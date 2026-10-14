import app from 'flarum/common/app';
import Widgets from '../../forum-widgets-core/common/extend/Widgets';

import ForumStatisticsWidget from './components/ForumStatisticsWidget';
import NewMembersWidget from './components/NewMembersWidget';
import { readConfig } from './metrics';

export default function () {
  const cfg = readConfig(app.forum && app.forum.attribute('framioStatsConfig'));

  new Widgets()
    .add({
      key: 'forumStatistics',
      component: ForumStatisticsWidget,
      // Görünecek istatistik yoksa (izin ya da ayar) widget gizlenir
      isDisabled: () => {
        const s: any = app.forum.attribute('framioStats') || {};
        return !Object.keys(s).some((k) => k !== 'computedAt' && s[k]);
      },
      isUnique: true,
      placement: cfg.placement === 'core' ? 'end' : cfg.placement,
      position: 0,
    })
    // Yeni Üyeler: sağ sütunda Çevrimiçi kartının altında (yeri Bileşen Çekirdeği'nden değiştirilebilir)
    .add({
      key: 'newMembers',
      component: NewMembersWidget,
      isDisabled: () => {
        const s: any = app.forum.attribute('framioStats') || {};
        return !(s.newMembers && s.newMembers.length);
      },
      isUnique: true,
      placement: 'end',
      position: 2,
    })
    .extend(app, 'fof-forum-statistics-widget');
}
