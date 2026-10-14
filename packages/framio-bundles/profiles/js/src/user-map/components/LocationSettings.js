import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import { loadLeaflet } from '../utils/loadLeaflet';

export default class LocationSettings extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    const user = this.attrs.user || app.session.user;
    this.locationValue = (user && user.location && user.location()) || '';
    this.saving = false;
    this.mapInstance = null;
  }

  view() {
    const user = this.attrs.user || app.session.user;
    const hasCoords = user && user.mapLat && user.mapLat();

    return (
      <fieldset className="Settings-theme" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--control-bg);">
        <legend style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">
          <i className="fas fa-map-marked-alt" style="margin-right: 6px; color: var(--primary-color);" />{' '}
          {app.translator.trans('framio-profiles-map.forum.location')}
        </legend>

        <div className="Form-group">
          <label style="font-weight: 500; margin-bottom: 6px; display: block;">
            {app.translator.trans('framio-profiles-map.forum.city_label')}
          </label>
          <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
            <input
              type="text"
              className="FormControl"
              placeholder={app.translator.trans('framio-profiles-map.forum.city_placeholder')}
              value={this.locationValue}
              oninput={(e) => {
                this.locationValue = e.target.value;
              }}
              style="max-width: 320px;"
            />
            <Button className="Button Button--primary" loading={this.saving} onclick={() => this.save()}>
              {app.translator.trans('framio-profiles-map.forum.save')}
            </Button>
          </div>
          <p className="helpText" style="font-size: 13px; color: var(--muted-color); margin-top: 4px;">
            {app.translator.trans('framio-profiles-map.forum.locationDescription')}
          </p>
        </div>

        {hasCoords ? (
          <div className="Form-group" style="margin-top: 16px;">
            <label style="font-weight: 500; margin-bottom: 6px; display: block;">
              {app.translator.trans('framio-profiles-map.forum.your_position')}
            </label>
            <div
              id="osm-map-settings"
              className="LocationSettings-preview"
              style="width: 100%; max-width: 600px; height: 220px; border-radius: 8px; overflow: hidden;"
            />
          </div>
        ) : null}

        <div className="Form-group" style="margin-top: 16px;">
          <a href={app.route('members.map')} className="Button Button--link">
            <i className="fas fa-globe" style="margin-right: 6px;" />
            {app.translator.trans('framio-profiles-map.forum.show_members_map')}
          </a>
        </div>
      </fieldset>
    );
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    this.initPersonalMap();
  }

  onupdate(vnode) {
    super.onupdate(vnode);
    const user = this.attrs.user || app.session.user;
    if (!this.mapInstance && user && user.mapLat && user.mapLat()) {
      this.initPersonalMap();
    }
  }

  onremove(vnode) {
    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = null;
    }
    super.onremove(vnode);
  }

  initPersonalMap() {
    const user = this.attrs.user || app.session.user;
    const lat = user && user.mapLat && user.mapLat();
    const lon = user && user.mapLon && user.mapLon();
    if (!lat || !lon) return;

    const el = document.getElementById('osm-map-settings');
    if (!el) return;

    loadLeaflet().then(() => {
      if (this.mapInstance) {
        this.mapInstance.remove();
        this.mapInstance = null;
      }
      const el2 = document.getElementById('osm-map-settings');
      if (!el2 || !window.L) return;

      this.mapInstance = window.L.map('osm-map-settings').setView([lat, lon], 11);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
        maxZoom: 19,
        referrerPolicy: 'strict-origin-when-cross-origin',
      }).addTo(this.mapInstance);

      const defaultIcon = window.L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      window.L.marker([lat, lon], { icon: defaultIcon })
        .bindPopup(`<strong>${user.displayName()}</strong><br/>${user.location() || ''}`)
        .addTo(this.mapInstance);

      setTimeout(() => this.mapInstance && this.mapInstance.invalidateSize(), 200);
    });
  }

  save() {
    this.saving = true;
    const user = this.attrs.user || app.session.user;

    user
      .save({ location: this.locationValue })
      .then(() => {
        this.saving = false;
        app.alerts.show({ type: 'success' }, app.translator.trans('framio-profiles-map.forum.locationSaved'));
        m.redraw();
        setTimeout(() => this.initPersonalMap(), 200);
      })
      .catch(() => {
        this.saving = false;
        m.redraw();
      });
  }
}
