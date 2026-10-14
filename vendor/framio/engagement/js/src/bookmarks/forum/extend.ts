import commonExtend from '../common/extend';
import Extend from 'flarum/common/extenders';
import Discussion from 'flarum/common/models/Discussion';
import Post from 'flarum/common/models/Post';
import BookmarksPage from './pages/BookmarksPage';

export default [
  ...commonExtend,

  new Extend.Routes() //
    .add('fof-bookmarks', '/bookmarks', BookmarksPage)
    .add('framio-bookmarks', '/bookmarks', BookmarksPage),

  new Extend.Model(Discussion) //
    .attribute<boolean>('bookmarked'),

  new Extend.Model(Post) //
    .attribute<boolean>('bookmarked'),
];
