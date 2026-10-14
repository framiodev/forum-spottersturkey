import Modal, { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Mithril from 'mithril';
import app from 'flarum/forum/app';
import Stream from 'flarum/common/utils/Stream';

export interface CreateStoryModalAttrs extends IInternalModalAttrs {
  refreshStories: () => void;
  username: string;
  userId: string | number;
}

export default class CreateStoryModal extends Modal<CreateStoryModalAttrs> {
  public step: number = 0;
  story_title = Stream('');
  story_imgUrl = Stream('');
  story_cta = Stream('');
  story_icon = Stream('');
  story_text = Stream('');
  story_content_cta = Stream('');
  story_content_link = Stream('');

  className(): string {
    return 'create-story-modal';
  }

  title(): Mithril.Children {
    return app.translator.trans('justoverclock-profile-stories.forum.createStory');
  }

  content(): Mithril.Children {
    return (
      <div className="new-story-container">
        <div className="new-story-content">
          {this.step === 0 && (
            <div className="story-step-container">
              <input
                value={this.story_title()}
                oninput={(e: { target: { value: string } }) => this.story_title(e.target.value)}
                placeholder={app.translator.trans('justoverclock-profile-stories.forum.storyTitle')}
                className="FormControl"
                type="text"
              />
              <input
                value={this.story_imgUrl()}
                oninput={(e: { target: { value: string } }) => this.story_imgUrl(e.target.value)}
                placeholder={app.translator.trans('justoverclock-profile-stories.forum.storyImage')}
                className="FormControl"
                type="url"
              />
              <input
                value={this.story_cta()}
                oninput={(e: { target: { value: string } }) => this.story_cta(e.target.value)}
                placeholder={app.translator.trans('justoverclock-profile-stories.forum.storyCta')}
                className="FormControl"
                type="text"
              />
            </div>
          )}
          {this.step === 1 && (
            <div className="story-step-container">
              <input
                value={this.story_icon()}
                oninput={(e: { target: { value: string } }) => this.story_icon(e.target.value)}
                placeholder={app.translator.trans('justoverclock-profile-stories.forum.storyIcon')}
                className="FormControl"
                type="text"
              />
              <input
                value={this.story_content_link()}
                oninput={(e: { target: { value: string } }) => this.story_content_link(e.target.value)}
                placeholder={app.translator.trans('justoverclock-profile-stories.forum.storyContentLink')}
                className="FormControl"
                type="text"
              />
              <input
                value={this.story_content_cta()}
                oninput={(e: { target: { value: string } }) => this.story_content_cta(e.target.value)}
                placeholder={app.translator.trans('justoverclock-profile-stories.forum.storyContentCta')}
                className="FormControl"
                type="text"
              />
              <textarea
                rows={6}
                value={this.story_text()}
                oninput={(e: { target: { value: string } }) => this.story_text(e.target.value)}
                placeholder={app.translator.trans('justoverclock-profile-stories.forum.storyContentText')}
                className="FormControl"
              />
            </div>
          )}
        </div>
        <form className="new-story-actions" onsubmit={(e: { preventDefault: () => any }) => e.preventDefault()}>
          <button disabled={this.step < 1} className="Button" onclick={this.stepDecrement.bind(this)}>
            {app.translator.trans('justoverclock-profile-stories.forum.previousStepBtn')}
          </button>
          {this.step < 1 && (
            <button className="Button" onclick={this.stepIncrement.bind(this)}>
              {app.translator.trans('justoverclock-profile-stories.forum.nextStepBtn')}
            </button>
          )}
          {this.step === 1 && (
            <button onclick={this.complete.bind(this)} className="Button" type="submit">
              {app.translator.trans('justoverclock-profile-stories.forum.saveBtn')}
            </button>
          )}
        </form>
      </div>
    );
  }

  stepIncrement() {
    if (this.step < 1) {
      this.step++;
      m.redraw();
    }
    m.redraw();
  }

  stepDecrement() {
    if (this.step > 0) {
      this.step--;
      m.redraw();
    }
    m.redraw();
  }

  complete() {
    app
      .request({
        method: 'POST',
        url: `${app.forum.attribute('apiUrl')}/create-story`,
        body: {
          data: {
            attributes: {
              user_id: this.attrs.userId,
              title: this.story_title(),
              img_url: this.story_imgUrl(),
              cta: this.story_cta(),
              content_icon: this.story_icon(),
              content_text: this.story_text(),
              content_cta: this.story_content_cta(),
              content_link: this.story_content_link(),
              username: this.attrs.username,
            },
          },
        },
      })
      .then(() => {
        this.hide();
        this.attrs.refreshStories();
      });
  }
}
