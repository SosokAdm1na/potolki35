// Бот в сообщениях группы ВК: считает цену и принимает заявку на замер.
// Заявка попадает в ту же базу, что и с сайта, и приходит карточкой в Telegram.
// Диалог остаётся в ВК: на свободный текст бот не отвечает, а если человек из группы
// ответил клиенту сам, бот замолкает и не мешает разговору.
import { randomInt } from 'node:crypto';
import type { Db } from './db.ts';

// Те же цены, что в src/config.ts. Совпадение проверяет тест.
export const PRICES = {
  canvas: {
    matte: { label: 'Матовое', perM2: 900 },
    satin: { label: 'Сатиновое', perM2: 900 },
    gloss: { label: 'Глянцевое', perM2: 900 },
  },
  profile: {
    standard: { label: 'Стандартный', perM: 0 },
    shadow: { label: 'Теневой', perM: 650 },
    floating: { label: 'Парящий', perM: 1200 },
  },
  spotlight: 600,
  chandelier: 700,
  lightLine: 2900,
  pipe: 300,
  hiddenCornice: 2500,
  bathCurtain: 3000,
  minOrder: 7000,
  discountPercent: 10,
};

export const DISTRICTS = ['Зашекснинский', 'Заягорбский', 'Индустриальный', 'Северный', 'Череповецкий район', 'Другое'];

const SITE = 'https://xn--35-vlcherag2a.xn--p1ai';
const POLICY = 'https://потолки35.рф/politika/';
const HOUR = 3_600_000;
const SHORT_QUIET = 24 * HOUR; // после разговора с ботом не показываем меню на каждое сообщение
const LONG_QUIET = 7 * 24 * HOUR; // после заявки или ответа человека

type CanvasKey = keyof typeof PRICES.canvas;
type ProfileKey = keyof typeof PRICES.profile;
type Step = '' | 'area' | 'canvas' | 'profile' | 'rooms' | 'spots' | 'pipes' | 'phone' | 'district';

export interface Draft {
  area?: number;
  canvas?: CanvasKey;
  profile?: ProfileKey;
  rooms?: number;
  spots?: number;
  pipes?: number;
  phone?: string;
  calc?: string;
}

interface VkMessage {
  id?: number;
  conversation_message_id?: number;
  date?: number;
  from_id: number;
  peer_id: number;
  text?: string;
  payload?: string;
  admin_author_id?: number;
}

export interface VkUpdate {
  type: string;
  object: any;
}

type Call = (method: string, params: Record<string, string | number>) => Promise<any>;

export interface VkOptions {
  token: string;
  groupId: number;
  call?: Call; // подменяется в тестах
}

const rub = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;

export function estimate(d: Required<Pick<Draft, 'area' | 'canvas' | 'profile' | 'spots' | 'pipes'>> & { rooms?: number }) {
  const canvas = PRICES.canvas[d.canvas];
  const profile = PRICES.profile[d.profile];
  const rooms = d.rooms || 1;
  const perimeter = rooms * 4 * Math.sqrt(d.area / rooms); // комнаты считаем примерно квадратными
  const rows: [string, number][] = [[`${canvas.label} полотно, ${d.area} м²`, d.area * canvas.perM2]];
  if (profile.perM) rows.push([`${profile.label} профиль, ~${Math.round(perimeter)} м`, perimeter * profile.perM]);
  if (d.spots) rows.push([`Установка светильников × ${d.spots}`, d.spots * PRICES.spotlight]);
  if (d.pipes) rows.push([`Обход труб × ${d.pipes}`, d.pipes * PRICES.pipe]);
  let total = rows.reduce((sum, r) => sum + r[1], 0);
  if (total < PRICES.minOrder) {
    rows.push(['Минимальный заказ', PRICES.minOrder - total]);
    total = PRICES.minOrder;
  }
  return { rows, total, discounted: total * (1 - PRICES.discountPercent / 100) };
}

/** Приводит номер к виду сайта. Возвращает null, если это не российский номер. */
export function normalizePhone(text: string): string | null {
  let d = text.replace(/\D/g, '');
  if (d.length === 10) d = `7${d}`;
  if (d.length !== 11 || !/^[78]/.test(d)) return null;
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}

// --- клавиатура
type Color = 'primary' | 'secondary' | 'positive' | 'negative';
const btn = (label: string, payload: Record<string, string>, color: Color = 'secondary') => ({
  action: { type: 'text', label, payload: JSON.stringify(payload) },
  color,
});
const link = (label: string, url: string) => ({ action: { type: 'open_link', label, link: url } });
const keyboard = (rows: object[][]) => JSON.stringify({ one_time: false, inline: false, buttons: rows });

const CANCEL = [btn('Отмена', { a: 'menu' }, 'negative')];
const menuKeys = keyboard([
  [btn('Рассчитать цену', { a: 'calc' }, 'primary')],
  [btn('Заказать замер', { a: 'lead' }, 'positive')],
  [btn('Цены', { a: 'prices' }), link('Примеры работ', `${SITE}/raboty/`)],
]);
const cancelKeys = keyboard([CANCEL]);
const choice = (items: [string, string][], perRow = 3) => {
  const rows: object[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow).map(([label, v]) => btn(label, { v })));
  return keyboard([...rows, CANCEL]);
};
const count = (labels: string[]) => choice(labels.map((n) => [n, n]), 5);

const MENU_TEXT = 'Здравствуйте! Это Потолки35, натяжные потолки в Череповце и районе.\n\nЗдесь можно посчитать цену и заказать замер. Вопросы пишите прямо в этот диалог.';
const PRICES_TEXT = [
  'Цены:',
  '',
  `Полотно с работой: от ${rub(PRICES.canvas.matte.perM2)}/м²`,
  `Теневой профиль: +${rub(PRICES.profile.shadow.perM)}/м`,
  `Парящий профиль: +${rub(PRICES.profile.floating.perM)}/м`,
  `Точечный светильник: ${rub(PRICES.spotlight)}`,
  `Люстра: от ${rub(PRICES.chandelier)}`,
  `Световая линия: ${rub(PRICES.lightLine)}/м`,
  `Обход трубы: ${rub(PRICES.pipe)}`,
  `Скрытый карниз ПК-14: от ${rub(PRICES.hiddenCornice)}/м`,
  `Гардина в ванную АМ-1: от ${rub(PRICES.bathCurtain)}/м`,
  '',
  `Минимальный заказ: ${rub(PRICES.minOrder)}`,
].join('\n');

const ASK: Record<Exclude<Step, ''>, [string, string]> = {
  area: ['Какая площадь потолка в м²? Напишите число, например 18.', cancelKeys],
  canvas: ['Какое полотно нужно?', choice(Object.entries(PRICES.canvas).map(([k, c]) => [c.label, k]))],
  profile: ['Какой профиль?', choice(Object.entries(PRICES.profile).map(([k, p]) => [p.label, k]))],
  rooms: ['Сколько комнат?', count(['1', '2', '3', '4', '5'])],
  spots: ['Сколько точечных светильников? Можно нажать кнопку или написать число.', count(['0', '2', '4', '6', '8'])],
  pipes: ['Сколько труб обходить?', count(['0', '1', '2', '3', '4'])],
  phone: [`Напишите номер телефона, мы перезвоним и договоримся о замере.\n\nОтправляя номер, вы соглашаетесь с обработкой данных: ${POLICY}`, cancelKeys],
  district: ['Какой район?', choice(DISTRICTS.map((d, i) => [d, String(i)]), 2)],
};

function parsePayload(raw?: string): Record<string, string> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

export function createVk(db: Db, opts: VkOptions) {
  const call: Call = opts.call ?? (async (method, params) => {
    const body = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), access_token: opts.token, v: '5.199' });
    const res = await fetch(`https://api.vk.ru/method/${method}`, { method: 'POST', body, signal: AbortSignal.timeout(15_000) });
    const json = (await res.json()) as { response?: unknown; error?: { error_code: number; error_msg: string } };
    if (json.error) throw new Error(`${method}: ${json.error.error_code} ${json.error.error_msg}`);
    return json.response;
  });

  const send = (peer: number, message: string, keys: string) =>
    call('messages.send', { peer_id: peer, random_id: randomInt(1, 2 ** 31 - 1), message, keyboard: keys, dont_parse_links: 1 });

  const ask = async (peer: number, step: Exclude<Step, ''>, data: Draft, hint = '') => {
    db.saveVkDialog(peer, step, JSON.stringify(data), Date.now() + SHORT_QUIET);
    const [text, keys] = ASK[step];
    await send(peer, hint ? `${hint}\n\n${text}` : text, keys);
  };

  const menu = async (peer: number, text = MENU_TEXT, data: Draft = {}) => {
    db.saveVkDialog(peer, '', JSON.stringify(data), Date.now() + SHORT_QUIET);
    await send(peer, text, menuKeys);
  };

  const showEstimate = async (peer: number, d: Draft) => {
    const e = estimate(d as Parameters<typeof estimate>[0]);
    const rows = e.rows.map(([label, sum]) => `${label}: ${rub(sum)}`);
    const calc = [...rows, `Итого ≈ ${rub(e.total)} (со скидкой ${rub(e.discounted)})`].join('\n');
    db.saveVkDialog(peer, '', JSON.stringify({ area: d.area, calc } satisfies Draft), Date.now() + SHORT_QUIET);
    await send(
      peer,
      `Примерный расчёт:\n\n${rows.join('\n')}\n\nИтого: ≈ ${rub(e.total)}\nСо скидкой ${PRICES.discountPercent}% по заявке: ≈ ${rub(e.discounted)}\n\nЛюстры, световые линии и карнизы посчитаем на замере. Точная цена будет после него.`,
      keyboard([
        [btn('Заказать замер', { a: 'lead' }, 'positive')],
        [btn('Пересчитать', { a: 'calc' }), btn('В меню', { a: 'menu' })],
      ]),
    );
  };

  const clientName = async (id: number) => {
    try {
      const [user] = (await call('users.get', { user_ids: id })) as { first_name?: string; last_name?: string }[];
      return [user?.first_name, user?.last_name].filter(Boolean).join(' ');
    } catch (e) {
      console.error('Имя из ВК:', (e as Error).message);
      return '';
    }
  };

  const finish = async (m: VkMessage, d: Draft, district: string) => {
    const peer = m.peer_id;
    const created = new Date((m.date ?? Date.now() / 1000) * 1000).toISOString();
    db.addLead({
      ext: `vk|${peer}|${created}`,
      created_at: created,
      name: await clientName(m.from_id),
      phone: d.phone!,
      phone_digits: d.phone!.replace(/\D/g, ''),
      method: 'call',
      area: d.area ? `${d.area} м²` : '',
      object: '',
      timing: '',
      district,
      address: '',
      comment: '',
      calc: d.calc ?? '',
      form: 'Бот ВК',
      page: `https://vk.com/gim${opts.groupId}?sel=${peer}`,
      channel: 'ВКонтакте',
      utm: '{}',
    });
    db.saveVkDialog(peer, '', '{}', Date.now() + LONG_QUIET);
    await send(peer, 'Заявка принята. Мы перезвоним и договоримся о замере. Если появятся вопросы, пишите сюда.', menuKeys);
  };

  const step = async (m: VkMessage, current: Exclude<Step, ''>, d: Draft, value: string) => {
    const peer = m.peer_id;
    const cleaned = value.replace(',', '.').replace(/[^\d.]/g, '');
    const number = cleaned ? Number(cleaned) : NaN;
    const whole = Number.isInteger(number) && number <= 100;
    switch (current) {
      case 'area':
        if (!(number >= 3 && number <= 300)) return ask(peer, 'area', d, 'Нужно число от 3 до 300.');
        return ask(peer, 'canvas', { ...d, area: number });
      case 'canvas':
        if (!Object.hasOwn(PRICES.canvas, value)) return ask(peer, 'canvas', d, 'Выберите кнопкой.');
        return ask(peer, 'profile', { ...d, canvas: value as CanvasKey });
      case 'profile':
        if (!Object.hasOwn(PRICES.profile, value)) return ask(peer, 'profile', d, 'Выберите кнопкой.');
        return ask(peer, value === 'standard' ? 'spots' : 'rooms', { ...d, profile: value as ProfileKey });
      case 'rooms':
        if (!whole || number < 1 || number > 20) return ask(peer, 'rooms', d, 'Нужно число комнат.');
        return ask(peer, 'spots', { ...d, rooms: number });
      case 'spots':
        if (!whole) return ask(peer, 'spots', d, 'Нужно число.');
        return ask(peer, 'pipes', { ...d, spots: number });
      case 'pipes':
        if (!whole) return ask(peer, 'pipes', d, 'Нужно число.');
        return showEstimate(peer, { ...d, pipes: number });
      case 'phone': {
        const phone = normalizePhone(value);
        if (!phone) return ask(peer, 'phone', d, 'Не получилось разобрать номер. Пример: 8 921 000-00-00.');
        return ask(peer, 'district', { ...d, phone });
      }
      case 'district': {
        const district = DISTRICTS[Number(value)] ?? DISTRICTS.find((x) => x.toLowerCase() === value.trim().toLowerCase());
        if (!district) return ask(peer, 'district', d, 'Выберите кнопкой.');
        return finish(m, d, district);
      }
    }
  };

  async function handle(update: VkUpdate) {
    if (update.type === 'message_reply') {
      const reply = update.object as VkMessage;
      // Ответ человека из группы: бот выходит из разговора. Свои сообщения бота сюда не попадают.
      if (reply.admin_author_id) db.saveVkDialog(reply.peer_id, '', '{}', Date.now() + LONG_QUIET);
      return;
    }
    if (update.type !== 'message_new') return;

    const m = update.object.message as VkMessage;
    if (m.from_id <= 0 || m.peer_id !== m.from_id) return; // только личные диалоги с людьми
    const peer = m.peer_id;
    const dialog = db.vkDialog(peer);
    const data = JSON.parse(dialog?.data ?? '{}') as Draft;
    const payload = parsePayload(m.payload);
    const command = payload.command === 'start' ? 'menu' : payload.a;

    if (command === 'menu') return menu(peer, MENU_TEXT, data.calc ? data : {});
    if (command === 'calc') return ask(peer, 'area', {});
    if (command === 'lead') return ask(peer, 'phone', { area: data.area, calc: data.calc });
    if (command === 'prices') return menu(peer, PRICES_TEXT, data);

    const current = (dialog?.step ?? '') as Step;
    if (current) return step(m, current, data, payload.v ?? m.text ?? '');

    // Свободный текст вне сценария: это разговор с людьми, поэтому бот показывается только один раз.
    if (Date.now() >= (dialog?.quiet_until ?? 0)) await menu(peer, MENU_TEXT, data);
  }

  async function run(signal: AbortSignal) {
    const pause = () => new Promise((done) => setTimeout(done, 5000));
    while (!signal.aborted) {
      try {
        const server = (await call('groups.getLongPollServer', { group_id: opts.groupId })) as { server: string; key: string; ts: string };
        let ts = db.getMeta('vk_ts') || server.ts; // после простоя забираем то, что накопилось
        while (!signal.aborted) {
          const url = `${server.server}?act=a_check&key=${server.key}&ts=${ts}&wait=25`;
          const res = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(35_000)]) });
          const poll = (await res.json()) as { ts?: string; updates?: VkUpdate[]; failed?: number };
          if (poll.failed === 1) {
            ts = String(poll.ts);
            continue;
          }
          if (poll.failed === 3) db.setMeta('vk_ts', '');
          if (poll.failed) break; // нужен новый ключ
          for (const update of poll.updates ?? []) {
            await handle(update).catch((e) => console.error('Сообщение ВК:', (e as Error).message));
          }
          ts = String(poll.ts);
          db.setMeta('vk_ts', ts);
        }
      } catch (e) {
        if (signal.aborted) return;
        console.error('Связь с ВК:', (e as Error).message);
        await pause();
      }
    }
  }

  return { handle, run };
}
