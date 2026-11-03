import type { ImageMetadata } from 'astro';
import kitchenDark from '../assets/photos/kitchen-dark.jpg';
import bedroomWarm from '../assets/photos/bedroom-warm.jpg';
import bathroomWood from '../assets/photos/bathroom-wood.jpg';
import livingRecess from '../assets/photos/living-recess.jpg';
import bathroomStone from '../assets/photos/bathroom-stone.jpg';
import coffered from '../assets/photos/coffered.jpg';
import heroLiving from '../assets/photos/hero-living.jpg';
import bedroomTrack from '../assets/photos/bedroom-track.jpg';

// ДЕМО: фото-заглушки из Unsplash. Заменить на реальные объекты заказчика, добавить район, площадь и срок.
export interface Work {
  photo: ImageMetadata;
  title: string;
  type: string;
}

export const works: Work[] = [
  { photo: heroLiving, title: 'Гостиная со световыми линиями', type: 'Матовый + линии' },
  { photo: kitchenDark, title: 'Кухня с подсветкой', type: 'Сатин' },
  { photo: bedroomWarm, title: 'Спальня, теневой профиль', type: 'Теневой' },
  { photo: bathroomWood, title: 'Ванная комната', type: 'Глянец' },
  { photo: livingRecess, title: 'Двухуровневый в гостиной', type: 'Двухуровневый' },
  { photo: bedroomTrack, title: 'Спальня с треками', type: 'Теневой + трек' },
  { photo: bathroomStone, title: 'Санузел', type: 'Матовый' },
  { photo: coffered, title: 'Кессонный потолок', type: 'Многоуровневый' },
];
