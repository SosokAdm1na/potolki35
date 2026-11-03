// Все основные настройки сайта в одном месте.
// TODO(заказчик): заменить телефон, мессенджеры, реквизиты и цены на реальные.

export const site = {
  // Демо: сайт закрыт от поисковиков. Перед запуском поставить false.
  demo: true,
  name: 'Потолки35',
  domain: 'потолки35.рф',
  url: 'https://xn--35-vlcherag2a.xn--p1ai', // punycode для потолки35.рф
  city: 'Череповец',
  cityIn: 'в Череповце',
  phone: '+7 (900) 000-00-00',
  phoneHref: 'tel:+79000000000',
  email: 'info@потолки35.рф',
  telegram: 'https://t.me/username',
  max: 'https://max.ru/username',
  vk: 'https://vk.com/username',
  workHours: 'Ежедневно 9:00–21:00',
  address: 'Череповец, выезд по городу и району',
  legal: 'ИП Фамилия И. О., ИНН 000000000000',
  // Скидка за заявку с сайта
  discountPercent: 10,
};

// Примерные цены для калькулятора (₽). Меняются здесь — пересчитывается весь сайт.
export const prices = {
  canvas: {
    matte: { label: 'Матовое', perM2: 490 },
    satin: { label: 'Сатиновое', perM2: 540 },
    gloss: { label: 'Глянцевое', perM2: 590 },
    fabric: { label: 'Тканевое', perM2: 1490 },
  },
  // доплата за погонный метр периметра
  profile: {
    standard: { label: 'Стандартный', perM: 0, note: 'классика с маскировочной лентой' },
    shadow: { label: 'Теневой', perM: 650, note: 'аккуратный зазор у стены' },
    floating: { label: 'Парящий', perM: 1200, note: 'подсветка по периметру' },
  },
  spotlight: 450, // точечный светильник, шт
  chandelier: 700, // закладная под люстру, шт
  lightLine: 2900, // световая линия, пог. м
  pipe: 300, // обход трубы, шт
  extraRoom: 1000, // выезд/подготовка на каждое доп. помещение
  minOrder: 7000,
} as const;

export type CanvasKey = keyof typeof prices.canvas;
export type ProfileKey = keyof typeof prices.profile;

export const districts = [
  'Зашекснинский',
  'Заягорбский',
  'Индустриальный',
  'Северный',
  'Череповецкий район',
  'Другое',
];
