import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';

/**
 * Mesaj sayfasına (/d/X-slug/N) doğrudan gelindiğinde başlık, sunucunun verdiği mesaj başlığı (künye) olarak kalır.
 * Flarum konu açılınca başlığı konu adına çevirdiği için Google'ın işlediği (JS çalıştırılmış) sayfada ve sekmede
 * "Mercedes-Benz Travego" görünüyordu; mesaj sayfasının kendi başlığı "Metro Turizm | 41 HG 609 - …" olmalı.
 */
export default function postTitle() {
  const landing = window.location.pathname;
  if (!/^\/d\/[^/]+\/\d+\/?$/.test(landing)) return;
  const meta = document.querySelector('meta[property="og:title"]');
  const site = app.forum && app.forum.attribute('title');
  // og:title sonunda site adı var; Flarum başlığa site adını kendisi ekler (çift olmasın)
  let title = meta && meta.getAttribute('content');
  if (title && site && title.endsWith(' | ' + site)) title = title.slice(0, -(' | ' + site).length);
  if (!title) return;

  extend('flarum/forum/components/DiscussionPage', 'show', function () {
    // Yalnızca ilk iniş sayfasında; forumda başka yere geçilince Flarum'un kendi başlığı geçerli
    if (window.location.pathname.replace(/\/\d+\/?$/, '') === landing.replace(/\/\d+\/?$/, '')) app.setTitle(title);
  });
}
