import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from './db.ts';
import { createBot } from './bot.ts';
import { channelOf, pullLeads } from './intake.ts';
import { leadText, moscowIso, nextDays, when } from './ui.ts';

const A = 111, B = 222, STRANGER = 333;

function setup(fail?: () => boolean) {
  const dir = mkdtempSync(join(tmpdir(), 'p35-'));
  const db = new Db(join(dir, 'bot.db'));
  const file = join(dir, 'leads.jsonl');
  const app = createBot(db, { token: '1:test', invite: 'secret' });
  const calls: { method: string; payload: any }[] = [];
  let nextId = 1000;
  app.bot.botInfo = { id: 1, is_bot: true, first_name: 'T', username: 'test_bot', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false } as any;
  app.bot.api.config.use(async (_prev, method, payload) => {
    if (fail?.() && method === 'sendMessage') throw new Error('network');
    calls.push({ method, payload });
    if (method === 'sendMessage') return { ok: true, result: { message_id: ++nextId, date: 0, chat: { id: (payload as any).chat_id, type: 'private' } } } as any;
    return { ok: true, result: true } as any;
  });
  let update = 0;
  const from = (id: number) => ({ id, is_bot: false, first_name: `U${id}` });
  const chat = (id: number) => ({ id, type: 'private', first_name: `U${id}` });
  const say = (id: number, text: string) => app.bot.handleUpdate({
    update_id: ++update,
    message: { message_id: ++nextId, date: 0, chat: chat(id), from: from(id), text, entities: text.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] : undefined },
  } as any);
  const press = (id: number, data: string, messageId: number) => app.bot.handleUpdate({
    update_id: ++update,
    callback_query: { id: String(update), from: from(id), chat_instance: 'x', data, message: { message_id: messageId, date: 0, chat: chat(id), text: 'x' } },
  } as any);
  return { db, file, app, calls, say, press };
}

const site = (over = {}) => JSON.stringify({ id: 'ABCDE', createdAt: '2026-11-05T11:32:00.000Z', name: 'Ирина <b>', phone: '+7 (921) 000-00-00', method: 'call', area: '', object: '', timing: '', district: 'Зашекснинский', address: 'Ленина 10', comment: '', calc: '18 м²', source: 'Калькулятор', page: '/', utm: { utm_source: 'yandex' }, ...over }) + '\n';

test('чужой не проходит, по приглашению входит, первый становится админом', async () => {
  const t = setup();
  await t.say(STRANGER, '/menu');
  assert.equal(t.db.member(STRANGER), undefined);
  assert.match(t.calls.at(-1)!.payload.text, /только по приглашению/);
  await t.say(A, '/start secret');
  await t.say(B, '/start secret');
  assert.equal(t.db.member(A)!.role, 'admin');
  assert.equal(t.db.member(B)!.role, 'member');
  await t.say(STRANGER, '/start wrong');
  assert.equal(t.db.member(STRANGER), undefined);
});

test('заявка из файла приходит всем один раз, неполная строка ждёт', async () => {
  const t = setup();
  await t.say(A, '/start secret');
  await t.say(B, '/start secret');
  writeFileSync(t.file, site() + '{"id":"PART');
  assert.deepEqual(await pullLeads(t.db, t.file), [1]);
  await t.app.deliver();
  await t.app.deliver();
  const sent = t.calls.filter((c) => c.method === 'sendMessage' && /Заявка #1/.test(c.payload.text));
  assert.equal(sent.length, 2);
  assert.ok(sent[0].payload.text.includes('Ирина &lt;b&gt;'), 'текст экранируется');
  assert.deepEqual(await pullLeads(t.db, t.file), []);
  appendFileSync(t.file, 'IAL","createdAt":"2026-11-05T12:00:00.000Z","phone":"+7 (900) 111-22-33"}\n');
  assert.deepEqual(await pullLeads(t.db, t.file), [2]);
});

test('сбой Telegram не теряет заявку', async () => {
  let down = false;
  const t = setup(() => down);
  await t.say(A, '/start secret');
  writeFileSync(t.file, site());
  await pullLeads(t.db, t.file);
  down = true;
  await t.app.deliver();
  assert.equal(t.db.lead(1)!.delivered, 0);
  down = false;
  await t.app.deliver();
  assert.equal(t.db.lead(1)!.delivered, 1);
});

test('заявка проходит весь путь, карточки обновляются у всех', async () => {
  const t = setup();
  await t.say(A, '/start secret');
  await t.say(B, '/start secret');
  writeFileSync(t.file, site());
  await pullLeads(t.db, t.file);
  await t.app.deliver();
  const cardA = t.db.cards(1).find((c) => c.chat_id === A)!;
  const cardB = t.db.cards(1).find((c) => c.chat_id === B)!;

  await t.press(A, 'l:1:take', cardA.message_id);
  assert.equal(t.db.lead(1)!.status, 'work');
  assert.equal(t.db.lead(1)!.assignee_id, A);
  const edits = t.calls.filter((c) => c.method === 'editMessageText');
  assert.deepEqual(edits.map((e) => e.payload.chat_id).sort(), [A, B]);

  await t.press(B, 'l:1:take', cardB.message_id);
  assert.equal(t.db.lead(1)!.assignee_id, A, 'второй не перехватывает заявку');

  await t.press(A, 'l:1:time:2026-11-07:15', cardA.message_id);
  assert.equal(t.db.lead(1)!.status, 'measure');
  assert.equal(new Date(t.db.lead(1)!.measure_at!).toISOString(), '2026-11-07T12:00:00.000Z');

  await t.press(A, 'l:1:note', cardA.message_id);
  await t.say(A, 'Просит звонить после 18:00');
  assert.equal(t.db.input(A), undefined);
  assert.ok(t.db.events(1).some((e) => e.text === 'Просит звонить после 18:00'));

  await t.press(A, 'l:1:install', cardA.message_id);
  await t.press(A, 'l:1:sum', cardA.message_id);
  await t.say(A, 'нет');
  assert.equal(t.db.lead(1)!.amount, null);
  await t.say(A, '25 000 ₽');
  assert.equal(t.db.lead(1)!.amount, 25000);
  await t.press(A, 'l:1:done', cardA.message_id);
  assert.equal(t.db.lead(1)!.status, 'done');

  const [row] = t.db.stats(null);
  assert.deepEqual({ ...row }, { channel: 'Яндекс Директ', total: 1, done: 1, rejected: 0, revenue: 25000 });
});

test('отказ с причиной и возврат', async () => {
  const t = setup();
  await t.say(A, '/start secret');
  writeFileSync(t.file, site());
  await pullLeads(t.db, t.file);
  await t.app.deliver();
  const c = t.db.cards(1)[0];
  await t.press(A, 'l:1:why:0', c.message_id);
  assert.equal(t.db.lead(1)!.reject_reason, 'Дорого');
  await t.press(A, 'l:1:reopen', c.message_id);
  assert.equal(t.db.lead(1)!.status, 'work');
  assert.equal(t.db.lead(1)!.reject_reason, null);
});

test('поиск по телефону и кириллице', async () => {
  const t = setup();
  await t.say(A, '/start secret');
  writeFileSync(t.file, site());
  await pullLeads(t.db, t.file);
  assert.equal(t.db.search('921 000').length, 1);
  assert.equal(t.db.search('ирина').length, 1);
  assert.equal(t.db.search('ЛЕНИНА').length, 1);
  assert.equal(t.db.search('петров').length, 0);
  await t.say(A, '9210000');
  assert.match(t.calls.filter((c) => c.method === 'sendMessage').at(-1)!.payload.text, /Нашлось: 1/);
});

test('команда: участник не видит управление, админ убирает', async () => {
  const t = setup();
  await t.say(A, '/start secret');
  await t.say(B, '/start secret');
  await t.press(B, `m:kick:${A}`, 1);
  assert.equal(t.db.member(A)!.active, 1);
  await t.press(A, `m:kick:${B}`, 1);
  assert.equal(t.db.member(B)!.active, 0);
  await t.say(B, '/menu');
  assert.match(t.calls.at(-1)!.payload.text, /только по приглашению/);
});

test('вид и даты', () => {
  assert.equal(channelOf({ referrer: 'https://yandex.ru/' }), 'Поиск Яндекса');
  assert.equal(channelOf({}), 'Прямой заход');
  assert.equal(moscowIso('2026-11-07', 9), '2026-11-07T09:00:00+03:00');
  assert.equal(nextDays(8, new Date('2026-11-05T22:00:00Z'))[0][0], '2026-11-06');
  console.log(when('2026-11-05T11:32:00.000Z'), nextDays(3, new Date('2026-11-05T10:00:00Z')));
  const text = leadText({ id: 1, created_at: '2026-11-05T11:32:00.000Z', name: '', phone: '+7', method: 'call', area: '', object: '', timing: '', district: '', address: '', comment: '', calc: '', channel: 'Авито', status: 'new', measure_at: null, reject_reason: null, amount: null } as any, []);
  assert.ok(text.includes('Без имени') && text.length < 4096);
});
