import app from 'flarum/forum/app';

/**
 * Gönderi istatistikleri için ziyaretçi davranışı (yöneticiler sayılmaz):
 *  - görüntülenme: fotoğraf en az 1 sn yarısından fazla ekranda kaldıysa
 *  - inceleme süresi: fotoğraf başına, yalnızca sekme açıkken ve ekranda görünürken
 *  - kaydırma (carousel), büyük görünüm (lightbox) süresi, künye/EXIF tıklamaları
 * Olaylar biriktirilir, 20 sn'de bir ya da sayfadan çıkarken tek istekte (sendBeacon) gönderilir.
 */
const CONTAINER = '.framio-image-container, .ulasimarsiv-image-container, .spotter-image-container';
const queue = [];
const dwell = {}; // "post|image" → ms
const visible = new Map(); // element → {post, image}
const viewed = new Set();
const seenEls = new WeakSet();
let lightboxOpen = null;
let started = false;

function visitorId() {
  try {
    let v = localStorage.getItem('framio_vid');
    if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('framio_vid', v); }
    return v;
  } catch (e) {
    return (window.__framioVid = window.__framioVid || Math.random().toString(36).slice(2));
  }
}

function enabled() {
  const u = app.session && app.session.user;
  return !(u && u.isAdmin());
}

export function track(t, p, extra = {}) {
  if (!started || !p) return;
  queue.push(Object.assign({ t, p: Number(p) }, extra));
}

function postIdOf(el) {
  const post = el && el.closest && el.closest('.Post[data-id], [data-post-id]');
  return post ? post.getAttribute('data-id') || post.getAttribute('data-post-id') : null;
}

function flush() {
  Object.keys(dwell).forEach((k) => {
    const ms = dwell[k];
    if (ms >= 500) { const [p, i] = k.split('|'); queue.push({ t: 'dwell', p: Number(p), i: i ? Number(i) : null, n: ms }); }
    delete dwell[k];
  });
  if (!queue.length) return;
  const body = JSON.stringify({ v: visitorId(), d: window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop', e: queue.splice(0, 80), csrfToken: app.session.csrfToken });
  const url = app.forum.attribute('apiUrl') + '/framio-insights/track';
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) return;
  } catch (e) {}
  fetch(url, { method: 'POST', body, keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': app.session.csrfToken } }).catch(() => {});
}

/** Büyük görünüm açıkken süre ona yazılır, akıştaki fotoğrafa değil */
export function lightboxOpened(postId, imageId) {
  if (!started || !postId) return;
  lightboxOpen = { p: postId, i: imageId, t0: Date.now() };
}
export function lightboxClosed() {
  if (!lightboxOpen) return;
  track('lightbox', lightboxOpen.p, { i: lightboxOpen.i, n: Date.now() - lightboxOpen.t0 });
  lightboxOpen = null;
}

export function startTracker() {
  if (started || typeof window === 'undefined' || !('IntersectionObserver' in window) || !enabled()) return;
  started = true;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting && en.intersectionRatio >= 0.5) {
        const p = postIdOf(en.target);
        if (p) visible.set(en.target, { p, i: en.target.getAttribute('data-id') });
      } else visible.delete(en.target);
    });
  }, { threshold: [0, 0.5, 1] });

  const scan = () => document.querySelectorAll(CONTAINER).forEach((el) => {
    if (!seenEls.has(el) && postIdOf(el)) { seenEls.add(el); io.observe(el); }
  });

  // Her saniye: görünen fotoğraflara süre eklenir (gizli carousel slaytları görünmez sayılır)
  setInterval(() => {
    scan();
    if (document.hidden || lightboxOpen) return;
    visible.forEach((v, el) => {
      if (!el.isConnected || !el.offsetParent) { visible.delete(el); return; }
      const k = v.p + '|' + (v.i || '');
      dwell[k] = (dwell[k] || 0) + 1000;
      if (dwell[k] >= 1000 && !viewed.has(v.p)) { viewed.add(v.p); track('view', v.p); }
    });
  }, 1000);

  setInterval(flush, 20000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { lightboxClosed(); flush(); } });
  window.addEventListener('pagehide', () => { lightboxClosed(); flush(); });

  // Künye / EXIF / bağlantı tıklamaları (fotoğrafın kendisi büyük görünüm olarak ayrıca sayılır)
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !t.closest || t.tagName === 'IMG') return;
    const body = t.closest('.Post-body');
    if (!body) return;
    const el = t.closest('a, li, dd, dt, td, button, strong, [class*="item" i], [class*="Exif" i], [class*="kunye" i]');
    if (!el || !body.contains(el)) return;
    const label = (el.innerText || el.textContent || '').trim().split('\n')[0].slice(0, 80);
    if (!label) return;
    const inCard = el.closest(CONTAINER) || el.closest('[class*="Exif" i], [class*="kunye" i]');
    const container = el.closest(CONTAINER);
    track('click', postIdOf(el), { l: (inCard ? 'EXIF · ' : el.closest('li') ? 'Künye · ' : 'Bağlantı · ') + label, i: container ? container.getAttribute('data-id') : null });
  }, true);
}
