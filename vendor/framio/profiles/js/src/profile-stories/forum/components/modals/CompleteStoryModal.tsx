import Modal, { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Mithril from 'mithril';
import { Story } from '../../types';
import Link from 'flarum/common/components/Link';
import app from 'flarum/forum/app';

interface CompleteStoryModalAttrs extends IInternalModalAttrs {
  story: Story;
}

export default class CompleteStoryModal extends Modal<CompleteStoryModalAttrs> {
  className(): string {
    return 'complete-story-modal';
  }

  title(): Mithril.Children {
    const { story } = this.attrs;
    return `${app.session?.user?.displayName()} ${app.translator.trans('justoverclock-profile-stories.forum.StoryModalTitle')}`;
  }

  content(): Mithril.Children {
    const { story } = this.attrs;
    return (
      <div className="complete-story-container">
        <div className="complete-story-content">
          <div className="complete-story-title">
            <i class={`story-icon fa-solid ${story.attributes.contentIcon}`}></i>
            <h3>{story.attributes.title}</h3>
          </div>
          <img className="complete-story-img" src={story.attributes.imgUrl} alt={story.attributes.title} />
          <p>{m.trust(story.attributes.contentText)}</p>
          <div className="complete-story-btn">
            <Link href={story.attributes.contentLink}>
              <button className="Button final-button">{story.attributes.contentCta}</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
