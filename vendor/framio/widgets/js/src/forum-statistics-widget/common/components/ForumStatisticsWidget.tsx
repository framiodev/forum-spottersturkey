import app from 'flarum/common/app';
import type Mithril from 'mithril';
import Widget, { WidgetAttrs } from '../../../forum-widgets-core/common/components/Widget';
import StatsView from './StatsView';
import { readConfig } from '../metrics';

/**
 * Forum İstatistikleri widget'ı. Veriler sayfayla birlikte gelir (forum verisindeki
 * "framioStats"); ayrı istek atılmaz. Görünüm admin → Forum İstatistikleri'nden yönetilir.
 */
export default class ForumStatisticsWidget extends Widget<WidgetAttrs> {
  config() {
    return readConfig(app.forum.attribute('framioStatsConfig'));
  }

  className(): string {
    const c = this.config();
    return 'Framio-ForumStatisticsWidget' + (c.showTitle ? '' : ' Framio-ForumStatisticsWidget--notitle');
  }

  icon(): string {
    return 'fas fa-chart-bar';
  }

  title(): string {
    return this.config().title || 'Forum İstatistikleri';
  }

  description(): string {
    return '';
  }

  moreHref(): string | null {
    if (!app.forum.attribute('framioCanViewStatsPage')) return null;
    try {
      return app.route('framio.stats');
    } catch (e) {
      return null;
    }
  }

  content(): Mithril.Children {
    // Çevrimiçi satırı için üyeler (Çevrimiçi Kullanıcılar modülünün forum verisinden)
    const forum: any = app.forum;
    const users = (typeof forum.onlineUsers === 'function' ? forum.onlineUsers() || [] : []).filter(Boolean);
    const onlineUsers = users.map((u: any) => ({ avatarUrl: u.avatarUrl(), displayName: u.displayName() }));

    return <StatsView stats={app.forum.attribute('framioStats')} config={this.config()} onlineUsers={onlineUsers} moreHref={this.moreHref()} />;
  }
}
