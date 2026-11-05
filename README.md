# Потолки35 — сайт натяжных потолков (Череповец)

Astro 7 + Tailwind 4, серверная часть — `@astrojs/node` (только для приёма заявок).

## Запуск
```bash
npm install
npm run dev -- --host 127.0.0.1   # http://127.0.0.1:4321
npm run build && node dist/server/entry.mjs   # продакшен
```

## Где что менять
| Что | Файл |
|---|---|
| Телефон, мессенджеры, скидка, реквизиты, цифры | `src/config.ts` → `site` |
| Цены калькулятора | `src/config.ts` → `prices` |
| Виды потолков (страницы `/potolki/...`) | `src/data/services.ts` |
| Портфолио | `src/data/works.ts` + фото в `src/assets/photos/` |
| Отзывы (сейчас ДЕМО) | `src/components/Reviews.astro` |

## Заявки
Форма → `POST /api/lead` → Telegram и/или MAX (+ резервная копия в `data/leads.jsonl`).
Скопируйте `.env.example` в `.env` и впишите токены. Без токенов заявки только пишутся в файл и консоль.

## Перед запуском в прод
- [ ] Реальные телефон, реквизиты, цены, фото, отзывы
- [ ] Политика ПДн под реквизиты + уведомление в Роскомнадзор
- [ ] Яндекс Метрика (ID в `src/scripts/site.ts` и счётчик в `Layout.astro`), цели `lead_sent`, `phone_click`
- [ ] Хостинг в РФ, HTTPS, домен потолки35.рф
- [ ] Админка (Keystatic/Decap) для фото работ и отзывов
