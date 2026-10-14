import { extend } from 'flarum/common/extend';
import type Discussion from 'flarum/common/models/Discussion';
import app from 'flarum/forum/app';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import BookmarkButton from './components/BookmarkButton';

/**
 * Whether the bookmark control should stand on its own in the discussion sidebar rather
 * than sit inside the dropdown.
 */
function useIndependentButton(): boolean {
  return !!app.forum.attribute('fof-bookmarks.independentButton');
}

export default function addDiscussionControls(): void {
  extend(DiscussionControls, 'userControls', (items, discussion: Discussion, context) => {
    if (!app.session.user) return;

    // On the discussion page itself the sidebar button takes over, so the dropdown entry
    // would be a duplicate. Elsewhere — the discussion list, for instance — there is no
    // sidebar, so the dropdown remains the only control.
    if (useIndependentButton() && context instanceof DiscussionPage) return;

    items.add('bookmark', <BookmarkButton subject={discussion} labels="dropdownButton" />);
  });

  extend(DiscussionPage.prototype, 'sidebarItems', function (items) {
    if (!app.session.user || !useIndependentButton()) return;

    // `discussion` is protected on DiscussionPage, but this runs as an extension of the
    // class, where it is populated by the time sidebarItems is called.
    const discussion = (this as unknown as { discussion: Discussion | null }).discussion;

    if (!discussion) return;

    items.add('bookmark', <BookmarkButton subject={discussion} labels="independentButton" className="Button Button--bookmark" />);
  });
}
