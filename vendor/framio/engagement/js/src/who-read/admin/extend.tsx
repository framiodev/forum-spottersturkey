import Extend from 'flarum/common/extenders';
import app from 'flarum/admin/app';
import Switch from 'flarum/common/components/Switch';
import Group from 'flarum/common/models/Group';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';

const settingsPrefix = 'who-read.';
const translationPrefix = 'clarkwinkelmann-who-read.admin.settings.';

export default [
  new Extend.Admin('framio-engagement:who-read')
    .customSetting(function (this: ExtensionPage) {
      const groupsValue = (this.setting(settingsPrefix + 'onlyGroups', '')() as string).split(',').filter((value) => parseInt(value) > 0);

      return [
        <div className="Form-group">
          {Switch.component(
            {
              state: this.setting(settingsPrefix + 'showInDiscussionList', '1')() === '1',
              onchange: (value: boolean) => {
                this.setting(settingsPrefix + 'showInDiscussionList')(value ? '1' : '0');
              },
            },
            app.translator.trans(translationPrefix + 'show-in-discussion-list')
          )}
        </div>,
        <div className="Form-group">
          {Switch.component(
            {
              state: this.setting(settingsPrefix + 'showInHero', '1')() === '1',
              onchange: (value: boolean) => {
                this.setting(settingsPrefix + 'showInHero')(value ? '1' : '0');
              },
            },
            app.translator.trans(translationPrefix + 'show-in-hero')
          )}
        </div>,
        <div className="Form-group">
          {Switch.component(
            {
              state: this.setting(settingsPrefix + 'showBetweenPosts', '1')() === '1',
              onchange: (value: boolean) => {
                this.setting(settingsPrefix + 'showBetweenPosts')(value ? '1' : '0');
              },
            },
            app.translator.trans(translationPrefix + 'show-between-posts')
          )}
        </div>,
        <div className="Form-group">
          {Switch.component(
            {
              state: this.setting(settingsPrefix + 'showCountOfReadersWhoStopped')() === '1',
              onchange: (value: boolean) => {
                this.setting(settingsPrefix + 'showCountOfReadersWhoStopped')(value ? '1' : '0');
              },
            },
            app.translator.trans(translationPrefix + 'show-count-of-readers-who-stopped')
          )}
        </div>,
        <div className="Form-group">
          <label>{app.translator.trans(translationPrefix + 'hide-when-behind')}</label>
          <input
            className="FormControl"
            type="number"
            bidi={this.setting(settingsPrefix + 'hideWhenBehind')}
            min={0}
          />
        </div>,
        <div className="Form-group">
          <label>{app.translator.trans(translationPrefix + 'max-visible')}</label>
          <input
            className="FormControl"
            type="number"
            bidi={this.setting(settingsPrefix + 'maxVisible', '10')}
            min={0}
          />
        </div>,
        <div className="Form-group">
          <label>{app.translator.trans(translationPrefix + 'unread-icon')}</label>
          <input
            className="FormControl"
            type="text"
            bidi={this.setting(settingsPrefix + 'unreadIcon')}
            placeholder="fas fa-eye-dash"
          />
        </div>,
        <div className="Form-group">
          <label>{app.translator.trans(translationPrefix + 'only-groups')}</label>
          {app.store
            .all<Group>('groups')
            .filter((group) => group.id() !== Group.MEMBER_ID && group.id() !== Group.GUEST_ID)
            .map((group) =>
              Switch.component(
                {
                  state: groupsValue.indexOf(group.id()!) !== -1,
                  onchange: (checked: boolean) => {
                    let newValue: string[];

                    if (checked) {
                      newValue = [...groupsValue, group.id()!];
                    } else {
                      newValue = groupsValue.filter((v) => v !== group.id());
                    }

                    this.setting(settingsPrefix + 'onlyGroups')(newValue.join(','));
                  },
                },
                group.nameSingular()
              )
            )}
        </div>,
      ];
    })
    .permission(
      () => ({
        icon: 'fas fa-book-reader',
        label: app.translator.trans('clarkwinkelmann-who-read.admin.permissions.see-read'),
        permission: 'who-read.seeRead',
        allowGuest: true,
      }),
      'view'
    )
    .permission(
      () => ({
        icon: 'fas fa-book-reader',
        label: app.translator.trans('clarkwinkelmann-who-read.admin.permissions.see-subscription'),
        permission: 'who-read.seeSubscription',
        allowGuest: true,
      }),
      'view'
    )
    .permission(
      () => ({
        icon: 'fas fa-book-reader',
        label: app.translator.trans('clarkwinkelmann-who-read.admin.permissions.see-unread'),
        permission: 'who-read.seeUnread',
        allowGuest: true,
      }),
      'view'
    )
    .permission(
      () => ({
        icon: 'fas fa-book-reader',
        label: app.translator.trans('clarkwinkelmann-who-read.admin.permissions.mark-unread'),
        permission: 'who-read.markUnread',
      }),
      'reply'
    ),
];
