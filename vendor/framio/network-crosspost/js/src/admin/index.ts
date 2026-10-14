import app from 'flarum/admin/app';
import CrosspostSettingsPage from './components/CrosspostSettingsPage';

app.initializers.add('framio-network-crosspost', () => {
  app.registry
    .for('framio-network-crosspost')
    .registerPage(CrosspostSettingsPage)
    .registerPermission(
      {
        icon: 'fas fa-network-wired',
        label: app.translator.trans('framio-network-crosspost.admin.permissions.crosspost'),
        permission: 'discussion.crosspost',
      },
      'moderate'
    );
});
