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

    // Kişisel Vision AI Yapılandırması (Kullanıcı Tercihi)
    const allowUserKeys = app.forum.attribute('framio-upload-exif.allow_user_ai_keys') !== '0';
    if (allowUserKeys) {
      const userPrefs = this.user.preferences();
      const currentProvider = userPrefs.framio_personal_ai_provider || 'default';
      const defaultProvider = app.forum.attribute('framio-upload-exif.ai_provider') || 'gemini';
      const effectiveProvider = currentProvider === 'default' ? defaultProvider : currentProvider;
      const currentModel = userPrefs.framio_personal_ai_model || '';

      const aiConfig = {
        gemini: {
          name: 'Google Gemini',
          keyPlaceholder: 'AIzaSy...',
          defaultModel: 'gemini-3.7-flash',
          models: [
            { id: 'default', label: 'Varsayılan Önerilen (Gemini 3.7 Flash)' },
            { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (En Yeni Nesil / Ultra Hızlı & Zeki)' },
            { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash (Kararlı En Yeni Flash Sürümü)' },
            { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
            { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro (Derin Akıl Yürütme & Vision)' },
            { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
            { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
            { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
            { id: 'custom', label: 'Özel Model Adı Belirt...' }
          ]
        },
        openai: {
          name: 'OpenAI (ChatGPT / GPT-OSS)',
          keyPlaceholder: 'sk-proj-... / sk-...',
          defaultModel: 'gpt-4o-mini',
          models: [
            { id: 'default', label: 'Varsayılan Önerilen (GPT-4o-mini)' },
            { id: 'gpt-4o-mini', label: 'GPT-4o-mini (Hızlı & Ekonomik)' },
            { id: 'gpt-4o', label: 'GPT-4o (Amiral Gemisi Omni Vision)' },
            { id: 'gpt-4.5-preview', label: 'GPT-4.5 Preview (En Gelişmiş)' },
            { id: 'chatgpt-4o-latest', label: 'ChatGPT-4o Dynamic Latest' },
            { id: 'gpt-oss-120b', label: 'GPT-OSS 120B (Açık Ağırlıklı / Hızlı)' },
            { id: 'gpt-4-turbo', label: 'GPT-4 Turbo Vision' },
            { id: 'custom', label: 'Özel Model Adı Belirt...' }
          ]
        },
        grok: {
          name: 'xAI (Grok)',
          keyPlaceholder: 'xai-...',
          defaultModel: 'grok-2-vision-1212',
          models: [
            { id: 'default', label: 'Varsayılan Önerilen (Grok 2 Vision 1212)' },
            { id: 'grok-2-vision-1212', label: 'Grok 2 Vision (1212 - En Güncel Sürüm)' },
            { id: 'grok-2-vision', label: 'Grok 2 Vision (Standart)' },
            { id: 'grok-vision-beta', label: 'Grok Vision Beta' },
            { id: 'custom', label: 'Özel Model Adı Belirt...' }
          ]
        },
        claude: {
          name: 'Anthropic (Claude)',
          keyPlaceholder: 'sk-ant-...',
          defaultModel: 'claude-sonnet-4.6',
          models: [
            { id: 'default', label: 'Varsayılan Önerilen (Claude Sonnet 4.6 Thinking)' },
            { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6 Thinking (En Yeni Amiral Gemisi)' },
            { id: 'claude-opus-4.6', label: 'Claude Opus 4.6 Thinking (Maksimum Derin Analiz)' },
            { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (Hibrit Akıl Yürütme & Vision)' },
            { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
            { id: 'custom', label: 'Özel Model Adı Belirt...' }
          ]
        }
      };

      const provInfo = aiConfig[effectiveProvider] || aiConfig.gemini;
      const isCustomModel = currentModel === 'custom' || (currentModel && currentModel !== 'default' && !provInfo.models.some(m => m.id === currentModel));
      const selectedModelVal = isCustomModel ? 'custom' : (currentModel || 'default');

      items.add(
        'framio-personal-ai-settings',
        <div className="Form-group framio-personal-ai-group" style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-robot" style={{ color: '#6366f1' }}></i>
            Kişisel Vision AI (Otomatik Künye) Ayarları
          </h4>
          <p className="helpText" style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
            Fotoğraf yüklerken künye alanlarının (Marka, Model, Plaka, Firma, Şehir) anlık otomatik doldurulması için kendi yapay zeka sağlayıcınızı ve API anahtarınızı tanımlayabilirsiniz.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Yapay Zeka Sağlayıcısı</label>
              <select
                className="FormControl"
                style={{ fontSize: '13px' }}
                value={currentProvider}
                onchange={(e) => {
                  this.user.savePreferences({
                    framio_personal_ai_provider: e.target.value,
                    framio_personal_ai_model: 'default'
                  });
                }}
              >
                <option value="default">Forum Varsayılanı ({aiConfig[defaultProvider] ? aiConfig[defaultProvider].name : defaultProvider})</option>
                <option value="gemini">Google Gemini (Gemini 2.5 Flash / Pro, 2.0, 1.5)</option>
                <option value="openai">OpenAI ChatGPT (GPT-4o, GPT-4o-mini, GPT-4.5)</option>
                <option value="grok">xAI Grok (Grok-2-Vision, Grok-Beta)</option>
                <option value="claude">Anthropic Claude (Claude 3.7 Sonnet, 3.5 Sonnet, 3.5 Haiku)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Model Sürümü</label>
              <select
                className="FormControl"
                style={{ fontSize: '13px' }}
                value={selectedModelVal}
                onchange={(e) => {
                  const val = e.target.value;
                  this.user.savePreferences({
                    framio_personal_ai_model: val === 'custom' ? '' : val
                  });
                }}
              >
                {provInfo.models.map(m => (
                  <option value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedModelVal === 'custom' && (
            <div style={{ marginBottom: '10px', padding: '10px', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Özel Model Kimliği</label>
              <input
                type="text"
                className="FormControl"
                placeholder="Örn: gemini-2.5-pro, gpt-4o, claude-3-7-sonnet-20250219"
                value={currentModel === 'custom' ? '' : currentModel}
                onchange={(e) => {
                  this.user.savePreferences({ framio_personal_ai_model: e.target.value });
                }}
                style={{ fontSize: '13px' }}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Kişisel API Anahtarı</label>
            <input
              type="password"
              className="FormControl"
              placeholder={provInfo.keyPlaceholder}
              value={userPrefs.framio_personal_ai_key || ''}
              onchange={(e) => {
                this.user.savePreferences({ framio_personal_ai_key: e.target.value });
              }}
              style={{ fontSize: '13px' }}
            />
            <div className="helpText" style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
              Kendi API anahtarınızı tanımladığınızda analizler forum kotasından değil doğrudan sizin API hesabınızdan harcanır.
            </div>
          </div>
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
