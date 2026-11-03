// Доставка заявок менеджерам: Telegram, MAX и резервная запись в файл.
import { appendFile, mkdir } from 'node:fs/promises';

const env = (k: string): string | undefined =>
  (typeof process !== 'undefined' ? process.env[k] : undefined) ?? (import.meta.env as Record<string, string | undefined>)[k];

export interface Lead {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  method: string;
  email: string;
  area: string;
  object: string;
  timing: string;
  district: string;
  address: string;
  comment: string;
  calc: string;
  source: string;
  page: string;
  utm: Record<string, string>;
}

const methodLabel: Record<string, string> = { call: '📞 Звонок', max: '💬 MAX', telegram: '✈️ Telegram', email: '✉️ Email' };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function channelOf(utm: Record<string, string>): string {
  const src = (utm.utm_source || '').toLowerCase();
  if (utm.yclid || src.includes('yandex') || src === 'direct') return 'Яндекс Директ';
  if (src.includes('vk')) return 'ВКонтакте';
  if (src.includes('avito')) return 'Авито';
  if (src) return utm.utm_source;
  const ref = utm.referrer || '';
  if (ref.includes('yandex')) return 'Поиск Яндекса';
  if (ref.includes('google')) return 'Поиск Google';
  if (ref) return `Переход с ${ref}`;
  return 'Прямой заход';
}

/** Текст сообщения в HTML-разметке (её понимают и Telegram, и MAX). */
export function formatLead(l: Lead): string {
  const lines: string[] = [];
  lines.push(`🔥 <b>Новая заявка #${l.id}</b>`);
  lines.push('');
  lines.push(`👤 ${esc(l.name || 'Без имени')}`);
  lines.push(`📱 <b>${esc(l.phone)}</b>`);
  lines.push(`Связаться: ${methodLabel[l.method] ?? esc(l.method)}${l.email ? ` — ${esc(l.email)}` : ''}`);

  const details = [
    l.area && `Площадь: ${esc(l.area)}`,
    l.object && `Объект: ${esc(l.object)}`,
    l.timing && `Сроки: ${esc(l.timing)}`,
    (l.district || l.address) && `Адрес: ${esc([l.district, l.address].filter(Boolean).join(', '))}`,
  ].filter(Boolean);
  if (details.length) lines.push('', ...(details as string[]));
  if (l.calc) lines.push('', '🧮 <b>Калькулятор:</b>', esc(l.calc));
  if (l.comment) lines.push('', `💬 ${esc(l.comment)}`);

  lines.push('', `📍 Канал: <b>${esc(channelOf(l.utm))}</b>`);
  const utmBits = ['utm_campaign', 'utm_content', 'utm_term'].filter((k) => l.utm[k]).map((k) => `${k.replace('utm_', '')}: ${esc(l.utm[k])}`);
  if (utmBits.length) lines.push(utmBits.join(' · '));
  lines.push(`Форма: ${esc(l.source)} (${esc(l.page)})`);
  return lines.join('\n');
}

async function sendTelegram(text: string) {
  const token = env('TG_BOT_TOKEN');
  const chat = env('TG_CHAT_ID');
  if (!token || !chat) return 'skipped';
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
  return 'ok';
}

async function sendMax(text: string) {
  const token = env('MAX_BOT_TOKEN');
  const chat = env('MAX_CHAT_ID');
  if (!token || !chat) return 'skipped';
  const base = env('MAX_API_URL') || 'https://platform-api2.max.ru';
  const res = await fetch(`${base}/messages?chat_id=${encodeURIComponent(chat)}&disable_link_preview=true`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, format: 'html' }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`MAX ${res.status}: ${await res.text()}`);
  return 'ok';
}

async function saveToFile(lead: Lead) {
  await mkdir('data', { recursive: true });
  await appendFile('data/leads.jsonl', JSON.stringify(lead) + '\n', 'utf8');
}

/** Отправляет во все настроенные каналы. Успех, если хотя бы один канал принял заявку. */
export async function deliverLead(lead: Lead) {
  const text = formatLead(lead);
  const results = await Promise.allSettled([sendTelegram(text), sendMax(text), saveToFile(lead).then(() => 'ok')]);
  const [tg, max, file] = results.map((r) => (r.status === 'fulfilled' ? r.value : `error: ${(r.reason as Error).message}`));
  const delivered = [tg, max].includes('ok');
  if (!delivered) console.log('\n[ЗАЯВКА — мессенджеры не настроены или недоступны]\n' + text.replace(/<[^>]+>/g, '') + '\n');
  console.log(`[lead ${lead.id}] telegram=${tg} max=${max} file=${file}`);
  return { delivered: delivered || file === 'ok', tg, max, file };
}
