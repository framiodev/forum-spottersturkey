import app from 'flarum/admin/app';
import { renderAd } from '../../common/adRender';

const m = window.m;
const api = () => app.forum.attribute('apiUrl') + '/seo/ads';

const LOCATIONS = {
    header_top: 'Sayfa üstü (menünün hemen altı, ilk alan)',
    header_bottom: 'İçerik üstü (sayfa başlığının altı)',
    discussion_top: 'Konu başı (ilk mesajın üstü)',
    discussion_between_posts: 'Mesaj araları (her N mesajda bir)',
    discussion_bottom: 'Konu sonu (yanıt alanının üstü)',
    sidebar: 'Kenar çubuğu (masaüstü)',
    footer: 'Sayfa altı (alt bilgi üstü)',
};
const FORMATS = {
    inline: ['Sayfa içi alan', 'Seçilen konumda, içerikle birlikte akar. En güvenli ve Google politikalarına en uygun biçim.'],
    sticky: ['Yapışkan alt şerit', 'Ekranın altına sabitlenir, kapatılabilir. Mobilde yüksek görünürlük; AdSense "anchor" biçimiyle aynı mantık.'],
    popup: ['Açılır pencere', 'Gecikmeli açılır, kapatılabilir; sıklık sınırıyla aynı ziyaretçiye tekrar tekrar gösterilmez. AdSense birimini açılır pencerede kullanmak Google politikalarına aykırıdır — yalnızca kendi banner / sponsor içeriğiniz için kullanın.'],
};
const TYPES = { adsense: 'Google AdSense birimi', image: 'Görsel banner (sponsor)', custom_code: 'Özel HTML / JavaScript' };
const SCOPES = { all: 'Tüm sayfalar', home: 'Yalnızca ana sayfa / listeler', discussion: 'Yalnızca konu sayfaları', tag: 'Bölüm ve konu sayfaları' };

const blank = () => ({
    id: null, name: '', type: 'adsense', format: 'inline', location: 'discussion_between_posts', page_scope: 'all', tag_slugs: '',
    code: '', adsense_slot: '', adsense_format: 'auto', banner_image_url: '', banner_target_url: '',
    post_interval: 5, delay_seconds: 8, frequency_hours: 24, is_active: true, desktop_visible: true, mobile_visible: true,
    hide_for_members: false, starts_at: '', ends_at: '',
});

export function loadAds(page) {
    page.adState = page.adState || { items: [], loading: false, edit: null, device: 'desktop' };
    page.adState.loading = true;
    return app.request({ method: 'GET', url: api() })
        .then(res => { page.adState.items = res.data || []; page.adState.loading = false; m.redraw(); })
        .catch(() => { page.adState.loading = false; m.redraw(); });
}

function post(page, body) {
    return app.request({ method: 'POST', url: api(), body }).then(res => { loadAds(page); return res; });
}

/** Yönetici formundaki kaydı, forumun aldığı biçime çevirir (önizleme için) */
function toForum(ad) {
    return {
        id: ad.id || 'preview', name: ad.name, location: ad.format === 'inline' ? ad.location : 'floating', type: ad.type, format: ad.format,
        code: ad.code, adsense_slot: ad.adsense_slot, adsense_format: ad.adsense_format,
        image_url: ad.banner_image_url, target_url: ad.banner_target_url,
    };
}

const field = (label, input, help) => m('div.Form-group', [m('label', label), input, help ? m('div.helpText', help) : null]);
const val = (ad, k) => (ad[k] === null || ad[k] === undefined ? '' : ad[k]);
const dateVal = v => (v ? String(v).replace(' ', 'T').slice(0, 16) : '');

/** Sahte forum sayfası; seçilen konumda reklam, diğer konumlar kesik çizgiyle */
function livePreview(page, ad) {
    const st = page.adState;
    const unit = renderAd(toForum(ad), { preview: true, label: app.data.settings['framio-seo.ads_label'] || 'Reklam', client: app.data.settings['framio-seo.ads_client'] });
    const here = loc => ad.format === 'inline' && ad.location === loc;
    const ghost = loc => m('div.FramioAdPreview-slot', { className: here(loc) ? 'is-active' : '', onclick: () => { ad.format = 'inline'; ad.location = loc; } },
        here(loc) ? unit : m('span', LOCATIONS[loc].split(' (')[0]));
    const post = (n) => m('div.FramioAdPreview-post', [m('div.FramioAdPreview-avatar'), m('div', [m('div.FramioAdPreview-line.is-short'), m('div.FramioAdPreview-photo'), m('div.FramioAdPreview-line')]), m('span.FramioAdPreview-num', '#' + n)]);
    const n = Math.max(1, parseInt(ad.post_interval, 10) || 5);
    const posts = [];
    for (let i = 1; i <= Math.min(Math.max(n + 1, 3), 7); i++) {
        posts.push(post(i));
        if (here('discussion_between_posts') && i % n === 0) posts.push(m('div.FramioAdPreview-slot.is-active', unit));
        else if (i === Math.min(n, 3) && !here('discussion_between_posts')) posts.push(ghost('discussion_between_posts'));
    }

    return m('div.FramioAdPreview', { className: 'is-' + st.device }, [
        m('div.FramioAdPreview-toolbar', [
            m('b', 'Canlı önizleme'),
            m('div.ButtonGroup', ['desktop', 'mobile'].map(d => m('button.Button.Button--small', { className: st.device === d ? 'Button--primary' : '', onclick: () => { st.device = d; } }, [m('i', { className: 'fas fa-' + (d === 'desktop' ? 'desktop' : 'mobile-alt') }), d === 'desktop' ? ' Masaüstü' : ' Mobil'])))
        ]),
        m('div.FramioAdPreview-frame', [
            m('div.FramioAdPreview-header', [m('div.FramioAdPreview-logo'), m('div.FramioAdPreview-nav')]),
            ghost('header_top'),
            ghost('header_bottom'),
            m('div.FramioAdPreview-body', [
                m('div.FramioAdPreview-main', [
                    m('div.FramioAdPreview-title'),
                    ghost('discussion_top'),
                    ...posts,
                    ghost('discussion_bottom'),
                    m('div.FramioAdPreview-reply')
                ]),
                st.device === 'desktop' ? m('div.FramioAdPreview-side', [m('div.FramioAdPreview-line'), m('div.FramioAdPreview-line'), ghost('sidebar')]) : null
            ]),
            ghost('footer'),
            ad.format !== 'inline' ? unit : null
        ]),
        m('p.FramioAdPreview-hint', ad.format === 'inline' ? 'Önizlemedeki kesik çizgili alanlara tıklayarak konumu değiştirebilirsiniz. AdSense birimleri önizlemede yer tutucu olarak gösterilir.' : 'Yapışkan şerit ve açılır pencere, sayfanın üzerinde gösterilir.')
    ]);
}

function editor(page) {
    const st = page.adState;
    const ad = st.edit;
    const set = k => e => { ad[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; };
    const client = app.data.settings['framio-seo.ads_client'];

    return m('div.FramioAdEditor', [
        m('div.FramioAdEditor-form', [
            m('h4', ad.id ? 'Reklamı düzenle' : 'Yeni reklam alanı'),
            field('Ad', m('input.FormControl', { value: val(ad, 'name'), placeholder: 'Örn. Konu içi AdSense', oninput: set('name') })),
            field('Biçim', m('div.FramioAdEditor-cards', Object.keys(FORMATS).map(f => m('button.FramioAdEditor-card', {
                className: ad.format === f ? 'is-on' : '', onclick: () => { ad.format = f; if (f === 'popup' && ad.type === 'adsense') ad.type = 'image'; }
            }, [m('b', FORMATS[f][0]), m('span', FORMATS[f][1])])))),
            ad.format === 'inline' ? field('Konum', m('select.FormControl', { value: ad.location, onchange: set('location') }, Object.keys(LOCATIONS).map(k => m('option', { value: k }, LOCATIONS[k])))) : null,
            ad.format === 'inline' && ad.location === 'discussion_between_posts' ? field('Kaç mesajda bir', m('input.FormControl', { type: 'number', min: 1, value: val(ad, 'post_interval'), oninput: set('post_interval') }), 'Google, içerikten fazla reklam olan sayfaları cezalandırır; 4–6 önerilir.') : null,
            field('Reklam türü', m('select.FormControl', { value: ad.type, onchange: set('type') }, Object.keys(TYPES).map(k => m('option', { value: k, disabled: k === 'adsense' && ad.format === 'popup' }, TYPES[k])))),

            ad.type === 'adsense' ? [
                !client ? m('div.Alert.Alert--warning', { style: 'margin-bottom:12px' }, 'Önce aşağıdaki "Genel ayarlar" bölümüne AdSense yayıncı kimliğinizi (ca-pub-…) girin.') : null,
                field('Reklam birimi (data-ad-slot)', m('input.FormControl', { value: val(ad, 'adsense_slot'), placeholder: '1234567890', oninput: set('adsense_slot') }), 'AdSense → Reklamlar → Reklam birimine göre → birim oluşturun; koddaki data-ad-slot numarasını yapıştırın.'),
                field('Birim boyutu', m('select.FormControl', { value: ad.adsense_format, onchange: set('adsense_format') }, [
                    m('option', { value: 'auto' }, 'Duyarlı (önerilen)'), m('option', { value: 'horizontal' }, 'Yatay'), m('option', { value: 'rectangle' }, 'Dikdörtgen'), m('option', { value: 'vertical' }, 'Dikey'), m('option', { value: 'fluid' }, 'Akışkan (yazı içi)')
                ]))
            ] : null,
            ad.type === 'image' ? [
                field('Görsel adresi', m('input.FormControl', { value: val(ad, 'banner_image_url'), placeholder: 'https://…/banner.webp', oninput: set('banner_image_url') }), 'Önerilen: masaüstü 728×90 veya 970×250, mobil 320×100; açılır pencere için 600×600.'),
                field('Hedef bağlantı', m('input.FormControl', { value: val(ad, 'banner_target_url'), placeholder: 'https://sponsor.com', oninput: set('banner_target_url') }), 'Bağlantılar otomatik olarak rel="sponsored nofollow" alır (Google kuralı).')
            ] : null,
            ad.type === 'custom_code' ? field('HTML / JavaScript', m('textarea.FormControl', { rows: 6, value: val(ad, 'code'), oninput: set('code'), style: 'font-family:monospace; font-size:12px' }), 'Önizlemede betikler çalıştırılmaz; forumda çalışır.') : null,

            ad.format !== 'inline' ? m('div.FramioAdEditor-row', [
                ad.format === 'popup' ? field('Gecikme (sn)', m('input.FormControl', { type: 'number', min: 0, value: val(ad, 'delay_seconds'), oninput: set('delay_seconds') })) : null,
                field('Kapatınca tekrar gösterme (saat)', m('input.FormControl', { type: 'number', min: 0, value: val(ad, 'frequency_hours'), oninput: set('frequency_hours') }))
            ]) : null,

            m('details.FramioAdEditor-more', [
                m('summary', 'Hedefleme ve zamanlama'),
                field('Sayfalar', m('select.FormControl', { value: ad.page_scope, onchange: set('page_scope') }, Object.keys(SCOPES).map(k => m('option', { value: k }, SCOPES[k])))),
                field('Yalnızca bu bölümlerde', m('input.FormControl', { value: val(ad, 'tag_slugs'), placeholder: 'setra-otobus-guncel, man-tir-arsiv', oninput: set('tag_slugs') }), 'Bölüm kısa adları, virgülle. Boşsa her bölümde.'),
                m('div.FramioAdEditor-row', [
                    field('Başlangıç', m('input.FormControl', { type: 'datetime-local', value: dateVal(ad.starts_at), oninput: set('starts_at') })),
                    field('Bitiş', m('input.FormControl', { type: 'datetime-local', value: dateVal(ad.ends_at), oninput: set('ends_at') }))
                ]),
                m('div.FramioAdEditor-checks', [
                    ['desktop_visible', 'Masaüstünde göster'], ['mobile_visible', 'Mobilde göster'], ['hide_for_members', 'Giriş yapmış üyelere gösterme'], ['is_active', 'Yayında']
                ].map(([k, l]) => m('label', [m('input', { type: 'checkbox', checked: !!ad[k], onchange: set(k) }), ' ', l])))
            ]),

            m('div.FramioAdEditor-actions', [
                m('button.Button.Button--primary', {
                    onclick: () => post(page, Object.assign({ action: 'save' }, ad)).then(() => { st.edit = null; app.alerts.show({ type: 'success' }, 'Reklam kaydedildi.'); })
                }, 'Kaydet'),
                m('button.Button', { onclick: () => { st.edit = null; } }, 'Vazgeç')
            ])
        ]),
        livePreview(page, ad)
    ]);
}

function stats(items) {
    const imp = items.reduce((s, a) => s + (a.impressions_count || 0), 0);
    const clk = items.reduce((s, a) => s + (a.clicks_count || 0), 0);
    return [
        ['Yayındaki alan', items.filter(a => a.is_live).length + ' / ' + items.length, 'ad'],
        ['Gösterim', imp.toLocaleString('tr'), 'eye'],
        ['Tıklama', clk.toLocaleString('tr'), 'mouse-pointer'],
        ['Tıklama oranı', imp ? (100 * clk / imp).toFixed(2) + '%' : '—', 'percent']
    ];
}

function generalSettings(page) {
    const client = page.setting('framio-seo.ads_client')() || '';
    const valid = /^ca-pub-\d{10,}$/.test(client.trim());
    const base = (app.forum.attribute('baseUrl') || '').replace(/\/$/, '');

    return page.seoBox('Genel ayarlar & Google AdSense', [
        page.seoToggle('ads_enabled', 'Reklamlar sitede gösterilsin', '0', 'Kapalıyken hiçbir reklam ve AdSense betiği yüklenmez.'),
        page.seoField('ads_client', 'AdSense yayıncı kimliği', { placeholder: 'ca-pub-1234567890123456', help: valid || !client ? 'AdSense → Hesap → Hesap bilgileri → Yayıncı kimliği. "ca-pub-" ile başlar.' : '⚠ Biçim "ca-pub-" + 16 rakam olmalı.' }),
        page.seoToggle('ads_auto_ads', 'Otomatik reklamlar (Auto ads)', '0', 'Google sayfaları tarar ve uygun yerlere kendisi reklam yerleştirir (yapışkan şerit ve vinyet dahil). Yerleşimleri AdSense panelinden yönetirsiniz; yukarıdaki elle eklenen alanlarla birlikte çalışır.'),
        page.seoToggle('ads_hide_members', 'Giriş yapmış üyelere hiç reklam gösterme', '0', 'Aktif topluluğu rahatsız etmeden gelir: reklamlar yalnızca arama motorundan gelen ziyaretçilere gösterilir.'),
        page.seoField('ads_label', 'Reklam etiketi', { placeholder: 'Reklam', help: 'Birimlerin üstünde görünür. Google, reklamların içerikten ayırt edilebilmesini ister; "Reklam" veya "Sponsorlu" önerilir.' }),
        page.seoField('ads_txt_extra', 'ads.txt ek satırları', { textarea: true, placeholder: 'ornekagi.com, 12345, RESELLER', help: 'AdSense satırı yayıncı kimliğinden otomatik üretilir. Başka reklam ağı kullanırsanız satırlarını ekleyin.' }),
        m('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;' }, [
            m('a.Button.Button--small', { href: base + '/ads.txt', target: '_blank' }, [m('i.fas.fa-file-alt'), ' ads.txt dosyasını aç']),
            m('a.Button.Button--small', { href: 'https://www.google.com/adsense/', target: '_blank', rel: 'noopener' }, [m('i.fab.fa-google'), ' AdSense paneli'])
        ]),
        m('button.Button.Button--primary', { disabled: page.isSaving, onclick: e => page.save(e) }, page.isSaving ? 'Kaydediliyor…' : 'Genel ayarları kaydet')
    ]);
}

export function renderAdsTab(page) {
    const st = page.adState;
    if (!st) { loadAds(page); return m('div.SeoCard', 'Yükleniyor…'); }
    const items = st.items || [];

    return m('div.FramioAds', [
        m('div.FramioAds-stats', stats(items).map(([l, v, i]) => m('div.FramioAds-stat', [m('i', { className: 'fas fa-' + i }), m('div', [m('span', l), m('b', v)])]))),

        st.edit ? editor(page) : m('div.SeoCard', [
            m('div.FramioAds-head', [
                m('div', [m('h3', 'Reklam alanları'), m('p', 'AdSense birimleri, sponsor bannerları ve özel kodlar. Her alan için konum, biçim, cihaz, bölüm ve tarih hedeflemesi.')]),
                m('button.Button.Button--primary', { onclick: () => { st.edit = blank(); } }, [m('i.fas.fa-plus'), ' Yeni reklam alanı'])
            ]),
            st.loading ? m('p', 'Yükleniyor…') : items.length ? m('table.FramioAds-table', [
                m('thead', m('tr', ['', 'Ad', 'Biçim / konum', 'Tür', 'Gösterim', 'Tıklama', 'TO', ''].map(h => m('th', h)))),
                m('tbody', items.map(ad => m('tr', { key: ad.id, className: ad.is_live ? '' : 'is-off' }, [
                    m('td', m('span.FramioAds-dot', { className: ad.is_live ? 'is-on' : '', title: ad.is_live ? 'Yayında' : (ad.is_active ? 'Tarih aralığı dışında' : 'Kapalı') })),
                    m('td', m('b', ad.name)),
                    m('td', (FORMATS[ad.format || 'inline'] || FORMATS.inline)[0] + (ad.format === 'inline' || !ad.format ? ' · ' + (LOCATIONS[ad.location] || ad.location).split(' (')[0] : '')),
                    m('td', TYPES[ad.type] || ad.type),
                    m('td', (ad.impressions_count || 0).toLocaleString('tr')),
                    m('td', (ad.clicks_count || 0).toLocaleString('tr')),
                    m('td', ad.impressions_count ? (100 * ad.clicks_count / ad.impressions_count).toFixed(2) + '%' : '—'),
                    m('td.FramioAds-actions', [
                        m('button.Button.Button--small', { onclick: () => post(page, { action: 'toggle', id: ad.id }) }, ad.is_active ? 'Durdur' : 'Başlat'),
                        m('button.Button.Button--small', { onclick: () => { st.edit = Object.assign(blank(), ad, { tag_slugs: ad.tag_slugs || '', code: ad.code || '' }); } }, 'Düzenle'),
                        m('button.Button.Button--small.Button--danger', { onclick: () => { if (confirm('"' + ad.name + '" silinsin mi?')) post(page, { action: 'delete', id: ad.id }); } }, m('i.fas.fa-trash'))
                    ])
                ])))
            ]) : m('div.FramioAds-empty', [m('i.fas.fa-ad'), m('p', 'Henüz reklam alanı yok.'), m('p', 'Önerilen başlangıç: konu içinde her 5 mesajda bir duyarlı AdSense birimi + mobilde yapışkan alt şerit.')])
        ]),

        generalSettings(page),

        page.seoBox('Gelir için öneriler', [
            m('ul.FramioAds-tips', [
                m('li', 'AdSense onayı için sitede gizlilik politikası ve iletişim sayfası bulunmalı; içerik özgün olmalı (fotoğraf forumları için avantaj).'),
                m('li', 'En verimli yerleşim fotoğraf forumlarında konu içi mesaj araları ve mobil yapışkan alt şerittir. Sayfa başına 3–4 birimi geçmeyin.'),
                m('li', 'Avrupa (AEA/Birleşik Krallık) ziyaretçileri için Google onaylı çerez onay penceresi (CMP) gerekir: AdSense → Gizlilik ve mesajlar bölümünden ücretsiz açılır.'),
                m('li', 'Reklamlar sayfa yüklendikten sonra eklenir; sunucunun ürettiği içerik ve yapılandırılmış veri değişmez. Yine de çok sayıda birim sayfa hızını düşürür; Search Console\'daki Önemli Web Verileri raporunu izleyin.')
            ])
        ])
    ]);
}
