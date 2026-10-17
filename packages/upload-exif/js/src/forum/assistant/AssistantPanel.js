import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import folder from './folder';
import { canListen, listenOnce, speak } from './speech';

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
    folder.load().then(() => {
      this.folderName = folder.name();
      m.redraw();
    });
    this.say(`Merhaba, ben ${assistantName()}. "06 ABC 123 fotoğrafını paylaş" gibi bir komut verin.`, false);
  }

  say(text, voice = true) {
    this.log.push({ who: 'bot', text });
    if (voice && pref('framio_assistant_speak', true)) speak(text);
    m.redraw();
    setTimeout(() => {
      const el = document.querySelector('.FramioAssistant-log');
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  }

  view() {
    return (
      <div className="FramioAssistant" role="dialog" aria-label={assistantName()}>
        <header className="FramioAssistant-head">
          <span className="FramioAssistant-badge">
            <i className="fas fa-magic"></i>
          </span>
          <strong>{assistantName()}</strong>
          <span className="FramioAssistant-folder" title="Bağlı fotoğraf klasörü">
            <i className="far fa-folder"></i> {this.folderName || 'Klasör bağlı değil'}
          </span>
          <button type="button" className="FramioAssistant-close" aria-label="Kapat" onclick={() => assistant.close()}>
            <i className="fas fa-times"></i>
          </button>
        </header>

        <div className="FramioAssistant-log">
          {this.log.map((l) => (
            <div className={'FramioAssistant-msg is-' + l.who}>{l.text}</div>
          ))}
          {this.queue.map((card) => this.cardView(card))}
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
          <Button className="Button FramioAssistant-link" icon="far fa-folder-open" onclick={() => this.linkFolder()}>
            Fotoğraf klasörümü bağla
          </Button>
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
    );
  }

  cardView(card) {
    const f = card.fields;
    const field = (key, label) => (
      <label className="FramioAssistant-field">
        <span>{label}</span>
        <input className="FormControl" value={f[key] || ''} oninput={(e) => (f[key] = e.target.value)} disabled={card.state !== 'ready'} />
      </label>
    );

    return (
      <div className={'FramioAssistant-card is-' + card.state} key={card.id}>
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

  async linkFolder() {
    try {
      await folder.link();
      this.folderName = folder.name();
      this.say(`"${this.folderName}" klasörünü bağladım. Artık buradaki fotoğrafları bulabilirim.`);
    } catch (e) {
      if (e && e.name !== 'AbortError') this.say('Klasör bağlanamadı.');
    }
  }

  async listen() {
    if (this.listening) return;
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
      if (text) this.command(text);
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
    this.input = '';
    this.log.push({ who: 'me', text });
    m.redraw();

    let intent;
    try {
      intent = await app.request({ method: 'POST', url: api('/framio-assistant/parse'), body: { text } });
    } catch (e) {
      return this.say('Komutu işleyemedim.');
    }

    const pending = this.queue.find((c) => c.state === 'ready');
    if (intent.action === 'confirm' && pending) return this.share(pending);
    if (intent.action === 'cancel') {
      if (pending) return this.skip(pending);
      return this.say('Tamam, iptal ettim.');
    }
    if (intent.action === 'folder') return this.linkFolder();
    if (intent.action === 'help') {
      return this.say('Bağlı klasörünüzdeki fotoğrafları plaka ya da dosya adıyla bulurum, Framio AI ile künyesini çıkarırım ve uygun başlığa paylaşırım. Örnek: "06 ABC 123 fotoğrafını paylaş" ya da "34 TK 1234 için 3 fotoğraf bul".');
    }
    if (!intent.query) {
      return this.say('Hangi aracın fotoğrafını arayayım? Plakayı ya da dosya adını söyleyin.');
    }

    if (!folder.supported()) return this.say('Bu tarayıcıda klasör erişimi yok; Chrome ya da Edge kullanın.');
    if (!(await folder.load())) return this.say('Önce fotoğraf klasörünüzü bağlamanız gerekiyor; aşağıdaki düğmeye dokunun.');
    if (!(await folder.ensure())) return this.say('Klasöre erişim izni gerekiyor. Tarayıcının sorduğu izne "İzin ver" deyin ve komutu tekrarlayın.');

    this.busy = true;
    m.redraw();
    let files = [];
    try {
      files = await folder.find(intent.query, intent.count === 0 ? 20 : intent.count || 1);
    } catch (e) {
      this.busy = false;
      return this.say('Klasörü okuyamadım.');
    }
    this.busy = false;

    if (!files.length) return this.say(`"${intent.query}" adını taşıyan bir fotoğraf bulamadım.`);
    this.say(files.length === 1 ? `Bir fotoğraf buldum, inceliyorum.` : `${files.length} fotoğraf buldum, inceliyorum.`);

    for (const file of files) {
      await this.prepare(file, intent);
    }
  }

  async prepare(file, intent) {
    const card = {
      id: Math.random().toString(36).slice(2),
      file,
      preview: URL.createObjectURL(file),
      state: 'analyzing',
      fields: { plate: intent.plate || '' },
      suggestions: [],
      topic: '',
    };
    this.queue.push(card);
    m.redraw();

    try {
      const fd = new FormData();
      fd.append('image', await shrink(file), 'ai.jpg');
      fd.append('exif_head', file.slice(0, 256 * 1024), 'head.jpg');
      if (intent.tag) fd.append('tag_slug', intent.tag);
      const ai = await app.request({ method: 'POST', url: api('/framio-media/analyze-ai'), body: fd });
      const d = (ai && ai.data) || {};
      Object.assign(card.fields, {
        company: d.company || '',
        plate: d.plate || card.fields.plate,
        brand: d.brand || '',
        model: d.model || '',
        location: d.location || d.location_guess || '',
        year: d.year || d.year_guess || '',
      });
    } catch (e) {
      // Analiz olmadan da devam: alanlar elle doldurulabilir
    }

    try {
      const r = await app.request({ method: 'POST', url: api('/framio-assistant/route'), body: { brand: card.fields.brand, model: card.fields.model, company: card.fields.company } });
      card.suggestions = r.suggestions || [];
      card.topic = card.suggestions.length ? String(card.suggestions[0].discussion_id) : '';
      card.auto = !!r.auto && pref('framio_assistant_auto', true);
    } catch (e) {}

    card.state = 'ready';
    const f = card.fields;
    const summary = [f.company, f.plate, [f.brand, f.model].filter(Boolean).join(' '), f.location].filter(Boolean).join(', ');
    const topic = card.suggestions[0];

    if (card.auto && topic) {
      this.say(`${summary}. Bunu her zamanki gibi ${topic.title} başlığına paylaşıyorum; durdurmak için "iptal" deyin.`);
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
    card.state = 'sharing';
    m.redraw();

    try {
      let code = await upload(card.file, pref('framio_assistant_watermark', 'none'));
      const f = card.fields;
      const alt = [[f.company, f.plate].filter(Boolean).join(' | '), [f.brand, f.model].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
      if (alt) code = code.replace(/alt="([^"]*)"/g, `alt="${alt.replace(/"/g, '&quot;')}"`);
      const content = code + (kunyeText(f) ? '\n' + kunyeText(f) : '') + '\n';

      await app.request({
        method: 'POST',
        url: api('/posts'),
        body: { data: { type: 'posts', attributes: { content }, relationships: { discussion: { data: { type: 'discussions', id: String(card.topic) } } } } },
      });

      const s = card.suggestions.find((x) => String(x.discussion_id) === String(card.topic)) || {};
      card.state = 'done';
      card.topicTitle = s.title || 'başlık';
      card.doneUrl = s.url || '/d/' + card.topic;
      app.request({ method: 'POST', url: api('/framio-assistant/learn'), body: { brand: f.brand, model: f.model, company: f.company, discussion_id: card.topic } }).catch(() => {});
      this.say(`Paylaştım: ${card.topicTitle}.`);
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

  open(command) {
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
    if (command) setTimeout(() => this.panel && this.panel.command(command), 50);
  },

  close() {
    if (!this.el) return;
    m.mount(this.el, null);
    this.el.remove();
    this.el = null;
    this.panel = null;
  },

  toggle() {
    this.el ? this.close() : this.open();
  },
};

export default assistant;
