import app from 'flarum/admin/app';
import type { SelectFieldComponentOptions } from 'flarum/common/components/FormGroup';

const networks = [
  'whatsapp',
  'telegram',
  'linkedin',
  'twitter',
  'facebook',
  'reddit',
  'threads',
  'bluesky',
  'mastodon',
  'pinterest',
  'tumblr',
  'viber',
  'skype',
  'email',
  'vkontakte',
  'odnoklassniki',
  'my_mail',
  'qq',
  'qzone',
  'native',
];

app.initializers.add('fof/share-social', () => {
  const registerOn = (id: string) => {
    const set = app.registry
      .for(id)
      .registerSetting({
      label: app.translator.trans('fof-share-social.admin.settings.canonical-urls'),
      setting: 'fof-share-social.canonical-urls',
      type: 'boolean',
    })
    .registerSetting({
      label: app.translator.trans('fof-share-social.admin.settings.plain-copy'),
      setting: 'fof-share-social.plain-copy',
      type: 'boolean',
    })
    .registerSetting({
      label: app.translator.trans('fof-share-social.admin.settings.default-option'),
      help: app.translator.trans('fof-share-social.admin.settings.default-option-help'),
      setting: 'fof-share-social.default-option',
      type: 'select',
      options: networks.reduce(
        (o, network) => {
          o[network] = app.translator.trans(`fof-share-social.lib.networks.${network}`);
          return o;
        },
        { '': '' } as SelectFieldComponentOptions['options']
      ),
    })
    .registerSetting({
      label: app.translator.trans('fof-share-social.admin.settings.custom-networks'),
      help: app.translator.trans('fof-share-social.admin.settings.custom-networks-help'),
      placeholder: app.translator.trans('fof-share-social.admin.settings.custom-networks-placeholder'),
      setting: 'fof-share-social.custom-networks',
      type: 'textarea',
      rows: 4,
    })
    .registerSetting(function () {
      return (
        <div>
          <hr />
          <h4 style="margin: 15px 0 10px 0; font-weight: bold;">
            {app.translator.trans('fof-share-social.admin.settings.networks-heading')}
          </h4>
        </div>
      );
    });

    networks.forEach((network) =>
      set.registerSetting({
        label: app.translator.trans(`fof-share-social.lib.networks.${network}`),
        setting: `fof-share-social.networks.${network}`,
        type: 'boolean',
      })
    );
  };

  registerOn('framio-engagement:share-social');
  registerOn('fof-share-social');
});
