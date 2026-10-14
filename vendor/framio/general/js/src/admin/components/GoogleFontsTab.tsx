import app from 'flarum/admin/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import saveSettings from 'flarum/admin/utils/saveSettings';

export default class GoogleFontsTab extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.bodyFont = app.data.settings['framio-general.google_fonts_body'] || '';
    this.headingFont = app.data.settings['framio-general.google_fonts_heading'] || '';
    this.saving = false;

    this.popularFonts = [
      'Inter',
      'Roboto',
      'Open Sans',
      'Poppins',
      'Montserrat',
      'Lato',
      'Nunito',
      'Raleway',
      'Oswald',
      'Playfair Display',
      'Rubik',
    ];
  }

  loadPreviewFont(fontName) {
    if (!fontName) return;
    const linkId = 'preview-font-' + fontName.replace(/\s+/g, '-');
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;600;700&display=swap`;
      document.head.appendChild(link);
    }
  }

  save() {
    this.saving = true;
    saveSettings({
      'framio-general.google_fonts_body': this.bodyFont.trim(),
      'framio-general.google_fonts_heading': this.headingFont.trim(),
    })
      .then(() => {
        this.saving = false;
        app.alerts.show({ type: 'success' }, app.translator.trans('framio-general.admin.fonts.saved'));
        m.redraw();
      })
      .catch(() => {
        this.saving = false;
        m.redraw();
      });
  }

  view() {
    if (this.bodyFont) this.loadPreviewFont(this.bodyFont);
    if (this.headingFont) this.loadPreviewFont(this.headingFont);

    return (
      <div className="container SpeedCacheSettingsPage">
        <h2>{app.translator.trans('framio-general.admin.fonts.title')}</h2>
        <p className="helpText" style="max-width: 780px; margin-bottom: 24px; line-height: 1.5;">
          {app.translator.trans('framio-general.admin.fonts.description')}
        </p>

        <div className="Form-group" style="margin-bottom: 24px;">
          <label style="font-weight: 600; font-size: 14px; margin-bottom: 6px; display: block;">
            {app.translator.trans('framio-general.admin.fonts.body_label')}
          </label>
          <input
            type="text"
            className="FormControl"
            style="max-width: 400px; margin-bottom: 6px;"
            placeholder={app.translator.trans('framio-general.admin.fonts.body_placeholder')}
            value={this.bodyFont}
            oninput={(e) => {
              this.bodyFont = e.target.value;
            }}
          />
          <p className="helpText">{app.translator.trans('framio-general.admin.fonts.body_help')}</p>

          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; align-items: center;">
            <span style="font-size: 12px; color: var(--muted-color); margin-right: 4px;">
              {app.translator.trans('framio-general.admin.fonts.popular_heading')}
            </span>
            {this.popularFonts.map((font) => (
              <button
                type="button"
                className={`Button Button--sm ${this.bodyFont.toLowerCase() === font.toLowerCase() ? 'Button--primary' : ''}`}
                style="padding: 2px 8px; font-size: 12px;"
                onclick={() => {
                  this.bodyFont = font;
                  this.loadPreviewFont(font);
                }}
              >
                {font}
              </button>
            ))}
          </div>
        </div>

        <div className="Form-group" style="margin-bottom: 24px;">
          <label style="font-weight: 600; font-size: 14px; margin-bottom: 6px; display: block;">
            {app.translator.trans('framio-general.admin.fonts.heading_label')}
          </label>
          <input
            type="text"
            className="FormControl"
            style="max-width: 400px; margin-bottom: 6px;"
            placeholder={app.translator.trans('framio-general.admin.fonts.heading_placeholder')}
            value={this.headingFont}
            oninput={(e) => {
              this.headingFont = e.target.value;
            }}
          />
          <p className="helpText">{app.translator.trans('framio-general.admin.fonts.heading_help')}</p>

          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; align-items: center;">
            <span style="font-size: 12px; color: var(--muted-color); margin-right: 4px;">
              {app.translator.trans('framio-general.admin.fonts.popular_heading')}
            </span>
            {this.popularFonts.map((font) => (
              <button
                type="button"
                className={`Button Button--sm ${this.headingFont.toLowerCase() === font.toLowerCase() ? 'Button--primary' : ''}`}
                style="padding: 2px 8px; font-size: 12px;"
                onclick={() => {
                  this.headingFont = font;
                  this.loadPreviewFont(font);
                }}
              >
                {font}
              </button>
            ))}
          </div>
        </div>

        {/* Canlı Önizleme Alanı */}
        <div className="SpeedStats-section" style="margin-top: 24px; max-width: 780px;">
          <h3>{app.translator.trans('framio-general.admin.fonts.preview_title')}</h3>
          <div
            style={{
              padding: '16px',
              border: '1px solid var(--control-bg)',
              borderRadius: '6px',
              background: 'var(--body-bg)',
            }}
          >
            <h2
              style={{
                margin: '0 0 10px 0',
                fontSize: '22px',
                fontFamily: this.headingFont ? `'${this.headingFont}', sans-serif` : 'inherit',
              }}
            >
              {this.headingFont || 'Varsayılan Başlık Fontu'}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                lineHeight: 1.6,
                fontFamily: this.bodyFont ? `'${this.bodyFont}', sans-serif` : 'inherit',
              }}
            >
              {app.translator.trans('framio-general.admin.fonts.preview_text')}
            </p>
          </div>
        </div>

        <div style="margin-top: 24px;">
          <Button
            type="button"
            className="Button Button--primary"
            loading={this.saving}
            onclick={this.save.bind(this)}
          >
            {app.translator.trans('framio-general.admin.fonts.save')}
          </Button>
        </div>
      </div>
    );
  }
}
