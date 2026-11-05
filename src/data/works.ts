import type { ImageMetadata } from 'astro';
import bath from '../assets/works/bath.jpg';
import livingLines from '../assets/works/living-lines.jpg';
import kitchen from '../assets/works/kitchen.jpg';
import bedroom from '../assets/works/bedroom.jpg';
import bedroomShadow from '../assets/works/bedroom-shadow.jpg';
import matte1 from '../assets/types/matte-1.jpg';
import matte2 from '../assets/types/matte-2.jpg';
import matte3 from '../assets/types/matte-3.jpg';
import satin1 from '../assets/types/satin-1.jpg';
import satin2 from '../assets/types/satin-2.jpg';
import gloss1 from '../assets/types/gloss-1.jpg';
import gloss2 from '../assets/types/gloss-2.jpg';
import gloss3 from '../assets/types/gloss-3.jpg';
import gloss4 from '../assets/types/gloss-4.jpg';
import float1 from '../assets/types/float-1.jpg';
import float2 from '../assets/types/float-2.jpg';
import float3 from '../assets/types/float-3.jpg';
import float4 from '../assets/types/float-4.jpg';
import lines1 from '../assets/types/lines-1.jpg';
import lines2 from '../assets/types/lines-2.jpg';
import lines3 from '../assets/types/lines-3.jpg';
import lines4 from '../assets/types/lines-4.jpg';
import lines5 from '../assets/types/lines-5.jpg';
import shadow1 from '../assets/types/shadow-1.jpg';
import shadow2 from '../assets/types/shadow-2.jpg';
import shadow4 from '../assets/types/shadow-4.jpg';
import shadow5 from '../assets/types/shadow-5.jpg';

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
  { photo: bedroom, title: 'Спальня', type: 'Матовый, точечный свет' },
  { photo: matte1, title: 'Гостиная', type: 'Матовый' },
  { photo: satin1, title: 'Кухня', type: 'Сатиновый' },
  { photo: lines3, title: 'Коридор', type: 'Световые линии' },
  { photo: gloss2, title: 'Кухня-гостиная', type: 'Глянцевый' },
  { photo: float3, title: 'Комната', type: 'Парящий' },
  { photo: satin2, title: 'Спальня', type: 'Сатиновый с подсветкой' },
  { photo: lines5, title: 'Спальня', type: 'Световые линии' },
  { photo: shadow1, title: 'Комната', type: 'Теневой профиль, подсветка' },
  { photo: gloss4, title: 'Комната', type: 'Глянцевый, точечный свет' },
  { photo: float1, title: 'Ванная', type: 'Парящий' },
  { photo: matte2, title: 'Комната', type: 'Матовый, накладные светильники' },
  { photo: lines1, title: 'Комната', type: 'Световые линии' },
  { photo: shadow2, title: 'Комната', type: 'Теневой профиль, точечный свет' },
  { photo: gloss1, title: 'Комната', type: 'Глянцевый, подсветка' },
  { photo: float2, title: 'Комната', type: 'Парящий' },
  { photo: lines4, title: 'Коридор', type: 'Световые линии' },
  { photo: matte3, title: 'Комната', type: 'Матовый, накладные светильники' },
  { photo: shadow5, title: 'Комната', type: 'Теневой профиль, точечный свет' },
  { photo: gloss3, title: 'Комната', type: 'Глянцевый' },
  { photo: float4, title: 'Комната', type: 'Парящий' },
  { photo: lines2, title: 'Комната', type: 'Световые линии' },
  { photo: shadow4, title: 'Комната', type: 'Теневой профиль' },
];
