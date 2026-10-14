import Extend from 'flarum/common/extenders';
import Text from './models/Text';
import UserDirectoryPage from './components/UserDirectoryPage';

export default [
  new Extend.Store() //
    .add('fof-user-directory-text', Text),

  new Extend.Routes() //
    .add('fof_user_directory', '/users', UserDirectoryPage),
];
