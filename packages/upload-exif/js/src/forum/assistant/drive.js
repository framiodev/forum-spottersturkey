import app from 'flarum/forum/app';

/**
 * Framio Asistan: Google Drive (YALNIZCA OKUMA).
 *  - İzin kapsamı yalnızca "drive.readonly": asistan dosyaları görebilir ve indirebilir; silme,
 *    değiştirme, taşıma ya da yükleme yetkisi hiçbir zaman istenmez.
 *  - Kullanıcı Google'ın kendi klasör seçicisiyle bir ya da birden çok klasör seçer; arama yalnızca
 *    bu klasörlerde (ve alt klasörlerinde) yapılır.
 *  - Erişim belirteci yalnızca bu sayfanın belleğinde tutulur, sunucuya gönderilmez.
 * Admin ayarı: Google Cloud OAuth istemci kimliği, API anahtarı ve proje numarası.
 */
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const IMAGE_MIME = "(mimeType contains 'image/')";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google hizmeti yüklenemedi.'));
    document.head.appendChild(s);
  });
}

const storeKey = () => 'framio-assistant-drive-' + (app.session.user ? app.session.user.id() : 'guest');

const drive = {
  token: null,
  expires: 0,

  config() {
    return {
      clientId: app.forum.attribute('framioDriveClientId') || '',
      apiKey: app.forum.attribute('framioDriveApiKey') || '',
      appId: app.forum.attribute('framioDriveAppId') || '',
    };
  },

  available() {
    const c = this.config();
    return !!(c.clientId && c.apiKey);
  },

  folders() {
    try {
      return JSON.parse(localStorage.getItem(storeKey()) || '[]');
    } catch (e) {
      return [];
    }
  },

  saveFolders(list) {
    try {
      localStorage.setItem(storeKey(), JSON.stringify(list));
    } catch (e) {}
  },

  connected() {
    return this.folders().length > 0 || !!this.token;
  },

  /** Aranacak kökler: seçilen klasörler; oturum açık ama klasör seçilmediyse tüm Drive */
  roots() {
    const chosen = this.folders().filter((f) => f.enabled);
    if (chosen.length) return chosen;
    let live = !!this.token;
    try {
      live = live || !!sessionStorage.getItem(storeKey() + '-token');
    } catch (e) {}
    return live ? [{ id: 'root', name: "Drive'ım", enabled: true }] : [];
  },

  /**
   * Adında yer kelimesi geçen klasörler (Drive araması — tüm ağacı gezmeden): en özel kelime önce.
   * Seçili kökler varsa yalnızca onların altındakiler kabul edilir.
   */
  async findDirs(words) {
    for (const w of words) {
      const q = String(w).replace(/'/g, "\\'");
      const res = await (
        await this.request('https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({ q: `mimeType='application/vnd.google-apps.folder' and trashed=false and name contains '${q}'`, fields: 'files(id,name,parents)', pageSize: '50' }))
      ).json();
      const hits = (res.files || []).map((f) => ({ id: f.id, path: f.name, depth: 0 }));
      if (hits.length) return hits;
    }
    return [];
  },

  /** Klasörün Drive'daki tam yolu ("Medya/Karayolu/Otobüs/2026/Şehirler/Antalya/…"); üst klasörler önbelleklenir */
  async pathOf(id) {
    this.meta = this.meta || {};
    const parts = [];
    let cur = id;
    for (let i = 0; cur && i < 30; i++) {
      if (!this.meta[cur]) {
        try {
          const j = await (await this.request(`https://www.googleapis.com/drive/v3/files/${cur}?fields=name,parents`)).json();
          this.meta[cur] = { name: j.name, parent: (j.parents || [])[0] || null };
        } catch (e) {
          break;
        }
      }
      parts.unshift(this.meta[cur].name);
      cur = this.meta[cur].parent;
    }
    // En üstteki "Drive'ım" (My Drive) adı yoldan atılır
    if (parts.length > 1 && /^(my drive|drive'ım|drive’ım|drivem)$/i.test(parts[0])) parts.shift();
    return parts;
  },

  /**
   * Klasör yapısından hedefi bulur: Karayolu/Otobüs/2026/Şehirler/Antalya/…/Antalya Otogar/…/Mercedes-Benz/Travego
   * want: { year, place: ["Antalya Otogar", "Antalya"], brand, model }
   * 1) En özel ada (model → marka → yer) sahip klasörler Drive aramasıyla bulunur,
   * 2) her birinin tam yolu çıkarılır ve yolda yıl + yer (+ marka) geçmesi şartı aranır,
   * 3) en çok koşulu sağlayan klasörler döner (içleri alt klasörleriyle taranır).
   */
  async locate(want, onStep = () => {}) {
    const fold = (v) => String(v || '').toLocaleLowerCase('tr-TR').replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c]).replace(/[^a-z0-9]+/g, ' ').trim();
    const places = (want.place || []).map(fold).filter((w) => w.length > 2);
    const model = fold(want.model).split(' ')[0] || '';
    const brand = fold(want.brand).split(' ')[0] || '';
    const year = want.year ? String(want.year) : '';
    const terms = [model && want.model.split(/\s+/)[0], brand && want.brand.split(/[\s-]+/)[0], ...(want.place || [])].filter(Boolean);

    for (const term of terms) {
      onStep(`Drive'da "${term}" klasörlerini arıyorum…`);
      const q = String(term).replace(/'/g, "\\'");
      const res = await (
        await this.request('https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({ q: `mimeType='application/vnd.google-apps.folder' and trashed=false and name contains '${q}'`, fields: 'files(id,name,parents)', pageSize: '200' }))
      ).json();
      const found = res.files || [];
      if (!found.length) continue;
      found.forEach((f) => (this.meta = Object.assign(this.meta || {}, { [f.id]: { name: f.name, parent: (f.parents || [])[0] || null } })));
      const scored = [];
      for (const f of found) {
        const parts = await this.pathOf(f.id);
        const segs = parts.map(fold);
        const has = (w) => segs.some((s) => s === w || s.includes(w));
        // Zorunlu koşullar: yıl ve (varsa) yer yolda geçmeli; model aranıyorsa klasör modelin kendisi ya da altı
        if (year && !segs.some((s) => s.split(' ').includes(year))) continue;
        if (places.length && !places.some(has)) continue;
        let score = 0;
        places.forEach((p) => has(p) && (score += 3));
        if (brand && has(brand)) score += 2;
        if (model && has(model)) score += 4;
        // En özel klasör: yer adının birebir geçtiği klasör ("Antalya Otogar") genel olandan ("Antalya") üstündür
        if (places.some((p) => segs.includes(p))) score += 1;
        scored.push({ id: f.id, path: parts.join('/'), score, depth: parts.length });
      }
      if (!scored.length) continue;
      const best = Math.max(...scored.map((x) => x.score));
      // Aynı yolun hem üstü hem altı seçilmişse yalnızca en derindeki (en özel) kalır
      let top = scored.filter((x) => x.score === best).sort((a, b) => b.depth - a.depth);
      top = top.filter((x) => !top.some((y) => y !== x && y.path.startsWith(x.path + '/')));
      return top.slice(0, 12);
    }
    return [];
  },

  /** Verilen klasörlerin (alt klasörleri dahil) içindeki fotoğraflar */
  async filesUnder(dirs, limit = 600) {
    const out = [];
    const queue = dirs.map((d) => ({ id: d.id, path: d.path, depth: 0 }));
    while (queue.length && out.length < limit) {
      const f = queue.shift();
      let pageToken = '';
      do {
        let res = {};
        try {
          res = await (
          await this.request('https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({ q: `'${f.id}' in parents and trashed=false`, fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,imageMediaMetadata(time))', pageSize: '500', ...(pageToken ? { pageToken } : {}) }))
        ).json();
        } catch (e) {
          res = {};
        }
        (res.files || []).forEach((x) => {
          if (x.mimeType === 'application/vnd.google-apps.folder') {
            if (f.depth < 40) queue.push({ id: x.id, path: f.path + '/' + x.name, depth: f.depth + 1 });
          } else if (String(x.mimeType).startsWith('image/')) {
            const exif = x.imageMediaMetadata && x.imageMediaMetadata.time;
            const pathYear = (f.path.match(/(?:^|\/)[^/]*?((?:19|20)\d{2})[^/]*/) || [])[1];
            out.push({
              driveId: x.id, name: x.name, mime: x.mimeType, path: f.path, source: 'Drive: ' + f.path,
              year: exif ? Number(String(exif).slice(0, 4)) : pathYear ? Number(pathYear) : null,
              modified: Date.parse(x.modifiedTime) || 0,
              load: () => this.download(x.id, x.name, x.mimeType, Date.parse(x.modifiedTime) || 0),
            });
          }
        });
        pageToken = res.nextPageToken || '';
      } while (pageToken && out.length < limit);
    }
    return out;
  },

  /** Yalnızca okuma izniyle erişim belirteci (ilk seferde Google onay penceresi açılır) */
  async authorize(interactive = true) {
    // Belirteç bu tarayıcıda (oturum süresince, en çok 1 saat) saklanır: sayfa yenilense de hesap yeniden sorulmaz
    if (!this.token) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storeKey() + '-token') || 'null');
        if (saved && Date.now() < saved.expires - 60000) {
          this.token = saved.token;
          this.expires = saved.expires;
        }
      } catch (e) {}
    }
    if (this.token && Date.now() < this.expires - 60000) return this.token;
    await loadScript('https://accounts.google.com/gsi/client');
    const { clientId } = this.config();

    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        prompt: interactive ? '' : 'none',
        // Daha önce bağlanan hesap hatırlanır: hesap seçme ekranı yeniden gelmez
        ...(localStorage.getItem(storeKey() + '-email') ? { login_hint: localStorage.getItem(storeKey() + '-email') } : {}),
        callback: (res) => {
          if (res.error) return reject(new Error('Google Drive izni verilmedi.'));
          // Kullanıcı başka bir kapsam verdiyse bile yalnızca okuma kapsamı kullanılır
          if (!window.google.accounts.oauth2.hasGrantedAllScopes(res, SCOPE)) return reject(new Error('Drive okuma izni verilmedi.'));
          this.token = res.access_token;
          this.expires = Date.now() + (res.expires_in || 3600) * 1000;
          try {
            sessionStorage.setItem(storeKey() + '-token', JSON.stringify({ token: this.token, expires: this.expires }));
          } catch (e) {}
          // Hangi hesabın bağlandığı (bir sonraki girişte hesap seçimi atlanır)
          fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', { headers: { Authorization: 'Bearer ' + this.token } })
            .then((r) => r.json())
            .then((j) => j.user && j.user.emailAddress && localStorage.setItem(storeKey() + '-email', j.user.emailAddress))
            .catch(() => {});
          resolve(this.token);
        },
        error_callback: () => reject(new Error('Google Drive bağlantısı kurulamadı.')),
      });
      client.requestAccessToken();
    });
  },

  /** Google klasör seçicisi: bir ya da birden çok klasör eklenir */
  async pickFolders() {
    const token = await this.authorize(true);
    await loadScript('https://apis.google.com/js/api.js');
    await new Promise((r) => window.gapi.load('picker', r));
    const { apiKey, appId } = this.config();
    const g = window.google.picker;

    return new Promise((resolve) => {
      const view = new g.DocsView(g.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes('application/vnd.google-apps.folder');
      const builder = new g.PickerBuilder()
        .addView(view)
        .enableFeature(g.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setLocale('tr')
        .setTitle('Asistanın okuyabileceği klasörleri seçin')
        .setCallback((data) => {
          if (data.action !== g.Action.PICKED) {
            if (data.action === g.Action.CANCEL) resolve([]);
            return;
          }
          const list = this.folders();
          data.docs.forEach((d) => {
            if (!list.some((f) => f.id === d.id)) list.push({ id: d.id, name: d.name, enabled: true });
          });
          this.saveFolders(list);
          resolve(list);
        });
      if (appId) builder.setAppId(appId);
      builder.build().setVisible(true);
    });
  },

  /** Panel içi klasör gezgini için: bir klasörün alt klasörleri ('root' = Drive'ım, 'shared' = Benimle paylaşılanlar) */
  async listFolders(parent = 'root') {
    const q = parent === 'shared' ? "sharedWithMe and mimeType='application/vnd.google-apps.folder' and trashed=false" : `'${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const out = [];
    let pageToken = '';
    do {
      const res = await (
        await this.request('https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({ q, fields: 'nextPageToken,files(id,name)', orderBy: 'name', pageSize: '200', ...(pageToken ? { pageToken } : {}) }))
      ).json();
      (res.files || []).forEach((f) => out.push({ id: f.id, name: f.name }));
      pageToken = res.nextPageToken || '';
    } while (pageToken && out.length < 1000);
    return out;
  },

  addFolder(id, name) {
    const list = this.folders();
    if (!list.some((f) => f.id === id)) list.push({ id, name, enabled: true });
    this.saveFolders(list);
    return list;
  },

  toggle(id, enabled) {
    this.saveFolders(this.folders().map((f) => (f.id === id ? { ...f, enabled } : f)));
  },

  remove(id) {
    this.saveFolders(this.folders().filter((f) => f.id !== id));
  },

  /** Drive'ı tamamen ayır: klasör listesi silinir ve Google'daki izin geri alınır */
  async disconnect() {
    if (this.token && window.google && window.google.accounts) {
      try {
        window.google.accounts.oauth2.revoke(this.token, () => {});
      } catch (e) {}
    }
    this.token = null;
    try {
      sessionStorage.removeItem(storeKey() + '-token');
      localStorage.removeItem(storeKey() + '-email');
    } catch (e) {}
    this.saveFolders([]);
  },

  async request(url) {
    const token = await this.authorize(true);
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error('Drive yanıt vermedi (' + res.status + ').');
    return res;
  },

  /** Seçili klasörlerde (bir alt seviye dahil) adında ifade geçen fotoğraflar */
  /**
   * Seçili klasörler ve alt klasörleri (3 seviyeye kadar), yollarıyla: "Fotoğraflar/2026/Şehirlerarası Otobüsler"
   */
  async tree(maxDepth = 3) {
    const roots = this.roots().map((f) => ({ id: f.id, path: f.name, depth: 0 }));
    const out = [...roots];
    const queue = [...roots];
    while (queue.length) {
      const f = queue.shift();
      if (f.depth >= maxDepth) continue;
      const res = await (
        await this.request('https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({ q: `'${f.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id,name)', pageSize: '200' }))
      ).json();
      (res.files || []).forEach((s) => {
        const child = { id: s.id, path: f.path + '/' + s.name, depth: f.depth + 1 };
        out.push(child);
        queue.push(child);
      });
    }
    return out;
  },

  /**
   * Fotoğraf arama. Dosya içeriği İNDİRİLMEZ: Drive'ın kendi çıkardığı EXIF tarihi (imageMediaMetadata.time)
   * ve klasör adları (ör. "2026", "Şehirlerarası Otobüsler") kullanılır. Dosya yalnızca paylaşılacağı
   * zaman item.load() ile indirilir.
   * opts.year: çekim yılı · opts.hint: kategori ipucu (ör. "şehirlerarası")
   */
  async find(query, limit = 20, opts = {}) {
    if (!this.roots().length) return [];
    const q = String(query || '').replace(/'/g, "\\'");
    let folders = await this.tree(opts.hint || opts.year || query ? 40 : 3);

    // Klasör adı yılı ya da kategoriyi söylüyorsa yalnızca o klasörlere bakılır
    const norm = (v) => String(v || '').toLocaleLowerCase('tr-TR');
    if (opts.year) {
      const byYear = folders.filter((f) => norm(f.path).split('/').some((part) => part.includes(String(opts.year))));
      if (byYear.length) folders = byYear;
    }
    if (opts.hint) {
      const words = norm(opts.hint).split(/\s+/).filter((w) => w.length > 3);
      const byHint = folders.filter((f) => words.some((w) => norm(f.path).includes(w.slice(0, 6))));
      if (byHint.length) folders = byHint;
    }

    const compact = q.replace(/\s+/g, '');
    const nameQ = q ? ` and (name contains '${q}'${compact !== q ? ` or name contains '${compact}'` : ''})` : '';
    const out = [];
    for (const p of folders) {
      let pageToken = '';
      do {
        const res = await (
          await this.request(
            'https://www.googleapis.com/drive/v3/files?' +
              new URLSearchParams({
                q: `'${p.id}' in parents and ${IMAGE_MIME} and trashed=false${nameQ}`,
                fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,imageMediaMetadata(time))',
                orderBy: 'modifiedTime desc',
                pageSize: '200',
                ...(pageToken ? { pageToken } : {}),
              })
          )
        ).json();
        (res.files || []).forEach((f) => {
          const exif = f.imageMediaMetadata && f.imageMediaMetadata.time; // "2026:05:14 13:22:10"
          const pathYear = (p.path.match(/(?:^|\/)[^/]*?((?:19|20)\d{2})[^/]*/) || [])[1];
          const year = exif ? Number(String(exif).slice(0, 4)) : pathYear ? Number(pathYear) : null;
          out.push({
            driveId: f.id,
            name: f.name,
            mime: f.mimeType,
            path: p.path,
            source: 'Drive: ' + p.path,
            year,
            modified: Date.parse(f.modifiedTime) || 0,
            load: () => this.download(f.id, f.name, f.mimeType, Date.parse(f.modifiedTime) || 0),
          });
        });
        pageToken = res.nextPageToken || '';
      } while (pageToken && out.length < limit * 3);
      if (out.length >= limit * 3) break;
    }
    out.sort((a, b) => b.modified - a.modified);
    return out.filter((i) => !opts.year || !i.year || i.year === opts.year).slice(0, limit);
  },

  /** Tek dosyayı indirir (salt okunur: alt=media) */
  async download(id, name, mime, modified) {
    const blob = await (await this.request(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)).blob();
    return new File([blob], name, { type: mime || blob.type, lastModified: modified });
  },
};

export default drive;
