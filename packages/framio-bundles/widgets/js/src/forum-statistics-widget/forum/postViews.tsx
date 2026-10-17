import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import Button from 'flarum/common/components/Button';
import ViewersModal from './components/ViewersModal';

/**
 * Mesaj görüntülenmeleri:
 *  - Bir mesaj ekranda en az 1 saniye yarısından fazlası görünür kalınca "okundu"
 *    sayılır; birikenler 4 saniyede bir sunucuya gönderilir.
 *  - Mesajın başlığında görüntülenme sayısı (izin: framio-stats.viewPostViews);
 *    tıklayınca kimlerin görüntülediği (izin: framio-stats.viewViewers).
 *  - Tartışma menüsünde "Görüntüleyenler" (izin: framio-stats.viewViewers).
 */

const queue = new Map<number, number>(); // postId → discussionId
const sent = new Set<number>();
const timers = new Map<Element, number>();
let observer: IntersectionObserver | null = null;

function flush() {
  if (!queue.size) return;
  const byDiscussion = new Map<number, number[]>();
  queue.forEach((d, p) => byDiscussion.set(d, [...(byDiscussion.get(d) || []), p]));
  queue.clear();
  byDiscussion.forEach((postIds, discussionId) => {
    app
      .request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/framio-views', body: { discussionId, postIds }, errorHandler: () => {} } as any)
      .catch(() => {});
  });
}

function getObserver(): IntersectionObserver | null {
  if (observer || typeof IntersectionObserver === 'undefined') return observer;
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const el = e.target as HTMLElement;
        const postId = Number(el.dataset.framioPost);
        const discussionId = Number(el.dataset.framioDiscussion);
        if (!postId || sent.has(postId)) return;
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          if (!timers.has(el)) {
            timers.set(
              el,
              window.setTimeout(() => {
                timers.delete(el);
                if (document.visibilityState !== 'visible' || sent.has(postId)) return;
                sent.add(postId);
                queue.set(postId, discussionId);
                observer!.unobserve(el);
              }, 1000)
            );
          }
        } else if (timers.has(el)) {
          window.clearTimeout(timers.get(el));
          timers.delete(el);
        }
      });
    },
    { threshold: [0, 0.5, 1] }
  );
  window.setInterval(flush, 4000);
  window.addEventListener('pagehide', flush);

  return observer;
}

export default function registerPostViews() {
  extend(CommentPost.prototype, 'oncreate', function () {
    const post = this.attrs.post;
    const el = this.element as HTMLElement;
    const disc = post && post.discussion && post.discussion();
    if (!el || !post || !disc || post.isHidden()) return;
    el.dataset.framioPost = String(post.id());
    el.dataset.framioDiscussion = String(disc.id());
    const obs = getObserver();
    if (obs) obs.observe(el);
  });

  extend(CommentPost.prototype, 'onremove', function () {
    const el = this.element as HTMLElement;
    if (observer && el) observer.unobserve(el);
    if (el && timers.has(el)) {
      window.clearTimeout(timers.get(el));
      timers.delete(el);
    }
  });

  // Mesaj başlığındaki görüntülenme sayısı kaldırıldı: sayı, mesajın altındaki okunma
  // sayacında (engagement → kim okudu) gösteriliyor.

  // Tartışma menüsü: "Görüntüleyenler"
  extend(DiscussionControls, 'moderationControls', function (items, discussion) {
    if (!app.forum.attribute('framioCanViewViewers')) return;
    items.add(
      'framioViewers',
      <Button icon="far fa-eye" onclick={() => app.modal.show(ViewersModal, { kind: 'discussion', id: discussion.id() })}>
        Görüntüleyenler
      </Button>
    );
  });
}
