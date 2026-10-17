/**
 * Framio Asistan: fotoğraf kaynakları.
 *  - Yerel klasörler (File System Access API, YALNIZCA OKUMA): birden çok klasör eklenebilir,
 *    her biri açılıp kapatılabilir, adı değiştirilebilir. Tutamaçlar IndexedDB'de saklanır.
 *  - Google Drive klasörleri (drive.js, yalnızca okuma izni).
 * Tarayıcılar bir sitenin tüm diske erişmesine izin vermez; en geniş erişim, kullanıcının
 * seçtiği üst klasör (ör. Resimler) ve "tüm alt klasörlerde ara" ayarıdır.
 */
import drive from './drive';

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

/** Plaka / dosya adı karşılaştırması: "06 ABC 123" → "06ABC123" */
export function normalize(s) {
  return String(s || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/[^A-Z0-9ÇĞÖŞÜ]/g, '');
}

const folder = {
  list: null, // [{ id, label, handle, enabled }]

  supported() {
    return typeof window.showDirectoryPicker === 'function';
  },

  async load() {
    if (this.list) return this.list;
    this.list = (await idbGet('folders')) || [];
    // Eski tek klasörlü sürümden taşı
    const old = await idbGet('photos');
    if (old && !this.list.length) {
      this.list = [{ id: 'f' + Date.now(), label: old.name, handle: old, enabled: true }];
      await this.save();
    }
    return this.list;
  },

  save() {
    return idbSet('folders', this.list || []);
  },

  /** Görünen ad: tek klasör adı ya da "3 kaynak" */
  name() {
    const n = (this.list || []).filter((f) => f.enabled).length + drive.folders().filter((f) => f.enabled).length;
    if (!n) return null;
    const one = (this.list || []).find((f) => f.enabled);
    return n === 1 && one ? one.label : n + ' kaynak';
  },

  /** Klasör ekle (kullanıcı tıklaması gerekir); yalnızca okuma izni istenir */
  async link() {
    await this.load();
    const handle = await window.showDirectoryPicker({ id: 'framio-photos', mode: 'read', startIn: 'pictures' });
    for (const f of this.list) {
      if (f.handle && (await f.handle.isSameEntry(handle))) return f;
    }
    const item = { id: 'f' + Date.now(), label: handle.name, handle, enabled: true };
    this.list.push(item);
    await this.save();
    return item;
  },

  async remove(id) {
    await this.load();
    this.list = this.list.filter((f) => f.id !== id);
    await this.save();
  },

  async toggle(id, enabled) {
    await this.load();
    const f = this.list.find((x) => x.id === id);
    if (f) f.enabled = enabled;
    await this.save();
  },

  async rename(id, label) {
    await this.load();
    const f = this.list.find((x) => x.id === id);
    if (f && label) f.label = label;
    await this.save();
  },

  /** Tüm etkin yerel klasörlerin okuma izni (sesli komutta tarayıcı tek seferde onay ister) */
  async ensure() {
    await this.load();
    let ok = true;
    for (const f of this.list.filter((x) => x.enabled)) {
      try {
        if ((await f.handle.queryPermission({ mode: 'read' })) !== 'granted' && (await f.handle.requestPermission({ mode: 'read' })) !== 'granted') ok = false;
      } catch (e) {
        ok = false;
      }
    }
    return ok;
  },

  hasAny() {
    return (this.list || []).some((f) => f.enabled) || drive.folders().some((f) => f.enabled);
  },

  /**
   * Etkin kaynaklarda adı aranan ifadeyi içeren fotoğraflar, en yeni önce.
   * @param {(text: string) => void} onStep  anlık durum ("Masaüstü klasörünü tarıyorum…")
   * @return {Promise<{file: File|Blob, name: string, source: string, modified: number}[]>}
   */
  async find(query, limit = 20, depth = 2, onStep = () => {}) {
    await this.load();
    const needle = normalize(query);
    const out = [];

    for (const f of this.list.filter((x) => x.enabled)) {
      onStep(`"${f.label}" klasörünü tarıyorum…`);
      const walk = async (dir, level) => {
        for await (const entry of dir.values()) {
          if (entry.kind === 'file' && IMAGE.test(entry.name)) {
            if (!needle || normalize(entry.name).includes(needle)) {
              const file = await entry.getFile();
              out.push({ file, name: file.name, source: f.label, modified: file.lastModified });
            }
          } else if (entry.kind === 'directory' && level < depth && !entry.name.startsWith('.')) {
            await walk(entry, level + 1);
          }
        }
      };
      try {
        await walk(f.handle, 0);
      } catch (e) {
        onStep(`"${f.label}" klasörü okunamadı, atlıyorum.`);
      }
    }

    if (drive.folders().some((x) => x.enabled)) {
      onStep('Google Drive klasörlerinde arıyorum…');
      try {
        (await drive.find(query, limit)).forEach((d) => out.push(d));
      } catch (e) {
        onStep('Google Drive\'a ulaşamadım: ' + (e.message || 'bağlantı yok'));
      }
    }

    out.sort((a, b) => b.modified - a.modified);
    return out.slice(0, limit);
  },
};

export default folder;
