import app from 'flarum/forum/app';
import Modal, { IInternalModalAttrs } from 'flarum/common/components/Modal';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Link from 'flarum/common/components/Link';
import humanTime from 'flarum/common/utils/humanTime';

interface Attrs extends IInternalModalAttrs {
  kind: 'post' | 'discussion';
  id: string | number;
}

/** Bir mesajı ya da tartışmayı kimlerin görüntülediği (izin: framio-stats.viewViewers) */
export default class ViewersModal extends Modal<Attrs> {
  data: any = null;
  failed = false;

  oninit(vnode: any) {
    super.oninit(vnode);
    app
      .request<any>({ method: 'GET', url: `${app.forum.attribute('apiUrl')}/framio-views/${this.attrs.kind}/${this.attrs.id}`, errorHandler: () => {} } as any)
      .then((r) => (this.data = r))
      .catch(() => (this.failed = true))
      .then(() => m.redraw());
  }

  className() {
    return 'FramioViewersModal Modal--small';
  }

  title() {
    return this.attrs.kind === 'post' ? 'Mesajı görüntüleyenler' : 'Tartışmayı görüntüleyenler';
  }

  content() {
    if (this.failed) return <div className="Modal-body">Bilgi alınamadı.</div>;
    const d = this.data;
    if (!d) return <div className="Modal-body"><LoadingIndicator /></div>;
    const max = Math.max(1, ...d.daily.map((x: any) => x.members + x.guests));

    return (
      <div className="Modal-body">
        <div className="FramioViewers-title">{d.title}</div>
        <div className="FramioViewers-kpis">
          <div><strong>{d.total.toLocaleString('tr-TR')}</strong><span>Toplam (günlük tekil)</span></div>
          <div><strong>{d.uniqueMembers.toLocaleString('tr-TR')}</strong><span>Farklı üye</span></div>
          <div><strong>{d.guestViews.toLocaleString('tr-TR')}</strong><span>Ziyaretçi</span></div>
        </div>

        <div className="FramioViewers-chart" title="Son 14 gün">
          {d.daily.map((x: any) => (
            <span title={`${new Date(x.date + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}: ${x.members} üye, ${x.guests} ziyaretçi`}>
              <i className="is-guest" style={{ height: `${(x.guests / max) * 100}%` }}></i>
              <i className="is-member" style={{ height: `${(x.members / max) * 100}%` }}></i>
            </span>
          ))}
        </div>
        <div className="FramioViewers-legend"><span className="is-member"></span> Üye <span className="is-guest"></span> Ziyaretçi · son 14 gün</div>

        <h4>Görüntüleyen üyeler</h4>
        {d.members.length ? (
          <ul className="FramioViewers-list">
            {d.members.map((u: any) => (
              <li>
                <Link href={app.route('user', { username: u.username })} onclick={() => this.hide()}>
                  {u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : <span className="is-letter">{(u.displayName || '?').charAt(0)}</span>}
                  <span className="FramioViewers-name">{u.displayName}</span>
                </Link>
                <small>
                  {u.lastAt ? humanTime(new Date(u.lastAt)) : ''}
                  {u.days > 1 ? ` · ${u.days} farklı gün` : ''}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <div className="FramioViewers-empty">Henüz üye görüntülemesi yok.</div>
        )}
        <p className="FramioViewers-note">Ziyaretçilerin kimliği ve IP adresi saklanmaz; aynı ziyaretçi aynı gün bir kez sayılır.</p>
      </div>
    );
  }
}
