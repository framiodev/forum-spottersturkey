// Framio profiles — admin paketi. Modüller FoF kaynağından birebir yüklenir.
import Extend from 'flarum/common/extenders';
import framioGroupPage from './FramioGroupPage';
import '../masquerade/admin/index';
import e0 from '../masquerade/admin/extend';
import '../socialprofile/admin/index';
import e1 from '../socialprofile/admin/extend';
import '../user-bio/admin/index';
import '../signature/admin/index';
import e2 from '../signature/admin/extend';
import '../profile-cover/admin/index';
import e3 from '../profile-cover/admin/extend';
import '../custom-profile-page/admin/index';
import e4 from '../custom-profile-page/admin/extend';
import '../profile-stories/admin/index';
import e5 from '../profile-stories/admin/extend';
import '../badges/admin/index';
import e6 from '../badges/admin/extend';
import e7 from '../user-map/admin/extend';
import '../point-system/admin/index';

// Her modül kendi registry bağlamına kaydeder; sekmeler bu bağlamları okur.
const tabs = [
  { key: 'point-system', id: 'ramon-point-system', legacyId: 'ramon-point-system', title: 'Puan & Süsleme Sistemi' },
  { key: 'badges', id: 'framio-profiles:badges', legacyId: 'fof-badges', title: 'Rozetler' },
  { key: 'user-map', id: 'framio-profiles:user-map', legacyId: 'framio-profiles:user-map', title: 'Üye Haritası' },
  { key: 'masquerade', id: 'framio-profiles:masquerade', legacyId: 'fof-masquerade', title: 'Özel Profil Alanları' },
  { key: 'socialprofile', id: 'framio-profiles:socialprofile', legacyId: 'fof-socialprofile', title: 'Sosyal Profil Butonları' },
  { key: 'user-bio', id: 'framio-profiles:user-bio', legacyId: 'fof-user-bio', title: 'Kullanıcı Biyografisi' },
  { key: 'usercard-stats', id: 'framio-profiles:usercard-stats', legacyId: 'fof-usercard-stats', title: 'Kart İstatistikleri' },
  { key: 'profile-image-crop', id: 'framio-profiles:profile-image-crop', legacyId: 'fof-profile-image-crop', title: 'Avatar Kırpma' },
  { key: 'rank-badges', id: 'framio-profiles:rank-badges', legacyId: 'hazbin-rank-badges', title: 'Rütbe Rozetleri' },
  { key: 'signature', id: 'framio-profiles:signature', legacyId: 'gtdxyz-signature', title: 'İmza' },
  { key: 'profile-cover', id: 'framio-profiles:profile-cover', legacyId: 'sycho-profile-cover', title: 'Profil Kapağı' },
  { key: 'custom-profile-page', id: 'framio-profiles:custom-profile-page', legacyId: 'huseyinfiliz-custom-profile-page', title: 'Özel Profil Sayfası' },
  { key: 'profile-stories', id: 'framio-profiles:profile-stories', legacyId: 'justoverclock-profile-stories', title: 'Profil Hikayeleri' },
];

export const extend = [...(e0 ?? []), ...(e1 ?? []), ...(e2 ?? []), ...(e3 ?? []), ...(e4 ?? []), ...(e5 ?? []), ...(e6 ?? []), ...(e7 ?? []), new Extend.Admin().page(framioGroupPage(tabs))];
