// Бот в сообщениях группы ВК. Сценарий общий (flow.ts), здесь только связь с ВК.
// Диалог остаётся в группе: на свободный текст бот не отвечает, а если человек из группы
// ответил клиенту сам, бот замолкает и не мешает разговору.
import { randomInt } from 'node:crypto';
import type { Db } from './db.ts';
import { ABOUT, createFlow, type Keys } from './flow.ts';

interface VkMessage {
  id?: number;
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

const keyboard = (rows: Keys) => JSON.stringify({
  one_time: false,
  inline: false,
  buttons: rows.map((row) => row.map((k) => (k.url
    ? { action: { type: 'open_link', label: k.label, link: k.url } }
    : { action: { type: 'text', label: k.label, payload: JSON.stringify(k.a ? { a: k.a } : { v: k.v }) }, color: k.color ?? 'secondary' }))),
});

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

  const clientName = async (id: number) => {
    try {
      const [user] = (await call('users.get', { user_ids: id })) as { first_name?: string; last_name?: string }[];
      return [user?.first_name, user?.last_name].filter(Boolean).join(' ');
    } catch (e) {
      console.error('Имя из ВК:', (e as Error).message);
      return '';
    }
  };

  const flow = createFlow(db, {
    channel: 'vk',
    source: 'ВКонтакте',
    form: 'Бот ВК',
    greeting: `👋 Здравствуйте!\n\n${ABOUT}\n\nЗдесь можно посчитать цену, заказать замер или уточнить свой вопрос — пишите прямо в чат.`,
    done: 'Заявка принята. Мы перезвоним и договоримся о замере. Если появятся вопросы, пишите сюда.',
    conversation: true,
    send: (peer, message, keys) =>
      call('messages.send', { peer_id: peer, random_id: randomInt(1, 2 ** 31 - 1), message, keyboard: keyboard(keys), dont_parse_links: 1 }),
    client: async (peer) => ({ name: await clientName(peer), link: `https://vk.com/gim${opts.groupId}?sel=${peer}` }),
  });

  async function handle(update: VkUpdate) {
    if (update.type === 'message_reply') {
      const reply = update.object as VkMessage;
      if (reply.admin_author_id) flow.silence(reply.peer_id); // свои сообщения бота так не помечены
      return;
    }
    if (update.type !== 'message_new') return;

    const m = update.object.message as VkMessage;
    if (m.from_id <= 0 || m.peer_id !== m.from_id) return; // только личные диалоги с людьми
    const payload = parsePayload(m.payload);
    await flow.handle({
      peer: m.peer_id,
      text: m.text,
      a: payload.command === 'start' ? 'menu' : payload.a,
      v: payload.v,
      date: m.date,
    });
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
