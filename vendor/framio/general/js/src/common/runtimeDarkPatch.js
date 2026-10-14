/**
 * Karanlık Mod uyumluluk katmanının tarayıcı tarafı.
 * Sunucu tarafı yalnızca derlenmiş forum.css/admin.css'i yamalar; bazı eklentiler CSS'lerini
 * çalışma anında <style> etiketi olarak ekler (künye penceresi, mesajlaşma vb.). Bu modül
 * sonradan eklenen <style> etiketlerini izler ve sabit açık renkler için yalnızca karanlık
 * temada geçerli karşılık kuralları üretir (CssDarkPatcher.php ile aynı mantık).
 * Yalnızca sunucu yama bağlantısını (#framio-dark-patch) eklediyse çalışır.
 */
const DARK = 'html[data-theme^=dark]';
const OUT_ID = 'framio-dark-runtime';

const lum = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const hex = ([r, g, b]) => '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');

/** CSSOM değeri rgb()/rgba() olarak döner */
function parseColor(value) {
  const all = value.match(/rgba?\([^)]*\)/g);
  if (!all || all.length !== 1) return null;
  const n = all[0].match(/[\d.]+/g).map(Number);
  return { rgb: n.slice(0, 3), a: n.length > 3 ? n[3] : 1 };
}

const SKIP = /var\(|gradient|url\(|inherit|currentcolor|transparent|none|color-mix/i;

function convert(style) {
  const out = [];
  const imp = (p) => (style.getPropertyPriority(p) ? ' !important' : '');

  const bg = style.getPropertyValue('background-color');
  if (bg && !SKIP.test(bg)) {
    const c = parseColor(bg);
    if (c && c.a >= 0.5 && lum(c.rgb) >= 0.72) {
      const chroma = Math.max(...c.rgb) - Math.min(...c.rgb);
      out.push(
        'background-color:' +
          (chroma >= 20 ? `color-mix(in srgb, ${hex(c.rgb)} 14%, var(--control-bg))` : 'var(--framio-dm-surface)') +
          imp('background-color')
      );
    }
  }

  const color = style.getPropertyValue('color');
  if (color && !SKIP.test(color)) {
    const c = parseColor(color);
    if (c) {
      const l = lum(c.rgb);
      const chroma = Math.max(...c.rgb) - Math.min(...c.rgb);
      let v = null;
      if (l < 0.03) v = 'var(--text-color)';
      else if (chroma >= 40 && l < 0.2) v = `color-mix(in srgb, ${hex(c.rgb)} 50%, #fff)`;
      else if (l < 0.12) v = 'var(--text-color)';
      else if (l < 0.3 && chroma < 40) v = 'var(--muted-color)';
      if (v) out.push('color:' + v + imp('color'));
    }
  }

  for (const side of ['top', 'right', 'bottom', 'left']) {
    const p = `border-${side}-color`;
    const v = style.getPropertyValue(p);
    if (!v || SKIP.test(v)) continue;
    const c = parseColor(v);
    if (c && c.a >= 0.3 && lum(c.rgb) >= 0.6) out.push(`${p}:var(--framio-dm-border)` + imp(p));
  }

  return out;
}

function prefix(selector) {
  return selector
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/^(html|:root)\b/i.test(p) ? DARK + p.replace(/^(html|:root)/i, '') : DARK + ' ' + p))
    .join(',');
}

function patchRules(rules) {
  let css = '';
  for (const r of rules) {
    if (r.type === CSSRule.STYLE_RULE) {
      if (/data-theme/i.test(r.selectorText)) continue;
      const decl = convert(r.style);
      if (decl.length) css += prefix(r.selectorText) + '{' + decl.join(';') + '}';
    } else if (r.type === CSSRule.MEDIA_RULE || r.type === CSSRule.SUPPORTS_RULE) {
      if (/\bprint\b/i.test(r.conditionText || '')) continue;
      const inner = patchRules(r.cssRules);
      if (inner) css += '@' + (r.type === CSSRule.MEDIA_RULE ? 'media ' : 'supports ') + r.conditionText + '{' + inner + '}';
    }
  }
  return css;
}

export default function runtimeDarkPatch() {
  if (typeof document === 'undefined' || !document.getElementById('framio-dark-patch')) return;

  const done = new WeakMap(); // <style> → son işlenen içerik
  let out;

  const ensureOut = () => {
    if (!out || !out.isConnected) {
      out = document.createElement('style');
      out.id = OUT_ID;
      document.head.appendChild(out);
    }
    return out;
  };

  const chunks = new Map(); // <style> → üretilen CSS

  const process = (el) => {
    if (!(el instanceof HTMLStyleElement) || el.id === OUT_ID || el.id === 'framio-dark-mode') return false;
    const text = el.textContent || '';
    if (done.get(el) === text) return false;
    done.set(el, text);
    let css = '';
    try {
      if (el.sheet) css = patchRules(el.sheet.cssRules);
    } catch (e) {
      css = '';
    }
    if (css) chunks.set(el, css);
    else chunks.delete(el);
    return true;
  };

  const flush = () => {
    let css = '';
    for (const [el, c] of chunks) {
      if (el.isConnected) css += c;
      else chunks.delete(el);
    }
    const o = ensureOut();
    if (o.textContent !== css) o.textContent = css;
    // Çıktı her zaman en sonda dursun (aynı özgüllükte sonradan gelen kurallar kazanmasın)
    if (o.nextElementSibling) document.head.appendChild(o);
  };

  const scanAll = () => {
    let changed = false;
    document.querySelectorAll('style').forEach((el) => (changed = process(el) || changed));
    if (changed) flush();
  };

  scanAll();

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scanAll();
    });
    setTimeout(() => scheduled && ((scheduled = false), scanAll()), 200); // gizli sekmede rAF durur
  };

  new MutationObserver((muts) => {
    for (const m of muts) {
      const t = m.type === 'characterData' ? m.target.parentNode : m.target;
      if (!t || t.id === OUT_ID) continue;
      if (t instanceof HTMLStyleElement || [...m.addedNodes].some((n) => n.nodeName === 'STYLE')) {
        schedule();
        return;
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
}
