import app from 'flarum/forum/app';
import Form from 'flarum/common/components/Form';
import FormModal, { IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import username from 'flarum/common/helpers/username';
import Stream from 'flarum/common/utils/Stream';
import type Warning from '../model/Warning';
import type User from 'flarum/common/models/User';
import type Post from 'flarum/common/models/Post';
import type { AlertIdentifier } from 'flarum/common/states/AlertManagerState';
import type Mithril from 'mithril';

export interface IWarningModalAttrs extends IFormModalAttrs {
  user: User;
  post?: Post;
  callback?: (warning: Warning) => void;
}

export default class WarningModal<CustomAttrs extends IWarningModalAttrs = IWarningModalAttrs> extends FormModal<CustomAttrs> {
  publicComment!: Stream<string>;
  privateComment!: Stream<string>;
  strikes!: Stream<number>;
  successAlert?: AlertIdentifier;

  oninit(vnode: Mithril.Vnode<CustomAttrs, this>) {
    super.oninit(vnode);

    this.publicComment = Stream('');
    this.privateComment = Stream('');
    this.strikes = Stream(0);
  }

  className() {
    return 'WarningsModal Modal--large';
  }

  title() {
    return app.translator.trans('fof-moderator-warnings.forum.warning_modal.heading', { username: username(this.attrs.user) });
  }

  content() {
    return (
      <div className="Modal-body">
        <Form className="Form--centered">
          <div className="Form-group">
            <div>
              <label>
                {app.translator.trans('fof-moderator-warnings.forum.warning_modal.strikes_heading')}
                <input type="number" className="FormControl" bidi={this.strikes} min="0" max="5"></input>
              </label>
            </div>
          </div>
          <div className="Form-group">
            <div>
              <label>
                {app.translator.trans('fof-moderator-warnings.forum.warning_modal.public_comment_heading', {
                  username: username(this.attrs.user),
                })}
                <textarea className="FormControl" bidi={this.publicComment} required={true} rows="6" />
              </label>
            </div>
          </div>
          <div className="Form-group">
            <div>
              <label>
                {app.translator.trans('fof-moderator-warnings.forum.warning_modal.private_comment_heading', {
                  username: username(this.attrs.user),
                })}
                <textarea className="FormControl" bidi={this.privateComment} rows="6" />
              </label>
            </div>
          </div>
          <div className="Form-group">
            <Button className="Button Button--primary Button--block" type="submit" loading={this.loading}>
              {app.translator.trans('fof-moderator-warnings.forum.warning_modal.submit_button')}
            </Button>
          </div>
        </Form>
      </div>
    );
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();

    if (this.successAlert != null) {
      app.alerts.dismiss(this.successAlert);
    }

    this.loading = true;

    if (!this.strikes()) {
      this.strikes(0);
    }

    const data: Record<string, unknown> = {
      userId: this.attrs.user.id(),
      strikes: this.strikes(),
      publicComment: this.publicComment(),
      privateComment: this.privateComment(),
    };

    if (this.attrs.post) {
      data.relationships = {
        post: this.attrs.post,
      };
    }

    app.store
      .createRecord<Warning>('warnings')
      .save(data)
      .then((warning) => {
        this.hide();

        this.successAlert = app.alerts.show(
          { type: 'success' },
          app.translator.trans('fof-moderator-warnings.forum.warning_modal.confirmation_message')
        );

        // The warning now appears immediately, so the confirmation is a transient
        // acknowledgement rather than something the user has to act on.
        setTimeout(() => app.alerts.dismiss(this.successAlert!), 5000);

        // Hand the saved warning to the caller so it can be shown in place
        // rather than the page being reloaded to pick it up.
        this.attrs.callback?.(warning);
      })
      .catch(() => {
        this.loading = false;
        m.redraw();
      });
  }
}
