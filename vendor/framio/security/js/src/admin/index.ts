// Framio security — admin paketi. Modüller FoF kaynağından birebir yüklenir.
import Extend from 'flarum/common/extenders';
import framioGroupPage from './FramioGroupPage';
import '../oauth/admin/index';
import e0 from '../oauth/admin/extend';
import '../recaptcha/admin/index';
import e1 from '../recaptcha/admin/extend';
import '../pwned-passwords/admin/index';
import e2 from '../pwned-passwords/admin/extend';

// Her modül kendi registry bağlamına kaydeder; sekmeler bu bağlamları okur.
const tabs = [
  { key: 'oauth', id: 'framio-security:oauth', legacyId: 'fof-oauth', title: 'Sosyal Giriş (OAuth)' },
  { key: 'recaptcha', id: 'framio-security:recaptcha', legacyId: 'fof-recaptcha', title: 'Google reCAPTCHA' },
  { key: 'pwned-passwords', id: 'framio-security:pwned-passwords', legacyId: 'fof-pwned-passwords', title: 'Sızdırılmış Şifre Koruması' },
];

export const extend = [...(e0 ?? []), ...(e1 ?? []), ...(e2 ?? []), new Extend.Admin().page(framioGroupPage(tabs))];
