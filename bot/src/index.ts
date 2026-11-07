import { Db } from './db.ts';
import { createBot } from './bot.ts';
import { pullLeads } from './intake.ts';
import { createVk } from './vk.ts';
import { createMax } from './max.ts';

const need = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Не задан ${key}`);
  return value;
};

const db = new Db(need('BOT_DB'));
const leadsFile = need('LEADS_FILE');
const { bot, deliver, setup } = createBot(db, {
  token: need('BOT_TOKEN'),
  admins: new Set(need('BOT_ADMINS').split(',').map((id) => Number(id.trim())).filter(Boolean)),
  apiRoot: process.env.BOT_API_ROOT,
});

let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    await pullLeads(db, leadsFile);
    await deliver();
  } catch (e) {
    console.error('Цикл заявок:', (e as Error).message);
  } finally {
    busy = false;
  }
}

await bot.init();
await setup().catch((e) => console.error('Настройка меню:', e.message));
const timer = setInterval(tick, 5000);

// Бот группы ВК включается, когда на сервере есть ключ сообщества.
const vkStop = new AbortController();
if (process.env.VK_TOKEN) {
  void createVk(db, { token: process.env.VK_TOKEN, groupId: Number(need('VK_GROUP_ID')) }).run(vkStop.signal);
}

// Бот MAX включается, когда на сервере есть токен.
const maxServer = process.env.MAX_TOKEN
  ? createMax(db, { token: process.env.MAX_TOKEN, secret: need('MAX_SECRET') }).listen()
  : null;

const stop = () => {
  clearInterval(timer);
  vkStop.abort();
  maxServer?.close();
  void bot.stop();
};
process.once('SIGTERM', stop);
process.once('SIGINT', stop);

console.log(`@${bot.botInfo.username} запущен`);
await bot.start({ allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
db.close();
