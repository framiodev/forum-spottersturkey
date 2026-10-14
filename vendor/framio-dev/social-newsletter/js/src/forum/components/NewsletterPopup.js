import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';

export default class NewsletterPopup extends Component {
    oninit(vnode) {
        super.oninit(vnode);
        this.name = '';
        this.contactType = 'whatsapp';
        this.contactValue = '';
        this.submitting = false;
        this.submitted = false;
        this.visible = false;

        this.delay = parseInt(app.forum.attribute('framio-social-newsletter.popup_delay')) || 30;
        this.title = app.forum.attribute('framio-social-newsletter.popup_title') || 'Bizimle İletişime Geçin';
        this.desc = app.forum.attribute('framio-social-newsletter.popup_desc') || 'Size ulaşabilmemiz için bilgilerinizi bırakın.';

        // Sadece misafirlere göster
        if (!app.session.user) {
            this.setupTriggers();
        }
    }

    setupTriggers() {
        // Scroll event
        const scrollHandler = () => {
            if (window.scrollY > 300 && !this.visible && !this.submitted) {
                this.show();
                window.removeEventListener('scroll', scrollHandler);
            }
        };
        // Add scroll listener with a small delay so it doesn't trigger immediately on refresh if already scrolled down
        setTimeout(() => {
            window.addEventListener('scroll', scrollHandler);
        }, 1000);

        // Exit intent event (when mouse leaves the viewport at the top)
        const exitIntentHandler = (e) => {
            if (e.clientY < 0 && !this.visible && !this.submitted) {
                this.show();
                document.removeEventListener('mouseleave', exitIntentHandler);
            }
        };
        document.addEventListener('mouseleave', exitIntentHandler);

        // Timer
        const delayMs = isNaN(this.delay) || this.delay < 1 ? 30000 : this.delay * 1000;
        this.timer = setTimeout(() => {
            if (!this.visible && !this.submitted) {
                this.show();
                window.removeEventListener('scroll', scrollHandler);
                document.removeEventListener('mouseleave', exitIntentHandler);
            }
        }, delayMs);
    }

    show() {
        this.visible = true;
        m.redraw();
    }

    hide() {
        this.visible = false;
        m.redraw();
    }

    view() {
        if (!this.visible) return null;

        return (
            <div className="SocialNewsletterModal-overlay" onclick={this.hide.bind(this)}>
                <div className="SocialNewsletterModal-content" onclick={e => e.stopPropagation()}>
                    <button className="SocialNewsletterModal-close" onclick={this.hide.bind(this)}>
                        <i className="fas fa-times"></i>
                    </button>

                    {this.submitted ? (
                        <div className="SocialNewsletterModal-success">
                            <i className="fas fa-check-circle"></i>
                            <h3>Teşekkürler!</h3>
                            <p>Bilgileriniz alındı, en kısa sürede sizinle iletişime geçeceğiz.</p>
                            <Button className="Button Button--primary" onclick={this.hide.bind(this)}>Kapat</Button>
                        </div>
                    ) : (
                        <form onsubmit={this.submit.bind(this)}>
                            <h3>{this.title}</h3>
                            <p>{this.desc}</p>

                            <div className="Form-group">
                                <label>İsminiz</label>
                                <input 
                                    className="FormControl" 
                                    required 
                                    value={this.name} 
                                    oninput={e => this.name = e.target.value} 
                                    placeholder="Adınız Soyadınız" 
                                />
                            </div>

                            <div className="Form-group">
                                <label>İletişim Tercihi</label>
                                <select className="FormControl" value={this.contactType} onchange={e => this.contactType = e.target.value}>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="instagram">Instagram</option>
                                </select>
                            </div>

                            <div className="Form-group">
                                <label>{this.contactType === 'whatsapp' ? 'WhatsApp Numaranız' : 'Instagram Kullanıcı Adınız'}</label>
                                <input 
                                    className="FormControl" 
                                    required 
                                    value={this.contactValue} 
                                    oninput={e => this.contactValue = e.target.value} 
                                    placeholder={this.contactType === 'whatsapp' ? 'Örn: 05xx xxx xx xx' : 'Örn: @spottersturkey'} 
                                />
                            </div>

                            <Button className="Button Button--primary Button--block" type="submit" loading={this.submitting}>
                                <i className="fas fa-paper-plane"></i> Gönder
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    submit(e) {
        e.preventDefault();
        this.submitting = true;

        const vapidPublicKey = app.forum.attribute('framio-social-newsletter.vapid_public');

        if ('Notification' in window && 'serviceWorker' in navigator && vapidPublicKey) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    navigator.serviceWorker.register('/sw.js').then(reg => {
                        reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
                        }).then(sub => {
                            this.sendRequest(sub);
                        }).catch(() => this.sendRequest(null));
                    }).catch(() => this.sendRequest(null));
                } else {
                    this.sendRequest(null);
                }
            });
        } else {
            this.sendRequest(null);
        }
    }

    sendRequest(subscription) {
        let pushData = {};
        if (subscription) {
            const subJson = subscription.toJSON();
            pushData = {
                push_endpoint: subJson.endpoint,
                push_p256dh: subJson.keys ? subJson.keys.p256dh : null,
                push_auth: subJson.keys ? subJson.keys.auth : null
            };
        }

        app.request({
            method: 'POST',
            url: app.forum.attribute('apiUrl') + '/framio-social-leads',
            body: {
                data: {
                    attributes: Object.assign({
                        name: this.name,
                        contact_type: this.contactType,
                        contact_value: this.contactValue
                    }, pushData)
                }
            }
        }).then(() => {
            this.submitting = false;
            this.submitted = true;
            m.redraw();

            // Otomatik kapanma
            setTimeout(() => {
                this.hide();
            }, 5000);
        }).catch(() => {
            this.submitting = false;
            m.redraw();
        });
    }
}
