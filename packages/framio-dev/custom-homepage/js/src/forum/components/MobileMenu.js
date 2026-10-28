import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';

/**
 * Telefon ⋮ menüsü: Flarum'un soldan açılan çekmecesi yerine alttan açılan, maket düzeninde menü.
 * Üstte hesap (giriş yapılmışsa avatar + ad, değilse Giriş yap / Kayıt ol), ardından Mesajlar,
 * Topluluk Odaları (yazılı kanallar + sesli sohbet), Arama, Tema ve hesap bağlantıları.
 * İşlemler eklentilerin kendi düğmelerini / pencerelerini çağırır; yeni bir davranış eklenmez.
 */
let host = null;

const click = (sel) => {
  const el = document.querySelector(sel);
  if (el) { el.click(); return true; }
  return false;
};

export function openMobileMenu() {
  if (host) return;
  host = document.createElement('div');
  host.className = 'MobileMenu-mount';
  document.body.appendChild(host);

  const close = () => {
    if (!host) return;
    m.mount(host, null);
    host.remove();
    host = null;
  };
  const go = (fn) => () => { close(); setTimeout(fn, 30); };

  const themeOf = () => {
    const cur = document.querySelector('.ThemeSwitcher-option.active, .ThemeSwitcher-option.is-active, .ThemeSwitcher-option[aria-pressed="true"]');
    if (cur) return (cur.className.match(/--(auto|light|dark)/) || [])[1] || 'auto';
    return document.documentElement.getAttribute('data-theme') || 'auto';
  };

  m.mount(host, {
    view: () => {
      const user = app.session.user;
      const unread = (() => {
        const b = document.querySelector('.MessagesDropdown .Bubble, .item-direct-messages .Bubble, .item-direct-messages .NotificationsDropdown-unread');
        return b ? parseInt(b.textContent, 10) || 0 : 0;
      })();
      const row = (icon, label, onclick, extra) => (
        <button type="button" className="MobileMenu-row" onclick={onclick}>
          <span className="MobileMenu-ic"><i className={'icon ' + icon} /></span>
          <span className="MobileMenu-label">{label}</span>
          {extra || <i className="icon fas fa-chevron-right MobileMenu-chev" />}
        </button>
      );
      const theme = themeOf();
      const setTheme = (key) => {
        click('.ThemeSwitcher-option--' + key);
        m.redraw();
      };

      return (
        <div className="MobileMenu-backdrop" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="MobileMenu" role="dialog" aria-label="Menü">
            <span className="MobileMenu-grip" />

            {user ? (
              <button type="button" className="MobileMenu-account" onclick={go(() => m.route.set(app.route.user(user)))}>
                <Avatar user={user} />
                <span><b>{user.displayName()}</b><small>Profilini gör</small></span>
                <i className="icon fas fa-chevron-right MobileMenu-chev" />
              </button>
            ) : (
              <div className="MobileMenu-guest">
                <p>Fotoğraf paylaşmak, beğenmek ve yorum yapmak için giriş yap.</p>
                <div>
                  <button type="button" className="MobileMenu-primary" onclick={go(() => import('flarum/forum/components/LogInModal').then((mod) => app.modal.show(mod.default)))}>Giriş yap</button>
                  <button type="button" className="MobileMenu-secondary" onclick={go(() => import('flarum/forum/components/SignUpModal').then((mod) => app.modal.show(mod.default)))}>Kayıt ol</button>
                </div>
              </div>
            )}

            <div className="MobileMenu-group">
              {row('fas fa-search', 'Ara', go(() => click('.Search-input, .Search button, .item-search button, .item-search input')))}
              {user ? row('far fa-comments', 'Mesajlar', go(() => m.route.set('/messages')), unread ? <span className="MobileMenu-badge">{unread}</span> : null) : null}
              {user && app.voiceRoomsWidget ? row('fas fa-headset', 'Topluluk Odaları', go(() => { if (!app.voiceRoomsWidget.isOpen) app.voiceRoomsWidget.togglePanel(); m.redraw(); })) : null}
              {row('fas fa-users', 'Topluluk ve istatistikler', go(() => m.route.set('/all?topluluk=1')))}
            </div>

            <div className="MobileMenu-group">
              <div className="MobileMenu-themeRow">
                <span className="MobileMenu-ic"><i className="icon fas fa-circle-half-stroke" /></span>
                <span className="MobileMenu-label">Tema</span>
                <div className="MobileMenu-seg">
                  {[['auto', 'Sistem'], ['light', 'Açık'], ['dark', 'Koyu']].map(([k, l]) => (
                    <button type="button" className={theme === k ? 'on' : ''} onclick={() => setTheme(k)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>

            {user ? (
              <div className="MobileMenu-group">
                {row('fas fa-cog', 'Ayarlar', go(() => m.route.set(app.route('settings'))))}
                {row('fas fa-sign-out-alt', 'Çıkış yap', go(() => app.session.logout()), <span />)}
              </div>
            ) : null}

            <button type="button" className="MobileMenu-cancel" onclick={close}>Kapat</button>
          </div>
        </div>
      );
    },
  });
}

/** Telefonda ⋮ (çekmece) düğmesi bu menüyü açar */
export function installMobileMenu() {
  document.addEventListener('click', (e) => {
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    const btn = e.target.closest && e.target.closest('.Navigation-drawer');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    openMobileMenu();
  }, true);
}
