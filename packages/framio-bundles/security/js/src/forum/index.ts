import { gate, gateExtenders } from './moduleGate';
// Framio security — forum paketi. Modüller FoF kaynağından birebir yüklenir.
gate('oauth', () => require('../oauth/forum/index'));
const e0 = gateExtenders('oauth', require('../oauth/forum/extend').default);
gate('recaptcha', () => require('../recaptcha/forum/index'));
const e1 = gateExtenders('recaptcha', require('../recaptcha/forum/extend').default);
gate('pwned-passwords', () => require('../pwned-passwords/forum/index'));
const e2 = gateExtenders('pwned-passwords', require('../pwned-passwords/forum/extend').default);
export const extend = [...(e0 ?? []), ...(e1 ?? []), ...(e2 ?? [])];
