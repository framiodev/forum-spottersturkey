import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import FormModal from 'flarum/common/components/FormModal';
import LinkButton from 'flarum/common/components/LinkButton';
import DiscussionSearch from '../../../merge-discussions/forum/components/DiscussionSearch';
import type Discussion from 'flarum/common/models/Discussion';
import GlobalSearchState from 'flarum/forum/states/GlobalSearchState';
import { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import FormGroup from 'flarum/common/components/FormGroup';
import Stream from 'flarum/common/utils/Stream';

export interface MovePostsModalAttrs extends IInternalModalAttrs {
  discussion: Discussion;
  postIds: string[];
}

export interface MovePostsResponse {
  status: string;
  postCount: number;
  firstMovedPostNumber: number;
  sourceDiscussionId: string;
  targetDiscussionId: string;
}

export default class MovePostsModal extends FormModal<MovePostsModalAttrs> {
  isLoading: Stream<'check' | 'submit' | boolean> = Stream(false);
  newDiscussion: Stream<boolean> = Stream(false);
  newDiscussionTitle: Stream<string> = Stream('');
  targetDiscussionId: Stream<string> = Stream('');
  search = new GlobalSearchState();

  className() {
    return 'MovePostsModal';
  }

  title() {
    return app.translator.trans('fof-move-posts.forum.modal.title');
  }

  content() {
    return (
      <div className="Modal-body Form">
        <FormGroup
          label={app.translator.trans('fof-move-posts.forum.modal.selected_posts', { count: this.attrs.postIds.length })}
          value={this.attrs.postIds.join(', ')}
          readonly
        />
        <FormGroup label={app.translator.trans('fof-move-posts.forum.modal.new_discussion')} type="switch" stream={this.newDiscussion} />
        {this.newDiscussion() ? (
          <FormGroup
            label={app.translator.trans('fof-move-posts.forum.modal.discussion_name')}
            help={app.translator.trans('fof-move-posts.forum.modal.discussion_help')}
            stream={this.newDiscussionTitle}
            required
          />
        ) : (
          <div className="Form-group">
            <label for="destination">{app.translator.trans('fof-move-posts.forum.modal.destination')}</label>
            <DiscussionSearch
              state={this.search}
              ignore={this.attrs.discussion.id()}
              onSelect={(discussion: Discussion) => this.targetDiscussionId(discussion.id())}
            />
          </div>
        )}
        <div className="Form-group Form-controls">
          <Button
            className="Button Button--primary"
            type="submit"
            loading={this.isLoading() === 'submit'}
            disabled={this.isLoading() === 'check' || !this.canSubmit()}
          >
            {app.translator.trans('fof-move-posts.forum.modal.submit')}
          </Button>
          <Button
            className="Button"
            onclick={this.emulate.bind(this)}
            loading={this.isLoading() === 'check'}
            disabled={this.isLoading() === 'submit' || !this.canSubmit()}
          >
            {app.translator.trans('fof-move-posts.forum.modal.check')}
          </Button>
        </div>
      </div>
    );
  }

  canSubmit(): boolean {
    return (this.targetDiscussionId().length && !this.newDiscussion()) || (this.newDiscussionTitle().length && this.newDiscussion());
  }

  data() {
    const data: Record<string, unknown> = {
      sourceDiscussionId: this.attrs.discussion.id(),
      postIds: this.attrs.postIds,
    };

    if (this.newDiscussion()) {
      data.newDiscussion = true;
      data.newDiscussionTitle = this.newDiscussionTitle();
    } else {
      data.targetDiscussionId = this.targetDiscussionId();
    }

    return data;
  }

  emulate() {
    this.onsubmit(null, true).then((response: any) => {
      switch (response.status) {
        case 'old_to_new_move':
          this.alertAttrs = { type: 'error', content: app.translator.trans('fof-move-posts.forum.modal.status.old_to_new_move') };
          break;

        case 'simple_move':
          this.alertAttrs = { type: 'success', content: app.translator.trans('fof-move-posts.forum.modal.status.simple_move') };
          break;

        case 'complex_move':
          this.alertAttrs = { type: 'warning', content: app.translator.trans('fof-move-posts.forum.modal.status.complex_move') };
          break;

        default:
          break;
      }

      m.redraw();
    });
  }

  override async onsubmit(event: SubmitEvent | null, emulate: boolean = false) {
    event?.preventDefault();

    // Warn before moving the entire discussion into a new one
    if (
      !emulate &&
      this.newDiscussion() &&
      this.attrs.discussion.commentCount() === this.attrs.postIds.length &&
      !confirm(app.translator.trans('fof-move-posts.forum.modal.confirm_move_all_to_new_discussion') as string)
    ) {
      return;
    }

    this.isLoading(emulate ? 'check' : 'submit');

    const response = await app.request<MovePostsResponse>({
      method: 'POST',
      url: `${app.forum.attribute('baseUrl')}/api/posts/move${emulate ? '/check' : ''}`,
      body: { data: this.data() },
      errorHandler: (e) => {
        this.isLoading(false);
        if (!e?.response?.errors?.[0]?.code) {
          throw e;
        }

        const errorCode = e.response.errors[0].code;

        if (!['move_old_post_to_newer_discussion', 'move_posts_to_same_discussion'].includes(errorCode)) {
          throw e;
        }

        this.alertAttrs = {
          type: 'error',
          content: app.translator.trans(`fof-move-posts.forum.error.${errorCode}`),
        };

        m.redraw();
      },
    });
    this.isLoading(false);

    if (emulate) {
      return response;
    }

    const targetDiscussion =
      app.store.getById<Discussion>('discussions', response.targetDiscussionId) ??
      (await app.store.find<Discussion>('discussions', response.targetDiscussionId));

    app.alerts.show(
      { type: 'success' },
      app.translator.trans('fof-move-posts.forum.alerts.posts_moved_to', {
        count: response.postCount,
        target_discussion: (
          <LinkButton href={app.route.discussion(targetDiscussion, response.firstMovedPostNumber)}>{targetDiscussion.title()}</LinkButton>
        ),
      })
    );

    m.route.set(app.route.discussion(targetDiscussion, response.firstMovedPostNumber));

    this.hide();

    return response;
  }
}
