import Extend from 'flarum/common/extenders';
import SettingsPage from './components/SettingsPage';

export default [
  new Extend.Admin('framio-community:default-user-preferences') //
    .page(SettingsPage),
];
