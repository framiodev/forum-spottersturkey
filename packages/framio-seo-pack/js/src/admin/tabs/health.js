import app from 'flarum/admin/app';

const m = window.m;
const api = () => app.forum.attribute('apiUrl');

export function loadHealth(page) {
    page.health = page.health || { loading: false, data: null };
    page.health.loading = true;

    return app.request({ method: 'GET', url: api() + '/seo/health' })
        .then(res => { page.health.data = res; page.health.loading = false; m.redraw(); })
        .catch(() => { page.health.loading = false; m.redraw(); });
}

function ago(sec) {
    if (sec === null || sec === undefined) return 'hiç çalışmadı';
    if (sec < 90) return sec + ' sn önce';
    if (sec < 5400) return Math.round(sec / 60) + ' dk önce';
    if (sec < 172800) return Math.round(sec / 3600) + ' saat önce';
    return Math.round(sec / 86400) + ' gün önce';
}

const kb = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';

function item(tone, icon, title, value, sub, action) {
    return m('div.FramioHealth-item', { className: 'is-' + tone }, [
        m('i', { className: 'fas fa-' + icon }),
        m('div.FramioHealth-body', [
            m('div.FramioHealth-title', title),
            m('div.FramioHealth-value', value),
            sub ? m('div.FramioHealth-sub', sub) : null
        ]),
        action || null
    ]);
}

export function renderHealthPanel(page) {
    const st = page.health || {};
    if (!st.data) {
        if (!st.loading) loadHealth(page);
        return m('div.FramioHealth', m('div.FramioHealth-loading', [m('i.fas.fa-spinner.fa-spin'), ' Sistem sağlığı kontrol ediliyor…']));
    }

    const d = st.data;
    const cronAge = d.web_cron.ago;
    const cronTone = !d.web_cron.enabled ? 'muted' : (cronAge !== null && cronAge < 600 ? 'ok' : 'bad');
    const pct = d.indexing.backfill_total ? Math.round(100 * d.indexing.backfill_cursor / d.indexing.backfill_total) : 0;

    const checks = [
        d.sitemaps.post_pages_enabled, d.indexing.indexnow, d.bot_cache.enabled, d.sitemaps.legacy_redirects,
        cronTone === 'ok', d.indexing.service_account
    ];
    const score = Math.round(100 * checks.filter(Boolean).length / checks.length);

    return m('div.FramioHealth', [
        m('div.FramioHealth-head', [
            m('div.FramioHealth-score', { className: score >= 80 ? 'is-ok' : score >= 50 ? 'is-warn' : 'is-bad' }, [m('b', score), m('span', 'Sağlık')]),
            m('div', [
                m('h4', 'Sistem Sağlığı'),
                m('p', 'Tarama, dizine ekleme ve zamanlanmış görevlerin anlık durumu.')
            ]),
            m('button.Button.Button--icon', { title: 'Yenile', onclick: () => loadHealth(page) }, m('i.fas.fa-sync-alt', { className: st.loading ? 'fa-spin' : '' }))
        ]),
        m('div.FramioHealth-grid', [
            item('ok', 'sitemap', 'Site haritası adresleri', d.sitemaps.pages.toLocaleString('tr'),
                d.sitemaps.discussions + ' konu · ' + d.sitemaps.posts + ' gönderi sayfası · ' + d.sitemaps.hubs + ' araç sayfası'),
            item(pct >= 100 ? 'ok' : 'warn', 'paper-plane', 'Google geriye dönük bildirim', '%' + pct,
                d.indexing.backfill_cursor + ' / ' + d.indexing.backfill_total + ' adres' + (d.indexing.service_account ? '' : ' · servis hesabı yok')),
            item(d.indexing.indexnow ? 'ok' : 'muted', 'bolt', 'IndexNow (Bing, Yandex)', d.indexing.indexnow ? 'Açık' : 'Kapalı',
                'Google Indexing API: ' + (d.indexing.indexing_api ? 'açık' : 'kapalı')),
            item(cronTone, 'clock', 'Zamanlanmış görevler (web cron)', d.web_cron.enabled ? ago(cronAge) : 'Kapalı',
                cronTone === 'bad' ? '10 dakikadan uzun süredir çalışmadı — dış servisi kontrol edin.' : 'Zamanlanmış içerik ve sosyal paylaşımlar'),
            item(d.bot_cache.enabled ? 'ok' : 'muted', 'robot', 'Bot sayfa önbelleği', d.bot_cache.enabled ? d.bot_cache.files + ' sayfa' : 'Kapalı',
                kb(d.bot_cache.bytes) + ' · süre ' + Math.round(d.bot_cache.ttl / 3600) + ' saat',
                d.bot_cache.enabled ? m('button.Button.Button--small', {
                    onclick: () => {
                        if (!confirm('Bot önbelleği temizlensin mi? Botlar sonraki ziyarette sayfaları yeniden oluşturur.')) return;
                        app.request({ method: 'POST', url: api() + '/seo/health', body: { action: 'flush_bot_cache' } })
                            .then(res => { app.alerts.show({ type: 'success' }, res.message); loadHealth(page); });
                    }
                }, 'Temizle') : null),
            item(d.sitemaps.legacy_redirects ? 'ok' : 'muted', 'directions', 'Eski adres yönlendirmesi', d.sitemaps.legacy_redirects ? 'Açık' : 'Kapalı', 'Yanlış kısa adlı konu adresleri 301 ile düzeltilir')
        ])
    ]);
}
