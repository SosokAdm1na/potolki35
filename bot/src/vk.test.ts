import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from './db.ts';
import { createVk, DISTRICTS, estimate, normalizePhone, PRICES } from './vk.ts';
import { leadText } from './ui.ts';
import { districts, prices, site } from '../../src/config.ts';

const PEER = 555;

function setup() {
  const db = new Db(join(mkdtempSync(join(tmpdir(), 'p35vk-')), 'bot.db'));
  const sent: { peer_id: number; message: string; keyboard: string }[] = [];
  const vk = createVk(db, {
    token: 'x',
    groupId: 77,
    call: async (method, params) => {
      if (method === 'users.get') return [{ first_name: 'Ирина', last_name: 'К.' }];
      if (method === 'messages.send') sent.push(params as any);
      return 1;
    },
  });
  let id = 0;
  const msg = (text: string, payload?: object, from = PEER) => vk.handle({
    type: 'message_new',
    object: { message: { id: ++id, date: 1_790_000_000 + id, from_id: from, peer_id: from, text, payload: payload && JSON.stringify(payload) } },
  });
  return { db, vk, sent, msg, last: () => sent.at(-1)!.message };
}

test('цены и районы совпадают с сайтом', () => {
  const { discountPercent, ...own } = PRICES;
  const strip = (group: Record<string, any>) => Object.fromEntries(Object.entries(group).map(([k, { note, ...rest }]) => [k, rest]));
  assert.deepEqual(own, { ...prices, profile: strip(prices.profile), canvas: strip(prices.canvas) });
  assert.equal(discountPercent, site.discountPercent);
  assert.deepEqual(DISTRICTS, districts);
});

test('расчёт такой же, как в калькуляторе сайта', () => {
  const e = estimate({ area: 16, canvas: 'matte', profile: 'floating', rooms: 1, spots: 4, pipes: 1 });
  assert.equal(e.total, 16 * 900 + 16 * 1200 + 4 * 600 + 300);
  assert.equal(e.discounted, e.total * 0.9);
  const small = estimate({ area: 3, canvas: 'gloss', profile: 'standard', spots: 0, pipes: 0 });
  assert.equal(small.total, 7000);
});

test('номер телефона', () => {
  assert.equal(normalizePhone('8 921 000-00-00'), '+7 (921) 000-00-00');
  assert.equal(normalizePhone('9210000000'), '+7 (921) 000-00-00');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone('19210000000'), null);
});

test('расчёт и заявка: карточка получает всё, диалог остаётся в ВК', async () => {
  const t = setup();
  await t.msg('Начать', { command: 'start' });
  assert.match(t.last(), /Потолки35/);
  await t.msg('Рассчитать цену', { a: 'calc' });
  await t.msg('сколько стоит');
  assert.match(t.last(), /от 3 до 300/);
  await t.msg('18,5');
  await t.msg('Матовое', { v: 'matte' });
  await t.msg('Парящий', { v: 'floating' });
  await t.msg('2', { v: '2' });
  await t.msg('4', { v: '4' });
  await t.msg('1', { v: '1' });
  assert.match(t.last(), /Примерный расчёт/);
  await t.msg('Заказать замер', { a: 'lead' });
  assert.match(t.last(), /politika/);
  await t.msg('не помню');
  assert.match(t.last(), /разобрать номер/);
  await t.msg('89210000000');
  await t.msg('Северный', { v: '3' });
  assert.match(t.last(), /Заявка принята/);

  const lead = t.db.lead(1)!;
  assert.equal(lead.name, 'Ирина К.');
  assert.equal(lead.phone, '+7 (921) 000-00-00');
  assert.equal(lead.district, 'Северный');
  assert.equal(lead.channel, 'ВКонтакте');
  assert.equal(lead.area, '18.5 м²');
  assert.match(lead.calc, /Парящий профиль/);
  assert.equal(lead.delivered, 0, 'заявка ждёт отправки в Telegram');
  assert.match(leadText(lead, []), /href="https:\/\/vk\.com\/gim77\?sel=555"/);

  const before = t.sent.length;
  await t.msg('А когда приедете?');
  assert.equal(t.sent.length, before, 'после заявки бот молчит');
});

test('заявка сразу из меню, без расчёта', async () => {
  const t = setup();
  await t.msg('Заказать замер', { a: 'lead' });
  await t.msg('+7 921 000 00 00');
  await t.msg('другое');
  assert.equal(t.db.lead(1)!.district, 'Другое');
  assert.equal(t.db.lead(1)!.calc, '');
});

test('свободный текст: меню один раз, потом разговор людей', async () => {
  const t = setup();
  await t.msg('Здравствуйте, вы в Шексне работаете?');
  assert.equal(t.sent.length, 1);
  await t.msg('Алло');
  assert.equal(t.sent.length, 1);
});

test('ответ человека из группы останавливает бота посреди сценария', async () => {
  const t = setup();
  await t.msg('Рассчитать цену', { a: 'calc' });
  const before = t.sent.length;
  await t.vk.handle({ type: 'message_reply', object: { peer_id: PEER, from_id: -77, admin_author_id: 9, text: 'Добрый день' } });
  await t.msg('20');
  assert.equal(t.sent.length, before);
  await t.msg('Рассчитать цену', { a: 'calc' });
  assert.equal(t.sent.length, before + 1, 'кнопки продолжают работать');
});

test('сообщение самого бота не останавливает сценарий', async () => {
  const t = setup();
  await t.msg('Рассчитать цену', { a: 'calc' });
  await t.vk.handle({ type: 'message_reply', object: { peer_id: PEER, from_id: -77, text: 'Какая площадь' } });
  await t.msg('20');
  assert.match(t.last(), /полотно/);
});

test('слово вместо числа не считается нулём', async () => {
  const t = setup();
  await t.msg('x', { a: 'calc' });
  await t.msg('20');
  await t.msg('Матовое', { v: 'matte' });
  await t.msg('Стандартный', { v: 'standard' });
  await t.msg('штук пять');
  assert.match(t.last(), /Нужно число/);
});

test('подделанная кнопка и сообщения не от людей', async () => {
  const t = setup();
  await t.msg('x', { a: 'calc' });
  await t.msg('20');
  await t.msg('x', { v: 'constructor' });
  assert.match(t.last(), /Выберите кнопкой/);
  const before = t.sent.length;
  await t.vk.handle({ type: 'message_new', object: { message: { from_id: 5, peer_id: 2_000_000_001, text: 'беседа' } } });
  await t.vk.handle({ type: 'message_new', object: { message: { from_id: -5, peer_id: -5, text: 'группа' } } });
  assert.equal(t.sent.length, before);
});
