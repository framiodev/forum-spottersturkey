import LinkButton from 'flarum/common/components/LinkButton';
import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import listItems from 'flarum/common/helpers/listItems';
import ItemList from 'flarum/common/utils/ItemList';
import classList from 'flarum/common/utils/classList';
import extractText from 'flarum/common/utils/extractText';
import app from 'flarum/forum/app';
import DiscussionList from 'flarum/forum/components/DiscussionList';
import IndexPage from 'flarum/forum/components/IndexPage';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import PageStructure from 'flarum/forum/components/PageStructure';
import PostList from 'flarum/forum/components/PostList';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import type Mithril from 'mithril';
import BookmarkedPostListState from '../states/BookmarkedPostListState';

export type BookmarksTab = 'discussions' | 'posts';

const TABS: BookmarksTab[] = ['discussions', 'posts'];

const TAB_ICONS: Record<BookmarksTab, string> = {
  discussions: 'far fa-comments',
  posts: 'far fa-comment',
};

/**
 * The bookmarks page, listing the actor's bookmarked discussions and posts under one
 * route with a tab for each.
 *
 * Discussions reuse core's `DiscussionList` via the `bookmarked` filter, so sorting and
 * pagination behave exactly as they do on the index. Posts use their own list state driven
 * by the same filter on the post searcher.
 */
export default class BookmarksPage extends Page {
  private tab: BookmarksTab = 'discussions';
  private discussions!: DiscussionListState;
  private posts!: BookmarkedPostListState;

  oninit(vnode: Mithril.Vnode<IPageAttrs, this>): void {
    super.oninit(vnode);

    // Guests have no bookmarks, so there is nothing here for them.
    if (!app.session.user) {
      m.route.set(app.route('index'));

      return;
    }

    // `LinkButton` defaults to `force: true`, so switching tabs re-runs the route and
    // this method. The active tab is therefore read from the URL rather than tracked as
    // mutable state, which also makes /bookmarks?tab=posts work as a direct link.
    this.tab = m.route.param('tab') === 'posts' ? 'posts' : 'discussions';

    // The backend exposes a `bookmarked` filter; `is:bookmarked` is only the gambit text
    // the search box translates into it, so the filter is passed directly here.
    //
    // It has to be nested under `filter`: `DiscussionListState.requestParams()` spreads
    // `params.filter` into the request and special-cases only `params.q`, so a top-level
    // key is silently dropped and the list comes back unfiltered.
    this.discussions = new DiscussionListState({ filter: { bookmarked: true } });
    this.posts = new BookmarkedPostListState();

    this.loadCurrentTab();

    app.history.push('fof-bookmarks', extractText(app.translator.trans('fof-bookmarks.forum.page.title')));
    app.setTitle(extractText(app.translator.trans('fof-bookmarks.forum.page.title')));
  }

  view(): Mithril.Children {
    // `PageStructure` owns the hero/sidebar/content scaffolding, and `IndexSidebar` renders
    // its own `<nav>` wrapper plus the item classes its children rely on — notably
    // `App-primaryControl` on the "Start a Discussion" button, which positions it. Building
    // that markup by hand here dropped those classes and shifted the button.
    return (
      <PageStructure className="BookmarksPage IndexPage" hero={() => IndexPage.prototype.hero()} sidebar={() => <IndexSidebar />}>
        <div className="IndexPage-toolbar">
          <ul className="IndexPage-toolbar-view">{listItems(this.tabItems().toArray())}</ul>
        </div>
        {this.content()}
      </PageStructure>
    );
  }

  private tabItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    TABS.forEach((tab, index) => {
      const active = this.tab === tab;

      items.add(
        tab,
        // `Button` styles are opt-in: core's Button applies no class of its own, and the
        // toolbar list this sits in does not style its children the way `sideNav` does.
        //
        // The `active` attr drives LinkButton's own bookkeeping, while core's Button LESS
        // styles the `active` *class*, so both are set.
        <LinkButton className={classList('Button', { active })} href={this.tabHref(tab)} active={active} icon={TAB_ICONS[tab]}>
          {app.translator.trans(`fof-bookmarks.forum.page.tab.${tab}`)}
        </LinkButton>,
        // Preserve declaration order in the item list.
        100 - index
      );
    });

    return items;
  }

  private tabHref(tab: BookmarksTab): string {
    return app.route('fof-bookmarks', tab === 'discussions' ? {} : { tab });
  }

  /**
   * Both tabs render through core's list components, which already handle the initial
   * loading indicator, the empty placeholder, pagination and the per-item markup.
   */
  private content(): Mithril.Children {
    return this.tab === 'discussions' ? <DiscussionList state={this.discussions} /> : <PostList state={this.posts} />;
  }

  /**
   * Each list is only fetched when its tab is first opened, so opening the page does not
   * pay for results the user may never look at.
   */
  private loadCurrentTab(): void {
    const state = this.tab === 'discussions' ? this.discussions : this.posts;

    if (state.isInitialLoading() || state.hasItems()) return;

    state.refresh().then(() => m.redraw());
  }
}
