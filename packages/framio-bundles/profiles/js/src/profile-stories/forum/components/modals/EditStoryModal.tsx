import Modal, {IInternalModalAttrs} from "flarum/common/components/Modal";
import Mithril from "mithril";
import app from 'flarum/forum/app';
import Stream from 'flarum/common/utils/Stream';
import {StoryAttributes} from "../../types";
import User from "flarum/common/models/User";

export interface Story {
  type: string
  id: string
  attributes: StoryAttributes
}

export interface EditStoryModalAttrs extends IInternalModalAttrs {
  story: Story
  user: User
}

export default class EditStoryModal extends Modal<EditStoryModalAttrs> {
  story_title = Stream('');
  story_imgUrl = Stream('');
  story_cta = Stream('');
  story_icon = Stream('');
  story_text = Stream('');
  story_content_cta = Stream('');
  story_content_link = Stream('');

  oncreate(vnode: Mithril.VnodeDOM<EditStoryModalAttrs, this>) {
    super.oncreate(vnode);
    this.story_title(this.attrs.story.attributes.title)
    this.story_imgUrl(this.attrs.story.attributes.imgUrl)
    this.story_cta(this.attrs.story.attributes.cta)
    this.story_icon(this.attrs.story.attributes.contentIcon)
    this.story_text(this.attrs.story.attributes.contentText)
    this.story_content_cta(this.attrs.story.attributes.contentCta)
    this.story_content_link(this.attrs.story.attributes.contentLink)
  }

  className(): string {
    return 'edit-story-modal';
  }

  title(): Mithril.Children {
    return `${app.translator.trans('justoverclock-profile-stories.forum.editStoryModal')}`;
  }

  content(): Mithril.Children {
    return (
      <div className="new-story-container">
        <div className="new-story-content">
          <div className="story-step-container">
            <label htmlFor="title">
              {app.translator.trans('justoverclock-profile-stories.forum.storyTitleInput')}
            </label>
            <input
              value={this.story_title()}
              oninput={(e: { target: { value: string } }) => this.story_title(e.target.value)}
              placeholder={this.attrs.story.attributes.title}
              className="FormControl"
              type="text"
            />
            <label htmlFor="story_imgUrl">
              {app.translator.trans('justoverclock-profile-stories.forum.storyImgInput')}
            </label>
            <input
              value={this.story_imgUrl()}
              oninput={(e: { target: { value: string } }) => this.story_imgUrl(e.target.value)}
              placeholder={app.translator.trans('justoverclock-profile-stories.forum.storyImage')}
              className="FormControl"
              type="url"
            />
            <label htmlFor="story_cta">
              {app.translator.trans('justoverclock-profile-stories.forum.storyBtnTextInput')}
            </label>
            <input
              value={this.story_cta()}
              oninput={(e: { target: { value: string } }) => this.story_cta(e.target.value)}
              placeholder={app.translator.trans('justoverclock-profile-stories.forum.storyCta')}
              className="FormControl"
              type="text"
            />
            <label htmlFor="story_icon">
              {app.translator.trans('justoverclock-profile-stories.forum.storyIconInput')}
            </label>
            <input
              value={this.story_icon()}
              oninput={(e: { target: { value: string } }) => this.story_icon(e.target.value)}
              placeholder={app.translator.trans('justoverclock-profile-stories.forum.storyIcon')}
              className="FormControl"
              type="text"
            />
            <label htmlFor="story_content_link">
              {app.translator.trans('justoverclock-profile-stories.forum.storyLinkInput')}
            </label>
            <input
              value={this.story_content_link()}
              oninput={(e: { target: { value: string } }) => this.story_content_link(e.target.value)}
              placeholder={app.translator.trans('justoverclock-profile-stories.forum.storyContentLink')}
              className="FormControl"
              type="text"
            />
            <label htmlFor="story_content_cta">
              {app.translator.trans('justoverclock-profile-stories.forum.storyLinkButtonInput')}
            </label>
            <input
              value={this.story_content_cta()}
              oninput={(e: { target: { value: string } }) => this.story_content_cta(e.target.value)}
              placeholder={app.translator.trans('justoverclock-profile-stories.forum.storyContentCta')}
              className="FormControl"
              type="text"
            />
            <label htmlFor="story_text">
              {app.translator.trans('justoverclock-profile-stories.forum.storyTextInput')}
            </label>
            <textarea
              rows={6}
              value={this.story_text()}
              oninput={(e: { target: { value: string } }) => this.story_text(e.target.value)}
              placeholder={app.translator.trans('justoverclock-profile-stories.forum.storyContentText')}
              className="FormControl"
            />
          </div>
        </div>
        <form className="new-story-actions">
          <button className="Button" onclick={this.editStory.bind(this)}>
            {app.translator.trans('justoverclock-profile-stories.forum.editStoryModalBtn')}
          </button>
        </form>
      </div>
    );
  }

  editStory() {
    app
      .request({
        method: 'PATCH',
        url: `${app.forum.attribute('apiUrl')}/stories/${this.attrs.story.id}`,
        body: {
          data: {
            attributes: {
              user_id: this.attrs.story.attributes.userId,
              title: this.story_title(),
              img_url: this.story_imgUrl(),
              cta: this.story_cta(),
              content_icon: this.story_icon(),
              content_text: this.story_text(),
              content_cta: this.story_content_cta(),
              content_link: this.story_content_link(),
              username: this.attrs.user.username(),
            },
          },
        },
      })
      .then(() => {
        this.hide();
        app.alerts.show({ type: 'success' }, app.translator.trans('justoverclock-profile-stories.forum.successEdited'));
      });
  }
}
