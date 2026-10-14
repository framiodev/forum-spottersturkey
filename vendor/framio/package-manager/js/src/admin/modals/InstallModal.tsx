import Modal, { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import app from 'flarum/admin/app';
import type Mithril from 'mithril';

export interface InstallModalAttrs extends IInternalModalAttrs {
  package?: string;
  bundles: Array<{ id: string; name: string; title: string }>;
  oninstalled: () => void;
}

export default class InstallModal extends Modal<InstallModalAttrs> {
  packageSource: string = '';
  mode: 'consolidate' | 'new_bundle' | 'isolate' = 'consolidate';

  // Consolidate mode fields
  targetBundle: string = '';
  moduleKey: string = '';
  moduleTitle: string = '';

  // New Bundle mode fields
  newBundleName: string = '';
  newBundleTitle: string = '';
  newBundleDesc: string = '';

  // Isolate mode fields (Özelleştirilebilir Kimlik)
  customPackageName: string = '';
  customTitle: string = '';
  customDescription: string = '';
  customVersion: string = '1.0.0';
  customAuthor: string = 'Framio-Dev';
  customIconName: string = 'fas fa-puzzle-piece';
  customIconBg: string = '#0b5c4e';
  customIconColor: string = '#ffffff';

  loading: boolean = false;

  oninit(vnode: Mithril.Vnode<InstallModalAttrs, this>) {
    super.oninit(vnode);

    if (this.attrs.package) {
      this.packageSource = this.attrs.package;
      const parts = this.attrs.package.split('/');
      const slug = parts[parts.length - 1];
      this.moduleKey = slug;
      this.customPackageName = slug;
      this.customTitle = slug.charAt(0).toUpperCase() + slug.slice(1).replace(/[-_]/g, ' ');
    }

    if (this.attrs.bundles && this.attrs.bundles.length > 0) {
      this.targetBundle = this.attrs.bundles[0].id;
    }
  }

  className() {
    return 'FramioInstallModal Modal--medium';
  }

  title() {
    return 'Framio Eklenti Kurulum Sihirbazı';
  }

  content() {
    return (
      <div className="Modal-body">
        {/* Kaynak Paket */}
        <div className="form-row">
          <label>Kurulacak Eklenti (Packagist Adı)</label>
          <input
            className="FormControl"
            placeholder="örnek: fof/upload veya flarum/subscriptions"
            value={this.packageSource}
            oninput={(e: InputEvent) => {
              this.packageSource = (e.target as HTMLInputElement).value;
              const parts = this.packageSource.split('/');
              const slug = parts[parts.length - 1];
              if (!this.moduleKey) this.moduleKey = slug;
              if (!this.customPackageName) this.customPackageName = slug;
            }}
            disabled={this.loading}
          />
        </div>

        {/* Kurulum Modu Seçici */}
        <div className="mode-selector">
          <div
            className={'mode-option ' + (this.mode === 'consolidate' ? 'selected' : '')}
            onclick={() => (this.mode = 'consolidate')}
          >
            <i className="fas fa-layer-group" />
            <strong>Konsolide Pakete Ekle</strong>
            <small>Mevcut bir çatının alt modülü yap</small>
          </div>

          <div
            className={'mode-option ' + (this.mode === 'new_bundle' ? 'selected' : '')}
            onclick={() => (this.mode = 'new_bundle')}
          >
            <i className="fas fa-box-archive" />
            <strong>Yeni Paket Oluştur</strong>
            <small>Yeni konsolide çatı başlat</small>
          </div>

          <div
            className={'mode-option ' + (this.mode === 'isolate' ? 'selected' : '')}
            onclick={() => (this.mode = 'isolate')}
          >
            <i className="fas fa-shield-alt" />
            <strong>İzole / Bağımsız Kur</strong>
            <small>Özel kimlik, sürüm ve ikon</small>
          </div>
        </div>

        {/* MOD 1: Konsolide Pakete Ekle */}
        {this.mode === 'consolidate' && (
          <div className="mode-fields">
            <div className="form-row">
              <label>Hedef Konsolide Paket</label>
              <select
                className="FormControl"
                value={this.targetBundle}
                onchange={(e: Event) => (this.targetBundle = (e.target as HTMLSelectElement).value)}
                disabled={this.loading}
              >
                {this.attrs.bundles.map((b) => (
                  <option value={b.id}>{b.title} ({b.name})</option>
                ))}
              </select>
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label>Modül Anahtarı (Slug)</label>
                <input
                  className="FormControl"
                  placeholder="ornek-modul"
                  value={this.moduleKey}
                  oninput={(e: InputEvent) => (this.moduleKey = (e.target as HTMLInputElement).value)}
                  disabled={this.loading}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>Modül Başlığı</label>
                <input
                  className="FormControl"
                  placeholder="Örnek Modül Başlığı"
                  value={this.moduleTitle}
                  oninput={(e: InputEvent) => (this.moduleTitle = (e.target as HTMLInputElement).value)}
                  disabled={this.loading}
                />
              </div>
            </div>
          </div>
        )}

        {/* MOD 2: Yeni Paket Oluştur */}
        {this.mode === 'new_bundle' && (
          <div className="mode-fields">
            <div className="form-row">
              <label>Yeni Konsolide Paket Adı (Slug)</label>
              <input
                className="FormControl"
                placeholder="ornek-suite"
                value={this.newBundleName}
                oninput={(e: InputEvent) => (this.newBundleName = (e.target as HTMLInputElement).value)}
                disabled={this.loading}
              />
            </div>
            <div className="form-row">
              <label>Yeni Paket Başlığı</label>
              <input
                className="FormControl"
                placeholder="Framio Paket Başlığı"
                value={this.newBundleTitle}
                oninput={(e: InputEvent) => (this.newBundleTitle = (e.target as HTMLInputElement).value)}
                disabled={this.loading}
              />
            </div>
            <div className="form-row">
              <label>Paket Açıklaması</label>
              <input
                className="FormControl"
                placeholder="Konsolide paketin amacı..."
                value={this.newBundleDesc}
                oninput={(e: InputEvent) => (this.newBundleDesc = (e.target as HTMLInputElement).value)}
                disabled={this.loading}
              />
            </div>
          </div>
        )}

        {/* MOD 3: İzole Kurulum (Özelleştirilebilir Kimlik) */}
        {this.mode === 'isolate' && (
          <div className="mode-fields">
            <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 2 }}>
                <label>Özel Paket Adı (Vendor/Package)</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRight: 'none', borderRadius: '4px 0 0 4px', fontSize: '13px', color: '#64748b' }}>
                    framio/
                  </span>
                  <input
                    className="FormControl"
                    style={{ borderRadius: '0 4px 4px 0' }}
                    placeholder="ozel-eklenti"
                    value={this.customPackageName}
                    oninput={(e: InputEvent) => (this.customPackageName = (e.target as HTMLInputElement).value)}
                    disabled={this.loading}
                  />
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <label>Sürüm (Version)</label>
                <input
                  className="FormControl"
                  placeholder="1.0.0"
                  value={this.customVersion}
                  oninput={(e: InputEvent) => (this.customVersion = (e.target as HTMLInputElement).value)}
                  disabled={this.loading}
                />
              </div>
            </div>

            <div className="form-row">
              <label>Özel Görünen Başlık (Title)</label>
              <input
                className="FormControl"
                placeholder="Özel Eklenti Başlığı"
                value={this.customTitle}
                oninput={(e: InputEvent) => (this.customTitle = (e.target as HTMLInputElement).value)}
                disabled={this.loading}
              />
            </div>

            <div className="form-row">
              <label>Özel Açıklama</label>
              <textarea
                className="FormControl"
                rows={2}
                placeholder="Eklentinin işlevi hakkında kısa açıklama..."
                value={this.customDescription}
                oninput={(e: InputEvent) => (this.customDescription = (e.target as HTMLTextAreaElement).value)}
                disabled={this.loading}
              />
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 2 }}>
                <label>Geliştirici / Yazar</label>
                <input
                  className="FormControl"
                  placeholder="Framio-Dev"
                  value={this.customAuthor}
                  oninput={(e: InputEvent) => (this.customAuthor = (e.target as HTMLInputElement).value)}
                  disabled={this.loading}
                />
              </div>

              <div style={{ flex: 2 }}>
                <label>İkon (FontAwesome)</label>
                <input
                  className="FormControl"
                  placeholder="fas fa-puzzle-piece"
                  value={this.customIconName}
                  oninput={(e: InputEvent) => (this.customIconName = (e.target as HTMLInputElement).value)}
                  disabled={this.loading}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label>Renk</label>
                <input
                  type="color"
                  className="FormControl"
                  value={this.customIconBg}
                  oninput={(e: InputEvent) => (this.customIconBg = (e.target as HTMLInputElement).value)}
                  disabled={this.loading}
                  style={{ height: '38px', padding: '3px' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Butonlar */}
        <div className="Form-group" style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button className="Button Button--default" onclick={() => app.modal.close()} disabled={this.loading}>
            İptal
          </Button>
          <Button
            className="Button Button--primary"
            type="submit"
            loading={this.loading}
            disabled={!this.packageSource}
            icon="fas fa-download"
          >
            Kurulumu Başlat
          </Button>
        </div>
      </div>
    );
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!this.packageSource) return;

    this.loading = true;

    const payload: any = {
      package: this.packageSource,
      mode: this.mode,
    };

    if (this.mode === 'consolidate') {
      payload.target_bundle = this.targetBundle;
      payload.module_key = this.moduleKey;
      payload.module_title = this.moduleTitle;
    } else if (this.mode === 'new_bundle') {
      payload.bundle_name = this.newBundleName;
      payload.bundle_title = this.newBundleTitle;
      payload.bundle_description = this.newBundleDesc;
    } else if (this.mode === 'isolate') {
      payload.custom_package_name = this.customPackageName;
      payload.custom_title = this.customTitle;
      payload.custom_description = this.customDescription;
      payload.custom_version = this.customVersion;
      payload.custom_author = this.customAuthor;
      payload.custom_icon_name = this.customIconName;
      payload.custom_icon_bg = this.customIconBg;
      payload.custom_icon_color = this.customIconColor;
    }

    app
      .request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/framio/package-manager/install',
        body: payload,
      })
      .then((res: any) => {
        this.loading = false;
        app.modal.close();
        app.alerts.show({ type: 'success' }, res.message || 'Kurulum başarıyla tamamlandı!');
        this.attrs.oninstalled();
      })
      .catch((err) => {
        this.loading = false;
        app.alerts.show({ type: 'error' }, err.alert?.message || err.message || 'Kurulum başarısız oldu.');
      });
  }
}
