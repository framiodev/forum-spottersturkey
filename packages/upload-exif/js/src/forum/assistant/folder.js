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

  /**
   * Adında verilen kelimelerden biri geçen klasörler (ör. "Esenler"), derinlik sınırı olmadan.
   * Yalnızca klasör adlarına bakılır, dosyalar açılmaz: büyük arşivlerde de hızlıdır.
   * En özel (en derindeki) eşleşmeler döner; "İstanbul" ve "Esenler" birlikte geçiyorsa Esenler seçilir.
   * @return {Promise<{handle, path, label}[]>}
   */
  async findDirs(words, onStep = () => {}) {
    await this.load();
    const want = words.map((w) => w.toLocaleLowerCase('tr-TR')).filter((w) => w.length > 2);
    if (!want.length) return [];
    const hits = [];
    let seen = 0;
    const walk = async (dir, path, level) => {
      if (level > 40) return;
      let iter;
      try {
        iter = dir.values();
      } catch (e) {
        return;
      }
      while (true) {
        let step;
        try {
          step = await iter.next();
        } catch (e) {
          return;
        }
        if (step.done) return;
        const entry = step.value;
        if (entry.kind !== 'directory' || entry.name.startsWith('.')) continue;
        seen++;
        if (seen % 300 === 0) onStep(`Klasör yapısı taranıyor… (${seen} klasör)`);
        const p = path + '/' + entry.name;
        const name = entry.name.toLocaleLowerCase('tr-TR');
        const score = want.filter((w) => name.includes(w.slice(0, 6))).length;
        if (score) hits.push({ handle: entry, path: p, score, depth: level + 1 });
        await walk(entry, p, level + 1);
      }
    };
    for (const f of this.list.filter((x) => x.enabled)) {
      onStep(`"${f.label}" içinde "${words.join(', ')}" klasörü aranıyor…`);
      await walk(f.handle, f.label, 0);
    }
    if (!hits.length) return [];
    // En özel eşleşme: kelime listesinde en sonda gelen (ör. "Esenler") ve en derindeki klasör
    const rank = (h) => {
      const name = h.path.split('/').pop().toLocaleLowerCase('tr-TR');
      const idx = Math.max(...want.map((w, i) => (name.includes(w.slice(0, 6)) ? i + 1 : 0)));
      return idx * 100 + h.depth;
    };
    const top = Math.max(...hits.map(rank));
    // Bir eşleşme başka bir eşleşmenin içindeyse (İstanbul/…/Esenler) yalnızca içteki kalır
    const best = hits.filter((h) => rank(h) === top);
    return best.map((h) => ({ handle: h.handle, path: h.path, label: h.path.split('/').pop() }));
  },

  /** Verilen klasörlerin içindeki tüm fotoğraflar (alt klasörler dahil) */
  async filesIn(dirs, onStep = () => {}) {
    const out = [];
    for (const d of dirs) {
      onStep(`"${d.path}" klasöründeki fotoğraflar okunuyor…`);
      const entries = [];
      const walk = async (dir, path, level) => {
        if (level > 6) return;
        let iter;
        try {
          iter = dir.values();
        } catch (e) {
          return;
        }
        while (true) {
          let step;
          try {
            step = await iter.next();
          } catch (e) {
            return;
          }
          if (step.done) return;
          const entry = step.value;
          if (entry.kind === 'file' && IMAGE.test(entry.name)) entries.push({ entry, path });
          else if (entry.kind === 'directory' && !entry.name.startsWith('.')) await walk(entry, path + '/' + entry.name, level + 1);
        }
      };
      await walk(d.handle, d.path, 0);
      for (let i = 0; i < entries.length; i += 50) {
        const batch = await Promise.all(
          entries.slice(i, i + 50).map(async ({ entry, path }) => {
            try {
              const file = await entry.getFile();
              const py = (path.match(/(?:^|\/)[^/]*?((?:19|20)\d{2})[^/]*/) || [])[1];
              return { file, name: file.name, source: path, path, year: py ? Number(py) : null, modified: file.lastModified, size: file.size, load: async () => file };
            } catch (e) {
              return null;
            }
          })
        );
        batch.forEach((x) => x && out.push(x));
      }
    }
    // Aynı dosya iki kaynakta varsa bir kez
    const seen = new Set();
    return out
      .filter((x) => {
        const k = x.name + '|' + x.size;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => b.modified - a.modified);
  },

  hasAny() {
    return (this.list || []).some((f) => f.enabled) || drive.folders().some((f) => f.enabled);
  },

  /**
   * Etkin kaynaklarda adı aranan ifadeyi içeren fotoğraflar, en yeni önce.
   * @param {(text: string) => void} onStep  anlık durum ("Masaüstü klasörünü tarıyorum…")
   * @return {Promise<{file: File|Blob, name: string, source: string, modified: number}[]>}
   */
  async find(query, limit = 20, depth = 2, onStep = () => {}, opts = {}) {
    await this.load();
    const needle = normalize(query);
    const out = [];

    for (const f of this.list.filter((x) => x.enabled && opts.source !== 'drive')) {
      onStep(`"${f.label}" klasörünü tarıyorum…`);

      // 1) Yalnızca adlara bakılarak eşleşen dosyalar toplanır (dosya açılmaz: hızlı)
      // Bulut sürücülerinde (ExpanDrive, Google Drive masaüstü vb.) bazı öğeler okuma hatası verebilir:
      // hata veren alt klasör / dosya atlanır, taramanın geri kalanı sürer
      // Adla (plaka, dosya adı) aramada yalnızca adlara bakılır: derinlik sınırı yok (hızlı)
      const maxDepth = needle ? Infinity : depth;
      const entries = [];
      const errors = [];
      const walk = async (dir, level, path) => {
        let iter;
        try {
          iter = dir.values();
        } catch (e) {
          errors.push(path + ': ' + (e.name || 'hata'));
          return;
        }
        while (true) {
          let step;
          try {
            step = await iter.next();
          } catch (e) {
            errors.push(path + ': ' + (e.name || 'hata'));
            return;
          }
          if (step.done) return;
          const entry = step.value;
          if (entry.kind === 'file' && IMAGE.test(entry.name)) {
            if (!needle || normalize(entry.name).includes(needle)) entries.push({ entry, path });
          } else if (entry.kind === 'directory' && level < maxDepth && !entry.name.startsWith('.')) {
            await walk(entry, level + 1, path + '/' + entry.name);
          }
        }
      };
      await walk(f.handle, 0, f.label);
      if (errors.length) {
        onStep(`"${f.label}": ${errors.length} alt klasör okunamadı (${errors.slice(0, 2).join('; ')}${errors.length > 2 ? '…' : ''}); diğerleri tarandı.`);
      }
      onStep(`"${f.label}": ${entries.length} fotoğraf bulundu.`);

      // 2) Tarih için dosya bilgileri 50'şerli paralel gruplarla okunur; ilerleme gösterilir
      for (let i = 0; i < entries.length; i += 50) {
        const batch = await Promise.all(
          entries.slice(i, i + 50).map(async ({ entry, path }) => {
            try {
              const file = await entry.getFile();
              // Klasör adı yıl ise ("…/2026/…") çekim yılı ipucu
              const py = (path.match(/(?:^|\/)[^/]*?((?:19|20)\d{2})[^/]*/) || [])[1];
              return { file, name: file.name, source: path, path, year: py ? Number(py) : null, modified: file.lastModified, load: async () => file };
            } catch (e) {
              return null;
            }
          })
        );
        batch.forEach((x) => x && out.push(x));
        if (entries.length > 200 && i % 500 === 0) onStep(`"${f.label}": ${Math.min(i + 50, entries.length)}/${entries.length} fotoğraf tarandı…`);
      }
    }

    if (opts.source !== 'local' && drive.folders().some((x) => x.enabled)) {
      onStep('Google Drive klasörlerinde arıyorum…');
      try {
        (await drive.find(query, limit, opts)).forEach((d) => out.push(d));
      } catch (e) {
        onStep('Google Drive\'a ulaşamadım: ' + (e.message || 'bağlantı yok'));
      }
    }

    out.sort((a, b) => b.modified - a.modified);
    return out.slice(0, limit);
  },
};

export default folder;
