import app from 'flarum/common/app';
import type Mithril from 'mithril';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Tooltip from 'flarum/common/components/Tooltip';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import type User from 'flarum/common/models/User';

import Widget, { type WidgetAttrs } from '../../../forum-widgets-core/common/components/Widget';
import onlineUsersState from '../onlineUsersState';
import { live, loadOnline, activityText, onlinePageUrl, type OnlineRow } from '../onlineLive';

/** Kartta en fazla bu kadar kişi; fazlası /cevrimici sayfasında */
const CARD_LIMIT = 4;

/**
 * Çevrimiçi kartı: istatistik kartıyla aynı tasarım dili. Kişi başına tek satır
 * (avatar · ad · ne yaptığı), ilk birkaç kişi; tamamı /cevrimici sayfasında.
 * Etkinliği görme izni olmayanlar yalnızca avatarları görür.
 */
export default class OnlineUsersWidget extends Widget<WidgetAttrs> {
  timer: number | null = null;

  className(): string {
    return 'FoF-OnlineUsersWidget Framio-OnlineWidget';
  }

  icon(): string {
    return 'fas fa-user-friends';
  }

  title(): string {
    const total = this.activityMode() ? live.total : app.forum.totalOnlineUsers() || 0;
    return 'Şu an çevrimiçi' + (total ? ` · ${total}` : '');
  }

  activityMode(): boolean {
    return !!app.forum.attribute('canViewUserActivity');
  }

  oncreate(vnode: Mithril.VnodeDOM) {
    super.oncreate(vnode);
    if (!this.activityMode()) return;
    loadOnline(0);
    this.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadOnline(0, true);
    }, 30000);
  }

  onremove(vnode: Mithril.VnodeDOM) {
    super.onremove(vnode);
    if (this.timer) window.clearInterval(this.timer);
  }

  content(): Mithril.Children {
    return this.activityMode() ? this.viewActivity() : this.viewAvatars();
  }

  avatar(r: OnlineRow) {
    return r.avatarUrl ? (
      <img className="Framio-Online-avatar" src={r.avatarUrl} alt="" loading="lazy" />
    ) : (
      <span className="Framio-Online-avatar is-letter">{(r.displayName || '?').charAt(0).toLocaleUpperCase('tr-TR')}</span>
    );
  }

  viewActivity(): Mithril.Children {
    if (live.rows === null) return <LoadingIndicator />;
    const rows = live.rows;
    if (!rows.length) return <div className="Framio-Online-empty">Şu an çevrimiçi kimse yok.</div>;

    const shown = rows.slice(0, CARD_LIMIT);
    const rest = Math.max(0, live.total - shown.length);

    return (
      <div className="Framio-Online Framio-Online--card">
        <div className="Framio-Online-list">
          {shown.map((r) => {
            const a = r.activity;
            const line = activityText(a);
            return (
              <Link
                href={a && a.href ? a.href : app.route('user', { username: r.username })}
                className={'Framio-Online-item' + (a && a.writing ? ' is-writing' : '')}
                title={`${r.displayName}: ${line}`}
                key={r.id}
              >
                <span className="Framio-Online-avatarWrap">
                  {this.avatar(r)}
                  <span className="Framio-Online-dot"></span>
                </span>
                <span className="Framio-Online-body">
                  <span className="Framio-Online-name">
                    {r.displayName}
                    {r.isMe ? <em> (sen)</em> : null}
                  </span>
                  <span className="Framio-Online-line">
                    {a ? <i className={a.icon} aria-hidden="true"></i> : null}
                    <span>{line}</span>
                    {a && a.writing ? (
                      <span className="Framio-Online-typing" aria-hidden="true">
                        <i></i>
                        <i></i>
                        <i></i>
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
        <Link href={onlinePageUrl()} className="Framio-Online-all">
          <span>{rest ? `+${rest} kişi daha · ` : ''}Tümünü gör</span>
          <i className="fas fa-arrow-right" aria-hidden="true"></i>
        </Link>
      </div>
    );
  }

  /** Etkinliği görme izni olmayanlar: avatarlar */
  viewAvatars(): Mithril.Children {
    const users: User[] = (app.forum.onlineUsers() || []).filter((u): u is User => u !== undefined);
    const total: number = app.forum.totalOnlineUsers() || 0;

    if (onlineUsersState.isLoading && users.length === 0) return <LoadingIndicator />;
    if (!users.length) return <div className="Framio-Online-empty">Şu an çevrimiçi kimse yok.</div>;

    return (
      <div className="FoF-OnlineUsersWidget-users">
        <div className="FoF-OnlineUsersWidget-users-list">
          {users.map((user: User) => (
            <Link href={app.route('user', { username: user.slug() })} className="FoF-OnlineUsersWidget-users-item">
              <Tooltip text={user.displayName()}>
                <span className="Framio-Online-avatarWrap">
                  <Avatar user={user} />
                  <span className="Framio-Online-dot"></span>
                </span>
              </Tooltip>
            </Link>
          ))}
          {total > users.length ? (
            <span className="FoF-OnlineUsersWidget-users-item FoF-OnlineUsersWidget-users-item--plus">
              <span className="Avatar">{`+${total - users.length}`}</span>
            </span>
          ) : null}
        </div>
      </div>
    );
  }
}
