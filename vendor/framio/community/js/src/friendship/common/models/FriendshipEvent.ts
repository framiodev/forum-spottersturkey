import Model from 'flarum/common/Model';
import type User from 'flarum/common/models/User';

export default class FriendshipEvent extends Model {
  action = Model.attribute<string>('action');
  createdAt = Model.attribute<Date, string>('createdAt', Model.transformDate);

  otherUser = Model.hasOne<User>('otherUser');
  actor = Model.hasOne<User>('actor');
}
