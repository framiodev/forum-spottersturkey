// Framio content — admin paketi. Modüller FoF kaynağından birebir yüklenir.
import Extend from 'flarum/common/extenders';
import framioGroupPage from './FramioGroupPage';
import '../pages/admin/index';
import e0 from '../pages/admin/extend';
import '../drafts/admin/index';
import e1 from '../drafts/admin/extend';
import '../formatting/admin/index';
import e2 from '../formatting/admin/extend';
import '../discussion-thumbnail/admin/index';
import e3 from '../discussion-thumbnail/admin/extend';
import '../links/admin/index';
import e4 from '../links/admin/extend';
import '../hashtags/admin/index';
import e5 from '../hashtags/admin/extend';
import initDeepTagsAdmin from '../deep-tags/admin/index';

// DeepTags admin extension'ı başlat
initDeepTagsAdmin();

// Her modül kendi registry bağlamına kaydeder; sekmeler bu bağlamları okur.
const tabs = [
  { key: 'pages', id: 'framio-content:pages', legacyId: 'fof-pages', title: 'Özel Sayfalar' },
  { key: 'links', id: 'framio-content:links', legacyId: 'fof-links', title: 'Gezinti Bağlantıları' },
  { key: 'drafts', id: 'framio-content:drafts', legacyId: 'fof-drafts', title: 'Taslaklar' },
  { key: 'formatting', id: 'framio-content:formatting', legacyId: 'fof-formatting', title: 'Metin Biçimlendirme' },
  { key: 'discussion-thumbnail', id: 'framio-content:discussion-thumbnail', legacyId: 'fof-discussion-thumbnail', title: 'Konu Küçük Resimleri' },
  { key: 'hashtags', id: 'framio-content:hashtags', legacyId: 'ernestdefoe-hashtags', title: 'Konu Etiketleri (#)' },
  { key: 'flamoji', id: 'framio-content:flamoji', legacyId: 'pianotell-flamoji', title: 'Emoji Seçici 😀', always: true },
  { key: 'deep-tags', id: 'framio-content:deep-tags', title: 'Çok Seviyeli Kategoriler' },
];

export const extend = [...(e0 ?? []), ...(e1 ?? []), ...(e2 ?? []), ...(e3 ?? []), ...(e4 ?? []), ...(e5 ?? []), new Extend.Admin().page(framioGroupPage(tabs))];
