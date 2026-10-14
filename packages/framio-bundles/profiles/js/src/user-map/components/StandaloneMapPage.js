import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import { loadLeaflet } from '../utils/loadLeaflet';

export default class StandaloneMapPage extends Page {
  oninit(vnode) {
    super.oninit(vnode);
    this.mapInstance = null;
    this.users = [];
    this.loading = true;

    app
      .request({
        method: 'GET',
        url: app.forum.attribute('apiUrl') + '/map-users',
      })
      .then((result) => {
        this.users = result.data || [];
        this.loading = false;
        m.redraw();
        setTimeout(() => this.initMap(), 100);
      })
      .catch(() => {
        this.loading = false;
        m.redraw();
      });
  }

  view() {
    const fullWidth = app.forum.attribute('framioProfilesMap.fullWidth') === true;
    const mapHeight = app.forum.attribute('framioProfilesMap.mapHeight') || 500;
    const count = this.users.length;

    return (
      <div className={`StandaloneMapPage${fullWidth ? ' StandaloneMapPage--full' : ''}`}>
        <div className="StandaloneMapPage-header container">
          <h2>
            <i className="fas fa-map-marked-alt" /> {app.translator.trans('framio-profiles-map.forum.title')}
          </h2>
          {!this.loading && (
            <p className="helpText">
              {app.translator.trans('framio-profiles-map.forum.members_count', { count })}
            </p>
          )}
        </div>
        {this.loading ? (
          <div className="container" style="padding: 40px 0; text-align: center;">
            <LoadingIndicator />
          </div>
        ) : (
          <div className={fullWidth ? '' : 'container'}>
            <div id="osm-map-standalone" className="StandaloneMapPage-map" style={`height:${mapHeight}px`} />
          </div>
        )}
      </div>
    );
  }

  initMap() {
    const el = document.getElementById('osm-map-standalone');
    if (!el || this.mapInstance) return;

    loadLeaflet().then(() => {
      const el2 = document.getElementById('osm-map-standalone');
      if (!el2 || !window.L) return;

      this.mapInstance = window.L.map('osm-map-standalone').setView([39.0, 35.0], 6); // Türkiye merkezli varsayılan

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 19,
        referrerPolicy: 'strict-origin-when-cross-origin',
      }).addTo(this.mapInstance);

      // Özel marker ikonu veya varsayılan SVG/CSS marker
      const defaultIcon = window.L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const cluster = window.L.markerClusterGroup
        ? window.L.markerClusterGroup()
        : this.mapInstance;

      const bounds = [];

      this.users.forEach((user) => {
        const lat = user.lat;
        const lon = user.lon;
        if (!lat || !lon) return;

        bounds.push([lat, lon]);

        const avatarHtml = user.avatar
          ? `<img src="${user.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;margin-bottom:6px;display:inline-block;" />`
          : '';

        const popup = `
          <div style="text-align:center;min-width:130px;font-family:inherit;padding:4px;">
            ${avatarHtml}
            <div><strong><a href="${app.forum.attribute('baseUrl')}/u/${encodeURIComponent(user.username)}">${user.name}</a></strong></div>
            <div style="font-size:12px;color:#666;margin-top:2px;"><i class="fas fa-map-marker-alt"></i> ${user.location || ''}</div>
          </div>
        `;

        const marker = window.L.marker([lat, lon], { icon: defaultIcon }).bindPopup(popup);

        if (cluster !== this.mapInstance) {
          cluster.addLayer(marker);
        } else {
          marker.addTo(this.mapInstance);
        }
      });

      if (cluster !== this.mapInstance) {
        this.mapInstance.addLayer(cluster);
      }

      if (bounds.length > 0) {
        this.mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }

      setTimeout(() => this.mapInstance && this.mapInstance.invalidateSize(), 300);
    });
  }

  onremove(vnode) {
    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = null;
    }
    super.onremove(vnode);
  }
}
