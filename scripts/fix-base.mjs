// Для демо на GitHub Pages: сайт живёт в подпапке, поэтому добавляем её к внутренним ссылкам.
// Файлы Astro (картинки, стили, скрипты) получают подпапку сами через опцию base.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = process.env.DEPLOY_BASE;
if (!base) throw new Error('Не задан DEPLOY_BASE');
const root = 'dist/client';
const name = base.replace(/^\/|\/$/g, '');
const pattern = new RegExp(`href="/(?!/)(?!${name}/)`, 'g');

let count = 0;
for (const entry of await readdir(root, { recursive: true })) {
  if (!entry.endsWith('.html')) continue;
  const file = join(root, entry);
  const html = await readFile(file, 'utf8');
  await writeFile(file, html.replace(pattern, `href="${base}`));
  count++;
}
console.log(`Ссылки обновлены в ${count} HTML-файлах`);
