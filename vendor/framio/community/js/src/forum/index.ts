import { gate, gateExtenders } from './moduleGate';
// Framio community — forum paketi. Modüller FoF kaynağından birebir yüklenir.
gate('user-directory', () => require('../user-directory/forum/index'));
const e0 = gateExtenders('user-directory', require('../user-directory/forum/extend').default);
gate('ignore-users', () => require('../ignore-users/forum/index'));
const e1 = gateExtenders('ignore-users', require('../ignore-users/forum/extend').default);
gate('subscribed', () => require('../subscribed/forum/index'));
const e2 = gateExtenders('subscribed', require('../subscribed/forum/extend').default);
gate('mailing', () => require('../mailing/forum/index'));
const e3 = gateExtenders('mailing', require('../mailing/forum/extend').default);
gate('friendship', () => require('../friendship/forum/index'));
const e4 = gateExtenders('friendship', require('../friendship/forum/extend').default);
gate('follow-tags', () => require('../follow-tags/forum/index'));
const e5 = gateExtenders('follow-tags', require('../follow-tags/forum/extend').default);
export const extend = [...(e0 ?? []), ...(e1 ?? []), ...(e2 ?? []), ...(e3 ?? []), ...(e4 ?? []), ...(e5 ?? [])];
