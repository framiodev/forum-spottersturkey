import { extend } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import ReplyDraftAlert from './components/ReplyDraftAlert';
import { adjustDraftCount } from './utils/draftCount';
import type Draft from './models/Draft';

export default function addDiscussionReplyAlert() {
  extend('flarum/forum/components/DiscussionPage', 'sidebarItems', function (items) {
    if (!app.session.user) return;

    const discussion = (this as any).discussion;
    if (!discussion) return;

    const discId = discussion.id();
    const drafts = app.store.all<Draft>('drafts');
    
    // Bu tartışmaya ait yanıt taslağını bul
    const replyDraft = drafts.find((d) => {
      if (d.type() !== 'reply') return false;
      const rels = d.loadRelationships();
      const draftDiscId = rels.discussion ? (typeof rels.discussion.id === 'function' ? rels.discussion.id() : rels.discussion.id) : null;
      return String(draftDiscId) === String(discId);
    });

    if (replyDraft && app.composer.position !== 'fullScreen' && app.composer.position !== 'normal') {
      items.add(
        'replyDraftAlert',
        <ReplyDraftAlert
          draft={replyDraft}
          onRestore={() => {
            if (app.drafts) {
              app.drafts.showComposer(replyDraft);
            }
          }}
          onDiscard={() => {
            if (confirm('Bu yanıta ait taslağı silmek istediğinize emin misiniz?')) {
              replyDraft.delete().then(() => {
                adjustDraftCount(-1);
                m.redraw();
              });
            }
          }}
        />,
        15
      );
    }
  });
}
