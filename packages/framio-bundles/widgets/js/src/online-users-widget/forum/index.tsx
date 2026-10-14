import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserCard from 'flarum/forum/components/UserCard';
import Switch from 'flarum/common/components/Switch';
import Link from 'flarum/common/components/Link';
import registerWidget from '../common/registerWidget';
import extendRealtime from './extendRealtime';
import startActivityTracker from './activityTracker';

export { default as extend } from './extend';

app.initializers.add('fof/online-users-widget', () => {
  registerWidget(app);

  if ('flarum-realtime' in flarum.extensions) {
    extendRealtime();
  }

  // Anlık etkinlik: giriş yapmış üyenin bulunduğu sayfa sunucuya bildirilir
  startActivityTracker();

  // Profil kartı: çevrimiçiyse "şu an ne yapıyor"
  extend(UserCard.prototype, 'infoItems', function (items) {
    const user: any = this.attrs.user;
    const a = user && user.attribute && user.attribute('framioActivity');
    if (!a || !(user.isOnline && user.isOnline())) return;

    items.add(
      'framioActivity',
      <span className={'UserCard-activity' + (a.writing ? ' is-writing' : '')}>
        <i className={a.icon} aria-hidden="true"></i>{' '}
        {a.subject ? (
          <span>
            {a.href ? <Link href={a.href}>{a.subject}</Link> : <strong>{a.subject}</strong>} {a.text}
          </span>
        ) : (
          <span>{a.href ? <Link href={a.href}>{a.text}</Link> : a.text}</span>
        )}
      </span>,
      99
    );
  });

  // Ayarlar → Gizlilik: "Çevrimiçiyken ne yaptığımı göster" (ayarlar sayfası gecikmeli yüklenir)
  extend('flarum/forum/components/SettingsPage', 'privacyItems', function (this: any, items: any) {
    if (app.forum.attribute('framioActivityEnabled') === false) return;
    const prefs = this.user.preferences() || {};
    items.add(
      'framioDiscloseActivity',
      <Switch
        state={prefs.framioDiscloseActivity !== false}
        disabled={prefs.discloseOnline === false}
        onchange={(value: boolean) => {
          this.framioActivityLoading = true;
          this.user.savePreferences({ framioDiscloseActivity: value }).then(() => {
            this.framioActivityLoading = false;
            m.redraw();
          });
        }}
        loading={this.framioActivityLoading}
      >
        Çevrimiçiyken ne yaptığımı göster (hangi tartışmayı okuduğum, neye yanıt yazdığım)
      </Switch>,
      90
    );
  });
});
