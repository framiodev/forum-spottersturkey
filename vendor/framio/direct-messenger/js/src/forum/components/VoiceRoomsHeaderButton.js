import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';

export default class VoiceRoomsHeaderButton extends Component {
  oninit(vnode) {
    super.oninit(vnode);
  }

  view() {
    const widget = app.voiceRoomsWidget;
    const isConnected = widget && widget.activeRoomId;
    const isOpen = widget && widget.isOpen;
    const activeRoom = widget && widget.activeRoomData;
    const roomName = activeRoom && activeRoom.attributes ? activeRoom.attributes.name : '';

    return (
      <div className="VoiceRooms-headerDropdown" style="display: inline-block; position: relative;">
        <button 
          className={`Button Button--flat hasIcon VoiceRooms-headerBtn ${isConnected ? 'connected' : ''} ${isOpen ? 'open' : ''}`} 
          title={isConnected ? `Ses Bağlı: ${roomName}` : 'Topluluk Odaları'}
          onclick={() => {
            if (app.voiceRoomsWidget) {
              app.voiceRoomsWidget.togglePanel();
            }
          }}
        >
          <Icon name={isConnected ? 'fas fa-volume-up' : 'fas fa-headset'} className="Button-icon" />
          <span className="Button-label">
            <span className="Button-labelText">Topluluk Odaları</span>
          </span>
          {isConnected && (
            <span className="VoiceRooms-headerConnectedDot" title="Ses kanalına bağlı"></span>
          )}
        </button>
      </div>
    );
  }
}
