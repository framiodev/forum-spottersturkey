import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';

const SECTIONS = {
  potd: ['fas fa-crown', 'Günün Fotoğrafı'],
  popular: ['fas fa-fire', 'En Popüler'],
  recent: ['fas fa-clock', 'Son Eklenenler'],
  collections: ['fas fa-layer-group', 'Koleksiyonlar (araç sayfaları)'],
  photographers: ['fas fa-camera', 'Fotoğrafçılar'],
  equipment: ['fas fa-sliders-h', 'Ekipman (EXIF)'],
};

/**
 * "Keşfet" sekmesi: sayfanın açılıp kapanması, bölümler ve sıraları, popülerlik
 * ağırlıkları ve Günün Fotoğrafı (bugünün seçimi, dünün adayları, elle seçim).
 */
export default class ExploreSettings {
  constructor(page) {
    this.page = page;
    this.potd = null;
    this.potdLoading = false;
    this.manualInput = '';
    this.loadPotd();
  }

  loadPotd(body) {
    this.potdLoading = true;
    app
      .request({ method: body ? 'POST' : 'GET', url: app.forum.attribute('apiUrl') + '/framio/explore/potd', body })
      .then((res) => {
        this.potd = res;
        if (body) app.alerts.show({ type: 'success' }, body.post_id ? 'Günün Fotoğrafı güncellendi.' : 'Günün Fotoğrafı otomatik seçime döndü.');
      })
      .catch(() => {})
      .finally(() => {
        this.potdLoading = false;
        m.redraw();
      });
  }

  order() {
    const s = this.page.setting('framio-custom-homepage.explore_order', Object.keys(SECTIONS).join(','));
    const list = String(s() || '').split(',').map((k) => k.trim()).filter((k) => SECTIONS[k]);
    Object.keys(SECTIONS).forEach((k) => list.includes(k) || list.push(k));
    return [list, (next) => s(next.join(','))];
  }

  sectionsCard() {
    const p = this.page;
    const [list, save] = this.order();
    const move = (i, d) => {
      const next = list.slice();
      const j = i + d;
      if (j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j], next[i]];
      save(next);
    };

    return p.card('fas fa-list-ol', 'Bölümler', 'Sayfada görünecek bölümler ve sıraları.', (
      <div className="CHS-ExploreOrder">
        {list.map((k, i) => (
          <div className="CHS-Row" key={k}>
            <div className="CHS-Row-Label">
              <strong><i className={SECTIONS[k][0]}></i> {SECTIONS[k][1]}</strong>
            </div>
            <div className="CHS-Row-Control" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Button className="Button Button--icon" icon="fas fa-arrow-up" disabled={i === 0} onclick={() => move(i, -1)} aria-label="Yukarı" />
              <Button className="Button Button--icon" icon="fas fa-arrow-down" disabled={i === list.length - 1} onclick={() => move(i, 1)} aria-label="Aşağı" />
              {p.toggle('explore_show_' + k)}
            </div>
          </div>
        ))}
      </div>
    ));
  }

  potdCard() {
    const p = this.page;
    const data = this.potd;
    const today = data && data.today;
    const post = today && today.post;
    const resets = data && data.resets_at ? new Date(data.resets_at) : null;

    const body = !data ? (
      <LoadingIndicator />
    ) : (
      <div className="CHS-Potd">
        <div className="CHS-Potd-Today">
          {post && post.image ? <img src={post.image} alt="" /> : <div className="CHS-Potd-Blank"><i className="fas fa-image"></i></div>}
          <div>
            <div className="CHS-Potd-Tag">{today.source === 'manual' ? 'Elle seçildi' : 'Otomatik (dünün birincisi)'}</div>
            <strong>{post ? post.title : 'Henüz fotoğraf yok'}</strong>
            {post ? <div className="helpText">{post.author}{today.source === 'auto' && today.score ? ' · puan ' + Math.round(today.score) : ''}</div> : null}
            {post ? <a href={app.forum.attribute('baseUrl') + post.url} target="_blank" rel="noopener">Mesajı aç</a> : null}
            {resets ? <div className="helpText">Yeni seçim: {resets.toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</div> : null}
            {today.source === 'manual' ? (
              <Button className="Button Button--link" icon="fas fa-undo" loading={this.potdLoading} onclick={() => this.loadPotd({ post_id: '' })}>
                Otomatik seçime dön
              </Button>
            ) : null}
          </div>
        </div>

        <h4>Dünün adayları (puana göre)</h4>
        <p className="helpText">Puan = görüntülenme × ağırlık + beğeni × ağırlık + tepki × ağırlık. Birinci olan her gece 00.00'da otomatik seçilir ve 24 saat kalır.</p>
        <div className="CHS-Potd-Grid">
          {data.candidates.length ? (
            data.candidates.map((c, i) => (
              <div className={'CHS-Potd-Cand' + (post && post.id === c.id ? ' is-current' : '')} key={c.id}>
                {c.image ? <img src={c.image} alt="" loading="lazy" /> : <div className="CHS-Potd-Blank"><i className="fas fa-image"></i></div>}
                <div className="CHS-Potd-CandInfo">
                  <span className="CHS-Potd-Rank">{i + 1}</span>
                  <span className="CHS-Potd-CandTitle">{c.title}</span>
                  <span className="helpText">puan {Math.round(c.score)}</span>
                </div>
                <Button className="Button Button--primary" disabled={(post && post.id === c.id) || this.potdLoading} onclick={() => this.loadPotd({ post_id: String(c.id) })}>
                  {post && post.id === c.id ? 'Seçili' : 'Bunu seç'}
                </Button>
              </div>
            ))
          ) : (
            <p className="helpText">Dün ve son 7 günde puan alan fotoğraf yok; en yeni fotoğraf kullanılıyor.</p>
          )}
        </div>

        <h4>Başka bir fotoğraf seç</h4>
        <div style={{ display: 'flex', gap: '8px', maxWidth: '520px' }}>
          <input className="FormControl" placeholder="Mesaj bağlantısı (…/d/123-baslik/7) ya da mesaj kimliği" value={this.manualInput} oninput={(e) => (this.manualInput = e.target.value)} />
          <Button className="Button" disabled={!this.manualInput.trim() || this.potdLoading} onclick={() => this.loadPotd({ post_id: this.manualInput.trim() })}>
            Seç
          </Button>
        </div>
      </div>
    );

    return p.card('fas fa-crown', 'Günün Fotoğrafı', 'Bugünün seçimi gün boyu (yerel saatle 00.00–24.00) sayfanın en üstünde durur.', body);
  }

  homeRow() {
    const isHome = (app.data.settings.default_route || '') === '/kesfet';
    return this.page.row(
      'Ana sayfa yap',
      isHome ? 'Keşfet şu an sitenin ana sayfası.' : 'Sitenin açılış sayfası Keşfet olsun (Yönetim → Temel → Varsayılan Rota ile aynı ayar).',
      <Button
        className="Button"
        icon={isHome ? 'fas fa-undo' : 'fas fa-home'}
        loading={this.homeSaving}
        onclick={() => {
          const value = isHome ? '/all' : '/kesfet';
          if (!confirm(isHome ? 'Ana sayfa varsayılan tartışma listesine dönsün mü?' : 'Sitenin ana sayfası Keşfet olsun mu?')) return;
          this.homeSaving = true;
          app
            .request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/settings', body: { default_route: value } })
            .then(() => {
              app.data.settings.default_route = value;
              app.alerts.show({ type: 'success' }, isHome ? 'Ana sayfa eski haline döndü.' : 'Keşfet artık ana sayfa.');
            })
            .finally(() => {
              this.homeSaving = false;
              m.redraw();
            });
        }}
      >
        {isHome ? 'Eski ana sayfaya dön' : 'Keşfet ana sayfa olsun'}
      </Button>
    );
  }

  view() {
    const p = this.page;
    return [
      p.card('fas fa-compass', 'Keşfet sayfası', 'Jetphotos tarzı fotoğraf vitrini: /kesfet', [
        p.row('Sayfayı aç', 'Menüde "Keşfet" öğesi görünür.', p.toggle('explore_active')),
        p.row('Sayfa başlığı', 'Menüde ve sayfanın üstünde.', p.input('explore_title', 'Keşfet')),
        p.row('Alt başlık', 'İsteğe bağlı kısa açıklama.', p.input('explore_subtitle', '')),
        this.homeRow(),
      ]),
      this.potdCard(),
      this.sectionsCard(),
      p.card('fas fa-balance-scale', 'Popülerlik puanı', 'En Popüler sıralaması ve Günün Fotoğrafı bu puanla belirlenir.', [
        p.row('Varsayılan dönem', 'Sayfa açıldığında seçili sekme.', p.select('explore_popular_default', { week: 'Bu hafta', month: 'Bu ay', year: 'Bu yıl', all: 'Tüm zamanlar' }, 'week')),
        p.row('Görüntülenme ağırlığı', 'Her görüntülenmenin puanı.', p.input('explore_w_views', '1', { type: 'number', min: 0, step: '0.5' })),
        p.row('Beğeni ağırlığı', 'Her beğeninin puanı.', p.input('explore_w_likes', '10', { type: 'number', min: 0, step: '0.5' })),
        p.row('Tepki ağırlığı', 'Her tepkinin (emoji) puanı.', p.input('explore_w_reactions', '5', { type: 'number', min: 0, step: '0.5' })),
        p.row('Önbellek (dakika)', 'Sıralamalar bu süre boyunca yeniden hesaplanmaz. Yeni mesajda kendiliğinden temizlenir.', p.input('explore_cache_minutes', '15', { type: 'number', min: 1, max: 240 })),
        p.row('Saat dilimi', 'Günün Fotoğrafı bu saate göre 00.00\'da değişir.', p.input('explore_timezone', 'Europe/Istanbul')),
      ]),
    ];
  }
}
