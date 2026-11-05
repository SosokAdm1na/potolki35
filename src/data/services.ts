import type { ImageMetadata } from 'astro';
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
import shadow1 from '../assets/types/shadow-1.jpg';
import shadow2 from '../assets/types/shadow-2.jpg';
import shadow3 from '../assets/types/shadow-3.jpg';
import shadow4 from '../assets/types/shadow-4.jpg';
import shadow5 from '../assets/types/shadow-5.jpg';
import lines1 from '../assets/types/lines-1.jpg';
import lines2 from '../assets/types/lines-2.jpg';
import lines3 from '../assets/types/lines-3.jpg';
import lines4 from '../assets/types/lines-4.jpg';
import lines5 from '../assets/types/lines-5.jpg';
import { prices } from '../config';

export interface Service {
  slug: string;
  title: string; // короткое название для карточки
  h1: string; // заголовок страницы
  short: string;
  price: string; // для карточек и таблицы цен
  photo: ImageMetadata;
  gallery: ImageMetadata[]; // остальные фото этого вида
  seoTitle: string;
  seoDescription: string;
  intro: string;
  features: string[];
  goodFor: string[];
}

const perM = (n: number) => n.toLocaleString('ru-RU');
const canvas = perM(prices.canvas.matte.perM2);

export const services: Service[] = [
  {
    slug: 'matovye',
    title: 'Матовые',
    h1: 'Матовые натяжные потолки в Череповце',
    short: 'Как ровно покрашенный потолок, без бликов.',
    price: `от ${canvas} ₽/м²`,
    photo: matte1,
    gallery: [matte2, matte3],
    seoTitle: `Матовые натяжные потолки в Череповце — от ${canvas} ₽/м² с монтажом`,
    seoDescription: 'Матовые натяжные потолки в Череповце. Бесплатный замер, монтаж за 1 день. Рассчитайте стоимость онлайн.',
    intro: 'Матовое полотно не бликует и выглядит как ровно покрашенный потолок. Подходит почти к любому интерьеру.',
    features: ['Нет бликов', 'Много оттенков', 'Подходит к любому стилю', 'Легко протирается'],
    goodFor: ['Спальня', 'Гостиная', 'Детская', 'Коридор'],
  },
  {
    slug: 'satinovye',
    title: 'Сатиновые',
    h1: 'Сатиновые натяжные потолки в Череповце',
    short: 'Лёгкий блеск: среднее между матом и глянцем.',
    price: `от ${canvas} ₽/м²`,
    photo: satin1,
    gallery: [satin2],
    seoTitle: `Сатиновые натяжные потолки в Череповце — от ${canvas} ₽/м²`,
    seoDescription: 'Сатиновые натяжные потолки в Череповце. Бесплатный замер, монтаж за 1 день.',
    intro: 'Сатин немного отражает свет, поэтому комната выглядит светлее. Зеркального эффекта нет.',
    features: ['Мягкий блеск', 'Светлее матового', 'Цвета выглядят насыщеннее', 'Хорошо смотрится при дневном свете'],
    goodFor: ['Спальня', 'Гостиная', 'Кухня'],
  },
  {
    slug: 'glyancevye',
    title: 'Глянцевые',
    h1: 'Глянцевые натяжные потолки в Череповце',
    short: 'Отражает комнату, поэтому потолок кажется выше.',
    price: `от ${canvas} ₽/м²`,
    photo: gloss1,
    gallery: [gloss2, gloss3, gloss4],
    seoTitle: `Глянцевые натяжные потолки в Череповце — от ${canvas} ₽/м²`,
    seoDescription: 'Глянцевые натяжные потолки в Череповце. Бесплатный замер, монтаж за 1 день.',
    intro: 'Глянец отражает мебель и свет. За счёт этого небольшие комнаты кажутся выше и просторнее.',
    features: ['Потолок кажется выше', 'В комнате больше света', 'Хорошо смотрится с люстрой', 'Подходит для ванной и кухни'],
    goodFor: ['Ванная', 'Кухня', 'Коридор', 'Небольшие комнаты'],
  },
  {
    slug: 'paryashchie',
    title: 'Парящие',
    h1: 'Парящие натяжные потолки в Череповце',
    short: 'Подсветка по периметру: у стены виден ровный свет.',
    price: `+${perM(prices.profile.floating.perM)} ₽/пог. м`,
    photo: float1,
    gallery: [float2, float3, float4],
    seoTitle: 'Парящие натяжные потолки с подсветкой в Череповце',
    seoDescription: 'Парящие натяжные потолки с подсветкой в Череповце. Бесплатный замер, монтаж под ключ.',
    intro: 'В профиль по периметру комнаты встроена светодиодная лента. Она подсвечивает край потолка и может заменить вечерний свет.',
    features: ['Подсветка по всему контуру', 'Тёплый или холодный свет', 'Креплений не видно', 'Можно использовать как вечерний свет'],
    goodFor: ['Гостиная', 'Спальня', 'Кухня-гостиная'],
  },
  {
    slug: 'tenevye',
    title: 'Теневые',
    h1: 'Теневые натяжные потолки в Череповце',
    short: 'Вместо плинтуса ровный зазор у стены.',
    price: `+${perM(prices.profile.shadow.perM)} ₽/пог. м`,
    photo: shadow1,
    gallery: [shadow2, shadow3, shadow4, shadow5],
    seoTitle: 'Теневые натяжные потолки (без плинтуса) в Череповце',
    seoDescription: 'Теневые натяжные потолки без вставки и плинтуса в Череповце. Бесплатный замер, монтаж за 1 день.',
    intro: 'Теневой профиль оставляет небольшой ровный зазор между стеной и полотном. Плинтус и вставка не нужны.',
    features: ['Без вставки и плинтуса', 'Чёткая линия вдоль стены', 'Подходит к современным интерьерам', 'Хорошо сочетается с трековым светом'],
    goodFor: ['Спальня', 'Гостиная', 'Кабинет'],
  },
  {
    slug: 'svetovye-linii',
    title: 'Световые линии',
    h1: 'Световые линии в натяжном потолке — Череповец',
    short: 'Линии света в потолке вместо люстр.',
    price: `от ${perM(prices.lightLine)} ₽/пог. м`,
    photo: lines1,
    gallery: [lines2, lines3, lines4, lines5],
    seoTitle: 'Натяжные потолки со световыми линиями в Череповце',
    seoDescription: 'Световые линии в натяжном потолке в Череповце: прямые, угловые, с переходом на стену. Бесплатный замер.',
    intro: 'Алюминиевый профиль с рассеивателем встраивается прямо в полотно. Линии могут пересекаться, поворачивать и переходить на стены.',
    features: ['Прямые, угловые и пересекающиеся линии', 'Свет без пятен', 'Может заменить основной свет', 'Возможен переход на стену'],
    goodFor: ['Кухня', 'Гостиная', 'Коридор', 'Коммерческие помещения'],
  },
];

export const getService = (slug: string) => services.find((s) => s.slug === slug);
