import app from 'flarum/admin/app';
import Component from 'flarum/common/Component';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Button from 'flarum/common/components/Button';

export default class SpeedStatsTab extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.loading = true;
    this.stats = null;
    this.actionLoading = false;

    this.loadStats();
  }

  loadStats() {
    this.loading = true;
    app
      .request({
        method: 'GET',
        url: app.forum.attribute('apiUrl') + '/framio/speed-stats',
      })
      .then((response) => {
        this.stats = response;
        this.loading = false;
        m.redraw();
      })
      .catch(() => {
        this.loading = false;
        m.redraw();
      });
  }

  performAction(action) {
    this.actionLoading = true;
    app
      .request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/framio/speed-stats',
        body: { action },
      })
      .then((response) => {
        this.actionLoading = false;
        app.alerts.show({ type: 'success' }, response.message || 'Başarılı!');
        this.loadStats();
      })
      .catch(() => {
        this.actionLoading = false;
        m.redraw();
      });
  }

  view() {
    if (this.loading || !this.stats) {
      return (
        <div className="container SpeedCacheSettingsPage" style="padding: 40px 0; text-align: center;">
          <LoadingIndicator />
        </div>
      );
    }

    const { backend_avg, frontend_avg, images_avg, total_measurements, slowest_images, system } = this.stats;

    return (
      <div className="container SpeedCacheSettingsPage">
        <h2>{app.translator.trans('framio-general.admin.speed.title')}</h2>
        <p className="helpText">{app.translator.trans('framio-general.admin.speed.subtitle')}</p>

        <div className="SpeedStats-grid">
          <div className="SpeedStats-card">
            <span className="SpeedStats-card-label">{app.translator.trans('framio-general.admin.speed.backend_avg')}</span>
            <span className={`SpeedStats-card-value ${backend_avg < 200 ? 'good' : backend_avg < 500 ? 'warning' : 'bad'}`}>
              {backend_avg} ms
            </span>
          </div>
          <div className="SpeedStats-card">
            <span className="SpeedStats-card-label">{app.translator.trans('framio-general.admin.speed.frontend_avg')}</span>
            <span className={`SpeedStats-card-value ${frontend_avg < 1500 ? 'good' : frontend_avg < 3000 ? 'warning' : 'bad'}`}>
              {frontend_avg} ms
            </span>
          </div>
          <div className="SpeedStats-card">
            <span className="SpeedStats-card-label">{app.translator.trans('framio-general.admin.speed.images_avg')}</span>
            <span className={`SpeedStats-card-value ${images_avg < 300 ? 'good' : images_avg < 800 ? 'warning' : 'bad'}`}>
              {images_avg} ms
            </span>
          </div>
          <div className="SpeedStats-card">
            <span className="SpeedStats-card-label">{app.translator.trans('framio-general.admin.speed.total_req')}</span>
            <span className="SpeedStats-card-value">{total_measurements}</span>
          </div>
        </div>

        <div className="SpeedStats-section">
          <h3>{app.translator.trans('framio-general.admin.speed.system_status')}</h3>
          <table className="SpeedStats-table">
            <tbody>
              <tr>
                <td>PHP Sürümü</td>
                <td><strong>{system?.php_version}</strong></td>
              </tr>
              <tr>
                <td>OPcache Durumu</td>
                <td>
                  <span className={`label ${system?.opcache_enabled ? 'label-success' : 'label-danger'}`}>
                    {system?.opcache_enabled ? 'Etkin' : 'Devre Dışı'}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Önbellek Sürücüsü (Cache Driver)</td>
                <td><code>{system?.cache_driver}</code></td>
              </tr>
              <tr>
                <td>Storage / Cache Boyutu</td>
                <td>{system?.storage_cache_size}</td>
              </tr>
              <tr>
                <td>Storage / Views (Derlenmiş Görünümler) Boyutu</td>
                <td>{system?.storage_views_size}</td>
              </tr>
              <tr>
                <td>Public Assets Boyutu</td>
                <td>{system?.public_assets_size}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="SpeedStats-section">
          <h3>{app.translator.trans('framio-general.admin.speed.slowest_images')}</h3>
          {slowest_images && slowest_images.length > 0 ? (
            <table className="SpeedStats-table">
              <thead>
                <tr>
                  <th>Görsel URL Adresi</th>
                  <th>Ortalama Süre</th>
                  <th>Yüklenme Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {slowest_images.map((img) => (
                  <tr key={img.url}>
                    <td className="url-cell"><a href={img.url} target="_blank" rel="noreferrer">{img.url}</a></td>
                    <td><strong className="bad">{Math.round(img.avg_duration)} ms</strong></td>
                    <td>{img.load_count} defa</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Henüz yavaş görsel verisi kaydedilmedi.</p>
          )}
        </div>

        <div className="SpeedStats-actions">
          <Button
            type="button"
            className="Button Button--primary"
            loading={this.actionLoading}
            onclick={() => this.performAction('clear_cache')}
          >
            {app.translator.trans('framio-general.admin.speed.clear_cache')}
          </Button>
          <Button
            type="button"
            className="Button Button--danger"
            loading={this.actionLoading}
            onclick={() => this.performAction('clear_metrics')}
          >
            {app.translator.trans('framio-general.admin.speed.reset_metrics')}
          </Button>
        </div>
      </div>
    );
  }
}
