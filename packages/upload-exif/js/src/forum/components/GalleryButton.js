import Component from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import Tooltip from 'flarum/common/components/Tooltip';
import app from 'flarum/forum/app';
import GalleryModal from './GalleryModal';

export default class GalleryButton extends Component {
  view() {
    return (
      <Tooltip text="Yüklemelerim (Galeri)">
        <button 
            className="Button Button--icon Button--link hasIcon" 
            type="button"
            onclick={() => app.modal.show(GalleryModal, { editor: this.attrs.editor })}
        >
            <Icon name="fas fa-images" />
            <span className="Button-label">Galeri</span>
        </button>
      </Tooltip>
    );
  }
}