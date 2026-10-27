import app from 'flarum/forum/app';

/**
 * Telefonda mesaj fotoğrafına dokununca açılan tam ekran görüntüleyici (onaylı maket 5).
 * Aynı mesajdaki fotoğraflar arasında yana kaydırılır; altta alttan açılan bilgi sayfası:
 * açık fotoğrafın EXIF kartı (Upload & EXIF'in kendi bileşeni, masaüstü tasarımı), künye ve "Konuya git".
 * Flarum bileşeni değildir: kendi katmanını body'ye ekler, kapanınca kaldırır.
 */
export default function installMobileViewer() {
  const isPhone = () => window.matchMedia('(max-width: 767px)').matches;

  document.addEventListener('click', (e) => {
    if (!isPhone()) return;
    const img = e.target.closest && e.target.closest('.Post-body img');
    if (!img || img.classList.contains('emoji') || img.closest('.MobileViewer, .FeedCard-exif, .FeedCard-kunye')) return;

    const body = img.closest('.Post-body');
    const imgs = [...body.querySelectorAll('img')].filter((i) => !i.classList.contains('emoji') && i.naturalWidth !== 1);
    if (!imgs.length) return;

    e.preventDefault();
    e.stopPropagation();
    open(imgs, imgs.indexOf(img), img.closest('.FeedCard') || body.closest('.Post') || body);
  }, true);

  // Galeriler (kategori, Keşfet, ana sayfa) için giriş noktası: mesaj modelinden görüntüleyiciyi açar
  window.FramioMobileViewer = {
    isPhone,
    openPost(post, start = 0) {
      const scope = document.createElement('div');
      scope.className = 'FeedCard';
      scope.setAttribute('data-url', app.route.post(post));
      const body = document.createElement('div');
      body.className = 'Post-body';
      body.innerHTML = post.contentHtml() || '';
      const kunye = body.querySelector('.framio-kunye-card') || body.querySelector(':scope > ul');
      if (kunye) {
        const k = document.createElement('div');
        k.className = 'FeedCard-kunye';
        k.appendChild(kunye.cloneNode(true));
        scope.appendChild(k);
      }
      const imgs = [...body.querySelectorAll('img')].filter((i) => !i.classList.contains('emoji') && (i.getAttribute('src') || i.getAttribute('data-src')));
      if (!imgs.length) return false;
      open(imgs, Math.min(start, imgs.length - 1), scope);
      return true;
    },
  };

  // Orijinal dosya (indir düğmesi): ?w= küçültmesi kaldırılır
  function originalSrc(i) {
    const src = i.currentSrc || i.src || i.getAttribute('data-src') || '';
    return src.replace(/([?&])w=\d+&?/, '$1').replace(/[?&]$/, '');
  }

  // Görüntüleyicide 1600 px yeterli: orijinaller 4K olabiliyor, telefonda gereksiz yük
  function bestSrc(i) {
    const src = originalSrc(i);
    return /img\.|\/assets\//.test(src) ? src + (src.includes('?') ? '&' : '?') + 'w=1600' : src;
  }

  function photoIdOf(i) {
    const own = i.getAttribute('data-photo-id');
    if (own) return own;
    const box = i.closest('[data-id]');
    return box && box.classList.contains('framio-image-container') ? box.getAttribute('data-id') : '';
  }

  function open(imgs, start, scope) {
    const kunyeSrc = scope.querySelector('.FeedCard-kunye .framio-kunye-card, .FeedCard-kunye ul, .Post-body > .framio-kunye-card, .Post-body > ul');
    const url = scope.getAttribute && scope.getAttribute('data-url');
    const ids = imgs.map(photoIdOf);

    const root = document.createElement('div');
    root.className = 'MobileViewer';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Fotoğraf görüntüleyici');
    root.innerHTML =
      '<div class="MobileViewer-top"><button type="button" class="MobileViewer-close" aria-label="Kapat">✕</button>' +
      '<span class="MobileViewer-count"></span><a class="MobileViewer-dl" aria-label="İndir" target="_blank" rel="noopener">⤓</a></div>' +
      '<div class="MobileViewer-track"></div>' +
      (imgs.length > 1 ? '<div class="MobileViewer-dots"></div>' : '') +
      '<div class="MobileViewer-sheet"><span class="MobileViewer-grip"></span>' +
      '<div class="MobileViewer-exif Post-body"><div class="framio-image-container SpotterCard"><div class="spotter-exif-placeholder"></div></div></div>' +
      '<div class="MobileViewer-row"><div class="MobileViewer-kunye Post-body"></div></div></div>';

    const track = root.querySelector('.MobileViewer-track');
    imgs.forEach((i) => {
      const slide = document.createElement('div');
      slide.className = 'MobileViewer-slide';
      const big = document.createElement('img');
      big.src = bestSrc(i);
      big.alt = i.alt || '';
      big.decoding = 'async';
      slide.appendChild(big);
      track.appendChild(slide);
    });

    const dots = root.querySelector('.MobileViewer-dots');
    if (dots) imgs.forEach(() => dots.appendChild(document.createElement('i')));

    // Künye: masaüstü kartının HTML'i aynen; yanında "Konuya git"
    const row = root.querySelector('.MobileViewer-row');
    if (kunyeSrc) root.querySelector('.MobileViewer-kunye').appendChild(kunyeSrc.cloneNode(true));
    if (url) {
      const go = document.createElement('a');
      go.className = 'MobileViewer-go';
      go.href = url;
      go.textContent = 'Konuya git';
      go.onclick = (ev) => { ev.preventDefault(); close(); m.route.set(url); };
      row.appendChild(go);
    }
    if (!kunyeSrc && !url) row.remove();

    // EXIF kartı: açık fotoğrafa göre (Upload & EXIF bileşeni)
    const exifHost = root.querySelector('.spotter-exif-placeholder');
    const Card = window.FramioImageManager && window.FramioImageManager.SpotterImageCard;
    let current = -1;
    const mountExif = (n) => {
      if (!Card || !exifHost) return;
      const id = ids[n];
      root.querySelector('.MobileViewer-exif').hidden = !id;
      if (!id) return;
      m.mount(exifHost, { view: () => m(Card, { key: 'v-' + id, photoId: id, initialExifOpen: true }) });
    };

    const count = root.querySelector('.MobileViewer-count');
    const dl = root.querySelector('.MobileViewer-dl');
    const setIndex = (n) => {
      if (n === current) return;
      current = n;
      count.textContent = imgs.length > 1 ? n + 1 + ' / ' + imgs.length : '';
      if (dots) [...dots.children].forEach((d, k) => d.classList.toggle('on', k === n));
      dl.href = originalSrc(imgs[n]);
      mountExif(n);
    };
    track.addEventListener('scroll', () => setIndex(Math.round(track.scrollLeft / track.clientWidth)), { passive: true });

    // Bilgi sayfası: dokununca açılıp kapanır (yarım / tam)
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
