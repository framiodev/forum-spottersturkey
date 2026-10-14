import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Link from 'flarum/common/components/Link';
import type Mithril from 'mithril';
import StatsView from '../../common/components/StatsView';
import { readConfig } from '../../common/metrics';
import humanTime from 'flarum/common/utils/humanTime';
import { memberRows, membersPageUrl } from '../../common/components/NewMembersWidget';

const SERIES: Array<[string, string, string]> = [
  ['posts', 'Mesaj', 'fas fa-comment-dots'],
  ['discussions', 'Tartışma', 'fas fa-comments'],
  ['photos', 'Fotoğraf', 'fas fa-camera'],
  ['users', 'Yeni üye', 'fas fa-user-plus'],
  ['views', 'Görüntülenme', 'far fa-eye'],
  ['visitors', 'Tekil ziyaretçi', 'fas fa-users'],
];

function fmtDate(d: string, long = false): string {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' });
  } catch (e) {
    return d;
  }
}

/**
 * /istatistikler — ayrıntılı forum istatistikleri (izin: framio-stats.viewPage).
 */
export default class StatsPage extends Page {
  data: any = null;
  loading = false;
  days = 30;
  series = 'posts';
  hover: number | null = null;
  allTime = false;
  denied = false;
  /** Çevrimiçi üyeler (Çevrimiçi kartından bağımsız olarak bu sayfa kendisi alır) */
  online: any = null;

  oninit(vnode: Mithril.Vnode) {
    super.oninit(vnode);
    app.setTitle('Forum İstatistikleri');
    app.setTitleCount(0);
    this.load();
  }

  load() {
    if (!app.forum.attribute('framioCanViewStatsPage')) {
      this.denied = true;
      return;
    }
    this.loading = true;
    app
      .request<any>({ method: 'GET', url: app.forum.attribute('apiUrl') + '/framio-stats/detail', params: { days: this.days }, errorHandler: () => {} } as any)
      .then((res) => (this.data = res))
      .then(() => this.loadOnline())
      .catch(() => (this.denied = true))
      .then(() => {
        this.loading = false;
        m.redraw();
      });
  }

  loadOnline() {
    if (!app.forum.attribute('canViewOnlineUsersWidget')) return;
    return app
      .request<any>({ method: 'GET', url: app.forum.attribute('apiUrl') + '/framio-activity/online', params: { limit: 12 }, errorHandler: () => {} } as any)
      .then((res) => (this.online = res))
      .catch(() => {});
  }

  view() {
    return (
      <PageStructure className="FramioStatsPage" sidebar={() => <IndexSidebar />}>
        {this.content()}
      </PageStructure>
    );
  }

  content() {
    if (this.denied) return <div className="FramioStatsPage-empty"><i className="fas fa-lock"></i> Forum istatistiklerini görme izniniz yok.</div>;
    if (!this.data) return <LoadingIndicator />;
    const d = this.data;

    return (
      <div className="FramioStatsPage-body">
        <header className="FramioStatsPage-head">
          <div>
            <h2><i className="fas fa-chart-line"></i> Forum İstatistikleri</h2>
            <p>Son {d.days} gün · {fmtDate(d.daily.dates[0], true)} – {fmtDate(d.daily.dates[d.daily.dates.length - 1], true)}</p>
          </div>
          <div className="FramioStatsPage-seg">
            {[7, 30, 90].map((n) => (
              <button className={this.days === n ? 'is-active' : ''} disabled={this.loading} onclick={() => { this.days = n; this.load(); }}>
                {n} gün
              </button>
            ))}
          </div>
        </header>

        <section className="FramioStatsPage-card">
          <StatsView stats={d.summary} config={{ ...readConfig(app.forum.attribute('framioStatsConfig')), layout: 'tiles', columns: 3, animate: false }} />
        </section>

        <div className="FramioStatsPage-grid">
          {this.viewOnline()}
          {this.viewMembers(d)}
        </div>

        {this.viewChart(d)}

        <div className="FramioStatsPage-kpis">
          {this.kpi('fas fa-user-check', d.visitors.members, 'Okuyan üye')}
          {this.kpi('fas fa-user-secret', d.visitors.guestVisits, 'Ziyaretçi (günlük tekil)')}
          {this.kpi('far fa-eye', d.visitors.discussionViews, 'Tartışma görüntülenmesi')}
          {this.kpi('fas fa-align-left', d.visitors.postViews, 'Mesaj okunması')}
        </div>

        <div className="FramioStatsPage-grid">
          {this.listCard(
            'far fa-eye',
            'En çok görüntülenen tartışmalar',
            (this.allTime ? d.topViewedAllTime : d.topViewed).map((t: any) => ({ href: t.url, title: t.title, sub: `${t.comments} mesaj`, count: t.count })),
            'görüntülenme',
            <div className="FramioStatsPage-seg is-small">
              <button className={!this.allTime ? 'is-active' : ''} onclick={() => (this.allTime = false)}>{d.days} gün</button>
              <button className={this.allTime ? 'is-active' : ''} onclick={() => (this.allTime = true)}>Tüm zamanlar</button>
            </div>
          )}
          {this.listCard('fas fa-align-left', 'En çok okunan mesajlar', d.topPosts.map((p: any) => ({ href: p.url, title: `${p.title} · #${p.number}`, sub: p.author || '', count: p.count })), 'okunma')}
          {this.listCard('fas fa-pen-nib', 'En çok yazanlar', d.topPosters.map((u: any) => ({ href: u.url, title: u.displayName, avatar: u.avatarUrl, count: u.count })), 'mesaj')}
          {this.listCard('fas fa-tags', 'En hareketli kategoriler', d.topTags.map((t: any) => ({ href: t.url, title: t.name, icon: t.icon, color: t.color, count: t.count })), 'mesaj')}
        </div>
      </div>
    );
  }

  /** Şu an çevrimiçi (ne yaptıklarıyla) */
  viewOnline() {
    const o = this.online;
    let url: string | null = null;
    try {
      url = app.route('framio.online');
    } catch (e) {}
    if (!o) return null;
    const rows: any[] = o.data || [];

    return (
      <section className="FramioStatsPage-card FramioStatsPage-list">
        <header>
          <h3><span className="FramioStatsPage-live"></span> Şu an çevrimiçi · {o.meta ? o.meta.total : rows.length}</h3>
          {url ? <Link href={url} className="FramioStatsPage-link">Tümü <i className="fas fa-arrow-right"></i></Link> : null}
        </header>
        {rows.length ? (
          <div className="FramioStatsPage-people">
            {rows.slice(0, 8).map((r) => {
              const a = r.activity;
              return (
                <Link href={app.route('user', { username: r.username })} className="FStats-member">
                  {r.avatarUrl ? <img className="FStats-member-avatar" src={r.avatarUrl} alt="" /> : <span className="FStats-member-avatar is-letter">{(r.displayName || '?').charAt(0)}</span>}
                  <span className="FStats-member-body">
                    <span className="FStats-member-name">{r.displayName}</span>
                    <span className="FStats-member-sub">
                      {a ? <i className={a.icon} aria-hidden="true"></i> : <i className="fas fa-circle is-online" aria-hidden="true"></i>}{' '}
                      {a ? (a.subject ? `${a.subject} ${a.text}` : a.text) : 'Çevrimiçi'}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="FramioStatsPage-empty is-small">Şu an çevrimiçi kimse yok.</div>
        )}
      </section>
    );
  }

  /** Aramıza son katılanlar */
  viewMembers(d: any) {
    const members: any[] = (d.summary && d.summary.newMembers) || [];
    if (!members.length) return null;
    const url = membersPageUrl();

    return (
      <section className="FramioStatsPage-card FramioStatsPage-list">
        <header>
          <h3><i className="fas fa-user-plus"></i> Aramıza son katılanlar</h3>
          {url ? <Link href={url} className="FramioStatsPage-link">Tüm üyeler <i className="fas fa-arrow-right"></i></Link> : null}
        </header>
        <div className="FramioStatsPage-people">{memberRows(members, 8)}</div>
      </section>
    );
  }

  kpi(icon: string, value: number, label: string) {
    return (
      <div className="FramioStatsPage-kpi">
        <span className="FramioStatsPage-kpi-icon"><i className={icon}></i></span>
        <span className="FramioStatsPage-kpi-value">{Number(value || 0).toLocaleString('tr-TR')}</span>
        <span className="FramioStatsPage-kpi-label">{label}</span>
      </div>
    );
  }

  viewChart(d: any) {
    const available = SERIES.filter(([k]) => Array.isArray(d.daily[k]));
    const key = available.some(([k]) => k === this.series) ? this.series : available[0][0];
    const values: number[] = d.daily[key];
    const dates: string[] = d.daily.dates;
    const max = Math.max(1, ...values);
    const total = values.reduce((a, b) => a + b, 0);
    const W = 720;
    const H = 180;
    const gap = values.length > 40 ? 1 : 3;
    const bw = W / values.length - gap;
    const label = (SERIES.find(([k]) => k === key) || [])[1];
    const h = this.hover;

    return (
      <section className="FramioStatsPage-card FramioStatsPage-chartCard">
        <div className="FramioStatsPage-chartHead">
          <div className="FramioStatsPage-tabs">
            {available.map(([k, l, icon]) => (
              <button className={key === k ? 'is-active' : ''} onclick={() => (this.series = k)}>
                <i className={icon}></i> {l}
              </button>
            ))}
          </div>
          <div className="FramioStatsPage-chartTotal">
            <strong>{total.toLocaleString('tr-TR')}</strong> {label} · günlük ort. {(total / values.length).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
          </div>
        </div>
        <div className="FramioStatsPage-chart">
          <svg viewBox={`0 0 ${W} ${H + 22}`} preserveAspectRatio="none" onmouseleave={() => (this.hover = null)}>
            {[0.25, 0.5, 0.75, 1].map((p) => (
              <line x1="0" x2={W} y1={H - H * p} y2={H - H * p} className="FramioStatsPage-grid-line" />
            ))}
            {values.map((v, i) => {
              const bh = v ? Math.max(2, (v / max) * (H - 6)) : 0;
              const x = i * (bw + gap);
              return (
                <g onmouseenter={() => (this.hover = i)}>
                  <rect x={x} y={0} width={bw + gap} height={H} fill="transparent" />
                  <rect x={x} y={H - bh} width={bw} height={bh} rx={Math.min(3, bw / 2)} className={'FramioStatsPage-bar' + (h === i ? ' is-hover' : '')} />
                </g>
              );
            })}
            {dates.map((dt, i) =>
              i % Math.ceil(dates.length / 7) === 0 ? (
                <text x={i * (bw + gap) + bw / 2} y={H + 16} textAnchor="middle" className="FramioStatsPage-axis">{fmtDate(dt)}</text>
              ) : null
            )}
          </svg>
          {h !== null ? (
            <div className="FramioStatsPage-tip" style={{ left: `${((h + 0.5) / values.length) * 100}%` }}>
              <strong>{values[h].toLocaleString('tr-TR')}</strong> {label}
              <span>{fmtDate(dates[h], true)}</span>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  listCard(icon: string, title: string, rows: any[], unit: string, right?: Mithril.Children) {
    const max = Math.max(1, ...rows.map((r) => r.count));
    return (
      <section className="FramioStatsPage-card FramioStatsPage-list">
        <header>
          <h3><i className={icon}></i> {title}</h3>
          {right || null}
        </header>
        {rows.length ? (
          <ol>
            {rows.map((r, i) => (
              <li>
                <span className="FramioStatsPage-rank">{i + 1}</span>
                {r.avatar !== undefined ? (
                  r.avatar ? <img className="FramioStatsPage-avatar" src={r.avatar} alt="" loading="lazy" /> : <span className="FramioStatsPage-avatar is-letter">{(r.title || '?').charAt(0)}</span>
                ) : r.icon ? (
                  <span className="FramioStatsPage-tagIcon" style={{ color: r.color || undefined }}><i className={r.icon}></i></span>
                ) : null}
                <div className="FramioStatsPage-listMain">
                  <Link href={r.href}>{r.title}</Link>
                  {r.sub ? <small>{r.sub}</small> : null}
                  <span className="FramioStatsPage-meter"><i style={{ width: `${(r.count / max) * 100}%`, background: r.color || undefined }}></i></span>
                </div>
                <span className="FramioStatsPage-count" title={`${r.count} ${unit}`}>{r.count.toLocaleString('tr-TR')}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="FramioStatsPage-empty is-small">Bu dönemde veri yok.</div>
        )}
      </section>
    );
  }
}
