import Extend from 'flarum/common/extenders';
import app from 'flarum/admin/app';
import withAttr from 'flarum/common/utils/withAttr';
import formatBytes from '../common/formatBytes';

export default [
  new Extend.Admin('framio-profiles:profile-cover')
    .setting(() => ({
      setting: 'sycho-profile-cover.thumbnails',
      type: 'boolean',
      label: app.translator.trans('sycho-profile-cover.admin.thumbnails'),
    }))
    .customSetting(function () {
      const maxSize = this.setting('sycho-profile-cover.max_size', 2048);

      return (
        <div className="Form-group">
          <label>{app.translator.trans('sycho-profile-cover.admin.max_size')}</label>
          <div className="ProfileCover-size-input">
            <input type="number" className="FormControl" value={maxSize()} oninput={withAttr('value', maxSize)} />
            <input className="FormControl" value={formatBytes(maxSize() * Math.pow(2, 10))} disabled />
          </div>
        </div>
      );
    })
    .permission(
      () => ({
        icon: 'fas fa-image',
        label: app.translator.trans('sycho-profile-cover.admin.permission.set_cover'),
        permission: 'setProfileCover',
      }),
      'start'
    ),
];
