import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import Button from 'flarum/common/components/Button';
import saveSettings from 'flarum/admin/utils/saveSettings';
import app from 'flarum/admin/app';
import EditQueueModal from './EditQueueModal';

export default class SocialShareSettingsPage extends ExtensionPage {
  oninit(vnode) {
    super.oninit(vnode);
    this.activeTab = 'accounts';
    this.queue = [];
    this.queueLoading = false;
    this.queueLoaded = false;

    // Story Archive State
    this.storyArchive = [];
    this.storyArchiveLoading = false;
    this.storyArchiveLoaded = false;

    // Meta Business Suite State
    this.businessAccountIndex = 0;
    this.businessLoading = false;
    this.businessLoaded = false;
    this.businessProfile = null;
    this.businessInsights = null;
    this.businessMediaList = [];
    this.businessActiveSubTab = 'overview'; // 'overview' | 'media' | 'inbox' | 'story_publish'
    this.selectedMediaForComments = null;
    this.businessComments = [];
    this.businessCommentsLoading = false;
    this.businessConversations = [];
    this.businessConversationsLoading = false;
    this.selectedConversation = null;
    this.conversationMessages = [];
    this.conversationMessagesLoading = false;
    this.replyTextMap = {};
    this.storyPublishUrl = '';
    this.storyPublishing = false;
    this.storyScheduleEnabled = false;
    this.storyScheduleDate = '';
    this.storyScheduleHour = '20';
    this.storyScheduleMinute = '00';
    this.businessPlatform = 'instagram'; // 'instagram' | 'facebook'
    this.businessFbProfile = null;
    this.businessFbInsights = null;
    this.businessFbFeed = [];
    this.businessFbConversations = [];
    this.businessFbActiveSubTab = 'overview'; // 'overview' | 'media' | 'inbox' | 'story_publish'
    this.selectedFbMediaForComments = null;
    this.businessFbComments = [];
    this.businessFbCommentsLoading = false;
    this.fbReplyTextMap = {};
    this.selectedFbConversation = null;
    this.businessFbConversationMessages = [];
    this.businessFbConversationMessagesLoading = false;
    this.fbStoryPublishUrl = '';
    this.fbStoryPublishing = false;
    this.fbStoryScheduleEnabled = false;
    this.fbStoryScheduleDate = '';
    this.fbStoryScheduleHour = '20';
    this.fbStoryScheduleMinute = '00';

    // Threads State
    this.businessThreadsProfile = null;
    this.businessThreadsInsights = null;
    this.businessThreadsFeed = [];
    try {
        const accountsJson = this.setting('framio-social-share.accounts_json')() || '[]';
        try {
            this.accounts = JSON.parse(accountsJson);
        } catch(e) {
            this.accounts = [];
        }

        this.defaultAccountIndex = this.setting('framio-social-share.default_account_index')() || "0";
        this.postTemplate = this.setting('framio-social-share.post_template')() || "📸 {title}\n\n{text}\n\n{smart_tags}";
        this.geminiApiKey = this.setting('framio-social-share.gemini_api_key')() || '';
        this.groqApiKey = this.setting('framio-social-share.groq_api_key')() || '';
        this.openrouterApiKey = this.setting('framio-social-share.openrouter_api_key')() || '';
        this.tavilyApiKey = this.setting('framio-social-share.tavily_api_key')() || '';
        
        this.allowedShareUsers = this.setting('framio-social-share.allowed_share_users')() || '';
        this.allowedStoryUsers = this.setting('framio-social-share.allowed_story_users')() || '';
        this.allowedStoryPublishUsers = this.setting('framio-social-share.allowed_story_publish_users')() || '';
        this.userInstagramMap = this.setting('framio-social-share.user_instagram_map')() || 'alikaankaya: @spottersturkeycom';
        this.userNameMap = this.setting('framio-social-share.user_name_map')() || 'emircandadas: Emircan DADAŞ\nalikaankaya: Ali Kaan KAYA';
        
        this.canvaClientId = this.setting('framio-social-share.canva_client_id')() || '';
        this.canvaClientSecret = this.setting('framio-social-share.canva_client_secret')() || '';
        this.canvaTeamUsers = this.setting('framio-social-share.canva_team_users')() || 'alikaankaya, ulasimarsiv, spottersturkey';
        
        this.canvaBrandClientId = this.setting('framio-social-share.canva_brand_client_id')() || '';
        this.canvaBrandClientSecret = this.setting('framio-social-share.canva_brand_client_secret')() || '';
        this.canvaBrandUsers = this.setting('framio-social-share.canva_brand_users')() || '*';
        this.canvaBrandProfile = this.setting('framio-social-share.canva_brand_profile')() || '';
        
        this.canvaTemplateLinks = this.setting('framio-social-share.canva_template_links')() || '';

        const defaultBgs = [
            { id: "bg1", name: "Ulaşım Arşiv Koyu Yeşil (Statik)", type: "image", url: "/assets/backgrounds/ua_green.png", textColor: "#ffffff" },
            { id: "bg2", name: "Ulaşım Arşiv Beyaz (Statik)", type: "image", url: "/assets/backgrounds/ua_white.png", textColor: "#111111" },
            { id: "bg3", name: "Ulaşım Arşiv Hareketli Yeşil (Video)", type: "video", url: "/assets/backgrounds/ua_video_green.mp4", textColor: "#ffffff" }
        ];
        const storyBgJson = this.setting('framio-social-share.story_backgrounds_json')();
        try {
            if (storyBgJson !== undefined && storyBgJson !== null && String(storyBgJson).trim() !== '') {
                const parsed = JSON.parse(storyBgJson);
                this.storyBackgrounds = Array.isArray(parsed) ? parsed : defaultBgs;
            } else {
                this.storyBackgrounds = defaultBgs;
            }
        } catch(e) {
            this.storyBackgrounds = defaultBgs;
        }
    } catch(err) {
        console.error("SocialShareSettingsPage oninit error:", err);
        this.accounts = [];
        this.defaultAccountIndex = "0";
        this.autoShareEnabled = false;
        this.autoShareTags = "[]";
        this.postTemplate = "";
        this.storyBackgrounds = [];
        this.allowedShareUsers = "";
        this.allowedStoryUsers = "";
        this.allowedStoryPublishUsers = "";
        this.userInstagramMap = "";
        this.userNameMap = "";
        this.canvaClientId = "";
        this.canvaClientSecret = "";
        this.canvaTeamUsers = "alikaankaya, ulasimarsiv, spottersturkey";
        this.canvaBrandClientId = "";
        this.canvaBrandClientSecret = "";
        this.canvaBrandUsers = "*";
        this.canvaBrandProfile = "";
        this.canvaTemplateLinks = "";
        this.initError = err.toString();
    }
  }

  content() {
    if (this.initError) {
        return <div className="ExtensionPage-settings"><div className="container"><h2>Hata Oluştu</h2><p>{this.initError}</p></div></div>;
    }
    try {
      return (
      <div className="ExtensionPage-settings">
        <div className="container">
          <div className="Framio-Tabs-Container" style={{ marginBottom: '30px', marginTop: '20px' }}>
              <div className="Framio-Tab-Buttons" style={{
                  display: 'flex',
                  gap: '8px',
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '12px',
                  marginBottom: '24px',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'thin',
                  msOverflowStyle: 'none'
              }}>
                  {[
                      { id: 'accounts', label: 'Hesaplar', icon: 'fas fa-sliders-h' },
                      { id: 'format', label: 'Şablon & Yapay Zeka', icon: 'fas fa-robot' },
                      { id: 'story_bg', label: 'Hikaye Şablonları & Arşiv', icon: 'fas fa-photo-video', onClick: () => { if(!this.storyArchiveLoaded) this.loadStoryArchive(); } },
                      { id: 'canva', label: '🎨 Canva Pro', icon: 'fas fa-pen-nib' },
                      { id: 'permissions', label: 'Kullanıcı İzinleri', icon: 'fas fa-shield-alt' },
                      { id: 'queue', label: 'Planlanmış Gönderiler', icon: 'fas fa-calendar-alt', onClick: () => { if(!this.queueLoaded) this.loadQueue(); } },
                      { id: 'business', label: '📊 Meta Business Suite', icon: 'fab fa-facebook', isSpecial: true, onClick: () => { if(!this.businessLoaded) this.loadBusinessData(); } },
                  ].map(tab => {
                      const isActive = this.activeTab === tab.id;
                      let btnStyle = {
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '13px',
                          fontWeight: isActive ? '600' : '500',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: '1px solid',
                          outline: 'none'
                      };

                      if (tab.isSpecial) {
                          if (isActive) {
                              btnStyle.background = 'linear-gradient(135deg, #0081fb 0%, #0064e0 100%)';
                              btnStyle.color = '#ffffff';
                              btnStyle.borderColor = '#0064e0';
                              btnStyle.boxShadow = '0 2px 8px rgba(0, 100, 224, 0.35)';
                          } else {
                              btnStyle.background = '#f0f7ff';
                              btnStyle.color = '#0064e0';
                              btnStyle.borderColor = '#bae6fd';
                          }
                      } else {
                          if (isActive) {
                              btnStyle.background = '#4f46e5';
                              btnStyle.color = '#ffffff';
                              btnStyle.borderColor = '#4f46e5';
                              btnStyle.boxShadow = '0 2px 6px rgba(79, 70, 229, 0.25)';
                          } else {
                              btnStyle.background = '#f8fafc';
                              btnStyle.color = '#475569';
                              btnStyle.borderColor = '#e2e8f0';
                          }
                      }

                      return (
                          <button
                              type="button"
                              className={`Button Framio-Tab-Pill ${isActive ? 'active' : ''}`}
                              style={btnStyle}
                              onclick={() => {
                                  this.activeTab = tab.id;
                                  if (tab.onClick) tab.onClick();
                              }}
                          >
                              <i className={tab.icon} style={{ fontSize: '13px', opacity: isActive ? 1 : 0.85 }}></i>
                              <span>{tab.label}</span>
                          </button>
                      );
                  })}
              </div>
              <div className="Framio-Tab-Content">
                  {this.activeTab === 'accounts' && this.renderAccounts()}
                  {this.activeTab === 'format' && this.renderFormatAndAi()}
                  {this.activeTab === 'story_bg' && this.renderStoryBackgrounds()}
                  {this.activeTab === 'canva' && this.renderCanvaSettings()}
                  {this.activeTab === 'permissions' && this.renderPermissionsTab()}
                  {this.activeTab === 'queue' && this.renderQueue()}
                  {this.activeTab === 'business' && this.renderBusinessSuite()}
              </div>
          </div>
          <div className="Form-group">
            <Button className="Button Button--primary" loading={this.loading} onclick={this.saveCustomSettings.bind(this)}>
              Ayarları Kaydet
            </Button>
          </div>
        </div>
      </div>
      );
    } catch(err) {
        console.error("SocialShareSettingsPage content error:", err);
        return <div className="ExtensionPage-settings"><div className="container"><h2>Render Hatası</h2><p>{err.toString()}</p></div></div>;
    }
  }

  loadQueue() {
      this.queueLoading = true;
      app.request({
          method: 'GET',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/queue'
      }).then(response => {
          this.queue = response;
          this.queueLoading = false;
          this.queueLoaded = true;
          m.redraw();
      }).catch(err => {
          this.queueLoading = false;
          app.alerts.show({ type: 'error' }, 'Kuyruk yüklenemedi: ' + err.toString());
          m.redraw();
      });
  }

  getGroupedQueue() {
      if (!this.queue || this.queue.length === 0) return [];

      const groups = {};
      this.queue.forEach(item => {
          const groupId = item.group_id || item.id;
          if (!groups[groupId]) {
              groups[groupId] = {
                  id: groupId,
                  scheduled_at: item.scheduled_at,
                  status: item.status,
                  images: (item.payload && item.payload.images) || [],
                  platforms: {},
                  items: []
              };
          }

          const platform = (item.payload && item.payload.platform) || item.platform || 'facebook';
          groups[groupId].platforms[platform] = item;
          groups[groupId].items.push(item);
          
          if (!groups[groupId].images.length && item.payload && item.payload.images) {
              groups[groupId].images = item.payload.images;
          }
          if (item.status === 'error' || item.status === 'failed') {
              groups[groupId].status = item.status;
          }
      });

      return Object.values(groups);
  }

  updateQueueGroup(params) {
      const { items, action, messages, scheduled_at, images } = params;
      this.queueLoading = true;

      const firstItem = items[0];
      const payload = {
          id: firstItem.id,
          group_id: firstItem.group_id,
          action: action,
          scheduled_at: scheduled_at,
          images: images
      };

      if (action === 'update' && messages) {
          payload.messages = messages;
      }

      return app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/queue/update',
          body: payload
      }).then(res => {
          app.alerts.show({ type: 'success' }, res.message || 'İşlem başarılı');
          this.loadQueue();
      }).catch(err => {
          this.queueLoading = false;
          app.alerts.show({ type: 'error' }, 'Hata oluştu: ' + (err.message || err.toString()));
          m.redraw();
      });
  }

  renderQueue() {
      const grouped = this.getGroupedQueue();

      return (
          <div className="Framio-Queue-Settings">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#1f2937', fontSize: '20px', fontWeight: 'bold' }}><i className="fas fa-calendar-alt" style={{ color: '#6366f1', marginRight: '8px' }}></i> Planlanmış Gönderiler (Kuyruk)</h2>
                    <p className="helpText" style={{ margin: '5px 0 0 0', color: '#6b7280' }}>İleri bir tarihe planlanmış veya kuyrukta bekleyen gönderiler.</p>
                </div>
                <Button className="Button Button--primary" icon="fas fa-sync-alt" loading={this.queueLoading} onclick={() => this.loadQueue()} style={{ borderRadius: '8px', padding: '8px 16px', background: '#3b82f6', border: 'none', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)' }}>
                    Yenile
                </Button>
            </div>

            {this.queueLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: '#6b7280' }}>
                    <i className="fas fa-spinner fa-spin fa-2x"></i>
                </div>
            )}
            
            {!this.queueLoading && grouped.length === 0 && (
                <div style={{ textAlign: 'center', padding: '50px 20px', background: '#f9fafb', borderRadius: '12px', border: '1px dashed #d1d5db', color: '#6b7280' }}>
                    <i className="fas fa-inbox fa-3x" style={{ color: '#9ca3af', marginBottom: '15px' }}></i>
                    <h3 style={{ margin: '0 0 5px 0', color: '#374151' }}>Kuyruk Boş</h3>
                    <p style={{ margin: 0 }}>Şu anda bekleyen hiçbir planlanmış gönderi yok.</p>
                </div>
            )}

            {!this.queueLoading && grouped.length > 0 && (
                <div className="Framio-Queue-Grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {grouped.map(group => {
                        let dateStr = "Bilinmiyor";
                        try {
                            if (group.scheduled_at) {
                                const safeDate = group.scheduled_at.replace(' ', 'T');
                                const dateObj = new Date(safeDate);
                                dateStr = dateObj.toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                            }
                        } catch(e) {}
                        
                        const statusColors = {
                            pending: { bg: '#fffbeb', text: '#d97706', icon: 'fas fa-clock', label: 'Bekliyor' },
                            success: { bg: '#ecfdf5', text: '#059669', icon: 'fas fa-check-circle', label: 'Başarılı' },
                            error:   { bg: '#fef2f2', text: '#dc2626', icon: 'fas fa-exclamation-circle', label: 'Hatalı' },
                            failed:  { bg: '#fef2f2', text: '#dc2626', icon: 'fas fa-exclamation-circle', label: 'Hatalı' }
                        };
                        const statusInfo = statusColors[group.status] || { bg: '#f3f4f6', text: '#4b5563', icon: 'fas fa-question-circle', label: group.status };
                        const firstImage = (group.images && group.images.length > 0) ? group.images[0] : null;

                        const platformKeys = Object.keys(group.platforms);
                        const firstPlatformItem = group.platforms[platformKeys[0]] || group.items[0];
                        const sampleMessage = (firstPlatformItem && firstPlatformItem.payload && firstPlatformItem.payload.message) || '';

                        return (
                        <div className="Framio-Queue-Card" onclick={() => app.modal.show(EditQueueModal, { group: group, items: group.items, updateQueueGroup: this.updateQueueGroup.bind(this) })} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onmouseover={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'; }} onmouseout={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.04)'; }}>
                            
                            {/* Card Image Area */}
                            <div style={{ width: '100%', height: '170px', background: '#f3f4f6', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {firstImage ? (
                                    <img src={firstImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <i className="far fa-image fa-2x" style={{ color: '#d1d5db' }}></i>
                                )}
                                
                                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '20px', background: statusInfo.bg, color: statusInfo.text, fontSize: '11px', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                    <i className={statusInfo.icon}></i> {statusInfo.label}
                                </div>
                                
                                {/* Platform Badges */}
                                <div style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', gap: '6px' }}>
                                    {['facebook', 'instagram', 'threads'].map(p => {
                                        const exists = !!group.platforms[p];
                                        if (!exists) return null;
                                        const meta = {
                                            facebook: { icon: 'fab fa-facebook', color: '#1877f2', bg: 'rgba(255,255,255,0.95)' },
                                            instagram: { icon: 'fab fa-instagram', color: '#e1306c', bg: 'rgba(255,255,255,0.95)' },
                                            threads: { icon: 'fab fa-threads', color: '#000000', bg: 'rgba(255,255,255,0.95)' }
                                        }[p];
                                        return (
                                            <span style={{ background: meta.bg, padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', color: meta.color, display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
                                                <i className={meta.icon}></i> {p.toUpperCase()}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {/* Card Details Area */}
                            <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '13px', marginBottom: '10px' }}>
                                    <i className="far fa-calendar-alt" style={{ color: '#6366f1' }}></i> <strong>{dateStr}</strong>
                                    {group.images.length > 1 && (
                                        <span style={{ marginLeft: 'auto', background: '#e0e7ff', color: '#4338ca', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                                            <i className="far fa-images" style={{ marginRight: '3px' }}></i> {group.images.length} Görsel
                                        </span>
                                    )}
                                </div>
                                
                                <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', wordBreak: 'break-word', flex: 1 }}>
                                    {sampleMessage || 'Metin yok...'}
                                </div>
                                
                                <div style={{ marginTop: '15px', paddingTop: '12px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'center' }}>
                                    <span style={{ color: '#6366f1', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <i className="fas fa-edit"></i> Tek Tıkla İncele & Düzenle
                                    </span>
                                </div>
                            </div>
                            
                        </div>
                    )})}
                </div>
            )}
          </div>
      );
  }

  checkTokenStatus(index) {
      const acc = this.accounts[index];
      if (!acc || !acc.token) {
          app.alerts.show({ type: 'warning' }, 'Lütfen önce bu hesaba ait Access Token girin.');
          return;
      }

      this.tokenChecking = this.tokenChecking || {};
      this.tokenStatus = this.tokenStatus || {};
      this.tokenChecking[index] = true;
      m.redraw();

      app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/check-token',
          body: { token: acc.token }
      }).then(res => {
          this.tokenChecking[index] = false;
          this.tokenStatus[index] = res;
          if (res.valid) {
              app.alerts.show({ type: 'success' }, `[${acc.name || 'Hesap'}] Token Geçerli ve Aktif!`);
          } else {
              app.alerts.show({ type: 'error' }, `[${acc.name || 'Hesap'}] Token Hatası: ` + (res.error || 'Geçersiz Token'));
          }
          m.redraw();
      }).catch(err => {
          this.tokenChecking[index] = false;
          this.tokenStatus[index] = { valid: false, error: err.toString() };
          app.alerts.show({ type: 'error' }, 'Token kontrol edilirken hata oluştu.');
          m.redraw();
      });
  }

  renderAccounts() {
      this.tokenChecking = this.tokenChecking || {};
      this.tokenStatus = this.tokenStatus || {};

      return (
          <div>
            <h2>Meta (Instagram/Facebook) Hesapları</h2>
            <p className="helpText">Gönderilerinizi paylaşacağınız sayfaları ve hesapları buradan ekleyebilirsiniz.</p>
            
            <div className="Framio-Accounts-List" style={{ marginBottom: '20px' }}>
              {this.accounts.map((acc, index) => {
                  const status = this.tokenStatus[index];
                  const isChecking = this.tokenChecking[index];

                  return (
                  <div className="Framio-Account-Item" style={{ border: '1px solid #ddd', padding: '18px', marginBottom: '15px', borderRadius: '10px', background: '#f9fafb', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid #e5e7eb' }}>
                          <div style={{ fontWeight: '700', fontSize: '15px', color: '#1f2937' }}>
                              <i className="fas fa-user-circle" style={{ color: '#3b82f6', marginRight: '6px' }}></i>
                              {acc.name ? acc.name : `Hesap #${index + 1}`}
                          </div>

                          {/* Token Sağlık Durumu Rozeti */}
                          <div>
                              {status && status.valid && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: '#ecfdf5', color: '#059669', fontSize: '12px', fontWeight: '600', border: '1px solid #a7f3d0' }}>
                                      <i className="fas fa-check-circle"></i>
                                      {status.is_never_expire ? 'Süresiz Token (Ömürlük)' : `Kalan: ${status.days_left} Gün (${status.expiry_date})`}
                                  </span>
                              )}
                              {status && !status.valid && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: '600', border: '1px solid #fecaca' }}>
                                      <i className="fas fa-exclamation-triangle"></i> Token Geçersiz / Süresi Dolmuş
                                  </span>
                              )}
                          </div>
                      </div>

                      <div className="Form-group">
                          <label>Hesap Adı (Kendi Anlayacağınız İsim)</label>
                          <input className="FormControl" value={acc.name} oninput={e => { this.accounts[index].name = e.target.value; m.redraw(); }} />
                      </div>
                      <div className="Form-group">
                          <label>Facebook Page ID</label>
                          <input className="FormControl" value={acc.page_id} oninput={e => { this.accounts[index].page_id = e.target.value; m.redraw(); }} />
                      </div>
                      <div className="Form-group">
                          <label>Instagram Business ID</label>
                          <input className="FormControl" value={acc.ig_id} oninput={e => { this.accounts[index].ig_id = e.target.value; m.redraw(); }} />
                      </div>
                      <div className="Form-group">
                          <label>Threads User ID</label>
                          <input className="FormControl" value={acc.threads_id} oninput={e => { this.accounts[index].threads_id = e.target.value; m.redraw(); }} placeholder="Threads Profil / Kullanıcı ID" />
                      </div>
                      <div className="Form-group">
                          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>Access Token (Meta / FB & IG İçin Kalıcı Token)</span>
                              <button type="button" onclick={() => this.checkTokenStatus(index)} disabled={isChecking || !acc.token} style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <i className={isChecking ? "fas fa-spinner fa-spin" : "fas fa-shield-alt"}></i> {isChecking ? "Kontrol Ediliyor..." : "Token Sağlığını Kontrol Et"}
                              </button>
                          </label>
                          <input className="FormControl" type="password" value={acc.token} oninput={e => { this.accounts[index].token = e.target.value; m.redraw(); }} />
                      </div>
                      <div className="Form-group">
                          <label>Threads Access Token (İsteğe Bağlı - Farklıysa)</label>
                          <input className="FormControl" type="password" value={acc.threads_token} oninput={e => { this.accounts[index].threads_token = e.target.value; m.redraw(); }} placeholder="Boş bırakılırsa ana Access Token kullanılır" />
                      </div>
                      <div className="Form-group">
                          <label>
                              <input type="radio" name="default_account" checked={String(this.defaultAccountIndex) === String(index)} onchange={() => { this.defaultAccountIndex = String(index); m.redraw(); }} />
                              Varsayılan Olarak Ayarla (Otomatik Paylaşım İçin)
                          </label>
                      </div>
                      <Button className="Button Button--danger" onclick={() => this.removeAccount(index)}>Bu Hesabı Sil</Button>
                  </div>
              )})}
            </div>
  
            <Button className="Button Button--primary" onclick={() => this.addAccount()} style={{ marginBottom: '30px' }}>
              + Yeni Hesap Ekle
            </Button>
          </div>
      );
  }

  renderFormatAndAi() {
      return (
          <div className="Framio-Format-Ai-Settings">
            {/* Şablon Bölümü */}
            <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '25px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                        <i className="fas fa-palette"></i>
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 'bold' }}>Otomatik Gönderi Şablonu</h2>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>Gönderiler paylaşılırken otomatik olarak kullanılacak şablon. Desteklenen değişkenler: <code>{"{title}"}</code>, <code>{"{text}"}</code>, <code>{"{smart_tags}"}</code></p>
                    </div>
                </div>
                <div className="Form-group" style={{ margin: 0 }}>
                    <textarea className="FormControl" rows="5" value={this.postTemplate} oninput={e => { this.postTemplate = e.target.value; m.redraw(); }} style={{ fontSize: '13px', lineHeight: '1.5' }}></textarea>
                </div>
            </div>

            {/* Yapay Zeka (AI) Motoru */}
            <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                        <i className="fas fa-robot"></i>
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: 'bold' }}>Çoklu Yapay Zeka (AI) & Canlı Araştırma Motoru</h2>
                        <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>Yüksek limitli sağlayıcılar, otomatik anahtar rotasyonu ve canlı web araştırması ile kesintisiz metin üretir.</p>
                    </div>
                </div>

                {/* 1. Google Gemini Havuzu */}
                <div className="Form-group" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                    <label style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fab fa-google" style={{ color: '#ea4335' }}></i> Google Gemini API Anahtarları (Rotasyonlu Havuz)
                    </label>
                    <p className="helpText" style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b' }}>
                        Birden fazla anahtar girerek kotaya takılmayı önleyebilirsiniz (Her satıra bir API anahtarı veya virgülle ayırarak yazın). Biri 429 kotaya girerse sistem otomatik olarak diğerine geçer.
                    </p>
                    <textarea className="FormControl" rows="3" value={this.geminiApiKey} oninput={e => { this.geminiApiKey = e.target.value; m.redraw(); }} placeholder="AIzaSy...&#10;AIzaSy... (Farklı Google Projelerinden alınan anahtarlar)" style={{ fontFamily: 'monospace', fontSize: '12px' }}></textarea>
                    <p className="helpText" style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                        Ücretsiz anahtar almak için: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontWeight: '600' }}>Google AI Studio</a>
                    </p>
                </div>

                {/* 2. Groq API (Llama 3.3 70B & DeepSeek R1) */}
                <div className="Form-group" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                    <label style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fas fa-bolt" style={{ color: '#f59e0b' }}></i> Groq API Key (Llama 3.3 70B - Yüksek Limit & Ultra Hızlı)
                    </label>
                    <p className="helpText" style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b' }}>
                        Tamamen ücretsizdir ve günlük/dakikalık limitleri inanılmaz yüksektir. Gemini yedeklendiğinde veya doğrudan kullanımda devreye girer.
                    </p>
                    <input className="FormControl" type="password" value={this.groqApiKey} oninput={e => { this.groqApiKey = e.target.value; m.redraw(); }} placeholder="gsk_..." style={{ maxWidth: '500px' }} />
                    <p className="helpText" style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                        Ücretsiz anahtar almak için: <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b', fontWeight: '600' }}>Groq Cloud Console</a>
                    </p>
                </div>

                {/* 3. OpenRouter API */}
                <div className="Form-group" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                    <label style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fas fa-network-wired" style={{ color: '#3b82f6' }}></i> OpenRouter API Key (İsteğe Bağlı Ekstra Yedek)
                    </label>
                    <p className="helpText" style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b' }}>
                        Yüzlerce açık kaynaklı modeli tek çatıda toplayan ücretsiz havuz.
                    </p>
                    <input className="FormControl" type="password" value={this.openrouterApiKey} oninput={e => { this.openrouterApiKey = e.target.value; m.redraw(); }} placeholder="sk-or-..." style={{ maxWidth: '500px' }} />
                    <p className="helpText" style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                        Ücretsiz anahtar almak için: <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontWeight: '600' }}>OpenRouter.ai</a>
                    </p>
                </div>

                {/* 4. Tavily AI Search Engine (Özel Otobüs/Geçmiş Web Tarama) */}
                <div className="Form-group" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                    <label style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fas fa-search-plus" style={{ color: '#10b981' }}></i> Tavily AI Search API Key (Derin Araç/Plaka Web Araştırması)
                    </label>
                    <p className="helpText" style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b' }}>
                        Yapay zeka için özel arama motoru. Plaka, filo ve teslimat haberlerini (Instagram, haber siteleri, forumlar) derinlemesine tarayarak AI'a aktarır (Ayda 1,000 ücretsiz arama).
                    </p>
                    <input className="FormControl" type="password" value={this.tavilyApiKey} oninput={e => { this.tavilyApiKey = e.target.value; m.redraw(); }} placeholder="tvly-..." style={{ maxWidth: '500px' }} />
                    <p className="helpText" style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                        Ücretsiz anahtar almak için: <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', fontWeight: '600' }}>Tavily.com</a>
                    </p>
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', color: '#166534', fontSize: '12px', lineHeight: '1.5' }}>
                    <strong><i className="fas fa-globe"></i> Canlı Web Araştırması (Web Grounding):</strong> Paylaşım modalında <em>"🌐 Web / Filo Araştır"</em> butonuna tıkladığınızda sistem hem Google Arama hem de canlı web tarama motoru ile plaka ve firma teslimat haberlerini tarar, ardından aktif olan AI sağlayıcısına ileterek metni zenginleştirir.
                </div>
            </div>
          </div>
      );
  }

  renderStoryBackgrounds() {
      return (
          <div className="Framio-StoryBg-Settings">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#1f2937', fontSize: '20px', fontWeight: 'bold' }}>
                        <i className="fas fa-layer-group" style={{ color: '#0b5c4e', marginRight: '8px' }}></i> Hikaye Şablonları & Arka Plan Yönetimi
                    </h2>
                    <p className="helpText" style={{ margin: '5px 0 0 0', color: '#6b7280' }}>
                        Hikaye tasarımcısında kullanılacak şablonları doğrudan bilgisayarınızdan yükleyebilir veya bağlantısını girebilirsiniz. Sıralama butonlarıyla şablonların çıkış sırasını belirleyebilirsiniz.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <label className="Button Button--primary" style={{ borderRadius: '8px', padding: '8px 16px', background: '#0b5c4e', border: 'none', cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fas fa-cloud-upload-alt"></i> Dosyadan Yeni Şablon Yükle (.jpg, .png, .mp4)
                        <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" style={{ display: 'none' }} onchange={this.handleFileUpload.bind(this, null)} />
                    </label>
                    <Button className="Button" icon="fas fa-plus" onclick={() => this.addStoryBackground()} style={{ borderRadius: '8px', padding: '8px 14px' }}>
                        Manuel Ekle
                    </Button>
                </div>
            </div>

            {this.uploadingBg && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px 20px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e40af' }}>
                    <i className="fas fa-spinner fa-spin"></i> Dosya sunucuya yükleniyor, lütfen bekleyin...
                </div>
            )}

            <div className="Framio-StoryBg-List" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px', marginBottom: '25px' }}>
                {this.storyBackgrounds.map((bg, idx) => (
                    <div key={bg.id || idx} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', background: '#ffffff', padding: '18px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 'bold', color: '#0b5c4e', fontSize: '15px' }}>
                                    Sıra #{idx + 1}
                                </span>
                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', background: bg.type === 'video' ? '#e0e7ff' : '#ecfdf5', color: bg.type === 'video' ? '#4338ca' : '#047857' }}>
                                    <i className={bg.type === 'video' ? 'fas fa-video' : 'far fa-image'} style={{ marginRight: '4px' }}></i>
                                    {bg.type === 'video' ? 'Hareketli Video' : 'Statik Görsel'}
                                </span>
                            </div>

                            {/* Sıralama Kontrolleri */}
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button type="button" className="Button Button--icon" title="Yukarı / Öne Taşı" disabled={idx === 0} onclick={() => this.moveStoryBackground(idx, -1)} style={{ padding: '4px 8px', fontSize: '12px', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}>
                                    <i className="fas fa-arrow-up"></i>
                                </button>
                                <button type="button" className="Button Button--icon" title="Aşağı / Arkaya Taşı" disabled={idx === this.storyBackgrounds.length - 1} onclick={() => this.moveStoryBackground(idx, 1)} style={{ padding: '4px 8px', fontSize: '12px', cursor: idx === this.storyBackgrounds.length - 1 ? 'not-allowed' : 'pointer' }}>
                                    <i className="fas fa-arrow-down"></i>
                                </button>
                            </div>
                        </div>

                        <div className="Form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563', marginBottom: '4px', display: 'block' }}>Şablon Başlığı</label>
                            <input className="FormControl" value={bg.name} oninput={e => { bg.name = e.target.value; m.redraw(); }} placeholder="Örn: Ulaşım Arşiv Otobüs Teması" />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <div className="Form-group" style={{ flex: 1, margin: 0 }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563', marginBottom: '4px', display: 'block' }}>Format Türü</label>
                                <select className="FormControl" value={bg.type || 'image'} onchange={e => { bg.type = e.target.value; m.redraw(); }}>
                                    <option value="image">Görsel (JPG / PNG)</option>
                                    <option value="video">Video (MP4 / WebM)</option>
                                </select>
                            </div>
                            <div className="Form-group" style={{ flex: 1, margin: 0 }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563', marginBottom: '4px', display: 'block' }}>Varsayılan Metin Rengi</label>
                                <select className="FormControl" value={bg.textColor || '#ffffff'} onchange={e => { bg.textColor = e.target.value; m.redraw(); }}>
                                    <option value="#ffffff">Açık / Beyaz Metin (#ffffff)</option>
                                    <option value="#111111">Koyu / Siyah Metin (#111111)</option>
                                </select>
                            </div>
                        </div>

                        <div className="Form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563', marginBottom: '4px', display: 'block' }}>Dosya / Yükleme</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input className="FormControl" value={bg.url} oninput={e => { bg.url = e.target.value; m.redraw(); }} placeholder="/assets/backgrounds/..." style={{ flex: 1 }} />
                                <label className="Button" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }} title="Dosyayı Değiştir / Yükle">
                                    <i className="fas fa-upload"></i> Seç
                                    <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" style={{ display: 'none' }} onchange={this.handleFileUpload.bind(this, idx)} />
                                </label>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                {bg.url ? (bg.url.length > 28 ? bg.url.substring(0, 28) + '...' : bg.url) : 'Henüz dosya atanmadı'}
                            </span>
                            <Button className="Button Button--danger" icon="fas fa-trash-alt" onclick={() => this.removeStoryBackground(idx)} style={{ fontSize: '12px', padding: '4px 10px' }}>
                                Sil
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Hikaye Arşivi Bölümü */}
            <div style={{ marginTop: '40px', paddingTop: '30px', borderTop: '2px dashed #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px', fontWeight: 'bold' }}>
                            <i className="fas fa-archive" style={{ color: '#6366f1', marginRight: '8px' }}></i> Oluşturulan & İndirilen Hikayeler Arşivi
                        </h3>
                        <p className="helpText" style={{ margin: '4px 0 0 0', color: '#64748b' }}>
                            Kullanıcıların veya yöneticilerin tasarlayıp indirdiği tüm dikey hikayeler otomatik olarak burada arşivlenir. Doğrudan Instagram'da paylaşabilir veya bilgisayarınızdan yeni dikey hikaye yükleyebilirsiniz.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <label className="Button Button--primary" style={{ borderRadius: '8px', padding: '8px 16px', background: '#4f46e5', border: 'none', cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                            <i className="fas fa-cloud-upload-alt"></i> Cihazdan Hikaye Yükle
                            <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" style={{ display: 'none' }} onchange={this.uploadStoryDirect.bind(this)} />
                        </label>
                        <Button className="Button" icon="fas fa-sync-alt" loading={this.storyArchiveLoading} onclick={() => this.loadStoryArchive()} style={{ borderRadius: '8px', padding: '8px 14px' }}>
                            Yenile
                        </Button>
                    </div>
                </div>

                {this.storyArchiveLoading && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '30px', color: '#6b7280' }}>
                        <i className="fas fa-spinner fa-spin fa-2x"></i>
                    </div>
                )}

                {!this.storyArchiveLoading && this.storyArchive.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '35px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                        <i className="far fa-images fa-2x" style={{ color: '#94a3b8', marginBottom: '10px' }}></i>
                        <p style={{ margin: 0, fontSize: '13px' }}>Henüz kaydedilmiş veya yüklenmiş bir hikaye bulunmuyor.</p>
                    </div>
                )}

                {!this.storyArchiveLoading && this.storyArchive.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                        {this.storyArchive.map(st => (
                            <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                                <div style={{ width: '100%', height: '240px', background: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {st.type === 'video' ? (
                                        <video src={st.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls />
                                    ) : (
                                        <img src={st.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    )}
                                    <div style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>
                                        {st.type === 'video' ? 'VIDEO' : 'GÖRSEL'}
                                    </div>
                                </div>
                                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                                    <span style={{ fontSize: '11px', color: '#64748b' }}>{st.created_at || 'Tarih yok'}</span>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '6px' }}>
                                        <button 
                                            type="button" 
                                            className="Button Button--primary" 
                                            onclick={() => {
                                                this.activeTab = 'business';
                                                this.businessActiveSubTab = 'story_publish';
                                                this.storyPublishUrl = (app.forum.attribute('baseUrl') || window.location.origin).replace(/\/+$/, '') + st.url;
                                                m.redraw();
                                            }}
                                            style={{ flex: 1, padding: '4px 6px', fontSize: '11px', borderRadius: '6px', background: 'linear-gradient(135deg, #f09433, #dc2743)', border: 'none', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
                                            title="Instagram'da Hikaye Olarak Paylaş"
                                        >
                                            <i className="fab fa-instagram"></i> Paylaş
                                        </button>
                                        <button 
                                            type="button" 
                                            className="Button Button--danger" 
                                            onclick={() => this.deleteStoryArchive(st.filename)}
                                            style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px' }}
                                            title="Arşivden Sil"
                                        >
                                            <i className="fas fa-trash-alt"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '15px', color: '#166534', fontSize: '13px', lineHeight: '1.6', marginTop: '25px' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                    <i className="fas fa-lightbulb"></i> Canva Tasarım İpucu:
                </strong>
                Canva'da hazırladığınız <strong>1080x1920 (9:16)</strong> dikey tasarımları bilgisayarınıza indirdikten sonra yukarıdaki <strong>"Dosyadan Yeni Şablon Yükle"</strong> butonuna basarak tek tıkla yükleyebilirsiniz. Yüklenen dosya otomatik olarak <code>assets/backgrounds/</code> dizinine kaydedilir ve listenin sonuna eklenir. Ok butonlarıyla sırasını değiştirebilirsiniz.
            </div>
          </div>
      );
  }

  loadStoryArchive() {
      this.storyArchiveLoading = true;
      app.request({
          method: 'GET',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/story-archive'
      }).then(res => {
          this.storyArchiveLoading = false;
          this.storyArchiveLoaded = true;
          if (res && res.stories) {
              this.storyArchive = res.stories;
          }
          m.redraw();
      }).catch(err => {
          this.storyArchiveLoading = false;
          console.error("Story archive loading failed:", err);
          m.redraw();
      });
  }

  uploadStoryDirect(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      this.storyArchiveLoading = true;
      m.redraw();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'save');

      app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/story-archive',
          body: formData,
          serialize: raw => raw
      }).then(res => {
          this.storyArchiveLoading = false;
          if (res && res.success) {
              app.alerts.show({ type: 'success' }, 'Hikaye arşive başarıyla yüklendi!');
              this.loadStoryArchive();
          }
      }).catch(err => {
          this.storyArchiveLoading = false;
          app.alerts.show({ type: 'error' }, 'Yükleme hatası: ' + ((err && err.response && (err.response.error || err.response.message)) || (err && err.message) || 'Bilinmeyen hata olustu'));
          m.redraw();
      });
  }

  deleteStoryArchive(filename) {
      if (!confirm('Bu hikayeyi arşivden silmek istediğinize emin misiniz?')) return;

      this.storyArchiveLoading = true;
      m.redraw();

      app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/story-archive',
          body: { action: 'delete', filename: filename }
      }).then(res => {
          this.storyArchiveLoading = false;
          if (res && res.success) {
              app.alerts.show({ type: 'success' }, 'Hikaye arşivden silindi.');
              this.loadStoryArchive();
          }
      }).catch(err => {
          this.storyArchiveLoading = false;
          app.alerts.show({ type: 'error' }, 'Silme hatası: ' + ((err && err.response && (err.response.error || err.response.message)) || (err && err.message) || 'Bilinmeyen hata olustu'));
          m.redraw();
      });
  }

  handleFileUpload(targetIdx, e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      this.uploadingBg = true;
      m.redraw();

      const formData = new FormData();
      formData.append('file', file);

      app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/upload-bg',
          body: formData,
          serialize: raw => raw
      }).then(res => {
          this.uploadingBg = false;
          if (res && res.success) {
              if (targetIdx !== null && this.storyBackgrounds[targetIdx]) {
                  this.storyBackgrounds[targetIdx].url = res.url;
                  this.storyBackgrounds[targetIdx].type = res.type;
              } else {
                  this.storyBackgrounds.push({
                      id: 'bg_' + Date.now(),
                      name: res.suggestedName || 'Yeni Arka Plan',
                      type: res.type,
                      url: res.url,
                      textColor: '#ffffff'
                  });
              }
              app.alerts.show({ type: 'success' }, 'Dosya başarıyla yüklendi! Ayarları Kaydet butonuna basmayı unutmayın.');
          }
          m.redraw();
      }).catch(err => {
          this.uploadingBg = false;
          app.alerts.show({ type: 'error' }, 'Dosya yükleme hatası: ' + (err.message || err.toString()));
          m.redraw();
      });
  }

  moveStoryBackground(index, direction) {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= this.storyBackgrounds.length) return;
      const temp = this.storyBackgrounds[index];
      this.storyBackgrounds[index] = this.storyBackgrounds[newIndex];
      this.storyBackgrounds[newIndex] = temp;
      m.redraw();
  }

  addStoryBackground() {
      const newId = 'bg_' + Date.now();
      this.storyBackgrounds.push({
          id: newId,
          name: 'Yeni Şablon',
          type: 'image',
          url: '',
          textColor: '#ffffff'
      });
      m.redraw();
  }

  removeStoryBackground(idx) {
      if (confirm('Bu arka plan şablonunu silmek istediğinize emin misiniz?')) {
          this.storyBackgrounds.splice(idx, 1);
          m.redraw();
      }
  }

  renderPermissionsTab() {
      return (
          <div className="Framio-Permissions-Settings">
            <div style={{ marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#1f2937', fontSize: '20px', fontWeight: 'bold' }}>
                    <i className="fas fa-user-shield" style={{ color: '#0b5c4e', marginRight: '8px' }}></i> Kullanıcı ve Rol Yetkilendirmeleri
                </h2>
                <p className="helpText" style={{ margin: '5px 0 0 0', color: '#6b7280' }}>
                    Forumdaki gönderi paylaşma ve hikaye oluşturma araçlarını kimlerin kullanabileceğini buradan yönetebilirsiniz.
                </p>
            </div>

            {/* Bilgilendirme Kutusu */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px', marginBottom: '25px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                    <i className="fas fa-info-circle" style={{ color: '#3b82f6' }}></i> İki Aşamalı İzin Mimarisi
                </h4>
                <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: '1.6' }}>
                    <strong>1. Genel Grup İzinleri:</strong> Flarum'un sol menüsündeki <em>"İzinler (Permissions)"</em> sekmesine giderek dilediğiniz kullanıcı grubuna (Örn: Moderatörler, Editörler) <strong>"Sosyal Medyada Paylaş"</strong>, <strong>"Hikaye Tasarla & İndir"</strong> veya <strong>"Hikaye Yayınla & Zamanla"</strong> izinlerini verebilirsiniz.<br/>
                    <strong>2. Özel Kullanıcı Yetkilendirmesi:</strong> Aşağıdaki kutulara dilediğiniz kullanıcıların <strong>Kullanıcı Adlarını</strong> (veya ID'lerini) yazarak, gruba bağlı olmaksızın sadece onlara özel yetki tanımlayabilirsiniz.
                </p>
            </div>

            {/* Özel Kullanıcı İzin Alanları */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                {/* Gönderi Paylaşımı */}
                <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                            <i className="fab fa-instagram"></i>
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px', color: '#111827' }}>Meta Gönderi Paylaşma Yetkisi</h3>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>Facebook & Instagram gönderi paneli</span>
                        </div>
                    </div>
                    <div className="Form-group">
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                            Özel Yetkili Kullanıcı Adları
                        </label>
                        <input className="FormControl" value={this.allowedShareUsers} oninput={e => { this.allowedShareUsers = e.target.value; m.redraw(); }} placeholder="Örn: alikaankaya, mert, editor1" />
                        <small style={{ color: '#9ca3af', fontSize: '11px', marginTop: '5px', display: 'block' }}>
                            Kullanıcı adlarını (veya ID'lerini) aralarına virgül koyarak yazın. Yöneticiler (Admin) her zaman tam yetkilidir.
                        </small>
                    </div>
                </div>

                {/* Hikaye Tasarımı */}
                <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f0fdf4', color: '#0b5c4e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                            <i className="fas fa-mobile-alt"></i>
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px', color: '#111827' }}>Hikaye Oluşturma (Story) Yetkisi</h3>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>Dikey hikaye tasarımcısı ve indirme</span>
                        </div>
                    </div>
                    <div className="Form-group">
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                            Özel Yetkili Kullanıcı Adları
                        </label>
                        <input className="FormControl" value={this.allowedStoryUsers} oninput={e => { this.allowedStoryUsers = e.target.value; m.redraw(); }} placeholder="Örn: alikaankaya, mert, editor1" />
                        <small style={{ color: '#9ca3af', fontSize: '11px', marginTop: '5px', display: 'block' }}>
                            Kullanıcı adlarını (veya ID'lerini) aralarına virgül koyarak yazın. Yöneticiler (Admin) her zaman tam yetkilidir.
                        </small>
                    </div>
                </div>

                {/* Meta Hikaye Yayınlama & Zamanlama */}
                <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                            <i className="fas fa-paper-plane"></i>
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px', color: '#111827' }}>Meta Hikaye Yayınlama & Zamanlama Yetkisi</h3>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>Instagram & Facebook Hikaye anlık paylaşım ve planlama</span>
                        </div>
                    </div>
                    <div className="Form-group">
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                            Özel Yetkili Kullanıcı Adları
                        </label>
                        <input className="FormControl" value={this.allowedStoryPublishUsers} oninput={e => { this.allowedStoryPublishUsers = e.target.value; m.redraw(); }} placeholder="Örn: alikaankaya, mert, editor1" />
                        <small style={{ color: '#9ca3af', fontSize: '11px', marginTop: '5px', display: 'block' }}>
                            Kullanıcı adlarını (veya ID'lerini) aralarına virgül koyarak yazın. Grup bazlı yetki için Flarum İzinler sekmesini kullanabilirsiniz.
                        </small>
                    </div>
                </div>
            </div>

            {/* Üye Şahsi Instagram Hesapları Eşleştirmesi */}
            <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginBottom: '25px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                        <i className="fab fa-instagram"></i>
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '15px', color: '#111827' }}>Üye Şahsi Instagram Hesapları (Fotoğrafçı Künyesi)</h3>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Gönderi künyesinde <code>📸: İsim | @instagramhesabi</code> şeklinde otomatik görünmesi için tanımlar</span>
                    </div>
                </div>
                <div className="Form-group">
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                        Kullanıcı Adı : @InstagramHesabi (Her satıra bir üye)
                    </label>
                    <textarea className="FormControl" rows="3" value={this.userInstagramMap} oninput={e => { this.userInstagramMap = e.target.value; m.redraw(); }} placeholder="alikaankaya: @spottersturkeycom&#10;emircandadas: @emircandadas" style={{ fontFamily: 'monospace', fontSize: '13px' }}></textarea>
                    <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                        * Format: <code>kullaniciadi: @instagramhesabi</code> (Her satıra bir üye yazınız).
                    </small>
                </div>
            </div>

            {/* Özel Üye Ad Soyad Eşleştirmesi */}
            <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginBottom: '25px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                        <i className="fas fa-id-card"></i>
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '15px', color: '#111827' }}>Özel Üye Ad & Soyad Eşleştirmeleri (Fotoğrafçı Künyesi)</h3>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Kullanıcı adı tek parça olan üyelerin künyede doğru Adı ve BÜYÜK SOYADI ile çıkması için</span>
                    </div>
                </div>
                <div className="Form-group">
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                        Kullanıcı Adı : Görünen Ad Soyad (Her satıra bir üye)
                    </label>
                    <textarea className="FormControl" rows="3" value={this.userNameMap} oninput={e => { this.userNameMap = e.target.value; m.redraw(); }} placeholder="emircandadas: Emircan DADAŞ&#10;alikaankaya: Ali Kaan KAYA" style={{ fontFamily: 'monospace', fontSize: '13px' }}></textarea>
                    <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                        * Format: <code>kullaniciadi: Ad SOYAD</code> (Otomatik ayrıştırılamayan özel üyeleri buraya ekleyebilirsiniz).
                    </small>
                </div>
            </div>

          </div>
      );
  }

  addAccount() {
      this.accounts.push({ name: '', page_id: '', ig_id: '', token: '' });
      m.redraw();
  }

  removeAccount(index) {
      if(confirm('Bu hesabı silmek istediğinize emin misiniz?')) {
          this.accounts.splice(index, 1);
          if (String(this.defaultAccountIndex) === String(index)) this.defaultAccountIndex = "0";
          m.redraw();
      }
  }

  renderCanvaSettings() {
      const redirectUri = (app.forum.attribute('baseUrl') || window.location.origin).replace(/\/+$/, '') + '/api/framio/social-share/canva/callback';

      return (
          <div className="Canva-Settings-Tab" style={{ maxWidth: '850px' }}>
              
              {/* Bilgilendirme Bannerı */}
              <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px', padding: '16px 20px', marginBottom: '25px', fontSize: '13px', color: '#5b21b6', lineHeight: '1.6' }}>
                  <div style={{ fontWeight: '800', fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fas fa-info-circle" style={{ color: '#7d2ae8' }}></i> Çift Katmanlı Canva Pro Mimarisi (Ekip & Genel Üyeler)
                  </div>
                  Sistem iki farklı Canva hesabını bağımsız olarak destekler:
                  <ul style={{ margin: '6px 0 10px 20px', padding: 0 }}>
                      <li><strong>1. Özel Ekip Hesabı:</strong> Sizin ve eklediğiniz özel kullanıcıların (Siz, ulasimarsiv, spottersturkey) şahsi Canva Pro hesaplarına bağlanır.</li>
                      <li><strong>2. Markanın Ortak Hesabı (ulasimarsivcom@gmail.com):</strong> Kalan tüm forum üyelerinin paylaşımları için arka planda çalışan ortak kurumsal Canva Pro hesabıdır.</li>
                  </ul>
                  <strong>📌 Ortak Redirect URI (Her iki Canva App için de bunu girin):</strong><br />
                  <code style={{ background: '#ffffff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #c4b5fd', display: 'inline-block', marginTop: '5px', fontWeight: '700', color: '#6d28d9' }}>{redirectUri}</code>
              </div>

              {/* 1. HESAP: ŞAHSİ / ÖZEL EKİP HESABI */}
              <div style={{ background: '#ffffff', border: '1.5px solid #c7d2fe', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginBottom: '25px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                              <i className="fas fa-user-shield"></i>
                          </div>
                          <div>
                              <h3 style={{ margin: 0, fontSize: '16px', color: '#111827', fontWeight: '700' }}>1. Hesap: Şahsi / Özel Ekip Canva Pro Hesabı</h3>
                              <span style={{ fontSize: '13px', color: '#6b7280' }}>Yönetici ve özel spotter ekibinin kullandığı Canva hesabı</span>
                          </div>
                      </div>
                      <span style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }}>
                          Özel Ekip
                      </span>
                  </div>

                  <div className="Form-group" style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px', display: 'block' }}>
                          Şahsi Canva Client ID
                      </label>
                      <input 
                          type="text" 
                          className="FormControl" 
                          value={this.canvaClientId} 
                          oninput={e => { this.canvaClientId = e.target.value; m.redraw(); }} 
                          placeholder="Örn: OC-AaBzwyAxpl3G..." 
                          style={{ fontSize: '13px', borderRadius: '8px' }}
                      />
                  </div>

                  <div className="Form-group" style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px', display: 'block' }}>
                          Şahsi Canva Client Secret
                      </label>
                      <input 
                          type="password" 
                          className="FormControl" 
                          value={this.canvaClientSecret} 
                          oninput={e => { this.canvaClientSecret = e.target.value; m.redraw(); }} 
                          placeholder="Örn: cs_..." 
                          style={{ fontSize: '13px', borderRadius: '8px' }}
                      />
                  </div>

                  <div className="Form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px', display: 'block' }}>
                          Bu Hesabı Kullanacak Özel Kullanıcı Adları
                      </label>
                      <input 
                          type="text" 
                          className="FormControl" 
                          value={this.canvaTeamUsers} 
                          oninput={e => { this.canvaTeamUsers = e.target.value; m.redraw(); }} 
                          placeholder="alikaankaya, ulasimarsiv, spottersturkey" 
                          style={{ fontSize: '13px', borderRadius: '8px', fontWeight: '600' }}
                      />
                      <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                          Kullanıcı adlarını aralarına virgül koyarak yazın (Örn: <code>alikaankaya, ulasimarsiv, spottersturkey</code>). Bu kullanıcılar kendi şahsi Canva Pro hesaplarına bağlanır.
                      </small>
                  </div>
              </div>

              {/* 2. HESAP: MARKANIN ORTAK HESABI */}
              <div style={{ background: '#ffffff', border: '1.5px solid #86efac', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginBottom: '25px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                              <i className="fas fa-building"></i>
                          </div>
                          <div>
                              <h3 style={{ margin: 0, fontSize: '16px', color: '#111827', fontWeight: '700' }}>2. Hesap: Markanın Ortak Canva Pro Hesabı (ulasimarsivcom@gmail.com)</h3>
                              <span style={{ fontSize: '13px', color: '#6b7280' }}>Kalan tüm forum üyelerinin paylaşımları için otomatik çalışan kurumsal hesap</span>
                          </div>
                      </div>
                      <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }}>
                          Genel Üyeler (Varsayılan)
                      </span>
                  </div>

                  <div className="Form-group" style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px', display: 'block' }}>
                          Marka Canva Client ID (ulasimarsivcom@gmail.com)
                      </label>
                      <input 
                          type="text" 
                          className="FormControl" 
                          value={this.canvaBrandClientId} 
                          oninput={e => { this.canvaBrandClientId = e.target.value; m.redraw(); }} 
                          placeholder="Örn: OC-..." 
                          style={{ fontSize: '13px', borderRadius: '8px' }}
                      />
                  </div>

                  <div className="Form-group" style={{ marginBottom: '14px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px', display: 'block' }}>
                          Marka Canva Client Secret
                      </label>
                      <input 
                          type="password" 
                          className="FormControl" 
                          value={this.canvaBrandClientSecret} 
                          oninput={e => { this.canvaBrandClientSecret = e.target.value; m.redraw(); }} 
                          placeholder="Örn: cs_..." 
                          style={{ fontSize: '13px', borderRadius: '8px' }}
                      />
                  </div>

                  <div className="Form-group" style={{ marginBottom: '18px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px', display: 'block' }}>
                          Bu Hesaba Erişecek Kullanıcılar
                      </label>
                      <input 
                          type="text" 
                          className="FormControl" 
                          value={this.canvaBrandUsers} 
                          oninput={e => { this.canvaBrandUsers = e.target.value; m.redraw(); }} 
                          placeholder="*" 
                          style={{ fontSize: '13px', borderRadius: '8px', fontWeight: '600' }}
                      />
                      <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                          <code>*</code> bırakırsanız, 1. listede olmayan <strong>kalan tüm forum üyeleri</strong> otomatik olarak bu marka hesabını kullanır.
                      </small>
                  </div>

                  {/* Marka Hesabı Bağlantı Durumu & Butonu */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', marginBottom: '2px' }}>
                              Marka Hesabı Oturumu (Merkezi Token)
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                              Üyelerin tek tek giriş yapmasına gerek kalmadan paylaşımları bu hesaba aktarmak için tek seferlik yetkilendirin.
                          </div>
                      </div>
                      <div>
                          <button 
                              type="button" 
                              className="Button Button--primary"
                              disabled={!this.canvaBrandClientId || !this.canvaBrandClientSecret}
                              onclick={this.connectBrandCanva.bind(this)}
                              style={{ background: '#10b981', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '12px', padding: '8px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                              <i className="fas fa-link"></i> Marka Hesabını Bağla (ulasimarsivcom@gmail.com)
                          </button>
                      </div>
                  </div>
              </div>

              {/* 3. Özel Canva Şablon Linkleri Köprüsü */}
              <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginBottom: '25px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                          <i className="fas fa-layer-group"></i>
                      </div>
                      <div>
                          <h3 style={{ margin: 0, fontSize: '16px', color: '#111827', fontWeight: '700' }}>Özel Canva Şablon Linkleri (Hızlı Köprü)</h3>
                          <span style={{ fontSize: '13px', color: '#6b7280' }}>Canva'da önceden hazırladığınız kurumsal Ulaşım Arşiv hikaye şablon linklerini tanımlayın</span>
                      </div>
                  </div>

                  <div className="Form-group">
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>
                          Şablon Adı | Şablon URL (Her satıra bir şablon)
                      </label>
                      <textarea 
                          className="FormControl" 
                          rows="4" 
                          value={this.canvaTemplateLinks} 
                          oninput={e => { this.canvaTemplateLinks = e.target.value; m.redraw(); }} 
                          placeholder="Ulaşım Arşiv Yeşil Hikaye Şablonu | https://www.canva.com/design/...&#10;Minimalist Beyaz Hikaye Şablonu | https://www.canva.com/design/..." 
                          style={{ fontFamily: 'monospace', fontSize: '13px', borderRadius: '8px' }}
                      ></textarea>
                      <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                          * Format: <code>Şablon Adı | Canva Şablon Paylaşım Linki</code>
                      </small>
                  </div>
              </div>
          </div>
      );
  }

  connectBrandCanva() {
      const w = 600, h = 750;
      const left = (window.innerWidth - w) / 2 + window.screenX;
      const top = (window.innerHeight - h) / 2 + window.screenY;

      const win = window.open('about:blank', 'canva_brand_oauth', `width=${w},height=${h},top=${top},left=${left},scrollbars=yes`);
      if (win && win.document) {
          try {
              win.document.write('<div style="font-family:system-ui,sans-serif;text-align:center;padding:50px 20px;color:#1e293b;"><div style="font-size:36px;margin-bottom:12px;">🏢</div><h3 style="margin:0 0 8px 0;color:#10b981;">Marka Canva Pro Bağlantısı</h3><p style="font-size:13px;color:#64748b;">ulasimarsivcom@gmail.com bağlantısı başlatılıyor...</p></div>');
          } catch(de) {}
      }

      app.request({
          method: 'GET',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/canva/auth?action=auth-url&account_type=brand'
      }).then(res => {
          if (res && res.auth_url) {
              if (win && !win.closed) {
                  win.location.href = res.auth_url;
              } else {
                  window.open(res.auth_url, 'canva_brand_oauth', `width=${w},height=${h},top=${top},left=${left},scrollbars=yes`);
              }
          } else {
              if (win) win.close();
              app.alerts.show({ type: 'error' }, 'Marka bağlantı adresi alınamadı.');
          }
      }).catch(e => {
          if (win) win.close();
          const msg = (e && e.response && e.response.error) || 'Marka Client ID veya Secret henüz tanımlanmamış.';
          app.alerts.show({ type: 'error' }, msg);
      });
  }

  // ==========================================
  // --- META BUSINESS SUITE ADMIN PANELİ ---
  // ==========================================

  getSelectedBusinessAccount() {
      if (!this.accounts || this.accounts.length === 0) return null;
      const idx = parseInt(this.businessAccountIndex || 0);
      return this.accounts[idx] || this.accounts[0];
  }

  loadBusinessData() {
      const acc = this.getSelectedBusinessAccount();
      if (!acc || !acc.token) {
          this.businessLoaded = true;
          this.businessLoading = false;
          m.redraw();
          return;
      }

      this.businessLoading = true;
      m.redraw();

      // Facebook Sayfası Bilgileri ve Feed Çek (Varsa)
      const pageId = acc.page_id || acc.fb_page_id;
      if (pageId) {
          app.request({
              method: 'GET',
              url: app.forum.attribute('apiUrl') + `/framio/social-share/meta-business?action=fb_insights&page_id=${encodeURIComponent(pageId)}&token=${encodeURIComponent(acc.token)}`,
              errorHandler: () => {}
          }).then(res => {
              if (res && res.success) {
                  this.businessFbProfile = res.profile;
                  this.businessFbInsights = res.insights;
              }
          }).catch(e => {
              console.warn('FB Insights yüklenemedi:', e);
          });

          app.request({
              method: 'GET',
              url: app.forum.attribute('apiUrl') + `/framio/social-share/meta-business?action=fb_feed&page_id=${encodeURIComponent(pageId)}&token=${encodeURIComponent(acc.token)}&limit=20`,
              errorHandler: () => {}
          }).then(fRes => {
              if (fRes && fRes.success && fRes.data && fRes.data.data) {
                  this.businessFbFeed = fRes.data.data;
              }
          }).catch(fe => {
              console.warn('FB Feed yüklenemedi:', fe);
          });
      }

      // Threads Bilgileri ve Gönderileri Çek (Varsa)
      const threadsId = acc.threads_user_id || acc.threads_id;
      const threadsToken = acc.threads_token || acc.token;
      if (threadsId && threadsToken) {
          app.request({
              method: 'GET',
              url: app.forum.attribute('apiUrl') + `/framio/social-share/meta-business?action=threads_profile&threads_id=${encodeURIComponent(threadsId)}&threads_token=${encodeURIComponent(threadsToken)}&token=${encodeURIComponent(threadsToken)}`,
              errorHandler: () => {}
          }).then(tRes => {
              if (tRes && tRes.success && tRes.profile) {
                  this.businessThreadsProfile = tRes.profile;
                  m.redraw();
              }
          }).catch(te => {
              console.warn('Threads Profili yüklenemedi:', te);
          });

          app.request({
              method: 'GET',
              url: app.forum.attribute('apiUrl') + `/framio/social-share/meta-business?action=threads_insights&threads_id=${encodeURIComponent(threadsId)}&threads_token=${encodeURIComponent(threadsToken)}&token=${encodeURIComponent(threadsToken)}`,
              errorHandler: () => {}
          }).then(tiRes => {
              if (tiRes && tiRes.success && tiRes.insights) {
                  this.businessThreadsInsights = tiRes.insights;
                  m.redraw();
              }
          }).catch(tie => {
              console.warn('Threads Insights yüklenemedi:', tie);
          });

          app.request({
              method: 'GET',
              url: app.forum.attribute('apiUrl') + `/framio/social-share/meta-business?action=threads_media_list&threads_id=${encodeURIComponent(threadsId)}&threads_token=${encodeURIComponent(threadsToken)}&token=${encodeURIComponent(threadsToken)}&limit=20`,
              errorHandler: () => {}
          }).then(tmRes => {
              if (tmRes && tmRes.success && tmRes.data && tmRes.data.data) {
                  this.businessThreadsFeed = tmRes.data.data;
                  m.redraw();
              }
          }).catch(tme => {
              console.warn('Threads Feed yüklenemedi:', tme);
          });
      }

      if (!acc.ig_id) {
          this.businessLoading = false;
          this.businessLoaded = true;
          m.redraw();
          return;
      }

      // Instagram Insights ve Profil Çek
      app.request({
          method: 'GET',
          url: app.forum.attribute('apiUrl') + `/framio/social-share/meta-business?action=insights&ig_id=${encodeURIComponent(acc.ig_id)}&token=${encodeURIComponent(acc.token)}`
      }).then(res => {
          if (res && res.success) {
              this.businessProfile = res.profile;
              this.businessInsights = res.insights;
          }
      }).catch(e => {
          console.warn('Insights yüklenemedi:', e);
      }).finally(() => {
          // Instagram Media Listesi Çek
          app.request({
              method: 'GET',
              url: app.forum.attribute('apiUrl') + `/framio/social-share/meta-business?action=media_list&ig_id=${encodeURIComponent(acc.ig_id)}&token=${encodeURIComponent(acc.token)}&limit=20`
          }).then(mRes => {
              if (mRes && mRes.success && mRes.data && mRes.data.data) {
                  this.businessMediaList = mRes.data.data;
              }
          }).catch(me => {
              console.warn('Media listesi yüklenemedi:', me);
          }).finally(() => {
              this.businessLoading = false;
              this.businessLoaded = true;
              m.redraw();
          });
      });
  }

  loadConversations() {
      const acc = this.getSelectedBusinessAccount();
      if (!acc || !acc.ig_id || !acc.token) return;

      this.businessConversationsLoading = true;
      m.redraw();

      app.request({
          method: 'GET',
          url: app.forum.attribute('apiUrl') + `/framio/social-share/meta-business?action=conversations&ig_id=${encodeURIComponent(acc.ig_id)}&token=${encodeURIComponent(acc.token)}`
      }).then(res => {
          if (res && res.success && res.data && res.data.data) {
              this.businessConversations = res.data.data;
          }
      }).catch(e => {
          console.warn('Mesajlar yüklenemedi:', e);
      }).finally(() => {
          this.businessConversationsLoading = false;
          m.redraw();
      });
  }

  loadConversationMessages(conv) {
      const acc = this.getSelectedBusinessAccount();
      if (!acc || !acc.token || !conv || !conv.id) return;

      this.selectedConversation = conv;
      this.conversationMessagesLoading = true;
      this.conversationMessages = [];
      m.redraw();

      app.request({
          method: 'GET',
          url: app.forum.attribute('apiUrl') + `/framio/social-share/meta-business?action=conversation_messages&conversation_id=${encodeURIComponent(conv.id)}&token=${encodeURIComponent(acc.token)}`
      }).then(res => {
          if (res && res.success && res.data && res.data.data) {
              this.conversationMessages = res.data.data;
          }
      }).catch(e => {
          app.alerts.show({ type: 'error' }, 'Mesajlar alınamadı: ' + ((e && e.response && e.response.error) || e.message));
      }).finally(() => {
          this.conversationMessagesLoading = false;
          m.redraw();
      });
  }

  loadCommentsForMedia(media) {
      const acc = this.getSelectedBusinessAccount();
      if (!acc || !acc.token || !media || !media.id) return;

      this.selectedMediaForComments = media;
      this.businessCommentsLoading = true;
      this.businessComments = [];
      m.redraw();

      app.request({
          method: 'GET',
          url: app.forum.attribute('apiUrl') + `/framio/social-share/meta-business?action=comments&media_id=${encodeURIComponent(media.id)}&ig_id=${encodeURIComponent(acc.ig_id)}&token=${encodeURIComponent(acc.token)}`
      }).then(res => {
          if (res && res.success && res.data && res.data.data) {
              this.businessComments = res.data.data;
          }
      }).catch(e => {
          app.alerts.show({ type: 'error' }, 'Yorumlar çekilemedi: ' + ((e && e.response && e.response.error) || e.message));
      }).finally(() => {
          this.businessCommentsLoading = false;
          m.redraw();
      });
  }

  replyToInstagramComment(commentId) {
      const acc = this.getSelectedBusinessAccount();
      const text = this.replyTextMap[commentId];
      if (!acc || !acc.token || !commentId || !text || !text.trim()) {
          app.alerts.show({ type: 'error' }, 'Lütfen yanıt metni yazın.');
          return;
      }

      app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/meta-business',
          body: {
              action: 'reply_comment',
              ig_id: acc.ig_id,
              token: acc.token,
              comment_id: commentId,
              message: text.trim()
          }
      }).then(res => {
          if (res && res.success) {
              app.alerts.show({ type: 'success' }, 'Yanıtınız Instagram\'da yayınlandı!');
              this.replyTextMap[commentId] = '';
              if (this.selectedMediaForComments) {
                  this.loadCommentsForMedia(this.selectedMediaForComments);
              }
          }
      }).catch(e => {
          app.alerts.show({ type: 'error' }, 'Yanıt gönderilemedi: ' + ((e && e.response && e.response.error) || e.message));
      });
  }

  moderateInstagramComment(commentId, hide = false) {
      const acc = this.getSelectedBusinessAccount();
      if (!acc || !acc.token || !commentId) return;

      if (!hide && !confirm('Bu yorumu silmek istediğinize emin misiniz?')) {
          return;
      }

      app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/meta-business',
          body: {
              action: 'moderate_comment',
              ig_id: acc.ig_id,
              token: acc.token,
              comment_id: commentId,
              hide: hide
          }
      }).then(res => {
          if (res && res.success) {
              app.alerts.show({ type: 'success' }, hide ? 'Yorum gizlendi/görünür yapıldı.' : 'Yorum başarıyla silindi.');
              if (this.selectedMediaForComments) {
                  this.loadCommentsForMedia(this.selectedMediaForComments);
              }
          }
      }).catch(e => {
          app.alerts.show({ type: 'error' }, 'İşlem başarısız: ' + ((e && e.response && e.response.error) || e.message));
      });
  }

  publishDirectStory() {
      const acc = this.getSelectedBusinessAccount();
      if (!acc || !acc.ig_id || !acc.token) {
          app.alerts.show({ type: 'error' }, 'Lütfen geçerli bir hesap seçin.');
          return;
      }
      if (!this.storyPublishUrl || !this.storyPublishUrl.trim()) {
          app.alerts.show({ type: 'error' }, 'Lütfen yayınlanacak hikaye görselinin URL\'ini girin.');
          return;
      }

      const body = {
          action: 'post_story',
          ig_id: acc.ig_id,
          token: acc.token,
          image_url: this.storyPublishUrl.trim()
      };

      if (this.storyScheduleEnabled) {
          if (!this.storyScheduleDate) {
              app.alerts.show({ type: 'error' }, 'Lütfen geçerli bir zamanlama tarihi seçin.');
              return;
          }
          body.scheduled_at = `${this.storyScheduleDate} ${this.storyScheduleHour || '20'}:${this.storyScheduleMinute || '00'}:00`;
      }

      this.storyPublishing = true;
      m.redraw();

      app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/meta-business',
          body: body
      }).then(res => {
          if (res && res.success) {
              if (res.scheduled) {
                  app.alerts.show({ type: 'success' }, '⏰ Hikaye başarıyla zamanlandı ve planlanan gönderiler kuyruğuna eklendi!');
              } else {
                  app.alerts.show({ type: 'success' }, '🎉 Hikaye başarıyla Instagram hesabınızda anında yayınlandı!');
              }
              this.storyPublishUrl = '';
              this.storyScheduleEnabled = false;
              this.loadBusinessData();
          }
      }).catch(e => {
          app.alerts.show({ type: 'error' }, 'Hikaye işlemi başarısız: ' + ((e && e.response && e.response.error) || e.message));
      }).finally(() => {
          this.storyPublishing = false;
          m.redraw();
      });
  }

  setStorySchedulePreset(hoursAhead, fixedHour, fixedMinute) {
      const now = new Date();
      if (hoursAhead !== null) {
          now.setHours(now.getHours() + hoursAhead);
      } else if (fixedHour !== null) {
          if (now.getHours() >= fixedHour) {
              now.setDate(now.getDate() + 1);
          }
          now.setHours(fixedHour, fixedMinute || 0, 0, 0);
      }
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      this.storyScheduleDate = `${yyyy}-${mm}-${dd}`;
      this.storyScheduleHour = String(now.getHours()).padStart(2, '0');
      this.storyScheduleMinute = String(now.getMinutes()).padStart(2, '0');
      this.storyScheduleEnabled = true;
      m.redraw();
  }

  renderFacebookPageSuite() {
      const acc = this.getSelectedBusinessAccount();
      const pageId = acc ? (acc.page_id || acc.fb_page_id) : null;

      if (!acc || !pageId || !acc.token) {
          return (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  <i className="fab fa-facebook" style={{ fontSize: '36px', color: '#1877f2', marginBottom: '10px' }}></i>
                  <h4 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>Facebook Sayfası Bağlantısı Bulunamadı</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                      Seçili hesapta Facebook Sayfa ID (page_id) veya Erişim Jetonu (token) tanımlı değil. Lütfen "Hesaplar" sekmesinden Facebook Sayfa ID bilginizi kontrol edin.
                  </p>
              </div>
          );
      }

      const prof = this.businessFbProfile;
      const insights = this.businessFbInsights;

      return (
          <div>
              {/* Facebook Profil & Beğeni Kartı */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)', padding: '18px 24px', borderRadius: '12px', border: '1.5px solid #dbeafe', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#1877f2', padding: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img 
                              src={(prof && prof.picture && prof.picture.data && prof.picture.data.url) || 'https://via.placeholder.com/60'} 
                              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', background: '#fff' }} 
                          />
                      </div>
                      <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>{(prof && prof.name) || 'Facebook Sayfası'}</h4>
                              <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>Facebook Page</span>
                          </div>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', maxWidth: '450px' }}>
                              {(prof && prof.about) || 'Ulaşım Arşiv Resmi Facebook Sayfası'}
                          </p>
                      </div>
                  </div>

                  <div style={{ display: 'flex', gap: '24px', marginLeft: 'auto' }}>
                      <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '20px', fontWeight: '800', color: '#1877f2' }}>{(prof && (prof.followers_count ?? prof.fan_count)) ?? '-'}</div>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Takipçi / Beğeni</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>{this.businessFbFeed.length}</div>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Son Gönderiler</div>
                      </div>
                  </div>
              </div>

              {/* Alt Menü Tabları (Facebook) */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  <button 
                      type="button" 
                      onclick={() => this.businessFbActiveSubTab = 'overview'}
                      style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', border: 'none', background: this.businessFbActiveSubTab === 'overview' ? '#1877f2' : '#f1f5f9', color: this.businessFbActiveSubTab === 'overview' ? '#fff' : '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                      <i className="fas fa-chart-line"></i> İstatistikler (Insights)
                  </button>
                  <button 
                      type="button" 
                      onclick={() => this.businessFbActiveSubTab = 'media'}
                      style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', border: 'none', background: this.businessFbActiveSubTab === 'media' ? '#1877f2' : '#f1f5f9', color: this.businessFbActiveSubTab === 'media' ? '#fff' : '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                      <i className="fas fa-images"></i> Sayfa Gönderileri & Yorumlar
                  </button>
                  <button 
                      type="button" 
                      onclick={() => {
                          this.businessFbActiveSubTab = 'inbox';
                          this.loadFbConversations();
                      }}
                      style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', border: 'none', background: this.businessFbActiveSubTab === 'inbox' ? '#1877f2' : '#f1f5f9', color: this.businessFbActiveSubTab === 'inbox' ? '#fff' : '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                      <i className="fab fa-facebook-messenger"></i> Messenger Mesajları
                  </button>
                  <button 
                      type="button" 
                      onclick={() => this.businessFbActiveSubTab = 'story_publish'}
                      style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', border: 'none', background: this.businessFbActiveSubTab === 'story_publish' ? '#1877f2' : '#f1f5f9', color: this.businessFbActiveSubTab === 'story_publish' ? '#fff' : '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                      <i className="fas fa-plus-circle"></i> Facebook Hikaye Yayınla
                  </button>
              </div>

              {/* 1. SEKME: FACEBOOK İSTATİSTİKLER (INSIGHTS) */}
              {this.businessFbActiveSubTab === 'overview' ? (
                  <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>SAYFA GÖRÜNTÜLENMESİ</span>
                                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', color: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <i className="fas fa-eye"></i>
                                  </div>
                              </div>
                              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
                                  {(() => {
                                      const item = insights && insights.data && insights.data.find(d => d.name === 'page_views_total');
                                      return (item && item.values && item.values[0] && item.values[0].value !== undefined) ? item.values[0].value : 'Aktif';
                                  })()}
                              </div>
                              <span style={{ fontSize: '11px', color: '#1877f2', fontWeight: '600' }}>👁️ Toplam sayfa görüntülenmesi</span>
                          </div>

                          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>GÖNDERİ ETKİLEŞİMİ</span>
                                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <i className="fas fa-thumbs-up"></i>
                                  </div>
                              </div>
                              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
                                  {(() => {
                                      const item = insights && insights.data && insights.data.find(d => d.name === 'page_post_engagements');
                                      return (item && item.values && item.values[0] && item.values[0].value !== undefined) ? item.values[0].value : 'Aktif';
                                  })()}
                              </div>
                              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>👍 Gönderi reaksiyon ve yorumları</span>
                          </div>

                          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>YENİ TAKİPÇİLER</span>
                                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fdf2f8', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <i className="fas fa-user-plus"></i>
                                  </div>
                              </div>
                              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
                                  {(() => {
                                      const item = insights && insights.data && insights.data.find(d => d.name === 'page_daily_follows');
                                      return (item && item.values && item.values[0] && item.values[0].value !== undefined) ? item.values[0].value : 'Aktif';
                                  })()}
                              </div>
                              <span style={{ fontSize: '11px', color: '#ec4899', fontWeight: '600' }}>👥 Sayfayı takip eden yeni kullanıcılar</span>
                          </div>
                      </div>

                      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>ℹ️ Facebook Sayfa Bilgilendirmesi</h4>
                          <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                              Facebook Sayfa istatistikleri doğrudan Meta Graph API üzerinden çekilmektedir. Gönderi yorumlarını yanıtlayabilir, silebilir veya gizleyebilirsiniz.
                          </p>
                      </div>
                  </div>
              ) : null}

              {/* 2. SEKME: GÖNDERİLER & YORUM YÖNETİMİ (FACEBOOK) */}
              {this.businessFbActiveSubTab === 'media' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: this.selectedFbMediaForComments ? '1.1fr 1.1fr' : '1fr', gap: '20px' }}>
                      <div>
                          <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>Sayfa Gönderileri ({this.businessFbFeed.length})</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px', maxHeight: '650px', overflowY: 'auto' }}>
                              {this.businessFbFeed.map(post => {
                                  const isSelected = this.selectedFbMediaForComments && this.selectedFbMediaForComments.id === post.id;
                                  return (
                                      <div 
                                          style={{ 
                                              background: '#ffffff', 
                                              border: isSelected ? '2px solid #1877f2' : '1px solid #e2e8f0', 
                                              borderRadius: '10px', 
                                              overflow: 'hidden', 
                                              cursor: 'pointer',
                                              transition: 'all 0.2s',
                                              boxShadow: isSelected ? '0 4px 12px rgba(24, 119, 242, 0.2)' : 'none'
                                          }}
                                          onclick={() => this.loadCommentsForFbMedia(post)}
                                      >
                                          {post.full_picture && (
                                              <div style={{ width: '100%', height: '140px', background: '#0f172a' }}>
                                                  <img src={post.full_picture} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                              </div>
                                          )}
                                          <div style={{ padding: '12px' }}>
                                              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e293b', fontWeight: '600', height: '36px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                  {post.message || 'Görsel / Bağlantı paylaşımı'}
                                              </p>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>
                                                  <span>👍 {post.likes && post.likes.summary ? post.likes.summary.total_count : 0} Beğeni</span>
                                                  <span style={{ color: '#1877f2' }}>💬 {post.comments && post.comments.summary ? post.comments.summary.total_count : 0} Yorum</span>
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>

                      {/* Yan Panel: Seçili FB Gönderisinin Detayları & Yorumları */}
                      {this.selectedFbMediaForComments ? (
                          <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '650px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>Facebook Gönderi Yorumları</h4>
                                  <button 
                                      type="button" 
                                      onclick={() => this.selectedFbMediaForComments = null}
                                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}
                                  >
                                      <i className="fas fa-times"></i>
                                  </button>
                              </div>

                              <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '10px', marginBottom: '14px' }}>
                                  <p style={{ margin: 0, fontSize: '12px', color: '#334155' }}>{this.selectedFbMediaForComments.message || 'Gönderi'}</p>
                              </div>

                              {/* Yorumlar Listesi */}
                              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
                                  {this.businessFbCommentsLoading ? (
                                      <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                                          <i className="fas fa-spinner fa-spin fa-2x"></i>
                                      </div>
                                  ) : this.businessFbComments.length === 0 ? (
                                      <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                                          <i className="far fa-comments fa-2x" style={{ marginBottom: '8px', display: 'block' }}></i>
                                          Bu gönderiye henüz yorum yapılmamış.
                                      </div>
                                  ) : (
                                      this.businessFbComments.map(comment => (
                                          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                  <span style={{ fontWeight: '700', fontSize: '12px', color: '#0f172a' }}>
                                                      {(comment.from && comment.from.name) || 'Kullanıcı'}
                                                  </span>
                                                  <div style={{ display: 'flex', gap: '8px' }}>
                                                      <button 
                                                          type="button" 
                                                          title={comment.is_hidden ? 'Gizlemeyi Kaldır' : 'Gizle'}
                                                          onclick={() => this.moderateFbComment(comment.id, !comment.is_hidden)}
                                                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px' }}
                                                      >
                                                          <i className={comment.is_hidden ? 'fas fa-eye' : 'fas fa-eye-slash'}></i>
                                                      </button>
                                                      <button 
                                                          type="button" 
                                                          title="Sil"
                                                          onclick={() => this.moderateFbComment(comment.id, false)}
                                                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}
                                                      >
                                                          <i className="fas fa-trash-alt"></i>
                                                      </button>
                                                  </div>
                                              </div>
                                              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#334155' }}>{comment.message}</p>
                                              
                                              {/* Yanıt Yazma Alanı */}
                                              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                                  <input 
                                                      type="text" 
                                                      className="FormControl" 
                                                      placeholder="Yanıtınızı yazın..." 
                                                      value={this.fbReplyTextMap[comment.id] || ''} 
                                                      oninput={e => this.fbReplyTextMap[comment.id] = e.target.value} 
                                                      style={{ height: '30px', fontSize: '11px', borderRadius: '6px' }} 
                                                  />
                                                  <button 
                                                      type="button" 
                                                      onclick={() => this.replyToFbComment(comment.id)} 
                                                      style={{ background: '#1877f2', color: '#fff', border: 'none', borderRadius: '6px', padding: '0 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                                  >
                                                      Yanıtla
                                                  </button>
                                              </div>
                                          </div>
                                      ))
                                  )}
                              </div>
                          </div>
                      ) : null}
                  </div>
              ) : null}

              {/* 3. SEKME: MESSENGER GELEN MESAJLAR (FACEBOOK) */}
              {this.businessFbActiveSubTab === 'inbox' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: this.selectedFbConversation ? '1fr 1.3fr' : '1fr', gap: '20px' }}>
                      <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '18px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                                  <i className="fab fa-facebook-messenger" style={{ color: '#1877f2', marginRight: '6px' }}></i> Messenger Sohbetleri
                              </h4>
                              <Button 
                                  className="Button" 
                                  loading={this.businessFbConversationsLoading} 
                                  onclick={() => this.loadFbConversations()}
                                  style={{ fontSize: '12px', height: '32px' }}
                              >
                                  Yenile
                              </Button>
                          </div>

                          {this.businessFbConversationsLoading && (
                              <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                                  <i className="fas fa-spinner fa-spin fa-2x"></i>
                              </div>
                          )}

                          {!this.businessFbConversationsLoading && (!this.businessFbConversations || this.businessFbConversations.length === 0) && (
                              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                                  <i className="fab fa-facebook-messenger fa-2x" style={{ color: '#94a3b8', marginBottom: '8px' }}></i>
                                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Henüz Messenger mesajı bulunamadı.</p>
                                  <small style={{ color: '#94a3b8', display: 'block', marginTop: '4px' }}>Meta Graph API üzerinden Messenger mesajları için <code>pages_messaging</code> izni gereklidir.</small>
                              </div>
                          )}

                          {!this.businessFbConversationsLoading && this.businessFbConversations && this.businessFbConversations.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto' }}>
                                  {this.businessFbConversations.map(conv => {
                                      const isSelected = this.selectedFbConversation && this.selectedFbConversation.id === conv.id;
                                      const participants = (conv.participants && conv.participants.data) || [];
                                      const otherUser = participants.find(p => p.id !== pageId) || participants[0] || { name: 'Kullanıcı' };

                                      return (
                                          <div 
                                              style={{
                                                  padding: '12px 14px',
                                                  background: isSelected ? '#eff6ff' : '#ffffff',
                                                  border: isSelected ? '1.5px solid #1877f2' : '1px solid #e2e8f0',
                                                  borderRadius: '10px',
                                                  cursor: 'pointer',
                                                  transition: 'all 0.15s'
                                              }}
                                              onclick={() => this.loadFbConversationMessages(conv)}
                                          >
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                  <span style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a' }}>
                                                      {otherUser.name || 'Facebook Kullanıcısı'}
                                                  </span>
                                                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{conv.updated_time ? new Date(conv.updated_time).toLocaleDateString('tr-TR') : ''}</span>
                                              </div>
                                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                  Toplam {conv.message_count ?? '-'} mesaj
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>

                      {/* Sohbet Mesajları Paneli */}
                      {this.selectedFbConversation ? (
                          <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '600px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>Messenger Mesaj Geçmişi</h4>
                                  <button 
                                      type="button" 
                                      onclick={() => this.selectedFbConversation = null}
                                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}
                                  >
                                      <i className="fas fa-times"></i>
                                  </button>
                              </div>

                              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 0' }}>
                                  {this.businessFbConversationMessagesLoading ? (
                                      <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                                          <i className="fas fa-spinner fa-spin fa-2x"></i>
                                      </div>
                                  ) : this.businessFbConversationMessages.length === 0 ? (
                                      <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                                          <p style={{ margin: 0, fontSize: '12px' }}>Mesaj bulunamadı.</p>
                                      </div>
                                  ) : (
                                      this.businessFbConversationMessages.map(msg => {
                                          const isFromMe = msg.from && msg.from.id === pageId;
                                          return (
                                              <div style={{ alignSelf: isFromMe ? 'flex-end' : 'flex-start', maxWidth: '75%', background: isFromMe ? '#1877f2' : '#ffffff', color: isFromMe ? '#ffffff' : '#1e293b', padding: '10px 14px', borderRadius: '12px', border: isFromMe ? 'none' : '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                  <div style={{ fontSize: '10px', opacity: 0.75, marginBottom: '2px' }}>
                                                      {msg.from && (msg.from.name || msg.from.username)}
                                                  </div>
                                                  <div style={{ fontSize: '12px', lineHeight: '1.4' }}>{msg.message}</div>
                                              </div>
                                          );
                                      })
                                  )}
                              </div>
                          </div>
                      ) : null}
                  </div>
              ) : null}

              {/* 4. SEKME: FACEBOOK HİKAYE YAYINLAMA VE ZAMANLAMA */}
              {this.businessFbActiveSubTab === 'story_publish' ? (
                  <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1.5px solid #e2e8f0', maxWidth: '640px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #1877f2 0%, #0064e0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px' }}>
                              <i className="fab fa-facebook"></i>
                          </div>
                          <div>
                              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Facebook Sayfasında Hikaye Yayınla & Zamanla</h4>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>Anında paylaşın veya istediğiniz ileri bir tarihe zamanlayın</span>
                          </div>
                      </div>

                      <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b' }}>
                          9:16 dikey görsel URL'ini girerek veya cihazınızdan yükleyerek tek tıkla Facebook Sayfanızda Hikaye olarak paylaşabilir ya da zamanlayabilirsiniz.
                      </p>

                      <div style={{ marginBottom: '16px' }}>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>Hikaye Görsel URL'i veya Dosyadan Yükle:</label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                              <input 
                                  className="FormControl" 
                                  placeholder="https://forum.ulasimarsiv.com/assets/..." 
                                  value={this.fbStoryPublishUrl} 
                                  oninput={e => this.fbStoryPublishUrl = e.target.value} 
                                  style={{ height: '38px', borderRadius: '8px', fontSize: '13px', flex: 1 }} 
                              />
                              <label className="Button" style={{ borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                  <i className="fas fa-upload"></i> Cihazdan Seç
                                  <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onchange={this.uploadFbStoryToPublish.bind(this)} />
                              </label>
                          </div>
                      </div>

                      {/* Zamanlama Seçenekleri Kutusu */}
                      <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: this.fbStoryScheduleEnabled ? '12px' : '0' }}>
                              <label style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                                  <input 
                                      type="checkbox" 
                                      checked={this.fbStoryScheduleEnabled} 
                                      onchange={e => { this.fbStoryScheduleEnabled = e.target.checked; m.redraw(); }} 
                                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                  />
                                  <i className="fas fa-clock" style={{ color: '#1877f2' }}></i> Bu Hikayeyi İleri Bir Tarihe Zamanla
                              </label>
                              {this.fbStoryScheduleEnabled && (
                                  <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                                      Kuyruğa Eklenecek
                                  </span>
                              )}
                          </div>

                          {this.fbStoryScheduleEnabled && (
                              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                                      <div style={{ flex: 1, minWidth: '150px' }}>
                                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Tarih</label>
                                          <input 
                                              type="date" 
                                              className="FormControl" 
                                              value={this.fbStoryScheduleDate} 
                                              oninput={e => this.fbStoryScheduleDate = e.target.value} 
                                              style={{ height: '36px', borderRadius: '6px', fontSize: '13px' }} 
                                          />
                                      </div>
                                      <div style={{ width: '85px' }}>
                                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Saat</label>
                                          <select 
                                              className="FormControl" 
                                              value={this.fbStoryScheduleHour} 
                                              onchange={e => this.fbStoryScheduleHour = e.target.value} 
                                              style={{ height: '36px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}
                                          >
                                              {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                                                  <option value={h}>{h}:00</option>
                                              ))}
                                          </select>
                                      </div>
                                      <div style={{ width: '85px' }}>
                                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Dakika</label>
                                          <select 
                                              className="FormControl" 
                                              value={this.fbStoryScheduleMinute} 
                                              onchange={e => this.fbStoryScheduleMinute = e.target.value} 
                                              style={{ height: '36px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}
                                          >
                                              {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(minVal => (
                                                  <option value={minVal}>{minVal}</option>
                                              ))}
                                          </select>
                                      </div>
                                  </div>

                                  {/* Hızlı Seçim Butonları */}
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                      <button 
                                          type="button" 
                                          onclick={() => this.setFbStorySchedulePreset(1, null, null)}
                                          style={{ border: '1px solid #cbd5e1', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                                      >
                                          ⚡ +1 Saat Sonra
                                      </button>
                                      <button 
                                          type="button" 
                                          onclick={() => this.setFbStorySchedulePreset(null, 20, 0)}
                                          style={{ border: '1px solid #cbd5e1', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                                      >
                                          🌙 Bu Akşam 20:00
                                      </button>
                                      <button 
                                          type="button" 
                                          onclick={() => this.setFbStorySchedulePreset(null, 10, 0)}
                                          style={{ border: '1px solid #cbd5e1', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                                      >
                                          ☀️ Yarın 10:00
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>

                      <Button 
                          className="Button Button--primary" 
                          loading={this.fbStoryPublishing} 
                          onclick={() => this.publishDirectFbStory()} 
                          style={{ 
                              background: 'linear-gradient(135deg, #1877f2 0%, #0064e0 100%)', 
                              border: 'none', 
                              height: '42px', 
                              fontWeight: '700', 
                              borderRadius: '8px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              gap: '8px',
                              width: '100%',
                              fontSize: '13px'
                          }}
                      >
                          <i className={this.fbStoryScheduleEnabled ? 'fas fa-calendar-check' : 'fab fa-facebook'}></i>
                          {this.fbStoryPublishing 
                              ? (this.fbStoryScheduleEnabled ? 'Hikaye Zamanlanıyor...' : 'Hikaye Paylaşılıyor...') 
                              : (this.fbStoryScheduleEnabled ? '⏰ Facebook Hikayesini Belirlenen Saatte Planla' : "Facebook Sayfasında Hikaye Olarak Paylaş")}
                      </Button>
                  </div>
              ) : null}
          </div>
      );
  }

  renderThreadsSuite() {
      const acc = this.getSelectedBusinessAccount();
      const threadsId = acc ? (acc.threads_user_id || acc.threads_id) : null;

      const threadsToken = acc.threads_token || acc.token;

      if (!acc || !threadsId || !threadsToken) {
          return (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  <i className="fab fa-threads" style={{ fontSize: '36px', color: '#000000', marginBottom: '10px' }}></i>
                  <h4 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>Threads Hesabı Bağlantısı Bulunamadı</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                      Seçili hesapta Threads User ID (threads_id) veya Erişim Jetonu tanımlı değil. Lütfen "Hesaplar" sekmesinden Threads ID bilginizi kontrol edin.
                  </p>
              </div>
          );
      }

      const prof = this.businessThreadsProfile;
      const insights = this.businessThreadsInsights;

      return (
          <div>
              {/* Threads Profil Kartı */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: '20px 24px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#000', border: '2px solid #fff', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img 
                              src={(prof && prof.threads_profile_picture_url) || (prof && prof.profile_picture_url) || 'https://via.placeholder.com/60'} 
                              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', background: '#fff' }} 
                          />
                      </div>
                      <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>@{(prof && (prof.username || prof.name)) || 'ulasimarsiv'}</h4>
                              <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>Threads Profile</span>
                          </div>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#cbd5e1', maxWidth: '450px' }}>
                              {(prof && prof.threads_biography) || (prof && prof.biography) || 'Ulaşım araçlarına yönelik görsel içerikler ve sektör gelişmeleri sunan dijital içerik kanalı.'}
                          </p>
                      </div>
                  </div>

                  <div style={{ display: 'flex', gap: '24px', marginLeft: 'auto' }}>
                      <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff' }}>{(prof && (prof.followers_count ?? prof.follower_count)) ? (prof.followers_count ?? prof.follower_count) : 'Aktif'}</div>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Hesap Durumu</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff' }}>{this.businessThreadsFeed.length}</div>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Threads Gönderileri</div>
                      </div>
                  </div>
              </div>

              {/* Threads Insights Kartları */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>GÖRÜNTÜLENME (VIEWS)</span>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <i className="fas fa-eye"></i>
                          </div>
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
                          {(() => {
                              const item = insights && insights.data && insights.data.find(d => d.name === 'views');
                              return (item && item.total_value && item.total_value.value !== undefined) ? item.total_value.value : ((item && item.values && item.values[0]) ? item.values[0].value : '0');
                          })()}
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>👀 Threads akış görüntülenmeleri</span>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>BEĞENİLER (LIKES)</span>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <i className="fas fa-heart"></i>
                          </div>
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
                          {(() => {
                              const item = insights && insights.data && insights.data.find(d => d.name === 'likes');
                              return (item && item.total_value && item.total_value.value !== undefined) ? item.total_value.value : ((item && item.values && item.values[0]) ? item.values[0].value : '0');
                          })()}
                      </div>
                      <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600' }}>❤️ Toplam Threads beğenileri</span>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>YANITLAR (REPLIES)</span>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <i className="fas fa-reply"></i>
                          </div>
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
                          {(() => {
                              const item = insights && insights.data && insights.data.find(d => d.name === 'replies');
                              return (item && item.total_value && item.total_value.value !== undefined) ? item.total_value.value : ((item && item.values && item.values[0]) ? item.values[0].value : '0');
                          })()}
                      </div>
                      <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: '600' }}>💬 Threads iletilerine gelen yanıtlar</span>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>YENİDEN PAYLAŞIM (REPOSTS)</span>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <i className="fas fa-retweet"></i>
                          </div>
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
                          {(() => {
                              const item = insights && insights.data && insights.data.find(d => d.name === 'reposts');
                              return (item && item.total_value && item.total_value.value !== undefined) ? item.total_value.value : ((item && item.values && item.values[0]) ? item.values[0].value : '0');
                          })()}
                      </div>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>🔁 Yeniden paylaşılan Threads sayısı</span>
                  </div>
              </div>

              {/* Son Paylaşılan Threads Gönderileri */}
              <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                      <i className="fab fa-threads" style={{ marginRight: '6px' }}></i> Son Paylaşılan Threads Gönderileri ({this.businessThreadsFeed.length})
                  </h4>

                  {this.businessThreadsFeed.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                          <i className="fab fa-threads fa-2x" style={{ marginBottom: '8px', display: 'block' }}></i>
                          Henüz Threads gönderisi bulunamadı veya yükleniyor...
                      </div>
                  ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', maxHeight: '600px', overflowY: 'auto' }}>
                          {this.businessThreadsFeed.map(item => (
                              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  {item.media_url && (
                                      <div style={{ width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                                          <img src={item.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      </div>
                                  )}
                                  <p style={{ margin: 0, fontSize: '13px', color: '#1e293b', lineHeight: '1.4', maxHeight: '60px', overflowY: 'auto' }}>
                                      {item.text || <em style={{ color: '#94a3b8' }}>Metinsiz paylaşım</em>}
                                  </p>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '8px', fontSize: '11px', color: '#64748b' }}>
                                      <span>{item.timestamp ? new Date(item.timestamp).toLocaleDateString('tr-TR') : ''}</span>
                                      {item.permalink && (
                                          <a href={item.permalink} target="_blank" rel="noopener noreferrer" style={{ color: '#000000', fontWeight: '700', textDecoration: 'none' }}>
                                              Threads'te Aç ↗
                                          </a>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      );
  }

  renderBusinessSuite() {
      const acc = this.getSelectedBusinessAccount();

      return (
          <div className="BusinessSuite-Container" style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
              
              {/* Üst Bar: Hesap Seçici & Yenile */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', paddingBottom: '20px', borderBottom: '1.5px solid #f1f5f9', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #0081fb 0%, #0064e0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px', boxShadow: '0 4px 12px rgba(0, 129, 251, 0.3)' }}>
                          <i className="fab fa-facebook"></i>
                      </div>
                      <div>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>Meta Business Suite Paneli</h3>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>Instagram & Facebook hesap istatistikleri, gelen yorumlar ve doğrudan hikaye yönetimi</span>
                      </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#334155' }}>Hesap:</label>
                      <select 
                          className="FormControl" 
                          value={this.businessAccountIndex} 
                          onchange={e => { this.businessAccountIndex = parseInt(e.target.value); this.loadBusinessData(); }}
                          style={{ width: '220px', height: '38px', borderRadius: '8px', fontWeight: '600', fontSize: '13px' }}
                      >
                          {this.accounts.map((a, i) => (
                              <option value={i}>{a.name || `Hesap #${i + 1}`}</option>
                          ))}
                      </select>

                      <Button 
                          className="Button Button--primary" 
                          loading={this.businessLoading} 
                          onclick={() => this.loadBusinessData()}
                          style={{ height: '38px', borderRadius: '8px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                          <i className="fas fa-sync-alt"></i> Verileri Yenile
                      </Button>
                  </div>
              </div>

              {/* Platform Seçici (Instagram vs Facebook vs Threads) */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <button 
                      type="button" 
                      onclick={() => { this.businessPlatform = 'instagram'; m.redraw(); }}
                      style={{ 
                          padding: '10px 20px', 
                          borderRadius: '10px', 
                          fontWeight: '800', 
                          fontSize: '14px', 
                          cursor: 'pointer', 
                          border: this.businessPlatform === 'instagram' ? '2px solid #e1306c' : '1px solid #e2e8f0', 
                          background: this.businessPlatform === 'instagram' ? 'linear-gradient(135deg, #fdf2f8 0%, #fff 100%)' : '#ffffff', 
                          color: this.businessPlatform === 'instagram' ? '#e1306c' : '#64748b', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          boxShadow: this.businessPlatform === 'instagram' ? '0 4px 12px rgba(225, 48, 108, 0.15)' : 'none'
                      }}
                  >
                      <i className="fab fa-instagram" style={{ fontSize: '18px' }}></i> Instagram Hesabı
                  </button>

                  <button 
                      type="button" 
                      onclick={() => { this.businessPlatform = 'facebook'; m.redraw(); }}
                      style={{ 
                          padding: '10px 20px', 
                          borderRadius: '10px', 
                          fontWeight: '800', 
                          fontSize: '14px', 
                          cursor: 'pointer', 
                          border: this.businessPlatform === 'facebook' ? '2px solid #1877f2' : '1px solid #e2e8f0', 
                          background: this.businessPlatform === 'facebook' ? 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)' : '#ffffff', 
                          color: this.businessPlatform === 'facebook' ? '#1877f2' : '#64748b', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          boxShadow: this.businessPlatform === 'facebook' ? '0 4px 12px rgba(24, 119, 242, 0.15)' : 'none'
                      }}
                  >
                      <i className="fab fa-facebook" style={{ fontSize: '18px' }}></i> Facebook Sayfası
                  </button>

                  <button 
                      type="button" 
                      onclick={() => { this.businessPlatform = 'threads'; m.redraw(); }}
                      style={{ 
                          padding: '10px 20px', 
                          borderRadius: '10px', 
                          fontWeight: '800', 
                          fontSize: '14px', 
                          cursor: 'pointer', 
                          border: this.businessPlatform === 'threads' ? '2px solid #000000' : '1px solid #e2e8f0', 
                          background: this.businessPlatform === 'threads' ? '#000000' : '#ffffff', 
                          color: this.businessPlatform === 'threads' ? '#ffffff' : '#0f172a', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          boxShadow: this.businessPlatform === 'threads' ? '0 4px 12px rgba(0, 0, 0, 0.2)' : 'none'
                      }}
                  >
                      <i className="fab fa-threads" style={{ fontSize: '18px' }}></i> Threads Hesabı
                  </button>
              </div>

              {this.businessPlatform === 'facebook' ? (typeof this.renderFacebookPageSuite === 'function' ? this.renderFacebookPageSuite() : null) : (this.businessPlatform === 'threads' ? (typeof this.renderThreadsSuite === 'function' ? this.renderThreadsSuite() : null) : (
                  !acc || !acc.ig_id || !acc.token ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                          <i className="fas fa-exclamation-circle" style={{ fontSize: '36px', color: '#f59e0b', marginBottom: '10px' }}></i>
                          <h4 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>Instagram Bağlantısı Bulunamadı</h4>
                          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Bu hesabın Instagram ID (ig_id) ve Erişim Jetonu (Token) alanları dolu olmalıdır. Lütfen "Hesaplar" sekmesinden kontrol edin.</p>
                      </div>
                  ) : (
                  <div>
                      {/* Profil & Hızlı Özet Kartı */}
                      {this.businessProfile ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', padding: '18px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', padding: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <img 
                                          src={this.businessProfile.profile_picture_url || 'https://via.placeholder.com/60'} 
                                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', background: '#fff' }} 
                                      />
                                  </div>
                                  <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>@{this.businessProfile.username}</h4>
                                          <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>Instagram Business</span>
                                      </div>
                                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', maxWidth: '450px' }}>{this.businessProfile.biography || this.businessProfile.name || 'Biyografi bilgisi yok'}</p>
                                  </div>
                              </div>

                              <div style={{ display: 'flex', gap: '24px', marginLeft: 'auto' }}>
                                  <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>{this.businessProfile.followers_count ?? '-'}</div>
                                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Takipçi</div>
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>{this.businessProfile.follows_count ?? '-'}</div>
                                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Takip Edilen</div>
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>{this.businessProfile.media_count ?? '-'}</div>
                                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Toplam Gönderi</div>
                                  </div>
                              </div>
                          </div>
                      ) : null}

                      {/* Alt Menü Tabları */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                          <button 
                              type="button" 
                              onclick={() => this.businessActiveSubTab = 'overview'}
                              style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', border: 'none', background: this.businessActiveSubTab === 'overview' ? '#0081fb' : '#f1f5f9', color: this.businessActiveSubTab === 'overview' ? '#fff' : '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                              <i className="fas fa-chart-line"></i> İstatistikler (Insights)
                          </button>
                          <button 
                              type="button" 
                              onclick={() => this.businessActiveSubTab = 'media'}
                              style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', border: 'none', background: this.businessActiveSubTab === 'media' ? '#0081fb' : '#f1f5f9', color: this.businessActiveSubTab === 'media' ? '#fff' : '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                              <i className="fas fa-images"></i> Son Gönderiler & Yorumlar
                          </button>
                          <button 
                              type="button" 
                              onclick={() => {
                                  this.businessActiveSubTab = 'inbox';
                                  this.loadConversations();
                              }}
                              style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', border: 'none', background: this.businessActiveSubTab === 'inbox' ? '#0081fb' : '#f1f5f9', color: this.businessActiveSubTab === 'inbox' ? '#fff' : '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                              <i className="fas fa-comments"></i> 💬 Gelen Mesajlar (DM)
                          </button>
                          <button 
                              type="button" 
                              onclick={() => this.businessActiveSubTab = 'story_publish'}
                              style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', border: 'none', background: this.businessActiveSubTab === 'story_publish' ? '#0081fb' : '#f1f5f9', color: this.businessActiveSubTab === 'story_publish' ? '#fff' : '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                              <i className="fas fa-plus-circle"></i> Doğrudan Hikaye Yayınla
                          </button>
                      </div>

                      {/* 1. SEKME: İSTATİSTİKLER (INSIGHTS) */}
                      {this.businessActiveSubTab === 'overview' ? (
                          <div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>HESAP ERİŞİMİ (REACH)</span>
                                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                              <i className="fas fa-users"></i>
                                          </div>
                                      </div>
                                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
                                          {(() => {
                                              const item = this.businessInsights && this.businessInsights.data && this.businessInsights.data.find(d => d.name === 'reach');
                                              if (!item) return '-';
                                              if (item.total_value && item.total_value.value !== undefined) return item.total_value.value;
                                              return item.values && item.values[0] ? item.values[0].value : '0';
                                          })()}
                                      </div>
                                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>✨ Organik hesap erişimi</span>
                                  </div>

                                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>GÖRÜNTÜLENME (VIEWS)</span>
                                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                              <i className="fas fa-eye"></i>
                                          </div>
                                      </div>
                                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
                                          {(() => {
                                              const item = this.businessInsights && this.businessInsights.data && this.businessInsights.data.find(d => d.name === 'views');
                                              if (!item) return '-';
                                              if (item.total_value && item.total_value.value !== undefined) return item.total_value.value;
                                              return item.values && item.values[0] ? item.values[0].value : '0';
                                          })()}
                                      </div>
                                      <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '600' }}>📈 Akış, Reels ve Keşfet</span>
                                  </div>

                                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>PROFİL ZİYARETLERİ</span>
                                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fdf2f8', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                              <i className="fas fa-id-badge"></i>
                                          </div>
                                      </div>
                                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
                                          {(() => {
                                              const item = this.businessInsights && this.businessInsights.data && this.businessInsights.data.find(d => d.name === 'profile_views');
                                              if (!item) return '-';
                                              if (item.total_value && item.total_value.value !== undefined) return item.total_value.value;
                                              return item.values && item.values[0] ? item.values[0].value : '0';
                                          })()}
                                      </div>
                                      <span style={{ fontSize: '11px', color: '#ec4899', fontWeight: '600' }}>👤 Doğrudan profil tıklamaları</span>
                                  </div>

                                  <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>TOPLAM ETKİLEŞİM</span>
                                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                              <i className="fas fa-heart"></i>
                                          </div>
                                      </div>
                                      <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
                                          {(() => {
                                              const item = this.businessInsights && this.businessInsights.data && this.businessInsights.data.find(d => d.name === 'total_interactions');
                                              if (!item) return '-';
                                              if (item.total_value && item.total_value.value !== undefined) return item.total_value.value;
                                              return item.values && item.values[0] ? item.values[0].value : '0';
                                          })()}
                                      </div>
                                      <span style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: '600' }}>💬 Beğeni, yorum ve paylaşım</span>
                                  </div>
                              </div>

                              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>ℹ️ Meta Insights Bilgilendirmesi</h4>
                                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                                      Meta Graph API gereği detaylı günlük etkileşim grafikleri sayfanız 100+ takipçiye ulaştığında ve Meta App üzerinde <code>instagram_manage_insights</code> izni aktif edildiğinde otomatik olarak grafikleşir.
                                  </p>
                              </div>
                          </div>
                      ) : null}

                      {/* 2. SEKME: GÖNDERİLER & YORUM YÖNETİMİ */}
                      {this.businessActiveSubTab === 'media' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: this.selectedMediaForComments ? '1.1fr 1.1fr' : '1fr', gap: '20px' }}>
                              <div>
                                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>Son Paylaşılan Gönderiler ({this.businessMediaList.length})</h4>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', maxHeight: '650px', overflowY: 'auto' }}>
                                      {this.businessMediaList.map(item => {
                                          const isSelected = this.selectedMediaForComments && this.selectedMediaForComments.id === item.id;
                                          const isVideo = item.media_type === 'VIDEO';
                                          const mediaSrc = item.thumbnail_url || item.media_url;

                                          return (
                                              <div 
                                                  style={{ 
                                                      background: '#ffffff', 
                                                      border: isSelected ? '2px solid #0081fb' : '1px solid #e2e8f0', 
                                                      borderRadius: '10px', 
                                                      overflow: 'hidden', 
                                                      cursor: 'pointer',
                                                      transition: 'all 0.2s',
                                                      boxShadow: isSelected ? '0 4px 12px rgba(0, 129, 251, 0.2)' : 'none'
                                                  }}
                                                  onclick={() => this.loadCommentsForMedia(item)}
                                              >
                                                  <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                      {mediaSrc ? (
                                                          <img 
                                                              src={mediaSrc} 
                                                              onerror={e => {
                                                                  e.target.style.display = 'none';
                                                                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                                              }}
                                                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                          />
                                                      ) : null}
                                                      <div style={{ display: mediaSrc ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                                          <i className={isVideo ? 'fas fa-video fa-2x' : 'far fa-image fa-2x'} style={{ marginBottom: '4px' }}></i>
                                                          <span style={{ fontSize: '10px' }}>{isVideo ? 'Reels / Video' : 'Görsel'}</span>
                                                      </div>
                                                      <div style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                          <i className={isVideo ? 'fas fa-play' : 'far fa-image'}></i> {item.media_type}
                                                      </div>
                                                  </div>
                                                  <div style={{ padding: '10px' }}>
                                                      <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#334155', fontWeight: '600', height: '32px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                          {item.caption || 'Açıklama yok'}
                                                      </p>
                                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>
                                                          <span>❤️ {item.like_count ?? 0}</span>
                                                          <span style={{ color: '#0081fb' }}>💬 {item.comments_count ?? 0} Yorum</span>
                                                      </div>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>

                              {/* Yan Panel: Seçili Gönderinin Detayları & Yorumları */}
                              {this.selectedMediaForComments ? (
                                  <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '650px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                                          <div>
                                              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>Gönderi Detayı & Yorumlar</h4>
                                          </div>
                                          <button 
                                              type="button" 
                                              onclick={() => this.selectedMediaForComments = null}
                                              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}
                                          >
                                              <i className="fas fa-times"></i>
                                          </button>
                                      </div>

                                      {/* Seçili Gönderinin Canlı Önizleme Kartı */}
                                      <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '12px', marginBottom: '14px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                          <div style={{ width: '80px', height: '80px', borderRadius: '6px', overflow: 'hidden', background: '#000', flexShrink: 0, position: 'relative' }}>
                                              {this.selectedMediaForComments.media_type === 'VIDEO' && this.selectedMediaForComments.media_url ? (
                                                  <video src={this.selectedMediaForComments.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                              ) : (
                                                  <img src={this.selectedMediaForComments.thumbnail_url || this.selectedMediaForComments.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                              )}
                                          </div>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                                  <span>{this.selectedMediaForComments.media_type}</span>
                                                  {this.selectedMediaForComments.permalink && (
                                                      <a href={this.selectedMediaForComments.permalink} target="_blank" rel="noopener noreferrer" style={{ color: '#0081fb', fontWeight: '700', textDecoration: 'none' }}>
                                                          <i className="fab fa-instagram"></i> Instagram'da Aç ↗
                                                      </a>
                                                  )}
                                              </div>
                                              <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#1e293b', maxHeight: '42px', overflowY: 'auto', lineHeight: '1.4' }}>
                                                  {this.selectedMediaForComments.caption || 'Açıklama yok'}
                                              </p>
                                              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                                                  <span>❤️ {this.selectedMediaForComments.like_count ?? 0} Beğeni</span>
                                                  <span>💬 {this.selectedMediaForComments.comments_count ?? 0} Yorum</span>
                                              </div>
                                          </div>
                                      </div>

                                      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
                                          {this.businessCommentsLoading ? (
                                              <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                                                  <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '8px' }}></i>
                                                  <p style={{ margin: 0, fontSize: '12px' }}>Yorumlar yükleniyor...</p>
                                              </div>
                                          ) : this.businessComments.length === 0 ? (
                                              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                                                  <i className="far fa-comment-dots" style={{ fontSize: '32px', marginBottom: '8px' }}></i>
                                                  <p style={{ margin: 0, fontSize: '12px' }}>Bu gönderiye henüz yorum gelmemiş.</p>
                                              </div>
                                          ) : (
                                              this.businessComments.map(c => (
                                                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>@{c.username}</span>
                                                          <div style={{ display: 'flex', gap: '6px' }}>
                                                              <button 
                                                                  type="button" 
                                                                  onclick={() => this.moderateInstagramComment(c.id, false)}
                                                                  title="Yorumu Sil"
                                                                  style={{ border: 'none', background: '#fee2e2', color: '#ef4444', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer' }}
                                                              >
                                                                  <i className="fas fa-trash"></i>
                                                              </button>
                                                          </div>
                                                      </div>
                                                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#334155' }}>{c.text}</p>

                                                      {/* Yanıtlar Varsa Göster */}
                                                      {c.replies && c.replies.data ? (
                                                          <div style={{ paddingLeft: '12px', borderLeft: '2px solid #cbd5e1', marginBottom: '8px' }}>
                                                              {c.replies.data.map(rep => (
                                                                  <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
                                                                      <strong>@{rep.username}:</strong> {rep.text}
                                                                  </div>
                                                              ))}
                                                          </div>
                                                      ) : null}

                                                      {/* Yanıt Formu */}
                                                      <div style={{ display: 'flex', gap: '6px' }}>
                                                          <input 
                                                              className="FormControl" 
                                                              placeholder="Yoruma yanıt yazın..." 
                                                              value={this.replyTextMap[c.id] || ''} 
                                                              oninput={e => this.replyTextMap[c.id] = e.target.value}
                                                              style={{ height: '30px', fontSize: '11px', borderRadius: '6px' }}
                                                          />
                                                          <button 
                                                              type="button" 
                                                              onclick={() => this.replyToInstagramComment(c.id)}
                                                              style={{ padding: '0 10px', background: '#0081fb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                                          >
                                                              Yanıtla
                                                          </button>
                                                      </div>
                                                  </div>
                                              ))
                                          )}
                                      </div>
                                  </div>
                              ) : null}
                          </div>
                      ) : null}

                      {/* 3. SEKME: GELEN MESAJLAR (DM / INBOX) */}
                      {this.businessActiveSubTab === 'inbox' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: this.selectedConversation ? '1.1fr 1.3fr' : '1fr', gap: '20px' }}>
                              <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>Instagram Sohbetleri</h4>
                                      <Button className="Button" icon="fas fa-sync-alt" loading={this.businessConversationsLoading} onclick={() => this.loadConversations()} style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px' }}>
                                          Yenile
                                      </Button>
                                  </div>

                                  {this.businessConversationsLoading && (
                                      <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                                          <i className="fas fa-spinner fa-spin fa-2x"></i>
                                      </div>
                                  )}

                                  {!this.businessConversationsLoading && this.businessConversations.length === 0 && (
                                      <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                                          <i className="far fa-comments fa-2x" style={{ color: '#94a3b8', marginBottom: '8px' }}></i>
                                          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Henüz gelen sohbet / direkt mesaj bulunamadı.</p>
                                          <small style={{ color: '#94a3b8', display: 'block', marginTop: '4px' }}>Meta Graph API üzerinden Instagram Direct mesajları için <code>instagram_manage_messages</code> izni gereklidir.</small>
                                      </div>
                                  )}

                                  {!this.businessConversationsLoading && this.businessConversations.length > 0 && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto' }}>
                                          {this.businessConversations.map(conv => {
                                              const isSelected = this.selectedConversation && this.selectedConversation.id === conv.id;
                                              const participants = (conv.participants && conv.participants.data) || [];
                                              const otherUser = participants.find(p => p.id !== acc.ig_id) || participants[0] || { username: 'Bilinmeyen Kullanıcı' };

                                              return (
                                                  <div 
                                                      style={{
                                                          padding: '12px 14px',
                                                          background: isSelected ? '#eff6ff' : '#ffffff',
                                                          border: isSelected ? '1.5px solid #0081fb' : '1px solid #e2e8f0',
                                                          borderRadius: '10px',
                                                          cursor: 'pointer',
                                                          transition: 'all 0.15s'
                                                      }}
                                                      onclick={() => this.loadConversationMessages(conv)}
                                                  >
                                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                          <span style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a' }}>
                                                              @{otherUser.username || otherUser.name || 'Instagram Kullanıcısı'}
                                                          </span>
                                                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{conv.updated_time ? new Date(conv.updated_time).toLocaleDateString('tr-TR') : ''}</span>
                                                      </div>
                                                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                          Toplam {conv.message_count ?? '-'} mesaj
                                                      </div>
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  )}
                              </div>

                              {/* Sohbet Mesajları Paneli */}
                              {this.selectedConversation ? (
                                  <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '600px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>Mesaj Geçmişi</h4>
                                          <button 
                                              type="button" 
                                              onclick={() => this.selectedConversation = null}
                                              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}
                                          >
                                              <i className="fas fa-times"></i>
                                          </button>
                                      </div>

                                      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 0' }}>
                                          {this.conversationMessagesLoading ? (
                                              <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                                                  <i className="fas fa-spinner fa-spin fa-2x"></i>
                                              </div>
                                          ) : this.conversationMessages.length === 0 ? (
                                              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                                                  <p style={{ margin: 0, fontSize: '12px' }}>Mesaj bulunamadı.</p>
                                              </div>
                                          ) : (
                                              this.conversationMessages.map(msg => {
                                                  const isFromMe = msg.from && msg.from.id === acc.ig_id;
                                                  return (
                                                      <div style={{ alignSelf: isFromMe ? 'flex-end' : 'flex-start', maxWidth: '75%', background: isFromMe ? '#0081fb' : '#ffffff', color: isFromMe ? '#ffffff' : '#1e293b', padding: '10px 14px', borderRadius: '12px', border: isFromMe ? 'none' : '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                          <div style={{ fontSize: '10px', opacity: 0.75, marginBottom: '2px' }}>
                                                              {msg.from && (msg.from.username || msg.from.name)}
                                                          </div>
                                                          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>{msg.message}</div>
                                                      </div>
                                                  );
                                              })
                                          )}
                                      </div>
                                  </div>
                              ) : null}
                          </div>
                      ) : null}

                      {/* 4. SEKME: DOĞRUDAN HİKAYE (STORY) YAYINLAMA VE ZAMANLAMA */}
                      {this.businessActiveSubTab === 'story_publish' ? (
                          <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1.5px solid #e2e8f0', maxWidth: '640px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #f09433 0%, #dc2743 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px' }}>
                                      <i className="fab fa-instagram"></i>
                                  </div>
                                  <div>
                                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Instagram Hesabında Hikaye Yayınla & Zamanla</h4>
                                      <span style={{ fontSize: '12px', color: '#64748b' }}>Anında paylaşın veya istediğiniz ileri bir tarihe zamanlayın</span>
                                  </div>
                              </div>

                              <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b' }}>
                                  9:16 dikey görsel URL'ini girerek veya cihazınızdan yükleyerek tek tıkla Instagram Hikayesi (Story) olarak paylaşabilir ya da zamanlayabilirsiniz.
                              </p>

                              <div style={{ marginBottom: '16px' }}>
                                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>Hikaye Görsel URL'i veya Dosyadan Yükle:</label>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                      <input 
                                          className="FormControl" 
                                          placeholder="https://forum.ulasimarsiv.com/assets/..." 
                                          value={this.storyPublishUrl} 
                                          oninput={e => this.storyPublishUrl = e.target.value} 
                                          style={{ height: '38px', borderRadius: '8px', fontSize: '13px', flex: 1 }} 
                                      />
                                      <label className="Button" style={{ borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                          <i className="fas fa-upload"></i> Cihazdan Seç
                                          <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onchange={this.uploadStoryToPublish.bind(this)} />
                                      </label>
                                  </div>
                              </div>

                              {/* Zamanlama Seçenekleri Kutusu */}
                              <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: this.storyScheduleEnabled ? '12px' : '0' }}>
                                      <label style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                                          <input 
                                              type="checkbox" 
                                              checked={this.storyScheduleEnabled} 
                                              onchange={e => { this.storyScheduleEnabled = e.target.checked; m.redraw(); }} 
                                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                          />
                                          <i className="fas fa-clock" style={{ color: '#6366f1' }}></i> Bu Hikayeyi İleri Bir Tarihe Zamanla
                                      </label>
                                      {this.storyScheduleEnabled && (
                                          <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                                              Kuyruğa Eklenecek
                                          </span>
                                      )}
                                  </div>

                                  {this.storyScheduleEnabled && (
                                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                                              <div style={{ flex: 1, minWidth: '150px' }}>
                                                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Tarih</label>
                                                  <input 
                                                      type="date" 
                                                      className="FormControl" 
                                                      value={this.storyScheduleDate} 
                                                      oninput={e => this.storyScheduleDate = e.target.value} 
                                                      style={{ height: '36px', borderRadius: '6px', fontSize: '13px' }} 
                                                  />
                                              </div>
                                              <div style={{ width: '85px' }}>
                                                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Saat</label>
                                                  <select 
                                                      className="FormControl" 
                                                      value={this.storyScheduleHour} 
                                                      onchange={e => this.storyScheduleHour = e.target.value} 
                                                      style={{ height: '36px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}
                                                  >
                                                      {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                                                          <option value={h}>{h}:00</option>
                                                      ))}
                                                  </select>
                                              </div>
                                              <div style={{ width: '85px' }}>
                                                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Dakika</label>
                                                  <select 
                                                      className="FormControl" 
                                                      value={this.storyScheduleMinute} 
                                                      onchange={e => this.storyScheduleMinute = e.target.value} 
                                                      style={{ height: '36px', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}
                                                  >
                                                      {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(minVal => (
                                                          <option value={minVal}>{minVal}</option>
                                                      ))}
                                                  </select>
                                              </div>
                                          </div>

                                          {/* Hızlı Seçim Butonları */}
                                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                              <button 
                                                  type="button" 
                                                  onclick={() => this.setStorySchedulePreset(1, null, null)}
                                                  style={{ border: '1px solid #cbd5e1', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                                              >
                                                  ⚡ +1 Saat Sonra
                                              </button>
                                              <button 
                                                  type="button" 
                                                  onclick={() => this.setStorySchedulePreset(null, 20, 0)}
                                                  style={{ border: '1px solid #cbd5e1', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                                              >
                                                  🌙 Bu Akşam 20:00
                                              </button>
                                              <button 
                                                  type="button" 
                                                  onclick={() => this.setStorySchedulePreset(null, 10, 0)}
                                                  style={{ border: '1px solid #cbd5e1', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                                              >
                                                  ☀️ Yarın 10:00
                                              </button>
                                          </div>
                                      </div>
                                  )}
                              </div>

                              <Button 
                                  className="Button Button--primary" 
                                  loading={this.storyPublishing} 
                                  onclick={() => this.publishDirectStory()} 
                                  style={{ 
                                      background: this.storyScheduleEnabled ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' : 'linear-gradient(135deg, #f09433 0%, #dc2743 100%)', 
                                      border: 'none', 
                                      height: '42px', 
                                      fontWeight: '700', 
                                      borderRadius: '8px', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center',
                                      gap: '8px',
                                      width: '100%',
                                      fontSize: '13px'
                                  }}
                              >
                                  <i className={this.storyScheduleEnabled ? 'fas fa-calendar-check' : 'fab fa-instagram'}></i>
                                  {this.storyPublishing 
                                      ? (this.storyScheduleEnabled ? 'Hikaye Zamanlanıyor...' : 'Hikaye Paylaşılıyor...') 
                                      : (this.storyScheduleEnabled ? '⏰ Hikayeyi Belirlenen Saatte Paylaşmak Üzere Planla' : "Instagram'da Doğrudan Hikaye Olarak Paylaş")}
                              </Button>
                          </div>
                      ) : null}
                  </div>
              ))
          )}
          </div>
      );
  }

  uploadStoryToPublish(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      this.storyPublishing = true;
      m.redraw();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'save');

      app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/story-archive',
          body: formData,
          serialize: raw => raw
      }).then(res => {
          this.storyPublishing = false;
          if (res && res.url) {
              const fullUrl = (app.forum.attribute('baseUrl') || window.location.origin).replace(/\/+$/, '') + res.url;
              this.storyPublishUrl = fullUrl;
              app.alerts.show({ type: 'success' }, 'Görsel yüklendi ve URL alanına eklendi!');
          }
          m.redraw();
      }).catch(err => {
          this.storyPublishing = false;
          app.alerts.show({ type: 'error' }, 'Yükleme başarısız: ' + ((err && err.response && (err.response.error || err.response.message)) || (err && err.message) || 'Bilinmeyen hata olustu'));
          m.redraw();
      });
  }

  loadFbConversations() {
      const acc = this.getSelectedBusinessAccount();
      const pageId = acc ? (acc.page_id || acc.fb_page_id) : null;
      if (!acc || !pageId || !acc.token) return;

      this.businessFbConversationsLoading = true;
      m.redraw();

      app.request({
          method: 'GET',
          url: app.forum.attribute('apiUrl') + `/framio/social-share/meta-business?action=fb_conversations&page_id=${encodeURIComponent(pageId)}&token=${encodeURIComponent(acc.token)}`,
          errorHandler: () => {}
      }).then(res => {
          if (res && res.success && res.data && res.data.data) {
              this.businessFbConversations = res.data.data;
          }
      }).catch(e => {
          console.warn('FB Mesajlar yüklenemedi:', e);
      }).finally(() => {
          this.businessFbConversationsLoading = false;
          m.redraw();
      });
  }

  loadFbConversationMessages(conv) {
      const acc = this.getSelectedBusinessAccount();
      if (!acc || !acc.token || !conv || !conv.id) return;

      this.selectedFbConversation = conv;
      this.businessFbConversationMessagesLoading = true;
      this.businessFbConversationMessages = [];
      m.redraw();

      app.request({
          method: 'GET',
          url: app.forum.attribute('apiUrl') + `/framio/social-share/meta-business?action=fb_conversation_messages&conversation_id=${encodeURIComponent(conv.id)}&token=${encodeURIComponent(acc.token)}`
      }).then(res => {
          if (res && res.success && res.data && res.data.data) {
              this.businessFbConversationMessages = res.data.data;
          }
      }).catch(e => {
          app.alerts.show({ type: 'error' }, 'Messenger mesajları alınamadı: ' + ((e && e.response && e.response.error) || e.message));
      }).finally(() => {
          this.businessFbConversationMessagesLoading = false;
          m.redraw();
      });
  }

  loadCommentsForFbMedia(post) {
      const acc = this.getSelectedBusinessAccount();
      if (!acc || !acc.token || !post || !post.id) return;

      this.selectedFbMediaForComments = post;
      this.businessFbCommentsLoading = true;
      this.businessFbComments = [];
      m.redraw();

      app.request({
          method: 'GET',
          url: app.forum.attribute('apiUrl') + `/framio/social-share/meta-business?action=fb_comments&post_id=${encodeURIComponent(post.id)}&token=${encodeURIComponent(acc.token)}`
      }).then(res => {
          if (res && res.success && res.data && res.data.data) {
              this.businessFbComments = res.data.data;
          }
      }).catch(e => {
          app.alerts.show({ type: 'error' }, 'Facebook yorumları çekilemedi: ' + ((e && e.response && e.response.error) || e.message));
      }).finally(() => {
          this.businessFbCommentsLoading = false;
          m.redraw();
      });
  }

  replyToFbComment(commentId) {
      const acc = this.getSelectedBusinessAccount();
      const text = this.fbReplyTextMap[commentId];
      if (!acc || !acc.token || !commentId || !text || !text.trim()) {
          app.alerts.show({ type: 'error' }, 'Lütfen yanıt metni yazın.');
          return;
      }

      app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/meta-business',
          body: {
              action: 'fb_reply_comment',
              token: acc.token,
              comment_id: commentId,
              message: text.trim()
          }
      }).then(res => {
          if (res && res.success) {
              app.alerts.show({ type: 'success' }, "Yanıtınız Facebook'ta yayınlandı!");
              this.fbReplyTextMap[commentId] = '';
              if (this.selectedFbMediaForComments) {
                  this.loadCommentsForFbMedia(this.selectedFbMediaForComments);
              }
          }
      }).catch(e => {
          app.alerts.show({ type: 'error' }, 'Yanıt gönderilemedi: ' + ((e && e.response && e.response.error) || e.message));
      });
  }

  moderateFbComment(commentId, hide = false) {
      const acc = this.getSelectedBusinessAccount();
      if (!acc || !acc.token || !commentId) return;

      if (!hide && !confirm('Bu Facebook yorumunu silmek istediğinize emin misiniz?')) {
          return;
      }

      app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/meta-business',
          body: {
              action: 'fb_moderate_comment',
              token: acc.token,
              comment_id: commentId,
              hide: hide
          }
      }).then(res => {
          if (res && res.success) {
              app.alerts.show({ type: 'success' }, hide ? 'Yorum gizlendi/görünür yapıldı.' : 'Yorum başarıyla silindi.');
              if (this.selectedFbMediaForComments) {
                  this.loadCommentsForFbMedia(this.selectedFbMediaForComments);
              }
          }
      }).catch(e => {
          app.alerts.show({ type: 'error' }, 'İşlem başarısız: ' + ((e && e.response && e.response.error) || e.message));
      });
  }

  publishDirectFbStory() {
      const acc = this.getSelectedBusinessAccount();
      const pageId = acc ? (acc.page_id || acc.fb_page_id) : null;
      if (!acc || !pageId || !acc.token) {
          app.alerts.show({ type: 'error' }, 'Lütfen geçerli bir Facebook sayfası olan hesap seçin.');
          return;
      }
      if (!this.fbStoryPublishUrl || !this.fbStoryPublishUrl.trim()) {
          app.alerts.show({ type: 'error' }, 'Lütfen yayınlanacak hikaye görselinin URL\'ini girin.');
          return;
      }

      const body = {
          action: 'fb_post_story',
          page_id: pageId,
          token: acc.token,
          image_url: this.fbStoryPublishUrl.trim()
      };

      if (this.fbStoryScheduleEnabled) {
          if (!this.fbStoryScheduleDate) {
              app.alerts.show({ type: 'error' }, 'Lütfen geçerli bir zamanlama tarihi seçin.');
              return;
          }
          body.scheduled_at = `${this.fbStoryScheduleDate} ${this.fbStoryScheduleHour || '20'}:${this.fbStoryScheduleMinute || '00'}:00`;
      }

      this.fbStoryPublishing = true;
      m.redraw();

      app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/meta-business',
          body: body
      }).then(res => {
          if (res && res.success) {
              if (res.scheduled) {
                  app.alerts.show({ type: 'success' }, '⏰ Facebook Hikayesi başarıyla zamanlandı ve kuyruğa eklendi!');
              } else {
                  app.alerts.show({ type: 'success' }, '🎉 Facebook Hikayesi başarıyla sayfanızda yayınlandı!');
              }
              this.fbStoryPublishUrl = '';
              this.fbStoryScheduleEnabled = false;
              this.loadBusinessData();
          }
      }).catch(e => {
          app.alerts.show({ type: 'error' }, 'Facebook hikaye işlemi başarısız: ' + ((e && e.response && e.response.error) || e.message));
      }).finally(() => {
          this.fbStoryPublishing = false;
          m.redraw();
      });
  }

  setFbStorySchedulePreset(hoursAhead, fixedHour, fixedMinute) {
      const now = new Date();
      if (hoursAhead !== null) {
          now.setHours(now.getHours() + hoursAhead);
      } else if (fixedHour !== null) {
          if (now.getHours() >= fixedHour) {
              now.setDate(now.getDate() + 1);
          }
          now.setHours(fixedHour, fixedMinute || 0, 0, 0);
      }
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      this.fbStoryScheduleDate = `${yyyy}-${mm}-${dd}`;
      this.fbStoryScheduleHour = String(now.getHours()).padStart(2, '0');
      this.fbStoryScheduleMinute = String(now.getMinutes()).padStart(2, '0');
      this.fbStoryScheduleEnabled = true;
      m.redraw();
  }

  uploadFbStoryToPublish(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      this.fbStoryPublishing = true;
      m.redraw();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'save');

      app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/social-share/story-archive',
          body: formData,
          serialize: raw => raw
      }).then(res => {
          this.fbStoryPublishing = false;
          if (res && res.url) {
              const fullUrl = (app.forum.attribute('baseUrl') || window.location.origin).replace(/\/+$/, '') + res.url;
              this.fbStoryPublishUrl = fullUrl;
              app.alerts.show({ type: 'success' }, 'Görsel yüklendi ve Facebook Hikaye URL alanına eklendi!');
          }
          m.redraw();
      }).catch(err => {
          this.fbStoryPublishing = false;
          app.alerts.show({ type: 'error' }, 'Yükleme başarısız: ' + ((err && err.response && (err.response.error || err.response.message)) || (err && err.message) || 'Bilinmeyen hata olustu'));
          m.redraw();
      });
  }

  saveCustomSettings(e) {
      e.preventDefault();
      this.loading = true;

      const settings = {
          'framio-social-share.accounts_json': JSON.stringify(this.accounts),
          'framio-social-share.default_account_index': String(this.defaultAccountIndex),
          'framio-social-share.post_template': this.postTemplate,
          'framio-social-share.story_backgrounds_json': JSON.stringify(this.storyBackgrounds),
          'framio-social-share.allowed_share_users': this.allowedShareUsers,
          'framio-social-share.allowed_story_users': this.allowedStoryUsers,
          'framio-social-share.allowed_story_publish_users': this.allowedStoryPublishUsers,
          'framio-social-share.user_instagram_map': this.userInstagramMap,
          'framio-social-share.user_name_map': this.userNameMap,
          'framio-social-share.gemini_api_key': this.geminiApiKey,
          'framio-social-share.groq_api_key': this.groqApiKey,
          'framio-social-share.openrouter_api_key': this.openrouterApiKey,
          'framio-social-share.tavily_api_key': this.tavilyApiKey,
          'framio-social-share.canva_client_id': this.canvaClientId,
          'framio-social-share.canva_client_secret': this.canvaClientSecret,
          'framio-social-share.canva_team_users': this.canvaTeamUsers,
          'framio-social-share.canva_brand_client_id': this.canvaBrandClientId,
          'framio-social-share.canva_brand_client_secret': this.canvaBrandClientSecret,
          'framio-social-share.canva_brand_users': this.canvaBrandUsers,
          'framio-social-share.canva_template_links': this.canvaTemplateLinks
      };

      saveSettings(settings)
          .then(() => {
              this.loading = false;
              app.alerts.show({ type: 'success' }, 'Ayarlar başarıyla kaydedildi.');
              m.redraw();
          })
          .catch(() => {
              this.loading = false;
              app.alerts.show({ type: 'error' }, 'Ayarlar kaydedilirken hata oluştu.');
              m.redraw();
          });
  }
}

