import app from 'flarum/admin/app';
import MenuSettingsPage from './components/MenuSettingsPage';

app.initializers.add('spottersturkey-header-menu', () => {
    (app.registry || app.registry).for('spottersturkey-header-menu').registerPage(MenuSettingsPage);
});
