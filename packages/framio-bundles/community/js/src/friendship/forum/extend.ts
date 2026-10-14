import Extend from 'flarum/common/extenders';
import commonExtend from '../common/extend';
import FriendsPage from './components/FriendsPage';

export default [...commonExtend, new Extend.Routes().add('user.friendship', '/u/:username/friendship', FriendsPage)];
