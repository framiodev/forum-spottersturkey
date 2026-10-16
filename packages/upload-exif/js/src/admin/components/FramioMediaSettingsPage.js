import saveSettings from 'flarum/admin/utils/saveSettings';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Switch from 'flarum/common/components/Switch';
import app from 'flarum/admin/app';
import Stream from 'flarum/common/utils/Stream';

export const AI_PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    free: true,
    keyLink: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIza...',
    defaultModel: 'gemini-3.5-flash-lite',
    models: [
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (en hızlı, ücretsiz katman)' },
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (en yeni, daha isabetli)' },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
      { id: 'gemini-4-argon', label: 'Gemini 4 Argon (amiral gemisi, yavaş)' },
    ],
  },
  groq: {
    name: 'Groq',
    free: true,
    keyLink: 'https://console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
    defaultModel: 'qwen/qwen3.8-27b',
    models: [
      { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B (çok hızlı, ücretsiz katman)' },
      { id: 'meta-models/muse-spark-open', label: 'Muse Spark (sınırlı önizleme)' },
    ],
  },
  nvidia: {
    name: 'NVIDIA NIM',
    free: true,
    keyLink: 'https://build.nvidia.com/settings/api-keys',
    keyPlaceholder: 'nvapi-...',
    defaultModel: 'google/gemma-4-31b-it',
    models: [
      { id: 'google/gemma-4-31b-it', label: 'Gemma 4 31B (hızlı, ücretsiz)' },
      { id: 'nvidia/nemotron-3.5-super-vl-120b-a12b', label: 'Nemotron 3.5 Super VL 120B (en isabetli, ücretsiz)' },
      { id: 'meta/llama-3.2-90b-vision-instruct', label: 'Llama 3.2 90B Vision' },
      { id: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6' },
    ],
  },
  openrouter: {
    name: 'OpenRouter',
    free: true,
    keyLink: 'https://openrouter.ai/settings/keys',
    keyPlaceholder: 'sk-or-...',
    defaultModel: 'google/gemma-4-31b-it:free',
    models: [
      { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (ücretsiz)' },
      { id: 'nvidia/nemotron-3.5-super-vl:free', label: 'Nemotron 3.5 Super VL (ücretsiz)' },
      { id: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B A4B (ücretsiz, hızlı)' },
      { id: 'openrouter/free', label: 'Otomatik ücretsiz model' },
    ],
  },
  openai: {
    name: 'OpenAI ChatGPT',
    keyLink: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-...',
    defaultModel: 'gpt-6-luna',
    models: [
      { id: 'gpt-6-luna', label: 'GPT-6 Luna (hızlı, ekonomik)' },
      { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol (dengeli)' },
      { id: 'gpt-6-astra', label: 'GPT-6 Astra (amiral gemisi, yavaş)' },
    ],
  },
  claude: {
    name: 'Anthropic Claude',
    keyLink: 'https://platform.claude.com/settings/keys',
    keyPlaceholder: 'sk-ant-...',
    defaultModel: 'claude-haiku-5-5',
    models: [
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (en hızlı)' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (hız + zekâ)' },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (en isabetli, yavaş)' },
    ],
  },
  grok: {
    name: 'xAI Grok',
    keyLink: 'https://console.x.ai',
    keyPlaceholder: 'xai-...',
    defaultModel: 'grok-4.7',
    models: [
      { id: 'grok-4.7', label: 'Grok 4.7 (en yeni)' },
      { id: 'grok-4.6', label: 'Grok 4.6' },
    ],
  },
};

export default class FramioMediaSettingsPage extends ExtensionPage {
  oninit(vnode) {
    super.oninit(vnode);

    this.activeTab = 'general'; // 'general' | 'firebase' | 'watermarks' | 'taxonomy' | 'converter' | 'ai'
    
    // Tab Yönetimi
    this.searchQuery = '';
    this.images = [];
    this.isLoading = false;

    // Format Dönüştürme State
    this.convertTarget = 'webp';
    this.isConverting = false;
    this.conversionReport = null;

    // Retroaktif Alt Tag State
    this.isUpdatingAltTags = false;
    this.altTagsReport = null;

    // Filigran State
    this.globalWatermarks = [];
    this.newWmFile = null;
    this.isUploadingWm = false;

    // === 0. Kategori Şeması (Category Schemas) State ===
    this.categorySchemas = [];
    this.isLoadingSchemas = false;
    this.isSavingSchema = false;
    this.editingSchema = null; // currently editing schema object
    this.showSchemaEditor = false;
    this.showKunyePreview = false;
    this.kunyePreviewFields = {}; // preview field values
    this.newCategoryName = '';
    this.newCategoryParentId = null;
    this.newCategoryIcon = 'fas fa-folder';
    this.forumTags = []; // Flarum tags for linking

    // === 1. Marka & Model (Taxonomy) State ===
    this.taxonomy = [];
    this.newBrand = '';
    this.newModel = '';
    this.newVehicleType = 'bus';
    this.newCity = '';
    this.newDiscussion = '';
    this.selectedTaxonomyType = 'bus';
    this.selectedTaxonomyBrand = null;
    this.selectedTaxonomyDiscussionKey = null;
    this.isSavingTaxonomy = false;
    this.draggedModelIndex = null;

    // === 2. Şehiriçi Hatlar State ===
    this.cityList = [];
    this.selectedCity = 'Ankara';
    this.cityRoutes = [];
    this.routeSearchTerm = '';
    this.newRouteCode = '';
    this.newRouteName = '';
    this.isLoadingRoutes = false;
    this.isSavingRoute = false;
    this.isUpdatingRoute = false;
    this.editingRoute = null;
    this.showParserModal = false;
    this.parserTab = 'manual';
    this.rawSourceCode = '';
    this.parsedPreviewRoutes = [];
    this.overwriteExistingRoutes = false;

    // === 3. Medya Yönetimi State ===
    this.imagesAll = [];
    this.originalsAll = [];
    this.isLoadingAll = false;
    this.isLoadingOrig = false;
    this.offsetAll = 0;
    this.offsetOrig = 0;
    this.limitAll = 14;
    this.searchQueryAll = '';

    this.loadGlobalWatermarks();
    this.loadCategorySchemas();
    this.loadForumTags();
    this.loadTaxonomy();
    this.loadCityList();
    this.loadImagesAll();
    this.loadOriginalsAll();
  }

  loadGlobalWatermarks() {
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio-media/watermarks'
    }).then(res => {
      this.globalWatermarks = res.templates || res.global || [];
      this.adminUsersWatermarks = res.admin_users || [];
      m.redraw();
    }).catch(() => {});
  }

  saveWatermarkTemplate(wm) {
    wm.isSaving = true;
    m.redraw();
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/watermarks',
      body: {
        action: 'save_template',
        id: wm.id || wm.filename,
        label: wm.label,
        orientation: wm.orientation,
        position: wm.position,
        style: wm.style,
        sort_order: wm.sort_order,
        bg_color: wm.bg_color || '',
        text_color: wm.text_color || '',
        border_color: wm.border_color || ''
      }
    }).then(res => {
      wm.isSaving = false;
      app.alerts.show({ type: 'success' }, 'Filigran şablonu başarıyla güncellendi.');
      this.loadGlobalWatermarks();
    }).catch(err => {
      wm.isSaving = false;
      m.redraw();
      app.alerts.show({ type: 'error' }, 'Şablon kaydedilirken hata oluştu.');
    });
  }

  // İmza şablonunu listede bir yukarı/aşağı taşır ve sırayı kaydeder
  moveWatermarkTemplate(index, dir) {
    const list = this.globalWatermarks || [];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    list.forEach((t, i) => { t.sort_order = i; });
    m.redraw();

    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/watermarks',
      body: { action: 'reorder_templates', ids: list.map((t) => t.id || t.filename) }
    }).catch(() => {
      app.alerts.show({ type: 'error' }, 'Sıralama kaydedilemedi.');
      this.loadGlobalWatermarks();
    });
  }

  renderColorField(wm, key, label) {
    const val = wm[key] || '';
    return (
      <div>
        <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="color"
            value={val || '#ffffff'}
            style={{ width: '34px', height: '32px', padding: '2px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', cursor: 'pointer', opacity: val ? 1 : 0.45 }}
            oninput={(e) => { wm[key] = e.target.value; }}
          />
          <input
            type="text"
            className="FormControl"
            placeholder="Varsayılan"
            value={val}
            style={{ height: '32px', padding: '4px 8px', fontSize: '12px', lineHeight: 'normal', fontFamily: 'monospace' }}
            oninput={(e) => { wm[key] = e.target.value.trim(); }}
          />
        </div>
      </div>
    );
  }

  uploadPersonalWatermark() {
    if (!this.newPersonalUsername || !this.newPersonalFile) return;
    this.isUploadingPersonalWm = true;
    m.redraw();

    const fd = new FormData();
    fd.append('watermark', this.newPersonalFile);
    fd.append('target_username', this.newPersonalUsername);
    fd.append('is_global', '0');

    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/watermarks',
      body: fd
    }).then(res => {
      this.isUploadingPersonalWm = false;
      this.newPersonalFile = null;
      const fileInput = document.getElementById('personal-wm-file');
      if (fileInput) fileInput.value = '';
      app.alerts.show({ type: 'success' }, 'Kişisel filigran başarıyla eklendi.');
      this.loadGlobalWatermarks();
    }).catch(err => {
      this.isUploadingPersonalWm = false;
      m.redraw();
      app.alerts.show({ type: 'error' }, 'Filigran yüklenirken hata oluştu.');
    });
  }

  deletePersonalWatermark(username, filename) {
    if (!confirm(username + ' kullanıcısına ait bu filigranı silmek istediğinize emin misiniz?')) return;
    app.request({
      method: 'DELETE',
      url: app.forum.attribute('apiUrl') + '/framio-media/watermarks',
      body: { filename: filename, is_global: '0', target_username: username }
    }).then(() => {
      this.loadGlobalWatermarks();
    });
  }

  // --- Kategori Şemaları Loader ---
  loadCategorySchemas() {
    this.isLoadingSchemas = true;
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio-media/category-schemas'
    }).then(res => {
      this.categorySchemas = res.data || [];
      this.isLoadingSchemas = false;
      // Dinamik vehicleTypes'ı güncelle — alt kategorileri (parent_id olan) kullan
      this.syncVehicleTypesFromSchemas();
      m.redraw();
    }).catch(() => {
      this.isLoadingSchemas = false;
      m.redraw();
    });
  }

  // --- Forum Etiketleri Loader ---
  loadForumTags() {
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/tags'
    }).then(res => {
      const tags = res.data || [];
      this.forumTags = tags.map(t => ({
        id: t.id,
        name: t.attributes ? t.attributes.name : (t.name || ''),
        slug: t.attributes ? t.attributes.slug : (t.slug || ''),
        parent_id: t.relationships && t.relationships.parent && t.relationships.parent.data
          ? t.relationships.parent.data.id : null
      }));
      m.redraw();
    }).catch(() => {});
  }

  // Kategori şemalarından dinamik vehicleTypes listesi oluştur
  syncVehicleTypesFromSchemas() {
    if (this.categorySchemas.length === 0) return;
    // Alt kategorileri vehicleType olarak kullan
    const leafSchemas = this.categorySchemas.filter(s => {
      return !this.categorySchemas.some(other => String(other.parent_id) === String(s.id));
    });
    if (leafSchemas.length > 0) {
      this._dynamicVehicleTypes = leafSchemas.map(s => {
        const parent = s.parent_id
          ? this.categorySchemas.find(p => String(p.id) === String(s.parent_id))
          : null;
        return {
          key: s.slug,
          label: s.name,
          icon: s.icon || 'fas fa-folder',
          parentName: parent ? parent.name : null,
          parentIcon: parent ? (parent.icon || 'fas fa-folder') : null,
          hasCityField: this.schemaHasCityField(s)
        };
      });
      if (!this._dynamicVehicleTypes.find(v => v.key === this.selectedTaxonomyType)) {
        this.selectedTaxonomyType = this._dynamicVehicleTypes[0].key;
        this.newVehicleType = this._dynamicVehicleTypes[0].key;
      }
    }
  }

  // Bir şemanın city_select alan tipini içerip içermediğini kontrol eder
  schemaHasCityField(schema) {
    const fields = typeof schema.fields_config === 'string'
      ? JSON.parse(schema.fields_config || '[]')
      : (schema.fields_config || []);
    return fields.some(f => f.type === 'city_select');
  }

  // Aktif vehicle types döner (dinamik varsa onu, yoksa fallback)
  getVehicleTypes() {
    if (this._dynamicVehicleTypes && this._dynamicVehicleTypes.length > 0) {
      return this._dynamicVehicleTypes;
    }
    // Fallback: sabit değerler
    return [
      { key: 'bus', label: 'Otobüsler', icon: 'fas fa-bus', parentName: 'Karayolu', parentIcon: 'fas fa-road' },
      { key: 'citybus', label: 'Şehiriçi Araçlar', icon: 'fas fa-city', parentName: 'Karayolu', parentIcon: 'fas fa-road', hasCityField: true },
      { key: 'truck', label: 'Çekici, Tır ve Kamyonlar', icon: 'fas fa-truck', parentName: 'Karayolu', parentIcon: 'fas fa-road' }
    ];
  }

  // --- Marka & Model Loader ---
  loadTaxonomy() {
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio-media/taxonomy'
    }).then(res => {
      this.taxonomy = res.data || [];
      m.redraw();
    }).catch(() => {});
  }

  // --- Şehiriçi Hatlar Loader ---
  loadCityList() {
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio-media/city-routes',
      params: { all_cities: 1 }
    }).then(res => {
      this.cityList = res.cities || [];
      if (!this.selectedCity && this.cityList.length > 0) {
        this.selectedCity = this.cityList[0].name;
      }
      if (this.selectedCity) {
        this.loadCityRoutes(this.selectedCity);
      }
      m.redraw();
    }).catch(() => {});
  }

  loadCityRoutes(city) {
    if (!city) return;
    this.isLoadingRoutes = true;
    m.redraw();
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio-media/city-routes',
      params: { city: city }
    }).then(res => {
      this.cityRoutes = res.routes || [];
      this.isLoadingRoutes = false;
      m.redraw();
    }).catch(() => {
      this.isLoadingRoutes = false;
      m.redraw();
    });
  }

  // --- Medya Yönetimi Loaders ---
  loadImagesAll() {
    this.isLoadingAll = true;
    m.redraw();
    const params = {
      'page.offset': this.offsetAll,
      'page.limit': this.limitAll
    };
    if (this.searchQueryAll) {
      params['filter[q]'] = this.searchQueryAll;
    }
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio-media/images/all',
      params: params
    }).then(res => {
      this.imagesAll = Array.isArray(res) ? res : (res.data || []);
      this.isLoadingAll = false;
      m.redraw();
    }).catch(() => {
      this.isLoadingAll = false;
      m.redraw();
    });
  }

  loadOriginalsAll() {
    this.isLoadingOrig = true;
    m.redraw();
    const params = {
      'page.offset': this.offsetOrig,
      'page.limit': this.limitAll,
      'filter[has_original]': '1'
    };
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio-media/images/all',
      params: params
    }).then(res => {
      this.originalsAll = Array.isArray(res) ? res : (res.data || []);
      this.isLoadingOrig = false;
      m.redraw();
    }).catch(() => {
      this.isLoadingOrig = false;
      m.redraw();
    });
  }

  content() {
    return (
      <div className="FramioMediaSettingsPage container">
        <div className="FramioSettings-header" style={{ margin: '20px 0', borderBottom: '2px solid #e0e0e0', paddingBottom: '15px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#1e88e5' }}>
            <i className="fas fa-camera-retro"></i>
            <span>Framio Upload, Medya & EXIF Yönetimi</span>
          </h2>
          <p style={{ color: '#666', margin: '5px 0 0 0' }}>
            Çoklu bulut depolama, akıllı 2-kopya optimizasyonu, Framio AI destekli künye ve gelişmiş filigran motoru.
          </p>
        </div>

        {/* SEKME MENÜSÜ */}
        <div className="FramioSettings-tabs" style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555', margin: 0 }}>
            <i className="fas fa-layer-group" style={{ marginRight: '8px', color: '#1e88e5' }}></i>
            Yapılandırma Modülü:
          </label>
          <select 
            className="FormControl" 
            style={{ width: '100%', maxWidth: '300px', fontSize: '14px', padding: '8px 12px', cursor: 'pointer', border: '1px solid #1e88e5', color: '#1e88e5', fontWeight: '600' }}
            value={this.activeTab}
            onchange={(e) => { this.activeTab = e.target.value; m.redraw(); }}
          >
            <option value="general">Genel & Görsel</option>
            <option value="kunye_exif">Künye & EXIF Tasarımı</option>
            <option value="download_meta">İndirme & Meta Veri (EXIF/IPTC)</option>
            <option value="firebase">Firebase & Depolama</option>
            <option value="watermarks">İmza & Filigran</option>
            <option value="ai">Framio AI</option>
            <option value="converter">Format Dönüştürücü & SEO</option>
            <option value="categories">Kategori Yapısı</option>
            <option value="taxonomy">Marka & Model</option>
            <option value="city_settings">Şehiriçi Hatlar</option>
            <option value="media">Medya Yönetimi</option>
          </select>
        </div>

        {/* SEKME İÇERİKLERİ */}
        <div className="FramioSettings-tabBody">
          {this.activeTab === 'general' && this.renderGeneralTab()}
          {this.activeTab === 'kunye_exif' && this.renderKunyeExifTab()}
          {this.activeTab === 'download_meta' && this.renderDownloadMetaTab()}
          {this.activeTab === 'firebase' && this.renderFirebaseTab()}
          {this.activeTab === 'watermarks' && this.renderWatermarksTab()}
          {this.activeTab === 'ai' && this.renderAiTab()}
          {this.activeTab === 'converter' && this.renderConverterTab()}
          {this.activeTab === 'categories' && this.renderCategoriesTab()}
          {this.activeTab === 'taxonomy' && this.renderTaxonomyTab()}
          {this.activeTab === 'city_settings' && this.renderCitySettingsTab()}
          {this.activeTab === 'media' && this.renderMediaTab()}
        </div>
      </div>
    );
  }

  buildTabBtn(key, title, iconName) {
    const isActive = this.activeTab === key;
    return (
      <button
        type="button"
        className={`Button ${isActive ? 'Button--primary' : ''}`}
        style={{
          borderRadius: '20px',
          padding: '8px 16px',
          fontWeight: 600,
          background: isActive ? '#1e88e5' : '#f5f5f5',
          color: isActive ? '#fff' : '#444',
          border: '1px solid ' + (isActive ? '#1e88e5' : '#ddd')
        }}
        onclick={() => this.activeTab = key}
      >
        <i className={iconName} style={{ marginRight: '8px' }}></i>
        {title}
      </button>
    );
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

    saveSettings(toSave)
      .then(() => {
        this.isSaving = false;
        app.alerts.show({ type: 'success' }, 'Ayarlar başarıyla kaydedildi.');
        m.redraw();
      })
      .catch((err) => {
        this.isSaving = false;
        app.alerts.show({ type: 'error' }, 'Ayarlar kaydedilirken hata oluştu.');
        m.redraw();
      });
  }



  // ============================================================
  // 1. Firebase & Bulut Depolama
  // ============================================================
  renderFirebaseTab() {
    return (
      <div className="Form-section" style={{ background: '#fff', padding: '25px', borderRadius: '10px', border: '1px solid #e5e5e5' }}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0 }}>Firebase & Bulut Depolama Yapılandırması</h3>
        <p className="helpText" style={{ color: '#555' }}>
          Görseller doğrudan Google Cloud / Firebase Storage üzerine yüklenir. Sunucuda yer tutmaz. Kod içerisine hiçbir kimlik yazmanıza gerek yoktur; tüm ayarları bu ekrandan yönetebilirsiniz.
        </p>

        <div className="Form-group">
          <label>Firebase Storage Bucket Adı</label>
          <input
            type="text"
            className="FormControl"
            placeholder="ornek-proje.firebasestorage.app"
            bidi={this.setting('framio-upload-exif.firebase_bucket', '')}
          />
          <div className="helpText">Firebase Console - Storage sekmesindeki gs:// ile başlayan bucket adresinizi girin.</div>
        </div>

        <div className="Form-group" style={{ marginTop: '15px' }}>
          <label>Özel CDN / Görsel Alan Adı (Custom Domain)</label>
          <input
            type="text"
            className="FormControl"
            placeholder="https://img.ulasim.info"
            bidi={this.setting('framio-upload-exif.custom_domain', '')}
          />
          <div className="helpText">Eğer Firebase Storage için özel bir CDN veya alt alan adı (subdomain) bağladıysanız buraya girin. Boş bırakılırsa standart storage.googleapis.com adresi kullanılır.</div>
        </div>

        <div className="Form-group" style={{ marginTop: '15px' }}>
          <label>Firebase Service Account JSON (Kimlik Dosyası İçeriği)</label>
          <textarea
            className="FormControl"
            rows="6"
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
            placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "..."\n}'}
            bidi={this.setting('framio-upload-exif.firebase_service_account', '')}
          ></textarea>
          <div className="helpText">Google Cloud Console'dan indirdiğiniz Servis Hesabı JSON anahtarının içeriği. Boş bırakılırsa aşağıdaki kimlik dosyası kullanılır.</div>
        </div>

        <div className="Form-group" style={{ marginTop: '15px' }}>
          <label>Kimlik Dosyası (storage klasöründe)</label>
          <input
            type="text"
            className="FormControl"
            placeholder="firebase-auth.json"
            bidi={this.setting('framio-upload-exif.firebase_key_file', '')}
          />
          <div className="helpText">
            JSON alanı boşsa forumun <code>storage/</code> klasöründeki bu dosya kullanılır (varsayılan: firebase-auth.json). Anahtarın veritabanında
            tutulmaması için önerilen yöntem budur.
          </div>
        </div>

        <div className="Form-group" style={{ marginTop: '15px' }}>
          <label>Bulut Klasörü</label>
          <input
            type="text"
            className="FormControl"
            placeholder="assets/uploads"
            bidi={this.setting('framio-upload-exif.cloud_folder', '')}
          />
          <div className="helpText">Görsellerin bucket içinde yükleneceği klasör. Altına otomatik olarak yıl/ay klasörleri açılır (örn. assets/uploads/2026/10/).</div>
        </div>

        <div className="Form-group" style={{ marginTop: '15px' }}>
          <Switch
            state={this.setting('framio-upload-exif.delete_from_storage_on_delete', '0')() === '1'}
            onchange={(val) => this.setting('framio-upload-exif.delete_from_storage_on_delete')(val ? '1' : '0')}
          >
            Forumdan bir görsel silindiğinde bulut depolamadan (Firebase) da kalıcı olarak silinsin
          </Switch>
        </div>

        <div style={{ marginTop: '25px' }}>
          <Button className="Button Button--primary" loading={this.isSaving} onclick={(e) => this.save(e)}>
            Değişiklikleri Kaydet
          </Button>
        </div>
      </div>
    );
  }


  // ============================================================
  // 2. İmza & Filigran Yönetimi
  // ============================================================
  renderWatermarksTab() {
    return (
      <div className="Form-section" style={{ background: '#fff', padding: '25px', borderRadius: '10px', border: '1px solid #e5e5e5' }}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-stamp" style={{ color: '#1565c0' }}></i>
          İmza & Filigran Çalışma Modu
        </h3>

        <div className="Form-group" style={{ marginBottom: '25px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Filigran Dağıtım Modu</label>
          <select className="FormControl" bidi={this.setting('framio-upload-exif.watermark_mode', 'hybrid')} style={{ maxWidth: '500px' }}>
            <option value="hybrid">🌟 Hibrit Mod (Hem site şablonları hem kişisel imzalar aktif - Önerilen)</option>
            <option value="templates">🏛️ Şablon Modu (Yalnızca sitenin sunduğu sabit filigran seçenekleri)</option>
            <option value="personal">👤 Kişisel İmza Modu (Yalnızca üyelerin profillerine yüklediği özel imzalar)</option>
          </select>
          <div className="helpText" style={{ marginTop: '8px', lineHeight: '1.6', fontSize: '12px', color: '#666' }}>
            <div><strong>🌟 Hibrit Mod:</strong> Forum yükleme penceresinde önce üyenin kendi kişisel imzası (varsa), ardından sitenin genel şablonları (Köşe/Orta vb.) görünür.</div>
            <div><strong>🏛️ Şablon Modu:</strong> Yalnızca aşağıda tanımladığınız site şablonları listelenir. Üye kişisel imzaları gizlenir.</div>
            <div><strong>👤 Kişisel İmza Modu:</strong> Yalnızca üyelerin kişisel imzaları listelenir. Site geneli şablonlar gizlenir.</div>
          </div>
        </div>

        <div className="Form-group" style={{ marginBottom: '25px' }}>
          <Switch
            state={['1', 1, true].includes(this.setting('framio-upload-exif.allow_personal_upload', '1')())}
            onchange={(v) => this.setting('framio-upload-exif.allow_personal_upload')(v ? '1' : '0')}
          >
            Üyeler kişisel imzalarını yükleme penceresinden kendileri yükleyebilsin
          </Switch>
          <div className="helpText" style={{ marginTop: '6px', fontSize: '12px', color: '#666' }}>
            Kapalıyken imza seçim penceresindeki "Kişisel imza yükle" bağlantısı gizlenir; kişisel imzaları yalnızca yöneticiler aşağıdan ekleyebilir. Hibrit ve Kişisel modda geçerlidir.
          </div>
        </div>

        {/* ============================================================ */}
        {/* 1. SİTE GENELİ FİLİGRAN ŞABLONLARI */}
        {/* ============================================================ */}
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: '35px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-layer-group" style={{ color: '#2e7d32' }}></i>
          Site Geneli Filigran Şablonları
        </h3>
        <p className="helpText" style={{ color: '#555', marginBottom: '20px' }}>
          Buraya eklediğiniz tüm filigranlar kod değişikliği gerektirmeden forumdaki imza seçim penceresinde otomatik olarak listelenir. Başlık, yön (yatay/dikey), konum (köşe/orta) ve renk temasını buradan yönetebilirsiniz.
        </p>

        {/* Yeni Şablon Yükleme Kartı */}
        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px dashed #cbd5e1', marginBottom: '25px' }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fas fa-plus-circle" style={{ color: '#1565c0' }}></i> Yeni Filigran Şablonu Ekle
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Filigran Dosyası (PNG/WebP)</label>
              <input
                id="new-wm-file-input"
                type="file"
                className="FormControl"
                accept="image/png,image/webp"
                onchange={(e) => this.newWmFile = e.target.files[0]}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Görünecek Başlık / Etiket</label>
              <input
                type="text"
                className="FormControl"
                placeholder="Örn: Beyaz İmza (Köşe)"
                value={this.newWmLabel || ''}
                oninput={(e) => this.newWmLabel = e.target.value}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Fotoğraf Yönü</label>
              <select
                className="FormControl"
                value={this.newWmOrientation || 'landscape'}
                onchange={(e) => this.newWmOrientation = e.target.value}
              >
                <option value="landscape">Yatay Fotoğraflar (Landscape)</option>
                <option value="portrait">Dikey Fotoğraflar (Portrait)</option>
                <option value="square">Kare Fotoğraflar (Square - 1:1)</option>
                <option value="all">Tüm Yönler / Genel (All)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Konum Grubu</label>
              <select
                className="FormControl"
                value={this.newWmPosition || 'corner'}
                onchange={(e) => this.newWmPosition = e.target.value}
              >
                <option value="corner">Köşe İmzası (Corner)</option>
                <option value="center">Orta İmzası (Center)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Görsel Tema / Renk</label>
              <select
                className="FormControl"
                value={this.newWmStyle || 'white'}
                onchange={(e) => this.newWmStyle = e.target.value}
              >
                <option value="white">Beyaz (Koyu arka planlar için)</option>
                <option value="black">Siyah (Açık arka planlar için)</option>
                <option value="color">Renkli / Özel</option>
              </select>
            </div>
            <div>
              <Button
                className="Button Button--primary"
                style={{ width: '100%', height: '38px', fontWeight: 'bold' }}
                loading={this.isUploadingWm}
                disabled={!this.newWmFile}
                onclick={() => {
                  if (!this.newWmFile) return;
                  this.isUploadingWm = true;
                  const fd = new FormData();
                  fd.append('watermark', this.newWmFile);
                  fd.append('is_global', '1');
                  fd.append('label', this.newWmLabel || '');
                  fd.append('orientation', this.newWmOrientation || 'landscape');
                  fd.append('position', this.newWmPosition || 'corner');
                  fd.append('style', this.newWmStyle || 'white');

                  app.request({
                    method: 'POST',
                    url: app.forum.attribute('apiUrl') + '/framio-media/watermarks',
                    body: fd
                  }).then(res => {
                    this.isUploadingWm = false;
                    this.newWmFile = null;
                    this.newWmLabel = '';
                    const fi = document.getElementById('new-wm-file-input');
                    if (fi) fi.value = '';
                    app.alerts.show({ type: 'success' }, 'Filigran şablonu başarıyla eklendi.');
                    this.loadGlobalWatermarks();
                  }).catch(err => {
                    this.isUploadingWm = false;
                    m.redraw();
                    app.alerts.show({ type: 'error' }, 'Filigran yüklenirken hata oluştu.');
                  });
                }}
              >
                <i className="fas fa-upload" style={{ marginRight: '6px' }}></i> Şablonu Yükle
              </Button>
            </div>
          </div>
        </div>

        {/* Aktif Şablonlar Listesi */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
          {(this.globalWatermarks || []).map((wm, idx) => (
            <div key={wm.id || wm.filename} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '15px', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Menüdeki sıra */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Menü sırası</span>
                <span style={{ minWidth: '24px', height: '22px', padding: '0 6px', borderRadius: '11px', background: '#1e293b', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{idx + 1}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                  <Button className="Button Button--icon" icon="fas fa-arrow-up" title="Yukarı taşı" disabled={idx === 0} onclick={() => this.moveWatermarkTemplate(idx, -1)} />
                  <Button className="Button Button--icon" icon="fas fa-arrow-down" title="Aşağı taşı" disabled={idx === this.globalWatermarks.length - 1} onclick={() => this.moveWatermarkTemplate(idx, 1)} />
                </div>
              </div>
              {/* Önizleme */}
              <div style={{
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: wm.style === 'white' ? '#262626' : '#f1f5f9',
                borderRadius: '6px',
                padding: '10px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <img src={wm.url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                {(() => {
                  const orientColors = { landscape: '#1e88e5', portrait: '#8e24aa', square: '#0d9488', all: '#475569' };
                  const orientLabels = { landscape: 'Yatay', portrait: 'Dikey', square: 'Kare', all: 'Tüm Yönler' };
                  const oColor = orientColors[wm.orientation] || '#1e88e5';
                  const oLabel = orientLabels[wm.orientation] || (wm.orientation === 'portrait' ? 'Dikey' : 'Yatay');
                  return (
                    <span style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: oColor,
                      color: '#fff'
                    }}>
                      {oLabel}
                    </span>
                  );
                })()}
              </div>

              {/* Başlık Girişi */}
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Şablon Başlığı</label>
                <input
                  type="text"
                  className="FormControl"
                  style={{ height: '36px', padding: '6px 10px', fontSize: '13px', lineHeight: 'normal' }}
                  value={wm.label || ''}
                  oninput={(e) => wm.label = e.target.value}
                />
              </div>

              {/* Seçimler */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Yön</label>
                  <select
                    className="FormControl"
                    style={{ height: '36px', padding: '4px 6px', fontSize: '12px', lineHeight: 'normal' }}
                    value={wm.orientation || 'landscape'}
                    onchange={(e) => {
                      wm.orientation = e.target.value;
                      wm.type = e.target.value;
                    }}
                  >
                    <option value="landscape">Yatay</option>
                    <option value="portrait">Dikey</option>
                    <option value="square">Kare</option>
                    <option value="all">Tüm</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Konum</label>
                  <select
                    className="FormControl"
                    style={{ height: '36px', padding: '4px 6px', fontSize: '12px', lineHeight: 'normal' }}
                    value={wm.position || 'corner'}
                    onchange={(e) => wm.position = e.target.value}
                  >
                    <option value="corner">Köşe</option>
                    <option value="center">Orta</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Tema/Stil</label>
                  <select
                    className="FormControl"
                    style={{ height: '36px', padding: '4px 6px', fontSize: '12px', lineHeight: 'normal' }}
                    value={wm.style || 'white'}
                    onchange={(e) => wm.style = e.target.value}
                  >
                    <option value="white">Beyaz</option>
                    <option value="black">Siyah</option>
                    <option value="color">Renkli</option>
                  </select>
                </div>
              </div>

              {/* Seçildiğinde buton renkleri */}
              <div style={{ padding: '10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #eef2f7' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Seçildiğinde buton renkleri</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {this.renderColorField(wm, 'bg_color', 'Zemin')}
                  {this.renderColorField(wm, 'text_color', 'Yazı')}
                  {this.renderColorField(wm, 'border_color', 'Kenarlık')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                  <div style={{ flex: 1, minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', border: '2px solid ' + (wm.border_color || '#2b2b2b'), background: wm.bg_color || '#f1f5f9', color: wm.text_color || '#1e293b', fontSize: '13px', fontWeight: 600 }}>
                    <i className="fas fa-stamp"></i> {wm.label || 'İmza'}
                  </div>
                  <Button className="Button" style={{ height: '40px', fontSize: '11px' }} onclick={() => { wm.bg_color = ''; wm.text_color = ''; wm.border_color = ''; }}>Sıfırla</Button>
                </div>
              </div>

              <div style={{ fontSize: '10px', color: '#94a3b8', wordBreak: 'break-all' }}>{wm.filename}</div>

              {/* Eylemler */}
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                <Button
                  className="Button Button--primary"
                  style={{ flex: 1, height: '30px', fontSize: '12px', padding: '0 8px' }}
                  loading={wm.isSaving}
                  onclick={() => this.saveWatermarkTemplate(wm)}
                >
                  <i className="fas fa-save" style={{ marginRight: '4px' }}></i> Kaydet
                </Button>
                <Button
                  className="Button Button--danger"
                  style={{ height: '30px', fontSize: '12px', padding: '0 10px' }}
                  onclick={() => {
                    if (!confirm(`"${wm.label || wm.filename}" filigranını silmek istediğinize emin misiniz?`)) return;
                    app.request({
                      method: 'DELETE',
                      url: app.forum.attribute('apiUrl') + '/framio-media/watermarks',
                      body: { filename: wm.filename, id: wm.id, is_global: '1' }
                    }).then(() => {
                      app.alerts.show({ type: 'success' }, 'Filigran silindi.');
                      this.loadGlobalWatermarks();
                    });
                  }}
                >
                  <i className="fas fa-trash"></i> Sil
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* ============================================================ */}
        {/* 2. KULLANICI KİŞİSEL İMZALARI (ADMIN YÖNETİMİ) */}
        {/* ============================================================ */}
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: '40px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-signature" style={{ color: '#d97706' }}></i>
          Kullanıcı Kişisel İmzaları
        </h3>
        <p className="helpText" style={{ color: '#555', marginBottom: '15px' }}>
          Yönetici olarak herhangi bir üyenin hesabına özel imza yükleyebilir veya mevcut kişisel imzalarını silebilirsiniz.
        </p>

        {/* Kişisel İmza Yükleme */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px', background: '#fffbeb', padding: '15px', borderRadius: '8px', border: '1px solid #fef3c7' }}>
          <input
            type="text"
            className="FormControl"
            style={{ width: '220px' }}
            placeholder="Hedef Kullanıcı Adı"
            value={this.newPersonalUsername || ''}
            oninput={(e) => this.newPersonalUsername = e.target.value}
          />
          <input
            id="personal-wm-file"
            type="file"
            accept="image/png,image/webp"
            onchange={(e) => this.newPersonalFile = e.target.files[0]}
          />
          <Button
            className="Button Button--primary"
            loading={this.isUploadingPersonalWm}
            disabled={!this.newPersonalUsername || !this.newPersonalFile}
            onclick={() => this.uploadPersonalWatermark()}
          >
            Kullanıcıya Yükle
          </Button>
        </div>

        {/* Kişisel İmzalar Tablosu */}
        {(this.adminUsersWatermarks || []).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {this.adminUsersWatermarks.map(u => (
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fas fa-user-circle" style={{ fontSize: '20px', color: '#64748b' }}></i>
                  <strong style={{ color: '#1e293b', fontSize: '13px' }}>{u.username}</strong>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {(u.watermarks || []).map(wm => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <img src={wm.url} alt="" style={{ height: '30px', maxWidth: '100px', objectFit: 'contain' }} />
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{wm.filename}</span>
                      <Button
                        className="Button Button--link"
                        style={{ color: '#ef4444', padding: '0 4px', fontSize: '12px' }}
                        onclick={() => this.deletePersonalWatermark(u.username, wm.filename)}
                      >
                        <i className="fas fa-trash"></i>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '13px', padding: '10px 0' }}>
            Henüz yüklenmiş bir kullanıcı kişisel imzası bulunmuyor.
          </div>
        )}

        <div style={{ marginTop: '30px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
          <Button className="Button Button--primary" loading={this.isSaving} onclick={(e) => this.save(e)}>
            Değişiklikleri Kaydet
          </Button>
        </div>
      </div>
    );
  }

  // ============================================================
  // 3. Görsel Format Dönüştürücü & Retroaktif SEO
  // ============================================================
  convertRequest(body) {
    return app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/convert-format',
      body: { target_format: this.convertTarget, ...body },
    });
  }

  refreshConvertCount() {
    this.convertCount = null;
    this.loadConvertRuns();
    this.convertRequest({ dry_run: 1 }).then((res) => {
      this.convertCount = res;
      m.redraw();
    });
  }

  loadConvertRuns() {
    app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/framio-media/convert-format/runs' }).then((res) => {
      this.convertRuns = res.runs || [];
      m.redraw();
    });
  }

  revertRun(run) {
    if (!confirm('Bu dönüştürme geri alınacak: görsel kayıtları ve gönderilerdeki adresler eski haline döner, yeni dosyalar buluttan silinir. Devam edilsin mi?')) return;
    this.isReverting = run;
    let total = 0;
    const step = () => {
      app.request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/framio-media/convert-format/revert', body: { run, limit: 20 } })
        .then((res) => {
          total += res.reverted || 0;
          this.revertReport = `${total} görsel eski haline döndürüldü. Kalan: ${res.remaining}`;
          m.redraw();
          if (!res.completed && res.reverted > 0) return step();
          this.isReverting = null;
          if (res.failed && res.failed.length) this.revertReport += ` (${res.failed.length} görsel geri alınamadı: ${res.failed[0].reason})`;
          this.refreshConvertCount();
          m.redraw();
        })
        .catch((err) => {
          this.isReverting = null;
          this.revertReport = 'Hata: ' + (err.message || 'bilinmeyen hata');
          m.redraw();
        });
      m.redraw();
    };
    step();
  }

  repairUrls() {
    this.isRepairing = true;
    let total = 0;
    const stale = [];
    const step = (afterId) => {
      app.request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/framio-media/convert-format/revert', body: { action: 'repair', after_id: afterId, limit: 40 } })
        .then((res) => {
          total += res.repaired || 0;
          stale.push(...(res.stale || []));
          this.repairReport =
            `${total} gönderi onarıldı. Kalan görsel: ${res.remaining}` +
            (stale.length ? ` · Onarılamayan ${stale.length} görsel: ${stale.slice(0, 8).map((x) => '#' + x.id + ' ' + x.file).join(', ')}` : '');
          m.redraw();
          if (!res.completed && res.remaining > 0) return step(res.next_after_id);
          this.isRepairing = false;
          m.redraw();
        })
        .catch((err) => {
          this.isRepairing = false;
          this.repairReport = 'Hata: ' + (err.message || 'bilinmeyen hata');
          m.redraw();
        });
    };
    step(0);
  }

  purgeRun(run) {
    if (!confirm('Bu dönüştürmenin eski dosyaları (eski JPG ana görseller, thumb_ ve mini_ kopyaları) buluttan KALICI olarak silinecek. Bu adımdan sonra dönüştürme geri alınamaz. Görsellerin forumda sorunsuz göründüğünü doğruladınız mı?')) return;
    this.isPurging = run;
    let total = 0;
    let repaired = 0;
    const skipped = [];
    const step = () => {
      app.request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/framio-media/convert-format/revert', body: { run, action: 'purge', limit: 20 } })
        .then((res) => {
          total += res.deleted || 0;
          repaired += res.repaired || 0;
          skipped.push(...(res.skipped || []));
          this.revertReport =
            `${total} eski dosya silindi, ${repaired} gönderi onarıldı. Kalan görsel: ${res.remaining}` +
            (skipped.length ? ` · Hâlâ kullanıldığı için korunan ${skipped.length} dosya: ${skipped.slice(0, 5).map((x) => '#' + x.id + ' ' + x.file).join(', ')}` : '');
          m.redraw();
          if (!res.completed && res.remaining > 0) return step();
          this.isPurging = null;
          this.loadConvertRuns();
          m.redraw();
        })
        .catch((err) => {
          this.isPurging = null;
          this.revertReport = 'Hata: ' + (err.message || 'bilinmeyen hata');
          m.redraw();
        });
      m.redraw();
    };
    step();
  }

  startConversion() {
    const total = this.convertCount ? this.convertCount.total : 0;
    if (!confirm(`${total} görsel ${this.convertTarget.toUpperCase()} formatına dönüştürülecek. Gönderilerdeki adresler otomatik güncellenir. ${this.convertKeepOld !== false ? 'Eski dosyalar korunur, işlem geri alınabilir.' : 'Eski dosyalar buluttan SİLİNİR, işlem geri alınamaz!'} Devam edilsin mi?`)) return;

    this.isConverting = true;
    this.convertStopRequested = false;
    const keepOld = this.convertKeepOld !== false;
    const run = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    this.convertStats = { done: 0, failed: [], posts: 0, total };
    this.conversionReport = 'Dönüştürme başlatıldı…';

    const runBatch = (afterId) => {
      if (this.convertStopRequested) {
        this.isConverting = false;
        this.conversionReport = 'Durduruldu. Kaldığı yerden yeniden başlatabilirsiniz.';
        this.refreshConvertCount();
        return m.redraw();
      }
      this.convertRequest({ limit: 5, after_id: afterId, run, keep_old: keepOld ? 1 : 0, include_originals: this.convertOriginals ? 1 : 0 })
        .then((res) => {
          const s = this.convertStats;
          s.done += res.converted || 0;
          s.posts += res.posts_updated || 0;
          s.failed.push(...(res.failed || []));
          this.conversionReport = `${s.done} görsel dönüştürüldü, ${s.posts} gönderi güncellendi. Kalan: ${res.remaining}`;
          m.redraw();
          if (!res.completed && res.remaining > 0) return runBatch(res.next_after_id);

          this.isConverting = false;
          this.refreshConvertCount();
          app.alerts.show({ type: s.failed.length ? 'warning' : 'success' },
            s.failed.length ? `Tamamlandı, ${s.failed.length} görsel dönüştürülemedi.` : 'Tüm dönüştürme işlemleri tamamlandı!');
          m.redraw();
        })
        .catch((err) => {
          this.isConverting = false;
          this.conversionReport = 'Hata oluştu: ' + (err.response?.error || err.message || 'bilinmeyen hata');
          m.redraw();
        });
    };

    runBatch(0);
  }

  renderConverterTab() {
    if (this.convertCount === undefined) this.refreshConvertCount();
    const c = this.convertCount;
    const s = this.convertStats;
    const pct = s && s.total ? Math.min(100, Math.round(((s.done + s.failed.length) / s.total) * 100)) : 0;

    return (
      <div className="Form-section FramioConvert">
        <h3>Görsel Format Dönüştürücü (WebP & JPG)</h3>
        <p className="helpText">
          Bulut depodaki görselleri seçilen formata dönüştürür; görsel kayıtları ve bu görselleri içeren gönderilerdeki adresler otomatik güncellenir.
          "CDN dinamik boyutlandırma" açıkken eski görseller yeni yapıya geçirilir: yalnızca ana görsel WebP olarak yüklenir, mesaj içi ve liste
          görselleri ?w= adresleriyle sunulur, thumb_ ve mini_ dosyaları eski dosyalar arasına alınır. Orijinal yedekler JPG kalır.
          Eski dosyalar korunursa dönüştürme geri alınabilir; doğruladıktan sonra "Eski Dosyaları Sil" ile tamamen kaldırılır.
        </p>

        <div className="FramioConvert-bar">
          <select
            className="FormControl"
            value={this.convertTarget}
            disabled={this.isConverting}
            onchange={(e) => {
              this.convertTarget = e.target.value;
              this.refreshConvertCount();
            }}
          >
            <option value="webp">JPG → WebP</option>
            <option value="jpg">WebP → JPG</option>
          </select>

          <span className="FramioConvert-count">
            {c == null ? 'Sayılıyor…' : <span><strong>{c.total}</strong> görsel dönüştürülmeyi bekliyor</span>}
          </span>

          {this.isConverting ? (
            <Button className="Button" onclick={() => (this.convertStopRequested = true)}>Durdur</Button>
          ) : (
            <Button className="Button Button--primary" disabled={!c || !c.total || !c.configured} onclick={() => this.startConversion()}>
              Dönüştürmeyi Başlat
            </Button>
          )}
        </div>

        <label className="checkbox FramioConvert-opt">
          <input type="checkbox" checked={!!this.convertOriginals} disabled={this.isConverting} onchange={(e) => (this.convertOriginals = e.target.checked)} />
          Orijinal yedekleri de dönüştür (önerilmez: orijinaller indirilebilir tam kalite kopyadır ve EXIF verisi kaybolur)
        </label>

        <label className="checkbox FramioConvert-opt">
          <input type="checkbox" checked={this.convertKeepOld !== false} disabled={this.isConverting} onchange={(e) => (this.convertKeepOld = e.target.checked)} />
          Eski dosyaları bulutta koru (önerilir: işlem geri alınabilir; her şey doğrulandıktan sonra kapatıp yer açabilirsiniz)
        </label>

        {c && !c.configured && (
          <div className="Alert Alert--error FramioConvert-msg">Firebase yapılandırması eksik. "Bulut Depolama" ayarlarından bucket adını girin ve kimlik dosyasını kontrol edin.</div>
        )}

        {this.convertRuns && this.convertRuns.length > 0 && (
          <div className="FramioConvert-runs">
            <h4>Geçmiş Dönüştürmeler</h4>
            {this.convertRuns.map((r) => (
              <div className="FramioConvert-run">
                <span>
                  <strong>{r.started_at}</strong> · {r.images} görsel
                  {Number(r.unrecoverable) > 0 && <em> · {r.unrecoverable} görselin eski dosyası silinmiş (geri alınamaz)</em>}
                </span>
                {Number(r.images) > Number(r.unrecoverable) && (
                  <span className="FramioConvert-runActions">
                    <Button className="Button" loading={this.isPurging === r.run} disabled={this.isConverting || this.isReverting || (this.isPurging && this.isPurging !== r.run)} onclick={() => this.purgeRun(r.run)}>
                      Eski Dosyaları Sil
                    </Button>
                    <Button className="Button Button--danger" loading={this.isReverting === r.run} disabled={this.isConverting || this.isPurging || (this.isReverting && this.isReverting !== r.run)} onclick={() => this.revertRun(r.run)}>
                      Geri Al
                    </Button>
                  </span>
                )}
              </div>
            ))}
            {this.revertReport && <div className="FramioConvert-report">{this.revertReport}</div>}
          </div>
        )}

        <div className="FramioConvert-repair">
          <Button className="Button" loading={this.isRepairing} disabled={this.isConverting || this.isPurging || this.isReverting} onclick={() => this.repairUrls()}>
            Gönderi Adreslerini Onar
          </Button>
          <span className="helpText">
            Bütün gönderileri tarar; görselin eski adresinde (eski uzantı, thumb_ ya da mini_) kalmış olanları güncel adrese çevirir. Güvenle tekrar çalıştırılabilir.
          </span>
          {this.repairReport && <div className="FramioConvert-report">{this.repairReport}</div>}
        </div>

        {s && (
          <div className="FramioConvert-progress">
            <div className="FramioConvert-track"><div className="FramioConvert-fill" style={{ width: pct + '%' }} /></div>
            <div className="FramioConvert-report">{this.conversionReport}</div>
            {s.failed.length > 0 && (
              <ul className="FramioConvert-failed">
                {s.failed.slice(0, 20).map((f) => (
                  <li>#{f.id} {f.file}: {f.reason}</li>
                ))}
                {s.failed.length > 20 && <li>… ve {s.failed.length - 20} görsel daha</li>}
              </ul>
            )}
          </div>
        )}

        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: '35px' }}>Retroaktif SEO & Alt Tag Güncelleyici</h3>
        <p className="helpText" style={{ color: '#555' }}>
          Geçmişte açılmış olan tüm konulardaki görsel BBCode'larını tarar. Gönderideki araç/künye bilgisi veya dosya adından otomatik olarak SEO dostu <code>alt=""</code> etiketlerini tek tıkla yeniler.
        </p>

        <div style={{ margin: '20px 0' }}>
          <Button
            className="Button Button--primary"
            loading={this.isUpdatingAltTags}
            onclick={() => {
              this.isUpdatingAltTags = true;
              app.request({
                method: 'POST',
                url: app.forum.attribute('apiUrl') + '/framio-media/update-alt-tags'
              }).then(res => {
                this.isUpdatingAltTags = false;
                app.alerts.show({ type: 'success' }, String(res.updated_count) + ' adet gönderideki görsel etiketleri güncellendi.');
                m.redraw();
              }).catch(() => {
                this.isUpdatingAltTags = false;
                app.alerts.show({ type: 'error' }, 'Etiketler güncellenirken hata oluştu.');
                m.redraw();
              });
            }}
          >
            Tüm Alt Etiketlerini Retroaktif Güncelle
          </Button>
        </div>
      </div>
    );
  }

  // ============================================================
  // 4. Marka & Model (Taxonomy) Yönetimi
  // ============================================================
  // ==========================================
  renderTaxonomyTab() {
    const vehicleTypes = [
      { key: 'bus', label: 'Otobüsler', icon: 'fas fa-bus' },
      { key: 'citybus', label: 'Şehiriçi Araçlar', icon: 'fas fa-city' },
      { key: 'truck', label: 'Çekici, Tır ve Kamyonlar', icon: 'fas fa-truck' }
    ];

    const currentTypeItems = this.taxonomy.filter(item => {
      const itemType = item.type || item.category || 'bus';
      return itemType === this.selectedTaxonomyType;
    });

    const brandsMap = {};
    currentTypeItems.forEach(item => {
      const b = String(item.brand || '').trim();
      if (!b) return;
      if (!brandsMap[b]) brandsMap[b] = [];
      brandsMap[b].push(item);
    });

    let brandOrder = [];
    try {
      const brandOrderStr = app.data.settings['framio-upload-exif.brand_order'];
      if (brandOrderStr) brandOrder = JSON.parse(brandOrderStr);
    } catch (e) {}

    const sortedBrandNames = Object.keys(brandsMap).sort((a, b) => {
      const idxA = brandOrder.indexOf(a);
      const idxB = brandOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, 'tr');
    });

    if (!this.selectedTaxonomyBrand || !brandsMap[this.selectedTaxonomyBrand]) {
      this.selectedTaxonomyBrand = sortedBrandNames.length > 0 ? sortedBrandNames[0] : null;
    }

    const activeBrandItems = this.selectedTaxonomyBrand ? (brandsMap[this.selectedTaxonomyBrand] || []) : [];
    const discussionsMap = {};
    activeBrandItems.forEach(item => {
      const discId = item.discussion_id ? String(item.discussion_id) : '0';
      if (!discussionsMap[discId]) {
        let label = 'Genel (Tüm Konular)';
        let url = null;
        let title = null;
        if (item.discussion) {
          label = `d/${item.discussion.id}-${item.discussion.slug || ''}`;
          url = `${app.forum.attribute('baseUrl')}/d/${item.discussion.id}-${item.discussion.slug || ''}`;
          title = item.discussion.title;
        } else if (item.discussion_id) {
          label = `d/${item.discussion_id}`;
          url = `${app.forum.attribute('baseUrl')}/d/${item.discussion_id}`;
          title = `Konu #${item.discussion_id}`;
        }
        discussionsMap[discId] = {
          id: discId,
          label: label,
          url: url,
          title: title,
          items: []
        };
      }
      discussionsMap[discId].items.push(item);
    });

    const discussionKeys = Object.keys(discussionsMap);
    if (!this.selectedTaxonomyDiscussionKey || !discussionsMap[this.selectedTaxonomyDiscussionKey]) {
      this.selectedTaxonomyDiscussionKey = discussionKeys.length > 0 ? discussionKeys[0] : null;
    }

    const activeDiscussionGroup = this.selectedTaxonomyDiscussionKey ? discussionsMap[this.selectedTaxonomyDiscussionKey] : null;

    const getTypeName = (typeKey) => {
      const found = vehicleTypes.find(v => v.key === typeKey);
      return found ? found.label : 'Otobüsler';
    };

    return (
      <div className="TaxonomyManager-section" style={{ background: '#fff', padding: '25px', borderRadius: '10px', border: '1px solid #e5e5e5' }}>
        <h3 style={{ color: '#1e88e5', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-bus"></i>
          Marka & Model Yönetimi
        </h3>
        <p className="helpText" style={{ marginBottom: '20px', color: '#666', fontSize: '13px' }}>
          Buradan eklediğiniz marka ve modeller, kullanıcıların fotoğraf yükleme modalında ve Framio AI künye otomatik doldurucusunda listelenir. Konu URL tanımlayarak marka ve modelleri konuya özel filtreleyebilirsiniz.
        </p>

        {/* EKLEME FORMU */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f9fbfd', padding: '16px', borderRadius: '8px', border: '1px solid #dce4ec', marginBottom: '25px', flexWrap: 'wrap' }}>
          <input
            className="FormControl"
            type="text"
            placeholder="Marka (Örn: Mercedes-Benz)"
            value={this.newBrand}
            oninput={e => this.newBrand = e.target.value}
            style={{ flex: '1 1 180px', minWidth: '160px' }}
          />
          <input
            className="FormControl"
            type="text"
            placeholder="Model (Örn: Travego)"
            value={this.newModel}
            oninput={e => this.newModel = e.target.value}
            style={{ flex: '1 1 180px', minWidth: '160px' }}
          />
          <select
            className="FormControl"
            value={this.newVehicleType}
            onchange={e => {
              this.newVehicleType = e.target.value;
              this.selectedTaxonomyType = e.target.value;
            }}
            style={{ flex: '1 1 180px', minWidth: '160px' }}
          >
            {vehicleTypes.map(vt => (
              <option value={vt.key}>{vt.label}</option>
            ))}
          </select>
          {this.newVehicleType === 'citybus' && (
            <input
              className="FormControl"
              type="text"
              placeholder="Şehir (Örn: Ankara)"
              value={this.newCity}
              oninput={e => this.newCity = e.target.value}
              style={{ flex: '1 1 160px', minWidth: '140px', borderColor: '#38bdf8' }}
            />
          )}
          <input
            className="FormControl"
            type="text"
            placeholder="Konu URL (İsteğe Bağlı)"
            title="Örn: https://forum.ulasim.info/d/131-nostalji-otobusler veya 131"
            value={this.newDiscussion}
            oninput={e => this.newDiscussion = e.target.value}
            style={{ flex: '1 1 200px', minWidth: '180px' }}
          />
          <Button
            className="Button Button--primary"
            icon="fas fa-plus"
            loading={this.isSavingTaxonomy}
            onclick={() => this.saveTaxonomy()}
            disabled={!this.newBrand || !this.newModel}
            style={{ height: '38px', padding: '0 20px', fontWeight: 'bold' }}
          >
            Ekle
          </Button>
        </div>

        {/* 1. SEVİYE: ARAÇ TÜRÜ SEKME BUTONLARI */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {vehicleTypes.map(vt => {
            const isActive = this.selectedTaxonomyType === vt.key;
            const count = this.taxonomy.filter(i => (i.type || i.category || 'bus') === vt.key).length;
            return (
              <button
                type="button"
                className={`Button ${isActive ? 'Button--primary' : ''}`}
                onclick={() => {
                  this.selectedTaxonomyType = vt.key;
                  this.newVehicleType = vt.key;
                  this.selectedTaxonomyBrand = null;
                  this.selectedTaxonomyDiscussionKey = null;
                  m.redraw();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  background: isActive ? '#1e88e5' : '#f0f3f6',
                  color: isActive ? '#fff' : '#455a64',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <i className={vt.icon}></i>
                <span>{vt.label}</span>
                {count > 0 && (
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    background: isActive ? 'rgba(255,255,255,0.25)' : '#cfd8dc',
                    color: isActive ? '#fff' : '#37474f'
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 2. SEVİYE: MARKA HAPLARI */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          {sortedBrandNames.map(brandName => {
            const isActive = this.selectedTaxonomyBrand === brandName;
            const brandCount = brandsMap[brandName].length;
            return (
              <div
                className={`TaxonomyBrand-pill ${isActive ? 'active' : ''}`}
                onclick={() => {
                  this.selectedTaxonomyBrand = brandName;
                  this.selectedTaxonomyDiscussionKey = null;
                  m.redraw();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 15px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  border: isActive ? '1px solid #1e88e5' : '1px solid #dcdfe6',
                  background: isActive ? '#1e88e5' : '#ffffff',
                  color: isActive ? '#ffffff' : '#333333',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                {isActive && (
                  <i
                    className="fas fa-chevron-left"
                    title="Sola Kaydır"
                    onclick={(e) => { e.stopPropagation(); this.moveBrand(brandsMap, brandName, -1); }}
                    style={{ padding: '0 4px', cursor: 'pointer', opacity: 0.8 }}
                  ></i>
                )}
                <span>{brandName}</span>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  background: isActive ? 'rgba(255,255,255,0.3)' : '#eef2f5',
                  color: isActive ? '#ffffff' : '#555555'
                }}>
                  {brandCount}
                </span>
                {isActive && (
                  <i
                    className="fas fa-chevron-right"
                    title="Sağa Kaydır"
                    onclick={(e) => { e.stopPropagation(); this.moveBrand(brandsMap, brandName, 1); }}
                    style={{ padding: '0 4px', cursor: 'pointer', opacity: 0.8 }}
                  ></i>
                )}
              </div>
            );
          })}
          {sortedBrandNames.length === 0 && (
            <div style={{ color: '#999', fontSize: '13px', padding: '10px 0' }}>
              Bu kategoride henüz kayıtlı marka bulunmuyor. Yukarıdaki formdan ekleyebilirsiniz.
            </div>
          )}
        </div>

        {/* 3. SEVİYE: KONU / BAŞLIK HAPLARI */}
        {this.selectedTaxonomyBrand && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            {discussionKeys.map(dKey => {
              const disc = discussionsMap[dKey];
              const isActive = this.selectedTaxonomyDiscussionKey === dKey;
              return (
                <button
                  type="button"
                  onclick={() => {
                    this.selectedTaxonomyDiscussionKey = dKey;
                    m.redraw();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    border: isActive ? '1px solid #0056b3' : '1px solid #dce4ec',
                    background: isActive ? '#0d6efd' : '#ffffff',
                    color: isActive ? '#ffffff' : '#495057',
                    cursor: 'pointer'
                  }}
                >
                  <i className="fas fa-link" style={{ fontSize: '11px', opacity: 0.8 }}></i>
                  <span>{disc.label}</span>
                  <span style={{
                    fontSize: '11px',
                    padding: '1px 6px',
                    borderRadius: '8px',
                    background: isActive ? 'rgba(255,255,255,0.25)' : '#e9ecef',
                    color: isActive ? '#ffffff' : '#495057'
                  }}>
                    {disc.items.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 4. SEVİYE: AKTİF KONU KARTI VE MODELLER */}
        {activeDiscussionGroup && (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '14px 20px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <strong style={{ color: '#1e293b', fontSize: '13px' }}>
                  AKTİF KONU URL: <span style={{ color: '#0d6efd', fontWeight: 'bold' }}>{activeDiscussionGroup.label}</span>
                </strong>
                {activeDiscussionGroup.url && (
                  <a
                    href={activeDiscussionGroup.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#0284c7', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}
                  >
                    <i className="fas fa-external-link-alt" style={{ fontSize: '11px' }}></i> {activeDiscussionGroup.title || 'Konuyu Aç'}
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button
                  className="Button Button--link"
                  icon="fas fa-copy"
                  onclick={() => this.cloneDiscussionGroup(activeDiscussionGroup)}
                  style={{ color: '#0ea5e9', fontSize: '12px', padding: '4px 8px' }}
                >
                  Çoğalt (Yeni URL Ekle)
                </Button>
                <Button
                  className="Button Button--link"
                  icon="fas fa-pencil-alt"
                  onclick={() => this.editDiscussionGroup(activeDiscussionGroup)}
                  style={{ color: '#4b5563', fontSize: '12px', padding: '4px 8px' }}
                >
                  Düzenle
                </Button>
                <Button
                  className="Button Button--link"
                  icon="fas fa-trash-alt"
                  onclick={() => this.deleteDiscussionGroup(activeDiscussionGroup)}
                  style={{ color: '#dc2626', fontSize: '12px', padding: '4px 8px' }}
                >
                  Sil
                </Button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px', padding: '20px' }}>
              {activeDiscussionGroup.items.map((item, index) => {
                const isFirst = index === 0;
                const isLast = index === activeDiscussionGroup.items.length - 1;
                return (
                  <div
                    draggable="true"
                    ondragstart={(e) => {
                      this.draggedModelIndex = index;
                      e.dataTransfer.setData('text/plain', index);
                      e.currentTarget.style.opacity = '0.5';
                    }}
                    ondragend={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    ondragover={(e) => e.preventDefault()}
                    ondrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.opacity = '1';
                      if (this.draggedModelIndex !== null && this.draggedModelIndex !== undefined && this.draggedModelIndex !== index) {
                        this.reorderModels(activeDiscussionGroup.items, this.draggedModelIndex, index);
                        this.draggedModelIndex = null;
                      }
                    }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      cursor: 'grab'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <i className="fas fa-grip-vertical" style={{ color: '#cbd5e1', fontSize: '13px' }}></i>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#1e293b' }}>
                          {item.model}
                        </div>
                        <div style={{ fontSize: '11px', color: '#1e88e5', fontWeight: '500' }}>
                          {getTypeName(item.type || item.category)}
                          {(item.type === 'citybus' || item.category === 'citybus') && item.city && (
                            <span style={{ marginLeft: '8px', color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                              <i className="fas fa-map-marker-alt" style={{ marginRight: '3px' }}></i>
                              {item.city}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Button
                        className="Button Button--icon Button--link"
                        icon="fas fa-arrow-left"
                        disabled={isFirst}
                        onclick={(e) => { e.stopPropagation(); this.moveModel(activeDiscussionGroup.items, index, -1); }}
                        title="Öne / Sola Taşı"
                        style={{ color: isFirst ? '#e2e8f0' : '#475569', minWidth: '24px', height: '24px', padding: 0 }}
                      />
                      <Button
                        className="Button Button--icon Button--link"
                        icon="fas fa-arrow-right"
                        disabled={isLast}
                        onclick={(e) => { e.stopPropagation(); this.moveModel(activeDiscussionGroup.items, index, 1); }}
                        title="Arkaya / Sağa Taşı"
                        style={{ color: isLast ? '#e2e8f0' : '#475569', minWidth: '24px', height: '24px', padding: 0 }}
                      />
                      <div style={{ width: '1px', height: '16px', background: '#e2e8f0', margin: '0 4px' }}></div>
                      <Button
                        className="Button Button--icon Button--link"
                        icon="fas fa-pencil-alt"
                        onclick={(e) => { e.stopPropagation(); this.editTaxonomyItem(item); }}
                        title="Modeli Düzenle"
                        style={{ color: '#64748b', minWidth: '24px', height: '24px', padding: 0 }}
                      />
                      <Button
                        className="Button Button--icon Button--link"
                        icon="fas fa-trash-alt"
                        onclick={(e) => { e.stopPropagation(); this.deleteTaxonomy(item.id); }}
                        title="Modeli Sil"
                        style={{ color: '#ef4444', minWidth: '24px', height: '24px', padding: 0 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Marka & Model İşlemleri ---
  saveTaxonomy() {
    if (!this.newBrand || !this.newModel) return;
    this.isSavingTaxonomy = true;
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/taxonomy',
      body: {
        brand: this.newBrand.trim(),
        model: this.newModel.trim(),
        type: this.newVehicleType,
        category: this.newVehicleType,
        city: this.newVehicleType === 'citybus' ? this.newCity.trim() : null,
        discussion: this.newDiscussion.trim()
      }
    }).then(() => {
      this.newModel = '';
      this.isSavingTaxonomy = false;
      this.loadTaxonomy();
      app.alerts.show({ type: 'success' }, 'Marka/Model eklendi.');
    }).catch(() => {
      this.isSavingTaxonomy = false;
      m.redraw();
    });
  }

  moveModel(items, currentIndex, direction) {
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const newItems = [...items];
    const temp = newItems[currentIndex];
    newItems[currentIndex] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    this.applyReorder(newItems);
  }

  reorderModels(items, fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return;
    const newItems = [...items];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);
    this.applyReorder(newItems);
  }

  applyReorder(newItems) {
    const orderIds = newItems.map(i => i.id);
    newItems.forEach((item, idx) => {
      const found = this.taxonomy.find(t => t.id === item.id);
      if (found) found.sort_order = idx;
    });
    m.redraw();

    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/taxonomy',
      body: { action: 'reorder', order: orderIds }
    }).then(() => {
      this.loadTaxonomy();
    }).catch(() => {
      this.loadTaxonomy();
    });
  }

  moveBrand(brandsMap, brandName, direction) {
    let brandOrder = [];
    try {
      const brandOrderStr = app.data.settings['framio-upload-exif.brand_order'];
      if (brandOrderStr) brandOrder = JSON.parse(brandOrderStr);
    } catch (e) {}

    const currentBrands = Object.keys(brandsMap).sort((a, b) => {
      const idxA = brandOrder.indexOf(a);
      const idxB = brandOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, 'tr');
    });

    const currentIndex = currentBrands.indexOf(brandName);
    if (currentIndex === -1) return;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= currentBrands.length) return;

    const targetBrand = currentBrands[targetIndex];
    currentBrands.forEach(b => {
      if (!brandOrder.includes(b)) brandOrder.push(b);
    });

    const globalIdxA = brandOrder.indexOf(brandName);
    const globalIdxB = brandOrder.indexOf(targetBrand);
    if (globalIdxA !== -1 && globalIdxB !== -1) {
      const t = brandOrder[globalIdxA];
      brandOrder[globalIdxA] = brandOrder[globalIdxB];
      brandOrder[globalIdxB] = t;
    }

    const newVal = JSON.stringify(brandOrder);
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/settings',
      body: { 'framio-upload-exif.brand_order': newVal }
    }).then(() => {
      app.data.settings['framio-upload-exif.brand_order'] = newVal;
      m.redraw();
    });
  }

  editTaxonomyItem(item) {
    const newModel = prompt('Yeni model adını giriniz:', item.model);
    if (newModel === null) return;
    const trimmed = newModel.trim();
    if (!trimmed) return;

    let newCity = item.city;
    if (item.type === 'citybus' || item.category === 'citybus') {
      const cityPrompt = prompt('Şehir adını giriniz (İsteğe bağlı):', item.city || '');
      if (cityPrompt !== null) newCity = cityPrompt.trim();
    }

    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/taxonomy',
      body: {
        action: 'update',
        id: item.id,
        model: trimmed,
        city: newCity
      }
    }).then(() => {
      this.loadTaxonomy();
      app.alerts.show({ type: 'success' }, 'Model güncellendi.');
    });
  }

  editDiscussionGroup(group) {
    const currentVal = (group.id && group.id !== '0') ? group.id : '';
    const newDiscussion = prompt('Bu gruptaki tüm modeller için yeni Konu URL veya ID giriniz (Genel yapmak için boş bırakın):', currentVal);
    if (newDiscussion === null) return;

    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/taxonomy',
      body: {
        action: 'update_discussion',
        brand: this.selectedTaxonomyBrand,
        type: this.selectedTaxonomyType,
        old_discussion_id: group.id !== '0' ? group.id : null,
        new_discussion: newDiscussion.trim()
      }
    }).then(() => {
      this.selectedTaxonomyDiscussionKey = null;
      this.loadTaxonomy();
      app.alerts.show({ type: 'success' }, 'Konu eşleştirmesi güncellendi.');
    });
  }

  async cloneDiscussionGroup(group) {
    if (!group || !group.items || group.items.length === 0) return;
    const newUrl = prompt('Bu gruptaki tüm modelleri kopyalamak için YENİ Konu URL\'sini veya ID\'sini giriniz:');
    if (!newUrl) return;

    this.isSavingTaxonomy = true;
    m.redraw();
    try {
      for (const item of group.items) {
        await app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio-media/taxonomy',
          body: {
            brand: item.brand,
            model: item.model,
            type: item.type || item.category,
            category: item.type || item.category,
            city: item.city,
            discussion: newUrl.trim()
          }
        });
      }
      this.isSavingTaxonomy = false;
      app.alerts.show({ type: 'success' }, 'Tüm modeller yeni URL ile çoğaltıldı.');
      this.loadTaxonomy();
    } catch (e) {
      this.isSavingTaxonomy = false;
      this.loadTaxonomy();
    }
  }

  deleteDiscussionGroup(group) {
    if (!confirm(`"${group.label}" altındaki tüm modelleri silmek istediğinize emin misiniz?`)) return;
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/taxonomy',
      body: {
        action: 'delete_discussion_group',
        brand: this.selectedTaxonomyBrand,
        type: this.selectedTaxonomyType,
        discussion_id: group.id !== '0' ? group.id : null
      }
    }).then(() => {
      this.selectedTaxonomyDiscussionKey = null;
      this.loadTaxonomy();
      app.alerts.show({ type: 'success' }, 'Konu altındaki modeller silindi.');
    });
  }

  deleteTaxonomy(id) {
    if (!confirm('Bu modeli silmek istediğinize emin misiniz?')) return;
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/taxonomy',
      body: { action: 'delete', id }
    }).then(() => {
      this.loadTaxonomy();
      app.alerts.show({ type: 'success' }, 'Silindi.');
    });
  }


  renderDownloadMetaTab() {
    return (
      <div className="Form-section" style={{ background: '#fff', padding: '25px', borderRadius: '10px', border: '1px solid #e5e5e5' }}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0, color: '#1e88e5' }}>
          <i className="fas fa-file-download" style={{ marginRight: '8px' }}></i>
          Fotoğraf İndirme & Meta Veri (EXIF / IPTC) Yapılandırması
        </h3>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>
          Kullanıcılar forumdaki fotoğrafları bilgisayarlarına veya cihazlarına indirdiklerinde dosyanın nasıl işleneceğini ve Windows dosya özelliklerindeki <b>Ayrıntılar (Başlık, Açıklamalar, Yazar, Telif Hakkı)</b> alanlarının nasıl doldurulacağını buradan yönetebilirsiniz.
        </p>

        {/* 1. JPG Dönüştürme Seçeneği */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '25px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>İndirme Formatı</h4>
          <div className="Form-group" style={{ marginBottom: '15px' }}>
            <label style={{ fontWeight: 'bold' }}>İndirme biçimi</label>
            <select
              className="FormControl"
              style={{ maxWidth: '360px' }}
              value={this.setting('framio-upload-exif.download_format_mode', '')() || (this.setting('framio-upload-exif.download_convert_jpg', '1')() === '0' ? 'webp' : 'ask')}
              onchange={(e) => this.setting('framio-upload-exif.download_format_mode')(e.target.value)}
            >
              <option value="ask">Her seferinde sor (JPG veya WebP)</option>
              <option value="jpg">Her zaman JPG</option>
              <option value="webp">Her zaman WebP</option>
            </select>
            <div className="helpText" style={{ color: '#64748b', fontSize: '12px', marginTop: '6px' }}>
              İki biçimde de fotoğrafın yüklenirken saklanan EXIF, XMP ve renk profili ile aşağıdaki başlık/açıklama bilgileri dosyaya yazılır.
              JPG en geniş uyumluluğu sağlar ve IPTC (künye) alanlarını da taşır; WebP daha küçüktür ve yeniden kodlanmadan, kayıpsız verilir.
            </div>
          </div>

          <div className="Form-group" style={{ maxWidth: '250px' }}>
            <label>JPG İndirme Kalitesi (0-100)</label>
            <input className="FormControl" type="number" min="50" max="100" bidi={this.setting('framio-upload-exif.download_jpg_quality', '95')} />
            <div className="helpText" style={{ fontSize: '11px', color: '#888' }}>Önerilen: 95 (Yüksek netlik ve detay).</div>
          </div>
        </div>

        {/* İndirilen Dosya Adı */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '25px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>
            <i className="fas fa-file-signature" style={{ marginRight: '6px', color: '#1e88e5' }}></i>
            İndirilen Dosya Adı
          </h4>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>
            Kullanılabilir etiketler: <code>{'{title}'}</code>, <code>{'{kunye_inline}'}</code>, <code>{'{author}'}</code>, <code>{'{forum_title}'}</code>,
            <code>{'{date}'}</code>, <code>{'{date_ymd}'}</code> (2026-10-01), <code>{'{id}'}</code> (görsel no), <code>{'{original_name}'}</code> (yüklenen dosya adı).
            Uzantı (.jpg / .webp) otomatik eklenir.
          </p>

          <div className="Form-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontWeight: 'bold' }}>Dosya adı şablonu</label>
            <input className="FormControl" type="text" placeholder="{title}" bidi={this.setting('framio-upload-exif.download_filename_template', '{title}')} />
            <div className="helpText" style={{ fontSize: '11px', color: '#888' }}>
              Örn: <code>{'{title} - {forum_title}'}</code> → "Varan 34 CDL 37 - Spotters Turkey Forum.jpg"
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="Form-group" style={{ flex: '1 1 260px' }}>
              <label style={{ fontWeight: 'bold' }}>Karakter biçimi</label>
              <select
                className="FormControl"
                value={this.setting('framio-upload-exif.download_filename_style', 'unicode')() || 'unicode'}
                onchange={(e) => this.setting('framio-upload-exif.download_filename_style')(e.target.value)}
              >
                <option value="unicode">Türkçe karakterler korunsun (Ağır Vasıta.jpg)</option>
                <option value="ascii">Türkçe karakterler çevrilsin (Agir Vasita.jpg)</option>
                <option value="slug">Küçük harf ve tire (agir-vasita.jpg)</option>
              </select>
            </div>
            <div className="Form-group" style={{ flex: '0 1 200px' }}>
              <label style={{ fontWeight: 'bold' }}>En fazla karakter</label>
              <input className="FormControl" type="number" min="20" max="200" bidi={this.setting('framio-upload-exif.download_filename_max', '120')} />
            </div>
          </div>
          <div className="helpText" style={{ fontSize: '11px', color: '#888' }}>
            Dosya sistemlerinde yasak olan karakterler (\ / : * ? " &lt; &gt; |) otomatik temizlenir. Şablon boş kalırsa fotoğraf başlığı kullanılır.
          </div>
        </div>

        {/* 2. Windows Ayrıntılar / Meta Veri Şablonları */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '25px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>
            <i className="fas fa-tags" style={{ marginRight: '6px', color: '#1e88e5' }}></i>
            Windows Dosya Özellikleri (Açıklama & Ayrıntılar) Şablonları
          </h4>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '15px' }}>
            Kullanılabilir Dinamik Etiketler: <code>{'{title}'}</code> (Fotoğraf/Araç Başlığı), <code>{'{kunye_inline}'}</code> (Tek Satır Künye), <code>{'{kunye_formatted}'}</code> (Maddeli Künye), <code>{'{post_url}'}</code> (Mesaj Doğrudan Linki), <code>{'{author}'}</code> (Sanatçı/Fotoğrafçı), <code>{'{forum_title}'}</code> (Site Adı), <code>{'{forum_url}'}</code> (Site Adresi), <code>{'{date}'}</code> (Tarih).
          </p>

          <div className="Form-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontWeight: 'bold' }}>Başlık (Title / ObjectName)</label>
            <input className="FormControl" type="text" placeholder="{title} | {forum_title}" bidi={this.setting('framio-upload-exif.download_meta_title', '{title} | {forum_title}')} />
            <div className="helpText" style={{ fontSize: '11px', color: '#888' }}>Windows dosya özelliklerindeki "Başlık" alanına yazılır. Örn: <code>{'{title} | {forum_title}'}</code></div>
          </div>

          <div className="Form-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontWeight: 'bold' }}>Konu (Subject / Headline)</label>
            <input className="FormControl" type="text" placeholder="{kunye_inline} - {post_url}" bidi={this.setting('framio-upload-exif.download_meta_subject', '{kunye_inline} - {post_url}')} />
            <div className="helpText" style={{ fontSize: '11px', color: '#888' }}>Windows dosya özelliklerindeki "Konu" alanına künye bilgileri ve ilgili mesaj linki yazılır.</div>
          </div>

          <div className="Form-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontWeight: 'bold' }}>Açıklamalar (Comments / Caption)</label>
            <textarea
              className="FormControl"
              rows="6"
              placeholder="{title}&#10;&#10;Künye Bilgileri:&#10;{kunye_formatted}&#10;&#10;Fotoğrafı Çeken: {author}&#10;Kaynak: {post_url}&#10;Telif Hakkı: © {author} | {forum_title} ({forum_url})"
              bidi={this.setting('framio-upload-exif.download_meta_comment', "{title}\n\nKünye Bilgileri:\n{kunye_formatted}\n\nFotoğrafı Çeken: {author}\nKaynak: {post_url}\nTelif Hakkı: © {author} | {forum_title} ({forum_url})")}
            ></textarea>
            <div className="helpText" style={{ fontSize: '11px', color: '#888' }}>Windows dosya özelliklerindeki "Açıklamalar" alanına yazılır.</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '16px' }}>
            <div className="Form-group">
              <label style={{ fontWeight: 'bold' }}>Yazarlar (Author / Artist)</label>
              <input className="FormControl" type="text" placeholder="{author}" bidi={this.setting('framio-upload-exif.download_meta_author', '{author}')} />
            </div>
            <div className="Form-group">
              <label style={{ fontWeight: 'bold' }}>Telif Hakkı (Copyright)</label>
              <input className="FormControl" type="text" placeholder="© {author} | {forum_title} ({forum_url})" bidi={this.setting('framio-upload-exif.download_meta_copyright', '© {author} | {forum_title} ({forum_url})')} />
            </div>
          </div>

          <div className="Form-group">
            <label style={{ fontWeight: 'bold' }}>Etiketler (Keywords / Tags)</label>
            <input className="FormControl" type="text" placeholder="İsteğe bağlı boş bırakılabilir" bidi={this.setting('framio-upload-exif.download_meta_tags', '')} />
            <div className="helpText" style={{ fontSize: '11px', color: '#888' }}>Varsayılan olarak boş bırakılmıştır. İstenirse etiket eklenebilir.</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <Button
            type="button"
            className="Button Button--primary"
            loading={this.isSaving}
            onclick={this.save.bind(this)}
          >
            Değişiklikleri Kaydet
          </Button>
        </div>
      </div>
    );
  }

  renderGeneralTab() {
    return (
      <div className="Form-section" style={{ background: '#fff', padding: '25px', borderRadius: '10px', border: '1px solid #e5e5e5' }}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0 }}>Genel & Görsel Optimizasyon</h3>
        
        <div className="Form-group">
          <label>Varsayılan Görsel Formatı</label>
          <div className="helpText" style={{ marginBottom: '10px', color: '#666' }}>Yeni yüklenen görseller için hedeflenen dosya formatı.</div>
          <select className="FormControl" bidi={this.setting('framio-upload-exif.image_format', 'webp')}>
            <option value="webp">WebP (Modern, Yüksek Sıkıştırma, Hızlı - Önerilen)</option>
            <option value="jpg">JPEG / JPG (Standart Fotoğraf Formatı)</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
            <div className="Form-group" style={{ flex: 1 }}>
                <label>Maksimum Fotoğraf Genişliği (px)</label>
                <input className="FormControl" type="number" bidi={this.setting('framio-upload-exif.resize_width', 3840)} />
            </div>
            <div className="Form-group" style={{ flex: 1 }}>
                <label>Sıkıştırma Kalitesi (0-100)</label>
                <input className="FormControl" type="number" bidi={this.setting('framio-upload-exif.compression_quality', 88)} />
            </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
            <div className="Form-group" style={{ flex: 1 }}>
                <label>Thumbnail Genişliği (px)</label>
                <input className="FormControl" type="number" bidi={this.setting('framio-upload-exif.thumb_width', 1024)} />
            </div>
            <div className="Form-group" style={{ flex: 1 }}>
                <label>Mini Genişliği (px)</label>
                <input className="FormControl" type="number" bidi={this.setting('framio-upload-exif.mini_width', 250)} />
            </div>
        </div>

        <hr style={{ margin: '25px 0', border: '0', borderTop: '1px solid #eee' }} />

        <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>
          <div className="Form-group">
            <label>Orijinal Kopya Saklansın Mı?</label>
            <Switch state={this.setting('framio-upload-exif.keep_original', true)()} onchange={this.setting('framio-upload-exif.keep_original', true)}>
              Evet (Hem web için optimize edilmiş, hem de orijinal çözünürlüklü kopya Cloud'da saklanır)
            </Switch>
          </div>
          <div className="Form-group">
            <label>Carousel (Slayt) Modu</label>
            <Switch state={this.setting('framio-upload-exif.enable_carousel_mode', true)()} onchange={this.setting('framio-upload-exif.enable_carousel_mode', true)}>
              Aktif (Kullanıcılar fotoğrafa tıkladığında tam ekran galeride gezinir)
            </Switch>
          </div>
          <div className="Form-group">
            <label>Dinamik CDN Boyutlandırma</label>
            <Switch state={this.setting('framio-upload-exif.cdn_dynamic_resize', false)()} onchange={this.setting('framio-upload-exif.cdn_dynamic_resize', false)}>
              Aktif (Görseller istek anında CDN üzerinden boyutlandırılır)
            </Switch>
          </div>
        </div>

        <hr style={{ margin: '25px 0', border: '0', borderTop: '1px solid #eee' }} />

        {/* ➔ BBCode & Medya Etiketi Yapılandırması (MediaTagParser) ➔ */}
        <h4 style={{ margin: '0 0 10px 0', color: '#1e88e5', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-code"></i>
          BBCode & Medya Etiketi Yönetimi (MediaTagParser)
        </h4>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '15px' }}>
          Forumda fotoğrafların mesaja hangi BBCode etiketi ile ekleneceğini ve sistemin hangi eski/farklı forum etiketlerini geriye dönük otomatik tanıyacağını buradan belirleyebilirsiniz.
        </p>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '15px' }}>
            <div className="Form-group" style={{ flex: 1, minWidth: '240px' }}>
              <label style={{ fontWeight: 'bold' }}>Aktif Yükleme BBCode Etiketi</label>
              <input
                className="FormControl"
                type="text"
                placeholder="framio-image"
                bidi={this.setting('framio-upload-exif.active_bbcode_tag', 'framio-image')}
              />
              <div className="helpText" style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Yeni yüklenen fotoğraflar bu etiketle mesaja eklenir. (Örn: <code>framio-image</code>, <code>spotter-image</code>, <code>ulasimarsiv-image</code>)
              </div>
            </div>

            <div className="Form-group" style={{ flex: 1, minWidth: '240px' }}>
              <label style={{ fontWeight: 'bold' }}>Tanınan Ekstra Etiketler (Virgülle Ayrılmış)</label>
              <input
                className="FormControl"
                type="text"
                placeholder="spotter-image, ulasimarsiv-image, upl-image-preview"
                bidi={this.setting('framio-upload-exif.recognized_bbcode_tags', 'spotter-image, ulasimarsiv-image, upl-image-preview')}
              />
              <div className="helpText" style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Sistem bu etiketleri otomatik tanır ve eski mesajları bozmadan aynı zengin kart ile gösterir.
              </div>
            </div>
          </div>

          {/* Toplu Etiket Dönüştürme / Migration Aracı */}
          <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '15px', marginTop: '10px' }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>
              <i className="fas fa-exchange-alt" style={{ marginRight: '6px', color: '#6366f1' }}></i>
              Toplu BBCode Etiket Dönüştürücü (Veritabanı Migration Aracı)
            </h5>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
              Eski forumdan kalan etiketleri (örn: <code>spotter-image</code> veya <code>ulasimarsiv-image</code>) tek tıkla yeni aktif etiketinize (<code>framio-image</code>) dönüştürebilirsiniz.
            </p>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="FormControl"
                type="text"
                placeholder="Kaynak Etiket (Örn: spotter-image)"
                style={{ width: '220px', fontSize: '12px' }}
                value={this.migrateFromTag || ''}
                oninput={(e) => this.migrateFromTag = e.target.value}
              />
              <span style={{ fontWeight: 'bold', color: '#64748b' }}>➜</span>
              <input
                className="FormControl"
                type="text"
                placeholder="Hedef Etiket (Örn: framio-image)"
                style={{ width: '220px', fontSize: '12px' }}
                value={this.migrateToTag || (this.setting('framio-upload-exif.active_bbcode_tag')() || 'framio-image')}
                oninput={(e) => this.migrateToTag = e.target.value}
              />

              <Button
                type="button"
                className="Button"
                loading={this.isCountingMigration}
                onclick={() => {
                  const from = (this.migrateFromTag || '').trim();
                  const to = (this.migrateToTag || this.setting('framio-upload-exif.active_bbcode_tag')() || 'framio-image').trim();
                  if (!from) return alert('Lütfen dönüştürülecek kaynak etiketi girin.');
                  this.isCountingMigration = true;
                  m.redraw();

                  app.request({
                    method: 'POST',
                    url: app.forum.attribute('apiUrl') + '/framio-media/migrate-tags',
                    body: { action: 'count', from_tag: from, to_tag: to }
                  }).then(res => {
                    this.isCountingMigration = false;
                    this.migrationCountResult = res.count;
                    m.redraw();
                  }).catch(err => {
                    this.isCountingMigration = false;
                    alert('Hata: ' + (err?.response?.error || 'Sayım yapılamadı.'));
                    m.redraw();
                  });
                }}
                style={{ fontSize: '12px' }}
              >
                Taramayı Başlat / Say
              </Button>

              {this.migrationCountResult !== undefined && (
                <Button
                  type="button"
                  className="Button Button--danger"
                  loading={this.isMigrating}
                  onclick={() => {
                    const from = (this.migrateFromTag || '').trim();
                    const to = (this.migrateToTag || this.setting('framio-upload-exif.active_bbcode_tag')() || 'framio-image').trim();
                    if (!confirm(`Veritabanında bulunan ${this.migrationCountResult} adet [${from}] etiketi [${to}] olarak güncellenecektir. Onaylıyor musunuz?`)) return;

                    this.isMigrating = true;
                    m.redraw();

                    app.request({
                      method: 'POST',
                      url: app.forum.attribute('apiUrl') + '/framio-media/migrate-tags',
                      body: { action: 'migrate', from_tag: from, to_tag: to }
                    }).then(res => {
                      this.isMigrating = false;
                      this.migrationCountResult = undefined;
                      app.alerts.show({ type: 'success' }, res.message || 'Dönüştürme tamamlandı.');
                      m.redraw();
                    }).catch(err => {
                      this.isMigrating = false;
                      alert('Hata: ' + (err?.response?.error || 'İşlem başarısız.'));
                      m.redraw();
                    });
                  }}
                  style={{ fontSize: '12px' }}
                >
                  {this.migrationCountResult} Gönderiyi Dönüştür
                </Button>
              )}
            </div>
          </div>
        </div>
        
        <div className="Form-group" style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <Button
            className="Button Button--primary"
            icon="fas fa-save"
            loading={this.isSaving}
            onclick={this.save.bind(this)}
            style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 'bold' }}
          >
            Değişiklikleri Kaydet
          </Button>
        </div>
      </div>
    );
  }

  renderKunyeExifTab() {
    return (
      <div className="Form-section" style={{ background: '#fff', padding: '25px', borderRadius: '10px', border: '1px solid #e5e5e5' }}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0 }}>Künye & EXIF Tasarım Ayarları</h3>
        
        <h4>1. Künye Bilgileri Tasarımı (Araç, Plaka, Güzergah)</h4>
        <div className="helpText" style={{ marginBottom: '15px', color: '#666' }}>
          Yüklenen fotoğraflara ait bilgilerin forumda nasıl sergileneceğini seçin.
        </div>
        
        <div className="Form-group">
          <select className="FormControl" bidi={this.setting('framio-upload-exif.kunye_theme', 'classic')}>
            <option value="classic">Klasik Liste (Mevcut Yapı - Sade ve Şeffaf)</option>
            <option value="modern-line">Modern Çizgi (Sol Kenarlı, Zarif ve Minimalist)</option>
            <option value="inline">Inline Satır (Tek Satır, Kompakt ve Yer Kaplamayan)</option>
          </select>
          
          <div style={{ marginTop: '15px', padding: '15px', background: '#f8f9fa', border: '1px dashed #ccc', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>Künye Canlı Önizleme:</h4>
              <div className={`framio-kunye-card theme-${this.setting('framio-upload-exif.kunye_theme')() || 'classic'}`}>
                  <ul>
                      <li><strong>Varan</strong> | 34 CDL 37</li>
                      <li><strong>Mercedes-Benz Tourismo 16 RHD</strong></li>
                      <li><strong>Ankara</strong> / '26</li>
                  </ul>
              </div>
          </div>
        </div>

        <hr style={{ margin: '25px 0', border: '0', borderTop: '1px solid #eee' }} />

        <h4>2. EXIF Kartı Tasarımı (Kamera Bilgileri)</h4>
        <div className="helpText" style={{ marginBottom: '15px', color: '#666' }}>
          Fotoğrafın çekildiği kamera, ISO, diyafram gibi EXIF bilgilerinin tasarımını seçin.
        </div>
        
        <div className="Form-group">
          <select className="FormControl" bidi={this.setting('framio-upload-exif.exif_theme', 'lightbox_modal')}>
            <option value="lightbox_modal">Lightbox</option>
            <option value="classic">Klasik Açılır Kart</option>
            <option value="hidden">Gizli</option>
          </select>
        </div>

        <div className="Form-group" style={{ marginTop: '20px' }}>
          <label>EXIF Bilgileri Herkese Açık Mı?</label>
          <Switch state={this.setting('framio-upload-exif.show_exif_publicly', true)()} onchange={this.setting('framio-upload-exif.show_exif_publicly', true)}>
            Evet (Fotoğrafların EXIF verileri foruma yansıtılır)
          </Switch>
        </div>
        
        <div className="Form-group" style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <Button
            className="Button Button--primary"
            icon="fas fa-save"
            loading={this.isSaving}
            onclick={this.save.bind(this)}
            style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 'bold' }}
          >
            Değişiklikleri Kaydet
          </Button>
        </div>
      </div>
    );
  }

  renderAiTab() {
    const aiConfig = AI_PROVIDERS;
    const providersSetting = this.setting('framio-upload-exif.ai_providers', '');
    let rows = [];
    try { rows = JSON.parse(providersSetting() || '[]'); } catch (e) { rows = []; }
    if (!Array.isArray(rows)) rows = [];
    // Eski tek sağlayıcılı ayar varsa listeye ilk satır olarak taşınır
    if (!providersSetting() && (this.setting('framio-upload-exif.ai_api_key', '')() || '')) {
      rows = [{ provider: this.setting('framio-upload-exif.ai_provider', 'gemini')() || 'gemini', model: '', key: this.setting('framio-upload-exif.ai_api_key', '')(), enabled: true }];
    }
    const save = (next) => providersSetting(JSON.stringify(next));
    const update = (i, patch) => save(rows.map((r, k) => (k === i ? Object.assign({}, r, patch) : r)));
    const move = (i, d) => {
      const j = i + d;
      if (j < 0 || j >= rows.length) return;
      const next = rows.slice();
      [next[i], next[j]] = [next[j], next[i]];
      save(next);
    };

    return (
      <div className="Form-section" style={{ background: '#fff', padding: '25px', borderRadius: '10px', border: '1px solid #e5e5e5' }}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-robot"></i>
          Framio AI — Otomatik Künye Doldurma
        </h3>
        <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
          Kullanıcılar fotoğraf yüklediklerinde, görsel yapay zeka tarafından taranır ve araç markası, modeli, plakası, firma/belediye adı, şehir ve yılı <b>anlık olarak otomatik doldurulur</b>.
        </p>

        {/* 1. Genel Aktiflik */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <div className="Form-group" style={{ margin: 0 }}>
            <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Framio AI otomatik künye doldurma</label>
            <Switch
              state={this.setting('framio-upload-exif.ai_enabled', '1')() !== '0'}
              onchange={(val) => {
                this.setting('framio-upload-exif.ai_enabled')(val ? '1' : '0');
              }}
            >
              Fotoğraf yüklendiğinde künye alanlarını yapay zeka ile anlık otomatik doldur
            </Switch>
          </div>
        </div>

        {/* 2. Sağlayıcılar (paralel yarış) */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>
            <i className="fas fa-bolt" style={{ marginRight: '6px', color: 'var(--primary-color)' }}></i>
            Yapay Zeka Sağlayıcıları
          </h4>
          <p className="helpText" style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px' }}>
            Etkin sağlayıcıların hepsine <b>aynı anda</b> sorulur, ilk gelen geçerli yanıt kullanılır; biri yavaşlar ya da hata verirse diğeri devreye girer.
            Görsel 768 px boyutuna küçültülüp gönderilir ve aynı fotoğrafın sonucu önbellekten gelir. Ücretsiz seçenekler: Gemini, Groq, NVIDIA NIM ve OpenRouter. Hepsini ekleyin: biri sınıra takılırsa diğeri yanıt verir.
          </p>

          {rows.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#b45309' }}>Henüz sağlayıcı yok. Framio AI, en az bir anahtar eklenene kadar sessizce devre dışı kalır.</p>
          ) : null}

          {rows.map((row, i) => {
            const info = aiConfig[row.provider] || aiConfig.gemini;
            const listId = 'framio-ai-models-' + i;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 160px 1fr 1fr auto', gap: '8px', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', marginBottom: '8px', opacity: row.enabled === false ? 0.55 : 1 }}>
                <input type="checkbox" title="Etkin" checked={row.enabled !== false} onchange={(e) => update(i, { enabled: e.target.checked })} />
                <select className="FormControl" value={row.provider} onchange={(e) => update(i, { provider: e.target.value, model: '' })}>
                  {Object.keys(aiConfig).map((k) => (
                    <option value={k}>{aiConfig[k].name + (aiConfig[k].free ? ' — ücretsiz' : '')}</option>
                  ))}
                </select>
                <div>
                  <input className="FormControl" list={listId} placeholder={'Varsayılan: ' + info.defaultModel} value={row.model || ''} onchange={(e) => update(i, { model: e.target.value.trim() })} />
                  <datalist id={listId}>
                    {info.models.map((mm) => (
                      <option value={mm.id}>{mm.label}</option>
                    ))}
                  </datalist>
                </div>
                <input className="FormControl" type="password" autocomplete="off" placeholder={info.keyPlaceholder} value={row.key || ''} onchange={(e) => update(i, { key: e.target.value.trim() })} />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <Button className="Button Button--icon" icon="fas fa-arrow-up" disabled={i === 0} onclick={() => move(i, -1)} />
                  <Button className="Button Button--icon" icon="fas fa-arrow-down" disabled={i === rows.length - 1} onclick={() => move(i, 1)} />
                  <Button className="Button Button--icon" icon="fas fa-trash" onclick={() => save(rows.filter((r, k) => k !== i))} />
                </div>
                <div style={{ gridColumn: '2 / -1', fontSize: '11px' }}>
                  <a href={info.keyLink} target="_blank" rel="noopener noreferrer">
                    {info.name} anahtarı al <i className="fas fa-external-link-alt"></i>
                  </a>
                </div>
              </div>
            );
          })}

          <Button className="Button" icon="fas fa-plus" onclick={() => save(rows.concat([{ provider: 'groq', model: '', key: '', enabled: true }]))}>
            Sağlayıcı ekle
          </Button>

          <div className="Form-group" style={{ marginTop: '14px', maxWidth: '260px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Zaman aşımı (saniye)</label>
            <input className="FormControl" type="number" min="3" max="30" bidi={this.setting('framio-upload-exif.ai_timeout', '10')} />
            <div className="helpText" style={{ fontSize: '11px', color: '#888' }}>Hiçbir sağlayıcı bu sürede yanıt vermezse alanlar boş kalır, kullanıcı elle doldurur.</div>
          </div>

          <div className="Form-group" style={{ marginTop: '14px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Forum geçmişini kullanan bölümler</label>
            <input className="FormControl" placeholder="ör. sehirlerarasi-otobus, turizm-otobusleri (boş = tüm bölümler)" bidi={this.setting('framio-upload-exif.ai_history_tags', '')} />
            <div className="helpText" style={{ fontSize: '11px', color: '#888' }}>
              Bu bölümlerde (etiket kısa adları, virgülle) okunan plaka daha önce paylaşıldıysa firma, marka ve model o künyelerden alınır;
              firma adı forumdaki tam haline tamamlanır ve model, forumda kullanılan model adlarından seçilir.
            </div>
          </div>

          <div style={{ marginTop: '14px', padding: '12px', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '6px' }}>
            <Switch
              state={this.setting('framio-upload-exif.ai_similarity', '1')() !== '0'}
              onchange={(val) => this.setting('framio-upload-exif.ai_similarity')(val ? '1' : '0')}
            >
              Görsel benzerlik: yeni fotoğrafı forumdaki künyeli fotoğraflarla karşılaştır
            </Switch>
            <div className="helpText" style={{ fontSize: '11px', color: '#64748b', margin: '6px 0 10px' }}>
              Listede etkin bir <b>Google Gemini</b> anahtarı gerekir (gemini-embedding-2). Yapay zeka sorgusuyla aynı anda çalışır, süreyi uzatmaz.
              Yeterince benzeyen bir fotoğraf bulunursa firma, marka, model ve (okunanla çok yakınsa) plaka o fotoğrafın künyesinden alınır.
              Dizin, sunucuda <code>php flarum media:vision-index</code> komutuyla doldurulur; yeni fotoğraflar için bu komutu cron'a (ör. 15 dakikada bir) ekleyin.
            </div>
            <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Benzerlik eşiği (0.50 – 0.99)</label>
            <input className="FormControl" type="number" min="0.5" max="0.99" step="0.01" style={{ maxWidth: '160px' }} bidi={this.setting('framio-upload-exif.ai_similarity_threshold', '0.86')} />
          </div>

          <div style={{ marginTop: '14px', padding: '12px', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '6px' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 'bold' }}>
              <i className="fas fa-map-marker-alt" style={{ marginRight: '6px', color: 'var(--primary-color)' }}></i>Çekim yeri
            </h4>
            <div className="helpText" style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>
              Sıra: fotoğrafın GPS bilgisi → aynı kullanıcının aynı çekim oturumu (±4 saat) → arka planı benzeyen geçmiş fotoğraf → yapay zeka tahmini (yalnızca yüksek/orta güven; orta güven "tahmin" olarak işaretlenir).
              Varsayılan biçim yalnızca il adıdır (ör. Ankara).
            </div>
            <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Yer + il yazılan bölümler</label>
            <input className="FormControl" placeholder="ör. sehirici-ulasim-araclari (etiket kısa adları, virgülle)" bidi={this.setting('framio-upload-exif.ai_location_detail_tags', '')} />
            <div className="helpText" style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>Bu bölümlerde çekim yeri şehir içindeki konumla birlikte yazılır (ör. Kızılay - Ankara).</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Arka plan benzerlik eşiği</label>
                <input className="FormControl" type="number" min="0.5" max="0.99" step="0.01" bidi={this.setting('framio-upload-exif.ai_location_threshold', '0.80')} />
              </div>
              <div>
                <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Konum sorusu modeli (Gemini)</label>
                <input className="FormControl" placeholder="gemini-2.5-flash" bidi={this.setting('framio-upload-exif.ai_location_model', '')} />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Kullanıcı Yetkisi & Kendi API Kotası */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>
            <i className="fas fa-user-shield" style={{ marginRight: '6px', color: 'var(--primary-color)' }}></i>
            Kullanıcı Özel API Anahtarları
          </h4>
          <div className="Form-group" style={{ margin: 0 }}>
            <Switch
              state={this.setting('framio-upload-exif.allow_user_ai_keys', '1')() !== '0'}
              onchange={(val) => {
                this.setting('framio-upload-exif.allow_user_ai_keys')(val ? '1' : '0');
              }}
            >
              Kullanıcıların kendi profil tercihlerinden kişisel API anahtarlarını ve AI sağlayıcılarını girmelerine izin ver
            </Switch>
            <div className="helpText" style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
              Kullanıcı profilinde kendi API anahtarı tanımlıysa analiz onun kotasından yapılır, aksi halde forumun sistem API anahtarı devreye girer.
            </div>
          </div>
        </div>

        {/* 4. Sistem Promptu */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>
            <i className="fas fa-terminal" style={{ marginRight: '6px', color: 'var(--primary-color)' }}></i>
            Özel Yapay Zeka Sistem Komutu (Prompt)
          </h4>
          <div className="Form-group">
            <textarea
              className="FormControl"
              rows="6"
              placeholder="Varsayılan ulaşım uzmanı promptunu kullanmak için boş bırakınız."
              bidi={this.setting('framio-upload-exif.ai_custom_prompt', '')}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            ></textarea>
            <div className="helpText" style={{ fontSize: '11px', color: '#888' }}>
              Boş bırakılırsa standart JSON tabanlı Türk ve dünya ulaşım araçları uzman promptu uygulanır.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <Button
            type="button"
            className="Button Button--primary"
            loading={this.isSaving}
            onclick={this.save.bind(this)}
          >
            Değişiklikleri Kaydet
          </Button>
        </div>
      </div>
    );
  }

  // --- Kategori Şeması Editör Paneli ---
  renderCategoriesTab() {
    const rootSchemas = this.categorySchemas.filter(s => !s.parent_id);
    const getChildren = (parentId) => this.categorySchemas.filter(s => String(s.parent_id) === String(parentId));

    return (
      <div className="CategoryManager-section" style={{ background: '#fff', padding: '25px', borderRadius: '10px', border: '1px solid #e5e5e5' }}>
        <h3 style={{ color: '#1e88e5', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-sitemap"></i>
          Kategori Yapısı & Künye Ayarları
        </h3>
        <p className="helpText" style={{ marginBottom: '20px', color: '#666', fontSize: '13px' }}>
          Forum etiketlerinize bağlı kategori ağacı oluşturun. Her alt kategoriye özel künye alanları tanımlayarak, kullanıcıların fotoğraf yükleme modalında hangi bilgileri gireceğini belirleyin.
        </p>

        {/* EKLEME FORMU */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f9fbfd', padding: '16px', borderRadius: '8px', border: '1px solid #dce4ec', marginBottom: '25px', flexWrap: 'wrap' }}>
          <input
            className="FormControl"
            type="text"
            placeholder="Kategori Adı (Örn: Otobüsler)"
            value={this.newCategoryName}
            oninput={e => this.newCategoryName = e.target.value}
            style={{ flex: '1 1 200px', minWidth: '180px' }}
          />
          <select
            className="FormControl"
            value={this.newCategoryParentId || ''}
            onchange={e => this.newCategoryParentId = e.target.value ? Number(e.target.value) : null}
            style={{ flex: '1 1 180px', minWidth: '160px' }}
          >
            <option value="">Ana Kategori (Kök)</option>
            {rootSchemas.map(s => (
              <option value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            className="FormControl"
            type="text"
            placeholder="İkon (fas fa-bus)"
            value={this.newCategoryIcon}
            oninput={e => this.newCategoryIcon = e.target.value}
            style={{ flex: '1 1 160px', minWidth: '140px' }}
          />
          <Button
            className="Button Button--primary"
            icon="fas fa-plus"
            loading={this.isSavingSchema}
            disabled={!this.newCategoryName.trim()}
            onclick={() => this.addCategorySchema()}
            style={{ height: '38px', padding: '0 20px', fontWeight: 'bold' }}
          >
            Ekle
          </Button>
        </div>

        {/* KATEGORİ AĞACI */}
        {this.isLoadingSchemas ? (
          <div style={{ textAlign: 'center', padding: '30px' }}>
            <LoadingIndicator />
          </div>
        ) : this.categorySchemas.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px', border: '2px dashed #e5e5e5', borderRadius: '8px' }}>
            <i className="fas fa-sitemap fa-3x" style={{ marginBottom: '15px', display: 'block', opacity: 0.3 }}></i>
            <p>Henüz kategori tanımlanmamış. Yukarıdan ilk kategorinizi ekleyin.</p>
            <p style={{ fontSize: '12px', color: '#aaa' }}>Önerilen yapı: Karayolu, Havayolu, Demiryolu ana kategorileri altına alt kategoriler ekleyin.</p>
          </div>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            {rootSchemas.map(root => {
              const children = getChildren(root.id);
              return (
                <div key={root.id}>
                  {/* ANA KATEGORİ SATIRI */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <i className="fas fa-grip-vertical" style={{ color: '#cbd5e1', cursor: 'grab' }}></i>
                      <i className={root.icon || 'fas fa-folder'} style={{ color: '#1e88e5', fontSize: '18px' }}></i>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1e293b' }}>{root.name}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {children.length} alt kategori
                          {root.tag_slugs && root.tag_slugs.length > 0 && (
                            <span> · {(typeof root.tag_slugs === 'string' ? JSON.parse(root.tag_slugs) : root.tag_slugs).map(ts => (
                              <span key={ts} style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '3px', marginLeft: '4px', fontSize: '10px' }}>{ts}</span>
                            ))}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Button
                        className="Button Button--icon Button--link"
                        icon="fas fa-cog"
                        onclick={() => this.openSchemaEditor(root)}
                        title="Ayarlar"
                        style={{ color: '#64748b' }}
                      />
                      <Button
                        className="Button Button--icon Button--link"
                        icon="fas fa-trash-alt"
                        onclick={() => this.deleteCategorySchema(root.id)}
                        title="Sil"
                        style={{ color: '#ef4444' }}
                      />
                    </div>
                  </div>

                  {/* ALT KATEGORİ SATIRLARI */}
                  {children.map(child => {
                    const fieldsConfig = typeof child.fields_config === 'string'
                      ? JSON.parse(child.fields_config || '[]')
                      : (child.fields_config || []);
                    return (
                      <div key={child.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 20px 12px 50px', background: '#fff', borderBottom: '1px solid #f1f5f9'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <i className="fas fa-grip-vertical" style={{ color: '#e2e8f0', cursor: 'grab' }}></i>
                          <i className={child.icon || 'fas fa-tag'} style={{ color: '#64748b', fontSize: '15px' }}></i>
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '14px', color: '#334155' }}>{child.name}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                              {fieldsConfig.length > 0
                                ? `${fieldsConfig.length} alan tanımlı`
                                : 'Alan yapılandırması yok'}
                              {child.tag_slugs && (typeof child.tag_slugs === 'string' ? JSON.parse(child.tag_slugs) : child.tag_slugs).length > 0 && (
                                <span> · {(typeof child.tag_slugs === 'string' ? JSON.parse(child.tag_slugs) : child.tag_slugs).map(ts => (
                                  <span key={ts} style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '3px', marginLeft: '4px', fontSize: '10px' }}>{ts}</span>
                                ))}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Button
                            className="Button Button--link"
                            icon="fas fa-eye"
                            onclick={() => this.openKunyePreview(child)}
                            title="Künye Önizleme"
                            style={{ color: '#8b5cf6', fontSize: '12px', padding: '4px 8px' }}
                          >
                            Önizle
                          </Button>
                          <Button
                            className="Button Button--icon Button--link"
                            icon="fas fa-cog"
                            onclick={() => this.openSchemaEditor(child)}
                            title="Alan Yapılandırması"
                            style={{ color: '#64748b' }}
                          />
                          <Button
                            className="Button Button--icon Button--link"
                            icon="fas fa-trash-alt"
                            onclick={() => this.deleteCategorySchema(child.id)}
                            title="Sil"
                            style={{ color: '#ef4444' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ŞEMA DÜZENLEYICI MODALI */}
        {this.showSchemaEditor && this.editingSchema && this.renderSchemaEditorPanel()}

        {/* KÜNYE MODAL ÖNİZLEMESİ */}
        {this.showKunyePreview && this.editingSchema && this.renderKunyePreviewPanel()}
      </div>
    );
  }

  // --- Şema Düzenleme Paneli ---

  renderSchemaEditorPanel() {
    const schema = this.editingSchema;
    const tagSlugs = Array.isArray(schema.tag_slugs) ? schema.tag_slugs : (typeof schema.tag_slugs === 'string' ? JSON.parse(schema.tag_slugs || '[]') : []);
    const fieldsConfig = Array.isArray(schema.fields_config) ? schema.fields_config : (typeof schema.fields_config === 'string' ? JSON.parse(schema.fields_config || '[]') : []);

    const fieldTypes = [
      { value: 'text', label: 'Metin Girişi' },
      { value: 'taxonomy_select', label: 'Taksonomi (Marka/Model)' },
      { value: 'city_select', label: 'Şehir Seçici' },
      { value: 'route_select', label: 'Hat Seçici' },
      { value: 'year', label: 'Yıl (EXIF Otomatik)' },
      { value: 'select', label: 'Sabit Seçenek Listesi' }
    ];

    return (
      <div style={{
        marginTop: '25px', background: '#f8fafc', border: '2px solid #1e88e5',
        borderRadius: '10px', padding: '25px', position: 'relative'
      }}>
        {/* Başlık */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h4 style={{ margin: 0, color: '#1e88e5', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-cog"></i>
            Kategori Ayarları: <strong>{schema.name}</strong>
          </h4>
          <Button
            className="Button Button--icon"
            icon="fas fa-times"
            onclick={() => { this.showSchemaEditor = false; this.editingSchema = null; m.redraw(); }}
            style={{ color: '#94a3b8' }}
          />
        </div>

        {/* Hızlı Şablonlar (Hazır Presetler) */}
        <div style={{ marginBottom: '25px', padding: '15px', background: '#e0f2fe', borderRadius: '8px', border: '1px dashed #7dd3fc' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0369a1', marginBottom: '10px' }}>
            <i className="fas fa-magic" style={{ marginRight: '6px' }}></i>
            Hızlı Şablon Yükle
          </div>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#0c4a6e' }}>
            Aşağıdaki butonlara tıklayarak standart yapılandırmaları tek tıkla yükleyebilirsiniz. <strong>Dikkat:</strong> Tıkladığınızda alttaki mevcut "Alanlar" ve "Çıktı Şablonu" sıfırlanıp üzerine yazılır.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button className="Button" onclick={() => this.applyPreset('bus')} style={{ background: '#fff', border: '1px solid #bae6fd', color: '#0284c7' }}>
              <i className="fas fa-bus"></i> Standart (Otobüs/Kamyon)
            </Button>
            <Button className="Button" onclick={() => this.applyPreset('city')} style={{ background: '#fff', border: '1px solid #bae6fd', color: '#0284c7' }}>
              <i className="fas fa-city"></i> Şehiriçi Araçlar
            </Button>
          </div>
        </div>

        {/* Temel Bilgiler */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="Form-group" style={{ flex: '1 1 200px' }}>
            <label>Kategori Adı</label>
            <input className="FormControl" value={schema.name}
              oninput={e => { schema.name = e.target.value; m.redraw(); }} />
          </div>
          <div className="Form-group" style={{ flex: '1 1 160px' }}>
            <label>İkon Sınıfı</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input className="FormControl" value={schema.icon || ''}
                oninput={e => { schema.icon = e.target.value; m.redraw(); }}
                placeholder="fas fa-bus" />
              <i className={schema.icon || 'fas fa-folder'} style={{ fontSize: '20px', color: '#1e88e5' }}></i>
            </div>
          </div>
        </div>

        {/* Bağlı Forum Etiketleri */}
        <div className="Form-group" style={{ marginBottom: '20px' }}>
          <label>
            <i className="fas fa-tags" style={{ marginRight: '6px', color: '#0ea5e9' }}></i>
            Bağlı Forum Etiketleri & Konu ID'leri
          </label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {tagSlugs.map((ts, idx) => {
              const isUrl = ts.startsWith('url:');
              return (
                <span key={idx} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: isUrl ? '#fce7f3' : '#e0f2fe',
                  color: isUrl ? '#be185d' : '#0369a1',
                  padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600'
                }}>
                  {isUrl ? <i className="fas fa-link"></i> : <i className="fas fa-tag"></i>}
                  {isUrl ? `Konu: ${ts.replace('url:', '')}` : ts}
                  <i className="fas fa-times" style={{ cursor: 'pointer', opacity: 0.7 }}
                    onclick={() => {
                      tagSlugs.splice(idx, 1);
                      schema.tag_slugs = [...tagSlugs];
                      m.redraw();
                    }}></i>
                </span>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              className="FormControl"
              style={{ width: '220px' }}
              onchange={e => {
                const val = e.target.value;
                if (val && !tagSlugs.includes(val)) {
                  tagSlugs.push(val);
                  schema.tag_slugs = [...tagSlugs];
                  m.redraw();
                }
                e.target.value = '';
              }}
            >
              <option value="">+ Etiket Bağla...</option>
              {this.forumTags.map(tag => (
                <option value={tag.slug} disabled={tagSlugs.includes(tag.slug)}>
                  {tag.name} ({tag.slug})
                </option>
              ))}
            </select>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>veya</span>
            <input
              className="FormControl"
              type="text"
              placeholder="Konu ID / URL Bağla (Örn: 131)"
              style={{ width: '220px' }}
              onchange={e => {
                let val = e.target.value.trim();
                if (val) {
                  // Extract ID if URL is pasted
                  const match = val.match(/\/d\/(\d+)/);
                  if (match) val = match[1];
                  
                  const tagVal = 'url:' + val;
                  if (!tagSlugs.includes(tagVal)) {
                    tagSlugs.push(tagVal);
                    schema.tag_slugs = [...tagSlugs];
                    m.redraw();
                  }
                }
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* Alan Yapılandırması */}
        <div className="Form-group" style={{ marginBottom: '20px' }}>
          {/* Datalist (Orta sütun için popüler anahtarlar) */}
          <datalist id="popular-keys">
            <option value="company">Firma</option>
            <option value="plate">Plaka</option>
            <option value="brand">Marka</option>
            <option value="model">Model</option>
            <option value="location">Çekim Yeri</option>
            <option value="year">Yıl</option>
            <option value="city">Şehir</option>
            <option value="route">Hat Kodu</option>
            <option value="fleetCode">Filo Kodu</option>
          </datalist>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
              <i className="fas fa-list-alt" style={{ marginRight: '8px', color: '#8b5cf6' }}></i>
              Künye Modal Alanları
            </span>
            <Button
              className="Button Button--primary"
              icon="fas fa-plus"
              onclick={() => {
                fieldsConfig.push({ key: 'field_' + Date.now(), label: 'Yeni Alan', type: 'text', required: false });
                schema.fields_config = [...fieldsConfig];
                m.redraw();
              }}
              style={{ fontSize: '11px', padding: '4px 14px', height: 'auto', marginLeft: '15px' }}
            >
              Alan Ekle
            </Button>
          </div>

          <div style={{ borderRadius: '8px', overflow: 'hidden', marginTop: '10px' }}>
            {fieldsConfig.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                Henüz alan eklenmemiş. "Alan Ekle" butonuna tıklayın.
              </div>
            ) : fieldsConfig.map((field, idx) => (
              <div
                key={idx}
                draggable="true"
                ondragstart={(e) => { this._dragFieldIdx = idx; e.dataTransfer.setData('text/plain', idx); }}
                ondragover={(e) => e.preventDefault()}
                ondrop={(e) => {
                  e.preventDefault();
                  if (this._dragFieldIdx !== undefined && this._dragFieldIdx !== idx) {
                    const [moved] = fieldsConfig.splice(this._dragFieldIdx, 1);
                    fieldsConfig.splice(idx, 0, moved);
                    schema.fields_config = [...fieldsConfig];
                    this._dragFieldIdx = undefined;
                    m.redraw();
                  }
                }}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '8px',
                  padding: '12px 14px', marginBottom: '8px',
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'box-shadow 0.2s, transform 0.1s'
                }}
                className="SchemaField-Row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <div style={{ cursor: 'grab', padding: '5px', color: '#94a3b8', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Sürükle">
                    <i className="fas fa-grip-vertical"></i>
                  </div>
                  <input className="FormControl" value={field.label}
                    oninput={e => { field.label = e.target.value; schema.fields_config = [...fieldsConfig]; m.redraw(); }}
                    placeholder="Alan Etiketi (Örn: Firma)"
                    style={{ flex: '1 1 160px', minWidth: '120px', fontSize: '13px' }} />
                  <input className="FormControl" value={field.key} list="popular-keys"
                    oninput={e => { field.key = e.target.value; schema.fields_config = [...fieldsConfig]; m.redraw(); }}
                    placeholder="Alan Anahtarı (örn: company)"
                    style={{ width: '140px', fontSize: '12px', fontFamily: 'monospace' }} />
                  <select className="FormControl" value={field.type}
                    onchange={e => { field.type = e.target.value; schema.fields_config = [...fieldsConfig]; m.redraw(); }}
                    style={{ width: '160px', fontSize: '12px' }}
                  >
                    {fieldTypes.map(ft => <option value={ft.value}>{ft.label}</option>)}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', whiteSpace: 'nowrap', cursor: 'pointer', padding: '0 5px' }}>
                    <input type="checkbox" checked={field.required}
                      onchange={e => { field.required = e.target.checked; schema.fields_config = [...fieldsConfig]; m.redraw(); }} />
                    Zorunlu
                  </label>
                  <Button
                    className="Button Button--icon Button--link"
                    icon="fas fa-trash-alt"
                    onclick={() => { fieldsConfig.splice(idx, 1); schema.fields_config = [...fieldsConfig]; m.redraw(); }}
                    style={{ color: '#ef4444', minWidth: '24px', padding: 0 }}
                    title="Alanı Sil"
                  />
                </div>
                
                {/* Yapay Zeka Talimatı (AI Prompt) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '28px', marginTop: '2px' }}>
                  <i className="fas fa-robot" style={{ color: '#6366f1', fontSize: '12px' }} title="Yapay Zeka Sorusu / Talimatı"></i>
                  <input
                    type="text"
                    className="FormControl"
                    value={field.ai_prompt || ''}
                    oninput={e => { field.ai_prompt = e.target.value; schema.fields_config = [...fieldsConfig]; m.redraw(); }}
                    placeholder={`Yapay Zeka Talimatı (Varsayılan: Fotoğraftan "${field.label || 'bilgi'}" değerini çıkar)`}
                    style={{ flex: 1, fontSize: '11px', background: '#f8fafc', borderColor: '#cbd5e1', padding: '4px 8px', height: '28px' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Çıktı Şablonu */}
        <div className="Form-group" style={{ marginBottom: '20px' }}>
          <label>
            <i className="fas fa-file-alt" style={{ marginRight: '6px', color: '#f59e0b' }}></i>
            Çıktı Şablonu (Markdown)
          </label>
          <textarea
            className="FormControl"
            rows={4}
            value={schema.output_template || ''}
            oninput={e => { schema.output_template = e.target.value; m.redraw(); }}
            placeholder={'- **{company} | {plate}**\n- **{brand} {model}**\n- **{location} / \'{year}**'}
            style={{ fontFamily: 'monospace', fontSize: '13px', resize: 'vertical' }}
          />
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: '5px 0 0 0' }}>
            Alan anahtarlarını süslü parantez içinde kullanın: {'{company}'}, {'{brand}'}, {'{model}'}, {'{location}'}, {'{year}'}... Boş alanlar çıktıda gizlenir.
          </p>
        </div>

        {/* Kaydet & Önizle Butonları */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <Button
            className="Button"
            icon="fas fa-eye"
            onclick={() => { this.showKunyePreview = true; m.redraw(); }}
            style={{ background: '#f3e8ff', color: '#7c3aed', border: '1px solid #c4b5fd' }}
          >
            Künye Önizlemesi
          </Button>
          <Button
            className="Button Button--primary"
            icon="fas fa-save"
            loading={this.isSavingSchema}
            onclick={() => this.saveCategorySchema(schema)}
          >
            Kaydet
          </Button>
        </div>
      </div>
    );
  }

  // --- Künye Modal Canlı Önizleme Paneli ---
  renderKunyePreviewPanel() {
    const schema = this.editingSchema;
    const fieldsConfig = Array.isArray(schema.fields_config) ? schema.fields_config : (typeof schema.fields_config === 'string' ? JSON.parse(schema.fields_config || '[]') : []);
    const outputTemplate = schema.output_template || '';

    // Placeholder örnek veriler
    const placeholders = {
      company: 'Metro Turizm', plate: '34 ABC 123', brand: 'Mercedes-Benz', model: 'Travego',
      location: 'Bursa Otogar', year: '2025', city: 'Ankara', route: '104 | Kızılay - Batıkent',
      fleetCode: '06-1234', airline: 'THY', registration: 'TC-JRL', airport: 'IST',
      operator: 'TCDD', vehicle_code: 'E43000-123', station: 'Ankara Gar'
    };

    // Önizleme alanları için değerler
    const previewValues = {};
    fieldsConfig.forEach(f => {
      previewValues[f.key] = this.kunyePreviewFields[f.key] || placeholders[f.key] || `Örnek ${f.label}`;
    });

    // Çıktı şablonunu render et
    let renderedOutput = outputTemplate;
    Object.keys(previewValues).forEach(key => {
      renderedOutput = renderedOutput.replace(new RegExp(`\\{${key}\\}`, 'g'), previewValues[key]);
    });
    // Yıl kısaltması
    if (previewValues.year) {
      renderedOutput = renderedOutput.replace(/'\{year\}/g, "'" + String(previewValues.year).slice(-2));
      renderedOutput = renderedOutput.replace(/\{year\}/g, String(previewValues.year).slice(-2));
    }
    // Boş placeholder'ları temizle
    renderedOutput = renderedOutput.replace(/\{[a-z_]+\}/g, '');
    renderedOutput = renderedOutput.replace(/\|\s*\*\*/g, '**').replace(/\*\*\s*\|/g, '**');

    return (
      <div style={{
        marginTop: '25px', background: '#faf5ff', border: '2px solid #8b5cf6',
        borderRadius: '10px', padding: '25px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h4 style={{ margin: 0, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-eye"></i>
            Künye Modal Önizlemesi ” {schema.name}
          </h4>
          <Button
            className="Button Button--icon"
            icon="fas fa-times"
            onclick={() => { this.showKunyePreview = false; m.redraw(); }}
            style={{ color: '#94a3b8' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap' }}>
          {/* SOL: MODAL ÖNİZLEME */}
          <div style={{
            flex: '1 1 400px', background: '#fff', borderRadius: '12px',
            border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
              <h5 style={{ margin: 0, fontWeight: 700, color: '#333', fontSize: '1.15em' }}>
                Araç Künye Bilgileri
              </h5>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px' }}>
              {/* Örnek Preview Area */}
              <div style={{
                background: '#f4f6f8', borderRadius: '8px', border: '1px solid #e1e4e8',
                padding: '25px', textAlign: 'center', marginBottom: '20px', color: '#999'
              }}>
                <i className="fas fa-image fa-2x" style={{ marginBottom: '8px', display: 'block' }}></i>
                Fotoğraf Önizlemesi
              </div>

              {/* Dinamik Form Alanları */}
              {this.renderPreviewFormFields(fieldsConfig, previewValues)}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button style={{
                width: '100%', height: '42px', borderRadius: '8px', fontSize: '13px',
                fontWeight: 600, background: 'var(--primary-color, #1e88e5)', color: '#fff',
                border: 'none', cursor: 'default'
              }}>
                <i className="fas fa-check" style={{ marginRight: '6px' }}></i> Bilgileri Onayla
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ flex: 1, height: '36px', borderRadius: '8px', fontSize: '12px', background: '#ecf0f1', color: '#2c3e50', border: 'none', cursor: 'default' }}>
                  <i className="fas fa-info-circle" style={{ marginRight: '4px' }}></i> Info Ekle
                </button>
                <button style={{ flex: 1, height: '36px', borderRadius: '8px', fontSize: '12px', background: '#fff', color: '#333', border: '1px solid #dcdfe6', cursor: 'default' }}>
                  Künye Ekleme
                </button>
              </div>
            </div>
          </div>

          {/* SAĞ: ÇIKTI ÖNİZLEME */}
          <div style={{ flex: '1 1 300px' }}>
            <h5 style={{ margin: '0 0 12px 0', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fas fa-file-alt"></i> Gönderi Çıktısı Önizlemesi
            </h5>
            <div style={{
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
              padding: '20px', fontFamily: 'system-ui', lineHeight: 1.8
            }}>
              {renderedOutput.split('\n').filter(l => l.trim()).map((line, i) => {
                const cleaned = line.replace(/- \*\*/g, '').replace(/\*\*/g, '').trim();
                return (
                  <div key={i} style={{ fontSize: '14px', color: '#1e293b' }}>
                    {'- '}<strong>{cleaned}</strong>
                  </div>
                );
              })}
              {!renderedOutput.trim() && (
                <p style={{ color: '#94a3b8', fontSize: '13px' }}>Çıktı şablonu henüz tanımlanmamış.</p>
              )}
            </div>

            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px' }}>
              <i className="fas fa-info-circle" style={{ marginRight: '4px' }}></i>
              Bu önizleme, kullanıcının gönderi oluşturduğunda konunun altına eklenen künye metninin nasıl görüneceğini gösterir.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Önizleme form alanlarını render eder
  renderPreviewFormFields(fieldsConfig, previewValues) {
    // Alanları 2'li satırlara böl
    const rows = [];
    for (let i = 0; i < fieldsConfig.length; i += 2) {
      rows.push(fieldsConfig.slice(i, i + 2));
    }

    const inputStyle = {
      background: '#fff', border: '1px solid #dcdfe6', borderRadius: '8px',
      padding: '8px 12px', fontSize: '14px', width: '100%',
      minHeight: '42px', lineHeight: 'normal', boxSizing: 'border-box'
    };

    return rows.map((row, rowIdx) => (
      <div key={rowIdx} style={{ display: 'flex', gap: '15px', marginBottom: '12px' }}>
        {row.map(field => (
          <div className="Form-group" style={{ flex: 1 }} key={field.key}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#5c6b77', marginBottom: '6px', display: 'block' }}>
              {field.label}
              {field.required && <span style={{ color: '#e74c3c', marginLeft: '3px' }}>*</span>}
            </label>
            {field.type === 'taxonomy_select' ? (
              <select className="FormControl" style={inputStyle}>
                <option>{previewValues[field.key] || `-- ${field.label} Seç --`}</option>
              </select>
            ) : field.type === 'city_select' || field.type === 'route_select' ? (
              <input className="FormControl"
                value={previewValues[field.key] || ''}
                oninput={e => { this.kunyePreviewFields[field.key] = e.target.value; m.redraw(); }}
                placeholder=""
                style={inputStyle} />
            ) : field.type === 'year' ? (
              <input className="FormControl" type="number"
                value={previewValues[field.key] || ''}
                oninput={e => { this.kunyePreviewFields[field.key] = e.target.value; m.redraw(); }}
                style={inputStyle} />
            ) : (
              <input className="FormControl"
                value={previewValues[field.key] || ''}
                oninput={e => { this.kunyePreviewFields[field.key] = e.target.value; m.redraw(); }}
                style={inputStyle} />
            )}
          </div>
        ))}
      </div>
    ));
  }

  // --- Kategori Şeması CRUD ---
  addCategorySchema() {
    if (!this.newCategoryName.trim()) return;
    this.isSavingSchema = true;
    m.redraw();
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/category-schemas',
      body: {
        name: this.newCategoryName.trim(),
        parent_id: this.newCategoryParentId,
        icon: this.newCategoryIcon || 'fas fa-folder',
        sort_order: this.categorySchemas.length
      }
    }).then(() => {
      this.newCategoryName = '';
      this.newCategoryParentId = null;
      this.newCategoryIcon = 'fas fa-folder';
      this.isSavingSchema = false;
      this.loadCategorySchemas();
      app.alerts.show({ type: 'success' }, 'Kategori eklendi.');
    }).catch(() => {
      this.isSavingSchema = false;
      m.redraw();
    });
  }

  saveCategorySchema(schema) {
    this.isSavingSchema = true;
    m.redraw();
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/category-schemas',
      body: {
        id: schema.id,
        name: schema.name,
        slug: schema.slug,
        icon: schema.icon,
        parent_id: schema.parent_id,
        tag_slugs: schema.tag_slugs,
        fields_config: schema.fields_config,
        output_template: schema.output_template,
        sort_order: schema.sort_order
      }
    }).then(() => {
      this.isSavingSchema = false;
      this.loadCategorySchemas();
      app.alerts.show({ type: 'success' }, 'Kategori ayarları kaydedildi.');
    }).catch(() => {
      this.isSavingSchema = false;
      m.redraw();
    });
  }

  deleteCategorySchema(id) {
    if (!confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) return;
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/category-schemas',
      body: { action: 'delete', id }
    }).then(() => {
      this.loadCategorySchemas();
      app.alerts.show({ type: 'success' }, 'Kategori silindi.');
    });
  }

  openSchemaEditor(schema) {
    // Deep clone to edit
    this.editingSchema = JSON.parse(JSON.stringify(schema));
    this.showSchemaEditor = true;
    this.showKunyePreview = false;
    this.kunyePreviewFields = {};
    m.redraw();
  }

  openKunyePreview(schema) {
    this.editingSchema = JSON.parse(JSON.stringify(schema));
    this.showKunyePreview = true;
    this.showSchemaEditor = false;
    this.kunyePreviewFields = {};
    m.redraw();
  }

  // ==========================================
  // --- 2. ŞEHİRİÇİ HAT YÖNETİMİ SEKMESİ ---
  // ==========================================
  renderCitySettingsTab() {
    const filteredRoutes = this.cityRoutes.filter(r => {
      if (!this.routeSearchTerm) return true;
      const q = this.routeSearchTerm.toLowerCase();
      return (r.route_code && r.route_code.toLowerCase().includes(q)) ||
             (r.route_name && r.route_name.toLowerCase().includes(q));
    });

    return (
      <div className="CityRoutes-section" style={{ background: '#fff', padding: '25px', borderRadius: '10px', border: '1px solid #e5e5e5' }}>
        <h3 style={{ color: '#1e88e5', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-city"></i>
          Şehiriçi Ulaşım ve Hat Yönetimi
        </h3>
        <p className="helpText" style={{ marginBottom: '20px', color: '#666', fontSize: '13px' }}>
          Şehiriçi araç fotoğrafları için şehirlerin hat ve güzergah bilgilerini buradan yönetebilirsiniz. JSON dosyası yükleyebilir, kaynak kodundan hat ayrıştırabilir ya da tekil hat tanımlayabilirsiniz.
        </p>

        {/* 1. SEVİYE: ŞEHİR SEÇİMİ VE YÖNETİMİ */}
        <div style={{ background: '#fff', border: '1px solid #dce4ec', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#334155' }}>
                <i className="fas fa-map-marker-alt" style={{ color: '#e11d48', marginRight: '6px' }}></i>
                Aktif Şehir:
              </span>
              <select
                className="FormControl"
                value={this.selectedCity}
                onchange={(e) => {
                  this.selectedCity = e.target.value;
                  this.loadCityRoutes(this.selectedCity);
                }}
                style={{ width: '220px', fontWeight: 'bold' }}
              >
                {this.cityList.map(c => (
                  <option value={c.name}>{c.name} ({c.count || 0} Hat)</option>
                ))}
              </select>
              <Button
                className="Button Button--primary"
                icon="fas fa-plus"
                onclick={() => this.addCity()}
                style={{ height: '38px', fontSize: '12px' }}
              >
                Yeni Şehir Ekle
              </Button>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['Ankara', 'İstanbul', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep', 'Eskişehir', 'Kayseri', 'Mersin', 'Samsun', 'Trabzon'].map(city => (
                <button
                  type="button"
                  className="Button"
                  onclick={() => {
                    this.selectedCity = city;
                    const exists = this.cityList.some(c => c.name.toLowerCase() === city.toLowerCase());
                    if (!exists) this.cityList.unshift({ name: city, count: 0 });
                    this.loadCityRoutes(city);
                  }}
                  style={{
                    fontSize: '12px', padding: '4px 10px', borderRadius: '15px',
                    background: this.selectedCity === city ? '#1e88e5' : '#f1f5f9',
                    color: this.selectedCity === city ? '#fff' : '#475569',
                    border: 'none', cursor: 'pointer', fontWeight: this.selectedCity === city ? 'bold' : 'normal'
                  }}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. EYLEM ÇUBUĞU */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', background: '#f1f5f9', padding: '12px 16px', borderRadius: '8px' }}>
          <input
            type="file"
            id="city-routes-json-input"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onchange={(e) => this.handleJsonFile(e)}
          />
          <Button
            className="Button"
            icon="fas fa-file-import"
            onclick={() => document.getElementById('city-routes-json-input').click()}
            style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#0369a1', fontWeight: '500' }}
          >
            JSON Dosyası Yükle
          </Button>

          <Button
            className="Button"
            icon="fas fa-magic"
            onclick={() => {
              this.showParserModal = true;
              this.rawSourceCode = '';
              this.parsedPreviewRoutes = [];
              m.redraw();
            }}
            style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#7c3aed', fontWeight: '500' }}
          >
            Kaynak Kodu / Metin Yapıştır
          </Button>

          <Button
            className="Button"
            icon="fas fa-file-export"
            onclick={() => this.exportJsonFile()}
            disabled={this.cityRoutes.length === 0}
            style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#059669', fontWeight: '500' }}
          >
            JSON İndir ({this.selectedCity})
          </Button>

          <Button
            className="Button"
            icon="fas fa-broom"
            onclick={() => this.sanitizeCityRoutes()}
            disabled={this.cityRoutes.length === 0}
            title="Güzergah isimlerindeki gereksiz iki nokta, tire ve boşlukları temizler."
            style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#d97706', fontWeight: '500' }}
          >
            İsimleri Temizle
          </Button>

          <Button
            className="Button"
            icon="fas fa-font"
            onclick={() => this.changeCityCasing('title')}
            disabled={this.cityRoutes.length === 0}
            style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#2563eb', fontWeight: '500' }}
          >
            Baş Harfleri Büyüt
          </Button>

          <Button
            className="Button"
            icon="fas fa-heading"
            onclick={() => this.changeCityCasing('upper')}
            disabled={this.cityRoutes.length === 0}
            style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#475569', fontWeight: '500' }}
          >
            Tümü Büyük Harf
          </Button>

          <Button
            className="Button"
            icon="fas fa-trash-alt"
            onclick={() => this.clearCityRoutes()}
            disabled={this.cityRoutes.length === 0}
            style={{ background: '#fff', border: '1px solid #fca5a5', color: '#dc2626', marginLeft: 'auto' }}
          >
            Tüm Hatları Sil
          </Button>
        </div>

        {/* 3. TEKİL HAT EKLEME */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #dce4ec', marginBottom: '25px', flexWrap: 'wrap' }}>
          <input
            className="FormControl"
            type="text"
            placeholder="Hat Kodu (Örn: 104, 500T, M2)"
            value={this.newRouteCode}
            oninput={e => this.newRouteCode = e.target.value}
            style={{ flex: '1 1 140px', minWidth: '120px' }}
          />
          <input
            className="FormControl"
            type="text"
            placeholder="Hat Adı / Güzergah (Örn: Gölbaşı - Kızılay - Sıhhiye)"
            value={this.newRouteName}
            oninput={e => this.newRouteName = e.target.value}
            style={{ flex: '2 1 250px', minWidth: '200px' }}
          />
          <Button
            className="Button Button--primary"
            icon="fas fa-plus"
            loading={this.isSavingRoute}
            onclick={() => this.saveSingleRoute()}
            disabled={!this.newRouteCode && !this.newRouteName}
            style={{ height: '38px', padding: '0 20px', fontWeight: 'bold' }}
          >
            Hat Ekle ({this.selectedCity})
          </Button>
        </div>

        {/* 4. HAT LİSTESİ */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#1e293b' }}>
              <i className="fas fa-list-ul" style={{ marginRight: '8px', color: '#64748b' }}></i>
              {this.selectedCity} Hat Listesi ({filteredRoutes.length} / {this.cityRoutes.length} Hat)
            </div>
            <div style={{ width: '250px' }}>
              <input
                className="FormControl"
                type="text"
                placeholder="Listede Ara..."
                value={this.routeSearchTerm}
                oninput={e => this.routeSearchTerm = e.target.value}
                style={{ height: '34px', fontSize: '13px' }}
              />
            </div>
          </div>

          {this.isLoadingRoutes ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <LoadingIndicator /> Hatlar yükleniyor...
            </div>
          ) : filteredRoutes.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              {this.cityRoutes.length === 0 ? (
                <div>
                  <i className="fas fa-bus-alt fa-2x" style={{ marginBottom: '10px', color: '#cbd5e1' }}></i>
                  <p>{this.selectedCity} şehri için henüz hat kaydı bulunmuyor.</p>
                </div>
              ) : 'Aramanızla eşleşen hat bulunamadı.'}
            </div>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 14px', width: '120px' }}>Hat Kodu</th>
                    <th style={{ padding: '10px 14px' }}>Hat Adı / Güzergah</th>
                    <th style={{ padding: '10px 14px', width: '120px', textAlign: 'right' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutes.map((route, idx) => (
                    <tr style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fcfdfd' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' }}>
                          {route.route_code}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#1e293b', fontWeight: '500' }}>
                        {route.route_name || '-'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <Button
                          className="Button Button--icon Button--link"
                          icon="fas fa-pencil-alt"
                          onclick={() => this.editRoute(route)}
                          title="Düzenle"
                          style={{ color: '#64748b', marginRight: '6px' }}
                        />
                        <Button
                          className="Button Button--icon Button--link"
                          icon="fas fa-trash-alt"
                          onclick={() => this.deleteRoute(route)}
                          title="Sil"
                          style={{ color: '#ef4444' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PARSER MODAL */}
        {this.showParserModal && this.renderParserModal()}

        {/* EDIT ROUTE MODAL */}
        {this.editingRoute && this.renderEditRouteModal()}
      </div>
    );
  }

  // --- Şehiriçi Hat İşlemleri ---
  addCity() {
    const cityName = prompt('Eklemek istediğiniz şehir adını yazınız (Örn: Muğla):');
    if (!cityName) return;
    const clean = cityName.trim();
    if (!clean) return;
    const exists = this.cityList.some(c => c.name.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      this.cityList.unshift({ name: clean, count: 0 });
    }
    this.selectedCity = clean;
    this.loadCityRoutes(clean);
  }

  saveSingleRoute() {
    if (!this.newRouteCode && !this.newRouteName) return;
    this.isSavingRoute = true;
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/city-routes',
      body: {
        action: 'save',
        city: this.selectedCity,
        route_code: this.newRouteCode.trim(),
        route_name: this.newRouteName.trim()
      }
    }).then(() => {
      this.newRouteCode = '';
      this.newRouteName = '';
      this.isSavingRoute = false;
      this.loadCityList();
      this.loadCityRoutes(this.selectedCity);
      app.alerts.show({ type: 'success' }, 'Hat eklendi.');
    }).catch(() => {
      this.isSavingRoute = false;
      m.redraw();
    });
  }

  editRoute(route) {
    this.editingRoute = {
      id: route.id,
      city: route.city || this.selectedCity,
      route_code: route.route_code || '',
      route_name: (route.route_name || '').replace(/^[:\-–|\s]+|[:\-–|\s]+$/g, '').trim()
    };
    m.redraw();
  }

  saveEditedRoute() {
    if (!this.editingRoute || !this.editingRoute.route_code) return;
    this.isUpdatingRoute = true;
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/city-routes',
      body: {
        action: 'update',
        id: this.editingRoute.id,
        city: this.editingRoute.city || this.selectedCity,
        route_code: this.editingRoute.route_code.trim(),
        route_name: (this.editingRoute.route_name || '').trim()
      }
    }).then(() => {
      this.isUpdatingRoute = false;
      this.editingRoute = null;
      this.loadCityRoutes(this.selectedCity);
      app.alerts.show({ type: 'success' }, 'Hat güncellendi.');
    }).catch(() => {
      this.isUpdatingRoute = false;
      m.redraw();
    });
  }

  deleteRoute(route) {
    if (!confirm(`"${route.route_code} - ${route.route_name || ''}" hattını silmek istediğinize emin misiniz?`)) return;
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/city-routes',
      body: { action: 'delete', id: route.id }
    }).then(() => {
      this.loadCityList();
      this.loadCityRoutes(this.selectedCity);
      app.alerts.show({ type: 'success' }, 'Hat silindi.');
    });
  }

  clearCityRoutes() {
    if (!confirm(`DİKKAT: "${this.selectedCity}" şehrine ait TÜM hatlar silinecektir. Onaylıyor musunuz?`)) return;
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/city-routes',
      body: { action: 'delete_city', city: this.selectedCity }
    }).then(res => {
      this.loadCityList();
      this.loadCityRoutes(this.selectedCity);
      app.alerts.show({ type: 'success' }, 'Tüm hatlar silindi.');
    });
  }

  sanitizeCityRoutes() {
    if (!confirm(`"${this.selectedCity}" şehrine ait hat isimleri otomatik temizlensin mi?`)) return;
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/city-routes',
      body: { action: 'sanitize_city', city: this.selectedCity }
    }).then(res => {
      this.loadCityRoutes(this.selectedCity);
      app.alerts.show({ type: 'success' }, res.message || 'Hat isimleri temizlendi.');
    });
  }

  changeCityCasing(casing) {
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-media/city-routes',
      body: { action: 'change_casing', city: this.selectedCity, casing: casing }
    }).then(res => {
      this.loadCityRoutes(this.selectedCity);
      app.alerts.show({ type: 'success' }, res.message || 'Yazım formatı güncellendi.');
    });
  }

  handleJsonFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = event.target.result;
        let routes = [];
        try {
          const parsed = JSON.parse(rawText);
          routes = Array.isArray(parsed) ? parsed : (parsed.routes || parsed.lines || parsed.hatlar || parsed.data || []);
          // Şehre göre gruplanmış biçim: { "İstanbul": [ ... ], "Ankara": [ ... ] }
          if ((!routes || !routes.length) && parsed && typeof parsed === 'object') {
            routes = [];
            Object.keys(parsed).forEach(cityName => {
              if (Array.isArray(parsed[cityName])) {
                parsed[cityName].forEach(r => routes.push(typeof r === 'object' ? Object.assign({ city: cityName }, r) : { city: cityName, route_name: String(r) }));
              }
            });
          }
        } catch(err) {
          routes = this.parseSourceCode(rawText);
        }
        if (!routes || routes.length === 0) {
          alert('JSON dosyasında hat bilgisi bulunamadı.');
          return;
        }
        const overwrite = confirm(`${routes.length} adet hat okundu. Eski hatlar silinsin mi?`);
        app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio-media/city-routes',
          body: {
            action: 'bulk_import',
            city: this.selectedCity,
            routes: routes,
            overwrite: overwrite
          }
        }).then(res => {
          this.loadCityList();
          this.loadCityRoutes(this.selectedCity);
          app.alerts.show({ type: 'success' }, res.message || `${routes.length} hat içe aktarıldı.`);
        });
      } catch (err) {
        alert('Dosya okunurken hata oluştu.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  exportJsonFile() {
    if (this.cityRoutes.length === 0) return;
    const exportData = this.cityRoutes.map(r => ({
      route_code: r.route_code,
      route_name: r.route_name
    }));
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.selectedCity}_hat_listesi.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  parseSourceCode(rawText) {
    if (!rawText || !rawText.trim()) return [];
    const results = [];
    const seen = new Set();
    const cleanRaw = rawText.replace(/<(?:script|style|nav|footer|header|noscript)\b[^>]*>.*?<\/(?:script|style|nav|footer|header|noscript)>/gis, '');
    const lines = cleanRaw.split(/\r?\n/);
    lines.forEach(line => {
      line = line.trim();
      if (!line) return;
      const match = line.match(/^([A-Za-z0-9\-\/]+)\s*[-:–|]\s*(.+)$/);
      if (match) {
        const c = match[1].trim();
        const n = match[2].trim();
        if (c && !seen.has(c)) {
          seen.add(c);
          results.push({ route_code: c, route_name: n });
        }
      }
    });
    return results;
  }

  renderParserModal() {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.6)', zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
      }}>
        <div style={{
          background: '#fff', borderRadius: '12px', width: '700px', maxWidth: '95vw',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
            <h4 style={{ margin: 0, color: '#1e293b', fontSize: '16px' }}>
              <i className="fas fa-magic" style={{ color: '#1e88e5', marginRight: '8px' }}></i>
              Kaynak Kodu / Metinden Hat Çekici ({this.selectedCity})
            </h4>
            <button
              type="button"
              onclick={() => { this.showParserModal = false; m.redraw(); }}
              style={{ background: 'transparent', border: 'none', fontSize: '18px', color: '#64748b', cursor: 'pointer' }}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#475569' }}>
              Ulaşım sitesinden kopyaladığınız satır satır hat listesini (Örn: <code>104 - Gölbaşı - Sıhhiye</code>) buraya yapıştırın.
            </p>
            <textarea
              className="FormControl"
              rows="7"
              placeholder="104 - Gölbaşı - Sıhhiye&#10;500T - Tuzla Şifa Mahallesi - Cevizlibağ"
              value={this.rawSourceCode}
              oninput={e => {
                this.rawSourceCode = e.target.value;
                this.parsedPreviewRoutes = this.parseSourceCode(this.rawSourceCode);
              }}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', marginBottom: '15px' }}
            ></textarea>

            {this.parsedPreviewRoutes.length > 0 && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', marginBottom: '15px' }}>
                <div style={{ fontWeight: 'bold', color: '#166534', fontSize: '14px', marginBottom: '6px' }}>
                  <i className="fas fa-check-circle" style={{ marginRight: '6px' }}></i>
                  {this.parsedPreviewRoutes.length} Hat Ayrıştırıldı
                </div>
                <div style={{ fontSize: '12px', color: '#15803d', maxHeight: '120px', overflowY: 'auto' }}>
                  {this.parsedPreviewRoutes.slice(0, 10).map(r => (
                    <div><strong>{r.route_code}</strong>: {r.route_name}</div>
                  ))}
                  {this.parsedPreviewRoutes.length > 10 && <div>... ve {this.parsedPreviewRoutes.length - 10} hat daha.</div>}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="overwrite-chk"
                checked={this.overwriteExistingRoutes}
                onchange={e => this.overwriteExistingRoutes = e.target.checked}
              />
              <label htmlFor="overwrite-chk" style={{ fontSize: '13px', margin: 0, cursor: 'pointer' }}>
                {this.selectedCity} için mevcut tüm eski hatları sil ve sıfırdan yükle
              </label>
            </div>
          </div>

          <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
            <Button className="Button" onclick={() => { this.showParserModal = false; m.redraw(); }}>Kapat</Button>
            <Button
              className="Button Button--primary"
              disabled={this.parsedPreviewRoutes.length === 0}
              onclick={() => {
                app.request({
                  method: 'POST',
                  url: app.forum.attribute('apiUrl') + '/framio-media/city-routes',
                  body: {
                    action: 'bulk_import',
                    city: this.selectedCity,
                    routes: this.parsedPreviewRoutes,
                    overwrite: this.overwriteExistingRoutes
                  }
                }).then(res => {
                  this.showParserModal = false;
                  this.loadCityList();
                  this.loadCityRoutes(this.selectedCity);
                  app.alerts.show({ type: 'success' }, res.message || 'Hatlar aktarıldı.');
                });
              }}
            >
              Hatları Aktar ({this.parsedPreviewRoutes.length})
            </Button>
          </div>
        </div>
      </div>
    );
  }

  renderEditRouteModal() {
    if (!this.editingRoute) return null;
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.6)', zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
      }}>
        <div style={{ background: '#fff', borderRadius: '12px', width: '500px', maxWidth: '95vw', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
            <h4 style={{ margin: 0, color: '#1e293b' }}>Hat Düzenle ({this.editingRoute.city})</h4>
            <button type="button" onclick={() => { this.editingRoute = null; m.redraw(); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="Form-group" style={{ marginBottom: '15px' }}>
              <label>Hat Kodu</label>
              <input
                className="FormControl"
                type="text"
                value={this.editingRoute.route_code}
                oninput={e => this.editingRoute.route_code = e.target.value}
              />
            </div>
            <div className="Form-group">
              <label>Hat Adı / Güzergah</label>
              <input
                className="FormControl"
                type="text"
                value={this.editingRoute.route_name}
                oninput={e => this.editingRoute.route_name = e.target.value}
              />
            </div>
          </div>
          <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc' }}>
            <Button className="Button" onclick={() => { this.editingRoute = null; m.redraw(); }}>İptal</Button>
            <Button className="Button Button--primary" loading={this.isUpdatingRoute} onclick={() => this.saveEditedRoute()}>Kaydet</Button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // --- 3. MEDYA YÖNETİMİ SEKMESİ ---
  // ==========================================
  renderMediaTab() {
    return (
      <div style={{ background: '#fff', padding: '25px', borderRadius: '10px', border: '1px solid #e5e5e5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3 style={{ color: '#1e88e5', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-images"></i>
              Tüm Medya Yönetimi
            </h3>
            <p className="helpText" style={{ margin: 0, color: '#666' }}>
              Forum genelinde yüklenmiş tüm fotoğrafları inceleyebilir, arama yapabilir ve silebilirsiniz.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              className="FormControl"
              type="text"
              placeholder="Dosya veya kullanıcı adı ile ara..."
              value={this.searchQueryAll}
              oninput={e => this.searchQueryAll = e.target.value}
              onkeydown={e => { if (e.key === 'Enter') { this.offsetAll = 0; this.loadImagesAll(); } }}
              style={{ width: '280px' }}
            />
            <Button
              className="Button Button--primary"
              onclick={() => { this.offsetAll = 0; this.loadImagesAll(); }}
            >
              <i className="fas fa-search"></i>
            </Button>
          </div>
        </div>

        {this.renderMediaGrid(this.imagesAll, this.isLoadingAll, false)}
        {this.renderMediaPagination(this.imagesAll.length, false)}

        <hr style={{ margin: '40px 0', border: 'none', borderTop: '1px solid #eee' }} />

        <div>
          <h3 style={{ color: '#e67e22', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-archive"></i>
            Orijinal (İmzasız) Medya Yedek Deposu
          </h3>
          <p className="helpText" style={{ marginBottom: '20px', color: '#666' }}>
            Burada yalnızca orijinal (imzasız) ham kopyası bulunan fotoğraflar listelenir. "Yedeği Sil" derseniz, forumdaki vitrin fotoğrafı bozulmadan yerinde kalır, sadece buluttaki ham yedek silinerek depolama alanı açılır.
          </p>

          {this.renderMediaGrid(this.originalsAll, this.isLoadingOrig, true)}
          {this.renderMediaPagination(this.originalsAll.length, true)}
        </div>
      </div>
    );
  }

  renderMediaGrid(list, loading, isOriginals) {
    if (loading) {
      return <div style={{ textAlign: 'center', padding: '40px' }}><LoadingIndicator /></div>;
    }
    if (!list || list.length === 0) {
      return <div style={{ textAlign: 'center', color: '#999', padding: '30px' }}>Kayıt bulunamadı.</div>;
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {list.map(image => {
          const thumbUrl = isOriginals && image.original_path
            ? image.original_path
            : (image.thumb_path || image.path);
          const fullUrl = image.original_path || image.path;
          const username = image.user ? image.user.username : 'Bilinmeyen Üye';

          return (
            <div style={{ background: '#fff', border: isOriginals ? '1px solid #f39c12' : '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '110px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderBottom: '1px solid #eee' }}>
                <a href={fullUrl} target="_blank" rel="noopener noreferrer" style={{ width: '100%', height: '100%' }}>
                  <img src={thumbUrl} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </a>
              </div>
              <div style={{ padding: '8px', fontSize: '11px', flexGrow: 1 }}>
                <div title={image.filename} style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '3px', color: '#1e293b' }}>
                  {image.filename}
                </div>
                <div style={{ color: '#64748b' }}>
                  <i className="fas fa-user" style={{ marginRight: '4px', fontSize: '10px' }}></i>
                  {username}
                </div>
              </div>
              <div style={{ padding: '6px', background: '#fafafa', borderTop: '1px solid #eee' }}>
                {isOriginals ? (
                  <Button
                    className="Button Button--block Button--small"
                    style={{ backgroundColor: '#e67e22', color: 'white', border: 'none', fontSize: '11px', fontWeight: 'bold' }}
                    onclick={() => this.deleteOriginalOnly(image)}
                  >
                    Yedeği Sil
                  </Button>
                ) : (
                  <Button
                    className="Button Button--danger Button--block Button--small"
                    icon="fas fa-trash-alt"
                    style={{ fontSize: '11px' }}
                    onclick={() => this.deleteImageCompletely(image)}
                  >
                    Tamamen Sil
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  renderMediaPagination(count, isOriginals) {
    const offset = isOriginals ? this.offsetOrig : this.offsetAll;
    const label = count > 0 ? `${offset + 1} - ${offset + count}` : '0';

    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center', padding: '10px 0 20px 0' }}>
        <Button
          className="Button"
          icon="fas fa-chevron-left"
          disabled={offset === 0}
          onclick={() => {
            if (isOriginals) {
              this.offsetOrig = Math.max(0, this.offsetOrig - this.limitAll);
              this.loadOriginalsAll();
            } else {
              this.offsetAll = Math.max(0, this.offsetAll - this.limitAll);
              this.loadImagesAll();
            }
          }}
        >
          Önceki
        </Button>
        <span style={{ fontWeight: 'bold', color: '#666', fontSize: '13px' }}>{label}</span>
        <Button
          className="Button"
          icon="fas fa-chevron-right"
          disabled={count < this.limitAll}
          onclick={() => {
            if (isOriginals) {
              this.offsetOrig += this.limitAll;
              this.loadOriginalsAll();
            } else {
              this.offsetAll += this.limitAll;
              this.loadImagesAll();
            }
          }}
        >
          Sonraki
        </Button>
      </div>
    );
  }

  deleteOriginalOnly(image) {
    if (!confirm(`Sadece orijinal yedeği silip forumdaki vitrin fotoğrafını korumak istiyor musunuz?`)) return;
    app.request({
      method: 'DELETE',
      url: app.forum.attribute('apiUrl') + '/framio-media/image/' + image.id,
      params: { target: 'original' }
    }).then(() => {
      this.originalsAll = this.originalsAll.filter(i => i.id !== image.id);
      app.alerts.show({ type: 'success' }, 'Orijinal yedek silindi, depolama alanı açıldı.');
      m.redraw();
    });
  }

  deleteImageCompletely(image) {
    if (!confirm(`"${image.filename}" dosyasını TAMAMEN silmek istediğinize emin misiniz? Forum gönderilerinde görsel görünmeyecektir.`)) return;
    app.request({
      method: 'DELETE',
      url: app.forum.attribute('apiUrl') + '/framio-media/image/' + image.id
    }).then(() => {
      this.imagesAll = this.imagesAll.filter(i => i.id !== image.id);
      this.originalsAll = this.originalsAll.filter(i => i.id !== image.id);
      app.alerts.show({ type: 'success' }, 'Görsel tamamen silindi.');
      m.redraw();
    });
  }
}




