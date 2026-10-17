/**
 * Framio Asistan "uzaktan kullanım" görünümü: asistan bir adım attığında ekranda bir imleç
 * ilgili öğeye gider, tıklama dalgası gösterir; alanlar yazılıyormuş gibi dolar.
 * Yalnızca görsel bir anlatımdır; asıl işler API üzerinden yapılır.
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ghost = {
  el: null,
  enabled: false,

  ensure() {
    if (this.el) return this.el;
    this.el = document.createElement('div');
    this.el.className = 'FramioGhost';
    this.el.innerHTML =
      '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4 2l16 9.5-7 1.6-3.6 6.9z" fill="var(--primary-color)" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg><span class="FramioGhost-label"></span>';
    this.el.style.left = window.innerWidth - 60 + 'px';
    this.el.style.top = window.innerHeight - 60 + 'px';
    document.body.appendChild(this.el);
    return this.el;
  },

  hide() {
    if (this.el) this.el.classList.remove('is-visible');
  },

  /** İmleci öğenin üzerine götürür; label kısa açıklama ("Paylaş'a tıklıyorum") */
  async moveTo(target, label = '') {
    if (!this.enabled || !target) return;
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const g = this.ensure();
    el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    await wait(reduced() ? 0 : 250);
    const r = el.getBoundingClientRect();
    g.classList.add('is-visible');
    g.querySelector('.FramioGhost-label').textContent = label;
    g.style.left = Math.round(r.left + Math.min(r.width / 2, 60)) + 'px';
    g.style.top = Math.round(r.top + Math.min(r.height / 2, 24)) + 'px';
    await wait(reduced() ? 0 : 650);
  },

  async click(target, label = '') {
    if (!this.enabled) return;
    await this.moveTo(target, label);
    const g = this.ensure();
    g.classList.remove('is-click');
    void g.offsetWidth;
    g.classList.add('is-click');
    await wait(reduced() ? 0 : 350);
  },

  /** Alanı karakter karakter doldurur (görsel); value sonunda kesin olarak yazılır */
  async type(input, value, setter) {
    if (!this.enabled || !input || !value || reduced()) {
      setter(value);
      return;
    }
    await this.moveTo(input);
    const text = String(value);
    for (let i = 1; i <= text.length; i++) {
      setter(text.slice(0, i));
      m.redraw.sync();
      await wait(18);
    }
  },
};

export default ghost;
