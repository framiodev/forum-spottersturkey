import Extend from 'flarum/common/extenders';
import DirectMessengerSettingsPage from './components/DirectMessengerSettingsPage';

export default [
  new Extend.Admin()
    .permission(
      () => ({
        icon: 'fas fa-paper-plane',
        label: 'Özel Mesaj Gönderebilir',
        permission: 'direct-messenger.send',
      }),
      'start'
    )
    .page(DirectMessengerSettingsPage),
];
