import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import app from 'flarum/forum/app';
import type Mithril from 'mithril';
import type Draft from '../models/Draft';

export interface IReplyDraftAlertAttrs {
  draft: Draft;
  onRestore: () => void;
  onDiscard: () => void;
}

export default class ReplyDraftAlert extends Component<IReplyDraftAlertAttrs> {
  view() {
    const { draft, onRestore, onDiscard } = this.attrs;

    return (
      <div className="ReplyDraftAlert-card">
        <div className="ReplyDraftAlert-header">
          <div className="ReplyDraftAlert-badge">
            <i className="fas fa-feather-pointed"></i>
          </div>
          <div className="ReplyDraftAlert-info">
            <span className="ReplyDraftAlert-title">Kaydedilmiş Taslak</span>
            <p className="ReplyDraftAlert-text">Bu konuya ait yarım kalan bir yanıt taslağınız var.</p>
          </div>
        </div>
        <div className="ReplyDraftAlert-actions">
          <Button className="Button Button--primary Button--sm ReplyDraftAlert-loadBtn" icon="fas fa-arrow-rotate-left" onclick={onRestore}>
            Taslağı Yükle
          </Button>
          <Button className="Button Button--danger Button--sm ReplyDraftAlert-deleteBtn" icon="fas fa-trash-can" onclick={onDiscard}>
            Sil
          </Button>
        </div>
      </div>
    );
  }
}
