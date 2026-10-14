import app from 'flarum/admin/app';
import Extend from 'flarum/common/extenders';

export default [
  new Extend.Admin('framio-widgets:online-users')
    .setting(() => ({
      setting: 'framio-activity.enabled',
      type: 'boolean',
      label: 'Anlık etkinliği göster (kim hangi sayfada, neye yanıt yazıyor)',
      help: 'Üyelerin hangi tartışmayı okuduğu, kimin profiline baktığı, hangi tartışmaya yanıt yazdığı gösterilir. Yazılan metin hiçbir zaman gösterilmez. Üyeler kendi ayarlarından etkinliklerini gizleyebilir.',
    }))
    .setting(() => ({
      setting: 'fof-online-users-widget.max_users',
      label: app.translator.trans('fof-online-users-widget.admin.settings.max_users'),
      type: 'number',
    }))
    .setting(() => ({
      setting: 'fof-online-users-widget.last_seen_interval',
      label: app.translator.trans('fof-online-users-widget.admin.settings.last_seen_interval'),
      type: 'number',
    }))
    .setting(() => ({
      setting: 'fof-online-users-widget.cache_ttl',
      label: app.translator.trans('fof-online-users-widget.admin.settings.cache_ttl'),
      type: 'number',
    }))
    .permission(
      () => ({
        icon: 'fas fa-user-clock',
        label: app.translator.trans('fof-online-users-widget.admin.permissions.view_online_users_widget'),
        permission: 'viewOnlineUsersWidget',
        allowGuest: true,
      }),
      'view'
    )
    .permission(
      () => ({
        icon: 'fas fa-binoculars',
        label: 'Çevrimiçi üyelerin ne yaptığını görebilir',
        permission: 'framio.viewUserActivity',
      }),
      'view'
    ),
];
