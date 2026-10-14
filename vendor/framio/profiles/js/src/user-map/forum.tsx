import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Model from 'flarum/common/Model';
import User from 'flarum/common/models/User';
import SettingsPage from 'flarum/forum/components/SettingsPage';
import LinkButton from 'flarum/common/components/LinkButton';
import IndexPage from 'flarum/forum/components/IndexPage';
import LocationSettings from './components/LocationSettings';
import StandaloneMapPage from './components/StandaloneMapPage';

export function initUserMapForum() {
  const UserModel = (User as any)?.prototype ? User : ((app.store as any)?.models?.users as any);
  if (UserModel?.prototype) {
    UserModel.prototype.location = Model.attribute('location');
    UserModel.prototype.mapLat = Model.attribute('mapLat');
    UserModel.prototype.mapLon = Model.attribute('mapLon');
  }

  app.routes['members.map'] = {
    path: '/map',
    component: StandaloneMapPage,
  };

  // Navigasyon menüsüne Harita bağlantısı ekleme
  const IndexPageComponent: any =
    IndexPage ||
    (window as any).flarum?.core?.compat?.['forum/components/IndexPage'] ||
    (window as any).flarum?.core?.compat?.['forum/pages/IndexPage'];
  if (IndexPageComponent?.prototype) {
    extend(IndexPageComponent.prototype, 'navItems', function (items) {
      items.add(
        'members-map',
        <LinkButton href={app.route('members.map')} icon="fas fa-map-marked-alt">
          {app.translator.trans('framio-profiles-map.forum.nav_tab')}
        </LinkButton>,
        15
      );
    });
  }

  // Masquerade varsa oraya ekleyelim
  const masquerade = (window as any).flarum?.extensions?.['fof-masquerade'] || (window as any).flarum?.extensions?.['framio-profiles'];
  if (masquerade?.panes?.ProfileConfigurePane?.prototype) {
    extend(masquerade.panes.ProfileConfigurePane.prototype, 'view', function (this: any, vnode: any) {
      if (app.forum?.attribute?.('framioProfilesMap.useMasquerade') !== false) {
        vnode.children.push(<LocationSettings user={this.attrs.user} />);
      }
    });
  }

  // Standart Ayarlar Sayfasına ekleme (Masquerade kapalıysa veya fallback olarak)
  const SettingsPageComponent: any =
    SettingsPage ||
    (window as any).flarum?.core?.compat?.['forum/components/SettingsPage'] ||
    (window as any).flarum?.core?.compat?.['forum/pages/SettingsPage'];
  if (SettingsPageComponent?.prototype) {
    extend(SettingsPageComponent.prototype, 'settingsItems', function (items) {
      if (app.forum?.attribute?.('framioProfilesMap.useMasquerade') === false || !masquerade?.panes?.ProfileConfigurePane?.prototype) {
        items.add('user-map-location', <LocationSettings />, 75);
      }
    });
  }
}
