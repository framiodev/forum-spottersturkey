/**
 * Attributes this extension adds to core's models.
 *
 * Both are registered at runtime by the `Extend.Model` extenders in
 * `forum/extend.ts`, and are serialized by the `bookmarked` API serializer
 * attributes in extend.php.
 */

import 'flarum/common/models/Discussion';
import 'flarum/common/models/Post';

declare module 'flarum/common/models/Discussion' {
  export default interface Discussion {
    bookmarked(): boolean;
  }
}

declare module 'flarum/common/models/Post' {
  export default interface Post {
    bookmarked(): boolean;
  }
}
