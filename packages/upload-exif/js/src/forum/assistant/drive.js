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
    return this.folders().length > 0;
  },

  /** Yalnızca okuma izniyle erişim belirteci (ilk seferde Google onay penceresi açılır) */
  async authorize(interactive = true) {
    if (this.token && Date.now() < this.expires - 60000) return this.token;
    await loadScript('https://accounts.google.com/gsi/client');
    const { clientId } = this.config();

    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        prompt: interactive ? '' : 'none',
        callback: (res) => {
          if (res.error) return reject(new Error('Google Drive izni verilmedi.'));
          // Kullanıcı başka bir kapsam verdiyse bile yalnızca okuma kapsamı kullanılır
          if (!window.google.accounts.oauth2.hasGrantedAllScopes(res, SCOPE)) return reject(new Error('Drive okuma izni verilmedi.'));
          this.token = res.access_token;
          this.expires = Date.now() + (res.expires_in || 3600) * 1000;
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
    const roots = this.folders().filter((f) => f.enabled).map((f) => ({ id: f.id, path: f.name, depth: 0 }));
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
    if (!this.folders().some((f) => f.enabled)) return [];
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
