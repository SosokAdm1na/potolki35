// Только настоящие отзывы: имя, текст и откуда взят. Пока список пуст, блок на сайте не показывается.
export interface Review {
  name: string;
  text: string;
  where?: string; // например, «Кухня и коридор»
  date?: string; // например, «Октябрь 2026»
  source?: string; // «Авито», «ВКонтакте», «Яндекс Карты»
  url?: string; // ссылка на оригинал
}

export const reviews: Review[] = [];
