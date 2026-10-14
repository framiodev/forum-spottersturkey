import { gate, gateExtenders, moduleOn } from './moduleGate';
import app from 'flarum/forum/app';
import Hashtag from '../hashtags/forum/models/Hashtag';

// Model kaydı
app.store.models['hashtags'] = Hashtag;

// Framio content — forum paketi. Modüller FoF kaynağından birebir yüklenir.
gate('pages', () => require('../pages/forum/index'));
gate('drafts', () => require('../drafts/forum/index'));
const e1 = gateExtenders('drafts', require('../drafts/forum/extend').default);
gate('discussion-thumbnail', () => require('../discussion-thumbnail/forum/index'));
const e2 = gateExtenders('discussion-thumbnail', require('../discussion-thumbnail/forum/extend').default);
gate('links', () => require('../links/forum/index'));
const e3 = gateExtenders('links', require('../links/forum/extend').default);
gate('hashtags', () => require('../hashtags/forum/index'));
// Çok seviyeli kategoriler doğrudan prototip genişletir; başlatıcı içinde, modül açıksa çalışsın
const initDeepTagsForum = require('../deep-tags/forum/index').default;
app.initializers.add('framio-content-deep-tags', () => { if (moduleOn('deep-tags')) initDeepTagsForum(); });
// DeepTags forum hiyerarşi ve navigasyonunu başlat

export const extend = [...(e1 ?? []), ...(e2 ?? []), ...(e3 ?? [])];
