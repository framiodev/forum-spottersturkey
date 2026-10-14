// Framio widgets — admin paketi. Modüller FoF kaynağından birebir yüklenir.
import Extend from 'flarum/common/extenders';
import framioGroupPage from './FramioGroupPage';
import '../forum-widgets-core/admin/index';
import e0 from '../forum-widgets-core/admin/extend';
import '../forum-statistics-widget/admin/index';
import e1 from '../forum-statistics-widget/admin/extend';
import '../frontpage/admin/index';
import e2 from '../frontpage/admin/extend';
import '../socialcards/admin/index';
import e3 from '../socialcards/admin/extend';
import e4 from '../online-users-widget/admin/extend';
import '../top-posters-widget/admin/index';
import e5 from '../top-posters-widget/admin/extend';
import e6 from '../news-widget/admin/extend';

// Her modül kendi registry bağlamına kaydeder; sekmeler bu bağlamları okur.
const tabs = [
  { key: 'forum-widgets-core', id: 'framio-widgets:forum-widgets-core', legacyId: 'fof-forum-widgets-core', title: 'Bileşen Çekirdeği' },
  { key: 'forum-statistics-widget', id: 'framio-widgets:forum-statistics-widget', legacyId: 'fof-forum-statistics-widget', title: 'Forum İstatistikleri' },
  { key: 'frontpage', id: 'framio-widgets:frontpage', legacyId: 'fof-frontpage', title: 'Ön Sayfa Düzeni' },
  { key: 'socialcards', id: 'framio-widgets:socialcards', legacyId: 'justoverclock-socialcards', title: 'Sosyal Kartlar' },
  { key: 'online-users', id: 'framio-widgets:online-users', legacyId: 'fof-online-users-widget', title: 'Çevrimiçi Kullanıcılar 🟢' },
  { key: 'top-posters', id: 'framio-widgets:top-posters', legacyId: 'fof-top-posters-widget', title: 'Ayın En Çok Yazanları 🏆' },
  { key: 'news-widget', id: 'framio-widgets:news-widget', legacyId: 'fof-news-widget', title: 'Haber & Duyuru Bandı 📢' },
];

export const extend = [...(e0 ?? []), ...(e1 ?? []), ...(e2 ?? []), ...(e3 ?? []), ...(e4 ?? []), ...(e5 ?? []), ...(e6 ?? []), new Extend.Admin().page(framioGroupPage(tabs))];
