import app from 'flarum/forum/app';
import Page from 'flarum/common/components/Page';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import ItemList from 'flarum/common/utils/ItemList';
import NewConversationModal from './NewConversationModal';
import Peer from 'peerjs';

export default class MessagesPage extends Page {
  oninit(vnode) {
    super.oninit(vnode);

    this.conversations = [];
    this.loadingConversations = true;
    this.activeConversationId = null;
    this.activeTab = 'all'; // 'all', 'starred', 'archived'
    
    this.messages = [];
    this.loadingMessages = false;
    this.newMessageContent = '';
    this.replyToMessage = null;
    this.editingMessage = null;
    
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    
    this.hoveredMessageId = null;
    this.showingStarred = false;
    this.starredMessages = [];
    this.searchQuery = '';
    this.pollInterval = null;
    this.showEmojiPicker = false;
    
    // Call States
    this.peer = null;
    this.incomingCall = null;
    this.activeCall = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isVideoCall = false;
    
    app.setTitle('Mesajlar');

    if (m.route.param('starred')) {
      this.loadStarredMessages();
    } else {
      this.loadConversations();
    }
    this.initPeerJS();
    this.startPolling();
  }

  onremove() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      if (this.activeConversationId && !this.loadingMessages) {
        this.pollNewMessages();
      }
    }, 3500);
  }

  pollNewMessages() {
    if (!this.activeConversationId) return;
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/messages?id=' + this.activeConversationId
    }).then(response => {
      if (response && response.data) {
        if (response.data.length !== this.messages.length) {
          const container = document.getElementById('DirectMessenger-messagesList');
          const isAtBottom = container ? (container.scrollHeight - container.scrollTop <= container.clientHeight + 80) : true;
          this.messages = response.data;
          m.redraw();
          if (isAtBottom) {
            this.scrollToBottom();
          }
        }
      }
    }).catch(() => {});
  }

  initPeerJS() {
    if (!app.session.user) return;
    this.peer = new Peer(`spotters-user-${app.session.user.id()}`);
    this.peer.on('call', call => {
      this.incomingCall = call;
      m.redraw();
    });
  }

  startCall(isVideo) {
    const activeConv = this.conversations.find(c => c.id === this.activeConversationId);
    if (!activeConv || activeConv.attributes.isGroup) {
      alert("Grup aramaları yakında eklenecek.");
      return;
    }
    
    const myId = app.session.user.id();
    const otherUser = activeConv.relationships.users.data.find(u => String(u.id) !== String(myId));
    if (!otherUser) return;
    
    this.isVideoCall = isVideo;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Güvenlik engeli: Tarayıcınız HTTPS olmadığı için kamera ve mikrofon kullanımına izin vermiyor. Lütfen siteyi localhost üzerinden veya SSL (HTTPS) ile açarak tekrar deneyin.");
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true })
      .then(stream => {
        this.localStream = stream;
        const call = this.peer.call(`spotters-user-${otherUser.id}`, stream);
        this.activeCall = call;
        this.setupCallEvents(call);
        m.redraw();
      })
      .catch(err => {
        alert("Kamera/Mikrofon erişimi reddedildi veya bulunamadı.");
      });
  }

  answerCall() {
    if (!this.incomingCall) return;
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Güvenlik engeli: Tarayıcınız HTTPS olmadığı için kamera ve mikrofon kullanımına izin vermiyor.");
      return;
    }

    // As a simple heuristic, request video if we think it's a video call, but for simplicity request both
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        this.localStream = stream;
        this.incomingCall.answer(stream);
        this.activeCall = this.incomingCall;
        this.incomingCall = null;
        this.isVideoCall = true; // Assumed video if we request video
        this.setupCallEvents(this.activeCall);
        m.redraw();
      }).catch(err => {
        // Fallback to audio only if video fails
        navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then(stream => {
           this.localStream = stream;
           this.incomingCall.answer(stream);
           this.activeCall = this.incomingCall;
           this.incomingCall = null;
           this.isVideoCall = false;
           this.setupCallEvents(this.activeCall);
           m.redraw();
        }).catch(e => alert("Mikrofon erişimi reddedildi."));
      });
  }

  rejectCall() {
    if (this.incomingCall) {
      this.incomingCall.close();
      this.incomingCall = null;
      m.redraw();
    }
  }

  setupCallEvents(call) {
    call.on('stream', remoteStream => {
      this.remoteStream = remoteStream;
      m.redraw();
      
      // Auto-play the streams once they arrive
      setTimeout(() => {
        const remoteVideo = document.getElementById('DirectMessenger-remoteVideo');
        if (remoteVideo) remoteVideo.srcObject = remoteStream;
        
        const localVideo = document.getElementById('DirectMessenger-localVideo');
        if (localVideo) localVideo.srcObject = this.localStream;
      }, 500);
    });
    
    call.on('close', () => {
      this.endCall(false);
    });
  }

  endCall(closeConnection = true) {
    if (this.activeCall && closeConnection) {
      this.activeCall.close();
    }
    this.activeCall = null;
    this.remoteStream = null;
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    m.redraw();
  }

  loadConversations() {
    this.loadingConversations = true;
    m.redraw();
    
    let url = app.forum.attribute('apiUrl') + '/conversations';
    if (this.activeTab === 'archived') {
      url += '?filter[is_archived]=true';
    } else if (this.activeTab === 'starred') {
      url += '?filter[is_starred]=true';
    } else {
      url += '?filter[is_archived]=false';
    }

    app.request({
      method: 'GET',
      url: url
    }).then(response => {
      this.conversations = response.data;
      this.loadingConversations = false;
      m.redraw();
    });
  }

  loadMessages(id) {
    this.activeConversationId = id;
    this.showingStarred = false;
    this.loadingMessages = true;
    this.messages = [];
    m.redraw();
    
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/messages?id=' + id
    }).then(response => {
      this.messages = response.data;
      this.loadingMessages = false;
      m.redraw();
      this.scrollToBottom();
    });
  }

  loadStarredMessages() {
    this.activeConversationId = null;
    this.showingStarred = true;
    this.loadingMessages = true;
    this.messages = [];
    m.redraw();

    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/starred-messages'
    }).then(response => {
      this.messages = response.data;
      this.loadingMessages = false;
      m.redraw();
    });
  }

  scrollToBottom() {
    setTimeout(() => {
      const container = document.getElementById('DirectMessenger-messagesList');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Güvenlik nedeniyle (HTTPS eksikliği) tarayıcınız mikrofon erişimini engelliyor. Lütfen siteye http://localhost/... adresinden girin veya SSL sertifikası kurun.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        this.isRecording = true;
        this.audioChunks = [];
        this.mediaRecorder = new MediaRecorder(stream);
        this.mediaRecorder.addEventListener("dataavailable", event => {
          this.audioChunks.push(event.data);
        });
        this.mediaRecorder.addEventListener("stop", () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.uploadMedia(audioBlob, 'audio');
          stream.getTracks().forEach(track => track.stop());
        });
        this.mediaRecorder.start();
        m.redraw();
      })
      .catch(err => {
        alert('Mikrofon erişimi reddedildi: ' + err);
      });
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      m.redraw();
    }
  }

  triggerImageUpload() {
    document.getElementById('DirectMessenger-fileInput').click();
  }

  handleImageSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    this.uploadMedia(file, 'image');
    e.target.value = ''; // Reset input
  }

  uploadMedia(fileBlob, type) {
    if (!this.activeConversationId) return;
    
    const formData = new FormData();
    formData.append('data[attributes][conversationId]', this.activeConversationId);
    formData.append('data[attributes][type]', type);
    formData.append('media', fileBlob);

    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/messages',
      serialize: data => data, // Prevent Mithril from turning FormData into JSON string
      body: formData
    }).then(response => {
      this.messages.push(response.data);
      m.redraw();
      this.scrollToBottom();
    }).catch(err => {
      alert("Dosya yüklenirken bir hata oluştu.");
    });
  }

  showNewConversationModal() {
    app.modal.show(NewConversationModal, {
      onConversationCreated: (id) => {
        this.loadConversations();
        this.loadMessages(id);
      }
    });
  }

  sendMessage() {
    if (!this.newMessageContent.trim() || !this.activeConversationId) return;
    
    const content = this.newMessageContent;
    this.newMessageContent = '';
    
    if (this.editingMessage) {
      // Düzenleme işlemi
      app.request({
        method: 'PATCH',
        url: app.forum.attribute('apiUrl') + '/messages/' + this.editingMessage.id,
        body: { data: { attributes: { content: content } } }
      }).then(response => {
        const index = this.messages.findIndex(m => m.id === response.data.id);
        if (index !== -1) {
          this.messages[index] = response.data;
        }
        this.editingMessage = null;
        m.redraw();
      });
      return;
    }
    
    const payload = {
      data: {
        attributes: {
          conversationId: this.activeConversationId,
          content: content,
          type: 'text'
        }
      }
    };
    
    if (this.replyToMessage) {
      payload.data.attributes.replyToMessageId = this.replyToMessage.id;
    }
    
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/messages',
      body: payload
    }).then(response => {
      this.messages.push(response.data);
      this.replyToMessage = null;
      m.redraw();
      this.scrollToBottom();
    });
  }

  deleteMessage(msg, e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (confirm('Bu mesajı silmek istediğinize emin misiniz?')) {
      app.request({
        method: 'DELETE',
        url: app.forum.attribute('apiUrl') + '/messages/' + msg.id
      }).then(response => {
        const index = this.messages.findIndex(m => m.id === response.data.id);
        if (index !== -1) {
          this.messages[index] = response.data;
        }
        m.redraw();
      });
    }
  }

  updateConversationState(id, data) {
    app.request({
      method: 'PATCH',
      url: app.forum.attribute('apiUrl') + '/conversations/' + id + '/state',
      body: { data: { attributes: data } }
    }).then(response => {
      this.loadConversations();
    });
  }

  deleteConversation(id) {
    if (confirm('Bu sohbeti silmek istediğinize emin misiniz? Eğer karşı taraf mesaj atarsa sohbet yeniden görünür.')) {
      app.request({
        method: 'PATCH',
        url: app.forum.attribute('apiUrl') + '/conversations/' + id + '/state',
        body: { data: { attributes: { isDeleted: true } } }
      }).then(response => {
        if (this.activeConversationId === id) {
          this.activeConversationId = null;
          this.messages = [];
        }
        this.loadConversations();
      });
    }
  }

  starMessage(msg) {
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/messages/' + msg.id + '/star'
    }).then(response => {
      const index = this.messages.findIndex(m => m.id === response.data.id);
      if (index !== -1) {
        this.messages[index] = response.data;
      }
      m.redraw();
    });
  }

  view() {
    const hasActiveChat = Boolean(this.activeConversationId || this.showingStarred);
    const filteredConversations = this.conversations.filter(conv => {
      if (!this.searchQuery.trim()) return true;
      const title = conv.attributes && conv.attributes.title ? conv.attributes.title.toLowerCase() : '';
      return title.includes(this.searchQuery.toLowerCase().trim());
    });

    return (
      <div className={`DirectMessenger-page ${hasActiveChat ? 'has-active-chat' : ''}`}>
        {/* Sol Menü: Konuşmalar Listesi */}
        <div className="DirectMessenger-sidebar">
          <div className="DirectMessenger-header">
            <h2 className="DirectMessenger-headerTitle">{app.session.user ? app.session.user.username() : 'Mesajlar'}</h2>
            <div>
              <button 
                className={`Button Button--icon Button--link ${this.showingStarred ? 'active' : ''}`} 
                style={`color: ${this.showingStarred ? '#fadb14' : 'var(--dm-text)'}; margin-right: 6px;`} 
                onclick={() => {
                  if (this.showingStarred) {
                    this.showingStarred = false;
                    this.activeConversationId = null;
                    this.messages = [];
                    m.redraw();
                  } else {
                    this.loadStarredMessages();
                  }
                }} 
                title="Yıldızlı Mesajlar">
                <i className={this.showingStarred ? "fas fa-star" : "far fa-star"} style="font-size: 17px;"></i>
              </button>
              <button 
                className="Button Button--icon Button--link" 
                style="color: var(--dm-text);" 
                onclick={this.showNewConversationModal.bind(this)} 
                title="Yeni Mesaj">
                <i className="far fa-edit" style="font-size: 17px;"></i>
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="DirectMessenger-searchBox">
            <div className="DirectMessenger-searchInputWrapper">
              <i className="fas fa-search" style="color: var(--dm-text-subtle); font-size: 13px;"></i>
              <input 
                type="text" 
                className="DirectMessenger-searchInput" 
                placeholder="Sohbetlerde veya kişilerde ara..." 
                value={this.searchQuery}
                oninput={e => this.searchQuery = e.target.value}
              />
              {this.searchQuery && (
                <button className="Button Button--icon Button--link" style="padding: 2px; color: var(--dm-text-subtle);" onclick={() => this.searchQuery = ''}>
                  <i className="fas fa-times-circle" style="font-size: 13px;"></i>
                </button>
              )}
            </div>
          </div>

          <div className="DirectMessenger-tabs">
            <button 
              className={`DirectMessenger-tabItem ${this.activeTab === 'all' ? 'active' : ''}`}
              onclick={() => { this.activeTab = 'all'; this.loadConversations(); }}
            >Tümü</button>
            <button 
              className={`DirectMessenger-tabItem ${this.activeTab === 'starred' ? 'active' : ''}`}
              onclick={() => { this.activeTab = 'starred'; this.loadConversations(); }}
            >Yıldızlı</button>
            <button 
              className={`DirectMessenger-tabItem ${this.activeTab === 'archived' ? 'active' : ''}`}
              onclick={() => { this.activeTab = 'archived'; this.loadConversations(); }}
            >Arşiv</button>
          </div>
          
          <div className="DirectMessenger-conversations">
            {this.loadingConversations ? <LoadingIndicator /> : (
              filteredConversations.length === 0 ? (
                <div style="padding: 30px 20px; text-align: center; color: var(--dm-text-muted); font-size: 13.5px;">
                  {this.searchQuery ? 'Aramanızla eşleşen sohbet bulunamadı.' : 'Henüz bir sohbetiniz bulunmuyor.'}
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const isActive = conv.id === this.activeConversationId;
                  const isStarred = conv.attributes.isStarred;
                  const isArchived = conv.attributes.isArchived;
                  const isGroup = conv.attributes.isGroup;
                  const unreadCount = conv.attributes.unreadCount || 0;
                  const snippet = conv.attributes.lastMessageSnippet || 'Sohbet başlatıldı.';
                  const time = conv.attributes.lastMessageCreatedAt 
                    ? new Date(conv.attributes.lastMessageCreatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
                    : (conv.attributes.updatedAt ? new Date(conv.attributes.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '');

                  let actionItems = new ItemList();
                  actionItems.add('star', <button className="DirectMessenger-dropdownItem" onclick={(e) => { e.stopPropagation(); this.updateConversationState(conv.id, { isStarred: !isStarred }); }}><i className={isStarred ? "fas fa-star" : "far fa-star"}></i> {isStarred ? 'Yıldızı Kaldır' : 'Yıldızla'}</button>);
                  actionItems.add('archive', <button className="DirectMessenger-dropdownItem" onclick={(e) => { e.stopPropagation(); this.updateConversationState(conv.id, { isArchived: !isArchived }); }}><i className="fas fa-archive"></i> {isArchived ? 'Arşivden Çıkar' : 'Arşivle'}</button>);
                  actionItems.add('separator', <div className="Dropdown-separator"></div>);
                  actionItems.add('delete', <button className="DirectMessenger-dropdownItem danger" onclick={(e) => { e.stopPropagation(); this.deleteConversation(conv.id); }}><i className="fas fa-trash"></i> Sil</button>);

                  return (
                    <div 
                      className={`DirectMessenger-conversation ${isActive ? 'active' : ''}`}
                      onclick={(e) => {
                        if (e.target.closest('.DirectMessenger-convAction')) return;
                        this.loadMessages(conv.id);
                      }}
                    >
                      <div className="DirectMessenger-convAvatar">
                        {isGroup ? (
                          <div style="width: 100%; height: 100%; background: #e0f2fe; display: flex; justify-content: center; align-items: center; color: #0284c7;">
                            <i className="fas fa-users" style="font-size: 22px;"></i>
                          </div>
                        ) : (
                          conv.attributes.avatarUrl ? <img src={conv.attributes.avatarUrl} style="width: 100%; height: 100%; object-fit: cover;" /> : <i className="fas fa-user" style="color: #fff; font-size: 20px; line-height: 50px; display: block; text-align: center;"></i>
                        )}
                      </div>
                      
                      <div className="DirectMessenger-convMeta">
                        <div className="DirectMessenger-convTitleRow">
                          <span className="DirectMessenger-convTitle">
                            {conv.attributes.title}
                            {isStarred && <i className="fas fa-star" style="color: #fadb14; margin-left: 5px; font-size: 11px;"></i>}
                          </span>
                          <span className="DirectMessenger-convTime">{time}</span>
                        </div>
                        <div className="DirectMessenger-convSnippetRow">
                          <span className="DirectMessenger-convSnippet" style={unreadCount > 0 ? 'font-weight: 600; color: var(--dm-text);' : ''}>
                            {snippet}
                          </span>
                          {unreadCount > 0 && (
                            <span className="DirectMessenger-unreadBadge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                          )}
                        </div>
                      </div>

                      <div style="margin-left: 8px;" className="DirectMessenger-convAction">
                        <Dropdown
                          buttonClassName="Button Button--icon Button--flat"
                          menuClassName="Dropdown-menu--right DirectMessenger-dropdownMenu"
                          icon="fas fa-ellipsis-v"
                        >
                          {actionItems.toArray()}
                        </Dropdown>
                      </div>
                    </div>
                  )
                })
              )
            )}
          </div>
        </div>

        {/* Sağ Menü: Sohbet Ekranı */}
        <div className="DirectMessenger-chatArea">
          {!this.activeConversationId && !this.showingStarred ? (
            <div style="flex: 1; display: flex; justify-content: center; align-items: center; flex-direction: column; padding: 20px; text-align: center;">
              <div style="width: 100px; height: 100px; border-radius: 50%; background: var(--dm-bg-hover); display: flex; align-items: center; justify-content: center; margin-bottom: 24px; box-shadow: var(--dm-shadow-sm);">
                <i className="far fa-paper-plane" style="font-size: 46px; color: #0284c7;"></i>
              </div>
              <h2 style="margin: 0 0 8px 0; font-weight: 700; color: var(--dm-text); font-size: 22px;">Mesajlarınız</h2>
              <p style="color: var(--dm-text-muted); font-size: 14px; max-width: 320px; line-height: 1.5; margin: 0 0 20px 0;">
                Arkadaşlarınızla özel mesajlar, fotoğraflar ve ses kayıtları paylaşın.
              </p>
              <Button className="Button Button--primary" style="padding: 10px 24px; border-radius: 20px; font-weight: 600;" onclick={this.showNewConversationModal.bind(this)}>
                Yeni Mesaj Başlat
              </Button>
            </div>
          ) : (
            <>
              <div className="DirectMessenger-chatHeader">
                <div style="display: flex; align-items: center;">
                  <button 
                    className="DirectMessenger-mobileBackBtn"
                    onclick={() => {
                      this.activeConversationId = null;
                      this.showingStarred = false;
                      m.redraw();
                    }}
                    title="Geri Dön"
                  >
                    <i className="fas fa-arrow-left"></i>
                  </button>
                  
                  <h3 className="DirectMessenger-chatHeaderTitle">
                    {this.showingStarred ? 'Yıldızlı Mesajlar' : (
                      <>
                        {this.conversations.find(c => c.id === this.activeConversationId)?.attributes?.isGroup && <i className="fas fa-users" style="margin-right: 8px; color: #0284c7; font-size: 16px;"></i>}
                        {this.conversations.find(c => c.id === this.activeConversationId)?.attributes?.title || `Sohbet #${this.activeConversationId}`}
                      </>
                    )}
                  </h3>
                </div>
                
                {!this.showingStarred && (
                  <div>
                    <Dropdown
                      buttonClassName="Button Button--icon Button--flat"
                      menuClassName="Dropdown-menu--right DirectMessenger-dropdownMenu"
                      icon="fas fa-phone-alt"
                    >
                      <button className="DirectMessenger-dropdownItem" onclick={() => this.startCall(false)}><i className="fas fa-phone"></i> Sesli Ara</button>
                      <button className="DirectMessenger-dropdownItem" onclick={() => this.startCall(true)}><i className="fas fa-video"></i> Görüntülü Ara</button>
                    </Dropdown>
                  </div>
                )}
              </div>
              
              <div id="DirectMessenger-messagesList" className="DirectMessenger-messagesList">
                {this.loadingMessages ? <LoadingIndicator /> : (
                  this.messages.length === 0 && this.showingStarred ? (
                    <div style="display: flex; justify-content: center; align-items: center; flex: 1; color: var(--dm-text-muted); flex-direction: column;">
                      <i className="far fa-star" style="font-size: 40px; margin-bottom: 15px; color: #fadb14;"></i>
                      Hiç yıldızlı mesajınız yok.
                    </div>
                  ) : (
                    this.messages.map(msg => {
                    const isMine = msg.relationships && msg.relationships.user && msg.relationships.user.data.id === app.session.user.id();
                    const type = msg.attributes.type;
                    const content = msg.attributes.content;
                    const isDeleted = msg.attributes.isDeleted;
                    const isEdited = msg.attributes.isEdited;
                    const isStarred = msg.attributes.isStarred;
                    const senderName = msg.attributes.senderName;
                    const senderAvatar = msg.attributes.senderAvatar;
                    const activeConv = this.conversations.find(c => c.id === this.activeConversationId);
                    const isGroup = activeConv ? activeConv.attributes.isGroup : false;
                    
                    let renderedContent;
                    let bubbleClass = isMine ? 'DirectMessenger-messageBubbleMine' : 'DirectMessenger-messageBubbleOther';
                    let bubblePadding = 'padding: 11px 16px;';
                    
                    if (isDeleted) {
                        bubblePadding = 'padding: 10px 14px; font-style: italic; opacity: 0.7;';
                        renderedContent = <span><i className="fas fa-ban" style="margin-right: 5px;"></i> Bu mesaj silindi.</span>;
                    } else if (type === 'image') {
                        bubblePadding = 'padding: 0; background: transparent !important; border: none !important; box-shadow: none !important;';
                        bubbleClass = '';
                        renderedContent = <img src={content} style="max-width: 100%; max-height: 320px; border-radius: 16px; box-shadow: var(--dm-shadow-md);" />;
                    } else if (type === 'audio') {
                        renderedContent = <audio controls src={content} style="max-width: 220px; height: 38px;"></audio>;
                    } else if (type === 'post_share') {
                        bubblePadding = 'padding: 0; overflow: hidden;';
                        let postData = {};
                        try { postData = JSON.parse(content); } catch(e) {}
                        renderedContent = (
                            <div style="width: 270px; display: flex; flex-direction: column;">
                                <div style="padding: 12px 14px; border-bottom: 1px solid rgba(0,0,0,0.06); font-weight: 700; font-size: 13.5px; display: flex; align-items: center;">
                                    <i className="far fa-file-alt" style="margin-right: 8px; color: #0284c7; font-size: 15px;"></i>
                                    <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{postData.title || 'Forum Gönderisi'}</span>
                                </div>
                                {postData.imageUrl ? (
                                    <div style="width: 100%; height: 150px; background: var(--dm-bg-hover); overflow: hidden;">
                                        <img src={postData.imageUrl} style="width: 100%; height: 100%; object-fit: cover;" />
                                    </div>
                                ) : null}
                                <div style="padding: 10px 14px; font-size: 13px; max-height: 75px; overflow: hidden; text-overflow: ellipsis; white-space: pre-wrap; line-height: 1.4; opacity: 0.85;">
                                    {postData.excerpt || 'Gönderiyi görüntülemek için tıklayın.'}
                                </div>
                                <a href={postData.url} target="_blank" style="display: block; padding: 10px; background: rgba(2, 132, 199, 0.08); color: #0284c7; text-align: center; font-weight: 700; font-size: 12.5px; text-decoration: none;">
                                    Gönderiyi Gör <i className="fas fa-chevron-right" style="font-size: 10px; margin-left: 4px;"></i>
                                </a>
                                {postData.userMessage && (
                                    <div style="padding: 10px 14px; font-size: 13.5px; border-top: 1px solid rgba(0,0,0,0.06); background: rgba(255,255,255,0.2);">
                                        {postData.userMessage}
                                    </div>
                                )}
                            </div>
                        );
                    } else {
                        renderedContent = <span style="line-height: 1.45; word-break: break-word;">{content}</span>;
                    }

                    // Reply To render
                    let replyBlock = null;
                    if (msg.relationships && msg.relationships.replyTo && msg.relationships.replyTo.data) {
                      const replyId = msg.relationships.replyTo.data.id;
                      const replyMsg = this.messages.find(m => m.id === replyId);
                      if (replyMsg && !isDeleted) {
                        const replyUser = replyMsg.relationships && replyMsg.relationships.user ? replyMsg.relationships.user.data.id : null;
                        const replyName = replyUser === app.session.user.id() ? 'Siz' : 'Kullanıcı';
                        let replySnippet = replyMsg.attributes.type === 'image' ? '📷 Fotoğraf' : (replyMsg.attributes.type === 'post_share' ? '📌 Gönderi' : replyMsg.attributes.content);
                        if (replyMsg.attributes.isDeleted) replySnippet = 'Bu mesaj silindi.';
                        
                        replyBlock = (
                          <div style={`background: ${isMine ? 'rgba(255,255,255,0.15)' : 'var(--dm-bg-hover)'}; padding: 6px 10px; border-radius: 8px; margin-bottom: 6px; border-left: 3px solid ${isMine ? '#fff' : '#0284c7'}; font-size: 11.5px; cursor: pointer;`}>
                            <div style={`font-weight: 700; color: ${isMine ? '#fff' : '#0284c7'}; margin-bottom: 2px;`}>{replyName}</div>
                            <div style={`white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.85;`}>{replySnippet}</div>
                          </div>
                        );
                      }
                    }

                    // Read Receipts Logic
                    let ticks = null;
                    if (isMine) {
                      const isRead = activeConv && activeConv.attributes.otherUserReadAt && 
                                     new Date(msg.attributes.createdAt) <= new Date(activeConv.attributes.otherUserReadAt);
                                     
                      ticks = (
                        <span style={`font-size: 10px; margin-left: 5px; opacity: 0.9;`}>
                          <i className={isRead ? "fas fa-check-double" : "fas fa-check"}></i>
                        </span>
                      );
                    }

                    const timeColor = (type === 'image' && !isDeleted) ? '#fff' : (isMine ? 'rgba(255,255,255,0.8)' : 'var(--dm-text-subtle)');
                    const timeStyle = (type === 'image' && !isDeleted) 
                        ? 'position: absolute; bottom: 8px; right: 12px; background: rgba(0,0,0,0.6); padding: 2px 8px; border-radius: 12px; display: flex; align-items: center;'
                        : `display: flex; justify-content: flex-end; align-items: center; margin-top: 4px; ${(type === 'post_share' && !isDeleted) ? 'padding: 6px 12px; border-top: 1px solid rgba(0,0,0,0.05);' : ''}`;

                    let othersItems = new ItemList();
                    othersItems.add('reply', <button className="DirectMessenger-dropdownItem" onclick={() => this.replyToMessage = msg}><i className="fas fa-reply"></i> Yanıtla</button>);
                    othersItems.add('star', <button className="DirectMessenger-dropdownItem" onclick={() => this.starMessage(msg)}><i className={isStarred ? "fas fa-star" : "far fa-star"}></i> {isStarred ? 'Yıldızı Kaldır' : 'Yıldızla'}</button>);
                    
                    let myItems = new ItemList();
                    myItems.add('reply', <button className="DirectMessenger-dropdownItem" onclick={() => this.replyToMessage = msg}><i className="fas fa-reply"></i> Yanıtla</button>);
                    myItems.add('star', <button className="DirectMessenger-dropdownItem" onclick={() => this.starMessage(msg)}><i className={isStarred ? "fas fa-star" : "far fa-star"}></i> {isStarred ? 'Yıldızı Kaldır' : 'Yıldızla'}</button>);
                    if (type === 'text') {
                      myItems.add('edit', <button className="DirectMessenger-dropdownItem" onclick={() => { this.editingMessage = msg; this.newMessageContent = msg.attributes.content; }}><i className="fas fa-pencil-alt"></i> Düzenle</button>);
                    }
                    myItems.add('separator', <div className="Dropdown-separator"></div>);
                    myItems.add('delete', <button type="button" className="DirectMessenger-dropdownItem danger" onclick={(e) => this.deleteMessage(msg, e)}><i className="fas fa-trash"></i> Sil</button>);

                    return (
                      <div 
                        style={`display: flex; align-items: flex-end; ${isMine ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}`}
                        className="DirectMessenger-messageRow"
                      >
                        {/* Dropdown for MY messages (Left Side) */}
                        {isMine && !isDeleted && (
                          <div style="margin-right: 4px; margin-bottom: 6px;" className="DirectMessenger-msgAction">
                            <Dropdown
                              buttonClassName="Button Button--icon Button--flat"
                              menuClassName="Dropdown-menu--right DirectMessenger-dropdownMenu"
                              icon="fas fa-ellipsis-v"
                            >
                              {myItems.toArray()}
                            </Dropdown>
                          </div>
                        )}
                        
                        <div style="position: relative; max-width: 68%; display: flex; flex-direction: column;">
                          {isStarred && <div style={`position: absolute; top: -6px; ${isMine ? 'left: -6px;' : 'right: -6px;'} background: #fadb14; color: #fff; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 9px; box-shadow: var(--dm-shadow-sm); z-index: 10;`}><i className="fas fa-star"></i></div>}
                          
                          {/* Sender name for group chats (if not mine) */}
                          {isGroup && !isMine && !isDeleted && (
                            <div style="font-size: 11px; font-weight: 700; margin-left: 8px; margin-bottom: 3px; color: var(--dm-text-subtle); display: flex; align-items: center;">
                              {senderAvatar ? <img src={senderAvatar} style="width: 14px; height: 14px; border-radius: 50%; margin-right: 4px; object-fit: cover;" /> : <i className="fas fa-user-circle" style="margin-right: 4px;"></i>}
                              {senderName}
                            </div>
                          )}
                          
                          <div className={bubbleClass} style={`font-size: 14px; position: relative; ${bubblePadding} width: 100%;`}>
                            {replyBlock}
                            {renderedContent}
                            <div style={timeStyle}>
                              <span style={`font-size: 10px; color: ${timeColor};`}>
                                {isEdited && <span style="margin-right: 4px; font-style: italic;">(düzenlendi)</span>}
                                {new Date(msg.attributes.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                              {ticks}
                            </div>
                          </div>
                        </div>

                        {/* Dropdown for OTHERS' messages (Right Side) */}
                        {!isMine && !isDeleted && (
                          <div style="margin-left: 4px; margin-bottom: 6px;" className="DirectMessenger-msgAction">
                            <Dropdown
                              buttonClassName="Button Button--icon Button--flat"
                              menuClassName="Dropdown-menu--left DirectMessenger-dropdownMenu"
                              icon="fas fa-ellipsis-v"
                            >
                              {othersItems.toArray()}
                            </Dropdown>
                          </div>
                        )}
                      </div>
                    )
                  })
                ))}
              </div>
              
              {!this.showingStarred && (
                <div className="DirectMessenger-inputArea">
                  {/* Quick Emoji Bar */}
                  {this.showEmojiPicker && (
                    <div className="DirectMessenger-emojiBar">
                      {['❤️', '👍', '😂', '🔥', '🎉', '👏', '😍', '😢', '🙏', '✨'].map(emoji => (
                        <button 
                          className="DirectMessenger-emojiBtn" 
                          onclick={() => {
                            this.newMessageContent += emoji;
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {this.replyToMessage && (
                    <div style="background: var(--dm-bg-hover); padding: 8px 12px; border-radius: 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 3.5px solid #0284c7;">
                      <div style="flex: 1; overflow: hidden;">
                        <div style="font-weight: 700; font-size: 11.5px; color: #0284c7;">Yanıtlanıyor...</div>
                        <div style="font-size: 12.5px; color: var(--dm-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          {this.replyToMessage.attributes.type === 'image' ? '📷 Fotoğraf' : (this.replyToMessage.attributes.type === 'post_share' ? '📌 Gönderi' : this.replyToMessage.attributes.content)}
                        </div>
                      </div>
                      <button className="Button Button--icon Button--link" style="color: var(--dm-text-subtle);" onclick={() => this.replyToMessage = null}><i className="fas fa-times"></i></button>
                    </div>
                  )}
                  {this.editingMessage && (
                    <div style="background: var(--dm-bg-hover); padding: 8px 12px; border-radius: 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 3.5px solid #fadb14;">
                      <div style="flex: 1; overflow: hidden;">
                        <div style="font-weight: 700; font-size: 11.5px; color: #fadb14;">Mesaj Düzenleniyor...</div>
                      </div>
                      <button className="Button Button--icon Button--link" style="color: var(--dm-text-subtle);" onclick={() => { this.editingMessage = null; this.newMessageContent = ''; }}><i className="fas fa-times"></i></button>
                    </div>
                  )}
                  <input type="file" id="DirectMessenger-fileInput" style="display:none" accept="image/*" onchange={this.handleImageSelected.bind(this)} />
                  <div className="DirectMessenger-inputContainer">
                    <button 
                      className="Button Button--icon Button--link" 
                      style={`padding: 6px 8px; color: ${this.showEmojiPicker ? '#0284c7' : 'var(--dm-text-muted)'};`} 
                      onclick={() => this.showEmojiPicker = !this.showEmojiPicker}
                      title="Emoji Seç"
                    >
                      <i className="far fa-smile" style="font-size: 17px;"></i>
                    </button>
                    <input 
                      type="text" 
                      className="DirectMessenger-messageInput"
                      placeholder={this.isRecording ? "🎤 Ses Kaydediliyor..." : "Mesaj gönder..."}
                      disabled={this.isRecording}
                      style={this.isRecording ? 'color: #ef4444; font-weight: 600;' : ''} 
                      value={this.newMessageContent}
                      oninput={e => this.newMessageContent = e.target.value}
                      onkeypress={e => { if (e.key === 'Enter') this.sendMessage(); }}
                    />
                    {this.newMessageContent.trim() ? (
                      <button className="Button Button--link" style="color: #0284c7; font-weight: 700; padding: 6px 12px; font-size: 14px;" onclick={() => this.sendMessage()}>Gönder</button>
                    ) : (
                      <div style="display: flex; align-items: center;">
                        {this.isRecording ? (
                          <button className="Button Button--icon Button--link" style="color: #ef4444; padding: 6px 8px;" onclick={this.stopRecording.bind(this)} title="Kaydı Durdur"><i className="fas fa-stop-circle" style="font-size: 18px;"></i></button>
                        ) : (
                          <>
                            <button className="Button Button--icon Button--link" style="color: var(--dm-text-muted); padding: 6px 8px;" onclick={this.triggerImageUpload.bind(this)} title="Görsel Yükle"><i className="far fa-image" style="font-size: 17px;"></i></button>
                            <button className="Button Button--icon Button--link" style="color: var(--dm-text-muted); padding: 6px 8px;" onclick={this.startRecording.bind(this)} title="Ses Kaydı Başlat"><i className="fas fa-microphone" style="font-size: 17px;"></i></button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Incoming Call Overlay */}
        {this.incomingCall && (
          <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white;">
            <div style="background: #262626; padding: 40px; border-radius: 20px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
              <div style="width: 80px; height: 80px; background: #0095f6; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 20px auto; animation: pulse 1.5s infinite;">
                <i className="fas fa-phone-alt" style="font-size: 32px;"></i>
              </div>
              <h2 style="margin: 0 0 10px 0;">Gelen Arama</h2>
              <p style="color: #ccc; margin-bottom: 30px;">Biri sizi arıyor...</p>
              
              <div style="display: flex; gap: 20px; justify-content: center;">
                <button onclick={() => this.rejectCall()} style="width: 60px; height: 60px; border-radius: 50%; border: none; background: #e74c3c; color: white; font-size: 24px; cursor: pointer;">
                  <i className="fas fa-phone-slash"></i>
                </button>
                <button onclick={() => this.answerCall()} style="width: 60px; height: 60px; border-radius: 50%; border: none; background: #2ecc71; color: white; font-size: 24px; cursor: pointer;">
                  <i className="fas fa-phone"></i>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Call Overlay */}
        {this.activeCall && (
          <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #111; z-index: 9998; display: flex; flex-direction: column;">
            <div style="flex: 1; position: relative; display: flex; justify-content: center; align-items: center;">
              {this.remoteStream && this.isVideoCall ? (
                <video id="DirectMessenger-remoteVideo" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
              ) : (
                <div style="display: flex; flex-direction: column; align-items: center; color: white;">
                  <div style="width: 120px; height: 120px; background: #333; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin-bottom: 20px;">
                    <i className="fas fa-user" style="font-size: 50px; color: #666;"></i>
                  </div>
                  <h3>Arama devam ediyor...</h3>
                  {this.remoteStream && <audio id="DirectMessenger-remoteVideo" autoplay playsinline></audio>}
                </div>
              )}
              
              {/* Local Video Thumbnail */}
              {this.localStream && this.isVideoCall && (
                <div style="position: absolute; bottom: 100px; right: 30px; width: 150px; height: 200px; background: #000; border-radius: 12px; overflow: hidden; border: 2px solid rgba(255,255,255,0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                  <video id="DirectMessenger-localVideo" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
                </div>
              )}
            </div>
            
            {/* Call Controls */}
            <div style="height: 80px; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; gap: 20px;">
              <button onclick={() => {
                if (this.localStream) {
                  const audioTrack = this.localStream.getAudioTracks()[0];
                  if (audioTrack) audioTrack.enabled = !audioTrack.enabled;
                }
              }} style="width: 50px; height: 50px; border-radius: 50%; border: none; background: #444; color: white; font-size: 20px; cursor: pointer;">
                <i className="fas fa-microphone-slash"></i>
              </button>
              
              <button onclick={() => this.endCall()} style="width: 60px; height: 60px; border-radius: 50%; border: none; background: #e74c3c; color: white; font-size: 24px; cursor: pointer; box-shadow: 0 0 15px rgba(231, 76, 60, 0.5);">
                <i className="fas fa-phone-slash"></i>
              </button>
            </div>
          </div>
        )}

      </div>
    );
  }
}
