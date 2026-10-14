import app from 'flarum/forum/app';
import Component, { ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import username from 'flarum/common/helpers/username';
import WarningPreview from './WarningPreview';
import type Mithril from 'mithril';
import type Warning from '../model/Warning';

export interface PostWarningAttrs extends ComponentAttrs {
  warning: Warning;
}

export default class PostWarning<CustomAttrs extends PostWarningAttrs = PostWarningAttrs> extends Component<CustomAttrs> {
  warning!: Warning;

  oninit(vnode: Mithril.Vnode<CustomAttrs, this>) {
    super.oninit(vnode);

    this.warning = this.attrs.warning;
  }

  view() {
    return (
      <div className="Post-warning">
        <span className="Post-warning-summary">
          <Icon name="fas fa-exclamation-circle" />
          {this.warning.strikes()
            ? app.translator.trans('fof-moderator-warnings.forum.post.warning', {
                strikes: this.warning.strikes() || 0,
                mod_username: username(this.warning.addedByUser()),
              })
            : app.translator.trans('fof-moderator-warnings.forum.post.warning_no_strikes', {
                mod_username: username(this.warning.addedByUser()),
              })}
        </span>
      </div>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<CustomAttrs, this>) {
    super.oncreate(vnode);

    const warning = this.warning;

    let timeout: ReturnType<typeof setTimeout> | undefined;

    const hidePreview = () => {
      this.$('.Post-warning-preview')
        .removeClass('in')
        .one('transitionend', function () {
          $(this).hide();
        });
    };

    const $preview = $('<ul class="Dropdown-menu Post-warning-preview fade"/>');
    this.$().append($preview);

    this.$()
      .children()
      .hover(
        function () {
          clearTimeout(timeout);
          timeout = setTimeout(function () {
            if (!$preview.hasClass('in') && $preview.is(':visible')) return;

            // When the user hovers their mouse over the list of people who have
            // replied to the post, render a list of reply previews into a
            // popup.
            m.render(
              $preview[0],
              <li data-id={warning.id()}>
                <WarningPreview warning={warning} />
              </li>
            );
            $preview.show();
            setTimeout(() => $preview.off('transitionend').addClass('in'));
          }, 200);
        },
        function () {
          clearTimeout(timeout);
          timeout = setTimeout(hidePreview, 250);
        }
      );

    // Whenever the user hovers their mouse over a particular name in the
    // list of repliers, highlight the corresponding post in the preview
    // popup.
    $('.Post-warning')
      .find('.Post-warning-summary a')
      .hover(
        function () {
          $('.Post-warning')
            .find('[data-number="' + $(this).data('number') + '"]')
            .addClass('active');
        },
        function () {
          $('.Post-warning').find('[data-number]').removeClass('active');
        }
      );
  }
}
