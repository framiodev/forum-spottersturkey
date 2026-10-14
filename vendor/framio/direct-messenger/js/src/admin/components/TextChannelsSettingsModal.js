import app from 'flarum/admin/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Stream from 'flarum/common/utils/Stream';

export default class TextChannelsSettingsModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);

    this.loading = true;
    this.channels = [];
    this.saving = false;

    // Form state for creating / editing
    this.editingId = null;
    this.name = Stream('');
    this.description = Stream('');
    this.icon = Stream('fas fa-hashtag');
    this.sortOrder = Stream(0);
    this.isActive = Stream(true);

    this.loadChannels();
  }

  className() {
    return 'TextChannelsSettingsModal Modal--large';
  }

  title() {
    return 'Metin Kanalları Yönetimi (Maks. 10 Oda)';
  }

  loadChannels() {
    this.loading = true;
    m.redraw();

    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/text-channels',
    }).then((response) => {
      const raw = response.data || [];
      this.channels = raw.map(ch => {
        const attrs = ch.attributes || {};
        return {
          id: ch.id || attrs.id,
          name: ch.name || attrs.name || '',
          description: ch.description || attrs.description || '',
          icon: ch.icon || attrs.icon || 'fas fa-hashtag',
          sort_order: ch.sort_order || attrs.sortOrder || 0,
          is_active: ch.is_active !== undefined ? ch.is_active : (attrs.isActive !== undefined ? attrs.isActive : true),
        };
      });
      this.loading = false;
      m.redraw();
    }).catch(() => {
      this.loading = false;
      m.redraw();
    });
  }

  resetForm() {
    this.editingId = null;
    this.name('');
    this.description('');
    this.icon('fas fa-hashtag');
    this.sortOrder(0);
    this.isActive(true);
  }

  startEdit(ch) {
    this.editingId = ch.id;
    this.name(ch.name);
    this.description(ch.description || '');
    this.icon(ch.icon || 'fas fa-hashtag');
    this.sortOrder(ch.sort_order || 0);
    this.isActive(ch.is_active !== false);
  }

  saveChannel(e) {
    e.preventDefault();
    if (!this.name() || !this.name().trim()) {
      alert('Lütfen bir kanal adı girin.');
      return;
    }

    this.saving = true;

    const data = {
      name: this.name().trim(),
      description: this.description().trim(),
      icon: this.icon().trim() || 'fas fa-hashtag',
      sort_order: parseInt(this.sortOrder()) || 0,
      is_active: this.isActive(),
    };

    const isEdit = !!this.editingId;
    const url = app.forum.attribute('apiUrl') + (isEdit ? `/text-channels/${this.editingId}` : '/text-channels');
    const method = isEdit ? 'PATCH' : 'POST';

    app.request({
      method,
      url,
      body: data,
    }).then(() => {
      this.saving = false;
      this.resetForm();
      this.loadChannels();
    }).catch((err) => {
      this.saving = false;
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
    const channelCount = this.channels.length;
    const canAddMore = channelCount < 10;

    return (
      <div className="Modal-body" style={{ padding: '24px' }}>
        <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, fontWeight: 700 }}>Mevcut Metin Odaları ({channelCount}/10)</h4>
            <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '13px' }}>
              Discord benzeri topluluk metin kanalları. En fazla 10 adet genel oda açılabilir.
            </p>
          </div>
        </div>

        {this.loading ? (
          <LoadingIndicator />
        ) : (
          <div style={{ marginBottom: '24px' }}>
            {this.channels.length === 0 ? (
              <p style={{ color: '#888', fontStyle: 'italic' }}>Henüz metin kanalı bulunmuyor.</p>
            ) : (
              <table className="Table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #333' }}>
                    <th style={{ padding: '8px 4px' }}>İkon</th>
                    <th style={{ padding: '8px 4px' }}>Kanal Adı</th>
                    <th style={{ padding: '8px 4px' }}>Açıklama</th>
                    <th style={{ padding: '8px 4px' }}>Sıra</th>
                    <th style={{ padding: '8px 4px' }}>Durum</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {this.channels.map((ch) => (
                    <tr key={ch.id} style={{ borderBottom: '1px solid #282828' }}>
                      <td style={{ padding: '8px 4px' }}><i className={ch.icon || 'fas fa-hashtag'} /></td>
                      <td style={{ padding: '8px 4px', fontWeight: 600 }}>{ch.name}</td>
                      <td style={{ padding: '8px 4px', color: '#aaa', fontSize: '12px' }}>{ch.description || '-'}</td>
                      <td style={{ padding: '8px 4px' }}>{ch.sort_order}</td>
                      <td style={{ padding: '8px 4px' }}>
                        {ch.is_active ? (
                          <span style={{ color: '#43b581', fontSize: '12px' }}>● Aktif</span>
                        ) : (
                          <span style={{ color: '#f04747', fontSize: '12px' }}>● Pasif</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                        <Button
                          className="Button Button--link"
                          icon="fas fa-edit"
                          onclick={() => this.startEdit(ch)}
                        />
                        <Button
                          className="Button Button--link"
                          icon="fas fa-trash"
                          style={{ color: '#f04747', marginLeft: '6px' }}
                          onclick={() => this.deleteChannel(ch)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <hr style={{ borderColor: '#333', margin: '20px 0' }} />

        {/* Form Container */}
        <div>
          <h4 style={{ margin: '0 0 12px 0', fontWeight: 700 }}>
            {this.editingId ? `Kanalı Düzenle (#${this.editingId})` : 'Yeni Metin Kanalı Ekle'}
          </h4>

          {!this.editingId && !canAddMore ? (
            <div className="Alert Alert--warning" style={{ padding: '10px 14px', borderRadius: '4px', marginBottom: '14px' }}>
              Maksimum 10 metin kanalı sınırına ulaşıldı. Yeni kanal eklemek için mevcut bir kanalı silmelisiniz.
            </div>
          ) : (
            <form onsubmit={this.saveChannel.bind(this)}>
              <div className="Form-group" style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Kanal Adı</label>
                <input
                  type="text"
                  className="FormControl"
                  placeholder="#genel-sohbet"
                  bidi={this.name}
                  required
                />
              </div>

              <div className="Form-group" style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Açıklama (İsteğe bağlı)</label>
                <input
                  type="text"
                  className="FormControl"
                  placeholder="Kanalın amacını belirten kısa açıklama"
                  bidi={this.description}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                <div className="Form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>İkon (FontAwesome)</label>
                  <input
                    type="text"
                    className="FormControl"
                    placeholder="fas fa-hashtag"
                    bidi={this.icon}
                  />
                </div>
                <div className="Form-group" style={{ width: '120px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>Sıralama</label>
                  <input
                    type="number"
                    className="FormControl"
                    placeholder="0"
                    bidi={this.sortOrder}
                  />
                </div>
              </div>

              <div className="Form-group" style={{ marginBottom: '16px' }}>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={this.isActive()}
                    onchange={(e) => this.isActive(e.target.checked)}
                  />{' '}
                  Kanal Aktif Olsun
                </label>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  type="submit"
                  className="Button Button--primary"
                  loading={this.saving}
                  disabled={!this.editingId && !canAddMore}
                >
                  {this.editingId ? 'Değişiklikleri Kaydet' : 'Kanalı Oluştur'}
                </Button>

                {this.editingId && (
                  <Button
                    type="button"
                    className="Button"
                    onclick={this.resetForm.bind(this)}
                  >
                    Vazgeç
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }
}
