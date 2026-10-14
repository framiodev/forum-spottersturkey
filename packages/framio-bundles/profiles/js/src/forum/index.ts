import { gate, gateExtenders, moduleOn } from './moduleGate';
import app from 'flarum/forum/app';
import Model from 'flarum/common/Model';
import User from 'flarum/common/models/User';

// Modül modelleri ve bileşenleri
import Answer from '../masquerade/lib/models/Answer';
import RootMasqueradePane from '../masquerade/forum/panes/RootMasqueradePane';
import SignaturePage from '../signature/forum/components/SignaturePage';
import BadgesPage from '../badges/forum/components/BadgesPage';
import UserBadgesPage from '../badges/forum/components/UserBadgesPage';
import Badge from '../badges/common/models/Badge';
import BadgeCategory from '../badges/common/models/BadgeCategory';
import UserBadge from '../badges/common/models/UserBadge';

// Modülleri yükle
gate('masquerade', () => require('../masquerade/forum/index'));
const e0 = gateExtenders('masquerade', require('../masquerade/forum/extend').default);
gate('socialprofile', () => require('../socialprofile/forum/index'));
const e1 = gateExtenders('socialprofile', require('../socialprofile/forum/extend').default);
gate('user-bio', () => require('../user-bio/forum/index'));
const e2 = gateExtenders('user-bio', require('../user-bio/forum/extend').default);
gate('usercard-stats', () => require('../usercard-stats/forum/index'));
gate('profile-image-crop', () => require('../profile-image-crop/forum/index'));
gate('rank-badges', () => require('../rank-badges/forum/index'));
gate('signature', () => require('../signature/forum/index'));
const e3 = gateExtenders('signature', require('../signature/forum/extend').default);
gate('profile-cover', () => require('../profile-cover/forum/index'));
gate('custom-profile-page', () => require('../custom-profile-page/forum/index'));
gate('profile-stories', () => require('../profile-stories/forum/index'));
gate('badges', () => require('../badges/forum/index'));
const e4 = gateExtenders('badges', require('../badges/forum/extend').default);
import { initUserMapForum } from '../user-map/forum';
gate('point-system', () => require('../point-system/forum/index'));
// ---------------------------------------------------------------------------
// Model Nitelikleri, İlişkileri ve Rotaları Başlatma
// ---------------------------------------------------------------------------
app.initializers.add('framio-profiles', () => {
  const UserModel = (User as any)?.prototype ? User : ((app.store as any)?.models?.users as any);
  if (UserModel?.prototype) {
    // 1. Masquerade
    UserModel.prototype.canEditMasqueradeProfile = Model.attribute('canEditMasqueradeProfile');
    UserModel.prototype.bioFields = Model.hasMany<Answer>('bioFields');
    UserModel.prototype.masqueradeAnswers = Model.hasMany<Answer>('masqueradeAnswers');

    // 2. Social Profile
    UserModel.prototype.canViewSocialProfile = Model.attribute('canViewSocialProfile');
    UserModel.prototype.canEditSocialProfile = Model.attribute('canEditSocialProfile');
    UserModel.prototype.socialButtons = Model.attribute('socialButtons', (str: unknown) => {
      try {
        return JSON.parse((str as string) || '[]');
      } catch {
        return [];
      }
    });

    // 3. User Bio
    UserModel.prototype.bio = Model.attribute('bio');
    UserModel.prototype.bioHtml = Model.attribute('bioHtml');

    // 4. Signature
    UserModel.prototype.canHaveSignature = Model.attribute('canHaveSignature');
    UserModel.prototype.canEditSignature = Model.attribute('canEditSignature');
    UserModel.prototype.signature = Model.attribute('signature');
    UserModel.prototype.signatureHtml = Model.attribute('signatureHtml');

    // 6. User Map
    UserModel.prototype.location = Model.attribute('location');
    UserModel.prototype.mapLat = Model.attribute('mapLat');
    UserModel.prototype.mapLon = Model.attribute('mapLon');
  }

  if (app.store?.models) {
    app.store.models['masquerade-answers'] = Answer;
    app.store.models['badges'] = Badge;
    app.store.models['badge-categories'] = BadgeCategory;
    app.store.models['user-badges'] = UserBadge;
  }

  if (app.routes) {
    if (moduleOn('badges')) app.routes['badges'] = { path: '/badges', component: BadgesPage };
    if (moduleOn('badges')) app.routes['user.badges'] = { path: '/u/:username/badges', component: UserBadgesPage };
    if (moduleOn('masquerade')) app.routes['fof-masquerade'] = { path: '/u/:username/masquerade', component: RootMasqueradePane };
    if (moduleOn('signature')) app.routes['user.signature'] = { path: '/u/:username/signature', component: SignaturePage };
  }

  if (moduleOn('user-map')) initUserMapForum();
});

export const extend = [...(e0 ?? []), ...(e1 ?? []), ...(e2 ?? []), ...(e3 ?? []), ...(e4 ?? [])];

