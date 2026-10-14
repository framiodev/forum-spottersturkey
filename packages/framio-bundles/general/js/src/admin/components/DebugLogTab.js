import app from 'flarum/admin/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Switch from 'flarum/common/components/Switch';
import saveSettings from 'flarum/admin/utils/saveSettings';

const SEVERITY = {
  critical: { label: 'Kritik', color: '#dc2626', icon: 'fas fa-skull-crossbones' },
  error: { label: 'Hata', color: '#ea580c', icon: 'fas fa-bug' },
  warning: { label: 'Uyarı', color: '#ca8a04', icon: 'fas fa-exclamation-triangle' },
  notice: { label: 'Bilgi', color: '#2563eb', icon: 'fas fa-info-circle' },
};
const ORIGIN = { server: 'Sunucu (PHP)', client: 'Tarayıcı (JS)', log: 'Log dosyası' };
const FRONTEND = { forum: 'Forum', admin: 'Admin', api: 'API', console: 'Konsol' };

// Sunucu UTC kaydeder; yerel saate çevir
const fmt = (d) => (d ? new Date(String(d).replace(' ', 'T') + (/[Z+]/.test(String(d)) ? '' : 'Z')).toLocaleString('tr-TR') : '');

/**
 * Hata Günlüğü & Debug: debug modu kapalıyken toplanan hataları önem,
 * kaynak eklenti ve forum bölümüne göre raporlar; yapay zekâya
 * yapıştırmaya hazır özet ve tam rapor üretir.
 */
export default class DebugLogTab extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.loading = true;
    this.summary = null;
    this.rows = [];
    this.filters = { severity: '', origin: '', source: '', q: '' };
    this.open = {}; // id → tam kayıt
    this.busy = false;
    this.load();
  }

  api(method, path = '', body, params) {
    return app.request({ method, url: app.forum.attribute('apiUrl') + '/framio/debug-logs' + path, body, params });
  }

  load() {
    this.loading = true;
    const params = {};
    Object.keys(this.filters).forEach((k) => this.filters[k] && (params[k] = this.filters[k]));
    this.api('GET', '', undefined, params)
      .then((res) => {
        this.summary = res.summary;
        this.rows = res.data || [];
      })
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  action(action, extra = {}, confirmText) {
    if (confirmText && !confirm(confirmText)) return;
    this.busy = true;
    this.api('POST', '', { action, ...extra })
      .then((res) => {
        if (action === 'import') app.alerts.show({ type: 'success' }, `${res.imported} log kaydı içe aktarıldı.`);
        this.load();
      })
      .finally(() => {
        this.busy = false;
        m.redraw();
      });
  }

  toggleRow(row) {
    if (this.open[row.id]) {
      delete this.open[row.id];
      return;
    }
    this.open[row.id] = 'loading';
    this.api('GET', '/' + row.id).then((res) => {
      this.open[row.id] = res.data;
      m.redraw();
    });
  }

  copy(text, label) {
    const done = () => app.alerts.show({ type: 'success' }, `${label} panoya kopyalandı.`);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done);
    } else {
      const t = document.createElement('textarea');
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
      done();
    }
  }

  // ─────────────────────────────── Kopyalanabilir raporlar

  siteLine() {
    return `Site: ${app.forum.attribute('title')} (${app.forum.attribute('baseUrl')}) · Flarum ${app.data.settings.version || app.forum.attribute('version') || ''}`;
  }

  summaryText() {
    const s = this.summary;
    const lines = [
      '# Flarum hata özeti',
      this.siteLine(),
      `Tarih: ${new Date().toLocaleString('tr-TR')}`,
      `Açık hata: ${s.total} (toplam ${s.occurrences} kez), son 24 saatte görülen: ${s.last24h}`,
      '',
      '## Önem derecesine göre',
      ...s.bySeverity.map((x) => `- ${(SEVERITY[x.severity] || {}).label || x.severity}: ${x.n} hata / ${x.c} kez`),
      '',
      '## Kaynağa (eklenti / çekirdek) göre',
      ...s.bySource.map((x) => `- ${x.title || x.source} [${x.source}]: ${x.n} hata / ${x.c} kez`),
      '',
      '## Hatalar (önem sırasıyla)',
      ...this.rows.map(
        (r, i) =>
          `${i + 1}. [${(SEVERITY[r.severity] || {}).label}] ${r.source_title || r.source} · ${ORIGIN[r.origin] || r.origin}${r.frontend ? ' · ' + (FRONTEND[r.frontend] || r.frontend) : ''}\n` +
          `   ${r.exception ? r.exception + ': ' : ''}${r.message}\n` +
          `   ${r.file ? r.file + (r.line ? ':' + r.line : '') : '(dosya yok)'} · ${r.count} kez · son: ${fmt(r.last_seen_at)}`
      ),
    ];
    return lines.join('\n');
  }

  fullText(d) {
    let ctx = d.context;
    try {
      ctx = JSON.stringify(JSON.parse(d.context), null, 2);
    } catch (e) {}
    return [
      `# Hata raporu #${d.id}`,
      this.siteLine(),
      `Önem: ${(SEVERITY[d.severity] || {}).label} · Köken: ${ORIGIN[d.origin] || d.origin}${d.frontend ? ' · Bölüm: ' + (FRONTEND[d.frontend] || d.frontend) : ''}`,
      `Kaynak: ${d.source_title || d.source} [${d.source}]`,
      `Tür: ${d.exception || '-'}`,
      `Mesaj: ${d.message}`,
      `Dosya: ${d.file || '-'}${d.line ? ':' + d.line : ''}`,
      `Adres: ${d.url || '-'}`,
      `Tekrar: ${d.count} kez · İlk: ${fmt(d.first_seen_at)} · Son: ${fmt(d.last_seen_at)}`,
      '',
      '## Bağlam',
      '```json',
      ctx || '-',
      '```',
      '',
      '## Yığın (stack trace)',
      '```',
      d.trace || '-',
      '```',
    ].join('\n');
  }

  async allFullText() {
    const parts = [this.summaryText(), ''];
    for (const r of this.rows.slice(0, 30)) {
      const d = typeof this.open[r.id] === 'object' ? this.open[r.id] : (await this.api('GET', '/' + r.id)).data;
      parts.push(this.fullText(d), '\n---\n');
    }
    return parts.join('\n');
  }

  // ─────────────────────────────── Görünüm

  settingToggle(key, label, help) {
    const val = app.data.settings[key] === undefined ? true : ['1', 'true', true, 1].includes(app.data.settings[key]);
    return (
      <div className="FDebug-SettingRow">
        <Switch
          state={val}
          onchange={(v) => {
            app.data.settings[key] = v ? '1' : '0';
            saveSettings({ [key]: v ? '1' : '0' });
          }}
        >
          <strong>{label}</strong>
        </Switch>
        <small>{help}</small>
      </div>
    );
  }

  viewSummary() {
    const s = this.summary;
    const sev = Object.fromEntries(s.bySeverity.map((x) => [x.severity, x]));
    const stat = (label, value, color, onclick) => (
      <button className={'FDebug-Stat' + (onclick ? ' is-clickable' : '')} style={color ? { '--c': color } : {}} onclick={onclick}>
        <span>{label}</span>
        <strong>{value}</strong>
      </button>
    );

    return (
      <div className="FDebug-Stats">
        {stat('Açık hata', s.total)}
        {stat('Toplam tekrar', s.occurrences)}
        {stat('Son 24 saat', s.last24h)}
        {Object.keys(SEVERITY).map((k) =>
          stat(SEVERITY[k].label, sev[k] ? sev[k].n : 0, SEVERITY[k].color, () => {
            this.filters.severity = this.filters.severity === k ? '' : k;
            this.load();
          })
        )}
      </div>
    );
  }

  viewSources() {
    const s = this.summary;
    if (!s.bySource.length) return null;
    const max = Math.max(...s.bySource.map((x) => Number(x.c)));
    return (
      <div className="FDebug-Card">
        <h4><i className="fas fa-puzzle-piece"></i> Kaynağa göre (eklenti / çekirdek)</h4>
        {s.bySource.map((x) => (
          <div className={'FDebug-SourceRow' + (this.filters.source === x.source ? ' is-active' : '')}
            onclick={() => { this.filters.source = this.filters.source === x.source ? '' : x.source; this.load(); }}>
            <span className="FDebug-SourceName">{x.title || x.source}<small>{x.source}</small></span>
            <span className="FDebug-Bar"><i style={{ width: (Number(x.c) / max) * 100 + '%' }}></i></span>
            <span className="FDebug-SourceCount">{x.n} hata · {x.c} kez</span>
          </div>
        ))}
      </div>
    );
  }

  viewRow(r) {
    const sv = SEVERITY[r.severity] || SEVERITY.error;
    const d = this.open[r.id];
    return (
      <div className={'FDebug-Row' + (d ? ' is-open' : '')} style={{ '--c': sv.color }}>
        <div className="FDebug-RowHead" onclick={() => this.toggleRow(r)}>
          <span className="FDebug-Badge"><i className={sv.icon}></i> {sv.label}</span>
          <div className="FDebug-RowMain">
            <div className="FDebug-Msg">{r.exception ? <b>{r.exception.split('\\').pop()}: </b> : null}{r.message}</div>
            <div className="FDebug-Meta">
              <span><i className="fas fa-puzzle-piece"></i> {r.source_title || r.source}</span>
              <span><i className="fas fa-server"></i> {ORIGIN[r.origin] || r.origin}{r.frontend ? ' · ' + (FRONTEND[r.frontend] || r.frontend) : ''}</span>
              {r.file ? <span><i className="far fa-file-code"></i> {r.file}{r.line ? ':' + r.line : ''}</span> : null}
            </div>
          </div>
          <div className="FDebug-RowSide">
            <strong>{r.count}×</strong>
            <small>{fmt(r.last_seen_at)}</small>
          </div>
        </div>

        {d ? (
          <div className="FDebug-Detail">
            {d === 'loading' ? <LoadingIndicator size="small" /> : [
              <div className="FDebug-DetailActions">
                <Button className="Button Button--primary" icon="fas fa-copy" onclick={() => this.copy(this.fullText(d), 'Tam rapor')}>Tam raporu kopyala (yapay zekâ için)</Button>
                <Button className="Button" icon="fas fa-check" onclick={() => this.action('resolve', { id: r.id })}>Çözüldü işaretle</Button>
                {r.url ? <a className="Button" href={r.url} target="_blank" rel="noopener"><i className="fas fa-external-link-alt"></i> Sayfayı aç</a> : null}
              </div>,
              <pre className="FDebug-Pre">{this.fullText(d)}</pre>,
            ]}
          </div>
        ) : null}
      </div>
    );
  }

  view() {
    return (
      <div className="FDebugLog container">
        <div className="FDebug-Intro">
          <div>
            <h3><i className="fas fa-bug"></i> Hata Günlüğü & Debug</h3>
            <p>Debug modu kapalıyken de forumdaki hatalar burada toplanır: sunucu (PHP) istisnaları, ziyaretçilerin tarayıcısındaki JS hataları ve Flarum log dosyaları. Her hata önem derecesi, sorumlu eklenti ve forumun hangi bölümünde çıktığıyla gruplanır.</p>
          </div>
          <div className="FDebug-Toolbar">
            <Button className="Button Button--primary" icon="fas fa-clipboard" disabled={!this.summary} onclick={() => this.copy(this.summaryText(), 'Özet rapor')}>Özeti kopyala</Button>
            <Button className="Button" icon="fas fa-file-alt" loading={this.copyingAll} disabled={!this.rows.length}
              onclick={async () => { this.copyingAll = true; m.redraw(); try { this.copy(await this.allFullText(), 'Tüm tam raporlar'); } finally { this.copyingAll = false; m.redraw(); } }}>
              Tümünü tam kopyala
            </Button>
            <Button className="Button" icon="fas fa-file-import" loading={this.busy} onclick={() => this.action('import')}>Log dosyalarını içe aktar</Button>
            <Button className="Button" icon="fas fa-sync" onclick={() => this.load()}>Yenile</Button>
          </div>
        </div>

        {this.loading && !this.summary ? <LoadingIndicator /> : this.summary ? [
          this.viewSummary(),

          <div className="FDebug-Layout">
            <div className="FDebug-ListCol">
              <div className="FDebug-Filters">
                <input className="FormControl" placeholder="Mesaj, dosya veya tür ara…" value={this.filters.q}
                  oninput={(e) => (this.filters.q = e.target.value)} onkeydown={(e) => e.key === 'Enter' && this.load()} />
                <select className="FormControl" value={this.filters.origin} onchange={(e) => { this.filters.origin = e.target.value; this.load(); }}>
                  <option value="">Tüm kökenler</option>
                  {Object.keys(ORIGIN).map((k) => <option value={k}>{ORIGIN[k]}</option>)}
                </select>
                {Object.values(this.filters).some(Boolean) ? (
                  <Button className="Button" icon="fas fa-times" onclick={() => { this.filters = { severity: '', origin: '', source: '', q: '' }; this.load(); }}>Filtreleri temizle</Button>
                ) : null}
              </div>

              {this.rows.length ? this.rows.map((r) => this.viewRow(r)) : (
                <div className="FDebug-Empty"><i className="fas fa-check-circle"></i> Açık hata yok. Harika!</div>
              )}
            </div>

            <div className="FDebug-SideCol">
              {this.viewSources()}
              <div className="FDebug-Card">
                <h4><i className="fas fa-cog"></i> Ayarlar</h4>
                {this.settingToggle('framio-general.debug_log_enabled', 'Hata toplama açık', 'Sunucu hataları günlüğe yazılır.')}
                {this.settingToggle('framio-general.debug_log_client', 'Tarayıcı (JS) hataları', 'Ziyaretçi ve admin tarayıcısındaki hatalar da toplanır.')}
                <div className="FDebug-SideActions">
                  <Button className="Button" icon="fas fa-vial" onclick={() => this.action('test')}>Test kaydı oluştur</Button>
                  <Button className="Button" icon="fas fa-broom" onclick={() => this.action('clear_resolved')}>Çözülenleri sil ({this.summary.resolved})</Button>
                  <Button className="Button Button--danger" icon="fas fa-trash" onclick={() => this.action('clear', {}, 'Bütün hata kayıtları silinsin mi?')}>Tümünü sil</Button>
                </div>
              </div>
            </div>
          </div>,
        ] : null}
      </div>
    );
  }
}
