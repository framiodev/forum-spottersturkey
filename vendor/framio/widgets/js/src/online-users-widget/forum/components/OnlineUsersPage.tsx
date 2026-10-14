import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Link from 'flarum/common/components/Link';
import humanTime from 'flarum/common/utils/humanTime';
import type Mithril from 'mithril';
import { live, loadOnline, onlinePageUrl, type OnlineRow } from '../../common/onlineLive';

type Filter = 'all' | 'writing' | 'reading' | 'browsing';

/**
 * /cevrimici — çevrimiçi üyelerin tamamı ve şu an ne yaptıkları.
 * 20 saniyede bir kendiliğinden yenilenir.
 */
export default class OnlineUsersPage extends Page {
  timer: number | null = null;
  filter: Filter = 'all';

  oninit(vnode: Mithril.Vnode) {
    super.oninit(vnode);
    app.setTitle('Şu an çevrimiçi');
    app.setTitleCount(0);
    loadOnline(100, true);
  }

  oncreate(vnode: Mithril.VnodeDOM) {
    super.oncreate(vnode);
    this.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadOnline(100, true);
    }, 20000);
  }

  onremove(vnode: Mithril.VnodeDOM) {
    super.onremove(vnode);
    if (this.timer) window.clearInterval(this.timer);
  }

  kind(r: OnlineRow): Filter {
    const t = (r.activity && r.activity.type) || '';
    if (r.activity && r.activity.writing) return 'writing';
    if (t === 'discussion' || t === 'profile') return 'reading';
    return 'browsing';
  }

  view() {
    return (
      <PageStructure className="FramioOnlinePage" sidebar={() => <IndexSidebar />}>
        {this.content()}
      </PageStructure>
    );
  }

  content() {
    if (!app.forum.attribute('canViewOnlineUsersWidget')) {
      return <div className="FramioOnlinePage-empty">Çevrimiçi üyeleri görme izniniz yok.</div>;
    }
    if (live.rows === null) return <LoadingIndicator />;

    const rows = live.rows;
    const counts = { all: rows.length, writing: 0, reading: 0, browsing: 0 } as Record<Filter, number>;
    rows.forEach((r) => counts[this.kind(r)]++);
    const list = this.filter === 'all' ? rows : rows.filter((r) => this.kind(r) === this.filter);

    const tab = (key: Filter, icon: string, label: string) => (
      <button className={'FramioOnlinePage-tab' + (this.filter === key ? ' is-active' : '')} onclick={() => (this.filter = key)}>
        <i className={icon} aria-hidden="true"></i> {label} <span>{counts[key]}</span>
      </button>
    );

    return (
      <div className="FramioOnlinePage-body">
        <header className="FramioOnlinePage-head">
          <div>
            <h2>
              <span className="FramioOnlinePage-live"></span> Şu an çevrimiçi
            </h2>
            <p>
              {live.total} üye çevrimiçi{live.total > rows.length ? ` (ilk ${rows.length} gösteriliyor)` : ''} · her 20 saniyede bir yenilenir
            </p>
          </div>
          <button className="Button" onclick={() => loadOnline(100, true)} disabled={live.loading}>
            <i className={'fas fa-sync-alt' + (live.loading ? ' fa-spin' : '')}></i> Yenile
          </button>
        </header>

        {live.canViewActivity ? (
          <div className="FramioOnlinePage-tabs">
            {tab('all', 'fas fa-users', 'Tümü')}
            {tab('writing', 'fas fa-pen', 'Yazıyor')}
            {tab('reading', 'far fa-eye', 'Okuyor')}
            {tab('browsing', 'fas fa-compass', 'Geziniyor')}
          </div>
        ) : null}

        {list.length ? (
          <div className="FramioOnlinePage-grid">{list.map((r) => this.card(r))}</div>
        ) : (
          <div className="FramioOnlinePage-empty">Bu grupta şu an kimse yok.</div>
        )}
      </div>
    );
  }

  card(r: OnlineRow) {
    const a = r.activity;
    return (
      <div className={'FramioOnlinePage-card' + (a && a.writing ? ' is-writing' : '')} key={r.id}>
        <Link href={app.route('user', { username: r.username })} className="FramioOnlinePage-who">
          <span className="Framio-Online-avatarWrap">
            {r.avatarUrl ? (
              <img className="Framio-Online-avatar" src={r.avatarUrl} alt="" loading="lazy" />
            ) : (
              <span className="Framio-Online-avatar is-letter">{(r.displayName || '?').charAt(0).toLocaleUpperCase('tr-TR')}</span>
            )}
            <span className="Framio-Online-dot"></span>
          </span>
          <span className="FramioOnlinePage-name">
            {r.displayName}
            {r.isMe ? <em> (sen)</em> : null}
          </span>
        </Link>
        <div className="FramioOnlinePage-activity">
          {a ? (
            <>
              <span className="FramioOnlinePage-icon">
                <i className={a.icon} aria-hidden="true"></i>
              </span>
              <span className="FramioOnlinePage-text">
                {a.subject ? (
                  <>
                    {a.href ? <Link href={a.href}>{a.subject}</Link> : <strong>{a.subject}</strong>} {a.text}
                  </>
                ) : a.href ? (
                  <Link href={a.href}>{a.text}</Link>
                ) : (
                  a.text
                )}
                {a.writing ? (
                  <span className="Framio-Online-typing" aria-hidden="true">
                    <i></i>
                    <i></i>
                    <i></i>
                  </span>
                ) : null}
              </span>
            </>
          ) : (
            <span className="FramioOnlinePage-text is-muted">Çevrimiçi</span>
          )}
        </div>
        <div className="FramioOnlinePage-time">
          <i className="far fa-clock" aria-hidden="true"></i> {a && a.since ? humanTime(new Date(a.since)) : r.lastSeenAt ? humanTime(new Date(r.lastSeenAt)) : 'az önce'}
        </div>
      </div>
    );
  }
}

export { onlinePageUrl };
