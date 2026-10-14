import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import app from 'flarum/admin/app';
import saveSettings from 'flarum/admin/utils/saveSettings';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Select from 'flarum/common/components/Select';
import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';
const icon = (iconName, attrs = {}) => { attrs.className = (attrs.className || "") + " icon " + iconName; return m("i", attrs); }; 
import HeroSlider from '../../forum/components/HeroSlider'; 
import MenuManager from './MenuManager';
import PageHeroes from './PageHeroes';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// sekme anahtarı → [ikon, ad, kısa açıklama]
const TABS = {
    general: ['fas fa-sliders-h', 'Genel & Metinler', 'Site adı ve ziyaretçiye gösterilen metinler'],
    pages: ['fas fa-heading', 'Akış & Galeri Sayfaları', 'Akış ve Galeri sayfalarının üstündeki başlık alanı'],
    menu: ['fas fa-bars', 'Menü Yöneticisi', 'Ana menü öğeleri: sıra, ad, ikon ve görünürlük (yatay / dikey)'],
    slider: ['fas fa-th-large', 'Hero Grid / Slider', 'Ana sayfanın üstündeki büyük fotoğraf ızgarası'],
    categories: ['fas fa-tags', 'Kategori Kartları', 'Ana sayfadaki kategori kartlarının düzeni ve kapakları'],
    gallery: ['fas fa-images', 'Ana Galeri & Lightbox', '"Son Eklenenler" galerisi ve tıklama davranışı'],
    categoryGallery: ['fas fa-folder-open', 'Kategori İçi Galeri', 'Kategorilerdeki "Fotoğraflar" sekmesi ve istisnalar'],
    covers: ['fas fa-crown', 'Kapak Görselleri', 'Çok fotoğraflı mesajlarda galeride gösterilecek kapak'],
    performance: ['fas fa-bolt', 'Performans & Önbellek', 'Galeri boyutu ve ziyaretçi önbelleği'],
};

export default class CustomHomepageSettingsPage extends ExtensionPage {
    // Kaydet çubuğu için "gerçek değişiklik" takibi: varsayılan değerle ilk
    // açılan ayarlar değişiklik sayılmasın
    setting(key, fallback = '') {
        const s = super.setting(key, fallback);
        this.initialValues = this.initialValues || {};
        if (!(key in this.initialValues)) this.initialValues[key] = s();
        return s;
    }

    isChanged() {
        const init = this.initialValues || {};
        return Object.keys(init).some((k) => this.settings[k] && this.settings[k]() !== init[k]);
    }

    onsaved() {
        super.onsaved();
        Object.keys(this.initialValues || {}).forEach((k) => (this.initialValues[k] = this.settings[k]()));
    }

    // ───────────── Ortak görünüm parçaları (bütün sekmeler aynı yapıyı kullanır)

    /** Başlıklı kart; right: başlığın sağındaki öğe (ör. aç/kapat) */
    card(iconName, title, desc, body, right) {
        return (
            <section className="CHS-Card">
                <header className="CHS-Card-Head">
                    <div className="CHS-Card-Icon"><i className={iconName}></i></div>
                    <div className="CHS-Card-Titles">
                        <h3>{title}</h3>
                        {desc ? <p>{desc}</p> : null}
                    </div>
                    {right ? <div className="CHS-Card-Right">{right}</div> : null}
                </header>
                {body ? <div className="CHS-Card-Body">{body}</div> : null}
            </section>
        );
    }

    /** Etiket solda, açıklama altında, kontrol sağda */
    row(label, help, control) {
        return (
            <div className="CHS-Row">
                <div className="CHS-Row-Label">
                    <strong>{label}</strong>
                    {help ? <small>{help}</small> : null}
                </div>
                <div className="CHS-Row-Control">{control}</div>
            </div>
        );
    }

    /** Kart genişliği ayarı: "kaç kart görünsün" seçimine çevrilir (değer yine calc olarak saklanır) */
    cardCountControl() {
        const s = this.setting("framio-custom-homepage.tag_carousel_width", "calc((100% - 40px) / 3)");
        const calcFor = (n) => "calc((100% - " + (n - 1) * 20 + "px) / " + n + ")";
        const counts = [1, 2, 3, 4, 5, 6];
        const current = counts.find((n) => calcFor(n) === s()) || (this.customCardWidth ? "custom" : (s() ? "custom" : 3));
        return (
            <div style={{ display: "flex", gap: "8px", width: "100%", maxWidth: "360px" }}>
                {Select.component({
                    options: { 1: "1 kart", 2: "2 kart", 3: "3 kart (önerilen)", 4: "4 kart", 5: "5 kart", 6: "6 kart", custom: "Özel genişlik" },
                    value: String(current),
                    onchange: (v) => { this.customCardWidth = v === "custom"; if (v !== "custom") s(calcFor(Number(v))); m.redraw(); },
                })}
                {current === "custom" ? <input className="FormControl" style={{ maxWidth: "140px" }} placeholder="örn. 300px" value={s()} oninput={(e) => s(e.target.value)} /> : null}
            </div>
        );
    }

    toggle(key, def = '1') {
        const s = this.setting('framio-custom-homepage.' + key, def);
        return <Switch state={s() === '1'} onchange={(v) => s(v ? '1' : '0')}></Switch>;
    }

    select(key, options, def) {
        const s = this.setting('framio-custom-homepage.' + key);
        return Select.component({ options, value: s() || def, onchange: (v) => { s(v); m.redraw(); } });
    }

    input(key, placeholder, attrs = {}) {
        const s = this.setting('framio-custom-homepage.' + key);
        return <input className="FormControl" placeholder={placeholder} value={s() || ''} oninput={(e) => s(e.target.value)} {...attrs} />;
    }

    oninit(vnode) {
        super.oninit(vnode);
        this.loading = true;
        this.posts = [];
        this.included = [];
        this.expandedPostId = null;
        this.draggedItemIndex = null;
        
        this.activeTab = 'general';
        this.imagePage = 1;
        this.tagImagePage = 1; 
        this.pickingTagId = null; 
        
        this.uploadingTagId = null;
        this.expandedTagSettings = null; 
        
        app.store.find('tags').then(() => m.redraw());
        this.loadPosts();
    }

    getSliderData() {
        let data = [];
        try {
            data = JSON.parse(this.setting('framio-custom-homepage.slider_data')() || '[]');
            if (!Array.isArray(data)) data = [];
        } catch(e) {}
        return data;
    }

    saveSliderData(data) {
        this.setting('framio-custom-homepage.slider_data')(JSON.stringify(data));
    }

    getTagOverrides() {
        let data = {};
        try { data = JSON.parse(this.setting('framio-custom-homepage.tag_gallery_overrides')() || '{}'); } catch(e) {}
        return data;
    }

    updateTagOverride(tagSlug, key, value) {
        const overrides = this.getTagOverrides();
        if (!overrides[tagSlug]) {
            overrides[tagSlug] = { override_active: '0', gallery_active: '1', default_sort: 'gallery', other_tabs_active: '1', position: 'top' };
        }
        overrides[tagSlug][key] = value;
        this.setting('framio-custom-homepage.tag_gallery_overrides')(JSON.stringify(overrides));
    }

    addSlide() {
        const data = this.getSliderData();
        if (data.length < 16) {
            data.push({ url: '', discussionId: null, postNumber: null });
            this.saveSliderData(data);
        } else {
            app.alerts.show({ type: 'error' }, 'Maksimum 16 görsel ekleyebilirsiniz.');
        }
    }

    addSlideFromUrl(imgObj) {
        const data = this.getSliderData();
        if (data.length < 16) {
            const newSlide = typeof imgObj === 'string' 
                ? { url: imgObj, discussionId: null, postNumber: null } 
                : { url: imgObj.url, discussionId: imgObj.discussionId, postNumber: imgObj.postNumber };
                
            data.push(newSlide);
            this.saveSliderData(data);
            app.alerts.show({ type: 'success' }, 'Görsel slidera eklendi.');
            m.redraw();
        } else {
            app.alerts.show({ type: 'error' }, 'Maksimum 16 görsel ekleyebilirsiniz.');
        }
    }

    removeSlide(index) {
        const data = this.getSliderData();
        data.splice(index, 1);
        this.saveSliderData(data);
    }

    updateSlideData(index, field, value) {
        const data = this.getSliderData();
        data[index][field] = value;
        this.saveSliderData(data);
    }

    onDragStart(e, index) {
        this.draggedItemIndex = index;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => { if (e.target) e.target.classList.add('dragging-item'); }, 0);
    }

    onDragEnd(e) {
        if (e.target) e.target.classList.remove('dragging-item');
        this.draggedItemIndex = null;
    }

    onDragOver(e, index) {
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move';
    }

    onDrop(e, index) {
        e.preventDefault();
        if (this.draggedItemIndex === null || this.draggedItemIndex === index) return;
        const data = this.getSliderData();
        const draggedItem = data.splice(this.draggedItemIndex, 1)[0];
        data.splice(index, 0, draggedItem);
        this.saveSliderData(data);
        this.draggedItemIndex = null;
        m.redraw();
    }

    loadPosts() {
        app.request({
            method: 'GET',
            url: app.forum.attribute('apiUrl') + '/framio/homepage-posts',
        }).then(response => {
            this.posts = response.data || [];
            this.included = response.included || [];
            this.loading = false;
            m.redraw();
        }).catch(error => {
            console.error(error);
            this.loading = false;
            m.redraw();
        });
    }

    extractImages(htmlContent, rawContent) {
        const images = [];
        const htmlToScan = htmlContent || '';
        const textToScan = rawContent || htmlToScan;
        
        const shouldInclude = (url) => {
            if (url.includes('firebasestorage') && !url.includes('thumb')) return false;
            return true;
        };

        const addImage = (rawUrl) => {
            let cleanUrl = rawUrl;
            try {
                let decodedUrl = decodeURI(rawUrl);
                cleanUrl = encodeURI(decodedUrl).replace(/\(/g, '%28').replace(/\)/g, '%29');
            } catch (e) {}
            
            if (!images.includes(cleanUrl) && shouldInclude(cleanUrl)) {
                images.push(cleanUrl);
            }
        };

        const imgRegex = /<img[^>]+src="([^">]+)"/g;
        let match;
        while ((match = imgRegex.exec(htmlToScan)) !== null) addImage(match[1]);

        const spotterRegex = /\[spotter-image[^\]]+url="([^"]+)"/g;
        while ((match = spotterRegex.exec(textToScan)) !== null) addImage(match[1]);

        return images;
    }

    getRecentImages() {
        let recentImages = [];
        this.posts.forEach(post => {
            const attributes = post.attributes || {};
            const discussionId = post.relationships?.discussion?.data?.id;
            const postNumber = attributes.number; // Mesaj Numarasını (Örn: 82) alıyoruz.
            const images = this.extractImages(attributes.contentHtml, attributes.content);
            
            images.forEach(imgUrl => {
                if (!recentImages.some(r => r.url === imgUrl)) {
                    recentImages.push({ 
                        url: imgUrl, 
                        discussionId: discussionId,
                        postNumber: postNumber 
                    });
                }
            });
        });
        return recentImages;
    }

    togglePost(postId) {
        this.expandedPostId = postId;
    }

    getCovers() {
        let covers = {};
        try {
            covers = JSON.parse(this.setting('framio-custom-homepage.cover_overrides')() || '{}');
            if (Array.isArray(covers)) covers = {};
        } catch(e) {}
        return covers;
    }

    setCoverImage(postId, imageUrl, e) {
        if (e) e.stopPropagation();
        
        const covers = this.getCovers();
        covers[postId] = imageUrl; 
        
        const stringified = JSON.stringify(covers);
        this.setting('framio-custom-homepage.cover_overrides')(stringified);
        
        saveSettings({ 'framio-custom-homepage.cover_overrides': stringified }).then(() => {
            app.alerts.show({ type: 'success' }, 'Kapak görseli kaydedildi.');
            m.redraw();
        });
    }

    getTagCovers() {
        let covers = {};
        try { covers = JSON.parse(this.setting('framio-custom-homepage.tag_covers')() || '{}'); } catch(e) {}
        return covers;
    }

    updateTagCover(tagId, url) {
        const covers = this.getTagCovers();
        covers[tagId] = url;
        this.setting('framio-custom-homepage.tag_covers')(JSON.stringify(covers));
    }

    handleFileUpload(tagId, e) {
        const file = e.target.files[0];
        if (!file) return;
        
        e.target.value = '';

        if (file.size > 5 * 1024 * 1024) { 
            app.alerts.show({ type: 'error' }, 'Görsel boyutu çok büyük! Lütfen 5MB altı bir görsel seçin.');
            return;
        }

        this.uploadingTagId = tagId;
        m.redraw();

        const firebaseConfig = {
            apiKey: "AIzaSyBNr8OHna26qi1C8A8Y_RSk1FZ6SuYStFg",
            authDomain: "spotters-turkey-storage.firebaseapp.com",
            projectId: "spotters-turkey-storage",
            storageBucket: "spotters-turkey-storage.firebasestorage.app",
            messagingSenderId: "593543513590",
            appId: "1:593543513590:web:7b09c9cf1304a00fd733d7"
        };

        let firebaseApp;
        if (!getApps().length) {
            firebaseApp = initializeApp(firebaseConfig);
        } else {
            firebaseApp = getApp();
        }

        const storage = getStorage(firebaseApp);
        
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const filePath = `assets/spotters/covers/${Date.now()}_${cleanFileName}`;
        const storageRef = ref(storage, filePath);

        uploadBytes(storageRef, file).then((snapshot) => {
            getDownloadURL(snapshot.ref).then((downloadURL) => {
                this.updateTagCover(tagId, downloadURL);
                this.uploadingTagId = null; 
                app.alerts.show({ type: 'success' }, 'Kapak görseli Firebase\'e başarıyla yüklendi!');
                m.redraw();
            });
        }).catch(error => {
            console.error("Firebase Yükleme Hatası:", error);
            this.uploadingTagId = null;
            app.alerts.show({ type: 'error' }, 'Yükleme başarısız oldu. Konsolu kontrol edin.');
            m.redraw();
        });
    }

    scrollPreview(direction) {
        const container = document.getElementById('Framio-Admin-TagSlider');
        if (container) {
            const scrollAmount = container.clientWidth / 2; 
            container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
        }
    }

    content() {
        if (this.loading) return <LoadingIndicator />;

        return (
            <div className="CustomHomepageSettingsPage">
                <div className="container">
                    <div className="Framio-Tabs-Container">
                        {/* SEKME MENÜSÜ (Upload & SEO eklentileriyle aynı açılır yapı) */}
                        <div className="CHS-TabBar">
                            <label>
                                <i className="fas fa-layer-group"></i> Yapılandırma Modülü
                            </label>
                            <select className="FormControl" value={this.activeTab} onchange={(e) => { this.activeTab = e.target.value; m.redraw(); }}>
                                {Object.keys(TABS).map((k) => <option value={k}>{TABS[k][1]}</option>)}
                            </select>
                            <span className="CHS-TabBar-Desc"><i className={TABS[this.activeTab][0]}></i> {TABS[this.activeTab][2]}</span>
                        </div>

                        <div className="Framio-Tab-Content">
                            {this.activeTab === 'general' && this.renderGeneralSettings()}
                            {this.activeTab === 'pages' && (this.pageHeroes || (this.pageHeroes = new PageHeroes(this))).view()}
                            {this.activeTab === 'menu' && (this.menuManager || (this.menuManager = new MenuManager(this))).view()}
                            {this.activeTab === 'performance' && this.renderPerformanceSettings()}
                            {this.activeTab === 'slider' && this.renderSliderSettings()}
                            {this.activeTab === 'categories' && this.renderCategorySettings()}
                            {this.activeTab === 'gallery' && this.renderGallerySettings()}
                            {this.activeTab === 'categoryGallery' && this.renderCategoryGallerySettings()}
                            {this.activeTab === 'covers' && this.renderCoverSettings()}
                        </div>
                    </div>

                    <div className="Form-group CHS-Save">
                        {this.submitButton()}
                    </div>
                </div>
            </div>
        );
    }

    renderGeneralSettings() {
        const title = app.forum.attribute('title');
        return this.card('fas fa-sliders-h', 'Genel & Metinler', 'Boş bırakılan alanlarda forum başlığı ve varsayılan metinler kullanılır; eklenti her sitede ayarsız da çalışır.', [
            this.row('Site adı', 'Galeri, paylaşım ve yükleniyor metinlerinde kullanılır.', this.input('site_label', title)),
            this.row('Yükleniyor metni', 'Galeri verisi gelirken gösterilir.', this.input('loading_text', title + ' ekibinden en güncel içerikler yükleniyor...')),
            this.row('Boş galeri metni', 'Kategoride fotoğraf yokken gösterilir.', this.input('empty_text', 'Bu kategoride henüz yüklenmiş bir fotoğraf bulunmuyor.')),
            this.row('Paylaşım metni', '{site} yazısı site adıyla değiştirilir.', this.input('share_text', "{site}'daki bu harika fotoğrafa bak!")),
        ]);
    }

    renderPerformanceSettings() {
        return [
            this.card('fas fa-bolt', 'Performans & Önbellek', 'Galerinin boyutu ve ziyaretçilere önbellekten sunulma süresi.', [
                this.row('Galerideki mesaj sayısı', '12–200. Artırmak galeriyi zenginleştirir, ilk yüklemeyi yavaşlatır.', this.input('gallery_post_limit', '60', { type: 'number', min: 12, max: 200 })),
                this.row('Ziyaretçi önbelleği (dakika)', 'Yeni mesaj, düzenleme veya silmede kendiliğinden temizlenir. 0 = kapalı.', this.input('cache_minutes', '5', { type: 'number', min: 0, max: 120 })),
                this.row('Önbelleği temizle', 'Değişiklik hemen görünsün istiyorsanız.', (
                    <Button className="Button" icon="fas fa-broom" loading={this.flushing} onclick={() => {
                        this.flushing = true;
                        app.request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/framio/homepage-cache/flush' })
                            .then(() => app.alerts.show({ type: 'success' }, 'Galeri önbelleği temizlendi.'))
                            .finally(() => { this.flushing = false; m.redraw(); });
                    }}>Şimdi temizle</Button>
                )),
            ]),
        ];
    }

    /** Birincil / ikincil etiket kuralları (aynı yapı, farklı anahtar öneki) */
    tagRuleCard(prefix, iconName, title, desc) {
        return this.card(iconName, title, desc, [
            this.row('"Fotoğraflar" sekmesi', 'Kategori sayfasında galeri sekmesi görünsün.', this.toggle(prefix + '_gallery_active')),
            this.row('Varsayılan sekme', 'Kategoriye girildiğinde açılacak görünüm.', this.select(prefix + '_default_sort', { gallery: 'Fotoğraflar', feed: 'Akış (önerilen)', default: 'Konu listesi' }, 'gallery')),
            this.row('Diğer sekmelerde göster', '"En Son" gibi sekmelerde de galeri şeridi çıksın.', this.toggle(prefix + '_other_tabs_active')),
            this.row('Galeri konumu', 'Diğer sekmelerde şeridin yeri.', this.select(prefix + '_gallery_position', { top: 'Listenin üstünde', bottom: 'Listenin altında' }, 'top')),
        ]);
    }

    renderCategoryGallerySettings() {
        return [
            this.card('fas fa-folder-open', 'Kategori İçi Galeri', 'Kategorilerde "Fotoğraflar" sekmesi. Kapatılırsa bütün kategorilerde gizlenir.', [
                this.row('Sütun sayısı', null, this.select('category_gallery_layout', { 3: 'Yan yana 3 (standart)', 2: 'Yan yana 2 (büyük)' }, '3')),
            ], this.toggle('category_gallery_active')),
            <div className="CHS-Grid2">
                {this.tagRuleCard('primary', 'fas fa-tag', 'Ana kategoriler', 'Üst düzey etiketler için genel kural')}
                {this.tagRuleCard('secondary', 'fas fa-tags', 'Alt kategoriler', 'İkincil etiketler için genel kural')}
            </div>,
            this.renderSpecificTagSettings(),
        ];
    }

    renderSpecificTagSettings() {
        const tags = app.store.all('tags');
        const primaryTags = tags.filter(tag => !tag.parent() && tag.position() !== null).sort((a, b) => a.position() - b.position());
        const overrides = this.getTagOverrides();

        const renderTagRow = (tag, isChild = false) => {
            const slug = tag.slug();
            const ovr = overrides[slug] || { override_active: '0', gallery_active: '1', default_sort: 'gallery', other_tabs_active: '1', position: 'top' };
            const isExpanded = this.expandedTagSettings === slug;
            const hasOverride = ovr.override_active === '1';

            return (
                <div style={{ marginBottom: '10px', background: hasOverride ? 'rgba(231, 76, 60, 0.05)' : 'var(--body-bg)', border: hasOverride ? '1px solid var(--primary-color)' : '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden', marginLeft: isChild ? '30px' : '0' }}>
                    <div style={{ padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onclick={() => this.expandedTagSettings = isExpanded ? null : slug}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: tag.color() || '#ccc' }}></span>
                            <strong style={{ color: hasOverride ? 'var(--primary-color)' : 'var(--heading-color)', fontSize: isChild ? '13px' : '15px' }}>{tag.name()}</strong>
                            {hasOverride && <span style={{ fontSize: '10px', background: 'var(--primary-color)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>ÖZEL AYAR AKTİF</span>}
                        </div>
                        <div style={{ color: 'var(--muted-color)' }}>{icon(isExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down')}</div>
                    </div>
                    
                    {isExpanded && (
                        <div style={{ padding: '15px', borderTop: '1px solid var(--border-color)', background: 'var(--control-bg)' }}>
                            <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px dashed var(--border-color)' }}>
                                <Switch state={ovr.override_active === '1'} onchange={(val) => this.updateTagOverride(slug, 'override_active', val ? '1' : '0')}>
                                    <b style={{ color: 'var(--primary-color)' }}>Bu Kategori İçin Özel Ayar Kullan (Genel kuralları ezer)</b>
                                </Switch>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', opacity: ovr.override_active === '1' ? 1 : 0.4, pointerEvents: ovr.override_active === '1' ? 'auto' : 'none' }}>
                                <div>
                                    <Switch state={ovr.gallery_active === '1'} onchange={(val) => this.updateTagOverride(slug, 'gallery_active', val ? '1' : '0')}>
                                        <b>"Fotoğraflar" Menüsü Çıksın Mı?</b>
                                    </Switch>
                                </div>
                                <div>
                                    <Switch state={ovr.other_tabs_active === '1'} onchange={(val) => this.updateTagOverride(slug, 'other_tabs_active', val ? '1' : '0')}>
                                        <b>Diğer Sekmelerde Göster</b>
                                    </Switch>
                                </div>
                                <div>
                                    <label style={{fontWeight: 'bold', display: 'block', marginBottom: '5px', fontSize: '12px'}}>Varsayılan Sekme</label>
                                    {Select.component({
                                        options: { 'gallery': '"Fotoğraflar" Sekmesi', 'feed': '"Akış" Sekmesi (Önerilen)', 'default': 'Orijinal Konu Listesi' },
                                        value: ovr.default_sort || 'gallery',
                                        onchange: (val) => { this.updateTagOverride(slug, 'default_sort', val); m.redraw(); }
                                    })}
                                </div>
                                <div>
                                    <label style={{fontWeight: 'bold', display: 'block', marginBottom: '5px', fontSize: '12px'}}>Galeri Konumu</label>
                                    {Select.component({
                                        options: { 'top': 'Listenin Üstünde', 'bottom': 'Listenin Altında' },
                                        value: ovr.position || 'top',
                                        onchange: (val) => { this.updateTagOverride(slug, 'position', val); m.redraw(); }
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div style={{ marginTop: '30px', background: 'var(--body-bg)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--heading-color)' }}>🎯 Spesifik Kategori Ayarları (İstisnalar)</h4>
                <p className="helpText" style={{marginBottom: '20px'}}>Aşağıdaki listeden istediğiniz bir kategoriyi seçerek, yukarıdaki genel kuralları ezip o kategoriye özel kurallar tanımlayabilirsiniz.</p>
                
                {primaryTags.map(pTag => (
                    <div style={{ marginBottom: '15px' }}>
                        {renderTagRow(pTag, false)}
                        {tags.filter(t => t.parent() === pTag).sort((a,b) => a.position() - b.position()).map(cTag => renderTagRow(cTag, true))}
                    </div>
                ))}
            </div>
        );
    }

    renderSliderSettings() {
        const currentSliderData = this.getSliderData();
        const recentImages = this.getRecentImages();
        
        const itemsPerPage = 20;
        const totalPages = Math.ceil(recentImages.length / itemsPerPage) || 1;
        
        if (this.imagePage > totalPages) this.imagePage = totalPages;
        if (this.imagePage < 1) this.imagePage = 1;

        const startIndex = (this.imagePage - 1) * itemsPerPage;
        const currentImages = recentImages.slice(startIndex, startIndex + itemsPerPage);

        return (
            <div className="Form-group Framio-SliderSettings">
                {this.card("fas fa-th-large", "Hero Grid / Slider", "Ana sayfanın en üstündeki büyük ızgara. En fazla 16 fotoğraf; sürükleyerek sıralayın.", (
                    <div className="Framio-Slider-Layout">
                    <div className="Framio-Slider-Controls">
                        {this.row("Grid tasarım modu", "Tek sayfa veya kayan sayfalar.", Select.component({
                                    options: { 
                                        'grid-16': '16 Fotoğraf Tek Sayfada (Sabit)', 
                                        'grid-8': '8\'li Kayan Sayfalar (Animasyonlu)',
                                        'grid-4': '4\'lü Kayan Sayfalar (Animasyonlu)'
                                    },
                                    value: this.setting('framio-custom-homepage.slider_layout_mode')() || 'grid-8',
                                    onchange: (val) => {
                                        this.setting('framio-custom-homepage.slider_layout_mode')(val);
                                        m.redraw();
                                    }
                                }))}

                        <h4 className="CHS-SubHead"><i className="fas fa-layer-group"></i> Slider görselleri <span>{currentSliderData.length}/16</span></h4>
                        <div className="Slider-Items-Compact" style={{ marginBottom: '20px' }}>
                            {currentSliderData.map((slide, index) => (
                                <div className="Slider-Item minimal" draggable="true" ondragstart={(e) => this.onDragStart(e, index)} ondragend={(e) => this.onDragEnd(e)} ondragover={(e) => this.onDragOver(e, index)} ondrop={(e) => this.onDrop(e, index)}>
                                    <div className="Drag-Handle" title="Sürükle ve Sırala">{icon('fas fa-grip-vertical')}</div>
                                    {slide.url ? <div className="Slider-Item-Thumb" style={{ backgroundImage: `url(${slide.url})` }}></div> : <div className="Slider-Item-Thumb" style={{ background: '#333' }}></div>}
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                                        <input className="FormControl input-sm" placeholder="Görsel URL..." value={slide.url} oninput={(e) => this.updateSlideData(index, 'url', e.target.value)} />
                                        
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                                                <span style={{fontSize: '11px', color: 'var(--muted-color)', fontWeight: 'bold'}}>Konu ID:</span>
                                                <input className="FormControl input-sm" style={{width: '60px', textAlign: 'center'}} placeholder="Örn: 78" value={slide.discussionId || ''} oninput={(e) => this.updateSlideData(index, 'discussionId', e.target.value)} />
                                            </div>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                                                <span style={{fontSize: '11px', color: 'var(--muted-color)', fontWeight: 'bold'}}>Mesaj No:</span>
                                                <input className="FormControl input-sm" style={{width: '60px', textAlign: 'center'}} placeholder="Örn: 82" value={slide.postNumber || ''} oninput={(e) => this.updateSlideData(index, 'postNumber', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>

                                    <Button className="Button Button--danger Button--icon" icon="fas fa-trash" onclick={() => this.removeSlide(index)} title="Sil" />
                                </div>
                            ))}
                            {currentSliderData.length === 0 && <p className="helpText">Henüz görsel eklenmemiş.</p>}
                        </div>

                        <h4 className="CHS-SubHead"><i className="fas fa-plus-circle"></i> Son yüklenen fotoğraflardan ekle <span>tıklayınca eklenir</span></h4>
                        {recentImages.length > 0 ? (
                            <div className="ImagePicker-Container">
                                <div className="ImagePicker-Grid">
                                    {currentImages.map((imgObj, i) => (
                                        <div key={`img-${this.imagePage}-${i}`} className="ImagePicker-Item" onclick={() => this.addSlideFromUrl(imgObj)}>
                                            <img src={imgObj.url} alt="Recent upload" />
                                            <div className="ImagePicker-Overlay">{icon('fas fa-plus')}</div>
                                        </div>
                                    ))}
                                </div>
                                
                                {totalPages > 1 && (
                                    <div className="ImagePicker-Pagination">
                                        <Button className="Button Button--icon" disabled={this.imagePage === 1} icon="fas fa-chevron-left" onclick={(e) => { e.preventDefault(); this.imagePage--; m.redraw(); }} />
                                        <span className="Page-Info">Sayfa {this.imagePage} / {totalPages}</span>
                                        <Button className="Button Button--icon" disabled={this.imagePage === totalPages} icon="fas fa-chevron-right" onclick={(e) => { e.preventDefault(); this.imagePage++; m.redraw(); }} />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="helpText">Foruma yüklenmiş görsel bulunamadı.</p>
                        )}
                        
                        <Button className="Button" icon="fas fa-link" onclick={() => this.addSlide()} style={{ marginTop: '15px', width: '100%' }}>
                            Manuel URL Giriş Alanı Ekle
                        </Button>
                    </div>

                    <div className="Framio-Slider-PreviewBox">
                        <h4 className="CHS-SubHead"><i className="fas fa-eye"></i> Canlı önizleme</h4>
                        <div className="Framio-Admin-SliderPreview">
                            <span className="Preview-Badge">ÖNİZLEME</span>
                            <HeroSlider preview={true} slides={currentSliderData} layoutMode={this.setting('framio-custom-homepage.slider_layout_mode')() || 'grid-8'} />
                        </div>
                        <p className="helpText" style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px' }}>
                            *Sitede sınırların tamamını dolduracak şekilde görünür.
                        </p>
                    </div>
                </div>
                ), this.toggle("slider_active"))}
            </div>
        );
    }

    renderCategorySettings() {
        const isCarouselMode = this.setting('framio-custom-homepage.tag_layout_mode')() === 'carousel';
        const isImageStyle = this.setting('framio-custom-homepage.tag_card_style')() === 'image';
        
        const mainTags = app.store.all('tags').filter(tag => !tag.parent() && tag.position() !== null).sort((a, b) => a.position() - b.position());
        const tagCovers = this.getTagCovers();

        const recentImages = this.getRecentImages();
        const itemsPerPage = 20;
        const totalPages = Math.ceil(recentImages.length / itemsPerPage) || 1;
        if (this.tagImagePage > totalPages) this.tagImagePage = totalPages;
        if (this.tagImagePage < 1) this.tagImagePage = 1;
        const startIndex = (this.tagImagePage - 1) * itemsPerPage;
        const currentImages = recentImages.slice(startIndex, startIndex + itemsPerPage);

        return (
            <div className="Form-group">
                {this.card("fas fa-tags", "Kategori Kartları", "Ana sayfadaki kategori kartlarının düzeni; kaydırmalı modda kapak görselleri seçilebilir.", [
                    this.row("Kategori düzeni", null, this.select("tag_layout_mode", { default: "Klasik Flarum (kutu ızgara)", carousel: "Kaydırmalı şerit (carousel)" }, "default")),
                    isCarouselMode ? this.row("Kart tasarımı", null, this.select("tag_card_style", { color: "Sadece renk + yazı", image: "Kapak görselli, degradeli" }, "image")) : null,
                    isCarouselMode ? this.row("Yan yana görünen kart", "Ekranda aynı anda kaç kategori kartı görünsün; fazlası kaydırılarak görülür.", this.cardCountControl()) : null,
                    isCarouselMode ? this.row("Kart yüksekliği", "Piksel cinsinden, örn. 250px", <input className="FormControl" bidi={this.setting("framio-custom-homepage.tag_carousel_height", "250px")} />) : null,
                ])}
                {isCarouselMode && (
                    <div className="CHS-Card CHS-Card--covers">

                        {isImageStyle && (
                            <div className="Framio-TagCovers-Section">
                                <header className="CHS-Card-Head"><div className="CHS-Card-Icon"><i className="fas fa-image"></i></div><div className="CHS-Card-Titles"><h3>Kategori kapak görselleri</h3><p>Her kategoriye arka plan seçin: forumdan seç, cihazdan yükle veya adres yapıştır. Önizleme anında değişir.</p></div></header>
                                <div className="CHS-Card-Body">
                                
                                <div className="Framio-TagCovers-Grid">
                                    {mainTags.map(tag => {
                                        const tagId = tag.id();
                                        const currentCover = tagCovers[tagId] || '';
                                        return (
                                            <div className="Framio-TagCover-Item">
                                                <label className="TagCover-Label">
                                                    <span className="TagCover-ColorBox" style={{ backgroundColor: tag.color() || '#333' }}>
                                                        {tag.icon() && icon(tag.icon())}
                                                    </span>
                                                    {tag.name()}
                                                </label>
                                                
                                                <div className="TagCover-InputArea">
                                                    <input 
                                                        className="FormControl" 
                                                        placeholder="Görsel URL..." 
                                                        value={currentCover} 
                                                        oninput={(e) => this.updateTagCover(tagId, e.target.value)} 
                                                        disabled={this.uploadingTagId === tagId}
                                                    />
                                                    
                                                    {this.uploadingTagId === tagId ? (
                                                        <LoadingIndicator size="small" style={{ display: 'inline-block', margin: '0 10px' }} />
                                                    ) : (
                                                        <>
                                                            <Button className="Button Button--icon" icon="fas fa-images" onclick={(e) => { e.preventDefault(); this.pickingTagId = this.pickingTagId === tagId ? null : tagId; }} title="Forumdan Seç" />
                                                            
                                                            <label className="Button Button--icon" title="Cihazdan Yükle" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <i className="fas fa-upload"></i>
                                                                <input type="file" accept="image/*" style={{ display: 'none' }} onchange={(e) => this.handleFileUpload(tagId, e)} />
                                                            </label>

                                                            {currentCover && (
                                                                <Button className="Button Button--icon Button--danger" icon="fas fa-trash" onclick={(e) => { e.preventDefault(); this.updateTagCover(tagId, ''); m.redraw(); }} title="Kapak Görselini Kaldır" />
                                                            )}
                                                        </>
                                                    )}

                                                    {currentCover && this.uploadingTagId !== tagId && <div className="Framio-MiniPreview" style={{ backgroundImage: `url(${currentCover})` }}></div>}
                                                </div>

                                                {this.pickingTagId === tagId && (
                                                    <div className="TagCover-RecentPicker" style={{ marginTop: '15px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                                                        {recentImages.length > 0 ? (
                                                            <div className="ImagePicker-Container">
                                                                <div className="ImagePicker-Grid">
                                                                    {currentImages.map((imgObj, i) => (
                                                                        <div key={`tag-img-${this.tagImagePage}-${i}`} className="ImagePicker-Item" onclick={() => { this.updateTagCover(tagId, imgObj.url); this.pickingTagId = null; m.redraw(); }}>
                                                                            <img src={imgObj.url} alt="Recent" />
                                                                            <div className="ImagePicker-Overlay">{icon('fas fa-check')}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                {totalPages > 1 && (
                                                                    <div className="ImagePicker-Pagination">
                                                                        <Button className="Button Button--icon" disabled={this.tagImagePage === 1} icon="fas fa-chevron-left" onclick={(e) => { e.preventDefault(); this.tagImagePage--; m.redraw(); }} />
                                                                        <span className="Page-Info">Sayfa {this.tagImagePage} / {totalPages}</span>
                                                                        <Button className="Button Button--icon" disabled={this.tagImagePage === totalPages} icon="fas fa-chevron-right" onclick={(e) => { e.preventDefault(); this.tagImagePage++; m.redraw(); }} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="helpText">Foruma yüklenmiş görsel bulunamadı.</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {this.renderTagCarouselPreview(mainTags, tagCovers)}
                                </div>

                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    renderTagCarouselPreview(tags, tagCovers) {
        const cardWidth = this.setting('framio-custom-homepage.tag_carousel_width', 'calc((100% - 40px) / 3)')();
        const cardHeight = this.setting('framio-custom-homepage.tag_carousel_height', '250px')();

        return (
            <div className="Framio-Admin-CarouselPreview-Wrapper" style={{ marginTop: '30px', position: 'relative' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '10px', textAlign: 'center' }}>Canlı Kategori Önizleme</h4>
                
                <div className="Framio-Admin-CarouselPreview" style={{ position: 'relative' }}>
                    <button className="Framio-Carousel-Btn prev" onclick={(e) => { e.preventDefault(); this.scrollPreview(-1); }} style={{ position: 'absolute', left: '-20px', zIndex: 10 }}>
                        {icon('fas fa-chevron-left')}
                    </button>

                    <div id="Framio-Admin-TagSlider" className="Framio-Carousel-Track" style={{ display: 'flex', gap: '20px', overflowX: 'auto', scrollBehavior: 'smooth', scrollbarWidth: 'none', width: '100%' }}>
                        {tags.map(tag => {
                            const customCover = tagCovers[tag.id()];
                            const finalBgUrl = customCover || tag.backgroundUrl();
                            const hasBgImage = !!finalBgUrl;
                            const bgColor = tag.color() || '#333';
                            
                            return (
                                <div className="Framio-Carousel-Card Style-image" style={{ width: cardWidth, height: cardHeight, flex: `0 0 ${cardWidth}` }}>
                                    <div className="Framio-Carousel-Bg" style={{ backgroundImage: hasBgImage ? `url("${finalBgUrl}")` : 'none', backgroundColor: bgColor }}></div>
                                    <div className="Framio-Carousel-Overlay"></div>
                                    <div className="Framio-Carousel-Card-Content">
                                        <div className="Framio-Carousel-Text-Wrapper">
                                            <h3 className="Framio-Carousel-Card-Title">{tag.name()}</h3>
                                            {tag.description() && (
                                                <p className="Framio-Carousel-Desc" title={tag.description()}>{tag.description()}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button className="Framio-Carousel-Btn next" onclick={(e) => { e.preventDefault(); this.scrollPreview(1); }} style={{ position: 'absolute', right: '-20px', zIndex: 10 }}>
                        {icon('fas fa-chevron-right')}
                    </button>
                </div>
            </div>
        );
    }

    renderGallerySettings() {
        return this.card("fas fa-images", "Ana Galeri & Lightbox", "Ana sayfadaki \"Son Eklenenler\" galerisi.", [
            this.row("Tıklama davranışı", "Fotoğrafa tıklanınca lightbox mı açılsın, konuya mı gidilsin?", this.select("click_behavior", { lightbox: "Lightbox aç (önerilen)", link: "Doğrudan konuya git" }, "lightbox")),
            this.row("Galeri modu", null, this.select("gallery_mode", { recent: "Son yüklenenler (mesaj başına 1 kart)" }, "recent")),
        ], this.toggle("gallery_active"));
    }

    renderCoverSettings() {
        return (
            this.card("fas fa-crown", "Kapak Görselleri", "Birden fazla fotoğraflı mesajlar listelenir; bir mesaja tıklayıp galeride görünecek kapağı seçin.", this.expandedPostId ? this.renderDetailView() : this.renderGridView(), this.toggle("covers_active"))
        );
    }

    renderGridView() {
        const validPosts = this.posts.filter(post => {
            const attributes = post.attributes || {};
            const images = this.extractImages(attributes.contentHtml, attributes.content);
            return images.length > 1;
        });

        if (validPosts.length === 0) return <p>Birden fazla görsel içeren mesaj bulunamadı.</p>;
        const covers = this.getCovers();

        return (
            <div className="Framio-PostGrid">
                {validPosts.map(post => {
                    const attributes = post.attributes || {};
                    const images = this.extractImages(attributes.contentHtml, attributes.content);
                    const userId = post.relationships?.user?.data?.id;
                    const userObj = userId ? this.included.find(inc => inc.type === 'users' && inc.id === userId) : null;
                    const userName = userObj?.attributes?.username || 'Bilinmeyen Kullanıcı';
                    const discussionId = post.relationships?.discussion?.data?.id;
                    const discussionObj = discussionId ? this.included.find(inc => inc.type === 'discussions' && inc.id === discussionId) : null;
                    const discussionTitle = discussionObj?.attributes?.title || `Mesaj #${post.id}`;
                    const coverUrl = covers[post.id];
                    const thumbUrl = coverUrl || images[0];

                    return (
                        <div className="Framio-PostCard" onclick={() => this.togglePost(post.id)}>
                            <div className="Framio-PostCard-Thumb" style={{ backgroundImage: `url("${thumbUrl}")` }}>
                                <div className="Framio-PostCard-Badge">{images.length} Fotoğraf</div>
                                {coverUrl && <div className="Framio-ImageCrown">👑</div>}
                            </div>
                            <div className="Framio-PostCard-Info">
                                <div className="Framio-PostCard-Title" title={discussionTitle}>{discussionTitle}</div>
                                <div className="Framio-PostCard-User">{icon('fas fa-user')} {userName}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    renderDetailView() {
        const post = this.posts.find(p => p.id === this.expandedPostId);
        if (!post) return null;

        const attributes = post.attributes || {};
        const images = this.extractImages(attributes.contentHtml, attributes.content);
        const covers = this.getCovers();
        const coverSetting = covers[post.id];
        const discussionId = post.relationships?.discussion?.data?.id;
        const discussionObj = discussionId ? this.included.find(inc => inc.type === 'discussions' && inc.id === discussionId) : null;
        const discussionTitle = discussionObj?.attributes?.title || `Mesaj #${post.id}`;

        return (
            <div className="Framio-DetailView">
                <div className="Framio-DetailHeader">
                    <Button className="Button Button--primary" icon="fas fa-arrow-left" onclick={() => this.togglePost(null)}>
                        Listeye Dön
                    </Button>
                    <h4 style={{ margin: 0 }}>{discussionTitle}</h4>
                </div>
                <div className="Framio-ImageGrid">
                    {images.map(imgUrl => (
                        <div className={`Framio-ImageItem ${coverSetting === imgUrl ? 'selected' : ''}`} onclick={(e) => this.setCoverImage(post.id, imgUrl, e)}>
                            <img src={imgUrl} alt="Post image" />
                            {coverSetting === imgUrl && <div className="Framio-ImageCrown">👑</div>}
                            <div className="Framio-ImageOverlay">Kapak Yap</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
}