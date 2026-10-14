import app from 'flarum/forum/app';

/**
 * Giriş yapmış üyenin anlık etkinliğini sunucuya bildirir: hangi sayfada, hangi
 * tartışmada, kimin profilinde, yazma penceresi açıksa neye yazıyor.
 * Yalnızca etkinlik türü ve ilgili kimlik gönderilir; yazılan metin gönderilmez.
 *
 * Değişince (1,5 sn bekleyerek) ve sayfa açık kaldıkça 60 saniyede bir gönderilir.
 */

interface Activity {
  type: string;
  subjectId?: number | null;
  extra?: string | null;
}

function id(model: any): number | null {
  try {
    const v = model && typeof model.id === 'function' ? model.id() : null;
    return v ? Number(v) : null;
  } catch (e) {
    return null;
  }
}

function currentActivity(): Activity {
  // Yazma penceresi açıksa öncelik onda
  const composer: any = (app as any).composer;
  try {
    if (composer && composer.body && composer.body.componentClass && (!composer.isVisible || composer.isVisible())) {
      const attrs = composer.body.attrs || {};
      if (attrs.post) {
        const disc = attrs.post.discussion && attrs.post.discussion();
        return { type: 'composing_edit', subjectId: id(disc) };
      }
      if (attrs.discussion) return { type: 'composing_reply', subjectId: id(attrs.discussion) };
      return { type: 'composing_discussion' };
    }
  } catch (e) {}

  const route: string = (app.current && (app.current.get('routeName') as string)) || '';
  const param = (k: string) => {
    try {
      return m.route.param(k);
    } catch (e) {
      return null;
    }
  };

  if (route === 'tags' || route === '' || route === 'home') return { type: 'home' };
  if (route === 'index') return { type: 'index', extra: param('sort') || null };
  if (route === 'tag') return { type: 'tag', subjectId: id((app as any).currentTag && (app as any).currentTag()) };
  if (route.startsWith('discussion')) return { type: 'discussion', subjectId: id(app.current.get('discussion')) };
  if (route === 'user' || route.startsWith('user.')) return { type: 'profile', subjectId: id(app.current.get('user')) };
  if (route === 'notifications') return { type: 'notifications' };
  if (route === 'settings') return { type: 'settings' };
  if (/message|conversation|chat|byobu|private/i.test(route)) return { type: 'messages' };
  if (param('q')) return { type: 'search' };
  return { type: 'other' };
}

let lastSig = '';
let lastSent = 0;
let pending: number | null = null;

function send(force = false) {
  if (!app.session.user || app.forum.attribute('framioActivityEnabled') === false) return;
  const a = currentActivity();
  const sig = JSON.stringify(a);
  if (!force && sig === lastSig && Date.now() - lastSent < 60000) return;
  lastSig = sig;
  lastSent = Date.now();
  app
    .request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio-activity',
      body: a,
      errorHandler: () => {},
    } as any)
    .catch(() => {});
}

function schedule() {
  if (pending) window.clearTimeout(pending);
  pending = window.setTimeout(() => {
    pending = null;
    send();
  }, 1500);
}

export default function startActivityTracker() {
  if ((window as any).__framioActivityTracker) return;
  (window as any).__framioActivityTracker = true;

  // Sayfa geçişleri
  (['pushState', 'replaceState'] as const).forEach((fn) => {
    const orig = history[fn];
    history[fn] = function (this: History, ...args: any[]) {
      const r = (orig as any).apply(this, args);
      schedule();
      return r;
    } as any;
  });
  window.addEventListener('popstate', schedule);

  // Yazma penceresi açılıp kapanması ve sayfa açık kaldıkça tazeleme (5 sn'de bir kontrol, değişince gönder)
  window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const sig = JSON.stringify(currentActivity());
    if (sig !== lastSig) schedule();
    else if (Date.now() - lastSent >= 60000) send(true);
  }, 5000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') send(true);
  });

  window.setTimeout(() => send(true), 2000);
}
