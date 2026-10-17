/**
 * Framio Asistan görev yardımcıları: EXIF çekim yılı, plaka, zaman çizelgesi, cevap yorumlama.
 */

/** Fotoğrafın çekim yılı (EXIF DateTimeOriginal), yoksa dosya tarihi */
export async function shotYear(file) {
  try {
    const buf = await file.slice(0, 128 * 1024).arrayBuffer();
    const text = new TextDecoder('latin1').decode(new Uint8Array(buf));
    const m = text.match(/(19|20)\d{2}:[01]\d:[0-3]\d [0-2]\d:[0-5]\d:[0-5]\d/);
    if (m) return Number(m[0].slice(0, 4));
  } catch (e) {}
  return file.lastModified ? new Date(file.lastModified).getFullYear() : null;
}

/** Dosya adındaki plaka ("02 ADH 788.webp" → "02ADH788"), çeşitlilik için */
export function plateKey(name) {
  const m = String(name || '')
    .toLocaleUpperCase('tr-TR')
    .match(/(0[1-9]|[1-7]\d|8[01])[\s_.-]*([A-ZÇĞİÖŞÜ]{1,3})[\s_.-]*(\d{2,5})/);
  return m ? m[1] + m[2] + m[3] : null;
}

/**
 * Paylaşım zamanları: "7 gün, günde 10, saat 12:00" → 70 zaman. Saat bugün geçtiyse yarından başlar.
 * Aynı gündeki paylaşımlar akışı doldurmasın diye 3 dakika arayla sıralanır.
 */
export function slots({ count, days, perDay, time }) {
  const [hh, mm] = String(time || '12:00').split(':').map(Number);
  perDay = perDay || (days ? Math.ceil(count / days) : count);
  days = days || Math.ceil(count / perDay);
  const start = new Date();
  start.setSeconds(0, 0);
  const first = new Date(start);
  first.setHours(hh, mm, 0, 0);
  if (first <= start) first.setDate(first.getDate() + 1);

  const out = [];
  for (let d = 0; d < days && out.length < count; d++) {
    for (let i = 0; i < perDay && out.length < count; i++) {
      const t = new Date(first);
      t.setDate(first.getDate() + d);
      t.setMinutes(t.getMinutes() + i * 3);
      out.push(t);
    }
  }
  return out;
}

/** Sunucuya yerel saatle gönderim: "2026-10-18 12:03" */
export function localStamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function humanDate(d) {
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

/** "fark etmez", "otomatik", "hayır yok" gibi serbest bırakma cevapları */
export function isAny(text) {
  return /^(fark etmez|farketmez|otomatik|hepsi|her ?hangi|yok|hayır|olmasın|sen seç|sen karar ver|önemli değil|boş)/i.test(String(text || '').trim().toLocaleLowerCase('tr-TR'));
}

export function isYes(text) {
  return /^(evet|tamam|olur|onay|başla|devam|uygun|peki)/i.test(String(text || '').trim().toLocaleLowerCase('tr-TR'));
}
