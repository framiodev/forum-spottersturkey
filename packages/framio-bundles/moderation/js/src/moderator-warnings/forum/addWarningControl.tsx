import { extend } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import PostControls from 'flarum/forum/utils/PostControls';
import UserControls from 'flarum/forum/utils/UserControls';
import Button from 'flarum/common/components/Button';
import type User from 'flarum/common/models/User';

/**
 * Keep the profile warnings badge in step after a warning is issued. The count is
 * computed server-side, so without this it only catches up on the next page load.
 */
function bumpWarningCount(user: User | null | undefined | false) {
  if (!user) return;

  const count = user.visibleWarningCount();

  if (typeof count === 'number') {
    user.pushAttributes({ visibleWarningCount: count + 1 });
  }
}

export default function () {
  extend(PostControls, 'moderationControls', function (items, post) {
    if (!app.session.user || !app.session.user.canManageWarnings()) return;

    items.add(
      'warning',
      <Button
        icon="fas fa-exclamation-circle"
        onclick={() =>
          app.modal.show(() => import('./components/WarningModal'), {
            callback: (warning: any) => {
              // Show the warning in the post footer straight away. The relationship
              // is only loaded once warnings have been included for this post.
              const warnings = post.warnings();

              if (warning && Array.isArray(warnings)) {
                post.pushData({
                  relationships: { warnings: [...warnings.filter(Boolean), warning] },
                });
              }

              bumpWarningCount(post.user());

              m.redraw();
            },
            user: post.user(),
            post: post,
          })
        }
      >
        {app.translator.trans('fof-moderator-warnings.forum.post_controls.warning_button')}
      </Button>
    );
  });

  extend(UserControls, 'moderationControls', function (items, user) {
    if (!app.session.user || !app.session.user.canManageWarnings()) return;

    items.add(
      'warning',
      <Button
        icon="fas fa-exclamation-circle"
        onclick={() =>
          app.modal.show(() => import('./components/WarningModal'), {
            callback: () => {
              bumpWarningCount(user);

              m.redraw();
            },
            user: user,
          })
        }
      >
        {app.translator.trans('fof-moderator-warnings.forum.post_controls.warning_button')}
      </Button>
    );
  });
}
