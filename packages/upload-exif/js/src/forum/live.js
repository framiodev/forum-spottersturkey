import app from 'flarum/forum/app';

/**
 * Canlı güncelleme (paylaşımlı barındırmada soket olmadığı için hafif yoklama):
 *  - Sitenin dosyaları güncellenince (yeni sürüm) sekme kendini yeniler; mesaj yazılıyorsa ya da
 *    bir pencere açıksa yazı kaybolmasın diye bunlar kapanınca yenilenir.
 *  - Açık başlığa yeni mesaj gelince sayfa yenilenmeden mesaj akışa eklenir.
 *  - Başka bir başlığa mesaj gelince sol altta 6 saniyelik bildirim: "X, Y başlığına yeni paylaşım yaptı · Mesaja git".
 * Sekme arka plandayken yoklama yavaşlar; görünür olunca hemen kontrol edilir.
 */
export default function live() {
  if (app.forum.attribute('framioLiveEnabled') === false) return;
  const interval = Math.max(15, Number(app.forum.attribute('framioLiveInterval') || 30)) * 1000;

  let rev = null;
  let since = 0;
  let pendingReload = false;
  let timer = null;
  let busy = false;

  const busyUser = () => {
    const composer = app.composer && app.composer.isVisible && app.composer.isVisible() && app.composer.fields && app.composer.fields.content && app.composer.fields.content();
    return !!composer || !!(app.modal && app.modal.modal) || !!document.querySelector('.FramioAssistant');
  };

  const reloadIfIdle = () => {
    if (!pendingReload) return;
    if (busyUser()) return;
    window.location.reload();
  };

  const toast = (p) => {
    let host = document.querySelector('.FramioLiveToasts');
    if (!host) {
      host = document.createElement('div');
      host.className = 'FramioLiveToasts';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'FramioLiveToast';
    el.innerHTML = `<span class="FramioLiveToast-avatar is-letter"></span><div class="FramioLiveToast-text"><strong></strong>, <em></em> başlığına yeni paylaşım yaptı.</div><button type="button" class="FramioLiveToast-go">Mesaja git</button><button type="button" class="FramioLiveToast-close" aria-label="Kapat">×</button>`;
    const av = el.querySelector('.FramioLiveToast-avatar');
    if (p.avatar) {
      const img = document.createElement('img');
      img.className = 'FramioLiveToast-avatar';
      img.alt = '';
      img.src = p.avatar;
      av.replaceWith(img);
    } else {
      av.textContent = (p.username || '?').charAt(0).toUpperCase();
    }
    el.querySelector('strong').textContent = p.username;
    el.querySelector('em').textContent = p.title;
    const close = () => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 300);
    };
    el.querySelector('.FramioLiveToast-go').onclick = () => {
      close();
      m.route.set(app.route('discussion.near', { id: p.discussion_id + (p.slug ? '-' + p.slug : ''), near: p.number }));
    };
    el.querySelector('.FramioLiveToast-close').onclick = close;
    host.appendChild(el);
    setTimeout(close, 6000);
  };

  const currentDiscussion = () => {
    const d = app.current && app.current.get && app.current.get('discussion');
    return d ? Number(d.id()) : null;
  };

  const refreshStream = async (discussionId) => {
    try {
      await app.store.find('discussions', String(discussionId));
      const stream = app.current.get('stream');
      if (stream && stream.update) {
        await stream.update();
        m.redraw();
      }
    } catch (e) {}
  };

  const poll = async () => {
    if (busy) return;
    busy = true;
    try {
      const res = await app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/framio/live?since=' + since, background: true, errorHandler: () => {} });
      if (rev === null) rev = res.rev;
      else if (res.rev && res.rev !== rev) {
        pendingReload = true;
        reloadIfIdle();
      }

      const me = app.session.user ? Number(app.session.user.id()) : 0;
      const here = currentDiscussion();
      const refreshHere = new Set();
      (res.posts || []).forEach((p) => {
        if (p.user_id === me) return;
        if (here && p.discussion_id === here) refreshHere.add(here);
        else toast(p);
      });
      refreshHere.forEach((id) => refreshStream(id));
      since = Math.max(since, res.latest || 0);
    } catch (e) {
      // sessiz: bir sonraki yoklamada yeniden denenir
    } finally {
      busy = false;
    }
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await poll();
      schedule();
    }, document.hidden ? interval * 4 : interval);
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      poll();
      schedule();
    }
  });
  // Yazı ya da pencere kapanınca bekleyen yenileme yapılır
  document.addEventListener('click', () => setTimeout(reloadIfIdle, 500), true);

  poll();
  schedule();
}
