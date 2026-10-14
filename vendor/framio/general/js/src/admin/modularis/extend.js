import Extend from 'flarum/common/extenders';
import Style from './model/Style';
import ModularisAdminPage from './components/ModularisAdminPage';

export default [
  new Extend.Store().add('modularis-styles', Style),

  new Extend.Admin().page(ModularisAdminPage),
];
