import type { ImageMetadata } from 'astro';
import bath from '../assets/works/bath.jpg';
import livingLevel from '../assets/works/living-level.jpg';
import livingLines from '../assets/works/living-lines.jpg';
import kitchen from '../assets/works/kitchen.jpg';
import bedroom from '../assets/works/bedroom.jpg';
import bedroomShadow from '../assets/works/bedroom-shadow.jpg';
import matte1 from '../assets/types/matte-1.jpg';
import satin1 from '../assets/types/satin-1.jpg';
import satin2 from '../assets/types/satin-2.jpg';
import gloss2 from '../assets/types/gloss-2.jpg';
import float3 from '../assets/types/float-3.jpg';
import lines3 from '../assets/types/lines-3.jpg';

export interface Work {
  photo: ImageMetadata;
  title: string;
  type: string;
}

// Первые шесть показываются на главной, все — на странице работ.
export const works: Work[] = [
  { photo: livingLines, title: 'Гостиная', type: 'Световые линии' },
  { photo: kitchen, title: 'Кухня', type: 'Матовый, накладные светильники' },
  { photo: bedroomShadow, title: 'Спальня', type: 'Теневой профиль' },
  { photo: bath, title: 'Ванная', type: 'Световые линии' },
  { photo: livingLevel, title: 'Гостиная', type: 'Двухуровневый, треки' },
  { photo: bedroom, title: 'Спальня', type: 'Матовый, точечный свет' },
  { photo: matte1, title: 'Гостиная', type: 'Матовый' },
  { photo: satin1, title: 'Кухня', type: 'Сатиновый' },
  { photo: lines3, title: 'Коридор', type: 'Световые линии' },
  { photo: gloss2, title: 'Кухня-гостиная', type: 'Глянцевый' },
  { photo: float3, title: 'Комната', type: 'Парящий' },
  { photo: satin2, title: 'Спальня', type: 'Сатиновый с подсветкой' },
];
