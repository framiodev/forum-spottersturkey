import Component from 'flarum/common/Component';
import app from 'flarum/forum/app';

// SpotterCarousel component wraps the actual images into a slider.
// It will render the EXIF card (SpotterImageCard) for the currently visible image.
export default class SpotterCarousel extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    // this.attrs.images should be an array of { id, originalElement }
    this.images = this.attrs.images || [];
    this.currentIndex = 0;
    
    // We pass the SpotterImageCard component class as an attr to avoid circular dependency issues
    this.SpotterImageCard = this.attrs.SpotterImageCard;
    this.dotsContainer = this.attrs.dotsContainer;
    this.isExifOpen = false; // Carousel genelinde EXIF açık/kapalı durumu
  }

  nextSlide(e) {
    e.preventDefault();
    e.stopPropagation();
    if (this.currentIndex < this.images.length - 1) {
      this.currentIndex++;
      m.redraw();
    }
  }

  prevSlide(e) {
    e.preventDefault();
    e.stopPropagation();
    if (this.currentIndex > 0) {
      this.currentIndex--;
      m.redraw();
    }
  }

  setSlide(index) {
    this.currentIndex = index;
    m.redraw();
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    this.renderDots();
    this.updateContainerHeight();
    this.syncKunye();
    
    this.resizeHandler = () => this.updateContainerHeight();
    window.addEventListener('resize', this.resizeHandler);

    // Dokunmatik (Touch) Kaydırma Desteği
    if (this.containerEl) {
      let touchStartX = 0;
      let touchEndX = 0;

      this.touchStartHandler = (e) => {
        touchStartX = e.changedTouches[0].screenX;
      };

      this.touchEndHandler = (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 40) {
          if (diff > 0 && this.currentIndex < this.images.length - 1) {
            this.currentIndex++;
            m.redraw();
          } else if (diff < 0 && this.currentIndex > 0) {
            this.currentIndex--;
            m.redraw();
          }
        }
      };

      this.containerEl.addEventListener('touchstart', this.touchStartHandler, { passive: true });
      this.containerEl.addEventListener('touchend', this.touchEndHandler, { passive: true });
    }
  }

  onupdate(vnode) {
    super.onupdate(vnode);
    this.renderDots();
    this.updateContainerHeight();
    this.syncKunye();
  }

  /**
   * Birden çok açıklamalı mesaj: yalnızca açık fotoğrafın künye kartı
   * görünür. Kartlar HTML'de yerinde kalır (arama motorları hepsini okur);
   * gizli fotoğrafların ardındaki kartlar 1px'e indirildiği için açık kart
   * her zaman kaydırıcının hemen altına düşer.
   */
  syncKunye() {
    const kunyes = this.attrs.kunyes;
    if (!kunyes) return;
    kunyes.forEach((node, idx) => {
      if (node) node.style.display = idx === this.currentIndex ? '' : 'none';
    });
  }

  onremove(vnode) {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    if (this.containerEl && this.touchStartHandler) {
      this.containerEl.removeEventListener('touchstart', this.touchStartHandler);
      this.containerEl.removeEventListener('touchend', this.touchEndHandler);
    }
  }

  updateContainerHeight() {
    if (!this.containerEl) return;
    const slides = this.containerEl.querySelectorAll('.SpotterCarousel-Slide');
    if (slides.length > this.currentIndex) {
      const currentSlide = slides[this.currentIndex];
      const updateHeight = () => {
        this.containerEl.style.height = currentSlide.offsetHeight + 'px';
      };
      
      const img = currentSlide.querySelector('img');
      if (img && !img.complete) {
        img.onload = updateHeight;
      } else {
        updateHeight();
      }
    }
  }

  renderDots() {
    if (!this.dotsContainer) return;
    m.render(this.dotsContainer, 
      <div className="SpotterCarousel-Dots" style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '15px 0' }}>
        {this.images.map((_, idx) => (
          <div 
            key={idx}
            className={`SpotterCarousel-Dot ${idx === this.currentIndex ? 'active' : ''}`}
            onclick={this.setSlide.bind(this, idx)}
            style={{ 
              width: '10px', height: '10px', borderRadius: '50%', cursor: 'pointer',
              backgroundColor: idx === this.currentIndex ? 'var(--primary-color, #333)' : '#ccc',
              transition: 'background-color 0.3s'
            }}
          ></div>
        ))}
      </div>
    );
  }

  view() {
    if (!this.images || this.images.length === 0) return null;

    const currentItem = this.images[this.currentIndex];

    let src = '';
    let alt = '';
    
    const imgEl = currentItem.originalElement.tagName === 'IMG' 
                  ? currentItem.originalElement 
                  : currentItem.originalElement.querySelector('img');
                  
    if (imgEl) {
      src = imgEl.src;
      alt = imgEl.alt;
    }

    return (
      <div className="SpotterCarousel-Wrapper" style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
        
        {/* CAROUSEL CONTAINER */}
        <div 
          className="SpotterCarousel-Container" 
          oncreate={v => { this.containerEl = v.dom; this.updateContainerHeight(); }}
          onupdate={v => { this.updateContainerHeight(); }}
          style={{ position: 'relative', overflow: 'hidden', background: 'transparent', transition: 'height 0.4s ease-in-out' }}
        >
          
          {/* The Track */}
          <div className="SpotterCarousel-Track" style={{ 
            display: 'flex', 
            alignItems: 'flex-start',
            transition: 'transform 0.4s ease-in-out', 
            transform: `translateX(-${this.currentIndex * 100}%)`,
            width: '100%' 
          }}>
            {this.images.map((imgData, idx) => {
              let slideSrc = '';
              let slideAlt = '';
              const slideImgEl = imgData.originalElement.tagName === 'IMG' 
                            ? imgData.originalElement 
                            : imgData.originalElement.querySelector('img');
              if (slideImgEl) {
                slideSrc = slideImgEl.src;
                slideAlt = slideImgEl.alt;
              }
              return (
                <div key={idx} className="SpotterCarousel-Slide" style={{ flex: '0 0 100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', width: '100%' }}>
                  <img src={slideSrc} alt={slideAlt} style={{ width: '100%', height: 'auto', display: 'block', margin: '0 auto', maxHeight: '850px', objectFit: 'cover' }} />
                </div>
              );
            })}
          </div>

          {/* Navigation Arrows */}
          {this.currentIndex > 0 && (
            <div 
              className="SpotterCarousel-Arrow SpotterCarousel-Prev" 
              onclick={this.prevSlide.bind(this)}
              style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
            >
              <i className="fas fa-chevron-left"></i>
            </div>
          )}
          
          {this.currentIndex < this.images.length - 1 && (
            <div 
              className="SpotterCarousel-Arrow SpotterCarousel-Next" 
              onclick={this.nextSlide.bind(this)}
              style={{ position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
            >
              <i className="fas fa-chevron-right"></i>
            </div>
          )}

        </div>

        {/* EXIF CARD (updates based on currently visible image ID) */}
        {/* Anahtarlı öğe kendi dizisinde: kardeşleri anahtarsız, karışık anahtar hatası vermesin */}
        {this.SpotterImageCard && currentItem.id ? [(
          <div key={`exif-${currentItem.id}`} className="SpotterCarousel-ExifCard" style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
            {m(this.SpotterImageCard, {
              photoId: currentItem.id,
              disableImage: true,
              // Lightbox EXIF temasında (i) düğmesi carousel alanına yerleşir (görsel kartın içinde değil)
              imageWrapper: this.containerEl,
              currentIndex: this.currentIndex,
              totalCount: this.images.length,
              initialExifOpen: this.isExifOpen,
              onToggleExif: (state) => { this.isExifOpen = state; }
            })}
          </div>
        )] : null}

      </div>
    );
  }
}
