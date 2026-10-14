import { gate, gateExtenders } from './moduleGate';
// Framio widgets — forum paketi. Modüller FoF kaynağından birebir yüklenir.
gate('forum-widgets-core', () => require('../forum-widgets-core/forum/index'));
gate('forum-statistics-widget', () => require('../forum-statistics-widget/forum/index'));
const e1 = gateExtenders('forum-statistics-widget', require('../forum-statistics-widget/forum/extend').default);
gate('frontpage', () => require('../frontpage/forum/index'));
const e2 = gateExtenders('frontpage', require('../frontpage/forum/extend').default);
gate('socialcards', () => require('../socialcards/forum/index'));
gate('online-users', () => require('../online-users-widget/forum/index'));
const e4 = gateExtenders('online-users', require('../online-users-widget/forum/extend').default);
gate('top-posters', () => require('../top-posters-widget/forum/index'));
const e5 = gateExtenders('top-posters', require('../top-posters-widget/forum/extend').default);
gate('news-widget', () => require('../news-widget/forum/index'));
export const extend = [...(e1 ?? []), ...(e2 ?? []), ...(e4 ?? []), ...(e5 ?? [])];
