import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import { openShareFlow } from './MobileShareFlow';

/**
 * Telefonda ekranın altında sabit duran 5 sekmeli gezinme çubuğu
 * (Akış · Keşfet · Yükle · Bildirimler · Profil). Masaüstünde CSS ile gizlidir.
 */
export default class MobileTabBar extends Component {
  view() {
    // Düzenleyici açıkken çubuk gizlenir; düzenleyici tüm ekranı kullanır
    if (app.composer && app.composer.isVisible && app.composer.isVisible()) return <nav className="MobileTabBar-hidden" />;

    const user = app.session.user;
    const route = app.current.get('routeName');

    // Mesaj sayfası (Threads düzeni): alt çubuk yerine sabit yanıt kutusu
    const discussion = app.current.get('discussion');
    if (discussion && /^discussion/.test(route || '')) {
      document.documentElement.classList.remove('MobileRoot');
      return (
        <div className="MobileTabBar-wrap">
          <div className="MobileReplyBar">
            <button type="button" className="MobileReplyBar-back" aria-label="Geri" onclick={() => (window.history.length > 1 ? window.history.back() : this.go('/all?sort=feed'))}>
              <i className="icon fas fa-chevron-left" />
            </button>
            <button type="button" className="MobileReplyBar-input" onclick={() => this.reply(discussion)}>
              {user ? (user.displayName() + ' olarak yanıtla…') : 'Yanıtlamak için giriş yap'}
            </button>
            <button type="button" className="MobileReplyBar-send" onclick={() => this.reply(discussion)}>Yanıtla</button>
          </div>
        </div>
      );
    }
    const unread = user ? user.unreadNotificationCount() || 0 : 0;

    const tab = (key, ic, label, active, onclick, badge) => (
      <button type="button" className={'MobileTabBar-tab' + (active ? ' active' : '') + (key === 'upload' ? ' MobileTabBar-upload' : '')}
        aria-label={label} onclick={onclick}>
        <i className={'icon ' + ic} aria-hidden="true" />
        {badge ? <span className="MobileTabBar-badge">{badge > 9 ? '9+' : badge}</span> : null}
      </button>
    );

    return (
      <div className="MobileTabBar-wrap">
        {this.rootLogo(route)}
        {/* Bildirimler Instagram'daki gibi üst başlıkta, arama düğmesinin solunda */}
        <button type="button" className={'MobileHeaderBell' + (route === 'notifications' ? ' active' : '')} aria-label="Bildirimler"
          onclick={() => (user ? this.go(app.route('notifications')) : this.login())}>
          <i className="icon fas fa-bell" aria-hidden="true" />
          {unread ? <span className="MobileTabBar-badge">{unread > 9 ? '9+' : unread}</span> : null}
        </button>
        <nav className="MobileTabBar" aria-label="Alt gezinme">
          {tab('home', 'fas fa-house', 'Akış', m.route.get() === '/all?sort=feed' || route === 'tags', () => this.go('/all?sort=feed'))}
          {tab('explore', 'fas fa-compass', 'Keşfet', route === 'framio.explore', () => this.go(app.route('framio.explore')))}
          {tab('upload', 'fas fa-plus', 'Fotoğraf paylaş', false, () => this.upload())}
          {tab('cats', 'fas fa-layer-group', 'Kategoriler', route === 'framio.categories' || route === 'tag' || !!m.route.param('topluluk'), () => this.go('/kategoriler'))}
          {tab('profile', 'fas fa-user', 'Profil', route && route.indexOf('user') === 0, () => (user ? this.go(app.route.user(user)) : this.login()))}
        </nav>
      </div>
    );
  }

  // Ana sekmelerde (Akış, Keşfet, Kategoriler, ana sayfa, kategori) başlıkta geri oku yerine logo
  rootLogo(route) {
    const root = ['index', 'tags', 'tag', 'framio.explore', 'framio.categories'].includes(route);
    document.documentElement.classList.toggle('MobileRoot', root);
    if (route !== 'tag') document.documentElement.classList.remove('MobileTagPage', 'MobileTagPage--photos', 'MobileTagPage--list');
    // Topluluk görünümü (/all?topluluk=1): yalnızca FoF Widgets bölümü (istatistikler, yeni üyeler)
    document.documentElement.classList.toggle('MobileCommunity', route === 'index' && !!m.route.param('topluluk'));
    // Logo: admin ayarındaki logo (Framio-MobileLogo) ana sekmelerde ortada gösterilir (CSS)
    return null;
  }

  go(url) {
    if (m.route.get() === url) window.scrollTo({ top: 0, behavior: 'smooth' });
    else m.route.set(url);
  }

  login() {
    import('flarum/forum/components/LogInModal').then((mod) => app.modal.show(mod.default));
  }

  // Fotoğraf paylaş akışı (maket 6): seçim ekranı → imza + künye → başlık + kategori
  upload() {
    openShareFlow();
  }

}
