import Model from 'flarum/common/Model';
import type User from 'flarum/common/models/User';

export default class FriendshipRequest extends Model {
  createdAt = Model.attribute<Date, string>('createdAt', Model.transformDate);

  sender = Model.hasOne<User>('sender');
  recipient = Model.hasOne<User>('recipient');
}
