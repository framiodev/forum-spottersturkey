import app from 'flarum/admin/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';

/**
 * Framio AI model referans görselleri: sık karıştırılan modeller için örnek fotoğraflar.
 * Kaynaklar: bilgisayardan yükleme, adres yapıştırma, forumda o modelle künyelenmiş fotoğraflar, web araması.
 */
export default class ModelRefsManager extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.rows = [];
    this.brand = '';
    this.model = '';
    this.tags = '';
    this.note = '';
    this.url = '';
    this.results = null; // { source, items: [{url, thumb, title}] }
    this.busy = false;
    this.error = '';
    this.load();
  }

  api(params = {}, method = 'GET', body) {
    return app.request({ method, url: app.forum.attribute('apiUrl') + '/framio-media/ai-refs', params, body, serialize: body instanceof FormData ? (r) => r : undefined });
  }

  load() {
    this.api().then((r) => { this.rows = r.data || []; m.redraw(); });
  }

  add(payload) {
    if (!this.brand.trim() || !this.model.trim()) { this.error = 'Önce marka ve modeli yazın.'; return Promise.resolve(); }
    this.busy = true;
    this.error = '';
    let body = payload;
    if (!(payload instanceof FormData)) body = Object.assign({ brand: this.brand, model: this.model, tag_slugs: this.tags, note: this.note }, payload);
    else ['brand', 'model', 'tag_slugs', 'note'].forEach((k) => payload.append(k, { brand: this.brand, model: this.model, tag_slugs: this.tags, note: this.note }[k]));
    return this.api({}, 'POST', body)
      .then(() => this.load())
      .catch((e) => { this.error = (e.response && e.response.error) || 'Eklenemedi.'; })
      .finally(() => { this.busy = false; m.redraw(); });
  }

  upload(e) {
    Array.from(e.target.files || []).reduce((p, f) => p.then(() => {
      const fd = new FormData();
      fd.append('image', f);
      return this.add(fd);
    }), Promise.resolve());
    e.target.value = '';
  }

  find(source) {
    if (!this.model.trim()) { this.error = 'Aramak için model yazın.'; return; }
    this.busy = true;
    this.error = '';
    const params = source === 'forum' ? { find: 'forum', brand: this.brand, model: this.model } : { find: 'web', q: (this.brand + ' ' + this.model).trim() };
    this.api(params)
      .then((r) => { this.results = { source, items: (r.data || []).map((x) => (typeof x === 'string' ? { url: x, thumb: x } : x)) }; })
      .catch((e) => { this.error = (e.response && e.response.error) || 'Arama yapılamadı.'; })
      .finally(() => { this.busy = false; m.redraw(); });
  }

  remove(id) {
    if (!confirm('Bu referans görsel silinsin mi?')) return;
    this.api({ delete: id }, 'POST', {}).then(() => this.load());
  }

  view() {
    const groups = {};
    this.rows.forEach((r) => { (groups[r.brand + ' ' + r.model] = groups[r.brand + ' ' + r.model] || []).push(r); });
    const thumb = (u) => (u.startsWith('/') ? app.forum.attribute('baseUrl') + u : u);

    return (
      <div className="FramioRefs">
        <div className="FramioRefs-form">
          <input className="FormControl" placeholder="Marka (ör. Setra)" value={this.brand} oninput={(e) => (this.brand = e.target.value)} />
          <input className="FormControl" placeholder="Model (ör. S 415 HD)" value={this.model} oninput={(e) => (this.model = e.target.value)} />
          <input className="FormControl" placeholder="Kategori etiketleri (boş: tümü)" value={this.tags} oninput={(e) => (this.tags = e.target.value)} />
          <input className="FormControl" placeholder="Not (ör. 2019 sonrası, yüksek tavan)" value={this.note} oninput={(e) => (this.note = e.target.value)} />
        </div>
        <div className="FramioRefs-actions">
          <label className="Button">
            <i className="fas fa-upload"></i> Görsel yükle
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onchange={(e) => this.upload(e)} />
          </label>
          <Button className="Button" icon="fas fa-comments" loading={this.busy} onclick={() => this.find('forum')}>Forumdan bul</Button>
          <Button className="Button" icon="fab fa-google" loading={this.busy} onclick={() => this.find('web')}>Web'de ara</Button>
          <input className="FormControl" style={{ flex: 1, minWidth: '180px' }} placeholder="ya da görsel adresi yapıştırın" value={this.url} oninput={(e) => (this.url = e.target.value)} />
          <Button className="Button" icon="fas fa-link" onclick={() => this.add({ url: this.url, source: 'url' }).then(() => { this.url = ''; })}>Ekle</Button>
        </div>
        {this.error ? <div className="Alert Alert--error" style={{ margin: '8px 0' }}>{this.error}</div> : null}

        {this.results ? (
          <div className="FramioRefs-results">
            <div className="helpText">{this.results.items.length ? 'Eklemek istediklerinize tıklayın:' : 'Sonuç yok.'} <a onclick={() => { this.results = null; }}>Kapat</a></div>
            <div className="FramioRefs-grid">
              {this.results.items.map((it) => (
                <button type="button" className="FramioRefs-pick" title={it.title || it.url}
                  onclick={(e) => { e.currentTarget.disabled = true; this.add({ url: it.url, source: this.results.source }); }}>
                  <img src={it.thumb} loading="lazy" alt="" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="FramioRefs-list">
          {Object.keys(groups).length === 0 ? <div className="helpText">Henüz referans görsel yok.</div> : null}
          {Object.keys(groups).sort().map((k) => (
            <div className="FramioRefs-group">
              <b>{k}</b> <span className="helpText">{groups[k][0].tag_slugs || 'tüm kategoriler'}</span>
              <div className="FramioRefs-grid">
                {groups[k].map((r) => (
                  <div className="FramioRefs-item" title={r.note || ''}>
                    <img src={thumb(r.url)} loading="lazy" alt="" />
                    <span className="FramioRefs-src">{{ upload: 'yükleme', forum: 'forum', web: 'web', url: 'adres' }[r.source] || r.source}</span>
                    <button type="button" className="FramioRefs-del" title="Sil" onclick={() => this.remove(r.id)}><i className="fas fa-times"></i></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
}
