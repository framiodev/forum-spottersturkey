import app from 'flarum/forum/app';
import haptic from 'flarum/common/utils/haptic';
import Component from 'flarum/common/Component';
import HeaderList from 'flarum/forum/components/HeaderList';
import Button from 'flarum/common/components/Button';
import Tooltip from 'flarum/common/components/Tooltip';
import ItemList from 'flarum/common/utils/ItemList';
import type Draft from '../models/Draft';
import type DraftsListState from '../states/DraftsListState';
import { setDraftCount } from '../utils/draftCount';
import DraftsListItem from './DraftsListItem';

interface DraftsListAttrs {
  state: DraftsListState;
}

export default class DraftsList extends Component<DraftsListAttrs> {
  oncreate(vnode: any) {
    super.oncreate(vnode);

    $('.draft--delete').on('click tap', function (event) {
      event.stopPropagation();
    });
  }

  deleteAll(e: MouseEvent) {
    $(e.currentTarget as HTMLElement).trigger('mouseleave');
    if (!confirm(app.translator.trans('fof-drafts.forum.dropdown.delete_all_alert') as string)) return;

    haptic('heavy');
    app
      .request({
        method: 'DELETE',
        url: app.forum.attribute('apiUrl') + '/drafts/all',
      })
      .then(() => {
        // Clear drafts from store
        const drafts = app.store.all<Draft>('drafts');
        drafts.forEach((draft) => app.store.remove(draft));
        setDraftCount(0);
        m.redraw();
      });
  }

  private activeFilter: 'all' | 'drafts' | 'scheduled' = 'all';

  controlItems() {
    const items = new ItemList();

    items.add(
      'deleteAll',
      <Tooltip showOnFocus={false} text={app.translator.trans('fof-drafts.forum.dropdown.delete_all_button')}>
        <Button
          data-container="body"
          icon="fas fa-trash-can"
          className="Button Button--link Button--icon Alert-dismiss"
          onclick={(e: MouseEvent) => {
            this.deleteAll(e);
          }}
        />
      </Tooltip>
    );

    return items;
  }

  view() {
    const allDrafts = app.store.all<Draft>('drafts');
    const state = this.attrs.state;

    const scheduledCount = allDrafts.filter((d) => Boolean(d.scheduledFor())).length;
    const unscheduledCount = allDrafts.filter((d) => !d.scheduledFor()).length;

    const drafts = allDrafts.filter((draft) => {
      if (this.activeFilter === 'scheduled') {
        return Boolean(draft.scheduledFor());
      }
      if (this.activeFilter === 'drafts') {
        return !draft.scheduledFor();
      }
      return true;
    });

    let emptyText = app.translator.trans('fof-drafts.forum.dropdown.empty_text') as string;
    if (this.activeFilter === 'scheduled') {
      emptyText = 'Zamanlanmış herhangi bir içerik bulunmuyor.';
    } else if (this.activeFilter === 'drafts') {
      emptyText = 'Kayıtlı taslak içerik bulunmuyor.';
    }

    return (
      <HeaderList
        className="DraftsList"
        title="Taslak ve Planlamalar"
        controls={this.controlItems()}
        hasItems={allDrafts.length > 0}
        loading={state.loading}
        emptyText={emptyText}
      >
        {allDrafts.length > 0 && (
          <div className="DraftsList-filterTabs">
            <button
              type="button"
              className={`DraftsList-tabBtn ${this.activeFilter === 'all' ? 'active' : ''}`}
              onclick={(e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                this.activeFilter = 'all';
                m.redraw();
              }}
            >
              Tümü ({allDrafts.length})
            </button>
            <button
              type="button"
              className={`DraftsList-tabBtn ${this.activeFilter === 'drafts' ? 'active' : ''}`}
              onclick={(e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                this.activeFilter = 'drafts';
                m.redraw();
              }}
            >
              <i className="fas fa-file-pen" style={{ marginRight: '4px' }}></i>
              Taslaklar ({unscheduledCount})
            </button>
            <button
              type="button"
              className={`DraftsList-tabBtn ${this.activeFilter === 'scheduled' ? 'active' : ''}`}
              onclick={(e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                this.activeFilter = 'scheduled';
                m.redraw();
              }}
            >
              <i className="far fa-clock" style={{ marginRight: '4px' }}></i>
              Zamanlanan ({scheduledCount})
            </button>
          </div>
        )}

        <ul className="HeaderListGroup-content">
          {drafts
            .sort((a, b) => (b.updatedAt()?.getTime?.() ?? 0) - (a.updatedAt()?.getTime?.() ?? 0))
            .map((draftItem) => {
              return <DraftsListItem key={draftItem.id()} draft={draftItem} state={state} />;
            })}
        </ul>
      </HeaderList>
    );
  }
}
