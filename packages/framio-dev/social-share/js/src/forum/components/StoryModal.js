import Modal from 'flarum/common/components/Modal';
import { brand } from '../brand';
import Button from 'flarum/common/components/Button';
import app from 'flarum/forum/app';
import ForumFeedPickerModal from './ForumFeedPickerModal';
import SocialActionChooserModal from './SocialActionChooserModal';

export default class StoryModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);
    this.availableImages = this.extractImagesFromPost();
    this.selectedImage = this.availableImages.length > 0 ? this.availableImages[0] : null;
    this.isDownloading = false;
    this.isCopying = false;
    
    const details = this.extractPostDetails();
    this.topicTitle = details.topicTitle;
    if (details.isFourLineFormat) {
      this.companyTitle = details.line1 + (details.line2 ? " & " + details.line2 : "");
    } else {
      this.companyTitle = details.companyName + (details.modelName ? " & " + details.modelName : "");
    }
    if (!this.companyTitle.trim()) {
        this.companyTitle = this.topicTitle;
    }
    
    this.storyMode = "standard";
    this.exifData = { camera: "", lens: "", shutter: "", aperture: "", iso: "", focal: "" };
    this.exifYOffset = 0;
    
    this.titleMode = "company";
    this.customTitle = this.companyTitle;
    this.titleYOffset = 0;
    
    this.showFooterText = true;
    this.customFooterText = "Daha Fazlası İçin:";
    this.footerYOffset = 0;
    this.creditsSeparateLine = false; // Fotoğrafçı künyesi 3. satırla birleşik mi yoksa ayrı bir satırda mı
    
    this.imageYOffset = 0;
    this.imageScale = 1.0; // 0.6 - 1.5 arası fotoğraf boyutu (ölçekleme)
    this.frameStyle = 'modern'; // 'modern' | 'polaroid' | 'polaroid_tape' | 'tape_corners' | 'vintage_card'
    this.imageCornerRadius = 24; // 0, 12, 24, 36
    this.imageShadowStyle = 'deep'; // 'none', 'soft', 'deep'
    this.imageBorderWidth = 0; // 0, 4, 8

    // Sektörel Rozetler & Künye Bilgileri
    this.showPlateBadge = true;
    this.badgeDisplayMode = 'auto'; // 'auto' (Çerçeveye göre akıllı) | 'top_floating' | 'bottom_integrated'
    this.badgeAlign = 'center'; // 'center' (Ortalı) | 'left' (Sola Yaslı) | 'right' (Sağa Yaslı)
    this.commonBadgeFontSize = 21; // Varsayılan ortak punto
    this.commonBadgeColor = ""; // Boş ise arka plana göre otomatik renk
    this.photographerPlacement = 'same_line'; // 'same_line' | 'separate_line' | 'hidden'
    this.badgeLine1 = details.line1 || "";
    this.badgeLine2 = details.line2 || "";
    this.badgeLine3 = details.line3 || "";
    this.plateBadgeText = details.plate || "";
    this.cityBadgeText = details.city || "";
    this.badgeYOffset = 0;

    // Instagram Güvenli Alan Kılavuzu
    this.showSafeZoneGuide = false;
    
    this.creditsText = "📸 " + (details.authorName || brand().name);
    this.creditsIsBold = false;
    this.creditsIsItalic = false;
    this.creditsSize = 21; // 4. satır ayrı düzenleme için bağımsız punto (varsayılan ortakla eşit)
    this.creditsColor = ""; // 4. satır için bağımsız renk
    this.creditsYOffset = 0; // 4. satır için bağımsız dikey konumlandırma

    // Özel Renk & Punto Seçenekleri
    this.titleColor = ""; // Boş ise arka plana göre otomatik
    this.showBadgeLine1 = true;
    this.badgeLine1Size = 21;
    this.badgeLine1Color = "";
    this.showBadgeLine2 = true;
    this.badgeLine2Size = 21;
    this.badgeLine2Color = "";
    this.showBadgeLine3 = true;
    this.badgeLine3Size = 21;
    this.badgeLine3Color = "";
    this.showBadgeCredits = true;
    this.footerFontSize = 44;
    this.footerTextColor = "";
    this.exifCardStyle = "glass"; // 'glass' | 'solid' | 'bordered'
    this.exifCardScale = 1.0; // 1.0 (Varsayılan min) - 1.25 arası ölçekleme
    
    const defaultBgs = [
        { id: "bg_blur", name: "✨ Bulanık Görsel Fonu (Frosted Glass / Ambient)", type: "blur", textColor: "#ffffff" }
    ];
    const storyBgSetting = app.forum.attribute('framio-social-share.story_backgrounds_json');
    try {
        const customBgs = storyBgSetting ? JSON.parse(storyBgSetting) : [];
        this.backgrounds = [...defaultBgs, ...(Array.isArray(customBgs) ? customBgs : [])];
    } catch(e) {
        this.backgrounds = defaultBgs;
    }
    this.selectedBgId = "bg_blur";
    
    this.logos = [
        {id:"none", name:"Logo Ekleme", file:null},
        {id:"logo1", name:(brand().name + " Siyah Logo"), file:"ua_black_logo.png"},
        {id:"logo2", name:(brand().name + " Beyaz Logo"), file:"ua_white_logo.png"},
        {id:"logo3", name:(brand().name + " Yeşil Logo"), file:"ua_green_logo.png"}
    ];
    this.selectedLogoId = "none";
    this.logoXOffset = 0;
    this.logoYOffset = 0;
    this.logoScale = 1;
    
    this.imageCache = {};
    this.loadedBg = null;
    this.bgVideo = null;
    this.animFrameId = null;
    this.loadedMain = null;
    this.loadedLogo = null;

    // Tipografi & Google Fonts (25+ Karakter Destekli Zengin Yazı Tipleri)
    this.selectedFontFamily = 'Exo 2'; // Genel / Başlık fontu (Forum varsayılanı)
    this.badgeFontFamily = '';         // Künye fontu (boş ise genel fontu miras alır)
    this.footerFontFamily = '';        // Duyuru metni fontu (boş ise genel fontu miras alır)
    this.titleFontSize = 64;           // Başlık boyutu (px)
    this.titleIsUppercase = false;     // Tümü Büyük Harf
    this.textShadowEnabled = true;      // Kontrast artırıcı metin gölgesi
    this.fontScope = 'all';            // 'all' (Tüm metinler) | 'title_only' (Sadece başlık)

    this.availableFonts = [
        // 1. Forum Varsayılanı
        { name: "Exo 2", label: "🏛️ Exo 2 (Forum Varsayılanı)", category: "Forum Varsayılanı", query: "Exo+2:wght@400;600;700;800" },

        // 2. Modern & Geometrik Sans-Serif
        { name: "Cairo", label: "⚡ Cairo (Modern & Vurgulu)", category: "Modern & Geometrik", query: "Cairo:wght@400;600;700;800;900" },
        { name: "Montserrat", label: "📐 Montserrat (Modern Geometrik)", category: "Modern & Geometrik", query: "Montserrat:wght@400;600;700;800;900" },
        { name: "Inter", label: "📱 Inter (Minimalist & Net)", category: "Modern & Geometrik", query: "Inter:wght@400;600;700;800" },
        { name: "Poppins", label: "✨ Poppins (Yumuşak & Dinamik)", category: "Modern & Geometrik", query: "Poppins:wght@400;600;700;800" },
        { name: "Roboto", label: "🏢 Roboto (Endüstriyel Standart)", category: "Modern & Geometrik", query: "Roboto:wght@400;500;700;900" },
        { name: "Outfit", label: "💎 Outfit (Çağdaş & Şık)", category: "Modern & Geometrik", query: "Outfit:wght@400;600;700;800" },
        { name: "Plus Jakarta Sans", label: "🚀 Plus Jakarta Sans (Modern UI)", category: "Modern & Geometrik", query: "Plus+Jakarta+Sans:wght@400;600;700;800" },
        { name: "Raleway", label: "🌟 Raleway (Zarif Geometrik)", category: "Modern & Geometrik", query: "Raleway:wght@400;600;700;800" },

        // 3. Güçlü Başlık & Display (Manşet & Afiş)
        { name: "Bebas Neue", label: "📢 Bebas Neue (Büyük Manşet / Afiş)", category: "Başlık & Display", query: "Bebas+Neue", hasBold: false },
        { name: "Oswald", label: "📰 Oswald (Klasik Haber / Manşet)", category: "Başlık & Display", query: "Oswald:wght@400;600;700" },
        { name: "Barlow Condensed", label: "🚌 Barlow Condensed (Sektörel / Tabela)", category: "Başlık & Display", query: "Barlow+Condensed:wght@400;600;700;800" },
        { name: "Teko", label: "🏎️ Teko (Ultra Dikey & Kondanse)", category: "Başlık & Display", query: "Teko:wght@400;600;700" },
        { name: "Russo One", label: "🛡️ Russo One (Kalın Blok & Güçlü)", category: "Başlık & Display", query: "Russo+One", hasBold: false },
        { name: "Anton", label: "🔥 Anton (Vurgulu & Çarpıcı)", category: "Başlık & Display", query: "Anton", hasBold: false },
        { name: "Changa", label: "🏷️ Changa (Kare & Dijital Başlık)", category: "Başlık & Display", query: "Changa:wght@400;600;700;800" },

        // 4. Slab Serif & Mekanik (Ağır Vasıta / Otomotiv / Retro)
        { name: "Alfa Slab One", label: "🚜 Alfa Slab One (Retro & Kalın)", category: "Slab & Mekanik", query: "Alfa+Slab+One", hasBold: false },
        { name: "Roboto Slab", label: "🏛️ Roboto Slab (Zarif & Sağlam)", category: "Slab & Mekanik", query: "Roboto+Slab:wght@400;600;700;800" },
        { name: "Zilla Slab", label: "⚙️ Zilla Slab (Endüstriyel & Teknik)", category: "Slab & Mekanik", query: "Zilla+Slab:wght@400;600;700" },

        // 5. Klasik & Lüks Serif (Prestij & Kurumsal)
        { name: "Playfair Display", label: "🎩 Playfair Display (Lüks & Prestij)", category: "Serif & Klasik", query: "Playfair+Display:ital,wght@0,400;0,700;0,900;1,400" },
        { name: "Merriweather", label: "📖 Merriweather (Zarif & Asil)", category: "Serif & Klasik", query: "Merriweather:ital,wght@0,400;0,700;0,900;1,400" },
        { name: "Cinzel", label: "🏛️ Cinzel (Anıtsal Roma Stili)", category: "Serif & Klasik", query: "Cinzel:wght@400;600;700;800" },
        { name: "Lora", label: "✍️ Lora (Kalıcı & Edebi)", category: "Serif & Klasik", query: "Lora:ital,wght@0,400;0,600;0,700;1,400" },

        // 6. El Yazısı, İmza & Özel (Kokpit / Nostalji / Not)
        { name: "Caveat", label: "🖋️ Caveat (Doğal Not / El Yazısı)", category: "El Yazısı & Özel", query: "Caveat:wght@400;600;700" },
        { name: "Pacifico", label: "🌊 Pacifico (Samimi & Gezi)", category: "El Yazısı & Özel", query: "Pacifico", hasBold: false },
        { name: "Marck Script", label: "✒️ Marck Script (Zarif İmza & Kartpostal)", category: "El Yazısı & Özel", query: "Marck+Script", hasBold: false },
        { name: "Orbitron", label: "🚀 Orbitron (Dijital Kokpit & Kadran)", category: "El Yazısı & Özel", query: "Orbitron:wght@400;600;700;800;900" },
        { name: "Share Tech Mono", label: "💻 Share Tech Mono (Terminal & Gösterge)", category: "El Yazısı & Özel", query: "Share+Tech+Mono", hasBold: false }
    ];

    // Google Fonts Preconnect & Toplu Font Yükleme (Gecikmesiz Canvas Çizimi)
    if (!document.getElementById('framio-gf-pre-1')) {
        const p1 = document.createElement('link');
        p1.id = 'framio-gf-pre-1';
        p1.rel = 'preconnect';
        p1.href = 'https://fonts.googleapis.com';
        document.head.appendChild(p1);

        const p2 = document.createElement('link');
        p2.id = 'framio-gf-pre-2';
        p2.rel = 'preconnect';
        p2.href = 'https://fonts.gstatic.com';
        p2.crossOrigin = 'anonymous';
        document.head.appendChild(p2);
    }

    const bulkFontUrl = "https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;800&family=Cairo:wght@400;600;700;800;900&family=Montserrat:wght@400;600;700;800;900&family=Inter:wght@400;600;700;800&family=Poppins:wght@400;600;700;800&family=Roboto:wght@400;500;700;900&family=Outfit:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Raleway:wght@400;600;700;800&family=Bebas+Neue&family=Oswald:wght@400;600;700&family=Barlow+Condensed:wght@400;600;700;800&family=Teko:wght@400;600;700&family=Russo+One&family=Anton&family=Changa:wght@400;600;700;800&family=Alfa+Slab+One&family=Roboto+Slab:wght@400;600;700;800&family=Zilla+Slab:wght@400;600;700&family=Playfair+Display:wght@400;700;900&family=Merriweather:wght@400;700;900&family=Cinzel:wght@400;600;700;800&family=Lora:wght@400;600;700&family=Caveat:wght@400;600;700&family=Pacifico&family=Marck+Script&family=Orbitron:wght@400;600;700;800;900&family=Share+Tech+Mono&display=swap";

    if (!document.getElementById('framio-bulk-google-fonts')) {
        const bLink = document.createElement('link');
        bLink.id = 'framio-bulk-google-fonts';
        bLink.rel = 'stylesheet';
        bLink.href = bulkFontUrl;
        bLink.onload = () => {
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(() => {
                    this.updateCanvasSync();
                    m.redraw();
                });
            }
        };
        document.head.appendChild(bLink);
    }

    this.loadGoogleFont(this.selectedFontFamily);

    // Canva Entegrasyon Durumları
    this.activeModeTab = 'native'; // 'native' | 'canva'
    this.selectedCanvaAccount = 'brand'; // 'brand' | 'user'
    this.canvaStatus = { 
      connected: false, 
      user_connected: false, 
      brand_connected: false, 
      user_profile: null, 
      brand_profile: null, 
      is_team_user: false, 
      loading: false 
    };
    this.canvaCreating = false;
    this.canvaExporting = false;
    this.canvaCurrentDesign = null;
    this.canvaExportedImage = null;

    this.canvaMsgHandler = this.handleCanvaMessage.bind(this);
    this.canvaStorageHandler = this.handleCanvaStorage.bind(this);
    window.addEventListener('message', this.canvaMsgHandler);
    window.addEventListener('storage', this.canvaStorageHandler);

    this.fetchCanvaStatus();

    // Meta Story Paylaşım & Zamanlama State'leri
    this.storyPublishIg = true;
    this.storyPublishFb = true;
    this.storyScheduleEnabled = false;
    this.storyScheduleDate = new Date().toISOString().split('T')[0];
    this.storyScheduleHour = '20';
    this.storyScheduleMinute = '00';
    this.isStoryPublishing = false;
    this.storyPublishProgress = '';

    try {
        const accJson = app.forum.attribute('framio-social-share.accounts_json') || '[]';
        this.accounts = JSON.parse(accJson);
    } catch(e) {
        this.accounts = [];
    }
    const defAccIdx = parseInt(app.forum.attribute('framio-social-share.default_account_index') || '0', 10);
    this.selectedStoryAccountIndex = defAccIdx < this.accounts.length ? defAccIdx : 0;

    // Font Yükleme Dinleyicisi (loadingdone ile anında tuval güncelleme)
    this.isFontLoading = false;
    this.fontLoadingHandler = () => {
        this.updateCanvasSync();
    };
    if (document.fonts && document.fonts.addEventListener) {
        document.fonts.addEventListener('loadingdone', this.fontLoadingHandler);
    }

    // Alt Etkileşim Barı ve Hikaye Çerçevesi genişlik senkronizasyonu
    this.storyCardWidth = 326;
    this.updateCardWidthFromEl = (el) => {
        if (!el) return;
        const w = el.getBoundingClientRect ? el.getBoundingClientRect().width : el.offsetWidth;
        if (w && Math.abs(this.storyCardWidth - w) > 0.5) {
            this.storyCardWidth = Math.round(w);
            m.redraw();
        }
    };
  }

  onremove(vnode) {
    super.onremove(vnode);
    if (this.canvaMsgHandler) window.removeEventListener('message', this.canvaMsgHandler);
    if (this.canvaStorageHandler) window.removeEventListener('storage', this.canvaStorageHandler);
    if (this.fontLoadingHandler && document.fonts && document.fonts.removeEventListener) {
        document.fonts.removeEventListener('loadingdone', this.fontLoadingHandler);
    }
  }

  async loadGoogleFont(fontName) {
    if (!fontName) return;
    const fontObj = this.availableFonts ? this.availableFonts.find(f => f.name === fontName) : null;
    if (!fontObj) return;

    const linkId = `google-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
    if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontObj.query}&display=swap`;
        link.onload = () => {
            this.updateCanvasSync();
            m.redraw();
        };
        document.head.appendChild(link);
    }

    const weight = fontObj.hasBold === false ? '400' : '700';
    const spec = `${weight} 48px "${fontName}"`;

    if (document.fonts && typeof document.fonts.load === 'function') {
        const isLoaded = document.fonts.check(spec);
        if (!isLoaded) {
            this.isFontLoading = true;
            m.redraw();
            try {
                await document.fonts.load(spec);
                if (fontObj.hasBold !== false) {
                    document.fonts.load(`400 48px "${fontName}"`);
                }
            } catch (e) {
                console.warn("Font yüklenirken hata:", fontName, e);
            } finally {
                this.isFontLoading = false;
                this.updateCanvasSync();
                m.redraw();
            }
        } else {
            this.isFontLoading = false;
            this.updateCanvasSync();
        }
    } else {
        this.updateCanvasSync();
    }

    setTimeout(() => { this.updateCanvasSync(); m.redraw(); }, 120);
    setTimeout(() => { this.updateCanvasSync(); m.redraw(); }, 400);
  }

  extractImagesFromPost() {
    const results = [];
    
    // 1. attrs üzerinden gelen görseller
    if (this.attrs.images && Array.isArray(this.attrs.images)) {
      this.attrs.images.forEach(img => {
        if (img) {
          const abs = this.getAbsoluteAssetUrl(img);
          if (!results.includes(abs)) results.push(abs);
        }
      });
    }

    if (this.attrs.imageUrl) {
      const abs = this.getAbsoluteAssetUrl(this.attrs.imageUrl);
      if (!results.includes(abs)) results.push(abs);
    }

    // 2. Post HTML içeriğinden ayrıştırma
    try {
      const html = this.attrs.post.contentHtml();
      const div = document.createElement('div');
      div.innerHTML = html;

      // a href linklerini tara (büyük görsel linkleri)
      const anchors = Array.from(div.querySelectorAll('a'));
      anchors.forEach(a => {
        const href = a.getAttribute('href');
        if (href && /\.(jpe?g|png|webp|gif)($|\?)/i.test(href)) {
          const abs = this.getAbsoluteAssetUrl(href);
          if (!results.includes(abs)) results.push(abs);
        }
      });

      // img etiketlerini tara
      const images = Array.from(div.querySelectorAll('img'));
      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src) {
          const parentA = img.closest('a');
          const parentHref = parentA ? parentA.getAttribute('href') : null;
          if (!parentHref || !/\.(jpe?g|png|webp|gif)($|\?)/i.test(parentHref)) {
            const abs = this.getAbsoluteAssetUrl(src);
            if (!results.includes(abs)) results.push(abs);
          }
        }
      });
    } catch(e) {
      console.warn("Görseller ayrıştırılamadı:", e);
    }

    return results;
  }

  extractPostDetails() {
    const post = this.attrs.post;
    const html = post.contentHtml() || "";
    const div = document.createElement("div");
    div.innerHTML = html;
    
    // 1. Liste öğelerini (ul li veya ol li) topla
    let items = Array.from(div.querySelectorAll("li")).map(e => e.innerText.trim()).filter(Boolean);
    
    // 2. Eğer li yoksa satır bazlı (blockquote, p veya br ayrımı) topla
    if (items.length === 0) {
      const paragraphs = Array.from(div.querySelectorAll("blockquote, p")).map(e => e.innerText.trim()).filter(Boolean);
      for (let p of paragraphs) {
        const lines = p.split('\n').map(l => l.replace(/^[>•\-\*]\s*/, '').trim()).filter(Boolean);
        if (lines.length >= 2) {
          items = lines;
          break;
        }
      }
    }

    let company = "";
    let plate = "";
    let model = "";
    let line1 = "";
    let line2 = "";
    let line3 = "";
    let isFourLineFormat = false;

    if (items.length >= 4) {
      // Kullanıcının belirttiği 4 Satırlı Format:
      // 1. satır: araç marka modeli (Örn: Otokar Kent LF)
      // 2. satır: araç kapı kodu ve plakası (Örn: B-1513 | 34 HO 2442)
      // 3. satır: aracın hattı (Örn: H-6 | Yunus Emre Mahallesi-İstanbul Havalimanı)
      // 4. satır: çekim yeri ve çekim yılı (Örn: İstanbul Havalimanı / '26)
      isFourLineFormat = true;
      model = items[0].trim();
      plate = items[1].trim();
      line1 = model;
      line2 = plate;
      line3 = items[2].trim() ? `${items[2].trim()} - ${items[3].trim()}` : items[3].trim();
      company = model; // Başlık modu için marka/model kullanılır
    } else {
      // Standart 3 Satırlı Format:
      // 1. satır: Şirket | Plaka
      // 2. satır: Model
      // 3. satır: Şehir / Konum
      line1 = items[0] || "";
      line2 = items[1] || "";
      line3 = items[2] || "";

      if (line1) {
        if (line1.includes("|")) {
          const parts = line1.split("|");
          company = parts[0].trim();
          plate = parts.slice(1).join("|").trim();
        } else {
          company = line1.trim();
        }
      }
      model = line2;
    }
    let city = items.length >= 4 ? items[items.length - 1].trim() : line3;

    // Yazar adı (formatlı)
    const user = post.user();
    let authorName = brand().name;
    if (user) {
      if (typeof user.displayName === 'function' && user.displayName()) {
        authorName = user.displayName();
      } else if (typeof user.username === 'function' && user.username()) {
        authorName = user.username();
      }
    }

    return {
        topicTitle: post.discussion() ? post.discussion().title() : "",
        companyName: company,
        modelName: model,
        plate: plate,
        city: city,
        line1: line1,
        line2: line2,
        line3: line3,
        authorName: authorName
    };
  }

  async fetchExifFromPHP(url) {
    if (!url) return;
    try {
        const fetchUrl = app.forum.attribute("baseUrl") + "/get_exif.php?url=" + encodeURIComponent(url);
        const res = await fetch(fetchUrl);
        const json = await res.json();
        if (json && json.success && json.data) {
            const data = json.data;
            let updated = false;
            if (data.camera && !this.exifData.camera) { this.exifData.camera = data.camera; updated = true; }
            if (data.lens && !this.exifData.lens) { this.exifData.lens = data.lens; updated = true; }
            if (data.shutter && !this.exifData.shutter) { this.exifData.shutter = data.shutter; updated = true; }
            if (data.aperture && !this.exifData.aperture) { this.exifData.aperture = data.aperture; updated = true; }
            if (data.iso && !this.exifData.iso) { this.exifData.iso = data.iso; updated = true; }
            if (data.focal && !this.exifData.focal) { this.exifData.focal = data.focal; updated = true; }
            if (updated) {
                m.redraw();
                this.updateCanvasSync();
            }
        }
    } catch (e) {
        console.warn("Sunucu üzerinden EXIF çekilemedi.", e);
    }
  }

  extractExifFromDOM() {
    const exif = { camera: "", lens: "", shutter: "", aperture: "", iso: "", focal: "" };
    try {
        const id = this.attrs.post.id();
        const node = document.querySelector('[data-id="' + id + '"]') || document.querySelector('.PostStream-item[data-id="' + id + '"]');
        if (!node) return exif;
        
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
        const texts = [];
        let n;
        while (n = walker.nextNode()) {
            const text = n.nodeValue.replace(/[\n\r]+|[\s]{2,}/g, " ").trim();
            if (text && text !== ":" && text !== "-") texts.push(text);
        }
        
        for (let i = 0; i < texts.length; i++) {
            const up = texts[i].toUpperCase();
            if (up === "KAMERA" || up === "GÖVDE") { if (texts[i+1]) exif.camera = texts[i+1]; }
            else if (up === "LENS") { if (texts[i+1]) exif.lens = texts[i+1]; }
            else if (up === "ENSTANTANE") { if (texts[i+1]) exif.shutter = texts[i+1]; }
            else if (up === "DİYAFRAM") { if (texts[i+1]) exif.aperture = texts[i+1]; }
            else if (up === "ISO") { if (texts[i+1]) exif.iso = texts[i+1]; }
            else if (up === "ODAK UZAKLIĞI") { if (texts[i+1]) exif.focal = texts[i+1]; }
        }
        
        const removeKeys = ["KAMERA", "LENS", "ENSTANTANE", "DİYAFRAM", "ISO", "ODAK UZAKLIĞI", "ÇEKİM TARİHİ", "FOTOĞRAF BİLGİLERİ"];
        for (let k in exif) {
            if (exif[k] && removeKeys.some(rk => exif[k].toUpperCase() === rk)) {
                exif[k] = "";
            }
        }
    } catch(e) {}
    return exif;
  }

  openFeedPicker() {
    app.modal.show(ForumFeedPickerModal, {
      existingImages: [...this.availableImages],
      onconfirm: (selectedUrls) => {
        app.modal.show(StoryModal, this.attrs);
        setTimeout(() => {
          if (app.modal.component && selectedUrls && selectedUrls.length > 0) {
            selectedUrls.forEach(url => {
              const abs = app.modal.component.getAbsoluteAssetUrl(url);
              if (!app.modal.component.availableImages.includes(abs)) {
                app.modal.component.availableImages.push(abs);
              }
            });
            app.modal.component.selectedImage = app.modal.component.getAbsoluteAssetUrl(selectedUrls[0]);
            app.modal.component.preloadAndDraw();
            m.redraw();
          }
        }, 100);
      }
    });
  }

  handleDeviceUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(f => {
      const url = URL.createObjectURL(f);
      if (!this.availableImages.includes(url)) {
        this.availableImages.push(url);
      }
    });
    this.selectedImage = this.availableImages[this.availableImages.length - 1];
    this.preloadAndDraw();
    e.target.value = '';
    m.redraw();
  }

  async fetchCanvaStatus() {
    this.canvaStatus.loading = true;
    m.redraw();
    try {
      const res = await app.request({
        method: 'GET',
        url: app.forum.attribute('apiUrl') + '/framio/social-share/canva/auth?action=status'
      });
      this.canvaStatus = { ...res, loading: false };
      if (this.canvaStatus.user_connected) {
        this.selectedCanvaAccount = 'user';
      } else if (this.canvaStatus.brand_connected) {
        this.selectedCanvaAccount = 'brand';
      }
    } catch(e) {
      this.canvaStatus.loading = false;
    }
    m.redraw();
  }

  async connectCanva(type = 'user') {
    const w = 600, h = 750;
    const left = (window.innerWidth - w) / 2 + window.screenX;
    const top = (window.innerHeight - h) / 2 + window.screenY;

    // Tarayıcı popup engelleyicisini aşmak için kullanıcı tıklaması anında hemen aç
    const win = window.open('about:blank', 'canva_oauth_window', `width=${w},height=${h},top=${top},left=${left},scrollbars=yes`);
    if (win && win.document) {
      try {
        win.document.write('<div style="font-family:system-ui,sans-serif;text-align:center;padding:50px 20px;color:#1e293b;"><div style="font-size:36px;margin-bottom:12px;">🎨</div><h3 style="margin:0 0 8px 0;color:#7d2ae8;">Canva Studio Pro</h3><p style="font-size:13px;color:#64748b;">Bağlantı başlatılıyor, lütfen bekleyin...</p></div>');
      } catch(de) {}
    }

    try {
      const res = await app.request({
        method: 'GET',
        url: app.forum.attribute('apiUrl') + `/framio/social-share/canva/auth?action=auth-url&account_type=${type}`
      });
      if (res && res.auth_url) {
        if (win && !win.closed) {
          win.location.href = res.auth_url;
        } else {
          window.open(res.auth_url, 'canva_oauth_window', `width=${w},height=${h},top=${top},left=${left},scrollbars=yes`);
        }

        // Pencere kapandığında durumu otomatik kontrol et
        const pollTimer = setInterval(() => {
          if (!win || win.closed) {
            clearInterval(pollTimer);
            setTimeout(() => this.fetchCanvaStatus(), 600);
          }
        }, 1000);
      } else {
        if (win) win.close();
        app.alerts.show({ type: 'error' }, 'Canva bağlantı adresi alınamadı.');
      }
    } catch(e) {
      if (win) win.close();
      const msg = (e && e.response && e.response.error) || 'Canva Client ID veya Secret henüz Admin Panelinde tanımlanmamış.';
      app.alerts.show({ type: 'error' }, msg);
    }
  }

  async disconnectCanva(type = 'user') {
    if (!confirm('Bu Canva hesabının bağlantısını kesmek istediğinize emin misiniz?')) return;
    try {
      await app.request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + `/framio/social-share/canva/disconnect?account_type=${type}`
      });
      await this.fetchCanvaStatus();
      this.canvaCurrentDesign = null;
      this.canvaExportedImage = null;
      m.redraw();
    } catch(e) {}
  }

  handleCanvaMessage(event) {
    if (event.data && event.data.type === 'CANVA_AUTH_SUCCESS') {
      this.fetchCanvaStatus();
      app.alerts.show({ type: 'success' }, 'Canva Pro hesabı başarıyla bağlandı!');
      m.redraw();
    }
  }

  handleCanvaStorage(event) {
    if (event.key === 'framio_canva_auth_event' && event.newValue) {
      try {
        const data = JSON.parse(event.newValue);
        if (data && data.success) {
          this.fetchCanvaStatus();
          app.alerts.show({ type: 'success' }, 'Canva Pro hesabı başarıyla bağlandı!');
          m.redraw();
        }
      } catch(e) {}
    }
  }

  async startCanvaDesign() {
    if (!this.selectedImage) return;
    this.canvaCreating = true;
    m.redraw();

    try {
      let finalImageUrl = this.getAbsoluteAssetUrl(this.selectedImage);

      // Eğer cihazdan yüklenen yerel blob ise base64'e çevirip gönder
      if (this.selectedImage.startsWith('blob:')) {
        try {
          const blobRes = await fetch(this.selectedImage);
          const blobData = await blobRes.blob();
          finalImageUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blobData);
          });
        } catch (be) {
          console.warn('Blob base64 dönüştürme hatası:', be);
        }
      }

      const res = await app.request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/framio/social-share/canva/design',
        body: {
          action: 'create',
          account_type: this.selectedCanvaAccount,
          image_url: finalImageUrl,
          title: this.customTitle || this.topicTitle || (brand().name + ' Hikayesi')
        }
      });

      if (res && res.success && res.edit_url) {
        this.canvaCurrentDesign = res;
        this.canvaExportedImage = null;
        window.open(res.edit_url, '_blank');
        app.alerts.show({ type: 'success' }, 'Fotoğraf Canva\'ya aktarıldı ve 9:16 Hikaye tasarımı açıldı!');
      } else {
        app.alerts.show({ type: 'error' }, res.error || 'Canva tasarımı başlatılamadı.');
      }
    } catch(e) {
      const msg = (e && e.response && e.response.error) || 'Canva işlem hatası oluştu.';
      app.alerts.show({ type: 'error' }, msg);
    } finally {
      this.canvaCreating = false;
      m.redraw();
    }
  }

  async exportCanvaDesign(format = 'png') {
    if (!this.canvaCurrentDesign || !this.canvaCurrentDesign.design_id) return;
    this.canvaExporting = true;
    this.canvaExportFormat = format;
    m.redraw();

    try {
      const res = await app.request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/framio/social-share/canva/design',
        body: {
          action: 'export',
          design_id: this.canvaCurrentDesign.design_id,
          format: format
        }
      });

      if (res && res.success && res.image_url) {
        this.canvaExportedImage = res.image_url;
        this.canvaExportedFormat = res.format || format;
        app.alerts.show({ type: 'success' }, (format === 'mp4' ? 'Animasyonlu MP4 videosu' : 'Tasarım görseli') + ' Canva\'dan başarıyla çekildi!');
      } else {
        app.alerts.show({ type: 'error' }, res.error || 'Tasarım dışa aktarılamadı.');
      }
    } catch(e) {
      const msg = (e && e.response && e.response.error) || 'Tasarım çekilirken hata oluştu.';
      app.alerts.show({ type: 'error' }, msg);
    } finally {
      this.canvaExporting = false;
      this.canvaExportFormat = null;
      m.redraw();
    }
  }

  loadGoogleFont(fontName) {
    if (!fontName) return Promise.resolve();
    const fontObj = (this.availableFonts || []).find(f => f.name === fontName) || { query: encodeURIComponent(fontName).replace(/%20/g, '+') };
    const query = fontObj.query || encodeURIComponent(fontName).replace(/%20/g, '+');
    const id = 'gf-' + fontName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
      document.head.appendChild(link);
    }

    if (document.fonts && document.fonts.load) {
      return document.fonts.load(`bold 24px "${fontName}"`)
        .then(() => document.fonts.ready)
        .catch(() => Promise.resolve());
    }
    return Promise.resolve();
  }

  className() {
    return "FramioStoryModal Modal--large";
  }

  title() {
    return "Hikaye Oluştur ve Paylaş";
  }

  view() {
    return (
      <div className={'Modal modal-dialog ' + this.className()}>
        <div className="Modal-content">
          
          {/* Modal Header */}
          <div className="Modal-header" style="position: relative; display: flex; align-items: center; justify-content: space-between; height: 64px; padding: 0 24px;">
            <div className="Header-Left" style="display: flex; align-items: center; z-index: 2;">
              {this.attrs.canGoBack ? (
                <button
                  type="button"
                  className="Button Button--icon"
                  title="Geri Dön"
                  onclick={() => {
                    app.modal.show(SocialActionChooserModal, {
                      post: this.attrs.post,
                      images: this.availableImages && this.availableImages.length > 0 ? this.availableImages : (this.attrs.images || []),
                      canShare: true,
                      canStory: true
                    });
                  }}
                  style="margin-right: 6px; width: 34px; height: 34px; border-radius: 8px; border: 1px solid #cbd5e1; background: #ffffff; color: #334155; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; transition: all 0.15s ease;"
                >
                  <i className="fas fa-arrow-left"></i>
                </button>
              ) : null}
            </div>

            <div className="Header-Title-Area" style="position: absolute; left: 0; right: 0; top: 0; bottom: 0; margin: auto; display: flex; align-items: center; justify-content: center; gap: 10px; pointer-events: none; z-index: 1;">
              <div className="Header-Icon" style="pointer-events: auto;">
                <i className="fas fa-mobile-screen-button"></i>
              </div>
              <div className="Header-Titles" style="pointer-events: auto;">
                <h3 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0;">Hikaye Oluştur ve Paylaş</h3>
              </div>
            </div>

            <div className="ModalClose" style="z-index: 2;">
              <button onclick={() => app.modal.close()} type="button" title="Kapat">
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>

          <div className="StoryModal-Wrapper">
            {this.content()}
          </div>
        </div>
      </div>
    );
  }

  content() {
    return (
      <div className="StoryModal-Content">
        
        {/* Üst Mod Seçici Barı */}
        <div className="StoryModal-TabBar">
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                <button 
                    type="button" 
                    onclick={() => { this.activeModeTab = 'native'; setTimeout(() => this.updateCanvasSync(), 50); }}
                    style={`padding: 7px 12px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; border: 1.5px solid ${this.activeModeTab === 'native' ? '#10b981' : '#cbd5e1'}; background: ${this.activeModeTab === 'native' ? '#ecfdf5' : '#ffffff'}; color: ${this.activeModeTab === 'native' ? '#065f46' : '#475569'};`}
                >
                    <i className="fas fa-bolt" style={`color: ${this.activeModeTab === 'native' ? '#10b981' : '#94a3b8'};`}></i> ⚡ Hızlı Hikaye Oluştur
                </button>

                <button 
                    type="button" 
                    onclick={() => { this.activeModeTab = 'canva'; }}
                    style={`padding: 7px 12px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; border: 1.5px solid ${this.activeModeTab === 'canva' ? '#7d2ae8' : '#cbd5e1'}; background: ${this.activeModeTab === 'canva' ? '#f5f3ff' : '#ffffff'}; color: ${this.activeModeTab === 'canva' ? '#6b21a8' : '#475569'};`}
                >
                    <i className="fas fa-palette" style={`color: ${this.activeModeTab === 'canva' ? '#7d2ae8' : '#94a3b8'};`}></i> 🎨 Canva ile Hikaye Oluştur
                </button>
            </div>

            {this.activeModeTab === 'canva' && (this.canvaStatus.brand_connected || this.canvaStatus.connected) ? (
                <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: #059669; font-weight: 700; background: #ecfdf5; padding: 4px 10px; border-radius: 20px; border: 1px solid #a7f3d0;">
                    <span>✨ Canva Pro: <strong>{this.canvaStatus.brand_profile ? this.canvaStatus.brand_profile.display_name : brand().name}</strong></span>
                </div>
            ) : null}
        </div>

        {/* Gövde Alanı */}
        <div className="StoryModal-BodyWrapper">
            {this.activeModeTab === 'native' ? this.renderNativeStudio() : this.renderCanvaStudio()}
        </div>
      </div>
    );
  }

  renderNativeStudio() {
    const bgInfo = (this.backgrounds && this.backgrounds.find(b => b.id === this.selectedBgId)) || { textColor: "#ffffff", id: "default" };
    return (
<div className="Modal-body" style="display: flex; flex-direction: row; height: 100%; width: 100%; overflow: hidden; background: #f8fafc; padding: 0; margin: 0;">
        
        {/* SOL: TASARIM ARAÇLARI */}
        <div className="Story-Sidebar" style="flex: 1.15; min-width: 330px; background: #ffffff; padding: 20px 24px; border-right: 1px solid #e2e8f0; height: 100%; overflow-y: auto; box-sizing: border-box;">
            
            {/* 1. Fotoğraf Seçimi */}
            <div className="Form-Group" style="margin-bottom: 18px; padding: 14px 16px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <label style="font-weight: 700; font-size: 13px; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 6px;">
                        <i className="fas fa-images" style="color: #10b981;"></i> Fotoğraf Seçimi ({this.availableImages.length})
                    </label>
                    
                    <div style="display: flex; gap: 6px;">
                        <input type="file" id="story-device-upload" accept="image/*" multiple style="display: none;" onchange={this.handleDeviceUpload.bind(this)} />
                        <button 
                            type="button" 
                            onclick={() => document.getElementById('story-device-upload').click()}
                            style="padding: 4px 8px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; cursor: pointer; display: flex; align-items: center; gap: 4px;"
                            title="Bilgisayarınızdan yeni fotoğraf yükleyin"
                        >
                            <i className="fas fa-upload" style="color: #6366f1;"></i> Cihazdan
                        </button>
                        <button 
                            type="button" 
                            onclick={() => this.openFeedPicker()}
                            style="padding: 4px 8px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; cursor: pointer; display: flex; align-items: center; gap: 4px;"
                            title="Forumun akışındaki diğer gönderilerden fotoğraf seçin"
                        >
                            <i className="fas fa-search" style="color: #3b82f6;"></i> Forumdan
                        </button>
                    </div>
                </div>

                <div className="Media-Grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 8px; margin-bottom: 12px; max-height: 140px; overflow-y: auto;">
                    {this.availableImages.map(img => {
                        const active = this.selectedImage === img;
                        const proxySrc = this.getProxiedImageUrl(img);
                        return (
                            <div 
                                style={`cursor: pointer; border-radius: 8px; overflow: hidden; border: 2.5px solid ${active ? '#10b981' : '#cbd5e1'}; opacity: ${active ? '1' : '0.6'}; transition: all 0.2s; aspect-ratio: 4/3; background: #e2e8f0;`} 
                                onclick={() => { this.selectedImage = img; this.preloadAndDraw(); }}
                            >
                                <img 
                                    src={proxySrc} 
                                    onerror={e => {
                                        if (e.target.src !== img) {
                                            e.target.src = img;
                                        }
                                    }}
                                    style="width: 100%; height: 100%; object-fit: cover; display: block;" 
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Fotoğraf Boyutu (Ölçek) */}
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; color: #475569; font-weight: 600;">
                    <span>Fotoğraf Boyutu (Ölçek)</span><span>%{Math.round((this.imageScale || 1.0) * 100)}</span>
                </div>
                <input 
                    type="range" 
                    min="0.6" 
                    max="1.5" 
                    step="0.02" 
                    value={this.imageScale || 1.0} 
                    style="width: 100%; margin-bottom: 8px; accent-color: #10b981;" 
                    oninput={e => { this.imageScale = parseFloat(e.target.value); this.updateCanvasSync(); }} 
                />

                {/* Fotoğrafı Dikey Kaydır (Y) */}
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; color: #475569; font-weight: 600;">
                    <span>Fotoğrafı Dikey Kaydır (Y)</span><span>{this.imageYOffset}px</span>
                </div>
                <input type="range" min="-600" max="600" value={this.imageYOffset} style="width: 100%; accent-color: #10b981;" oninput={e => { this.imageYOffset = parseInt(e.target.value); this.updateCanvasSync(); }} />
            </div>

            {/* 2. Arka Plan ve Tema Modu */}
            <div className="Form-Group" style="margin-bottom: 18px; padding: 14px 16px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #e2e8f0;">
                <label style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 8px; display: block;">
                    <i className="fas fa-palette" style="color: #3b82f6; margin-right: 6px;"></i> Arka Plan & Tema Modu
                </label>
                <select 
                    className="FormControl" 
                    value={this.selectedBgId} 
                    onchange={(e) => { this.selectedBgId = e.target.value; this.preloadAndDraw(); }}
                    style="border-radius: 8px; height: 38px; font-size: 13px; font-weight: 600;"
                >
                    {this.backgrounds.map(bg => <option value={bg.id}>{bg.name}</option>)}
                </select>
            </div>

            {/* 3. Fotoğraf Çerçevesi & Tasarım Stili */}
            <div className="Form-Group" style="margin-bottom: 18px; padding: 14px 16px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #e2e8f0;">
                <label style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 10px; display: block;">
                    <i className="fas fa-crop-simple" style="color: #8b5cf6; margin-right: 6px;"></i> Fotoğraf Çerçevesi & Tasarım Stili
                </label>
                
                <div style="margin-bottom: 12px;">
                    <span style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">Çerçeve & Kart Tipi</span>
                    <select 
                        className="FormControl" 
                        value={this.frameStyle} 
                        onchange={e => { 
                            this.frameStyle = e.target.value; 
                            m.redraw();
                            requestAnimationFrame(() => this.updateCanvasSync());
                        }} 
                        style="height: 38px; font-size: 12px; font-weight: 700; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff;"
                    >
                        <option value="modern">📱 Modern Dijital Kart (Köşeli / Yuvarlak)</option>
                        <option value="polaroid">📷 Klasik Polaroid Fotoğraf Kartı</option>
                        <option value="polaroid_tape">🏷️ Polaroid + Üstten Bantlı (Washi Tape)</option>
                        <option value="tape_corners">📌 4 Köşeden Bantlı Duvar Posteri (Washi Tape)</option>
                        <option value="vintage_card">🎞️ Nostaljik Vintage Film Kartı</option>
                    </select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div>
                        <span style="font-size: 11px; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Köşe Yuvarlama</span>
                        <select className="FormControl" value={this.imageCornerRadius} onchange={e => { this.imageCornerRadius = parseInt(e.target.value); this.updateCanvasSync(); m.redraw(); }} style="height: 34px; font-size: 12px; border-radius: 6px;">
                            <option value={0}>0px (Keskin Köşeli)</option>
                            <option value={14}>14px (Hafif Yuvarlak)</option>
                            <option value={24}>24px (Modern Yuvarlak)</option>
                            <option value={36}>36px (Ekstra Yuvarlak)</option>
                        </select>
                    </div>
                    <div>
                        <span style="font-size: 11px; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Gölge Derinliği</span>
                        <select className="FormControl" value={this.imageShadowStyle} onchange={e => { this.imageShadowStyle = e.target.value; this.updateCanvasSync(); m.redraw(); }} style="height: 34px; font-size: 12px; border-radius: 6px;">
                            <option value="deep">Derin 3D Gölge</option>
                            <option value="soft">Hafif Yumuşak Gölge</option>
                            <option value="none">Gölgesiz (Düz)</option>
                        </select>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; align-items: center;">
                    <label style="font-size: 12px; font-weight: 600; color: #334155; display: flex; align-items: center; gap: 6px; cursor: pointer;">
                        <input type="checkbox" checked={this.imageBorderWidth > 0} onclick={() => { this.imageBorderWidth = this.imageBorderWidth > 0 ? 0 : 4; this.updateCanvasSync(); }} />
                        <span>Beyaz İnce Kenarlık (Border) Ekle</span>
                    </label>
                </div>
            </div>

            {/* 4. İçerik & Tasarım Modu */}
            <div className="Form-Group" style="margin-bottom: 18px; padding: 14px 16px; background: #eef2ff; border-radius: 10px; border: 1.5px solid #c7d2fe;">
                <label style="font-weight: 700; font-size: 13px; color: #3730a3; margin-bottom: 8px; display: block;">
                    <i className="fas fa-camera" style="margin-right: 6px;"></i> İçerik & Tasarım Modu
                </label>
                <div style="display: flex; gap: 15px; margin-bottom: 8px;">
                    <label style="cursor: pointer; font-size: 13px; font-weight: 600; color: #1e1b4b; display: flex; align-items: center; gap: 5px;">
                        <input type="radio" name="sMode" checked={this.storyMode === "standard"} onclick={() => { this.storyMode = "standard"; this.updateCanvasSync(); }} /> Standart Başlık
                    </label>
                    <label style="cursor: pointer; font-size: 13px; font-weight: 600; color: #1e1b4b; display: flex; align-items: center; gap: 5px;">
                        <input type="radio" name="sMode" checked={this.storyMode === "exif"} onclick={() => { this.storyMode = "exif"; this.updateCanvasSync(); }} /> EXIF Fotoğraf Kartı
                    </label>
                </div>

                {this.storyMode === "exif" ? (
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #a5b4fc;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: 11px; font-weight: 700; color: #4338ca;">Kart Tasarım Stili</span>
                            <select 
                                className="FormControl" 
                                value={this.exifCardStyle} 
                                onchange={e => { this.exifCardStyle = e.target.value; this.updateCanvasSync(); }}
                                style="height: 28px; font-size: 11px; width: auto; padding: 2px 8px; border-radius: 6px;"
                            >
                                <option value="glass">✨ Buzlu Cam (Frosted Glass)</option>
                                <option value="solid">⬛ Opak Modern Kart</option>
                                <option value="bordered">🔲 Minimalist İnce Çerçeveli</option>
                            </select>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; color: #4338ca;">
                            <span>EXIF Kart Büyüklüğü (Ölçek)</span><span>%{Math.round(this.exifCardScale * 100)}</span>
                        </div>
                        <input 
                            type="range" 
                            min="1.0" 
                            max="1.25" 
                            step="0.02" 
                            value={this.exifCardScale} 
                            style="width: 100%; margin-bottom: 10px; accent-color: #6366f1;" 
                            oninput={e => { this.exifCardScale = parseFloat(e.target.value); this.updateCanvasSync(); }} 
                        />
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; color: #4338ca;">
                            <span>EXIF Kartı Konumu (Y)</span><span>{this.exifYOffset}px</span>
                        </div>
                        <input type="range" min="-400" max="400" value={this.exifYOffset} style="width: 100%; margin-bottom: 10px;" oninput={e => { this.exifYOffset = parseInt(e.target.value); this.updateCanvasSync(); }} />
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="font-size: 10px; font-weight: 700; color: #4338ca;">Kamera & Çekim Değerleri:</span>
                            <button 
                                type="button" 
                                className="Button Button--link" 
                                style="font-size: 10px; padding: 0; color: #4f46e5; text-decoration: none;"
                                onclick={() => this.fetchExifFromPHP(this.selectedImage)}
                            >
                                <i className="fas fa-sync-alt" style="margin-right: 3px;"></i> Bilgileri Yenile
                            </button>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                            <input className="FormControl" placeholder="Kamera" value={this.exifData.camera} oninput={e => { this.exifData.camera = e.target.value; this.updateCanvasSync(); }} style="height: 32px; font-size: 11px;" />
                            <input className="FormControl" placeholder="Lens" value={this.exifData.lens} oninput={e => { this.exifData.lens = e.target.value; this.updateCanvasSync(); }} style="height: 32px; font-size: 11px;" />
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
                            <input className="FormControl" placeholder="Enst." value={this.exifData.shutter} oninput={e => { this.exifData.shutter = e.target.value; this.updateCanvasSync(); }} style="height: 30px; font-size: 10px;" />
                            <input className="FormControl" placeholder="Diyaf." value={this.exifData.aperture} oninput={e => { this.exifData.aperture = e.target.value; this.updateCanvasSync(); }} style="height: 30px; font-size: 10px;" />
                            <input className="FormControl" placeholder="ISO" value={this.exifData.iso} oninput={e => { this.exifData.iso = e.target.value; this.updateCanvasSync(); }} style="height: 30px; font-size: 10px;" />
                            <input className="FormControl" placeholder="Odak" value={this.exifData.focal} oninput={e => { this.exifData.focal = e.target.value; this.updateCanvasSync(); }} style="height: 30px; font-size: 10px;" />
                        </div>
                    </div>
                ) : null}
            </div>

            {/* 5. Yazı Tipi & Tipografi (Google Fonts & Forum Fontu) */}
            <div className="Form-Group" style="margin-bottom: 18px; padding: 14px 16px; background: #fdf4ff; border-radius: 10px; border: 1.5px solid #f0abfc;">
                {/* Görünmez DOM Font Isıtıcı / Önyükleyici */}
                <div style="position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none;" aria-hidden="true">
                    {this.availableFonts ? this.availableFonts.map(f => (
                        <span style={`font-family: "${f.name}", sans-serif; font-weight: ${f.hasBold === false ? '400' : '700'};`}>
                            {brand().name} 1234567890
                        </span>
                    )) : null}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <label style="font-weight: 700; font-size: 13px; color: #86198f; margin: 0; display: flex; align-items: center; gap: 6px;">
                        <i className="fas fa-font" style="color: #c026d3;"></i> Yazı Tipi & Tipografi
                        {this.isFontLoading ? (
                            <span style="font-size: 10px; font-weight: 700; color: #c026d3; background: #fae8ff; padding: 2px 7px; border-radius: 8px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid #e879f9;">
                                <i className="fas fa-spinner fa-spin"></i> Yükleniyor...
                            </span>
                        ) : null}
                    </label>
                    <span style="font-size: 11px; font-weight: 700; color: #a21caf; background: #fae8ff; padding: 2px 8px; border-radius: 12px;">
                        {this.availableFonts ? this.availableFonts.length : 20}+ Font
                    </span>
                </div>

                {/* Font Dropdown (Kategorilere Göre Gruplandırılmış) */}
                <div style="margin-bottom: 10px;">
                    <select 
                        className="FormControl" 
                        value={this.selectedFontFamily} 
                        onchange={e => { 
                            this.selectedFontFamily = e.target.value; 
                            this.loadGoogleFont(this.selectedFontFamily);
                            this.updateCanvasSync(); 
                            m.redraw();
                        }}
                        style="height: 36px; font-size: 12px; font-weight: 600; border-radius: 8px; border: 1px solid #e879f9; background: #ffffff;"
                    >
                        {Array.from(new Set(this.availableFonts.map(f => f.category))).map(category => (
                            <optgroup label={category}>
                                {this.availableFonts.filter(f => f.category === category).map(font => (
                                    <option value={font.name} selected={this.selectedFontFamily === font.name}>{font.label}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>

                {/* Hızlı Seçim Butonları */}
                <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px;">
                    {["Exo 2", "Cairo", "Montserrat", "Bebas Neue", "Barlow Condensed", "Alfa Slab One", "Playfair Display", "Caveat"].map(fname => (
                        <button
                            type="button"
                            onclick={() => {
                                this.selectedFontFamily = fname;
                                this.loadGoogleFont(fname);
                                this.updateCanvasSync();
                                m.redraw();
                            }}
                            style={`padding: 3px 8px; font-size: 10px; font-weight: 700; border-radius: 6px; cursor: pointer; border: 1px solid ${this.selectedFontFamily === fname ? '#a21caf' : '#e2e8f0'}; background: ${this.selectedFontFamily === fname ? '#f5d0fe' : '#ffffff'}; color: ${this.selectedFontFamily === fname ? '#701a75' : '#475569'};`}
                        >
                            {fname}
                        </button>
                    ))}
                </div>

                {/* Font Kapsamı: Tüm Metinler vs Sadece Başlık */}
                <div style="background: rgba(255,255,255,0.7); padding: 8px 10px; border-radius: 8px; border: 1px solid #f5d0fe; margin-bottom: 10px;">
                    <div style="font-size: 11px; font-weight: 700; color: #701a75; margin-bottom: 5px;">Uygulama Kapsamı:</div>
                    <div style="display: flex; gap: 14px;">
                        <label style="cursor: pointer; font-size: 11px; font-weight: 600; color: #1e1b4b; display: flex; align-items: center; gap: 4px;">
                            <input 
                                type="radio" 
                                name="fontScope" 
                                checked={this.fontScope === 'all'} 
                                onclick={() => { this.fontScope = 'all'; this.updateCanvasSync(); }} 
                            /> 🌟 Tüm Metinler
                        </label>
                        <label style="cursor: pointer; font-size: 11px; font-weight: 600; color: #1e1b4b; display: flex; align-items: center; gap: 4px;">
                            <input 
                                type="radio" 
                                name="fontScope" 
                                checked={this.fontScope === 'title_only'} 
                                onclick={() => { this.fontScope = 'title_only'; this.updateCanvasSync(); }} 
                            /> Sadece Başlık
                        </label>
                    </div>
                </div>

                {/* Başlık Boyutu & Rengi & Efektler */}
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 4px; color: #701a75; font-weight: 600;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span>Başlık Punto (Yazı Boyutu):</span>
                        <span style="font-weight: 700;">{this.titleFontSize}px</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 10px; color: #701a75;">Başlık Rengi:</span>
                        <input 
                            type="color" 
                            value={this.titleColor || bgInfo.textColor || "#ffffff"} 
                            oninput={e => { this.titleColor = e.target.value; this.updateCanvasSync(); }} 
                            style="width: 24px; height: 24px; padding: 0; border: 1px solid #e879f9; border-radius: 4px; cursor: pointer;" 
                            title="Başlık Rengi"
                        />
                        {this.titleColor ? (
                            <button type="button" className="Button Button--link" style="font-size: 9px; padding: 0 3px; color: #ef4444;" onclick={() => { this.titleColor = ""; this.updateCanvasSync(); }} title="Rengi Sıfırla">✕</button>
                        ) : null}
                    </div>
                </div>
                <input 
                    type="range" 
                    min="36" 
                    max="88" 
                    value={this.titleFontSize} 
                    style="width: 100%; accent-color: #c026d3; margin-bottom: 10px;" 
                    oninput={e => { this.titleFontSize = parseInt(e.target.value); this.updateCanvasSync(); }} 
                />

                <div style="display: flex; gap: 14px; align-items: center; font-size: 11px; font-weight: 600; color: #4a044e;">
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;" title="Sadece başlık metninin harflerini büyütür">
                        <input 
                            type="checkbox" 
                            checked={this.titleIsUppercase} 
                            onclick={() => { this.titleIsUppercase = !this.titleIsUppercase; this.updateCanvasSync(); }} 
                        /> 🔤 Başlığı Tümü Büyük Harf Yap
                    </label>

                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;" title="Tüm metinlerin okunabilirliğini ve kontrastını artıran derin metin gölgesi">
                        <input 
                            type="checkbox" 
                            checked={this.textShadowEnabled} 
                            onclick={() => { this.textShadowEnabled = !this.textShadowEnabled; this.updateCanvasSync(); }} 
                        /> 🌓 Akıllı Metin Gölgesi (Tümü)
                    </label>
                </div>
            </div>

            {/* 6. Başlık İçeriği */}
            <div className="Form-Group" style="margin-bottom: 18px; padding: 14px 16px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #e2e8f0;">
                <label style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 8px; display: block;">
                    <i className="fas fa-heading" style="color: #64748b; margin-right: 6px;"></i> Başlık İçeriği
                </label>
                <div style="display: flex; gap: 12px; margin-bottom: 8px;">
                    <label style="cursor: pointer; font-size: 12px; font-weight: 600;">
                        <input type="radio" name="tMode" checked={this.titleMode === "company"} onclick={() => { this.titleMode = "company"; this.customTitle = this.companyTitle; this.updateCanvasSync(); }} /> Şirket
                    </label>
                    <label style="cursor: pointer; font-size: 12px; font-weight: 600;">
                        <input type="radio" name="tMode" checked={this.titleMode === "topic"} onclick={() => { this.titleMode = "topic"; this.customTitle = this.topicTitle; this.updateCanvasSync(); }} /> Konu
                    </label>
                    <label style="cursor: pointer; font-size: 12px; font-weight: 600;">
                        <input type="radio" name="tMode" checked={this.titleMode === "custom"} onclick={() => { this.titleMode = "custom"; this.customTitle = ""; this.updateCanvasSync(); }} /> Özel
                    </label>
                </div>
                <textarea className="FormControl" style="margin-bottom: 8px; height: 50px; font-size: 12px; font-weight: 600; resize: none;" value={this.customTitle} oninput={e => { this.customTitle = e.target.value; this.updateCanvasSync(); }}></textarea>
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; color: #64748b;">
                    <span>Başlık Konumu (Y)</span><span>{this.titleYOffset}px</span>
                </div>
                <input type="range" min="-400" max="400" value={this.titleYOffset} style="width: 100%;" oninput={e => { this.titleYOffset = parseInt(e.target.value); this.updateCanvasSync(); }} />
            </div>

            {/* 7. Künye Bilgisi */}
            <div className="Form-Group" style="margin-bottom: 18px; padding: 14px 16px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <label style="font-weight: 700; font-size: 13px; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 6px;">
                        <i className="fas fa-id-badge" style="color: #0284c7;"></i> Künye Bilgisi
                    </label>
                    <label style="cursor: pointer; font-size: 12px; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 4px;">
                        <input type="checkbox" checked={this.showPlateBadge} onclick={() => { this.showPlateBadge = !this.showPlateBadge; this.updateCanvasSync(); }} /> Rozeti / Künyeyi Göster
                    </label>
                </div>

                {this.showPlateBadge ? (
                    <div>
                        {/* Künye Hizalama & Ortak Ayarlar */}
                        <div style="margin-bottom: 10px; padding: 8px 10px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
                            {/* Künye Özel Font Seçimi */}
                            <div style="margin-bottom: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <span style="font-size: 11px; font-weight: 700; color: #334155;">Künye Yazı Tipi (Font):</span>
                                    {this.badgeFontFamily ? (
                                        <button 
                                            type="button" 
                                            className="Button Button--link" 
                                            style="font-size: 10px; padding: 0; color: #0284c7;" 
                                            onclick={() => { this.badgeFontFamily = ""; this.updateCanvasSync(); }}
                                        >
                                            Genel Fonta Bağla
                                        </button>
                                    ) : (
                                        <span style="font-size: 10px; color: #64748b; font-style: italic;">Genel fontu kullanıyor</span>
                                    )}
                                </div>
                                <select 
                                    className="FormControl" 
                                    value={this.badgeFontFamily || ""} 
                                    onchange={e => { 
                                        this.badgeFontFamily = e.target.value; 
                                        if (this.badgeFontFamily) this.loadGoogleFont(this.badgeFontFamily);
                                        this.updateCanvasSync(); 
                                    }}
                                    style="height: 30px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff;"
                                >
                                    <option value="">⚙️ Genel Font ({this.selectedFontFamily || 'Exo 2'})</option>
                                    {Array.from(new Set(this.availableFonts.map(f => f.category))).map(category => (
                                        <optgroup label={category}>
                                            {this.availableFonts.filter(f => f.category === category).map(font => (
                                                <option value={font.name} selected={this.badgeFontFamily === font.name}>{font.label}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="font-size: 11px; font-weight: 700; color: #334155;">Hizalama:</span>
                                <div className="ButtonGroup" style="display: flex; gap: 2px;">
                                    <button 
                                        type="button" 
                                        className={`Button Button--small ${this.badgeAlign === 'left' ? 'Button--primary' : ''}`}
                                        style="font-size: 11px; padding: 2px 8px;"
                                        onclick={() => { this.badgeAlign = 'left'; this.updateCanvasSync(); }}
                                        title="Sola Yasla"
                                    >
                                        <i className="fas fa-align-left"></i> Sola
                                    </button>
                                    <button 
                                        type="button" 
                                        className={`Button Button--small ${this.badgeAlign === 'center' ? 'Button--primary' : ''}`}
                                        style="font-size: 11px; padding: 2px 8px;"
                                        onclick={() => { this.badgeAlign = 'center'; this.updateCanvasSync(); }}
                                        title="Ortala"
                                    >
                                        <i className="fas fa-align-center"></i> Ortalı
                                    </button>
                                    <button 
                                        type="button" 
                                        className={`Button Button--small ${this.badgeAlign === 'right' ? 'Button--primary' : ''}`}
                                        style="font-size: 11px; padding: 2px 8px;"
                                        onclick={() => { this.badgeAlign = 'right'; this.updateCanvasSync(); }}
                                        title="Sağa Yasla"
                                    >
                                        <i className="fas fa-align-right"></i> Sağa
                                    </button>
                                </div>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
                                <span style="font-size: 11px; font-weight: 700; color: #334155;">Tüm Künye İçin Ortak Ayar:</span>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="font-size: 10px; color: #64748b;">Punto:</span>
                                    <span style="font-size: 10px; font-weight: 700;">{this.commonBadgeFontSize || 21}px</span>
                                    <input 
                                        type="color" 
                                        value={this.commonBadgeColor || (bgInfo.textColor !== "#111111" ? "#ffffff" : "#0f172a")} 
                                        oninput={e => { 
                                            this.commonBadgeColor = e.target.value; 
                                            this.badgeLine1Color = e.target.value;
                                            this.badgeLine2Color = e.target.value;
                                            this.badgeLine3Color = e.target.value;
                                            if (this.photographerPlacement === 'same_line') {
                                                this.creditsColor = e.target.value;
                                            }
                                            this.updateCanvasSync(); 
                                        }} 
                                        style="width: 22px; height: 22px; padding: 0; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;" 
                                        title="Ortak Renk Uygula" 
                                    />
                                    {this.commonBadgeColor ? (
                                        <button 
                                            type="button" 
                                            className="Button Button--link" 
                                            style="font-size: 9px; padding: 0 2px; color: #ef4444;" 
                                            onclick={() => { 
                                                this.commonBadgeColor = ""; 
                                                this.badgeLine1Color = ""; 
                                                this.badgeLine2Color = ""; 
                                                this.badgeLine3Color = ""; 
                                                this.creditsColor = ""; 
                                                this.updateCanvasSync(); 
                                            }} 
                                            title="Ortak Rengi Sıfırla"
                                        >✕</button>
                                    ) : null}
                                </div>
                            </div>
                            <input 
                                type="range" 
                                min="14" 
                                max="34" 
                                value={this.commonBadgeFontSize || 21} 
                                style="width: 100%; margin-top: 4px;" 
                                oninput={e => { 
                                    const val = parseInt(e.target.value); 
                                    this.commonBadgeFontSize = val; 
                                    this.badgeLine1Size = val;
                                    this.badgeLine2Size = val;
                                    this.badgeLine3Size = val;
                                    if (this.photographerPlacement === 'same_line') {
                                        this.creditsSize = val;
                                    }
                                    this.updateCanvasSync(); 
                                }} 
                            />
                        </div>

                        {/* 1. Satır: Şirket & Plaka */}
                        <div style="margin-bottom: 8px; padding: 6px 8px; background: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <label style="font-size: 11px; font-weight: 700; color: #334155; margin: 0; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                                    <input type="checkbox" checked={this.showBadgeLine1 !== false} onclick={() => { this.showBadgeLine1 = this.showBadgeLine1 === false ? true : false; this.updateCanvasSync(); }} /> 1. Satır (Şirket & Plaka):
                                </label>
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span style="font-size: 10px; color: #64748b;">Punto:</span>
                                    <span style="font-size: 10px; font-weight: 700;">{this.badgeLine1Size || 21}px</span>
                                    <input type="color" value={this.badgeLine1Color || this.commonBadgeColor || bgInfo.textColor || "#ffffff"} oninput={e => { this.badgeLine1Color = e.target.value; this.updateCanvasSync(); }} style="width: 20px; height: 20px; padding: 0; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; margin-left: 4px;" title="1. Satır Rengi" />
                                    {this.badgeLine1Color ? <button type="button" className="Button Button--link" style="font-size: 9px; padding: 0 2px; color: #ef4444;" onclick={() => { this.badgeLine1Color = ""; this.updateCanvasSync(); }} title="Rengi Sıfırla">✕</button> : null}
                                </div>
                            </div>
                            <input className="FormControl" style="height: 30px; font-size: 11px; font-weight: 600; margin-bottom: 4px;" value={this.badgeLine1} oninput={e => { this.badgeLine1 = e.target.value; this.updateCanvasSync(); }} placeholder="Örn: Kamil Koç | 34 ABC 01" />
                            <input type="range" min="14" max="38" value={this.badgeLine1Size || 21} style="width: 100%;" oninput={e => { this.badgeLine1Size = parseInt(e.target.value); this.updateCanvasSync(); }} />
                        </div>

                        {/* 2. Satır: Araç Modeli */}
                        <div style="margin-bottom: 8px; padding: 6px 8px; background: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <label style="font-size: 11px; font-weight: 700; color: #334155; margin: 0; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                                    <input type="checkbox" checked={this.showBadgeLine2 !== false} onclick={() => { this.showBadgeLine2 = this.showBadgeLine2 === false ? true : false; this.updateCanvasSync(); }} /> 2. Satır (Araç Modeli):
                                </label>
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span style="font-size: 10px; color: #64748b;">Punto:</span>
                                    <span style="font-size: 10px; font-weight: 700;">{this.badgeLine2Size || 21}px</span>
                                    <input type="color" value={this.badgeLine2Color || this.commonBadgeColor || (bgInfo.textColor !== "#111111" ? "#e2e8f0" : "#334155")} oninput={e => { this.badgeLine2Color = e.target.value; this.updateCanvasSync(); }} style="width: 20px; height: 20px; padding: 0; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; margin-left: 4px;" title="2. Satır Rengi" />
                                    {this.badgeLine2Color ? <button type="button" className="Button Button--link" style="font-size: 9px; padding: 0 2px; color: #ef4444;" onclick={() => { this.badgeLine2Color = ""; this.updateCanvasSync(); }} title="Rengi Sıfırla">✕</button> : null}
                                </div>
                            </div>
                            <input className="FormControl" style="height: 30px; font-size: 11px; margin-bottom: 4px;" value={this.badgeLine2} oninput={e => { this.badgeLine2 = e.target.value; this.updateCanvasSync(); }} placeholder="Örn: Mercedes-Benz Travego 16 SHD" />
                            <input type="range" min="14" max="34" value={this.badgeLine2Size || 21} style="width: 100%;" oninput={e => { this.badgeLine2Size = parseInt(e.target.value); this.updateCanvasSync(); }} />
                        </div>

                        {/* 3. Satır: Şehir / Konum */}
                        <div style="margin-bottom: 8px; padding: 6px 8px; background: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <label style="font-size: 11px; font-weight: 700; color: #334155; margin: 0; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                                    <input type="checkbox" checked={this.showBadgeLine3 !== false} onclick={() => { this.showBadgeLine3 = this.showBadgeLine3 === false ? true : false; this.updateCanvasSync(); }} /> 3. Satır (Şehir / Konum):
                                </label>
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span style="font-size: 10px; color: #64748b;">Punto:</span>
                                    <span style="font-size: 10px; font-weight: 700;">{this.badgeLine3Size || 21}px</span>
                                    <input type="color" value={this.badgeLine3Color || this.commonBadgeColor || (bgInfo.textColor !== "#111111" ? "#94a3b8" : "#64748b")} oninput={e => { this.badgeLine3Color = e.target.value; this.updateCanvasSync(); }} style="width: 20px; height: 20px; padding: 0; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; margin-left: 4px;" title="3. Satır Rengi" />
                                    {this.badgeLine3Color ? <button type="button" className="Button Button--link" style="font-size: 9px; padding: 0 2px; color: #ef4444;" onclick={() => { this.badgeLine3Color = ""; this.updateCanvasSync(); }} title="Rengi Sıfırla">✕</button> : null}
                                </div>
                            </div>
                            <input className="FormControl" style="height: 30px; font-size: 11px; margin-bottom: 4px;" value={this.badgeLine3} oninput={e => { this.badgeLine3 = e.target.value; this.updateCanvasSync(); }} placeholder="Örn: İstanbul - 15 Temmuz Demokrasi Otogarı" />
                            <input type="range" min="12" max="32" value={this.badgeLine3Size || 21} style="width: 100%;" oninput={e => { this.badgeLine3Size = parseInt(e.target.value); this.updateCanvasSync(); }} />
                        </div>

                        {/* Fotoğrafçı / Yazar Künyesi - 3 Opsiyonlu */}
                        <div style="margin-bottom: 8px; padding: 8px 10px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="margin-bottom: 6px;">
                                <label style="font-size: 11px; font-weight: 700; color: #334155; margin: 0 0 6px 0; display: block;">
                                    Fotoğrafçı / Yazar Bilgisi Yerleşimi:
                                </label>
                                <div style="display: flex; flex-direction: column; gap: 5px; font-size: 11px;">
                                    <label style="cursor: pointer; display: flex; align-items: center; gap: 6px; margin: 0; font-weight: 600; color: #1e293b;">
                                        <input 
                                            type="radio" 
                                            name="photoPlacement" 
                                            checked={this.photographerPlacement === 'same_line'} 
                                            onclick={() => { 
                                                this.photographerPlacement = 'same_line'; 
                                                this.updateCanvasSync(); 
                                            }} 
                                        /> 
                                        <span>📍 3. Satır İle Aynı Satırda <span style="font-size: 10px; color: #64748b; font-weight: normal;">(Aynı renk & ortak punto ile)</span></span>
                                    </label>
                                    <label style="cursor: pointer; display: flex; align-items: center; gap: 6px; margin: 0; font-weight: 600; color: #1e293b;">
                                        <input 
                                            type="radio" 
                                            name="photoPlacement" 
                                            checked={this.photographerPlacement === 'separate_line'} 
                                            onclick={() => { 
                                                this.photographerPlacement = 'separate_line'; 
                                                this.updateCanvasSync(); 
                                            }} 
                                        /> 
                                        <span>↵ 4. Satır Olarak Alta Ekle <span style="font-size: 10px; color: #0284c7; font-weight: normal;">(Bağımsız punto, renk & konum)</span></span>
                                    </label>
                                    <label style="cursor: pointer; display: flex; align-items: center; gap: 6px; margin: 0; font-weight: 600; color: #ef4444;">
                                        <input 
                                            type="radio" 
                                            name="photoPlacement" 
                                            checked={this.photographerPlacement === 'hidden'} 
                                            onclick={() => { 
                                                this.photographerPlacement = 'hidden'; 
                                                this.updateCanvasSync(); 
                                            }} 
                                        /> 
                                        <span>🚫 Fotoğrafçı Bilgisini Gizle</span>
                                    </label>
                                </div>
                            </div>

                            {this.photographerPlacement !== 'hidden' ? (
                                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <span style="font-size: 11px; font-weight: 600; color: #475569;">Fotoğrafçı Metni:</span>
                                        {this.photographerPlacement === 'separate_line' ? (
                                            <div style="display: flex; align-items: center; gap: 4px;">
                                                <span style="font-size: 10px; color: #64748b;">Punto:</span>
                                                <span style="font-size: 10px; font-weight: 700;">{this.creditsSize || 21}px</span>
                                                <input 
                                                    type="color" 
                                                    value={this.creditsColor || (bgInfo.textColor !== "#111111" ? "#cbd5e1" : "#475569")} 
                                                    oninput={e => { this.creditsColor = e.target.value; this.updateCanvasSync(); }} 
                                                    style="width: 20px; height: 20px; padding: 0; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; margin-left: 4px;" 
                                                    title="Fotoğrafçı Rengi" 
                                                />
                                                {this.creditsColor ? (
                                                    <button 
                                                        type="button" 
                                                        className="Button Button--link" 
                                                        style="font-size: 9px; padding: 0 2px; color: #ef4444;" 
                                                        onclick={() => { this.creditsColor = ""; this.updateCanvasSync(); }} 
                                                        title="Rengi Sıfırla"
                                                    >✕</button>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <span style="font-size: 10px; color: #64748b; font-style: italic;">3. Satır ayarları geçerlidir</span>
                                        )}
                                    </div>
                                    <input 
                                        className="FormControl" 
                                        style="height: 30px; font-size: 11px; margin-bottom: 4px;" 
                                        value={this.creditsText} 
                                        oninput={e => { this.creditsText = e.target.value; this.updateCanvasSync(); }} 
                                        placeholder={'Örn: 📸 ' + brand().name} 
                                    />
                                    {this.photographerPlacement === 'separate_line' ? (
                                        <div>
                                            <input 
                                                type="range" 
                                                min="12" 
                                                max="36" 
                                                value={this.creditsSize || 21} 
                                                style="width: 100%; margin-bottom: 6px;" 
                                                oninput={e => { this.creditsSize = parseInt(e.target.value); this.updateCanvasSync(); }} 
                                            />
                                            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-bottom: 2px;">
                                                <span>Fotoğrafçı Dikey Ofseti (Y)</span>
                                                <span>{this.creditsYOffset}px</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="-40" 
                                                max="60" 
                                                value={this.creditsYOffset} 
                                                style="width: 100%; margin-bottom: 6px;" 
                                                oninput={e => { this.creditsYOffset = parseInt(e.target.value); this.updateCanvasSync(); }} 
                                            />
                                            <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 10px; font-weight: 600; color: #475569;">
                                                <label style="cursor: pointer; display: flex; align-items: center; gap: 3px;">
                                                    <input type="checkbox" checked={this.creditsIsBold} onclick={() => { this.creditsIsBold = !this.creditsIsBold; this.updateCanvasSync(); }} /> Kalın (Bold)
                                                </label>
                                                <label style="cursor: pointer; display: flex; align-items: center; gap: 3px;">
                                                    <input type="checkbox" checked={this.creditsIsItalic} onclick={() => { this.creditsIsItalic = !this.creditsIsItalic; this.updateCanvasSync(); }} /> İtalik
                                                </label>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>

                        {/* Künye Konumu (Y) */}
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 6px; margin-bottom: 2px; color: #64748b;">
                            <span>Künye Dikey Konumu (Y)</span><span>{this.badgeYOffset}px</span>
                        </div>
                        <input type="range" min="-300" max="300" value={this.badgeYOffset} style="width: 100%;" oninput={e => { this.badgeYOffset = parseInt(e.target.value); this.updateCanvasSync(); }} />
                    </div>
                ) : null}
            </div>

            {/* 8. Alt Çağrı & Yönlendirme Metni */}
            <div className="Form-Group" style="margin-bottom: 18px; padding: 14px 16px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <label style="font-weight: 700; font-size: 13px; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 6px;">
                        <i className="fas fa-bullhorn" style="color: #6366f1;"></i> Alt Çağrı & Yönlendirme Metni
                    </label>
                    <label style="cursor: pointer; font-size: 12px; font-weight: 600; margin: 0;">
                        <input type="checkbox" checked={this.showFooterText} onclick={() => { this.showFooterText = !this.showFooterText; this.updateCanvasSync(); }} /> Göster
                    </label>
                </div>
                {this.showFooterText ? (
                    <div>
                        {/* Alt Metin Yazı Tipi (Font) */}
                        <div style="margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                                <span style="font-size: 11px; font-weight: 600; color: #64748b;">Yazı Tipi (Font):</span>
                                {this.footerFontFamily ? (
                                    <button 
                                        type="button" 
                                        className="Button Button--link" 
                                        style="font-size: 10px; padding: 0; color: #6366f1;" 
                                        onclick={() => { this.footerFontFamily = ""; this.updateCanvasSync(); }}
                                    >
                                        Genel Fonta Bağla
                                    </button>
                                ) : (
                                    <span style="font-size: 10px; color: #94a3b8; font-style: italic;">Genel fontu kullanıyor</span>
                                )}
                            </div>
                            <select 
                                className="FormControl" 
                                value={this.footerFontFamily || ""} 
                                onchange={e => { 
                                    this.footerFontFamily = e.target.value; 
                                    if (this.footerFontFamily) this.loadGoogleFont(this.footerFontFamily);
                                    this.updateCanvasSync(); 
                                }}
                                style="height: 30px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff;"
                            >
                                <option value="">⚙️ Genel Font ({this.selectedFontFamily || 'Exo 2'})</option>
                                {Array.from(new Set(this.availableFonts.map(f => f.category))).map(category => (
                                    <optgroup label={category}>
                                        {this.availableFonts.filter(f => f.category === category).map(font => (
                                            <option value={font.name} selected={this.footerFontFamily === font.name}>{font.label}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>

                        <div style="margin-bottom: 8px;">
                            <span style="font-size: 11px; font-weight: 600; color: #64748b; display: block; margin-bottom: 3px;">Özelleştirilebilir Metin:</span>
                            <input 
                                className="FormControl" 
                                style="height: 32px; font-size: 12px; font-weight: 600;" 
                                value={this.customFooterText || "Daha Fazlası İçin:"} 
                                oninput={e => { this.customFooterText = e.target.value; this.updateCanvasSync(); }} 
                                placeholder="Örn: Daha Fazlası İçin:"
                            />
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 4px; color: #64748b;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span>Metin Boyutu:</span>
                                <span style="font-weight: 700; color: #0f172a;">{this.footerFontSize || 44}px</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 10px;">Renk:</span>
                                <input 
                                    type="color" 
                                    value={this.footerTextColor || bgInfo.textColor || "#ffffff"} 
                                    oninput={e => { this.footerTextColor = e.target.value; this.updateCanvasSync(); }} 
                                    style="width: 22px; height: 22px; padding: 0; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;" 
                                    title="Metin Rengi"
                                />
                                {this.footerTextColor ? (
                                    <button type="button" className="Button Button--link" style="font-size: 9px; padding: 0 3px; color: #ef4444;" onclick={() => { this.footerTextColor = ""; this.updateCanvasSync(); }} title="Rengi Sıfırla">✕</button>
                                ) : null}
                            </div>
                        </div>
                        <input 
                            type="range" 
                            min="24" 
                            max="64" 
                            value={this.footerFontSize || 44} 
                            style="width: 100%; margin-bottom: 8px;" 
                            oninput={e => { this.footerFontSize = parseInt(e.target.value); this.updateCanvasSync(); }} 
                        />
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; color: #64748b;">
                            <span>Metin Konumu (Y)</span><span>{this.footerYOffset}px</span>
                        </div>
                        <input type="range" min="-400" max="400" value={this.footerYOffset} style="width: 100%;" oninput={e => { this.footerYOffset = parseInt(e.target.value); this.updateCanvasSync(); }} />
                    </div>
                ) : null}
            </div>

            {/* 9. Meta'da Paylaş & Planla & Aksiyon Butonları */}
            <div className="Action-Area" style="margin-top: 15px; padding-top: 15px; border-top: 1.5px solid #e2e8f0; display: flex; flex-direction: column; gap: 12px;">
                
                {/* 9. META HİKAYE YAYINLAMA & ZAMANLAMA ALANI (Yetkili Kullanıcılar) */}
                {this.canPublishMetaStory() && (
                    <div className="Meta-Publish-Section" style="padding: 14px; background: #f0f7ff; border-radius: 10px; border: 1.5px solid #bfdbfe;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <span style="font-weight: 700; font-size: 13px; color: #1e3a8a; display: flex; align-items: center; gap: 6px;">
                                <i className="fab fa-meta" style="color: #0081fb;"></i> Meta'da Paylaş & Planla
                            </span>
                            <span style="font-size: 10px; font-weight: 700; color: #2563eb; background: #dbeafe; padding: 2px 8px; border-radius: 12px; text-transform: uppercase;">
                                Story API
                            </span>
                        </div>

                        {/* Hesap Seçimi */}
                        {this.accounts && this.accounts.length > 1 && (
                            <div style="margin-bottom: 10px;">
                                <label style="font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 4px; display: block;">Sosyal Medya Hesabı:</label>
                                <select 
                                    className="FormControl" 
                                    style="font-size: 12px; height: 32px; border-radius: 6px;"
                                    value={this.selectedStoryAccountIndex}
                                    onchange={e => { this.selectedStoryAccountIndex = parseInt(e.target.value); m.redraw(); }}
                                >
                                    {this.accounts.map((acc, idx) => (
                                        <option value={idx}>{acc.name || `Hesap #${idx+1}`}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Hedef Platform Checkboxları */}
                        <div style="display: flex; gap: 12px; margin-bottom: 10px; background: #ffffff; padding: 8px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #1e293b; cursor: pointer; margin: 0;">
                                <input 
                                    type="checkbox" 
                                    checked={this.storyPublishIg} 
                                    onchange={e => { this.storyPublishIg = e.target.checked; m.redraw(); }} 
                                />
                                <i className="fab fa-instagram" style="color: #e1306c; font-size: 14px;"></i> Instagram Story
                            </label>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #1e293b; cursor: pointer; margin: 0;">
                                <input 
                                    type="checkbox" 
                                    checked={this.storyPublishFb} 
                                    onchange={e => { this.storyPublishFb = e.target.checked; m.redraw(); }} 
                                />
                                <i className="fab fa-facebook" style="color: #1877f2; font-size: 14px;"></i> Facebook Story
                            </label>
                        </div>

                        {/* Zamanlayıcı Aç/Kapat */}
                        <div style="margin-bottom: 10px;">
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #1e3a8a; cursor: pointer; margin: 0;">
                                <input 
                                    type="checkbox" 
                                    checked={this.storyScheduleEnabled} 
                                    onchange={e => { this.storyScheduleEnabled = e.target.checked; m.redraw(); }} 
                                />
                                <i className="fas fa-clock" style="color: #6366f1;"></i> İleri Bir Tarihe Planla (Zamanlayıcı)
                            </label>

                            {this.storyScheduleEnabled && (
                                <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; margin-top: 8px;">
                                    <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;">
                                        <button type="button" className="Button Button--link" style="font-size: 11px; padding: 2px 6px; background: #f1f5f9; border-radius: 4px; border: 1px solid #e2e8f0; color: #334155;" onclick={() => this.setStorySchedulePreset(2)}>+2 Saat</button>
                                        <button type="button" className="Button Button--link" style="font-size: 11px; padding: 2px 6px; background: #f1f5f9; border-radius: 4px; border: 1px solid #e2e8f0; color: #334155;" onclick={() => this.setStorySchedulePreset(4)}>+4 Saat</button>
                                        <button type="button" className="Button Button--link" style="font-size: 11px; padding: 2px 6px; background: #f1f5f9; border-radius: 4px; border: 1px solid #e2e8f0; color: #334155;" onclick={() => this.setStorySchedulePreset(0, 20, 0)}>Bu Akşam 20:00</button>
                                        <button type="button" className="Button Button--link" style="font-size: 11px; padding: 2px 6px; background: #f1f5f9; border-radius: 4px; border: 1px solid #e2e8f0; color: #334155;" onclick={() => this.setStorySchedulePreset(24, 10, 0)}>Yarın 10:00</button>
                                        <button type="button" className="Button Button--link" style="font-size: 11px; padding: 2px 6px; background: #f1f5f9; border-radius: 4px; border: 1px solid #e2e8f0; color: #334155;" onclick={() => this.setStorySchedulePreset(24, 20, 0)}>Yarın 20:00</button>
                                    </div>

                                    <div style="display: flex; gap: 6px; align-items: center;">
                                        <input 
                                            type="date" 
                                            className="FormControl" 
                                            style="font-size: 11px; padding: 4px 6px; height: 30px; border-radius: 6px; flex: 1.4;" 
                                            value={this.storyScheduleDate} 
                                            oninput={e => { this.storyScheduleDate = e.target.value; m.redraw(); }} 
                                        />
                                        <select 
                                            className="FormControl" 
                                            style="font-size: 11px; padding: 4px; height: 30px; border-radius: 6px; flex: 1;" 
                                            value={this.storyScheduleHour} 
                                            onchange={e => { this.storyScheduleHour = e.target.value; m.redraw(); }}
                                        >
                                            {Array.from({ length: 24 }).map((_, i) => {
                                                const val = String(i).padStart(2, '0');
                                                return <option value={val}>{val}:00</option>;
                                            })}
                                        </select>
                                        <select 
                                            className="FormControl" 
                                            style="font-size: 11px; padding: 4px; height: 30px; border-radius: 6px; flex: 1;" 
                                            value={this.storyScheduleMinute} 
                                            onchange={e => { this.storyScheduleMinute = e.target.value; m.redraw(); }}
                                        >
                                            {['00', '15', '30', '45'].map(min => <option value={min}>{min} dk</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Meta Yayınla / Planla Butonu */}
                        <Button 
                            className="Button Button--primary Button--block" 
                            style="background: linear-gradient(135deg, #0081fb 0%, #0064e0 100%); border: none; font-weight: 700; font-size: 13px; padding: 11px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 100, 224, 0.3); color: #fff;" 
                            loading={this.isStoryPublishing} 
                            disabled={!this.selectedImage || this.isDownloading} 
                            onclick={() => this.publishOrScheduleStory()}
                        >
                            <i className={this.storyScheduleEnabled ? "fas fa-clock" : "fas fa-paper-plane"} style="margin-right: 6px;"></i> 
                            {this.isStoryPublishing 
                                ? (this.storyPublishProgress || 'İşleniyor...') 
                                : (this.storyScheduleEnabled ? 'Hikayeyi Meta\'da Planla' : 'Hikayeyi Meta\'da Yayınla')}
                        </Button>
                    </div>
                )}

                {/* Standart İndirme Butonu (Forum Varsayılan Birincil Renk) */}
                {(() => {
                    const currentBg = this.backgrounds.find(b => b.id === this.selectedBgId);
                    const isVideo = currentBg && currentBg.type === 'video';
                    return (
                        <div style="display: flex; gap: 8px; flex-direction: column;">
                            <Button 
                                className="Button Button--primary Button--block" 
                                style="font-weight: 700; font-size: 14px; padding: 12px; border-radius: 8px;" 
                                loading={this.isDownloading} 
                                disabled={!this.selectedImage || this.isStoryPublishing} 
                                onclick={this.downloadStory.bind(this)}
                            >
                                <i className={isVideo ? "fas fa-video" : "fas fa-download"} style="margin-right: 8px;"></i> 
                                {this.isDownloading ? (isVideo ? "Video Kaydediliyor (5 sn)..." : "Hazırlanıyor...") : (isVideo ? "Hikaye Videosunu İndir (.mp4)" : "Hikaye Görselini İndir (.jpg)")}
                            </Button>
                        </div>
                    );
                })()}
            </div>

        </div>
        
        {/* SAĞ: CANLI ÖNİZLEME & GÜVENLİ ALAN KILAVUZU */}
        <div className="Story-Preview" style="flex: 0.85; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #0b1329; padding: 18px; height: 100%; box-sizing: border-box; overflow: hidden; position: relative;">
            
            {/* Üst Kılavuz Aç/Kapat Butonu */}
            <div style="margin-bottom: 10px; z-index: 20;">
                <button
                    type="button"
                    onclick={() => { this.showSafeZoneGuide = !this.showSafeZoneGuide; m.redraw(); }}
                    style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: '700',
                        border: this.showSafeZoneGuide ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.2)',
                        background: this.showSafeZoneGuide ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.1)',
                        color: this.showSafeZoneGuide ? '#38bdf8' : '#e2e8f0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backdropFilter: 'blur(8px)',
                        transition: 'all 0.2s'
                    }}
                >
                    <i className={`fas ${this.showSafeZoneGuide ? 'fa-eye-slash' : 'fa-border-none'}`}></i>
                    <span>{this.showSafeZoneGuide ? 'Instagram Kılavuzunu Gizle' : 'Instagram Güvenli Alan Kılavuzu'}</span>
                </button>
            </div>

            {/* Gerçek Instagram Hikaye Görünümü (9:16 Dikey Kart + Alt Etkileşim Barı) */}
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; max-height: calc(100% - 10px); box-sizing: border-box;">
                {/* 9:16 Hikaye Kartı (Instagram'da görünen asıl içerik alanı) */}
                <div 
                    className="Story-Container" 
                    oncreate={(vnode) => this.updateCardWidthFromEl(vnode.dom)}
                    onupdate={(vnode) => this.updateCardWidthFromEl(vnode.dom)}
                    style="position: relative; height: 100%; max-height: 580px; aspect-ratio: 9/16; border-radius: 12px; overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,0.85); background: #000; border: 1.5px solid rgba(255,255,255,0.15); flex-shrink: 1;"
                >
                    <canvas id="framio-story-canvas" width="1080" height="1920" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block;"></canvas>
                    
                    {/* Instagram Üst Bar (Gerçek Instagram Story Üst Barı) */}
                    <div className="Ig-Overlay-Top" style="position: absolute; top: 0; left: 0; width: 100%; padding: 12px 10px 8px; background: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%); pointer-events: none; display: flex; flex-direction: column; gap: 6px; z-index: 10;">
                        <div style="width: 100%; height: 2px; background: rgba(255,255,255,0.35); border-radius: 2px; overflow: hidden;">
                            <div style="width: 40%; height: 100%; background: #ffffff;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div style="display: flex; align-items: center; gap: 7px; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                <div style="width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <i className="fab fa-instagram" style="color: #ffffff; font-size: 14px; line-height: 1;"></i>
                                </div>
                                <span style="font-weight: 700; font-size: 12px; letter-spacing: -0.1px;">{brand().handle}</span>
                                <span style="color: rgba(255,255,255,0.7); font-size: 11px;">2s</span>
                            </div>
                            <div style="color: #fff; display: flex; gap: 12px; font-size: 14px; opacity: 0.9;">
                                <i className="fas fa-ellipsis-h"></i>
                                <i className="fas fa-times"></i>
                            </div>
                        </div>
                    </div>

                    {/* Güvenli Alan Kılavuzu (İsteğe Bağlı Açılır) */}
                    {this.showSafeZoneGuide ? (
                        <div style="position: absolute; inset: 0; pointer-events: none; z-index: 15; display: flex; flex-direction: column; justify-content: space-between; padding: 45px 12px 30px;">
                            <div style="border: 1px dashed rgba(56, 189, 248, 0.8); border-radius: 6px; height: 40px; background: rgba(56, 189, 248, 0.12); display: flex; align-items: center; justify-content: center; color: #38bdf8; font-size: 9px; font-weight: 700;">
                                <span>Üst Başlık Güvenli Alanı</span>
                            </div>
                            <div style="border: 1px dashed rgba(234, 179, 8, 0.8); border-radius: 6px; height: 50px; background: rgba(234, 179, 8, 0.12); display: flex; align-items: center; justify-content: center; color: #eab308; font-size: 9px; font-weight: 700;">
                                <span>Etiket & Çıkartma Alanı</span>
                            </div>
                            <div style="border: 1px dashed rgba(239, 68, 68, 0.8); border-radius: 6px; height: 35px; background: rgba(239, 68, 68, 0.12); display: flex; align-items: center; justify-content: center; color: #ef4444; font-size: 9px; font-weight: 700;">
                                <span>Alt Metin Güvenli Alanı</span>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Gerçek Instagram'daki Gibi Hikayenin DIŞINDA Yer Alan Alt Mesaj & Beğeni Barı (Hikaye kartıyla birebir aynı genişlik ve hizada) */}
                <div style={{ width: (this.storyCardWidth || 326) + 'px', maxWidth: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 2px', boxSizing: 'border-box', flexShrink: 0 }}>
                    <div style="flex: 1; height: 38px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.06); display: flex; align-items: center; padding: 0 14px; color: rgba(255,255,255,0.6); font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        <span>Mesaj gönder...</span>
                    </div>
                    <i className="far fa-heart" style="color: #ffffff; font-size: 20px; cursor: pointer; opacity: 0.9;"></i>
                    <i className="far fa-paper-plane" style="color: #ffffff; font-size: 20px; cursor: pointer; opacity: 0.9;"></i>
                </div>
            </div>
        </div>
      </div>
    );
  }

  renderCanvaStudio() {
    const templateLinksStr = app.forum.attribute('framio-social-share.canva_template_links') || '';
    const templateList = [];
    if (templateLinksStr) {
      const lines = templateLinksStr.split('\n');
      lines.forEach(l => {
        const parts = l.split('|');
        if (parts.length >= 2) {
          templateList.push({ name: parts[0].trim(), url: parts.slice(1).join('|').trim() });
        }
      });
    }

    return (
      <div className="Modal-body" style="display: flex; flex-direction: row; height: 100%; width: 100%; overflow: hidden; background: #f8fafc; padding: 0; margin: 0;">
        
        {/* SOL: CANVA KONTROLLERİ */}
        <div className="Story-Sidebar" style="flex: 1.15; min-width: 330px; background: #ffffff; padding: 20px 24px; border-right: 1px solid #e2e8f0; height: 100%; overflow-y: auto; box-sizing: border-box;">
            
            {/* 1. CANVA PRO BİLGİLENDİRME & BAĞLANTI DURUMU */}
            <div style="background: linear-gradient(135deg, #7d2ae8 0%, #00c4cc 100%); border-radius: 12px; padding: 16px 18px; color: #ffffff; margin-bottom: 18px; box-shadow: 0 4px 14px rgba(125, 42, 232, 0.25);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                        <i className="fas fa-palette"></i> {brand().name} Canva Pro
                    </span>
                    {this.canvaStatus.brand_connected || this.canvaStatus.connected ? (
                        <span style="background: rgba(255,255,255,0.25); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 20px;">
                            ● Aktif & Hazır
                        </span>
                    ) : null}
                </div>

                {this.canvaStatus.brand_connected || this.canvaStatus.connected ? (
                    <p style="font-size: 12px; margin: 0; opacity: 0.95; line-height: 1.4;">
                        ✨ Giriş yapmanıza gerek yoktur. Tasarımınız doğrudan <strong>{brand().name}</strong> kurumsal Canva hesabında 9:16 dikey formatta açılacaktır.
                    </p>
                ) : (
                    <div>
                        <p style="font-size: 12px; margin: 0 0 10px 0; opacity: 0.95; line-height: 1.4;">
                            Marka hesabı {brand().email ? '(' + brand().email + ')' : ''} henüz foruma bağlanmamış. Lütfen yetkilendirin:
                        </p>
                        <button 
                            type="button" 
                            onclick={() => this.connectCanva('brand')}
                            style="width: 100%; padding: 8px 14px; background: #ffffff; color: #7d2ae8; border: none; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;"
                        >
                            <i className="fas fa-link"></i> Marka Hesabını Bağla {brand().email ? '(' + brand().email + ')' : ''}
                        </button>
                    </div>
                )}
            </div>

            {/* 2. Aktarılacak Fotoğraf Seçimi */}
            <div className="Form-Group" style="margin-bottom: 18px; padding: 14px 16px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <label style="font-weight: 700; font-size: 13px; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 6px;">
                        <i className="fas fa-images" style="color: #7d2ae8;"></i> Aktarılacak Fotoğraf
                    </label>
                    <button 
                        type="button" 
                        onclick={() => this.openFeedPicker()}
                        style="padding: 4px 8px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; cursor: pointer; display: flex; align-items: center; gap: 4px;"
                    >
                        <i className="fas fa-search" style="color: #3b82f6;"></i> Forumdan
                    </button>
                </div>

                <div className="Media-Grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 8px; margin-bottom: 12px; max-height: 120px; overflow-y: auto;">
                    {this.availableImages.map(img => {
                        const active = this.selectedImage === img;
                        const proxySrc = this.getProxiedImageUrl(img);
                        return (
                            <div 
                                style={`cursor: pointer; border-radius: 8px; overflow: hidden; border: 2.5px solid ${active ? '#7d2ae8' : '#cbd5e1'}; opacity: ${active ? '1' : '0.6'}; transition: all 0.2s; aspect-ratio: 4/3; background: #e2e8f0;`} 
                                onclick={() => { this.selectedImage = img; m.redraw(); }}
                            >
                                <img 
                                    src={proxySrc} 
                                    onerror={e => { if (e.target.src !== img) e.target.src = img; }}
                                    style="width: 100%; height: 100%; object-fit: cover; display: block;" 
                                />
                            </div>
                        );
                    })}
                </div>

                <label style="font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;">Tasarım Başlığı (Canva)</label>
                <input 
                    type="text" 
                    className="FormControl" 
                    value={this.customTitle} 
                    oninput={e => { this.customTitle = e.target.value; }} 
                    placeholder="Tasarım Başlığı..."
                    style="height: 36px; font-size: 13px; border-radius: 6px;"
                />
            </div>

            {/* 3. Ana Eylem: Canva'da Tasarla */}
            {(() => {
                const isBrandConnected = this.canvaStatus.brand_connected || this.canvaStatus.connected;
                const isDisabled = !isBrandConnected || this.canvaCreating || !this.selectedImage;

                return (
                    <div style="margin-bottom: 20px;">
                        <button 
                            type="button" 
                            onclick={this.startCanvaDesign.bind(this)}
                            disabled={isDisabled}
                            style={`width: 100%; padding: 13px 20px; background: linear-gradient(135deg, #7d2ae8 0%, #00c4cc 100%); color: #ffffff; border: none; border-radius: 10px; font-weight: 800; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(125, 42, 232, 0.35); opacity: ${isDisabled ? '0.5' : '1'}; transition: all 0.2s;`}
                        >
                            {this.canvaCreating ? (
                                <span><i className="fas fa-spinner fa-spin"></i> Canva'ya Yükleniyor...</span>
                            ) : (
                                <span>
                                    <i className="fas fa-wand-magic-sparkles"></i> Canva'da Tasarla (9:16)
                                </span>
                            )}
                        </button>
                    </div>
                );
            })()}

            {/* 4. Tasarım Aktarım ve Geri Çekme Durumu */}
            {this.canvaCurrentDesign ? (
                <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #15803d; font-weight: 700; font-size: 13px;">
                        <i className="fas fa-check-circle"></i> Tasarım Canva'da Açıldı!
                    </div>
                    <p style="font-size: 12px; color: #374151; margin: 0 0 12px 0; line-height: 1.4;">
                        Canva'da düzenlemeniz (animasyon veya statik) bittiğinde tasarımı dilediğiniz formatta foruma çekebilirsiniz:
                    </p>
                    
                    <div style="margin-bottom: 8px;">
                        <a 
                            href={this.canvaCurrentDesign.edit_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style="width: 100%; padding: 8px 12px; font-size: 12px; font-weight: 700; background: #ffffff; border: 1.5px solid #7d2ae8; border-radius: 6px; color: #7d2ae8; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box;"
                        >
                            <i className="fas fa-arrow-up-right-from-square"></i> Canva'da Düzenlemeye Devam Et
                        </a>
                    </div>

                    <div style="display: flex; gap: 6px;">
                        <button 
                            type="button" 
                            onclick={() => this.exportCanvaDesign('png')}
                            disabled={this.canvaExporting}
                            style="flex: 1; padding: 8px 10px; font-size: 11px; font-weight: 700; background: #16a34a; border: none; border-radius: 6px; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;"
                            title="Statik fotoğraf / görsel olarak çek"
                        >
                            {this.canvaExporting && this.canvaExportFormat === 'png' ? (
                                <span><i className="fas fa-spinner fa-spin"></i> PNG Çekiliyor...</span>
                            ) : (
                                <span><i className="fas fa-image"></i> PNG Görsel Çek</span>
                            )}
                        </button>

                        <button 
                            type="button" 
                            onclick={() => this.exportCanvaDesign('mp4')}
                            disabled={this.canvaExporting}
                            style="flex: 1.2; padding: 8px 10px; font-size: 11px; font-weight: 700; background: linear-gradient(135deg, #7d2ae8 0%, #2563eb 100%); border: none; border-radius: 6px; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;"
                            title="Animasyonlu video (.mp4) olarak çek"
                        >
                            {this.canvaExporting && this.canvaExportFormat === 'mp4' ? (
                                <span><i className="fas fa-spinner fa-spin"></i> MP4 Hazırlanıyor...</span>
                            ) : (
                                <span><i className="fas fa-video"></i> 🎬 MP4 Video Çek</span>
                            )}
                        </button>
                    </div>
                </div>
            ) : null}

            {/* 5. Ön Tanımlı Kurumsal Canva Şablon Linkleri */}
            {templateList.length > 0 ? (
                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 14px 16px;">
                    <label style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 8px; display: block;">
                        <i className="fas fa-layer-group" style="color: #7d2ae8; margin-right: 6px;"></i> Kurumsal Canva Şablonları
                    </label>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        {templateList.map(tpl => (
                            <a 
                                href={tpl.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style="padding: 8px 12px; font-size: 12px; font-weight: 600; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; color: #334155; text-decoration: none; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;"
                            >
                                <span>{tpl.name}</span>
                                <i className="fas fa-external-link-alt" style="font-size: 11px; color: #94a3b8;"></i>
                            </a>
                        ))}
                    </div>
                </div>
            ) : null}

        </div>

        {/* SAĞ: CANVA CANLI ÖNİZLEME */}
        <div className="Story-Preview Story-Preview-Area" style="flex: 0.85; background: #0b1329; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18px; position: relative; overflow: hidden; box-sizing: border-box; height: 100%;">
            
            {/* Gerçek 9:16 Telefon / Hikaye Mockup Çerçevesi */}
            <div 
                className="Story-Container" 
                oncreate={(vnode) => this.updateCardWidthFromEl(vnode.dom)}
                onupdate={(vnode) => this.updateCardWidthFromEl(vnode.dom)}
                style="position: relative; height: calc(100% - 40px); aspect-ratio: 9/16; border-radius: 14px; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.85); background: #000; border: 1.5px solid rgba(255,255,255,0.12);"
            >
                
                {/* Instagram Üst Bar */}
                <div className="Ig-Overlay-Top" style="position: absolute; top: 0; left: 0; width: 100%; padding: 15px 12px; background: linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%); pointer-events: none; display: flex; flex-direction: column; gap: 8px; z-index: 10;">
                    <div style="width: 100%; height: 2px; background: rgba(255,255,255,0.4); border-radius: 2px; overflow: hidden;">
                        <div style="width: 30%; height: 100%; background: #fff;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <div style="display: flex; align-items: center; gap: 8px; color: #fff; font-family: 'Exo 2', -apple-system, sans-serif;">
                            <div style="width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                                <i className="fab fa-instagram" style="color: #ffffff; font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center;"></i>
                            </div>
                            <span style="font-weight: 700; font-size: 13px; letter-spacing: -0.2px;">{brand().handle}</span>
                            <span style="color: rgba(255,255,255,0.7); font-size: 13px;">2s</span>
                        </div>
                        <div style="color: #fff; display: flex; gap: 15px; font-size: 16px;">
                            <i className="fas fa-ellipsis-h"></i>
                            <i className="fas fa-times"></i>
                        </div>
                    </div>
                </div>

                {/* İçerik / Canva Görseli veya Boş Durum */}
                {this.canvaExportedImage ? (
                    this.canvaExportedFormat === 'mp4' ? (
                        <video src={this.canvaExportedImage} autoplay loop muted playsinline style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; display: block;" />
                    ) : (
                        <img src={this.canvaExportedImage} style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; display: block;" />
                    )
                ) : (
                    <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; color: #ffffff; z-index: 5;">
                        <div style="width: 58px; height: 58px; border-radius: 14px; background: linear-gradient(135deg, #7d2ae8 0%, #00c4cc 100%); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 26px; box-shadow: 0 8px 20px rgba(125, 42, 232, 0.4);">
                            <i className="fas fa-palette"></i>
                        </div>
                        <h4 style="font-size: 15px; font-weight: 800; margin: 0 0 8px 0; font-family: 'Exo 2', sans-serif;">Canva Studio Önizleme</h4>
                        <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                            {this.canvaCurrentDesign 
                                ? "Tasarımınız Canva'da düzenleniyor. İşiniz bittiğinde sol taraftan 'PNG Görsel Çek' veya animasyonlu 'MP4 Video Çek' butonuna basarak burada görüntüleyebilirsiniz."
                                : "Fotoğrafı Canva'ya aktarmak için sol menüdeki 'Canva'da Tasarla' butonuna tıklayın."}
                        </p>
                    </div>
                )}
            </div>

            {/* Gerçek Instagram'daki Gibi Hikayenin DIŞINDA Yer Alan Alt Mesaj & Beğeni Barı (Hikaye kartıyla birebir aynı genişlik ve hizada) */}
            <div style={{ width: (this.storyCardWidth || 326) + 'px', maxWidth: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 2px', boxSizing: 'border-box', flexShrink: 0 }}>
                <div style="flex: 1; height: 38px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.06); display: flex; align-items: center; padding: 0 14px; color: rgba(255,255,255,0.6); font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <span>Mesaj gönder...</span>
                </div>
                <i className="far fa-heart" style="color: #ffffff; font-size: 20px; cursor: pointer; opacity: 0.9;"></i>
                <i className="far fa-paper-plane" style="color: #ffffff; font-size: 20px; cursor: pointer; opacity: 0.9;"></i>
            </div>

            {/* İndirme & Kopyalama & Meta Paylaşım Eylem Barı */}
            {this.canvaExportedImage ? (
                <div style="margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px; z-index: 20; align-items: center;">
                    <a 
                        href={this.canvaExportedImage} 
                        download={this.canvaExportedFormat === 'mp4' ? brand().handle + "_canva_story.mp4" : brand().handle + "_canva_story.png"}
                        target="_blank"
                        style={`padding: 8px 16px; background: ${this.canvaExportedFormat === 'mp4' ? 'linear-gradient(135deg, #7d2ae8 0%, #2563eb 100%)' : '#10b981'}; color: #fff; font-weight: 700; font-size: 12px; border-radius: 8px; text-decoration: none; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);`}
                    >
                        <i className={this.canvaExportedFormat === 'mp4' ? "fas fa-video" : "fas fa-download"}></i>
                        <span>{this.canvaExportedFormat === 'mp4' ? "Hikaye Videosunu İndir (.mp4)" : "Hikayeyi İndir (PNG)"}</span>
                    </a>

                    {this.canPublishMetaStory() && (
                        <button 
                            type="button"
                            className="Button Button--primary"
                            style="padding: 8px 16px; background: linear-gradient(135deg, #0081fb 0%, #0064e0 100%); color: #fff; font-weight: 700; font-size: 12px; border-radius: 8px; border: none; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(0, 100, 224, 0.3); cursor: pointer;"
                            disabled={this.isStoryPublishing}
                            onclick={() => this.publishOrScheduleStory(this.canvaExportedImage)}
                        >
                            <i className="fab fa-meta"></i>
                            <span>{this.isStoryPublishing ? (this.storyPublishProgress || 'Paylaşılıyor...') : 'Meta Hikaye Olarak Paylaş'}</span>
                        </button>
                    )}
                </div>
            ) : null}
        </div>
      </div>
    );
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    const ex = this.extractExifFromDOM();
    if (ex.camera) {
        this.exifData = ex;
        m.redraw();
    }
    if (document.fonts) {
        document.fonts.load('bold 60px "Exo 2"').then(() => this.preloadAndDraw());
    } else {
        setTimeout(() => this.preloadAndDraw(), 500);
    }
  }

  onremove(vnode) {
    if (this.canvaMsgHandler) {
        window.removeEventListener('message', this.canvaMsgHandler);
    }
    if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
    }
    if (this.bgVideo) {
        this.bgVideo.pause();
        this.bgVideo.removeAttribute('src');
        this.bgVideo.load();
        this.bgVideo = null;
    }
    super.onremove(vnode);
  }

  getAbsoluteAssetUrl(pathOrUrl) {
    if (!pathOrUrl) return '';
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('blob:') || pathOrUrl.startsWith('data:')) {
        return pathOrUrl;
    }
    const origin = window.location.origin;
    const baseUrl = (app.forum.attribute('baseUrl') || origin).replace(/\/+$/, '');
    const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl;
    return baseUrl + cleanPath;
  }

  getProxiedImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    const absUrl = this.getAbsoluteAssetUrl(url);
    const apiUrl = app.forum.attribute('apiUrl') || (window.location.origin + '/api');
    return apiUrl + '/framio/social-share/proxy-image?url=' + encodeURIComponent(absUrl);
  }

  async loadSafeImage(url) {
    if (!url) return null;
    const absUrl = this.getAbsoluteAssetUrl(url);
    if (this.imageCache[absUrl]) return this.imageCache[absUrl];

    const loadImg = (src, crossOrigin = true) => new Promise((resolve, reject) => {
        const img = new Image();
        if (crossOrigin && !src.startsWith('data:') && !src.startsWith('blob:')) {
            img.crossOrigin = "Anonymous";
        }
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err || new Error("Yükleme hatası: " + src));
        img.src = src;
    });

    const proxyUrl = this.getProxiedImageUrl(absUrl);

    // 1. Önce Proxy üzerinden dene (CORS başlığı ve canvas yetkisi garantili)
    try {
        const i = await loadImg(proxyUrl, true);
        this.imageCache[absUrl] = i;
        return i;
    } catch(e) {
        // 2. Doğrudan yüklemeyi dene
        try {
            const i = await loadImg(absUrl, true);
            this.imageCache[absUrl] = i;
            return i;
        } catch(e2) {
            // 3. Blob fetch üzerinden dene
            try {
                const res = await fetch(proxyUrl);
                if (!res.ok) throw new Error("Fetch failed: " + res.status);
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                const i = await loadImg(blobUrl, false);
                this.imageCache[absUrl] = i;
                return i;
            } catch(e3) {
                try {
                    const i = await loadImg(absUrl, false);
                    this.imageCache[absUrl] = i;
                    return i;
                } catch(e4) {
                    console.warn("Görsel yüklenemedi:", absUrl, e4);
                    return null;
                }
            }
        }
    }
  }

  async preloadAndDraw() {
    if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
    }
    if (this.bgVideo) {
        this.bgVideo.pause();
        this.bgVideo.removeAttribute('src');
        this.bgVideo.load();
        this.bgVideo = null;
    }

    if (!this.selectedImage) return;
    const bgInfo = this.backgrounds.find(b => b.id === this.selectedBgId) || this.backgrounds[0];
    
    if (bgInfo && bgInfo.type === 'video') {
        this.loadedBg = null;
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.src = this.getAbsoluteAssetUrl(bgInfo.url);
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        
        try {
            await video.play();
        } catch(e) {
            console.warn("Video autoplay prevented or source not found:", e);
        }
        this.bgVideo = video;
    } else if (bgInfo && bgInfo.type === 'image') {
        const bgUrl = this.getAbsoluteAssetUrl(bgInfo.url || ('/assets/backgrounds/' + bgInfo.file));
        this.loadedBg = await this.loadSafeImage(bgUrl);
    } else {
        this.loadedBg = null;
    }

    this.loadedMain = await this.loadSafeImage(this.selectedImage);
    this.fetchExifFromPHP(this.selectedImage);

    if (this.selectedLogoId !== "none") {
        const logoInfo = this.logos.find(l => l.id === this.selectedLogoId);
        const logoUrl = app.forum.attribute("baseUrl") + "/assets/backgrounds/logos/" + logoInfo.file;
        this.loadedLogo = await this.loadSafeImage(logoUrl);
    } else {
        this.loadedLogo = null;
    }

    this.startRenderingLoop();
  }

  startRenderingLoop() {
    if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
    }

    const currentBg = this.backgrounds.find(b => b.id === this.selectedBgId);
    const isVideo = currentBg && currentBg.type === 'video';

    const render = () => {
        this.updateCanvasSync();
        if (isVideo && this.bgVideo && !this.bgVideo.paused) {
            this.animFrameId = requestAnimationFrame(render);
        }
    };

    if (isVideo) {
        this.animFrameId = requestAnimationFrame(render);
    } else {
        this.updateCanvasSync();
    }
  }

  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) return;
    const words = text.split(" ");
    let line = "";
    const lines = [];
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        if (ctx.measureText(testLine).width > maxWidth && n > 0) {
            lines.push(line.trim());
            line = words[n] + " ";
        } else {
            line = testLine;
        }
    }
    lines.push(line.trim());
    const startY = y - (lines.length - 1) * lineHeight;
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x, startY + i * lineHeight);
    }
  }

  updateCanvasSync() {
    const canvas = document.getElementById("framio-story-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    // Canvas'ı ve donanımsal çizim belleğini tamamen temizle ve tüm durumları sıfırla
    canvas.width = 1080;
    canvas.height = 1920;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.beginPath();
    ctx.filter = "none";
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 1;

    const bgInfo = this.backgrounds.find(b => b.id === this.selectedBgId) || { textColor: "#ffffff", id: "default" };
    
    // Tipografi Tanımları (Google Fonts & Forum Fontu Entegrasyonu)
    const defaultForumFont = '"Exo 2", sans-serif';

    // 1. Başlık Fontu
    const titleFontName = this.selectedFontFamily || 'Exo 2';
    const titleFontObj = this.availableFonts ? this.availableFonts.find(f => f.name === titleFontName) : null;
    const titleIsSingleWeight = titleFontObj && titleFontObj.hasBold === false;
    const primaryWeight = titleIsSingleWeight ? 'normal' : 'bold';
    const titleFont = `"${titleFontName}", sans-serif`;

    // 2. Künye Fontu (Özel seçilmişse onu, değilse fontScope='all' ise genel fontu, değilse forum varsayılanını kullanır)
    const effectiveBadgeFontName = this.badgeFontFamily || (this.fontScope === 'all' ? titleFontName : 'Exo 2');
    const badgeFontObj = this.availableFonts ? this.availableFonts.find(f => f.name === effectiveBadgeFontName) : null;
    const badgeIsSingleWeight = badgeFontObj && badgeFontObj.hasBold === false;
    const badgeWeight = badgeIsSingleWeight ? 'normal' : 'bold';
    const subWeight = badgeWeight;
    const badgeFont = `"${effectiveBadgeFontName}", sans-serif`;
    const detailFont = badgeFont;

    // 3. Alt Duyuru Metni Fontu
    const effectiveFooterFontName = this.footerFontFamily || (this.fontScope === 'all' ? titleFontName : 'Exo 2');
    const footerFontObj = this.availableFonts ? this.availableFonts.find(f => f.name === effectiveFooterFontName) : null;
    const footerIsSingleWeight = footerFontObj && footerFontObj.hasBold === false;
    const footerWeight = footerIsSingleWeight ? 'normal' : 'bold';
    const footerFont = `"${effectiveFooterFontName}", sans-serif`;

    const applyTextShadow = (enable = this.textShadowEnabled) => {
        if (enable) {
            ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
            ctx.shadowBlur = 14;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 4;
        } else {
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
    };
    
    // 1. Arka Plan Katmanı
    if (bgInfo.type === 'blur' && this.loadedMain) {
        // ✨ Bulanık Görsel Fonu (Frosted Blur / Ambient Glass)
        ctx.save();
        ctx.filter = 'blur(45px) brightness(0.65)';
        ctx.drawImage(this.loadedMain, -120, -120, 1320, 2160);
        ctx.restore();
        
        // Üstüne yumuşak karanlık geçiş gradyanı
        ctx.save();
        const grad = ctx.createLinearGradient(0, 0, 0, 1920);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
        grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1080, 1920);
        ctx.restore();
    } else if (bgInfo.type === 'gradient') {
        ctx.save();
        const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(0.6, '#064e3b');
        grad.addColorStop(1, '#022c22');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1080, 1920);
        ctx.restore();
    } else if (bgInfo.type === 'color') {
        ctx.save();
        ctx.fillStyle = bgInfo.color || '#ffffff';
        ctx.fillRect(0, 0, 1080, 1920);
        ctx.restore();
    } else if (this.bgVideo && this.bgVideo.readyState >= 2) {
        ctx.save();
        ctx.drawImage(this.bgVideo, 0, 0, 1080, 1920);
        ctx.restore();
    } else if (this.loadedBg) {
        ctx.save();
        ctx.drawImage(this.loadedBg, 0, 0, 1080, 1920);
        ctx.restore();
    } else {
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 1080, 1920);
        ctx.restore();
    }

    // 2. Ana Konu Görseli
    let cy = 960;
    let ch = 0;
    let imgW = 880;
    let imgX = 100;
    const radius = this.imageCornerRadius || 0;
    const frame = this.frameStyle || 'modern';

    if (this.loadedMain) {
        // Polaroid ve Vintage modelleri için orantılı boyut ayarlaması
        if (frame === 'polaroid' || frame === 'polaroid_tape') {
            imgW = 800;
        } else if (frame === 'tape_corners') {
            imgW = 840;
        }
        // Fotoğraf Boyutu / Ölçekleme (0.6 - 1.5)
        const scale = this.imageScale || 1.0;
        imgW = Math.round(imgW * scale);
        imgX = Math.round(540 - imgW / 2);

        ch = this.loadedMain.height * (imgW / this.loadedMain.width);
        const isExif = this.storyMode === "exif";
        const isPolaroid = (frame === 'polaroid' || frame === 'polaroid_tape');
        const maxChBase = isExif 
            ? (isPolaroid ? 550 : (frame === 'vintage_card' ? 620 : 680)) 
            : 950;
        const maxCh = Math.round(maxChBase * scale);
        if (ch > maxCh) ch = maxCh;

        if (isExif) {
            // EXIF modunda: Çerçeve yüksekliğine göre merkezi dinamik hizala (Polaroid'de 135px alt taban vardır)
            const topCenter = isPolaroid ? 650 : (frame === 'vintage_card' ? 690 : 720);
            cy = topCenter - ch / 2 + this.imageYOffset;
        } else {
            // Standart modda: Başlık üstte (300px), Fotoğraf ortada (890px), Künye altta (1250-1450px), Footer (1670px)
            cy = 890 - ch / 2 + this.imageYOffset;
        }
        
        // Helper: Washi Tape (Maskeleme Bandı) Çizici
        const drawTape = (tx, ty, tw, th, angle = 0) => {
            ctx.save();
            ctx.translate(tx + tw / 2, ty + th / 2);
            ctx.rotate(angle * Math.PI / 180);
            
            // Bant Gölgesi
            ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 4;
            
            // Yarı Saydam Dokulu Washi Bant
            const tapeGrad = ctx.createLinearGradient(-tw / 2, -th / 2, tw / 2, th / 2);
            tapeGrad.addColorStop(0, 'rgba(255, 245, 205, 0.82)');
            tapeGrad.addColorStop(0.5, 'rgba(255, 250, 220, 0.78)');
            tapeGrad.addColorStop(1, 'rgba(250, 235, 180, 0.82)');
            ctx.fillStyle = tapeGrad;
            
            ctx.fillRect(-tw / 2, -th / 2, tw, th);
            
            // Bant Lifleri / Dokusu
            ctx.strokeStyle = "rgba(215, 195, 140, 0.4)";
            ctx.lineWidth = 1;
            ctx.strokeRect(-tw / 2, -th / 2, tw, th);
            ctx.restore();
        };

        if (frame === 'polaroid' || frame === 'polaroid_tape') {
            // === POLAROID FOTOĞRAF KARTI ===
            ctx.save();
            const padX = 24;
            const padTop = 24;
            const padBottom = 135; // 3 satır künye ve fotoğrafçı için geniş alt Polaroid tabanı
            const cardW = imgW + padX * 2;
            const cardH = ch + padTop + padBottom;
            const cardX = imgX - padX;
            const cardY = cy - padTop;

            // Polaroid Kart Gölgesi
            if (this.imageShadowStyle === 'deep') {
                ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
                ctx.shadowBlur = 50;
                ctx.shadowOffsetY = 28;
            } else if (this.imageShadowStyle === 'soft') {
                ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
                ctx.shadowBlur = 24;
                ctx.shadowOffsetY = 12;
            }

            // Karton / Fotoğraf Kağıdı Arka Planı (Hafif sıcak beyaz)
            ctx.fillStyle = "#faf8f5";
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(cardX, cardY, cardW, cardH, 8);
            } else {
                ctx.rect(cardX, cardY, cardW, cardH);
            }
            ctx.fill();
            ctx.shadowColor = "transparent";

            // İç Görsel Çizimi
            ctx.save();
            ctx.beginPath();
            ctx.rect(imgX, cy, imgW, ch);
            ctx.clip();
            ctx.drawImage(this.loadedMain, imgX, cy, imgW, ch);
            ctx.restore();

            // Polaroid Alt Alanı - 3 Satırlı Tam Künye (Bağımsız Renk & Punto)
            ctx.save();
            
            if (this.showPlateBadge && (this.badgeLine1 || this.badgeLine2 || this.badgeLine3)) {
                const polAlign = this.badgeAlign || 'center';
                const getPolX = () => {
                    if (polAlign === 'left') return imgX + 10;
                    if (polAlign === 'right') return imgX + imgW - 10;
                    return 540;
                };

                // 1. Satır: Şirket & Plaka
                ctx.textAlign = polAlign;
                const s1 = this.badgeLine1Size || 21;
                ctx.font = `${primaryWeight} ${s1}px ${badgeFont}`;
                ctx.fillStyle = this.badgeLine1Color || this.commonBadgeColor || "#0f172a";
                const l1 = this.badgeLine1 || this.companyTitle || "ULAŞIM ARŞİV";
                ctx.fillText(l1, getPolX(), cardY + cardH - 95);

                // 2. Satır: Araç Modeli
                if (this.badgeLine2) {
                    ctx.textAlign = polAlign;
                    const s2 = this.badgeLine2Size || 21;
                    ctx.font = `${subWeight} ${s2}px ${badgeFont}`;
                    ctx.fillStyle = this.badgeLine2Color || this.commonBadgeColor || "#334155";
                    ctx.fillText(this.badgeLine2, getPolX(), cardY + cardH - 63);
                }

                // 3. Satır: Konum / Şehir & Fotoğrafçı Künyesi
                const hasPolLoc = Boolean(this.showBadgeLine3 !== false && this.badgeLine3);
                const photoPlacement = this.photographerPlacement || 'same_line';
                const showPolCred = (photoPlacement !== 'hidden') && Boolean(this.creditsText && this.creditsText.trim());

                if (showPolCred && photoPlacement === 'same_line') {
                    // Opsiyon 1: Aynı satırda, ortak punto ve aynı renkte
                    const s3 = this.badgeLine3Size || this.commonBadgeFontSize || 21;
                    ctx.font = `${subWeight} ${s3}px ${badgeFont}`;
                    ctx.fillStyle = this.badgeLine3Color || this.commonBadgeColor || "#64748b";
                    ctx.textAlign = polAlign;

                    let polFullLine = "";
                    if (hasPolLoc) {
                        polFullLine = `📍 ${this.badgeLine3}   •   ${this.creditsText.trim()}`;
                    } else {
                        polFullLine = this.creditsText.trim();
                    }
                    ctx.fillText(polFullLine, getPolX(), cardY + cardH - 31);
                } else {
                    // Opsiyon 2 (separate_line) veya Opsiyon 3 (hidden)
                    ctx.textAlign = polAlign;
                    if (hasPolLoc) {
                        const s3 = this.badgeLine3Size || 21;
                        ctx.font = `${subWeight} ${s3}px ${badgeFont}`;
                        ctx.fillStyle = this.badgeLine3Color || this.commonBadgeColor || "#64748b";
                        ctx.fillText(`📍 ${this.badgeLine3}`, getPolX(), cardY + cardH - (showPolCred ? 42 : 31));
                    }
                    if (showPolCred && photoPlacement === 'separate_line') {
                        const credSize = this.creditsSize || 21;
                        let credWeight = subWeight;
                        if (this.creditsIsBold && (!isSingleWeight || this.fontScope !== 'all')) credWeight = "bold";
                        let credStyle = this.creditsIsItalic ? "italic " : "";
                        ctx.font = `${credStyle}${credWeight} ${credSize}px ${detailFont}`;
                        ctx.fillStyle = this.creditsColor || "#64748b";
                        const credY = cardY + cardH - 18 + (this.creditsYOffset || 0);
                        ctx.fillText(this.creditsText.trim(), getPolX(), credY);
                    }
                }
            } else {
                // Sadece Şirket Başlığı ve Künye
                ctx.textAlign = "center";
                ctx.font = `${subWeight} 22px ${badgeFont}`;
                const polMainText = this.companyTitle || "ULAŞIM ARŞİV";
                ctx.fillStyle = "#1e293b";
                ctx.fillText(polMainText, 540, cardY + cardH - 62);

                if (this.creditsText.trim() !== "") {
                    let credWeight = subWeight;
                    if (this.creditsIsBold && (!isSingleWeight || this.fontScope !== 'all')) credWeight = "bold";
                    let credStyle = this.creditsIsItalic ? "italic " : "";
                    ctx.font = `${credStyle}${credWeight} ${this.creditsSize || 22}px ${detailFont}`;
                    ctx.fillStyle = this.creditsColor || "#64748b";
                    ctx.fillText(this.creditsText.trim(), 540, cardY + cardH - 28);
                }
            }
            ctx.restore();
            ctx.restore();

            // Üstten Yapıştırılmış Washi Tape (Maskeleme Bandı)
            if (frame === 'polaroid_tape') {
                drawTape(540 - 90, cardY - 26, 180, 52, -2.5);
            }

        } else if (frame === 'tape_corners') {
            // === 4 KÖŞEDEN BANTLI POSTER ===
            ctx.save();
            if (this.imageShadowStyle === 'deep') {
                ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
                ctx.shadowBlur = 40;
                ctx.shadowOffsetY = 20;
            } else if (this.imageShadowStyle === 'soft') {
                ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
                ctx.shadowBlur = 18;
                ctx.shadowOffsetY = 8;
            }

            // Beyaz Paspartu Kenar
            ctx.fillStyle = "#ffffff";
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(imgX - 8, cy - 8, imgW + 16, ch + 16, 4);
            } else {
                ctx.rect(imgX - 8, cy - 8, imgW + 16, ch + 16);
            }
            ctx.fill();
            ctx.shadowColor = "transparent";

            // Fotoğraf
            ctx.save();
            ctx.beginPath();
            ctx.rect(imgX, cy, imgW, ch);
            ctx.clip();
            ctx.drawImage(this.loadedMain, imgX, cy, imgW, ch);
            ctx.restore();
            ctx.restore();

            // 4 Köşe Washi Tape Bantları
            drawTape(imgX - 35, cy - 25, 110, 44, -38);             // Sol Üst
            drawTape(imgX + imgW - 75, cy - 25, 110, 44, 38);       // Sağ Üst
            drawTape(imgX - 35, cy + ch - 20, 110, 44, 38);         // Sol Alt
            drawTape(imgX + imgW - 75, cy + ch - 20, 110, 44, -38);  // Sağ Alt

        } else if (frame === 'vintage_card') {
            // === VINTAGE FİLM & DOKU KARTI ===
            ctx.save();
            if (this.imageShadowStyle === 'deep') {
                ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
                ctx.shadowBlur = 45;
                ctx.shadowOffsetY = 24;
            }

            // Koyu Vintage Film Kenarlığı
            ctx.fillStyle = "#18181b";
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(imgX - 16, cy - 28, imgW + 32, ch + 56, 10);
            } else {
                ctx.rect(imgX - 16, cy - 28, imgW + 32, ch + 56);
            }
            ctx.fill();
            ctx.shadowColor = "transparent";

            // Üst ve Alt Film Perforasyon Delikleri (Film Sprockets)
            ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
            for (let fx = imgX; fx < imgX + imgW; fx += 55) {
                ctx.fillRect(fx, cy - 20, 24, 12);
                ctx.fillRect(fx, cy + ch + 8, 24, 12);
            }

            // Fotoğraf
            ctx.save();
            ctx.beginPath();
            ctx.rect(imgX, cy, imgW, ch);
            ctx.clip();
            ctx.drawImage(this.loadedMain, imgX, cy, imgW, ch);
            ctx.restore();
            ctx.restore();

        } else {
            // === MODERN STANDART KART ===
            ctx.save();
            if (this.imageShadowStyle === 'deep') {
                ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
                ctx.shadowBlur = 45;
                ctx.shadowOffsetY = 24;
            } else if (this.imageShadowStyle === 'soft') {
                ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
                ctx.shadowBlur = 20;
                ctx.shadowOffsetY = 10;
            }

            // Yuvarlatılmış Köşeli Arka Dolgu & Gölge
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(imgX - 4, cy - 4, imgW + 8, ch + 8, radius > 0 ? radius + 2 : 0);
            } else {
                ctx.rect(imgX - 4, cy - 4, imgW + 8, ch + 8);
            }
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.shadowColor = "transparent";

            // Görseli Kırp ve Çiz
            ctx.save();
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(imgX, cy, imgW, ch, radius);
            } else {
                ctx.rect(imgX, cy, imgW, ch);
            }
            ctx.clip();
            ctx.drawImage(this.loadedMain, imgX, cy, imgW, ch);
            ctx.restore();

            // İnce Kenarlık (Varsa)
            if (this.imageBorderWidth > 0) {
                ctx.save();
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(imgX, cy, imgW, ch, radius);
                } else {
                    ctx.rect(imgX, cy, imgW, ch);
                }
                ctx.lineWidth = this.imageBorderWidth;
                ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
                ctx.stroke();
                ctx.restore();
            }
            ctx.restore();
        }
    }

    // 3. Sektörel Rozet (Plaka & Künye Rozeti)
    const isPolaroidFrame = (frame === 'polaroid' || frame === 'polaroid_tape');
    const hasAnyBadgeInfo = Boolean(
        (this.showBadgeLine1 && this.badgeLine1) || 
        (this.showBadgeLine2 && this.badgeLine2) || 
        (this.showBadgeLine3 && this.badgeLine3) || 
        (this.showBadgeCredits && this.creditsText && this.creditsText.trim()) ||
        this.plateBadgeText || this.cityBadgeText
    );
    
    // Gölge derinliğine göre metinlerin ve kartların fotoğraf gölgesinin içine girmesini önleyen akıllı boşluk payı (shadowPad)
    let shadowPad = 28;
    if (this.imageShadowStyle === 'deep') {
        shadowPad = 66; // 24px offset + 45px blur -> 69px toplam gölge etki alanı
    } else if (this.imageShadowStyle === 'soft') {
        shadowPad = 38;
    } else if (this.imageShadowStyle === 'none') {
        shadowPad = 20;
    }

    // Rozet yerleşim modu: 'auto' ise Polaroid çerçevesinde Polaroid içine, diğer tüm çerçevelerde fotoğraf altına 3 satır entegre kart
    const effectiveBadgeMode = (this.badgeDisplayMode === 'auto') 
        ? (isPolaroidFrame ? 'polaroid' : 'bottom_integrated') 
        : this.badgeDisplayMode;

    const shouldDrawExternalBadge = this.showPlateBadge && hasAnyBadgeInfo && this.loadedMain && (!isPolaroidFrame || effectiveBadgeMode === 'top_floating');

    if (shouldDrawExternalBadge) {
        ctx.save();
        const isDark = (bgInfo.textColor !== "#111111");

        if (effectiveBadgeMode === 'bottom_integrated') {
            // === DOĞAL & KARTSIZ KÜNYE (SAF TİPOGRAFİ) ===
            const l1 = (this.showBadgeLine1 !== false) ? (this.badgeLine1 || this.companyTitle || (this.plateBadgeText ? `🚌 ${this.plateBadgeText}` : "")) : "";
            const l2 = (this.showBadgeLine2 !== false) ? (this.badgeLine2 || "") : "";
            let l3Parts = [];
            if (this.showBadgeLine3 !== false && this.badgeLine3) l3Parts.push(`📍 ${this.badgeLine3}`);
            if (this.showBadgeCredits !== false && this.creditsText && this.creditsText.trim()) l3Parts.push(this.creditsText.trim());
            const l3 = l3Parts.join("   •   ");

            const hasL1 = Boolean(l1);
            const hasL2 = Boolean(l2);
            const hasL3 = Boolean(this.showBadgeLine3 !== false && this.badgeLine3);
            const hasCredits = Boolean(this.showBadgeCredits !== false && this.creditsText && this.creditsText.trim());

            // Fotoğrafın gölgesinin tamamen dışına çıkması için shadowPad eklenir
            const startY = cy + ch + shadowPad + this.badgeYOffset;

            // Yazıların her arka planda kristal netliğinde okunması için metin gölgesi
            ctx.save();
            applyTextShadow(true);

            let curY = startY;
            const alignMode = this.badgeAlign || 'center';
            let getBaseX = () => {
                if (alignMode === 'left') return imgX + 16;
                if (alignMode === 'right') return imgX + imgW - 16;
                return 540;
            };

            // 1. Satır: Şirket & Plaka
            if (hasL1) {
                ctx.textAlign = alignMode;
                const s1 = this.badgeLine1Size || 21;
                ctx.font = `${primaryWeight} ${s1}px ${badgeFont}`;
                ctx.fillStyle = this.badgeLine1Color || this.commonBadgeColor || bgInfo.textColor || (isDark ? "#ffffff" : "#0f172a");
                ctx.fillText(l1, getBaseX(), curY);
                curY += Math.round(s1 * 1.44);
            }

            // 2. Satır: Araç Modeli
            if (hasL2) {
                ctx.textAlign = alignMode;
                const s2 = this.badgeLine2Size || 21;
                ctx.font = `${subWeight} ${s2}px ${badgeFont}`;
                ctx.fillStyle = this.badgeLine2Color || this.commonBadgeColor || (isDark ? "#e2e8f0" : "#334155");
                ctx.fillText(l2, getBaseX(), curY);
                curY += Math.round(s2 * 1.46);
            }

            // 3. Satır ve Fotoğrafçı Künyesi (Opsiyon 1: same_line, Opsiyon 2: separate_line, Opsiyon 3: hidden)
            const photoPlacement = this.photographerPlacement || 'same_line';
            const showPhotographer = (photoPlacement !== 'hidden') && hasCredits;

            if (showPhotographer && photoPlacement === 'same_line') {
                // Opsiyon 1: 3. satır ile aynı satırda, AYNI RENK VE AYNI PUNTODA
                const s3 = this.badgeLine3Size || this.commonBadgeFontSize || 21;
                ctx.font = `${subWeight} ${s3}px ${badgeFont}`;
                ctx.fillStyle = this.badgeLine3Color || this.commonBadgeColor || (isDark ? "#94a3b8" : "#64748b");
                ctx.textAlign = alignMode;

                let line3FullText = "";
                if (hasL3 && this.badgeLine3) {
                    line3FullText = `📍 ${this.badgeLine3}   •   ${this.creditsText.trim()}`;
                } else {
                    line3FullText = this.creditsText.trim();
                }

                ctx.fillText(line3FullText, getBaseX(), curY);
                curY += Math.round(s3 * 1.44);
            } else {
                // Opsiyon 2 veya 3 (veya fotoğrafçı yoksa)
                // 3. Satır Konum/Şehir
                if (hasL3 && this.badgeLine3) {
                    ctx.textAlign = alignMode;
                    const s3 = this.badgeLine3Size || 21;
                    ctx.font = `${subWeight} ${s3}px ${badgeFont}`;
                    ctx.fillStyle = this.badgeLine3Color || this.commonBadgeColor || (isDark ? "#94a3b8" : "#64748b");
                    ctx.fillText(`📍 ${this.badgeLine3}`, getBaseX(), curY);
                    curY += Math.round(s3 * 1.44);
                }

                // 4. Satır: Fotoğrafçı Künyesi (Opsiyon 2: separate_line - Bağımsız düzenlenebilir)
                if (showPhotographer && photoPlacement === 'separate_line') {
                    ctx.textAlign = alignMode;
                    const credSize = this.creditsSize || 21;
                    let credWeight = subWeight;
                    if (this.creditsIsBold && (!isSingleWeight || this.fontScope !== 'all')) credWeight = "bold";
                    let credStyle = this.creditsIsItalic ? "italic " : "";
                    ctx.font = `${credStyle}${credWeight} ${credSize}px ${detailFont}`;
                    ctx.fillStyle = this.creditsColor || (isDark ? "#cbd5e1" : "#475569");
                    const credY = curY + (this.creditsYOffset || 0);
                    ctx.fillText(this.creditsText.trim(), getBaseX(), credY);
                    curY += Math.round(credSize * 1.44);
                }
            }

            ctx.restore();
            ctx.restore();
        } else {
            // === ÜST YÜZEN KAPSÜL ROZET ===
            const badgeY = cy - 64 + this.badgeYOffset;
            
            const l1 = (this.showBadgeLine1 !== false) ? (this.badgeLine1 || (this.plateBadgeText ? `🚌 ${this.plateBadgeText}` : "")) : "";
            let subParts = [];
            if (this.showBadgeLine2 !== false && this.badgeLine2) subParts.push(this.badgeLine2);
            if (this.showBadgeLine3 !== false && this.badgeLine3) subParts.push(`📍 ${this.badgeLine3}`);
            if (this.showBadgeCredits !== false && this.creditsText && this.creditsText.trim()) subParts.push(this.creditsText.trim());
            const l2 = subParts.join("   •   ");

            if (l1 && l2) {
                ctx.font = `${subWeight} 19px ${badgeFont}`;
                const w1 = ctx.measureText(l1).width;
                ctx.font = `${subWeight} 17px ${badgeFont}`;
                const w2 = ctx.measureText(l2).width;
                const badgeW = Math.max(w1, w2) + 48;
                const badgeH = 58;
                const badgeX = 540 - badgeW / 2;

                ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(255, 255, 255, 0.94)";
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 16);
                } else {
                    ctx.rect(badgeX, badgeY, badgeW, badgeH);
                }
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.1)";
                ctx.stroke();

                ctx.textAlign = "center";
                ctx.font = `${subWeight} 19px ${badgeFont}`;
                ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
                ctx.fillText(l1, 540, badgeY + 25);

                ctx.font = `${subWeight} 17px ${badgeFont}`;
                ctx.fillStyle = isDark ? "#94a3b8" : "#475569";
                ctx.fillText(l2, 540, badgeY + 48);
            } else {
                const textStr = l1 || l2 || "";
                ctx.font = `${subWeight} 20px ${badgeFont}`;
                const textMetrics = ctx.measureText(textStr);
                const badgeW = textMetrics.width + 44;
                const badgeH = 44;
                const badgeX = 540 - badgeW / 2;

                ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(255, 255, 255, 0.94)";
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 22);
                } else {
                    ctx.rect(badgeX, badgeY, badgeW, badgeH);
                }
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.1)";
                ctx.stroke();

                ctx.textAlign = "center";
                ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
                ctx.fillText(textStr, 540, badgeY + 29);
            }
        }
        ctx.restore();
    }

    // 4. Logo Katmanı
    if (this.loadedLogo && this.selectedLogoId !== "none") {
        const r = this.loadedLogo.height / this.loadedLogo.width;
        const w = 350 * this.logoScale;
        const h = w * r;
        const lx = 540 - w / 2 + this.logoXOffset;
        const ly = 150 + this.logoYOffset;
        ctx.drawImage(this.loadedLogo, lx, ly, w, h);
    }

    // 5. EXIF Bilgi Kartı
    if (this.storyMode === "exif" && this.loadedMain) {
        // EXIF modunda çerçeveye göre dinamik alt sınır hesaplama
        let frameBottom = cy + ch + shadowPad;
        if (frame === 'polaroid' || frame === 'polaroid_tape') {
            // Polaroid taban yüksekliği (135px) + kart payı
            frameBottom = cy + ch + 135 + shadowPad;
        } else if (frame === 'vintage_card') {
            // Vintage kart alt kenarlığı (28px)
            frameBottom = cy + ch + 28 + shadowPad;
        } else if (frame === 'tape_corners') {
            // Paspartu alt kenarlığı (8px)
            frameBottom = cy + ch + 8 + shadowPad;
        }

        let exifCardBaseY = frameBottom + 15;
        if (shouldDrawExternalBadge && effectiveBadgeMode === 'bottom_integrated') {
            const hasL1 = Boolean(this.showBadgeLine1 !== false && (this.badgeLine1 || this.companyTitle));
            const hasL2 = Boolean(this.showBadgeLine2 !== false && this.badgeLine2);
            const hasL3 = Boolean((this.showBadgeLine3 !== false && this.badgeLine3) || (this.showBadgeCredits !== false && this.creditsText && this.creditsText.trim()));
            let lc = (hasL1 ? 1 : 0) + (hasL2 ? 1 : 0) + (hasL3 ? 1 : 0);
            if (lc > 0) {
                const badgeHeight = lc === 3 ? 90 : (lc === 2 ? 65 : 35);
                exifCardBaseY = frameBottom + this.badgeYOffset + badgeHeight + 20;
            }
        }

        const scale = this.exifCardScale || 1.0;
        const baseW = 788;
        const baseH = 240;
        const ew = baseW * scale;
        const eh = baseH * scale;
        const ex = 540 - ew / 2;
        const ey = exifCardBaseY + this.exifYOffset;
        const isDark = (bgInfo.textColor !== "#111111");

        // EXIF Kart Stilleri: Glass (Buzlu Cam), Solid (Opak Modern), Bordered (Minimal Çerçeveli)
        const cardStyle = this.exifCardStyle || 'glass';
        ctx.save();

        if (cardStyle === 'solid') {
            ctx.fillStyle = isDark ? "#0f172a" : "#ffffff";
            ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
            ctx.shadowBlur = 24;
            ctx.shadowOffsetY = 8;
        } else if (cardStyle === 'bordered') {
            ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.25)" : "rgba(255, 255, 255, 0.35)";
            ctx.shadowColor = "transparent";
        } else {
            // Glass (Varsayılan frosted glass)
            ctx.fillStyle = isDark ? "rgba(0, 0, 0, 0.55)" : "rgba(255, 255, 255, 0.88)";
            ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 6;
        }

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(ex, ey, ew, eh, 20 * scale);
        } else {
            ctx.rect(ex, ey, ew, eh);
        }
        ctx.fill();
        ctx.shadowColor = "transparent";

        // Kenarlık çizgisi
        ctx.lineWidth = (cardStyle === 'bordered' ? 2 : 1) * scale;
        if (cardStyle === 'bordered') {
            ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.25)";
        } else {
            ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.08)";
        }
        ctx.stroke();

        const mainColor = isDark ? "#ffffff" : "#0f172a";
        const subColor = isDark ? "rgba(255, 255, 255, 0.65)" : "rgba(15, 23, 42, 0.6)";

        ctx.textAlign = "left";
        ctx.font = `${subWeight} ${Math.round(16 * scale)}px ${detailFont}`;
        ctx.fillStyle = subColor;
        ctx.fillText("KAMERA", ex + 26 * scale, ey + 45 * scale);
        ctx.fillStyle = mainColor;
        ctx.font = `${subWeight} ${Math.round(26 * scale)}px ${detailFont}`;
        let cam = this.exifData.camera || "-";
        if (cam.length > 20) cam = cam.substring(0, 20) + "...";
        ctx.fillText(cam, ex + 26 * scale, ey + 80 * scale);

        ctx.fillStyle = subColor;
        ctx.font = `${subWeight} ${Math.round(16 * scale)}px ${detailFont}`;
        ctx.fillText("LENS", ex + 424 * scale, ey + 45 * scale);
        ctx.fillStyle = mainColor;
        ctx.font = `${subWeight} ${Math.round(26 * scale)}px ${detailFont}`;
        let len = this.exifData.lens || "-";
        if (len.length > 20) len = len.substring(0, 20) + "...";
        ctx.fillText(len, ex + 424 * scale, ey + 80 * scale);

        ctx.beginPath();
        ctx.moveTo(ex + 16 * scale, ey + 115 * scale);
        ctx.lineTo(ex + ew - 16 * scale, ey + 115 * scale);
        ctx.strokeStyle = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();

        ctx.textAlign = "center";
        const colW = ew / 4;
        const drawSub = (lbl, val, idx) => {
            const rx = ex + colW * idx + colW / 2;
            ctx.fillStyle = subColor;
            ctx.font = `${subWeight} ${Math.round(15 * scale)}px ${detailFont}`;
            ctx.fillText(lbl, rx, ey + 160 * scale);
            ctx.fillStyle = mainColor;
            ctx.font = `${subWeight} ${Math.round(28 * scale)}px ${detailFont}`;
            ctx.fillText(val || "-", rx, ey + 200 * scale);
        };
        drawSub("ENSTANTANE", this.exifData.shutter, 0);
        drawSub("DİYAFRAM", this.exifData.aperture, 1);
        drawSub("ISO", this.exifData.iso, 2);
        drawSub("ODAK UZAKLIĞI", this.exifData.focal, 3);
        ctx.restore();
    }

    // 6. Başlık ve Metinler
    ctx.textAlign = "center";
    ctx.fillStyle = this.titleColor || bgInfo.textColor || "#ffffff";
    applyTextShadow();
    ctx.font = `${primaryWeight} ${this.titleFontSize || 64}px ${titleFont}`;
    const isTopBadge = shouldDrawExternalBadge && effectiveBadgeMode === 'top_floating';
    
    // Başlığın üst güvenli alana yapışmasını önleyen dinamik konum:
    // Instagram hikayelerinde üst profil barı ilk 180px'i kaplar, başlık en az 250px'den başlamalıdır
    let calculatedTitleY = this.loadedMain ? (isTopBadge ? cy - 115 : cy - 70) : 500;
    if (this.storyMode === "exif") {
        // EXIF modunda başlık üstte ferah ve güvenli 260px bandında yer alır
        calculatedTitleY = Math.max(260, Math.min(cy - 65, 340));
    } else {
        calculatedTitleY = Math.max(250, calculatedTitleY);
    }
    const titleY = calculatedTitleY;
    
    let renderedTitle = this.customTitle || "";
    if (this.titleIsUppercase && renderedTitle) {
        renderedTitle = renderedTitle.toLocaleUpperCase('tr-TR');
    }
    const titleLineHeight = Math.round((this.titleFontSize || 64) * 1.22);
    this.drawWrappedText(ctx, renderedTitle, 540, titleY + this.titleYOffset, 980, titleLineHeight);
    
    // Fotoğrafçı / Yazar Künyesi: Eğer Polaroid tabanında veya alttaki künye kartında zaten yer alıyorsa ayrı bir dış künye yazdırma
    const creditsAlreadyInBadge = isPolaroidFrame || (shouldDrawExternalBadge && effectiveBadgeMode === 'bottom_integrated');
    if (this.showBadgeCredits !== false && this.creditsText && this.creditsText.trim() !== "" && !creditsAlreadyInBadge) {
        applyTextShadow();
        ctx.fillStyle = this.creditsColor || (bgInfo.textColor !== "#111111" ? "#e2e8f0" : "#334155");
        let fstr = "";
        if (this.creditsIsItalic) fstr += "italic ";
        if (this.creditsIsBold && (!isSingleWeight || this.fontScope !== 'all')) fstr += "bold ";
        fstr += (this.creditsSize || 28) + `px ${detailFont}`;
        ctx.font = fstr;
        let cY = 1300;
        if (this.loadedMain) {
            cY = this.storyMode === "exif" ? cy + ch + shadowPad + 280 : cy + ch + shadowPad + 30;
        }
        ctx.fillText(this.creditsText, 540, cY + this.creditsYOffset);
    }

    if (this.showFooterText) {
        applyTextShadow();
        const fSize = this.footerFontSize || 44;
        ctx.font = `${footerWeight} ${fSize}px ${footerFont}`;
        ctx.fillStyle = this.footerTextColor || bgInfo.textColor || "#ffffff";
        // Instagram Güvenli Alan Kuralı: Alt mesaj barının hemen üstünde (1650px - 1700px bandı) güvenli yerleşim
        let baseFooterY = 1680;
        
        if (this.loadedMain) {
            if (isPolaroidFrame) {
                // Polaroid tabanı bittiğinde (cardY + cardH) hemen altına güvenli mesafe
                const polaroidBottom = (cy - 24) + (ch + 24 + 135);
                baseFooterY = Math.max(polaroidBottom + 70, 1660);
                if (baseFooterY > 1730) baseFooterY = 1730; // Instagram alt mesaj kutusuna taşmayı önle
            } else if (this.storyMode === "exif") {
                const scale = this.exifCardScale || 1.0;
                const eh = 240 * scale;
                let frameBottom = cy + ch + shadowPad;
                if (isPolaroidFrame) {
                    frameBottom = cy + ch + 135 + shadowPad;
                } else if (frame === 'vintage_card') {
                    frameBottom = cy + ch + 28 + shadowPad;
                } else if (frame === 'tape_corners') {
                    frameBottom = cy + ch + 8 + shadowPad;
                }

                let exifCardBaseY = frameBottom + 15;
                if (shouldDrawExternalBadge && effectiveBadgeMode === 'bottom_integrated') {
                    const hasL1 = Boolean(this.showBadgeLine1 !== false && (this.badgeLine1 || this.companyTitle));
                    const hasL2 = Boolean(this.showBadgeLine2 !== false && this.badgeLine2);
                    const hasL3 = Boolean((this.showBadgeLine3 !== false && this.badgeLine3) || (this.showBadgeCredits !== false && this.creditsText && this.creditsText.trim()));
                    let lc = (hasL1 ? 1 : 0) + (hasL2 ? 1 : 0) + (hasL3 ? 1 : 0);
                    const badgeHeight = lc === 3 ? 90 : (lc === 2 ? 65 : (lc === 1 ? 35 : 0));
                    exifCardBaseY = frameBottom + this.badgeYOffset + badgeHeight + 20;
                }
                const exifCardBottom = exifCardBaseY + this.exifYOffset + eh;
                baseFooterY = Math.max(exifCardBottom + 45, 1680);
                if (baseFooterY > 1730) baseFooterY = 1730;
            } else {
                let elemBottom = cy + ch + shadowPad;
                if (shouldDrawExternalBadge && effectiveBadgeMode === 'bottom_integrated') {
                    const hasL1 = Boolean(this.showBadgeLine1 !== false && (this.badgeLine1 || this.companyTitle));
                    const hasL2 = Boolean(this.showBadgeLine2 !== false && this.badgeLine2);
                    const hasL3 = Boolean(this.showBadgeLine3 !== false && this.badgeLine3);
                    const hasCredits = Boolean(this.creditsText && this.creditsText.trim());
                    const photoPlacement = this.photographerPlacement || 'same_line';
                    let lc = (hasL1 ? 1 : 0) + (hasL2 ? 1 : 0) + (hasL3 ? 1 : 0);
                    if (photoPlacement === 'separate_line' && hasCredits) {
                        lc += 1;
                    } else if (photoPlacement === 'same_line' && hasCredits && !hasL3) {
                        lc += 1;
                    }
                    if (lc === 0) lc = 1;
                    const badgeH = lc >= 4 ? 150 : (lc === 3 ? 124 : (lc === 2 ? 88 : 56));
                    elemBottom = cy + ch + shadowPad + this.badgeYOffset + badgeH;
                } else if (this.creditsText && this.creditsText.trim() !== "") {
                    elemBottom += 50;
                }
                baseFooterY = Math.max(elemBottom + 65, 1680);
                if (baseFooterY > 1730) baseFooterY = 1730;
            }
        }
        
        ctx.textAlign = "center";
        const footerStr = (this.customFooterText !== undefined && this.customFooterText !== null) ? this.customFooterText : "Daha Fazlası İçin:";
        ctx.fillText(footerStr, 540, baseFooterY + this.footerYOffset);
    }
    ctx.shadowColor = "transparent";
  }

  async copyToClipboard() {
    this.isCopying = true;
    m.redraw();
    const canvas = document.getElementById("framio-story-canvas");
    if (!canvas) {
        this.isCopying = false;
        m.redraw();
        return;
    }

    try {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                this.isCopying = false;
                m.redraw();
                return;
            }
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                app.alerts.show({ type: 'success' }, '✨ Hikaye panoya kopyalandı! Instagram Web veya istediğiniz yere yapıştırabilirsiniz.');
            } catch (err) {
                console.error("Panoya kopyalama hatası:", err);
                app.alerts.show({ type: 'error' }, 'Panoya kopyalama tarayıcınız tarafından desteklenmiyor olabilir.');
            }
            this.isCopying = false;
            m.redraw();
        }, 'image/png');
    } catch (e) {
        this.isCopying = false;
        m.redraw();
    }
  }

  async downloadStory() {
    this.isDownloading = true;
    m.redraw();
    const canvas = document.getElementById("framio-story-canvas");
    if (!canvas) {
        this.isDownloading = false;
        m.redraw();
        return;
    }

    const currentBg = this.backgrounds.find(b => b.id === this.selectedBgId);
    const isVideo = currentBg && currentBg.type === 'video';

    if (isVideo) {
        try {
            const stream = canvas.captureStream(30);
            let mimeType = 'video/webm;codecs=vp9';
            let ext = 'webm';
            if (MediaRecorder.isTypeSupported('video/mp4')) {
                mimeType = 'video/mp4';
                ext = 'mp4';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
                mimeType = 'video/webm;codecs=h264';
                ext = 'webm';
            }

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                videoBitsPerSecond: 6000000
            });

            const recordedChunks = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.download = brand().handle + "_hikaye_video_" + Date.now() + "." + ext;
                a.href = url;
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(url);
                this.isDownloading = false;
                m.redraw();

                // Sunucu arşivine de arka planda kaydet
                try {
                    const fd = new FormData();
                    fd.append('file', blob, "story_video_" + Date.now() + "." + ext);
                    app.request({
                        method: 'POST',
                        url: app.forum.attribute('apiUrl') + '/framio/social-share/story-archive',
                        body: fd,
                        serialize: raw => raw
                    }).catch(e => console.warn('Hikaye video arşive kaydedilemedi:', e));
                } catch(e) {}
            };

            mediaRecorder.start();
            setTimeout(() => {
                mediaRecorder.stop();
            }, 5000);

        } catch(err) {
            console.error("Video kaydı hatası:", err);
            alert("Video kaydı başlatılamadı: " + err.message);
            this.isDownloading = false;
            m.redraw();
        }
    } else {
        try {
            const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
            const a = document.createElement("a");
            a.download = brand().handle + "_hikaye_" + Date.now() + ".jpg";
            a.href = dataUrl;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Sunucu arşivine de arka planda kaydet
            app.request({
                method: 'POST',
                url: app.forum.attribute('apiUrl') + '/framio/social-share/story-archive',
                body: { image_data: dataUrl }
            }).catch(e => console.warn('Hikaye görseli arşive kaydedilemedi:', e));
        } catch(e) {
            alert("İndirme başarısız! Lütfen bağlantıyı kontrol edin.");
        }
        this.isDownloading = false;
        m.redraw();
    }
  }

  canPublishMetaStory() {
    const user = app.session.user;
    if (!user) return false;
    if (user.isAdmin && user.isAdmin()) return true;
    if (user.hasPermission && user.hasPermission('framio-social-share.publish-stories')) return true;

    const allowedPublishStr = app.forum.attribute('framio-social-share.allowed_story_publish_users') 
        || app.forum.attribute('framio-social-share.allowed_story_users') || '';
    const allowed = allowedPublishStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const uname = (user.username && user.username() || '').toLowerCase();
    const uid = String(user.id && user.id() || '');

    return allowed.includes(uname) || allowed.includes(uid);
  }

  setStorySchedulePreset(hoursAhead, fixedHour = null, fixedMinute = null) {
    const now = new Date();
    if (fixedHour !== null && fixedMinute !== null) {
      now.setHours(fixedHour, fixedMinute, 0, 0);
      if (now.getTime() <= Date.now()) {
        now.setDate(now.getDate() + 1);
      }
    } else {
      now.setTime(now.getTime() + hoursAhead * 3600 * 1000);
    }

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    this.storyScheduleDate = `${year}-${month}-${day}`;
    this.storyScheduleHour = hh;
    this.storyScheduleMinute = mm;
    this.storyScheduleEnabled = true;
    m.redraw();
  }

  async publishOrScheduleStory(sourceUrl = null) {
    if (!this.canPublishMetaStory()) {
        app.alerts.show({ type: 'error' }, 'Hikaye yayınlama veya planlama yetkiniz bulunmuyor.');
        return;
    }

    const acc = this.accounts && this.accounts[this.selectedStoryAccountIndex];
    if (!acc) {
        app.alerts.show({ type: 'error' }, 'Lütfen geçerli bir sosyal medya hesabı seçin.');
        return;
    }
    if (!this.storyPublishIg && !this.storyPublishFb) {
        app.alerts.show({ type: 'error' }, 'Lütfen paylaşım yapılacak en az bir platform seçin (Instagram veya Facebook).');
        return;
    }
    if (this.storyPublishIg && !acc.ig_id) {
        app.alerts.show({ type: 'error' }, 'Seçilen hesapta bağlı Instagram Business hesabı bulunmuyor.');
        return;
    }
    const pageId = acc.page_id || acc.fb_page_id;
    if (this.storyPublishFb && !pageId) {
        app.alerts.show({ type: 'error' }, 'Seçilen hesapta bağlı Facebook Sayfası bulunmuyor.');
        return;
    }

    let finalImageUrl = sourceUrl;

    this.isStoryPublishing = true;
    this.storyPublishProgress = 'Hikaye hazırlanıyor...';
    m.redraw();

    try {
        if (!finalImageUrl) {
            const canvas = document.getElementById("framio-story-canvas");
            if (!canvas) {
                throw new Error('Tuval (Canvas) bulunamadı.');
            }

            const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
            this.storyPublishProgress = 'Görsel sunucuya yükleniyor...';
            m.redraw();

            const uploadRes = await app.request({
                method: 'POST',
                url: app.forum.attribute('apiUrl') + '/framio/social-share/story-archive',
                body: { image_data: dataUrl }
            });

            if (!uploadRes || !uploadRes.url) {
                throw new Error('Görsel sunucuya yüklenemedi.');
            }

            const baseUrl = (app.forum.attribute('baseUrl') || window.location.origin).replace(/\/+$/, '');
            finalImageUrl = uploadRes.url.startsWith('http') ? uploadRes.url : baseUrl + uploadRes.url;
        }

        let scheduledAt = null;
        if (this.storyScheduleEnabled) {
            if (!this.storyScheduleDate) {
                throw new Error('Lütfen geçerli bir zamanlama tarihi seçin.');
            }
            scheduledAt = `${this.storyScheduleDate} ${this.storyScheduleHour || '20'}:${this.storyScheduleMinute || '00'}:00`;
        }

        const successMessages = [];

        // 1. Instagram Story
        if (this.storyPublishIg) {
            this.storyPublishProgress = scheduledAt ? 'Instagram Story planlanıyor...' : 'Instagram Story yayınlanıyor...';
            m.redraw();

            const igBody = {
                action: 'post_story',
                ig_id: acc.ig_id,
                image_url: finalImageUrl
            };
            if (scheduledAt) igBody.scheduled_at = scheduledAt;

            const igRes = await app.request({
                method: 'POST',
                url: app.forum.attribute('apiUrl') + '/framio/social-share/meta-business',
                body: igBody
            });

            if (igRes && igRes.success) {
                successMessages.push(scheduledAt ? 'Instagram Story planlandı' : 'Instagram Story yayınlandı');
            }
        }

        // 2. Facebook Story
        if (this.storyPublishFb) {
            this.storyPublishProgress = scheduledAt ? 'Facebook Story planlanıyor...' : 'Facebook Story yayınlanıyor...';
            m.redraw();

            const fbBody = {
                action: 'fb_post_story',
                page_id: pageId,
                image_url: finalImageUrl
            };
            if (scheduledAt) fbBody.scheduled_at = scheduledAt;

            const fbRes = await app.request({
                method: 'POST',
                url: app.forum.attribute('apiUrl') + '/framio/social-share/meta-business',
                body: fbBody
            });

            if (fbRes && fbRes.success) {
                successMessages.push(scheduledAt ? 'Facebook Story planlandı' : 'Facebook Story yayınlandı');
            }
        }

        if (successMessages.length > 0) {
            app.alerts.show({ type: 'success' }, (scheduledAt ? '⏰ ' : '🎉 ') + successMessages.join(' & ') + '!');
            this.storyScheduleEnabled = false;
        }
    } catch(err) {
        console.error('Story publish error:', err);
        app.alerts.show({ type: 'error' }, 'Hikaye işlemi başarısız: ' + ((err && err.response && (err.response.error || err.response.message)) || (err && err.message) || 'Hata oluştu'));
    } finally {
        this.isStoryPublishing = false;
        this.storyPublishProgress = '';
        m.redraw();
    }
  }
}


