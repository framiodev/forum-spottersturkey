import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';

import registerWidget from '../common/registerWidget';
import { readConfig } from '../common/metrics';
import registerPostViews from './postViews';

export { default as extend } from './extend';

app.initializers.add('fof/forum-statistics-widget', () => {
  registerWidget();

  // Mesaj görüntülenmeleri ve kimlerin görüntülediği
  registerPostViews();

  // Yerleşim admin → Forum İstatistikleri'nden gelir. "core" seçiliyse Bileşen
  // Çekirdeği'ndeki düzen kullanılır. (Başlatıcıda app.forum henüz yüklü
  // olmadığından ayar, widget'lar listelenirken okunur.)
  setTimeout(() => {
    const widgets: any = (app as any).widgets;
    if (!widgets || typeof widgets.getWidgetInstances !== 'function') return;

    override(widgets, 'getWidgetInstances', function (original: () => any[]) {
      const instances = original();
      const placement = readConfig(app.forum && app.forum.attribute('framioStatsConfig')).placement;
      if (placement && placement !== 'core') {
        instances.forEach((w: any) => {
          if (w.key === 'forumStatistics') w.placement = placement;
        });
      }
      return instances;
    });
    m.redraw();
  }, 0);
});
