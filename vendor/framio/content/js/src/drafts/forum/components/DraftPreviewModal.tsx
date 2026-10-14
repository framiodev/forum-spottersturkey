import Modal, { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import app from 'flarum/forum/app';
import type Mithril from 'mithril';
import type Draft from '../models/Draft';
import ScheduleDraftModal from './ScheduleDraftModal';

export interface IDraftPreviewModalAttrs extends IInternalModalAttrs {
  draft: Draft;
  onedit?: () => void;
}

export default class DraftPreviewModal extends Modal<IDraftPreviewModalAttrs> {
  className() {
    return 'DraftPreviewModal Modal--medium';
  }

  title() {
    const draft = this.attrs.draft;
    const title = draft.type() === 'reply' ? draft.loadRelationships().discussion?.title() ?? draft.title() : draft.title();
    return title || 'Taslak Önizlemesi';
  }

  content() {
    const draft = this.attrs.draft;
    const rawContent = draft.content() || '';
    const extra = draft.extra?.() || {};

    const canSchedule = Boolean(
      (app.forum.attribute<boolean>('canScheduleDrafts') ?? app.forum.attribute<boolean>('canSaveDrafts')) &&
      (app.forum.attribute<boolean>('drafts.enableScheduledDrafts') ?? true)
    );

    const isScheduled = Boolean(draft.scheduledFor());

    return (
      <div className="Modal-body DraftPreviewModal-body">
        <div className="DraftPreviewModal-meta">
          <span className="DraftPreviewModal-badge">
            <i className={draft.icon()} style={{ marginRight: '5px' }}></i>
            {draft.type() === 'reply' ? 'Yanıt Taslağı' : 'Konu Taslağı'}
          </span>

          {extra.spotter_image_count > 0 && (
            <span className="DraftPreviewModal-stat DraftPreviewModal-stat--images">
              <i className="fas fa-camera" style={{ marginRight: '4px' }}></i>
              {extra.spotter_image_count} fotoğraf
            </span>
          )}

          {draft.updatedAt() && (
            <span className="DraftPreviewModal-date">
              <i className="far fa-clock" style={{ marginRight: '4px' }}></i>
              {draft.updatedAt()?.toLocaleString?.() ?? ''}
            </span>
          )}

          {isScheduled && (
            <span
              className="DraftPreviewModal-scheduledBadge"
              title="Planlama zamanını düzenlemek için tıklayın"
              onclick={() => {
                this.hide();
                app.modal.show(ScheduleDraftModal as any, { draft });
              }}
            >
              <i className="far fa-clock" style={{ marginRight: '4px' }}></i>
              {dayjs ? dayjs(draft.scheduledFor()).format('DD.MM.YYYY HH:mm') : new Date(draft.scheduledFor()).toLocaleString()} Planlandı
            </span>
          )}
        </div>

        <div className="DraftPreviewModal-content Post-body"></div>

        <div className="DraftPreviewModal-actions">
          {canSchedule && (
            <Button
              className={`Button ${isScheduled ? 'Button--scheduled' : 'Button--secondary'}`}
              icon={isScheduled ? 'fas fa-calendar-check' : 'fas fa-calendar-plus'}
              onclick={() => {
                this.hide();
                app.modal.show(ScheduleDraftModal as any, { draft });
              }}
            >
              {isScheduled ? 'Zamanlamayı Değiştir' : 'İçeriği Planla'}
            </Button>
          )}

          <Button
            className="Button Button--primary"
            icon="fas fa-pen-to-square"
            onclick={() => {
              this.hide();
              if (this.attrs.onedit) {
                this.attrs.onedit();
              } else if (app.drafts) {
                app.drafts.showComposer(draft);
              }
            }}
          >
            Düzenleyiciye Yükle & Devam Et
          </Button>

          <Button className="Button" onclick={() => this.hide()}>
            Kapat
          </Button>
        </div>
      </div>
    );
  }

  oncreate(vnode: any) {
    super.oncreate(vnode);
    this.renderPreview(vnode.dom);
  }

  onupdate(vnode: any) {
    super.onupdate(vnode);
    this.renderPreview(vnode.dom);
  }

  private renderPreview(dom: HTMLElement) {
    if (!dom) return;
    try {
      const previewBody = dom.querySelector('.DraftPreviewModal-content') as HTMLElement;
      if (!previewBody) return;

      const rawContent = this.attrs.draft.content() || '';

      // Flarum client-side formatter preview (exact same engine used by ComposerPostPreview)
      const s9e = (window as any).s9e;
      if (s9e?.TextFormatter?.preview) {
        s9e.TextFormatter.preview(rawContent, previewBody);
      } else {
        previewBody.innerHTML = rawContent.replace(/\n/g, '<br>');
      }

      // Mount SpotterCards for ulasimarsiv images
      const containers = previewBody.querySelectorAll('.ulasimarsiv-image-container');
      if (containers.length === 0) return;

      const SpotterImageManager = (window as any).SpotterImageManager;
      const SpotterImageCard = SpotterImageManager?.SpotterImageCard;

      containers.forEach((el: Element) => {
        const id = el.getAttribute('data-id');
        const exifPlaceholder = el.querySelector('.spotter-exif-placeholder') as HTMLElement;
        el.classList.add('SpotterCard');

        if (SpotterImageCard && exifPlaceholder && !exifPlaceholder.hasChildNodes()) {
          m.mount(exifPlaceholder, {
            view: () => m(SpotterImageCard, { photoId: id, initialExifOpen: false })
          });
        }
      });
    } catch (e) {
      console.error('Draft preview render failed:', e);
    }
  }
}
