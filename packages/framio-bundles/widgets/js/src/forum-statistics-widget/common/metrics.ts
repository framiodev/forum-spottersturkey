import app from 'flarum/common/app';

/**
 * Forum İstatistikleri: istatistik tanımları ve görünüm ayarları.
 * Forum widget'ı ve admin önizlemesi aynı tanımları kullanır.
 */

export type MetricKind = 'number' | 'person';

export interface MetricDef {
  key: string;
  kind: MetricKind;
  label: string;
  icon: string;
  /** Sunucudaki istatistiklerden değer (sayı) ve bugünkü değişim */
  value?: (s: any) => number | null | undefined;
  delta?: (s: any) => number | null | undefined;
  /** Tıklanınca gidilecek yer */
  href?: () => string | null;
  /** Kısa açıklama (ör. rekor tarihi) */
  note?: (s: any) => string | null;
}

function routeIf(name: string, params: any = {}): string | null {
  try {
    return (app as any).routes && (app as any).routes[name] ? app.route(name, params) : null;
  } catch (e) {
    return null;
  }
}

function dateText(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return null;
  }
}

export const METRICS: MetricDef[] = [
  { key: 'discussions', kind: 'number', label: 'Tartışma', icon: 'fas fa-comments', value: (s) => s.discussions?.total, delta: (s) => s.discussions?.today, href: () => routeIf('index') },
  { key: 'posts', kind: 'number', label: 'Mesaj', icon: 'fas fa-comment-dots', value: (s) => s.posts?.total, delta: (s) => s.posts?.today },
  { key: 'photos', kind: 'number', label: 'Fotoğraf', icon: 'fas fa-camera', value: (s) => s.photos?.total, delta: (s) => s.photos?.today, href: () => routeIf('index', { sort: 'gallery' }) },
  { key: 'users', kind: 'number', label: 'Üye', icon: 'fas fa-users', value: (s) => s.users?.total, delta: (s) => s.users?.today, href: () => routeIf('fof_user_directory') || routeIf('fof.user_directory') },
  { key: 'online', kind: 'number', label: 'Çevrimiçi', icon: 'fas fa-signal', value: (s) => s.online?.now, href: () => routeIf('framio.online') },
  { key: 'newUsersWeek', kind: 'number', label: 'Bu hafta katılan', icon: 'fas fa-user-plus', value: (s) => s.users?.week },
  { key: 'onlineRecord', kind: 'number', label: 'Çevrimiçi rekoru', icon: 'fas fa-trophy', value: (s) => s.online?.record, note: (s) => dateText(s.online?.recordAt) },
  { key: 'tags', kind: 'number', label: 'Kategori', icon: 'fas fa-tags', value: (s) => s.tags?.total, href: () => routeIf('tags') },
  { key: 'latestUser', kind: 'person', label: 'Son katılan', icon: 'fas fa-user-check' },
  { key: 'topWeek', kind: 'person', label: 'Haftanın en aktifi', icon: 'fas fa-medal' },
];

export interface MetricConfig {
  key: string;
  enabled: boolean;
  label?: string;
  icon?: string;
}

export interface StatsConfig {
  title: string;
  showTitle: boolean;
  layout: 'tiles' | 'list' | 'compact';
  columns: number;
  format: 'short' | 'full';
  accent: string;
  showDelta: boolean;
  animate: boolean;
  linkable: boolean;
  placement: 'core' | 'start_top' | 'start_bottom' | 'end' | 'top' | 'bottom';
  metrics: MetricConfig[];
}

// Çevrimiçi ve son katılan üyeler kendi kartlarında (Çevrimiçi, Yeni Üyeler) gösterilir
const DEFAULT_ON = ['discussions', 'posts', 'photos', 'users', 'topWeek'];

export const DEFAULT_CONFIG: StatsConfig = {
  title: 'Forum İstatistikleri',
  showTitle: true,
  layout: 'tiles',
  columns: 2,
  format: 'short',
  accent: '',
  showDelta: true,
  animate: true,
  linkable: true,
  placement: 'end',
  metrics: METRICS.map((m) => ({ key: m.key, enabled: DEFAULT_ON.includes(m.key) })),
};

/** Kayıtlı ayarı varsayılanlarla birleştirir; yeni eklenen istatistikler listenin sonuna gelir */
export function readConfig(raw: any): StatsConfig {
  let saved: any = {};
  try {
    saved = typeof raw === 'string' ? JSON.parse(raw || '{}') || {} : raw || {};
  } catch (e) {
    saved = {};
  }
  const cfg: StatsConfig = { ...DEFAULT_CONFIG, ...saved };
  const list: MetricConfig[] = Array.isArray(saved.metrics) ? saved.metrics.filter((m: any) => m && METRICS.some((d) => d.key === m.key)) : [];
  METRICS.forEach((d) => {
    if (!list.some((m) => m.key === d.key)) list.push({ key: d.key, enabled: DEFAULT_ON.includes(d.key) && !Array.isArray(saved.metrics) });
  });
  cfg.metrics = list;
  return cfg;
}

export function metricDef(key: string): MetricDef | undefined {
  return METRICS.find((m) => m.key === key);
}

/** 12400 → "12,4B" (kısa) ya da "12.400" (tam) */
export function formatValue(n: number, format: 'short' | 'full'): string {
  // Dört basamaklı sayılar tam gösterilir (1.142); kısaltma 10.000'den başlar
  if (format === 'short' && n >= 10000) {
    const units: Array<[number, string]> = [
      [1e9, 'Mr'],
      [1e6, 'M'],
      [1e3, 'B'],
    ];
    for (const [v, u] of units) {
      if (n >= v) {
        const x = n / v;
        return (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toLocaleString('tr-TR') + u;
      }
    }
  }
  return n.toLocaleString('tr-TR');
}
