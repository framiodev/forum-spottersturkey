import Extend from 'flarum/common/extenders';
import app from 'flarum/admin/app';

export default [
  new Extend.Admin('framio-profiles:user-map')
    .setting(() => ({
      setting: 'framio-profiles.user-map.mapHeight',
      label: app.translator.trans('framio-profiles-map.admin.settings.map_height'),
      help: app.translator.trans('framio-profiles-map.admin.settings.map_height_help'),
      type: 'number',
      default: 500,
    }))
    .setting(() => ({
      setting: 'framio-profiles.user-map.fullWidth',
      label: app.translator.trans('framio-profiles-map.admin.settings.full_width'),
      help: app.translator.trans('framio-profiles-map.admin.settings.full_width_help'),
      type: 'boolean',
      default: false,
    }))
    .setting(() => ({
      setting: 'framio-profiles.user-map.useMasquerade',
      label: app.translator.trans('framio-profiles-map.admin.settings.use_masquerade'),
      help: app.translator.trans('framio-profiles-map.admin.settings.use_masquerade_help'),
      type: 'boolean',
      default: true,
    })),
];
