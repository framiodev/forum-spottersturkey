import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import { extend } from 'flarum/common/extend';
import LinkButton from 'flarum/common/components/LinkButton';
import app from 'flarum/forum/app';

export default function addBookmarksNavItem(): void {
  extend(IndexSidebar.prototype, 'navItems', (items) => {
    if (!app.session.user) return;

    items.add(
      'fof-bookmarks',
      <LinkButton href={app.route('fof-bookmarks')} icon="fa-solid fa-bookmark">
        {app.translator.trans('fof-bookmarks.forum.page.link')}
      </LinkButton>,
      89
    );
  });
}
