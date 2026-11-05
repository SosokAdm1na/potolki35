// Логика бота: доступ, меню, движение заявки и рассылка карточек всей команде.
import { Bot, GrammyError, type Context, type InlineKeyboard } from 'grammy';
import type { Db, Lead, Member, Status } from './db.ts';
import * as ui from './ui.ts';

export interface BotOptions {
  token: string;
  admins: Set<number>; // единственные, у кого есть доступ
  apiRoot?: string;
}

const HTML = { parse_mode: 'HTML' } as const;
const STATUSES: Status[] = ['new', 'work', 'measure', 'install', 'done', 'rejected'];

const isNotModified = (e: unknown) => e instanceof GrammyError && e.description.includes('message is not modified');
const isGone = (e: unknown) => e instanceof GrammyError && /message to edit not found|message can't be edited|chat not found|bot was blocked/.test(e.description);

export function createBot(db: Db, opts: BotOptions) {
  const bot = new Bot(opts.token, opts.apiRoot ? { client: { apiRoot: opts.apiRoot } } : undefined);

  const cardText = (l: Lead) => ui.leadText(l, db.events(l.id), l.assignee_id ? db.member(l.assignee_id) : undefined);

  /** Обновляет карточку заявки у всех, у кого она открыта. */
  async function syncCards(id: number) {
    const lead = db.lead(id);
    if (!lead) return;
    const text = cardText(lead);
    for (const c of db.cards(id)) {
      try {
        await bot.api.editMessageText(c.chat_id, c.message_id, text, { ...HTML, reply_markup: ui.leadKeyboard(lead, c.kind === 'view') });
      } catch (e) {
        if (isGone(e)) db.dropCard(c.chat_id, c.message_id);
        else if (!isNotModified(e)) console.error(`Карточка #${id}:`, (e as Error).message);
      }
    }
  }

  /** Отправляет команде заявки, которые ещё не дошли. Сбой сети не теряет заявку: повтор на следующем круге. */
  async function deliver() {
    const people = db.members().filter((m) => opts.admins.has(m.tg_id));
    if (!people.length) return;
    for (const lead of db.undelivered()) {
      let ok = true;
      for (const m of people) {
        if (db.hasFeedCard(lead.id, m.tg_id)) continue;
        try {
          const msg = await bot.api.sendMessage(m.tg_id, cardText(lead), { ...HTML, reply_markup: ui.leadKeyboard(lead, false) });
          db.addCard({ lead_id: lead.id, chat_id: m.tg_id, message_id: msg.message_id, kind: 'feed' });
        } catch (e) {
          if (!isGone(e)) ok = false;
          console.error(`Отправка #${lead.id}:`, (e as Error).message);
        }
      }
      if (ok) db.update(lead.id, { delivered: 1 });
    }
  }

  async function show(ctx: Context, text: string, keyboard: InlineKeyboard) {
    try {
      await ctx.editMessageText(text, { ...HTML, reply_markup: keyboard });
    } catch (e) {
      if (!isNotModified(e)) throw e;
    }
  }

  /** Новое меню внизу чата, прошлое убирается. */
  async function sendMenu(ctx: Context, me: Member) {
    const counts = db.counts();
    const msg = await ctx.reply(ui.menuText(counts), { ...HTML, reply_markup: ui.menuKeyboard(counts) });
    if (me.screen_id) await ctx.api.deleteMessage(me.tg_id, me.screen_id).catch(() => {});
    db.setScreen(me.tg_id, msg.message_id);
  }

  async function showList(ctx: Context, status: Status, page: number) {
    const total = db.counts()[status];
    const leads = db.list(status, ui.PAGE, page * ui.PAGE);
    await show(ctx, ui.listTitle(status, total), ui.listKeyboard(leads, status, page, total));
  }

  async function ask(ctx: Context, me: Member, kind: 'note' | 'sum' | 'find', leadId: number | null, text: string) {
    const msg = await ctx.reply(text, { ...HTML, reply_markup: ui.cancelKeyboard() });
    db.setInput({ tg_id: me.tg_id, kind, lead_id: leadId, prompt_id: msg.message_id });
  }

  const team = new WeakMap<Context, Member>();

  // Только личные чаты и только ID из списка админов. Остальные видят одну фразу.
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== 'private' || !ctx.from) return;
    if (!opts.admins.has(ctx.from.id)) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery();
      else await ctx.reply(ui.lockText, HTML);
      return;
    }
    const known = db.member(ctx.from.id);
    const name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
    team.set(ctx, known?.active ? known : db.join(ctx.from.id, name, ctx.from.username ?? ''));
    await next();
    if (!known?.active) await deliver();
  });

  const member = (ctx: Context) => team.get(ctx)!;

  for (const cmd of ['start', 'menu']) bot.command(cmd, (ctx) => { db.clearInput(ctx.from!.id); return sendMenu(ctx, member(ctx)); });
  bot.command('find', (ctx) => ask(ctx, member(ctx), 'find', null, `${ui.em('info')} Напишите телефон, имя или адрес`));

  bot.callbackQuery(/^m:(.+)$/, async (ctx) => {
    const me = member(ctx);
    const [cmd, a, b] = ctx.match[1].split(':');
    if (cmd === 'home') {
      const counts = db.counts();
      await show(ctx, ui.menuText(counts), ui.menuKeyboard(counts));
      const c = db.card(ctx.chat!.id, ctx.msg!.message_id);
      if (c) db.dropCard(c.chat_id, c.message_id);
      db.setScreen(me.tg_id, ctx.msg!.message_id);
    } else if (cmd === 'list' && STATUSES.includes(a as Status)) {
      const c = db.card(ctx.chat!.id, ctx.msg!.message_id);
      if (c?.kind === 'view') db.dropCard(c.chat_id, c.message_id);
      await showList(ctx, a as Status, Number(b) || 0);
    } else if (cmd === 'archive') {
      const counts = db.counts();
      await show(ctx, `${ui.em('calc')} <b>Архив</b>\n${ui.LINE}`, ui.archiveKeyboard(counts));
    } else if (cmd === 'stats' && ui.PERIODS[a]) {
      const days = ui.PERIODS[a].days;
      const since = days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
      await show(ctx, ui.statsText(a, db.stats(since)), ui.statsKeyboard(a));
    } else if (cmd === 'find') {
      await ask(ctx, me, 'find', null, `${ui.em('info')} Напишите телефон, имя или адрес`);
    } else if (cmd === 'cancel') {
      db.clearInput(me.tg_id);
      await ctx.deleteMessage().catch(() => {});
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^l:(\d+):([a-z]+)(?::(.+))?$/, async (ctx) => {
    const me = member(ctx);
    const id = Number(ctx.match[1]);
    const action = ctx.match[2];
    const arg = ctx.match[3];
    const lead = db.lead(id);
    if (!lead) return ctx.answerCallbackQuery({ text: 'Заявка не найдена' });
    const chat = ctx.chat!.id;
    const message = ctx.msg!.message_id;
    const change = async (fields: Parameters<Db['update']>[1], log: string) => {
      db.update(id, fields);
      db.log(id, me.tg_id, log);
      await syncCards(id);
    };

    switch (action) {
      case 'open':
        db.addCard({ lead_id: id, chat_id: chat, message_id: message, kind: 'view' });
        await show(ctx, cardText(lead), ui.leadKeyboard(lead, true));
        break;
      case 'take':
        if (lead.assignee_id && lead.status !== 'new') {
          await ctx.answerCallbackQuery({ text: 'Заявку уже взяли', show_alert: true });
          await syncCards(id);
          return;
        }
        await change({ status: 'work', assignee_id: me.tg_id }, 'взял в работу');
        break;
      case 'measure':
        await ctx.editMessageReplyMarkup({ reply_markup: ui.dayKeyboard(id) });
        break;
      case 'day':
        await ctx.editMessageReplyMarkup({ reply_markup: ui.hourKeyboard(id, arg!) });
        break;
      case 'time': {
        const [day, hour] = [arg!.slice(0, 10), Number(arg!.slice(11))];
        const at = ui.moscowIso(day, hour);
        await change({ status: 'measure', measure_at: at, assignee_id: lead.assignee_id ?? me.tg_id }, `замер на ${ui.when(at)}`);
        break;
      }
      case 'install':
        await change({ status: 'install' }, 'договорились на монтаж');
        break;
      case 'done':
        await change({ status: 'done' }, 'готово');
        break;
      case 'reject':
        await ctx.editMessageReplyMarkup({ reply_markup: ui.rejectKeyboard(id) });
        break;
      case 'why': {
        const reason = ui.REJECT_REASONS[Number(arg)] ?? 'Другое';
        await change({ status: 'rejected', reject_reason: reason }, `отказ: ${reason}`);
        break;
      }
      case 'reopen':
        await change({ status: 'work', reject_reason: null, assignee_id: lead.assignee_id ?? me.tg_id }, 'вернул в работу');
        break;
      case 'cancel':
        await ctx.editMessageReplyMarkup({ reply_markup: ui.leadKeyboard(lead, db.card(chat, message)?.kind === 'view') });
        break;
      case 'note':
        await ask(ctx, me, 'note', id, `${ui.em('note')} Заметка к заявке #${id}. Напишите текст`);
        break;
      case 'sum':
        await ask(ctx, me, 'sum', id, `${ui.em('money')} Сумма сделки #${id}. Напишите число в рублях`);
        break;
    }
    await ctx.answerCallbackQuery().catch(() => {});
  });

  bot.on('message:text', async (ctx) => {
    const me = member(ctx);
    const text = ctx.message.text.trim();
    const pending = db.input(me.tg_id);
    const tidy = async () => {
      await ctx.deleteMessage().catch(() => {});
      if (pending?.prompt_id) await ctx.api.deleteMessage(me.tg_id, pending.prompt_id).catch(() => {});
    };

    if (pending?.kind === 'note' && pending.lead_id) {
      db.clearInput(me.tg_id);
      db.log(pending.lead_id, me.tg_id, text.slice(0, 500));
      await syncCards(pending.lead_id);
      return tidy();
    }
    if (pending?.kind === 'sum' && pending.lead_id) {
      const amount = Number(text.replace(/[^\d]/g, ''));
      if (!amount) return void (await ctx.reply(`${ui.em('warning')} Нужно число, например 25000`, HTML));
      db.clearInput(me.tg_id);
      db.update(pending.lead_id, { amount });
      db.log(pending.lead_id, me.tg_id, `сумма ${ui.rub(amount)}`);
      await syncCards(pending.lead_id);
      return tidy();
    }

    // Любой текст без ожидания считаем поиском: удобно просто вставить номер.
    db.clearInput(me.tg_id);
    const found = db.search(text);
    await tidy();
    await ctx.reply(found.length ? `${ui.em('info')} <b>Нашлось: ${found.length}</b>\n${ui.LINE}` : `${ui.em('info')} Ничего не нашлось`, { ...HTML, reply_markup: ui.searchKeyboard(found) });
  });

  bot.catch((e) => console.error('Ошибка обновления:', e.error));

  async function setup() {
    await bot.api.setMyCommands([
      { command: 'menu', description: 'Заявки' },
      { command: 'find', description: 'Поиск заявки' },
    ]);
    await bot.api.setChatMenuButton({ menu_button: { type: 'commands' } });
    await bot.api.setMyShortDescription('Рабочий бот заявок Потолки35');
    await bot.api.setMyDescription('Рабочий бот заявок Потолки35. Доступ закрыт.');
  }

  return { bot, deliver, syncCards, setup };
}
