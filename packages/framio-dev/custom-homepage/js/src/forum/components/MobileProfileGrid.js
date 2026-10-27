import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';

/**
 * Telefon profil ızgarası (onaylı maket 4): kullanıcının mesajlarındaki fotoğraflar 3 sütunlu,
 * boşluksuz kare ızgarada. Veri, profil sayfasının zaten yüklediği mesaj listesinden (PostListState) gelir;
 * "Daha fazla" listeyi bir sonraki sayfayla genişletir.
 */
export default class MobileProfileGrid extends Component {
  // Basılı tutma (Instagram gibi): 450 ms sonra görüntüleyici açılır; ızgaradaki sıradaki gönderilere kaydırılabilir
  pressStart(tiles, t) {
    this.pressCancel();
    this.timer = setTimeout(() => {
      const v = window.FramioMobileViewer;
      if (!v) return;
      this.pressed = true;
      if (navigator.vibrate) navigator.vibrate(15);
      const posts = tiles.map((x) => x.post);
      v.openPosts(posts, posts.indexOf(t.post));
    }, 450);
  }

  pressCancel() {
    clearTimeout(this.timer);
  }

  view() {
    const state = this.attrs.state;
    const posts = (state.getAllItems ? state.getAllItems() : []).filter((p) => p && p.contentType && p.contentType() === 'comment');

    const tiles = [];
    posts.forEach((post) => {
      const box = document.createElement('div');
      box.innerHTML = post.contentHtml() || '';
      const imgs = [...box.querySelectorAll('img')].filter((i) => !i.classList.contains('emoji') && (i.getAttribute('src') || '').length);
      // Kare küçük görsel için 480 px yeterli (görsel sunucusu ?w= ile boyutlandırır)
      if (imgs.length) tiles.push({ post, src: imgs[0].getAttribute('src').replace(/([?&])w=\d+/, '$1w=480'), alt: imgs[0].getAttribute('alt') || '', multi: imgs.length > 1 });
    });

    const loading = state.isLoading && state.isLoading();
    const more = state.hasNext && state.hasNext();

    return (
      <div className="MobileProfileGrid">
        {tiles.length ? (
          <div className="MobileProfileGrid-tiles">
            {tiles.map((t) => (
              <a href={app.route.post(t.post)} className="MobileProfileGrid-tile"
                onclick={(e) => { e.preventDefault(); if (this.pressed) { this.pressed = false; return; } m.route.set(app.route.post(t.post)); }}
                oncontextmenu={(e) => e.preventDefault()}
                ontouchstart={() => this.pressStart(tiles, t)}
                ontouchmove={() => this.pressCancel()}
                ontouchend={() => this.pressCancel()}>
                <img src={t.src} alt={t.alt} loading="lazy" decoding="async" />
                {t.multi ? <i className="icon fas fa-clone" /> : null}
              </a>
            ))}
          </div>
        ) : !loading ? <p className="MobileProfileGrid-empty">Henüz fotoğraf paylaşılmamış.</p> : null}
        {loading ? <div className="MobileProfileGrid-loading">Yükleniyor…</div> : null}
        {!loading && more ? (
          <button type="button" className="MobileProfileGrid-more" onclick={() => state.loadNext()}>Daha fazla göster</button>
        ) : null}
      </div>
    );
  }
}
