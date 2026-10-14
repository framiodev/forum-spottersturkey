import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import messengerState from '../states/messengerState';

export default class MessagesDropdown extends Component {
  oninit(vnode) {
    super.oninit(vnode);
  }

  view() {
    const unread = messengerState.totalUnread;

    return (
      <div className="DirectMessenger-dropdown" style="display: inline-block; position: relative;">
        <button 
          className="Button Button--flat hasIcon" 
          title="Mesajlar"
          onclick={() => messengerState.toggleDock()}
        >
          <Icon name="fas fa-paper-plane" className="Button-icon" />
          <span className="Button-label">
            <span className="Button-labelText">Mesajlar</span>
          </span>
          {unread > 0 && (
            <span className="DirectMessenger-headerBadge">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </div>
    );
  }
}
