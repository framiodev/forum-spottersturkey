import Modal, { IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import app from 'flarum/admin/app';
import type Mithril from 'mithril';

export interface CreateBundleModalAttrs extends IInternalModalAttrs {
  onsubmit: (bundleData: any) => Promise<void>;
}

export default class CreateBundleModal extends Modal<CreateBundleModalAttrs> {
  name: string = '';
  title: string = '';
  description: string = '';
  iconName: string = 'fas fa-cubes';
  iconBg: string = '#0b5c4e';
  loading: boolean = false;

  className() {
    return 'FramioInstallModal Modal--small';
  }

  title() {
    return 'Yeni Konsolide Paket Oluştur';
  }

  content() {
    return (
      <div className="Modal-body">
        <div className="form-row">
          <label>Paket Tanımlayıcısı (Slug)</label>
          <div className="help">packages/ dizini altında klasör adı olarak kullanılacaktır (örn: social-tools)</div>
          <input
            className="FormControl"
            placeholder="ornek-paket"
            value={this.name}
            oninput={(e: InputEvent) => (this.name = (e.target as HTMLInputElement).value)}
            disabled={this.loading}
          />
        </div>

        <div className="form-row">
          <label>Görünen Paket Başlığı</label>
          <input
            className="FormControl"
            placeholder="Framio Sosyal Araçlar"
            value={this.title}
            oninput={(e: InputEvent) => (this.title = (e.target as HTMLInputElement).value)}
            disabled={this.loading}
          />
        </div>

        <div className="form-row">
          <label>Açıklama</label>
          <textarea
            className="FormControl"
            rows={2}
            placeholder="Paket hakkında kısa bilgi..."
            value={this.description}
            oninput={(e: InputEvent) => (this.description = (e.target as HTMLTextAreaElement).value)}
            disabled={this.loading}
          />
        </div>

        <div className="form-row" style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label>İkon (FontAwesome)</label>
            <input
              className="FormControl"
              placeholder="fas fa-cubes"
              value={this.iconName}
              oninput={(e: InputEvent) => (this.iconName = (e.target as HTMLInputElement).value)}
              disabled={this.loading}
            />
          </div>
          <div style={{ width: '100px' }}>
            <label>Renk</label>
            <input
              type="color"
              className="FormControl"
              value={this.iconBg}
              oninput={(e: InputEvent) => (this.iconBg = (e.target as HTMLInputElement).value)}
              disabled={this.loading}
              style={{ height: '38px', padding: '3px' }}
            />
          </div>
        </div>

        <div className="Form-group" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button className="Button Button--default" onclick={() => app.modal.close()} disabled={this.loading}>
            İptal
          </Button>
          <Button
            className="Button Button--primary"
            type="submit"
            loading={this.loading}
            disabled={!this.name || !this.title}
          >
            Paketi Oluştur
          </Button>
        </div>
      </div>
    );
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();
    this.loading = true;

    this.attrs
      .onsubmit({
        name: this.name,
        title: this.title,
        description: this.description,
        icon_name: this.iconName,
        icon_bg: this.iconBg,
      })
      .then(() => {
        this.loading = false;
        app.modal.close();
      })
      .catch((err) => {
        this.loading = false;
        app.alerts.show({ type: 'error' }, err.alert?.message || err.message || 'Paket oluşturulurken hata meydana geldi.');
      });
  }
}
