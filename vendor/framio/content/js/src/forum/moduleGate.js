import app from 'flarum/common/app';

/**
 * Konsolide paket modül kapısı: admin'de pasife alınan modülün tarayıcı
 * kodu (başlatıcıları ve extender'ları) hiç çalışmaz. Sunucu tarafı zaten
 * ModuleManager::conditional ile kapalıdır; liste forum özniteliği
 * framioDisabledModules ile gelir.
 */
function disabledList() {
  try {
    if (app.forum) return app.forum.attribute('framioDisabledModules') || [];
    const forum = ((app.data && app.data.resources) || []).find((r) => r.type === 'forums');
    return (forum && forum.attributes && forum.attributes.framioDisabledModules) || [];
  } catch (e) {
    return [];
  }
}

export function moduleOn(key) {
  return !disabledList().includes(key);
}

/** Modül dosyasını yükler; eklediği başlatıcıları anahtara bağlar */
export function gate(key, load) {
  const before = new Set(Object.keys(app.initializers.toObject()));
  const result = load();
  Object.keys(app.initializers.toObject()).forEach((name) => {
    if (before.has(name)) return;
    const run = app.initializers.get(name);
    app.initializers.setContent(name, function (...args) {
      if (moduleOn(key)) return run.apply(this, args);
    });
  });
  return result;
}

/** Modülün extender'larını yalnızca modül açıksa uygular */
export function gateExtenders(key, extenders) {
  return (extenders || []).map((e) => ({
    extend(appInstance, extension) {
      if (moduleOn(key)) return e.extend(appInstance, extension);
    },
  }));
}
