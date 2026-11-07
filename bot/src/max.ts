// Бот в MAX. Сценарий общий (flow.ts), здесь только связь с MAX.
// События приходят на webhook: nginx передаёт их с /max-webhook/ на локальный порт.
import { createServer, type Server } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { Db } from './db.ts';
import { createFlow, GREETING_NO_CHAT, DONE_NO_CHAT, type Keys } from './flow.ts';

const API = 'https://platform-api2.max.ru';

interface MaxUser {
  user_id: number;
  first_name?: string;
  last_name?: string | null;
  username?: string | null;
  is_bot?: boolean;
}

export interface MaxUpdate {
  update_type: string;
  timestamp?: number;
  user?: MaxUser;
  callback?: { callback_id: string; payload?: string; user: MaxUser };
  message?: {
    sender?: MaxUser | null;
    recipient?: { chat_type?: string };
    body?: { text?: string | null };
  } | null;
}

type Call = (path: string, query: Record<string, string | number | boolean>, body: object) => Promise<unknown>;

export interface MaxOptions {
  token: string;
  secret: string;
  port?: number;
  call?: Call; // подменяется в тестах
}

const keyboard = (rows: Keys) => ({
  type: 'inline_keyboard',
  payload: {
    buttons: rows.map((row) => row.map((k) => (k.url
      ? { type: 'link', text: k.label, url: k.url }
      : { type: 'callback', text: k.label, payload: k.a ? `a:${k.a}` : `v:${k.v}` }))),
  },
});

const clientOf = (user: MaxUser) => ({
  name: [user.first_name, user.last_name].filter(Boolean).join(' '),
  link: user.username ? `https://max.ru/${user.username}` : '',
});

function sameSecret(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createMax(db: Db, opts: MaxOptions) {
  const call: Call = opts.call ?? (async (path, query, body) => {
    const params = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
    const res = await fetch(`${API}/${path}?${params}`, {
      method: 'POST',
      headers: { Authorization: opts.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json();
  });

  const flow = createFlow(db, {
    channel: 'max',
    source: 'MAX',
    form: 'Бот MAX',
    greeting: GREETING_NO_CHAT,
    done: DONE_NO_CHAT,
    conversation: false, // отвечает только бот
    send: (peer, text, keys) => call('messages', { user_id: peer, disable_link_preview: true }, { text, attachments: [keyboard(keys)] }),
  });

  async function handle(update: MaxUpdate) {
    const date = update.timestamp ? update.timestamp / 1000 : undefined;

    if (update.update_type === 'bot_started' && update.user) {
      await flow.handle({ peer: update.user.user_id, a: 'menu', client: clientOf(update.user), date });
      return;
    }

    if (update.update_type === 'message_created') {
      const m = update.message;
      if (!m?.sender || m.sender.is_bot || m.recipient?.chat_type !== 'dialog') return;
      const text = m.body?.text ?? '';
      if (!text) return;
      await flow.handle({ peer: m.sender.user_id, text, a: text.startsWith('/start') ? 'menu' : undefined, client: clientOf(m.sender), date });
      return;
    }

    if (update.update_type === 'message_callback' && update.callback) {
      const { callback_id, payload = '', user } = update.callback;
      if (user.is_bot) return;
      // Ответ убирает кнопки у старого сообщения, чтобы их нельзя было нажать повторно.
      await call('answers', { callback_id }, { message: { text: update.message?.body?.text ?? 'Готово', attachments: [] } })
        .catch((e) => console.error('Ответ на кнопку MAX:', (e as Error).message));
      const [kind, ...rest] = payload.split(':');
      const value = rest.join(':');
      if (!value || (kind !== 'a' && kind !== 'v')) return;
      await flow.handle({ peer: user.user_id, [kind]: value, client: clientOf(user), date });
    }
  }

  /** Обрабатывает события по очереди, чтобы быстрые нажатия не перепутали шаги сценария. */
  let queue = Promise.resolve();
  const enqueue = (update: MaxUpdate) => {
    queue = queue.then(() => handle(update)).catch((e) => console.error('Сообщение MAX:', (e as Error).message));
  };

  function listen(): Server {
    const server = createServer((req, res) => {
      const secret = req.headers['x-max-bot-api-secret'];
      if (req.method !== 'POST' || typeof secret !== 'string' || !sameSecret(secret, opts.secret)) {
        res.writeHead(404).end();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size <= 1_000_000) chunks.push(chunk);
      });
      req.on('end', () => {
        res.writeHead(200).end('ok');
        try {
          enqueue(JSON.parse(Buffer.concat(chunks).toString('utf8')) as MaxUpdate);
        } catch (e) {
          console.error('Событие MAX:', (e as Error).message);
        }
      });
    });
    server.listen(opts.port ?? 4322, '127.0.0.1');
    return server;
  }

  return { handle, listen };
}
