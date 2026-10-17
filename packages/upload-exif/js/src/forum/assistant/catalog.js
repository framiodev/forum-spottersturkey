/**
 * Framio Asistan: fotoğraf kataloğu (yalnızca bu tarayıcıda, IndexedDB).
 * Bir kez incelenen her dosyanın künyesi (plaka, firma, marka, model, konu, yer, yıl) saklanır;
 * aynı dosya ikinci kez yapay zekaya gönderilmez. Dosyalar sunucuya yüklenmez.
 */
const DB = 'framio-assistant-catalog';
const STORE = 'files';
const VERSION = 1; // kayıt biçimi; değişirse eski kayıtlar yok sayılır
let dbp = null;

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbp;
}

export const keyOf = (c) => [c.driveId || '', c.path || '', c.name || '', c.modified || ''].join('|');

export async function getMeta(c) {
  try {
    const d = await db();
    return await new Promise((resolve) => {
      const q = d.transaction(STORE).objectStore(STORE).get(keyOf(c));
      q.onsuccess = () => resolve(q.result && q.result.v === VERSION ? q.result : null);
      q.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function putMeta(c, fields) {
  try {
    const d = await db();
    d.transaction(STORE, 'readwrite').objectStore(STORE).put(Object.assign({}, fields, { v: VERSION, at: Date.now() }), keyOf(c));
  } catch (e) {}
}
