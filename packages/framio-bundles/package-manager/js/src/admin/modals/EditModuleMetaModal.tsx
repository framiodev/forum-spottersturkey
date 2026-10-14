import Modal, { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import app from 'flarum/admin/app';
import type Mithril from 'mithril';

export interface EditModuleMetaModalAttrs extends IInternalModalAttrs {
  bundleId: string;
  moduleKey: string;
  moduleTitle: string;
  currentPackage?: string;
  currentVersion?: string;
  onsaved: () => void;
}

export default class EditModuleMetaModal extends Modal<EditModuleMetaModalAttrs> {
  originalPackage: string = '';
  version: string = '1.0.0';
  loading: boolean = false;

  oninit(vnode: Mithril.Vnode<EditModuleMetaModalAttrs, this>) {
    super.oninit(vnode);
    this.originalPackage = this.attrs.currentPackage || '';
    this.version = this.attrs.currentVersion || '1.0.0';
  }

  className() {
    return 'FramioInstallModal Modal--small';
  }

  title() {
    return `Güncelleme Kaynağı: ${this.attrs.moduleTitle}`;
  }

  content() {
    return (
      <div className="Modal-body">
        <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '15px' }}>
          Bu modülün Packagist üzerinden otomatik güncellenebilmesi için orijinal eklenti paket adını bağlayın.
        </p>

        <div className="form-row">
          <label>Orijinal Packagist Paket Adı</label>
          <input
            className="FormControl"
            placeholder="örnek: fof/online-users-widget"
            value={this.originalPackage}
            oninput={(e: InputEvent) => (this.originalPackage = (e.target as HTMLInputElement).value)}
            disabled={this.loading}
          />
          <div className="help">Packagist üzerindeki vendor/package adı.</div>
        </div>

        <div className="form-row">
          <label>Şu Anki Kurulu Sürüm</label>
          <input
            className="FormControl"
            placeholder="1.0.0"
            value={this.version}
            oninput={(e: InputEvent) => (this.version = (e.target as HTMLInputElement).value)}
            disabled={this.loading}
          />
        </div>

        <div className="Form-group" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button className="Button Button--default" onclick={() => app.modal.close()} disabled={this.loading}>
            İptal
          </Button>
          <Button
            className="Button Button--primary"
            type="submit"
            loading={this.loading}
            disabled={!this.originalPackage}
          >
            Kaydet
          </Button>
        </div>
      </div>
    );
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!this.originalPackage) return;

    this.loading = true;
    app
      .request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/framio/package-manager/set-meta',
        body: {
          bundle: this.attrs.bundleId,
          module: this.attrs.moduleKey,
          original_package: this.originalPackage,
          version: this.version,
        },
      })
      .then((res: any) => {
        this.loading = false;
        app.modal.close();
        app.alerts.show({ type: 'success' }, res.message || 'Paket kaynağı kaydedildi.');
        this.attrs.onsaved();
      })
      .catch((err) => {
        this.loading = false;
        app.alerts.show({ type: 'error' }, err.alert?.message || err.message || 'Hata oluştu.');
      });
  }
}
