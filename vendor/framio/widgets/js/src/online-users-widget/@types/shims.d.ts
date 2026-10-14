import User from 'flarum/common/models/User';

declare module 'flarum/common/models/Forum' {
  export default interface Forum {
    /**
     * `hasMany` yields `undefined` for any identifier not yet in the store, so
     * the widget filters before rendering.
     */
    onlineUsers(): (User | undefined)[] | false;
    totalOnlineUsers(): number | undefined;
  }
}
