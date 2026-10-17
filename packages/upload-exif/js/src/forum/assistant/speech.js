import app from 'flarum/forum/app';
/**
 * Framio Asistan: ses tanıma (tarayıcının kendi Türkçe tanıması, ücretsiz) ve sesli yanıt.
 */
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function canListen() {
  return !!Recognition;
}

/** Tek bir cümle dinler */
export function listenOnce({ onInterim } = {}) {
  return new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error('Bu tarayıcı ses tanımayı desteklemiyor.'));
    const r = new Recognition();
    r.lang = 'tr-TR';
    r.interimResults = true;
    r.maxAlternatives = 1;
    let final = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (onInterim) onInterim(final + interim);
    };
    r.onerror = (e) => reject(new Error(e.error === 'not-allowed' ? 'Mikrofon izni verilmedi.' : 'Ses anlaşılamadı.'));
    r.onend = () => resolve(final.trim());
    r.start();
  });
}

// Türkçe harf okunuşları (plakalar harf harf okunur)
const LETTERS = { A: 'a', B: 'be', C: 'ce', Ç: 'çe', D: 'de', E: 'e', F: 'fe', G: 'ge', Ğ: 'yumuşak ge', H: 'he', I: 'ı', İ: 'i', J: 'je', K: 'ke', L: 'le', M: 'me', N: 'ne', O: 'o', Ö: 'ö', P: 'pe', R: 're', S: 'se', Ş: 'şe', T: 'te', U: 'u', Ü: 'ü', V: 've', Y: 'ye', Z: 'ze', Q: 'kü', W: 've', X: 'iks' };

/**
 * Yazımı okunuşa çevirir: admin'in telaffuz sözlüğü ("Mercedes=Mersedes" satırları) ve plakalar.
 * Sözlük admin ayarından gelir; sitede tanımlı değilse yalnızca plaka kuralı uygulanır.
 */
export function pronounce(text) {
  let out = String(text || '').replace(/[*_#>]/g, '');

  // Plaka: "02 ADH 788" → "sıfır iki, a de he, 788" (il kodu tek tek, harfler harf adıyla)
  out = out.replace(/\b(\d)(\d)\s*([A-ZÇĞİÖŞÜ]{1,3})\s*(\d{2,5})\b/gu, (all, a, b, letters, num) => {
    const digit = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
    const code = a === '0' ? 'sıfır ' + digit[+b] : a + b;
    return `${code}, ${[...letters].map((l) => LETTERS[l] || l).join(' ')}, ${num}`;
  });

  const dict = String(app.forum.attribute('framioAssistantSay') || '')
    .split(/\r?\n/)
    .map((l) => l.split('='))
    .filter((p) => p.length === 2 && p[0].trim() && p[1].trim())
    .sort((x, y) => y[0].trim().length - x[0].trim().length);
  dict.forEach(([from, to]) => {
    const re = new RegExp('(^|[^\\p{L}])' + from.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^\\p{L}])', 'giu');
    out = out.replace(re, (m, pre) => pre + to.trim());
  });

  return out;
}

// Konuşmalar sıraya girer: asistan bir cümleyi bitirmeden ne yeni cümleye ne de işe geçer
let queue = Promise.resolve();
let speaking = 0;

/** Türkçe sesli yanıt; konuşma bitince çözülen bir söz (promise) döner */
export function speak(text) {
  if (!window.speechSynthesis || !text) return queue;
  speaking++;
  queue = queue.then(
    () =>
      new Promise((resolve) => {
        try {
          const u = new SpeechSynthesisUtterance(pronounce(text));
          u.lang = 'tr-TR';
          const voice = window.speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('tr'));
          if (voice) u.voice = voice;
          u.rate = 1.05;
          // Bazı tarayıcılar "end" olayını kaçırabilir: metin uzunluğuna göre üst sınır
          const guard = setTimeout(resolve, 2000 + String(text).length * 90);
          const done = () => {
            clearTimeout(guard);
            resolve();
          };
          u.onend = done;
          u.onerror = done;
          window.speechSynthesis.speak(u);
        } catch (e) {
          resolve();
        }
      })
  );
  const mine = queue;
  mine.then(() => speaking--);
  return mine;
}

/** Asistan şu an konuşuyor mu / konuşması bitene kadar bekle */
export function isSpeaking() {
  return speaking > 0;
}
export function whenQuiet() {
  return queue;
}

/** Konuşmayı hemen kes (kullanıcı araya girdiğinde) */
export function hush() {
  try {
    window.speechSynthesis.cancel();
  } catch (e) {}
}

/**
 * Uyandırma sözü dinleyicisi: arka planda sürekli dinler; söz duyulunca geri kalan cümleyi komut
 * olarak verir ("Hey Arşiv, 06 ABC 123'ü paylaş" → "06 ABC 123'ü paylaş").
 */
export function wakeListener(phrases, onWake) {
  if (!Recognition) return { stop() {} };
  const norm = (s) =>
    String(s || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/[^a-zçğıöşü0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const list = phrases.map(norm).filter(Boolean);
  let stopped = false;
  let r = null;
  let paused = false;

  const start = () => {
    if (stopped || paused) return;
    r = new Recognition();
    r.lang = 'tr-TR';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      // Asistan konuşurken duyduklarını kendi sesi sayar; uyanmaz
      if (speaking > 0) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const heard = norm(e.results[i][0].transcript);
        const hit = list.find((p) => heard.includes(p));
        if (hit) {
          const rest = heard.slice(heard.indexOf(hit) + hit.length).trim();
          onWake(rest);
        }
      }
    };
    // Tarayıcı belli aralıklarla dinlemeyi kapatır; sessizce yeniden başlatılır
    r.onend = () => setTimeout(start, 400);
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') stopped = true;
    };
    try {
      r.start();
    } catch (e) {}
  };
  start();

  return {
    stop() {
      stopped = true;
      try {
        r && r.stop();
      } catch (e) {}
    },
    // Asistan kendisi dinlerken uyandırma dinleyicisi susar (mikrofon çakışmasın)
    pause() {
      paused = true;
      try {
        r && r.stop();
      } catch (e) {}
    },
    resume() {
      if (!paused) return;
      paused = false;
      start();
    },
  };
}
