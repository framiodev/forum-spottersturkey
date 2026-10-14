import Component, { ComponentAttrs } from 'flarum/common/Component';
import Switch from 'flarum/common/components/Switch';
import Button from 'flarum/common/components/Button';
import app from 'flarum/admin/app';
import type Mithril from 'mithril';

export interface ModuleData {
  key: string;
  name: string;
  bundle: string;
  title: string;
  description: string;
  version: string;
  icon: { name: string; backgroundColor: string; color: string };
  enabled: boolean;
  original_package?: string;
  latest_version?: string;
  has_update?: boolean;
  path: string;
}

export interface BundleData {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  icon: { name: string; backgroundColor: string; color: string };
  path: string;
  modules: ModuleData[];
}

export interface BundleCardAttrs extends ComponentAttrs {
  bundle: BundleData;
  onModuleToggled: (key: string, enabled: boolean) => void;
  onAddModule: (bundleId: string) => void;
  onDeleteModule: (bundleId: string, moduleKey: string) => void;
  onCheckUpdate: (bundleId: string, moduleKey: string) => void;
  onUpdateModule: (bundleId: string, moduleKey: string) => void;
  onEditMeta: (bundleId: string, module: ModuleData) => void;
}

export default class BundleCard extends Component<BundleCardAttrs> {
  toggling: Record<string, boolean> = {};
  checking: Record<string, boolean> = {};

  view() {
    const { bundle } = this.attrs;
    const activeCount = bundle.modules.filter((m) => m.enabled).length;

    return (
      <div className="FramioPackageManager-bundleCard">
        {/* Başlık ve Paket Bilgisi */}
        <div className="FramioPackageManager-bundleCard-header">
          <div className="bundle-info">
            <div
              className="bundle-icon"
              style={{
                backgroundColor: bundle.icon?.backgroundColor || '#0b5c4e',
                color: bundle.icon?.color || '#fff',
              }}
            >
              <i className={bundle.icon?.name || 'fas fa-box-archive'} />
            </div>
            <div>
              <h3>
                {bundle.title}
                <span className="version">v{bundle.version}</span>
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748b' }}>
                  ({activeCount}/{bundle.modules.length} Aktif Modül)
                </span>
              </h3>
              <p>{bundle.description}</p>
            </div>
          </div>

          <div className="bundle-actions">
            <Button
              className="Button Button--primary Button--sm"
              icon="fas fa-plus"
              onclick={() => this.attrs.onAddModule(bundle.id)}
            >
              Modül Ekle
            </Button>
          </div>
        </div>

        {/* Modüller Listesi */}
        <div className="FramioPackageManager-bundleCard-modules">
          {bundle.modules.length === 0 ? (
            <div className="modules-empty">Bu pakette henüz alt modül bulunmuyor.</div>
          ) : (
            bundle.modules.map((mod) => {
              const isBusy = !!this.toggling[mod.key];
              const isChecking = !!this.checking[mod.key];

              return (
                <div className="module-row" key={mod.key}>
                  <div className="module-details">
                    <div
                      className="module-icon"
                      style={{
                        backgroundColor: mod.icon?.backgroundColor || '#4D698E',
                        color: mod.icon?.color || '#fff',
                      }}
                    >
                      <i className={mod.icon?.name || 'fas fa-puzzle-piece'} />
                    </div>
                    <div>
                      <div className="title">
                        {mod.title} <span className="key">{mod.key}</span>
                        <span style={{ marginLeft: '8px', fontSize: '11px', background: '#e2e8f0', color: '#475569', padding: '1px 6px', borderRadius: '4px' }}>
                          v{mod.version}
                        </span>
                        {mod.original_package ? (
                          <span
                            style={{ marginLeft: '6px', fontSize: '11px', color: '#0b5c4e', cursor: 'pointer', textDecoration: 'underline' }}
                            title="Kaynak paketi düzenle"
                            onclick={() => this.attrs.onEditMeta(bundle.id, mod)}
                          >
                            <i className="fas fa-link" /> {mod.original_package}
                          </span>
                        ) : (
                          <span
                            style={{ marginLeft: '6px', fontSize: '11px', color: '#94a3b8', cursor: 'pointer' }}
                            title="Packagist paketini bağla"
                            onclick={() => this.attrs.onEditMeta(bundle.id, mod)}
                          >
                            <i className="fas fa-plus-circle" /> Paket Bağla
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{mod.description}</div>
                    </div>
                  </div>

                  <div className="module-controls">
                    {/* Güncelleme Durumu & Butonu */}
                    {mod.has_update ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="status-tag status-tag--active" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                          <i className="fas fa-arrow-up" /> v{mod.latest_version}
                        </span>
                        <Button
                          className="Button Button--primary Button--sm"
                          icon="fas fa-bolt"
                          onclick={() => {
                            if (confirm(`'${mod.title}' modülünü v${mod.latest_version} sürümüne güncellemek istiyor musunuz? Mevcut dosyalar yedeklenecektir.`)) {
                              this.attrs.onUpdateModule(bundle.id, mod.key);
                            }
                          }}
                        >
                          Güncelle
                        </Button>
                      </span>
                    ) : (
                      mod.original_package && (
                        <Button
                          className="Button Button--default Button--sm"
                          icon={isChecking ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'}
                          loading={isChecking}
                          title="Packagist güncellemesini denetle"
                          onclick={() => {
                            this.checking[mod.key] = true;
                            this.attrs.onCheckUpdate(bundle.id, mod.key);
                            setTimeout(() => {
                              delete this.checking[mod.key];
                              m.redraw();
                            }, 1000);
                          }}
                        >
                          Denetle
                        </Button>
                      )
                    )}

                    <span
                      className={
                        'status-tag ' +
                        (mod.enabled ? 'status-tag--active' : 'status-tag--inactive')
                      }
                    >
                      {mod.enabled ? 'Aktif' : 'Pasif'}
                    </span>

                    <Switch
                      state={mod.enabled}
                      loading={isBusy}
                      onchange={(state: boolean) => {
                        this.toggling[mod.key] = true;
                        this.attrs.onModuleToggled(mod.key, state);
                        setTimeout(() => {
                          delete this.toggling[mod.key];
                          m.redraw();
                        }, 500);
                      }}
                    />

                    <Button
                      className="Button Button--danger Button--icon Button--link"
                      icon="fas fa-trash-alt"
                      title="Modülü Paketten Kaldır"
                      onclick={() => {
                        if (confirm(`'${mod.title}' modülünü bu paketten tamamen kaldırmak istediğinize emin misiniz?`)) {
                          this.attrs.onDeleteModule(bundle.id, mod.key);
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }
}
