import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db } from './db.ts';
import { createMax, type MaxUpdate } from './max.ts';
import { leadText } from './ui.ts';

const USER = { user_id: 700, first_name: 'Ирина', last_name: 'К.', username: 'irina' };

function setup() {
  const db = new Db(join(mkdtempSync(join(tmpdir(), 'p35max-')), 'bot.db'));
  const calls: { path: string; query: any; body: any }[] = [];
  const max = createMax(db, {
    token: 'x',
    secret: 's3cret',
    port: 0,
    call: async (path, query, body) => {
      calls.push({ path, query, body });
      return {};
    },
  });
  const say = (text: string, over: object = {}) => max.handle({
    update_type: 'message_created',
    timestamp: 1_790_000_000_000,
    message: { sender: USER, recipient: { chat_type: 'dialog' }, body: { text }, ...over },
  } as MaxUpdate);
  let id = 0;
  const press = (payload: string) => max.handle({
    update_type: 'message_callback',
    timestamp: 1_790_000_000_000,
    callback: { callback_id: `cb${++id}`, payload, user: USER },
    message: { body: { text: 'старый текст' } },
  } as MaxUpdate);
  const sent = () => calls.filter((c) => c.path === 'messages');
  return { db, max, calls, say, press, sent, last: () => sent().at(-1)!.body.text as string };
}

test('старт: меню с кнопками нужного вида', async () => {
  const t = setup();
  await t.max.handle({ update_type: 'bot_started', user: USER } as MaxUpdate);
  const m = t.sent()[0];
  assert.equal(m.query.user_id, 700);
  assert.match(m.body.text, /Здравствуйте/);
  assert.doesNotMatch(m.body.text, /пишите прямо в чат/);
  const buttons = m.body.attachments[0].payload.buttons.flat();
  assert.equal(m.body.attachments[0].type, 'inline_keyboard');
  assert.deepEqual(buttons[0], { type: 'callback', text: 'Рассчитать цену', payload: 'a:calc' });
  assert.ok(buttons.some((b: any) => b.type === 'link' && b.url.endsWith('/raboty/')));
});

test('расчёт и заявка: кнопка отвечает и убирает старые кнопки, заявка ждёт отправки в Telegram', async () => {
  const t = setup();
  await t.press('a:calc');
  const answer = t.calls.find((c) => c.path === 'answers')!;
  assert.equal(answer.query.callback_id, 'cb1');
  assert.deepEqual(answer.body.message, { text: 'старый текст', attachments: [] });
  await t.say('20');
  await t.press('v:satin');
  await t.press('v:floating');
  await t.press('v:2');
  await t.press('v:4');
  await t.press('v:1');
  assert.match(t.last(), /Примерный расчёт/);
  await t.press('a:lead');
  assert.match(t.last(), /politika/);
  await t.say('8 921 000-00-00');
  await t.press('v:2');
  assert.match(t.last(), /Заявка принята/);

  const lead = t.db.lead(1)!;
  assert.equal(lead.name, 'Ирина К.');
  assert.equal(lead.phone, '+7 (921) 000-00-00');
  assert.equal(lead.district, 'Индустриальный');
  assert.equal(lead.channel, 'MAX');
  assert.equal(lead.form, 'Бот MAX');
  assert.match(lead.calc, /Сатиновое полотно/);
  assert.equal(lead.delivered, 0);
  assert.match(leadText(lead, []), /href="https:\/\/max\.ru\/irina"/);
});

test('без имени пользователя заявка всё равно создаётся', async () => {
  const t = setup();
  await t.max.handle({
    update_type: 'message_callback',
    callback: { callback_id: '1', payload: 'a:lead', user: { user_id: 1, first_name: 'Аня' } },
  } as MaxUpdate);
  await t.max.handle({ update_type: 'message_created', message: { sender: { user_id: 1, first_name: 'Аня' }, recipient: { chat_type: 'dialog' }, body: { text: '89210000000' } } } as MaxUpdate);
  await t.max.handle({ update_type: 'message_callback', callback: { callback_id: '2', payload: 'v:5', user: { user_id: 1, first_name: 'Аня' } } } as MaxUpdate);
  assert.equal(t.db.lead(1)!.name, 'Аня');
  assert.equal(t.db.lead(1)!.page, '');
});

test('свободный текст возвращает меню, чаты и боты игнорируются', async () => {
  const t = setup();
  await t.say('Сколько стоит?');
  await t.say('Ещё вопрос');
  assert.equal(t.sent().length, 2);
  await t.say('в группе', { recipient: { chat_type: 'chat' } });
  await t.say('я бот', { sender: { ...USER, is_bot: true } });
  await t.max.handle({ update_type: 'message_edited' } as MaxUpdate);
  assert.equal(t.sent().length, 2);
});

test('webhook принимает только верный секрет', async () => {
  const t = setup();
  const server = t.max.listen();
  await new Promise((done) => server.once('listening', done));
  const { port } = server.address() as { port: number };
  const post = (secret?: string) => fetch(`http://127.0.0.1:${port}/`, {
    method: 'POST',
    headers: secret ? { 'x-max-bot-api-secret': secret } : {},
    body: JSON.stringify({ update_type: 'bot_started', user: USER }),
  });
  assert.equal((await post()).status, 404);
  assert.equal((await post('wrong')).status, 404);
  assert.equal(t.sent().length, 0);
  assert.equal((await post('s3cret')).status, 200);
  for (let i = 0; i < 50 && !t.sent().length; i++) await new Promise((done) => setTimeout(done, 10));
  assert.equal(t.sent().length, 1);
  await new Promise((done) => server.close(done));
});
