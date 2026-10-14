import commonExtend from '../common/extend';
import Extend from 'flarum/common/extenders';
import User from 'flarum/common/models/User';
import Forum from 'flarum/common/models/Forum';

export default [
  new Extend.Model(User) //
    .attribute<number>('prettyCommentCount'),

  new Extend.Model(Forum) //
    .hasMany<User>('topPosters'),
];
