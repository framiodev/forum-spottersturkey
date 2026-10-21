import app from 'flarum/admin/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';

/**
 * Otomatik koleksiyon kuralları: hedef başlık + yapay zekâya sorulacak evet/hayır sorusu + kaynak bölümler.
 * Kurallar ayar akışına (attrs.setting: framio-upload-exif.auto_collect_rules) JSON olarak yazılır, sayfanın
 * "Kaydet" düğmesiyle kaydedilir. Geçmiş gönderiler kural başına önizlemeyle taranır.
 */
export default class AutoCollectManager extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.scan = {}; // kural → { busy, items, picked:Set }
  }

  rules() {
    try { return JSON.parse(this.attrs.setting() || '[]') || []; } catch (e) { return []; }
  }

  save(rules) {
    this.attrs.setting(JSON.stringify(rules));
  }

  update(i, key, value) {
    const rules = this.rules();
    rules[i][key] = value;
    this.save(rules);
  }

  add() {
    const rules = this.rules();
    rules.push({ key: Math.random().toString(36).slice(2, 12), name: '', target: '', question: '', tags: '', active: true });
    this.save(rules);
  }

  remove(i) {
    if (!confirm('Kural silinsin mi? (Daha önce eklenen mesajlar kalır.)')) return;
    const rules = this.rules();
    rules.splice(i, 1);
    this.save(rules);
  }

  call(body) {
    return app.request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/framio-media/auto-collect', body });
  }

  runScan(rule) {
    const st = (this.scan[rule.key] = this.scan[rule.key] || { items: [], picked: new Set() });
    st.busy = true;
    st.error = '';
    this.call({ rule: rule.key, action: 'scan', limit: 20 })
      .then((r) => {
        st.items = r.items || [];
        st.scanned = true;
        st.picked = new Set(st.items.filter((x) => x.answer && x.confidence !== 'low').map((x) => x.post_id));
      })
      .catch((e) => { st.error = (e.response && e.response.error) || 'Tarama yapılamadı (önce ayarları kaydedin).'; })
      .finally(() => { st.busy = false; m.redraw(); });
  }

  addPicked(rule) {
    const st = this.scan[rule.key];
    if (!st || !st.picked.size) return;
    st.busy = true;
    this.call({ rule: rule.key, action: 'add', posts: Array.from(st.picked) })
      .then((r) => { app.alerts.show({ type: 'success' }, r.added + ' gönderi başlığa eklendi.'); st.items = st.items.filter((x) => !st.picked.has(x.post_id)); st.picked = new Set(); })
      .finally(() => { st.busy = false; m.redraw(); });
  }

  view() {
    const rules = this.rules();
    const base = app.forum.attribute('baseUrl');

    return (
      <div className="FramioAuto">
        {rules.map((r, i) => {
          const st = this.scan[r.key];
          return (
            <div className="FramioAuto-rule">
              <div className="FramioAuto-row">
                <input className="FormControl" placeholder="Kural adı (ör. Renkli otobüsler)" value={r.name} oninput={(e) => this.update(i, 'name', e.target.value)} />
                <input className="FormControl" placeholder="Hedef başlık adresi ya da numarası (ör. /d/245)" value={r.target} oninput={(e) => this.update(i, 'target', e.target.value)} />
                <Switch state={r.active !== false} onchange={(v) => this.update(i, 'active', v)}>Etkin</Switch>
                <Switch state={!!r.backfill} onchange={(v) => this.update(i, 'backfill', v)}>Geçmişi de tara</Switch>
                <Button className="Button Button--icon" icon="fas fa-trash" title="Kuralı sil" onclick={() => this.remove(i)} />
              </div>
              <textarea className="FormControl" rows="2" placeholder="Yapay zekâya sorulacak evet/hayır sorusu (ör. Aracın gövdesi ağırlıklı olarak beyaz DIŞINDA bir renkte mi? Firma logoları ve yazılar sayılmaz.)"
                value={r.question} oninput={(e) => this.update(i, 'question', e.target.value)} />
              <input className="FormControl" placeholder="Hangi bölümlerden alınsın? (etiket kısa adları, virgülle; boş: tüm forum)" value={r.tags} oninput={(e) => this.update(i, 'tags', e.target.value)} />
              <div className="FramioAuto-row">
                <Button className="Button" icon="fas fa-search" loading={st && st.busy} onclick={() => this.runScan(r)}>Geçmişi tara (20 gönderi)</Button>
                {st && st.items.length ? <Button className="Button Button--primary" icon="fas fa-plus" loading={st.busy} onclick={() => this.addPicked(r)}>Seçilenleri ekle ({st.picked.size})</Button> : null}
                <span className="helpText">Yeni gönderiler 10 dakikada bir kendiliğinden sorulur. "Geçmişi de tara" açıksa eski gönderiler de 10 dakikada 30'ar taranıp uygun olanlar bildirim gönderilmeden kopyalanır.</span>
              </div>
              {st && st.error ? <div className="Alert Alert--error">{st.error}</div> : null}
              {st && st.items.length ? (
                <div className="FramioAuto-grid">
                  {st.items.map((x) => (
                    <label className={'FramioAuto-item' + (x.answer ? ' is-yes' : '')} title={x.error || ''}>
                      {x.image ? <img src={x.image} loading="lazy" alt="" /> : <span className="FramioAuto-noimg">görsel yok</span>}
                      <span className="FramioAuto-meta">
                        <input type="checkbox" checked={st.picked.has(x.post_id)} onchange={(e) => { e.target.checked ? st.picked.add(x.post_id) : st.picked.delete(x.post_id); }} />
                        {x.answer ? ' Evet' : ' Hayır'} · {x.confidence}
                        <a href={base + '/d/' + x.discussion_id + '/' + x.number} target="_blank" rel="noopener"> #{x.post_id}</a>
                      </span>
                    </label>
                  ))}
                </div>
              ) : st && !st.busy && st.items && !st.error && st.scanned ? <div className="helpText">Sorulmamış gönderi kalmadı.</div> : null}
            </div>
          );
        })}
        <Button className="Button" icon="fas fa-plus" onclick={() => this.add()}>Kural ekle</Button>
      </div>
    );
  }
}
