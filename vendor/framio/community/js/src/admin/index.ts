// Framio community — admin paketi. Modüller FoF kaynağından birebir yüklenir.
import Extend from 'flarum/common/extenders';
import framioGroupPage from './FramioGroupPage';
import '../user-directory/admin/index';
import e0 from '../user-directory/admin/extend';
import '../ignore-users/admin/index';
import e1 from '../ignore-users/admin/extend';
import '../subscribed/admin/index';
import e2 from '../subscribed/admin/extend';
import '../default-group/admin/index';
import e3 from '../default-group/admin/extend';
import '../default-user-preferences/admin/index';
import e4 from '../default-user-preferences/admin/extend';
import e5 from '../mailing/admin/extend';
import '../language-detection/admin/index';
import e6 from '../notifications/admin/extend';
import '../friendship/admin/index';
import '../follow-tags/admin/index';
import e7 from '../follow-tags/admin/extend';

// Her modül kendi registry bağlamına kaydeder; sekmeler bu bağlamları okur.
const tabs = [
  { key: 'user-directory', id: 'framio-community:user-directory', legacyId: 'fof-user-directory', title: 'Üye Dizini' },
  { key: 'ignore-users', id: 'framio-community:ignore-users', legacyId: 'fof-ignore-users', title: 'Üye Engelleme' },
  { key: 'subscribed', id: 'framio-community:subscribed', legacyId: 'fof-subscribed', title: 'Bildirim Abonelikleri' },
  { key: 'default-group', id: 'framio-community:default-group', legacyId: 'fof-default-group', title: 'Varsayılan Üye Grubu' },
  { key: 'default-user-preferences', id: 'framio-community:default-user-preferences', legacyId: 'fof-default-user-preferences', title: 'Varsayılan Tercihler' },
  { key: 'language-detection', id: 'framio-community:language-detection', legacyId: 'huseyinfiliz-language-detection', title: 'Otomatik Dil Tespiti' },
  { key: 'notifications', id: 'framio-community:notifications', legacyId: null, title: 'Bildirimler 🔔' },
  { key: 'friendship', id: 'forumaker-friendship', legacyId: 'forumaker-friendship', title: 'Arkadaşlık 🤝' },
  { key: 'mailing', id: 'framio-community:mailing', legacyId: 'fof-mailing', title: 'Toplu E-posta ✉️', always: true },
  { key: 'follow-tags', id: 'framio-community:follow-tags', legacyId: 'fof-follow-tags', title: 'Etiket Takibi 🏷️' },
];

export const extend = [...(e0 ?? []), ...(e1 ?? []), ...(e2 ?? []), ...(e3 ?? []), ...(e4 ?? []), ...(e5 ?? []), ...(e6 ?? []), ...(e7 ?? []), new Extend.Admin().page(framioGroupPage(tabs))];
