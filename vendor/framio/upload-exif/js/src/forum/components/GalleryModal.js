import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import app from 'flarum/forum/app';

export default class GalleryModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);
    this.loading = true;
    this.images = [];
    this.editor = this.attrs.editor;
    this.loadImages();
  }

  className() { return 'GalleryModal Modal--large'; }
  title() { return 'Medyalarım (Galeri)'; }

  loadImages() {
    this.loading = true;
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio-media/images'
    }).then(response => {
      this.images = (response || []).sort((a, b) => b.id - a.id);
      this.loading = false;
      m.redraw();
    }).catch(() => {
      this.loading = false;
      m.redraw();
    });
  }

  deleteImage(img, e) {
    e.preventDefault(); 
    e.stopPropagation(); 
    
    if (!confirm('Bu görseli kalıcı olarak silmek istiyor musunuz?')) return;
    
    app.request({
      method: 'DELETE',
      url: app.forum.attribute('apiUrl') + '/framio-media/image/' + img.id
    }).then(() => {
      this.images = this.images.filter(i => i.id !== img.id);
      m.redraw();
    });
  }

  copyLink(img, e) {
    e.preventDefault(); 
    e.stopPropagation();
    const bbcode = `[framio-image id=${img.id} url="${img.thumb_path || img.path}" alt="${img.filename}"]`;
    
    navigator.clipboard.writeText(bbcode).then(() => {
        app.alerts.show({ type: 'success' }, 'BBCode kopyalandı!');
    });
  }

  insertImage(img) {
    let altText = img.filename.split('.').slice(0, -1).join('.');
    altText = altText.replace(/[-_]/g, ' ');

    const bbcode = `[framio-image id=${img.id} url="${img.thumb_path || img.path}" alt="${altText}"]`;
    
    if (this.editor) {
        this.editor.insertAtCursor(bbcode + '\n');
        app.modal.close();
    }
  }

  content() {
    return (
      <div className="Modal-body">
        {this.loading ? (
          <LoadingIndicator />
        ) : (
          <div className="Gallery-Grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '12px',
            maxHeight: '60vh',
            overflowY: 'auto',
            padding: '5px'
          }}>
            {this.images.length === 0 ? (
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#888', padding: '30px 0' }}>
                Henüz yüklenmiş bir görseliniz bulunmuyor.
              </p>
            ) : (
              this.images.map(img => (
                <div 
                  className="Gallery-Item" 
                  key={img.id}
                  style={{
                    position: 'relative',
                    aspectRatio: '16/10',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: '1px solid #ddd',
                    cursor: 'pointer',
                    background: '#000'
                  }}
                  onclick={() => this.insertImage(img)}
                >
                  <img 
                    src={img.thumb_path || img.path} 
                    alt={img.filename} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                  
                  <div className="Gallery-Item-Actions" style={{
                    position: 'absolute',
                    top: '5px',
                    right: '5px',
                    display: 'flex',
                    gap: '4px',
                    zIndex: 5
                  }}>
                    <button 
                      type="button" 
                      className="Button Button--icon" 
                      style={{ padding: '4px 6px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '4px' }}
                      onclick={(e) => this.copyLink(img, e)}
                      title="BBCode Kopyala"
                    >
                      <i className="fas fa-copy" style={{ fontSize: '11px' }}></i>
                    </button>
                    <button 
                      type="button" 
                      className="Button Button--icon" 
                      style={{ padding: '4px 6px', background: 'rgba(231, 76, 60, 0.8)', color: '#fff', border: 'none', borderRadius: '4px' }}
                      onclick={(e) => this.deleteImage(img, e)}
                      title="Görseli Sil"
                    >
                      <i className="fas fa-trash" style={{ fontSize: '11px' }}></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }
}
