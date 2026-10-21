import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import TextEditor from 'flarum/common/components/TextEditor';
import UserPage from 'flarum/forum/components/UserPage';
import LinkButton from 'flarum/common/components/LinkButton';
import PostControls from 'flarum/forum/utils/PostControls';
import Button from 'flarum/common/components/Button';
import UploadButton from './components/UploadButton';
import GalleryButton from './components/GalleryButton';
import UserUploadsPage from './components/UserUploadsPage';
import SpotterImageManager from './components/SpotterImageManager';
import CustomizePostModal from './components/CustomizePostModal';
import Switch from 'flarum/common/components/Switch';
import SettingsPage from 'flarum/forum/components/SettingsPage';

import Page from 'flarum/common/components/Page';
import crosspostOnPublish from './crosspostOnPublish';
import live from './live';
import assistant, { assistantName } from './assistant/AssistantPanel';
import { canListen, wakeListener } from './assistant/speech';
import folder from './assistant/folder';
import drive from './assistant/drive';
import HeaderSecondary from 'flarum/forum/components/HeaderSecondary';
import { startTracker } from './insights/tracker';
import PostInsightsModal from './insights/PostInsightsModal';

// Mesaj görselleri inince yumuşakça belirsin (yer önceden ayrılır: bkz. AddImageDimensions)
if (typeof document !== 'undefined') {
  const markLoaded = (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.classList && t.classList.contains('spotter-lazy')) t.classList.add('is-loaded');
  };
  document.addEventListener('load', markLoaded, true);
  document.addEventListener('error', markLoaded, true);

  // Önbellekten gelen (load olayı betikten önce biten) görseller görünmez kalmasın
  const markComplete = (root) => {
    if (!root || !root.querySelectorAll) return;
    const list = root.matches && root.matches('img.spotter-lazy') ? [root] : root.querySelectorAll('img.spotter-lazy:not(.is-loaded)');
    list.forEach((img) => { if (img.complete) img.classList.add('is-loaded'); });
  };
  const start = () => {
    markComplete(document);
    new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach(markComplete))).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
}

app.initializers.add('framio/upload-exif', () => {
  // Gönderi istatistikleri: ziyaretçi davranışı toplanır, 3 nokta menüsünden yalnızca yöneticiler görür
  setTimeout(startTracker, 0);
  extend(PostControls, 'moderationControls', function (items, post) {
    if (!app.session.user || !app.session.user.isAdmin() || !post || post.contentType() !== 'comment') return;
    items.add('framio-insights', <Button icon="fas fa-chart-bar" onclick={() => app.modal.show(PostInsightsModal, { post })}>Gönderi İstatistikleri</Button>, 90);
  });
  crosspostOnPublish();
  // Canlı güncelleme: yeni sürümde sekme yenilenir, yeni mesajlar akışa eklenir / bildirilir
  setTimeout(live, 1500);

  // Yönetici "Üye adına paylaş" seçtiyse (imza penceresinde) konu/yanıt o üye adına gönderilir.
  // Sunucu yalnızca yöneticilerden gelen framioPostAs alanını dikkate alır (PostAsHandler).
  ['flarum/forum/components/ReplyComposer', 'flarum/forum/components/DiscussionComposer'].forEach((name) => {
    extend(name, 'data', function (data) {
      const postAs = this.attrs.framioPostAs;
      if (postAs && app.session.user && app.session.user.isAdmin()) data.framioPostAs = Number(postAs.id);
    });

    extend(name, 'headerItems', function (items) {
      const postAs = this.attrs.framioPostAs;
      if (!postAs) return;
      items.add(
        'framioPostAs',
        <span className="FramioPostAsBadge" title="Bu paylaşım seçilen üye adına yapılacak">
          <i className="fas fa-user-secret" aria-hidden="true"></i> @{postAs.username} adına
          <button
            type="button"
            aria-label="Üye adına paylaşımı iptal et"
            onclick={() => {
              delete this.attrs.framioPostAs;
              m.redraw();
            }}
          >
            <i className="fas fa-times" aria-hidden="true"></i>
          </button>
        </span>,
        100
      );
    });
  });

  extend(Page.prototype, 'oninit', function() {
    if (app.forum) {
      const theme = app.forum.attribute('framio-upload-exif.kunye_theme') || 'classic';
      document.body.classList.add('framio-kunye-global-theme-' + theme);
    }
  });

  // 1. ROTA TANIMLA (/u/kullaniciadi/uploads)
  app.routes['user.uploads'] = { path: '/u/:username/uploads', component: UserUploadsPage };

  // 2. EDİTÖR BUTONLARI
  extend(TextEditor.prototype, 'toolbarItems', function(items) {
    items.add('framio-media-upload', <UploadButton editor={this} />, 102);
    items.add('framio-media-gallery', <GalleryButton editor={this} />, 101);
    // Framio Asistan: yükleme ve galeri düğmelerinden hemen sonra (admin "araç çubuğu" seçtiyse)
    if (app.session.user && app.forum.attribute('framioAssistantEnabled') !== false && launcher().includes('toolbar')) {
      items.add(
        'framio-assistant',
        <Button className="Button Button--icon Button--link FramioAssistant-toolbar" icon="fas fa-magic" title={assistantName()} aria-label={assistantName()} onclick={() => assistant.toggle()} />,
        100
      );
    }
  });

  // Framio Asistan başlatıcısı: sağ altta yuvarlak düğme (canlı destek gibi) ve/veya başlık menüsü
  const launcher = () => String(app.forum.attribute('framioAssistantLauncher') || 'fab');
  const mountFab = () => {
    if (document.querySelector('.FramioAssistant-fab') || !app.session.user || app.forum.attribute('framioAssistantEnabled') === false || !launcher().includes('fab')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'FramioAssistant-fab is-' + (app.forum.attribute('framioAssistantPosition') || 'right');
    b.setAttribute('aria-label', assistantName());
    b.title = assistantName();
    b.innerHTML = '<i class="fas fa-magic" aria-hidden="true"></i>';
    b.onclick = () => {
      b.classList.remove('has-notice');
      assistant.toggle();
    };
    document.body.appendChild(b);
    // Planlı paylaşım haberi gibi okunmamış not varsa düğmede işaret
    app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/framio-assistant/history?limit=1' })
      .then((r) => r.unseen && b.classList.add('has-notice'))
      .catch(() => {});
  };
  extend(Page.prototype, 'oncreate', mountFab);
  extend(HeaderSecondary.prototype, 'items', function (items) {
    if (!app.session.user || app.forum.attribute('framioAssistantEnabled') === false || !launcher().includes('header')) return;
    items.add(
      'framio-assistant',
      <Button className="Button Button--flat Button--icon FramioAssistant-headerBtn" icon="fas fa-magic" aria-label={assistantName()} title={assistantName()} onclick={() => assistant.toggle()} />,
      15
    );
  });

  // Framio Asistan: uyandırma sözü (sitenin gizli sözü + kişinin kendi sözü), sayfa açıkken dinler
  const startWake = () => {
    if (assistant.wake || !app.session.user || app.forum.attribute('framioAssistantEnabled') === false || !canListen()) return;
    const prefs = app.session.user.preferences() || {};
    if (!prefs.framio_assistant_listen) return;
    const phrases = [app.forum.attribute('framioAssistantWake'), prefs.framio_assistant_wake, prefs.framio_assistant_name ? 'hey ' + prefs.framio_assistant_name : ''].filter(Boolean);
    if (!phrases.length) return;
    // Uyandırma sözünden sonra cümlenin tamamı beklenir (konuşma bitmeden işlem yapılmaz)
    assistant.wake = wakeListener(phrases, (rest) => assistant.open(rest || null, { listen: true }));
  };
  extend(Page.prototype, 'oncreate', startWake);

  // PWA kısayolu ya da bağlantı: /?asistan=1 asistanı açar
  extend(Page.prototype, 'oncreate', function () {
    if (/[?&]asistan=1\b/.test(window.location.search) && !assistant.el) assistant.open();
  });

  // 3. PROFİL SAYFASI MENÜSÜNE EKLE
  extend(UserPage.prototype, 'navItems', function(items) {
    const user = this.user;
    items.add(
      'uploads',
      <LinkButton
        href={app.route('user.uploads', { username: user.slug() })}
        icon="fas fa-camera"
      >
        Kullanıcı Medyası
      </LinkButton>,
      10
    );
  });

  // 4. KULLANICI AYARLARI EKRANI (CAROUSEL & KİŞİSEL AI TERCİHLERİ)
  extend('flarum/forum/components/SettingsPage', 'settingsItems', function(items) {
    const adminEnabled = app.forum.attribute('framio-upload-exif.enable_carousel_mode') === '1' || app.forum.attribute('framio-upload-exif.enable_carousel_mode') === true;

    if (adminEnabled) {
      items.add(
        'framio-carousel-preference',
        <Switch
          state={this.user.preferences().framio_carousel_enabled !== false}
          onchange={(value) => {
            this.user.savePreferences({ framio_carousel_enabled: value });
          }}
        >
          Gönderilerde birden fazla fotoğrafı kaydırmalı (carousel) olarak göster
        </Switch>,
        10
      );
    }

    // Kişisel asistan: adı, uyandırma sözü, sesli yanıt, öğrenip otomatik paylaşma, varsayılan imza
    if (app.forum.attribute('framioAssistantEnabled') !== false) {
      const prefs = this.user.preferences();
      const save = (data) => this.user.savePreferences(data).then(() => m.redraw());
      const label = { fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' };
      if (!this.framioFolderLoaded) {
        this.framioFolderLoaded = true;
        folder.load().then(() => m.redraw());
      }
      if (!this.framioWatermarks) {
        this.framioWatermarks = [];
        app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/framio-media/watermarks' })
          .then((res) => {
            this.framioWatermarks = res.watermarks || [];
            m.redraw();
          })
          .catch(() => {});
      }

      items.add(
        'framio-assistant-settings',
        <div className="Form-group FramioAssistant-settings">
          <h4>
            <i className="fas fa-magic"></i> Kişisel asistanım
          </h4>
          <p className="helpText">
            Sesli ya da yazılı komutla bağlı klasörünüzdeki fotoğrafı bulur, künyesini çıkarır ve uygun başlığa paylaşır. Paylaşmadan önce onay ister; aynı modeli aynı başlığa birkaç kez
            onayladığınızda o başlığı öğrenir.
          </p>
          <div className="FramioAssistant-settingsGrid">
            <div>
              <label style={label}>Asistanın adı</label>
              <input className="FormControl" placeholder="ör. Jarvis" value={prefs.framio_assistant_name || ''} onchange={(e) => save({ framio_assistant_name: e.target.value.trim() })} />
            </div>
            <div>
              <label style={label}>Uyandırma sözü</label>
              <input
                className="FormControl"
                placeholder={prefs.framio_assistant_name ? 'Hey ' + prefs.framio_assistant_name : 'ör. Hey Jarvis'}
                value={prefs.framio_assistant_wake || ''}
                onchange={(e) => save({ framio_assistant_wake: e.target.value.trim() })}
              />
            </div>
            <div>
              <label style={label}>Paylaşırken kullanılacak imza</label>
              <select className="FormControl" value={prefs.framio_assistant_watermark || 'none'} onchange={(e) => save({ framio_assistant_watermark: e.target.value })}>
                <option value="none">İmzasız</option>
                {(this.framioWatermarks || []).map((w) => (
                  <option value={w.id || w.filename || w.name}>{w.name || w.label || w.filename}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Klasör arama derinliği</label>
              <select className="FormControl" value={String(prefs.framio_assistant_depth ?? 2)} onchange={(e) => save({ framio_assistant_depth: Number(e.target.value) })}>
                <option value="0">Yalnızca seçtiğim klasör</option>
                <option value="1">1 alt klasöre kadar</option>
                <option value="2">2 alt klasöre kadar</option>
                <option value="6">Tüm alt klasörler</option>
              </select>
            </div>
          </div>

          <div className="FramioAssistant-sourceList">
            <label style={label}>Fotoğraf kaynakları (yalnızca okuma — asistan silemez, değiştiremez)</label>
            {(folder.list || []).map((f) => (
              <div className="FramioAssistant-sourceRow" key={f.id}>
                <i className="far fa-folder"></i>
                <span className="FramioAssistant-sourceName">{f.label}</span>
                <Switch state={f.enabled} onchange={(v) => folder.toggle(f.id, v).then(() => m.redraw())}>
                  {f.enabled ? 'Açık' : 'Kapalı'}
                </Switch>
                <Button className="Button Button--icon Button--link" icon="far fa-trash-alt" aria-label="Kaldır" onclick={() => folder.remove(f.id).then(() => m.redraw())} />
              </div>
            ))}
            {drive.folders().map((f) => (
              <div className="FramioAssistant-sourceRow" key={f.id}>
                <i className="fab fa-google-drive"></i>
                <span className="FramioAssistant-sourceName">Drive: {f.name}</span>
                <Switch state={f.enabled} onchange={(v) => { drive.toggle(f.id, v); m.redraw(); }}>
                  {f.enabled ? 'Açık' : 'Kapalı'}
                </Switch>
                <Button className="Button Button--icon Button--link" icon="far fa-trash-alt" aria-label="Kaldır" onclick={() => { drive.remove(f.id); m.redraw(); }} />
              </div>
            ))}
            <div className="FramioAssistant-sourceAdd">
              <Button className="Button" icon="far fa-folder-open" disabled={!folder.supported()} onclick={() => folder.link().then(() => m.redraw()).catch(() => {})}>
                Bilgisayardan klasör ekle
              </Button>
              {drive.available() ? (
                <Button className="Button" icon="fab fa-google-drive" onclick={() => drive.pickFolders().then(() => m.redraw()).catch((e) => app.alerts.show({ type: 'error' }, e.message))}>
                  Google Drive klasörü ekle
                </Button>
              ) : null}
              {drive.connected() ? (
                <Button className="Button Button--link" icon="fas fa-unlink" onclick={() => drive.disconnect().then(() => m.redraw())}>
                  Drive bağlantısını kaldır
                </Button>
              ) : null}
            </div>
            {!folder.supported() ? <p className="helpText">Bu tarayıcı bilgisayardaki klasörlere erişimi desteklemiyor (Chrome ya da Edge gerekir).</p> : null}
            <p className="helpText">
              Tarayıcılar bir sitenin bilgisayarın tamamına erişmesine izin vermez; en geniş erişim için üst klasörü (ör. Resimler) ekleyip "Tüm alt klasörler"i seçin.
            </p>
          </div>
          {canListen() ? (
            <Switch
              state={!!prefs.framio_assistant_listen}
              onchange={(v) => {
                save({ framio_assistant_listen: v });
                if (v) {
                  // İlk açılışta tarayıcı mikrofon izni ister
                  navigator.mediaDevices && navigator.mediaDevices.getUserMedia({ audio: true }).then((st) => st.getTracks().forEach((t) => t.stop())).catch(() => {});
                } else if (assistant.wake) {
                  assistant.wake.stop();
                  assistant.wake = null;
                }
              }}
            >
              Sayfa açıkken uyandırma sözümü dinle
            </Switch>
          ) : (
            <p className="helpText">Bu tarayıcı ses tanımayı desteklemiyor; yazılı komut kullanılabilir.</p>
          )}
          <Switch state={prefs.framio_assistant_speak !== false} onchange={(v) => save({ framio_assistant_speak: v })}>
            Yanıtları sesli oku
          </Switch>
          <Switch
            state={prefs.framio_assistant_show_actions === undefined || prefs.framio_assistant_show_actions === null ? app.forum.attribute('framioAssistantShowActions') !== false : !!prefs.framio_assistant_show_actions}
            onchange={(v) => save({ framio_assistant_show_actions: v })}
          >
            Yaptıklarını ekranda göster (imleç tıklamaları ve alanların doldurulması)
          </Switch>
          <Switch state={prefs.framio_assistant_auto !== false} onchange={(v) => save({ framio_assistant_auto: v })}>
            Öğrendiği başlıklara kısa bir geri sayımla kendisi paylaşsın
          </Switch>
          <Button
            className="Button Button--link"
            icon="fas fa-eraser"
            onclick={() => {
              if (!confirm('Asistanın öğrendiği tüm başlık tercihleri silinsin mi?')) return;
              app.request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/framio-assistant/forget' }).then((r) => app.alerts.show({ type: 'success' }, r.removed + ' öğrenilmiş tercih silindi.'));
            }}
          >
            Öğrendiklerini sıfırla
          </Button>
        </div>,
        8
      );
    }

    // Kişisel Framio AI: kullanıcı kendi anahtarını tanımlarsa ilk önce o denenir, site sağlayıcıları yedekte kalır
    const allowUserKeys = app.forum.attribute('framio-upload-exif.allow_user_ai_keys') !== '0';
    if (allowUserKeys) {
      const prefs = this.user.preferences();
      const provider = prefs.framio_personal_ai_provider || 'default';
      const PROV = {
        gemini: ['Google Gemini — ücretsiz katman', 'AIza...', 'https://aistudio.google.com/app/apikey', ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash']],
        groq: ['Groq — ücretsiz, çok hızlı', 'gsk_...', 'https://console.groq.com/keys', ['qwen/qwen3.8-27b']],
        nvidia: ['NVIDIA NIM — ücretsiz', 'nvapi-...', 'https://build.nvidia.com/settings/api-keys', ['google/gemma-4-31b-it', 'nvidia/nemotron-3.5-super-vl-120b-a12b']],
        openrouter: ['OpenRouter — ücretsiz modeller', 'sk-or-...', 'https://openrouter.ai/settings/keys', ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3.5-super-vl:free']],
        openai: ['OpenAI ChatGPT', 'sk-...', 'https://platform.openai.com/api-keys', ['gpt-6-luna', 'gpt-6.1-sol']],
        claude: ['Anthropic Claude', 'sk-ant-...', 'https://platform.claude.com/settings/keys', ['claude-haiku-5-5', 'claude-sonnet-5-5']],
        grok: ['xAI Grok', 'xai-...', 'https://console.x.ai', ['grok-4.7']],
      };
      const info = PROV[provider];
      const model = prefs.framio_personal_ai_model && prefs.framio_personal_ai_model !== 'default' ? prefs.framio_personal_ai_model : '';
      const label = { fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' };

      items.add(
        'framio-personal-ai-settings',
        <div className="Form-group framio-personal-ai-group" style={{ marginTop: '20px', padding: '16px', background: 'var(--control-bg)', borderRadius: '10px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-robot" style={{ color: 'var(--primary-color)' }}></i> Kişisel Framio AI (otomatik künye)
          </h4>
          <p className="helpText" style={{ fontSize: '12px', marginBottom: '12px' }}>
            İsterseniz kendi yapay zeka anahtarınızı tanımlayın: künye önce sizin hesabınızla doldurulur, olmazsa forumun sağlayıcıları devreye girer.
          </p>

          <label style={label}>Sağlayıcı</label>
          <select
            className="FormControl"
            value={provider}
            onchange={(e) => this.user.savePreferences({ framio_personal_ai_provider: e.target.value, framio_personal_ai_model: '' })}
          >
            <option value="default">Kullanma — forumun ayarı yeterli</option>
            {Object.keys(PROV).map((k) => (
              <option value={k}>{PROV[k][0]}</option>
            ))}
          </select>

          {info ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
              <div>
                <label style={label}>Model (boş = önerilen)</label>
                <input
                  className="FormControl"
                  list="framio-personal-ai-models"
                  placeholder={info[3][0]}
                  value={model}
                  onchange={(e) => this.user.savePreferences({ framio_personal_ai_model: e.target.value.trim() })}
                />
                <datalist id="framio-personal-ai-models">
                  {info[3].map((id) => (
                    <option value={id}></option>
                  ))}
                </datalist>
              </div>
              <div>
                <label style={label}>API anahtarı</label>
                <input
                  type="password"
                  autocomplete="off"
                  className="FormControl"
                  placeholder={info[1]}
                  value={prefs.framio_personal_ai_key || ''}
                  onchange={(e) => this.user.savePreferences({ framio_personal_ai_key: e.target.value.trim() })}
                />
                <a href={info[2]} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px' }}>
                  Anahtar al <i className="fas fa-external-link-alt"></i>
                </a>
              </div>
            </div>
          ) : null}
        </div>,
        9
      );
    }
  });

  // 5. GÖNDERİ 3 NOKTA AÇILIR MENÜSÜNE (PostControls) "Gönderiyi Özelleştir" EKLE
  extend(PostControls, 'moderationControls', function(items, post) {
    if (!app.session.user || !post) return;

    const isAdmin = app.session.user.isAdmin();
    const isOwner = isAdmin || (post.user && Number(app.session.user.id()) === Number(post.user().id()));
    if (!isOwner) return;

    const contentHtml = post.contentHtml() || '';
    if (!contentHtml.includes('framio-image-container') && !contentHtml.includes('ulasimarsiv-image-container') && !contentHtml.includes('spotter-image-container')) return;

    items.add(
      'framio-media-customize',
      <Button
        icon="fas fa-sliders-h"
        onclick={(e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }

          const postEl = document.querySelector(`.Post[data-id="${post.id()}"]`);
          let imageIds = [];
          if (postEl) {
            const containers = postEl.querySelectorAll('.framio-image-container, .ulasimarsiv-image-container, .spotter-image-container');
            imageIds = Array.from(containers)
              .map(el => el.getAttribute('data-id'))
              .filter(Boolean);
          }

          if (imageIds.length === 0) {
            const regex = /(?:framio-image-container|ulasimarsiv-image-container|spotter-image-container)[^>]*data-id="(\d+)"/g;
            let match;
            while ((match = regex.exec(contentHtml)) !== null) {
              imageIds.push(match[1]);
            }
          }

          if (imageIds.length === 0) return;

          const { cardRegistry } = SpotterImageManager;
          const firstCard = cardRegistry ? cardRegistry.get(String(imageIds[0])) : null;

          if (firstCard && firstCard.data) {
            firstCard.openCustomizeModal(null, imageIds);
          } else {
            app.modal.show(CustomizePostModal, {
              music: null,
              gps: null,
              initialGps: null,
              onconfirm: (customData) => {
                app.request({
                  method: 'PATCH',
                  url: app.forum.attribute('apiUrl') + '/framio-media/image/' + imageIds.join(',') + '/custom-data',
                  body: {
                    custom_music: customData.music,
                    custom_gps: customData.gps
                  }
                }).then(res => {
                  if (cardRegistry) {
                    imageIds.forEach(id => {
                      const card = cardRegistry.get(String(id));
                      if (card) {
                        card.data = {
                          ...card.data,
                          music_data: res.music_data,
                          exif_data: typeof res.exif_data === 'string' ? res.exif_data : JSON.stringify(res.exif_data)
                        };
                      }
                    });
                  }
                  app.alerts.show({ type: 'success' }, 'Gönderi özelleştirmeleri güncellendi.');
                  m.redraw();
                }).catch(err => {
                  console.error(err);
                  app.alerts.show({ type: 'error' }, 'Güncelleme sırasında bir hata oluştu.');
                });
              }
            });
          }
        }}
      >
        Gönderiyi Özelleştir
      </Button>,
      -50
    );
  });

  SpotterImageManager.init();
  window.FramioImageManager = SpotterImageManager;
});
