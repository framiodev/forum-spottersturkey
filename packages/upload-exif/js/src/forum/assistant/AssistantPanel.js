import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import folder, { normalize } from './folder';

/** Karşılaştırma için: küçük harf, Türkçe harfler sadeleşir, noktalama atılır ("Başlık." → "baslik") */
const fold = (s) =>
  String(s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c])
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
import { canListen, listenOnce, speak, whenQuiet, hush } from './speech';
import ghost from './ghost';
import drive from './drive';
import { shotYear, plateKey, slots, localStamp, humanDate, isAny, isYes } from './planner';
import { getMeta, putMeta } from './catalog';
import AttributeModal from '../components/AttributeModal';

/** "34ARS603" → "34 ARS 603" */
const plateText = (name) => {
  const k = plateKey(name);
  const m = k && k.match(/^(\d{2})([A-ZÇĞİÖŞÜ]{1,3})(\d{2,5})$/);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : '';
};

/**
 * Framio Asistan paneli: sesli / yazılı komutla bağlı klasördeki fotoğrafı bulur, Framio AI ile
 * künyesini çıkarır, uygun başlığı önerir, onayla filigranlı yükleyip paylaşır.
 * Onaylanan her paylaşım öğrenilir; aynı model aynı başlığa yeterince gidince asistan başlığı
 * kendisi seçer ve kısa bir geri sayımla (iptal edilebilir) paylaşır.
 */
const api = (path) => app.forum.attribute('apiUrl') + path;
const pref = (key, def) => {
  const u = app.session.user;
  const v = u && u.preferences() ? u.preferences()[key] : undefined;
  return v === undefined || v === null || v === '' ? def : v;
};

export function assistantName() {
  return pref('framio_assistant_name', '') || 'Framio Asistan';
}

/** Framio AI için görseli en fazla 768 px JPEG'e küçültür */
function shrink(file, max = 768) {
  if (!window.createImageBitmap) return Promise.resolve(file);
  return createImageBitmap(file)
    .then((bmp) => {
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise((r) => c.toBlob((b) => r(b || file), 'image/jpeg', 0.82));
    })
    .catch(() => file);
}

function kunyeText(f) {
  const lines = [];
  const l1 = [f.company, f.plate].filter(Boolean).join(' | ');
  const l2 = [f.brand, f.model].filter(Boolean).join(' ');
  const yy = f.year ? "'" + String(f.year).slice(-2) : '';
  const l3 = [f.location, yy].filter(Boolean).join(' / ');
  [l1, l2, l3].forEach((l) => l && lines.push(`- **${l}**`));
  if (!lines.length) return '';
  const theme = app.forum.attribute('framio-upload-exif.kunye_theme') || 'classic';
  return `[framio-kunye theme="${theme}"]\n${lines.join('\n')}\n[/framio-kunye]`;
}

function upload(file, watermark) {
  return new Promise((resolve, reject) => {
    const data = new FormData();
    data.append('spotter_image', file);
    data.append('watermark_type', watermark || 'none');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', api('/framio-media/upload'));
    xhr.setRequestHeader('X-CSRF-Token', app.session.csrfToken);
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        res.bbcode ? resolve(res.bbcode) : reject(new Error('Yükleme yanıtı boş.'));
      } catch (e) {
        reject(new Error('Yükleme başarısız (' + xhr.status + ').'));
      }
    };
    xhr.onerror = () => reject(new Error('Yükleme sırasında bağlantı kesildi.'));
    xhr.send(data);
  });
}

class Panel extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.log = [];
    this.input = '';
    this.listening = false;
    this.busy = false;
    this.queue = []; // onay bekleyen fotoğraf kartları
    this.folderName = null;
    // "Uzaktan kullanım" görünümü: kullanıcı tercihi, yoksa sitenin varsayılanı
    const sitePref = app.forum.attribute('framioAssistantShowActions') !== false;
    const own = app.session.user.preferences().framio_assistant_show_actions;
    ghost.enabled = own === undefined || own === null || own === '' ? sitePref : !!own;
    folder.load().then(() => {
      this.folderName = folder.name();
      m.redraw();
    });
    this.task = null; // soru-cevap bekleyen görev
    this.convId = null; // her açılış yeni bir sohbet
    this.convs = [];
    this.showArchived = false;
    this.sideOpen = window.innerWidth >= 900;
    this.loadConversations();
    this.welcome();
  }

  /** Yeni sohbet: karşılama + seçenekler; okunmamış planlı paylaşım bildirimleri de söylenir */
  welcome() {
    this.say('Bugün ne yapmak istersiniz?', true, false);
    this.log.push({ who: 'choices' });
    app
      .request({ method: 'GET', url: api('/framio-assistant/history?mark=1') })
      .then((res) => {
        const notices = (res.messages || []).filter((x) => x.role === 'notice');
        if (notices.length) this.say(notices.map((n) => n.text).join(' '), true, false);
      })
      .catch(() => {});
  }

  /** Karşılamadaki seçenekler: tıklanınca kısa bir yönlendirme sorusu sorulur, cevabı serbestçe yazılır */
  choose(kind) {
    this.log = this.log.filter((l) => l.who !== 'choices');
    const map = {
      single: ['İçerik paylaşmak istiyorum', 'Hangi aracı paylaşalım? Plakası ya da dosya adı yeterli; isterseniz başlığı ya da çekim yerini de söyleyebilirsiniz.'],
      batch: ['Toplu içerik paylaşmak istiyorum', 'Harika. Hangi fotoğraflardan, kaç tane ve hangi başlıklara? Örneğin "Esenler 2026 çekimlerinden her Mercedes başlığına birer tane".'],
      plan: ['İleri bir tarih için içerik planlamak istiyorum', 'Ne zaman ve nasıl paylaşalım? Örneğin "Drive’daki 2026 çekimlerinden 70 fotoğraf, 7 gün boyunca her gün 12.00’de 10’ar tane".'],
      list: ['Planlı paylaşımlarımı göster', null],
    };
    const [mine, reply] = map[kind];
    this.log.push({ who: 'me', text: mine });
    this.remember('me', mine);
    if (kind === 'list') return this.listSchedule();
    this.say(reply);
  }

  loadConversations() {
    return app
      .request({ method: 'GET', url: api('/framio-assistant/conversations') })
      .then((res) => {
        this.convs = res.conversations || [];
        m.redraw();
      })
      .catch(() => {});
  }

  newConversation() {
    hush();
    this.convId = null;
    this.log = [];
    this.queue = [];
    this.task = null;
    this.confirming = null;
    this.awaiting = null;
    this.pendingItems = [];
    if (window.innerWidth < 900) this.sideOpen = false;
    this.welcome();
  }

  openConversation(id) {
    hush();
    this.convId = id;
    this.queue = [];
    this.task = null;
    this.confirming = null;
    this.awaiting = null;
    this.log = [];
    if (window.innerWidth < 900) this.sideOpen = false;
    m.redraw();
    app
      .request({ method: 'GET', url: api('/framio-assistant/history?limit=500&conversation=' + id) })
      .then((res) => {
        this.log = (res.messages || []).map((x) => ({ who: x.role === 'notice' ? 'bot' : x.role, text: x.text, old: true }));
        m.redraw();
        this.scroll();
      })
      .catch(() => {});
  }

  updateConversation(c, changes) {
    Object.assign(c, changes);
    m.redraw();
    app.request({ method: 'POST', url: api('/framio-assistant/conversations'), body: Object.assign({ id: c.id }, changes) }).then(() => this.loadConversations()).catch(() => {});
  }

  deleteConversation(c) {
    if (!confirm(`"${c.title}" sohbeti silinsin mi? Bu geri alınamaz.`)) return;
    this.convs = this.convs.filter((x) => x.id !== c.id);
    if (this.convId === c.id) this.newConversation();
    m.redraw();
    app.request({ method: 'DELETE', url: api('/framio-assistant/conversations?id=' + c.id) }).catch(() => {});
  }

  remember(role, text) {
    // İlk kayıt sohbeti oluşturur; sonraki mesajlar aynı sohbete yazılır (sıra korunur)
    this.saving = (this.saving || Promise.resolve()).then(() =>
      app
        .request({ method: 'POST', url: api('/framio-assistant/history'), body: { role, text, conversation_id: this.convId } })
        .then((res) => {
          if (res && res.conversation_id && res.conversation_id !== this.convId) {
            this.convId = res.conversation_id;
            this.loadConversations();
          }
        })
        .catch(() => {})
    );
  }

  sidebarView() {
    const list = this.convs.filter((c) => !!c.archived === this.showArchived);
    return (
      <aside className="FramioAssistant-side">
        <button type="button" className="FramioAssistant-new" onclick={() => this.newConversation()}>
          <i className="fas fa-plus"></i> Yeni sohbet
        </button>
        <div className="FramioAssistant-sideTabs">
          <button type="button" className={!this.showArchived ? 'is-active' : ''} onclick={() => (this.showArchived = false)}>
            Sohbetler
          </button>
          <button type="button" className={this.showArchived ? 'is-active' : ''} onclick={() => (this.showArchived = true)}>
            Arşiv
          </button>
        </div>
        <div className="FramioAssistant-convs">
          {list.length ? null : <p className="helpText">{this.showArchived ? 'Arşivde sohbet yok.' : 'Henüz sohbet yok.'}</p>}
          {list.map((c) => (
            <div className={'FramioAssistant-conv' + (c.id === this.convId ? ' is-active' : '')} key={c.id}>
              <button type="button" className="FramioAssistant-convTitle" title={c.title} onclick={() => this.openConversation(c.id)}>
                {c.pinned ? <i className="fas fa-thumbtack"></i> : null} {c.title}
              </button>
              <span className="FramioAssistant-convActions">
                <button type="button" title={c.pinned ? 'Sabitlemeyi kaldır' : 'Başa tuttur'} aria-label={c.pinned ? 'Sabitlemeyi kaldır' : 'Başa tuttur'} onclick={() => this.updateConversation(c, { pinned: !c.pinned })}>
                  <i className="fas fa-thumbtack"></i>
                </button>
                <button type="button" title={c.archived ? 'Arşivden çıkar' : 'Arşivle'} aria-label={c.archived ? 'Arşivden çıkar' : 'Arşivle'} onclick={() => this.updateConversation(c, { archived: !c.archived })}>
                  <i className={c.archived ? 'fas fa-box-open' : 'fas fa-archive'}></i>
                </button>
                <button type="button" title="Sil" aria-label="Sil" onclick={() => this.deleteConversation(c)}>
                  <i className="far fa-trash-alt"></i>
                </button>
              </span>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  choicesView() {
    const items = [
      ['single', 'fas fa-image', 'İçerik paylaş', 'Tek bir aracı plakasıyla bulup paylaşır'],
      ['batch', 'fas fa-images', 'Toplu içerik paylaş', 'Birden çok fotoğrafı başlıklarına dağıtır'],
      ['plan', 'far fa-calendar-alt', 'İleri tarihe planla', 'Seçtiğiniz gün ve saatlerde paylaşır'],
      ['list', 'fas fa-list-ul', 'Planlarım', 'Bekleyen planlı paylaşımlar'],
    ];
    return (
      <div className="FramioAssistant-choices">
        {items.map(([k, icon, title, desc]) => (
          <button type="button" className="FramioAssistant-choice" onclick={() => this.choose(k)}>
            <i className={icon}></i>
            <strong>{title}</strong>
            <span>{desc}</span>
          </button>
        ))}
      </div>
    );
  }

  /** Anlık durum satırı ("Klasörü tarıyorum…"); yeni adım gelince önceki ✓ olur */
  step(text) {
    this.log.forEach((l) => l.who === 'step' && (l.done = true));
    if (text) this.log.push({ who: 'step', text, done: false });
    m.redraw();
    this.scroll();
  }

  scroll() {
    setTimeout(() => {
      const el = document.querySelector('.FramioAssistant-log');
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  }

  say(text, voice = true, store = true) {
    this.log.forEach((l) => l.who === 'step' && (l.done = true));
    this.log.push({ who: 'bot', text });
    if (store) this.remember('bot', text);
    const spoken = voice && pref('framio_assistant_speak', true) ? speak(text) : Promise.resolve();
    m.redraw();
    setTimeout(() => {
      const el = document.querySelector('.FramioAssistant-log');
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
    return spoken;
  }

  view() {
    return (
      <div className={'FramioAssistant' + (this.sideOpen ? ' has-side' : '')} role="dialog" aria-label={assistantName()}>
        {this.sideOpen ? this.sidebarView() : null}
        <div className="FramioAssistant-main">
        <header className="FramioAssistant-head">
          <button type="button" className="FramioAssistant-sideToggle" aria-label="Sohbetler" title="Sohbetler" onclick={() => (this.sideOpen = !this.sideOpen)}>
            <i className="fas fa-bars"></i>
          </button>
          <span className="FramioAssistant-badge">
            <i className="fas fa-magic"></i>
          </span>
          <strong>{assistantName()}</strong>
          <button
            type="button"
            className={'FramioAssistant-folder' + (this.showSources ? ' is-open' : '')}
            title="Fotoğraf kaynaklarını yönet"
            aria-expanded={this.showSources ? 'true' : 'false'}
            onclick={() => {
              this.showSources = !this.showSources;
              folder.load().then(() => m.redraw());
            }}
          >
            <i className="far fa-folder"></i> {this.folderName || 'Kaynak ekle'} <i className={'fas fa-chevron-' + (this.showSources ? 'up' : 'down')}></i>
          </button>
          <button type="button" className="FramioAssistant-close" aria-label="Kapat" onclick={() => assistant.close()}>
            <i className="fas fa-times"></i>
          </button>
        </header>

        {this.showSources ? this.sourcesView() : null}

        <div className={'FramioAssistant-log' + (this.showSources ? ' is-hidden' : '')}>
          {this.log.map((l) =>
            l.who === 'choices' ? (
              this.choicesView()
            ) : l.who === 'step' ? (
              <div className={'FramioAssistant-step' + (l.done ? ' is-done' : '')}>
                <i className={l.done ? 'fas fa-check' : 'fas fa-circle-notch fa-spin'}></i> {l.text}
              </div>
            ) : (
              <div className={'FramioAssistant-msg is-' + l.who + (l.old ? ' is-old' : '')}>{l.text}</div>
            )
          )}
          {this.queue.map((card) => this.cardView(card))}
          {this.confirmView()}
          {this.busy ? (
            <div className="FramioAssistant-msg is-bot is-typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          ) : null}
        </div>

        {!folder.supported() ? (
          <p className="FramioAssistant-note">Bu tarayıcı klasör erişimini desteklemiyor; Chrome ya da Edge kullanın.</p>
        ) : !this.folderName ? (
          <div className="FramioAssistant-sources">
            <Button className="Button FramioAssistant-link" icon="far fa-folder-open" onclick={() => this.linkFolder()}>
              Klasör bağla
            </Button>
            {drive.available() ? (
              <Button className="Button FramioAssistant-link" icon="fab fa-google-drive" onclick={() => { this.showSources = true; this.linkDrive(); }}>
                Google Drive
              </Button>
            ) : null}
          </div>
        ) : null}

        <form
          className="FramioAssistant-input"
          onsubmit={(e) => {
            e.preventDefault();
            this.command(this.input);
          }}
        >
          {canListen() ? (
            <button type="button" className={'FramioAssistant-mic' + (this.listening ? ' is-on' : '')} aria-label="Sesli komut" onclick={() => this.listen()}>
              <i className="fas fa-microphone"></i>
            </button>
          ) : null}
          <input
            className="FormControl"
            placeholder={this.listening ? 'Dinliyorum…' : 'Komut yazın ya da mikrofona dokunun'}
            value={this.input}
            oninput={(e) => (this.input = e.target.value)}
          />
          <button type="submit" className="FramioAssistant-send" aria-label="Gönder" disabled={!this.input.trim()}>
            <i className="fas fa-paper-plane"></i>
          </button>
        </form>
        </div>
      </div>
    );
  }

  /**
   * Bulunan fotoğrafı gösterir ve onay ister: "Paylaş" / "Atla" / "Görevi durdur" (ya da sesli/yazılı evet, hayır, iptal).
   * @return {Promise<'yes'|'no'|'stop'>}
   */
  confirmItem(c, f, topic, summary, extras = []) {
    return new Promise(async (resolve) => {
      const items = [];
      for (const x of [c, ...extras].filter(Boolean)) {
        try {
          const blob = await this.img(x);
          items.push({ name: x.name, file: x.file || null, blob, src: x, url: URL.createObjectURL(blob) });
        } catch (e) {}
      }
      const cf = { items, name: c.name, path: c.path, summary, topic, resolve, left: 120, fields: f, kunye: null };
      // Kullanıcıdan 120 saniye haber gelmezse paylaşılır (her dokunuşta süre baştan başlar)
      cf.timer = setInterval(() => {
        if (cf.paused) return; // künye düzenlenirken süre durur
        cf.left -= 1;
        if (cf.left <= 0) {
          this.say('120 saniyedir yanıt gelmedi, paylaşıyorum.', false);
          this.resolveConfirm('yes');
        }
        m.redraw();
      }, 1000);
      this.confirming = cf;
      m.redraw();
      this.scroll();
      const n = items.length;
      await this.say(`Şunu buldum: ${summary || c.name}${n > 1 ? `, ${n} pozla` : ''}. ${topic.title} başlığına paylaşayım mı?`);
    });
  }

  resolveConfirm(decision) {
    const cf = this.confirming;
    if (!cf) return;
    clearInterval(cf.timer);
    this.confirming = null;
    this.confirmed = decision === 'yes' ? cf.items.map((x) => ({ name: x.name, file: x.file, src: x.src })) : null;
    this.confirmedKunye = decision === 'yes' ? cf.kunye : null;
    cf.items.forEach((x) => {
      try {
        URL.revokeObjectURL(x.url);
      } catch (e) {}
    });
    this.log.push({ who: 'me', text: decision === 'yes' ? 'Paylaş' : decision === 'stop' ? 'Görevi durdur' : 'Atla' });
    m.redraw();
    cf.resolve(decision);
  }

  /** Kart üzerinde düzenleme: sıra, silme, bilgisayardan fotoğraf ekleme */
  editConfirm(fn) {
    const cf = this.confirming;
    if (!cf) return;
    cf.left = 120;
    fn(cf.items);
    m.redraw();
  }

  /** Künye modalı (elle yüklemedeki ile aynı) asistanın üstünde açılır; süre bu sırada durur */
  editKunye() {
    const cf = this.confirming;
    if (!cf) return;
    cf.paused = true;
    const files = cf.items.map((x) => x.file || x.blob);
    const f = cf.fields || {};
    const resume = () => {
      if (this.confirming === cf) {
        cf.paused = false;
        cf.left = 120;
        m.redraw();
      }
    };
    const done = (text) => {
      if (this.confirming !== cf) return;
      cf.kunye = Array.isArray(text) ? text.filter(Boolean).join('\n') : text || null;
      cf.summary = (cf.summary || '') + ' · künye düzenlendi';
      resume();
    };
    app.modal.show(AttributeModal, {
      initialValues: { company: f.company || '', plate: f.plate || '', brand: f.brand || '', model: f.model || '', location: f.location || '', year: f.year || '' },
      files,
      session: { fileList: files, result: { customFileNames: files.map((x) => x.name) }, completedUploads: [] },
      onsubmit: (text) => done(text),
      onInfo: (text) => {
        done(text);
        app.modal.close();
      },
      onskip: () => resume(),
      oncancel: () => resume(),
      ongoback: () => resume(),
    });
  }

  confirmView() {
    const cf = this.confirming;
    if (!cf) return null;
    const move = (i, d) => this.editConfirm((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
    });
    const remove = (i) => this.editConfirm((list) => {
      const [x] = list.splice(i, 1);
      try {
        URL.revokeObjectURL(x.url);
      } catch (e) {}
    });
    const add = (files) => this.editConfirm((list) => {
      Array.from(files || []).filter((f) => /^image\//.test(f.type)).forEach((f) => list.push({ name: f.name, file: f, blob: f, url: URL.createObjectURL(f) }));
    });
    return (
      <div className="FramioAssistant-card is-confirm">
        {cf.items[0] ? <img src={cf.items[0].url} alt="" /> : null}
        <div className="FramioAssistant-cardBody">
          <p>
            <strong>{cf.summary || cf.name}</strong>
          </p>
          <p className="helpText">
            {cf.path ? cf.path + '/' : ''}
            {cf.name}
          </p>
          <div className="FramioAssistant-poses">
            {cf.items.map((x, i) => (
              <div className="FramioAssistant-pose">
                <img src={x.url} alt={x.name} title={x.name} />
                <span className="FramioAssistant-poseNo">{i + 1}</span>
                <div className="FramioAssistant-poseTools">
                  <button type="button" aria-label="Sola al" title="Sola al" disabled={i === 0} onclick={() => move(i, -1)}>
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <button type="button" aria-label="Kaldır" title="Kaldır" disabled={cf.items.length < 2} onclick={() => remove(i)}>
                    <i className="fas fa-times"></i>
                  </button>
                  <button type="button" aria-label="Sağa al" title="Sağa al" disabled={i === cf.items.length - 1} onclick={() => move(i, 1)}>
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            ))}
            <label className="FramioAssistant-poseAdd" title="Fotoğraf ekle">
              <i className="fas fa-plus"></i>
              <span>Fotoğraf ekle</span>
              <input type="file" accept="image/*" multiple onchange={(e) => { add(e.target.files); e.target.value = ''; }} />
            </label>
          </div>
          <p>
            <i className="fas fa-arrow-right"></i> {cf.topic.title}
          </p>
          <div className="FramioAssistant-actions">
            <Button className="Button Button--primary" icon="fas fa-paper-plane" disabled={!cf.items.length} onclick={() => this.resolveConfirm('yes')}>
              Paylaş ({cf.left} sn)
            </Button>
            <Button className="Button" icon="fas fa-pen" onclick={() => this.editKunye()}>
              Künyeyi düzenle
            </Button>
            <Button className="Button" onclick={() => this.resolveConfirm('no')}>
              Atla
            </Button>
            <Button className="Button Button--link" onclick={() => this.resolveConfirm('stop')}>
              Durdur
            </Button>
          </div>
          <p className="helpText">Yanıt vermezseniz {cf.left} saniye sonra kendiliğinden paylaşırım. Pozları sıralayabilir, kaldırabilir ya da bilgisayarınızdan ekleyebilirsiniz.</p>
        </div>
      </div>
    );
  }

  /**
   * Hızlı inceleme (katalogdan ya da yapay zekanın hızlı kipiyle). Dosya adında plaka varsa plaka oradan.
   * Sonuç bu tarayıcının kataloğuna yazılır; aynı dosya bir daha gönderilmez.
   */
  async quickAnalyze(c) {
    const hit = await getMeta(c);
    if (hit) return Object.assign({}, hit, { plate: plateText(c.name) || hit.plate });
    const im = await this.img(c);
    const fd = new FormData();
    fd.append('image', await shrink(im), 'ai.jpg');
    if (c.file) fd.append('exif_head', c.file.slice(0, 256 * 1024), 'head.jpg');
    fd.append('file_name', c.name);
    fd.append('quick', '1');
    const ai = await app.request({ method: 'POST', url: api('/framio-media/analyze-ai'), body: fd });
    const d = (ai && ai.data) || {};
    const f = { company: d.company || '', plate: plateText(c.name) || d.plate || '', brand: d.brand || '', model: d.model || '', subject: d.subject || '', year: d.year || '' };
    putMeta(c, f);
    return f;
  }

  /** İnceleme ve önizleme için görüntü: yerel dosya, yoksa Drive'ın küçük önizlemesi, o da yoksa tam dosya */
  async img(c) {
    if (c.file) return c.file;
    if (c.preview) return c.preview;
    if (c.loadPreview) {
      try {
        return (c.preview = await c.loadPreview());
      } catch (e) {}
    }
    return (c.file = await c.load());
  }

  /** Klasör yapısından firma ve plaka: …/<firma>/<plaka>/<plaka>-1.jpg */
  companyFromPath(c) {
    const parts = String(c.path || '').split('/');
    const pk = plateKey(c.name);
    const i = parts.findIndex((x) => pk && plateKey(x) === pk);
    return i > 0 ? parts[i - 1] : '';
  }

  /**
   * Aynı aracın klasöründeki diğer pozlar: hareketi gösterecek şekilde dağıtılır
   * (sıralı karelerden ilk, orta ve son: en uzak → orta → en yakın / arka poz). En çok `max` kare.
   */
  async posesFor(c, pool, max = 3) {
    if (max <= 1 || !c.path) return [];
    const num = (n) => Number((String(n).match(/(\d+)(?=\.[a-z]+$)/i) || [])[1] || 0);
    // Aynı araç: aynı klasör VE (dosya adındaki plaka aynı ya da çekim zamanı en çok 3 dk farklı).
    // Düzensiz klasörlerde (IMG_1234.jpg, yüzlerce farklı araç) başka araçların kareleri böylece karışmaz.
    // Aynı araç: aynı klasördeki kareler arasından bariz ayrıntıları (plaka; plaka okunmuyorsa firma + marka + model)
    // birebir aynı olanlar. Klasör aracın plaka klasörüyse (…/34 ARS 603/) hepsi aynı araçtır.
    const pk = plateKey(c.name) || plateKey(c.f && c.f.plate);
    const folderIsPlate = pk && plateKey(String(c.path).split('/').pop()) === pk;
    const siblings = pool
      .filter((x) => x !== c && x.path === c.path && x.name !== c.name)
      .sort((a, b) => Math.abs((a.modified || 0) - (c.modified || 0)) - Math.abs((b.modified || 0) - (c.modified || 0)))
      .slice(0, 12);
    const ok = [];
    for (const x of siblings) {
      if (folderIsPlate || (pk && plateKey(x.name) === pk)) {
        ok.push(x);
        continue;
      }
      try {
        const g = await this.quickAnalyze(x);
        const gp = plateKey(g.plate);
        const ref = c.f || {};
        const same = gp && pk ? gp === pk : !gp && fold(g.company) && fold(g.company) === fold(ref.company) && fold(g.model) === fold(ref.model) && fold(g.brand) === fold(ref.brand);
        if (same && (!g.subject || g.subject === 'vehicle')) ok.push(x);
      } catch (e) {}
    }
    const same = [c, ...ok].sort((a, b) => num(a.name) - num(b.name) || a.name.localeCompare(b.name));
    if (same.length < 2) return [];
    const idx = [...new Set([0, Math.floor((same.length - 1) / 2), same.length - 1])];
    const picks = idx.map((i) => same[i]).filter((x) => x !== c).slice(0, max - 1);
    for (const x of picks) {
      try {
        await this.img(x);
      } catch (e) {}
    }
    return picks.filter((x) => x.file || x.preview);
  }

  /** Kaynak yöneticisi: klasörler, Google Drive oturumu, arama derinliği (profil ayarlarına gitmeden) */
  sourcesView() {
    const refresh = () => {
      this.folderName = folder.name();
      m.redraw();
    };
    const depth = String(pref('framio_assistant_depth', 2));
    const local = folder.list || [];
    const drives = drive.folders();

    return (
      <div className="FramioAssistant-sourcesPanel">
        <div className="FramioAssistant-sourcesHead">
          <strong>Fotoğraf kaynakları</strong>
          <span className="helpText">Yalnızca okuma — asistan silemez, değiştiremez.</span>
        </div>

        <div className="FramioAssistant-sourceGroup">
          <div className="FramioAssistant-sourceGroupTitle">
            <i className="fas fa-desktop"></i> Bu bilgisayar
          </div>
          {local.length ? null : <p className="helpText">Henüz klasör yok.</p>}
          {local.map((f) => (
            <div className={'FramioAssistant-sourceRow' + (f.enabled ? '' : ' is-off')} key={f.id}>
              <i className="far fa-folder"></i>
              <span className="FramioAssistant-sourceName" title={f.label}>
                {f.label}
              </span>
              <button type="button" className={'FramioAssistant-toggle' + (f.enabled ? ' is-on' : '')} aria-label={f.enabled ? 'Kapat' : 'Aç'} onclick={() => folder.toggle(f.id, !f.enabled).then(refresh)}>
                <span></span>
              </button>
              <button type="button" className="FramioAssistant-iconBtn" aria-label="Kaldır" title="Kaldır" onclick={() => confirm(`"${f.label}" kaynaklardan kaldırılsın mı? (Klasörünüze dokunulmaz.)`) && folder.remove(f.id).then(refresh)}>
                <i className="far fa-trash-alt"></i>
              </button>
            </div>
          ))}
          <Button className="Button FramioAssistant-addSource" icon="fas fa-plus" disabled={!folder.supported()} onclick={() => this.linkFolder().then(refresh)}>
            Klasör ekle
          </Button>
          {!folder.supported() ? <p className="helpText">Bu tarayıcı klasör erişimini desteklemiyor (Chrome ya da Edge gerekir).</p> : null}
          <p className="helpText">ExpanDrive, Google Drive masaüstü, OneDrive gibi bulut sürücülerindeki klasörler de buradan eklenebilir.</p>
        </div>

        <div className="FramioAssistant-sourceGroup">
          <div className="FramioAssistant-sourceGroupTitle">
            <i className="fab fa-google-drive"></i> Google Drive
          </div>
          {!drive.available() ? (
            <p className="helpText">Google Drive bağlantısı bu sitede henüz açılmadı (yönetici Google Cloud bilgilerini girince "Google ile oturum aç" düğmesi burada görünür).</p>
          ) : (
            [
              drives.map((f) => (
                <div className={'FramioAssistant-sourceRow' + (f.enabled ? '' : ' is-off')} key={f.id}>
                  <i className="fab fa-google-drive"></i>
                  <span className="FramioAssistant-sourceName" title={f.name}>
                    {f.name}
                  </span>
                  <button type="button" className={'FramioAssistant-toggle' + (f.enabled ? ' is-on' : '')} aria-label={f.enabled ? 'Kapat' : 'Aç'} onclick={() => { drive.toggle(f.id, !f.enabled); refresh(); }}>
                    <span></span>
                  </button>
                  <button type="button" className="FramioAssistant-iconBtn" aria-label="Kaldır" title="Kaldır" onclick={() => { drive.remove(f.id); refresh(); }}>
                    <i className="far fa-trash-alt"></i>
                  </button>
                </div>
              )),
              this.driveBrowse ? this.driveBrowseView(refresh) : null,
              <div className="FramioAssistant-sourceActions">
                <Button className="Button FramioAssistant-google" icon="fab fa-google" onclick={() => this.linkDrive().then(refresh)}>
                  {drive.connected() ? 'Drive klasörü ekle' : 'Google ile oturum aç'}
                </Button>
                {drive.connected() ? (
                  <Button className="Button Button--link" icon="fas fa-unlink" onclick={() => confirm('Google Drive bağlantısı kaldırılsın mı? (Google tarafındaki izin de geri alınır.)') && drive.disconnect().then(refresh)}>
                    Oturumu kapat
                  </Button>
                ) : null}
              </div>,
            ]
          )}
        </div>

        <div className="FramioAssistant-sourceGroup">
          <label className="FramioAssistant-sourceGroupTitle" for="framio-depth">
            <i className="fas fa-sitemap"></i> Alt klasörlerde arama
          </label>
          <select
            id="framio-depth"
            className="FormControl"
            value={depth}
            onchange={(e) => app.session.user.savePreferences({ framio_assistant_depth: Number(e.target.value) }).then(() => m.redraw())}
          >
            <option value="0">Yalnızca seçtiğim klasör</option>
            <option value="1">1 alt klasöre kadar</option>
            <option value="2">2 alt klasöre kadar</option>
            <option value="6">Tüm alt klasörler (yavaş olabilir)</option>
          </select>
        </div>

        <Button className="Button Button--primary FramioAssistant-sourcesDone" onclick={() => (this.showSources = false)}>
          Tamam
        </Button>
      </div>
    );
  }

  cardView(card) {
    const f = card.fields;
    const field = (key, label) => (
      <label className="FramioAssistant-field">
        <span>{label}</span>
        <input className="FormControl" data-key={key} value={f[key] || ''} oninput={(e) => (f[key] = e.target.value)} disabled={card.state !== 'ready'} />
      </label>
    );

    return (
      <div className={'FramioAssistant-card is-' + card.state} key={card.id} data-id={card.id}>
        {card.source ? <span className="FramioAssistant-source">{card.source}</span> : null}
        <img src={card.preview} alt="" />
        <div className="FramioAssistant-cardBody">
          {card.state === 'analyzing' ? <p className="helpText">Framio AI inceliyor…</p> : null}
          {card.state === 'done' ? (
            <p>
              <i className="fas fa-check-circle"></i> Paylaşıldı:{' '}
              <a href={app.forum.attribute('baseUrl') + card.doneUrl} onclick={() => assistant.close()}>
                {card.topicTitle}
              </a>
            </p>
          ) : null}
          {card.state === 'error' ? <p className="FramioAssistant-error">{card.error}</p> : null}
          {card.state === 'ready' || card.state === 'sharing' ? (
            <div>
              <div className="FramioAssistant-fields">
                {field('company', 'Firma')}
                {field('plate', 'Plaka')}
                {field('brand', 'Marka')}
                {field('model', 'Model')}
                {field('location', 'Çekim yeri')}
                {field('year', 'Yıl')}
              </div>
              <label className="FramioAssistant-field is-wide">
                <span>Başlık</span>
                <select className="FormControl" value={card.topic || ''} onchange={(e) => (card.topic = e.target.value)} disabled={card.state !== 'ready'}>
                  {card.suggestions.length ? null : <option value="">Uygun başlık bulunamadı</option>}
                  {card.suggestions.map((s) => (
                    <option value={s.discussion_id}>
                      {s.title}
                      {s.reason === 'learned' ? ' (öğrenildi)' : s.reason === 'history' ? ' (son seçiminiz)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {card.countdown ? <p className="FramioAssistant-auto">Öğrendiğim başlığa {card.countdown} sn içinde paylaşıyorum…</p> : null}
              <div className="FramioAssistant-actions">
                <Button className="Button Button--primary" icon="fas fa-paper-plane" loading={card.state === 'sharing'} disabled={!card.topic} onclick={() => this.share(card)}>
                  Paylaş
                </Button>
                <Button className="Button" onclick={() => this.skip(card)}>
                  {card.countdown ? 'Durdur' : 'Atla'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  /**
   * Google ile oturum açar ve panelin içinde Drive klasör gezginini açar (Google'ın ayrı seçici penceresine
   * gerek kalmaz). Yalnızca okuma izni istenir.
   */
  async linkDrive() {
    try {
      await drive.authorize(true);
    } catch (e) {
      return this.say(e.message || 'Google Drive bağlanamadı.');
    }
    this.showSources = true;
    this.driveBrowse = { stack: [{ id: 'root', name: "Drive'ım" }], items: [], loading: false, error: null };
    return this.browseDrive();
  }

  async browseDrive(to) {
    const b = this.driveBrowse;
    if (!b) return;
    if (to) {
      const i = b.stack.findIndex((s) => s.id === to.id);
      b.stack = i >= 0 ? b.stack.slice(0, i + 1) : b.stack.concat([to]);
    }
    b.loading = true;
    b.error = null;
    m.redraw();
    try {
      b.items = await drive.listFolders(b.stack[b.stack.length - 1].id);
    } catch (e) {
      b.items = [];
      b.error = e.message || 'Klasörler okunamadı.';
    }
    b.loading = false;
    m.redraw();
  }

  driveBrowseView(refresh) {
    const b = this.driveBrowse;
    const here = b.stack[b.stack.length - 1];
    const added = (id) => drive.folders().some((f) => f.id === id);
    const add = (f) => {
      drive.addFolder(f.id, f.name);
      refresh();
      this.say(`"${f.name}" Drive klasörünü ekledim. Yalnızca okuyabilirim; silme ya da değiştirme yetkim yok.`, false);
    };
    return (
      <div className="FramioAssistant-driveBrowse">
        <div className="FramioAssistant-crumbs">
          {b.stack.map((s, i) => [i ? <i className="fas fa-chevron-right"></i> : null, <button type="button" onclick={() => this.browseDrive(s)}>{s.name}</button>])}
          {b.stack.length === 1 ? (
            <button type="button" className="is-alt" onclick={() => this.browseDrive({ id: 'shared', name: 'Benimle paylaşılanlar' })}>
              Benimle paylaşılanlar
            </button>
          ) : null}
        </div>
        {here.id !== 'root' && here.id !== 'shared' ? (
          <Button className="Button Button--primary FramioAssistant-addHere" icon="fas fa-plus" disabled={added(here.id)} onclick={() => add(here)}>
            {added(here.id) ? 'Bu klasör ekli' : `"${here.name}" klasörünü ekle`}
          </Button>
        ) : null}
        <div className="FramioAssistant-driveList">
          {b.loading ? <p className="helpText"><i className="fas fa-circle-notch fa-spin"></i> Klasörler okunuyor…</p> : null}
          {b.error ? <p className="helpText">{b.error}</p> : null}
          {!b.loading && !b.error && !b.items.length ? <p className="helpText">Bu klasörde alt klasör yok.</p> : null}
          {b.items.map((f) => (
            <div className="FramioAssistant-sourceRow">
              <button type="button" className="FramioAssistant-driveDir" onclick={() => this.browseDrive(f)}>
                <i className="fas fa-folder"></i> {f.name}
              </button>
              <button type="button" className="FramioAssistant-iconBtn" title={added(f.id) ? 'Ekli' : 'Ekle'} aria-label={added(f.id) ? 'Ekli' : 'Ekle'} disabled={added(f.id)} onclick={() => add(f)}>
                <i className={added(f.id) ? 'fas fa-check' : 'fas fa-plus'}></i>
              </button>
            </div>
          ))}
        </div>
        <Button className="Button Button--link" onclick={() => (this.driveBrowse = null)}>
          Gezgini kapat
        </Button>
      </div>
    );
  }

  async linkFolder() {
    try {
      const f = await folder.link();
      this.folderName = folder.name();
      this.say(`"${f.label}" klasörünü bağladım (yalnızca okuma). Profil ayarlarından başka klasörler de ekleyebilirsiniz.`);
    } catch (e) {
      if (e && e.name !== 'AbortError') this.say('Klasör bağlanamadı.');
    }
  }

  async listen(prefix = '') {
    if (this.listening) return;
    await whenQuiet();
    this.listening = true;
    assistant.wake && assistant.wake.pause();
    m.redraw();
    try {
      const text = await listenOnce({
        onInterim: (t) => {
          this.input = t;
          m.redraw();
        },
      });
      this.listening = false;
      const full = [prefix, text].filter(Boolean).join(' ').trim();
      if (full) this.command(full);
    } catch (e) {
      this.listening = false;
      this.say(e.message);
    } finally {
      assistant.wake && assistant.wake.resume();
      m.redraw();
    }
  }

  async command(text) {
    text = String(text || '').trim();
    if (!text) return;
    hush();
    this.input = '';
    if (this.awaiting) {
      const done = this.awaiting;
      this.awaiting = null;
      this.log.push({ who: 'me', text });
      m.redraw();
      return done(text);
    }
    if (this.confirming) {
      const low = text.toLocaleLowerCase('tr-TR');
      if (/(iptal|durdur|dur\b|vazgeç|bitir)/.test(low)) return this.resolveConfirm('stop');
      if (isYes(low) || /(paylaş|gönder)/.test(low)) return this.resolveConfirm('yes');
      return this.resolveConfirm('no');
    }
    this.log.push({ who: 'me', text });
    this.remember('me', text);
    m.redraw();


    let intent;
    this.step('Komutu anlıyorum…');
    try {
      const pendingCard = this.queue.find((c) => c.state === 'ready');
      intent = await app.request({
        method: 'POST',
        url: api('/framio-assistant/parse'),
        body: {
          text,
          context: this.task && this.task.waiting ? this.task.question : '',
          history: this.log.filter((l) => l.who === 'me' || l.who === 'bot').slice(-13, -1).map((l) => ({ who: l.who, text: l.text })),
          card: pendingCard ? Object.assign({}, pendingCard.fields, { topic: ((pendingCard.suggestions || []).find((x) => String(x.discussion_id) === String(pendingCard.topic)) || {}).title || '' }) : null,
        },
      });
    } catch (e) {
      return this.say('Komutu işleyemedim.');
    }
    this.step(null);

    // Asistan bir soru sormuştu: cevapsa göreve devam; yeni ve tam bir istekse eski görev bırakılır
    if (this.task && this.task.waiting) {
      const fresh = ['batch', 'plan', 'share'].includes(intent.action) && (intent.per_topic || intent.count || intent.plate || intent.shot_year || intent.location);
      if (!fresh) return this.answer(text, intent.answer || {});
      this.task = null;
    }

    const pending = this.queue.find((c) => c.state === 'ready');
    if (intent.action === 'multi') return this.startMulti(intent);
    if (intent.action === 'chat') return this.say(intent.reply || 'Anlayamadım, biraz daha açar mısınız?');
    if (intent.action === 'correct' && pending) return this.correctCard(pending, intent.corrections || {}, intent.reply);
    if (intent.action === 'confirm' && pending) return this.share(pending);
    if (intent.action === 'cancel') {
      if (pending) return this.skip(pending);
      return this.say('Tamam, iptal ettim.');
    }
    if (intent.action === 'folder') return this.linkFolder();
    // Plaka yokken çok koşullu istek: çoklu paylaşım
    if ((intent.action === 'share' || intent.action === 'search') && !intent.plate && !intent.query && (intent.per_topic || intent.topics_scope || intent.count > 1 || intent.shot_year || intent.location)) {
      intent.action = intent.days || intent.per_day || intent.time ? 'plan' : 'batch';
    }
    if (intent.action === 'plan' || intent.action === 'batch') return this.startTask(intent);
    if (intent.action === 'schedule_list') return this.listSchedule();
    if (intent.action === 'schedule_cancel') return this.cancelSchedule();
    if (intent.action === 'help') {
      return this.say('Bağlı klasörünüzdeki fotoğrafları plaka ya da dosya adıyla bulurum, Framio AI ile künyesini çıkarırım ve uygun başlığa paylaşırım. Örnek: "06 ABC 123 fotoğrafını paylaş" ya da "34 TK 1234 için 3 fotoğraf bul".');
    }
    if (!intent.query) {
      return this.say('Hangi aracın fotoğrafını arayayım? Plakayı ya da dosya adını söyleyin.');
    }

    await folder.load();
    if (!folder.hasAny()) return this.say('Önce bir fotoğraf kaynağı bağlamanız gerekiyor: bilgisayardan bir klasör ya da Google Drive.');
    if ((folder.list || []).some((f) => f.enabled)) {
      this.step('Klasör erişim iznini kontrol ediyorum…');
      if (!(await folder.ensure())) return this.say('Klasöre erişim izni gerekiyor. Tarayıcının sorduğu izne "İzin ver" deyin ve komutu tekrarlayın.');
    }

    let files = [];
    try {
      const depth = Number(pref('framio_assistant_depth', 2));
      // Komutta yer belirtildiyse ("Antalya alt klasörlerindeki") önce o klasör bulunur, yalnızca içine bakılır
      const placeWords = intent.location
        ? intent.location.split(/[\s,/]+/).map((w) => w.replace(/['’](da|de|ta|te|nda|nde|ndaki|ndeki|daki|deki)$/i, '')).filter((w) => w.length > 2 && !/^(otogar|otogarı|terminal|garaj|il|ilçe)$/i.test(w))
        : [];
      let dirs = [];
      if (placeWords.length && (folder.list || []).some((f) => f.enabled)) dirs = await folder.findDirs(placeWords.slice().reverse(), (t) => this.step(t));
      if (dirs.length) {
        this.step(`"${dirs.map((d) => d.path).join(' · ')}" içinde arıyorum…`);
        const needle = normalize(intent.query);
        files = (await folder.filesIn(dirs, (t) => this.step(t))).filter((x) => normalize(x.name).includes(needle)).slice(0, intent.count === 0 ? 20 : intent.count || 1);
      }
      if (!files.length) files = await folder.find(intent.query, intent.count === 0 ? 20 : Math.max(intent.count || 1, 12), depth, (t) => this.step(t), { source: intent.source, hint: intent.location || '' });
      const wantPlate = plateKey(intent.plate || intent.query);
      if (!files.length && wantPlate) {
        // Dosya adları plaka değil (IMG_1234.jpg): fotoğraflardaki plaka okunur. Önce katalog, sonra hızlı tarama (6'şar).
        const all = await folder.find('', 400, Math.max(depth, 6), (t) => this.step(t), { source: intent.source });
        this.step(`Dosya adlarında yok; ${all.length} fotoğrafta plakayı görselden arıyorum…`);
        const hits = [];
        for (let i = 0; i < all.length && hits.length < (intent.count || 1); i += 6) {
          const group = all.slice(i, i + 6);
          const res = await Promise.all(group.map((c) => this.quickAnalyze(c).then((g) => ({ c, g })).catch(() => null)));
          res.filter(Boolean).forEach(({ c, g }) => plateKey(g.plate) === wantPlate && hits.push(c));
          this.step(`${Math.min(i + 6, all.length)}/${all.length} fotoğraf tarandı${hits.length ? ` · ${hits.length} eşleşme` : ''}…`);
        }
        files = hits;
      }
    } catch (e) {
      return this.say('Kaynakları okuyamadım' + (e && e.message ? ': ' + e.message : '.'));
    }

    if (!files.length) return this.say(`"${intent.query}" adını taşıyan bir fotoğraf bulamadım.`);
    await this.say(files.length === 1 ? `Bir fotoğraf buldum (${files[0].source}), inceliyorum.` : `${files.length} fotoğraf buldum, inceliyorum.`);

    for (const item of files) {
      this.step(item.file ? null : `"${item.name}" indiriliyor…`);
      const file = item.file || (item.file = await item.load());
      await this.prepare(file, intent, item.source, item.path);
      await whenQuiet();
    }
  }

  async prepare(file, intent, source = '', path = '') {
    const card = {
      id: Math.random().toString(36).slice(2),
      file,
      preview: URL.createObjectURL(file),
      state: 'analyzing',
      fields: { plate: intent.plate || '' },
      suggestions: [],
      topic: '',
      source,
    };
    this.queue.push(card);
    m.redraw();
    this.scroll();
    this.step(`Framio AI "${file.name}" fotoğrafını inceliyor…`);

    try {
      const fd = new FormData();
      fd.append('image', await shrink(file), 'ai.jpg');
      fd.append('exif_head', file.slice(0, 256 * 1024), 'head.jpg'); fd.append('file_name', file.name);
      if (intent.tag) fd.append('tag_slug', intent.tag);
      const ai = await app.request({ method: 'POST', url: api('/framio-media/analyze-ai'), body: fd });
      const d = (ai && ai.data) || {};
      card.aiFields = {
        company: d.company || '',
        plate: d.plate || card.fields.plate,
        brand: d.brand || '',
        model: d.model || '',
        location: d.location || d.location_guess || '',
        year: d.year || String(new Date(file.lastModified).getFullYear()),
      };
    } catch (e) {
      // Analiz olmadan da devam: alanlar elle doldurulabilir
    }

    // Alanlar görünür biçimde doldurulur (uzaktan kullanım görünümünde yazılıyormuş gibi)
    card.state = 'ready';
    m.redraw.sync();
    for (const [key, value] of Object.entries(card.aiFields || {})) {
      const input = document.querySelector(`.FramioAssistant-card[data-id="${card.id}"] input[data-key="${key}"]`);
      await ghost.type(input, value, (v) => (card.fields[key] = v));
      card.fields[key] = value;
    }
    // Eksik bilgi: tahmin etmek yerine kullanıcıya sorulur ("geç" denirse boş kalır)
    const labels = { company: 'Firma', plate: 'Plaka', brand: 'Marka', model: 'Model', location: 'Çekim yeri' };
    for (const key of Object.keys(labels)) {
      if (String(card.fields[key] || '').trim()) continue;
      const q = `${labels[key]} bilgisini bulamadım. Söyler misiniz? Bilmiyorsanız "geç" deyin.`;
      const value = await this.askField(q, key, card);
      if (value) card.fields[key] = value;
    }
    card.state = 'analyzing';

    this.step('Uygun başlığı arıyorum…');
    try {
      const r = await app.request({ method: 'POST', url: api('/framio-assistant/route'), body: { plate: card.fields.plate, brand: card.fields.brand, model: card.fields.model, company: card.fields.company, year: card.fields.year, hint: path } });
      card.suggestions = r.suggestions || [];
      card.topic = card.suggestions.length ? String(card.suggestions[0].discussion_id) : '';
      card.auto = !!r.auto && pref('framio_assistant_auto', true);
    } catch (e) {}

    // Başlık, tanınan modelle çelişiyorsa (ör. Tourismo bulundu ama Travego başlığı) sorulur.
    // Karşılaştırma modelin ana adıyla yapılır: "Tourismo 16 RHD" ↔ "Mercedes-Benz Tourismo" çelişki DEĞİLDİR.
    {
      const key = fold(card.fields.model).split(' ')[0] || '';
      const first = card.suggestions[0];
      if (key.length > 2 && first && !fold(first.title).includes(key)) {
        const why = first.reason === 'plate' ? 'bu plaka daha önce bu başlıkta paylaşılmış' : 'bulabildiğim en yakın başlık bu';
        const q = `Fotoğrafta ${[card.fields.brand, card.fields.model].filter(Boolean).join(' ')} görünüyor, ama ${why}: ${first.title}. Fotoğraftaki model mi doğru, başlık mı? Farklıysa doğru modeli yazın.`;
        const pick = await this.askConflict(q, card, first);
        card.auto = false;
        if (pick.model) card.fields.model = pick.model;
        if (pick.keepTitle) {
          // Başlık doğru: model başlıktan düzeltilir
          const bn = fold(card.fields.brand);
          const tm = (first.title || '').split(/\s+/).filter((w) => !bn.includes(fold(w))).join(' ').trim();
          if (tm) card.fields.model = tm;
          card.topic = String(first.discussion_id);
        } else {
          const key2 = fold(card.fields.model).split(' ')[0] || '';
          let own = card.suggestions.find((x) => fold(x.title).includes(key2));
          if (!own) {
            try {
              const r2 = await app.request({ method: 'POST', url: api('/framio-assistant/route'), body: { brand: card.fields.brand, model: card.fields.model, company: card.fields.company, year: card.fields.year, hint: path } });
              own = (r2.suggestions || []).find((x) => fold(x.title).includes(key2));
              if (own) card.suggestions = [own].concat(card.suggestions.filter((x) => x.discussion_id !== own.discussion_id));
            } catch (e) {}
          }
          card.topic = own ? String(own.discussion_id) : '';
          if (!own) card.suggestions = card.suggestions.filter((x) => fold(x.title).includes(key2));
        }
        card.suggestions.sort((x, y) => (String(y.discussion_id) === card.topic) - (String(x.discussion_id) === card.topic));
      }
    }

    card.state = 'ready';
    const f = card.fields;
    const summary = [f.company, f.plate, [f.brand, f.model].filter(Boolean).join(' '), f.location].filter(Boolean).join(', ');
    const topic = card.suggestions[0];

    if (card.auto && topic) {
      await this.say(`${summary}. Bunu her zamanki gibi ${topic.title} başlığına paylaşıyorum; durdurmak için "iptal" deyin.`);
      card.countdown = 5;
      card.timer = setInterval(() => {
        card.countdown -= 1;
        if (card.countdown <= 0) {
          clearInterval(card.timer);
          card.countdown = 0;
          this.share(card);
        }
        m.redraw();
      }, 1000);
    } else if (topic) {
      this.say(`${summary || 'Künyeyi çıkaramadım'}. ${topic.title} başlığına paylaşayım mı?`);
    } else {
      this.say(`${summary || 'Künyeyi çıkaramadım'}. Uygun başlık bulamadım; listeden seçebilirsiniz.`);
    }
    m.redraw();
  }

  /** Kullanıcının düzeltmesini karta uygular, başlığı yeniden arar */
  async correctCard(card, fix, reply) {
    for (const k of ['company', 'plate', 'brand', 'model', 'location']) {
      if (fix[k]) card.fields[k] = fix[k];
    }
    // Model marka adıyla yazıldıysa marka ayrılır ("Mercedes-Benz Tourismo 16" → "Tourismo 16")
    if (card.fields.brand && normalize(card.fields.model || '').startsWith(normalize(card.fields.brand))) {
      card.fields.model = card.fields.model.slice(card.fields.brand.length).trim();
    }
    card.state = 'analyzing';
    m.redraw();
    this.step('Başlığı yeniden arıyorum…');
    try {
      const r = await app.request({ method: 'POST', url: api('/framio-assistant/route'), body: { plate: fix.model ? '' : card.fields.plate, brand: card.fields.brand, model: card.fields.model, company: card.fields.company, year: card.fields.year, hint: [card.path || '', fix.topic_hint || ''].join(' ') } });
      card.suggestions = r.suggestions || [];
      if (fix.topic_hint) {
        const h = normalize(fix.topic_hint);
        card.suggestions.sort((a, b) => normalize(b.title).includes(h) - normalize(a.title).includes(h));
      }
      card.topic = card.suggestions.length ? String(card.suggestions[0].discussion_id) : '';
    } catch (e) {}
    this.step(null);
    card.state = 'ready';
    card.auto = false;
    const f = card.fields;
    const summary = [f.company, f.plate, [f.brand, f.model].filter(Boolean).join(' '), f.location].filter(Boolean).join(', ');
    const topic = card.suggestions[0];
    m.redraw();
    return this.say(`${reply ? reply + ' ' : ''}${summary}. ${topic ? topic.title + ' başlığına paylaşayım mı?' : 'Uygun başlık bulamadım; listeden seçebilir ya da başlık adını söyleyebilirsiniz.'}`);
  }

  /**
   * Eksik alan sorusunun cevabını yorumlar. Kısa ve açık cevaplar doğrudan alınır ("Antalya", "geç");
   * cümle hâlindeki cevaplar ("çekim yeri Antalya otogarı", "bilmiyorum ama sanırım Bursa") yapay zekayla anlaşılır.
   */
  async askField(question, key, card) {
    const raw = String(await this.prompt(question)).trim();
    const f = fold(raw);
    if (!f || /^(gec|atla|bilmiyorum|bilmem|yok|pas|bos birak|emin degilim)\b/.test(f)) return '';
    // Başındaki etiket ve sondaki noktalama atılır: "Çekim yeri Antalya." → "Antalya"
    const label = /^(cekim yeri|cekim yer|yer|konum|firma|firmasi|plaka|plakasi|marka|markasi|model|modeli)\s*[:=-]?\s*/;
    let clean = raw.replace(/[.!…]+$/, '').trim();
    if (label.test(f)) clean = clean.split(/\s+/).slice(f.match(label)[0].trim().split(/\s+/).length).join(' ').replace(/^[:=-]\s*/, '');
    if (clean.split(/\s+/).length <= 4 && !/\b(degil|ama|sanirim|galiba|bence|olabilir)\b/.test(f)) return clean;
    const it = await this.interpret(question, raw, card);
    return (it.corrections && it.corrections[key]) || (it.answer && it.answer.value) || '';
  }

  /** Model–başlık çelişkisi cevabı: { keepTitle } ya da { model } */
  async askConflict(question, card, first) {
    const raw = String(await this.prompt(question)).trim();
    const f = fold(raw);
    const modelKey = fold(card.fields.model).split(' ')[0];
    const titleKey = fold(first.title).split(' ').filter((w) => !fold(card.fields.brand).includes(w))[0] || '';
    if (/^(baslik|basliktaki|baslik dogru|evet baslik|baslikta kalsin)\b/.test(f) || (titleKey && f.includes(titleKey) && !f.includes(modelKey) && !/degil/.test(f))) return { keepTitle: true };
    if (/^(model|fotograf|fotograftaki|model dogru|fotograf dogru)\b/.test(f) || (f.includes(modelKey) && !/degil/.test(f) && f.split(' ').length <= 3)) return {};
    // Serbest cevap ("Travego değil, Tourismo 16"): yapay zekayla anlaşılır
    const it = await this.interpret(question, raw, card);
    const m = it.corrections && it.corrections.model;
    if (m) return { model: m.replace(new RegExp('^' + (card.fields.brand || '').replace(/[^\wÇĞİÖŞÜçğıöşü-]/g, '') + '\\s*', 'i'), '').trim() };
    if (it.answer && it.answer.yes) return { keepTitle: true };
    return {};
  }

  /** Bir soruya verilen serbest cevabı, soru ve kart bağlamıyla yapay zekaya yorumlatır */
  async interpret(question, text, card) {
    this.step('Cevabınızı anlıyorum…');
    try {
      const r = await app.request({ method: 'POST', url: api('/framio-assistant/parse'), body: { text, context: question, card: card ? card.fields : null, history: [] } });
      this.step(null);
      return r || {};
    } catch (e) {
      this.step(null);
      return {};
    }
  }

  /**
   * Klasör yolundan künye: model klasörü (aranan modelin adı geçen klasör) → bir üstü marka;
   * altındaki "15 SHD", "16 RHD", "S 516 HD" gibi varyant klasörü modele eklenir ("Eski Kasa" gibi kasa adları eklenmez);
   * "Şehirler" klasöründen sonraki klasör şehirdir.
   */
  fieldsFromPath(path, wantModel) {
    const parts = String(path || '').split('/');
    const out = {};
    const si = parts.findIndex((x) => fold(x) === 'sehirler');
    if (si >= 0 && parts[si + 1]) out.city = parts[si + 1];
    const key = fold(wantModel).split(' ').filter((w) => w.length > 2 && !/^(mercedes|benz|man|setra)$/.test(w))[0];
    const mi = key ? parts.findIndex((x) => fold(x).split(' ').includes(key)) : -1;
    if (mi > 0) {
      out.brand = parts[mi - 1];
      const variant = parts.slice(mi + 1).find((x) => /^(\d{1,3}\s?[a-z]{1,4}|[a-z]\s?\d{3}\s?[a-z]{1,4})$/i.test(x.trim()));
      out.model = parts[mi] + (variant ? ' ' + variant.trim() : '');
    }
    return out;
  }

  /** Soru sorar, kullanıcının bir sonraki (yazılı ya da sesli) cevabını döndürür */
  async prompt(question) {
    await this.say(question);
    return new Promise((resolve) => (this.awaiting = resolve));
  }

  // ── Çok adımlı görevler: önce sorar, sonra seçer, hazırlar, paylaşır ya da planlar ──────────

  async startTask(intent) {
    let count = intent.count === 0 ? 20 : intent.count || (intent.days && intent.per_day ? intent.days * intent.per_day : 10);
    const f = intent.filters || {};
    this.task = { intent, count, plan: intent.action === 'plan', topic: null, filter: [f.company, f.plate, f.brand, f.model].filter(Boolean).join(' ') || null, waiting: null, targets: null };

    // "Her marka başlığına 1'er": hedef başlıklar sunucudan (bölüm + dönem)
    if (intent.per_topic || intent.topics_scope === 'brand_topics') {
      this.step('Hedef başlıkları belirliyorum…');
      try {
        const res = await app.request({ method: 'POST', url: api('/framio-assistant/targets'), body: { section: intent.section || '', era: intent.era || '' } });
        this.task.targets = res.topics || [];
        this.task.sections = res.sections || [];
        this.task.perTopic = intent.per_topic || 1;
        count = this.task.targets.length * this.task.perTopic;
        this.task.count = count;
      } catch (e) {}
      if (!this.task.targets || !this.task.targets.length) {
        this.task = null;
        return this.say('Bu tarife uyan hedef başlık bulamadım; bölümü biraz daha açık söyler misiniz?');
      }
    }
    const what = this.task.plan
      ? `${count} fotoğrafı ${intent.days ? intent.days + ' gün boyunca ' : ''}${intent.per_day ? 'günde ' + intent.per_day + ' adet, ' : ''}${intent.time ? 'saat ' + intent.time + "'de " : ''}paylaşacak şekilde planlayacağım`
      : `${count} yeni fotoğraf paylaşacağım`;
    const from = intent.source === 'drive' ? "Google Drive'dan" : intent.source === 'local' ? 'bilgisayardaki klasörlerden' : 'bağlı kaynaklardan';
    const year = intent.shot_year ? `, yalnızca ${intent.shot_year} çekimleri` : '';
    const place = intent.location ? `, çekim yeri ${intent.location}` : '';
    const scope = this.task.targets ? ` ${this.task.targets.length} başlığın her birine ${this.task.perTopic} adet olmak üzere` : '';
    // İfade birden çok bölüme uyuyorsa (otomatik modda bile) hangisi olduğu sorulur
    if (this.task.sections && this.task.sections.length > 1) {
      await this.say(`"${intent.section || 'Bu bölüm'}" birden fazla bölüme uyuyor: ${this.task.sections.map((x) => `${x.name} (${x.count} başlık)`).join(', ')}. Hangisinde paylaşayım? Birini söyleyin ya da "hepsi" deyin.`);
      this.task.waiting = 'section';
      this.task.question = 'Hangi bölümde paylaşayım?';
      return;
    }
    if (intent.auto) {
      await this.say(`Anladım: ${from}${year}${place}${scope} ${what}. Otomatik başlıyorum; durdurmak için "iptal" deyin.`);
      return this.runTask();
    }
    await this.say(`Anladım: ${from}${year}${place}${scope} ${what}. Birkaç sorum var.`);
    this.ask(this.task.targets ? 'filter' : 'topic');
  }

  ask(what) {
    this.task.waiting = what;
    this.task.question =
      what === 'topic' ? 'Hangi başlıkta paylaşayım?' : what === 'filter' ? 'Özellikle istediğiniz bir firma, plaka, marka ya da model var mı?' : 'Başlayayım mı?';
    if (what === 'topic') this.say('Hangi başlıkta paylaşayım? Her fotoğraf için uygun başlığı benim seçmemi isterseniz "otomatik" deyin ya da bir başlık adı söyleyin.');
    if (what === 'filter') this.say('Özellikle istediğiniz bir firma, plaka, marka ya da model var mı? Yoksa "fark etmez" deyin.');
    if (what === 'confirm') {
      const t = this.task;
      const parts = [
        `${t.count} fotoğraf`,
        t.targets ? `${t.targets.length} başlığa ${t.perTopic}'er adet` : t.topic ? `başlık: ${t.topic.title}` : 'başlık: her fotoğrafa uygun olan (Güncel/Arşiv çekim yılına göre)',
        t.intent.location ? `çekim yeri: ${t.intent.location}` : null,
        t.intent.shot_year ? `çekim yılı: ${t.intent.shot_year}` : null,
        t.filter ? `filtre: ${t.filter}` : null,
        t.intent.diverse ? 'her biri farklı araç' : null,
        t.plan && t.intent.time ? `her gün ${t.intent.time}` : null,
      ].filter(Boolean);
      this.say(`Özetle: ${parts.join(', ')}. Başlayayım mı?`);
    }
  }

  async answer(text, a = {}) {
    const t = this.task;
    const step = t.waiting;
    t.waiting = null;

    if (/^(iptal|vazgeç|dur)/i.test(text.trim())) {
      this.task = null;
      return this.say('Görevi iptal ettim.');
    }

    if (step === 'section') {
      const low = String(a.value || text).toLocaleLowerCase('tr-TR');
      if (!/(hepsi|hepsinde|ikisi|ikisinde|tümü|tümünde|her ikisi)/.test(low)) {
        const words = low.split(/[\s,.]+/).filter((w) => w.length > 3);
        const names = t.sections.map((x) => x.name.toLocaleLowerCase('tr-TR'));
        // Her bölümde ortak geçen kelimeler sayılmaz
        const distinct = words.filter((w) => names.filter((n) => n.includes(w.slice(0, 6))).length < names.length);
        const scored = t.sections.map((x, i) => ({ x, score: distinct.filter((w) => names[i].includes(w.slice(0, 6))).length }));
        const best = Math.max(0, ...scored.map((z) => z.score));
        const pick = best > 0 ? scored.filter((z) => z.score === best).map((z) => z.x) : [];
        if (pick.length) {
          const slugs = pick.map((x) => x.slug);
          t.targets = t.targets.filter((g) => slugs.includes(g.section_slug));
        }
      }
      t.sections = null;
      t.count = t.targets.length * t.perTopic;
      await this.say(`Tamam: ${t.targets.length} başlığın her birine ${t.perTopic} adet, toplam ${t.count} fotoğraf.`);
      if (t.intent.auto) return this.runTask();
      return this.ask('filter');
    }
    if (step === 'topic') {
      if (!(a.any || isAny(text))) {
        // Başlık adı: forumda arayıp en uygun başlığı bul
        this.step('Başlığı arıyorum…');
        try {
          const res = await app.request({ method: 'GET', url: api('/discussions?' + new URLSearchParams({ 'filter[q]': a.value || text, 'page[limit]': '5' })) });
          const d = (res.data || [])[0];
          if (d) t.topic = { discussion_id: d.id, title: d.attributes.title };
        } catch (e) {}
        if (!t.topic) {
          this.say(`"${text}" adında bir başlık bulamadım; her fotoğraf için uygun başlığı ben seçeceğim.`);
        } else {
          this.say(`Tamam, "${t.topic.title}" başlığına paylaşacağım.`);
        }
      }
      return this.ask('filter');
    }
    if (step === 'filter') {
      t.filter = a.any || isAny(text) ? null : (a.value || text).trim();
      return this.ask('confirm');
    }
    if (step === 'confirm') {
      if (a.no || !(a.yes || isYes(text))) {
        this.task = null;
        return this.say('Tamam, başlatmadım.');
      }
      return this.runTask();
    }
  }

  /** Görev biter bitmez sıradaki parça (çok parçalı istek) başlar */
  async runTask() {
    await this.runTaskInner();
    if (!this.task && this.pendingItems && this.pendingItems.length) return this.nextItem();
  }

  /** "Antalya'dan bir Travego, Esenler'den bir Tourismo 15" → her parça ayrı, kısa bir görev olarak sırayla yapılır */
  async startMulti(intent) {
    this.pendingItems = (intent.items || []).slice();
    this.multiSource = intent.source || null;
    const list = this.pendingItems
      .map((it) => [it.count > 1 ? it.count + ' adet' : 'bir', [it.brand, it.model].filter(Boolean).join(' ') || 'fotoğraf', it.location ? `(${it.location}${it.shot_year ? ', ' + it.shot_year : ''})` : it.shot_year ? `(${it.shot_year})` : '', it.note ? '— ' + it.note : ''].filter(Boolean).join(' '))
      .join('; ');
    await this.say(intent.reply || `Anladım, ${this.pendingItems.length} ayrı iş: ${list}. Sırayla bulup her birini paylaşmadan önce size göstereceğim.`);
    return this.nextItem();
  }

  nextItem() {
    const it = this.pendingItems.shift();
    if (!it) return;
    const intent = {
      action: 'batch',
      count: it.count || 1,
      filters: { brand: it.brand, model: it.model, company: it.company },
      location: it.location,
      shot_year: it.shot_year,
      note: it.note,
      source: this.multiSource,
      auto: true,
      diverse: true,
      quiet: true,
    };
    this.step(`Sıradaki: ${[it.brand, it.model].filter(Boolean).join(' ') || 'fotoğraf'}${it.location ? ' · ' + it.location : ''}${it.shot_year ? ' · ' + it.shot_year : ''}`);
    return this.startTask(intent);
  }

  async runTaskInner() {
    const t = this.task;
    const intent = t.intent;
    await folder.load();
    if (!folder.hasAny()) {
      this.task = null;
      return this.say('Önce bir fotoğraf kaynağı bağlamanız gerekiyor.');
    }
    if (intent.source !== 'drive' && (folder.list || []).some((f) => f.enabled)) {
      this.step('Klasör erişim iznini kontrol ediyorum…');
      if (!(await folder.ensure())) {
        this.task = null;
        return this.say('Klasöre erişim izni gerekiyor; izin verip komutu tekrarlayın.');
      }
    }

    // 1) Aday fotoğraflar (kaynak kısıtı, filtre dosya adında geçiyorsa önce onlar)
    const depth = Number(pref('framio_assistant_depth', 2));
    const pool = Math.min(400, t.count * 6);
    let candidates = [];
    t.placeFromPath = false;
    try {
      // Çekim yeri verildiyse: önce o yerin klasörü (ör. …/İstanbul/…/Esenler) bulunur, yalnızca içine bakılır
      const placeWords = intent.location
        ? intent.location
            .split(/[\s,/]+/)
            .map((w) => w.replace(/['’](da|de|ta|te|nda|nde|ndaki|ndeki|daki|deki)$/i, ''))
            .filter((w) => w.length > 2 && !/^(otogar|otogarı|terminal|terminali|garaj|garajı|il|ilçe)$/i.test(w))
        : [];
      // "Esenler Otogarı, İstanbul" → en özel kelime önce gelir; sıralamada son kelime en özel sayılır
      const ordered = placeWords.slice().reverse();
      if (ordered.length && intent.source !== 'drive' && (folder.list || []).some((f) => f.enabled)) {
        const dirs = await folder.findDirs(ordered, (x) => this.step(x));
        if (dirs.length) {
          this.step(`Çekim yeri klasörü bulundu: ${dirs.map((d) => d.path).join(' · ')}`);
          candidates = await folder.filesIn(dirs, (x) => this.step(x));
          t.placeFromPath = true;
        } else if (!drive.roots().length) {
          this.task = null;
          return this.say(`Kaynaklarınızda adında "${ordered.join('" ya da "')}" geçen bir klasör bulamadım. Fotoğrafların yerini tahmin ederek yanlış paylaşım yapmak istemedim; klasörü kaynaklara ekleyip tekrar deneyebilirsiniz.`);
        }
      }
      // Drive: yer adıyla klasör araması (tüm ağacı gezmeden), ardından o klasörlerin fotoğrafları
      if (!t.placeFromPath && ordered.length && intent.source !== 'local' && drive.roots().length) {
        this.step('Google Drive klasör yapısında hedefi arıyorum…');
        const fl = intent.filters || {};
        const ddirs = await drive.locate(
          { year: intent.shot_year, place: [intent.location, ...ordered].filter(Boolean).map((p) => String(p).replace(/['’]\S*$/, '').replace(/(otogarı|otogari)/gi, 'Otogar')), brand: fl.brand, model: fl.model, hint: [intent.section, intent.note].filter(Boolean).join(' ') },
          (x) => this.step(x),
          (names) => this.prompt(`"${intent.location}" klasörü birden fazla bölümde var: ${names.join(' ya da ')}. Hangisinden seçeyim?`)
        );
        if (ddirs.length) {
          this.step(`Klasör bulundu: ${ddirs.slice(0, 3).map((d) => d.path).join(' · ')}${ddirs.length > 3 ? ` (+${ddirs.length - 3})` : ''}`);
          candidates = (await drive.filesUnder(ddirs)).filter((c) => !intent.shot_year || !c.year || c.year === intent.shot_year);
          // Komuttaki her ayrıntı klasör/dosya yolunda geçmeli: firma ("Metro Turizm"), varyant ("16 SHD"), kasa ("Yeni Kasa"), plaka.
          // Elle düzenlenmiş arşivde bu bilgiler klasör adıdır; yapay zekaya bırakılmaz.
          {
            const fl2 = intent.filters || {};
            const variant = (String(fl2.model || '').match(/\b(\d{1,3}\s?[A-Za-z]{1,4}|[A-Za-z]\s?\d{3}\s?[A-Za-z]{1,4})\b/) || [])[1];
            const terms = [fl2.company, fl2.plate, variant, intent.note].filter(Boolean).map(fold).filter((x) => x.length > 1);
            if (terms.length) {
              const strict = candidates.filter((c) => {
                const where = fold((c.path || '') + ' ' + c.name);
                return terms.every((w) => where.includes(w) || (w.split(' ').length > 1 && w.split(' ').every((x) => where.includes(x))));
              });
              this.step(`Klasörlerde "${terms.join('", "')}" geçenler: ${strict.length} fotoğraf.`);
              // Varyant yakın yazılmış olabilir ("16 SHD" ↔ klasörde "16 RHD"): sayısı aynı varyant klasörü denenir
              if (!strict.length && variant) {
                const num = fold(variant).match(/\d+/)[0];
                const rest = terms.filter((w) => w !== fold(variant));
                const near = candidates.filter((c) => {
                  const segs = String(c.path || '').split('/').map(fold);
                  const where = fold((c.path || '') + ' ' + c.name);
                  return segs.some((x) => new RegExp('^' + num + ' ?[a-z]{1,4}$').test(x)) && rest.every((w) => where.includes(w));
                });
                if (near.length) {
                  const seg = String(near[0].path).split('/').find((x) => new RegExp('^' + num + ' ?[a-z]{1,4}$', 'i').test(fold(x)));
                  this.say(`"${variant}" klasörü yok ama "${seg}" var; ${near.length} fotoğraf onunla eşleşiyor, oradan seçiyorum.`, false);
                  strict.push(...near);
                }
              }
              if (!strict.length) {
                this.task = null;
                return this.say(`Bulduğum klasörlerde "${[fl2.company, variant, intent.note, fl2.plate].filter(Boolean).join(', ')}" ile eşleşen fotoğraf yok. İsterseniz bu koşullardan birini gevşetebiliriz.`);
              }
              candidates = strict;
              t.pathStrict = true;
            }
          }
          // Klasörden rastgele seçim (aynı seri karelerin hep ilk sırada gelmemesi için)
          for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
          }
          t.placeFromPath = true;
        }
      }
      if (!t.placeFromPath) {
        candidates = await folder.find('', Math.max(pool, (t.targets ? t.targets.length : 0) * 20), depth, (x) => this.step(x), { source: intent.source, year: intent.shot_year, hint: intent.location || t.filter || '' });
      }
      // Çekim yeri klasör adında geçiyorsa ("…/Esenler/…") önce onlar
      if (intent.location && !t.placeFromPath) {
        // Drive: klasör yolunda yer geçenler (drive.find yolu zaten süzdü); yerel klasör yoksa yapay zekanın bulduğu yer
        const words = placeWords.map((w) => w.toLocaleLowerCase('tr-TR'));
        const inPath = candidates.filter((c) => words.some((w) => String(c.path || '').toLocaleLowerCase('tr-TR').includes(w.slice(0, 6))));
        if (inPath.length) {
          candidates = inPath;
          t.placeFromPath = true;
        }
        t.placeWords = words;
      }
    } catch (e) {
      this.task = null;
      return this.say('Kaynakları okuyamadım' + (e && e.message ? ': ' + e.message : '.'));
    }

    // 2) Daha önce yüklenmiş olanlar çıkarılır ("yeni" fotoğraflar)
    this.step('Daha önce paylaştıklarınızı ayıklıyorum…');
    try {
      const seen = new Set((await app.request({ method: 'POST', url: api('/framio-assistant/seen'), body: { names: candidates.map((c) => c.name) } })).seen || []);
      candidates = candidates.filter((c) => !seen.has(c.name));
      t.pool = candidates;
    } catch (e) {}

    // 3) Çekim yılı ve çeşitlilik (her araç bir kez)
    const picked = [];
    const plates = new Set();
    const needle = t.filter ? t.filter.toLocaleLowerCase('tr-TR') : null;
    for (const c of candidates) {
      // Aday havuzu geniş tutulur; inceleme istenen sayıya ulaşınca zaten durur
      if (picked.length >= Math.min(60, t.count * (needle || t.targets || intent.location ? 12 : 3))) break;
      if (intent.shot_year) {
        // Drive: indirmeden bilinen yıl (EXIF ya da klasör adı); yerel dosyada EXIF okunur
        const y = c.year || (c.file ? await shotYear(c.file) : null);
        if (y && y !== intent.shot_year) continue;
      }
      const key = plateKey(c.name);
      if (intent.diverse && key) {
        if (plates.has(key)) continue;
        plates.add(key);
      }
      picked.push(c);
    }
    if (!picked.length) {
      this.task = null;
      return this.say('Koşullara uyan yeni bir fotoğraf bulamadım.');
    }
    await this.say(`${picked.length} aday fotoğraf seçtim; Framio AI ile inceleyip ${t.plan ? 'planı hazırlıyorum' : 'paylaşıyorum'}. Bu biraz sürebilir, sekmeyi açık bırakın.`);

    // 4) Hazırla: analiz → (filtre) → başlık → yükle → içerik
    const times = t.plan ? slots({ count: t.count, days: intent.days, perDay: intent.per_day, time: intent.time }) : [];
    const items = [];
    const usedPlates = new Set();
    const analyze = async (c) => {
      try {
        await this.img(c);
      } catch (e) {
        return { c, error: 'indirilemedi' };
      }
      let f = {};
      const fp = c.path ? this.fieldsFromPath(c.path, (intent.filters || {}).model || t.filter || '') : {};
      const pt = plateText(c.name);
      if (fp.model && pt && (t.pathStrict || this.companyFromPath(c))) {
        // Düzenli arşiv: marka/model/şehir klasörlerden, plaka dosya adından, firma plaka klasörünün üstünden — yapay zeka gerekmez
        f = { company: this.companyFromPath(c) || ((intent.filters || {}).company || ''), plate: pt, brand: fp.brand || '', model: fp.model, location: fp.city || '', subject: 'vehicle', year: String(c.year || (c.file ? await shotYear(c.file) : '') || ''), fromPath: true };
      } else {
        try {
          // Hızlı tarama (katalog önbellekli); seçilen fotoğraf onaydan önce ayrıntılı incelenir
          f = await this.quickAnalyze(c);
          f.year = f.year || String(c.year || (c.file ? await shotYear(c.file) : '') || '');
        } catch (e) {
          f = { year: String(c.year || (c.file ? await shotYear(c.file) : '') || '') };
        }
      }
      c.f = f;
      let sugg = [];
      if (!t.topic) {
        try {
          const r = await app.request({ method: 'POST', url: api('/framio-assistant/route'), body: { plate: f.plate, brand: f.brand, model: f.model, company: f.company, year: f.year, hint: c.path || '' } });
          sugg = r.suggestions || [];
        } catch (e) {}
      }
      return { c, f, sugg };
    };

    const filledCount = () => (t.targets ? t.targets.filter((g) => (t.filled[g.discussion_id] || 0) >= t.perTopic).length : 0);
    t.filled = t.filled || {};
    let checked = 0;

    for (let i = 0; i < picked.length && items.length < t.count; i += 6) {
      if (this.task !== t) return; // "iptal" denildi
      const group = picked.slice(i, i + 6);
      this.step(
        t.targets
          ? `Fotoğraflar inceleniyor (${checked + 1}–${checked + group.length}) · ${filledCount()}/${t.targets.length} başlık doldu…`
          : `${items.length + 1}/${t.count} · ${group.length} fotoğraf aynı anda inceleniyor…`
      );
      const results = await Promise.all(group.map(analyze));
      t.accepted = t.accepted || [];
      checked += group.length;

      for (const { c, f, sugg, error } of results) {
        if (items.length >= t.count || this.task !== t) break;
        if (error) {
          this.step(`"${c.name}" ${error}, atlıyorum.`);
          continue;
        }
        // Yalnızca aracın ana konu olduğu kareler (insan, iç mekan, detay kareleri atlanır)
        if ((f.subject && f.subject !== 'vehicle') || !f.brand) {
          this.step(`"${c.name}" araç fotoğrafı değil (${f.subject === 'person' ? 'insan karesi' : f.subject === 'interior' ? 'iç mekan' : f.subject === 'detail' ? 'detay' : 'araç tanınamadı'}), atlıyorum.`);
          continue;
        }
        // Aynı aracın art arda çekilmiş kareleri: plaka ya da (plakasızsa) firma+model ve 2 dakika içinde çekim
        const sig = f.plate ? 'p:' + f.plate.replace(/\s+/g, '') : 'm:' + [f.company, f.brand, f.model].join('|').toLocaleLowerCase('tr-TR');
        if (t.targets || intent.diverse) {
          const twin = (t.accepted || []).find((a) => a.sig === sig && (sig.startsWith('p:') || Math.abs(a.modified - (c.modified || 0)) < 120000));
          if (twin) {
            this.step(`"${c.name}" daha önce seçilen "${twin.name}" ile aynı araç, atlıyorum.`);
            continue;
          }
        }
        // Klasör yapısı esastır (elle düzenlenmiş arşiv): …/Şehirler/Antalya/…/Mercedes-Benz/Travego/Eski Kasa/15 SHD/<firma>/<plaka>
        // Marka, model (+ varyant) ve şehir klasör adlarından alınır; yapay zekanın tahmini bunların önüne geçemez.
        if (c.path) {
          const fromPath = this.fieldsFromPath(c.path, (intent.filters || {}).model || t.filter || '');
          let changed = false;
          if (fromPath.model && fold(fromPath.model) !== fold(f.model)) {
            f.brand = fromPath.brand || f.brand;
            f.model = fromPath.model;
            changed = true;
          }
          const fl3 = intent.filters || {};
          if (t.pathStrict && fl3.company && !fold(f.company).includes(fold(fl3.company))) {
            f.company = fl3.company;
            changed = true;
          }
          if (fromPath.city && !fold(f.location).includes(fold(fromPath.city))) {
            f.location = fromPath.city;
            changed = true;
          }
          if (changed) {
            this.step(`"${c.name}": künye klasörlerden alındı (${[f.brand, f.model].filter(Boolean).join(' ')}${fromPath.city ? ' · ' + fromPath.city : ''}).`);
            try {
              const r2 = await app.request({ method: 'POST', url: api('/framio-assistant/route'), body: { plate: f.plate, brand: f.brand, model: f.model, company: f.company, year: f.year, hint: c.path } });
              if (sugg) sugg.splice(0, sugg.length, ...(r2.suggestions || []));
            } catch (e) {}
          }
        }
        // Klasör yolu komuttaki tüm ayrıntılarla zaten eşleştiyse tekrar kontrol edilmez; değilse her kelime künyede geçmeli
        const have = fold([f.company, f.plate, f.brand, f.model].join(' '));
        if (needle && !t.pathStrict && !fold(needle).split(' ').filter((w) => w.length > 1).every((w) => have.includes(w))) {
          this.step(`"${c.name}" ${[f.brand, f.model].filter(Boolean).join(' ') || 'araç'} çıktı, aranan "${t.filter}" değil, atlıyorum.`);
          continue;
        }
        // Çekim yeri klasörden anlaşılmadıysa Framio AI'nın bulduğu yere bakılır
        if (t.placeWords && t.placeWords.length && !t.placeFromPath) {
          const loc = String(f.location || '').toLocaleLowerCase('tr-TR');
          if (!loc || !t.placeWords.some((w) => loc.includes(w.slice(0, 6)))) continue;
        }
        if (intent.diverse && f.plate) {
          const k = f.plate.replace(/\s+/g, '');
          if (usedPlates.has(k)) {
            this.step(`"${c.name}" aynı plakanın başka karesi, atlıyorum.`);
            continue;
          }
          usedPlates.add(k);
        }

        // Seçilen fotoğraf (klasörden kesin künyesi yoksa): ayrıntılı inceleme — güçlü model, %95+ forum benzerliği, konum
        if (!f.fromPath) {
          try {
            this.step(`"${c.name}" ayrıntılı inceleniyor…`);
            const fd = new FormData();
            fd.append('image', await shrink(await this.img(c)), 'ai.jpg');
            if (c.file) fd.append('exif_head', c.file.slice(0, 256 * 1024), 'head.jpg');
            fd.append('file_name', c.name);
            const ai = await app.request({ method: 'POST', url: api('/framio-media/analyze-ai'), body: fd });
            const d = (ai && ai.data) || {};
            ['company', 'plate', 'brand', 'model', 'location'].forEach((k) => d[k] && (f[k] = d[k]));
            if (d.year) f.year = d.year;
            putMeta(c, { company: f.company, plate: f.plate, brand: f.brand, model: f.model, subject: f.subject || 'vehicle', year: f.year, location: f.location });
            const r3 = await app.request({ method: 'POST', url: api('/framio-assistant/route'), body: { plate: f.plate, brand: f.brand, model: f.model, company: f.company, year: f.year, hint: c.path || '' } });
            if (sugg) sugg.splice(0, sugg.length, ...(r3.suggestions || []));
          } catch (e) {}
        }

        let topic = t.topic;
        if (!topic) {
          if (t.targets) {
            // Model birebir eşleşmeli: yalnızca bu modelin başlığı (marka düzeyi öneriler sayılmaz);
            // o başlık doluysa fotoğraf başka bir modele KONMAZ
            const own = sugg.find((x) => x.reason !== 'brand' && t.targets.some((g) => g.discussion_id === x.discussion_id));
            if (!own) {
              this.step(`"${c.name}" (${[f.brand, f.model].filter(Boolean).join(' ')}) hedef başlıklardan birinin modeli değil, atlıyorum.`);
              continue;
            }
            if ((t.filled[own.discussion_id] || 0) >= t.perTopic) {
              this.step(`${own.title} zaten doldu, "${c.name}" atlıyorum.`);
              continue;
            }
            topic = own;
          } else {
            topic = sugg[0];
          }
        }
        if (!topic) {
          this.step(`"${c.name}" (${[f.brand, f.model].filter(Boolean).join(' ')}) için uygun başlık bulamadım, atlıyorum.`);
          continue;
        }

        // Paylaşmadan önce onay
        const summary = [[f.company, f.plate].filter(Boolean).join(' | '), [f.brand, f.model].filter(Boolean).join(' '), f.location].filter(Boolean).join(' · ');
        const extras = await this.posesFor(c, t.pool || [], intent.per_post || 3);
        this.confirmedKunye = null;
        const decision = await this.confirmItem(c, f, topic, summary, extras);
        if (decision === 'stop' || this.task !== t) {
          this.task = null;
          return this.say(`Görevi durdurdum. ${items.length} fotoğraf ${t.plan ? 'planlandı' : 'paylaşıldı'}.`);
        }
        if (decision !== 'yes') {
          this.step(`"${c.name}" atlandı.`);
          continue;
        }
        t.accepted.push({ sig, name: c.name, modified: c.modified || 0 });

        this.step(`"${c.name}" → ${topic.title}: imzalanıp yükleniyor…`);
        let code = '';
        const chosen = this.confirmed && this.confirmed.length ? this.confirmed : [{ name: c.name, file: c.file, src: c }];
        // Tam boyutlu dosyalar yalnızca şimdi ve paralel indirilir (incelemede küçük önizleme kullanıldı)
        if (chosen.some((x) => !x.file)) this.step('Tam boyutlu fotoğraflar indiriliyor…');
        await Promise.all(
          chosen.map(async (x) => {
            if (!x.file && x.src) {
              try {
                x.file = x.src.file || (x.src.file = await x.src.load());
              } catch (e) {}
            }
          })
        );
        for (const x of chosen) {
          try {
            code += (code ? '\n' : '') + (await upload(x.file, pref('framio_assistant_watermark', 'none')));
          } catch (e) {
            this.step(`"${x.name}" yüklenemedi.`);
          }
        }
        if (!code) {
          this.step(`"${c.name}" yüklenemedi, atlıyorum.`);
          continue;
        }
        // Aynı klasörden eklenen pozlar bu görevde yeniden aday olmaz
        chosen.forEach((x) => (t.usedNames = t.usedNames || new Set()).add(x.name));
        const alt = [[f.company, f.plate].filter(Boolean).join(' | '), [f.brand, f.model].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
        if (alt) code = code.replace(/alt="([^"]*)"/g, `alt="${alt.replace(/"/g, '&quot;')}"`);
        const kText = this.confirmedKunye || kunyeText(f);
        const content = code + (kText ? '\n' + kText : '') + '\n';
        items.push({ discussion_id: topic.discussion_id, title: topic.title, content, label: alt || c.name, f });
        t.filled[topic.discussion_id] = (t.filled[topic.discussion_id] || 0) + 1;

        if (!t.plan) {
          try {
            await app.request({ method: 'POST', url: api('/posts'), body: { data: { type: 'posts', attributes: { content }, relationships: { discussion: { data: { type: 'discussions', id: String(topic.discussion_id) } } } } } });
            app.request({ method: 'POST', url: api('/framio-assistant/learn'), body: { plate: f.plate, brand: f.brand, model: f.model, company: f.company, discussion_id: topic.discussion_id } }).catch(() => {});
            this.say(`✓ ${topic.title}: ${alt || c.name}` + (t.targets ? ` (${filledCount()}/${t.targets.length} başlık)` : ''), false);
          } catch (e) {
            this.step(`"${c.name}" paylaşılamadı.`);
          }
        }
      }
    }

    if (!items.length) {
      this.task = null;
      return this.say('Koşullara uyan fotoğraf hazırlayamadım. Yukarıdaki adımlarda her fotoğrafın neden atlandığını görebilirsiniz.');
    }

    if (t.plan) {
      this.step('Planı kaydediyorum…');
      const body = { items: items.map((it, i) => ({ discussion_id: it.discussion_id, content: it.content, label: it.label, publish_at: localStamp(times[i] || times[times.length - 1]) })) };
      try {
        const res = await app.request({ method: 'POST', url: api('/framio-assistant/schedule'), body });
        const first = times[0];
        const last = times[Math.min(items.length, times.length) - 1];
        this.say(`Plan hazır: ${res.count} fotoğraf, ilk paylaşım ${humanDate(first)}, son paylaşım ${humanDate(last)}. Her paylaşımdan sonra size buradan haber vereceğim. "Planlarım" diyerek durumu görebilir, "planı iptal et" diyerek durdurabilirsiniz.`);
      } catch (e) {
        this.say('Planı kaydedemedim.');
      }
    } else {
      const byTopic = {};
      items.forEach((it) => (byTopic[it.title] = (byTopic[it.title] || 0) + 1));
      const empty = t.targets ? t.targets.filter((g) => !(t.filled || {})[g.discussion_id]).map((g) => g.title) : [];
      this.say(`Tamamlandı: ${items.length} fotoğraf paylaştım — ${Object.entries(byTopic).map(([k, v]) => `${k} (${v})`).join(', ')}.` + (empty.length ? ` Uygun fotoğraf bulamadığım başlıklar: ${empty.join(', ')}.` : ''));
    }
    this.task = null;
  }

  async listSchedule() {
    try {
      const res = await app.request({ method: 'GET', url: api('/framio-assistant/schedule') });
      if (!res.pending) return this.say('Bekleyen planlı paylaşımınız yok.');
      const slotsTxt = Object.entries(res.slots)
        .slice(0, 6)
        .map(([d, n]) => `${d} (${n})`)
        .join(', ');
      this.say(`Sırada ${res.pending} paylaşım var: ${slotsTxt}${Object.keys(res.slots).length > 6 ? '…' : ''}.`);
    } catch (e) {
      this.say('Planları alamadım.');
    }
  }

  async cancelSchedule() {
    try {
      const res = await app.request({ method: 'POST', url: api('/framio-assistant/schedule/cancel'), body: {} });
      this.say(res.cancelled ? `${res.cancelled} planlı paylaşımı iptal ettim.` : 'İptal edilecek planlı paylaşım yoktu.');
    } catch (e) {
      this.say('İptal edemedim.');
    }
  }

  skip(card) {
    if (card.timer) clearInterval(card.timer);
    card.countdown = 0;
    if (card.state === 'ready') {
      this.queue = this.queue.filter((c) => c !== card);
      this.say('Tamam, bu fotoğrafı paylaşmıyorum.');
    }
    m.redraw();
  }

  async share(card) {
    if (card.state !== 'ready' || !card.topic) return;
    if (card.timer) clearInterval(card.timer);
    card.countdown = 0;
    await ghost.click(`.FramioAssistant-card[data-id="${card.id}"] .Button--primary`, 'Paylaş');
    card.state = 'sharing';
    m.redraw();

    try {
      const wm = pref('framio_assistant_watermark', 'none');
      this.step(wm === 'none' ? 'Fotoğrafı yüklüyorum…' : 'İmzayı ekleyip fotoğrafı yüklüyorum…');
      let code = await upload(card.file, wm);
      const f = card.fields;
      const alt = [[f.company, f.plate].filter(Boolean).join(' | '), [f.brand, f.model].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
      if (alt) code = code.replace(/alt="([^"]*)"/g, `alt="${alt.replace(/"/g, '&quot;')}"`);
      const content = code + (kunyeText(f) ? '\n' + kunyeText(f) : '') + '\n';

      this.step('Mesajı yazıp başlığa gönderiyorum…');
      const created = await app.request({
        method: 'POST',
        url: api('/posts'),
        body: { data: { type: 'posts', attributes: { content }, relationships: { discussion: { data: { type: 'discussions', id: String(card.topic) } } } } },
      });

      const s = card.suggestions.find((x) => String(x.discussion_id) === String(card.topic)) || {};
      card.state = 'done';
      card.topicTitle = s.title || 'başlık';
      const number = created && created.data && created.data.attributes && created.data.attributes.number;
      card.doneUrl = (s.url || '/d/' + card.topic) + (number ? '/' + number : '');
      app.request({ method: 'POST', url: api('/framio-assistant/learn'), body: { plate: f.plate, brand: f.brand, model: f.model, company: f.company, discussion_id: card.topic } }).catch(() => {});
      this.say(`Paylaştım: ${card.topicTitle}.`);
      // Uzaktan kullanım görünümü: mesaja gidip gösterir
      if (ghost.enabled && created && created.data) {
        m.route.set(card.doneUrl);
        setTimeout(async () => {
          await ghost.moveTo(`.PostStream-item[data-id="${created.data.id}"]`, 'Yeni mesajınız');
          setTimeout(() => ghost.hide(), 2500);
        }, 1500);
      }
    } catch (e) {
      card.state = 'error';
      card.error = (e && e.message) || 'Paylaşılamadı.';
      this.say('Paylaşırken bir sorun oldu.');
    }
    m.redraw();
  }
}

/** Tek kopya: panel sayfada bir kez açılır */
const assistant = {
  el: null,
  panel: null,
  wake: null,

  open(command, opts = {}) {
    if (!app.session.user) return;
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.className = 'FramioAssistant-host';
      document.body.appendChild(this.el);
      const self = this;
      m.mount(this.el, {
        view: () => m(Panel, { oncreate: (v) => (self.panel = v.state) }),
      });
    }
    document.body.classList.add('framio-assistant-open');
    if (opts.listen) setTimeout(() => this.panel && this.panel.listen(command || ''), 80);
    else if (command) setTimeout(() => this.panel && this.panel.command(command), 50);
  },

  close() {
    if (!this.el) return;
    m.mount(this.el, null);
    this.el.remove();
    this.el = null;
    this.panel = null;
    document.body.classList.remove('framio-assistant-open');
    ghost.hide();
  },

  toggle() {
    this.el ? this.close() : this.open();
  },
};

export default assistant;
