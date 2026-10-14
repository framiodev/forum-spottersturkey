import Button from 'flarum/common/components/Button';
import Component from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import Icon from 'flarum/common/components/Icon';
import app from 'flarum/forum/app';
import type Mithril from 'mithril';
import classList from 'flarum/common/utils/classList';

export interface BookmarkButtonAttrs {
  /**
   * The discussion or post being bookmarked. Both expose a `bookmarked` attribute and
   * are saved the same way, so one button serves both.
   */
  subject: Discussion | Post;
  /**
   * Which set of labels to use. Discussions read differently depending on whether the
   * control sits in a dropdown or stands on its own in the sidebar.
   */
  labels: 'dropdownButton' | 'independentButton' | 'postButton';
  className?: string;
  /**
   * Show an alert confirming the change, with a link to the bookmarks page. Used by the
   * post button, which can sit far down a long page.
   */
  alert?: boolean;
}

export default class BookmarkButton extends Component<BookmarkButtonAttrs> {
  /**
   * Guards against a second click while the first save is still in flight, which would
   * otherwise send a contradictory request.
   */
  private saving = false;

  view(): Mithril.Children {
    const { subject, labels, className } = this.attrs;
    const bookmarked = subject.bookmarked();

    return (
      <Button
        // Only the modifier is conditional. `Button` itself is left to the caller: core's
        // Button deliberately applies no class of its own, because a dropdown item must
        // *not* have it — adding it there stacks button padding on top of the menu item's
        // own and indents the row. Folding `Button` in here would also mean the class
        // appeared only once bookmarked, shifting the row on toggle.
        className={classList(className, { 'Button--bookmarked': bookmarked })}
        icon={<Icon name={bookmarked ? 'fas fa-bookmark' : 'far fa-bookmark'} className="Button-icon" noStyleOverride />}
        loading={this.saving}
        onclick={() => this.toggle()}
      >
        {app.translator.trans(`fof-bookmarks.forum.${labels}.${bookmarked ? 'remove' : 'add'}`)}
      </Button>
    );
  }

  private toggle(): void {
    if (this.saving) return;

    const { subject, alert } = this.attrs;

    // Read before saving: the attribute is what we are about to invert.
    const wasBookmarked = subject.bookmarked();

    this.saving = true;

    subject
      .save({ bookmarked: !wasBookmarked })
      .then(() => {
        if (alert) this.showAlert(!wasBookmarked);
      })
      .catch(() => {
        // Flarum's default error handler has already told the user. Nothing to add.
      })
      .then(() => {
        this.saving = false;
        m.redraw();
      });
  }

  private showAlert(bookmarked: boolean): void {
    const message = app.translator.trans(`fof-bookmarks.forum.alert.${bookmarked ? 'added' : 'removed'}`);

    // Offering a link to the bookmarks page is pointless when already looking at it.
    if (app.current.get('routeName') === 'fof-bookmarks') {
      app.alerts.show({ type: 'success' }, message);

      return;
    }

    const alert = app.alerts.show(
      {
        type: 'success',
        controls: [
          <Button
            className="Button Button--link"
            onclick={() => {
              m.route.set(app.route('fof-bookmarks'));
              // Dismissing on navigation stops the alert outliving the page it refers to.
              app.alerts.dismiss(alert);
            }}
          >
            {app.translator.trans('fof-bookmarks.forum.alert.show_bookmarks')}
          </Button>,
        ],
      },
      message
    );
  }
}
