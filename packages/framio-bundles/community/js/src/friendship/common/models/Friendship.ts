import Model from 'flarum/common/Model';
import type User from 'flarum/common/models/User';

export default class Friendship extends Model {
  createdAt = Model.attribute<Date, string>('createdAt', Model.transformDate);

  user = Model.hasOne<User>('user');
  friend = Model.hasOne<User>('friend');
}
