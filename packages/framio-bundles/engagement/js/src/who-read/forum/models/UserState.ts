import Model from 'flarum/common/Model';
import User from 'flarum/common/models/User';

// API alanları camelCase gelir (WhoReaderResource: lastReadAt, lastReadPostNumber)
export default class UserState extends Model {
    last_read_at = Model.attribute<string>('lastReadAt');
    last_read_post_number = Model.attribute<number | null>('lastReadPostNumber');
    subscription = Model.attribute<string | null>('subscription');
    unread = Model.attribute<boolean>('unread');
    user = Model.hasOne<User>('user');
}
