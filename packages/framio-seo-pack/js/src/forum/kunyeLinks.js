import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';

/**
 * Künye alanındaki marka / model / firma / plaka / şehir / yıl adlarını derleme
 * sayfalarına (/arac/…) bağlar. Veri sunucudan post.seoEntities() ile gelir;
 * yalnızca künye öğelerindeki metne dokunulur, mesajın geri kalanına değil.
 */
// Künye satırlarının tamamı (etiket ve değer); yalnızca bilinen varlık adları bağlanır
const KUNYE_SELECTOR = '.framio-kunye-card, li';

function linkify(root, entities) {
  // Uzun adlar önce (model adı markayı içerir)
  const list = entities.slice().sort((a, b) => b.name.length - a.name.length);

  root.querySelectorAll(KUNYE_SELECTOR).forEach((container) => {
    if (container.closest('.FramioKunyeLink')) return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((node) => {
      if (node.parentElement && node.parentElement.closest('a')) return;
      let text = node.nodeValue;
      const parts = [];
      let cursor = 0;

      // Metindeki eşleşmeleri bul, çakışanları at
      const hits = [];
      // Büyük/küçük harfe duyarsız ("TEMSA" ↔ "Temsa"); Türkçe kurallar karakter sayısını korur (I↔ı, İ↔i)
      const fold = (s) => s.toLocaleLowerCase('tr-TR');
      const haystack = fold(text);
      const sameLength = haystack.length === text.length;
      list.forEach((ent) => {
        // Yıl gibi varlıklar künyede kısaltılmış yazılır ("'26"): sunucu eşleşecek yazımları da gönderir
        (ent.match && ent.match.length ? ent.match : [ent.name]).forEach((raw) => {
          const needle = sameLength ? fold(raw) : raw;
          const source = sameLength ? haystack : text;
          let idx = source.indexOf(needle);
          while (idx !== -1) {
            const end = idx + needle.length;
            if (!hits.some((h) => idx < h.end && end > h.start)) hits.push({ start: idx, end, ent });
            idx = source.indexOf(needle, end);
          }
        });
      });
      if (!hits.length) return;
      hits.sort((a, b) => a.start - b.start);

      hits.forEach((h) => {
        if (h.start > cursor) parts.push(document.createTextNode(text.slice(cursor, h.start)));
        const a = document.createElement('a');
        a.className = 'FramioKunyeLink FramioKunyeLink--' + h.ent.type;
        a.href = app.forum.attribute('basePath') + h.ent.path;
        a.title = 'Tüm "' + h.ent.name + '" fotoğrafları';
        a.textContent = text.slice(h.start, h.end);
        // Derleme sayfası yeni sekmede açılır; okunan mesaj yerinde kalır
        a.target = '_blank';
        a.rel = 'noopener';
        parts.push(a);
        cursor = h.end;
      });
      if (cursor < text.length) parts.push(document.createTextNode(text.slice(cursor)));

      const frag = document.createDocumentFragment();
      parts.forEach((p) => frag.appendChild(p));
      node.parentNode.replaceChild(frag, node);
    });
  });
}

function apply(vnode) {
  const post = this.attrs.post;
  const entities = post && typeof post.attribute === 'function' ? post.attribute('seoEntities') : null;
  if (!entities || !entities.length || !this.element) return;

  const body = this.element.querySelector('.Post-body');
  // Mesaj içeriği yeniden çizilince bağlantılar kaybolur; yalnızca o zaman tekrar uygula
  if (!body || body.querySelector('.FramioKunyeLink')) return;

  linkify(body, entities);
}

// Lightbox (galeri, Keşfet, ana sayfa) künyesi: mesaj sayfası dışında da bağlantılı olsun
const cache = {};
function entitiesFor(id) {
  if (cache[id]) return cache[id];
  const stored = app.store.getById('posts', id);
  const known = stored && stored.attribute('seoEntities');
  cache[id] = known
    ? Promise.resolve(known)
    : app
        .request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/posts/' + id })
        .then((res) => (res && res.data && res.data.attributes && res.data.attributes.seoEntities) || [])
        .catch(() => []);
  return cache[id];
}

function scanLightbox() {
  document.querySelectorAll('.SpottersGallery-DescContent[data-post-id]').forEach((el) => {
    const id = el.getAttribute('data-post-id');
    if (el.querySelector('.FramioKunyeLink') || el.dataset.kunyeFor === id + ':' + el.textContent.length) return;
    el.dataset.kunyeFor = id + ':' + el.textContent.length;
    entitiesFor(id).then((entities) => {
      if (entities && entities.length && el.isConnected && !el.querySelector('.FramioKunyeLink')) linkify(el, entities);
    });
  });
}

export default function kunyeLinks() {
  extend(CommentPost.prototype, 'oncreate', apply);
  extend(CommentPost.prototype, 'onupdate', apply);

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      scanLightbox();
    }, 60);
  }).observe(document.body, { childList: true, subtree: true });
}
