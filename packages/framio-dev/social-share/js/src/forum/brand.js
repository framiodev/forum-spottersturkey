import app from 'flarum/common/app';

/**
 * Foruma özel marka bilgileri (sunucuda Brand::get(); admin → Marka ve Gönderi Metni).
 * Boş alanlar forumun başlığı ve adresinden türetilir; hiçbir site adı kodda sabit değildir.
 */
export const DEFAULT_TEMPLATE = '{header}\n\n{text}\n\n{trivia}\n\n{more_info}\n\n{kunye}\n📌 {location}\n\n📸: {author}\n\n{tags}';

export function brand() {
  const b = (app.forum && app.forum.attribute('framioSocialBrand')) || {};
  const host = window.location.host;
  const name = b.name || (app.forum && app.forum.attribute('title')) || host;
  const handle = b.handle || host.replace(/^(forum|www)\./, '').split('.')[0];
  const site = b.site || host;
  return {
    name,
    handle,
    site,
    hashtag: b.hashtag || name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^A-Za-z0-9]/g, ''),
    email: b.email || '',
    more_info: b.more_info || `Daha fazlası için: ${site} | @${handle}`,
    template: b.template || DEFAULT_TEMPLATE,
  };
}

/** Gönderi metni şablonu: boş değişkenli satırlar atılır, fazla boş satırlar toplanır (sunucudaki Brand::render ile aynı) */
export function renderCaption(vars, template) {
  const b = brand();
  const all = Object.assign({ brand: b.name, handle: b.handle, site: b.site, more_info: b.more_info }, vars);
  const out = [];
  String(template || b.template)
    .split(/\r?\n/)
    .forEach((line) => {
      const used = (line.match(/\{([a-z_]+)\}/g) || []).map((x) => x.slice(1, -1));
      const onlyVars = line.replace(/\{[a-z_]+\}/g, '').trim() === '';
      if (used.length && onlyVars && !used.some((k) => String(all[k] == null ? '' : all[k]).trim() !== '')) return;
      out.push(line.replace(/\{([a-z_]+)\}/g, (m, k) => (all[k] == null ? '' : String(all[k]))));
    });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
