import app from 'flarum/admin/app';

export function initUserMapAdmin() {
  app.initializers.add('framio-profiles-user-map', () => {
    app.registry
      .for('framio-profiles:user-map')
      .registerSetting({
        setting: 'framio-profiles.user-map.mapHeight',
        label: () => app.translator.trans('framio-profiles-map.admin.settings.map_height'),
        help: () => app.translator.trans('framio-profiles-map.admin.settings.map_height_help'),
        type: 'number',
        default: 500,
      })
      .registerSetting({
        setting: 'framio-profiles.user-map.fullWidth',
        label: () => app.translator.trans('framio-profiles-map.admin.settings.full_width'),
        help: () => app.translator.trans('framio-profiles-map.admin.settings.full_width_help'),
        type: 'boolean',
        default: false,
      })
      .registerSetting({
        setting: 'framio-profiles.user-map.useMasquerade',
        label: () => app.translator.trans('framio-profiles-map.admin.settings.use_masquerade'),
        help: () => app.translator.trans('framio-profiles-map.admin.settings.use_masquerade_help'),
        type: 'boolean',
        default: true,
      });
  });
}
