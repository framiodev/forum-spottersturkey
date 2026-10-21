import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';

const sec = (ms) => {
  const s = Math.round((ms || 0) / 1000);
  if (s < 60) return s + ' sn';
  const m = Math.floor(s / 60);
  return m < 60 ? m + ' dk ' + (s % 60) + ' sn' : Math.floor(m / 60) + ' sa ' + (m % 60) + ' dk';
};

/** Yönetici: gönderi istatistikleri (Instagram tarzı) */
export default class PostInsightsModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);
    this.data = null;
    app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/framio-insights', params: { id: this.attrs.post.id() } })
      .then((d) => { this.data = d; m.redraw(); })
      .catch(() => { this.data = { error: true }; m.redraw(); });
  }

  className() { return 'PostInsightsModal Modal--medium'; }
  title() { return [<i className="fas fa-chart-bar"></i>, ' Gönderi İstatistikleri']; }

  thumbOf(id) {
    const img = document.querySelector(`.Post[data-id="${this.attrs.post.id()}"] [data-id="${id}"] img`);
    return img ? img.currentSrc || img.src : null;
  }

  bars(rows, max) {
    return (
      <div className="PI-bars">
        {rows.map((r) => (
          <div className="PI-bar">
            <span className="PI-barLabel" title={r.label}>{r.label}</span>
            <span className="PI-barTrack"><span className="PI-barFill" style={{ width: (max ? Math.max(2, (r.value / max) * 100) : 0) + '%' }}></span></span>
            <span className="PI-barVal">{r.text != null ? r.text : r.value}</span>
          </div>
        ))}
      </div>
    );
  }

  content() {
    const d = this.data;
    if (!d) return <div className="Modal-body"><LoadingIndicator /></div>;
    if (d.error) return <div className="Modal-body">İstatistikler alınamadı.</div>;
    if (!d.unique) return <div className="Modal-body PI-empty"><i className="fas fa-chart-line"></i><p>Bu gönderi için henüz veri yok. Sayım bu özellik açıldıktan sonra başlar.</p></div>;

    const dayMax = Math.max(1, ...d.daily.map((x) => x.n));
    const imgMax = Math.max(1, ...d.images.map((x) => x.ms));
    const clickMax = Math.max(1, ...d.clicks.map((x) => x.n));
    const locMax = Math.max(1, ...d.locations.map((x) => x.n));
    const buckets = Object.entries(d.dwellBuckets);
    const bMax = Math.max(1, ...buckets.map(([, v]) => v));
    const reach = Object.entries(d.reach || {});
    const mobile = d.devices.mobile || 0, desktop = d.devices.desktop || 0;

    return (
      <div className="Modal-body PI">
        <div className="PI-stats">
          <div className="PI-stat"><b>{d.unique}</b><span>Kişi gördü</span></div>
          <div className="PI-stat"><b>{d.views}</b><span>Toplam görüntülenme</span></div>
          <div className="PI-stat"><b>{sec(d.dwellAvg)}</b><span>Ortalama inceleme</span></div>
          <div className="PI-stat"><b>{sec(d.dwellTotal)}</b><span>Toplam inceleme</span></div>
        </div>
        <div className="PI-sub">
          {d.members} üye · {d.guests} ziyaretçi · ortanca {sec(d.dwellMedian)} · {mobile} mobil / {desktop} masaüstü
        </div>

        <h4>Son 14 gün</h4>
        <div className="PI-days">
          {d.daily.map((x) => <span className="PI-day" title={x.d + ': ' + x.n + ' kişi'}><span style={{ height: (x.n / dayMax) * 100 + '%' }}></span></span>)}
        </div>

        <h4>Ne kadar süre incelendi?</h4>
        {this.bars(buckets.map(([k, v]) => ({ label: k, value: v, text: v + ' kişi' })), bMax)}

        {d.images.length ? [
          <h4>Fotoğraf başına</h4>,
          <div className="PI-images">
            {d.images.map((x, i) => (
              <div className="PI-image">
                {this.thumbOf(x.id) ? <img src={this.thumbOf(x.id)} alt="" loading="lazy" /> : <span className="PI-noThumb">#{i + 1}</span>}
                <div><b>{sec(x.ms)}</b><span>{x.people} kişi · kişi başı {sec(x.ms / Math.max(1, x.people))}</span>
                  <span className="PI-barTrack"><span className="PI-barFill" style={{ width: (x.ms / imgMax) * 100 + '%' }}></span></span></div>
              </div>
            ))}
          </div>,
        ] : null}

        {d.swipers ? [
          <h4>Kaydırma davranışı</h4>,
          <div className="PI-sub">{d.swipers} kişi kaydırdı · {d.slides} geçiş · {d.backs} geri dönüş</div>,
          this.bars(reach.map(([k, v]) => ({ label: k + '. fotoğrafa kadar', value: v, text: v + ' kişi' })), Math.max(1, ...reach.map(([, v]) => v))),
        ] : null}

        <h4>Büyük görünüm</h4>
        <div className="PI-sub">{d.lightbox.opens} kez açıldı · {d.lightbox.people} kişi · toplam {sec(d.lightbox.ms)}{d.lightbox.opens ? ' · açılış başı ' + sec(d.lightbox.ms / d.lightbox.opens) : ''}</div>

        <h4>En çok tıklanan künye bilgileri</h4>
        {d.clicks.length ? this.bars(d.clicks.map((c) => ({ label: c.label, value: c.n, text: c.n + ' (' + c.people + ' kişi)' })), clickMax) : <div className="PI-sub">Henüz tıklama yok.</div>}

        <h4>Konum</h4>
        {d.locations.some((l) => l.country)
          ? this.bars(d.locations.map((l) => ({ label: l.country ? (l.city ? l.city + ', ' : '') + l.country : 'Bilinmiyor', value: l.n, text: l.n + ' kişi' })), locMax)
          : <div className="PI-sub">Konum bilgisi gelmiyor (Cloudflare konum başlıkları kapalı olabilir).</div>}

        {d.since ? <div className="PI-foot">Veri başlangıcı: {new Date(d.since.replace(' ', 'T')).toLocaleDateString('tr-TR')} · Yöneticilerin gezintisi ve botlar sayılmaz.</div> : null}
      </div>
    );
  }
}
