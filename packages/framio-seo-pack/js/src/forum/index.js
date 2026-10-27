import app from 'flarum/forum/app';
import Extend from 'flarum/common/extenders';
import Post from 'flarum/common/models/Post';
import analytics from './analytics';
import ads from './ads';
import searchTracker from './searchTracker';
import kunyeLinks from './kunyeLinks';
import postTitle from './postTitle';
import HubPage from './components/HubPage';
import HubIndexPage from './components/HubIndexPage';

// Rota adları sunucudaki Extend\Frontend->route() adlarıyla aynı olmalı
export const extend = [
  new Extend.Routes()
    .add('framio-seo.hubs', '/arac', HubIndexPage)
    .add('framio-seo.hub', '/arac/:type/:slug', HubPage),

  new Extend.Model(Post).attribute('seoEntities'),
];

app.initializers.add('framio-seo-pack', () => {
  // Biri hata verse de diğerleri çalışsın ve forumda "başlatılamadı" uyarısı çıkmasın
  [analytics, ads, searchTracker, kunyeLinks, postTitle].forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('[framio-seo-pack]', fn.name, e);
    }
  });
});
