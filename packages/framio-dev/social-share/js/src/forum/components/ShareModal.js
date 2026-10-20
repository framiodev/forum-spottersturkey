import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Stream from 'flarum/common/utils/Stream';
import app from 'flarum/forum/app';
import WatermarkModal from '../../../../../../upload-exif/js/src/forum/components/WatermarkModal';
import ForumFeedPickerModal from './ForumFeedPickerModal';
import { brand, renderCaption } from '../brand';
import SocialActionChooserModal from './SocialActionChooserModal';

const icon = (iconName, attrs = {}) => {
  attrs.className = (attrs.className || '') + ' icon ' + iconName;
  return m('i', attrs);
};

// Türkçe karakter duyarlı akıllı yazar / üye adı biçimlendirici
const formatAuthorName = (user) => {
  if (!user) return brand().name;

  let raw = '';
  // 1. Varsa Flarum Nickname veya displayName kontrolü
  try {
    if (user.nickname && typeof user.nickname === 'function' && user.nickname()) {
      raw = user.nickname();
    } else if (user.displayName && typeof user.displayName === 'function' && user.displayName()) {
      raw = user.displayName();
    } else if (user.username && typeof user.username === 'function' && user.username()) {
      raw = user.username();
    }
  } catch (e) {
    raw = brand().name;
  }

  if (!raw) return brand().name;

  const username = (user.username && typeof user.username === 'function' ? user.username() : raw).toLowerCase().trim();

  // 1. Admin Ayarlarındaki Özel İsim Haritası (framio-social-share.user_name_map)
  const nameMapStr = app.forum.attribute('framio-social-share.user_name_map') || '';
  if (nameMapStr) {
    const lines = nameMapStr.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || !line.includes(':')) continue;
      const parts = line.split(':');
      const u = parts[0].trim().toLowerCase();
      const mappedName = parts.slice(1).join(':').trim();
      if (u === username && mappedName) {
        return mappedName;
      }
    }
  }

  // 2. Bilinen varsayılan kullanıcı haritası
  const knownMap = {
    'alikaankaya': 'Ali Kaan KAYA',
    'mehmetardaicten': 'Mehmet Arda İÇTEN',
    'umutsayin': 'Umut SAYIN',
    'adembilgin': 'Adem BİLGİN',
    'mustafacantoprak': 'Mustafa Can TOPRAK',
    'yigityalcin': 'Yiğit YALÇIN',
    'serkankocakoc': 'Serkan KOCAKOÇ',
    'yusuftemel': 'Yusuf TEMEL',
    'abdulsametsahin': 'Abdulsamet ŞAHİN',
    'mertefeozmen': 'Mert Efe ÖZMEN',
    'emircandadas': 'Emircan DADAŞ',
    'emircan_dadas': 'Emircan DADAŞ',
  };

  const normalized = username.replace(/[^a-z0-9çğıöşü]/g, '');
  if (normalized === brand().handle) return brand().name;
  if (knownMap[normalized]) {
    return knownMap[normalized];
  }
  if (knownMap[raw.toLowerCase()]) {
    return knownMap[raw.toLowerCase()];
  }

  // 3. Eğer zaten boşluklu bir isim girilmişse (örn: "Emircan Dadaş" veya "Ali Kaan Kaya")
  if (raw.includes(' ')) {
    const parts = raw.trim().split(/\s+/);
    if (parts.length > 1) {
      const firstNames = parts.slice(0, -1).map(p => p.charAt(0).toLocaleUpperCase('tr-TR') + p.slice(1).toLocaleLowerCase('tr-TR')).join(' ');
      const lastName = parts[parts.length - 1].toLocaleUpperCase('tr-TR');
      return `${firstNames} ${lastName}`;
    }
  }

  // 4. CamelCase ayrıştırma (Örn: EmirCanDadas -> Emir Can DADAŞ)
  const camelSplit = raw.replace(/([a-zçğıöşü])([A-ZÇĞİÖŞÜ])/g, '$1 $2').trim();
  if (camelSplit.includes(' ')) {
    const parts = camelSplit.split(/\s+/);
    const firstNames = parts.slice(0, -1).map(p => p.charAt(0).toLocaleUpperCase('tr-TR') + p.slice(1).toLocaleLowerCase('tr-TR')).join(' ');
    const lastName = parts[parts.length - 1].toLocaleUpperCase('tr-TR');
    return `${firstNames} ${lastName}`;
  }

  // 5. Nokta, alt çizgi veya tire ile ayrılmış isimler (Örn: emircan.dadas, emircan_dadas)
  if (raw.includes('.') || raw.includes('_') || raw.includes('-')) {
    const parts = raw.split(/[\._\-]+/).filter(Boolean);
    if (parts.length > 1) {
      const firstNames = parts.slice(0, -1).map(p => p.charAt(0).toLocaleUpperCase('tr-TR') + p.slice(1).toLocaleLowerCase('tr-TR')).join(' ');
      const lastName = parts[parts.length - 1].toLocaleUpperCase('tr-TR');
      return `${firstNames} ${lastName}`;
    }
  }

  // Tek parça kullanıcı adıysa baş harfini büyüt
  return raw.charAt(0).toLocaleUpperCase('tr-TR') + raw.slice(1);
};

// Admin panelinden veya profilden kullanıcının Instagram hesabını çözer
const resolveUserInstagram = (user) => {
  if (!user) return '';

  const username = (user.username && typeof user.username === 'function' ? user.username() : '').toLowerCase().trim();
  
  // 1. Admin Ayarlarındaki Map Kontrolü (framio-social-share.user_instagram_map)
  const mapStr = app.forum.attribute('framio-social-share.user_instagram_map') || '';
  if (mapStr) {
    const lines = mapStr.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || !line.includes(':')) continue;
      const parts = line.split(':');
      const u = parts[0].trim().toLowerCase();
      const ig = parts.slice(1).join(':').trim();
      if (u === username && ig) {
        return ig.startsWith('@') ? ig : '@' + ig;
      }
    }
  }

  // 2. Kullanıcı Profilindeki Social Profile / Butonlar (Varsa)
  try {
    const socialButtons = user.attribute('socialButtons');
    if (socialButtons && typeof socialButtons === 'string') {
      const btns = JSON.parse(socialButtons);
      if (Array.isArray(btns)) {
        for (let b of btns) {
          if (b.title && b.title.toLowerCase().includes('instagram') && b.url) {
            const match = b.url.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
            if (match && match[1]) {
              return '@' + match[1];
            }
          }
        }
      }
    }
  } catch (e) {}

  // 3. Varsayılan eşleşme (alikaankaya için özel)
  if (username === 'alikaankaya') {
    return '@spottersturkeycom';
  }

  return '';
};

export default class ShareModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);
    
    try {
        const accountsJson = app.forum.attribute('framio-social-share.accounts_json') || '[]';
        this.accounts = [];
        let isMertefeozmen = false;
        try {
            if (window.location.href.includes('/u/mertefeozmen')) {
                isMertefeozmen = true;
            } else {
                const post = this.attrs.post;
                const postUser = post ? post.user() : null;
                if (postUser && postUser.username() === 'mertefeozmen') {
                    isMertefeozmen = true;
                }
            }
        } catch(e) {}
        
        try {
            let parsedAccounts = JSON.parse(accountsJson);
            
            if (isMertefeozmen) {
                this.accounts = parsedAccounts.filter(acc => acc.name && acc.name.toLowerCase().includes('tonaj'));
            } else {
                this.accounts = parsedAccounts;
            }
        } catch (e) {}

        const defaultIndex = parseInt(app.forum.attribute('framio-social-share.default_account_index') || "0");
        this.selectedAccountIndex = Stream(defaultIndex < this.accounts.length ? defaultIndex : 0);
        this.scheduleTime = Stream('');
        this.schedulePickerOpen = Stream(false);
        this.scheduleDate = Stream(new Date().toISOString().split('T')[0]);
        this.scheduleHour = Stream(String(new Date().getHours() + 1).padStart(2, '0'));
        this.scheduleMinute = Stream('00');
        
        this.images = this.attrs.images || [];
        this.selectedImages = this.images.map(() => Stream(true));
        // Görseller seçilir seçilmez tam kalite kopyalar hazırlanmaya başlar
        setTimeout(() => this.prepareImages(this.images), 0);
        this.activeImageIndex = Stream(0);
        this.previewLightboxIndex = Stream(null);

        // Sürükle-Bırak, Watermark Yükleme ve Forum Görsel Seçici State'leri
        this.draggedIndex = Stream(null);
        this.dragOverIndex = Stream(null);
        this.isDroppingFiles = Stream(false);
        this.uploadingNewImages = Stream(false);
        this.uploadProgress = Stream(0);
        this.showForumImagePicker = Stream(false);
        this.recentForumImages = Stream([]);
        this.loadingRecentImages = Stream(false);
        this.recentImagesSearch = Stream('');

        const discussion = this.attrs.post.discussion();
        const discussionTitle = discussion && discussion.title() ? discussion.title() : "Bilinmeyen Konu";
        
        // Akıllı Yazar ve Instagram Künyesi
        const user = this.attrs.post.user();
        const yazarAd = formatAuthorName(user);
        const userIg = resolveUserInstagram(user);
        const yazarKunye = userIg ? `${yazarAd} | ${userIg}` : `${yazarAd} |`;

        const fullYear = new Date().getFullYear().toString();
        const shortYil = "'" + fullYear.slice(-2);

        // Künye ayrıştırma (Bullet points or LI tags)
        const rawHtml = this.attrs.post.contentHtml() || "";
        
        let listItems = [];
        const liRegex = /<li[^>]*>(.*?)<\/li>/gi;
        let match;
        while ((match = liRegex.exec(rawHtml)) !== null) {
            listItems.push(match[1].replace(/<[^>]*>?/gm, '').trim());
        }

        let isFourLineFormat = false;
        let sirket = "", madde_1 = "", madde_2 = "", sehir = "", plaka = "", guzergah = "";
        
        if (listItems.length >= 4) {
            // Kullanıcının belirttiği 4 Satırlı Format:
            // 1. Satır: Araç marka modeli (Örn: Otokar Kent LF)
            // 2. Satır: Araç kapı kodu ve plakası (Örn: B-1513 | 34 HO 2442)
            // 3. Satır: Aracın hattı (Örn: H-6 | Yunus Emre Mahallesi-İstanbul Havalimanı)
            // 4. Satır: Çekim yeri ve çekim yılı (Örn: İstanbul Havalimanı / '26)
            isFourLineFormat = true;
            madde_1 = listItems[0].trim(); // Model
            madde_2 = listItems[1].trim(); // Kapı Kodu | Plaka
            guzergah = listItems[2].trim(); // Hat
            sehir = listItems[3].trim(); // Konum & Yıl

            sirket = madde_1;
            if (madde_2.includes('|')) {
                const pParts = madde_2.split('|');
                plaka = pParts.slice(1).join('|').trim();
            } else {
                plaka = madde_2;
            }
        } else if (listItems.length > 0) {
            let first = listItems[0];
            madde_1 = first;
            if (first.includes('|')) {
                let parts = first.split('|');
                sirket = parts[0].trim();
                plaka = parts.slice(1).join('|').trim();
            } else {
                sirket = first;
            }
            if (listItems.length > 1) {
                madde_2 = listItems[1].trim();
            }
            if (listItems.length > 2) {
                sehir = listItems[2].trim();
            }
        } else {
            sirket = discussionTitle;
        }

        // Şehir ve Yıl ayrıştırma: "Antalya / '26" -> Temiz Şehir: "Antalya", Temiz Yıl: "'26"
        let cleanCity = sehir || 'Bilinmiyor';
        let cleanYear = shortYil;
        if (cleanCity.includes('/')) {
            const cParts = cleanCity.split('/');
            cleanCity = cParts[0].trim();
            const yPart = cParts.slice(1).join('/').trim();
            if (yPart) {
                cleanYear = yPart.startsWith("'") ? yPart : (yPart.length === 2 ? "'" + yPart : (yPart.length === 4 ? "'" + yPart.slice(-2) : yPart));
            }
        }

        const sehirKunye = `${cleanCity} / ${cleanYear}`;

        // Düz Metin (text)
        let contentText = rawHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '');
        contentText = contentText.replace(/\n\s*\n/g, '\n').trim();

        // Trivia ayıklama
        let triviaText = "";
        let tIndex = contentText.indexOf("T R I V I A");
        if (tIndex !== -1) {
            triviaText = contentText.substring(tIndex).trim();
            contentText = contentText.substring(0, tIndex).trim();
        }

        // Akıllı Hashtag Üretimi
        let customTags = [];
        if (sirket) customTags.push(sirket.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/gi, ''));
        if (plaka) customTags.push(plaka.replace(/[^a-zA-Z0-9]/g, ''));

        if (madde_2) {
            const brandMatch = madde_2.match(/(Mercedes-Benz|MAN|Scania|Volvo|Ford|Neoplan|Setra|TEMSA|DAF|Otokar|Isuzu|Iveco)/i);
            if (brandMatch) {
                const brandClean = brandMatch[0].replace(/[^a-zA-Z0-9]/g, '');
                customTags.push(brandClean);
            }
            const cleanModelTag = madde_2.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/gi, '');
            if (cleanModelTag) customTags.push(cleanModelTag);
        }

        customTags.push(brand().hashtag);

        // Benzersiz (unique) ve geçerli tagleri filtrele
        let uniqueTags = [];
        for (let i = 0; i < customTags.length; i++) {
            if (customTags[i] && customTags[i].length > 1 && !uniqueTags.includes(customTags[i])) {
                uniqueTags.push(customTags[i]);
            }
        }
        let smartTags = uniqueTags.map(t => '#' + t).join(' ');

        // Yeni Standart Gönderi Formatı
        const header = isFourLineFormat 
            ? `${madde_1} & ${madde_2}`
            : (`${sirket}` + (madde_2 ? ` & ${madde_2}` : ''));
            
        const moreInfo = brand().more_info;
        
        // Künye satırları ("> Firma | Plaka", "> Marka Model", "> Güzergâh")
        const kunye = (isFourLineFormat
            ? [`> ${madde_1}`, `> ${madde_2}`, guzergah ? `> ${guzergah}` : '']
            : [`> ${sirket}` + (plaka ? ` | ${plaka}` : ''), madde_2 ? `> ${madde_2}` : '', guzergah ? `> ${guzergah}` : '']
        ).filter(Boolean).join('\n');

        // Gönderi metni admin'deki şablondan (Sosyal Medya → Marka ve Gönderi Metni)
        let safeMessage = renderCaption({ header, text: '', trivia: triviaText, more_info: moreInfo, kunye, location: sehirKunye, author: yazarKunye, tags: smartTags });
        
        if (isMertefeozmen) {
            safeMessage = '';
        }
            
        // Tek / Birden Çok Açıklama: fotoğraf bazında künye (mesajdaki sırayla)
        this.captionBase = { header, triviaText, moreInfo, yazarKunye, shortYil, isMertefeozmen };
        this.photoKunye = this.parsePhotoKunyes(rawHtml);
        const distinctKunye = new Set(this.images.map((u) => this.photoKunye[this.imageKey(u)]).filter(Boolean));
        this.captionMode = Stream(distinctKunye.size > 1 ? 'multi' : 'single');
        this.singleMessage = safeMessage;
        if (distinctKunye.size > 1 && !isMertefeozmen) {
            // Birden çok araç: Instagram/Threads tek açıklamada bütün künyeleri taşır
            safeMessage = this.buildMultiMessage();
        }

        this.originalMessage = safeMessage;
        this.messageFb = Stream(safeMessage);
        this.messageIg = Stream(safeMessage);
        this.messageThreads = Stream(safeMessage);
        // Facebook metni fotoğraf başına modundaysa künyeleri fotoğraflara bırakır
        if (this.captionMode() === 'multi') this.applyCaptionMode();
        this.activePlatformTab = Stream('facebook');
        
        this.postToFb = Stream(true);
        this.postToIg = Stream(true);
        this.postToThreads = Stream(true);

        this.aiLoading = Stream(false);
        this.aiLength = Stream('medium');
        
        // Metadata for AI generation
        this.postMeta = {
            sirket: sirket,
            plaka: plaka,
            model: madde_2,
            sehir: cleanCity,
            yazar: yazarKunye,
            yil: cleanYear,
            trivia: triviaText,
            title: discussionTitle,
            smart_tags: smartTags,
            images: this.images || []
        };

        // Eğer Watermark modalından veya Forum Feed Picker'dan geri dönüldüyse state'i eksiksiz geri yükle
        if (this.attrs.initialState) {
            const s = this.attrs.initialState;
            if (s.images) this.images = [...s.images];
            if (s.selectedImages) this.selectedImages = s.selectedImages.map(v => typeof v === 'function' ? v : Stream(v));
            if (s.messageFb !== undefined) this.messageFb(s.messageFb);
            if (s.messageIg !== undefined) this.messageIg(s.messageIg);
            if (s.messageThreads !== undefined) this.messageThreads(s.messageThreads);
            if (s.selectedAccountIndex !== undefined) this.selectedAccountIndex(s.selectedAccountIndex);
            if (s.activePlatformTab !== undefined) this.activePlatformTab(s.activePlatformTab);
            if (s.postToFb !== undefined) this.postToFb(s.postToFb);
            if (s.postToIg !== undefined) this.postToIg(s.postToIg);
            if (s.postToThreads !== undefined) this.postToThreads(s.postToThreads);
            if (s.activeImageIndex !== undefined) this.activeImageIndex(s.activeImageIndex);
            if (s.scheduleTime !== undefined) this.scheduleTime(s.scheduleTime);
            if (s.captionMode) this.captionMode(s.captionMode);
            if (s.photoKunye) this.photoKunye = { ...s.photoKunye };
        }

        // Eğer bekleyen dosya filigran yüklemesi varsa hemen başlat
        if (this.attrs.pendingUpload) {
            const { fileList, result } = this.attrs.pendingUpload;
            setTimeout(() => {
                this.uploadWatermarkedFiles(fileList, result);
            }, 50);
        }
    } catch(err) {
        console.error("ShareModal oninit error:", err);
        this.originalMessage = "";
        this.messageFb = Stream("Hata oluştu: " + err.toString());
        this.messageIg = Stream("Hata oluştu: " + err.toString());
        this.messageThreads = Stream("Hata oluştu: " + err.toString());
        this.activePlatformTab = Stream('facebook');
        this.accounts = [];
        this.selectedAccountIndex = Stream(0);
        this.scheduleTime = Stream('');
        this.images = [];
        this.activeImageIndex = Stream(0);
        this.postToFb = Stream(true);
        this.postToIg = Stream(true);
        this.postToThreads = Stream(true);
        this.aiLoading = Stream(false);
        this.aiLength = Stream('medium');
        this.postMeta = {};
    }
    
    this.aiProgressStep = Stream('');
  }

  generateAiCaption(length = 'medium') {
    this.aiLoading(true);
    this.aiLength(length);
    this.aiProgressStep(length === 'web' ? '🔍 1/4: Plaka ve araç geçmişi taranıyor...' : '✨ Metin hazırlanıyor...');

    let progressTimer = null;
    if (length === 'web') {
      let step = 0;
      const steps = [
        '🔍 1/4: Plaka ve araç geçmişi taranıyor...',
        '🌐 2/4: YouTube, Instagram ve forum arşivleri taranıyor...',
        '🔄 3/4: Önceki firma ve teslimat geçmişi doğrulanıyor...',
        '✍️ 4/4: Spotter arşiv metni sentezleniyor...'
      ];
      progressTimer = setInterval(() => {
        step++;
        if (step < steps.length) {
          this.aiProgressStep(steps[step]);
          m.redraw();
        }
      }, 2000);
    }

    app.request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/framio/social-share/ai-generate',
        body: {
            length: length,
            meta: this.postMeta || {}
        }
    }).then((res) => {
        if (progressTimer) clearInterval(progressTimer);
        this.aiLoading(false);
        this.aiProgressStep('');
        if (res && res.success && res.caption) {
            if (this.postToFb()) this.messageFb(res.caption);
            if (this.postToIg()) this.messageIg(res.caption);
            if (this.postToThreads()) this.messageThreads(res.caption);

            app.alerts.show({ type: 'success' }, `✨ ${length === 'web' ? 'Derin Arşiv & Filo Araştırması' : 'AI Metni'} başarıyla tamamlandı.`);
        } else if (res && res.error) {
            app.alerts.show({ type: 'error' }, res.error);
        }
        m.redraw();
    }).catch((err) => {
        if (progressTimer) clearInterval(progressTimer);
        this.aiLoading(false);
        this.aiProgressStep('');
        console.error("AI Generation error:", err);
        app.alerts.show({ type: 'error' }, 'AI metin oluşturulurken bir hata meydana geldi.');
        m.redraw();
    });
  }

  resetToOriginalCaption() {
    if (!this.originalMessage) return;
    if (this.postToFb()) this.messageFb(this.originalMessage);
    if (this.postToIg()) this.messageIg(this.originalMessage);
    if (this.postToThreads()) this.messageThreads(this.originalMessage);
    app.alerts.show({ type: 'success' }, 'Metin orijinal şablon haline döndürüldü.');
    m.redraw();
  }

  moveImage(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.images.length) return;

    // Swap images
    const tempImg = this.images[index];
    this.images[index] = this.images[newIndex];
    this.images[newIndex] = tempImg;

    // Swap selected state
    const tempSelected = this.selectedImages[index]();
    this.selectedImages[index](this.selectedImages[newIndex]());
    this.selectedImages[newIndex](tempSelected);

    // Update active image preview index
    if (this.activeImageIndex() === index) {
      this.activeImageIndex(newIndex);
    } else if (this.activeImageIndex() === newIndex) {
      this.activeImageIndex(index);
    }

    m.redraw();
  }

  reorderImage(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= this.images.length || toIndex < 0 || toIndex >= this.images.length) return;
    
    const movedImg = this.images.splice(fromIndex, 1)[0];
    this.images.splice(toIndex, 0, movedImg);
    
    const movedSelected = this.selectedImages.splice(fromIndex, 1)[0];
    this.selectedImages.splice(toIndex, 0, movedSelected);
    
    this.activeImageIndex(toIndex);
    m.redraw();
  }

  deleteImage(index) {
    if (this.images.length <= 1) {
      alert('En az bir görsel bulunmalıdır!');
      return;
    }
    this.images.splice(index, 1);
    this.selectedImages.splice(index, 1);
    if (this.activeImageIndex() >= this.images.length) {
      this.activeImageIndex(this.images.length - 1);
    }
    m.redraw();
  }

  getCurrentModalState() {
    return {
      images: [...this.images],
      selectedImages: this.selectedImages.map(s => s()),
      messageFb: this.messageFb(),
      messageIg: this.messageIg(),
      messageThreads: this.messageThreads(),
      selectedAccountIndex: this.selectedAccountIndex(),
      activePlatformTab: this.activePlatformTab(),
      postToFb: this.postToFb(),
      postToIg: this.postToIg(),
      postToThreads: this.postToThreads(),
      activeImageIndex: this.activeImageIndex(),
      scheduleTime: this.scheduleTime(),
      captionMode: this.captionMode ? this.captionMode() : 'single',
      photoKunye: { ...(this.photoKunye || {}) }
    };
  }

  // ─────────────────────────────── Tek / Birden Çok Açıklama

  /** Görsel adresinin karşılaştırma anahtarı (thumb_/proxy farkını yok sayar) */
  imageKey(url) {
    let name = String(url || '').split('?')[0].split('/').pop() || '';
    try { name = decodeURIComponent(name); } catch (e) {}
    return name.replace(/^(thumb_|mini_)/, '').toLowerCase();
  }

  /** Mesaj HTML'inden görsel → künye metni (satırlar \n ile) */
  parsePhotoKunyes(html) {
    const out = {};
    const box = document.createElement('div');
    box.innerHTML = html || '';
    let pending = [];
    let first = '';
    box.querySelectorAll('img, .framio-kunye-card, ul').forEach((el) => {
      if (el.tagName === 'IMG') {
        const key = this.imageKey(el.getAttribute('src') || el.getAttribute('data-src'));
        if (key && !(key in out)) { out[key] = ''; pending.push(key); }
        return;
      }
      if (el.tagName === 'UL' && el.closest('.framio-kunye-card')) return;
      const lines = Array.from(el.querySelectorAll('li')).map((li) => li.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (!lines.length) return;
      const text = lines.join('\n');
      if (!first) first = text;
      pending.forEach((k) => { out[k] = text; });
      pending = [];
    });
    Object.keys(out).forEach((k) => { if (!out[k]) out[k] = first; });
    // Paylaşım listesindeki (sonradan eklenmiş olabilecek) görseller
    let last = first;
    this.images.forEach((u) => {
      const k = this.imageKey(u);
      if (out[k]) last = out[k]; else out[k] = last;
    });
    return out;
  }

  /** Mesajdaki fotoğraflar farklı araçlara mı ait? */
  hasMultipleVehicles() {
    return new Set(this.images.map((u) => (this.photoKunye[this.imageKey(u)] || '').trim()).filter(Boolean)).size > 1;
  }

  /** Facebook fotoğraf açıklaması: o fotoğrafın künyesi */
  fbPhotoCaption(url) {
    const lines = (this.photoKunye[this.imageKey(url)] || '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return '';
    const last = lines.length > 2 && /\/\s*'?\d{2,4}\s*$/.test(lines[lines.length - 1]) ? lines.pop() : '';
    return lines.map((l) => '> ' + l).join('\n') + (last ? `\n📌 ${last}` : '');
  }

  /**
   * Seçili fotoğrafların künyelerinden birleşik gönderi metni.
   * withBlocks=false: Facebook'ta künyeler fotoğraf açıklamalarına taşındığında
   * gönderi metninde yalnızca başlık, bilgi ve etiketler kalır.
   */
  buildMultiMessage(withBlocks = true) {
    const b = this.captionBase || {};
    const selected = this.images.filter((u, i) => !this.selectedImages[i] || this.selectedImages[i]());
    const groups = [];
    selected.forEach((u, i) => {
      const text = (this.photoKunye[this.imageKey(u)] || '').trim();
      if (!text) return;
      const g = groups.find((x) => x.text === text);
      if (g) g.nums.push(i + 1); else groups.push({ text, nums: [i + 1] });
    });
    if (!groups.length) return this.singleMessage || '';

    const tags = [];
    const heads = [];
    const blocks = groups.map((g) => {
      const lines = g.text.split('\n').map((l) => l.trim()).filter(Boolean);
      const last = lines.length > 2 && /\/\s*'?\d{2,4}\s*$/.test(lines[lines.length - 1]) ? lines.pop() : '';
      heads.push(lines.slice(0, 2).join(' & '));
      const [company, plate] = (lines[0] || '').split('|').map((s) => (s || '').trim());
      if (company) tags.push(company.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/gi, ''));
      if (plate) tags.push(plate.replace(/[^a-zA-Z0-9]/g, ''));
      const numLabel = groups.length > 1 ? `📷 ${g.nums.join(', ')}\n` : '';
      return numLabel + lines.map((l) => '> ' + l).join('\n') + (last ? `\n📌 ${last}` : '');
    });
    tags.push(brand().hashtag);
    const smartTags = tags.filter((t, i) => t && t.length > 1 && tags.indexOf(t) === i).map((t) => '#' + t).join(' ');

    const parts = [heads.join(' • ')];
    if (b.triviaText) parts.push(b.triviaText);
    parts.push(b.moreInfo);
    parts.push((withBlocks ? blocks.join('\n\n') + '\n\n' : '') + `📸: ${b.yazarKunye}\n\n${smartTags}`);
    return parts.join('\n\n').trim();
  }

  /**
   * Fotoğraf başına açıklama yalnızca Facebook'ta desteklenir (Meta Graph API:
   * yayımlanmamış fotoğraflara caption + attached_media). Instagram ve
   * Threads kaydırmalı gönderide tek açıklama kabul eder; onlara her zaman
   * bütün künyeleri içeren tek metin gider.
   */
  applyCaptionMode(mode) {
    if (mode) this.captionMode(mode);
    if (this.captionBase && this.captionBase.isMertefeozmen) return;
    const combined = this.hasMultipleVehicles() ? this.buildMultiMessage(true) : this.singleMessage;
    const fb = this.captionMode() === 'multi' ? this.buildMultiMessage(false) : combined;
    this.originalMessage = combined;
    this.messageFb(fb);
    this.messageIg(combined);
    this.messageThreads(combined);
  }

  /** Facebook'a gidecek görseller: fotoğraf başına modunda açıklamalı */
  facebookImages(finalImages) {
    if (this.captionMode() !== 'multi' || finalImages.length < 2) return finalImages;
    return finalImages.map((url) => ({ url, caption: this.fbPhotoCaption(url) }));
  }

  renderCaptionModeSwitch() {
    const opt = (mode, iconName, label) => {
      const active = this.captionMode() === mode;
      return (
        <button type="button" onclick={(e) => { e.preventDefault(); this.applyCaptionMode(mode); }} title={mode === 'single' ? 'Bütün künyeler gönderi metninde' : 'Facebook: her fotoğraf kendi künyesini açıklama olarak taşır'} style={{
          padding: '4px 11px', border: 'none', borderRadius: '999px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, lineHeight: '16px',
          background: active ? '#1e293b' : 'transparent', color: active ? '#fff' : '#64748b', transition: 'all .15s'
        }}>
          <i className={iconName} style={{ marginRight: '5px', fontSize: '10px' }}></i>{label}
        </button>
      );
    };
    return (
      <div style={{ display: 'inline-flex', gap: '2px', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px', borderRadius: '999px' }}>
        {opt('single', 'fas fa-align-left', 'Tek Açıklama')}
        {opt('multi', 'fas fa-images', 'Fotoğraf Başına')}
      </div>
    );
  }

  /** Birden Çok modunda önizlemedeki fotoğrafın künye alanı */
  renderPhotoKunyeEditor(selectedImagesArray) {
    if (this.captionMode() !== 'multi' || !selectedImagesArray.length) return null;
    const i = Math.min(this.activeImageIndex(), selectedImagesArray.length - 1);
    const key = this.imageKey(selectedImagesArray[i]);
    if (!this.photoKunye[key]) {
      // Önceki fotoğrafın künyesi yinelenir
      for (let j = i - 1; j >= 0; j--) {
        const prev = this.photoKunye[this.imageKey(selectedImagesArray[j])];
        if (prev) { this.photoKunye[key] = prev; break; }
      }
    }
    const nav = (dir) => {
      const t = i + dir;
      const off = t < 0 || t >= selectedImagesArray.length;
      return (
        <button type="button" disabled={off} onclick={(e) => { e.preventDefault(); this.activeImageIndex(t); }} style={{ width: '22px', height: '22px', borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', color: '#334155', cursor: off ? 'default' : 'pointer', opacity: off ? 0.35 : 1, fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={dir < 0 ? 'fas fa-chevron-left' : 'fas fa-chevron-right'}></i>
        </button>
      );
    };
    return (
      <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px' }}>
        <img src={selectedImagesArray[i]} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#334155' }}>
            {nav(-1)}
            <span>Fotoğraf {i + 1} / {selectedImagesArray.length} · Facebook açıklaması</span>
            {nav(1)}
          </div>
          <textarea className="FormControl" rows="3" value={this.photoKunye[key] || ''}
            oninput={(e) => { this.photoKunye[key] = e.target.value; this.applyCaptionMode(); }}
            placeholder={'Firma | Plaka\nMarka Model\nŞehir / \'26'}
            style={{ fontSize: '12px', lineHeight: '1.45', padding: '6px 8px', borderRadius: '6px', minHeight: '58px', resize: 'vertical' }} />
        </div>
      </div>
    );
  }

  startWatermarkUploadFlow(files) {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    
    const state = this.getCurrentModalState();
    let isHandled = false;

    app.modal.show(WatermarkModal, {
      files: fileList,
      onconfirm: (result) => {
        isHandled = true;
        app.modal.show(ShareModal, {
          ...this.attrs,
          images: state.images,
          initialState: state,
          pendingUpload: { fileList, result }
        });
      },
      oncancel: () => {
        if (!isHandled) {
          isHandled = true;
          app.modal.show(ShareModal, {
            ...this.attrs,
            images: state.images,
            initialState: state
          });
        }
      }
    });
  }

  uploadWatermarkedFiles(fileList, result) {
    this.uploadingNewImages(true);
    this.uploadProgress(0);
    m.redraw();

    const selections = result.selections || [];
    const targetUsername = result.targetUsername || '';
    const targetWatermarkType = result.targetWatermarkType || '';
    const customFileNames = result.customFileNames || [];

    const uploadPromises = fileList.map((file, i) => {
      let watermarkType = selections[i] || 'none';
      if (watermarkType === 'admin_override') watermarkType = 'none';
      const customName = customFileNames[i] || '';

      const formData = new FormData();
      formData.append('spotter_image', file);
      formData.append('watermark_type', watermarkType);
      if (customName) formData.append('custom_filename', customName);
      if (targetUsername) {
        formData.append('target_username', targetUsername);
        if (targetWatermarkType) formData.append('target_watermark_type', targetWatermarkType);
      }

      return app.request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/framio/social-share/upload-watermarked',
        body: formData,
        serialize: (raw) => raw
      }).then(res => {
        if (res && res.success && res.url) {
          return res.url;
        }
        return null;
      }).catch(err => {
        console.error('Watermark upload error:', err);
        return null;
      });
    });

    Promise.all(uploadPromises).then(urls => {
      this.uploadingNewImages(false);
      const validUrls = urls.filter(u => !!u);
      if (validUrls.length > 0) {
        validUrls.forEach(url => {
          this.images.push(url);
          this.selectedImages.push(Stream(true));
        });
        this.activeImageIndex(this.images.length - 1);
        app.alerts.show({ type: 'success' }, `✨ ${validUrls.length} yeni filigranlı görsel paylaşıma eklendi.`);
      } else {
        app.alerts.show({ type: 'error' }, 'Görsel yüklenirken bir sorun oluştu.');
      }
      m.redraw();
    });
  }

  openForumFeedPicker() {
    const state = this.getCurrentModalState();
    let isHandled = false;

    app.modal.show(ForumFeedPickerModal, {
      existingImages: [...this.images],
      onconfirm: (selectedUrls) => {
        isHandled = true;
        const newImages = [...state.images];
        const newSelectedImages = [...state.selectedImages];
        let addedCount = 0;

        if (selectedUrls && selectedUrls.length > 0) {
          selectedUrls.forEach(url => {
            if (!newImages.includes(url)) {
              newImages.push(url);
              newSelectedImages.push(true);
              addedCount++;
            }
          });
        }

        const updatedState = {
          ...state,
          images: newImages,
          selectedImages: newSelectedImages,
          activeImageIndex: newImages.length > 0 ? newImages.length - 1 : 0
        };

        app.modal.show(ShareModal, {
          ...this.attrs,
          images: newImages,
          initialState: updatedState
        });

        if (addedCount > 0) {
          app.alerts.show({ type: 'success' }, `✨ Forumdan ${addedCount} yeni görsel paylaşıma eklendi.`);
        }
      },
      oncancel: () => {
        if (!isHandled) {
          isHandled = true;
          app.modal.show(ShareModal, {
            ...this.attrs,
            images: state.images,
            initialState: state
          });
        }
      }
    });
  }

  loadRecentForumImages(query = '') {
    this.loadingRecentImages(true);
    m.redraw();
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio/social-share/recent-images',
      params: { q: query, limit: 40 }
    }).then(res => {
      this.recentForumImages(res.images || []);
      this.loadingRecentImages(false);
      m.redraw();
    }).catch(err => {
      console.error(err);
      this.loadingRecentImages(false);
      m.redraw();
    });
  }

  toggleAddForumImage(imgObj) {
    const existingIndex = this.images.indexOf(imgObj.url);
    if (existingIndex !== -1) {
      if (this.images.length > 1) {
        this.images.splice(existingIndex, 1);
        this.selectedImages.splice(existingIndex, 1);
        if (this.activeImageIndex() >= this.images.length) {
          this.activeImageIndex(this.images.length - 1);
        }
      }
    } else {
      this.images.push(imgObj.url);
      this.selectedImages.push(Stream(true));
      this.activeImageIndex(this.images.length - 1);
      app.alerts.show({ type: 'success' }, 'Görsel paylaşıma eklendi.');
    }
    m.redraw();
  }

  mountLightboxPortal() {
    let portal = document.getElementById('framio-share-lightbox-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'framio-share-lightbox-portal';
      document.body.appendChild(portal);
    }

    const self = this;
    m.mount(portal, {
      view: () => {
        const curIdx = self.previewLightboxIndex();
        if (curIdx === null || !self.images || !self.images[curIdx]) return null;
        const currentImg = self.images[curIdx];
        const total = self.images.length;

        return (
          <div 
            className="FramioShare-Lightbox"
            onclick={() => { self.previewLightboxIndex(null); m.redraw(); }}
          >
            <button 
              type="button" 
              className="FramioShare-CloseBtn"
              onclick={(e) => { e.stopPropagation(); self.previewLightboxIndex(null); m.redraw(); }}
              title="Kapat (ESC)"
            >
              <i className="fas fa-times"></i>
            </button>

            <div className="FramioShare-Lightbox-Wrapper" onclick={e => e.stopPropagation()}>
              {total > 1 && curIdx > 0 ? (
                <button 
                  type="button" 
                  className="OuterNav Prev"
                  onclick={(e) => { e.stopPropagation(); self.previewLightboxIndex(curIdx - 1); m.redraw(); }}
                  title="Önceki Görsel (Sol Ok)"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
              ) : null}

              <div 
                className="FramioShare-ImageContainer" 
                onclick={() => { self.previewLightboxIndex(null); m.redraw(); }} 
                style="cursor: zoom-out;"
              >
                <img 
                  src={currentImg} 
                  alt={`Görsel ${curIdx + 1}`}
                  onclick={e => e.stopPropagation()}
                />
              </div>

              {total > 1 && curIdx < total - 1 ? (
                <button 
                  type="button" 
                  className="OuterNav Next"
                  onclick={(e) => { e.stopPropagation(); self.previewLightboxIndex(curIdx + 1); m.redraw(); }}
                  title="Sonraki Görsel (Sağ Ok)"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              ) : null}

              {total > 1 ? (
                <div className="FramioShare-CounterBadge">
                  {curIdx + 1} / {total}
                </div>
              ) : null}
            </div>
          </div>
        );
      }
    });
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    this.keyHandler = (e) => {
      if (this.previewLightboxIndex() !== null) {
        if (e.key === 'Escape') {
          this.previewLightboxIndex(null);
          m.redraw();
        } else if (e.key === 'ArrowLeft') {
          const cur = this.previewLightboxIndex();
          if (cur > 0) {
            this.previewLightboxIndex(cur - 1);
            m.redraw();
          }
        } else if (e.key === 'ArrowRight') {
          const cur = this.previewLightboxIndex();
          if (cur < this.images.length - 1) {
            this.previewLightboxIndex(cur + 1);
            m.redraw();
          }
        }
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    this.mountLightboxPortal();
  }

  onupdate(vnode) {
    super.onupdate(vnode);
  }

  onremove(vnode) {
    super.onremove(vnode);
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }
    const portal = document.getElementById('framio-share-lightbox-portal');
    if (portal) {
      m.mount(portal, null);
      portal.remove();
    }
  }

  className() {
    return 'FramioShareModal Modal--large';
  }

  view() {
    return (
      <div className={'Modal modal-dialog ' + this.className()}>
        <div className="Modal-content">
          
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
                        images: this.images,
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
                    <i className="fas fa-share-nodes"></i>
                </div>
                <div className="Header-Titles" style="pointer-events: auto;">
                    <h3 style="font-size: 17px; font-weight: 700; color: #0f172a; margin: 0;">Gönderi Paylaş</h3>
                </div>
            </div>

            <div className="ModalClose" style="z-index: 2;">
                <button onclick={() => app.modal.close()} type="button" title="Kapat">
                    <i className="fas fa-times"></i>
                </button>
            </div>
          </div>

          <form onsubmit={this.onsubmit.bind(this)} style="height: calc(100% - 64px); display: flex; flex-direction: column;">
            {this.content()}
          </form>
        </div>
      </div>
    );
  }

  title() {
    return 'Gönderi Paylaş';
  }

  content() {
    const selectedImagesArray = this.images.filter((img, i) => this.selectedImages[i]());
    if (this.activeImageIndex() >= selectedImagesArray.length && selectedImagesArray.length > 0) {
        this.activeImageIndex(selectedImagesArray.length - 1);
    } else if (selectedImagesArray.length === 0) {
        this.activeImageIndex(0);
    }

    return (
      <div className="Modal-body">
        {/* SOL: KONTROLLER VE EDİTÖR */}
        <div className="Framio-Modal-Left">
            
            {/* 1. KART: HESAP VE YAYIN PLATFORMLARI */}
            <div className="Section-Card">
                <div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-end;">
                    <div style="flex: 1; min-width: 220px;">
                        <label className="Field-Label">
                            <i className="fas fa-id-badge" style="color: var(--primary-color, #e03131);"></i> Hedef Hesap
                        </label>
                        <select className="FormControl" style="border-radius: 8px; border: 1px solid #cbd5e1; padding: 8px 12px; height: 38px; font-size: 13px; font-weight: 500; background: #f8fafc;" onchange={e => this.selectedAccountIndex(e.target.value)} value={this.selectedAccountIndex()}>
                            {this.accounts.length === 0 ? <option value="0">Hesap Bulunamadı (Admin'den ekleyin)</option> : null}
                            {this.accounts.map((acc, index) => (
                                <option value={index}>{acc.name} ({acc.page_id})</option>
                            ))}
                        </select>
                    </div>

                    <div style="display: flex; gap: 8px; flex: 1; min-width: 240px;">
                         <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', padding: '8px 10px', background: this.postToFb() ? '#eff6ff' : '#ffffff', color: this.postToFb() ? '#2563eb' : '#94a3b8', borderRadius: '8px', fontWeight: '600', border: `1.5px solid ${this.postToFb() ? '#3b82f6' : '#e2e8f0'}`, transition: 'all 0.2s', fontSize: '12px' }}>
                             <input type="checkbox" checked={this.postToFb()} onchange={e => { this.postToFb(e.target.checked); if(e.target.checked) this.activePlatformTab('facebook'); else if(this.postToIg()) this.activePlatformTab('instagram'); else if(this.postToThreads()) this.activePlatformTab('threads'); }} style={{ margin: 0, cursor: 'pointer' }} />
                             <i className="fab fa-facebook" style={{ fontSize: '14px' }}></i> FB
                         </label>
                         <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', padding: '8px 10px', background: this.postToIg() ? '#fdf2f8' : '#ffffff', color: this.postToIg() ? '#db2777' : '#94a3b8', borderRadius: '8px', fontWeight: '600', border: `1.5px solid ${this.postToIg() ? '#ec4899' : '#e2e8f0'}`, transition: 'all 0.2s', fontSize: '12px' }}>
                             <input type="checkbox" checked={this.postToIg()} onchange={e => { this.postToIg(e.target.checked); if(e.target.checked) this.activePlatformTab('instagram'); else if(this.postToFb()) this.activePlatformTab('facebook'); else if(this.postToThreads()) this.activePlatformTab('threads'); }} style={{ margin: 0, cursor: 'pointer' }} />
                             <i className="fab fa-instagram" style={{ fontSize: '14px' }}></i> IG
                         </label>
                         <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', padding: '8px 10px', background: this.postToThreads() ? '#f1f5f9' : '#ffffff', color: this.postToThreads() ? '#0f172a' : '#94a3b8', borderRadius: '8px', fontWeight: '600', border: `1.5px solid ${this.postToThreads() ? '#0f172a' : '#e2e8f0'}`, transition: 'all 0.2s', fontSize: '12px' }}>
                             <input type="checkbox" checked={this.postToThreads()} onchange={e => { this.postToThreads(e.target.checked); if(e.target.checked) this.activePlatformTab('threads'); else if(this.postToFb()) this.activePlatformTab('facebook'); else if(this.postToIg()) this.activePlatformTab('instagram'); }} style={{ margin: 0, cursor: 'pointer' }} />
                             <i className="fab fa-threads" style={{ fontSize: '14px' }}></i> Threads
                         </label>
                    </div>
                </div>
            </div>

            {/* 2. KART: GÖRSEL SEÇİCİ, SÜRÜKLE-BIRAK & FORUM ARŞİVİ */}
            <div 
                className={`Section-Card ${this.isDroppingFiles() ? 'Dropzone-Active' : ''}`}
                ondragover={(e) => {
                    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
                        e.preventDefault();
                        if (!this.isDroppingFiles()) {
                            this.isDroppingFiles(true);
                            m.redraw();
                        }
                    }
                }}
                ondragleave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget)) return;
                    this.isDroppingFiles(false);
                    m.redraw();
                }}
                ondrop={(e) => {
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        e.preventDefault();
                        this.isDroppingFiles(false);
                        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                        if (files.length > 0) {
                            this.startWatermarkUploadFlow(files);
                        }
                        m.redraw();
                    }
                }}
            >
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                    <label className="Field-Label" style="margin: 0;">
                        <i className="fas fa-images" style="color: var(--primary-color, #e03131);"></i> Paylaşılacak Görseller ({selectedImagesArray.length}/{this.images.length})
                    </label>
                    
                    {/* Ekleme Butonları */}
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <input 
                            type="file" 
                            multiple 
                            accept="image/*" 
                            id="framio-device-file-input" 
                            style="display: none;" 
                            onchange={(e) => {
                                const files = Array.from(e.target.files);
                                if (files.length > 0) {
                                    this.startWatermarkUploadFlow(files);
                                }
                                e.target.value = '';
                            }} 
                        />
                        <button 
                            type="button" 
                            onclick={() => {
                                const fileInput = document.getElementById('framio-device-file-input');
                                if (fileInput) fileInput.click();
                            }}
                            style="padding: 5px 10px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #1e293b; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.2s;"
                            onmouseover={e => e.currentTarget.style.borderColor = '#6366f1'}
                            onmouseout={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                            title="Bilgisayarınızdan fotoğraf seçip filigran ekleyin"
                        >
                            <i className="fas fa-upload" style="color: #6366f1;"></i> + Cihazdan Yükle
                        </button>

                        <button 
                            type="button" 
                            onclick={() => this.openForumFeedPicker()}
                            style="padding: 5px 10px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #1e293b; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.2s;"
                            onmouseover={e => e.currentTarget.style.borderColor = '#4f46e5'}
                            onmouseout={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                            title="Forumun akışındaki diğer gönderilerden görsel seçip ekleyin"
                        >
                            <i className="fas fa-images" style="color: #4f46e5;"></i> Forum Arşivi
                        </button>
                    </div>
                </div>

                {/* Yükleme Devam Ediyor Göstergesi */}
                {this.uploadingNewImages() ? (
                    <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 10px 14px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; font-size: 12px; color: #3730a3; font-weight: 600;">
                        <i className="fas fa-spinner fa-spin" style="font-size: 16px;"></i>
                        <span>Fotoğraflar işleniyor, filigran uygulanıyor ve sosyal medya için optimize ediliyor...</span>
                    </div>
                ) : null}

                {/* Sürükle Bırak Bildirimi */}
                {this.isDroppingFiles() ? (
                    <div style="background: #eef2ff; border: 2px dashed #6366f1; border-radius: 8px; padding: 20px; text-align: center; color: #4338ca; font-weight: 700; font-size: 13px;">
                        <i className="fas fa-cloud-arrow-up" style="font-size: 24px; display: block; margin-bottom: 6px;"></i>
                        Fotoğrafları buraya bırakın (Otomatik İmza / Filigran Modalı Açılacaktır)
                    </div>
                ) : (
                    <div style="display: flex; gap: 10px; overflow-x: auto; padding: 4px 0; scrollbar-width: thin;">
                        {this.images.map((img, i) => (
                            <div 
                                className={`Framio-ImageThumbCard ${this.draggedIndex() === i ? 'is-dragging' : ''} ${this.dragOverIndex() === i ? 'drag-over' : ''}`}
                                draggable={true}
                                ondragstart={(e) => {
                                    this.draggedIndex(i);
                                    e.dataTransfer.setData('text/plain', String(i));
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                ondragover={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (this.dragOverIndex() !== i) {
                                        this.dragOverIndex(i);
                                        m.redraw();
                                    }
                                }}
                                ondragleave={(e) => {
                                    if (this.dragOverIndex() === i) {
                                        this.dragOverIndex(null);
                                        m.redraw();
                                    }
                                }}
                                ondrop={(e) => {
                                    e.preventDefault();
                                    const src = this.draggedIndex();
                                    if (src !== null && src !== i) {
                                        this.reorderImage(src, i);
                                    }
                                    this.draggedIndex(null);
                                    this.dragOverIndex(null);
                                    m.redraw();
                                }}
                                ondragend={() => {
                                    this.draggedIndex(null);
                                    this.dragOverIndex(null);
                                    m.redraw();
                                }}
                            >
                                <div style="position: relative; display: inline-block;">
                                    <input 
                                        type="checkbox" 
                                        checked={this.selectedImages[i]()} 
                                        onchange={e => this.selectedImages[i](e.target.checked)} 
                                        style="position: absolute; top: 4px; left: 4px; z-index: 10; cursor: pointer;" 
                                        title="Paylaşıma Dahil Et / Çıkar"
                                    />
                                    <button 
                                        type="button" 
                                        onclick={(e) => { e.preventDefault(); e.stopPropagation(); this.deleteImage(i); }} 
                                        style="position: absolute; top: 4px; right: 4px; z-index: 10; background: rgba(239, 68, 68, 0.9); color: #ffffff; border: none; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 9px; cursor: pointer; transition: all 0.2s;" 
                                        title="Görseli Listeden Sil"
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                    <img 
                                        src={img} 
                                        onclick={() => this.activeImageIndex(i)} 
                                        style={`width: 64px; height: 64px; object-fit: cover; border-radius: 6px; border: 2px solid ${this.selectedImages[i]() ? 'var(--primary-color, #e03131)' : '#cbd5e1'}; opacity: ${this.selectedImages[i]() ? '1' : '0.35'}; transition: all 0.2s; cursor: pointer; display: block;`} 
                                        title="Önizlemede görmek için tıkla" 
                                    />
                                    <button 
                                        type="button" 
                                        onclick={(e) => { e.preventDefault(); e.stopPropagation(); this.previewLightboxIndex(i); }} 
                                        style="position: absolute; bottom: 4px; right: 4px; z-index: 10; background: rgba(15, 23, 42, 0.75); color: #ffffff; border: none; border-radius: 4px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: pointer; transition: all 0.2s;" 
                                        title="Görseli Büyüt (Lightbox)"
                                    >
                                        <i className="fas fa-search-plus"></i>
                                    </button>
                                </div>
                                <div style="display: flex; gap: 4px; align-items: center;">
                                    <button type="button" disabled={i === 0} onclick={(e) => { e.preventDefault(); this.moveImage(i, -1); }} style={{ padding: '2px 5px', fontSize: '9px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', color: i === 0 ? '#cbd5e1' : '#334155', cursor: i === 0 ? 'not-allowed' : 'pointer' }} title="Sola Taşı">
                                        <i className="fas fa-arrow-left"></i>
                                    </button>
                                    <button type="button" disabled={i === this.images.length - 1} onclick={(e) => { e.preventDefault(); this.moveImage(i, 1); }} style={{ padding: '2px 5px', fontSize: '9px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', color: i === this.images.length - 1 ? '#cbd5e1' : '#334155', cursor: i === this.images.length - 1 ? 'not-allowed' : 'pointer' }} title="Sağa Taşı">
                                        <i className="fas fa-arrow-right"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 3. KART: METİN EDİTÖRÜ & AI ARAÇ ÇUBUĞU */}
            <div className="Section-Card" style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label className="Field-Label" style="margin: 0;">
                        <i className="fas fa-pen-nib" style="color: var(--primary-color, #e03131);"></i> Gönderi Metni
                    </label>

                    {selectedImagesArray.length > 1 && this.activePlatformTab() === 'facebook' && this.postToFb() ? this.renderCaptionModeSwitch() : null}

                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '2px' }}>
                        <button onclick={(e) => { e.preventDefault(); this.activePlatformTab('facebook'); }} style={{ padding: '4px 10px', fontSize: '11px', border: 'none', background: this.activePlatformTab() === 'facebook' ? '#ffffff' : 'transparent', color: this.activePlatformTab() === 'facebook' ? '#2563eb' : '#64748b', borderRadius: '6px', boxShadow: this.activePlatformTab() === 'facebook' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', cursor: 'pointer', fontWeight: '600', opacity: this.postToFb() ? 1 : 0.4 }} disabled={!this.postToFb()}>
                            <i className="fab fa-facebook" style={{ marginRight: '4px' }}></i> FB
                        </button>
                        <button onclick={(e) => { e.preventDefault(); this.activePlatformTab('instagram'); }} style={{ padding: '4px 10px', fontSize: '11px', border: 'none', background: this.activePlatformTab() === 'instagram' ? '#ffffff' : 'transparent', color: this.activePlatformTab() === 'instagram' ? '#db2777' : '#64748b', borderRadius: '6px', boxShadow: this.activePlatformTab() === 'instagram' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', cursor: 'pointer', fontWeight: '600', opacity: this.postToIg() ? 1 : 0.4 }} disabled={!this.postToIg()}>
                            <i className="fab fa-instagram" style={{ marginRight: '4px' }}></i> IG
                        </button>
                        <button onclick={(e) => { e.preventDefault(); this.activePlatformTab('threads'); }} style={{ padding: '4px 10px', fontSize: '11px', border: 'none', background: this.activePlatformTab() === 'threads' ? '#ffffff' : 'transparent', color: this.activePlatformTab() === 'threads' ? '#0f172a' : '#64748b', borderRadius: '6px', boxShadow: this.activePlatformTab() === 'threads' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', cursor: 'pointer', fontWeight: '600', opacity: this.postToThreads() ? 1 : 0.4 }} disabled={!this.postToThreads()}>
                            <i className="fab fa-threads" style={{ marginRight: '4px' }}></i> Threads
                        </button>
                    </div>
                </div>

                {/* AI Metin Oluşturucu & Orijinale Dön Araç Çubuğu */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-color, #e03131)', fontSize: '12px', fontWeight: '600' }}>
                        <i className={`fas ${this.aiLoading() ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                        <span>{this.aiLoading() ? (this.aiProgressStep() || 'AI Araştırma Yapıyor...') : 'AI Metin Oluşturucu:'}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="button" disabled={this.aiLoading()} onclick={(e) => { e.preventDefault(); this.generateAiCaption('short'); }} style={{ padding: '5px 9px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: this.aiLoading() ? 'not-allowed' : 'pointer', fontWeight: '600', transition: 'all 0.2s', outline: 'none' }} title="Kısa ve öz kurumsal metin">
                            ⚡ Kısa
                        </button>
                        <button type="button" disabled={this.aiLoading()} onclick={(e) => { e.preventDefault(); this.generateAiCaption('medium'); }} style={{ padding: '5px 9px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: this.aiLoading() ? 'not-allowed' : 'pointer', fontWeight: '600', transition: 'all 0.2s', outline: 'none' }} title="Dengeli kurumsal metin">
                            ✨ Orta
                        </button>
                        <button type="button" disabled={this.aiLoading()} onclick={(e) => { e.preventDefault(); this.generateAiCaption('long'); }} style={{ padding: '5px 9px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: this.aiLoading() ? 'not-allowed' : 'pointer', fontWeight: '600', transition: 'all 0.2s', outline: 'none' }} title="Detaylı hikaye ve künyeli metin">
                            📖 Uzun
                        </button>
                        <button type="button" disabled={this.aiLoading()} onclick={(e) => { e.preventDefault(); this.generateAiCaption('web'); }} style={{ padding: '5px 11px', fontSize: '11px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', cursor: this.aiLoading() ? 'not-allowed' : 'pointer', fontWeight: '600', transition: 'all 0.2s', outline: 'none', boxShadow: '0 2px 6px rgba(99,102,241,0.3)' }} title="Görsel ve plakayı internette araştırarak derin arşiv metni üretir">
                            🌐 Web / Filo Araştır
                        </button>
                        <button type="button" onclick={(e) => { e.preventDefault(); this.resetToOriginalCaption(); }} style={{ marginLeft: '4px', padding: '5px 9px', fontSize: '11px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#ffffff', color: '#64748b', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', outline: 'none', display: 'flex', alignItems: 'center', gap: '4px' }} title="Orijinal şablon metnine geri dön">
                            <i className="fas fa-undo"></i> Orijinal
                        </button>
                    </div>
                </div>

                {selectedImagesArray.length > 1 && this.activePlatformTab() === 'facebook' && this.postToFb() ? this.renderPhotoKunyeEditor(selectedImagesArray) : null}

                {selectedImagesArray.length > 1 && this.activePlatformTab() !== 'facebook' && this.hasMultipleVehicles() ? (
                    <div style={{ fontSize: '11px', color: '#64748b', background: '#f8fafc', border: '1px dashed #e2e8f0', borderRadius: '8px', padding: '6px 10px' }}>
                        <i className="fas fa-info-circle" style={{ marginRight: '5px' }}></i>
                        {this.activePlatformTab() === 'instagram' ? 'Instagram' : 'Threads'} kaydırmalı gönderide yalnızca tek açıklama kabul eder; bütün araçların künyesi bu metinde. Fotoğraf başına açıklama yalnızca Facebook'ta.
                    </div>
                ) : null}

                {this.activePlatformTab() === 'facebook' && this.postToFb() ? (
                    <textarea bidi={this.messageFb} className="FormControl" style="border-radius: 8px; border: 1.5px solid #3b82f6; min-height: 130px; resize: vertical; padding: 12px; font-size: 13px; line-height: 1.5; background: #ffffff;" placeholder="Facebook gönderi metni..." />
                ) : null}
                
                {this.activePlatformTab() === 'instagram' && this.postToIg() ? (
                    <textarea bidi={this.messageIg} className="FormControl" style="border-radius: 8px; border: 1.5px solid #ec4899; min-height: 130px; resize: vertical; padding: 12px; font-size: 13px; line-height: 1.5; background: #ffffff;" placeholder="Instagram gönderi metni..." />
                ) : null}

                {this.activePlatformTab() === 'threads' && this.postToThreads() ? (
                    <textarea bidi={this.messageThreads} className="FormControl" style="border-radius: 8px; border: 1.5px solid #0f172a; min-height: 130px; resize: vertical; padding: 12px; font-size: 13px; line-height: 1.5; background: #ffffff;" placeholder="Threads gönderi metni..." />
                ) : null}
                
                {(([this.postToFb(), this.postToIg(), this.postToThreads()].filter(Boolean).length) > 1) ? (
                    <div style={{ textAlign: 'right' }}>
                        <button type="button" onclick={() => {
                            let currentText = '';
                            if (this.activePlatformTab() === 'facebook') currentText = this.messageFb();
                            else if (this.activePlatformTab() === 'instagram') currentText = this.messageIg();
                            else if (this.activePlatformTab() === 'threads') currentText = this.messageThreads();

                            if (this.postToFb()) this.messageFb(currentText);
                            if (this.postToIg()) this.messageIg(currentText);
                            if (this.postToThreads()) this.messageThreads(currentText);

                            app.alerts.show({ type: 'success' }, 'Metin diğer tüm platformlara başarıyla kopyalandı.');
                        }} style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '6px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', outline: 'none', fontWeight: '500' }}>
                            <i className="fas fa-copy"></i> Bu Metni Diğer Platformlara Senkronize Et
                        </button>
                    </div>
                ) : null}
                
                {!this.postToFb() && !this.postToIg() && !this.postToThreads() ? (
                    <div style="border-radius: 8px; border: 1px dashed #ef4444; min-height: 100px; display: flex; align-items: center; justify-content: center; color: #ef4444; background: #fef2f2; font-size: 13px; font-weight: 500;">
                        Lütfen paylaşım yapılacak en az bir sosyal ağ seçin.
                    </div>
                ) : null}
            </div>

            {/* 4. ALT BAR: ZAMANLAYICI & PAYLAŞ BUTONU */}
            <div className="Section-Card" style="padding: 14px 18px; background: #ffffff; display: flex; flex-direction: column; gap: 12px;">
                
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                    {/* Şık ve Modern Zamanlama Butonu */}
                    <div style="display: inline-flex; align-items: center; gap: 8px;">
                        <button 
                            type="button"
                            className={`Button ${this.scheduleTime() ? 'Button--primary' : 'Button--text'}`}
                            style={{ 
                                borderRadius: '8px', 
                                border: `1.5px solid ${this.scheduleTime() ? 'var(--primary-color, #e03131)' : '#cbd5e1'}`, 
                                background: this.scheduleTime() ? '#fff5f5' : '#f8fafc', 
                                color: this.scheduleTime() ? 'var(--primary-color, #e03131)' : '#334155', 
                                fontSize: '13px', 
                                fontWeight: '600', 
                                padding: '9px 16px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer'
                            }}
                            onclick={(e) => { 
                                e.preventDefault();
                                e.stopPropagation();
                                const nextState = !this.schedulePickerOpen();
                                this.schedulePickerOpen(nextState);
                                m.redraw();
                            }}
                        >
                            <i className={this.scheduleTime() ? 'fas fa-calendar-check' : 'fas fa-clock'} style={{ color: 'var(--primary-color, #e03131)' }}></i>
                            <span>{this.scheduleTime() ? `Planlandı: ${this.scheduleTime().replace('T', ' ')}` : 'İçeriği Planla'}</span>
                            <i className={`fas fa-chevron-${this.schedulePickerOpen() ? 'up' : 'down'}`} style="font-size: 11px; margin-left: 4px; opacity: 0.7;"></i>
                        </button>

                        {this.scheduleTime() ? (
                            <button 
                                type="button"
                                className="Button Button--danger"
                                style={{ fontSize: '12px', fontWeight: '600', padding: '7px 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                                onclick={(e) => { 
                                    e.preventDefault();
                                    e.stopPropagation();
                                    this.scheduleTime(''); 
                                    this.schedulePickerOpen(false); 
                                    m.redraw();
                                }}
                            >
                                <i className="fas fa-times"></i> Planı İptal Et
                            </button>
                        ) : null}
                    </div>

                    {/* Forum Varsayılan Rengi Paylaş Butonu */}
                    <div style="flex-shrink: 0;">
                        <Button 
                            className="Button Button--primary" 
                            style="border-radius: 8px; font-weight: 700; font-size: 14px; padding: 10px 24px; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px;" 
                            loading={this.loading} 
                            icon={this.scheduleTime() ? 'fas fa-calendar-check' : 'fas fa-paper-plane'}
                            onclick={this.onsubmit.bind(this)}
                        >
                            {this.scheduleTime() ? ' Gönderiyi Planla' : ' Gönderiyi Şimdi Paylaş'}
                        </Button>
                    </div>
                </div>

                {/* Açılır / Kapanır İnline Zamanlayıcı Alanı */}
                {this.schedulePickerOpen() ? (
                    <div 
                        oncreate={(vnode) => {
                            setTimeout(() => {
                                const leftPane = document.querySelector('.Framio-Modal-Left');
                                if (leftPane) {
                                    leftPane.scrollTo({ top: leftPane.scrollHeight, behavior: 'smooth' });
                                } else if (vnode && vnode.dom) {
                                    vnode.dom.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                }
                            }, 60);
                        }}
                        style="margin-top: 6px; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; display: flex; flex-direction: column; gap: 12px;"
                    >
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-weight: 700; font-size: 12px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
                                <i className="fas fa-calendar-day" style="color: var(--primary-color, #e03131); margin-right: 6px;"></i> Yayınlanma Tarihi ve Saati
                            </span>
                            <span style="font-size: 11px; color: #94a3b8;">Gönderi belirtilen saatte otomatik paylaşılacaktır</span>
                        </div>

                        {/* Hızlı Seçim Butonları (Chips) */}
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button type="button" onclick={() => {
                                const d = new Date(Date.now() + 60*60*1000);
                                const pad = (n) => String(n).padStart(2, '0');
                                this.scheduleDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
                                this.scheduleHour(pad(d.getHours()));
                                this.scheduleMinute('00');
                            }} style="padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; background: #ffffff; border: 1px solid #cbd5e1; color: #334155; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
                                ⚡ +1 Saat Sonra
                            </button>
                            <button type="button" onclick={() => {
                                const d = new Date();
                                const pad = (n) => String(n).padStart(2, '0');
                                this.scheduleDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
                                this.scheduleHour('20');
                                this.scheduleMinute('00');
                            }} style="padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; background: #ffffff; border: 1px solid #cbd5e1; color: #334155; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
                                🌙 Bu Akşam 20:00
                            </button>
                            <button type="button" onclick={() => {
                                const d = new Date(Date.now() + 24*60*60*1000);
                                const pad = (n) => String(n).padStart(2, '0');
                                this.scheduleDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
                                this.scheduleHour('10');
                                this.scheduleMinute('00');
                            }} style="padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; background: #ffffff; border: 1px solid #cbd5e1; color: #334155; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
                                ☀️ Yarın 10:00
                            </button>
                        </div>

                        {/* Tarih ve Saat Seçimi */}
                        <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
                            <div style="flex: 2; min-width: 140px;">
                                <label style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px; display: block;">Tarih</label>
                                <input type="date" className="FormControl" style="border-radius: 6px; border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 13px; height: 36px; background: #ffffff;" value={this.scheduleDate()} oninput={e => this.scheduleDate(e.target.value)} />
                            </div>
                            <div style="flex: 2; min-width: 140px;">
                                <label style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px; display: block;">Saat (SS:DD)</label>
                                <div style="display: flex; gap: 4px; align-items: center;">
                                    <select className="FormControl" style="border-radius: 6px; border: 1px solid #cbd5e1; padding: 4px 8px; font-size: 13px; height: 36px; background: #ffffff; text-align: center; flex: 1;" value={this.scheduleHour()} onchange={e => this.scheduleHour(e.target.value)}>
                                        {Array.from({length: 24}, (_, i) => String(i).padStart(2, '0')).map(h => <option value={h}>{h}</option>)}
                                    </select>
                                    <span style="font-weight: bold; color: #64748b;">:</span>
                                    <select className="FormControl" style="border-radius: 6px; border: 1px solid #cbd5e1; padding: 4px 8px; font-size: 13px; height: 36px; background: #ffffff; text-align: center; flex: 1;" value={this.scheduleMinute()} onchange={e => this.scheduleMinute(e.target.value)}>
                                        {['00', '15', '30', '45'].map(minuteVal => <option value={minuteVal}>{minuteVal}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <Button 
                                    className="Button Button--primary"
                                    style="padding: 8px 16px; font-size: 13px; font-weight: 600; border-radius: 6px; height: 36px; display: inline-flex; align-items: center; gap: 6px;"
                                    icon="fas fa-check"
                                    onclick={() => {
                                        const formatted = `${this.scheduleDate()}T${this.scheduleHour()}:${this.scheduleMinute()}`;
                                        this.scheduleTime(formatted);
                                        this.schedulePickerOpen(false);
                                    }}
                                >
                                    Tarihi Onayla
                                </Button>
                                <Button 
                                    className="Button"
                                    style="padding: 8px 12px; font-size: 13px; font-weight: 600; border-radius: 6px; background: #ffffff; color: #64748b; border: 1px solid #cbd5e1; height: 36px;"
                                    onclick={() => {
                                        this.schedulePickerOpen(false);
                                    }}
                                >
                                    Vazgeç
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : null}

            </div>

        </div>

        {/* SAĞ: CANLI SOSYAL ÖNİZLEME */}
        <div className="Framio-Modal-Right">
            <div style="width: 100%; max-width: 330px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                
                {/* Header */}
                <div style="display: flex; align-items: center; padding: 10px 14px; border-bottom: 1px solid #f1f5f9;">
                    {this.activePlatformTab() === 'instagram' ? (
                        <div style="width: 30px; height: 30px; min-width: 30px; border-radius: 50%; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); display: flex; align-items: center; justify-content: center; color: #ffffff; margin-right: 10px; box-shadow: 0 2px 6px rgba(220, 39, 67, 0.3);">
                            <i className="fab fa-instagram" style="font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center;"></i>
                        </div>
                    ) : (this.activePlatformTab() === 'threads' ? (
                        <div style="width: 30px; height: 30px; min-width: 30px; border-radius: 50%; background: #000000; display: flex; align-items: center; justify-content: center; color: #ffffff; margin-right: 10px;">
                            <i className="fab fa-threads" style="font-size: 15px; line-height: 1; display: flex; align-items: center; justify-content: center;"></i>
                        </div>
                    ) : (
                        <div style="width: 30px; height: 30px; min-width: 30px; border-radius: 50%; background: #ffffff; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; color: #1877f2; margin-right: 10px;">
                            <i className="fab fa-facebook" style="font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center;"></i>
                        </div>
                    ))}
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 700; font-size: 13px; color: #0f172a; line-height: 1.2;">{brand().handle}</span>
                        <span style="font-size: 11px; color: #94a3b8;">
                            {this.activePlatformTab() === 'facebook' ? 'Şimdi • 🌐' : (this.activePlatformTab() === 'threads' ? 'Threads' : 'Instagram')}
                        </span>
                    </div>
                    <div style="margin-left: auto; color: #94a3b8; font-size: 13px;"><i className="fas fa-ellipsis-h"></i></div>
                </div>

                {/* Image Slider - Sosyal Medya Standart Gönderi Oranı (4:3 / 16:9 cover) */}
                <div style="position: relative; width: 100%; height: 230px; background: #f8fafc; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    {selectedImagesArray.length > 0 ? (
                        <img 
                            src={selectedImagesArray[this.activeImageIndex()]} 
                            onclick={() => {
                                const currentUrl = selectedImagesArray[this.activeImageIndex()];
                                const idx = this.images.indexOf(currentUrl);
                                this.previewLightboxIndex(idx !== -1 ? idx : 0);
                            }}
                            style="width: 100%; height: 100%; object-fit: cover; cursor: pointer; transition: transform 0.2s;" 
                            title="Büyük boyutta görmek için tıkla (Lightbox)"
                        />
                    ) : (
                        <div style="color: #64748b; font-size: 13px; text-align: center;">
                            <i className="far fa-image" style="font-size: 24px; display: block; margin: 0 auto 6px;"></i> Görsel Seçilmedi
                        </div>
                    )}
                    
                    {selectedImagesArray.length > 1 && (
                        <div>
                            {this.activeImageIndex() > 0 ? (
                                <button onclick={(e) => { e.preventDefault(); this.activeImageIndex(this.activeImageIndex() - 1); }} style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.9); color: #0f172a; border: none; border-radius: 50%; width: 26px; height: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.2); font-size: 11px;"><i className="fas fa-chevron-left"></i></button>
                            ) : null}
                            {this.activeImageIndex() < selectedImagesArray.length - 1 ? (
                                <button onclick={(e) => { e.preventDefault(); this.activeImageIndex(this.activeImageIndex() + 1); }} style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.9); color: #0f172a; border: none; border-radius: 50%; width: 26px; height: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.2); font-size: 11px;"><i className="fas fa-chevron-right"></i></button>
                            ) : null}
                            <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: #ffffff; font-size: 10px; font-weight: 600; padding: 3px 7px; border-radius: 10px;">
                                {this.activeImageIndex() + 1} / {selectedImagesArray.length}
                            </div>
                        </div>
                    )}
                </div>

                {/* Social Actions */}
                {this.activePlatformTab() === 'instagram' ? (
                    <div style="padding: 10px 14px; display: flex; gap: 14px; font-size: 20px; color: #0f172a;">
                        <i className="far fa-heart" style="cursor: pointer;"></i>
                        <i className="far fa-comment" style="cursor: pointer;"></i>
                        <i className="far fa-paper-plane" style="cursor: pointer;"></i>
                        <span style="margin-left: auto;"><i className="far fa-bookmark" style="cursor: pointer;"></i></span>
                    </div>
                ) : (this.activePlatformTab() === 'threads' ? (
                    <div style="padding: 10px 14px; display: flex; gap: 16px; font-size: 17px; color: #0f172a;">
                        <i className="far fa-heart" style="cursor: pointer;"></i>
                        <i className="far fa-comment" style="cursor: pointer;"></i>
                        <i className="fas fa-retweet" style="cursor: pointer;"></i>
                        <i className="far fa-paper-plane" style="cursor: pointer;"></i>
                    </div>
                ) : (
                    <div style="padding: 6px 14px; display: flex; justify-content: space-between; color: #64748b; font-weight: 600; font-size: 12px; border-bottom: 1px solid #f1f5f9;">
                        <div style="display: flex; align-items: center; gap: 4px; cursor: pointer;"><i className="far fa-thumbs-up"></i> Beğen</div>
                        <div style="display: flex; align-items: center; gap: 4px; cursor: pointer;"><i className="far fa-comment-alt"></i> Yorum</div>
                        <div style="display: flex; align-items: center; gap: 4px; cursor: pointer;"><i className="fas fa-share"></i> Paylaş</div>
                    </div>
                ))}

                {/* Caption Preview */}
                <div style="padding: 0 14px 14px; font-size: 13px; color: #334155; line-height: 1.45; max-height: 180px; overflow-y: auto; scrollbar-width: thin;">
                    <span style="font-weight: 700; color: #0f172a; margin-right: 6px;">{brand().handle}</span>
                    <span style="white-space: pre-wrap; word-break: break-word;">
                        {!this.postToFb() && !this.postToIg() && !this.postToThreads() ? "Gövde metni kapalı." : (this.activePlatformTab() === 'facebook' ? this.messageFb() : (this.activePlatformTab() === 'threads' ? this.messageThreads() : this.messageIg()))}
                    </span>
                </div>
            </div>
        </div>

      </div>
    );
  }

  /**
   * Seçilen görsellerin tam kalite, imzalı kopyaları sunucuda (Firebase) arka planda hazırlanır.
   * Pencerede gösterilen adresler değişmez; yalnızca gönderirken hazırlanmış adresler kullanılır.
   */
  prepareImages(list) {
    this.prepared = this.prepared || {};
    const todo = (list || []).filter((u) => typeof u === 'string' && !this.prepared[u] && !/\/social-temp\//.test(u));
    if (!todo.length) return this.preparing || Promise.resolve();
    const p = app
      .request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/framio/social-share/prepare-images', body: { urls: todo } })
      .then((res) => Object.assign(this.prepared, (res && res.map) || {}))
      .catch(() => {});
    this.preparing = Promise.all([this.preparing, p]);
    return this.preparing;
  }

  onsubmit(e) {
    e.preventDefault();
    this.loading = true;
    const account = this.accounts[this.selectedAccountIndex()];

    if (!account) { alert('Hesap seçilmedi! Lütfen Admin panelinden bir hesap ekleyin.'); this.loading = false; return; }

    const finalImages = this.images.filter((img, i) => this.selectedImages[i]());

    if (finalImages.length === 0) { alert('En az bir görsel seçmelisiniz!'); this.loading = false; return; }
    if (!this.postToFb() && !this.postToIg() && !this.postToThreads()) { alert('Lütfen gönderiyi paylaşmak için en az bir platform seçin.'); this.loading = false; return; }

    // Tam kalite kopyalar hazır olana kadar beklenir; adresler onlarla değiştirilir
    const swap = (u) => (this.prepared && this.prepared[u]) || u;
    const swapItem = (it) => (it && typeof it === 'object' ? Object.assign({}, it, { url: swap(it.url) }) : swap(it));
    this.prepareImages(finalImages).then(() => app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio/social-share',
      body: {
        messageFb: this.postToFb() ? this.messageFb() : '',
        messageIg: this.postToIg() ? this.messageIg() : '',
        messageThreads: this.postToThreads() ? this.messageThreads() : '',
        // Facebook fotoğraf başına açıklamaları görsel öğesinde taşınır; sunucu
        // Instagram/Threads için yalnızca adresleri kullanır
        images: (this.postToFb() ? this.facebookImages(finalImages) : finalImages).map(swapItem),
        pageId: account.page_id,
        igId: account.ig_id,
        threadsId: account.threads_id,
        // jeton sunucuda kimliğe göre bulunur
        scheduleTime: this.scheduleTime()
      }
    })).then((res) => {
      this.loading = false;
      app.modal.close();
      if(res.errors && res.errors.length > 0) {
          app.alerts.show({ type: 'warning' }, 'Uyarılar: ' + res.errors.join(', '));
      } else {
          app.alerts.show({ type: 'success' }, 'Gönderi başarıyla iletildi!');
      }
    }).catch((err) => {
      this.loading = false;
      app.alerts.show({ type: 'error' }, 'Bir hata oluştu.');
    });
  }
}