import app from 'flarum/forum/app';

class MessengerState {
  constructor() {
    this.isDockOpen = false; // Is the Messenger conversation list popup open?
    this.activeConversationId = null; // Currently open floating chat window ID
    this.minimized = false; // Is the active chat window collapsed into a floating head?
    this.conversations = [];
    this.loadingConversations = false;
    this.totalUnread = 0;
    this.searchQuery = '';
    this.pollInterval = null;

    // Active Meeting State
    this.activeMeeting = null; // { roomName, meetingTitle, audioOnly }
  }

  startMeeting(roomName, meetingTitle, audioOnly = false) {
    const finalRoom = roomName || `UlasimArsiv-Room-${Date.now()}`;
    const user = app.session && app.session.user;
    const displayName = user ? (user.displayName ? user.displayName() : user.username()) : 'Kullanıcı';
    
    // Open dedicated, unlimited window (Google Meet style application popup)
    // We pass both prejoinConfig.enabled=false and quoted/encoded userInfo.displayName for Jitsi
    const params = [
      'config.prejoinConfig.enabled=false',
      'config.prejoinPageEnabled=false',
      `config.startWithVideoMuted=${!!audioOnly}`,
      `userInfo.displayName=${encodeURIComponent('"' + displayName + '"')}`
    ].join('&');

    const url = `https://meet.jit.si/${encodeURIComponent(finalRoom)}#${params}`;
    const w = 1000;
    const h = 700;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    
    window.open(
      url, 
      `Meet_${finalRoom}`, 
      `width=${w},height=${h},top=${top},left=${left},status=no,menubar=no,toolbar=no,location=no,resizable=yes,scrollbars=no`
    );
  }

  closeMeeting() {
    this.activeMeeting = null;
    m.redraw();
  }

  init() {
    this.fetchConversations();
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.fetchConversations(false);
    }, 15000);
  }

  toggleDock() {
    this.isDockOpen = !this.isDockOpen;
    if (this.isDockOpen) {
      this.fetchConversations();
    }
    m.redraw();
  }

  openDock() {
    this.isDockOpen = true;
    this.fetchConversations();
    m.redraw();
  }

  closeDock() {
    this.isDockOpen = false;
    m.redraw();
  }

  openConversation(conversationId) {
    this.activeConversationId = conversationId;
    this.minimized = false;
    this.isDockOpen = false; // Close the list dock when conversation opens, like Facebook
    m.redraw();
  }

  backToList() {
    this.activeConversationId = null;
    this.minimized = false;
    this.isDockOpen = true;
    this.fetchConversations(false);
    m.redraw();
  }

  openWithUser(user) {
    if (!user || !app.session || !app.session.user) return;
    const currentUserId = String(app.session.user.id());
    const targetUserId = typeof user.id === 'function' ? String(user.id()) : String(user.id);

    if (targetUserId === currentUserId) {
      alert('Kendinize mesaj gönderemezsiniz.');
      return;
    }

    // Create or find 1-to-1 conversation
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/conversations',
      body: {
        data: {
          attributes: {
            recipientId: targetUserId,
            recipientIds: [targetUserId]
          }
        }
      }
    }).then(response => {
      if (response && response.data) {
        this.fetchConversations(false);
        this.openConversation(response.data.id);
      }
    }).catch(err => {
      console.error('Error starting conversation with user:', err);
      alert('Sohbet başlatılırken bir hata oluştu.');
    });
  }

  closeConversation() {
    this.activeConversationId = null;
    this.minimized = false;
    m.redraw();
  }

  toggleMinimize() {
    this.minimized = !this.minimized;
    m.redraw();
  }

  fetchConversations(showLoading = true) {
    if (!app.session || !app.session.user) return;
    if (showLoading) this.loadingConversations = true;

    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/conversations?filter[is_archived]=false'
    }).then(response => {
      if (response && response.data) {
        this.conversations = response.data;
        let unread = 0;
        response.data.forEach(c => {
          if (c.attributes && c.attributes.unreadCount) {
            unread += c.attributes.unreadCount;
          }
        });
        this.totalUnread = unread;
      }
      this.loadingConversations = false;
      m.redraw();
    }).catch(() => {
      this.loadingConversations = false;
    });
  }
}

const messengerState = new MessengerState();
export default messengerState;
