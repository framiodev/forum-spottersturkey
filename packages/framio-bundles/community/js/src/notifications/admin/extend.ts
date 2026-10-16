import Extend from 'flarum/common/extenders';
import BroadcastPage from './BroadcastPage';

// Grup duyuruları (Telegram / WhatsApp): ayarlar + kuyruk tek sayfada
export default [new Extend.Admin('framio-community:notifications').page(BroadcastPage)];
