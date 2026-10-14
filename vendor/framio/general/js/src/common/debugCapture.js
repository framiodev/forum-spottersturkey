/**
 * Tarayıcıdaki JS hatalarını (yakalanmamış hata, reddedilen promise,
 * console.error) toplayıp toplu halde sunucuya gönderir.
 * Aynı hata sayfa başına bir kez, en fazla 20 kayıt gönderilir.
 */
export default function debugCapture(app, frontend) {
  if (window.__framioDebugCapture) return;
  window.__framioDebugCapture = true;

  const seen = new Set();
  let queue = [];
  let sent = 0;
  let timer = null;

  const flush = () => {
    timer = null;
    if (!queue.length) return;
    // Modül/ayar kapalıysa (öznitelik yok) sessizce bırak
    if (!app.forum || !app.forum.attribute('framioGeneral.debugClient')) { queue = []; return; }
    const errors = queue.splice(0, 10);
    try {
      const url = app.forum.attribute('apiUrl') + '/framio/debug-logs/client';
      const headers = { 'Content-Type': 'application/json' };
      if (app.session && app.session.csrfToken) headers['X-CSRF-Token'] = app.session.csrfToken;
      fetch(url, { method: 'POST', headers, credentials: 'same-origin', body: JSON.stringify({ errors }), keepalive: true }).catch(() => {});
    } catch (e) {}
  };

  const push = (kind, err, extra = {}) => {
    try {
      if (sent >= 20) return;
      const message = String((err && err.message) || extra.message || err || '').slice(0, 2000);
      if (!message || /ResizeObserver loop|Script error\.?$/i.test(message)) return;
      const stack = String((err && err.stack) || extra.stack || '').slice(0, 20000);
      const key = kind + message + stack.slice(0, 200);
      if (seen.has(key)) return;
      seen.add(key);
      sent++;

      let route = '';
      try { route = (window.m && m.route && m.route.get()) || ''; } catch (e) {}
      const user = app.session && app.session.user ? { id: app.session.user.id(), ad: app.session.user.username() } : 'misafir';

      queue.push({
        kind,
        frontend,
        name: (err && err.name) || extra.name || 'Error',
        message,
        stack,
        file: extra.file || null,
        line: extra.line || null,
        url: location.href,
        route,
        user,
      });
      if (!timer) timer = setTimeout(flush, 2000);
    } catch (e) {}
  };

  window.addEventListener('error', (e) => {
    if (e.target && e.target !== window) return; // görsel/betik yükleme hataları değil
    push('error', e.error, { message: e.message, file: e.filename, line: e.lineno });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    // Flarum'un bildirdiği API hataları (403, 404, doğrulama) gürültü sayılır
    // Flarum API istek hataları (RequestError): sunucu tarafı zaten kendi
    // yığınıyla kaydedilir; tarayıcıda "[object Object]" tekrarı olmasın
    if (r && (r.status || r.xhr || r.response || r.responseText !== undefined)) return;
    push('promise', r instanceof Error ? r : null, { message: r && (r.message || (typeof r === 'object' ? JSON.stringify(r).slice(0, 500) : String(r))), name: 'UnhandledRejection' });
  });

  const origError = console.error;
  console.error = function (...args) {
    try {
      const err = args.find((a) => a instanceof Error);
      // Kaynak tespitinde bu sarmalayıcı karesi değil, çağıran kod görünsün
      const stack = err ? err.stack : (new Error().stack || '').split('\n').slice(2).join('\n');
      // Flarum'un API hata yazdırıcısı: sunucu hatası zaten ayrıca kaydediliyor
      if (/requestError(DefaultHandler|Catch)/.test(stack)) return origError.apply(this, args);
      const text = args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : '')).filter(Boolean).join(' ');
      push('console', err || null, { message: text, stack, name: 'console.error' });
    } catch (e) {}
    return origError.apply(this, args);
  };

  window.addEventListener('pagehide', flush);
}
