// Общий сценарий для клиентов: расчёт цены и заявка на замер. ВК и Telegram отличаются
// только доставкой сообщений и текстами. Заявка попадает в ту же базу, что и с сайта.
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
const HOME = 'https://потолки35.рф/';
const POLICY = `${HOME}politika/`;
export const PHONE = '+7 (965) 744-14-44';
export const ABOUT = 'Это Потолки35, мы занимаемся установкой качественных, современных натяжных потолков.';
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

// Кнопки описаны без привязки к площадке. a: команда, v: ответ на вопрос, url: ссылка.
export type Color = 'primary' | 'secondary' | 'positive' | 'negative';
export interface Key {
  label: string;
  a?: string;
  v?: string;
  url?: string;
  color?: Color;
}
export type Keys = Key[][];

export interface Client {
  name: string;
  link: string; // откуда в карточке можно перейти к клиенту
}

export interface Incoming {
  peer: number;
  text?: string;
  a?: string;
  v?: string;
  date?: number; // секунды
  client?: Client;
}

export interface FlowOptions {
  channel: 'vk' | 'tg';
  source: string; // канал в статистике
  form: string;
  greeting: string;
  done: string;
  conversation: boolean; // люди ведут здесь диалог: на свободный текст бот почти не отвечает
  send: (peer: number, text: string, keys: Keys) => Promise<unknown>;
  client?: (peer: number) => Promise<Client>;
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

const CANCEL: Key[] = [{ label: 'Отмена', a: 'menu', color: 'negative' }];
const MENU_KEYS: Keys = [
  [{ label: 'Рассчитать цену', a: 'calc', color: 'primary' }],
  [{ label: 'Заказать замер', a: 'lead', color: 'positive' }],
  [{ label: 'Цены', a: 'prices' }, { label: 'Примеры работ', url: `${SITE}/raboty/` }],
];
const RESULT_KEYS: Keys = [
  [{ label: 'Заказать замер', a: 'lead', color: 'positive' }],
  [{ label: 'Пересчитать', a: 'calc' }, { label: 'В меню', a: 'menu' }],
];
const choice = (items: [string, string][], perRow = 3): Keys => {
  const rows: Keys = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow).map(([label, v]) => ({ label, v })));
  return [...rows, CANCEL];
};
const count = (labels: string[]) => choice(labels.map((n) => [n, n]), 5);

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
  `Точную цену поможем определить по звонку ${PHONE} или по заявке на сайте: ${HOME}`,
].join('\n');

const ASK: Record<Exclude<Step, ''>, [string, Keys]> = {
  area: ['Какая площадь потолка в м²? Напишите число, например 18.', [CANCEL]],
  canvas: ['Какое полотно нужно?', choice(Object.entries(PRICES.canvas).map(([k, c]) => [c.label, k]))],
  profile: ['Какой профиль?', choice(Object.entries(PRICES.profile).map(([k, p]) => [p.label, k]))],
  rooms: ['Сколько комнат?', count(['1', '2', '3', '4', '5'])],
  spots: ['Сколько точечных светильников? Можно нажать кнопку или написать число.', count(['0', '2', '4', '6', '8'])],
  pipes: ['Сколько труб обходить?', count(['0', '1', '2', '3', '4'])],
  phone: [`Напишите номер телефона, мы перезвоним и договоримся о замере.\n\nОтправляя номер, вы соглашаетесь с обработкой данных: ${POLICY}`, [CANCEL]],
  district: ['Какой район?', choice(DISTRICTS.map((d, i) => [d, String(i)]), 2)],
};

export function createFlow(db: Db, o: FlowOptions) {
  const save = (peer: number, step: Step, data: Draft, quiet: number) =>
    db.saveDialog(o.channel, peer, step, JSON.stringify(data), Date.now() + quiet);

  const ask = async (peer: number, step: Exclude<Step, ''>, data: Draft, hint = '') => {
    save(peer, step, data, SHORT_QUIET);
    const [text, keys] = ASK[step];
    await o.send(peer, hint ? `${hint}\n\n${text}` : text, keys);
  };

  const menu = async (peer: number, text: string, data: Draft = {}) => {
    save(peer, '', data, SHORT_QUIET);
    await o.send(peer, text, MENU_KEYS);
  };

  const showEstimate = async (peer: number, d: Draft) => {
    const e = estimate(d as Parameters<typeof estimate>[0]);
    const rows = e.rows.map(([label, sum]) => `${label}: ${rub(sum)}`);
    const calc = [...rows, `Итого ≈ ${rub(e.total)} (со скидкой ${rub(e.discounted)})`].join('\n');
    save(peer, '', { area: d.area, calc }, SHORT_QUIET);
    await o.send(
      peer,
      `Примерный расчёт:\n\n${rows.join('\n')}\n\nИтого: ≈ ${rub(e.total)}\nСо скидкой ${PRICES.discountPercent}% по заявке: ≈ ${rub(e.discounted)}\n\nЛюстры, световые линии и карнизы посчитаем на замере. Точная цена будет после него.`,
      RESULT_KEYS,
    );
  };

  const finish = async (m: Incoming, d: Draft, district: string) => {
    const peer = m.peer;
    const created = new Date((m.date ?? Date.now() / 1000) * 1000).toISOString();
    const client = m.client ?? (await o.client!(peer));
    db.addLead({
      ext: `${o.channel}|${peer}|${created}`,
      created_at: created,
      name: client.name,
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
      form: o.form,
      page: client.link,
      channel: o.source,
      utm: '{}',
    });
    save(peer, '', {}, LONG_QUIET);
    await o.send(peer, o.done, MENU_KEYS);
  };

  const step = async (m: Incoming, current: Exclude<Step, ''>, d: Draft, value: string) => {
    const peer = m.peer;
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

  async function handle(m: Incoming) {
    const peer = m.peer;
    const dialog = db.dialog(o.channel, peer);
    const data = JSON.parse(dialog?.data ?? '{}') as Draft;

    if (m.a === 'menu') return menu(peer, o.greeting, data.calc ? data : {});
    if (m.a === 'calc') return ask(peer, 'area', {});
    if (m.a === 'lead') return ask(peer, 'phone', { area: data.area, calc: data.calc });
    if (m.a === 'prices') return menu(peer, PRICES_TEXT, data);

    const current = (dialog?.step ?? '') as Step;
    if (current) return step(m, current, data, m.v ?? m.text ?? '');

    // Свободный текст вне сценария. Где диалог ведут люди, бот показывается только один раз.
    if (!o.conversation || Date.now() >= (dialog?.quiet_until ?? 0)) await menu(peer, o.greeting, data);
  }

  /** Человек ответил клиенту сам: бот выходит из разговора. */
  const silence = (peer: number) => save(peer, '', {}, LONG_QUIET);

  return { handle, silence };
}
