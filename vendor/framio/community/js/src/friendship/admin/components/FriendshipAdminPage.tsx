import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import { getContrastColor } from '../../common';

const BADGE_COLOR_SETTING = 'forumaker-friendship.badge_color';
const BADGE_COLOR_DEFAULT = '#45698D';
const BADGE_BG_COLOR_SETTING = 'forumaker-friendship.badge_bg_color';
const BADGE_BG_COLOR_DEFAULT = '#45698D';
const BADGE_ICON_SETTING = 'forumaker-friendship.badge_icon';
const BADGE_ICON_DEFAULT = 'fas fa-hand-peace';

export default class FriendshipAdminPage extends ExtensionPage {
  content() {
    const colorStream = this.setting(BADGE_COLOR_SETTING, BADGE_COLOR_DEFAULT);
    const bgColorStream = this.setting(BADGE_BG_COLOR_SETTING, BADGE_BG_COLOR_DEFAULT);
    const iconStream = this.setting(BADGE_ICON_SETTING, BADGE_ICON_DEFAULT);

    return (
      <div className="FriendshipAdminPage">
        <div className="container">
        <div className="FriendshipAdminPage-content">
          <div className="FriendshipAdminPage-section">
            <h3>
              <i className="fas fa-user-friends" aria-hidden="true" />
              {app.translator.trans('forumaker-friendship.admin.sections.badges')}
            </h3>
            <p className="helpText">{app.translator.trans('forumaker-friendship.admin.settings.badges_intro')}</p>

            <div className="Form-group">
              {this.buildSettingComponent({
                type: 'boolean',
                setting: 'forumaker-friendship.show_badge_on_usercard',
                label: app.translator.trans('forumaker-friendship.admin.settings.show_badge_on_usercard'),
                help: app.translator.trans('forumaker-friendship.admin.settings.show_badge_on_usercard_help'),
              })}
            </div>
            <div className="Form-group">
              {this.buildSettingComponent({
                type: 'boolean',
                setting: 'forumaker-friendship.show_badge_on_post',
                label: app.translator.trans('forumaker-friendship.admin.settings.show_badge_on_post'),
                help: app.translator.trans('forumaker-friendship.admin.settings.show_badge_on_post_help'),
              })}
            </div>
            <div className="Form-group">
              <label>{app.translator.trans('forumaker-friendship.admin.settings.badge_color')}</label>
              <div className="FriendshipAdminPage-colorRow">
                <input type="color" className="FriendshipAdminPage-colorInput" bidi={colorStream} />
                <input type="text" className="FormControl FriendshipAdminPage-colorHex" bidi={colorStream} />
                <input
                  type="text"
                  className="FormControl FriendshipAdminPage-iconInput"
                  placeholder={BADGE_ICON_DEFAULT}
                  bidi={iconStream}
                />
                <span className="FriendshipAdminPage-iconPreview">
                  <i className={iconStream() || BADGE_ICON_DEFAULT} style={{ color: colorStream() || BADGE_COLOR_DEFAULT }} />
                </span>
              </div>
            </div>
            <div className="Form-group">
              <label>{app.translator.trans('forumaker-friendship.admin.settings.badge_bg_color')}</label>
              <div className="FriendshipAdminPage-colorRow">
                <input type="color" className="FriendshipAdminPage-colorInput" bidi={bgColorStream} />
                <input type="text" className="FormControl FriendshipAdminPage-colorHex" bidi={bgColorStream} />
                <span
                  className="Badge FriendshipAdminPage-bgPreview"
                  style={{
                    background: bgColorStream() || BADGE_BG_COLOR_DEFAULT,
                    color: getContrastColor(bgColorStream() || BADGE_BG_COLOR_DEFAULT),
                  }}
                >
                  <i className={iconStream() || BADGE_ICON_DEFAULT} />
                  <span>9</span>
                </span>
              </div>
            </div>
          </div>

          <div className="FriendshipAdminPage-section">
            <h3>
              <i className="fas fa-history" aria-hidden="true" />
              {app.translator.trans('forumaker-friendship.admin.sections.history')}
            </h3>
            <p className="helpText">{app.translator.trans('forumaker-friendship.admin.settings.event_retention_intro')}</p>

            <div className="Form-group">
              {this.buildSettingComponent({
                setting: 'forumaker-friendship.event_retention_days',
                label: app.translator.trans('forumaker-friendship.admin.settings.event_retention_days'),
                help: app.translator.trans('forumaker-friendship.admin.settings.event_retention_days_help'),
                type: 'number',
                min: 0,
                default: 90,
              })}
            </div>
          </div>

          <div className="Form-group">{this.submitButton()}</div>
        </div>{/* FriendshipAdminPage-content */}
        </div>{/* container */}
      </div>
    );
  }
}
