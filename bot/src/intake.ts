// Забирает новые заявки из файла, куда их пишет сайт. Сайт о боте ничего не знает:
// если бот или Telegram недоступны, заявка остаётся в файле и обрабатывается позже.
import { open, stat } from 'node:fs/promises';
import type { Db, NewLead } from './db.ts';

interface SiteLead {
  id?: string;
  createdAt?: string;
  name?: string;
  phone?: string;
  method?: string;
  area?: string;
  object?: string;
  timing?: string;
  district?: string;
  address?: string;
  comment?: string;
  calc?: string;
  source?: string;
  page?: string;
  utm?: Record<string, string>;
}

export function channelOf(utm: Record<string, string>): string {
  const src = (utm.utm_source || '').toLowerCase();
  if (utm.yclid || src.includes('yandex') || src === 'direct') return 'Яндекс Директ';
  if (src.includes('vk')) return 'ВКонтакте';
  if (src.includes('avito')) return 'Авито';
  if (src) return utm.utm_source;
  const ref = utm.referrer || '';
  if (ref.includes('yandex')) return 'Поиск Яндекса';
  if (ref.includes('google')) return 'Поиск Google';
  if (ref) return 'Другой сайт';
  return 'Прямой заход';
}

export function toLead(raw: SiteLead): NewLead {
  const utm = raw.utm ?? {};
  const phone = raw.phone ?? '';
  const created = raw.createdAt ?? new Date().toISOString();
  return {
    ext: `${created}|${raw.id ?? phone}`,
    created_at: created,
    name: raw.name ?? '',
    phone,
    phone_digits: phone.replace(/\D/g, ''),
    method: raw.method ?? '',
    area: raw.area ?? '',
    object: raw.object ?? '',
    timing: raw.timing ?? '',
    district: raw.district ?? '',
    address: raw.address ?? '',
    comment: raw.comment ?? '',
    calc: raw.calc ?? '',
    form: raw.source ?? '',
    page: raw.page ?? '',
    channel: channelOf(utm),
    utm: JSON.stringify(utm),
  };
}

/** Читает только дописанные строки. Возвращает номера новых заявок. */
export async function pullLeads(db: Db, file: string): Promise<number[]> {
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }

  let offset = Number(db.getMeta('intake_offset') ?? 0);
  if (size < offset) offset = 0; // файл заменили: повторы отсеет уникальный ключ
  if (size === offset) return [];

  const handle = await open(file, 'r');
  try {
    const buf = Buffer.alloc(size - offset);
    await handle.read(buf, 0, buf.length, offset);
    const end = buf.lastIndexOf(0x0a); // незаконченную строку оставляем на следующий раз
    if (end < 0) return [];

    const added: number[] = [];
    for (const line of buf.subarray(0, end).toString('utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const id = db.addLead(toLead(JSON.parse(line) as SiteLead));
        if (id !== null) added.push(id);
      } catch (e) {
        console.error('Не разобрал строку заявки:', (e as Error).message);
      }
    }
    db.setMeta('intake_offset', String(offset + end + 1));
    return added;
  } finally {
    await handle.close();
  }
}
