import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import type Mithril from 'mithril';

export interface NetworkNodeItem {
  id: string;
  name: string;
  url: string;
  secret_key: string;
  default_tag_slug: string;
  enabled: boolean;
}

export interface DiscussionMapItem {
  source: string;
  node: string;
  target_url: string;
  target_title: string;
}

export default class CrosspostSettingsPage extends ExtensionPage {
  mappings: DiscussionMapItem[] = [];
  mapSearch: Record<number, { q: string; loading: boolean; results: Array<{ id: string; title: string; url: string }> }> = {};
  nodes: NetworkNodeItem[] = [];
  testStatuses: Record<string, { loading?: boolean; success?: boolean; message?: string }> = {};
  copiedSecret: boolean = false;
  activeTab: 'general' | 'nodes' | 'mapping' | 'watermark' = 'general';

  oninit(vnode: Mithril.Vnode) {
    super.oninit(vnode);

    try {
      const raw = this.setting('framio-network-crosspost.nodes')() || '[]';
      this.nodes = JSON.parse(raw);
      if (!Array.isArray(this.nodes)) {
        this.nodes = [];
      }
    } catch {
      this.nodes = [];
    }

    try {
      const rawMap = JSON.parse(this.setting('framio-network-crosspost.discussion_map')() || '[]');
      this.mappings = Array.isArray(rawMap) ? rawMap : [];
    } catch {
      this.mappings = [];
    }

    // Eğer gizli anahtar henüz üretilmemişse otomatik bir tane üretip dolduralım
    if (!this.setting('framio-network-crosspost.secret_key')()) {
      this.generateNewSecret();
    }
  }

  generateNewSecret() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.setting('framio-network-crosspost.secret_key')(result);
    m.redraw();
  }

  copySecret() {
    const secret = this.setting('framio-network-crosspost.secret_key')() || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(secret).then(() => {
        this.copiedSecret = true;
        m.redraw();
        setTimeout(() => {
          this.copiedSecret = false;
          m.redraw();
        }, 2000);
      });
    }
  }

  syncNodesSetting() {
    this.setting('framio-network-crosspost.nodes')(JSON.stringify(this.nodes));
  }

  addNode() {
    const newId = 'node_' + Date.now();
    this.nodes.push({
      id: newId,
      name: '',
      url: '',
      secret_key: '',
      default_tag_slug: '',
      enabled: true,
    });
    this.syncNodesSetting();
    m.redraw();
  }

  removeNode(index: number) {
    this.nodes.splice(index, 1);
    this.syncNodesSetting();
    m.redraw();
  }

  testConnection(node: NetworkNodeItem) {
    this.testStatuses[node.id] = { loading: true };
    m.redraw();

    app.request<{ success: boolean; message?: string; error?: string }>({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/framio/crosspost/test-node',
      body: {
        url: node.url,
        secret_key: node.secret_key,
      },
    }).then((res) => {
      this.testStatuses[node.id] = {
        loading: false,
        success: res.success,
        message: res.message || (res.success ? 'Bağlantı başarılı!' : res.error),
      };
      m.redraw();
    }).catch((err) => {
      this.testStatuses[node.id] = {
        loading: false,
        success: false,
        message: err.message || 'Bağlantı sağlanamadı.',
      };
      m.redraw();
    });
  }

  content(): Mithril.Children {
    return (
      <div className="CrosspostAdminPage">
        <div className="container">
          {/* Sekme Navigasyonu */}
          <div className="CrosspostAdmin-tabs">
            <button
              type="button"
              className={`CrosspostAdmin-tab ${this.activeTab === 'general' ? 'is-active' : ''}`}
              onclick={() => { this.activeTab = 'general'; }}
            >
              <Icon name="fas fa-cog" />
              <span>{app.translator.trans('framio-network-crosspost.admin.general_settings')}</span>
            </button>
            <button
              type="button"
              className={`CrosspostAdmin-tab ${this.activeTab === 'nodes' ? 'is-active' : ''}`}
              onclick={() => { this.activeTab = 'nodes'; }}
            >
              <Icon name="fas fa-network-wired" />
              <span>{app.translator.trans('framio-network-crosspost.admin.nodes_title')}</span>
            </button>
            <button
              type="button"
              className={`CrosspostAdmin-tab ${this.activeTab === 'mapping' ? 'is-active' : ''}`}
              onclick={() => { this.activeTab = 'mapping'; }}
            >
              <Icon name="fas fa-link" />
              <span>Tartışma Eşleşmeleri</span>
            </button>
            <button
              type="button"
              className={`CrosspostAdmin-tab ${this.activeTab === 'watermark' ? 'is-active' : ''}`}
              onclick={() => { this.activeTab = 'watermark'; }}
            >
              <Icon name="fas fa-stamp" />
              <span>{app.translator.trans('framio-network-crosspost.admin.wm_tab_title')}</span>
            </button>
          </div>

          {/* Sekmeler */}
          {this.activeTab === 'general' && this.renderGeneralTab()}
          {this.activeTab === 'nodes' && this.renderNodesTab()}
          {this.activeTab === 'mapping' && this.renderMappingTab()}
          {this.activeTab === 'watermark' && this.renderWatermarkTab()}

          <div className="Form-group" style="margin-top: 24px;">
            {this.submitButton()}
          </div>
        </div>
      </div>
    );
  }

  renderGeneralTab(): Mithril.Children {
    return (
      <div className="CrosspostAdmin-tab-content">
        <h3>{app.translator.trans('framio-network-crosspost.admin.general_settings')}</h3>

        <div className="Form-group">
          <label>{app.translator.trans('framio-network-crosspost.admin.platform_name')}</label>
          <div className="helpText">
            {app.translator.trans('framio-network-crosspost.admin.platform_name_help')}
          </div>
          <input
            type="text"
            className="FormControl"
            placeholder="Örn: Ulaşım Info"
            bidi={this.setting('framio-network-crosspost.current_platform_name')}
          />
        </div>

        <div className="Form-group">
          <label>{app.translator.trans('framio-network-crosspost.admin.secret_key')}</label>
          <div className="helpText">
            {app.translator.trans('framio-network-crosspost.admin.secret_key_help')}
          </div>
          <div className="CrosspostAdmin-secret-row">
            <input
              type="text"
              className="FormControl"
              style="flex: 1;"
              bidi={this.setting('framio-network-crosspost.secret_key')}
            />
            <Button
              type="button"
              className="Button"
              onclick={this.copySecret.bind(this)}
            >
              <Icon name={this.copiedSecret ? 'fas fa-check' : 'fas fa-copy'} />
              <span>
                {this.copiedSecret
                  ? app.translator.trans('framio-network-crosspost.admin.copied')
                  : app.translator.trans('framio-network-crosspost.admin.copy')}
              </span>
            </Button>
            <Button
              type="button"
              className="Button Button--danger"
              onclick={this.generateNewSecret.bind(this)}
            >
              <Icon name="fas fa-sync-alt" />
              <span>{app.translator.trans('framio-network-crosspost.admin.generate_secret')}</span>
            </Button>
          </div>
        </div>

        <div className="Form-group">
          <label>{app.translator.trans('framio-network-crosspost.admin.sync_user_id')}</label>
          <div className="helpText">
            {app.translator.trans('framio-network-crosspost.admin.sync_user_id_help')}
          </div>
          <input
            type="number"
            className="FormControl"
            style="width: 160px;"
            placeholder="1"
            bidi={this.setting('framio-network-crosspost.sync_user_id')}
          />
        </div>

        <div className="Form-group" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--muted-more-color, #eee);">
          <label style="font-weight: 600; font-size: 15px; margin-bottom: 8px; display: block;">
            {app.translator.trans('framio-network-crosspost.admin.user_mapping_title')}
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={(() => {
                const val = this.setting('framio-network-crosspost.allow_admin_select_user')();
                return val === '1' || val === true || val === 'true' || val === undefined || val === '';
              })()}
              onchange={(e: Event) => {
                this.setting('framio-network-crosspost.allow_admin_select_user')((e.target as HTMLInputElement).checked ? '1' : '0');
              }}
            />
            <span style="font-weight: bold; margin-left: 6px;">
              {app.translator.trans('framio-network-crosspost.admin.allow_admin_select_user')}
            </span>
          </label>
          <div className="helpText" style="margin-left: 24px;">
            {app.translator.trans('framio-network-crosspost.admin.allow_admin_select_user_help')}
          </div>
        </div>
      </div>
    );
  }

  renderNodesTab(): Mithril.Children {
    return (
      <div className="CrosspostAdmin-tab-content">
        <div className="CrosspostAdmin-nodes-section">
          <div className="CrosspostAdmin-nodes-header">
            <div>
              <h4>{app.translator.trans('framio-network-crosspost.admin.nodes_title')}</h4>
              <div className="helpText">
                {app.translator.trans('framio-network-crosspost.admin.nodes_desc')}
              </div>
            </div>
            <Button
              type="button"
              className="Button Button--primary"
              onclick={this.addNode.bind(this)}
            >
              <Icon name="fas fa-plus" />
              <span>{app.translator.trans('framio-network-crosspost.admin.add_node')}</span>
            </Button>
          </div>

          {this.nodes.map((node, index) => {
            const test = this.testStatuses[node.id];
            return (
              <div className="CrosspostAdmin-node-card" key={node.id}>
                <div className="CrosspostAdmin-node-grid">
                  <div>
                    <label>{app.translator.trans('framio-network-crosspost.admin.node_name')}</label>
                    <input
                      type="text"
                      className="FormControl"
                      placeholder="Örn: Spotters Turkey veya Ulaşım Arşiv"
                      value={node.name}
                      oninput={(e: Event) => {
                        node.name = (e.target as HTMLInputElement).value;
                        this.syncNodesSetting();
                      }}
                    />
                  </div>
                  <div>
                    <label>{app.translator.trans('framio-network-crosspost.admin.node_url')}</label>
                    <input
                      type="text"
                      className="FormControl"
                      placeholder="http://forum.spottersturkeyrc.test"
                      value={node.url}
                      oninput={(e: Event) => {
                        node.url = (e.target as HTMLInputElement).value;
                        this.syncNodesSetting();
                      }}
                    />
                  </div>
                  <div>
                    <label>{app.translator.trans('framio-network-crosspost.admin.node_secret')}</label>
                    <input
                      type="text"
                      className="FormControl"
                      placeholder="Karşı sitenin Inbound Secret Key'i"
                      value={node.secret_key}
                      oninput={(e: Event) => {
                        node.secret_key = (e.target as HTMLInputElement).value;
                        this.syncNodesSetting();
                      }}
                    />
                  </div>
                  <div>
                    <label>{app.translator.trans('framio-network-crosspost.admin.node_tag_slug')}</label>
                    <input
                      type="text"
                      className="FormControl"
                      placeholder="Örn: haberler (opsiyonel)"
                      value={node.default_tag_slug}
                      oninput={(e: Event) => {
                        node.default_tag_slug = (e.target as HTMLInputElement).value;
                        this.syncNodesSetting();
                      }}
                    />
                  </div>
                </div>

                <div className="CrosspostAdmin-node-actions">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <label style="display: flex; align-items: center; gap: 6px; margin: 0; cursor: pointer;">
                      <input
                        type="checkbox"
                        checked={node.enabled !== false}
                        onchange={(e: Event) => {
                          node.enabled = (e.target as HTMLInputElement).checked;
                          this.syncNodesSetting();
                        }}
                      />
                      <span>Aktif</span>
                    </label>

                    <Button
                      type="button"
                      className="Button"
                      loading={test && test.loading}
                      onclick={() => this.testConnection(node)}
                    >
                      <Icon name="fas fa-plug" />
                      <span>{app.translator.trans('framio-network-crosspost.admin.test_connection')}</span>
                    </Button>

                    {test && test.message && (
                      <span style={`font-size: 12px; font-weight: 600; color: ${test.success ? '#059669' : '#dc2626'};`}>
                        {test.message}
                      </span>
                    )}
                  </div>

                  <Button
                    type="button"
                    className="Button Button--link Button--danger"
                    onclick={() => this.removeNode(index)}
                  >
                    <Icon name="fas fa-trash" />
                    <span>{app.translator.trans('framio-network-crosspost.admin.delete')}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  renderWatermarkTab(): Mithril.Children {
    const wmModes = [
      {
        key: 'wm_allow_keep_source',
        settingKey: 'framio-network-crosspost.wm_allow_keep_source',
        icon: 'fas fa-image',
        label: app.translator.trans('framio-network-crosspost.admin.wm_keep_source'),
        help: app.translator.trans('framio-network-crosspost.admin.wm_keep_source_help'),
        modeValue: 'keep_source',
      },
      {
        key: 'wm_allow_target_site',
        settingKey: 'framio-network-crosspost.wm_allow_target_site',
        icon: 'fas fa-exchange-alt',
        label: app.translator.trans('framio-network-crosspost.admin.wm_target_site'),
        help: app.translator.trans('framio-network-crosspost.admin.wm_target_site_help'),
        modeValue: 'target_site',
      },
      {
        key: 'wm_allow_no_watermark',
        settingKey: 'framio-network-crosspost.wm_allow_no_watermark',
        icon: 'fas fa-ban',
        label: app.translator.trans('framio-network-crosspost.admin.wm_no_watermark'),
        help: app.translator.trans('framio-network-crosspost.admin.wm_no_watermark_help'),
        modeValue: 'no_watermark',
      },
      {
        key: 'wm_allow_custom_upload',
        settingKey: 'framio-network-crosspost.wm_allow_custom_upload',
        icon: 'fas fa-upload',
        label: app.translator.trans('framio-network-crosspost.admin.wm_custom_upload'),
        help: app.translator.trans('framio-network-crosspost.admin.wm_custom_upload_help'),
        modeValue: 'custom',
      },
    ];

    const defaultMode = this.setting('framio-network-crosspost.wm_default_mode')() || 'keep_source';

    // Aktif seçenekleri filtrele (varsayılan modu seçebilmek için)
    const enabledModes = wmModes.filter((mode) => {
      const val = this.setting(mode.settingKey)();
      return val === '1' || val === true || val === 'true';
    });

    return (
      <div className="CrosspostAdmin-tab-content">
        <h3>
          <Icon name="fas fa-stamp" />
          <span style="margin-left: 8px;">{app.translator.trans('framio-network-crosspost.admin.wm_tab_title')}</span>
        </h3>

        <div className="helpText" style="margin-bottom: 20px;">
          {app.translator.trans('framio-network-crosspost.admin.wm_tab_desc')}
        </div>

        <div className="CrosspostAdmin-wm-options">
          {wmModes.map((mode) => {
            const isEnabled = (() => {
              const val = this.setting(mode.settingKey)();
              return val === '1' || val === true || val === 'true';
            })();

            return (
              <div className={`CrosspostAdmin-wm-option ${isEnabled ? 'is-enabled' : ''}`} key={mode.key}>
                <label className="CrosspostAdmin-wm-option-label">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onchange={(e: Event) => {
                      this.setting(mode.settingKey)((e.target as HTMLInputElement).checked ? '1' : '0');
                    }}
                  />
                  <div className="CrosspostAdmin-wm-option-info">
                    <div className="CrosspostAdmin-wm-option-title">
                      <Icon name={mode.icon} />
                      <span>{mode.label}</span>
                    </div>
                    <div className="CrosspostAdmin-wm-option-help">
                      {mode.help}
                    </div>
                  </div>
                </label>
              </div>
            );
          })}
        </div>

        <div className="Form-group" style="margin-top: 20px;">
          <label>{app.translator.trans('framio-network-crosspost.admin.wm_default_mode_label')}</label>
          <div className="helpText">
            {app.translator.trans('framio-network-crosspost.admin.wm_default_mode_help')}
          </div>
          <select
            className="FormControl"
            style="width: 320px;"
            value={defaultMode}
            onchange={(e: Event) => {
              this.setting('framio-network-crosspost.wm_default_mode')((e.target as HTMLSelectElement).value);
            }}
          >
            {wmModes.map((mode) => (
              <option value={mode.modeValue} key={mode.modeValue}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>

        {enabledModes.length === 0 && (
          <div className="Alert Alert--info" style="margin-top: 16px;">
            <Icon name="fas fa-info-circle" />
            <span style="margin-left: 8px;">
              {app.translator.trans('framio-network-crosspost.admin.wm_none_enabled_info')}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // TARTIŞMA EŞLEŞMELERİ
  // Bu sitedeki bir tartışmanın diğer sitede hangi tartışmaya denk geldiği.
  // Aktarım penceresi eşleşme bulursa "buraya mı aktarayım?" diye kısa onay ister.
  // ==========================================
  syncMappingsSetting() {
    this.setting('framio-network-crosspost.discussion_map')(JSON.stringify(this.mappings));
  }

  addMapping() {
    this.mappings.push({ source: '', node: this.nodes[0] ? this.nodes[0].id : '', target_url: '', target_title: '' });
    this.syncMappingsSetting();
  }

  removeMapping(index: number) {
    this.mappings.splice(index, 1);
    delete this.mapSearch[index];
    this.syncMappingsSetting();
  }

  static discussionId(value: string): string {
    const v = (value || '').trim();
    if (/^\d+$/.test(v)) return v;
    const m = v.match(/\/d\/(\d+)/);
    return m ? m[1] : '';
  }

  searchTarget(index: number) {
    const row = this.mappings[index];
    const state = this.mapSearch[index] || (this.mapSearch[index] = { q: '', loading: false, results: [] });
    if (!row.node) return;
    state.loading = true;
    app.request<{ discussions: Array<{ id: string; title: string; url: string }> }>({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/framio/crosspost/target-data',
      params: { action: 'discussions', node_id: row.node, q: state.q },
    }).then((res) => {
      state.results = res.discussions || [];
      state.loading = false;
      m.redraw();
    }).catch(() => {
      state.results = [];
      state.loading = false;
      m.redraw();
    });
  }

  renderMappingTab(): Mithril.Children {
    return (
      <div className="CrosspostAdmin-tab-content">
        <div className="CrosspostAdmin-nodes-header">
          <div>
            <h4>Tartışma Eşleşmeleri</h4>
            <div className="helpText">
              Bu sitedeki bir tartışmanın diğer sitede hangi tartışmaya karşılık geldiğini tanımlayın. Aktarım penceresi
              eşleşme bulduğunda hedef seçtirmek yerine "Eşleşen tartışma bu, buraya aktarılsın mı?" diye kısa bir onay ister.
            </div>
          </div>
          <Button type="button" className="Button Button--primary" disabled={!this.nodes.length} onclick={() => this.addMapping()}>
            <Icon name="fas fa-plus" />
            <span>Eşleşme Ekle</span>
          </Button>
        </div>

        {!this.nodes.length && <div className="Alert Alert--warning">Önce "Ağ Düğümleri" sekmesinden en az bir hedef site ekleyin.</div>}
        {this.nodes.length > 0 && !this.mappings.length && <div className="helpText">Henüz eşleşme yok.</div>}

        {this.mappings.map((row, index) => {
          const sourceId = CrosspostSettingsPage.discussionId(row.source);
          const state = this.mapSearch[index];
          return (
            <div className="CrosspostAdmin-node-card" key={index}>
              <div className="CrosspostAdmin-node-grid">
                <div>
                  <label>Bu Sitedeki Tartışma (bağlantı veya ID)</label>
                  <input
                    type="text"
                    className="FormControl"
                    placeholder="Örn: /d/6-mercedes-benz-travego veya 6"
                    value={row.source}
                    oninput={(e: Event) => {
                      row.source = (e.target as HTMLInputElement).value;
                      this.syncMappingsSetting();
                    }}
                  />
                  <div className="helpText">{sourceId ? `Tartışma #${sourceId}` : row.source ? 'Bağlantıdan tartışma kimliği okunamadı.' : ''}</div>
                </div>
                <div>
                  <label>Hedef Site</label>
                  <select
                    className="FormControl"
                    value={row.node}
                    onchange={(e: Event) => {
                      row.node = (e.target as HTMLSelectElement).value;
                      this.syncMappingsSetting();
                    }}
                  >
                    {this.nodes.map((n) => (
                      <option value={n.id}>{n.name || n.url || n.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Hedef Sitedeki Tartışma (bağlantı veya ID)</label>
                  <input
                    type="text"
                    className="FormControl"
                    placeholder="Örn: http://forum.ulasimarsiv.test/d/132-..."
                    value={row.target_url}
                    oninput={(e: Event) => {
                      row.target_url = (e.target as HTMLInputElement).value;
                      this.syncMappingsSetting();
                    }}
                  />
                </div>
                <div>
                  <label>Hedef Tartışma Başlığı (onayda gösterilir)</label>
                  <input
                    type="text"
                    className="FormControl"
                    placeholder="Aramadan seçince kendiliğinden dolar"
                    value={row.target_title}
                    oninput={(e: Event) => {
                      row.target_title = (e.target as HTMLInputElement).value;
                      this.syncMappingsSetting();
                    }}
                  />
                </div>
              </div>

              {/* Hedef sitede ara */}
              <div style="display: flex; gap: 8px; margin-top: 10px;">
                <input
                  type="text"
                  className="FormControl"
                  placeholder="Hedef sitede tartışma ara..."
                  value={state ? state.q : ''}
                  oninput={(e: Event) => {
                    (this.mapSearch[index] || (this.mapSearch[index] = { q: '', loading: false, results: [] })).q = (e.target as HTMLInputElement).value;
                  }}
                  onkeydown={(e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      this.searchTarget(index);
                    }
                  }}
                />
                <Button type="button" className="Button" loading={!!(state && state.loading)} onclick={() => this.searchTarget(index)}>
                  <Icon name="fas fa-search" />
                  <span>Ara</span>
                </Button>
                <Button type="button" className="Button Button--danger" onclick={() => this.removeMapping(index)}>
                  <Icon name="fas fa-trash" />
                </Button>
              </div>
              {state && state.results.length > 0 && (
                <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow: auto;">
                  {state.results.map((d) => (
                    <div
                      style={`cursor: pointer; padding: 6px 10px; border-radius: 6px; border: 1px solid ${row.target_url === d.url ? '#93c5fd' : 'var(--control-bg, #e2e8f0)'}; background: ${row.target_url === d.url ? '#dbeafe' : 'transparent'};`}
                      onclick={() => {
                        row.target_url = d.url;
                        row.target_title = d.title;
                        state.results = [];
                        this.syncMappingsSetting();
                      }}
                    >
                      <strong>{d.title}</strong> <span style="opacity: .6; font-size: 12px;">{d.url}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
}
