import type { APIRoute } from 'astro';
import { deliverLead, type Lead } from '../../lib/notify';

export const prerender = false;

// Простая защита от спама: не чаще 3 заявок в 10 минут с одного IP.
const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 3;
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: 'Некорректный запрос' }, 400);
  }

  // Бот заполнил скрытое поле или отправил форму мгновенно — делаем вид, что всё хорошо.
  if (str(data.website) || Number(data.elapsed) < 1500) return json({ ok: true });

  const digits = str(data.phone).replace(/\D/g, '');
  if (digits.length !== 11) return json({ ok: false, error: 'Проверьте номер телефона' }, 422);
  if (!data.consent) return json({ ok: false, error: 'Нужно согласие на обработку данных' }, 422);

  let ip = 'unknown';
  try {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress;
  } catch {}
  if (rateLimited(ip)) return json({ ok: false, error: 'Слишком много заявок подряд' }, 429);

  const utmRaw = (typeof data.utm === 'object' && data.utm) || {};
  const utm: Record<string, string> = {};
  for (const [k, v] of Object.entries(utmRaw)) utm[str(k, 30)] = str(v);

  const lead: Lead = {
    id: Date.now().toString(36).slice(-5).toUpperCase(),
    createdAt: new Date().toISOString(),
    name: str(data.name, 60),
    phone: `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`,
    method: str(data.method, 20) || 'call',
    email: str(data.email, 100),
    area: str(data.area, 30),
    object: str(data.object, 30),
    timing: str(data.timing, 40),
    district: str(data.district, 40),
    address: str(data.address, 120),
    comment: str(data.comment, 1000),
    calc: str(data.calc, 1000),
    source: str(data.source, 80),
    page: str(data.page, 120),
    utm,
  };

  const res = await deliverLead(lead);
  if (!res.delivered) return json({ ok: false, error: 'Не удалось отправить заявку' }, 502);
  return json({ ok: true, id: lead.id });
};
