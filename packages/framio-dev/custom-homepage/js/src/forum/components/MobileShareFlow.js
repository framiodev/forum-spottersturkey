import app from 'flarum/forum/app';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';

/**
 * Telefon "Fotoğraf paylaş" akışı (onaylı maket 6), 1. adım: fotoğraf seçimi.
 * Tam ekran: büyük önizleme + 4 sütunlu seçim ızgarası (seçim sırası numaralı), "Yeni tartışma / Bu başlığa ekle".
 * "İleri" ile seçilen fotoğraflar yazma penceresindeki Upload & EXIF yükleme düğmesine aktarılır;
 * 2. adım (imza + Framio AI künye) ve 3. adım (başlık + kategori) eklentinin kendi ekranlarıyla sürer.
 */
let host = null;

export function openShareFlow() {
  if (!app.session.user) {
    import('flarum/forum/components/LogInModal').then((mod) => app.modal.show(mod.default));
    return;
  }
  if (host) return;
  host = document.createElement('div');
  host.className = 'MobileShare-mount';
  document.body.appendChild(host);
  document.documentElement.classList.add('MobileShare-open');

  const discussion = app.current.get('discussion');
  const state = {
    files: [],
    urls: [],
    selected: [],
    preview: 0,
    // Bir tartışmadaysak varsayılan: o başlığa ekle
    target: discussion ? 'reply' : 'new',
    discussion,
  };

  const close = () => {
    state.urls.forEach((u) => URL.revokeObjectURL(u));
    m.mount(host, null);
    host.remove();
    host = null;
    document.documentElement.classList.remove('MobileShare-open');
    window.removeEventListener('popstate', onPop);
  };
  const onPop = () => close();
  history.pushState({ mobileShare: true }, '');
  window.addEventListener('popstate', onPop);

  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*';
  input.onchange = () => {
    const added = Array.from(input.files || []);
    added.forEach((f) => {
      state.files.push(f);
      state.urls.push(URL.createObjectURL(f));
      state.selected.push(state.files.length - 1);
    });
    if (state.selected.length) state.preview = state.selected[0];
    input.value = '';
    m.redraw();
  };
  const pick = () => input.click();

  // Seçili değilse seç ve önizle; seçili ve önizlenen kareye ikinci dokunuş seçimi kaldırır;
  // seçili ama önizlenmeyen kare yalnızca önizlenir
  const toggle = (i) => {
    const at = state.selected.indexOf(i);
    if (at === -1) state.selected.push(i);
    else if (state.preview === i) state.selected.splice(at, 1);
    state.preview = i;
  };

  const next = () => {
    const files = state.selected.map((i) => state.files[i]);
    if (!files.length) return;
    const target = state.target;
    const discussionModel = state.discussion;
    history.back();
    // Geri tuşu kaydı (popstate) kapandıktan sonra yazma penceresi açılır
    setTimeout(() => startComposer(files, target, discussionModel), 60);
  };

  m.mount(host, {
    view: () => {
      const has = state.files.length > 0;
      const count = state.selected.length;
      return (
        <div className="MobileShare" role="dialog" aria-label="Fotoğraf paylaş">
          <div className="MobileShare-top">
            <button type="button" className="MobileShare-x" aria-label="Vazgeç" onclick={() => history.back()}>✕</button>
            <b>Yeni paylaşım</b>
            <button type="button" className="MobileShare-next" disabled={!count} onclick={next}>İleri</button>
          </div>
          <div className="MobileShare-steps"><i className="on" /><i /><i /></div>

          {state.discussion ? (
            <div className="MobileShare-target">
              <button type="button" className={state.target === 'new' ? 'on' : ''} onclick={() => { state.target = 'new'; }}>Yeni tartışma</button>
              <button type="button" className={state.target === 'reply' ? 'on' : ''} onclick={() => { state.target = 'reply'; }}>Bu başlığa ekle</button>
            </div>
          ) : null}

          <div className="MobileShare-scroll">
            {has ? (
              <div className="MobileShare-preview" style={{ backgroundImage: 'url(' + state.urls[state.preview] + ')' }}>
                {count ? <span>{(state.selected.indexOf(state.preview) + 1 || '–') + ' / ' + count}</span> : null}
              </div>
            ) : (
              <button type="button" className="MobileShare-empty" onclick={pick}>
                <i className="icon fas fa-images" />
                <b>Fotoğraf seç</b>
                <small>Galeriden bir ya da birden çok fotoğraf seç</small>
              </button>
            )}

            {has ? (
              <div className="MobileShare-grid">
                <button type="button" className="MobileShare-add" onclick={pick} aria-label="Fotoğraf ekle"><i className="icon fas fa-plus" /></button>
                {state.files.map((f, i) => {
                  const n = state.selected.indexOf(i);
                  return (
                    <button type="button" className={'MobileShare-tile' + (n !== -1 ? ' sel' : '') + (state.preview === i ? ' cur' : '')}
                      style={{ backgroundImage: 'url(' + state.urls[i] + ')' }} onclick={() => toggle(i)} aria-label={f.name}>
                      {n !== -1 ? <span>{n + 1}</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {has ? <p className="MobileShare-hint">Sonraki adımda imza ve Framio AI künyesi, ardından başlık ve kategori.</p> : null}
          </div>
        </div>
      );
    },
  });

  // Ekran açılır açılmaz telefonun galerisi açılsın
  setTimeout(pick, 50);
}

/**
 * 2. ve 3. adım: yazma penceresi açılır, seçilen fotoğraflar Upload & EXIF'in yükleme düğmesine
 * (aynı change olayı) aktarılır; imza ve künye ekranları eklentinin kendi akışıyla açılır.
 */
function startComposer(files, target, discussion) {
  const open = () => {
    if (target === 'reply' && discussion) {
      const r = DiscussionControls.replyAction.call(discussion, true, false);
      return r && r.then ? r : Promise.resolve();
    }
    return import('flarum/forum/components/DiscussionComposer').then((mod) => {
      app.composer.load(mod.default, { user: app.session.user });
      app.composer.show();
    });
  };

  open().then(() => {
    let tries = 0;
    const feed = () => {
      const input = document.querySelector('.Composer .spotter-upload-button input[type=file]');
      if (!input) {
        if (++tries < 40) return setTimeout(feed, 100);
        app.alerts.show({ type: 'error' }, 'Yükleme düğmesi bulunamadı; fotoğrafları yazma penceresindeki 📷 ile ekleyebilirsin.');
        return;
      }
      try {
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {
        app.alerts.show({ type: 'error' }, 'Fotoğraflar aktarılamadı; yazma penceresindeki 📷 ile ekleyebilirsin.');
      }
    };
    feed();
  }).catch(() => {});
}
