import Extend from 'flarum/common/extenders';
import FormattingExtensionSettingsPage from './components/FormattingExtensionSettingsPage';

export default [
  new Extend.Admin('framio-content:formatting') //
    .page(FormattingExtensionSettingsPage),
];
