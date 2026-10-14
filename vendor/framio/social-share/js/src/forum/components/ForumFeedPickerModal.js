import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Stream from 'flarum/common/utils/Stream';
import app from 'flarum/forum/app';

export default class ForumFeedPickerModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);

    this.posts = Stream([]);
    this.loading = Stream(false);
    this.searchQuery = Stream('');
    
    // Seçilen görsellerin listesi (URL string array)
    this.selectedImages = Stream([]);
    // Önceden modalda var olan görseller (çakışmaları engellemek ve göstermek için)
    this.existingImages = this.attrs.existingImages || [];
    
    // Lightbox State
    this.previewLightboxIndex = Stream(null);
    this.lightboxImagesList = Stream([]);

    this.loadPosts();
  }

  className() {
    return 'FramioForumFeedPickerModal Modal--large';
  }

  title() {
    return 'Forum Akışından Gönderi / Görsel Seç';
  }

  loadPosts(query = '') {
    this.loading(true);
    m.redraw();

    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio/social-share/forum-feed-posts',
      params: { q: query, limit: 50 }
    }).then(res => {
      this.posts(res.posts || []);
      this.loading(false);
      m.redraw();
    }).catch(err => {
      console.error('Forum feed load error:', err);
      this.loading(false);
      m.redraw();
    });
  }

  getFilteredPosts() {
    const q = (this.searchQuery() || '').trim().toLocaleLowerCase('tr-TR');
    if (!q) return this.posts();

    return this.posts().filter(p => {
      const title = (p.discussion_title || '').toLocaleLowerCase('tr-TR');
      const author = (p.author_name || '').toLocaleLowerCase('tr-TR');
      const user = (p.username || '').toLocaleLowerCase('tr-TR');
      const snippet = (p.snippet || '').toLocaleLowerCase('tr-TR');

      return title.includes(q) || author.includes(q) || user.includes(q) || snippet.includes(q);
    });
  }

  toggleImage(url) {
    const list = [...this.selectedImages()];
    const index = list.indexOf(url);
    if (index !== -1) {
      list.splice(index, 1);
    } else {
      list.push(url);
    }
    this.selectedImages(list);
    m.redraw();
  }

  togglePostAllImages(post) {
    const list = [...this.selectedImages()];
    const postImages = post.images || [];
    const allSelected = postImages.every(img => list.includes(img));

    if (allSelected) {
      // Hepsini çıkar
      postImages.forEach(img => {
        const idx = list.indexOf(img);
        if (idx !== -1) list.splice(idx, 1);
      });
    } else {
      // Hepsini ekle
      postImages.forEach(img => {
        if (!list.includes(img)) list.push(img);
      });
    }

    this.selectedImages(list);
    m.redraw();
  }

  openLightbox(imagesList, index = 0) {
    this.lightboxImagesList(imagesList || []);
    this.previewLightboxIndex(index);
    m.redraw();
  }

  mountLightboxPortal() {
    let portal = document.getElementById('framio-feed-lightbox-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'framio-feed-lightbox-portal';
      document.body.appendChild(portal);
    }

    const self = this;
    m.mount(portal, {
      view: () => {
        const curIdx = self.previewLightboxIndex();
        if (curIdx === null) return null;

        const currentList = self.lightboxImagesList();
        if (!currentList || !currentList[curIdx]) return null;
        
        const currentImg = currentList[curIdx];
        const total = currentList.length;
        const isSelected = self.selectedImages().includes(currentImg);

        return (
          <div 
            className="FramioShare-Lightbox"
            onclick={() => { self.previewLightboxIndex(null); m.redraw(); }}
          >
            {/* Kapat Butonu */}
            <button 
              type="button" 
              className="FramioShare-CloseBtn"
              onclick={(e) => { e.stopPropagation(); self.previewLightboxIndex(null); m.redraw(); }}
              title="Kapat (ESC)"
            >
              <i className="fas fa-times"></i>
            </button>

            {/* Orta Görsel Alanı */}
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
            </div>

            {/* Alt Kontrol & Aksiyon Barı (Sleek Glassmorphic Pill) */}
            <div 
              style="position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 1000000; display: flex; align-items: center; gap: 14px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); padding: 6px 8px 6px 18px; border-radius: 40px; border: 1px solid rgba(255, 255, 255, 0.22); box-shadow: 0 12px 36px rgba(0,0,0,0.55);"
              onclick={e => e.stopPropagation()}
            >
              {/* Sayaç */}
              {total > 1 ? (
                <div style="color: #cbd5e1; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; white-space: nowrap;">
                  {curIdx + 1} / {total}
                </div>
              ) : null}

              {/* Ayırıcı Çizgi */}
              {total > 1 ? (
                <div style="width: 1px; height: 18px; background: rgba(255,255,255,0.25);"></div>
              ) : null}

              {/* Ekle / Çıkar Aksiyon Butonu */}
              <button
                type="button"
                onclick={(e) => {
                  e.stopPropagation();
                  self.toggleImage(currentImg);
                }}
                style={{
                  padding: '9px 20px',
                  borderRadius: '30px',
                  fontSize: '13px',
                  fontWeight: '700',
                  border: isSelected ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.2)',
                  background: isSelected ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 4px 16px rgba(34, 197, 94, 0.45)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
                title={isSelected ? 'Paylaşım listesinden çıkar' : 'Paylaşım listesine ekle'}
              >
                <i className={`fas ${isSelected ? 'fa-check-circle' : 'fa-plus-circle'}`} style="font-size: 14px;"></i>
                <span>{isSelected ? 'Paylaşıma Eklendi' : 'Paylaşıma Ekle'}</span>
              </button>
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
          const list = this.lightboxImagesList();
          if (cur < list.length - 1) {
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
    const portal = document.getElementById('framio-feed-lightbox-portal');
    if (portal) {
      m.mount(portal, null);
      portal.remove();
    }
  }

  confirmSelection() {
    const selected = this.selectedImages();
    if (selected.length === 0) {
      alert('Lütfen paylaşıma eklemek için en az 1 görsel seçin.');
      return;
    }

    if (typeof this.attrs.onconfirm === 'function') {
      this.attrs.onconfirm(selected);
    }
  }

  hide() {
    if (typeof this.attrs.oncancel === 'function') {
      this.attrs.oncancel();
    }
    super.hide();
  }

  view() {
    return (
      <div className={'Modal modal-dialog ' + this.className()}>
        <div className="Modal-content">
          
          {/* Modal Header */}
          <div className="Modal-header">
            <div className="Header-Title-Area">
              <div className="Header-Icon">
                <i className="fas fa-photo-film"></i>
              </div>
              <div className="Header-Titles">
                <h3 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0;">Forum Arşivi & Akıştan Görsel Seç</h3>
                <span>Forumdaki gönderilerden ve konulardan görsel seçip paylaşıma dahil edin</span>
              </div>
            </div>
            <div className="ModalClose">
              <button onclick={() => this.hide()} type="button" title="Kapat">
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>

          <div style="height: calc(100% - 64px); display: flex; flex-direction: column; overflow: hidden;">
            {this.content()}
          </div>
        </div>
      </div>
    );
  }

  content() {
    const totalSelected = this.selectedImages().length;

    return (
      <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; height: 100%;">
        
        {/* Üst Arama ve Filtreleme Çubuğu */}
        <div style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; gap: 12px; align-items: center; flex-shrink: 0;">
          <div style="position: relative; flex: 1;">
            <i className="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 13px;"></i>
            <input 
              type="text" 
              className="FormControl" 
              placeholder="Konu başlığı, yazar veya gönderi içeriğinde ara..." 
              style="padding-left: 36px; border-radius: 8px; border: 1.5px solid #cbd5e1; height: 38px; font-size: 13px;"
              bidi={this.searchQuery}
              oninput={(e) => {
                this.searchQuery(e.target.value);
                m.redraw();
                clearTimeout(this._searchTimer);
                this._searchTimer = setTimeout(() => {
                  this.loadPosts(this.searchQuery());
                }, 400);
              }}
            />
          </div>
          <button 
            type="button" 
            className="Button Button--primary"
            onclick={() => this.loadPosts(this.searchQuery())}
            style="border-radius: 8px; height: 38px; padding: 0 16px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;"
          >
            <i className="fas fa-arrows-rotate"></i> Yenile
          </button>
        </div>

        {/* Orta Liste Alanı: Akış Kartları */}
        <div style="flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; background: #ffffff;">
          {this.loading() ? (
            <div style="text-align: center; padding: 60px 20px; color: #64748b;">
              <i className="fas fa-spinner fa-spin" style="font-size: 28px; color: #6366f1; margin-bottom: 12px; display: block;"></i>
              <span style="font-weight: 600; font-size: 14px;">Forum gönderileri ve arşiv görselleri taranıyor...</span>
            </div>
          ) : this.getFilteredPosts().length === 0 ? (
            <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
              <i className="fas fa-photo-film" style="font-size: 36px; margin-bottom: 12px; display: block; opacity: 0.5;"></i>
              <span style="font-weight: 600; font-size: 14px;">Aramanıza uygun görsel içeren bir gönderi bulunamadı.</span>
            </div>
          ) : (
            this.getFilteredPosts().map(post => {
              const postImages = post.images || [];
              const allPostImagesSelected = postImages.length > 0 && postImages.every(img => this.selectedImages().includes(img));
              const somePostImagesSelected = postImages.some(img => this.selectedImages().includes(img));

              return (
                <div className="FramioFeed-PostCard" style="border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; background: #ffffff; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                  
                  {/* Başlık & Yazar Başlık Satırı */}
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 12px;">
                    <div style="flex: 1;">
                      <a 
                        href={app.route('discussion', { id: post.discussion_id }) + '/' + post.post_number} 
                        target="_blank" 
                        style="font-size: 14px; font-weight: 700; color: #0f172a; text-decoration: none; display: flex; align-items: center; gap: 6px; line-height: 1.3;"
                      >
                        <i className="fas fa-comments" style="color: #3b82f6; font-size: 13px;"></i>
                        <span>{post.discussion_title}</span>
                      </a>
                      
                      <div style="display: flex; align-items: center; gap: 8px; margin-top: 5px; font-size: 12px; color: #64748b;">
                        <span style="font-weight: 600; color: #334155;">
                          <i className="fas fa-user-pen" style="font-size: 11px; margin-right: 4px; color: #94a3b8;"></i>
                          {post.author_name} (@{post.username})
                        </span>
                        <span>•</span>
                        <span>{new Date(post.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>

                    {/* Tüm Gönderiyi Seç / Çıkar Butonu */}
                    <button 
                      type="button" 
                      onclick={() => this.togglePostAllImages(post)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        borderRadius: '8px',
                        border: `1.5px solid ${allPostImagesSelected ? '#22c55e' : '#cbd5e1'}`,
                        background: allPostImagesSelected ? '#f0fdf4' : '#f8fafc',
                        color: allPostImagesSelected ? '#15803d' : '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                      title="Bu gönderideki tüm görselleri seç veya seçimi kaldır"
                    >
                      <i className={`fas ${allPostImagesSelected ? 'fa-check-double' : (somePostImagesSelected ? 'fa-minus' : 'fa-plus')}`}></i>
                      <span>{allPostImagesSelected ? 'Tümü Seçildi' : `Tümünü Seç (${postImages.length})`}</span>
                    </button>
                  </div>

                  {/* Gönderi Metin Özeti (Varsa) */}
                  {post.snippet ? (
                    <div style="font-size: 12px; color: #475569; margin-bottom: 12px; line-height: 1.4; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #cbd5e1;">
                      {post.snippet}
                    </div>
                  ) : null}

                  {/* Gönderi Görselleri Grid */}
                  <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(95px, 1fr)); gap: 8px;">
                    {postImages.map((imgUrl, imgIdx) => {
                      const isSelected = this.selectedImages().includes(imgUrl);
                      const isExisting = this.existingImages.includes(imgUrl);

                      return (
                        <div 
                          className={`FramioFeed-ImageItem ${isSelected ? 'is-selected' : ''}`}
                          onclick={() => this.openLightbox(postImages, imgIdx)}
                          style={{
                            position: 'relative',
                            aspectRatio: '4/3',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: `2px solid ${isSelected ? '#22c55e' : (isExisting ? '#3b82f6' : '#e2e8f0')}`,
                            cursor: 'pointer',
                            background: '#0f172a',
                            boxShadow: isSelected ? '0 0 0 2px rgba(34, 197, 94, 0.4)' : 'none',
                            transition: 'all 0.2s ease'
                          }}
                          title="Büyütmek ve incelemek için tıklayın"
                        >
                          <img 
                            src={imgUrl} 
                            alt="Forum Görseli" 
                            loading="lazy" 
                            style="width: 100%; height: 100%; object-fit: cover; display: block;" 
                          />

                          {/* Hover Büyüt İkonu */}
                          <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.3); opacity: 0; transition: opacity 0.2s ease; display: flex; align-items: center; justify-content: center; color: #ffffff;"
                            onmouseover={e => e.currentTarget.style.opacity = '1'}
                            onmouseout={e => e.currentTarget.style.opacity = '0'}
                          >
                            <i className="fas fa-magnifying-glass-plus" style="font-size: 16px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));"></i>
                          </div>

                          {/* Doğrudan Seçim Rozeti (Hızlı Seç/Kaldır) */}
                          <div 
                            onclick={(e) => {
                              e.stopPropagation();
                              this.toggleImage(imgUrl);
                            }}
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              background: isSelected ? '#22c55e' : 'rgba(15, 23, 42, 0.75)',
                              color: '#ffffff',
                              borderRadius: '50%',
                              width: '22px',
                              height: '22px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              border: '1.5px solid #ffffff',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                              zIndex: 2,
                              cursor: 'pointer'
                            }}
                            title={isSelected ? 'Seçimi Kaldır' : 'Paylaşıma Ekle'}
                          >
                            <i className={`fas ${isSelected ? 'fa-check' : 'fa-plus'}`}></i>
                          </div>

                          {/* Zaten Var Rozeti */}
                          {isExisting && !isSelected ? (
                            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(59, 130, 246, 0.9); color: #ffffff; font-size: 8px; font-weight: 700; text-align: center; padding: 2px 0; z-index: 2;">
                              EKLİ
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* Alt Sabit Bar: Seçim Özeti ve Onay Butonu */}
        <div style="padding: 14px 20px; border-top: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
          <div style="font-size: 13px; font-weight: 600; color: #334155; display: flex; align-items: center; gap: 8px;">
            <i className="fas fa-images" style="color: #3b82f6; font-size: 16px;"></i>
            <span>
              {totalSelected > 0 ? (
                <strong style="color: #15803d;">{totalSelected} görsel seçildi</strong>
              ) : (
                <span style="color: #94a3b8;">Henüz görsel seçilmedi</span>
              )}
            </span>
          </div>

          <div style="display: flex; gap: 10px; align-items: center;">
            <button 
              type="button" 
              className="Button" 
              onclick={() => this.hide()} 
              style="border-radius: 8px; font-weight: 600; padding: 8px 16px;"
            >
              Vazgeç
            </button>

            <button 
              type="button" 
              className="Button Button--primary" 
              disabled={totalSelected === 0}
              onclick={() => this.confirmSelection()} 
              style={{
                borderRadius: '8px',
                fontWeight: '700',
                padding: '8px 20px',
                background: totalSelected > 0 ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : '#cbd5e1',
                border: 'none',
                color: '#ffffff',
                boxShadow: totalSelected > 0 ? '0 4px 12px rgba(34, 197, 94, 0.3)' : 'none',
                cursor: totalSelected > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fas fa-file-import"></i>
              <span>Seçilenleri Paylaşıma Ekle ({totalSelected})</span>
            </button>
          </div>
        </div>

      </div>
    );
  }
}
