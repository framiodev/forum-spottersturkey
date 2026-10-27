import app from 'flarum/forum/app';

/**
 * Telefon görünümü küçük görselleri (/framio/mobile-thumbs): kategori → son fotoğraf,
 * tartışma → ilk fotoğraf. İstekler kısa süre toplanıp tek çağrıda gider; sonuç sayfa boyunca saklanır.
 */
const known = { tags: {}, discussions: {} };
const pending = { tags: new Set(), discussions: new Set() };
let timer = null;

function flush() {
  timer = null;
  const tags = [...pending.tags];
  const discussions = [...pending.discussions];
  pending.tags.clear();
  pending.discussions.clear();
  if (!tags.length && !discussions.length) return;

  app.request({
    method: 'GET',
    url: app.forum.attribute('apiUrl') + '/framio/mobile-thumbs',
    params: { tags: tags.join(','), discussions: discussions.join(',') },
    errorHandler: () => {},
  }).then((r) => {
    // Bulunamayanlar da işaretlenir (null): tekrar sorulmaz
    tags.forEach((id) => { known.tags[id] = (r && r.tags && r.tags[id]) || null; });
    discussions.forEach((id) => { known.discussions[id] = (r && r.discussions && r.discussions[id]) || null; });
    m.redraw();
  }).catch(() => {});
}

function get(kind, id) {
  id = String(id);
  if (id in known[kind]) return known[kind][id];
  if (!pending[kind].has(id)) {
    pending[kind].add(id);
    if (!timer) timer = setTimeout(flush, 60);
  }
  return undefined;
}

export const tagThumb = (id) => get('tags', id);
export const discussionThumb = (id) => get('discussions', id);
