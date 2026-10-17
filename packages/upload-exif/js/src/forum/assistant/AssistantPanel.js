import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import folder from './folder';
import { canListen, listenOnce, speak, whenQuiet, hush } from './speech';
import ghost from './ghost';
import drive from './drive';
import { shotYear, plateKey, slots, localStamp, humanDate, isAny, isYes } from './planner';

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
    app
      .request({ method: 'GET', url: api('/framio-assistant/history?limit=60&mark=1') })
      .then((res) => {
        const old = (res.messages || []).map((m) => ({ who: m.role, text: m.text, old: true }));
        this.log = old.concat(this.log);
        if (!old.length) this.say(`Merhaba, ben ${assistantName()}. "06 ABC 123 fotoğrafını paylaş", "bugün 10 yeni fotoğraf paylaş" ya da "Drive'dan 2026 çekimlerinden 70 poz seç, 7 gün boyunca günde 10, saat 12'de paylaş" diyebilirsiniz.`, false);
        else {
          const notices = (res.messages || []).filter((m) => m.role === 'notice' && !m.seen);
          if (notices.length) this.say(notices.map((n) => n.text).join(' '), true, false);
        }
        m.redraw();
        this.scroll();
      })
      .catch(() => this.say(`Merhaba, ben ${assistantName()}.`, false));
  }

  remember(role, text) {
    app.request({ method: 'POST', url: api('/framio-assistant/history'), body: { role, text } }).catch(() => {});
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
          {this.log.map((l) =>
            l.who === 'step' ? (
              <div className={'FramioAssistant-step' + (l.done ? ' is-done' : '')}>
                <i className={l.done ? 'fas fa-check' : 'fas fa-circle-notch fa-spin'}></i> {l.text}
              </div>
            ) : (
              <div className={'FramioAssistant-msg is-' + l.who + (l.old ? ' is-old' : '')}>{l.text}</div>
            )
          )}
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
          <div className="FramioAssistant-sources">
            <Button className="Button FramioAssistant-link" icon="far fa-folder-open" onclick={() => this.linkFolder()}>
              Klasör bağla
            </Button>
            {drive.available() ? (
              <Button className="Button FramioAssistant-link" icon="fab fa-google-drive" onclick={() => this.linkDrive()}>
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

  async linkDrive() {
    try {
      this.step('Google Drive klasör seçicisini açıyorum (yalnızca okuma izni)…');
      const list = await drive.pickFolders();
      this.folderName = folder.name();
      this.say(list.length ? `Drive'dan ${list.length} klasör bağlı. Yalnızca okuyabilirim; silme ya da değiştirme yetkim yok.` : 'Drive klasörü seçilmedi.');
    } catch (e) {
      this.say(e.message || 'Google Drive bağlanamadı.');
    }
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
    this.log.push({ who: 'me', text });
    this.remember('me', text);
    m.redraw();


    let intent;
    this.step('Komutu anlıyorum…');
    try {
      intent = await app.request({ method: 'POST', url: api('/framio-assistant/parse'), body: { text, context: this.task && this.task.waiting ? this.task.question : '' } });
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
      files = await folder.find(intent.query, intent.count === 0 ? 20 : intent.count || 1, depth, (t) => this.step(t));
    } catch (e) {
      return this.say('Kaynakları okuyamadım.');
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
    card.state = 'analyzing';

    this.step('Uygun başlığı arıyorum…');
    try {
      const r = await app.request({ method: 'POST', url: api('/framio-assistant/route'), body: { brand: card.fields.brand, model: card.fields.model, company: card.fields.company, year: card.fields.year, hint: path } });
      card.suggestions = r.suggestions || [];
      card.topic = card.suggestions.length ? String(card.suggestions[0].discussion_id) : '';
      card.auto = !!r.auto && pref('framio_assistant_auto', true);
    } catch (e) {}

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
        const pick = t.sections.filter((x) => low.split(/\s+/).some((w) => w.length > 3 && x.name.toLocaleLowerCase('tr-TR').includes(w.slice(0, 6))));
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

  async runTask() {
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
    try {
      candidates = await folder.find('', Math.max(pool, (t.targets ? t.targets.length : 0) * 20), depth, (x) => this.step(x), { source: intent.source, year: intent.shot_year, hint: intent.location || t.filter || '' });
      // Çekim yeri klasör adında geçiyorsa ("…/Esenler/…") önce onlar
      if (intent.location) {
        const words = intent.location.toLocaleLowerCase('tr-TR').split(/[\s,]+/).filter((w) => w.length > 3 && !/otogar|terminal|garaj/.test(w));
        const inPath = candidates.filter((c) => words.some((w) => String(c.path || '').toLocaleLowerCase('tr-TR').includes(w.slice(0, 6))));
        if (inPath.length) candidates = inPath.concat(candidates.filter((c) => !inPath.includes(c)));
        t.placeWords = words;
        t.placeFromPath = inPath.length > 0;
      }
    } catch (e) {
      this.task = null;
      return this.say('Kaynakları okuyamadım.');
    }

    // 2) Daha önce yüklenmiş olanlar çıkarılır ("yeni" fotoğraflar)
    this.step('Daha önce paylaştıklarınızı ayıklıyorum…');
    try {
      const seen = new Set((await app.request({ method: 'POST', url: api('/framio-assistant/seen'), body: { names: candidates.map((c) => c.name) } })).seen || []);
      candidates = candidates.filter((c) => !seen.has(c.name));
    } catch (e) {}

    // 3) Çekim yılı ve çeşitlilik (her araç bir kez)
    const picked = [];
    const plates = new Set();
    const needle = t.filter ? t.filter.toLocaleLowerCase('tr-TR') : null;
    for (const c of candidates) {
      if (picked.length >= t.count * (needle || t.targets || intent.location ? 4 : 1)) break;
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
    for (const c of picked) {
      if (items.length >= t.count) break;
      this.step(`${items.length + 1}/${t.count} · "${c.name}" ${c.file ? 'inceleniyor' : 'indiriliyor'}…`);
      try {
        if (!c.file) c.file = await c.load();
      } catch (e) {
        this.step(`"${c.name}" indirilemedi, atlıyorum.`);
        continue;
      }
      let f = {};
      try {
        const fd = new FormData();
        fd.append('image', await shrink(c.file), 'ai.jpg');
        fd.append('exif_head', c.file.slice(0, 256 * 1024), 'head.jpg');
        fd.append('file_name', c.name);
        const ai = await app.request({ method: 'POST', url: api('/framio-media/analyze-ai'), body: fd });
        const d = (ai && ai.data) || {};
        f = { company: d.company || '', plate: d.plate || '', brand: d.brand || '', model: d.model || '', location: d.location || '', year: d.year || String((await shotYear(c.file)) || '') };
      } catch (e) {
        f = { year: String((await shotYear(c.file)) || '') };
      }
      if (needle && ![f.company, f.plate, f.brand, f.model].join(' ').toLocaleLowerCase('tr-TR').includes(needle)) continue;
      // Çekim yeri klasörden anlaşılmadıysa Framio AI'nın bulduğu yere bakılır
      if (t.placeWords && t.placeWords.length && !t.placeFromPath) {
        const loc = String(f.location || '').toLocaleLowerCase('tr-TR');
        if (!loc || !t.placeWords.some((w) => loc.includes(w.slice(0, 6)))) continue;
      }
      if (intent.diverse && f.plate) {
        const k = f.plate.replace(/\s+/g, '');
        if (usedPlates.has(k)) continue;
        usedPlates.add(k);
      }

      let topic = t.topic;
      if (!topic) {
        try {
          const r = await app.request({ method: 'POST', url: api('/framio-assistant/route'), body: { brand: f.brand, model: f.model, company: f.company, year: f.year, hint: c.path || '' } });
          const sugg = r.suggestions || [];
          if (t.targets) {
            // Yalnızca hedef başlıklardan, henüz kotası dolmamış olanı
            t.filled = t.filled || {};
            topic = sugg.find((x) => t.targets.some((g) => g.discussion_id === x.discussion_id) && (t.filled[x.discussion_id] || 0) < t.perTopic);
          } else {
            topic = sugg[0];
          }
        } catch (e) {}
      }
      if (t.targets && !topic) {
        this.step(`"${c.name}" hedef başlıklardan birine uymuyor ya da o başlık doldu, atlıyorum.`);
        continue;
      }
      if (!topic) {
        this.step(`"${c.name}" için uygun başlık bulamadım, atlıyorum.`);
        continue;
      }

      this.step(`${items.length + 1}/${t.count} · imzalanıp yükleniyor…`);
      let code;
      try {
        code = await upload(c.file, pref('framio_assistant_watermark', 'none'));
      } catch (e) {
        this.step(`"${c.name}" yüklenemedi, atlıyorum.`);
        continue;
      }
      const alt = [[f.company, f.plate].filter(Boolean).join(' | '), [f.brand, f.model].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
      if (alt) code = code.replace(/alt="([^"]*)"/g, `alt="${alt.replace(/"/g, '&quot;')}"`);
      const content = code + (kunyeText(f) ? '\n' + kunyeText(f) : '') + '\n';
      items.push({ discussion_id: topic.discussion_id, title: topic.title, content, label: alt || c.name, f });
      if (t.targets) t.filled[topic.discussion_id] = (t.filled[topic.discussion_id] || 0) + 1;

      if (!t.plan) {
        // Hemen paylaş
        try {
          await app.request({ method: 'POST', url: api('/posts'), body: { data: { type: 'posts', attributes: { content }, relationships: { discussion: { data: { type: 'discussions', id: String(topic.discussion_id) } } } } } });
          app.request({ method: 'POST', url: api('/framio-assistant/learn'), body: { brand: f.brand, model: f.model, company: f.company, discussion_id: topic.discussion_id } }).catch(() => {});
        } catch (e) {
          this.step(`"${c.name}" paylaşılamadı.`);
        }
      }
    }

    if (!items.length) {
      this.task = null;
      return this.say('Koşullara uyan fotoğraf hazırlayamadım.');
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
      app.request({ method: 'POST', url: api('/framio-assistant/learn'), body: { brand: f.brand, model: f.model, company: f.company, discussion_id: card.topic } }).catch(() => {});
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
