import type { ImageMetadata } from 'astro';
import kitchenDark from '../assets/photos/kitchen-dark.jpg';
import bedroomWarm from '../assets/photos/bedroom-warm.jpg';
import bathroomWood from '../assets/photos/bathroom-wood.jpg';
import livingRecess from '../assets/photos/living-recess.jpg';
import bathroomStone from '../assets/photos/bathroom-stone.jpg';
import coffered from '../assets/photos/coffered.jpg';
import heroLiving from '../assets/photos/hero-living.jpg';
import bedroomTrack from '../assets/photos/bedroom-track.jpg';

// ДЕМО: фото-заглушки из Unsplash. Заменить на реальные объекты заказчика.
export interface Work {
  photo: ImageMetadata;
  title: string;
  place: string;
  area: number;
  type: string;
  days: number;
}

export const works: Work[] = [
  { photo: heroLiving, title: 'Гостиная со световыми линиями', place: 'ул. Ленина', area: 32, type: 'Матовый + линии', days: 1 },
  { photo: kitchenDark, title: 'Кухня с подсветкой', place: 'Зашекснинский р-н', area: 14, type: 'Сатин', days: 1 },
  { photo: bedroomWarm, title: 'Спальня, теневой профиль', place: 'Северный р-н', area: 16, type: 'Теневой', days: 1 },
  { photo: bathroomWood, title: 'Ванная комната', place: 'Индустриальный р-н', area: 6, type: 'Глянец', days: 1 },
  { photo: livingRecess, title: 'Двухуровневый в гостиной', place: 'Заягорбский р-н', area: 41, type: 'Двухуровневый', days: 2 },
  { photo: bedroomTrack, title: 'Спальня с треками', place: 'ул. Металлургов', area: 18, type: 'Теневой + трек', days: 1 },
  { photo: bathroomStone, title: 'Санузел', place: 'пр. Победы', area: 5, type: 'Матовый', days: 1 },
  { photo: coffered, title: 'Кессонный потолок', place: 'Частный дом', area: 28, type: 'Многоуровневый', days: 3 },
];
