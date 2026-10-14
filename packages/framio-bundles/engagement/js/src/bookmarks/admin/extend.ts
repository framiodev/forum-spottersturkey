import app from 'flarum/admin/app';
import Extend from 'flarum/common/extenders';
import commonExtend from '../common/extend';

export default [
  ...commonExtend,

  new Extend.Admin()
    .setting(() => ({
      setting: 'fof-bookmarks.independentButton',
      label: app.translator.trans('fof-bookmarks.admin.settings.independent_button'),
      help: app.translator.trans('fof-bookmarks.admin.settings.independent_button_help'),
      type: 'boolean',
    }))
    .setting(() => ({
      setting: 'fof-bookmarks.postButtonPosition',
      label: app.translator.trans('fof-bookmarks.admin.settings.post_button_position'),
      type: 'select',
      options: {
        header: app.translator.trans('fof-bookmarks.admin.settings.post_button_position_header'),
        actions: app.translator.trans('fof-bookmarks.admin.settings.post_button_position_actions'),
        menu: app.translator.trans('fof-bookmarks.admin.settings.post_button_position_menu'),
      },
    }))
    .setting(() => ({
      setting: 'fof-bookmarks.postHeaderBadge',
      label: app.translator.trans('fof-bookmarks.admin.settings.post_header_badge'),
      help: app.translator.trans('fof-bookmarks.admin.settings.post_header_badge_help'),
      type: 'boolean',
    })),
];
