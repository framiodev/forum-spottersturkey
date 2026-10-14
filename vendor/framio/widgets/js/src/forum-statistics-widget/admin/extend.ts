import app from 'flarum/admin/app';
import Extend from 'flarum/common/extenders';
import StatsSettingsPage from './StatsSettingsPage';

// İzin adı → etiket
const PERMS: Array<[string, string]> = [
  ['framio-stats.view.discussions', 'Tartışma ve kategori sayısını görebilir'],
  ['framio-stats.view.posts', 'Mesaj sayısını görebilir'],
  ['framio-stats.view.photos', 'Fotoğraf sayısını görebilir'],
  ['framio-stats.view.users', 'Üye sayılarını görebilir'],
  ['framio-stats.view.online', 'Çevrimiçi sayısını ve rekoru görebilir'],
  ['framio-stats.view.latestMember', 'En son katılan üyeyi görebilir'],
  ['framio-stats.view.topWeek', 'Haftanın en aktif üyesini görebilir'],
  // Ayrıntılı istatistikler ve görüntülenmeler
  ['framio-stats.viewPage', 'İstatistik sayfasını (/istatistikler) görebilir'],
  ['framio-stats.viewPostViews', 'Mesajların kaç kez okunduğunu görebilir'],
  ['framio-stats.viewViewers', 'Mesajı/tartışmayı kimlerin görüntülediğini görebilir'],
];

const admin = new Extend.Admin('framio-widgets:forum-statistics-widget').page(StatsSettingsPage);

PERMS.forEach(([permission, label]) =>
  admin.permission(
    () => ({
      icon: 'fas fa-chart-bar',
      label,
      permission,
      allowGuest: permission !== 'framio-stats.viewViewers',
    }),
    'view'
  )
);

export default [admin];
