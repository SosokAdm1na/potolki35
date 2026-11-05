// Единый вид бота: премиум-эмодзи, разделитель, цвета кнопок, карточка заявки и экраны.
import { InlineKeyboard } from 'grammy';
import type { Lead, LeadEvent, Member, Status } from './db.ts';

const EMOJI = {
  channel: { id: '5260268501515377807', fallback: '📣' },
  check: { id: '5260416304224936047', fallback: '✅' },
  cross: { id: '5258453452631056344', fallback: '❌' },
  money: { id: '5258204546391351475', fallback: '💰' },
  info: { id: '5258503720928288433', fallback: 'ℹ️' },
  note: { id: '5258215846450305872', fallback: '💬' },
  calc: { id: '5359629206948976159', fallback: '🔖' },
  stats: { id: '5258391025281408576', fallback: '📈' },
  user: { id: '5258362837411045098', fallback: '👤' },
  users: { id: '5258513401784573443', fallback: '👥' },
  settings: { id: '5258096772776991776', fallback: '⚙' },
  back: { id: '5258236805890710909', fallback: '⬅️' },
  next: { id: '5260450573768990626', fallback: '➡️' },
  warning: { id: '5258474669769497337', fallback: '❗️' },
  star: { id: '5260412365739925015', fallback: '⭐️' },
  plus: { id: '5258108352008823107', fallback: '➕' },
  refresh: { id: '5258420634785947640', fallback: '🔄' },
  timer: { id: '5258258882022612173', fallback: '⏲' },
  phone: { id: '5258020476977946656', fallback: '📞' },
  link: { id: '5260730055880876557', fallback: '⛓' },
  lock: { id: '5258476306152038031', fallback: '🔒' },
} as const;

type EmojiName = keyof typeof EMOJI;

export const em = (name: EmojiName) => `<tg-emoji emoji-id="${EMOJI[name].id}">${EMOJI[name].fallback}</tg-emoji>`;
const icon = (name: EmojiName) => EMOJI[name].id;

export const LINE = '━━━━━━━━━━━━━━';
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const STATUS: Record<Status, { label: string; plural: string; emoji: EmojiName }> = {
  new: { label: 'Новая', plural: 'Новые', emoji: 'star' },
  work: { label: 'В работе', plural: 'В работе', emoji: 'refresh' },
  measure: { label: 'Замер', plural: 'Замеры', emoji: 'timer' },
  install: { label: 'Монтаж', plural: 'Монтаж', emoji: 'settings' },
  done: { label: 'Готово', plural: 'Готово', emoji: 'check' },
  rejected: { label: 'Отказ', plural: 'Отказы', emoji: 'cross' },
};

export const REJECT_REASONS = ['Дорого', 'Передумал', 'Не дозвонились', 'Выбрал других', 'Спам', 'Другое'];

const TZ = 'Europe/Moscow'; // в Череповце московское время

export function when(iso: string, withTime = true): string {
  const opts: Intl.DateTimeFormatOptions = { timeZone: TZ, day: 'numeric', month: 'short' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return new Intl.DateTimeFormat('ru-RU', opts).format(new Date(iso)).replace('.', '').replace(' в ', ', ');
}

export const rub = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;

/** Дата и час по Москве в ISO. */
export function moscowIso(day: string, hour: number): string {
  return `${day}T${String(hour).padStart(2, '0')}:00:00+03:00`;
}

/** Ближайшие дни по Москве: [YYYY-MM-DD, подпись]. */
export function nextDays(count: number, from = new Date()): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getTime() + i * 86_400_000);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
    const date = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(d).replace('.', '');
    out.push([key, i === 0 ? `Сегодня, ${date.split(', ')[1]}` : i === 1 ? `Завтра, ${date.split(', ')[1]}` : date]);
  }
  return out;
}

const METHOD: Record<string, string> = { call: 'звонок', max: 'MAX' };

export function leadText(l: Lead, history: LeadEvent[], assignee?: Member): string {
  const out: string[] = [];
  out.push(`${em('channel')} <b>Заявка #${l.id}</b> · ${when(l.created_at)}`, LINE);
  out.push(`${em('user')} ${esc(l.name || 'Без имени')}`);
  out.push(`${em('phone')} <b>${esc(l.phone)}</b>${METHOD[l.method] ? ` · ${METHOD[l.method]}` : ''}`);
  const place = [l.district, l.address].filter(Boolean).join(', ');
  if (place) out.push(`${em('info')} ${esc(place)}`);
  const details = [l.area, l.object, l.timing].filter(Boolean).join(' · ');
  if (details) out.push(`${em('calc')} ${esc(details)}`);
  if (l.calc) out.push(`<blockquote expandable>${esc(l.calc)}</blockquote>`);
  if (l.comment) out.push(`${em('note')} ${esc(l.comment)}`);

  out.push(LINE);
  const s = STATUS[l.status];
  out.push(`${em(s.emoji)} <b>${s.label}</b>${assignee ? ` · ${esc(assignee.name)}` : ''}`);
  if (l.measure_at && (l.status === 'measure' || l.status === 'install')) out.push(`${em('timer')} Замер: ${when(l.measure_at)}`);
  if (l.status === 'rejected' && l.reject_reason) out.push(`${em('cross')} ${esc(l.reject_reason)}`);
  if (l.amount) out.push(`${em('money')} ${rub(l.amount)}`);
  out.push(`${em('link')} ${esc(l.channel)}`);
  if (l.page?.startsWith('https://vk.com/gim')) out.push(`${em('note')} <a href="${esc(l.page)}">Диалог в ВК</a>`);
  if (/^(https:\/\/t\.me\/|tg:\/\/user)/.test(l.page ?? '')) out.push(`${em('note')} <a href="${esc(l.page)}">Написать в Telegram</a>`);

  if (history.length) {
    const rows = history.map((e) => `${when(e.at)} ${e.actor_name ? `${esc(e.actor_name)}: ` : ''}${esc(e.text)}`);
    out.push(`<blockquote expandable>${rows.join('\n')}</blockquote>`);
  }
  return out.join('\n');
}

export function leadKeyboard(l: Lead, view: boolean): InlineKeyboard {
  const k = new InlineKeyboard();
  const a = (action: string) => `l:${l.id}:${action}`;
  switch (l.status) {
    case 'new':
      k.text('Взять в работу', a('take')).icon(icon('check')).success().row();
      k.text('Назначить замер', a('measure')).icon(icon('timer')).primary().row();
      break;
    case 'work':
      k.text('Назначить замер', a('measure')).icon(icon('timer')).success().row();
      break;
    case 'measure':
      k.text('Договорились на монтаж', a('install')).icon(icon('check')).success().row();
      k.text('Перенести замер', a('measure')).icon(icon('timer')).primary().row();
      break;
    case 'install':
      k.text('Готово', a('done')).icon(icon('check')).success().row();
      k.text('Сумма сделки', a('sum')).icon(icon('money')).primary().row();
      break;
    case 'done':
      k.text('Сумма сделки', a('sum')).icon(icon('money')).primary().row();
      k.text('Вернуть в работу', a('reopen')).icon(icon('refresh')).row();
      break;
    case 'rejected':
      k.text('Вернуть в работу', a('reopen')).icon(icon('refresh')).primary().row();
      break;
  }
  k.copyText('Номер', l.phone).icon(icon('phone'));
  k.text('Заметка', a('note')).icon(icon('note')).row();
  if (l.status !== 'done' && l.status !== 'rejected') k.text('Отказ', a('reject')).icon(icon('cross')).danger().row();
  if (view) k.text('Назад', `m:list:${l.status}:0`).icon(icon('back'));
  return k;
}

export function dayKeyboard(id: number, from?: Date): InlineKeyboard {
  const k = new InlineKeyboard();
  nextDays(8, from).forEach(([key, label], i) => {
    k.text(label, `l:${id}:day:${key}`);
    if (i % 2) k.row();
  });
  return k.text('Отмена', `l:${id}:cancel`).icon(icon('back'));
}

export function hourKeyboard(id: number, day: string): InlineKeyboard {
  const k = new InlineKeyboard();
  for (let h = 9; h <= 20; h++) {
    k.text(`${h}:00`, `l:${id}:time:${day}:${h}`);
    if ((h - 8) % 3 === 0) k.row();
  }
  return k.text('Другой день', `l:${id}:measure`).icon(icon('back'));
}

export function rejectKeyboard(id: number): InlineKeyboard {
  const k = new InlineKeyboard();
  REJECT_REASONS.forEach((r, i) => {
    k.text(r, `l:${id}:why:${i}`).danger();
    if (i % 2) k.row();
  });
  return k.text('Отмена', `l:${id}:cancel`).icon(icon('back'));
}

export function menuText(counts: Record<Status, number>): string {
  return [
    `${em('star')} <b>Потолки35 · заявки</b>`,
    LINE,
    `Новых: <b>${counts.new}</b>`,
    `В работе: <b>${counts.work}</b>`,
    `Замеров: <b>${counts.measure}</b>`,
    `На монтаже: <b>${counts.install}</b>`,
  ].join('\n');
}

export function menuKeyboard(counts: Record<Status, number>): InlineKeyboard {
  const k = new InlineKeyboard();
  k.text(`Новые · ${counts.new}`, 'm:list:new:0').icon(icon('star')).success().row();
  k.text(`В работе · ${counts.work}`, 'm:list:work:0').icon(icon('refresh')).primary();
  k.text(`Замеры · ${counts.measure}`, 'm:list:measure:0').icon(icon('timer')).primary().row();
  k.text(`Монтаж · ${counts.install}`, 'm:list:install:0').icon(icon('settings'));
  k.text('Архив', 'm:archive').icon(icon('calc')).row();
  k.text('Поиск', 'm:find').icon(icon('info'));
  k.text('Статистика', 'm:stats:7').icon(icon('stats'));
  return k;
}

export const PAGE = 8;

export function listTitle(status: Status, total: number): string {
  const s = STATUS[status];
  return `${em(s.emoji)} <b>${s.plural}</b> · ${total}\n${LINE}${total ? '' : '\nПока пусто'}`;
}

function leadRow(l: Lead): string {
  const when_ = l.status === 'measure' && l.measure_at ? when(l.measure_at) : `#${l.id}`;
  return `${when_} · ${l.name || 'Без имени'} · ${l.phone}`;
}

export function listKeyboard(leads: Lead[], status: Status, page: number, total: number): InlineKeyboard {
  const k = new InlineKeyboard();
  for (const l of leads) k.text(leadRow(l), `l:${l.id}:open`).row();
  if (page > 0) k.text('Назад', `m:list:${status}:${page - 1}`).icon(icon('back'));
  if ((page + 1) * PAGE < total) k.text('Дальше', `m:list:${status}:${page + 1}`).icon(icon('next'));
  if (page > 0 || (page + 1) * PAGE < total) k.row();
  return k.text('В меню', 'm:home').icon(icon('back'));
}

export function archiveKeyboard(counts: Record<Status, number>): InlineKeyboard {
  return new InlineKeyboard()
    .text(`Готово · ${counts.done}`, 'm:list:done:0').icon(icon('check')).success().row()
    .text(`Отказы · ${counts.rejected}`, 'm:list:rejected:0').icon(icon('cross')).danger().row()
    .text('В меню', 'm:home').icon(icon('back'));
}

export function searchKeyboard(leads: Lead[]): InlineKeyboard {
  const k = new InlineKeyboard();
  for (const l of leads) k.text(`#${l.id} · ${l.name || 'Без имени'} · ${STATUS[l.status].label}`, `l:${l.id}:open`).row();
  return k.text('В меню', 'm:home').icon(icon('back'));
}

export const PERIODS: Record<string, { label: string; days: number | null }> = {
  '1': { label: 'Сегодня', days: 1 },
  '7': { label: '7 дней', days: 7 },
  '30': { label: '30 дней', days: 30 },
  all: { label: 'Всё время', days: null },
};

export function statsText(period: string, rows: { channel: string; total: number; done: number; rejected: number; revenue: number }[]): string {
  const sum = (key: 'total' | 'done' | 'rejected' | 'revenue') => rows.reduce((n, r) => n + r[key], 0);
  const out = [`${em('stats')} <b>Статистика · ${PERIODS[period].label}</b>`, LINE];
  out.push(`Заявок: <b>${sum('total')}</b>`, `Готово: <b>${sum('done')}</b>`, `Отказов: <b>${sum('rejected')}</b>`, `Сумма сделок: <b>${rub(sum('revenue'))}</b>`);
  if (rows.length) {
    out.push(LINE, `${em('link')} <b>Источники</b>`);
    for (const r of rows) out.push(`${esc(r.channel)}: ${r.total}, готово ${r.done}${r.revenue ? `, ${rub(r.revenue)}` : ''}`);
  }
  return out.join('\n');
}

export function statsKeyboard(active: string): InlineKeyboard {
  const k = new InlineKeyboard();
  for (const key of Object.keys(PERIODS)) {
    k.text(PERIODS[key].label, `m:stats:${key}`);
    if (key === active) k.primary();
  }
  return k.row().text('В меню', 'm:home').icon(icon('back'));
}

export function cancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('Отмена', 'm:cancel').icon(icon('back'));
}

