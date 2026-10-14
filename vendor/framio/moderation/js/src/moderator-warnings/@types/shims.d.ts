import User from 'flarum/common/models/User';
import Warning from '../forum/model/Warning';

declare module 'flarum/common/models/User' {
  export default interface User {
    canViewWarnings(): boolean;
    canManageWarnings(): boolean;
    canDeleteWarnings(): boolean;
    visibleWarningCount(): number;
  }
}

declare module 'flarum/common/models/Post' {
  export default interface Post {
    warnings(): Warning[] | null;
  }
}
