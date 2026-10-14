import app from 'flarum/admin/app';
import Extend from 'flarum/common/extenders';

export default [
  new Extend.Admin('framio-moderation:moderator-warnings') //
    .permission(
      () => ({
        icon: 'fas fa-images',
        label: app.translator.trans('fof-moderator-warnings.admin.permissions.view_warnings'),
        permission: 'user.viewWarnings',
      }),
      'moderate',
      3
    )
    .permission(
      () => ({
        icon: 'fas fa-edit',
        label: app.translator.trans('fof-moderator-warnings.admin.permissions.manage_warnings'),
        permission: 'user.manageWarnings',
      }),
      'moderate',
      3
    )
    .permission(
      () => ({
        icon: 'fas fa-times',
        label: app.translator.trans('fof-moderator-warnings.admin.permissions.delete_warnings'),
        permission: 'user.deleteWarnings',
      }),
      'moderate',
      3
    ),
];
