import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import app from 'flarum/admin/app';
import type Mithril from 'mithril';

import BundleCard, { BundleData, ModuleData } from './BundleCard';
import IsolatedCard, { IsolatedData } from './IsolatedCard';
import DiscoverCard, { DiscoverItem } from './DiscoverCard';
import InstallModal from '../modals/InstallModal';
import CreateBundleModal from '../modals/CreateBundleModal';
import EditModuleMetaModal from '../modals/EditModuleMetaModal';

export default class PackageManagerPage extends ExtensionPage {
  loading: boolean = true;
  activeTab: 'bundles' | 'isolated' | 'discover' = 'bundles';

  bundles: BundleData[] = [];
  isolated: IsolatedData[] = [];

  // Packagist Arama
  searchQuery: string = '';
  searching: boolean = false;
  searchResults: DiscoverItem[] = [];
  searchTotal: number = 0;

  clearingCache: boolean = false;
  checkingAllUpdates: boolean = false;

  oninit(vnode: Mithril.VnodeDOM) {
    super.oninit(vnode);
    this.loadOverview();
  }

  loadOverview() {
    this.loading = true;
    m.redraw();

    app
      .request({
        method: 'GET',
        url: app.forum.attribute('apiUrl') + '/framio/package-manager/overview',
      })
      .then((data: any) => {
        this.bundles = data.bundles || [];
        this.isolated = data.isolated || [];
        this.loading = false;
        m.redraw();
      })
      .catch((err) => {
        this.loading = false;
        app.alerts.show({ type: 'error' }, 'Paket bilgileri yüklenemedi: ' + (err.message || ''));
        m.redraw();
      });
  }

  handleToggleModule(key: string, enabled: boolean) {
    app
      .request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/framio/package-manager/toggle',
        body: { key, enabled },
      })
      .then(() => {
        for (const bundle of this.bundles) {
          const mod = bundle.modules.find((m) => m.key === key);
          if (mod) {
            mod.enabled = enabled;
            break;
          }
        }
        app.alerts.show(
          { type: 'success' },
          `Modül durumu güncellendi: ${enabled ? 'Aktif' : 'Pasif'}`
        );
        m.redraw();
      })
      .catch(() => {
        app.alerts.show({ type: 'error' }, 'Ayar güncellenirken hata oluştu.');
      });
  }

  handleCheckUpdate(bundleId: string, moduleKey: string) {
    app
      .request({
        method: 'GET',
        url: app.forum.attribute('apiUrl') + '/framio/package-manager/check-update',
        params: { bundle: bundleId, module: moduleKey },
      })
      .then((res: any) => {
        const bundle = this.bundles.find((b) => b.id === bundleId);
        if (bundle) {
          const mod = bundle.modules.find((m) => m.key === moduleKey);
          if (mod) {
            mod.has_update = res.has_update;
            mod.latest_version = res.latest_version;
            m.redraw();
          }
        }
        if (res.has_update) {
          app.alerts.show({ type: 'success' }, `Yeni sürüm bulundu: v${res.latest_version}!`);
        } else {
          app.alerts.show({ type: 'info' }, `Modül güncel (v${res.current_version}).`);
        }
      })
      .catch((err) => {
        app.alerts.show({ type: 'error' }, err.alert?.message || err.message || 'Denetim başarısız.');
      });
  }

  handleUpdateModule(bundleId: string, moduleKey: string) {
    app.alerts.show({ type: 'info' }, 'Güncelleme indiriliyor ve uygulanıyor, lütfen bekleyin...');
    app
      .request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/framio/package-manager/update-module',
        body: { bundle: bundleId, module: moduleKey },
      })
      .then((res: any) => {
        app.alerts.show({ type: 'success' }, res.message || 'Güncelleme başarıyla tamamlandı!');
        this.loadOverview();
      })
      .catch((err) => {
        app.alerts.show({ type: 'error' }, err.alert?.message || err.message || 'Güncelleme sırasında hata oluştu.');
      });
  }

  handleCheckAllUpdates() {
    this.checkingAllUpdates = true;
    m.redraw();

    const promises: Promise<any>[] = [];
    for (const bundle of this.bundles) {
      for (const mod of bundle.modules) {
        if (mod.original_package) {
          const p = app
            .request({
              method: 'GET',
              url: app.forum.attribute('apiUrl') + '/framio/package-manager/check-update',
              params: { bundle: bundle.id, module: mod.key },
            })
            .then((res: any) => {
              mod.has_update = res.has_update;
              mod.latest_version = res.latest_version;
            })
            .catch(() => {});
          promises.push(p);
        }
      }
    }

    Promise.all(promises).finally(() => {
      this.checkingAllUpdates = false;
      m.redraw();
      app.alerts.show({ type: 'success' }, 'Tüm modüller için güncelleme taraması tamamlandı.');
    });
  }

  handleEditMeta(bundleId: string, module: ModuleData) {
    app.modal.show(EditModuleMetaModal, {
      bundleId,
      moduleKey: module.key,
      moduleTitle: module.title,
      currentPackage: module.original_package,
      currentVersion: module.version,
      onsaved: () => this.loadOverview(),
    });
  }

  handleDeleteModule(bundleId: string, moduleKey: string) {
    app
      .request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/framio/package-manager/delete-module',
        body: { bundle: bundleId, module: moduleKey },
      })
      .then(() => {
        app.alerts.show({ type: 'success' }, 'Modül paketten kaldırıldı.');
        this.loadOverview();
      })
      .catch((err) => {
        app.alerts.show({ type: 'error' }, err.alert?.message || err.message || 'Silme işlemi başarısız.');
      });
  }

  handleClearCache() {
    this.clearingCache = true;
    m.redraw();

    app
      .request({
        method: 'DELETE',
        url: app.forum.attribute('apiUrl') + '/cache',
      })
      .then(() => {
        app.alerts.show({ type: 'success' }, 'Önbellek başarıyla temizlendi.');
      })
      .catch(() => {
        app.alerts.show({ type: 'error' }, 'Önbellek temizlenirken hata oluştu.');
      })
      .finally(() => {
        this.clearingCache = false;
        m.redraw();
      });
  }

  handleSearchPackagist() {
    this.searching = true;
    m.redraw();

    app
      .request({
        method: 'GET',
        url: app.forum.attribute('apiUrl') + '/framio/package-manager/search',
        params: { q: this.searchQuery },
      })
      .then((data: any) => {
        this.searchResults = data.results || [];
        this.searchTotal = data.total || 0;
        this.searching = false;
        m.redraw();
      })
      .catch(() => {
        this.searching = false;
        app.alerts.show({ type: 'error' }, 'Packagist araması yapılamadı.');
        m.redraw();
      });
  }

  openInstallModal(pkgName?: string, targetBundleId?: string) {
    app.modal.show(InstallModal, {
      package: pkgName,
      bundles: this.bundles.map((b) => ({ id: b.id, name: b.name, title: b.title })),
      oninstalled: () => this.loadOverview(),
    });
  }

  openCreateBundleModal() {
    app.modal.show(CreateBundleModal, {
      onsubmit: async (data: any) => {
        const res: any = await app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/package-manager/create-bundle',
          body: data,
        });
        app.alerts.show({ type: 'success' }, res.message || 'Paket oluşturuldu!');
        this.loadOverview();
      },
    });
  }

  content() {
    let totalModules = 0;
    let activeModules = 0;
    let updateCount = 0;
    for (const b of this.bundles) {
      totalModules += b.modules.length;
      activeModules += b.modules.filter((m) => m.enabled).length;
      updateCount += b.modules.filter((m) => m.has_update).length;
    }

    return (
      <div className="FramioPackageManager">
        {/* Üst Başlık & Eylemler */}
        <div className="FramioPackageManager-header">
          <div className="container">
            <div>
              <h2>
                <i className="fas fa-cubes" /> Framio Paket & Modül Yöneticisi
              </h2>
              <p>Konsolide paketleri yönetin, alt modülleri anında açıp kapatın veya eklentileri özel kimlikle kurun.</p>

              <div className="FramioPackageManager-stats">
                <span className="badge badge--primary">
                  <i className="fas fa-box-archive" /> {this.bundles.length} Konsolide Paket
                </span>
                <span className="badge badge--success">
                  <i className="fas fa-power-off" /> {activeModules} / {totalModules} Aktif Modül
                </span>
                {updateCount > 0 && (
                  <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                    <i className="fas fa-arrow-up" /> {updateCount} Güncelleme Mevcut
                  </span>
                )}
                <span className="badge">
                  <i className="fas fa-shield-alt" /> {this.isolated.length} İzole Eklenti
                </span>
              </div>
            </div>

            <div className="FramioPackageManager-headerActions">
              <Button
                className="Button Button--primary"
                icon="fas fa-download"
                onclick={() => this.openInstallModal()}
              >
                Eklenti Kur / Dönüştür
              </Button>

              <Button
                className="Button Button--default"
                icon={this.checkingAllUpdates ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-arrow-down'}
                loading={this.checkingAllUpdates}
                onclick={() => this.handleCheckAllUpdates()}
              >
                Güncellemeleri Tara
              </Button>

              <Button
                className="Button Button--default"
                icon="fas fa-folder-plus"
                onclick={() => this.openCreateBundleModal()}
              >
                Yeni Konsolide Paket
              </Button>

              <Button
                className="Button Button--default"
                icon={this.clearingCache ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'}
                loading={this.clearingCache}
                onclick={() => this.handleClearCache()}
              >
                Önbelleği Temizle
              </Button>
            </div>
          </div>
        </div>

        {/* Sekmeler */}
        <div className="container">
          <div className="FramioPackageManager-nav">
            <button
              className={this.activeTab === 'bundles' ? 'active' : ''}
              onclick={() => (this.activeTab = 'bundles')}
            >
              <i className="fas fa-layer-group" /> Konsolide Paketler ({this.bundles.length})
            </button>
            <button
              className={this.activeTab === 'isolated' ? 'active' : ''}
              onclick={() => (this.activeTab = 'isolated')}
            >
              <i className="fas fa-shield-alt" /> İzole / Bağımsız Paketler ({this.isolated.length})
            </button>
            <button
              className={this.activeTab === 'discover' ? 'active' : ''}
              onclick={() => {
                this.activeTab = 'discover';
                if (this.searchResults.length === 0) {
                  this.handleSearchPackagist();
                }
              }}
            >
              <i className="fas fa-compass" /> Eklenti Keşfet (Packagist)
            </button>
          </div>

          {/* İçerik */}
          {this.loading ? (
            <LoadingIndicator />
          ) : (
            <div>
              {/* TAB 1: KONSOLİDE PAKETLER */}
              {this.activeTab === 'bundles' && (
                <div className="FramioPackageManager-grid">
                  {this.bundles.length === 0 ? (
                    <div className="FramioPackageManager-empty">Henüz konsolide paket bulunmuyor.</div>
                  ) : (
                    this.bundles.map((bundle) => (
                      <BundleCard
                        bundle={bundle}
                        onModuleToggled={(key, state) => this.handleToggleModule(key, state)}
                        onAddModule={(bId) => this.openInstallModal(undefined, bId)}
                        onDeleteModule={(bId, mKey) => this.handleDeleteModule(bId, mKey)}
                        onCheckUpdate={(bId, mKey) => this.handleCheckUpdate(bId, mKey)}
                        onUpdateModule={(bId, mKey) => this.handleUpdateModule(bId, mKey)}
                        onEditMeta={(bId, mod) => this.handleEditMeta(bId, mod)}
                      />
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: İZOLE PAKETLER */}
              {this.activeTab === 'isolated' && (
                <div className="FramioPackageManager-isolatedGrid">
                  {this.isolated.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontStyle: 'italic', gridColumn: '1/-1' }}>
                      Henüz izole kurulmuş bir eklenti bulunmuyor.
                    </div>
                  ) : (
                    this.isolated.map((item) => <IsolatedCard item={item} />)
                  )}
                </div>
              )}

              {/* TAB 3: KEŞFET & PACKAGIST ARAMA */}
              {this.activeTab === 'discover' && (
                <div>
                  <div className="FramioPackageManager-searchBar">
                    <input
                      placeholder="Packagist'te Flarum eklentisi ara (örn: subscriptions, upload, polls)..."
                      value={this.searchQuery}
                      oninput={(e: InputEvent) => (this.searchQuery = (e.target as HTMLInputElement).value)}
                      onkeydown={(e: KeyboardEvent) => {
                        if (e.key === 'Enter') this.handleSearchPackagist();
                      }}
                    />
                    <Button
                      className="Button Button--primary"
                      icon={this.searching ? 'fas fa-spinner fa-spin' : 'fas fa-search'}
                      loading={this.searching}
                      onclick={() => this.handleSearchPackagist()}
                    >
                      Ara
                    </Button>
                  </div>

                  {this.searching ? (
                    <LoadingIndicator />
                  ) : (
                    <div className="FramioPackageManager-discoverGrid">
                      {this.searchResults.map((item) => (
                        <DiscoverCard
                          item={item}
                          onInstall={(pkgName) => this.openInstallModal(pkgName)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}
