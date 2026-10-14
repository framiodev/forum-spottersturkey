import app from 'flarum/forum/app';

import DraftsListState from './states/DraftsListState';
import addComposerIntegration from './addComposerIntegration';
import addDraftsDropdown from './addDraftsDropdown';
import addPreferences from './addPreferences';
import type Draft from './models/Draft';

export { default as extend } from './extend';

function startScheduleWatcher() {
  // Immediately load drafts on startup if logged in
  if (app.session?.user && app.drafts && !app.cache.draftsLoaded) {
    app.drafts.load();
  }

  setInterval(() => {
    if (!app.session?.user) return;

    // Check if there are any drafts in store
    const allDrafts = app.store.all<Draft>('drafts');
    const now = new Date().getTime();
    const hasDueScheduledDrafts = allDrafts.some((d) => {
      const s = d.scheduledFor();
      return s && s.getTime() <= now;
    });

    if (hasDueScheduledDrafts) {
      app
        .request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/drafts/publish-due',
          errorHandler: () => {}, // Don't show modal red alert
        })
        .then((res: any) => {
          if (res && res.published > 0) {
            // Reload drafts
            if (app.drafts) {
              app.drafts.load(true);
            }

            // If user is currently on a discussion page, smoothly reload it
            if (app.current.data?.discussion) {
              window.location.reload();
            } else {
              m.redraw();
            }

            // Notification alert
            app.alerts.show({ type: 'success' }, 'Planlanan içeriğiniz başarıyla yayınlandı.');
          }
        })
        .catch(() => {});
    }
  }, 10000); // Check every 10 seconds
}

app.initializers.add('fof-drafts', () => {
  app.drafts = new DraftsListState();

  addComposerIntegration();
  addDraftsDropdown();
  addPreferences();
  startScheduleWatcher();
});
