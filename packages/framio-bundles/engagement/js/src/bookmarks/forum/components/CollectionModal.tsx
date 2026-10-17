import app from 'flarum/forum/app';
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';
import collections from '../collections';

interface CollectionModalAttrs extends IInternalModalAttrs {
  post: any;
}

/**
 * "Kitaplığa kaydet": Instagram'daki koleksiyonlar gibi. Kitaplığa dokununca mesaj oraya
 * kaydedilir; aynı pencereden yeni kitaplık oluşturulabilir.
 */
export default class CollectionModal extends Modal<CollectionModalAttrs> {
  private newName = '';
  private creating = false;
  private busyId: number | null | undefined = undefined;

  oninit(vnode: Mithril.Vnode<CollectionModalAttrs, this>) {
    super.oninit(vnode);
    collections.load();
  }

  className() {
    return 'BookmarkCollectionModal Modal--small';
  }

  title() {
    return 'Kitaplığa kaydet';
  }

  content() {
    const post = this.attrs.post;
    const current = post.attribute('bookmarkCollectionId') ?? null;
    const list = collections.list;

    return (
      <div className="Modal-body">
        {!list ? (
          <LoadingIndicator />
        ) : (
          <div className="BookmarkCollections-grid">
            <button type="button" className={'BookmarkCollection-tile' + (post.bookmarked() && current === null ? ' is-current' : '')} onclick={() => this.pick(null)}>
              <span className="BookmarkCollection-cover is-all">
                <i className="fas fa-bookmark"></i>
              </span>
              <span className="BookmarkCollection-name">Tüm kaydedilenler</span>
              {this.busyId === null ? <i className="fas fa-spinner fa-spin BookmarkCollection-check"></i> : post.bookmarked() && current === null ? <i className="fas fa-check-circle BookmarkCollection-check"></i> : null}
            </button>
            {list.map((c) => (
              <button type="button" key={c.id} className={'BookmarkCollection-tile' + (current === c.id ? ' is-current' : '')} onclick={() => this.pick(c.id)}>
                <span className="BookmarkCollection-cover" style={c.cover ? { backgroundImage: 'url("' + c.cover + '")' } : undefined}>
                  {c.cover ? null : <i className="far fa-images"></i>}
                </span>
                <span className="BookmarkCollection-name">{c.name}</span>
                <span className="BookmarkCollection-count">{c.count} kayıt</span>
                {this.busyId === c.id ? <i className="fas fa-spinner fa-spin BookmarkCollection-check"></i> : current === c.id ? <i className="fas fa-check-circle BookmarkCollection-check"></i> : null}
              </button>
            ))}
          </div>
        )}

        <form
          className="BookmarkCollection-new"
          onsubmit={(e: Event) => {
            e.preventDefault();
            this.create();
          }}
        >
          <input
            className="FormControl"
            maxlength={80}
            placeholder="Yeni kitaplık adı (ör. Travegolar, Otogarlar)"
            value={this.newName}
            oninput={(e: InputEvent) => (this.newName = (e.target as HTMLInputElement).value)}
          />
          <Button type="submit" className="Button Button--primary" icon="fas fa-plus" loading={this.creating} disabled={!this.newName.trim()}>
            Oluştur ve kaydet
          </Button>
        </form>
      </div>
    );
  }

  pick(id: number | null) {
    if (this.busyId !== undefined) return;
    this.busyId = id;
    collections
      .assign(this.attrs.post, id)
      .then(() => {
        const name = id === null ? 'Tüm kaydedilenler' : (collections.list || []).find((c) => c.id === id)?.name;
        app.alerts.show({ type: 'success' }, `"${name}" kitaplığına kaydedildi.`);
        this.hide();
      })
      .finally(() => {
        this.busyId = undefined;
        m.redraw();
      });
  }

  create() {
    const name = this.newName.trim();
    if (!name || this.creating) return;
    this.creating = true;
    collections
      .create(name)
      .then((id) => {
        this.newName = '';
        this.creating = false;
        this.pick(id);
      })
      .catch(() => {
        this.creating = false;
        m.redraw();
      });
  }
}
