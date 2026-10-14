import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import ItemList from 'flarum/common/utils/ItemList';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import formatBytes from '../../common/formatBytes';
import FocusDragArea from './FocusDragArea';

export default class CoverEditorModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);

    this.user = this.attrs.user;
    this.maxSize = parseFloat(app.forum.attribute('sycho-profile-cover.max_size') || 2048);

    this.alertAttrs = {
      content: app.translator.trans('sycho-profile-cover.forum.notice', {
        size: formatBytes(this.maxSize * Math.pow(2, 10)),
      }),
    };

    this.loading = false;
    this.savingPosition = false;
    this.cover = this.user.cover_thumbnail() || this.user.cover();
    this.context = '';

    this.focusX = Number(this.user.attribute('cover_focal_x') ?? 50);
    this.focusY = Number(this.user.attribute('cover_focal_y') ?? 50);
    this.zoom = Number(this.user.attribute('cover_zoom') ?? 1.0);
    this.dirty = false;
  }

  content() {
    return [
      this.cover ? (
        <div className="Modal-image CoverStudio-ModalArea">
          <FocusDragArea
            url={this.cover}
            focusX={this.focusX}
            focusY={this.focusY}
            zoom={this.zoom}
            height={180}
            onchange={(x, y) => {
              this.focusX = x;
              this.focusY = y;
              this.dirty = true;
            }}
            onzoom={(z) => {
              this.zoom = z;
              this.dirty = true;
            }}
          />
          {this.zoomControls()}
        </div>
      ) : (
        <div className="Modal-image CoverEditor-cover">
          {this.loading ? <LoadingIndicator /> : ''}
        </div>
      ),

      <div className="Modal-body">
        <div className="Form">{this.fieldsItems().toArray()}</div>
      </div>,
    ];
  }

  zoomControls() {
    return (
      <div className="CoverStudio-Editor-zoom">
        <label>{app.translator.trans('sycho-profile-cover.forum.zoom_label')}</label>
        <input
          type="range"
          min="0.5"
          max="3.0"
          step="0.05"
          value={this.zoom}
          oninput={(e) => {
            this.zoom = parseFloat(e.target.value);
            this.dirty = true;
          }}
        />
        <Button
          className="Button Button--link CoverStudio-Editor-zoomValue"
          onclick={() => {
            this.zoom = 1;
            this.dirty = true;
          }}
        >
          {Math.round(this.zoom * 100)}%
        </Button>
      </div>
    );
  }

  className() {
    return 'Cover-modal Modal--small';
  }

  title() {
    return app.translator.trans('sycho-profile-cover.forum.edit_cover');
  }

  fieldsItems() {
    const items = new ItemList();

    items.add('actions', this.controlItems().toArray());

    if (this.cover) {
      items.add(
        'save-position',
        <div className="CoverStudio-Editor-save">
          <Button
            className="Button Button--primary"
            loading={this.savingPosition}
            disabled={!this.dirty}
            onclick={this.savePosition.bind(this)}
          >
            {app.translator.trans('sycho-profile-cover.forum.save_position')}
          </Button>
        </div>,
        -10
      );
    }

    return items;
  }

  controlItems() {
    const items = new ItemList();

    items.add(
      'upload',
      <Button icon="fas fa-upload" className="Button" onclick={this.openPicker.bind(this)}>
        {app.translator.trans('core.forum.user.avatar_upload_button')}
      </Button>
    );

    if (this.cover) {
      items.add(
        'remove',
        <Button icon="fas fa-times" className="Button Button--danger" onclick={this.remove.bind(this)}>
          {app.translator.trans('core.forum.user.avatar_remove_button')}
        </Button>
      );
    }

    return items;
  }

  openPicker() {
    const input = $('<input type="file" accept="image/*">');

    input
      .appendTo('body')
      .hide()
      .click()
      .on('change', (e) => {
        this.upload($(e.target)[0].files[0]);
        input.remove();
      });
  }

  upload(file) {
    if (this.loading || !file) return;

    const data = new FormData();
    data.append('cover', file);

    this.loading = true;
    this.context = 'added';
    m.redraw();

    app
      .request({
        method: 'POST',
        url: `${app.forum.attribute('apiUrl')}/users/${this.user.id()}/cover`,
        serialize: (raw) => raw,
        body: data,
      })
      .then((res) => {
        this.success(res);
        this.cover = this.user.cover_thumbnail() || this.user.cover();
        m.redraw();
      })
      .catch(this.failure.bind(this));
  }

  savePosition() {
    this.savingPosition = true;
    m.redraw();

    this.user
      .save({
        cover_focal_x: this.focusX,
        cover_focal_y: this.focusY,
        cover_zoom: this.zoom,
      })
      .then(() => {
        this.savingPosition = false;
        this.dirty = false;
        app.alerts.show(
          { type: 'success' },
          app.translator.trans('sycho-profile-cover.forum.position_saved')
        );
        m.redraw();
        this.hide();
      })
      .catch(() => {
        this.savingPosition = false;
        m.redraw();
      });
  }

  remove() {
    this.loading = true;
    this.context = 'removed';
    m.redraw();

    app
      .request({
        method: 'DELETE',
        url: `${app.forum.attribute('apiUrl')}/users/${this.user.id()}/cover`,
      })
      .then(this.success.bind(this), this.failure.bind(this));
  }

  success(response) {
    app.store.pushPayload(response);
    this.showAlert('success');
    this.loading = false;
    m.redraw();
    this.hide();
  }

  failure() {
    this.showAlert('error');
    this.loading = false;
    m.redraw();
  }

  showAlert(type) {
    this.alertAttrs.content = app.translator.trans(`sycho-profile-cover.forum.${this.context}.${type}`);
    this.alertAttrs.type = type;
  }
}
