import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Stream from 'flarum/common/utils/Stream';

export default class DirectMessengerSettingsPage extends ExtensionPage {
  oninit(vnode) {
    super.oninit(vnode);

    this.activeTab = 'text_channels'; // 'text_channels' | 'voice_rooms' | 'direct_messaging' | 'general'

    // Text Channels State
    this.textChannels = [];
    this.loadingChannels = true;
    this.savingChannel = false;
    this.editingChannelId = null;
    this.channelName = Stream('');
    this.channelDescription = Stream('');
    this.channelIcon = Stream('fas fa-hashtag');
    this.channelSortOrder = Stream(0);
    this.channelIsActive = Stream(true);

    this.loadChannels();
  }

  loadChannels() {
    this.loadingChannels = true;
    m.redraw();

    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/text-channels',
    }).then((response) => {
      const raw = response.data || [];
      this.textChannels = raw.map(ch => {
        const attrs = ch.attributes || {};
        return {
          id: ch.id || attrs.id,
          name: ch.name || attrs.name || '',
          description: ch.description || attrs.description || '',
          icon: ch.icon || attrs.icon || 'fas fa-hashtag',
          sort_order: ch.sort_order !== undefined ? ch.sort_order : (attrs.sortOrder || 0),
          is_active: ch.is_active !== undefined ? ch.is_active : (attrs.isActive !== undefined ? attrs.isActive : true),
        };
      });
      this.loadingChannels = false;
      m.redraw();
    }).catch(() => {
      this.loadingChannels = false;
      m.redraw();
    });
  }

  resetChannelForm() {
    this.editingChannelId = null;
    this.channelName('');
    this.channelDescription('');
    this.channelIcon('fas fa-hashtag');
    this.channelSortOrder(0);
    this.channelIsActive(true);
  }

  startEditChannel(ch) {
    this.editingChannelId = ch.id;
    this.channelName(ch.name);
    this.channelDescription(ch.description || '');
    this.channelIcon(ch.icon || 'fas fa-hashtag');
    this.channelSortOrder(ch.sort_order || 0);
    this.channelIsActive(ch.is_active !== false);
  }

  saveChannel(e) {
    e.preventDefault();
    if (!this.channelName() || !this.channelName().trim()) {
      alert('Lütfen bir kanal adı girin.');
      return;
    }

    this.savingChannel = true;

    const data = {
      name: this.channelName().trim(),
      description: this.channelDescription().trim(),
      icon: this.channelIcon().trim() || 'fas fa-hashtag',
      sort_order: parseInt(this.channelSortOrder()) || 0,
      is_active: this.channelIsActive(),
    };

    const isEdit = !!this.editingChannelId;
    const url = app.forum.attribute('apiUrl') + (isEdit ? `/text-channels/${this.editingChannelId}` : '/text-channels');
    const method = isEdit ? 'PATCH' : 'POST';

    app.request({
      method,
      url,
      body: data,
    }).then(() => {
      this.savingChannel = false;
      this.resetChannelForm();
      this.loadChannels();
    }).catch((err) => {
      this.savingChannel = false;
      const msg = (err.response && err.response.error) || 'Kanal kaydedilirken bir hata oluştu.';
      alert(msg);
      m.redraw();
    });
  }

  deleteChannel(ch) {
    if (!confirm(`"${ch.name}" adlı kanalı ve tüm mesajlarını silmek istediğinize emin misiniz?`)) {
      return;
    }

    app.request({
      method: 'DELETE',
      url: app.forum.attribute('apiUrl') + `/text-channels/${ch.id}`,
    }).then(() => {
      this.loadChannels();
    }).catch((err) => {
      const msg = (err.response && err.response.error) || 'Silme işlemi başarısız.';
      alert(msg);
    });
  }

  content() {
    const tabs = [
      { id: 'text_channels', label: 'Metin Kanalları', icon: 'fas fa-hashtag' },
      { id: 'voice_rooms', label: 'Sesli Odalar', icon: 'fas fa-headset' },
      { id: 'direct_messaging', label: 'Özel Mesajlaşma', icon: 'fas fa-paper-plane' },
      { id: 'general', label: 'Genel Ayarlar', icon: 'fas fa-sliders-h' },
    ];

    return (
      <div className="DirectMessengerSettingsPage container">
        {/* Flarum Native Style Navigation Tabs */}
        <nav className="DirectMessengerSettingsPage-tabs" role="tablist">
          {tabs.map((tab) => {
            const isActive = this.activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`DirectMessengerSettingsPage-tab ${isActive ? 'DirectMessengerSettingsPage-tab--active' : ''}`}
                onclick={() => {
                  this.activeTab = tab.id;
                  m.redraw();
                }}
              >
                <i className={tab.icon} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab Panel Content */}
        <div className="DirectMessengerSettingsPage-panel">
          {this.activeTab === 'text_channels' && this.renderTextChannelsTab()}
          {this.activeTab === 'voice_rooms' && this.renderVoiceRoomsTab()}
          {this.activeTab === 'direct_messaging' && this.renderDirectMessagingTab()}
          {this.activeTab === 'general' && this.renderGeneralTab()}
        </div>
      </div>
    );
  }

  renderTextChannelsTab() {
    const channelCount = this.textChannels.length;
    const canAddMore = channelCount < 10;

    return (
      <div className="DM-tab-content">
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '17px' }}>
                <i className="fas fa-comments" style={{ marginRight: '8px', color: '#5865F2' }} />
                Topluluk Metin Kanalları ({channelCount}/10)
              </h3>
              <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '13px' }}>
                Discord benzeri genel metin kanalları. Forum üyeleri bu odalarda anlık yazılı sohbet gerçekleştirebilir.
              </p>
            </div>
            <span style={{
              background: canAddMore ? '#2f9e44' : '#e03131',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '12px'
            }}>
              {channelCount} / 10 Oda Dolu
            </span>
          </div>

          {this.loadingChannels ? (
            <LoadingIndicator />
          ) : (
            <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
              {this.textChannels.length === 0 ? (
                <p style={{ color: '#888', fontStyle: 'italic' }}>Henüz metin kanalı oluşturulmamış.</p>
              ) : (
                <table className="Table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #333' }}>
                      <th style={{ padding: '10px 8px' }}>İkon</th>
                      <th style={{ padding: '10px 8px' }}>Kanal Adı</th>
                      <th style={{ padding: '10px 8px' }}>Açıklama</th>
                      <th style={{ padding: '10px 8px' }}>Sıra</th>
                      <th style={{ padding: '10px 8px' }}>Durum</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {this.textChannels.map((ch) => (
                      <tr key={ch.id} style={{ borderBottom: '1px solid #282828' }}>
                        <td style={{ padding: '10px 8px' }}><i className={ch.icon || 'fas fa-hashtag'} style={{ color: '#5865F2' }} /></td>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{ch.name}</td>
                        <td style={{ padding: '10px 8px', color: '#aaa', fontSize: '12px' }}>{ch.description || '-'}</td>
                        <td style={{ padding: '10px 8px' }}>{ch.sort_order}</td>
                        <td style={{ padding: '10px 8px' }}>
                          {ch.is_active ? (
                            <span style={{ color: '#43b581', fontSize: '12px', fontWeight: 600 }}>● Aktif</span>
                          ) : (
                            <span style={{ color: '#f04747', fontSize: '12px', fontWeight: 600 }}>● Pasif</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                          <Button
                            className="Button Button--link"
                            icon="fas fa-edit"
                            onclick={() => this.startEditChannel(ch)}
                            title="Düzenle"
                          />
                          <Button
                            className="Button Button--link"
                            icon="fas fa-trash"
                            style={{ color: '#f04747', marginLeft: '6px' }}
                            onclick={() => this.deleteChannel(ch)}
                            title="Sil"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Form */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '18px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <h4 style={{ margin: '0 0 14px 0', fontWeight: 700, fontSize: '15px' }}>
              {this.editingChannelId ? `Kanalı Düzenle (#${this.editingChannelId})` : 'Yeni Metin Kanalı Ekle'}
            </h4>

            {!this.editingChannelId && !canAddMore ? (
              <div className="Alert Alert--warning" style={{ padding: '10px 14px', borderRadius: '4px' }}>
                Maksimum 10 metin kanalı sınırına ulaşıldı. Yeni kanal eklemek için mevcut bir kanalı silmelisiniz.
              </div>
            ) : (
              <form onsubmit={this.saveChannel.bind(this)}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 100px', gap: '14px', marginBottom: '12px' }}>
                  <div className="Form-group">
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '13px' }}>Kanal Adı</label>
                    <input
                      type="text"
                      className="FormControl"
                      placeholder="Örn: Genel Sohbet"
                      bidi={this.channelName}
                      required
                    />
                  </div>

                  <div className="Form-group">
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '13px' }}>İkon (FontAwesome)</label>
                    <input
                      type="text"
                      className="FormControl"
                      placeholder="fas fa-comments"
                      bidi={this.channelIcon}
                    />
                  </div>

                  <div className="Form-group">
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '13px' }}>Sıra</label>
                    <input
                      type="number"
                      className="FormControl"
                      placeholder="0"
                      bidi={this.channelSortOrder}
                    />
                  </div>
                </div>

                <div className="Form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '13px' }}>Kanal Açıklaması</label>
                  <input
                    type="text"
                    className="FormControl"
                    placeholder="Bu kanalın amacı ve konusu"
                    bidi={this.channelDescription}
                  />
                </div>

                <div className="Form-group" style={{ marginBottom: '16px' }}>
                  <label className="checkbox" style={{ fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={this.channelIsActive()}
                      onchange={(e) => this.channelIsActive(e.target.checked)}
                    />{' '}
                    Kanal Aktif (Kullanıcılar görebilir ve mesaj atabilir)
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button
                    type="submit"
                    className="Button Button--primary"
                    loading={this.savingChannel}
                    disabled={!this.editingChannelId && !canAddMore}
                  >
                    {this.editingChannelId ? 'Değişiklikleri Kaydet' : 'Kanalı Oluştur'}
                  </Button>

                  {this.editingChannelId && (
                    <Button
                      type="button"
                      className="Button"
                      onclick={this.resetChannelForm.bind(this)}
                    >
                      Vazgeç
                    </Button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  renderVoiceRoomsTab() {
    return (
      <div className="DM-tab-content">
        <form onsubmit={this.saveSettings.bind(this)}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontWeight: 700, fontSize: '17px' }}>
              <i className="fas fa-headset" style={{ marginRight: '8px', color: '#23a55a' }} />
              Sesli Odalar & WebRTC Ayarları
            </h3>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>
              Doğrudan eşler arası (Peer-to-Peer) sesli iletişim, tartışma bazlı özel ses odaları ve STUN sunucu yapılandırması.
            </p>

            <div className="Form-group" style={{ marginBottom: '16px' }}>
              <label className="checkbox" style={{ fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={this.setting('framio-direct-messenger.enable_voice_rooms', '1')() === '1'}
                  onchange={(e) => this.setting('framio-direct-messenger.enable_voice_rooms')(e.target.checked ? '1' : '0')}
                />{' '}
                Topluluk Sesli Odalarını Etkinleştir
              </label>
              <div className="helpText" style={{ color: '#777', fontSize: '12px', marginTop: '4px' }}>
                Kullanıcıların genel sesli odalara girip canlı mikrofon ile sohbet etmesine izin verir.
              </div>
            </div>

            <div className="Form-group" style={{ marginBottom: '16px' }}>
              <label className="checkbox" style={{ fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={this.setting('framio-direct-messenger.enable_discussion_voice_rooms', '1')() === '1'}
                  onchange={(e) => this.setting('framio-direct-messenger.enable_discussion_voice_rooms')(e.target.checked ? '1' : '0')}
                />{' '}
                Tartışma / Konu İçi Sesli Odayı Etkinleştir
              </label>
              <div className="helpText" style={{ color: '#777', fontSize: '12px', marginTop: '4px' }}>
                Bir tartışma konusuna girildiğinde konunun başlığına özel ses odası oluşturulur ve sadece o konudakiler birbirini duyar.
              </div>
            </div>

            <div className="Form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>STUN Sunucuları (Satır başına bir adet)</label>
              <textarea
                className="FormControl"
                rows="3"
                placeholder="stun:stun.l.google.com:19302&#10;stun:stun1.l.google.com:19302"
                bidi={this.setting('framio-direct-messenger.stun_servers', 'stun:stun.l.google.com:19302\nstun:stun1.l.google.com:19302')}
              />
              <div className="helpText" style={{ color: '#777', fontSize: '12px', marginTop: '4px' }}>
                Kullanıcılar arasında NAT arkasından doğrudan ses bağlantısı kurulması için kullanılan ücretsiz STUN sunucuları.
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              {this.submitButton()}
            </div>
          </div>
        </form>
      </div>
    );
  }

  renderDirectMessagingTab() {
    return (
      <div className="DM-tab-content">
        <form onsubmit={this.saveSettings.bind(this)}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontWeight: 700, fontSize: '17px' }}>
              <i className="fas fa-paper-plane" style={{ marginRight: '8px', color: '#0284c7' }} />
              Birebir Özel Mesajlaşma (Direct Messages) Ayarları
            </h3>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>
              Kullanıcılar arası özel mesajlaşma, sağ alt yüzen Messenger kutusu (Dock), okundu bilgileri ve sesli/görsel bildirimler.
            </p>

            <div className="Form-group" style={{ marginBottom: '16px' }}>
              <label className="checkbox" style={{ fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={this.setting('framio-direct-messenger.enable_floating_dock', '1')() === '1'}
                  onchange={(e) => this.setting('framio-direct-messenger.enable_floating_dock')(e.target.checked ? '1' : '0')}
                />{' '}
                Sağ Altta Yüzen Messenger Dock (Facebook Tarzı Mini Sohbet) Aktif
              </label>
              <div className="helpText" style={{ color: '#777', fontSize: '12px', marginTop: '4px' }}>
                Kullanıcıların forumun herhangi bir sayfasındayken sayfadan ayrılmadan mini pencerede yazışmasını sağlar.
              </div>
            </div>

            <div className="Form-group" style={{ marginBottom: '16px' }}>
              <label className="checkbox" style={{ fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={this.setting('framio-direct-messenger.enable_sound_notifications', '1')() === '1'}
                  onchange={(e) => this.setting('framio-direct-messenger.enable_sound_notifications')(e.target.checked ? '1' : '0')}
                />{' '}
                Yeni Mesaj Geldiğinde Sesli Bildirim Çal
              </label>
            </div>

            <div className="Form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Maksimum Mesaj Karakter Sayısı</label>
              <input
                type="number"
                className="FormControl"
                style={{ maxWidth: '200px' }}
                placeholder="2000"
                bidi={this.setting('framio-direct-messenger.max_message_chars', '2000')}
              />
              <div className="helpText" style={{ color: '#777', fontSize: '12px', marginTop: '4px' }}>
                Tek bir mesajda gönderilebilecek azami karakter adedi (Varsayılan: 2000).
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              {this.submitButton()}
            </div>
          </div>
        </form>
      </div>
    );
  }

  renderGeneralTab() {
    return (
      <div className="DM-tab-content">
        <form onsubmit={this.saveSettings.bind(this)}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontWeight: 700, fontSize: '17px' }}>
              <i className="fas fa-sliders-h" style={{ marginRight: '8px', color: '#fab005' }} />
              Genel ve Arayüz Yapılandırması
            </h3>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>
              Header menü butonları, anlık yenileme (polling) sıklığı ve genel forum entegrasyonu.
            </p>

            <div className="Form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Mesaj Yenileme Sıklığı (Milisaniye)</label>
              <input
                type="number"
                className="FormControl"
                style={{ maxWidth: '200px' }}
                placeholder="2500"
                bidi={this.setting('framio-direct-messenger.polling_interval', '2500')}
              />
              <div className="helpText" style={{ color: '#777', fontSize: '12px', marginTop: '4px' }}>
                Yeni mesajları kontrol etme aralığı (Önerilen: 2500 ms - 2.5 saniye).
              </div>
            </div>

            <div className="Form-group" style={{ marginBottom: '16px' }}>
              <label className="checkbox" style={{ fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={this.setting('framio-direct-messenger.show_profile_msg_btn', '1')() === '1'}
                  onchange={(e) => this.setting('framio-direct-messenger.show_profile_msg_btn')(e.target.checked ? '1' : '0')}
                />{' '}
                Kullanıcı Profil Kartlarında "Mesaj Gönder" Butonunu Göster
              </label>
            </div>

            <div style={{ marginTop: '20px' }}>
              {this.submitButton()}
            </div>
          </div>
        </form>
      </div>
    );
  }
}
