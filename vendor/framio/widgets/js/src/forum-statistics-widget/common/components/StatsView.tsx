import app from 'flarum/common/app';
import Component from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import humanTime from 'flarum/common/utils/humanTime';
import type Mithril from 'mithril';
import { StatsConfig, metricDef, formatValue } from '../metrics';

export interface StatsViewAttrs {
  stats: any;
  config: StatsConfig;
  /** Admin önizlemesinde bağlantılar tıklanmaz */
  preview?: boolean;
  /** Çevrimiçi satırında gösterilecek üyeler */
  onlineUsers?: Array<{ avatarUrl: string | null; displayName: string }>;
  /** "Tüm istatistikler" sayfası (izni olanlara) */
  moreHref?: string | null;
}

/**
 * İstatistiklerin görünümü (forum widget'ı ve admin önizlemesi ortak kullanır).
 * Düzenler: tiles (kutucuk ızgara), list (satır satır), compact (tek satır).
 */
export default class StatsView extends Component<StatsViewAttrs> {
  view() {
    const { stats, config: c } = this.attrs;
    if (!stats) return null;

    const numbers: Mithril.Children[] = [];
    const people: Mithril.Children[] = [];

    c.metrics.forEach((m) => {
      if (!m.enabled) return;
      const def = metricDef(m.key);
      if (!def) return;
      const label = m.label || def.label;
      const icon = m.icon || def.icon;

      if (def.kind === 'person') {
        const p = stats[m.key];
        if (p) people.push(this.person(m.key, p, label, icon));
        return;
      }

      const value = def.value ? def.value(stats) : null;
      if (value === null || value === undefined) return;
      const delta = c.showDelta && def.delta ? def.delta(stats) : 0;
      const href = c.linkable && def.href ? def.href() : null;
      const note = def.note ? def.note(stats) : null;
      numbers.push(this.number(m.key, value, label, icon, delta || 0, href, note));
    });

    if (!numbers.length && !people.length) return null;

    const style: any = {};
    if (c.accent) style['--fstats-accent'] = c.accent;

    return (
      <div className={`FStats FStats--${c.layout} FStats--cols-${c.columns}`} style={style}>
        {numbers.length ? <div className="FStats-numbers">{numbers}</div> : null}
        {people.length ? <div className="FStats-people">{people}</div> : null}
        {this.attrs.moreHref && !this.attrs.preview ? (
          <Link className="FStats-more" href={this.attrs.moreHref}>
            <span>Tüm istatistikler</span>
            <i className="fas fa-arrow-right" aria-hidden="true"></i>
          </Link>
        ) : null}
      </div>
    );
  }

  number(key: string, value: number, label: string, icon: string, delta: number, href: string | null, note: string | null) {
    const c = this.attrs.config;
    const inner = [
      <span className={'FStats-icon' + (key === 'online' ? ' is-live' : '')}>
        <i className={icon} aria-hidden="true"></i>
      </span>,
      <span className="FStats-body">
        <span className="FStats-value" title={value.toLocaleString('tr-TR')} data-count={c.animate ? String(value) : undefined} data-format={c.format}>
          {formatValue(value, c.format)}
        </span>
        <span className="FStats-label">{label}</span>
        {note ? <span className="FStats-note">{note}</span> : null}
      </span>,
      delta > 0 ? (
        <span className="FStats-delta" title="Bugün">
          +{formatValue(delta, c.format)}
        </span>
      ) : null,
    ];

    // Çevrimiçi: üyelerin avatarları (satırın tamamını kaplar)
    const faces = key === 'online' ? (this.attrs.onlineUsers || []).slice(0, 6) : [];
    if (faces.length) {
      const more = value - faces.length;
      inner.push(
        <span className="FStats-faces">
          {faces.map((u) =>
            u.avatarUrl ? (
              <img src={u.avatarUrl} alt="" title={u.displayName} loading="lazy" />
            ) : (
              <span className="is-letter" title={u.displayName}>{(u.displayName || '?').charAt(0).toLocaleUpperCase('tr-TR')}</span>
            )
          )}
          {more > 0 ? <span className="is-more">+{more}</span> : null}
        </span>
      );
    }
    const cls = 'FStats-item FStats-item--' + key + (faces.length ? ' FStats-item--wide' : '');

    return href && !this.attrs.preview ? (
      <Link className={cls} href={href} key={key}>
        {inner}
      </Link>
    ) : (
      <div className={cls} key={key}>
        {inner}
      </div>
    );
  }

  person(key: string, p: any, label: string, icon: string) {
    const name = p.displayName || p.username;
    const sub =
      key === 'latestUser'
        ? p.joinedAt
          ? [humanTime(new Date(p.joinedAt)), ' katıldı']
          : null
        : p.count
        ? `bu hafta ${p.count.toLocaleString('tr-TR')} mesaj`
        : null;
    const href = !this.attrs.preview && p.username ? app.route('user', { username: p.username }) : null;
    const avatar = p.avatar ? (
      <img className="FStats-avatar" src={p.avatar} alt="" loading="lazy" />
    ) : (
      <span className="FStats-avatar is-letter">{(name || '?').charAt(0).toLocaleUpperCase('tr-TR')}</span>
    );

    const inner = [
      avatar,
      <span className="FStats-person-body">
        <span className="FStats-person-label">
          <i className={icon} aria-hidden="true"></i> {label}
        </span>
        <span className="FStats-person-name">{name}</span>
        {sub ? <span className="FStats-person-sub">{sub}</span> : null}
      </span>,
    ];

    return href ? (
      <Link className={'FStats-person FStats-person--' + key} href={href} key={key}>
        {inner}
      </Link>
    ) : (
      <div className={'FStats-person FStats-person--' + key} key={key}>
        {inner}
      </div>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<StatsViewAttrs, this>) {
    super.oncreate(vnode);
    this.countUp();
  }

  /** Sayılar sayfa açılınca sıfırdan yumuşakça sayarak gelir (yalnızca ilk çizimde) */
  countUp() {
    if (!this.attrs.config.animate || !this.element) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = Array.from(this.element.querySelectorAll<HTMLElement>('.FStats-value[data-count]'));
    const duration = 900;
    const start = performance.now();
    const targets = els.map((el) => ({ el, to: Number(el.dataset.count) || 0, fmt: (el.dataset.format as any) || 'short' }));
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const ease = 1 - Math.pow(1 - k, 3);
      targets.forEach(({ el, to, fmt }) => {
        el.textContent = formatValue(Math.round(to * ease), fmt);
      });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // Sekme arka plandaysa rAF çalışmaz; son değer yine de yazılsın
    setTimeout(() => targets.forEach(({ el, to, fmt }) => (el.textContent = formatValue(to, fmt))), duration + 200);
  }
}
