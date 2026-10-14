import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import debugCapture from '../common/debugCapture';
import runtimeDarkPatch from '../common/runtimeDarkPatch';

app.initializers.add('framio-general', () => {
  // Hata Günlüğü: tarayıcı hatalarını topla (modül ve ayar açıksa)
  debugCapture(app, 'forum'); // ayar gönderim anında denetlenir (app.forum burada henüz yok)
  runtimeDarkPatch(); // çalışma anında eklenen <style>'lar için karanlık mod yaması

  // Kullanıcı tema seçimi: Flarum yalnızca forum renk şeması "Otomatik" iken kullanıcı tercihine izin verir.
  // Ayar açıksa forumun şeması yalnızca varsayılan olur; tercihi olan kullanıcıya kendi seçimi uygulanır.
  if (document.getElementById('framio-dark-mode')) {
    const coreInit = app.initColorScheme;
    app.initColorScheme = function (forumDefault = null) {
      if (app.forum.attribute('framioGeneral.dmUserSwitch') === false) return coreInit.call(this, forumDefault);

      forumDefault = forumDefault ?? (app.forum.attribute('colorScheme') || 'auto');
      this.allowUserColorScheme = true;

      const user = this.session.user;
      const preference = user ? user.preferences()?.colorScheme : sessionStorage.getItem('colorScheme');
      const scheme = preference || forumDefault;

      this.setColorScheme(scheme);

      if (scheme === 'auto' && !this.framioSchemeWatching) {
        this.framioSchemeWatching = true;
        this.watchSystemColorSchemePreference(() => this.initColorScheme(forumDefault));
      }
    };
  }

  // -------------------------------------------------------------------------
  // 1. Seamless Refresh (Kesintisiz Varlık Yenileme)
  // -------------------------------------------------------------------------
  const seamlessEnabled = (app.forum?.attribute?.('framioGeneral.seamlessRefresh') ?? true) !== false;
  const mutePrompts = (app.forum?.attribute?.('framioGeneral.mutePrompts') ?? true) !== false;

  if (seamlessEnabled) {
    let pendingReload = false;

    // Flarum 2.0 asset reload uyarısını intercept etme
    if (app.alerts && mutePrompts) {
      extend(app.alerts, 'show', function (result, attrs) {
        // Varlık yenilenmesi veya sürüm uyarısı içeren alert'leri sessize al
        const contentStr = typeof attrs?.content === 'string' ? attrs.content.toLowerCase() : '';
        const isAssetAlert =
          contentStr.includes('reload') ||
          contentStr.includes('yenile') ||
          contentStr.includes('updated') ||
          contentStr.includes('version') ||
          contentStr.includes('asset');

        if (isAssetAlert) {
          pendingReload = true;
          // Ekrana basılan alert'i gizle
          if (attrs) {
            attrs.type = 'hidden';
            setTimeout(() => app.alerts.dismiss(attrs), 50);
          }
        }
      });
    }

    // Kullanıcının ilk doğal sayfa geçişinde sessizce yenileme
    if (app.history) {
      extend(app.history, 'push', function () {
        if (pendingReload) {
          pendingReload = false;
          window.location.reload();
        }
      });
    }

    // Ayrıca bağlantıya tıklanıldığında (eğer bekleyen güncelleme varsa)
    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');
      if (anchor && pendingReload && anchor.href && !anchor.href.startsWith('javascript:')) {
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin === window.location.origin && !url.pathname.includes('/api/')) {
          pendingReload = false;
          // Normal SPA navigasyonu yerine tam sayfa yükleme
          window.location.href = anchor.href;
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // 2. Performans ve Hız Tanı Metrikleri
  // -------------------------------------------------------------------------
  window.addEventListener('load', () => {
    setTimeout(() => {
      const metrics = [];

      // Sayfa yüklenme süresi
      if (window.performance && window.performance.getEntriesByType) {
        const navEntries = window.performance.getEntriesByType('navigation');
        if (navEntries && navEntries.length > 0) {
          const nav = navEntries[0];
          const pageLoadTime = Math.round(nav.loadEventEnd - nav.startTime);

          if (pageLoadTime > 0) {
            metrics.push({
              type: 'page_load',
              url: window.location.pathname,
              duration_ms: pageLoadTime,
            });
          }
        }

        // Görsel yüklenme süreleri
        const resourceEntries = window.performance.getEntriesByType('resource');
        if (resourceEntries && resourceEntries.length > 0) {
          resourceEntries.forEach((entry) => {
            const isImage =
              entry.initiatorType === 'img' ||
              entry.name.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
            if (isImage) {
              const loadTime = Math.round(entry.duration);
              if (loadTime > 0) {
                metrics.push({
                  type: 'image_load',
                  url: entry.name,
                  duration_ms: loadTime,
                });
              }
            }
          });
        }
      }

      // Metrikleri arka planda kaydet
      if (metrics.length > 0 && app.forum?.attribute?.('apiUrl')) {
        app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/record-metric',
          body: { metrics },
          errorHandler: () => {},
        });
      }
    }, 3000);
  });

  // -------------------------------------------------------------------------
  // 3. Mobil Gezinme Çubuğu Logosu (Mobile Navigation Bar Logo)
  // -------------------------------------------------------------------------
  const MIN_HEIGHT = 16;
  const MAX_HEIGHT = 64;
  const DEFAULT_HEIGHT = 32;

  function vetUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) return null;
    if (value.startsWith('/')) return value;
    try {
      const parsed = new URL(value, window.location.href);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
      if (window.location.protocol === 'https:' && parsed.protocol === 'http:') return null;
      return parsed.href;
    } catch (e) {
      return null;
    }
  }

  function getMobileLogoHeight() {
    const raw = parseInt(app.forum?.attribute?.('framioGeneral.mobileLogoHeight'), 10);
    if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_HEIGHT;
    return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, raw));
  }

  function getMobileLogoUrl() {
    const source = app.forum?.attribute?.('framioGeneral.mobileLogoSource') || 'favicon';
    if (source === 'custom') {
      return vetUrl(app.forum?.attribute?.('framioGeneral.mobileLogoCustomUrl'));
    }
    if (source === 'logo') {
      return app.forum?.attribute?.('logoUrl') || app.forum?.attribute?.('faviconUrl') || null;
    }
    return app.forum?.attribute?.('faviconUrl') || app.forum?.attribute?.('logoUrl') || null;
  }

  extend('flarum/common/components/Navigation', 'view', function (vnode) {
    const isEnabled = app.forum?.attribute?.('framioGeneral.mobileLogoEnabled');
    if (!isEnabled) return;

    const className = (this.attrs && this.attrs.className) || '';
    if (!String(className).includes('App-backControl')) return;

    const url = getMobileLogoUrl();
    if (!url) return;
    if (!vnode || !vnode.children || typeof vnode.children.push !== 'function') return;

    const height = getMobileLogoHeight();

    const img = m('img', {
      className: 'LinkRobinsMobileLogo-image',
      src: url,
      alt: app.forum.attribute('title') || '',
      style: { height: height + 'px' },
      onerror: (e) => {
        const wrapper = e.target && e.target.parentNode;
        if (wrapper && wrapper.style) wrapper.style.display = 'none';
      },
    });

    const linkHome = app.forum.attribute('framioGeneral.mobileLogoLinkHome') !== false;
    const logo = linkHome
      ? m(
          'a',
          {
            className: 'LinkRobinsMobileLogo',
            href: app.forum.attribute('baseUrl') || '/',
            onclick: (e) => {
              if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
              e.preventDefault();
              if (app.history && typeof app.history.home === 'function') {
                app.history.home();
              } else {
                m.route.set('/');
              }
            },
          },
          img
        )
      : m('span', { className: 'LinkRobinsMobileLogo' }, img);

    const position = app.forum.attribute('framioGeneral.mobileLogoPosition') || 'left';
    if (position === 'right') {
      vnode.children.push(logo);
    } else {
      vnode.children.unshift(logo);
    }
  });
});

