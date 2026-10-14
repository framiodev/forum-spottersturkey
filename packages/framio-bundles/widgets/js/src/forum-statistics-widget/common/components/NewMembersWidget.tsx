import app from 'flarum/common/app';
import type Mithril from 'mithril';
import Link from 'flarum/common/components/Link';
import humanTime from 'flarum/common/utils/humanTime';
import Widget, { WidgetAttrs } from '../../../forum-widgets-core/common/components/Widget';

/** Kartta gösterilecek üye sayısı */
const LIMIT = 5;

export function membersPageUrl(): string | null {
  try {
    return (app as any).routes && (app as any).routes['fof_user_directory'] ? app.route('fof_user_directory', { sort: 'newest' }) : null;
  } catch (e) {
    return null;
  }
}

export function memberRows(members: any[], limit: number, onClick?: () => void): Mithril.Children {
  return members.slice(0, limit).map((u: any) => (
    <Link href={app.route('user', { username: u.username })} className="FStats-member" key={u.id} onclick={onClick}>
      {u.avatar ? (
        <img className="FStats-member-avatar" src={u.avatar} alt="" loading="lazy" />
      ) : (
        <span className="FStats-member-avatar is-letter">{(u.displayName || '?').charAt(0).toLocaleUpperCase('tr-TR')}</span>
      )}
      <span className="FStats-member-body">
        <span className="FStats-member-name">{u.displayName}</span>
        <span className="FStats-member-sub">
          <i className="fas fa-user-plus" aria-hidden="true"></i> {u.joinedAt ? [humanTime(new Date(u.joinedAt)), ' katıldı'] : 'Yeni üye'}
        </span>
      </span>
    </Link>
  ));
}

/**
 * Yeni Üyeler kartı: aramıza son katılanlar (Çevrimiçi kartıyla aynı tasarım dili).
 * Veri forum istatistikleriyle birlikte gelir (izin: framio-stats.view.latestMember).
 */
export default class NewMembersWidget extends Widget<WidgetAttrs> {
  className(): string {
    return 'Framio-NewMembersWidget';
  }

  icon(): string {
    return 'fas fa-user-plus';
  }

  title(): string {
    return 'Aramıza katılanlar';
  }

  description(): string {
    return '';
  }

  content(): Mithril.Children {
    const s: any = app.forum.attribute('framioStats') || {};
    const members: any[] = s.newMembers || [];
    if (!members.length) return <div className="FStats-members-empty">Henüz yeni üye yok.</div>;
    const more = membersPageUrl();

    return (
      <div className="FStats-members">
        <div className="FStats-members-list">{memberRows(members, LIMIT)}</div>
        {more ? (
          <Link href={more} className="FStats-more">
            <span>Tüm üyeler</span>
            <i className="fas fa-arrow-right" aria-hidden="true"></i>
          </Link>
        ) : null}
      </div>
    );
  }
}
