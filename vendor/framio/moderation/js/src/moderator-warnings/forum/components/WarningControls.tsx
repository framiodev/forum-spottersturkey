import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import Separator from 'flarum/common/components/Separator';
import ItemList from 'flarum/common/utils/ItemList';
import type Warning from '../model/Warning';
import type Mithril from 'mithril';

/**
 * The component the controls are rendered under, exposing the callbacks the
 * actions report back through.
 */
export interface WarningControlsContext {
  loading?: boolean;
  attrs: {
    ondelete?: (warning: Warning) => void;
    onchange?: (warning: Warning) => void;
  };
}

/**
 * The `WarningControls` utility constructs a list of buttons for a warning which
 * perform actions on it.
 */
export default {
  /**
   * Get a list of controls for a warning.
   *
   * @param context The parent component under which the controls menu will
   *     be displayed.
   */
  controls(warning: Warning, context: WarningControlsContext): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    (['user', 'moderation', 'destructive'] as const).forEach((section) => {
      const controls = this[`${section}Controls`](warning, context).toArray();
      if (controls.length) {
        controls.forEach((item) => items.add(item.itemName, item));
        items.add(section + 'Separator', Separator.component());
      }
    });

    return items;
  },

  /**
   * Get controls for a warning pertaining to the current user (e.g. report).
   */
  userControls(_warning: Warning, _context: WarningControlsContext): ItemList<Mithril.Children> {
    return new ItemList();
  },

  /**
   * Get controls for a warning pertaining to moderation (e.g. edit).
   */
  moderationControls(_warning: Warning, _context: WarningControlsContext): ItemList<Mithril.Children> {
    return new ItemList();
  },

  /**
   * Get controls for a warning that are destructive (e.g. delete).
   */
  destructiveControls(warning: Warning, context: WarningControlsContext): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    if (!warning.isHidden() && app.session.user?.canManageWarnings()) {
      items.add(
        'hide',
        <Button icon="far fa-trash-alt" onclick={this.hideAction.bind(warning, context)}>
          {app.translator.trans('fof-moderator-warnings.forum.warning_controls.delete_button')}
        </Button>
      );
    }
    if (warning.isHidden() && app.session.user?.canManageWarnings()) {
      items.add(
        'restore',
        <Button icon="fas fa-reply" onclick={this.restoreAction.bind(warning, context)}>
          {app.translator.trans('fof-moderator-warnings.forum.warning_controls.restore_button')}
        </Button>
      );
    }
    if (warning.isHidden() && app.session.user?.canDeleteWarnings()) {
      items.add(
        'delete',
        <Button icon="fas fa-times" onclick={this.deleteAction.bind(warning, context)}>
          {app.translator.trans('fof-moderator-warnings.forum.warning_controls.delete_forever_button')}
        </Button>
      );
    }

    return items;
  },

  /**
   * Hide a warning.
   */
  hideAction(this: Warning, context?: WarningControlsContext): Promise<void> {
    return this.save({ isHidden: true }).then(() => {
      context?.attrs?.onchange?.(this);
      m.redraw();
    });
  },

  /**
   * Restore a warning.
   */
  restoreAction(this: Warning, context?: WarningControlsContext): Promise<void> {
    return this.save({ isHidden: false }).then(() => {
      context?.attrs?.onchange?.(this);
      m.redraw();
    });
  },

  /**
   * Delete a warning.
   */
  deleteAction(this: Warning, context?: WarningControlsContext): Promise<void> {
    if (context) context.loading = true;

    const done = () => {
      if (context) context.loading = false;
      m.redraw();
    };

    return this.delete().then(
      () => {
        context?.attrs?.ondelete?.(this);
        done();
      },
      // Not swallowed: app.request shows its own error alert.
      (error) => {
        done();
        throw error;
      }
    );
  },
};
