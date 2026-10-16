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
  crosspostOnPublish();

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

    // Kişisel Vision AI: kullanıcı kendi anahtarını tanımlarsa ilk önce o denenir, site sağlayıcıları yedekte kalır
    const allowUserKeys = app.forum.attribute('framio-upload-exif.allow_user_ai_keys') !== '0';
    if (allowUserKeys) {
      const prefs = this.user.preferences();
      const provider = prefs.framio_personal_ai_provider || 'default';
      const PROV = {
        groq: ['Groq — en hızlı', 'gsk_...', 'https://console.groq.com/keys', ['qwen/qwen3.8-27b']],
        gemini: ['Google Gemini', 'AIzaSy...', 'https://aistudio.google.com/app/apikey', ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash']],
        openai: ['OpenAI ChatGPT', 'sk-...', 'https://platform.openai.com/api-keys', ['gpt-4o-mini', 'gpt-4.1-nano', 'gpt-4.1-mini', 'gpt-4o']],
        claude: ['Anthropic Claude', 'sk-ant-...', 'https://console.anthropic.com/settings/keys', ['claude-haiku-4-5', 'claude-haiku-5-5', 'claude-sonnet-5-5']],
        grok: ['xAI Grok', 'xai-...', 'https://console.x.ai', ['grok-2-vision-1212']],
      };
      const info = PROV[provider];
      const model = prefs.framio_personal_ai_model && prefs.framio_personal_ai_model !== 'default' ? prefs.framio_personal_ai_model : '';
      const label = { fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' };

      items.add(
        'framio-personal-ai-settings',
        <div className="Form-group framio-personal-ai-group" style={{ marginTop: '20px', padding: '16px', background: 'var(--control-bg)', borderRadius: '10px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-robot"></i> Kişisel Vision AI (otomatik künye)
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
