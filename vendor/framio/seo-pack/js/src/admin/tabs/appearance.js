import app from 'flarum/admin/app';

const m = window.m;

/**
 * "Arama Görünümü & Site Bağlantıları" sekmesi.
 * Google sonuç önizlemesi, site adı / alternatif adlar, iç sayfa başlık soneki, bölüm (etiket) bazında
 * başlık-açıklama ve öne çıkan bölümler. Tüm değerler framio-seo.* ayarlarında tutulur.
 */
export function loadAppearance(page) {
    page.appearance = page.appearance || { loading: false, data: null, filter: 'all', q: '' };
    page.appearance.loading = true;
    m.redraw();

    return app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/seo/search-appearance' })
        .then(res => { page.appearance.data = res; page.appearance.loading = false; m.redraw(); })
        .catch(() => { page.appearance.loading = false; m.redraw(); });
}

const ellipsis = (s, n) => (s || '').length > n ? s.slice(0, n - 1).trimEnd() + '…' : (s || '');

function fill(tpl, vars) {
    return (tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : '')).replace(/\s+/g, ' ').trim();
}

function overrides(page) {
    try {
        const v = JSON.parse(page.setting('framio-seo.tag_seo_overrides')() || '{}');
        return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (e) {
        return {};
    }
}

function setOverride(page, slug, field, value) {
    const all = overrides(page);
    all[slug] = Object.assign({}, all[slug] || {}, { [field]: value });
    if (!all[slug].title && !all[slug].description && !all[slug].short) delete all[slug];
    page.setting('framio-seo.tag_seo_overrides')(JSON.stringify(all));
}

function featuredList(page) {
    return (page.setting('framio-seo.featured_sections')() || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
}

function setFeatured(page, list) {
    page.setting('framio-seo.featured_sections')(list.join(', '));
}

/** Ayarlar kaydedilmeden önce de doğru görünmesi için başlığı istemcide yeniden hesaplar */
function computeSection(page, s, home) {
    const ov = overrides(page)[s.slug] || {};
    const all = overrides(page);
    const parent = s.parent_slug ? (((all[s.parent_slug] || {}).short || '').trim() || s.parent) : '';
    const vars = { tag: s.name, parent, site_name: home.site_name };
    const tpl = (ov.title || '').trim() || (page.setting('framio-seo.tag_title_template')() || '').trim();
    let title = tpl ? fill(tpl, vars) : s.name;
    title = title.replace(/\s*[-–|·]\s*$/, '') || s.name;
    const suffix = (page.setting('framio-seo.title_suffix')() || '').trim() || home.title;
    const desc = fill(ov.description || '', vars) || s.tag_description;

    return { title, full: title + ' - ' + suffix, desc };
}

/** Google masaüstü sonuç kartı taklidi */
function serpCard(url, title, desc, opts = {}) {
    const u = (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const parts = u.split('/');
    const crumb = parts[0] + (parts.length > 1 ? ' › ' + parts.slice(1).join(' › ') : '');

    return m('div.FramioSerp', [
        m('div.FramioSerp-site', [
            opts.logo ? m('img.FramioSerp-fav', { src: opts.logo, alt: '' }) : m('span.FramioSerp-fav'),
            m('div', [m('div.FramioSerp-name', opts.siteName || ''), m('div.FramioSerp-url', crumb)])
        ]),
        m('div.FramioSerp-title', ellipsis(title, 62)),
        m('div.FramioSerp-desc', ellipsis(desc, 158) || m('i', { style: 'color:#b45309' }, 'Açıklama yok — Google sayfadan rastgele metin seçer.')),
        opts.sitelinks && opts.sitelinks.length ? m('div.FramioSerp-links', opts.sitelinks.map(l => m('div.FramioSerp-link', [
            m('div.FramioSerp-linkTitle', ellipsis(l.title, 40)),
            m('div.FramioSerp-linkDesc', ellipsis(l.desc, 90))
        ]))) : null
    ]);
}

export function renderAppearanceTab(page) {
    const st = page.appearance || {};
    if (!st.data) {
        return m('div.SeoCard', st.loading ? m('p', 'Bölümler yükleniyor…') : m('button.Button', { onclick: () => loadAppearance(page) }, 'Yükle'));
    }

    const { home, sections } = st.data;
    const featured = featuredList(page);
    const bySlug = {};
    sections.forEach(s => { bySlug[s.slug] = s; });

    const computed = sections.map(s => Object.assign({}, s, computeSection(page, s, home)));
    const counts = {};
    computed.forEach(s => { const k = s.full.toLowerCase(); counts[k] = (counts[k] || 0) + 1; });
    computed.forEach(s => {
        s.dup = counts[s.full.toLowerCase()] > 1;
        s.long = s.full.length > 60;
        s.shortDesc = (s.desc || '').length < 70;
    });

    const dupCount = computed.filter(s => s.dup && !s.hidden).length;
    const longCount = computed.filter(s => s.long && !s.hidden).length;
    const noDesc = computed.filter(s => s.shortDesc && !s.hidden).length;

    const q = (st.q || '').toLocaleLowerCase('tr');
    const list = computed.filter(s => {
        if (st.filter === 'dup' && !s.dup) return false;
        if (st.filter === 'long' && !s.long) return false;
        if (st.filter === 'desc' && !s.shortDesc) return false;
        if (st.filter === 'featured' && !featured.includes(s.slug)) return false;
        return !q || (s.name + ' ' + (s.parent || '') + ' ' + s.slug).toLocaleLowerCase('tr').includes(q);
    });

    const sitelinks = featured.map(slug => computed.find(s => s.slug === slug)).filter(Boolean).slice(0, 6)
        .map(s => ({ title: s.title, desc: s.desc }));

    const siteName = (page.setting('framio-seo.org_name')() || '').trim() || home.site_name;
    const alt = page.setting('framio-seo.site_alternate_names')() || '';

    return m('div.SeoCard.FramioAppearance', [
        m('h3', { style: 'margin-top:0; color:#1e88e5;' }, 'Arama Görünümü & Site Bağlantıları'),
        m('p.FramioAppearance-lead', 'Sitenin Google sonuçlarında nasıl göründüğünü yönetin. Alt bağlantıları (sitelinks) Google kendisi seçer; ama her bölümün benzersiz başlığı ve açıklaması olması, ana sayfadan taranabilir bağlantı alması ve marka aramasında sitenin ilk sırada çıkması onları tetikleyen etkenlerdir.'),

        m('div.FramioAppearance-stats', [
            [dupCount, 'Aynı başlıklı bölüm', dupCount ? 'bad' : 'ok', 'dup'],
            [longCount, '60 karakteri aşan başlık', longCount ? 'warn' : 'ok', 'long'],
            [noDesc, 'Açıklaması kısa/eksik', noDesc ? 'warn' : 'ok', 'desc'],
            [featured.length, 'Öne çıkan bölüm', featured.length ? 'ok' : 'warn', 'featured']
        ].map(([n, label, tone, f]) => m('button.FramioAppearance-stat', {
            className: 'is-' + tone + (st.filter === f ? ' is-active' : ''),
            onclick: () => { st.filter = st.filter === f ? 'all' : f; }
        }, [m('b', n), m('span', label)]))),

        m('div.FramioAppearance-grid', [
            m('div', [
                page.seoBox('Google önizlemesi — marka araması', [
                    serpCard(home.url, home.title, home.description, { logo: home.logo, siteName, sitelinks }),
                    m('p.FramioAppearance-note', sitelinks.length
                        ? 'Alt bağlantılar öne çıkan bölümlerden temsilîdir; Google kendi seçimini yapar.'
                        : 'Aşağıdaki listeden ★ ile en fazla 6 bölümü öne çıkarın.')
                ]),
                page.seoBox('Site adı & başlık', [
                    page.seoField('site_alternate_names', 'Alternatif site adları', {
                        placeholder: 'Spotters TR, SpottersTurkey',
                        help: 'Virgülle ayırın. WebSite şemasında alternateName olarak bildirilir; Google sonuçta site adını gösterirken bunları da tanır.'
                    }),
                    page.seoField('title_suffix', 'İç sayfa başlık soneki', {
                        placeholder: home.title,
                        help: 'Konu, bölüm ve profil başlıklarının sonuna eklenir. Google ~60 karakterden sonrasını keser; kısa bir sonek (ör. "' + siteName + '") başlığın asıl kısmını görünür bırakır. Boşsa forum başlığı kullanılır; ana sayfa her zaman forum başlığını kullanır.'
                    }),
                    page.seoField('tag_title_template', 'Bölüm başlık şablonu', {
                        placeholder: '{tag} {parent}',
                        help: 'Değişkenler: {tag} {parent} {site_name}. Örn. "{tag} – {parent}" ile "Setra – Güncel Otobüs Fotoğrafları" ve "Setra – Otobüs Fotoğrafları Arşivi" ayrışır. Boşsa yalnızca bölüm adı kullanılır.'
                    })
                ])
            ]),
            m('div', [
                page.seoBox('Kontrol listesi', [
                    m('ul.FramioAppearance-checks', [
                        [!!home.logo, 'Logo tanımlı (Organization şeması)'],
                        [(home.social || []).length > 0, 'Sosyal profiller bağlı (sameAs)'],
                        [alt.trim() !== '', 'Alternatif site adı tanımlı'],
                        [dupCount === 0, 'Tüm bölüm başlıkları benzersiz'],
                        [longCount === 0, 'Bölüm başlıkları 60 karakterin altında'],
                        [featured.length >= 4, 'En az 4 öne çıkan bölüm'],
                        [(home.description || '').length >= 70, 'Ana sayfa açıklaması yeterli uzunlukta']
                    ].map(([ok, text]) => m('li', { className: ok ? 'is-ok' : 'is-bad' }, [m('i.fas', { className: ok ? 'fa-check-circle' : 'fa-exclamation-circle' }), ' ', text]))),
                    m('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;' }, [
                        m('a.Button.Button--small', { href: 'https://search.google.com/test/rich-results?url=' + encodeURIComponent(home.url), target: '_blank', rel: 'noopener' }, 'Zengin Sonuç Testi'),
                        m('a.Button.Button--small', { href: 'https://www.google.com/search?q=' + encodeURIComponent(siteName), target: '_blank', rel: 'noopener' }, 'Google\'da marka araması'),
                        m('a.Button.Button--small', { href: 'https://www.google.com/search?q=site:' + encodeURIComponent(home.url.replace(/^https?:\/\//, '').replace(/\/$/, '')), target: '_blank', rel: 'noopener' }, 'site: araması')
                    ])
                ])
            ])
        ]),

        page.seoBox('Bölümler (' + list.length + ' / ' + computed.length + ')', [
            m('div.FramioAppearance-toolbar', [
                m('input.FormControl', { placeholder: 'Bölüm ara…', value: st.q || '', oninput: e => { st.q = e.target.value; } }),
                st.filter !== 'all' ? m('button.Button.Button--small', { onclick: () => { st.filter = 'all'; } }, 'Filtreyi kaldır') : null
            ]),
            m('div.FramioAppearance-list', list.map(s => {
                const ov = overrides(page)[s.slug] || {};
                const isFeat = featured.includes(s.slug);
                const open = st.open === s.slug;
                return m('div.FramioAppearance-row', { key: s.slug, className: (s.hidden ? 'is-hidden ' : '') + (open ? 'is-open' : '') }, [
                    m('div.FramioAppearance-rowHead', [
                        m('button.FramioAppearance-star', {
                            className: isFeat ? 'is-on' : '',
                            title: isFeat ? 'Öne çıkanlardan çıkar' : 'Öne çıkar',
                            disabled: s.hidden || s.restricted,
                            onclick: () => setFeatured(page, isFeat ? featured.filter(x => x !== s.slug) : featured.concat(s.slug))
                        }, m('i', { className: isFeat ? 'fas fa-star' : 'far fa-star' })),
                        m('div.FramioAppearance-rowMain', { onclick: () => { st.open = open ? null : s.slug; } }, [
                            m('div.FramioAppearance-rowTitle', [
                                s.full,
                                s.dup ? m('span.FramioBadge.is-bad', 'Aynı başlık') : null,
                                s.long ? m('span.FramioBadge.is-warn', s.full.length + ' karakter') : null,
                                s.shortDesc ? m('span.FramioBadge.is-warn', 'Açıklama kısa') : null,
                                s.hidden ? m('span.FramioBadge', 'Gizli') : null,
                                s.restricted ? m('span.FramioBadge', 'Kısıtlı') : null
                            ]),
                            m('div.FramioAppearance-rowMeta', (s.parent ? s.parent + ' › ' : '') + s.name + ' · /t/' + s.slug + ' · ' + s.discussions + ' konu')
                        ]),
                        m('a.Button.Button--icon.Button--link', { href: s.url, target: '_blank', rel: 'noopener', title: 'Sayfayı aç' }, m('i.fas.fa-external-link-alt'))
                    ]),
                    open ? m('div.FramioAppearance-edit', [
                        serpCard(s.url, s.full, s.desc, { logo: home.logo, siteName }),
                        m('div.Form-group', [
                            m('label', 'SEO başlığı (bu bölüme özel)'),
                            m('input.FormControl', {
                                placeholder: s.title,
                                value: ov.title || '',
                                oninput: e => setOverride(page, s.slug, 'title', e.target.value)
                            }),
                            m('div.helpText', 'Boşsa şablon ya da bölüm adı kullanılır. Değişkenler: {tag} {parent} {site_name}. Sonek otomatik eklenir.')
                        ]),
                        m('div.Form-group', [
                            m('label', 'Kısa ad (alt bölüm başlıklarında {parent} yerine)'),
                            m('input.FormControl', {
                                placeholder: s.name,
                                value: ov.short || '',
                                oninput: e => setOverride(page, s.slug, 'short', e.target.value)
                            }),
                            m('div.helpText', 'Örn. "Güncel Çekici, TIR, Kamyon Fotoğrafları ve Haberler" yerine "Güncel TIR & Kamyon". Bu bölümün altındaki tüm bölümlerin başlığı kısalır.')
                        ]),
                        m('div.Form-group', [
                            m('label', 'Meta açıklama (bu bölüme özel)'),
                            m('textarea.FormControl', {
                                rows: 3,
                                placeholder: s.tag_description || 'Bölümde neler olduğunu 120–155 karakterde anlatın.',
                                value: ov.description || '',
                                oninput: e => setOverride(page, s.slug, 'description', e.target.value)
                            }),
                            m('div.helpText', (s.desc || '').length + ' karakter · Boşsa etiketin kendi açıklaması kullanılır.')
                        ])
                    ]) : null
                ]);
            }))
        ]),

        m('div.Form-group', { style: 'margin-top:20px;' }, [
            m('button.Button.Button--primary', { disabled: page.isSaving, onclick: e => page.save(e).then(() => loadAppearance(page)) }, page.isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet')
        ])
    ]);
}
