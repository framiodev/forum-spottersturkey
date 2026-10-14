import { extend as flarumExtend } from 'flarum/common/extend';
import app from 'flarum/admin/app';
import Extend from 'flarum/common/extenders';
import AdminNav from 'flarum/admin/components/AdminNav';
import LinkButton from 'flarum/common/components/LinkButton';
import PackageManagerPage from './components/PackageManagerPage';

export const extend = [
  new Extend.Admin().page(PackageManagerPage),
];

app.initializers.add('framio-package-manager', () => {
  flarumExtend(AdminNav.prototype, 'items', function (items) {
    items.add(
      'framio-package-manager',
      LinkButton.component(
        {
          href: app.route('extension', { id: 'framio-package-manager' }),
          icon: 'fas fa-cubes',
        },
        'Paket Yöneticisi'
      ),
      75
    );
  });
});
