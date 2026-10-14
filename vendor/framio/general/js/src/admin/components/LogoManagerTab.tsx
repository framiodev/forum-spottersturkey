import app from 'flarum/admin/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';
import Select from 'flarum/common/components/Select';
import saveSettings from 'flarum/admin/utils/saveSettings';

export default class LogoManagerTab extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.desktopHeight = app.data.settings['framio-general.logo_desktop_height'] || '';
    this.mobileHeight = app.data.settings['framio-general.logo_mobile_height'] || '';
    this.alignment = app.data.settings['framio-general.logo_alignment'] || 'left';
    this.darkModeUrl = app.data.settings['framio-general.logo_dark_mode_url'] || '';
    this.seasonalHat = app.data.settings['framio-general.logo_seasonal_hat'] === '1';

    // Mobile Navbar Logo
    this.mobileLogoEnabled = app.data.settings['framio-general.mobile_logo_enabled'] === '1';
    this.mobileLogoSource = app.data.settings['framio-general.mobile_logo_source'] || 'favicon';
    this.mobileLogoCustomUrl = app.data.settings['framio-general.mobile_logo_custom_url'] || '';
    this.mobileLogoPosition = app.data.settings['framio-general.mobile_logo_position'] || 'left';
    this.mobileLogoHeight = app.data.settings['framio-general.mobile_logo_height'] || '32';
    this.mobileLogoLinkHome = app.data.settings['framio-general.mobile_logo_link_home'] !== '0';

    this.saving = false;
  }

  save() {
    this.saving = true;
    saveSettings({
      'framio-general.logo_desktop_height': this.desktopHeight.trim(),
      'framio-general.logo_mobile_height': this.mobileHeight.trim(),
      'framio-general.logo_alignment': this.alignment,
      'framio-general.logo_dark_mode_url': this.darkModeUrl.trim(),
      'framio-general.logo_seasonal_hat': this.seasonalHat ? '1' : '0',
      'framio-general.mobile_logo_enabled': this.mobileLogoEnabled ? '1' : '0',
      'framio-general.mobile_logo_source': this.mobileLogoSource,
      'framio-general.mobile_logo_custom_url': this.mobileLogoCustomUrl.trim(),
      'framio-general.mobile_logo_position': this.mobileLogoPosition,
      'framio-general.mobile_logo_height': this.mobileLogoHeight,
      'framio-general.mobile_logo_link_home': this.mobileLogoLinkHome ? '1' : '0',
    })
      .then(() => {
        this.saving = false;
        app.alerts.show({ type: 'success' }, app.translator.trans('framio-general.admin.logo.saved'));
        m.redraw();
      })
      .catch(() => {
        this.saving = false;
        m.redraw();
      });
  }

  view() {
    const forumLogoUrl = app.forum.attribute('logoUrl') || '';

    return (
      <div className="container SpeedCacheSettingsPage">
        <h2>{app.translator.trans('framio-general.admin.logo.title')}</h2>
        <p className="helpText" style="max-width: 780px; margin-bottom: 24px; line-height: 1.5;">
          {app.translator.trans('framio-general.admin.logo.description')}
        </p>

        {/* Masaüstü ve Mobil Boyutlandırma */}
        <div style="display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 24px;">
          <div className="Form-group" style="flex: 1; min-width: 250px;">
            <label style="font-weight: 600; font-size: 14px; margin-bottom: 6px; display: block;">
              {app.translator.trans('framio-general.admin.logo.desktop_height_label')}
            </label>
            <input
              type="number"
              className="FormControl"
              placeholder="Örn: 42"
              value={this.desktopHeight}
              oninput={(e) => {
                this.desktopHeight = e.target.value;
              }}
            />
            <p className="helpText">{app.translator.trans('framio-general.admin.logo.desktop_height_help')}</p>
          </div>

          <div className="Form-group" style="flex: 1; min-width: 250px;">
            <label style="font-weight: 600; font-size: 14px; margin-bottom: 6px; display: block;">
              {app.translator.trans('framio-general.admin.logo.mobile_height_label')}
            </label>
            <input
              type="number"
              className="FormControl"
              placeholder="Örn: 32"
              value={this.mobileHeight}
              oninput={(e) => {
                this.mobileHeight = e.target.value;
              }}
            />
            <p className="helpText">{app.translator.trans('framio-general.admin.logo.mobile_height_help')}</p>
          </div>
        </div>

        {/* Hizalama Seçeneği */}
        <div className="Form-group" style="margin-bottom: 24px; max-width: 400px;">
          <label style="font-weight: 600; font-size: 14px; margin-bottom: 6px; display: block;">
            {app.translator.trans('framio-general.admin.logo.alignment_label')}
          </label>
          <Select
            value={this.alignment}
            options={{
              left: app.translator.trans('framio-general.admin.logo.alignment_left'),
              center: app.translator.trans('framio-general.admin.logo.alignment_center'),
            }}
            onchange={(val) => {
              this.alignment = val;
            }}
          />
        </div>

        {/* Karanlık Mod Logo URL */}
        <div className="Form-group" style="margin-bottom: 24px; max-width: 600px;">
          <label style="font-weight: 600; font-size: 14px; margin-bottom: 6px; display: block;">
            {app.translator.trans('framio-general.admin.logo.dark_mode_url_label')}
          </label>
          <input
            type="text"
            className="FormControl"
            placeholder={app.translator.trans('framio-general.admin.logo.dark_mode_url_placeholder')}
            value={this.darkModeUrl}
            oninput={(e) => {
              this.darkModeUrl = e.target.value;
            }}
          />
          <p className="helpText">{app.translator.trans('framio-general.admin.logo.dark_mode_url_help')}</p>
        </div>

        {/* Mevsimsel Yılbaşı Modu (Noel Şapkası) */}
        <div className="Form-group" style="margin-bottom: 24px;">
          <Switch
            state={this.seasonalHat}
            onchange={(val) => {
              this.seasonalHat = val;
            }}
          >
            <strong>{app.translator.trans('framio-general.admin.logo.seasonal_hat_label')}</strong>
          </Switch>
          <p className="helpText" style="margin-top: 4px; margin-left: 54px;">
            {app.translator.trans('framio-general.admin.logo.seasonal_hat_help')}
          </p>
        </div>

        {/* Canlı Logo Önizleme Alanı */}
        <div className="SpeedStats-section" style="margin-top: 24px; max-width: 780px;">
          <h3>Canlı Önizleme</h3>
          <div
            style={{
              padding: '20px',
              border: '1px solid var(--control-bg)',
              borderRadius: '6px',
              background: 'var(--header-bg, #fff)',
              display: 'flex',
              justifyContent: this.alignment === 'center' ? 'center' : 'flex-start',
              alignItems: 'center',
            }}
          >
            <div style={{ position: 'relative', display: 'inline-block' }}>
              {this.seasonalHat && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '-8px',
                    fontSize: '22px',
                    transform: 'rotate(-15deg)',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                >
                  🎅
                </span>
              )}
              {forumLogoUrl ? (
                <img
                  src={forumLogoUrl}
                  alt="Logo"
                  style={{
                    maxHeight: this.desktopHeight ? `${this.desktopHeight}px` : '40px',
                    height: this.desktopHeight ? `${this.desktopHeight}px` : 'auto',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '8px 16px',
                    background: 'var(--primary-color)',
                    color: '#fff',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    fontSize: this.desktopHeight ? `${Math.min(28, Math.max(14, this.desktopHeight * 0.5))}px` : '18px',
                  }}
                >
                  {app.forum.attribute('title') || 'Forum Logo'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobil Gezinme Çubuğu Logosu (Link Robins Mobile Logo) */}
        <div className="SpeedStats-section" style="margin-top: 32px; max-width: 780px; padding: 20px; border: 1px solid var(--control-bg); border-radius: 6px;">
          <h3 style="margin-top: 0; display: flex; align-items: center; gap: 8px;">
            <i className="fas fa-mobile-screen" aria-hidden="true" style="color: var(--primary-color);"></i>
            {app.translator.trans('framio-general.admin.logo.mobile_nav_title')}
          </h3>
          <p className="helpText" style="margin-bottom: 20px; line-height: 1.5;">
            {app.translator.trans('framio-general.admin.logo.mobile_nav_desc')}
          </p>

          <div className="Form-group" style="margin-bottom: 20px;">
            <Switch
              state={this.mobileLogoEnabled}
              onchange={(val) => {
                this.mobileLogoEnabled = val;
              }}
            >
              <strong>{app.translator.trans('framio-general.admin.logo.mobile_nav_enable_label')}</strong>
            </Switch>
            <p className="helpText" style="margin-top: 4px; margin-left: 54px;">
              {app.translator.trans('framio-general.admin.logo.mobile_nav_enable_help')}
            </p>
          </div>

          {this.mobileLogoEnabled && (
            <div>
              <div style="display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 20px;">
                <div className="Form-group" style="flex: 1; min-width: 250px;">
                  <label style="font-weight: 600; font-size: 14px; margin-bottom: 6px; display: block;">
                    {app.translator.trans('framio-general.admin.logo.mobile_nav_source_label')}
                  </label>
                  <Select
                    value={this.mobileLogoSource}
                    options={{
                      favicon: app.translator.trans('framio-general.admin.logo.mobile_nav_source_favicon'),
                      logo: app.translator.trans('framio-general.admin.logo.mobile_nav_source_logo'),
                      custom: app.translator.trans('framio-general.admin.logo.mobile_nav_source_custom'),
                    }}
                    onchange={(val) => {
                      this.mobileLogoSource = val;
                    }}
                  />
                  <p className="helpText">{app.translator.trans('framio-general.admin.logo.mobile_nav_source_help')}</p>
                </div>

                <div className="Form-group" style="flex: 1; min-width: 250px;">
                  <label style="font-weight: 600; font-size: 14px; margin-bottom: 6px; display: block;">
                    {app.translator.trans('framio-general.admin.logo.mobile_nav_position_label')}
                  </label>
                  <Select
                    value={this.mobileLogoPosition}
                    options={{
                      left: app.translator.trans('framio-general.admin.logo.mobile_nav_position_left'),
                      right: app.translator.trans('framio-general.admin.logo.mobile_nav_position_right'),
                    }}
                    onchange={(val) => {
                      this.mobileLogoPosition = val;
                    }}
                  />
                  <p className="helpText">{app.translator.trans('framio-general.admin.logo.mobile_nav_position_help')}</p>
                </div>
              </div>

              {this.mobileLogoSource === 'custom' && (
                <div className="Form-group" style="margin-bottom: 20px;">
                  <label style="font-weight: 600; font-size: 14px; margin-bottom: 6px; display: block;">
                    {app.translator.trans('framio-general.admin.logo.mobile_nav_custom_url_label')}
                  </label>
                  <input
                    type="text"
                    className="FormControl"
                    placeholder="https://... veya /assets/logo.png"
                    value={this.mobileLogoCustomUrl}
                    oninput={(e) => {
                      this.mobileLogoCustomUrl = e.target.value;
                    }}
                  />
                  <p className="helpText">{app.translator.trans('framio-general.admin.logo.mobile_nav_custom_url_help')}</p>
                </div>
              )}

              <div style="display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 20px;">
                <div className="Form-group" style="flex: 1; min-width: 200px;">
                  <label style="font-weight: 600; font-size: 14px; margin-bottom: 6px; display: block;">
                    {app.translator.trans('framio-general.admin.logo.mobile_nav_height_label')}
                  </label>
                  <input
                    type="number"
                    min="16"
                    max="64"
                    className="FormControl"
                    placeholder="32"
                    value={this.mobileLogoHeight}
                    oninput={(e) => {
                      this.mobileLogoHeight = e.target.value;
                    }}
                  />
                  <p className="helpText">{app.translator.trans('framio-general.admin.logo.mobile_nav_height_help')}</p>
                </div>

                <div className="Form-group" style="flex: 1; min-width: 250px; display: flex; flex-direction: column; justify-content: center;">
                  <Switch
                    state={this.mobileLogoLinkHome}
                    onchange={(val) => {
                      this.mobileLogoLinkHome = val;
                    }}
                  >
                    <strong>{app.translator.trans('framio-general.admin.logo.mobile_nav_link_home_label')}</strong>
                  </Switch>
                  <p className="helpText" style="margin-top: 4px; margin-left: 54px;">
                    {app.translator.trans('framio-general.admin.logo.mobile_nav_link_home_help')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style="margin-top: 24px;">
          <Button
            type="button"
            className="Button Button--primary"
            loading={this.saving}
            onclick={this.save.bind(this)}
          >
            {app.translator.trans('framio-general.admin.logo.save')}
          </Button>
        </div>
      </div>
    );
  }
}
