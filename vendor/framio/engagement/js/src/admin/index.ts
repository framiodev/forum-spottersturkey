// Framio engagement — admin paketi. Modüller FoF kaynağından birebir yüklenir.
import Extend from 'flarum/common/extenders';
import framioGroupPage from './FramioGroupPage';
import '../reactions/admin/index';
import e0 from '../reactions/admin/extend';
import '../polls/admin/index';
import e1 from '../polls/admin/extend';
import '../discussion-views/admin/index';
import e2 from '../discussion-views/admin/extend';
import '../share-social/admin/index';
import '../who-read/admin/index';
import e3 from '../who-read/admin/extend';
import '../bookmarks/admin/index';

// Her modül kendi registry bağlamına kaydeder; sekmeler bu bağlamları okur.
const tabs = [
  { key: 'reactions', id: 'framio-engagement:reactions', legacyId: 'fof-reactions', title: 'Tepkiler' },
  { key: 'polls', id: 'framio-engagement:polls', legacyId: 'fof-polls', title: 'Anketler' },
  { key: 'discussion-views', id: 'framio-engagement:discussion-views', legacyId: 'fof-discussion-views', title: 'Görüntülenme Sayacı' },
  { key: 'share-social', id: 'framio-engagement:share-social', legacyId: 'fof-share-social', title: 'Sosyal Paylaşım' },
  { key: 'who-read', id: 'framio-engagement:who-read', legacyId: 'clarkwinkelmann-who-read', title: 'Okuyanlar' },
  { key: 'bookmarks', id: 'framio-engagement:bookmarks', legacyId: 'fof-bookmarks', title: 'Yer İmleri' },
];

export const extend = [...(e0 ?? []), ...(e1 ?? []), ...(e2 ?? []), ...(e3 ?? []), new Extend.Admin().page(framioGroupPage(tabs))];
