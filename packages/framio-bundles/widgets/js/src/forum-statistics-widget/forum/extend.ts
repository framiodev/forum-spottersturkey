import Extend from 'flarum/common/extenders';
import Post from 'flarum/common/models/Post';
import StatsPage from './components/StatsPage';

export default [
  // Ayrıntılı istatistikler (izin: framio-stats.viewPage)
  new Extend.Routes().add('framio.stats', '/istatistikler', StatsPage),

  // Mesajın görüntülenme sayısı (izin: framio-stats.viewPostViews)
  new Extend.Model(Post).attribute<number>('framioViews'),
];
