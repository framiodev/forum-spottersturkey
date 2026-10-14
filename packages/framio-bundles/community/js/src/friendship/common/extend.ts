import Extend from 'flarum/common/extenders';
import Friendship from './models/Friendship';
import FriendshipRequest from './models/FriendshipRequest';
import FriendshipEvent from './models/FriendshipEvent';

export default [
  new Extend.Store()
    .add('friendships', Friendship)
    .add('friendship-requests', FriendshipRequest)
    .add('friendship-events', FriendshipEvent),
];
