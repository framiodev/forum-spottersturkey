import Extend from 'flarum/common/extenders';
import app from 'flarum/admin/app';
import StoriesSettingsPage from './components/StoriesSettingsPage';

export default [
  new Extend.Admin('framio-profiles:profile-stories')
    .page(StoriesSettingsPage)
    .permission(
      () => ({
        icon: 'fas fa-book-open',
        label: app.translator.trans('justoverclock-profile-stories.admin.permission.createStory'),
        permission: 'createStory',
        allowGuest: false,
      }),
      'start'
    )
    .permission(
      () => ({
        icon: 'fas fa-book-open',
        label: app.translator.trans('justoverclock-profile-stories.admin.permission.viewStory'),
        permission: 'viewStory',
        allowGuest: true,
      }),
      'view'
    )
    .permission(
      () => ({
        icon: 'fas fa-book-open',
        label: app.translator.trans('justoverclock-profile-stories.admin.permission.editStory'),
        permission: 'editStory',
        allowGuest: false,
      }),
      'moderate'
    )
    .permission(
      () => ({
        icon: 'fas fa-book-open',
        label: app.translator.trans('justoverclock-profile-stories.admin.permission.deleteStory'),
        permission: 'deleteStory',
        allowGuest: false,
      }),
      'moderate'
    ),
];
