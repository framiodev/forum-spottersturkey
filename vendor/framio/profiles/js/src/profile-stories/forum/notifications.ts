export interface Notification {
  name: string;
  label: string;
  icon: string;
}

export const REP_NOTIFICATIONS: Array<Notification> = [{ name: 'newStory', icon: 'fas fa-book-open', label: 'New Story' }];
