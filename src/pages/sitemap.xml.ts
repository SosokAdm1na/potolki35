import type { APIRoute } from 'astro';
import { site } from '../config';
import { services } from '../data/services';

export const prerender = true;

export const GET: APIRoute = () => {
  const paths = ['/', '/potolki/', ...services.map((s) => `/potolki/${s.slug}/`), '/ceny/', '/raboty/', '/kontakty/', '/politika/'];
  const urls = paths.map((p) => `  <url><loc>${site.url}${p}</loc></url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
