import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Application from 'flarum/common/Application';
import NewsletterPopup from './components/NewsletterPopup';

app.initializers.add('framio-dev-social-newsletter', () => {
    extend(Application.prototype, 'mount', function() {
        const popupContainer = document.createElement('div');
        document.body.appendChild(popupContainer);
        m.mount(popupContainer, NewsletterPopup);
    });

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
