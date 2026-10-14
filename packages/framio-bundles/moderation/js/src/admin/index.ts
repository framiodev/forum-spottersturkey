// Framio moderation — admin paketi. Modüller FoF kaynağından birebir yüklenir.
import Extend from 'flarum/common/extenders';
import framioGroupPage from './FramioGroupPage';
import '../moderator-notes/admin/index';
import e0 from '../moderator-notes/admin/extend';
import '../moderator-warnings/admin/index';
import e1 from '../moderator-warnings/admin/extend';
import '../author-change/admin/index';
import e2 from '../author-change/admin/extend';
import '../merge-discussions/admin/index';
import e3 from '../merge-discussions/admin/extend';
import '../move-posts/admin/index';
import e4 from '../move-posts/admin/extend';

// Her modül kendi registry bağlamına kaydeder; sekmeler bu bağlamları okur.
const tabs = [
  { key: 'moderator-notes', id: 'framio-moderation:moderator-notes', legacyId: 'fof-moderator-notes', title: 'Moderatör Notları' },
  { key: 'moderator-warnings', id: 'framio-moderation:moderator-warnings', legacyId: 'fof-moderator-warnings', title: 'Kullanıcı Uyarıları' },
  { key: 'author-change', id: 'framio-moderation:author-change', legacyId: 'clarkwinkelmann-author-change', title: 'Yazar Değiştirme' },
  { key: 'merge-discussions', id: 'framio-moderation:merge-discussions', legacyId: 'fof-merge-discussions', title: 'Tartışmaları Birleştirme' },
  { key: 'move-posts', id: 'framio-moderation:move-posts', legacyId: 'fof-move-posts', title: 'Gönderileri Taşıma 🚚' },
];

export const extend = [...(e0 ?? []), ...(e1 ?? []), ...(e2 ?? []), ...(e3 ?? []), ...(e4 ?? []), new Extend.Admin().page(framioGroupPage(tabs))];

