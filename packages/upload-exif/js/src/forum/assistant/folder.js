/**
 * Framio Asistan: bağlı fotoğraf klasörü.
 * Tarayıcının dosya sistemi izni (File System Access API) ile kullanıcı bir kez klasör seçer;
 * klasör tutamacı IndexedDB'de saklanır, sonraki komutlarda yeniden seçmek gerekmez.
 * (Chrome / Edge / Opera; kurulum yok, PWA olarak da çalışır.)
 */
const DB = 'framio-assistant';
const STORE = 'handles';

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(key) {
  return idb().then(
    (db) =>
      new Promise((resolve) => {
        const r = db.transaction(STORE).objectStore(STORE).get(key);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => resolve(null);
      })
  );
}

function idbSet(key, value) {
  return idb().then(
    (db) =>
      new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      })
  );
}

const IMAGE = /\.(jpe?g|png|webp|heic|heif|tiff?)$/i;

/** Plaka ve dosya adı karşılaştırması için sadeleştirme: "06 ABC 123" → "06ABC123" */
export function normalize(s) {
  return String(s || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/[^A-Z0-9ÇĞÖŞÜ]/g, '');
}

const folder = {
  handle: null,

  supported() {
    return typeof window.showDirectoryPicker === 'function';
  },

  async load() {
    if (!this.handle) this.handle = await idbGet('photos');
    return this.handle;
  },

  name() {
    return this.handle ? this.handle.name : null;
  },

  /** Klasör seç (kullanıcı tıklaması gerekir) */
  async link() {
    this.handle = await window.showDirectoryPicker({ id: 'framio-photos', mode: 'read', startIn: 'pictures' });
    await idbSet('photos', this.handle);
    return this.handle;
  },

  /** İzin durumu: 'granted' | 'prompt' | 'denied' | 'none' */
  async permission() {
    const h = await this.load();
    if (!h) return 'none';
    try {
      return await h.queryPermission({ mode: 'read' });
    } catch (e) {
      return 'prompt';
    }
  },

  /** İzni yeniler (kullanıcı tıklaması ya da sesli komutun ardından çağrılmalı) */
  async ensure() {
    const h = await this.load();
    if (!h) return false;
    if ((await h.queryPermission({ mode: 'read' })) === 'granted') return true;
    try {
      return (await h.requestPermission({ mode: 'read' })) === 'granted';
    } catch (e) {
      return false;
    }
  },

  /**
   * Klasörde (ve bir alt seviyede) adı aranan ifadeyi içeren fotoğraflar, en yeni önce.
   * @return {Promise<File[]>}
   */
  async find(query, limit = 20) {
    const h = await this.load();
    if (!h) return [];
    const needle = normalize(query);
    const out = [];

    const walk = async (dir, depth) => {
      for await (const entry of dir.values()) {
        if (entry.kind === 'file' && IMAGE.test(entry.name)) {
          if (!needle || normalize(entry.name).includes(needle)) {
            const file = await entry.getFile();
            out.push(file);
          }
        } else if (entry.kind === 'directory' && depth < 1 && !entry.name.startsWith('.')) {
          await walk(entry, depth + 1);
        }
      }
    };
    await walk(h, 0);

    // Orijinal/işlenmemiş kopyalar yerine dışa aktarılmış olanlar öne; en yeni önce
    out.sort((a, b) => b.lastModified - a.lastModified);
    return out.slice(0, limit);
  },
};

export default folder;
