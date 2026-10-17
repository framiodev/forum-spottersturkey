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

/** Türkçe sesli yanıt */
export function speak(text) {
  if (!window.speechSynthesis || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[*_#>]/g, ''));
    u.lang = 'tr-TR';
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('tr'));
    if (voice) u.voice = voice;
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
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
