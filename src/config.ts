// Все основные настройки сайта в одном месте.

export const site = {
  name: 'Потолки35',
  domain: 'потолки35.рф',
  url: 'https://xn--35-vlcherag2a.xn--p1ai', // punycode для потолки35.рф
  city: 'Череповец',
  cityIn: 'в Череповце',
  phone: '+7 (965) 744-14-44',
  phoneHref: 'tel:+79657441444',
  // Пустая ссылка: кнопка не показывается.
  max: '',
  vk: '',
  workHours: 'Ежедневно 9:00–21:00',
  address: 'Череповец, выезд по городу и району',
  legal: '', // ИП или ООО, ИНН: появится в подвале, контактах и политике
  // Скидка за заявку с сайта
  discountPercent: 10,
};

// Цены заказчика (₽). Меняются здесь — пересчитывается весь сайт.
export const prices = {
  canvas: {
    matte: { label: 'Матовое', perM2: 900 },
    satin: { label: 'Сатиновое', perM2: 900 },
    gloss: { label: 'Глянцевое', perM2: 900 },
  },
  // доплата за погонный метр периметра
  profile: {
    standard: { label: 'Стандартный', perM: 0, note: 'классика с маскировочной лентой' },
    shadow: { label: 'Теневой', perM: 650, note: 'аккуратный зазор у стены' },
    floating: { label: 'Парящий', perM: 1200, note: 'подсветка по периметру' },
  },
  spotlight: 600, // установка точечного светильника, шт
  chandelier: 700, // установка люстры, шт, от
  lightLine: 2900, // световая линия, пог. м
  pipe: 300, // обход трубы, шт
  hiddenCornice: 2500, // скрытый карниз ПК-14, пог. м, от
  bathCurtain: 3000, // гардина в ванную АМ-1, пог. м, от
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
