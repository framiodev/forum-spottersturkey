import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';

const GUEST_NAME_KEY = 'framioCommentGuestName';

function storage(get, value) {
  try {
    if (get) return window.localStorage.getItem(GUEST_NAME_KEY) || '';
    window.localStorage.setItem(GUEST_NAME_KEY, value);
  } catch (e) {}
  return '';
}

function ago(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'az önce';
  if (s < 3600) return Math.floor(s / 60) + ' dk';
  if (s < 86400) return Math.floor(s / 3600) + ' sa';
  if (s < 86400 * 7) return Math.floor(s / 86400) + ' g';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Düz metni güvenli vnode'lara çevirir: bağlantılar ve @kullanıcı adları tıklanabilir */
function richText(text) {
  const out = [];
  const re = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])|(^|\s)@([\p{L}\p{N}_.-]{2,30})/gu;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) {
      out.push(text.slice(last, m.index));
      out.push(<a href={m[1]} target="_blank" rel="nofollow noopener noreferrer">{m[1].replace(/^https?:\/\//, '').slice(0, 60)}</a>);
    } else {
      out.push(text.slice(last, m.index) + m[2]);
      out.push(<a className="PostComments-Mention" href={app.route('user', { username: m[3] })}>@{m[3]}</a>);
    }
    last = re.lastIndex;
  }
  out.push(text.slice(last));
  return out;
}

/** Mesajın görselleri ve (varsa) her görselin kendi künyesi */
function parsePost(post) {
  const box = document.createElement('div');
  box.innerHTML = post.contentHtml() || '';
  const images = [];
  box.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src');
    if (src && !/emoji|avatar|\.svg/i.test(src) && !images.includes(src)) images.push(src);
  });
  const lines = (card) => Array.from(card.querySelectorAll('li')).map((li) => li.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let cards = Array.from(box.querySelectorAll('.framio-kunye-card'));
  if (!cards.length) cards = Array.from(box.querySelectorAll('ul')).slice(0, 1);
  const withLines = cards.filter((c) => lines(c).length);
  const kunyes = withLines.map(lines);
  // Künye kartının gönderideki HTML hali (ana sayfa lightbox'ı gibi aynen gösterilir)
  const kunyeHtml = withLines.map((c) => { c.querySelectorAll("img, figure, hr").forEach((x) => x.remove()); return c.outerHTML; });
  return { images, kunyes, kunyeHtml };
}

/**
 * Mesaj yorumları paneli: solda mesajın fotoğrafları, sağda yorumlar.
 * Flarum'un modal yöneticisinden bağımsız, gövdeye bağlanan katman.
 */
class CommentsPanel extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.post = this.attrs.post;
    this.info = parsePost(this.post);
    this.multi = this.info.images.length > 1;
    this.imageIndex = 0;
    this.comments = [];
    this.loading = true;
    this.sending = false;
    this.error = '';
    this.canComment = true;
    this.canLike = !!app.session.user;
    this.maxLength = 1000;
    this.content = '';
    this.guestName = storage(true);
    this.website = '';
    this.editing = null;
    this.editText = '';
    this.replyTo = null;
    this.filter = 'all'; // all | photo
    this.attachPhoto = false; // yorum bu fotoğrafa mı
    this.flash = null;
    this.onkey = (e) => {
      if (e.key === 'Escape') return this.attrs.onclose();
      const typing = /INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '');
      if (!typing && this.multi && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        this.goImage(e.key === 'ArrowLeft' ? -1 : 1);
        m.redraw();
      }
    };
    this.load();
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    document.addEventListener('keydown', this.onkey);
    document.body.classList.add('SpottersGallery-NoScroll');
  }

  onremove(vnode) {
    super.onremove(vnode);
    document.removeEventListener('keydown', this.onkey);
    document.body.classList.remove('SpottersGallery-NoScroll');
  }

  api(method, path = '', body) {
    return app.request({
      method,
      url: app.forum.attribute('apiUrl') + '/post-comments' + path,
      params: method === 'GET' ? { post: this.post.id() } : undefined,
      body,
      errorHandler: (err) => {
        throw err;
      },
    });
  }

  errorText(err) {
    const e = err && err.response && err.response.errors && err.response.errors[0];
    return (e && e.detail) || 'Bir hata oluştu, lütfen tekrar deneyin.';
  }

  load() {
    this.api('GET')
      .then((res) => {
        this.comments = res.data || [];
        const meta = res.meta || {};
        this.canComment = meta.canComment !== false;
        this.canLike = !!meta.canLike;
        this.maxLength = meta.maxLength || 1000;
        this.syncCount();
      })
      .catch((err) => (this.error = this.errorText(err)))
      .then(() => {
        this.loading = false;
        const focus = this.attrs.focus && this.comments.find((c) => String(c.id) === String(this.attrs.focus));
        if (focus) {
          if (focus.photoIndex !== null && focus.photoIndex < this.info.images.length) this.imageIndex = focus.photoIndex;
          this.highlight(focus.id);
        } else {
          this.scrollList();
        }
        m.redraw();
      });
  }

  syncCount() {
    // Mesaj altındaki "Yorumlar (n)" düğmesi ve son yorum önizlemesi
    const top = this.comments.filter((c) => !c.parentId);
    const last = top[top.length - 1];
    this.post.pushAttributes({
      postCommentCount: this.comments.length,
      postCommentPreview: last ? { name: last.author.name, avatarUrl: last.author.avatarUrl || null, text: last.content.slice(0, 160) } : null,
    });
  }

  scrollList() {
    requestAnimationFrame(() => {
      const list = this.element && this.element.querySelector('.PostComments-List');
      if (list) list.scrollTop = list.scrollHeight;
    });
  }

  highlight(id) {
    this.flash = id;
    setTimeout(() => {
      const el = this.element && this.element.querySelector(`[data-comment="${id}"]`);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 50);
    setTimeout(() => {
      this.flash = null;
      m.redraw();
    }, 2200);
  }

  submit(e) {
    if (e) e.preventDefault();
    const guest = !app.session.user;
    if (!this.content.trim() || this.sending) return;
    if (guest && this.guestName.trim().length < 2) {
      this.error = 'Lütfen adınızı yazın.';
      return;
    }

    this.sending = true;
    this.error = '';
    this.api('POST', '', {
      post: this.post.id(),
      content: this.content,
      parentId: this.replyTo ? this.replyTo.id : undefined,
      photoIndex: !this.replyTo && this.multi && this.attachPhoto ? this.imageIndex : undefined,
      guestName: guest ? this.guestName.trim() : undefined,
      website: this.website,
    })
      .then((res) => {
        this.comments.push(res.data);
        this.content = '';
        this.replyTo = null;
        if (guest) storage(false, this.guestName.trim());
        this.syncCount();
        this.highlight(res.data.id);
      })
      .catch((err) => (this.error = this.errorText(err)))
      .then(() => {
        this.sending = false;
        m.redraw();
      });
  }

  saveEdit(c) {
    const text = this.editText.trim();
    if (!text) return;
    this.api('PATCH', '/' + c.id, { content: text })
      .then((res) => {
        Object.assign(c, res.data);
        this.editing = null;
        this.syncCount();
      })
      .catch((err) => (this.error = this.errorText(err)))
      .then(() => m.redraw());
  }

  remove(c) {
    const replies = this.comments.filter((x) => x.parentId === c.id).length;
    if (!window.confirm(replies ? `Bu yorum ve ${replies} yanıtı silinsin mi?` : 'Bu yorum silinsin mi?')) return;
    this.api('DELETE', '/' + c.id)
      .then(() => {
        this.comments = this.comments.filter((x) => x !== c && x.parentId !== c.id);
        this.syncCount();
      })
      .catch((err) => (this.error = this.errorText(err)))
      .then(() => m.redraw());
  }

  toggleLike(c) {
    if (!this.canLike) {
      this.error = 'Beğenmek için giriş yapın.';
      return;
    }
    // Anında göster, sunucu yanıtıyla düzelt
    c.liked = !c.liked;
    c.likes = Math.max(0, (c.likes || 0) + (c.liked ? 1 : -1));
    this.api('POST', '/' + c.id + '/like')
      .then((res) => {
        c.liked = res.liked;
        c.likes = res.likes;
      })
      .catch((err) => {
        c.liked = !c.liked;
        c.likes = Math.max(0, c.likes + (c.liked ? 1 : -1));
        this.error = this.errorText(err);
      })
      .then(() => m.redraw());
  }

  reply(c, parent) {
    this.replyTo = parent || c;
    const mention = c.author && c.author.username ? `@${c.author.username} ` : '';
    if (mention && !this.content.startsWith(mention) && c !== this.replyTo) this.content = mention + this.content;
    requestAnimationFrame(() => {
      const ta = this.element && this.element.querySelector('.PostComments-Compose textarea');
      if (ta) ta.focus();
    });
  }

  goImage(dir) {
    const n = this.info.images.length;
    if (n < 2) return;
    this.imageIndex = (this.imageIndex + dir + n) % n;
  }

  autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  // ───────────────────────────────────────────────────────── Görünüm

  viewComment(c, parent) {
    const a = c.author || {};
    const avatar = a.avatarUrl ? (
      <img className="PostComments-Avatar" src={a.avatarUrl} alt="" />
    ) : (
      <span className={'PostComments-Avatar PostComments-Avatar--letter' + (a.guest ? ' is-guest' : '')}>{(a.name || '?').charAt(0).toLocaleUpperCase('tr-TR')}</span>
    );
    const name = a.slug ? (
      <a href={app.route('user', { username: a.slug })} target="_blank" rel="noopener" className="PostComments-Name">{a.name}</a>
    ) : (
      <span className="PostComments-Name">{a.name}</span>
    );
    const replies = parent ? [] : this.comments.filter((x) => x.parentId === c.id);

    return (
      <div className={'PostComments-Item' + (parent ? ' is-reply' : '') + (this.flash === c.id ? ' is-flash' : '')} key={c.id} data-comment={c.id}>
        {avatar}
        <div className="PostComments-Main">
          <div className="PostComments-Bubble">
            <div className="PostComments-NameRow">
              {name}
              {a.guest ? <em className="PostComments-Tag">ziyaretçi</em> : null}
              {c.isPostAuthor ? <em className="PostComments-Tag is-author">paylaşan</em> : null}
              {!parent && this.multi && c.photoIndex !== null ? (
                <button className="PostComments-PhotoTag" title="Bu fotoğrafa git" onclick={() => (this.imageIndex = c.photoIndex)}>
                  <i className="fas fa-camera"></i> {c.photoIndex + 1}
                </button>
              ) : null}
            </div>
            {this.editing === c ? (
              <div className="PostComments-Edit">
                <textarea className="FormControl" value={this.editText} maxlength={this.maxLength} oninput={(e) => (this.editText = e.target.value)} />
                <div className="PostComments-EditActions">
                  <button className="Button Button--primary Button--small" onclick={() => this.saveEdit(c)}>Kaydet</button>
                  <button className="Button Button--small" onclick={() => (this.editing = null)}>Vazgeç</button>
                </div>
              </div>
            ) : (
              <div className="PostComments-Text">{richText(c.content)}</div>
            )}
            {c.likes ? (
              <span className="PostComments-LikeBadge"><i className="fas fa-heart"></i> {c.likes}</span>
            ) : null}
          </div>
          <div className="PostComments-Meta">
            <span title={c.createdAt ? new Date(c.createdAt).toLocaleString('tr-TR') : ''}>{ago(c.createdAt)}</span>
            <button className={c.liked ? 'is-liked' : ''} onclick={() => this.toggleLike(c)}>{c.liked ? 'Beğendin' : 'Beğen'}</button>
            {this.canComment ? <button onclick={() => this.reply(c, parent)}>Yanıtla</button> : null}
            {c.edited ? <span>düzenlendi</span> : null}
            {c.canEdit && this.editing !== c ? <button onclick={() => { this.editing = c; this.editText = c.content; }}>Düzenle</button> : null}
            {c.canDelete ? <button onclick={() => this.remove(c)}>Sil</button> : null}
          </div>
          {replies.length ? <div className="PostComments-Replies">{replies.map((r) => this.viewComment(r, c))}</div> : null}
        </div>
      </div>
    );
  }

  viewForm() {
    if (!this.canComment) {
      return (
        <div className="PostComments-Login">
          Yorum yapmak için <a onclick={() => { this.attrs.onclose(); app.modal.show(() => import('flarum/forum/components/LogInModal')); }}>giriş yapın</a>.
        </div>
      );
    }
    const guest = !app.session.user;
    const left = this.maxLength - this.content.length;

    return (
      <form className="PostComments-Form" onsubmit={(e) => this.submit(e)}>
        {this.replyTo ? (
          <div className="PostComments-ReplyBar">
            <span><i className="fas fa-reply"></i> <strong>{this.replyTo.author.name}</strong> kişisine yanıt</span>
            <button type="button" title="Vazgeç" onclick={() => (this.replyTo = null)}><i className="fas fa-times"></i></button>
          </div>
        ) : this.multi ? (
          <label className={'PostComments-AttachPhoto' + (this.attachPhoto ? ' is-on' : '')}>
            <input type="checkbox" checked={this.attachPhoto} onchange={(e) => (this.attachPhoto = e.target.checked)} />
            <i className="fas fa-camera"></i> Yorumu {this.imageIndex + 1}. fotoğrafa bağla
          </label>
        ) : null}
        {guest ? (
          <input className="FormControl PostComments-GuestName" placeholder="Adınız" maxlength="40" value={this.guestName} oninput={(e) => (this.guestName = e.target.value)} />
        ) : null}
        {/* Bot tuzağı: insanlar görmez */}
        <input className="PostComments-Trap" tabindex="-1" autocomplete="off" name="website" value={this.website} oninput={(e) => (this.website = e.target.value)} aria-hidden="true" />
        <div className="PostComments-Compose">
          <textarea
            className="FormControl"
            placeholder={this.replyTo ? 'Yanıt yazın…' : guest ? 'Ziyaretçi olarak yorum yazın…' : 'Yorum yazın…'}
            rows="1"
            maxlength={this.maxLength}
            value={this.content}
            oninput={(e) => {
              this.content = e.target.value;
              this.autoGrow(e.target);
            }}
            onupdate={(vnode) => !this.content && (vnode.dom.style.height = '')}
            onkeydown={(e) => {
              // Enter gönderir, Shift+Enter yeni satır
              if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                this.submit();
              }
            }}
          />
          <button type="submit" className="PostComments-Send" disabled={!this.content.trim() || this.sending} title="Gönder (Enter)">
            <i className={this.sending ? 'fas fa-spinner fa-spin' : 'fas fa-paper-plane'}></i>
          </button>
        </div>
        <div className="PostComments-Hint">
          <span>Enter ile gönder · Shift+Enter yeni satır</span>
          {left < 150 ? <span className={left < 30 ? 'is-low' : ''}>{left} karakter kaldı</span> : null}
        </div>
      </form>
    );
  }

  /** Fotoğraf: kendi boyutunda (siyah çerçeve yok), oklar görselin kenarında */
  viewMedia() {
    const { images } = this.info;
    if (!images.length) return <div className="PostComments-NoImage"><i className="far fa-images"></i></div>;
    return (
      <div
        className="PostComments-Stage"
        ontouchstart={(e) => (this.touchX = e.changedTouches[0].clientX)}
        ontouchend={(e) => {
          if (this.touchX == null) return;
          const dx = e.changedTouches[0].clientX - this.touchX;
          this.touchX = null;
          if (Math.abs(dx) > 40) this.goImage(dx < 0 ? 1 : -1);
        }}
      >
        <img src={images[this.imageIndex]} alt={(this.currentKunye() || []).join(' - ')} />
        {/* Ana sayfa lightbox'ındaki yüzen düğmeler */}
        <div className="PostComments-FloatingActions">
          {this.post.discussion() ? (
            <a href={app.route.post(this.post)} className="PostComments-FloatBtn primary" data-tooltip="Konuya Git" onclick={() => this.attrs.onclose()}>
              <i className="fas fa-external-link-square-alt"></i>
            </a>
          ) : null}
          <a href={images[this.imageIndex]} target="_blank" rel="noopener" className="PostComments-FloatBtn" data-tooltip="Orijinal Boyut">
            <i className="fas fa-expand-arrows-alt"></i>
          </a>
        </div>
        {this.multi ? (
          <div className="PostComments-StageNav">
            <button className="PostComments-InnerNav prev" title="Önceki (←)" onclick={(e) => { e.stopPropagation(); this.goImage(-1); }}><i className="fas fa-angle-left"></i></button>
            <button className="PostComments-InnerNav next" title="Sonraki (→)" onclick={(e) => { e.stopPropagation(); this.goImage(1); }}><i className="fas fa-angle-right"></i></button>
            <span className="PostComments-Counter-Badge">{this.imageIndex + 1} / {images.length}</span>
          </div>
        ) : null}
      </div>
    );
  }

  /** Çoklu fotoğrafta ekranın altında film şeridi (ana sayfa lightbox'ı gibi) */
  viewFilmstrip() {
    if (!this.multi) return null;
    return (
      <div className="PostComments-Filmstrip" onclick={(e) => e.stopPropagation()}>
        {this.info.images.map((src, i) => {
          const n = this.comments.filter((c) => !c.parentId && c.photoIndex === i).length;
          return (
            <button className={'PostComments-Thumb' + (i === this.imageIndex ? ' is-active' : '')} onclick={() => (this.imageIndex = i)}>
              <img src={src} alt="" loading="lazy" />
              {n ? <span className="PostComments-Thumb-Count"><i className="fas fa-comment"></i> {n}</span> : null}
            </button>
          );
        })}
      </div>
    );
  }

  currentKunyeHtml() {
    const { kunyeHtml, images } = this.info;
    if (!kunyeHtml.length) return "";
    return kunyeHtml.length === images.length ? kunyeHtml[this.imageIndex] : kunyeHtml[0];
  }

  currentKunye() {
    const { kunyes, images } = this.info;
    if (!kunyes.length) return null;
    return kunyes.length === images.length ? kunyes[this.imageIndex] : kunyes[0];
  }

  view() {
    const close = () => this.attrs.onclose();
    const user = this.post.user();
    const discussion = this.post.discussion();
    const kunye = this.currentKunye();
    const lines = kunye || [];
    // Başlık, ana sayfa lightbox'ındaki gibi: "Firma & 2. satır" (tek satırsa o satır, yoksa konu başlığı)
    let title = discussion ? discussion.title() : '';
    if (lines.length >= 2) {
      const company = lines[0].includes('|') ? lines[0].split('|')[0].trim() : lines[0].includes(' - ') ? lines[0].split(' - ')[0].trim() : lines[0];
      title = `${company} & ${lines[1]}`;
    } else if (lines.length === 1) {
      title = lines[0];
    }

    const top = this.comments.filter((c) => !c.parentId && (this.filter === 'all' || c.photoIndex === this.imageIndex));
    const photoCount = this.comments.filter((c) => !c.parentId && c.photoIndex === this.imageIndex).length;

    return (
      <div className={'PostComments-Overlay' + (this.multi ? ' has-filmstrip' : '')} onclick={close}>
        <button className="PostComments-CloseBtn" onclick={close} title="Kapat (Esc)">
          <i className="fas fa-times"></i>
        </button>

        <div className="PostComments-Box" onclick={(e) => e.stopPropagation()}>
          <div className="PostComments-Media">{this.viewMedia()}</div>

          <div className="PostComments-Side">
            {/* Başlık kartı (ana sayfa lightbox'ıyla aynı: "Firma & Marka Model") */}
            <div className="PostComments-Card PostComments-TitleCard">
              <h2>{title}</h2>
            </div>

            {/* Yorumlar kartı: kalan yüksekliği doldurur */}
            <div className="PostComments-Card PostComments-SectionCard PostComments-CommentsCard">
              <div className="PostComments-CardHeader">
                <h4>Yorumlar {this.comments.length ? `(${this.comments.length})` : ''}</h4>
                {this.multi ? (
                  <div className="PostComments-Filter">
                    <button className={this.filter === 'all' ? 'is-active' : ''} onclick={() => (this.filter = 'all')}>Tümü</button>
                    <button className={this.filter === 'photo' ? 'is-active' : ''} onclick={() => (this.filter = 'photo')}>
                      {this.imageIndex + 1}. fotoğraf {photoCount ? `(${photoCount})` : ''}
                    </button>
                  </div>
                ) : null}
              </div>
              {/* Paylaşan ve künye: yorumların üstünde, aynı kartta */}
              <div className="PostComments-CardBody PostComments-KunyeBlock">
                <div className="PostComments-Author">
                  {user && user.avatarUrl() ? <img className="PostComments-Avatar" src={user.avatarUrl()} alt="" /> : <span className="PostComments-Avatar PostComments-Avatar--letter">{user ? user.displayName().charAt(0) : '?'}</span>}
                  <div className="PostComments-AuthorText">
                    {user ? <a className="PostComments-Name" href={app.route.user(user)}>{user.displayName()}</a> : <span className="PostComments-Name">Silinmiş kullanıcı</span>}
                    <span className="PostComments-By">
                      {this.post.createdAt() ? this.post.createdAt().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                    </span>
                  </div>
                </div>
                {lines.length ? (
                  <div className="PostComments-KunyeHtml Post-body">{m.trust(this.currentKunyeHtml())}</div>
                ) : null}
              </div>

              <div className="PostComments-List">
                {this.loading ? (
                  <div className="PostComments-Empty"><i className="fas fa-spinner fa-spin"></i></div>
                ) : top.length ? (
                  top.map((c) => this.viewComment(c))
                ) : (
                  <div className="PostComments-Empty">
                    <i className="far fa-comment-dots"></i>
                    <div>{this.filter === 'photo' ? 'Bu fotoğrafa henüz yorum yok.' : 'Henüz yorum yok. İlk yorumu siz yapın!'}</div>
                  </div>
                )}
              </div>

              {this.error ? <div className="PostComments-Error" onclick={() => (this.error = '')}>{this.error}</div> : null}
              {this.viewForm()}
            </div>
          </div>
        </div>

        {this.viewFilmstrip()}
      </div>
    );
  }
}

let host = null;

export default function openComments(post, options = {}) {
  if (!host) {
    host = document.createElement('div');
    host.className = 'PostComments-Host';
    document.body.appendChild(host);
  }
  const onclose = () => {
    m.mount(host, null);
    m.redraw();
  };
  m.mount(host, { view: () => m(CommentsPanel, { post, onclose, focus: options.focus }) });
}
