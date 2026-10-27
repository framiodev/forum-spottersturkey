import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import icon from 'flarum/common/helpers/icon';

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
    const unread = user ? user.unreadNotificationCount() || 0 : 0;

    const tab = (key, ic, label, active, onclick, badge) => (
      <button type="button" className={'MobileTabBar-tab' + (active ? ' active' : '') + (key === 'upload' ? ' MobileTabBar-upload' : '')}
        aria-label={label} onclick={onclick}>
        {icon(ic)}
        {badge ? <span className="MobileTabBar-badge">{badge > 9 ? '9+' : badge}</span> : null}
      </button>
    );

    return (
      <nav className="MobileTabBar" aria-label="Alt gezinme">
        {tab('home', 'fas fa-house', 'Ana sayfa', route === 'index' || route === 'tag', () => this.go(app.route('index')))}
        {tab('explore', 'fas fa-compass', 'Keşfet', route === 'framio.explore', () => this.go(app.route('framio.explore')))}
        {tab('upload', 'fas fa-plus', 'Fotoğraf paylaş', false, () => this.upload())}
        {tab('notif', 'fas fa-bell', 'Bildirimler', route === 'notifications', () => (user ? this.go(app.route('notifications')) : this.login()), unread)}
        {tab('profile', 'fas fa-user', 'Profil', route && route.indexOf('user') === 0, () => (user ? this.go(app.route.user(user)) : this.login()))}
      </nav>
    );
  }

  go(url) {
    if (m.route.get() === url) window.scrollTo({ top: 0, behavior: 'smooth' });
    else m.route.set(url);
  }

  login() {
    import('flarum/forum/components/LogInModal').then((mod) => app.modal.show(mod.default));
  }

  upload() {
    if (!app.session.user) return this.login();
    // Yeni başlık düzenleyicisini açar (fotoğraf yükleme düğmesi düzenleyicinin içindedir)
    import('flarum/forum/components/DiscussionComposer').then((mod) => {
      app.composer.load(mod.default, { user: app.session.user });
      app.composer.show();
    });
  }
}
