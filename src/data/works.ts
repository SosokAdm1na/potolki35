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
  { photo: heroLiving, title: 'Гостиная', type: 'Матовый, световые линии' },
  { photo: kitchenDark, title: 'Кухня', type: 'Сатиновый с подсветкой' },
  { photo: bedroomWarm, title: 'Спальня', type: 'Теневой профиль' },
  { photo: bathroomWood, title: 'Ванная', type: 'Глянцевый' },
  { photo: livingRecess, title: 'Гостиная', type: 'Двухуровневый' },
  { photo: bedroomTrack, title: 'Спальня', type: 'Теневой профиль, треки' },
  { photo: bathroomStone, title: 'Санузел', type: 'Матовый' },
  { photo: coffered, title: 'Кессонный потолок', type: 'Многоуровневый' },
];
