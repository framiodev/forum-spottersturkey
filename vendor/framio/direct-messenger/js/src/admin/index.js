import app from 'flarum/admin/app';
import DirectMessengerSettingsPage from './components/DirectMessengerSettingsPage';
import extend from './extend';

export { extend };
export default extend;

app.initializers.add('framio-direct-messenger', (app) => {
  // Ensure the page is registered in registry for direct-messenger
  if (app.registry) {
    app.registry.for('framio-direct-messenger').registerPage(DirectMessengerSettingsPage);
  }
});
