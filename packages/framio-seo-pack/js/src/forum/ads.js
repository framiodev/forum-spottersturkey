import { extend } from 'flarum/common/extend';
import Page from 'flarum/common/components/Page';
import IndexPage from 'flarum/forum/components/IndexPage';
import app from 'flarum/forum/app';
import { renderAd } from '../common/adRender';

/**
 * Reklam alanları.
 *  - Sayfa üstü / menü altı / alt bilgi: #content'in çevresindeki kalıcı yuvalara çizilir.
 *  - Konu üstü / altı: konu akışının başına ve sonuna.
 *  - Mesaj araları: her N mesajda bir PostStream içine.
 *  - Kenar çubuğu: ana sayfa ve konu sayfası kenar menüsü.
 *  - Yapışkan şerit / açılır pencere: gecikme ve sıklık sınırıyla sayfa üstünde.
 */
let ads = [];
let loaded = false;
const seen = new Set();
const dismissed = new Set();
let popupTimer = null;
let popupReady = false;

const setting = k => app.forum && app.forum.attribute(k);
const isMobile = () => window.innerWidth <= 768;

function track(id, action) {
    if (action === 'track_impression') {
        if (seen.has(id)) return;
        seen.add(id);
    }
    app.request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/seo/ads', body: { action, id } }).catch(() => {});
}

function storageKey(ad) {
    return 'framio-ad-closed-' + ad.id;
}

function recentlyClosed(ad) {
    if (!ad.frequency_hours) return dismissed.has(ad.id);
    try {
        const t = parseInt(localStorage.getItem(storageKey(ad)) || '0', 10);
        return dismissed.has(ad.id) || (t && Date.now() - t < ad.frequency_hours * 3600 * 1000);
    } catch (e) {
        return dismissed.has(ad.id);
    }
}

function close(ad) {
    dismissed.add(ad.id);
    try { localStorage.setItem(storageKey(ad), String(Date.now())); } catch (e) {}
    renderFloating();
}

/** Mevcut sayfanın türü ve bölüm kısa adları */
function pageContext() {
    const cur = app.current;
    const d = cur && cur.get && cur.get('discussion');
    if (d) {
        const tags = d && d.tags ? (d.tags() || []).filter(Boolean).map(t => t.slug()) : [];
        return { type: 'discussion', tags };
    }
    const tag = m.route.param && m.route.param('tags');
    if (tag) return { type: 'tag', tags: [tag] };
    return { type: 'home', tags: [] };
}

function visible(ad, ctx) {
    if (!setting('framioAdsEnabled')) return false;
    if (app.session.user && (setting('framioAdsHideMembers') || ad.hide_for_members)) return false;
    if (isMobile() ? !ad.mobile : !ad.desktop) return false;
    if (ad.page_scope && ad.page_scope !== 'all') {
        if (ad.page_scope === 'tag' ? !(ctx.type === 'tag' || ctx.type === 'discussion') : ad.page_scope !== ctx.type) return false;
    }
    if (ad.tag_slugs && ad.tag_slugs.length && !ctx.tags.some(t => ad.tag_slugs.includes(t))) return false;
    return true;
}

function opts(ad) {
    return {
        client: setting('framioAdsClient'),
        // Ayar hiç kaydedilmediyse "Reklam"; bilinçli olarak boş bırakıldıysa etiket gösterilmez
        label: setting('framioAdsLabel') ?? 'Reklam',
        onImpression: () => track(ad.id, 'track_impression'),
        onClick: () => track(ad.id, 'track_click'),
        onClose: () => close(ad),
    };
}

function forLocation(location, ctx) {
    return ads.filter(a => a.location === location && visible(a, ctx));
}

function loadScript() {
    const client = setting('framioAdsClient');
    if (!client || document.getElementById('framio-adsense')) return;
    const need = setting('framioAdsAuto') || ads.some(a => a.type === 'adsense' && a.adsense_slot);
    if (!need || (app.session.user && setting('framioAdsHideMembers'))) return;
    const s = document.createElement('script');
    s.id = 'framio-adsense';
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client);
    document.head.appendChild(s);
}

/** #content çevresindeki kalıcı yuvalar */
function slot(id, where) {
    let el = document.getElementById(id);
    if (el) return el;
    const content = document.getElementById('content');
    if (!content || !content.parentNode) return null;
    el = document.createElement('div');
    el.id = id;
    el.className = 'FramioAdSlot';
    if (where === 'before') content.parentNode.insertBefore(el, content);
    else content.parentNode.insertBefore(el, content.nextSibling);
    return el;
}

function renderSlots() {
    if (!loaded) return;
    const ctx = pageContext();
    const top = slot('framio-ad-top', 'before');
    const footer = slot('framio-ad-footer', 'after');
    const list = l => forLocation(l, ctx).map(ad => renderAd(ad, opts(ad)));
    if (top) m.render(top, m('div.container', [...list('header_top'), ...list('header_bottom')]));
    if (footer) m.render(footer, m('div.container', list('footer')));
    renderFloating();
}

function renderFloating() {
    let host = document.getElementById('framio-ad-floating');
    if (!host) {
        host = document.createElement('div');
        host.id = 'framio-ad-floating';
        document.body.appendChild(host);
    }
    const ctx = pageContext();
    const items = forLocation('floating', ctx).filter(ad => !recentlyClosed(ad));
    const sticky = items.filter(a => a.format === 'sticky');
    const popup = items.filter(a => a.format === 'popup');

    // Açılır pencere: sayfada en fazla bir tane, gecikmeden sonra
    if (popup.length && !popupReady && !popupTimer) {
        popupTimer = setTimeout(() => { popupReady = true; renderFloating(); }, (popup[0].delay_seconds || 0) * 1000);
    }

    m.render(host, [
        ...sticky.map(ad => renderAd(ad, opts(ad))),
        popupReady && popup[0] ? renderAd(popup[0], opts(popup[0])) : null
    ]);
}

export default function () {
    const load = () => {
        if (loaded || !app.forum) return;
        loaded = true;
        if (!setting('framioAdsEnabled')) return;
        app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/seo/ads?for_forum=1' })
            .then(res => {
                ads = res.data || [];
                loadScript();
                renderSlots();
                m.redraw();
            })
            .catch(() => {});
    };

    // Başlatıcı çalışırken forum verisi henüz yok: hazır olana kadar kısa aralıklarla beklenir
    let tries = 0;
    const boot = setInterval(() => {
        if (app.forum || ++tries > 100) {
            clearInterval(boot);
            load();
        }
    }, 100);

    // Sayfa değişiminde yuvalar yeni bağlama (ana sayfa / bölüm / konu) göre güncellenir
    let lastPath = location.pathname;
    const onRoute = () => {
        if (location.pathname === lastPath) return;
        lastPath = location.pathname;
        setTimeout(renderSlots, 50);
    };
    window.addEventListener('popstate', onRoute);
    ['pushState', 'replaceState'].forEach(fn => {
        const orig = history[fn];
        history[fn] = function () {
            const r = orig.apply(this, arguments);
            onRoute();
            return r;
        };
    });
    extend(Page.prototype, 'oncreate', () => setTimeout(renderSlots, 0));

    const sidebar = function (items) {
        forLocation('sidebar', pageContext()).forEach((ad, i) => {
            const node = renderAd(ad, opts(ad));
            if (node) items.add('framio-ad-' + ad.id, node, -100 - i);
        });
    };
    extend(IndexPage.prototype, 'sidebarItems', sidebar);
    // Flarum 2: konu sayfası bileşenleri sonradan yüklenir; dize ile genişletilir
    extend('flarum/forum/components/DiscussionPage', 'sidebarItems', sidebar);

    // Konu üstü / mesaj araları / konu altı
    extend('flarum/forum/components/PostStream', 'view', function (vdom) {
        if (!ads.length || !vdom || !Array.isArray(vdom.children)) return;
        const ctx = pageContext();
        const between = forLocation('discussion_between_posts', ctx);
        const topAds = forLocation('discussion_top', ctx);
        const bottomAds = forLocation('discussion_bottom', ctx);
        if (!between.length && !topAds.length && !bottomAds.length) return;

        const out = [];
        let count = 0;
        vdom.children.forEach(child => {
            out.push(child);
            const isPost = child && child.attrs && child.attrs['data-type'] === 'comment';
            if (!isPost) return;
            count++;
            between.forEach(ad => {
                if (count % ad.post_interval === 0) {
                    const node = renderAd(ad, opts(ad));
                    if (node) out.push(m('div.PostStream-item.FramioAd-between', { key: 'ad-' + ad.id + '-' + count }, node));
                }
            });
        });

        const wrap = (list, pos) => list.map(ad => {
            const node = renderAd(ad, opts(ad));
            return node ? m('div.PostStream-item.FramioAd-' + pos, { key: 'ad-' + pos + '-' + ad.id }, node) : null;
        }).filter(Boolean);

        vdom.children = [...wrap(topAds, 'top'), ...out, ...wrap(bottomAds, 'bottom')];
    });

    window.addEventListener('resize', () => { if (loaded) renderSlots(); }, { passive: true });
}
