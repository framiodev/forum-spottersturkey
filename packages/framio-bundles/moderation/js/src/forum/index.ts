import { gate, gateExtenders } from './moduleGate';
// Framio moderation — forum paketi. Modüller FoF kaynağından birebir yüklenir.
gate('moderator-notes', () => require('../moderator-notes/forum/index'));
const e0 = gateExtenders('moderator-notes', require('../moderator-notes/forum/extend').default);
gate('moderator-warnings', () => require('../moderator-warnings/forum/index'));
const e1 = gateExtenders('moderator-warnings', require('../moderator-warnings/forum/extend').default);
gate('author-change', () => require('../author-change/forum/index'));
gate('merge-discussions', () => require('../merge-discussions/forum/index'));
const e2 = gateExtenders('merge-discussions', require('../merge-discussions/forum/extend').default);
gate('move-posts', () => require('../move-posts/forum/index'));
const e3 = gateExtenders('move-posts', require('../move-posts/forum/extend').default);
export const extend = [...(e0 ?? []), ...(e1 ?? []), ...(e2 ?? []), ...(e3 ?? [])];

