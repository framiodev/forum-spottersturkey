import Extend from 'flarum/common/extenders';
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';
import Alert from 'flarum/common/components/Alert';
import type ExtensionPage from 'flarum/admin/components/ExtensionPage';

const settingKey = 'fof-news-widget.lines';

export default [
  new Extend.Admin('framio-widgets:news-widget') //
    .customSetting(function (this: ExtensionPage) {
      const value = JSON.parse(this.setting(settingKey)() || '[]');

      return (
        <div className="Form-group">
          <div className="FoF-NewsWidget-htmlWarning">
            <Button
              className="Button"
              onclick={() => {
                this.setting(settingKey)(JSON.stringify([...value, '']));
              }}
            >
              {app.translator.trans('fof-news-widget.admin.settings.add_line')}
            </Button>
            <Alert dismissible={false}>{app.translator.trans('fof-news-widget.admin.settings.html_warning')}</Alert>
          </div>
          {!!value.length && (
            <div className="FoF-NewsWidget-lines">
              <label>{app.translator.trans('fof-news-widget.admin.settings.lines')}</label>
              {value.map((line: string, index: number) => (
                <div className="FoF-NewsWidget-lineSetting">
                  <textarea
                    className="FormControl"
                    oninput={(e: any) => {
                      value[index] = e.target.value;
                      this.setting(settingKey)(JSON.stringify([...value]));
                    }}
                  >
                    {line}
                  </textarea>
                  <Button
                    className="Button Button--icon"
                    icon="fas fa-trash"
                    aria-label={app.translator.trans('fof-news-widget.admin.settings.remove_line')}
                    onclick={() => {
                      this.setting(settingKey)(JSON.stringify([...value.filter((_l: string, i: number) => i !== index)]));
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }),
];
