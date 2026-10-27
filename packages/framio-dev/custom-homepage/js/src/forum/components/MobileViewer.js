/**
 * Telefonda mesaj fotoğrafına dokununca açılan tam ekran görüntüleyici.
 * Aynı mesajdaki fotoğraflar arasında yana kaydırarak geçilir; altta künye bilgisi gösterilir.
 * Flarum bileşeni değildir: kendi katmanını body'ye ekler, kapanınca kaldırır.
 */
export default function installMobileViewer() {
  const isPhone = () => window.matchMedia('(max-width: 767px)').matches;

  document.addEventListener('click', (e) => {
    if (!isPhone()) return;
    const img = e.target.closest && e.target.closest('.Post-body img');
    if (!img || img.classList.contains('emoji') || img.closest('.MobileViewer')) return;

    const body = img.closest('.Post-body');
    const imgs = [...body.querySelectorAll('img')].filter((i) => !i.classList.contains('emoji') && i.naturalWidth !== 1);
    if (!imgs.length) return;

    e.preventDefault();
    e.stopPropagation();
    open(imgs, imgs.indexOf(img), body);
  }, true);

  function bestSrc(i) {
    const src = i.currentSrc || i.src || i.getAttribute('data-src') || '';
    // Görüntüleyicide büyük boy: ?w= küçültmesi kaldırılır
    return src.replace(/([?&])w=\d+&?/, '$1').replace(/[?&]$/, '');
  }

  function open(imgs, start, body) {
    const facts = [...body.querySelectorAll('ul li')].map((li) => li.textContent.trim()).filter(Boolean).slice(0, 8);

    const root = document.createElement('div');
    root.className = 'MobileViewer';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Fotoğraf görüntüleyici');
    root.innerHTML =
      '<div class="MobileViewer-top"><button type="button" class="MobileViewer-close" aria-label="Kapat">✕</button>' +
      '<span class="MobileViewer-count"></span><span></span></div>' +
      '<div class="MobileViewer-track"></div>' +
      (imgs.length > 1 ? '<div class="MobileViewer-dots"></div>' : '') +
      (facts.length ? '<ul class="MobileViewer-facts"></ul>' : '');

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
    const list = root.querySelector('.MobileViewer-facts');
    if (list) facts.forEach((f) => { const li = document.createElement('li'); li.textContent = f; list.appendChild(li); });

    const count = root.querySelector('.MobileViewer-count');
    const setIndex = (n) => {
      count.textContent = imgs.length > 1 ? n + 1 + ' / ' + imgs.length : '';
      if (dots) [...dots.children].forEach((d, k) => d.classList.toggle('on', k === n));
    };
    track.addEventListener('scroll', () => setIndex(Math.round(track.scrollLeft / track.clientWidth)), { passive: true });

    const close = () => {
      root.remove();
      document.documentElement.classList.remove('MobileViewer-open');
      window.removeEventListener('popstate', onPop);
    };
    const onPop = () => close();
    root.querySelector('.MobileViewer-close').onclick = () => history.back();
    // Aşağı kaydırarak kapatma
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
