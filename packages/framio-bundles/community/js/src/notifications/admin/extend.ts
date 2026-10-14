import app from 'flarum/admin/app';
import Extend from 'flarum/common/extenders';

export default [
  new Extend.Admin('framio-community:notifications')
    // ─── TELEGRAM ────────────────────────────────────────────
    .setting(() => ({
      setting: 'notifications.telegram_enabled',
      type: 'boolean',
      label: app.translator.trans('framio-notifications.admin.telegram.enabled_label'),
    }))
    .setting(() => ({
      setting: 'notifications.telegram_bot_token',
      type: 'text',
      label: app.translator.trans('framio-notifications.admin.telegram.bot_token_label'),
      help: app.translator.trans('framio-notifications.admin.telegram.bot_token_help'),
    }))
    .setting(() => ({
      setting: 'notifications.telegram_chat_id',
      type: 'text',
      label: app.translator.trans('framio-notifications.admin.telegram.chat_id_label'),
      help: app.translator.trans('framio-notifications.admin.telegram.chat_id_help'),
    }))
    .setting(() => ({
      setting: 'notifications.telegram_thread_id',
      type: 'text',
      label: app.translator.trans('framio-notifications.admin.telegram.thread_id_label'),
      help: app.translator.trans('framio-notifications.admin.telegram.thread_id_help'),
    }))
    .setting(() => ({
      setting: 'notifications.telegram_new_discussion',
      type: 'boolean',
      label: app.translator.trans('framio-notifications.admin.telegram.new_discussion_label'),
    }))
    .setting(() => ({
      setting: 'notifications.telegram_new_reply',
      type: 'boolean',
      label: app.translator.trans('framio-notifications.admin.telegram.new_reply_label'),
    }))
    .setting(() => ({
      setting: 'notifications.telegram_discussion_template',
      type: 'textarea',
      label: app.translator.trans('framio-notifications.admin.telegram.discussion_template_label'),
      help: app.translator.trans('framio-notifications.admin.telegram.template_help'),
    }))
    .setting(() => ({
      setting: 'notifications.telegram_reply_template',
      type: 'textarea',
      label: app.translator.trans('framio-notifications.admin.telegram.reply_template_label'),
      help: app.translator.trans('framio-notifications.admin.telegram.template_help'),
    }))
    // ─── WHATSAPP ─────────────────────────────────────────────
    .setting(() => ({
      setting: 'notifications.whatsapp_enabled',
      type: 'boolean',
      label: app.translator.trans('framio-notifications.admin.whatsapp.enabled_label'),
    }))
    .setting(() => ({
      setting: 'notifications.whatsapp_gateway_url',
      type: 'text',
      label: app.translator.trans('framio-notifications.admin.whatsapp.gateway_url_label'),
      help: app.translator.trans('framio-notifications.admin.whatsapp.gateway_url_help'),
      default: 'http://localhost:3001',
    }))
    .setting(() => ({
      setting: 'notifications.whatsapp_group_id',
      type: 'text',
      label: app.translator.trans('framio-notifications.admin.whatsapp.group_id_label'),
      help: app.translator.trans('framio-notifications.admin.whatsapp.group_id_help'),
    }))
    .setting(() => ({
      setting: 'notifications.whatsapp_new_discussion',
      type: 'boolean',
      label: app.translator.trans('framio-notifications.admin.whatsapp.new_discussion_label'),
    }))
    .setting(() => ({
      setting: 'notifications.whatsapp_new_reply',
      type: 'boolean',
      label: app.translator.trans('framio-notifications.admin.whatsapp.new_reply_label'),
    }))
    .setting(() => ({
      setting: 'notifications.whatsapp_discussion_template',
      type: 'textarea',
      label: app.translator.trans('framio-notifications.admin.whatsapp.discussion_template_label'),
      help: app.translator.trans('framio-notifications.admin.whatsapp.template_help'),
    }))
    .setting(() => ({
      setting: 'notifications.whatsapp_reply_template',
      type: 'textarea',
      label: app.translator.trans('framio-notifications.admin.whatsapp.reply_template_label'),
      help: app.translator.trans('framio-notifications.admin.whatsapp.template_help'),
    })),
];
