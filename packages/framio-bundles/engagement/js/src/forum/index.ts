import { gate, gateExtenders } from './moduleGate';
// Framio engagement — forum paketi. Modüller FoF kaynağından birebir yüklenir.
gate('reactions', () => require('../reactions/forum/index'));
const e0 = gateExtenders('reactions', require('../reactions/forum/extend').default);
gate('polls', () => require('../polls/forum/index'));
const e1 = gateExtenders('polls', require('../polls/forum/extend').default);
gate('discussion-views', () => require('../discussion-views/forum/index'));
const e2 = gateExtenders('discussion-views', require('../discussion-views/forum/extend').default);
gate('share-social', () => require('../share-social/forum/index'));
const e3 = gateExtenders('share-social', require('../share-social/forum/extend').default);
gate('who-read', () => require('../who-read/forum/index'));
gate('bookmarks', () => require('../bookmarks/forum/index'));
const e4 = gateExtenders('bookmarks', require('../bookmarks/forum/extend').default);
export const extend = [...(e0 ?? []), ...(e1 ?? []), ...(e2 ?? []), ...(e3 ?? []), ...(e4 ?? [])];


