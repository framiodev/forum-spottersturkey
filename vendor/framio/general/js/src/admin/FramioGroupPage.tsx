import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import ExtensionPermissionGrid from 'flarum/admin/components/ExtensionPermissionGrid';
import Form from 'flarum/common/components/Form';
import ItemList from 'flarum/common/utils/ItemList';
import Switch from 'flarum/common/components/Switch';
import Button from 'flarum/common/components/Button';

/**
 * Modülün özgün ayar sayfasını sekme içinde güvenle render etmek için sarmalar.
 */
const embeddedCache = new Map();

function embedModulePage(PageClass, cacheKey) {
  const cached = embeddedCache.get(cacheKey);
  if (cached) return cached;

  class EmbeddedModulePage extends PageClass {
    bodyClass = '';

    oninit(vnode) {
      const current = app.current;
      const previous = app.previous;

      super.oninit(vnode);

      app.current = current;
      app.previous = previous;

      if (this.extension && vnode.attrs.contextId) {
        this.extension = { ...this.extension, id: vnode.attrs.contextId };
      }
    }

    view(vnode) {
      if (typeof this.sections === 'function') {
        return this.sections(vnode).toArray();
      }
      return typeof super.view === 'function' ? super.view(vnode) : (typeof this.content === 'function' ? this.content(vnode) : null);
    }
  }

  embeddedCache.set(cacheKey, EmbeddedModulePage);

  return EmbeddedModulePage;
}

/**
 * Framio konsolide ayar sayfası.
 *
 * Üst Kısım:
 * 1. Modül Seçici (Dropdown Menü): Masaüstü ve mobilde taşma yapmayan ergonomik açılır menü.
 * 2. Modül Switch Açma / Kapama (Aktif - Pasif)
 * 3. Canlı "Güncelleme Denetle / Güncelle" Butonu
 * 4. Anında "Önbelleği Temizle" Butonu
 *
 * Alt Kısım:
 * Modülün kendi ayarları ve izinleri.
 */
// renderTab: General gibi sekmelerini kendi çizen paketler için (tab.key → içerik)
export default function framioGroupPage(allTabs, renderTab = null) {
  return class FramioGroupPage extends ExtensionPage {
    activeTab = null;
    toggling = {};
    clearingCache = false;
    checkingUpdate = {};
    updateInfo = {};
    updating = {};

    tabs() {
      if (renderTab) return allTabs;
      return allTabs.filter(
        (t) => t.always || (app.registry.getPage(t.id) || (t.legacyId && app.registry.getPage(t.legacyId))) || (app.registry.getSettings(t.id) || (t.legacyId && app.registry.getSettings(t.legacyId))) || (app.registry.extensionHasPermissions(t.id) || (t.legacyId && app.registry.extensionHasPermissions(t.legacyId)))
      );
    }

    sections(vnode) {
      const items = new ItemList();
      items.add('content', this.content(vnode));
      return items;
    }

    getBundleId() {
      return (this.extension?.id || '').replace(/^framio-/, '');
    }

    isModuleEnabled(tab) {
      const key = `framio.module.${tab.key}.enabled`;
      const val = app.data.settings[key];
      return val === undefined || val === null || val === '1' || val === true;
    }

    toggleModule(tab, state) {
      const key = `framio.module.${tab.key}.enabled`;
      this.toggling[tab.key] = true;
      m.redraw();

      app
        .request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/settings',
          body: { [key]: state ? '1' : '0' },
        })
        .then(() => {
          app.data.settings[key] = state ? '1' : '0';
          // Modülün çeviri/ayar kayıtları sayfa yenilenince yüklenir; o ana kadar içerik gösterme
          this.pendingReload = true;
          app.alerts.show({ type: 'success' }, 'Modül ' + (state ? 'etkinleştirildi' : 'pasife alındı') + '; önbellek yenileniyor…');
          // Modülün CSS/JS varlıkları ve forum verisi hemen güncellensin
          return app.request({ method: 'DELETE', url: app.forum.attribute('apiUrl') + '/cache' }).catch(() => {}).then(() => setTimeout(() => window.location.reload(), 500));
        })
        .catch(() => {
          app.alerts.show({ type: 'error' }, 'Ayar güncellenirken bir hata oluştu.');
        })
        .finally(() => {
          delete this.toggling[tab.key];
          m.redraw();
        });
    }

    handleCheckUpdate(tab) {
      const bundle = this.getBundleId();
      this.checkingUpdate[tab.key] = true;
      m.redraw();

      app
        .request({
          method: 'GET',
          url: app.forum.attribute('apiUrl') + '/framio/package-manager/check-update',
          params: { bundle, module: tab.key },
        })
        .then((res: any) => {
          this.updateInfo[tab.key] = res;
          if (res.has_update) {
            app.alerts.show({ type: 'success' }, `${tab.title} için yeni sürüm mevcut: v${res.latest_version}`);
          } else {
            app.alerts.show({ type: 'info' }, `${tab.title} güncel (v${res.current_version}).`);
          }
        })
        .catch((err) => {
          app.alerts.show({ type: 'error' }, err.alert?.message || err.message || 'Güncelleme denetlenemedi.');
        })
        .finally(() => {
          delete this.checkingUpdate[tab.key];
          m.redraw();
        });
    }

    handleUpdateModule(tab, latestVersion) {
      if (!confirm(`'${tab.title}' modülünü v${latestVersion} sürümüne güncellemek istediğinize emin misiniz? Mevcut dosyalar yedeklenecektir.`)) {
        return;
      }

      const bundle = this.getBundleId();
      this.updating[tab.key] = true;
      m.redraw();

      app.alerts.show({ type: 'info' }, `${tab.title} güncelleniyor, lütfen bekleyin...`);

      app
        .request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/framio/package-manager/update-module',
          body: { bundle, module: tab.key },
        })
        .then((res: any) => {
          app.alerts.show({ type: 'success' }, res.message || `${tab.title} başarıyla güncellendi!`);
          setTimeout(() => window.location.reload(), 800);
        })
        .catch((err) => {
          app.alerts.show({ type: 'error' }, err.alert?.message || err.message || 'Güncelleme başarısız oldu.');
        })
        .finally(() => {
          delete this.updating[tab.key];
          m.redraw();
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
          setTimeout(() => window.location.reload(), 600);
        })
        .catch(() => {
          app.alerts.show({ type: 'error' }, 'Önbellek temizlenirken hata oluştu.');
          this.clearingCache = false;
          m.redraw();
        });
    }

    content() {
      const tabs = this.tabs();
      if (!tabs.length) return null;

      const active = tabs.find((t) => t.key === this.activeTab) || tabs[0];
      const enabled = this.isModuleEnabled(active);
      const isBusy = !!this.toggling[active.key];
      const isCheckingUpdate = !!this.checkingUpdate[active.key];
      const isUpdating = !!this.updating[active.key];
      const updateData = this.updateInfo[active.key];

      return (
        <div className="FramioGroupPage">
          {/* Üst Yönetim ve Seçim Paneli (Dropdown Selector + Switch + Update + Cache) */}
          <div className="container">
            <div className="FramioGroupPage-toolbar">
              <div className="FramioGroupPage-selectorWrapper">
                <label className="FramioGroupPage-selectorLabel" htmlFor="framio-module-select">
                  <i className="fas fa-layer-group" /> Modül / Özellik:
                </label>
                <div className="FramioGroupPage-selectControl">
                  <select
                    id="framio-module-select"
                    className="FormControl FramioGroupPage-select"
                    value={active.key}
                    onchange={(e: Event) => {
                      this.activeTab = (e.target as HTMLSelectElement).value;
                    }}
                  >
                    {tabs.map((tab) => {
                      const tabEnabled = this.isModuleEnabled(tab);
                      return (
                        <option value={tab.key}>
                          {tabEnabled ? '● ' : '○ '}
                          {tab.title}
                          {!tabEnabled ? ' (Devre Dışı)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="FramioGroupPage-controlsWrapper">
                <div className="FramioGroupPage-moduleSwitch">
                  <Switch
                    state={enabled}
                    loading={isBusy}
                    onchange={(val: boolean) => this.toggleModule(active, val)}
                  >
                    <span className="FramioGroupPage-switchLabel">
                      <strong>{active.title}</strong> — {enabled ? 'Aktif' : 'Pasif'}
                    </span>
                  </Switch>
                </div>

                <div className="FramioGroupPage-headerActions">
                  {/* Güncelleme Butonları */}
                  {updateData?.has_update ? (
                    <Button
                      className="Button Button--primary"
                      icon="fas fa-bolt"
                      loading={isUpdating}
                      onclick={() => this.handleUpdateModule(active, updateData.latest_version)}
                    >
                      v{updateData.latest_version} Güncelle
                    </Button>
                  ) : (
                    <Button
                      className="Button Button--default"
                      icon={isCheckingUpdate ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-arrow-down'}
                      loading={isCheckingUpdate}
                      title="Packagist'ten son sürümü sorgula"
                      onclick={() => this.handleCheckUpdate(active)}
                    >
                      Güncelleme Denetle
                    </Button>
                  )}

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
          </div>

          <div className="FramioGroupPage-panel">
            {this.pendingReload ? (
              <div className="container">
                <div className="FramioGroupPage-disabledNotice">
                  <i className="fas fa-spinner fa-spin" />
                  <h4>Modül ayarları yükleniyor…</h4>
                  <p>Değişiklik uygulanıyor, sayfa birkaç saniye içinde yenilenecek.</p>
                </div>
              </div>
            ) : !enabled ? (
              <div className="container">
                <div className="FramioGroupPage-disabledNotice">
                  <i className="fas fa-power-off" />
                  <h4>Bu modül şu anda devre dışı bırakılmıştır.</h4>
                  <p>Modülün forumdaki ve API'deki işlevlerini tekrar kullanmak için yukarıdaki anahtarı açabilirsiniz.</p>
                </div>
              </div>
            ) : (
              [
                <div className="FramioGroupPage-tabPanel" key={active.key}>
                  {this.tabContent(active)}
                </div>,
              ]
            )}
          </div>
        </div>
      );
    }

    tabContent(tab) {
      if (renderTab) return renderTab(tab.key);

      const EmbeddedPage = app.registry.getPage(tab.id) || (tab.legacyId ? app.registry.getPage(tab.legacyId) : null);

      if (EmbeddedPage) {
        const Embedded = embedModulePage(EmbeddedPage, tab.id);

        return (
          <div className={'ExtensionPage FramioGroupPage-embedded ' + tab.legacyId + '-Page'}>
            <Embedded id={this.extension.id} contextId={tab.id} />
          </div>
        );
      }

      const settings = app.registry.getSettings(tab.id) || (tab.legacyId ? app.registry.getSettings(tab.legacyId) : null);
      const hasPermissions = app.registry.extensionHasPermissions(tab.id) || (tab.legacyId ? app.registry.extensionHasPermissions(tab.legacyId) : false);

      return [
        settings ? (
          <div className="container">
            <Form>
              {settings.map(this.buildSettingComponent.bind(this))}
              <div className="Form-group Form-controls">{this.submitButton()}</div>
            </Form>
          </div>
        ) : (
          <div className="container">
            <h3 className="ExtensionPage-subHeader">{app.translator.trans('core.admin.extension.no_settings')}</h3>
          </div>
        ),

        hasPermissions ? (
          <div className="container FramioGroupPage-permissions">
            <h2 className="ExtensionTitle">{app.translator.trans('core.admin.extension.permissions_title')}</h2>
            <ExtensionPermissionGrid extensionId={app.registry.extensionHasPermissions(tab.id) ? tab.id : (tab.legacyId || tab.id)} />
          </div>
        ) : null,
      ];
    }
  };
}
