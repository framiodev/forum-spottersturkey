import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import { loadJitsiScript } from '../utils/jitsiLoader';

export default class MeetingModal extends Component {
  oninit(vnode) {
    super.oninit(vnode);

    this.roomName = this.attrs.roomName || `UlasimArsiv-Meeting-${Date.now()}`;
    this.meetingTitle = this.attrs.meetingTitle || 'Toplantı';
    this.isAudioOnly = !!this.attrs.audioOnly;
    this.loading = true;
    this.jitsiApi = null;
    this.isMaximized = false;
  }

  oncreate(vnode) {
    super.oncreate(vnode);
    this.initMeeting();
  }

  onremove(vnode) {
    super.onremove(vnode);
    if (this.jitsiApi) {
      try {
        this.jitsiApi.dispose();
      } catch (e) {}
      this.jitsiApi = null;
    }
  }

  initMeeting() {
    loadJitsiScript().then(JitsiMeetExternalAPI => {
      const container = document.getElementById('MeetingModal-jitsiContainer');
      if (!container) return;

      const currentUser = app.session && app.session.user;
      const displayName = currentUser ? (currentUser.displayName ? currentUser.displayName() : currentUser.username()) : 'Misafir';
      const email = currentUser && currentUser.email ? currentUser.email() : '';
      const avatarUrl = currentUser && currentUser.avatarUrl ? currentUser.avatarUrl() : '';

      const domain = 'meet.jit.si';
      const options = {
        roomName: this.roomName,
        parentNode: container,
        width: '100%',
        height: '100%',
        userInfo: {
          displayName: displayName,
          email: email
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: this.isAudioOnly,
          enableWelcomePage: false,
          prejoinPageEnabled: false,
          prejoinConfig: {
            enabled: false
          },
          enableClosePage: false,
          disableDeepLinking: true,
          toolbarButtons: [
            'camera',
            'chat',
            'desktop', // Screen sharing
            'etherpad',
            'filmstrip',
            'fullscreen',
            'hangup',
            'microphone',
            'participants-pane',
            'profile',
            'raisehand',
            'recording',
            'security',
            'select-background',
            'settings',
            'tileview',
            'toggle-camera',
            'videoquality'
          ]
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: '#0f172a',
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'desktop', 'hangup',
            'profile', 'chat', 'raisehand', 'tileview', 'settings'
          ]
        }
      };

      this.jitsiApi = new JitsiMeetExternalAPI(domain, options);

      // Ensure iframe has necessary WebRTC permissions
      const iframe = container.querySelector('iframe');
      if (iframe) {
        iframe.setAttribute('allow', 'camera *; microphone *; display-capture *; autoplay *; clipboard-write *; screen-wake-lock *; fullscreen *');
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.onload = () => {
          this.loading = false;
          m.redraw();
        };
      }

      // Also set a safety timeout to ensure spinner doesn't block the screen
      setTimeout(() => {
        if (this.loading) {
          this.loading = false;
          m.redraw();
        }
      }, 3000);

      this.jitsiApi.addEventListeners({
        videoConferenceJoined: () => {
          this.loading = false;
          m.redraw();
          if (avatarUrl) {
            this.jitsiApi.executeCommand('avatarUrl', avatarUrl);
          }
        },
        cameraError: () => {
          this.loading = false;
          m.redraw();
        },
        micError: () => {
          this.loading = false;
          m.redraw();
        },
        videoConferenceLeft: () => {
          this.closeModal();
        },
        readyToClose: () => {
          this.closeModal();
        }
      });
    }).catch(err => {
      console.error('Error loading Jitsi API:', err);
      this.loading = false;
      m.redraw();
      alert('Görüntülü toplantı modülü yüklenirken bir sorun oluştu.');
    });
  }

  toggleMaximize() {
    this.isMaximized = !this.isMaximized;
    m.redraw();
  }

  openInNewWindow() {
    const url = `https://meet.jit.si/${encodeURIComponent(this.roomName)}#config.prejoinPageEnabled=false&config.startWithVideoMuted=${this.isAudioOnly}&userInfo.displayName=${encodeURIComponent(app.session && app.session.user ? (app.session.user.displayName ? app.session.user.displayName() : app.session.user.username()) : 'Kullanıcı')}`;
    const w = 980;
    const h = 680;
    const left = (window.screen.width - w) / 2;
    const top = (window.screen.height - h) / 2;
    window.open(url, `Meet_${this.roomName}`, `width=${w},height=${h},top=${top},left=${left},status=no,menubar=no,toolbar=no,location=no,resizable=yes`);
    this.closeModal();
  }

  closeModal() {
    if (this.attrs.onClose) {
      this.attrs.onClose();
    }
  }

  view() {
    return (
      <div className={`MeetingModal-overlay ${this.isMaximized ? 'maximized' : ''}`}>
        <div className="MeetingModal-container">
          {/* Header Bar */}
          <div className="MeetingModal-header">
            <div className="MeetingModal-titleGroup">
              <span className="MeetingModal-liveDot"></span>
              <span className="MeetingModal-title">{this.meetingTitle}</span>
              <span className="MeetingModal-secureBadge">
                <i className="fas fa-shield-alt"></i> SFU Cloud • 30+ Katılımcı
              </span>
            </div>

            <div className="MeetingModal-actions">
              <button 
                type="button"
                className="MeetingModal-actionBtn popout"
                onclick={this.openInNewWindow.bind(this)}
                title="Sınırsız / Bağımsız Pencerede Aç (5 Dk Limiti Yok)"
              >
                <i className="fas fa-external-link-alt"></i>
              </button>
              <button 
                type="button"
                className="MeetingModal-actionBtn"
                onclick={this.toggleMaximize.bind(this)}
                title={this.isMaximized ? 'Küçült' : 'Tam Ekran'}
              >
                <i className={this.isMaximized ? 'fas fa-compress-arrows-alt' : 'fas fa-expand-arrows-alt'}></i>
              </button>
              <button 
                type="button"
                className="MeetingModal-actionBtn close"
                onclick={this.closeModal.bind(this)}
                title="Kapat / Ayrıl"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>

          {/* Jitsi Meeting Body */}
          <div className="MeetingModal-body">
            {this.loading && (
              <div className="MeetingModal-loading">
                <LoadingIndicator />
                <p>Google Meet altyapısına bağlanılıyor...</p>
              </div>
            )}
            <div id="MeetingModal-jitsiContainer" className="MeetingModal-jitsiFrame"></div>
          </div>
        </div>
      </div>
    );
  }
}
