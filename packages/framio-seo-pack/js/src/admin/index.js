import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import Alert from 'flarum/common/components/Alert';
import saveSettings from 'flarum/admin/utils/saveSettings';
import { loadAppearance, renderAppearanceTab } from './tabs/appearance';
import { renderHealthPanel } from './tabs/health';
import { loadAds as loadAdsTab, renderAdsTab } from './tabs/ads';
import { sized, altMissing, postSeoTools } from './tabs/imageTools';

const m = window.m;

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
    } else { 
        let ta = document.createElement('textarea'); 
        ta.value = text; 
        ta.style.position = 'fixed'; 
        document.body.appendChild(ta); 
        ta.select(); 
        document.execCommand('copy'); 
        document.body.removeChild(ta); 
    }
}

function trNorm(s) {
    return (s || '').toString()
        .replace(/İ/g, 'i')
        .replace(/I/g, 'i')
        .replace(/ı/g, 'i')
        .toLowerCase();
}

export default class SeoAdminPage extends ExtensionPage {
    oninit(vnode) {
        super.oninit(vnode);

        this.activeTab = 'dashboard';
        this.loading = false;
        this.isSaving = false;

        this.expandedPosts = {};
        this.expandedRows = {};

        this.selectedAuditPosts = new Set();
        this.auditQueue = [];
        this.auditQueueProgress = 0;
        this.auditQueueTotal = 0;
        this.isAuditQueueRunning = false;

        this.searchQuery = '';
        
        // Yeni Modül Form ve Durum Değişkenleri
        this.editingAd = null;
        this.isAdModalOpen = false;

        this.data = {
            dashboard: null,
            indexing: { items: [], page: 1, total_pages: 1 },
            images: { all: [], page: 1, perPage: 20, count: 0 },
            audit: { 
                posts: [], stats: {}, loading: false, 
                filterPriority: 'all', filterHasImage: 'with_image', 
                page: 1, perPage: 20, search: '' 
            },
            orphans: { items: [], stats: {}, loading: false },
            logs: { items: [], loading: false },
            ads: { items: [], stats: {}, loading: false },
            searches: { searches: [], top_keywords: [], niche_keywords: [], stats: {}, loading: false },
            social: { accounts: {}, best_posting_times: [], viral_candidates: [], loading: false },
            cache: JSON.parse(localStorage.getItem('framio_seo_cache_v2')) || {}
        };

        this.loadDashboard();
    }

    saveCache(url, data) {
        this.data.cache[url] = data;
        localStorage.setItem('framio_seo_cache_v2', JSON.stringify(this.data.cache));
    }

    // ---------- VERİ YÜKLEYİCİLER ----------
    loadDashboard() {
        this.loading = true;
        m.request({ 
            method: 'GET', 
            url: app.forum.attribute('apiUrl') + '/seo/stats', 
            headers: { 'X-CSRF-Token': app.session.csrfToken } 
        })
         .then(res => { this.data.dashboard = res; this.loading = false; m.redraw(); })
         .catch(() => { this.loading = false; m.redraw(); });
    }

    loadIndexing() {
        this.loading = true;
        m.request({ 
            method: 'GET', 
            url: app.forum.attribute('apiUrl') + '/seo/content', 
            params: { page: this.data.indexing.page }, 
            headers: { 'X-CSRF-Token': app.session.csrfToken } 
        })
         .then(res => { 
             this.data.indexing.items = res.items || []; 
             this.data.indexing.total_pages = res.total_pages || 1; 
             this.loading = false; 
             m.redraw(); 
         })
         .catch(() => { this.loading = false; m.redraw(); });
    }

    loadImages() {
        this.loading = true;
        this.data.images.page = 1;
        m.request({ 
            method: 'GET', 
            url: app.forum.attribute('apiUrl') + '/seo/images', 
            headers: { 'X-CSRF-Token': app.session.csrfToken } 
        })
         .then(res => {
             this.data.images.all = (res.status === 'success') ? (res.images || []) : [];
             this.data.images.count = (res.status === 'success') ? (res.count || 0) : 0;
             this.loading = false;
             m.redraw();
         })
         .catch(() => { this.loading = false; m.redraw(); });
    }

    loadAudit() {
        this.data.audit.loading = true;
        m.request({ 
            method: 'GET', 
            url: app.forum.attribute('apiUrl') + '/seo/post-audit?showAll=' + (this.data.audit.filterHasImage === 'all'), 
            headers: { 'X-CSRF-Token': app.session.csrfToken } 
        })
         .then(res => {
             this.data.audit.posts = res.posts || [];
             this.data.audit.stats = res.stats || {};
             this.data.audit.loading = false;
             m.redraw();
         })
         .catch(() => { this.data.audit.loading = false; m.redraw(); });
    }

    redirectsApi(method, body) {
        this.redir = this.redir || { redirects: [], not_found: [], stats: {}, loading: false, drafts: {} };
        this.redir.loading = true;
        return m.request({
            method,
            url: app.forum.attribute('apiUrl') + '/seo/redirects',
            headers: { 'X-CSRF-Token': app.session.csrfToken },
            body
        }).then(res => {
            if (res.redirects) {
                Object.assign(this.redir, { redirects: res.redirects, not_found: res.not_found, stats: res.stats || {} });
            }
            this.redir.loading = false;
            m.redraw();
            return res;
        }).catch(e => {
            this.redir.loading = false;
            app.alerts.show(Alert, { type: 'error' }, (e && e.response && e.response.error) || 'İşlem başarısız.');
            m.redraw();
        });
    }

    loadRedirects() {
        return this.redirectsApi('GET');
    }

    loadOrphans() {
        this.data.orphans.loading = true;
        m.request({ 
            method: 'GET', 
            url: app.forum.attribute('apiUrl') + '/seo/orphan-images?action=scan', 
            headers: { 'X-CSRF-Token': app.session.csrfToken } 
        })
         .then(res => {
             this.data.orphans.items = res.images || [];
             this.data.orphans.stats = res.stats || {};
             this.data.orphans.loading = false;
             m.redraw();
         })
         .catch(() => { this.data.orphans.loading = false; m.redraw(); });
    }

    loadLogs() {
        this.data.logs.loading = true;
        m.request({ 
            method: 'GET', 
            url: app.forum.attribute('apiUrl') + '/seo/logs', 
            headers: { 'X-CSRF-Token': app.session.csrfToken } 
        })
         .then(res => {
             this.data.logs.items = res.logs || [];
             this.data.logs.loading = false;
             m.redraw();
         })
         .catch(() => { this.data.logs.loading = false; m.redraw(); });
    }

    loadAds() {
        this.data.ads.loading = true;
        m.request({
            method: 'GET',
            url: app.forum.attribute('apiUrl') + '/seo/ads',
            headers: { 'X-CSRF-Token': app.session.csrfToken }
        }).then(res => {
            this.data.ads.items = res.ads || [];
            this.data.ads.stats = res.stats || {};
            this.data.ads.loading = false;
            m.redraw();
        }).catch(() => {
            this.data.ads.loading = false;
            m.redraw();
        });
    }

    loadSearches() {
        this.data.searches.loading = true;
        m.request({
            method: 'GET',
            url: app.forum.attribute('apiUrl') + '/seo/searches',
            headers: { 'X-CSRF-Token': app.session.csrfToken }
        }).then(res => {
            this.data.searches.searches = res.searches || [];
            this.data.searches.top_keywords = res.top_keywords || [];
            this.data.searches.niche_keywords = res.niche_keywords || [];
            this.data.searches.stats = res.stats || {};
            this.data.searches.loading = false;
            m.redraw();
        }).catch(() => {
            this.data.searches.loading = false;
            m.redraw();
        });
    }

    loadSocial() {
        this.data.social.loading = true;
        m.request({
            method: 'GET',
            url: app.forum.attribute('apiUrl') + '/seo/social-hub',
            headers: { 'X-CSRF-Token': app.session.csrfToken }
        }).then(res => {
            this.data.social.accounts = res.accounts || {};
            this.data.social.best_posting_times = res.best_posting_times || [];
            this.data.social.viral_candidates = res.viral_candidates || [];
            this.data.social.loading = false;
            m.redraw();
        }).catch(() => {
            this.data.social.loading = false;
            m.redraw();
        });
    }

    // ---------- KUYRUK & İŞLEMLER ----------
    startAuditQueue(postsToPing) {
        if (postsToPing.length === 0) return;
        this.auditQueue = postsToPing;
        this.auditQueueTotal = postsToPing.length;
        this.auditQueueProgress = 0;
        this.isAuditQueueRunning = true;
        this.processAuditQueue();
    }

    processAuditQueue() {
        if (this.auditQueue.length === 0) {
            this.isAuditQueueRunning = false;
            app.alerts.show(Alert, {type: 'success'}, 'Kuyruktaki tüm gönderimler başarıyla tamamlandı.');
            m.redraw();
            return;
        }

        const post = this.auditQueue.shift();

        m.request({
            method: 'POST',
            url: app.forum.attribute('apiUrl') + '/seo/manual-ping',
            headers: { 'X-CSRF-Token': app.session.csrfToken },
            body: { urls: [post.post_url || post.discussion_url], ids: [post.post_id], types: ['post'] }
        }).then(() => {
            this.auditQueueProgress++;
            m.redraw();
            setTimeout(() => this.processAuditQueue(), 1200);
        }).catch(() => {
            this.auditQueueProgress++;
            m.redraw();
            setTimeout(() => this.processAuditQueue(), 1200);
        });
    }

    pingSelectedAudit() {
        const postsToPing = this.data.audit.posts.filter(p => this.selectedAuditPosts.has(p.post_id));
        if (postsToPing.length === 0) {
            app.alerts.show(Alert, {type: 'warning'}, 'Lütfen önce pinglenecek gönderileri seçin.');
            return;
        }
        this.startAuditQueue(postsToPing);
    }

    pingCriticalAudit() {
        const postsToPing = this.data.audit.posts.filter(p => p.priority === 'critical');
        if (postsToPing.length === 0) {
            app.alerts.show(Alert, {type: 'warning'}, 'Kritik gönderi bulunamadı.');
            return;
        }
        this.startAuditQueue(postsToPing);
    }
    
    pingAllAudit() {
        if (!confirm('Tüm filtreli gönderiler sırayla pinglenecek. Emin misiniz?')) return;
        this.startAuditQueue(this.data.audit.posts);
    }

    deleteOrphans(ids) {
        if (!confirm(ids.length + ' adet görseli silmek istediğinize emin misiniz?')) return;
        m.request({
            method: 'POST',
            url: app.forum.attribute('apiUrl') + '/seo/orphan-images?action=delete',
            body: { ids: ids },
            headers: { 'X-CSRF-Token': app.session.csrfToken }
        }).then(res => {
            app.alerts.show(Alert, { type: 'success' }, res.message);
            this.loadOrphans();
        });
    }

    clearLogs() {
        if (!confirm('Tüm hata loglarını silmek istediğinize emin misiniz?')) return;
        m.request({
            method: 'GET',
            url: app.forum.attribute('apiUrl') + '/seo/logs?action=clear',
            headers: { 'X-CSRF-Token': app.session.csrfToken }
        }).then(res => {
            app.alerts.show(Alert, { type: 'success' }, res.message);
            this.loadLogs();
        });
    }

    checkGscIndex(url, postId) {
        let post = this.data.audit.posts.find(p => p.post_id === postId);
        if (post) post._inspecting = true;
        m.redraw();

        m.request({
            method: 'GET',
            url: app.forum.attribute('apiUrl') + '/seo/inspect',
            params: { url: url },
            headers: { 'X-CSRF-Token': app.session.csrfToken }
        }).then(res => {
            if (res.status === 'success') {
                this.saveCache(url, { indexed: res.indexed, date: Date.now() });
            }
            if (post) post._inspecting = false;
            m.redraw();
        }).catch(() => {
            if (post) post._inspecting = false;
            m.redraw();
        });
    }

    pingAllWaiting() {
        this.loading = true;
        app.request({
            method: 'GET',
            url: app.forum.attribute('apiUrl') + '/seo/trigger-index',
            params: { key: this.setting('framio-seo.trigger_secret')() }
        }).then(res => {
            app.alerts.show(Alert, {type: 'success'}, res.notified + ' içerik başarıyla senkronize edildi.');
            this.loadIndexing();
        }).catch(err => {
            app.alerts.show(Alert, {type: 'error'}, (err && err.error) || 'Toplu senkronizasyon başarısız.');
            this.loading = false;
            m.redraw();
        });
    }

    pingUnindexedOnly() {
        this.loading = true;
        app.request({
            method: 'GET',
            url: app.forum.attribute('apiUrl') + '/seo/trigger-index',
            params: { 
                key: this.setting('framio-seo.trigger_secret')(),
                only_unindexed: '1'
            }
        }).then(res => {
            app.alerts.show(Alert, {type: 'success'}, res.notified + ' adet indekslenmemiş içerik başarıyla yeniden gönderildi.');
            this.loadIndexing();
        }).catch(err => {
            app.alerts.show(Alert, {type: 'error'}, (err && err.error) || 'İndekslenmeyenleri gönderme işlemi başarısız.');
            this.loading = false;
            m.redraw();
        });
    }

    saveAd(adData) {
        m.request({
            method: 'POST',
            url: app.forum.attribute('apiUrl') + '/seo/ads',
            headers: { 'X-CSRF-Token': app.session.csrfToken },
            body: {
                action: 'save',
                ...adData
            }
        }).then(() => {
            app.alerts.show(Alert, { type: 'success' }, 'Reklam başarıyla kaydedildi.');
            this.isAdModalOpen = false;
            this.editingAd = null;
            this.loadAds();
        }).catch(err => {
            app.alerts.show(Alert, { type: 'error' }, 'Reklam kaydedilirken hata oluştu.');
        });
    }

    toggleAdActive(ad) {
        m.request({
            method: 'POST',
            url: app.forum.attribute('apiUrl') + '/seo/ads',
            headers: { 'X-CSRF-Token': app.session.csrfToken },
            body: {
                action: 'toggle',
                id: ad.id
            }
        }).then(() => {
            this.loadAds();
        });
    }

    deleteAd(adId) {
        if (!confirm('Bu reklamı silmek istediğinize emin misiniz?')) return;
        m.request({
            method: 'POST',
            url: app.forum.attribute('apiUrl') + '/seo/ads',
            headers: { 'X-CSRF-Token': app.session.csrfToken },
            body: {
                action: 'delete',
                id: adId
            }
        }).then(() => {
            app.alerts.show(Alert, { type: 'success' }, 'Reklam silindi.');
            this.loadAds();
        });
    }

    save(e) {
        if (e && e.preventDefault) e.preventDefault();
        this.isSaving = true;
        m.redraw();

        const toSave = {};
        for (const key in this.settings) {
            if (typeof this.settings[key] === 'function') {
                toSave[key] = this.settings[key]();
            } else {
                toSave[key] = this.settings[key];
            }
        }

        return saveSettings(toSave)
            .then(() => {
                this.isSaving = false;
                app.alerts.show({ type: 'success' }, 'SEO ayarları başarıyla kaydedildi.');
                m.redraw();
            })
            .catch(() => {
                this.isSaving = false;
                app.alerts.show({ type: 'error' }, 'Ayarlar kaydedilirken bir hata oluştu.');
                m.redraw();
            });
    }

    // ---------- TAB RENDERERS ----------

    // 1. DASHBOARD & CANLI METRİKLER
    renderDashboardTab(gsc, ga, d) {
        return m('div', [
            renderHealthPanel(this),
            m('div.StatGrid', { style: 'display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;' }, [
                ['Anlık Ziyaretçi', ga.realtime_users || 0, '#e67e22', 'bolt'], 
                ['Web Tıklama', gsc.clicks, '#3498db', 'mouse-pointer'], 
                ['Görsel Tıklama', (d && d.img_gsc ? d.img_gsc.clicks : 0), '#e74c3c', 'images'], 
                ['Google Gösterim', gsc.impressions, '#9b59b6', 'eye'], 
                ['Haftalık Aktif', ga.active_users, '#27ae60', 'users']
            ].map(c =>
                m('div', { style: 'flex:1; min-width:160px; background:#fff; padding:18px; border-radius:10px; border:1px solid #e0e4e8; text-align:center; box-shadow:0 2px 6px rgba(0,0,0,0.04);' }, [
                    m('div', { style: 'color:#888; font-size:11px; text-transform:uppercase; font-weight:600; letter-spacing:0.5px;' }, c[0]),
                    m('div', { style: 'font-size:26px; font-weight:bold; color:#2d3436; margin:8px 0;' }, c[1]),
                    m('i', { className: 'fas fa-' + c[3], style: 'color:' + c[2] + '; font-size:18px;' })
                ])
            )),

            m('div', { style: 'display:flex; gap:20px; flex-wrap:wrap; margin-bottom:20px;' }, [
                m('div.SeoCard', { style: 'flex:1; min-width:300px; background:#fff; padding:20px; border-radius:10px; border:1px solid #e0e4e8;' }, [
                    m('h4', { style: 'margin-top:0; color:#2980b9; display:flex; align-items:center; gap:8px;' }, [
                        m('i.fas.fa-search'), ' Google Search Console - En Çok Arananlar'
                    ]),
                    m('table', { style: 'width:100%; border-collapse:collapse;' }, [
                        m('tr', [
                            m('th', { style: 'text-align:left; border-bottom:2px solid #eee; padding-bottom:8px; color:#777; font-size:12px;' }, 'Arama Terimi'),
                            m('th', { style: 'text-align:right; border-bottom:2px solid #eee; padding-bottom:8px; color:#777; font-size:12px;' }, 'Tıklama')
                        ]),
                        (gsc.top_queries && gsc.top_queries.length > 0)
                            ? gsc.top_queries.map(q => m('tr', [
                                m('td', { style: 'padding:8px 0; border-bottom:1px solid #f5f6f7; color:#333; font-size:13px;' }, q.keyword), 
                                m('td', { style: 'text-align:right; font-weight:bold; color:#2980b9; padding:8px 0; border-bottom:1px solid #f5f6f7;' }, q.clicks)
                            ]))
                            : m('tr', m('td', { colspan: 2, style: 'padding:15px 0; text-align:center; color:#999;' }, 'Arama verisi henüz toplanmadı veya Google hesabı bağlı değil.'))
                    ])
                ]),
                m('div.SeoCard', { style: 'flex:1; min-width:300px; background:#fff; padding:20px; border-radius:10px; border:1px solid #e0e4e8;' }, [
                    m('h4', { style: 'margin-top:0; color:#27ae60; display:flex; align-items:center; gap:8px;' }, [
                        m('i.fas.fa-chart-line'), ' Google Analytics - Popüler Sayfalar'
                    ]),
                    m('table', { style: 'width:100%; border-collapse:collapse;' }, [
                        m('tr', [
                            m('th', { style: 'text-align:left; border-bottom:2px solid #eee; padding-bottom:8px; color:#777; font-size:12px;' }, 'Sayfa'),
                            m('th', { style: 'text-align:right; border-bottom:2px solid #eee; padding-bottom:8px; color:#777; font-size:12px;' }, 'Görüntülenme'),
                            m('th', { style: 'text-align:right; border-bottom:2px solid #eee; padding-bottom:8px; color:#777; font-size:12px;' }, 'Süre')
                        ]),
                        (ga.top_pages && ga.top_pages.length > 0)
                            ? ga.top_pages.map(p => m('tr', [
                                m('td', { style: 'padding:8px 0; border-bottom:1px solid #f5f6f7; color:#555; font-size:12px; word-break:break-all;' }, p.path), 
                                m('td', { style: 'text-align:right; font-weight:bold; border-bottom:1px solid #f5f6f7; padding:8px 0;' }, p.views),
                                m('td', { style: 'text-align:right; color:#27ae60; font-weight:bold; border-bottom:1px solid #f5f6f7; padding:8px 0;' }, p.time || '00:00')
                            ]))
                            : m('tr', m('td', { colspan: 3, style: 'padding:15px 0; text-align:center; color:#999;' }, 'Sayfa verisi henüz toplanmadı.'))
                    ])
                ])
            ])
        ]);
    }

    // 3. SOSYAL MEDYA HUB & ZAMANLAMA
    renderSocialTab() {
        const accounts = this.data.social.accounts || {};
        const times = this.data.social.best_posting_times || [];
        const viral = this.data.social.viral_candidates || [];

        return m('div', [
            // Sosyal Medya Hesapları Yönetimi
            m('div.SeoCard', { style: 'background:#fff; padding:20px; border-radius:10px; border:1px solid #e0e4e8; margin-bottom:20px;' }, [
                m('h3', { style: 'margin-top:0; color:#8e44ad; display:flex; align-items:center; gap:8px;' }, [
                    m('i.fas.fa-share-alt'), ' 📱 Bağlı Sosyal Medya Hesapları (GSC & Schema sameAs)'
                ]),
                m('p', { style: 'color:#7f8fa6; font-size:13px; margin-bottom:20px;' }, 'Sosyal medya bağlantılarınızı buraya girdiğinizde, sitenizin Schema.org Organization `sameAs` etiketleri otomatik güncellenir ve Google Knowledge Panel üzerinde eşleşir.'),
                
                m('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:15px;' }, [
                    m('div.Form-group', [
                        m('label', [m('i.fab.fa-instagram', { style: 'color:#e1306c; margin-right:6px;' }), 'Instagram Profil URL']),
                        m('input.FormControl', {
                            placeholder: 'https://instagram.com/hesabiniz',
                            value: this.setting('framio-seo.social_instagram')(),
                            oninput: e => this.setting('framio-seo.social_instagram')(e.target.value)
                        })
                    ]),
                    m('div.Form-group', [
                        m('label', [m('i.fab.fa-twitter', { style: 'color:#1da1f2; margin-right:6px;' }), 'Twitter / X Profil URL']),
                        m('input.FormControl', {
                            placeholder: 'https://x.com/hesabiniz',
                            value: this.setting('framio-seo.social_twitter')(),
                            oninput: e => this.setting('framio-seo.social_twitter')(e.target.value)
                        })
                    ]),
                    m('div.Form-group', [
                        m('label', [m('i.fab.fa-facebook', { style: 'color:#4267b2; margin-right:6px;' }), 'Facebook Sayfası URL']),
                        m('input.FormControl', {
                            placeholder: 'https://facebook.com/sayfaniz',
                            value: this.setting('framio-seo.social_facebook')(),
                            oninput: e => this.setting('framio-seo.social_facebook')(e.target.value)
                        })
                    ]),
                    m('div.Form-group', [
                        m('label', [m('i.fab.fa-youtube', { style: 'color:#ff0000; margin-right:6px;' }), 'YouTube Kanal URL']),
                        m('input.FormControl', {
                            placeholder: 'https://youtube.com/@kanaliniz',
                            value: this.setting('framio-seo.social_youtube')(),
                            oninput: e => this.setting('framio-seo.social_youtube')(e.target.value)
                        })
                    ]),
                    m('div.Form-group', [
                        m('label', [m('i.fab.fa-tiktok', { style: 'color:#000000; margin-right:6px;' }), 'TikTok Profil URL']),
                        m('input.FormControl', {
                            placeholder: 'https://tiktok.com/@hesabiniz',
                            value: this.setting('framio-seo.social_tiktok')(),
                            oninput: e => this.setting('framio-seo.social_tiktok')(e.target.value)
                        })
                    ]),
                    m('div.Form-group', [
                        m('label', [m('i.fab.fa-linkedin', { style: 'color:#0077b5; margin-right:6px;' }), 'LinkedIn Şirket URL']),
                        m('input.FormControl', {
                            placeholder: 'https://linkedin.com/company/...',
                            value: this.setting('framio-seo.social_linkedin')(),
                            oninput: e => this.setting('framio-seo.social_linkedin')(e.target.value)
                        })
                    ])
                ]),
                m('button.Button.Button--primary', {
                    style: 'margin-top:15px;',
                    onclick: e => this.save(e)
                }, 'Sosyal Medya Bağlantılarını Kaydet')
            ]),

            // En İdeal Paylaşım Saatleri (Prime Time) & Viral İçerik Kartları
            m('div', { style: 'display:flex; gap:20px; flex-wrap:wrap; margin-bottom:20px;' }, [
                // Prime Time Saatleri
                m('div.SeoCard', { style: 'flex:1; min-width:320px; background:#fff; padding:20px; border-radius:10px; border:1px solid #e0e4e8;' }, [
                    m('h4', { style: 'margin-top:0; color:#e67e22; display:flex; align-items:center; gap:8px;' }, [
                        m('i.fas.fa-clock'), ' ⏰ En İdeal Paylaşım Saatleri (Prime-Time Analizi)'
                    ]),
                    m('p', { style: 'color:#7f8fa6; font-size:12px; margin-bottom:15px;' }, 'Forum kullanıcı aktivitesi ve GA4 etkileşim verilerine göre haftalık en yüksek etkileşim potansiyeli gösteren zaman dilimleri:'),
                    
                    m('table', { style: 'width:100%; border-collapse:collapse;' }, [
                        m('thead', m('tr', [
                            m('th', { style: 'text-align:left; border-bottom:2px solid #eee; padding-bottom:8px; font-size:12px;' }, 'Gün'),
                            m('th', { style: 'text-align:left; border-bottom:2px solid #eee; padding-bottom:8px; font-size:12px;' }, 'Prime Time'),
                            m('th', { style: 'text-align:right; border-bottom:2px solid #eee; padding-bottom:8px; font-size:12px;' }, 'Potansiyel'),
                            m('th', { style: 'text-align:left; border-bottom:2px solid #eee; padding-bottom:8px; font-size:12px;' }, 'Öneri')
                        ])),
                        m('tbody', times.map(t => m('tr', [
                            m('td', { style: 'padding:10px 0; border-bottom:1px solid #f5f6f7; font-weight:600;' }, t.day),
                            m('td', { style: 'padding:10px 0; border-bottom:1px solid #f5f6f7; color:#e67e22; font-weight:bold;' }, t.prime_hours),
                            m('td', { style: 'padding:10px 0; border-bottom:1px solid #f5f6f7; text-align:right;' }, [
                                m('span', { style: `background:${t.score >= 90 ? '#eafaf1' : '#fef5e7'}; color:${t.score >= 90 ? '#27ae60' : '#d35400'}; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:bold;` }, '%' + t.score)
                            ]),
                            m('td', { style: 'padding:10px 0 10px 10px; border-bottom:1px solid #f5f6f7; font-size:11px; color:#555;' }, t.recommended_content)
                        ])))
                    ])
                ]),

                // Viral İçerik Önerileri
                m('div.SeoCard', { style: 'flex:1; min-width:320px; background:#fff; padding:20px; border-radius:10px; border:1px solid #e0e4e8;' }, [
                    m('h4', { style: 'margin-top:0; color:#27ae60; display:flex; align-items:center; gap:8px;' }, [
                        m('i.fas.fa-fire'), ' 🔥 Sosyal Medyada Paylaşmaya Uygun Viral Başlıklar'
                    ]),
                    m('p', { style: 'color:#7f8fa6; font-size:12px; margin-bottom:15px;' }, 'Forumdaki yüksek etkileşimli ve görselli konulardan sosyal medya için üretilmiş hazır paylaşım şablonları:'),
                    
                    m('div', { style: 'display:flex; flex-direction:column; gap:12px; max-height:480px; overflow-y:auto;' }, 
                        viral.length === 0 ? m('div', { style: 'color:#999; text-align:center; padding:20px;' }, 'İçerik analiz ediliyor...') :
                        viral.map(post => m('div', {
                            style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:6px;'
                        }, [
                            m('div', { style: 'display:flex; justify-content:space-between; align-items:center;' }, [
                                m('span', { style: 'font-weight:bold; font-size:13px; color:#2c3e50;' }, post.title),
                                m('span', { style: 'background:#ff7675; color:#fff; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:4px;' }, `⚡ Skor: ${post.viral_score}`)
                            ]),
                            m('div', { style: 'font-size:11px; color:#636e72;' }, `💬 ${post.comment_count} Yorum • 👁️ ${post.view_count} Görüntülenme`),
                            m('div', { style: 'background:#fff; border:1px dashed #cbd5e1; border-radius:6px; padding:8px; font-size:11px; color:#334155; line-height:1.4;' }, post.suggested_social_post),
                            m('div', { style: 'display:flex; gap:8px; margin-top:4px;' }, [
                                m('button.Button.Button--small', {
                                    style: 'background:#1877f2; color:#fff;',
                                    onclick: () => {
                                        copyToClipboard(post.suggested_social_post);
                                        app.alerts.show(Alert, { type: 'success' }, 'Metin panoya kopyalandı!');
                                    }
                                }, [m('i.fas.fa-copy'), ' Metni Kopyala']),
                                m('a.Button.Button--small', {
                                    href: post.url,
                                    target: '_blank'
                                }, [m('i.fas.fa-external-link-alt'), ' Konuyu Aç'])
                            ])
                        ]))
                    )
                ])
            ])
        ]);
    }

    // 4. ARAMA TRENDLERİ & ANAHTAR KELİMELER
    renderKeywordsTab() {
        const searches = this.data.searches.searches || [];
        const topKeywords = this.data.searches.top_keywords || [];
        const niche = this.data.searches.niche_keywords || [];
        const stats = this.data.searches.stats || {};

        return m('div', [
            // İstatistik Bar
            m('div.StatGrid', { style: 'display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;' }, [
                ['Toplam Forum İçi Arama', stats.total_searches || 0, '#3498db', 'search'],
                ['Tekil Arama Sorguları', stats.unique_queries || 0, '#9b59b6', 'fingerprint'],
                ['Son 7 Günlük Arama', stats.last_7_days || 0, '#e67e22', 'chart-bar'],
                ['Sonuçsuz Aramalar (Fırsat)', stats.zero_results || 0, '#e74c3c', 'question-circle']
            ].map(c => 
                m('div', { style: 'flex:1; min-width:160px; background:#fff; padding:18px; border-radius:10px; border:1px solid #e0e4e8; text-align:center;' }, [
                    m('div', { style: 'color:#888; font-size:11px; text-transform:uppercase; font-weight:600;' }, c[0]),
                    m('div', { style: 'font-size:24px; font-weight:bold; color:#2d3436; margin:6px 0;' }, c[1]),
                    m('i', { className: 'fas fa-' + c[3], style: 'color:' + c[2] })
                ])
            )),

            m('div', { style: 'display:flex; gap:20px; flex-wrap:wrap; margin-bottom:20px;' }, [
                // En Çok Aranan Kelimeler
                m('div.SeoCard', { style: 'flex:1; min-width:320px; background:#fff; padding:20px; border-radius:10px; border:1px solid #e0e4e8;' }, [
                    m('h4', { style: 'margin-top:0; color:#2980b9; display:flex; align-items:center; gap:8px;' }, [
                        m('i.fas.fa-list-ol'), ' 🏆 Forumda En Çok Aranan Terimler'
                    ]),
                    m('table', { style: 'width:100%; border-collapse:collapse;' }, [
                        m('thead', m('tr', [
                            m('th', { style: 'text-align:left; border-bottom:2px solid #eee; padding-bottom:8px; font-size:12px;' }, 'Kelime / İfade'),
                            m('th', { style: 'text-align:right; border-bottom:2px solid #eee; padding-bottom:8px; font-size:12px;' }, 'Arama Sayısı'),
                            m('th', { style: 'text-align:right; border-bottom:2px solid #eee; padding-bottom:8px; font-size:12px;' }, 'Trend')
                        ])),
                        m('tbody', topKeywords.length === 0 ? m('tr', m('td', { colspan: 3, style: 'text-align:center; padding:20px; color:#999;' }, 'Arama kaydı bulunamadı.')) :
                            topKeywords.map(k => m('tr', [
                                m('td', { style: 'padding:10px 0; border-bottom:1px solid #f5f6f7; font-weight:600; color:#2c3e50;' }, k.keyword),
                                m('td', { style: 'padding:10px 0; border-bottom:1px solid #f5f6f7; text-align:right; font-weight:bold; color:#2980b9;' }, k.count),
                                m('td', { style: 'padding:10px 0; border-bottom:1px solid #f5f6f7; text-align:right;' }, [
                                    m('span', { style: 'color:#27ae60; font-size:11px; font-weight:bold;' }, '↑ Artışta')
                                ])
                            ]))
                        )
                    ])
                ]),

                // Niş Sektörel Terim Yoğunluğu
                m('div.SeoCard', { style: 'flex:1; min-width:320px; background:#fff; padding:20px; border-radius:10px; border:1px solid #e0e4e8;' }, [
                    m('h4', { style: 'margin-top:0; color:#27ae60; display:flex; align-items:center; gap:8px;' }, [
                        m('i.fas.fa-tags'), ' 🏷️ Niş & Sektörel Anahtar Kelime Yoğunluğu'
                    ]),
                    m('p', { style: 'color:#7f8fa6; font-size:12px; margin-bottom:15px;' }, 'Ulaşım, otobüs, raylı sistem ve araç kategorilerindeki kullanıcı ilgi yoğunluğu:'),
                    
                    m('div', { style: 'display:flex; flex-wrap:wrap; gap:8px; padding:10px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;' }, 
                        niche.length === 0 ? m('div', { style: 'color:#999; padding:15px;' }, 'Niş kelime analizi yapılıyor...') :
                        niche.map(n => m('span', {
                            style: `background:#fff; border:1px solid #cbd5e1; padding:6px 12px; border-radius:20px; font-size:${11 + Math.min(n.weight * 2, 8)}px; font-weight:600; color:#1e293b; display:inline-flex; align-items:center; gap:6px; box-shadow:0 1px 3px rgba(0,0,0,0.05);`
                        }, [
                            n.tag,
                            m('span', { style: 'background:#3b82f6; color:#fff; font-size:9px; border-radius:10px; padding:1px 6px;' }, n.count)
                        ]))
                    )
                ])
            ]),

            // Son Yapılan Aramalar Tablosu
            m('div.SeoCard', { style: 'background:#fff; padding:20px; border-radius:10px; border:1px solid #e0e4e8;' }, [
                m('h4', { style: 'margin-top:0; color:#2c3e50;' }, '⏱️ Canlı Forum İçi Arama Kayıtları (Son 100 Arama)'),
                m('table', { style: 'width:100%; border-collapse:collapse;' }, [
                    m('thead', { style: 'background:#f8f9fa; border-bottom:2px solid #e9ecef;' }, m('tr', [
                        m('th', { style: 'padding:10px; text-align:left; font-size:12px;' }, 'Arama Terimi'),
                        m('th', { style: 'padding:10px; text-align:left; font-size:12px;' }, 'Kullanıcı'),
                        m('th', { style: 'padding:10px; text-align:right; font-size:12px;' }, 'Sonuç Sayısı'),
                        m('th', { style: 'padding:10px; text-align:right; font-size:12px;' }, 'Tarih')
                    ])),
                    m('tbody', searches.length === 0 ? m('tr', m('td', { colspan: 4, style: 'text-align:center; padding:25px; color:#999;' }, 'Henüz kayıtlı arama bulunmuyor.')) :
                        searches.map(s => m('tr', { style: 'border-bottom:1px solid #f1f3f5;' }, [
                            m('td', { style: 'padding:10px; font-weight:600; color:#2c3e50;' }, s.query),
                            m('td', { style: 'padding:10px; color:#7f8fa6; font-size:12px;' }, s.user_name || 'Misafir Ziyaretçi'),
                            m('td', { style: 'padding:10px; text-align:right;' }, [
                                m('span', { style: `background:${s.results_count > 0 ? '#eafaf1' : '#fdeeea'}; color:${s.results_count > 0 ? '#27ae60' : '#e74c3c'}; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:bold;` }, s.results_count + ' sonuç')
                            ]),
                            m('td', { style: 'padding:10px; text-align:right; font-size:12px; color:#95a5a6;' }, s.created_at)
                        ]))
                    )
                ])
            ])
        ]);
    }

    // 5. LOOKER STUDIO
    renderLookerTab() {
        const url = this.setting('framio-seo.looker_studio_url')();
        return m('div', { style: 'height: 100vh; display: flex; flex-direction: column;' }, [
            url
                ? m('iframe', {
                    src: url,
                    style: 'flex: 1; width: 100%; border: 0; border-radius: 8px; min-height: 800px;',
                    frameborder: '0',
                    allowfullscreen: true,
                    sandbox: 'allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'
                })
                : m('div.SeoCard', { style: 'text-align: center; padding: 40px;' }, [
                    m('i.fas.fa-chart-area', { style: 'font-size: 48px; color: #ccc; margin-bottom: 20px;' }),
                    m('h3', 'Looker Studio Raporu Bekleniyor'),
                    m('p', 'Kapsamlı Analytics arayüzünü görmek için Ayarlar sekmesinden Looker Studio (Embed) URL adresinizi girmeniz gerekmektedir.')
                ])
        ]);
    }

    // 6. İNDEKS YÖNETİMİ
    renderIndexingTab() {
        return m('div.SeoCard', [
            m('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;' }, [
                m('h3', { style: 'margin:0;' }, 'Detaylı İçerik İndeks Takibi'),
                m('div', { style: 'display:flex; gap:10px;' }, [
                    m('button.Button.Button--primary', { onclick: () => this.pingAllWaiting(), disabled: this.loading }, [m('i.fas.fa-sync'), ' Tümünü Senkronize Et (Toplu Ping)']),
                    m('button.Button.Button--danger', { onclick: () => this.pingUnindexedOnly(), disabled: this.loading }, [m('i.fas.fa-exclamation-triangle'), ' İndekslenmeyenleri Yeniden Gönder'])
                ])
            ]),
            this.loading ? m('p', 'Yükleniyor...') : m('table', { style: 'width:100%; border-collapse:collapse;' }, [
                m('thead', { style: 'background:#f8f9fa; border-bottom:2px solid #e9ecef;' }, m('tr', [
                    m('th', { style: 'width: 40px;' }),
                    m('th', { style: 'padding:12px 15px; text-align:left; font-size:12px; color:#555; text-transform:uppercase;' }, 'Konu'),
                    m('th', { style: 'padding:12px 15px; text-align:left; font-size:12px; color:#555; text-transform:uppercase;' }, 'Detay'),
                    m('th', { style: 'padding:12px 15px; text-align:left; font-size:12px; color:#555; text-transform:uppercase;' }, 'Durum'),
                    m('th', { style: 'padding:12px 15px; text-align:left; font-size:12px; color:#555; text-transform:uppercase;' }, 'Canlı Kontrol')
                ])),
                m('tbody', this.data.indexing.items.map(item => {
                    const isExpanded = !!this.expandedRows[item.id];
                    const sessionCheck = this.data.cache[item.url];
                    const hasPersisted = item.gsc_indexed !== null && item.gsc_indexed !== undefined;
                    const gscKnown = sessionCheck ? true : hasPersisted;
                    const gscIndexed = sessionCheck ? sessionCheck.indexed : !!item.gsc_indexed;
                    const gscCheckedAt = sessionCheck ? 'az önce' : (item.gsc_checked_at || null);
                    const gscDetails = sessionCheck ? sessionCheck.details : item.gsc_inspection_details;

                    let label = '🔴 Bekliyor', color = '#e74c3c';
                    if (item.seo_last_sent_at) {
                        if (item.last_posted_at && item.last_posted_at > item.seo_last_sent_at) { label = '🟡 Yeni Yorum Var'; color = '#f39c12'; }
                        else { label = '📤 ' + item.seo_last_sent_at; color = '#27ae60'; }
                    }

                    const rows = [
                        m('tr', { style: 'border-bottom:' + (isExpanded ? 'none' : '1px solid #f1f3f5') + ';' }, [
                            m('td', {
                                style: 'padding:14px 15px; vertical-align:middle; text-align:center; cursor:pointer;',
                                onclick: () => { this.expandedRows[item.id] = !isExpanded; }
                            }, m('i.fas.gsc-chevron', { class: isExpanded ? 'fa-chevron-down' : 'fa-chevron-right' })),
                            m('td', { style: 'padding:14px 15px; vertical-align:middle;' }, [
                                m('b', { style: 'color:#2c3e50;' }, item.title),
                                m('br'),
                                m('a', { href: item.url, target: '_blank', style: 'color:#868e96; font-size:11px;' }, item.url)
                            ]),
                            m('td', { style: 'padding:14px 15px; vertical-align:middle; font-size:12px; color:#555;' }, [
                                m('div', { style: 'margin-bottom:2px;' }, '💬 ' + item.comment_count + ' Yorum'),
                                m('div', { style: 'margin-bottom:2px;' }, '⏱️ ' + (item.last_posted_at || '-')),
                                m('div', { style: 'color:#0984e3;' }, '🌐 Bildirim: ' + (item.seo_last_sent_at || '-')),
                                gscKnown ? m('div', { style: 'color:#7f8fa6; margin-top:2px;' }, '🔎 GSC kontrolü: ' + (gscCheckedAt || '-')) : null
                            ]),
                            m('td', { style: 'padding:14px 15px; vertical-align:middle;' },
                                m('span', { style: 'background:' + color + '15; color:' + color + '; padding:5px 12px; border-radius:20px; font-size:11px; font-weight:bold; border:1px solid ' + color + '40;' }, label)
                            ),
                            m('td', { style: 'padding:14px 15px; vertical-align:middle;' }, [
                                m('button.Button.Button--small', {
                                    style: 'margin-right:5px;',
                                    onclick: () => {
                                        if (item._inspecting) return;
                                        item._inspecting = true;
                                        m.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/seo/inspect', params: { url: item.url, discussion_id: item.id }, headers: { 'X-CSRF-Token': app.session.csrfToken } })
                                         .then(res => {
                                             if (res.status !== 'success') {
                                                 app.alerts.show(Alert, { type: 'error' }, res.message || 'GSC kontrolü başarısız oldu.');
                                                 item._inspecting = false;
                                                 m.redraw();
                                                 return;
                                             }
                                             this.saveCache(item.url, { checked: true, indexed: res.indexed, details: res.details });
                                             item.gsc_indexed = res.indexed;
                                             item.gsc_inspection_details = res.details;
                                             item.gsc_checked_at = 'az önce';
                                             this.expandedRows[item.id] = true;
                                             item._inspecting = false;
                                             m.redraw();
                                         })
                                         .catch(() => {
                                             app.alerts.show(Alert, { type: 'error' }, 'GSC kontrolü sırasında bir ağ hatası oluştu.');
                                             item._inspecting = false;
                                             m.redraw();
                                         });
                                    }
                                }, item._inspecting ? '⏳' : '🔍 Kontrol Et'),
                                m('button.Button.Button--small', { style: 'margin-right:5px; background-color:#27ae60; color:#fff;', onclick: e => {
                                    const btn = e.target; btn.disabled = true;
                                    m.request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/seo/manual-ping', body: { urls: [item.url], ids: [item.id] }, headers: { 'X-CSRF-Token': app.session.csrfToken } })
                                     .then(res => { app.alerts.show(Alert, { type: 'success' }, res.message); btn.disabled = false; })
                                     .catch(() => { btn.disabled = false; });
                                }}, [m('i.fab.fa-google'), ' Ping']),
                                m('button.Button.Button--small', { onclick: () => { copyToClipboard(item.url); app.alerts.show(Alert, { type: 'success' }, 'Kopyalandı!'); } }, 'URL Kopyala')
                            ])
                        ])
                    ];

                    if (isExpanded) {
                        rows.push(m('tr.gsc-details-row', [
                            m('td', { colspan: 5, style: 'padding: 0 15px 15px 55px; border-bottom:1px solid #f1f3f5;' }, [
                                m('div.gsc-details-card', [
                                    m('h4', [m('i.fas.fa-search'), ' Google Arama İndeks Detayları']),
                                    m('div.gsc-grid', [
                                        m('div.gsc-grid-item', [
                                            m('span.gsc-label', 'Dizin Durumu:'),
                                            m('span.gsc-badge', { class: gscIndexed ? 'gsc-badge--success' : 'gsc-badge--danger' }, gscIndexed ? 'İndekste' : 'İndekste Değil')
                                        ]),
                                        m('div.gsc-grid-item', [
                                            m('span.gsc-label', 'Son Tarama:'),
                                            m('span.gsc-value', gscDetails && gscDetails.lastCrawlTime ? gscDetails.lastCrawlTime.replace('T', ' ').replace('Z', ' UTC') : 'Tarama verisi yok')
                                        ]),
                                        m('div.gsc-grid-item', [
                                            m('span.gsc-label', 'İndeks İzni:'),
                                            m('span.gsc-badge', {
                                                class: gscDetails && gscDetails.indexingState === 'INDEXING_ALLOWED' ? 'gsc-badge--success' : (gscDetails ? 'gsc-badge--danger' : 'gsc-badge--warning')
                                            }, gscDetails ? (gscDetails.indexingState === 'INDEXING_ALLOWED' ? 'İzin Verildi' : gscDetails.indexingState) : 'Bilinmiyor')
                                        ]),
                                        m('div.gsc-grid-item', [
                                            m('span.gsc-label', 'Tarama Sonucu:'),
                                            m('span.gsc-value', gscDetails ? gscDetails.crawlState || '-' : '-')
                                        ]),
                                        m('div.gsc-grid-item', { style: 'grid-column: span 2;' }, [
                                            m('span.gsc-label', 'Google Canonical URL:'),
                                            m('span.gsc-value', { style: 'font-family: monospace; font-size: 11px; word-break: break-all;' }, gscDetails ? gscDetails.googleCanonical || 'Belirtilmedi' : 'Bilinmiyor')
                                        ])
                                    ])
                                ])
                            ])
                        ]));
                    }

                    return rows;
                }).reduce((acc, val) => acc.concat(val), []))
            ]),
            m('div', { style: 'margin-top:20px; text-align:center; display:flex; align-items:center; justify-content:center; gap:12px;' }, [
                m('button.Button', { disabled: this.data.indexing.page <= 1, onclick: () => { this.data.indexing.page--; this.loadIndexing(); } }, '« Geri'),
                m('span', { style: 'font-weight:bold; color:#2a5298;' }, 'Sayfa ' + this.data.indexing.page + ' / ' + this.data.indexing.total_pages),
                m('button.Button', { disabled: this.data.indexing.page >= this.data.indexing.total_pages, onclick: () => { this.data.indexing.page++; this.loadIndexing(); } }, 'İleri »')
            ])
        ]);
    }

    // 7. GÖRSEL SEO & JSON-LD
    renderImagesTab(postsList, filteredPosts, postsSlice, imgPg, imgTotalPg, sq) {
        return m('div', [
            m('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;' }, [
                m('button.Button.Button--primary', {
                    onclick: (e) => {
                        if (confirm("Tüm eski mesajlar taranacak ve eksik/bozuk Alt etiketleri otomatik olarak onarılacaktır. Onaylıyor musunuz?")) {
                            e.target.disabled = true;
                            app.request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/seo/fix-alt-tags' })
                            .then(res => {
                                e.target.disabled = false;
                                app.alerts.show(Alert, { type: 'success' }, res.message);
                                this.loadImages();
                            });
                        }
                    }
                }, [m('i.fas.fa-magic'), ' Bozuk Alt Etiketlerini Otomatik Onar']),
                m('div', { style: 'color:#666; font-size:13px; font-weight:600;' }, `Toplam ${postsList.length} Mesaj (${this.data.images.count} Görsel)`)
            ]),

            // Arama kutusu
            m('div', { style: 'display:flex; align-items:center; gap:10px; margin-bottom:16px;' }, [
                m('div', { style: 'position:relative; flex:1;' }, [
                    m('i.fas.fa-search', { style: 'position:absolute; left:13px; top:50%; transform:translateY(-50%); color:#adb5bd; font-size:13px; pointer-events:none;' }),
                    m('input', {
                        type: 'text',
                        placeholder: 'Konu, marka, model, kullanıcı adı veya görsel açıklaması ile arayın...',
                        value: this.searchQuery,
                        style: 'width:100%; padding:10px 14px 10px 36px; border:1px solid #dee2e6; border-radius:8px; font-size:13px; outline:none; box-sizing:border-box; background:#fff; color:#2d3436;',
                        oninput: e => { this.searchQuery = e.target.value; this.data.images.page = 1; m.redraw(); }
                    })
                ]),
                this.searchQuery ? m('button.Button', {
                    onclick: () => { this.searchQuery = ''; this.data.images.page = 1; m.redraw(); }
                }, 'Temizle') : null,
                m('select.FormControl', {
                    style: 'max-width:220px;',
                    value: this.imageFilter || 'all',
                    onchange: e => { this.imageFilter = e.target.value; this.data.images.page = 1; }
                }, [
                    m('option', { value: 'all' }, 'Tüm görselli mesajlar'),
                    m('option', { value: 'alt' }, 'Alt metni eksik/zayıf olanlar')
                ])
            ]),

            this.loading ? m('div', { style: 'text-align:center; padding:60px;' }, [
                m('i.fas.fa-spinner.fa-spin', { style: 'font-size:32px; color:#2a5298; display:block; margin-bottom:15px;' }),
                m('p', { style: 'color:#666;' }, 'Veritabanı taranıyor...')
            ]) :
            filteredPosts.length > 0 ? m('div', [
                m('div', { style: 'display:grid; grid-template-columns:repeat(4,1fr); gap:14px;' },
                    postsSlice.map(post => {
                        const isExpanded = !!this.expandedPosts[post.post_id];
                        const firstImg = post.images[0] || {};
                        const imgCount = post.images.length;

                        return m('div', {
                            key: post.post_id,
                            style: isExpanded
                                ? 'grid-column:1/-1; background:#fff; border:2px solid #2a5298; border-radius:14px; overflow:hidden; box-shadow:0 4px 18px rgba(42,82,152,0.12);'
                                : 'background:#fff; border:1px solid #e0e4e8; border-radius:14px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.07); display:flex; flex-direction:column; cursor:pointer;',
                            onclick: !isExpanded ? () => { this.expandedPosts[post.post_id] = true; m.redraw(); } : null
                        }, isExpanded
                            ? [
                                m('div', { style: 'display:flex; align-items:center; justify-content:space-between; padding:14px 18px; background:linear-gradient(90deg,#1e3c72,#2a5298); flex-wrap:wrap; gap:8px;' }, [
                                    m('div', { style: 'display:flex; align-items:center; gap:12px; flex-wrap:wrap;' }, [
                                        m('span', { style: 'background:rgba(255,255,255,0.2); color:#fff; font-size:12px; font-weight:bold; border-radius:6px; padding:3px 10px;' }, `💬 Mesaj #${post.post_id}`),
                                        post.brand ? m('span', { style: 'background:#0984e3; color:#fff; font-size:11px; font-weight:600; border-radius:12px; padding:2px 10px;' }, `🚌 ${post.brand}${post.model ? ' ' + post.model : ''}`) : null,
                                        m('a', { href: post.discussion_url, target: '_blank', style: 'color:rgba(255,255,255,0.9); font-size:12px; text-decoration:none; font-weight:500;' }, `📂 ${post.discussion_title}`),
                                        m('span', { style: 'color:rgba(255,255,255,0.7); font-size:11px;' }, `👤 ${post.user_display_name}`)
                                    ]),
                                    m('div', { style: 'display:flex; gap:8px;' }, [
                                        m('button.Button', {
                                            style: 'background:#27ae60; color:#fff;',
                                            onclick: e => {
                                                e.stopPropagation(); e.target.disabled = true;
                                                app.request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/seo/manual-ping', body: { urls: [post.discussion_url], ids: [post.discussion_id] } })
                                                    .then(res => { app.alerts.show(Alert, { type: 'success' }, res.message); e.target.disabled = false; })
                                                    .catch(() => { e.target.disabled = false; });
                                            }
                                        }, [m('i.fab.fa-google'), ' Google\'a Gönder']),
                                        m('button.Button', {
                                            style: 'background:rgba(255,255,255,0.2); color:#fff;',
                                            onclick: e => { e.stopPropagation(); delete this.expandedPosts[post.post_id]; m.redraw(); }
                                        }, 'Kapat')
                                    ])
                                ]),
                                postSeoTools(this, post),
                                m('div', { style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px; padding:16px;' },
                                    post.images.map(img => m('div', { style: 'background:#f8f9fa; border:1px solid #e0e4e8; border-radius:10px; overflow:hidden; display:flex; flex-direction:column;' }, [
                                        m('div', { style: 'height:140px; background:#f0f0f0; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;' }, [
                                            m('img', { src: sized(img.url, 250), loading: 'lazy', style: 'max-width:100%; max-height:140px; object-fit:contain;' }),
                                            m('span', { style: 'position:absolute; top:5px; right:5px; background:rgba(42,82,152,0.85); color:#fff; font-size:9px; font-weight:bold; border-radius:4px; padding:2px 5px;' }, '#' + img.image_id)
                                        ]),
                                        m('div', { style: 'padding:8px 10px; flex:1;' }, [
                                            m('div', { title: img.alt, style: 'font-size:10.5px; font-weight:600; color:' + (altMissing(img.alt) ? '#dc2626' : '#2d3436') + '; margin-bottom:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;' }, altMissing(img.alt) ? '⚠ Alt metni eksik' : img.alt),
                                            m('div', { style: 'display:flex; gap:10px; flex-wrap:wrap;' }, [
                                                m('a', { href: img.url, target: '_blank', style: 'font-size:10px; color:#0984e3; text-decoration:none;' }, [m('i.fas.fa-external-link-alt'), ' Görseli Aç']),
                                                !altMissing(img.alt) ? m('a', { href: 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(img.alt), target: '_blank', rel: 'noopener', style: 'font-size:10px; color:#0984e3; text-decoration:none;' }, [m('i.fas.fa-images'), ' Google Görseller']) : null
                                            ])
                                        ])
                                    ]))
                                )
                            ]
                            : [
                                m('div', { style: 'position:relative; height:180px; overflow:hidden; border-radius:14px 14px 0 0;' }, [
                                    m('img', { src: sized(firstImg.url, 250), loading: 'lazy', style: 'position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter:blur(10px) brightness(0.45); transform:scale(1.08);' }),
                                    m('img', { src: sized(firstImg.url, 480), loading: 'lazy', style: 'position:relative; width:100%; height:100%; object-fit:contain; z-index:1; display:block;' }),
                                    imgCount > 1 ? m('div', { style: 'position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.65); color:#fff; font-size:11px; font-weight:bold; border-radius:20px; padding:3px 9px; backdrop-filter:blur(4px); z-index:2;' }, `📸 ${imgCount}`) : null,
                                    m('div', { style: 'position:absolute; top:8px; left:8px; background:rgba(42,82,152,0.85); color:#fff; font-size:10px; font-weight:bold; border-radius:6px; padding:2px 8px; z-index:2;' }, `#${post.post_id}`)
                                ]),
                                m('div', { style: 'padding:12px 14px; flex:1; display:flex; flex-direction:column; gap:6px;' }, [
                                    m('div', { style: 'font-size:12px; font-weight:700; color:#2c3e50; line-height:1.35; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;' }, post.discussion_title),
                                    post.brand ? m('div', { style: 'display:flex; align-items:center; gap:5px; flex-wrap:wrap;' }, [
                                        m('span', { style: 'background:#0984e315; color:#0984e3; font-size:10px; font-weight:700; border-radius:12px; padding:2px 9px;' }, `🚌 ${post.brand}`),
                                        post.model ? m('span', { style: 'background:#00b89415; color:#00b894; font-size:10px; font-weight:700; border-radius:12px; padding:2px 9px;' }, post.model) : null
                                    ]) : null,
                                    m('div', { style: 'display:flex; align-items:center; gap:5px; margin-top:auto; padding-top:6px; border-top:1px solid #f1f2f6;' }, [
                                        m('i.fas.fa-user-circle', { style: 'color:#a29bfe; font-size:12px;' }),
                                        m('span', { style: 'font-size:11px; color:#636e72; font-weight:500;' }, post.user_display_name),
                                        m('span', { style: 'margin-left:auto; font-size:10px; color:#b2bec3;' }, `${imgCount} görsel`)
                                    ])
                                ])
                            ]
                        );
                    })
                ),
                imgTotalPg > 1 ? m('div', { style: 'margin-top:25px; text-align:center; display:flex; align-items:center; justify-content:center; gap:12px;' }, [
                    m('button.Button', { disabled: imgPg <= 1, onclick: () => { this.data.images.page--; m.redraw(); } }, '« Geri'),
                    m('span', { style: 'font-weight:bold; color:#2a5298;' }, 'Sayfa ' + imgPg + ' / ' + imgTotalPg + '  (' + filteredPosts.length + ' mesaj)'),
                    m('button.Button', { disabled: imgPg >= imgTotalPg, onclick: () => { this.data.images.page++; m.redraw(); } }, 'İleri »')
                ]) : null
            ]) : m('div', { style: 'text-align:center; padding:60px; color:#999;' }, [
                m('i.fas.fa-images', { style: 'font-size:48px; display:block; margin-bottom:15px; color:#ddd;' }),
                m('p', { style: 'font-size:16px; margin:0; color:#555;' }, 'Kayıtlı görsel bulunamadı.')
            ])
        ]);
    }

    // 8. GÖNDERİ DENETİMİ
    renderAuditTab() {
        return m('div', [
            this.data.audit.loading ? m('div', { style: 'text-align:center; padding:40px;' }, [
                m('i.fas.fa-spinner.fa-spin', { style: 'font-size:30px; color:#3498db; margin-bottom:10px;' }),
                m('div', 'Denetim verileri yükleniyor...')
            ]) : m('div', [
                // İstatistik Bar
                m('div.StatGrid', { style: 'display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;' }, [
                    { label: 'Kritik', val: this.data.audit.stats.critical, color: '#e74c3c', icon: 'exclamation-circle', filter: 'critical' },
                    { label: 'Bekliyor', val: this.data.audit.stats.pending, color: '#f39c12', icon: 'clock', filter: 'pending' },
                    { label: 'Tamam', val: this.data.audit.stats.done, color: '#2ecc71', icon: 'check-circle', filter: 'done' },
                    { label: 'Atla', val: this.data.audit.stats.skip, color: '#95a5a6', icon: 'forward', filter: 'skip' }
                ].map(c => 
                    m('div', { 
                        style: `flex:1; background:#fff; padding:15px; border-radius:8px; border:1px solid ${this.data.audit.filterPriority === c.filter ? c.color : '#eee'}; text-align:center; cursor:pointer;`,
                        onclick: () => { this.data.audit.filterPriority = (this.data.audit.filterPriority === c.filter) ? 'all' : c.filter; this.data.audit.page = 1; }
                    }, [
                        m('div', { style: 'color:#888; font-size:11px; text-transform:uppercase;' }, c.label),
                        m('div', { style: 'font-size:26px; font-weight:bold; color:#2d3436; margin:6px 0;' }, c.val || 0),
                        m('i', { className: 'fas fa-' + c.icon, style: 'color:' + c.color })
                    ])
                )),

                // Kuyruk İlerleme Çubuğu
                this.isAuditQueueRunning ? m('div', { style: 'background:#f0f3f5; border-radius:8px; padding:15px; margin-bottom:20px; border:1px solid #dcdde1;' }, [
                    m('div', { style: 'display:flex; justify-content:space-between; margin-bottom:8px;' }, [
                        m('strong', { style: 'color:#2c3e50;' }, 'Google Indexing API Kuyruğu Çalışıyor...'),
                        m('span', { style: 'color:#0984e3; font-weight:bold;' }, this.auditQueueProgress + ' / ' + this.auditQueueTotal)
                    ]),
                    m('div', { style: 'background:#dfe6e9; border-radius:20px; height:12px; overflow:hidden;' }, [
                        m('div', { style: 'background:linear-gradient(90deg, #0984e3, #74b9ff); height:100%; transition:width 0.3s ease; width:' + (this.auditQueueProgress / this.auditQueueTotal * 100) + '%;' })
                    ])
                ]) : null,
                
                // İşlem Butonları
                m('div', { style: 'display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap; align-items:center; background:#fff; padding:12px 18px; border-radius:8px; border:1px solid #e0e4e8;' }, [
                    m('div', { style: 'font-weight:bold; color:#2d3436; margin-right:10px;' }, [m('i.fas.fa-bolt', { style: 'color:#f39c12; margin-right:5px;' }), 'Hızlı Aksiyonlar:']),
                    m('button.Button.Button--primary', { onclick: () => this.pingSelectedAudit(), disabled: this.selectedAuditPosts.size === 0 || this.isAuditQueueRunning }, [m('i.fas.fa-check-square', { style: 'margin-right:5px;' }), 'Seçilenleri Gönder (' + this.selectedAuditPosts.size + ')']),
                    m('button.Button', { style: 'background:#e74c3c; color:#fff; border:none;', onclick: () => this.pingCriticalAudit(), disabled: this.isAuditQueueRunning }, [m('i.fas.fa-exclamation-circle', { style: 'margin-right:5px;' }), 'Sadece Kritik Olanları Gönder']),
                    m('button.Button', { style: 'background:#34495e; color:#fff; border:none;', onclick: () => this.pingAllAudit(), disabled: this.isAuditQueueRunning }, [m('i.fas.fa-paper-plane', { style: 'margin-right:5px;' }), 'Tümünü Kuyruğa Ekle'])
                ]),

                // Filtreleme Satırı
                m('div', { style: 'display:flex; gap:15px; margin-bottom:20px; background:#fff; padding:15px; border-radius:8px; border:1px solid #eee; align-items:center; flex-wrap:wrap;' }, [
                    m('div', { style: 'flex:1; min-width:200px; display:flex; align-items:center; background:#f5f6fa; padding:8px 15px; border-radius:20px; border:1px solid #dcdde1;' }, [
                        m('i.fas.fa-search', { style: 'color:#7f8fa6; margin-right:10px;' }),
                        m('input', {
                            type: 'text',
                            placeholder: 'Konu, yazar, araç veya metin ara...',
                            style: 'border:none; background:transparent; outline:none; width:100%; font-size:14px; color:#2f3640;',
                            value: this.data.audit.search,
                            oninput: e => { this.data.audit.search = e.target.value; this.data.audit.page = 1; }
                        }),
                    ]),
                    m('select.FormControl', {
                        style: 'width:auto; display:inline-block;',
                        value: this.data.audit.filterPriority,
                        onchange: e => { this.data.audit.filterPriority = e.target.value; this.data.audit.page = 1; }
                    }, [
                        m('option', { value: 'all' }, 'Tüm Öncelikler'),
                        m('option', { value: 'critical' }, '🔴 Kritik'),
                        m('option', { value: 'pending' }, '🟡 Bekliyor'),
                        m('option', { value: 'done' }, '🟢 Tamam'),
                        m('option', { value: 'skip' }, '⚪ Atla')
                    ]),
                    m('select.FormControl', {
                        style: 'width:auto; display:inline-block;',
                        value: this.data.audit.filterHasImage,
                        onchange: e => { 
                            this.data.audit.filterHasImage = e.target.value; 
                            this.data.audit.page = 1; 
                            this.loadAudit();
                        }
                    }, [
                        m('option', { value: 'with_image' }, 'Yalnızca Görselli Mesajlar'),
                        m('option', { value: 'all' }, 'Tüm Mesajlar')
                    ])
                ]),

                // Liste Gösterimi
                m('div', { style: 'display:flex; flex-direction:column; gap:10px;' }, (() => {
                    const sq = trNorm(this.data.audit.search);
                    let filtered = this.data.audit.posts.filter(p => {
                        if (this.data.audit.filterPriority !== 'all' && p.priority !== this.data.audit.filterPriority) return false;
                        if (sq) {
                            const haystack = trNorm([p.discussion_title, p.user_display_name, p.brand, p.model, p.post_text].join(' '));
                            if (!haystack.includes(sq)) return false;
                        }
                        return true;
                    });

                    const page = this.data.audit.page;
                    const perPage = this.data.audit.perPage;
                    const totalPages = Math.ceil(filtered.length / perPage) || 1;
                    const slice = filtered.slice((page - 1) * perPage, page * perPage);

                    if (filtered.length === 0) {
                        return m('div', { style: 'text-align:center; padding:40px; color:#7f8fa6;' }, 'Kriterlere uygun mesaj bulunamadı.');
                    }
        
                    const priorityConfig = {
                        'critical': { color: '#e74c3c', bg: '#fdeeea', icon: 'exclamation-circle', label: 'Kritik' },
                        'pending':  { color: '#f39c12', bg: '#fef5e7', icon: 'clock',              label: 'Bekliyor' },
                        'done':     { color: '#2ecc71', bg: '#eafaf1', icon: 'check-circle',       label: 'Tamam' },
                        'skip':     { color: '#95a5a6', bg: '#f4f6f6', icon: 'forward',            label: 'Atla' }
                    };

                    let listNodes = slice.map(post => {
                        const pConf = priorityConfig[post.priority];
                        const cache = this.data.cache[post.post_url];
                        
                        let indexStatusNode = null;
                        if (post._inspecting) {
                            indexStatusNode = m('span', { style: 'color:#3498db; font-size:11px;' }, [m('i.fas.fa-spinner.fa-spin'), ' Kontrol ediliyor...']);
                        } else if (cache) {
                            indexStatusNode = cache.indexed 
                                ? m('span', { style: 'color:#27ae60; font-size:11px; font-weight:bold;' }, [m('i.fas.fa-check-circle'), ' İndekste']) 
                                : m('span', { style: 'color:#c0392b; font-size:11px; font-weight:bold;' }, [m('i.fas.fa-times-circle'), ' İndekste Yok']);
                        } else {
                            indexStatusNode = post.seo_last_sent_at 
                                ? m('span', { style: 'color:#7f8fa6; font-size:11px;' }, 'Son bildirim: ' + post.seo_last_sent_at)
                                : m('span', { style: 'color:#7f8fa6; font-size:11px;' }, 'Bilinmiyor');
                        }
                        return m('div', { style: 'display:flex; background:#fff; border:1px solid #eee; border-radius:8px; overflow:hidden; position:relative;' }, [
                            m('div', { style: 'position:absolute; top:10px; left:10px; z-index:10;' }, [
                                m('input', { 
                                    type: 'checkbox', 
                                    style: 'width:16px; height:16px; cursor:pointer;',
                                    checked: this.selectedAuditPosts.has(post.post_id),
                                    onchange: e => {
                                        if (e.target.checked) this.selectedAuditPosts.add(post.post_id);
                                        else this.selectedAuditPosts.delete(post.post_id);
                                    }
                                })
                            ]),
                            // Thumbnail
                            m('div', { style: 'width:100px; background:#f8f9fa; display:flex; align-items:center; justify-content:center; border-right:1px solid #eee; position:relative;' }, [
                                post.first_image_url 
                                    ? m('img', { src: post.first_image_url, style: 'width:100%; height:100%; object-fit:cover;' })
                                    : m('i.fas.fa-comment-alt', { style: 'font-size:24px; color:#dcdde1;' }),
                                post.image_count > 1 ? m('div', { style: 'position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.7); color:#fff; font-size:9px; padding:2px 5px; border-radius:4px;' }, `+${post.image_count}`) : null
                            ]),
                            // İçerik
                            m('div', { style: 'flex:1; padding:12px 15px; display:flex; flex-direction:column; gap:5px;' }, [
                                m('div', { style: 'display:flex; align-items:center; gap:8px;' }, [
                                    m('a', { href: post.discussion_url, target: '_blank', style: 'font-weight:bold; color:#2c3e50; font-size:14px; text-decoration:none;' }, post.discussion_title),
                                    m('span', { style: 'font-size:11px; color:#7f8fa6;' }, `• Post #${post.post_id}`),
                                    post.brand ? m('span', { style: 'background:#e1f5fe; color:#0288d1; font-size:10px; padding:2px 6px; border-radius:4px;' }, `${post.brand} ${post.model}`) : null
                                ]),
                                m('div', { style: 'font-size:12px; color:#636e72; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;' }, post.post_text),
                                m('div', { style: 'display:flex; align-items:center; gap:10px; margin-top:auto;' }, [
                                    m('span', { style: 'font-size:11px; color:#a4b0be;' }, [m('i.fas.fa-user'), ' ', post.user_display_name]),
                                    m('span', { style: 'font-size:11px; color:#a4b0be;' }, [m('i.fas.fa-clock'), ' ', post.created_at])
                                ])
                            ]),
                            // Aksiyon
                            m('div', { style: `width:160px; padding:12px; background:${pConf.bg}; display:flex; flex-direction:column; align-items:flex-end; justify-content:center; gap:8px; border-left:1px solid #eee;` }, [
                                m('div', { style: `color:${pConf.color}; font-weight:bold; font-size:13px; display:flex; align-items:center; gap:5px;` }, [
                                    m(`i.fas.fa-${pConf.icon}`), pConf.label
                                ]),
                                m('div', { style: 'text-align:right;' }, indexStatusNode),
                                m('div', { style: 'display:flex; gap:5px; margin-top:5px;' }, [
                                    m('button.Button.Button--primary', { 
                                        style: 'padding:4px 8px; font-size:11px; display:flex; align-items:center; gap:4px;', 
                                        onclick: () => this.checkGscIndex(post.post_url, post.post_id),
                                        disabled: post._inspecting
                                    }, [m('i.fab.fa-google'), ' Kontrol']),
                                    m('a.Button', { href: post.post_url, target: '_blank', style: 'padding:4px 8px; font-size:11px;' }, m('i.fas.fa-external-link-alt'))
                                ])
                            ])
                        ]);
                    });

                    if (totalPages > 1) {
                        listNodes.push(
                            m('div', { style: 'margin-top:15px; text-align:center; display:flex; align-items:center; justify-content:center; gap:12px;' }, [
                                m('button.Button', { disabled: page <= 1, onclick: () => { this.data.audit.page--; m.redraw(); } }, '« Geri'),
                                m('span', { style: 'font-weight:bold; color:#2c3e50;' }, `Sayfa ${page} / ${totalPages} (${filtered.length} mesaj)`),
                                m('button.Button', { disabled: page >= totalPages, onclick: () => { this.data.audit.page++; m.redraw(); } }, 'İleri »')
                            ])
                        );
                    }
        
                    return listNodes;
                })())
            ])
        ]);
    }

    // 9. YETİM GÖRSELLER
    renderOrphansTab() {
        return m('div.SeoCard', [
            m('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;' }, [
                m('h3', { style: 'margin:0;' }, 'Yetim Görsel Temizliği'),
                m('div', { style: 'font-weight:bold; color:#e74c3c;' }, `Bulunan: ${this.data.orphans.items.length} / Toplam: ${this.data.orphans.stats.total_images || 0}`)
            ]),
            m('p', { style: 'color:#7f8fa6; font-size:13px; margin-bottom:20px;' }, `Veritabanında kaydı olup hiçbir mesajda kullanılmayan görselleri listeler. Eşleşme dosya adına göre yapılır (WebP, ?w= boyutları, eski thumb_/mini_ kopyaları aynı görsel sayılır); son ${this.data.orphans.stats.grace_hours || 24} saatte yüklenenler gösterilmez. Silme yalnızca veritabanı kaydını kaldırır, silmeden hemen önce yeniden kontrol eder; bulut dosyalarına dokunmaz.`),
            this.data.orphans.loading ? m('p', 'Tarama yapılıyor, lütfen bekleyin...') : m('div', [
                this.data.orphans.items.length > 0 ? m('button.Button.Button--danger', {
                    style: 'margin-bottom:15px;',
                    onclick: () => this.deleteOrphans(this.data.orphans.items.map(i => i.id))
                }, [m('i.fas.fa-trash-alt'), ' Tüm Yetim Görselleri Sil (' + this.data.orphans.items.length + ')']) : null,
                
                m('div', { style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:15px;' }, 
                    this.data.orphans.items.map(img => 
                        m('div', { style: 'background:#f8f9fa; border:1px solid #ddd; border-radius:8px; overflow:hidden; text-align:center;' }, [
                            m('img', { src: img.thumb_path || img.path, style: 'width:100%; height:120px; object-fit:cover; border-bottom:1px solid #eee;' }),
                            m('div', { style: 'padding:8px; font-size:11px;' }, [
                                m('div', { style: 'color:#555; word-break:break-all;' }, `ID: ${img.id}`),
                                m('div', { style: 'color:#888; margin-top:4px;' }, img.created_at),
                                m('button.Button.Button--small', {
                                    style: 'margin-top:8px; width:100%;',
                                    onclick: () => this.deleteOrphans([img.id])
                                }, 'Bunu Sil')
                            ])
                        ])
                    )
                ),
                this.data.orphans.items.length === 0 ? m('div', { style: 'text-align:center; padding:30px; color:#2ecc71; font-weight:bold;' }, '✅ Hiç yetim görsel bulunamadı!') : null
            ])
        ]);
    }

    // 10. LOGLAR
    renderLogsTab() {
        return m('div.SeoCard', [
            m('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;' }, [
                m('h3', { style: 'margin:0;' }, 'Sistem ve API Hata Logları'),
                m('button.Button.Button--danger', { onclick: () => this.clearLogs() }, [m('i.fas.fa-trash'), ' Logları Temizle'])
            ]),
            m('p', { style: 'color:#7f8fa6; font-size:13px; margin-bottom:20px;' }, 'Google Indexing API ve diğer servislerde karşılaşılan son 100 hatayı listeler.'),
            this.data.logs.loading ? m('p', 'Loglar yükleniyor...') : m('div', { style: 'background:#2d3436; color:#f1f2f6; padding:15px; border-radius:8px; font-family:monospace; font-size:12px; max-height:500px; overflow-y:auto;' }, [
                this.data.logs.items.length === 0 
                    ? m('div', { style: 'color:#2ecc71;' }, 'Sistemde herhangi bir hata logu bulunmuyor. Her şey yolunda!') 
                    : this.data.logs.items.map(log => 
                        m('div', { style: 'margin-bottom:10px; border-bottom:1px solid #444; padding-bottom:10px;' }, [
                            m('span', { style: 'color:#f39c12; font-weight:bold; margin-right:10px;' }, `[${log.date}]`),
                            m('span', { style: 'word-break:break-all;' }, log.message)
                        ])
                    )
            ])
        ]);
    }

    // 11. AYARLAR
    renderSettingsTab() {
        const forumTitle = app.forum.attribute('forumTitle') || 'Forum';
        const forumUrl = app.forum.attribute('baseUrl') || window.location.origin;

        return m('div.SeoCard', [
            m('h3', { style: 'margin-top:0; color:#1e88e5;' }, 'Framio Enterprise SEO & Google Entegrasyonu'),

            // 1. Google Servisleri & OAuth
            m('div', { style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:20px;' }, [
                m('h4', { style: 'margin:0 0 12px 0; color:#334155;' }, '1. Google Servisleri & OAuth API Girişi'),
                m('div.Form-group', [
                    m('label', 'Google Analytics 4 Ölçüm Kimliği (G-XXXXXXXX)'),
                    m('input.FormControl', {
                        value: this.setting('framio-seo.ga_id')(),
                        oninput: e => this.setting('framio-seo.ga_id')(e.target.value)
                    })
                ]),
                m('div.Form-group', [
                    m('label', 'GA4 Mülk Kimliği (Sayısal ID)'),
                    m('input.FormControl', {
                        value: this.setting('framio-seo.ga_id_number')(),
                        oninput: e => this.setting('framio-seo.ga_id_number')(e.target.value)
                    })
                ]),
                m('div.Form-group', [
                    m('label', 'Google Search Console Doğrulama Kodu'),
                    m('input.FormControl', {
                        value: this.setting('framio-seo.gsc_code')(),
                        oninput: e => this.setting('framio-seo.gsc_code')(e.target.value)
                    })
                ]),
                m('div.Form-group', [
                    m('label', 'Google AdSense Yayıncı Kimliği (ca-pub-XXXXXXXX)'),
                    m('input.FormControl', {
                        value: this.setting('framio-seo.ads_client')(),
                        oninput: e => this.setting('framio-seo.ads_client')(e.target.value)
                    })
                ]),
                m('div.Form-group', [
                    m('label', 'Google OAuth Client ID'),
                    m('input.FormControl', {
                        value: this.setting('framio-seo.google_client_id')(),
                        oninput: e => this.setting('framio-seo.google_client_id')(e.target.value)
                    })
                ]),
                m('div.Form-group', [
                    m('label', 'Google OAuth Client Secret'),
                    m('input.FormControl', {
                        type: 'password',
                        value: this.setting('framio-seo.google_client_secret')(),
                        oninput: e => this.setting('framio-seo.google_client_secret')(e.target.value)
                    })
                ]),
                m('div.Form-group', { style: 'margin-top: 15px;' }, [
                    this.setting('framio-seo.google_tokens')()
                        ? m('button.Button', {
                            style: 'background-color: #e74c3c; color: white;',
                            onclick: (e) => {
                                e.preventDefault();
                                if (confirm('Google hesabınızın bağlantısını kesmek istediğinize emin misiniz?')) {
                                    m.request({
                                        method: 'POST',
                                        url: app.forum.attribute('apiUrl') + '/seo/google-logout',
                                        headers: { 'X-CSRF-Token': app.session.csrfToken }
                                    }).then(() => {
                                        this.setting('framio-seo.google_tokens')(null);
                                        app.alerts.show(Alert, {type: 'success'}, 'Bağlantı kesildi.');
                                        m.redraw();
                                    });
                                }
                            }
                        }, [m('i.fab.fa-google'), ' Google Bağlantısını Kes'])
                        : m('button.Button', {
                            style: 'background-color: #4285F4; color: white;',
                            onclick: (e) => {
                                e.preventDefault();
                                this.save(e);
                                m.request({
                                    method: 'GET',
                                    url: app.forum.attribute('apiUrl') + '/seo/google-login',
                                    headers: { 'X-CSRF-Token': app.session.csrfToken }
                                }).then(res => {
                                    if (res.auth_url) {
                                        window.open(res.auth_url, 'GoogleLogin', 'width=500,height=600');
                                        window.addEventListener('message', (event) => {
                                            if (event.data === 'google_auth_success') {
                                                window.location.reload();
                                            }
                                        });
                                    }
                                }).catch(() => {
                                    app.alerts.show(Alert, {type: 'error'}, 'URL oluşturulamadı (Client ID/Secret eksik olabilir).');
                                });
                            }
                        }, [m('i.fab.fa-google'), ' Google İle Giriş Yap (OAuth)'])
                ])
            ]),

            // 2. Looker Studio Entegrasyonu
            m('div', { style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:20px;' }, [
                m('h4', { style: 'margin:0 0 12px 0; color:#334155;' }, '2. Looker Studio Gelişmiş Analytics'),
                m('div.Form-group', [
                    m('label', 'Looker Studio Embed URL Adresi'),
                    m('input.FormControl', {
                        placeholder: 'https://lookerstudio.google.com/embed/reporting/...',
                        value: this.setting('framio-seo.looker_studio_url')(),
                        oninput: e => this.setting('framio-seo.looker_studio_url')(e.target.value)
                    }),
                    m('div.helpText', { style: 'font-size:11px; color:#888; margin-top:4px;' }, 'Google Looker Studio üzerinden oluşturduğunuz interaktif raporun yerleştirme (embed) bağlantısını buraya yapıştırarak admin panelinde canlı izleyebilirsiniz.')
                ])
            ]),

            // 3. Meta & Başlık Şablonları
            m('div', { style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:20px;' }, [
                m('h4', { style: 'margin:0 0 12px 0; color:#334155;' }, '3. Meta & İçerik Şablonları'),
                m('div.Form-group', [
                    m('label', 'Varsayılan Site Açıklaması (Meta Description)'),
                    m('textarea.FormControl', {
                        value: this.setting('framio-seo.meta_description_prefix')(),
                        oninput: e => this.setting('framio-seo.meta_description_prefix')(e.target.value)
                    })
                ]),
                m('div.Form-group', [
                    m('label', 'Meta Anahtar Kelimeler (Keywords)'),
                    m('textarea.FormControl', {
                        value: this.setting('framio-seo.meta_keywords')(),
                        oninput: e => this.setting('framio-seo.meta_keywords')(e.target.value)
                    })
                ])
            ]),

            // 4. Schema.org & Lisans Yönetimi
            m('div', { style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:20px;' }, [
                m('h4', { style: 'margin:0 0 12px 0; color:#334155;' }, '4. Schema.org, Telif & Lisans Yönetimi'),
                m('div.Form-group', [
                    m('label', 'Organizasyon / Telif Sahibi Adı'),
                    m('input.FormControl', {
                        placeholder: forumTitle,
                        value: this.setting('framio-seo.org_name')(),
                        oninput: e => this.setting('framio-seo.org_name')(e.target.value)
                    })
                ]),
                m('div.Form-group', [
                    m('label', 'Lisans / Rehber Sayfası URL'),
                    m('input.FormControl', {
                        placeholder: `${forumUrl}/p/lisans`,
                        value: this.setting('framio-seo.license_url')(),
                        oninput: e => this.setting('framio-seo.license_url')(e.target.value)
                    })
                ]),
                m('div.Form-group', [
                    m('label', 'Lisans Edinme / İletişim Sayfası URL'),
                    m('input.FormControl', {
                        placeholder: forumUrl,
                        value: this.setting('framio-seo.acquire_license_url')(),
                        oninput: e => this.setting('framio-seo.acquire_license_url')(e.target.value)
                    })
                ])
            ]),

            // 5. Görsel Sitemap, IndexNow & Web-Trigger
            m('div', { style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:20px;' }, [
                m('h4', { style: 'margin:0 0 12px 0; color:#334155;' }, '5. Görsel Sitemap, IndexNow & Web-Trigger'),
                m('div.Form-group', [
                    m('label', 'IndexNow API Anahtarı (Bing & Yandex Anlık Bildirim)'),
                    m('input.FormControl', {
                        placeholder: 'Otomatik üretilir veya özel anahtar girin',
                        value: this.setting('framio-seo.indexnow_key')(),
                        oninput: e => this.setting('framio-seo.indexnow_key')(e.target.value)
                    }),
                    m('div.helpText', { style: 'font-size:11px; color:#888; margin-top:4px;' }, 'Bing ve Yandex botlarına yeni ve güncellenen konular anında bildirilir. Doğrulama dosyası otomatik olarak `/{key}.txt` üzerinden sunulur.')
                ]),
                m('div.Form-group', [
                    m('label', 'Görsel Sitemap URL Formatı'),
                    m('select.FormControl', {
                        value: this.setting('framio-seo.sitemap_image_quality', 'thumb')(),
                        onchange: e => this.setting('framio-seo.sitemap_image_quality')(e.target.value)
                    }, [
                        m('option', { value: 'thumb' }, 'Tek adres: mesajdaki görsel boyutu (?w=1024; önerilen)'),
                        m('option', { value: 'original' }, 'Tam boyutlu ana görsel (?w= ve thumb_/mini_ ekleri kaldırılır)')
                    ]),
                    m('div.helpText', { style: 'font-size:11px; color:#888; margin-top:4px;' }, 'Site haritası, JSON-LD ve paylaşım kartlarında kullanılacak görsel adresi. Filigranlı WebP ana görsel kullanılır; filigransız orijinal JPG hiçbir zaman arama motorlarına bildirilmez.')
                ]),
                m('div.Form-group', [
                    m('label', 'Cron-Job.org / Web-Trigger Gizli Anahtarı'),
                    m('input.FormControl', {
                        value: this.setting('framio-seo.trigger_secret')(),
                        oninput: e => this.setting('framio-seo.trigger_secret')(e.target.value)
                    })
                ])
            ]),

            // Kaydet Butonu
            m('div.Form-group', { style: 'margin-top:20px;' }, [
                m('button.Button.Button--primary', {
                    disabled: this.isSaving,
                    onclick: (e) => this.save(e)
                }, this.isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet')
            ])
        ]);
    }

    // ---------- Form yardımcıları (Site Kimliği sekmesi) ----------
    seoField(key, label, opts = {}) {
        const k = 'framio-seo.' + key;
        const tag = opts.textarea ? 'textarea.FormControl' : 'input.FormControl';
        return m('div.Form-group', [
            m('label', label),
            m(tag, {
                // textarea'nın "type" özelliği salt okunurdur; yalnızca input'a verilir
                ...(opts.textarea ? { rows: opts.rows || 3 } : { type: opts.type || 'text' }),
                placeholder: opts.placeholder || '',
                value: this.setting(k)() || '',
                oninput: e => this.setting(k)(e.target.value)
            }),
            opts.help && m('div.helpText', { style: 'font-size:11px; color:#888; margin-top:4px;' }, opts.help)
        ]);
    }

    seoToggle(key, label, def = '1', help = null) {
        const k = 'framio-seo.' + key;
        const val = this.setting(k)();
        const checked = (val === undefined || val === null || val === '' ? def : val) === '1';
        return m('div.Form-group', [
            m('label', { style: 'display:flex; align-items:center; gap:10px; cursor:pointer;' }, [
                m('input', { type: 'checkbox', checked, onchange: e => this.setting(k)(e.target.checked ? '1' : '0') }),
                m('span', { style: 'font-weight:600;' }, label)
            ]),
            help && m('div.helpText', { style: 'font-size:11px; color:#888; margin-top:4px;' }, help)
        ]);
    }

    seoBox(title, children) {
        return m('div', { style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:20px;' }, [
            m('h4', { style: 'margin:0 0 12px 0; color:#334155;' }, title),
            ...children
        ]);
    }

    // 13. SİTE KİMLİĞİ, MEDYA & TARAMA — siteye özel her değer burada
    renderSiteTab() {
        const forumTitle = app.forum.attribute('forumTitle') || 'Forum';
        const forumUrl = (app.forum.attribute('baseUrl') || window.location.origin).replace(/\/$/, '');

        return m('div.SeoCard', [
            m('h3', { style: 'margin-top:0; color:#1e88e5;' }, 'Site Kimliği, Medya & Tarama'),
            m('p', { style: 'color:#64748b; font-size:13px;' }, 'Eklenti hiçbir siteye özel değeri kodunda tutmaz. Boş bırakılan alanlar forumun kendi ayarlarından (forum adı, logo, adres) türetilir.'),

            this.seoBox('1. Marka & Kimlik', [
                this.seoField('org_name', 'Site / Organizasyon Adı', { placeholder: forumTitle, help: 'Schema.org, og:site_name, görsel künyeleri ve telif bilgisinde kullanılır.' }),
                this.seoField('org_logo', 'Logo URL (Schema.org)', { placeholder: forumUrl + '/assets/logo.png', help: 'Boşsa forumun kendi logosu kullanılır. Google en az 112x112 piksel kare logo önerir.' }),
                this.seoField('default_author', 'Varsayılan Yazar / Fotoğrafçı Adı', { placeholder: forumTitle, help: 'Kullanıcısı silinmiş mesajlarda ve sosyal kartlarda gösterilir.' }),
                this.seoField('breadcrumb_home_label', 'Breadcrumb Ana Sayfa Etiketi', { placeholder: 'Ana Sayfa' }),
                this.seoToggle('dedupe_titles', 'Aynı başlıklı konuların <title> etiketine ana kategori adını ekle', '1', 'Örn. iki "BMC Kamyonlar" konusu "BMC Kamyonlar - Güncel …" ve "BMC Kamyonlar - Arşiv …" olarak ayrışır; Google kopya başlık olarak görmez.')
            ]),

            this.seoBox('2. Google Search Console Mülkleri', [
                this.seoField('gsc_property_url', 'Search Console Mülk Adresi', { placeholder: forumUrl + '/', help: 'URL öneki mülkü için tam adres (sonu / ile), alan adı mülkü için "sc-domain:ornek.com". Boşsa forum adresi kullanılır.' }),
                this.seoField('gsc_image_property_url', 'Görsel Sunucusu (CDN) Search Console Mülkü', { placeholder: 'https://cdn.ornek.com/', help: 'Görseller ayrı bir alan adından sunuluyorsa, Dashboard görsel performansı bu mülkten okunur.' })
            ]),

            this.seoBox('3. Medya Etiketleri & Görseller', [
                this.seoField('recognized_bbcode_tags', 'Tanınan Medya BBCode Etiketleri', { placeholder: 'framio-image, upl-image-preview', help: 'Virgülle ayırın. framio-image ve upl-image-preview her zaman tanınır; eski sürümlerden kalan etiketleri (ör. [eski-image]) buraya ekleyin.' }),
                this.seoField('media_table', 'Medya Veritabanı Tablosu (önek olmadan)', { placeholder: 'framio_media_images', help: 'EXIF konum verisi ve yetim görsel taraması bu tablodan okunur.' }),
                this.seoField('image_proxy_rules', 'Görsel Proxy Kuralları', { textarea: true, placeholder: 'cdn.ornek.com|/assets/site/', help: 'Her satıra "cdn-host|yol-öneki". Eşleşen görsel adresleri forum alan adındaki proxy yoluna çevrilir. Proxy sunucu tarafında (ör. .htaccess) kurulu değilse boş bırakın.' }),
                this.seoField('image_proxy_path', 'Proxy Yolu', { placeholder: '/f/' }),
                this.seoField('image_caption_format', 'Görsel Açıklama (Schema caption) Şablonu', { placeholder: '{alt}', help: 'Etiketler: {alt} {title} {site_name} {host}' }),
                this.seoField('image_keywords', 'Görsellere Eklenecek Ek Anahtar Kelimeler', { placeholder: 'otobüs fotoğrafları, spotting', help: 'Virgülle ayırın; her görselin keywords alanına eklenir.' }),
                this.seoField('alt_text_format', 'Otomatik Alt Metin Şablonu', { placeholder: '{kunye}', help: 'Etiketler: {kunye} {plate} {brand} {model} {company} {title} {filename} {site_name}. Sonuç boşsa "{filename} - {title}" kullanılır.' }),
                this.seoToggle('enable_auto_alt', 'Yeni mesajlarda boş alt metinleri otomatik doldur'),
                this.seoField('known_brands', 'Künyede Aranacak Markalar', { textarea: true, placeholder: 'Mercedes-Benz, Setra, MAN, Neoplan, Temsa…', help: 'Virgülle veya satırla ayırın. Boşsa geniş bir varsayılan ulaşım markaları listesi kullanılır.' }),
                this.seoField('max_schema_images', 'Sayfa Başına JSON-LD Görsel Sınırı', { type: 'number', placeholder: '20' }),
                this.seoField('brand_models_setting', 'Marka/Model Kuralları Ayar Anahtarı', { placeholder: 'framio-upload-exif.brand_models', help: 'Upload & EXIF eklentisinin marka/model kurallarını tuttuğu ayar anahtarı.' })
            ]),

            this.seoBox('4. Mesaj Sayfaları (her mesaj arama motorlarında ayrı sonuç)', [
                m('p', { style: 'color:#64748b; font-size:12px; margin:0 0 10px;' }, 'Flarum\'un kalıcı mesaj adresi (/d/konu/12) künyeli veya fotoğraflı mesajlarda kendi başlığı, açıklaması, görseli ve yapılandırılmış verisiyle ayrı bir sayfa olarak sunulur ve sitemap-posts.xml ile bildirilir. SPA davranışı değişmez.'),
                this.seoToggle('enable_post_pages', 'Mesaj sayfaları ve sitemap-posts.xml aktif'),
                m('div.Form-group', [
                    m('label', 'Hangi mesajlar bildirilsin?'),
                    m('select.FormControl', {
                        value: this.setting('framio-seo.post_sitemap_scope')() || 'media',
                        onchange: e => this.setting('framio-seo.post_sitemap_scope')(e.target.value)
                    }, [
                        m('option', { value: 'media' }, 'Yalnızca fotoğraflı / künyeli mesajlar (önerilen)'),
                        m('option', { value: 'all' }, 'Tüm yanıtlar')
                    ])
                ]),
                this.seoField('post_title_format', 'Mesaj Sayfası Başlık Şablonu', { placeholder: '{kunye}', help: 'Etiketler: {kunye} {plate} {brand} {model} {company} {location} {title} {number}. Sonuç boşsa "{konu başlığı} #{no}" kullanılır.' }),
                this.seoToggle('post_show_exif', 'EXIF bilgisini (kamera, lens, ayarlar) mesaj sayfalarında ve şemada göster'),
                this.seoToggle('post_show_location', 'EXIF GPS konumunu şemada göster', '0', 'Gizlilik nedeniyle varsayılan kapalı.'),
                this.seoField('discussion_min_posts', 'Başlığın dizine girmesi için en az mesaj sayısı', { type: 'number', placeholder: '2', help: 'Bu sayının altındaki başlıklar (ör. yalnızca açıklama mesajı olan, henüz fotoğraf paylaşılmamış başlıklar) noindex alır ve sitemap’e girmez; ilk paylaşım gelince kendiliğinden dizinlenebilir olur.' }),
                this.seoField('profile_min_posts', 'Profil sayfasının dizine girmesi için en az mesaj sayısı', { type: 'number', placeholder: '1', help: 'Bu sayının altındaki üye profilleri noindex alır ve sitemap\'e girmez (boş/ince profil sayfaları sitenin kalite puanını düşürür).' })
            ]),

            this.seoBox('4b. Araç Sayfaları (/arac — marka, model, firma, plaka, şehir, yıl)', [
                m('p', { style: 'color:#64748b; font-size:12px; margin:0 0 10px;' }, 'Künye satırlarındaki marka, model, firma, plaka, çekim şehri ve yılı tıklanabilir olur; her biri o değere ait tüm fotoğrafları toplayan bir sayfa açar ve sitemap-hubs.xml ile bildirilir. Mevcut mesajlar için dizin bir kez "php flarum seo:index-entities" komutuyla oluşturulur; yeni ve düzenlenen mesajlar otomatik işlenir.'),
                this.seoToggle('enable_hubs', 'Araç sayfaları ve künye bağlantıları aktif'),
                this.seoField('hub_min_posts', 'Sayfa açılması için en az fotoğraf (marka, model, firma, şehir, yıl)', { type: 'number', placeholder: '2', help: 'Bu sayının altındaki değerler bağlantıya dönüşmez ve sitemap\'e girmez (tek fotoğraflık ince sayfalar önlenir).' }),
                this.seoField('hub_min_posts_plate', 'Plaka sayfası için en az fotoğraf', { type: 'number', placeholder: '1', help: 'Plaka tek bir araca aittir ve çoğu aracın tek fotoğrafı vardır; plaka aramalarında ziyaretçiyi doğrudan araca ulaştırmak için önerilen değer 1.' })
            ]),

            this.seoBox('5. Tarama & Dizine Ekleme', [
                this.seoToggle('enable_sitemap', 'sitemap.xml aktif'),
                this.seoToggle('enable_image_sitemap', 'sitemap-images.xml (Google Görseller) aktif'),
                this.seoToggle('enable_indexnow', 'IndexNow bildirimleri aktif (Bing, Yandex, Seznam, Naver)'),
                this.seoToggle('enable_indexing_api', 'Google Indexing API bildirimleri aktif', '0',
                    'Google bu API\'yi resmî olarak yalnızca iş ilanı ve canlı yayın sayfaları için destekler; forum sayfalarında dizine eklemeyi garanti etmez ve kota tüketir. Önerilen: kapalı; sitemap + Search Console kullanın.'),
                this.seoToggle('bot_cache_enabled', 'Arama motoru botları için sayfa önbelleği', '0',
                    'Googlebot, Bingbot gibi botlara hazır HTML verir; tarama hızlanır, sunucu yükü azalır. İnsan ziyaretçiler ve giriş yapmış kullanıcılar etkilenmez. İçerik değişince önbellek otomatik temizlenir.'),
                this.seoField('bot_cache_ttl', 'Bot önbelleği süresi (saniye)', { placeholder: '21600', help: 'Varsayılan 21600 (6 saat). Yeni gönderi ve düzenlemelerde önbellek zaten temizlenir.' }),
                this.seoToggle('enable_legacy_redirects', 'Eski ve yanlış konu adreslerini 301 ile yönlendir', '0',
                    'Adresteki kısa ad konunun kendisininkiyle uyuşmazsa ya da konu numarası yoksa, aynı kısa ada sahip tek konuya yönlendirir (mesaj numarası korunur). Aynı adlı birden çok konu varsa (Güncel / Arşiv) tahmin yapılmaz; o adresler "Eski Adres Yönlendirmeleri & 404" kaydından yönlendirilir.'),
                this.seoField('robots_extra', 'robots.txt Ek Kuralları', { textarea: true, placeholder: 'Disallow: /u/', help: 'Sunucuda fiziksel robots.txt dosyası yoksa eklentinin ürettiği robots.txt\'ye eklenir.' })
            ]),

            m('div.Form-group', { style: 'margin-top:20px;' }, [
                m('button.Button.Button--primary', { disabled: this.isSaving, onclick: (e) => this.save(e) }, this.isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet')
            ])
        ]);
    }

    // 14. YÖNLENDİRMELER & 404 KAYDI
    renderRedirectsTab() {
        const r = this.redir || { redirects: [], not_found: [], stats: {}, drafts: {} };
        const presets = {
            'MyBB (SEF)': [
                '^/(?:konu|thread)-(.+?)(?:--\\d+)?(?:-page-\\d+)?\\.html => discussion',
                '^/forum-(.+?)(?:-page-\\d+)?\\.html => tag',
                '^/(?:User|user)-(.+?)(?:\\.html)?$ => user',
                '^/profil-(.+?)\\.html$ => user',
                '^/portal\\.php$ => /',
                '^/index\\.php$ => /',
            ],
            'phpBB': [
                '^/(?:index|portal)\\.php$ => /',
                '^/memberlist\\.php\\?mode=viewprofile&u=\\d+$ => gone',
            ],
            'vBulletin / XenForo': [
                '^/threads/(?:\\d+-)?([^/.]+?)(?:\\.\\d+)?/?$ => discussion',
                '^/forums/(?:\\d+-)?([^/.]+?)(?:\\.\\d+)?/?$ => tag',
                '^/members/([^/.]+?)(?:\\.\\d+)?/?$ => user',
            ],
        };
        const patternsKey = 'framio-seo.legacy_url_patterns';
        const cell = 'padding:6px 8px; border-bottom:1px solid #eef2f7; font-size:12px; vertical-align:middle;';

        return m('div.SeoCard', [
            m('h3', { style: 'margin-top:0; color:#1e88e5;' }, 'Eski Adres Yönlendirmeleri & 404 Kaydı'),
            m('p', { style: 'color:#64748b; font-size:13px;' }, 'Forum bir adres için 404 döndürdüğünde önce aşağıdaki yönlendirmelere, sonra kalıplara bakılır. Çözülemeyen adresler 404 kaydına düşer; Googlebot\'un hâlâ aradığı eski adresler burada birikir ve tek tıkla yönlendirilebilir.'),

            m('div', { style: 'display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px;' }, [
                ['Yönlendirme', r.stats.redirects || 0], ['Yönlendirilen istek', r.stats.redirect_hits || 0], ['Bekleyen 404', r.stats.not_found || 0]
            ].map(([l, v]) => m('div', { style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 16px;' }, [
                m('div', { style: 'font-size:20px; font-weight:700; color:#1e293b;' }, v), m('div', { style: 'font-size:11px; color:#64748b;' }, l)
            ]))),

            this.seoBox('1. Ayarlar & Eski URL Kalıpları', [
                this.seoToggle('enable_redirects', 'Yönlendirmeler aktif'),
                this.seoToggle('enable_404_log', '404 kaydı aktif (en fazla 5000 adres)'),
                this.seoField('legacy_url_patterns', 'Eski URL kalıpları', {
                    textarea: true, rows: 7,
                    placeholder: '^/konu-(.+?)\\.html => discussion',
                    help: 'Her satır: düzenli-ifade => hedef. Hedef: discussion | tag | user (ilk yakalama grubu slug olarak aranır), gone (410 Kalıcı Olarak Kaldırıldı) veya /yeni/yol/$1. # ile başlayan satırlar yok sayılır.'
                }),
                m('div', { style: 'display:flex; gap:8px; flex-wrap:wrap;' }, Object.keys(presets).map(name =>
                    m('button.Button.Button--small', {
                        onclick: (e) => {
                            e.preventDefault();
                            const cur = (this.setting(patternsKey)() || '').trim();
                            this.setting(patternsKey)((cur ? cur + '\n' : '') + '# ' + name + '\n' + presets[name].join('\n'));
                        }
                    }, '+ ' + name + ' hazır kalıpları')
                )),
                m('div', { style: 'margin-top:12px;' }, m('button.Button.Button--primary', { disabled: this.isSaving, onclick: (e) => this.save(e) }, this.isSaving ? 'Kaydediliyor...' : 'Kaydet'))
            ]),

            this.seoBox('2. Yeni Yönlendirme', [
                m('div', { style: 'display:grid; grid-template-columns:2fr 2fr 110px auto; gap:8px; align-items:end;' }, [
                    m('input.FormControl', { placeholder: '/showthread.php?tid=138', value: r.drafts.__new_source || '', oninput: e => { r.drafts.__new_source = e.target.value; } }),
                    m('input.FormControl', { placeholder: '/d/78-yan-yana-sehirlerarasi-otobusler', value: r.drafts.__new_target || '', oninput: e => { r.drafts.__new_target = e.target.value; } }),
                    m('select.FormControl', { value: r.drafts.__new_status || '301', onchange: e => { r.drafts.__new_status = e.target.value; } }, [
                        m('option', { value: '301' }, '301 Kalıcı'), m('option', { value: '302' }, '302 Geçici'), m('option', { value: '410' }, '410 Silindi')
                    ]),
                    m('button.Button.Button--primary', {
                        onclick: () => this.redirectsApi('POST', { action: 'save', source: r.drafts.__new_source, target: r.drafts.__new_target, status: r.drafts.__new_status || '301' })
                            .then(res => { if (res) { r.drafts.__new_source = ''; r.drafts.__new_target = ''; } })
                    }, 'Ekle')
                ])
            ]),

            this.seoBox('3. Çözülemeyen Adresler (404 kaydı)', [
                r.loading && m('p', 'Yükleniyor...'),
                r.not_found.length === 0 ? m('p', { style: 'color:#94a3b8;' }, 'Kayıt yok.') :
                m('div', { style: 'overflow-x:auto;' }, m('table', { style: 'width:100%; border-collapse:collapse;' }, [
                    m('tr', ['Adres', 'İstek', 'Bot', 'Son görülme', 'Hedef', ''].map(h => m('th', { style: cell + 'text-align:left; color:#64748b;' }, h))),
                    r.not_found.map(row => m('tr', [
                        m('td', { style: cell + 'word-break:break-all; max-width:320px;' }, [m('code', row.path), row.last_referrer && m('div', { style: 'color:#94a3b8; font-size:10px;' }, '↩ ' + row.last_referrer)]),
                        m('td', { style: cell }, row.hits),
                        m('td', { style: cell }, row.bot_hits),
                        m('td', { style: cell + 'white-space:nowrap;' }, (row.last_seen_at || '').substring(0, 16)),
                        m('td', { style: cell + 'min-width:220px;' }, m('input.FormControl', {
                            style: 'font-size:12px; padding:4px 8px;', placeholder: '/d/… veya boş = 410',
                            value: r.drafts[row.path] || '', oninput: e => { r.drafts[row.path] = e.target.value; }
                        })),
                        m('td', { style: cell + 'white-space:nowrap;' }, [
                            m('button.Button.Button--small', { title: 'Kalıplarla çözmeyi dene', onclick: () => this.redirectsApi('POST', { action: 'suggest', path: row.path }).then(res => {
                                if (res && res.resolved && res.target) { r.drafts[row.path] = res.target.replace(app.forum.attribute('baseUrl'), ''); }
                                else app.alerts.show(Alert, { type: 'warning' }, 'Kalıplarla eşleşen bir hedef bulunamadı.');
                                m.redraw();
                            }) }, '🔍'), ' ',
                            m('button.Button.Button--small.Button--primary', { onclick: () => {
                                const t = (r.drafts[row.path] || '').trim();
                                this.redirectsApi('POST', { action: 'save', source: row.path, target: t, status: t ? '301' : '410' });
                            } }, 'Kaydet'), ' ',
                            m('button.Button.Button--small', { title: 'Kayıttan sil', onclick: () => this.redirectsApi('POST', { action: 'dismiss', path: row.path }) }, '✕')
                        ])
                    ]))
                ])),
                r.not_found.length > 0 && m('button.Button.Button--small', { style: 'margin-top:10px;', onclick: () => confirm('404 kaydının tamamı silinsin mi?') && this.redirectsApi('POST', { action: 'clear404' }) }, 'Tüm 404 kaydını temizle')
            ]),

            this.seoBox('4. Kayıtlı Yönlendirmeler', [
                r.redirects.length === 0 ? m('p', { style: 'color:#94a3b8;' }, 'Henüz yönlendirme yok.') :
                m('div', { style: 'overflow-x:auto;' }, m('table', { style: 'width:100%; border-collapse:collapse;' }, [
                    m('tr', ['Eski adres', 'Hedef', 'Kod', 'Kaynak', 'Kullanım', ''].map(h => m('th', { style: cell + 'text-align:left; color:#64748b;' }, h))),
                    r.redirects.map(row => m('tr', [
                        m('td', { style: cell + 'word-break:break-all;' }, m('code', row.source)),
                        m('td', { style: cell + 'word-break:break-all;' }, row.target ? m('a', { href: row.target, target: '_blank' }, row.target) : '—'),
                        m('td', { style: cell }, row.status),
                        m('td', { style: cell }, row.origin === 'auto' ? 'Kalıp' : 'Elle'),
                        m('td', { style: cell }, row.hits),
                        m('td', { style: cell }, m('button.Button.Button--small', { onclick: () => confirm('Silinsin mi?') && this.redirectsApi('POST', { action: 'delete', id: row.id }) }, 'Sil'))
                    ]))
                ]))
            ])
        ]);
    }

    // 12. NİŞ & SEKTÖREL SEO MOTORU (SERP & SOCIAL BANNER)
    renderNicheTab() {
        const forumTitle = app.forum.attribute('forumTitle') || 'Forum';
        const forumUrl = app.forum.attribute('baseUrl') || window.location.origin;
        const currentNiche = this.setting('framio-seo.niche_mode', 'general')();
        const currentTitleFmt = this.setting('framio-seo.title_format', '{title}')();
        const currentDescFmt = this.setting('framio-seo.meta_desc_format', '')();

        // Örnek Değişkenlerle Canlı SERP Simülasyonu
        const sampleVars = {
            '{title}': 'Varan Turizm Yeni Travego 16 SHD',
            '{plate}': '34 VRN 01',
            '{brand}': 'Mercedes-Benz',
            '{model}': 'Travego 16 SHD',
            '{company}': 'Varan Turizm',
            '{site_name}': forumTitle,
            '{location}': 'İstanbul',
            '{tag}': 'Otobüsler'
        };

        let liveTitle = currentTitleFmt;
        for (const [k, v] of Object.entries(sampleVars)) {
            liveTitle = liveTitle.replace(new RegExp(k, 'g'), v);
        }

        let liveDesc = currentDescFmt;
        for (const [k, v] of Object.entries(sampleVars)) {
            liveDesc = liveDesc.replace(new RegExp(k, 'g'), v);
        }

        return m('div', [
            // Üst Açıklama
            m('div.SeoCard', { style: 'background:linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color:#fff; padding:22px; border-radius:12px; margin-bottom:20px; box-shadow:0 4px 15px rgba(30,60,114,0.15);' }, [
                m('h3', { style: 'margin:0 0 8px 0; color:#fff; display:flex; align-items:center; gap:10px;' }, [
                    m('i.fas.fa-bullseye'), '🎯 Sektörel Niş & Akıllı Sosyal Paylaşım Motoru'
                ]),
                m('p', { style: 'margin:0; opacity:0.9; font-size:13px; line-height:1.5;' }, 
                    'Rakipleri 100 gömlek geride bırakacak Google Rich Snippet araç pasaportu, dinamik WhatsApp/Twitter 1200x630 önizleme görseli (Social Card) ve arama motoru tıklama oranını artıran akıllı SERP şablonlarını buradan yönetebilirsiniz.'
                )
            ]),

            // 1. Sektörel Odak & Şema Seçimi
            m('div.SeoCard', { style: 'background:#fff; padding:20px; border-radius:10px; border:1px solid #e0e4e8; margin-bottom:20px;' }, [
                m('h4', { style: 'margin-top:0; color:#2c3e50; display:flex; align-items:center; gap:8px;' }, [
                    m('i.fas.fa-industry'), ' 1. Sektörel Odak Modu & Schema.org Yapısı'
                ]),
                m('p', { style: 'color:#7f8fa6; font-size:13px; margin-bottom:15px;' }, 'Bu sitenin ana uzmanlık alanını seçin. Arama motorları (Google/Bing) sayfa içeriğini bu sektörel mikroformata göre indeksleyecektir:'),
                
                m('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px; margin-bottom:15px;' }, [
                    { id: 'bus', title: '🚌 Otobüs & Yolcu Taşımacılığı', desc: 'Görseller BusOrCoach varlığına bağlanır: marka, model, plaka, işletmeci.' },
                    { id: 'truck', title: '🚛 Kamyon, Çekici & Ağır Vasıta', desc: 'Vehicle + kamyon sınıfı: marka, model, plaka, işletmeci.' },
                    { id: 'urban', title: '🚇 Şehir İçi Toplu Taşıma', desc: 'Vehicle + toplu taşıma sınıfı: filo no / plaka, marka, model.' },
                    { id: 'rail', title: '🚆 Demiryolu & Raylı Sistemler', desc: 'Vehicle + tren sınıfı: araç numarası, üretici, model.' },
                    { id: 'aviation', title: '✈️ Havacılık & Uçak Spotting', desc: 'Vehicle + uçak sınıfı: TC-xxx tescil, üretici, tip, havayolu.' },
                    { id: 'maritime', title: '🚢 Denizcilik', desc: 'Vehicle + gemi sınıfı: IMO / tescil, tersane, model.' },
                    { id: 'general', title: '🌐 Genel Ulaşım & Karma', desc: 'Sınıf belirtmeden genel Vehicle varlığı.' }
                ].map(opt => {
                    const isSel = currentNiche === opt.id;
                    return m('div', {
                        style: `border:2px solid ${isSel ? '#3498db' : '#e2e8f0'}; background:${isSel ? '#ebf5fb' : '#f8fafc'}; border-radius:10px; padding:15px; cursor:pointer; transition:all 0.2s;`,
                        onclick: () => this.setting('framio-seo.niche_mode')(opt.id)
                    }, [
                        m('div', { style: `font-weight:bold; font-size:14px; color:${isSel ? '#2980b9' : '#2c3e50'}; margin-bottom:5px;` }, opt.title),
                        m('div', { style: 'font-size:12px; color:#64748b; line-height:1.4;' }, opt.desc)
                    ]);
                }))
            ]),

            // 2. Akıllı Başlık & SERP Şablonu
            m('div.SeoCard', { style: 'background:#fff; padding:20px; border-radius:10px; border:1px solid #e0e4e8; margin-bottom:20px;' }, [
                m('h4', { style: 'margin-top:0; color:#2c3e50; display:flex; align-items:center; gap:8px;' }, [
                    m('i.fas.fa-heading'), ' 2. Akıllı Google Arama Başlık Şablonu (SERP Title Engine)'
                ]),
                m('p', { style: 'color:#7f8fa6; font-size:13px; margin-bottom:12px;' }, 'Konulardaki araç künye verilerini yakalayarak Google arama sonuçlarında en yüksek tıklama alan başlık formatını oluşturun:'),
                
                m('div.Form-group', [
                    m('input.FormControl', {
                        style: 'font-size:14px; font-weight:600; color:#1e293b; padding:10px;',
                        value: this.setting('framio-seo.title_format', '{title}')(),
                        oninput: e => this.setting('framio-seo.title_format')(e.target.value)
                    })
                ]),

                // Değişken Rozetleri
                m('div', { style: 'display:flex; flex-wrap:wrap; gap:8px; margin-bottom:15px; align-items:center;' }, [
                    m('span', { style: 'font-size:11px; font-weight:bold; color:#64748b;' }, 'Kullanılabilir Etiketler:'),
                    ['{title}', '{plate}', '{brand}', '{model}', '{company}', '{location}', '{tag}', '{site_name}'].map(tag => 
                        m('button.Button.Button--small', {
                            style: 'background:#f1f5f9; border:1px solid #cbd5e1; color:#334155; font-family:monospace;',
                            onclick: () => {
                                const cur = this.setting('framio-seo.title_format', '{title}')();
                                this.setting('framio-seo.title_format')(cur + ' ' + tag);
                            }
                        }, tag)
                    )
                ]),

                // Canlı SERP Başlık Önizlemesi
                m('div', { style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:15px;' }, [
                    m('div', { style: 'font-size:11px; text-transform:uppercase; color:#94a3b8; font-weight:bold; margin-bottom:6px;' }, 'Google Arama Sonucu Önizlemesi (Masaüstü & Mobil)'),
                    m('div', { style: 'font-size:11px; color:#202124; margin-bottom:3px;' }, `${forumUrl} › d › 123-varan-turizm-travego`),
                    m('div', { style: 'color:#1a0dab; font-size:18px; font-weight:500; text-decoration:underline; cursor:pointer; line-height:1.3; word-break:break-all;' }, liveTitle + ' - ' + forumTitle),
                    m('div', { style: 'color:#4d5156; font-size:13px; margin-top:4px; line-height:1.4;' }, liveDesc)
                ])
            ]),

            // 3. Akıllı Meta Açıklama Şablonu
            m('div.SeoCard', { style: 'background:#fff; padding:20px; border-radius:10px; border:1px solid #e0e4e8; margin-bottom:20px;' }, [
                m('h4', { style: 'margin-top:0; color:#2c3e50; display:flex; align-items:center; gap:8px;' }, [
                    m('i.fas.fa-align-left'), ' 3. Akıllı Meta Açıklama Şablonu (Meta Description Engine)'
                ]),
                m('p', { style: 'color:#7f8fa6; font-size:13px; margin-bottom:12px;' }, 'Araç künyesi içeren mesajlarda Google için otomatik üretilecek zengin meta açıklama formülü:'),
                
                m('div.Form-group', [
                    m('textarea.FormControl', {
                        rows: 3,
                        style: 'font-size:13px; color:#1e293b;',
                        value: this.setting('framio-seo.meta_desc_format', '')(),
                        oninput: e => this.setting('framio-seo.meta_desc_format')(e.target.value)
                    })
                ])
            ]),

            // 4. Dinamik Sosyal Paylaşım Görseli (OG 1200x630 Social Banner)
            m('div.SeoCard', { style: 'background:#fff; padding:20px; border-radius:10px; border:1px solid #e0e4e8; margin-bottom:20px;' }, [
                m('h4', { style: 'margin-top:0; color:#2c3e50; display:flex; align-items:center; gap:8px;' }, [
                    m('i.fas.fa-image'), ' 4. Dinamik Sosyal Paylaşım Görseli Motoru (1200x630 Social Card)'
                ]),
                m('p', { style: 'color:#7f8fa6; font-size:13px; margin-bottom:15px;' }, 'WhatsApp, Telegram, Twitter/X, Facebook vb. platformlarda paylaşılan her link için araç fotoğrafını, plakasını ve spotter adını otomatik harmanlayan dinamik Social Banner üretimi:'),
                
                m('div.Form-group', [
                    m('label', { style: 'display:flex; align-items:center; gap:10px; cursor:pointer;' }, [
                        m('input', {
                            type: 'checkbox',
                            checked: this.setting('framio-seo.enable_dynamic_og', '1')() === '1',
                            onchange: e => this.setting('framio-seo.enable_dynamic_og')(e.target.checked ? '1' : '0')
                        }),
                        m('span', { style: 'font-weight:600; color:#1e293b;' }, 'Dinamik Sosyal Önizleme Görseli (1200x630 Social Card) Aktif Olsun')
                    ])
                ]),

                // Sosyal Kart Görsel Simülasyonu
                m('div', { style: 'background:#121826; border-radius:12px; padding:20px; color:#fff; display:flex; gap:20px; max-width:680px; margin-top:15px; box-shadow:0 8px 25px rgba(0,0,0,0.3);' }, [
                    m('div', { style: 'width:240px; height:150px; background:#1e2538; border-radius:8px; border:1px solid #2d3748; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden;' }, [
                        m('i.fas.fa-bus', { style: 'font-size:48px; color:#3b82f6; opacity:0.4;' }),
                        m('span', { style: 'position:absolute; bottom:6px; left:6px; background:rgba(0,0,0,0.7); font-size:9px; padding:2px 6px; border-radius:4px;' }, '1200x630 HD')
                    ]),
                    m('div', { style: 'flex:1; display:flex; flex-direction:column; justify-content:center; gap:6px;' }, [
                        m('div', { style: 'font-size:11px; color:#38bdf8; font-weight:bold; letter-spacing:0.5px;' }, (forumTitle || '').toUpperCase()),
                        m('div', { style: 'display:inline-flex; align-items:center; background:#f8fafc; color:#0f172a; border-radius:4px; padding:2px 8px; width:fit-content; border:1px solid #334155; font-weight:bold; font-size:12px; font-family:monospace;' }, [
                            m('span', { style: 'background:#1d4ed8; color:#fff; font-size:8px; padding:1px 3px; border-radius:2px; margin-right:5px;' }, 'TR'),
                            '34 VRN 01'
                        ]),
                        m('div', { style: 'font-size:13px; font-weight:bold; color:#f8fafc; line-height:1.3;' }, 'Varan Turizm Yeni Travego 16 SHD'),
                        m('div', { style: 'font-size:11px; color:#94a3b8; margin-top:auto;' }, '📷 Fotoğrafçı: Kullanıcı • © ' + forumTitle)
                    ])
                ])
            ]),

            // Kaydet Butonu
            m('div.Form-group', { style: 'margin-top:20px;' }, [
                m('button.Button.Button--primary', {
                    disabled: this.isSaving,
                    onclick: (e) => this.save(e)
                }, this.isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet')
            ])
        ]);
    }

    // ---------- ANA GÖRÜNÜM (CONTENT) ----------
    content() {
        const d = this.data.dashboard;
        const gsc = (d && d.gsc) ? d.gsc : { clicks: 0, impressions: 0, top_queries: [] };
        const ga = (d && d.ga4) ? d.ga4 : { active_users: 0, screen_views: 0, top_pages: [] };

        const imgAll = this.data.images.all;
        const postsMap = new Map();
        imgAll.forEach(img => {
            if (!postsMap.has(img.post_id)) {
                postsMap.set(img.post_id, {
                    post_id: img.post_id,
                    discussion_id: img.discussion_id,
                    discussion_title: img.discussion_title,
                    discussion_url: img.discussion_url,
                    post_url: img.post_url,
                    user_display_name: img.user_display_name || 'Bilinmiyor',
                    brand: img.brand || '',
                    model: img.model || '',
                    post_text: img.post_text || '',
                    images: []
                });
            }
            postsMap.get(img.post_id).images.push(img);
        });
        const postsList = Array.from(postsMap.values());

        const sq = trNorm(this.searchQuery).trim();
        const imgFilter = this.imageFilter || 'all';
        const basePosts = imgFilter === 'alt' ? postsList.filter(p => p.images.some(i => altMissing(i.alt))) : postsList;
        const filteredPosts = sq
            ? basePosts.filter(p => {
                  const haystack = trNorm([
                      String(p.post_id),
                      p.discussion_title,
                      p.brand,
                      p.model,
                      p.user_display_name,
                      p.post_text,
                      ...p.images.map(i => i.alt)
                  ].join(' '));
                  return haystack.includes(sq);
              })
            : basePosts;

        const imgPg = this.data.images.page;
        const imgPerPg = 16;
        const imgTotalPg = Math.max(1, Math.ceil(filteredPosts.length / imgPerPg));
        const postsSlice = filteredPosts.slice((imgPg - 1) * imgPerPg, imgPg * imgPerPg);

        return m('div.FramioSeoSettingsPage.container', [

            // Üst Başlık Banner
            m('div.FramioSettings-header', { style: 'margin: 20px 0; border-bottom: 2px solid #e0e0e0; padding-bottom: 15px;' }, [
                m('h2', { style: 'display: flex; align-items: center; gap: 10px; margin: 0; color: #1e88e5;' }, [
                    m('i.fas.fa-globe-americas'),
                    m('span', 'Framio Enterprise SEO & Analytics Suite')
                ]),
                m('p', { style: 'color: #666; margin: 5px 0 0 0;' }, 'Google Indexing API, Bing IndexNow, Search Console, GA4 & Looker Studio, Reklam & Gelir Yönetimi, Sosyal Medya Hub, Niş & Sektörel SEO Motoru.')
            ]),

            // SEKME AÇILIR MENÜSÜ (Upload & EXIF ile birebir uyumlu açılır menü tasarımı)
            m('div.FramioSettings-tabs', { style: 'margin-bottom: 25px; display: flex; align-items: center; gap: 15px;' }, [
                m('label', { style: 'font-size: 14px; font-weight: bold; color: #555; margin: 0;' }, [
                    m('i.fas.fa-layer-group', { style: 'margin-right: 8px; color: #1e88e5;' }),
                    'Yapılandırma Modülü:'
                ]),
                m('select.FormControl', {
                    style: 'width: 100%; max-width: 380px; font-size: 14px; padding: 8px 12px; cursor: pointer; border: 1px solid #1e88e5; color: #1e88e5; font-weight: 600;',
                    value: this.activeTab,
                    onchange: (e) => {
                        this.activeTab = e.target.value;
                        if (this.activeTab === 'dashboard') this.loadDashboard();
                        if (this.activeTab === 'niche') {}
                        if (this.activeTab === 'ads') loadAdsTab(this);
                        if (this.activeTab === 'social') this.loadSocial();
                        if (this.activeTab === 'keywords') this.loadSearches();
                        if (this.activeTab === 'looker') {}
                        if (this.activeTab === 'indexing') this.loadIndexing();
                        if (this.activeTab === 'images') this.loadImages();
                        if (this.activeTab === 'audit') this.loadAudit();
                        if (this.activeTab === 'orphans') this.loadOrphans();
                        if (this.activeTab === 'logs') this.loadLogs();
                        if (this.activeTab === 'redirects') this.loadRedirects();
                        if (this.activeTab === 'appearance') loadAppearance(this);
                        m.redraw();
                    }
                }, [
                    m('option', { value: 'dashboard' }, '📊 Dashboard & Canlı Metrikler'),
                    m('option', { value: 'niche' }, '🎯 Sektörel Niş & Sosyal Kart Motoru'),
                    m('option', { value: 'ads' }, '📢 Reklam Yönetimi & Gelir Takibi'),
                    m('option', { value: 'social' }, '📱 Sosyal Medya Hub & Zamanlama'),
                    m('option', { value: 'keywords' }, '🔍 Arama Trendleri & Anahtar Kelimeler'),
                    m('option', { value: 'looker' }, '📈 Kapsamlı Analytics (Looker Studio)'),
                    m('option', { value: 'indexing' }, '📋 İndeks Yönetimi (GSC Canlı Takip)'),
                    m('option', { value: 'images' }, '🖼️ Görsel SEO & JSON-LD'),
                    m('option', { value: 'audit' }, '✅ Gönderi Denetimi & İndeks Kuyruğu'),
                    m('option', { value: 'orphans' }, '🗑️ Yetim Görsel Temizliği'),
                    m('option', { value: 'logs' }, '📝 API & Sistem Hata Logları'),
                    m('option', { value: 'appearance' }, '🌐 Arama Görünümü & Site Bağlantıları'),
                    m('option', { value: 'site' }, '🏷️ Site Kimliği, Medya & Tarama'),
                    m('option', { value: 'redirects' }, '↪️ Eski Adres Yönlendirmeleri & 404'),
                    m('option', { value: 'settings' }, '⚙️ SEO & Google Ayarları')
                ])
            ]),

            // SEKME İÇERİĞİ
            m('div.FramioSettings-tabBody', [
                this.activeTab === 'dashboard' && this.renderDashboardTab(gsc, ga, d),
                this.activeTab === 'niche' && this.renderNicheTab(),
                this.activeTab === 'ads' && renderAdsTab(this),
                this.activeTab === 'social' && this.renderSocialTab(),
                this.activeTab === 'keywords' && this.renderKeywordsTab(),
                this.activeTab === 'looker' && this.renderLookerTab(),
                this.activeTab === 'indexing' && this.renderIndexingTab(),
                this.activeTab === 'images' && this.renderImagesTab(postsList, filteredPosts, postsSlice, imgPg, imgTotalPg, sq),
                this.activeTab === 'audit' && this.renderAuditTab(),
                this.activeTab === 'orphans' && this.renderOrphansTab(),
                this.activeTab === 'logs' && this.renderLogsTab(),
                this.activeTab === 'appearance' && renderAppearanceTab(this),
                this.activeTab === 'site' && this.renderSiteTab(),
                this.activeTab === 'redirects' && this.renderRedirectsTab(),
                this.activeTab === 'settings' && this.renderSettingsTab()
            ])
        ]);
    }
}

app.initializers.add('framio-seo-pack', () => {
    (app.registry || app.extensionData)
        .for('framio-seo-pack')
        .registerPage(SeoAdminPage);
});
