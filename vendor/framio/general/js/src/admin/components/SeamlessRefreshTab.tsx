import app from 'flarum/admin/app';
import Component from 'flarum/common/Component';
import Switch from 'flarum/common/components/Switch';
import saveSettings from 'flarum/admin/utils/saveSettings';

export default class SeamlessRefreshTab extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.seamless = app.data.settings['framio-general.seamless_refresh'] !== '0';
    this.mute = app.data.settings['framio-general.mute_prompts'] !== '0';
    this.saving = false;
  }

  save() {
    this.saving = true;
    saveSettings({
      'framio-general.seamless_refresh': this.seamless ? '1' : '0',
      'framio-general.mute_prompts': this.mute ? '1' : '0',
    })
      .then(() => {
        this.saving = false;
        app.alerts.show({ type: 'success' }, app.translator.trans('core.admin.basics.saved_message'));
        m.redraw();
      })
      .catch(() => {
        this.saving = false;
        m.redraw();
      });
  }

  view() {
    return (
      <div className="container SpeedCacheSettingsPage">
        <h2>{app.translator.trans('framio-general.admin.seamless.title')}</h2>
        <p className="helpText" style="max-width: 780px; margin-bottom: 24px; line-height: 1.5;">
          {app.translator.trans('framio-general.admin.seamless.description')}
        </p>

        <div className="Form-group" style="margin-bottom: 20px;">
          <Switch
            state={this.seamless}
            onchange={(val) => {
              this.seamless = val;
              this.save();
            }}
          >
            <strong>{app.translator.trans('framio-general.admin.seamless.enable_label')}</strong>
          </Switch>
          <p className="helpText" style="margin-top: 4px; margin-left: 54px;">
            {app.translator.trans('framio-general.admin.seamless.enable_help')}
          </p>
        </div>

        <div className="Form-group" style="margin-bottom: 20px;">
          <Switch
            state={this.mute}
            onchange={(val) => {
              this.mute = val;
              this.save();
            }}
          >
            <strong>{app.translator.trans('framio-general.admin.seamless.mute_label')}</strong>
          </Switch>
          <p className="helpText" style="margin-top: 4px; margin-left: 54px;">
            {app.translator.trans('framio-general.admin.seamless.mute_help')}
          </p>
        </div>
      </div>
    );
  }
}
