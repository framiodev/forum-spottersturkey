import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Stream from 'flarum/common/utils/Stream';
import app from 'flarum/admin/app';

export default class EditQueueModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);
    
    this.group = this.attrs.group;
    this.items = this.attrs.items || (this.attrs.item ? [this.attrs.item] : []);
    this.updateQueueGroup = this.attrs.updateQueueGroup;
    
    this.messages = {
        facebook: Stream(''),
        instagram: Stream(''),
        threads: Stream(''),
        instagram_story: Stream('')
    };

    this.activePlatforms = [];
    this.images = [];
    this.scheduledAt = Stream('');
    this.isStory = false;

    this.items.forEach(it => {
        const p = (it.payload && it.payload.platform) ? it.payload.platform : it.platform;
        const type = (it.payload && it.payload.type) ? it.payload.type : '';
        if (p === 'instagram_story' || type === 'story') {
            this.isStory = true;
        }
        const msg = (it.payload && it.payload.message) ? it.payload.message : '';
        if (p && this.messages[p]) {
            this.messages[p](msg);
            if (!this.activePlatforms.includes(p)) this.activePlatforms.push(p);
        }
        if (it.payload && it.payload.images && this.images.length === 0) {
            this.images = [...it.payload.images];
        }
        if (it.scheduled_at && !this.scheduledAt()) {
            this.scheduledAt(it.scheduled_at);
        }
    });

    if (this.activePlatforms.length === 0) this.activePlatforms = ['facebook', 'instagram', 'threads'];
    this.activeTab = Stream(this.activePlatforms[0] || 'facebook');
    this.activeImageIndex = Stream(0);
    this.loading = false;
  }

  className() {
    return 'FramioEditQueueModal Modal--large';
  }

  title() {
    return 'Planlanmış Gönderiyi Düzenle';
  }

  content() {
    const currentTab = this.activeTab();
    const currentMessage = this.messages[currentTab] ? this.messages[currentTab]() : '';

    return (
      <div className="Modal-body" style={{ padding: '25px', background: '#fdfdfd', maxHeight: '80vh', overflowY: 'auto' }}>
        
        {/* ÜST PLATFORM SEÇİM ÇUBUĞU */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '12px', alignItems: 'center' }}>
            <span style={{ fontWeight: '700', color: '#475569', fontSize: '13px', marginRight: '5px' }}>Düzenlenen Platform:</span>
            
            {(this.isStory ? ['instagram_story'] : ['facebook', 'instagram', 'threads']).map(plt => {
                const isActive = this.activeTab() === plt;
                const isIncluded = this.activePlatforms.includes(plt);
                
                const meta = {
                    facebook: { label: 'Facebook', icon: 'fab fa-facebook', color: '#1877f2', bg: '#eff6ff' },
                    instagram: { label: 'Instagram', icon: 'fab fa-instagram', color: '#e1306c', bg: '#fdf2f8' },
                    threads: { label: 'Threads', icon: 'fab fa-threads', color: '#000000', bg: '#f3f4f6' },
                    instagram_story: { label: 'Instagram Hikaye', icon: 'fab fa-instagram', color: '#8b5cf6', bg: '#f5f3ff' }
                }[plt] || { label: plt, icon: 'fas fa-share-alt', color: '#64748b', bg: '#f1f5f9' };

                return (
                    <button
                        type="button"
                        onclick={() => this.activeTab(plt)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: isActive ? '700' : '500',
                            border: isActive ? `2px solid ${meta.color}` : '1px solid #cbd5e1',
                            background: isActive ? meta.bg : '#ffffff',
                            color: isActive ? meta.color : '#64748b',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                        }}
                    >
                        <i className={meta.icon} style={{ color: meta.color }}></i>
                        {meta.label}
                        {!isIncluded && <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '2px' }}>(Kuyrukta Yok)</span>}
                    </button>
                );
            })}
        </div>

        <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap', width: '100%', maxWidth: '850px', margin: '0 auto' }}>
            
            {/* SOL: METİN VE TARİH DÜZENLEME */}
            <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                <div className="Form-group">
                    <label style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                            <i className={this.activeTab() === 'instagram' ? 'fab fa-instagram' : (this.activeTab() === 'threads' ? 'fab fa-threads' : 'fab fa-facebook')} style={{ marginRight: '6px', color: this.activeTab() === 'instagram' ? '#e1306c' : (this.activeTab() === 'threads' ? '#000' : '#1877f2') }}></i>
                            {this.activeTab().toUpperCase()} Gönderi Metni
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>(Her platform için bağımsız düzenleyebilirsiniz)</span>
                    </label>
                    <textarea 
                        bidi={this.messages[this.activeTab()]} 
                        className="FormControl" 
                        style={{ borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '180px', resize: 'vertical', padding: '12px', fontSize: '13px', lineHeight: '1.5' }} 
                    />
                </div>

                <div className="Form-group">
                    <label style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', marginBottom: '6px', display: 'block' }}>
                        <i className="fas fa-clock" style={{ marginRight: '6px', color: '#6366f1' }}></i> Planlanan Zaman (Tarih & Saat)
                    </label>
                    <input 
                        type="datetime-local" 
                        className="FormControl" 
                        value={this.scheduledAt() ? this.scheduledAt().replace(' ', 'T').slice(0, 16) : ''} 
                        oninput={e => this.scheduledAt(e.target.value ? e.target.value.replace('T', ' ') + ':00' : '')} 
                        style={{ borderRadius: '8px', border: '1px solid #cbd5e1', height: '38px', fontSize: '13px' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <Button 
                        className="Button Button--primary" 
                        loading={this.loading} 
                        onclick={this.onsubmit.bind(this)} 
                        style={{ flex: 1, borderRadius: '8px', fontWeight: '700', height: '40px', background: '#4f46e5' }}
                    >
                        <i className="fas fa-save" style={{ marginRight: '6px' }}></i> Tüm Platformlar İçin Kaydet
                    </Button>
                    <Button 
                        className="Button Button--danger" 
                        onclick={this.onDelete.bind(this)} 
                        style={{ borderRadius: '8px', height: '40px', padding: '0 16px' }} 
                        title="Tüm Platform Kuyruğunu Sil"
                    >
                        <i className="fas fa-trash-alt"></i> Sil
                    </Button>
                </div>
            </div>

            {/* SAĞ: GÖRSEL VE CANLI ÖNİZLEME */}
            <div style={{ width: '320px', flexShrink: 0, background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '15px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: '700', fontSize: '12px', color: '#475569', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>GÖNDERİ ÖNİZLEME</span>
                    <span style={{ color: '#6366f1', textTransform: 'uppercase' }}>{this.activeTab()}</span>
                </div>

                <div style={{ width: '100%', aspectRatio: '1', background: '#000', borderRadius: '8px', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {this.images.length > 0 ? (
                        <img src={this.images[this.activeImageIndex()]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ color: '#94a3b8', textAlign: 'center' }}>
                            <i className="far fa-image fa-2x" style={{ marginBottom: '6px', display: 'block' }}></i>
                            Görsel Yok
                        </div>
                    )}

                    {this.images.length > 1 && (
                        <div>
                            {this.activeImageIndex() > 0 && (
                                <button onclick={(e) => { e.preventDefault(); this.activeImageIndex(this.activeImageIndex() - 1); }} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer' }}>
                                    <i className="fas fa-chevron-left" style={{ fontSize: '11px' }}></i>
                                </button>
                            )}
                            {this.activeImageIndex() < this.images.length - 1 && (
                                <button onclick={(e) => { e.preventDefault(); this.activeImageIndex(this.activeImageIndex() + 1); }} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer' }}>
                                    <i className="fas fa-chevron-right" style={{ fontSize: '11px' }}></i>
                                </button>
                            )}
                            <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '10px', padding: '2px 7px', borderRadius: '10px', fontWeight: '700' }}>
                                {this.activeImageIndex() + 1} / {this.images.length}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '12px', fontSize: '12px', color: '#334155', maxHeight: '140px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4', padding: '8px', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    {currentMessage || <em style={{ color: '#94a3b8' }}>Bu platform için metin girilmedi...</em>}
                </div>
            </div>

        </div>
      </div>
    );
  }

  onsubmit(e) {
    e.preventDefault();
    this.loading = true;

    const messagesMap = {
        facebook: this.messages.facebook(),
        instagram: this.messages.instagram(),
        threads: this.messages.threads(),
        instagram_story: this.messages.instagram_story()
    };

    this.updateQueueGroup({
        items: this.items,
        action: 'update',
        messages: messagesMap,
        scheduled_at: this.scheduledAt(),
        images: this.images
    }).then(() => {
        this.loading = false;
        app.modal.close();
    }).catch(err => {
        this.loading = false;
        app.alerts.show({ type: 'error' }, 'Güncelleme hatası: ' + (err.message || err.toString()));
    });
  }

  onDelete(e) {
    e.preventDefault();
    if (confirm('Bu planlanmış gönderiyi (tüm platformları dahil) kuyruktan silmek istediğinize emin misiniz?')) {
        this.updateQueueGroup({
            items: this.items,
            action: 'delete'
        }).then(() => {
            app.modal.close();
        });
    }
  }
}
