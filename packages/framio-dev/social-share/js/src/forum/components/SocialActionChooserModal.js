import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import app from 'flarum/forum/app';
import ShareModal from './ShareModal';
import StoryModal from './StoryModal';

export default class SocialActionChooserModal extends Modal {
  className() {
    return 'SocialActionChooserModal Modal--medium';
  }

  title() {
    return 'Sosyal Medyada Paylaş';
  }

  content() {
    const post = this.attrs.post;
    const images = this.attrs.images || [];
    const canShare = this.attrs.canShare !== false;
    const canStory = this.attrs.canStory !== false;

    const discussion = post && post.discussion ? post.discussion() : null;
    const title = discussion && discussion.title ? discussion.title() : 'Forum Gönderisi';
    const firstImg = images.length > 0 ? images[0] : null;

    return (
      <div className="Modal-body" style="padding: 24px; background: #f8fafc;">
        {/* Üst Bilgi Kartı */}
        <div style="display: flex; gap: 14px; align-items: center; background: #ffffff; padding: 14px 18px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 22px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
          {firstImg ? (
            <div style="width: 56px; height: 56px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: #e2e8f0;">
              <img src={firstImg} style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
          ) : (
            <div style="width: 56px; height: 56px; border-radius: 8px; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">
              <i className="fas fa-camera"></i>
            </div>
          )}
          <div style="flex: 1; min-width: 0;">
            <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Seçilen Gönderi</span>
            <h4 style="margin: 2px 0 0 0; font-size: 14px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              {title}
            </h4>
            <span style="font-size: 12px; color: #64748b;">Toplam {images.length} fotoğraf mevcut</span>
          </div>
        </div>

        {/* 2 Ana Eylem Kartı */}
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
          
          {/* KART 1: GÖNDERİ PAYLAŞ (Feed / Post / Carousel) */}
          <div 
            style={`background: #ffffff; border: 2px solid #e2e8f0; border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s ease; opacity: ${canShare ? '1' : '0.6'};`}
            onmouseover={e => { if (canShare) { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(59, 130, 246, 0.15)'; } }}
            onmouseout={e => { if (canShare) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; } }}
          >
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                <div style="width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">
                  <i className="fas fa-clone"></i>
                </div>
                <div style="display: flex; gap: 5px;">
                  <span style="width: 24px; height: 24px; border-radius: 50%; background: #1877f2; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px;"><i className="fab fa-facebook-f"></i></span>
                  <span style="width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(45deg, #f09433, #dc2743, #bc1888); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px;"><i className="fab fa-instagram"></i></span>
                  <span style="width: 24px; height: 24px; border-radius: 50%; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px;"><i className="fab fa-threads"></i></span>
                </div>
              </div>

              <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: #0f172a;">
                Gönderi Paylaş
              </h3>
              <p style="margin: 0 0 16px 0; font-size: 12.5px; color: #475569; line-height: 1.5;">
                Fotoğrafları albüm (carousel) olarak Facebook Sayfası, Instagram ve Threads akışında tek tıkla paylaşın veya ileri bir tarihe planlayın.
              </p>

              <ul style="list-style: none; padding: 0; margin: 0 0 18px 0; font-size: 11.5px; color: #64748b; display: flex; flex-direction: column; gap: 6px;">
                <li style="display: flex; align-items: center; gap: 6px;"><i className="fas fa-check" style="color: #10b981;"></i> Yapay Zeka (AI) metin ve hashtag üretici</li>
                <li style="display: flex; align-items: center; gap: 6px;"><i className="fas fa-check" style="color: #10b981;"></i> Çoklu fotoğraf & filigran (watermark) desteği</li>
                <li style="display: flex; align-items: center; gap: 6px;"><i className="fas fa-check" style="color: #10b981;"></i> Otomatik künye & saatlik zamanlayıcı</li>
              </ul>
            </div>

            <Button
              className="Button Button--primary Button--block"
              style="background: #2563eb; border: none; font-weight: 700; font-size: 13px; padding: 11px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);"
              disabled={!canShare}
              onclick={() => {
                app.modal.show(ShareModal, {
                  post: post,
                  images: images,
                  canGoBack: true
                });
              }}
            >
              <i className="fas fa-paper-plane" style="margin-right: 6px;"></i> Gönderi Paylaş
            </Button>
          </div>

          {/* KART 2: HİKAYE OLUŞTUR VE PAYLAŞ (Story / 9:16) */}
          <div 
            style={`background: #ffffff; border: 2px solid #e2e8f0; border-radius: 14px; padding: 22px 18px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s ease; opacity: ${canStory ? '1' : '0.6'};`}
            onmouseover={e => { if (canStory) { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(16, 185, 129, 0.15)'; } }}
            onmouseout={e => { if (canStory) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; } }}
          >
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                <div style="width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">
                  <i className="fas fa-mobile-alt"></i>
                </div>
                <span style="background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; border: 1px solid #a7f3d0;">
                  9:16 Story
                </span>
              </div>

              <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: #0f172a;">
                Hikaye Oluştur ve Paylaş
              </h3>
              <p style="margin: 0 0 16px 0; font-size: 12.5px; color: #475569; line-height: 1.5;">
                Dikey 9:16 hikaye stüdyosunda künyeli ve logolu şablonlar tasarlayın. Cihazınıza indirin veya anında Instagram & Facebook Hikayesi olarak paylaşın.
              </p>

              <ul style="list-style: none; padding: 0; margin: 0 0 18px 0; font-size: 11.5px; color: #64748b; display: flex; flex-direction: column; gap: 6px;">
                <li style="display: flex; align-items: center; gap: 6px;"><i className="fas fa-check" style="color: #10b981;"></i> Otomatik künye, plaka & şehir rozetleri</li>
                <li style="display: flex; align-items: center; gap: 6px;"><i className="fas fa-check" style="color: #10b981;"></i> Hareketli video ve cam (frosted glass) fonları</li>
                <li style="display: flex; align-items: center; gap: 6px;"><i className="fas fa-check" style="color: #10b981;"></i> Meta Story (IG & FB) anlık paylaşım ve planlama</li>
                <li style="display: flex; align-items: center; gap: 6px;"><i className="fas fa-check" style="color: #10b981;"></i> Canva Pro ile tam profesyonel tasarım</li>
              </ul>
            </div>

            <Button
              className="Button Button--primary Button--block"
              style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; font-weight: 700; font-size: 13px; padding: 11px; border-radius: 8px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);"
              disabled={!canStory}
              onclick={() => {
                app.modal.show(StoryModal, {
                  post: post,
                  images: images,
                  imageUrl: images[0],
                  canGoBack: true
                });
              }}
            >
              <i className="fas fa-magic" style="margin-right: 6px;"></i> Hikaye Oluştur ve Paylaş
            </Button>
          </div>

        </div>
      </div>
    );
  }
}
