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
      const forum = app.forum;
      const logo = forum.attribute('logoUrl');
      const title = forum.attribute('title');
      const unread = (() => {
        const b = document.querySelector('.MessagesDropdown .Bubble, .item-direct-messages .Bubble, .item-direct-messages .NotificationsDropdown-unread');
        return b ? parseInt(b.textContent, 10) || 0 : 0;
      })();
      // iOS ayarları düzeni: renkli simge karosu + etiket + (rozet | ok)
      const row = (icon, tint, label, sub, onclick, extra) => (
        <button type="button" className="MobileMenu-row" onclick={onclick}>
          <span className="MobileMenu-ic" style={{ '--tint': tint }}><i className={'icon ' + icon} /></span>
          <span className="MobileMenu-label">{label}{sub ? <small>{sub}</small> : null}</span>
          {extra === undefined ? <i className="icon fas fa-chevron-right MobileMenu-chev" /> : extra}
        </button>
      );
      const theme = themeOf();
      const setTheme = (key) => { click('.ThemeSwitcher-option--' + key); m.redraw(); };
      const terms = forum.attribute('framioSeoLicenseUrl') || null;

      return (
        <div className="MobileMenu-backdrop" onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="MobileMenu" role="dialog" aria-label="Menü">
            <div className="MobileMenu-head">
              {logo ? <img className="MobileMenu-logo" src={logo} alt={title} /> : <b>{title}</b>}
              <button type="button" className="MobileMenu-x" aria-label="Kapat" onclick={close}><i className="icon fas fa-times" /></button>
            </div>

            {user ? (
              <button type="button" className="MobileMenu-profile" onclick={go(() => m.route.set(app.route.user(user)))}
                style={user.attribute && user.attribute('cover') ? { backgroundImage: 'url(' + user.attribute('cover') + ')' } : {}}>
                <span className="MobileMenu-profileShade" />
                <Avatar user={user} />
                <span className="MobileMenu-profileText"><b>{user.displayName()}</b><small>Profilini gör</small></span>
                <i className="icon fas fa-chevron-right" />
              </button>
            ) : (
              <div className="MobileMenu-join">
                <b>{title} topluluğuna katıl</b>
                <p>Fotoğraflarını paylaş, beğen, yorum yap ve spotter'larla tanış.</p>
                <div className="MobileMenu-joinBtns">
                  <button type="button" className="MobileMenu-primary" onclick={go(() => import('flarum/forum/components/SignUpModal').then((mod) => app.modal.show(mod.default)))}>Kayıt ol</button>
                  <button type="button" className="MobileMenu-secondary" onclick={go(() => import('flarum/forum/components/LogInModal').then((mod) => app.modal.show(mod.default)))}>Giriş yap</button>
                </div>
              </div>
            )}

            <div className="MobileMenu-section">Keşfet</div>
            <div className="MobileMenu-group">
              {row('fas fa-search', '#0a84ff', 'Ara', 'Plaka, model, firma veya kullanıcı', go(() => click('.Search-input, .Search button, .item-search button, .item-search input')))}
              {user ? row('fas fa-paper-plane', '#ff375f', 'Mesajlar', null, go(() => m.route.set('/messages')), unread ? <span className="MobileMenu-badge">{unread}</span> : undefined) : null}
              {user && app.voiceRoomsWidget ? row('fas fa-headset', '#5e5ce6', 'Topluluk Odaları', 'Yazılı kanallar ve sesli sohbet', go(() => { if (!app.voiceRoomsWidget.isOpen) app.voiceRoomsWidget.togglePanel(); m.redraw(); })) : null}
              {row('fas fa-chart-simple', '#30b158', 'Topluluk', 'İstatistikler ve yeni üyeler', go(() => m.route.set('/all?topluluk=1')))}
            </div>

            <div className="MobileMenu-section">Görünüm</div>
            <div className="MobileMenu-themes">
              {[['auto', 'fas fa-circle-half-stroke', 'Sistem'], ['light', 'fas fa-sun', 'Açık'], ['dark', 'fas fa-moon', 'Koyu']].map(([k, ic, l]) => (
                <button type="button" className={'MobileMenu-theme MobileMenu-theme--' + k + (theme === k ? ' on' : '')} onclick={() => setTheme(k)}>
                  <span className="MobileMenu-themePrev"><i className={'icon ' + ic} /></span>
                  {l}
                </button>
              ))}
            </div>

            {user ? (
              <div>
                <div className="MobileMenu-section">Hesap</div>
                <div className="MobileMenu-group">
                  {row('fas fa-gear', '#8e8e93', 'Ayarlar', null, go(() => m.route.set(app.route('settings'))))}
                  {row('fas fa-arrow-right-from-bracket', '#ff453a', 'Çıkış yap', null, go(() => app.session.logout()), null)}
                </div>
              </div>
            ) : null}

            <div className="MobileMenu-foot">
              {terms ? <a href={terms} onclick={(e) => { e.preventDefault(); close(); m.route.set(terms.replace(forum.attribute('baseUrl'), '') || '/'); }}>Fotoğraf kullanım koşulları</a> : null}
              <span>© {new Date().getFullYear()} {title}</span>
            </div>
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
