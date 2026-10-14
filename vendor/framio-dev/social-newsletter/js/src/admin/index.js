import app from 'flarum/admin/app';
import SocialNewsletterSettingsPage from './components/SocialNewsletterSettingsPage';

app.initializers.add('framio-dev-social-newsletter', () => {
    (app.registry || app.registry).for('framio-dev-social-newsletter').registerPage(SocialNewsletterSettingsPage);

    // Otomatik kapanan success bildirimleri
    const originalShow = app.alerts.show.bind(app.alerts);
    app.alerts.show = function(componentOrAttrs, ...children) {
        const key = originalShow(componentOrAttrs, ...children);
        
        if (componentOrAttrs && componentOrAttrs.type === 'success') {
            setTimeout(() => {
                app.alerts.dismiss(key);
            }, 3000);
        }
        
        return key;
    };
});
