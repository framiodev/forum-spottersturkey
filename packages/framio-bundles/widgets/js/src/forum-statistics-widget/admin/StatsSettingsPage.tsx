import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import Switch from 'flarum/common/components/Switch';
import Select from 'flarum/common/components/Select';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import humanTime from 'flarum/common/utils/humanTime';
import StatsView from '../common/components/StatsView';
import { readConfig, metricDef, StatsConfig } from '../common/metrics';

const PLACEMENTS: Record<string, string> = {
  start_bottom: 'Sol kenar, menünün altı',
  start_top: 'Sol kenar, menünün üstü',
  end: 'Sağ kenar',
  top: 'İçeriğin üstü',
  bottom: 'İçeriğin altı',
  core: 'Bileşen Çekirdeği\'ndeki düzeni kullan',
};

/**
 * Forum İstatistikleri ayar sayfası: canlı önizleme, istatistik listesi
 * (sürükle-bırak, aç/kapat, ad, ikon), görünüm, yerleşim, sayım kuralları ve önbellek.
 */
export default class StatsSettingsPage extends ExtensionPage {
  cfg!: StatsConfig;
  stats: any = null;
  loadingStats = false;
  refreshing = false;
  dragIndex: number | null = null;
  previewWidth: 'side' | 'wide' = 'side';
  expanded: string | null = null;

  oninit(vnode: any) {
    super.oninit(vnode);
    this.cfg = readConfig(this.setting('framio-stats.config', '{}')());
    this.loadStats();
  }

  loadStats(refresh = false) {
    refresh ? (this.refreshing = true) : (this.loadingStats = true);
    app
      .request<any>({ method: refresh ? 'POST' : 'GET', url: app.forum.attribute('apiUrl') + (refresh ? '/framio-stats/refresh' : '/framio-stats') })
      .then((res) => {
        this.stats = res.data;
        if (refresh) app.alerts.show({ type: 'success' }, 'İstatistikler yeniden hesaplandı.');
      })
      .catch(() => {})
      .then(() => {
        this.loadingStats = this.refreshing = false;
        m.redraw();
      });
  }

  save() {
    this.setting('framio-stats.config')(JSON.stringify(this.cfg));
  }

  set(key: keyof StatsConfig, value: any) {
    (this.cfg as any)[key] = value;
    this.save();
  }

  move(from: number, to: number) {
    const list = this.cfg.metrics;
    if (to < 0 || to >= list.length || from === to) return;
    const [x] = list.splice(from, 1);
    list.splice(to, 0, x);
    this.save();
  }

  // ───────────────────────── Ortak parçalar

  card(icon: string, title: string, desc: string, body: any, right?: any) {
    return (
      <section className="FSA-Card">
        <header className="FSA-Card-Head">
          <span className="FSA-Card-Icon"><i className={icon}></i></span>
          <div className="FSA-Card-Titles">
            <h3>{title}</h3>
            {desc ? <p>{desc}</p> : null}
          </div>
          {right ? <div className="FSA-Card-Right">{right}</div> : null}
        </header>
        <div className="FSA-Card-Body">{body}</div>
      </section>
    );
  }

  row(label: string, help: string | null, control: any) {
    return (
      <div className="FSA-Row">
        <div className="FSA-Row-Label">
          <strong>{label}</strong>
          {help ? <small>{help}</small> : null}
        </div>
        <div className="FSA-Row-Control">{control}</div>
      </div>
    );
  }

  flag(key: string, def: boolean) {
    const s = this.setting('framio-stats.' + key, def ? '1' : '0');
    return <Switch state={s() === '1' || s() === 'true'} onchange={(v: boolean) => s(v ? '1' : '0')} />;
  }

  // ───────────────────────── Görünüm

  content() {
    return (
      <div className="FSA">
        <div className="FSA-Layout">
          <div className="FSA-Main">
            {this.viewMetrics()}
            {this.viewAppearance()}
            {this.viewCounting()}
            {this.viewCache()}
            <div className="FSA-Save">{this.submitButton()}</div>
          </div>
          <aside className="FSA-Side">{this.viewPreview()}</aside>
        </div>
      </div>
    );
  }

  viewPreview() {
    return (
      <div className="FSA-Preview">
        <div className="FSA-Preview-Head">
          <strong><i className="fas fa-eye"></i> Canlı önizleme</strong>
          <div className="FSA-Seg">
            <button className={this.previewWidth === 'side' ? 'is-active' : ''} title="Kenar sütunu genişliği" onclick={() => (this.previewWidth = 'side')}><i className="fas fa-columns"></i></button>
            <button className={this.previewWidth === 'wide' ? 'is-active' : ''} title="Geniş alan" onclick={() => (this.previewWidth = 'wide')}><i className="fas fa-expand"></i></button>
          </div>
        </div>
        <div className={'FSA-Preview-Frame FSA-Preview-Frame--' + this.previewWidth}>
          {this.cfg.showTitle ? (
            <div className="FSA-Preview-Title">
              <i className="fas fa-chart-bar"></i> {this.cfg.title || 'Forum İstatistikleri'}
            </div>
          ) : null}
          {this.stats ? <StatsView stats={this.stats} config={this.cfg} preview={true} key={JSON.stringify(this.cfg)} /> : <LoadingIndicator />}
        </div>
        <small className="FSA-Note">Önizleme gerçek verilerle çizilir; ziyaretçinin izni olmayan istatistikler forumda gösterilmez.</small>
      </div>
    );
  }

  viewMetrics() {
    const list = this.cfg.metrics;
    return this.card(
      'fas fa-list-ol',
      'İstatistikler',
      'Gösterilecek istatistikleri seçin, sürükleyerek sıralayın; adlarını ve ikonlarını değiştirebilirsiniz.',
      <div className="FSA-Metrics">
        {list.map((mc, i) => {
          const def = metricDef(mc.key)!;
          const open = this.expanded === mc.key;
          return (
            <div
              className={'FSA-Metric' + (mc.enabled ? '' : ' is-off') + (this.dragIndex === i ? ' is-dragging' : '')}
              key={mc.key}
              draggable="true"
              ondragstart={(e: DragEvent) => {
                this.dragIndex = i;
                e.dataTransfer!.effectAllowed = 'move';
              }}
              ondragover={(e: DragEvent) => e.preventDefault()}
              ondrop={(e: DragEvent) => {
                e.preventDefault();
                if (this.dragIndex !== null) this.move(this.dragIndex, i);
                this.dragIndex = null;
              }}
              ondragend={() => (this.dragIndex = null)}
            >
              <div className="FSA-Metric-Head">
                <span className="FSA-Grip"><i className="fas fa-grip-vertical"></i></span>
                <span className="FSA-Metric-Icon"><i className={mc.icon || def.icon}></i></span>
                <div className="FSA-Metric-Title">
                  <strong>{mc.label || def.label}</strong>
                  <small>{def.kind === 'person' ? 'Kişi kartı' : 'Sayı'}{this.stats ? ' · ' + this.sample(mc.key) : ''}</small>
                </div>
                <Switch state={mc.enabled} onchange={(v: boolean) => { mc.enabled = v; this.save(); }} />
                <div className="FSA-Order">
                  <button disabled={i === 0} onclick={() => this.move(i, i - 1)}><i className="fas fa-chevron-up"></i></button>
                  <button disabled={i === list.length - 1} onclick={() => this.move(i, i + 1)}><i className="fas fa-chevron-down"></i></button>
                </div>
                <button className="FSA-Edit" title="Düzenle" onclick={() => (this.expanded = open ? null : mc.key)}>
                  <i className={open ? 'fas fa-chevron-up' : 'fas fa-pen'}></i>
                </button>
              </div>
              {open ? (
                <div className="FSA-Metric-Body">
                  <label>
                    Görünen ad
                    <input className="FormControl" placeholder={def.label} value={mc.label || ''} oninput={(e: any) => { mc.label = e.target.value; this.save(); }} />
                  </label>
                  <label>
                    İkon (Font Awesome)
                    <div className="FSA-IconInput">
                      <span><i className={mc.icon || def.icon}></i></span>
                      <input className="FormControl" placeholder={def.icon} value={mc.icon || ''} oninput={(e: any) => { mc.icon = e.target.value.trim(); this.save(); }} />
                    </div>
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  /** Listede istatistiğin şu anki değeri */
  sample(key: string): string {
    const def = metricDef(key);
    if (!def || !this.stats) return '';
    if (def.kind === 'person') {
      const p = this.stats[key];
      return p ? p.displayName || p.username : 'veri yok';
    }
    const v = def.value ? def.value(this.stats) : null;
    return v === null || v === undefined ? 'veri yok' : Number(v).toLocaleString('tr-TR');
  }

  viewAppearance() {
    const c = this.cfg;
    return this.card(
      'fas fa-palette',
      'Görünüm ve Yerleşim',
      'Widget\'ın başlığı, düzeni, sayı biçimi, rengi ve sayfadaki yeri.',
      <div className="FSA-Rows">
        {this.row('Başlık', null, <input className="FormControl" value={c.title} placeholder="Forum İstatistikleri" oninput={(e: any) => this.set('title', e.target.value)} />)}
        {this.row('Başlığı göster', null, <Switch state={c.showTitle} onchange={(v: boolean) => this.set('showTitle', v)} />)}
        {this.row('Düzen', null, (
          <div className="FSA-Seg FSA-Seg--wide">
            {[['tiles', 'fas fa-th-large', 'Kutucuk'], ['list', 'fas fa-list', 'Liste'], ['compact', 'fas fa-grip-lines', 'Kompakt']].map(([k, icon, t]) => (
              <button className={c.layout === k ? 'is-active' : ''} onclick={() => this.set('layout', k)}><i className={icon}></i> {t}</button>
            ))}
          </div>
        ))}
        {c.layout === 'tiles' ? this.row('Sütun sayısı', null, Select.component({ options: { 1: '1 sütun', 2: '2 sütun', 3: '3 sütun' }, value: String(c.columns), onchange: (v: string) => this.set('columns', Number(v)) })) : null}
        {this.row('Sayı biçimi', 'Kısa biçimde tam sayı, üzerine gelince görünür.', Select.component({ options: { short: 'Kısa (12,4B)', full: 'Tam (12.400)' }, value: c.format, onchange: (v: string) => this.set('format', v) }))}
        {this.row('Vurgu rengi', 'İkonlar ve kişi kartları; boşsa temanın ana rengi.', (
          <div className="FSA-Color">
            <input type="color" value={c.accent || '#555555'} oninput={(e: any) => this.set('accent', e.target.value)} />
            <input className="FormControl" placeholder="Tema rengi" value={c.accent} oninput={(e: any) => this.set('accent', e.target.value.trim())} />
            {c.accent ? <button className="FSA-Clear" title="Tema rengine dön" onclick={() => this.set('accent', '')}><i className="fas fa-undo"></i></button> : null}
          </div>
        ))}
        {this.row('Günlük değişim rozeti', 'Sayının köşesinde "bugün +8" rozeti.', <Switch state={c.showDelta} onchange={(v: boolean) => this.set('showDelta', v)} />)}
        {this.row('Sayma animasyonu', 'Sayfa açılınca sayılar sıfırdan sayarak gelir.', <Switch state={c.animate} onchange={(v: boolean) => this.set('animate', v)} />)}
        {this.row('Tıklanabilir istatistikler', 'Tartışmalar, Fotoğraflar, Üyeler, Kategoriler ilgili sayfaya gider.', <Switch state={c.linkable} onchange={(v: boolean) => this.set('linkable', v)} />)}
        {this.row('Sayfadaki yeri', null, Select.component({ options: PLACEMENTS, value: c.placement, onchange: (v: string) => this.set('placement', v) }))}
      </div>
    );
  }

  viewCounting() {
    return this.card(
      'fas fa-calculator',
      'Sayım Kuralları',
      'Sayılara nelerin dahil edileceği.',
      <div className="FSA-Rows">
        {this.row('Gizlenmiş/silinmiş içerikleri sayma', 'Gizlenen konu ve mesajlar sayılmaz.', this.flag('exclude_hidden', true))}
        {this.row('Özel tartışmaları sayma', 'Özel tartışmalar ve içindeki mesajlar sayılmaz.', this.flag('exclude_private', true))}
        {this.row('Onaylanmamış hesapları sayma', 'E-postasını onaylamamış üyeler sayılmaz.', this.flag('exclude_unconfirmed', true))}
        {this.row('Askıdaki hesapları sayma', null, this.flag('exclude_suspended', false))}
      </div>
    );
  }

  viewCache() {
    const s = this.stats;
    return this.card(
      'fas fa-database',
      'Önbellek ve Veri',
      'Sayılar önbellekte tutulur; yeni konu, mesaj ya da üye olunca kendiliğinden yenilenir.',
      <div className="FSA-Rows">
        {this.row('Önbellek süresi (saniye)', '0 = önbellek yok (önerilmez).', <input className="FormControl FSA-Num" type="number" min="0" bidi={this.setting('framio-stats.cache_duration', '600')} />)}
        {this.row('Çevrimiçi sayılma süresi (dakika)', 'Son bu kadar dakikada görülen üyeler çevrimiçi sayılır.', <input className="FormControl FSA-Num" type="number" min="1" bidi={this.setting('framio-stats.online_minutes', '5')} />)}
        {this.row('Fotoğraf tablosu', 'Fotoğraf sayısının alındığı tablo (öneksiz). Tablo yoksa fotoğraf istatistiği gösterilmez.', <input className="FormControl" bidi={this.setting('framio-stats.photo_table', 'spotter_images')} />)}
        <div className="FSA-Cache">
          <div>
            <strong>Son hesaplanma:</strong> {s && s.computedAt ? humanTime(new Date(s.computedAt)) : '—'}
            {s && s.online ? <span className="FSA-Cache-Note"> · çevrimiçi rekoru {s.online.record} ({s.online.recordAt ? new Date(s.online.recordAt).toLocaleDateString('tr-TR') : '—'})</span> : null}
          </div>
          {Button.component({ className: 'Button', icon: 'fas fa-sync-alt', loading: this.refreshing, onclick: () => this.loadStats(true) }, 'Şimdi Yenile')}
        </div>
      </div>
    );
  }
}

