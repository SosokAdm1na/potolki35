// База бота: заявки, история, команда и отправленные карточки.
import { DatabaseSync } from 'node:sqlite';

export type Status = 'new' | 'work' | 'measure' | 'install' | 'done' | 'rejected';
export type Role = 'admin' | 'member';

export interface Lead {
  id: number;
  ext: string;
  created_at: string;
  name: string;
  phone: string;
  phone_digits: string;
  method: string;
  area: string;
  object: string;
  timing: string;
  district: string;
  address: string;
  comment: string;
  calc: string;
  form: string;
  page: string;
  channel: string;
  utm: string;
  status: Status;
  assignee_id: number | null;
  measure_at: string | null;
  reject_reason: string | null;
  amount: number | null;
  delivered: number;
}

export interface Member {
  tg_id: number;
  name: string;
  username: string;
  role: Role;
  active: number;
  screen_id: number | null;
}

export interface LeadEvent {
  actor_name: string | null;
  text: string;
  at: string;
}

export interface Card {
  lead_id: number;
  chat_id: number;
  message_id: number;
  kind: 'feed' | 'view';
}

export interface PendingInput {
  tg_id: number;
  kind: 'note' | 'sum' | 'find';
  lead_id: number | null;
  prompt_id: number | null;
}

export interface ClientDialog {
  channel: string;
  peer_id: number;
  step: string;
  data: string;
  quiet_until: number;
}

export type NewLead = Pick<Lead, 'ext' | 'created_at' | 'name' | 'phone' | 'phone_digits' | 'method' | 'area' | 'object' | 'timing' | 'district' | 'address' | 'comment' | 'calc' | 'form' | 'page' | 'channel' | 'utm'>;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ext TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    phone_digits TEXT NOT NULL DEFAULT '',
    method TEXT NOT NULL DEFAULT '',
    area TEXT NOT NULL DEFAULT '',
    object TEXT NOT NULL DEFAULT '',
    timing TEXT NOT NULL DEFAULT '',
    district TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    comment TEXT NOT NULL DEFAULT '',
    calc TEXT NOT NULL DEFAULT '',
    form TEXT NOT NULL DEFAULT '',
    page TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL DEFAULT '',
    utm TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'new',
    assignee_id INTEGER,
    measure_at TEXT,
    reject_reason TEXT,
    amount INTEGER,
    delivered INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS leads_status ON leads(status, id);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    actor_id INTEGER,
    text TEXT NOT NULL,
    at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_lead ON events(lead_id, id);
  CREATE TABLE IF NOT EXISTS members (
    tg_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'member',
    active INTEGER NOT NULL DEFAULT 1,
    screen_id INTEGER
  );
  CREATE TABLE IF NOT EXISTS cards (
    lead_id INTEGER NOT NULL,
    chat_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'feed',
    PRIMARY KEY (chat_id, message_id)
  );
  CREATE INDEX IF NOT EXISTS cards_lead ON cards(lead_id);
  CREATE TABLE IF NOT EXISTS inputs (
    tg_id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    lead_id INTEGER,
    prompt_id INTEGER
  );
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS client_dialogs (
    channel TEXT NOT NULL,
    peer_id INTEGER NOT NULL,
    step TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL DEFAULT '{}',
    quiet_until INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (channel, peer_id)
  );
`;

export class Db {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');
    this.db.exec(SCHEMA);
    // Диалоги ВК раньше лежали в отдельной таблице.
    if (this.db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'vk_dialogs'").get()) {
      this.db.exec(`
        INSERT OR IGNORE INTO client_dialogs SELECT 'vk', peer_id, step, data, quiet_until FROM vk_dialogs;
        DROP TABLE vk_dialogs;
      `);
    }
  }

  close() {
    this.db.close();
  }

  // --- служебное
  getMeta(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }
  setMeta(key: string, value: string) {
    this.db.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  // --- заявки
  /** Возвращает номер новой заявки или null, если такая уже есть. */
  addLead(l: NewLead): number | null {
    const res = this.db.prepare(`
      INSERT OR IGNORE INTO leads (ext, created_at, name, phone, phone_digits, method, area, object, timing, district, address, comment, calc, form, page, channel, utm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(l.ext, l.created_at, l.name, l.phone, l.phone_digits, l.method, l.area, l.object, l.timing, l.district, l.address, l.comment, l.calc, l.form, l.page, l.channel, l.utm);
    return res.changes ? Number(res.lastInsertRowid) : null;
  }
  lead(id: number): Lead | undefined {
    return this.db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as unknown as Lead | undefined;
  }
  update(id: number, fields: Partial<Pick<Lead, 'status' | 'assignee_id' | 'measure_at' | 'reject_reason' | 'amount' | 'delivered'>>) {
    const keys = Object.keys(fields) as (keyof typeof fields)[];
    if (!keys.length) return;
    const set = keys.map((k) => `${k} = ?`).join(', ');
    this.db.prepare(`UPDATE leads SET ${set} WHERE id = ?`).run(...keys.map((k) => fields[k] ?? null), id);
  }
  counts(): Record<Status, number> {
    const out: Record<Status, number> = { new: 0, work: 0, measure: 0, install: 0, done: 0, rejected: 0 };
    const rows = this.db.prepare('SELECT status, COUNT(*) AS n FROM leads GROUP BY status').all() as unknown as { status: Status; n: number }[];
    for (const r of rows) out[r.status] = r.n;
    return out;
  }
  list(status: Status, limit: number, offset: number): Lead[] {
    // Замеры показываем по дате, остальное — сначала свежие.
    const order = status === 'measure' ? 'measure_at ASC, id ASC' : 'id DESC';
    return this.db.prepare(`SELECT * FROM leads WHERE status = ? ORDER BY ${order} LIMIT ? OFFSET ?`).all(status, limit, offset) as unknown as Lead[];
  }
  search(query: string): Lead[] {
    const digits = query.replace(/\D/g, '');
    const like = `%${query.toLowerCase()}%`;
    const byPhone = digits.length >= 4 ? `%${digits}%` : '\u0000';
    const rows = this.db.prepare('SELECT * FROM leads WHERE phone_digits LIKE ? OR id = ? ORDER BY id DESC LIMIT 200').all(byPhone, Number(digits) || 0) as unknown as Lead[];
    if (rows.length || digits.length >= 4) return rows.slice(0, 10);
    // В SQLite LOWER не понимает кириллицу, поэтому имя и адрес сравниваем здесь.
    const all = this.db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 2000').all() as unknown as Lead[];
    const needle = like.slice(1, -1);
    return all.filter((l) => `${l.name} ${l.address} ${l.district}`.toLowerCase().includes(needle)).slice(0, 10);
  }
  undelivered(): Lead[] {
    return this.db.prepare('SELECT * FROM leads WHERE delivered = 0 ORDER BY id').all() as unknown as Lead[];
  }
  stats(since: string | null) {
    const where = since ? 'WHERE created_at >= ?' : '';
    const args = since ? [since] : [];
    const rows = this.db.prepare(`
      SELECT channel, COUNT(*) AS total,
        SUM(status = 'done') AS done,
        SUM(status = 'rejected') AS rejected,
        COALESCE(SUM(CASE WHEN status = 'done' THEN amount END), 0) AS revenue
      FROM leads ${where} GROUP BY channel ORDER BY total DESC
    `).all(...args) as unknown as { channel: string; total: number; done: number; rejected: number; revenue: number }[];
    return rows;
  }

  // --- история
  log(leadId: number, actorId: number | null, text: string) {
    this.db.prepare('INSERT INTO events(lead_id, actor_id, text, at) VALUES(?, ?, ?, ?)').run(leadId, actorId, text, new Date().toISOString());
  }
  events(leadId: number, limit = 10): LeadEvent[] {
    const rows = this.db.prepare(`
      SELECT m.name AS actor_name, e.text, e.at FROM events e LEFT JOIN members m ON m.tg_id = e.actor_id
      WHERE e.lead_id = ? ORDER BY e.id DESC LIMIT ?
    `).all(leadId, limit) as unknown as LeadEvent[];
    return rows.reverse();
  }

  // --- команда
  member(id: number): Member | undefined {
    return this.db.prepare('SELECT * FROM members WHERE tg_id = ?').get(id) as unknown as Member | undefined;
  }
  members(): Member[] {
    return this.db.prepare('SELECT * FROM members WHERE active = 1 ORDER BY role, name').all() as unknown as Member[];
  }
  join(id: number, name: string, username: string): Member {
    this.db.prepare(`
      INSERT INTO members(tg_id, name, username, role) VALUES(?, ?, ?, 'admin')
      ON CONFLICT(tg_id) DO UPDATE SET name = excluded.name, username = excluded.username, active = 1
    `).run(id, name, username);
    return this.member(id)!;
  }
  setScreen(id: number, messageId: number | null) {
    this.db.prepare('UPDATE members SET screen_id = ? WHERE tg_id = ?').run(messageId, id);
  }

  // --- карточки
  addCard(c: Card) {
    this.db.prepare('INSERT OR REPLACE INTO cards(lead_id, chat_id, message_id, kind) VALUES(?, ?, ?, ?)').run(c.lead_id, c.chat_id, c.message_id, c.kind);
  }
  cards(leadId: number): Card[] {
    return this.db.prepare('SELECT * FROM cards WHERE lead_id = ?').all(leadId) as unknown as Card[];
  }
  card(chatId: number, messageId: number): Card | undefined {
    return this.db.prepare('SELECT * FROM cards WHERE chat_id = ? AND message_id = ?').get(chatId, messageId) as unknown as Card | undefined;
  }
  hasFeedCard(leadId: number, chatId: number): boolean {
    return !!this.db.prepare("SELECT 1 FROM cards WHERE lead_id = ? AND chat_id = ? AND kind = 'feed'").get(leadId, chatId);
  }
  dropCard(chatId: number, messageId: number) {
    this.db.prepare('DELETE FROM cards WHERE chat_id = ? AND message_id = ?').run(chatId, messageId);
  }

  // --- ожидание текста от пользователя
  input(id: number): PendingInput | undefined {
    return this.db.prepare('SELECT * FROM inputs WHERE tg_id = ?').get(id) as unknown as PendingInput | undefined;
  }
  setInput(i: PendingInput) {
    this.db.prepare('INSERT OR REPLACE INTO inputs(tg_id, kind, lead_id, prompt_id) VALUES(?, ?, ?, ?)').run(i.tg_id, i.kind, i.lead_id, i.prompt_id);
  }
  clearInput(id: number) {
    this.db.prepare('DELETE FROM inputs WHERE tg_id = ?').run(id);
  }

  // --- диалоги с клиентами в ВК и Telegram
  dialog(channel: string, peer: number): ClientDialog | undefined {
    return this.db.prepare('SELECT * FROM client_dialogs WHERE channel = ? AND peer_id = ?').get(channel, peer) as unknown as ClientDialog | undefined;
  }
  saveDialog(channel: string, peer: number, step: string, data: string, quietUntil: number) {
    this.db.prepare('INSERT OR REPLACE INTO client_dialogs(channel, peer_id, step, data, quiet_until) VALUES(?, ?, ?, ?, ?)').run(channel, peer, step, data, quietUntil);
  }
}
