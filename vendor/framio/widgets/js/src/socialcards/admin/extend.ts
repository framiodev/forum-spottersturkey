import app from 'flarum/admin/app';
import Extend from 'flarum/common/extenders';

export default [
  new Extend.Admin('framio-widgets:socialcards') //
    .setting(() => ({
      setting: 'justoverclock-socialcards.hide.facebook',
      label: app.translator.trans('flarum-ext-socialcards.admin.settings.showfacebook'),
      type: 'boolean',
    }))
    .setting(() => ({
      setting: 'justoverclock-guestengagement.fblink',
      name: 'fblink',
      type: 'url',
      label: app.translator.trans('flarum-ext-socialcards.admin.settings.fblink'),
      help: 'e.g. https://www.facebook.com',
    }))
    .setting(() => ({
      setting: 'justoverclock-socialcards.hide.youtube',
      label: app.translator.trans('flarum-ext-socialcards.admin.settings.showyoutube'),
      type: 'boolean',
    }))
    .setting(() => ({
      setting: 'justoverclock-guestengagement.ytlink',
      name: 'ytlink',
      type: 'url',
      label: app.translator.trans('flarum-ext-socialcards.admin.settings.ytlink'),
      help: 'e.g. https://www.youtube.com',
    }))
    .setting(() => ({
      setting: 'justoverclock-socialcards.hide.twitter',
      label: app.translator.trans('flarum-ext-socialcards.admin.settings.showtwitter'),
      type: 'boolean',
    }))
    .setting(() => ({
      setting: 'justoverclock-guestengagement.twlink',
      name: 'twlink',
      type: 'url',
      label: app.translator.trans('flarum-ext-socialcards.admin.settings.twlink'),
      help: 'e.g. https://www.twitter.com',
    }))
    .setting(() => ({
      setting: 'justoverclock-socialcards.hide.github',
      label: app.translator.trans('flarum-ext-socialcards.admin.settings.showGithub'),
      type: 'boolean',
    }))
    .setting(() => ({
      setting: 'justoverclock-guestengagement.ghlink',
      name: 'ghlink',
      type: 'url',
      label: app.translator.trans('flarum-ext-socialcards.admin.settings.ghlink'),
      help: 'e.g. https://www.github.com',
    })),
];
