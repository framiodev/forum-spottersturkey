import app from 'flarum/forum/app';

/**
 * Telefon tam ekran görüntüleyici (onaylı maket 5).
 * Kayan şerit tek gönderiyle sınırlı değildir: sayfadaki sıradaki gönderilerin fotoğrafları arkaya
 * eklenir, yana kaydırdıkça bir sonraki gönderiye geçilir. Her fotoğraf kendi gönderisinin EXIF kartını
 * (Upload & EXIF bileşeni), künyesini ve "Konuya git" adresini taşır.
 * Flarum bileşeni değildir: kendi katmanını body'ye ekler, kapanınca kaldırır.
 */
export default function installMobileViewer() {
  const isPhone = () => window.matchMedia('(max-width: 767px)').matches;

  // Orijinal dosya (indir düğmesi): ?w= küçültmesi kaldırılır
  const originalSrc = (src) => String(src || '').replace(/([?&])w=\d+&?/, '$1').replace(/[?&]$/, '');
  // Ekranda 1600 px yeterli: orijinaller 4K olabiliyor
  const screenSrc = (src) => {
    const o = originalSrc(src);
    return /img\.|\/assets\//.test(o) ? o + (o.includes('?') ? '&' : '?') + 'w=1600' : o;
  };

  /** Bir gönderinin HTML'inden görüntüleyici kayıtları: her fotoğraf için {src, id, url, kunyeHtml} */
  function entriesFromHtml(html, url, pid = '') {
    const body = document.createElement('div');
    body.innerHTML = html || '';
    const kunye = body.querySelector('.framio-kunye-card') || body.querySelector(':scope > ul');
    const kunyeHtml = kunye ? kunye.outerHTML : '';
    return [...body.querySelectorAll('img')]
      .filter((i) => !i.classList.contains('emoji') && (i.getAttribute('src') || i.getAttribute('data-src')))
      .map((i) => {
        const box = i.closest('.framio-image-container[data-id]');
        return { src: i.getAttribute('src') || i.getAttribute('data-src'), alt: i.getAttribute('alt') || '', id: box ? box.getAttribute('data-id') : '', url, pid, kunyeHtml };
      });
  }
  const entriesFromPost = (post) => entriesFromHtml(post.contentHtml(), app.route.post(post), String(post.id()));

  // Sayfadaki gönderi sırası (Akış kartları, mesaj sayfası)
  const pagePosts = () => [...document.querySelectorAll('.FeedCard[data-post-id]')]
    .map((el) => app.store.getById('posts', el.getAttribute('data-post-id')))
    .filter(Boolean);

  document.addEventListener('click', (e) => {
    if (!isPhone()) return;
    const img = e.target.closest && e.target.closest('.FeedCard-slide img, .Post .Post-body img');
    if (!img || img.classList.contains('emoji') || img.closest('.MobileViewer, .FeedCard-exif, .FeedCard-kunye')) return;

    const card = img.closest('.FeedCard[data-post-id]');
    let entries = [];
    let start = 0;
    if (card) {
      const posts = pagePosts();
      const at = posts.findIndex((p) => String(p.id()) === card.getAttribute('data-post-id'));
      const slideIndex = [...card.querySelectorAll('.FeedCard-slide img')].indexOf(img);
      posts.forEach((p, k) => {
        if (k === at) start = entries.length + Math.max(0, slideIndex);
        entries = entries.concat(entriesFromPost(p));
      });
    } else {
      // Masaüstü düzeninde kalan mesajlar: yalnızca o mesajın fotoğrafları
      const body = img.closest('.Post-body');
      const imgs = [...body.querySelectorAll('img')].filter((i) => !i.classList.contains('emoji'));
      entries = entriesFromHtml(body.innerHTML, '');
      start = Math.max(0, imgs.indexOf(img));
    }
    if (!entries.length) return;

    e.preventDefault();
    e.stopPropagation();
    open(entries, start);
  }, true);

  // Galeriler (kategori, Keşfet, ana sayfa, profil) için giriş noktası
  window.FramioMobileViewer = {
    isPhone,
    /** posts: sıradaki gönderiler (kaydırınca geçilir), start: açılacak gönderinin sırası */
    openPosts(posts, start = 0) {
      let entries = [];
      let at = 0;
      posts.forEach((p, k) => {
        if (k === start) at = entries.length;
        entries = entries.concat(entriesFromPost(p));
      });
      if (!entries.length) return false;
      open(entries, at);
      return true;
    },
    openPost(post) {
      return this.openPosts([post], 0);
    },
  };

  function open(entries, start) {
    const root = document.createElement('div');
    root.className = 'MobileViewer';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Fotoğraf görüntüleyici');
    root.innerHTML =
      '<div class="MobileViewer-top"><button type="button" class="MobileViewer-close" aria-label="Kapat">✕</button>' +
      '<span class="MobileViewer-count"></span><a class="MobileViewer-dl" aria-label="İndir" target="_blank" rel="noopener">⤓</a></div>' +
      '<div class="MobileViewer-track"></div>' +
      '<div class="MobileViewer-dots"></div>' +
      '<div class="MobileViewer-sheet"><span class="MobileViewer-grip"></span>' +
      '<div class="MobileViewer-exif Post-body"><div class="framio-image-container SpotterCard"><div class="spotter-exif-placeholder"></div></div></div>' +
      '<div class="MobileViewer-row"><div class="MobileViewer-kunye Post-body SpottersGallery-DescContent"></div><a class="MobileViewer-go" href="#">Konuya git</a></div></div>';

    const track = root.querySelector('.MobileViewer-track');
    entries.forEach((en, k) => {
      const slide = document.createElement('div');
      slide.className = 'MobileViewer-slide';
      const big = document.createElement('img');
      big.alt = en.alt || '';
      big.decoding = 'async';
      // Yakındaki fotoğraflar hemen, uzaktakiler kaydırıldıkça yüklenir
      big.dataset.src = screenSrc(en.src);
      if (Math.abs(k - start) <= 1) big.src = big.dataset.src;
      slide.appendChild(big);
      track.appendChild(slide);
    });

    const dots = root.querySelector('.MobileViewer-dots');
    const count = root.querySelector('.MobileViewer-count');
    const dl = root.querySelector('.MobileViewer-dl');
    const kunyeBox = root.querySelector('.MobileViewer-kunye');
    const go = root.querySelector('.MobileViewer-go');
    const exifWrap = root.querySelector('.MobileViewer-exif');
    const exifHost = root.querySelector('.spotter-exif-placeholder');
    const Card = window.FramioImageManager && window.FramioImageManager.SpotterImageCard;

    // Aynı gönderinin fotoğrafları bir grup: sayaç ve noktalar grup içinde
    const groupOf = (n) => {
      const url = entries[n].url;
      let a = n;
      let b = n;
      while (url && a > 0 && entries[a - 1].url === url) a--;
      while (url && b < entries.length - 1 && entries[b + 1].url === url) b++;
      return [a, b];
    };

    let current = -1;
    let currentUrl = null;
    const setIndex = (n) => {
      if (n === current || !entries[n]) return;
      current = n;
      const en = entries[n];
      [n - 1, n, n + 1].forEach((k) => {
        const im = track.children[k] && track.children[k].firstChild;
        if (im && !im.getAttribute('src')) im.src = im.dataset.src;
      });

      const [a, b] = groupOf(n);
      const size = b - a + 1;
      count.textContent = size > 1 ? n - a + 1 + ' / ' + size : '';
      dots.innerHTML = size > 1 ? Array.from({ length: size }, (_, k) => '<i' + (k === n - a ? ' class="on"' : '') + '></i>').join('') : '';
      dl.href = originalSrc(en.src);

      // EXIF: açık fotoğrafın kartı
      exifWrap.hidden = !(en.id && Card);
      if (en.id && Card) m.mount(exifHost, { view: () => m(Card, { key: 'v-' + en.id, photoId: en.id, initialExifOpen: true }) });

      // Künye ve "Konuya git": gönderi değişince güncellenir
      if (en.url !== currentUrl) {
        currentUrl = en.url;
        kunyeBox.innerHTML = en.kunyeHtml || '';
        // SEO Pack bu kutuyu görünce künye adlarını /arac sayfalarına bağlar
        if (en.pid) kunyeBox.setAttribute('data-post-id', en.pid); else kunyeBox.removeAttribute('data-post-id');
        go.hidden = !en.url;
        go.href = en.url || '#';
      }
    };
    track.addEventListener('scroll', () => setIndex(Math.round(track.scrollLeft / track.clientWidth)), { passive: true });

    go.onclick = (ev) => {
      ev.preventDefault();
      const url = entries[current] && entries[current].url;
      close();
      if (url) m.route.set(url);
    };

    const sheet = root.querySelector('.MobileViewer-sheet');
    root.querySelector('.MobileViewer-grip').onclick = () => sheet.classList.toggle('is-open');

    const close = () => {
      if (exifHost) m.mount(exifHost, null);
      root.remove();
      document.documentElement.classList.remove('MobileViewer-open');
      window.removeEventListener('popstate', onPop);
    };
    const onPop = () => close();
    root.querySelector('.MobileViewer-close').onclick = () => history.back();
    // Fotoğrafı aşağı kaydırarak kapatma
    let y0 = null;
    track.addEventListener('touchstart', (ev) => { y0 = ev.touches[0].clientY; }, { passive: true });
    track.addEventListener('touchend', (ev) => {
      if (y0 !== null && ev.changedTouches[0].clientY - y0 > 120) history.back();
      y0 = null;
    }, { passive: true });

    document.body.appendChild(root);
    document.documentElement.classList.add('MobileViewer-open');
    // Telefonun geri tuşu görüntüleyiciyi kapatsın, sayfadan çıkmasın
    history.pushState({ mobileViewer: true }, '');
    window.addEventListener('popstate', onPop);

    track.scrollLeft = start * track.clientWidth;
    setIndex(start);
  }
}
