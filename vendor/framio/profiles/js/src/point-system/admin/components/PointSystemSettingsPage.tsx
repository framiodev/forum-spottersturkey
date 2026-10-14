// @ts-nocheck
import Component from 'flarum/common/Component';
import app from 'flarum/admin/app';
import PointsRulesPanel from './PointsRulesPanel';
import UsersPointsPanel from './UsersPointsPanel';
import AvatarDecorationsPanel from './AvatarDecorationsPanel';
import NameDecorationsPanel from './NameDecorationsPanel';
import CoverDecorationsPanel from './CoverDecorationsPanel';
import TitleDecorationsPanel from './TitleDecorationsPanel';
import PostHighlightDecorationsPanel from './PostHighlightDecorationsPanel';
import GroupOffersPanel from './GroupOffersPanel';
import ManualAwardPanel from './ManualAwardPanel';
import PendingSubmissionsPanel from './PendingSubmissionsPanel';
import AllTradesPanel from './AllTradesPanel';

export default class PointSystemSettingsPage extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.currentTab = 'rules';
  }

  content() {
    const tab = this.currentTab;

    let child;
    switch (tab) {
      case 'users':
        child = <UsersPointsPanel />;
        break;
      case 'avatar':
        child = <AvatarDecorationsPanel />;
        break;
      case 'name':
        child = <NameDecorationsPanel />;
        break;
      case 'cover':
        child = <CoverDecorationsPanel />;
        break;
      case 'title':
        child = <TitleDecorationsPanel />;
        break;
      case 'post-hl':
        child = <PostHighlightDecorationsPanel />;
        break;
      case 'groups':
        child = <GroupOffersPanel />;
        break;
      case 'manual':
        child = <ManualAwardPanel />;
        break;
      case 'submissions':
        child = <PendingSubmissionsPanel />;
        break;
      case 'all-trades':
        child = <AllTradesPanel />;
        break;
      default:
        child = <PointsRulesPanel page={this} />;
    }

    const links: Array<[string, string, string]> = [
      ['rules', 'fas fa-sliders-h', 'rules'],
      ['users', 'fas fa-users', 'users'],
      ['avatar', 'fas fa-user-circle', 'avatar'],
      ['name', 'fas fa-font', 'name'],
      ['cover', 'fas fa-image', 'cover'],
      ['title', 'fas fa-id-badge', 'title'],
      ['post-hl', 'fas fa-highlighter', 'post_hl'],
      ['groups', 'fas fa-layer-group', 'groups'],
      ['manual', 'fas fa-hand-holding-usd', 'manual'],
      ['submissions', 'fas fa-inbox', 'submissions'],
      ['all-trades', 'fas fa-handshake', 'all_trades'],
    ];

    return (
      <div className="ExtensionPage-settings PointSystemAdmin">
        <nav className="PointSystemAdminNav" style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 20px;">
          {links.map(([subTab, icon, key]) => (
            <button
              type="button"
              key={subTab}
              className={'Button ' + (this.currentTab === subTab ? 'Button--primary' : '')}
              style="font-size: 13px; padding: 6px 12px;"
              onclick={() => {
                this.currentTab = subTab;
                m.redraw();
              }}
            >
              <i className={icon} style="margin-right: 6px;" />
              <span>{app.translator.trans('ramon-point-system.admin.tabs.' + key)}</span>
            </button>
          ))}
        </nav>
        <div className="container PointSystemAdmin-body">{child}</div>
      </div>
    );
  }

  view() {
    return this.content();
  }
}
