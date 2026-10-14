import app from 'flarum/admin/app';

const m = window.m;

/** Görsel sunucusu ?w= destekliyorsa küçük önizleme adresi (yönetim panelini hafifletir) */
export function sized(url, width) {
    if (!url) return url;
    if (/[?&]w=\d+/.test(url)) return url.replace(/([?&]w=)\d+/, '$1' + width);
    const dynamic = app.data.settings['framio-upload-exif.cdn_dynamic_resize'];
    const domain = (app.data.settings['framio-upload-exif.custom_domain'] || '').replace(/\/$/, '');
    if (dynamic && dynamic !== '0' && domain && url.indexOf(domain + '/') === 0 && /\.webp$/i.test(url)) return url + '?w=' + width;

    return url;
}

export const altMissing = alt => !alt || alt === 'Açıklama Belirtilmedi' || alt.trim().length < 4;

/** Gönderi sayfasının ürettiği JSON-LD bloklarını okur (aynı alan adı; sunucu çıktısı) */
function loadJsonLd(state, url) {
    state.ld = { loading: true, items: [] };
    fetch(url, { credentials: 'omit' })
        .then(r => r.text())
        .then(html => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const items = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(s => {
                try { return JSON.parse(s.textContent); } catch (e) { return { _error: 'Geçersiz JSON', raw: s.textContent.slice(0, 300) }; }
            });
            const title = (doc.querySelector('title') || {}).textContent || '';
            const desc = (doc.querySelector('meta[name="description"]') || {}).content || '';
            const canonical = (doc.querySelector('link[rel="canonical"]') || {}).href || '';
            const h1 = doc.querySelectorAll('h1').length;
            state.ld = { loading: false, items, title, desc, canonical, h1 };
            m.redraw();
        })
        .catch(() => { state.ld = { loading: false, error: 'Sayfa okunamadı.' }; m.redraw(); });
}

function inspect(state, url) {
    state.gsc = { loading: true };
    app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/seo/inspect', params: { url } })
        .then(res => { state.gsc = res.status === 'success' ? res : { error: res.message }; m.redraw(); })
        .catch(() => { state.gsc = { error: 'Ağ hatası' }; m.redraw(); });
}

function summary(item) {
    if (item._error) return item._error;
    const t = item['@type'];
    const bits = [];
    if (item.headline || item.name) bits.push(item.headline || item.name);
    if (Array.isArray(item.image)) bits.push(item.image.length + ' görsel');
    if (Array.isArray(item.itemListElement)) bits.push(item.itemListElement.length + ' öğe');
    if (Array.isArray(item.comment)) bits.push(item.comment.length + ' yorum');
    return (Array.isArray(t) ? t.join(', ') : t) + (bits.length ? ' — ' + bits.join(' · ') : '');
}

/** Gönderi kartı açıldığında başlığın altında gösterilen araç çubuğu ve sonuç panelleri */
export function postSeoTools(page, post) {
    page.postTools = page.postTools || {};
    const st = page.postTools[post.post_id] = page.postTools[post.post_id] || {};
    const url = post.post_url || post.discussion_url;
    const g = st.gsc;
    const ld = st.ld;

    return m('div.FramioPostSeo', [
        m('div.FramioPostSeo-bar', [
            m('a.Button.Button--small', { href: url, target: '_blank', rel: 'noopener' }, [m('i.fas.fa-link'), ' Gönderi sayfası']),
            m('button.Button.Button--small', { disabled: g && g.loading, onclick: () => inspect(st, url) }, [m('i.fab.fa-google'), g && g.loading ? ' Kontrol ediliyor…' : ' Google\'da dizinde mi?']),
            m('button.Button.Button--small', { onclick: () => (st.ld && !st.ld.loading ? (st.ld = null) : loadJsonLd(st, url)) }, [m('i.fas.fa-code'), ld ? ' JSON-LD\'yi gizle' : ' JSON-LD şemaları']),
            m('a.Button.Button--small', { href: 'https://search.google.com/test/rich-results?url=' + encodeURIComponent(url), target: '_blank', rel: 'noopener' }, [m('i.fas.fa-vial'), ' Zengin Sonuç Testi']),
            post.brand || post.images[0] ? m('a.Button.Button--small', {
                href: 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent((post.images[0] && !altMissing(post.images[0].alt) ? post.images[0].alt : post.discussion_title)),
                target: '_blank', rel: 'noopener'
            }, [m('i.fas.fa-images'), ' Google Görseller']) : null
        ]),

        g && !g.loading ? m('div.FramioPostSeo-panel', g.error ? m('div.FramioPostSeo-bad', g.error) : [
            m('div', { className: g.indexed ? 'FramioPostSeo-ok' : 'FramioPostSeo-bad' }, g.indexed ? '🟢 Google dizininde' : '🔴 Google dizininde değil'),
            g.details ? m('dl.FramioPostSeo-dl', [
                m('dt', 'Kapsam'), m('dd', g.details.coverageState || '-'),
                m('dt', 'Son tarama'), m('dd', (g.details.lastCrawlTime || '-').replace('T', ' ').replace('Z', ' UTC')),
                m('dt', 'Google kanonik'), m('dd', g.details.googleCanonical || '-'),
                m('dt', 'Zengin sonuç'), m('dd', (g.details.richVerdict || '-') + ((g.details.richTypes || []).length ? ' (' + g.details.richTypes.join(', ') + ')' : ''))
            ]) : null,
            !g.indexed ? m('button.Button.Button--small', {
                onclick: e => {
                    e.target.disabled = true;
                    app.request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/seo/manual-ping', body: { urls: [url], ids: [post.discussion_id] } })
                        .then(res => app.alerts.show({ type: 'success' }, res.message));
                }
            }, 'Google\'a bildir') : null
        ]) : null,

        ld ? m('div.FramioPostSeo-panel', ld.loading ? 'Sayfa okunuyor…' : ld.error ? m('div.FramioPostSeo-bad', ld.error) : [
            m('dl.FramioPostSeo-dl', [
                m('dt', 'Başlık'), m('dd', [ld.title, ' ', m('span.FramioBadge', { className: ld.title.length > 60 ? 'is-warn' : '' }, ld.title.length + ' kr')]),
                m('dt', 'Açıklama'), m('dd', ld.desc || m('span.FramioBadge.is-bad', 'yok')),
                m('dt', 'Kanonik'), m('dd', ld.canonical || '-'),
                m('dt', 'H1 sayısı'), m('dd', m('span.FramioBadge', { className: ld.h1 === 1 ? '' : 'is-bad' }, ld.h1))
            ]),
            ld.items.map((it, i) => m('details.FramioPostSeo-ld', { key: i }, [
                m('summary', summary(it)),
                m('pre', JSON.stringify(it, null, 2))
            ]))
        ]) : null
    ]);
}
