import { Db } from './db.ts';
import { createBot } from './bot.ts';
import { pullLeads } from './intake.ts';

const need = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Не задан ${key}`);
  return value;
};

const db = new Db(need('BOT_DB'));
const leadsFile = need('LEADS_FILE');
const { bot, deliver, setup } = createBot(db, {
  token: need('BOT_TOKEN'),
  invite: need('BOT_INVITE'),
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

const stop = () => {
  clearInterval(timer);
  void bot.stop();
};
process.once('SIGTERM', stop);
process.once('SIGINT', stop);

console.log(`@${bot.botInfo.username} запущен`);
await bot.start({ allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
db.close();
