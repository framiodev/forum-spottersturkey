import app from 'flarum/common/app';

/**
 * Çevrimiçi üyeler ve ne yaptıkları (GET /api/framio-activity/online).
 * Çevrimiçi widget'ı, /cevrimici sayfası ve istatistik kartı bu ortak durumu kullanır.
 */

export interface OnlineActivity {
  icon: string;
  text: string;
  subject?: string;
  href: string | null;
  writing?: boolean;
  type?: string;
  since?: string;
}

export interface OnlineRow {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  lastSeenAt?: string;
  isMe: boolean;
  activity: OnlineActivity | null;
}

interface LiveState {
  rows: OnlineRow[] | null;
  total: number;
  canViewActivity: boolean;
  at: number;
  loading: boolean;
  limit: number;
}

export const live: LiveState = { rows: null, total: 0, canViewActivity: false, at: 0, loading: false, limit: 0 };

/** @param limit 0 = widget ayarındaki kadar; sayfa daha fazlasını ister */
export function loadOnline(limit = 0, force = false): Promise<void> {
  const fresh = Date.now() - live.at < 20000 && live.limit >= limit;
  if (live.loading || (!force && fresh)) return Promise.resolve();
  live.loading = true;

  return app
    .request<any>({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio-activity/online' + (limit ? '?limit=' + limit : ''),
      errorHandler: () => {},
    } as any)
    .then((res) => {
      live.rows = res.data || [];
      live.total = (res.meta && res.meta.total) || live.rows!.length;
      live.canViewActivity = !!(res.meta && res.meta.canViewActivity);
      live.at = Date.now();
      live.limit = limit;
    })
    .catch(() => {})
    .then(() => {
      live.loading = false;
      m.redraw();
    });
}

/** Etkinliği tek cümle metin olarak (başlık/ipucu için) */
export function activityText(a: OnlineActivity | null): string {
  if (!a) return 'Çevrimiçi';
  return a.subject ? `${a.subject} ${a.text}` : a.text;
}

export function onlinePageUrl(): string {
  try {
    return app.route('framio.online');
  } catch (e) {
    return (app.forum.attribute('basePath') || '') + '/cevrimici';
  }
}
