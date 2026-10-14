import ExtensionPage, { ExtensionPageAttrs } from 'flarum/admin/components/ExtensionPage';
import app from 'flarum/admin/app';
import Mithril from 'mithril';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';

export default class StoriesSettingsPage extends ExtensionPage {
  fileInput: HTMLInputElement | null = null;
  filepath: string | null = null;

  oninit(vnode: Mithril.Vnode<ExtensionPageAttrs, this>) {
    super.oninit(vnode);
    this.fileInput = null;
    this.filepath = '';
  }

  oncreate(vnode: Mithril.VnodeDOM<ExtensionPageAttrs, this>) {
    super.oncreate(vnode);
  }

  uploadStoryBanner(url = `${app.forum.attribute('apiUrl')}/banner/upload`) {
    if (!this.fileInput || !this.fileInput.files?.length) {
      app.alerts.show({ type: 'error' }, 'Please select a file to upload.');
      return;
    }

    const file: File = this.fileInput.files[0];
    const formData = new FormData();
    formData.append('storyBanner', file);

    app
      .request({
        method: 'POST',
        url,
        body: formData,
      })
      .then((response) => {
        // @ts-ignore
        this.filepath = response.data.attributes.path;
        app.alerts.show({ type: 'success' }, 'Banner uploaded successfully!');
      })
      .catch((error) => {
        console.error('Upload failed:', error);
        app.alerts.show({ type: 'error' }, 'Failed to upload the banner. Please try again.');
      })
      .finally(() => {
        m.redraw();
        window.location.reload();
      });
  }

  content(vnode: Mithril.VnodeDOM<ExtensionPageAttrs, this>): JSX.Element {
    const path = app.forum.attribute('baseUrl');
    const image = app.forum.attribute('justoverclock-profile-stories.imagePreview') || 'https://placehold.co/1920x400';
    const imagePreview = image ? `${path}/assets/${image}` : '';

    return (
      <div className="profileStoryContainer">
        <div className="preview-storybanner">
          <img src={imagePreview} alt="Preview" />
        </div>
        <label for="storyBanner">{app.translator.trans('justoverclock-profile-stories.admin.uploadLabel')}</label>
        <p className="helpText">{app.translator.trans('justoverclock-profile-stories.admin.uploadLabelHelp')}</p>
        <input
          id="storyBanner"
          className="FormControl"
          type="file"
          name="storyBanner"
          onchange={(event: Event) => {
            this.fileInput = event.target as HTMLInputElement;
          }}
        />
        <button
          onclick={() => {
            this.uploadStoryBanner();
          }}
          className="Button"
        >
          Save
        </button>
      </div>
    );
  }
}
