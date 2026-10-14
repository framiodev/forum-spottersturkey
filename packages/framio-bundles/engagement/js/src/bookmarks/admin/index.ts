import app from 'flarum/admin/app';

app.initializers.add('framio-bookmarks', () => {
  const registerOn = (id: string) => {
    app.registry
      .for(id)
      .registerSetting({
        setting: 'fof-bookmarks.independentButton',
        label: app.translator.trans('framio-bookmarks.admin.settings.independent_button'),
        help: app.translator.trans('framio-bookmarks.admin.settings.independent_button_help'),
        type: 'boolean',
      })
      .registerSetting({
        setting: 'fof-bookmarks.postButtonPosition',
        label: app.translator.trans('framio-bookmarks.admin.settings.post_button_position'),
        type: 'select',
        options: {
          header: app.translator.trans('framio-bookmarks.admin.settings.post_button_position_header'),
          actions: app.translator.trans('framio-bookmarks.admin.settings.post_button_position_actions'),
          menu: app.translator.trans('framio-bookmarks.admin.settings.post_button_position_menu'),
        },
      })
      .registerSetting({
        setting: 'fof-bookmarks.postHeaderBadge',
        label: app.translator.trans('framio-bookmarks.admin.settings.post_header_badge'),
        help: app.translator.trans('framio-bookmarks.admin.settings.post_header_badge_help'),
        type: 'boolean',
      });
  };

  registerOn('framio-engagement:bookmarks');
  registerOn('fof-bookmarks');
});
