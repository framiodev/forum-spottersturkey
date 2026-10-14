import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import ItemList from 'flarum/common/utils/ItemList';
import Link from 'flarum/common/components/Link';
import NewConversationModal from './NewConversationModal';
import MeetingModal from './MeetingModal';
import messengerState from '../states/messengerState';

export default class MessengerDock extends Component {
  oninit(vnode) {
    super.oninit(vnode);

    this.messages = [];
    this.loadingMessages = false;
    this.newMessageContent = '';
    this.replyToMessage = null;
    this.editingMessage = null;
    this.showEmojiPicker = false;
    this.pollInterval = null;
    this.currentChatId = null;

    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];

    this.selectedImageFile = null;
    this.selectedImagePreview = null;
    this.isUploadingMedia = false;

    // Periodic check for chat messages
    this.pollInterval = setInterval(() => {
      if (messengerState.activeConversationId && !this.loadingMessages) {
        this.pollMessages();
      }
    }, 3500);
  }

  onremove(vnode) {
    super.onremove(vnode);
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  loadMessages(convId) {
    this.currentChatId = convId;
    this.loadingMessages = true;
    this.messages = [];
    this.replyToMessage = null;
    this.editingMessage = null;
    this.showEmojiPicker = false;
    m.redraw();

    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/messages?id=' + convId
    }).then(response => {
      this.messages = response.data || [];
      this.loadingMessages = false;
      m.redraw();
      this.scrollToBottom();
    }).catch(() => {
      this.loadingMessages = false;
      m.redraw();
    });
  }

  pollMessages() {
    if (!messengerState.activeConversationId) return;

    // Check if user changed conversation
    if (this.currentChatId !== messengerState.activeConversationId) {
      this.loadMessages(messengerState.activeConversationId);
      return;
    }

    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/messages?id=' + messengerState.activeConversationId
    }).then(response => {
      if (response && response.data && response.data.length !== this.messages.length) {
        const oldLength = this.messages.length;
        const newMessages = response.data;
        const container = document.getElementById('MessengerDock-messagesStream');
        const isAtBottom = container ? (container.scrollHeight - container.scrollTop <= container.clientHeight + 80) : true;
        
        // Play notification sound if the newest message is from another user
        if (newMessages.length > oldLength) {
          const newest = newMessages[newMessages.length - 1];
          const isFromOther = newest && newest.relationships && newest.relationships.user && newest.relationships.user.data.id !== app.session.user.id();
          if (isFromOther) {
            this.playNotificationSound();
          }
        }

        this.messages = newMessages;
        m.redraw();
        if (isAtBottom) {
          this.scrollToBottom();
        }
      }
    }).catch(() => {});
  }

  scrollToBottom() {
    setTimeout(() => {
      const container = document.getElementById('MessengerDock-messagesStream');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  startCall() {
    if (!messengerState.activeConversationId) return;

    const convId = messengerState.activeConversationId;
    const activeConv = messengerState.conversations.find(c => String(c.id) === String(convId));
    const title = activeConv ? activeConv.attributes.title : 'Sohbet';

    // Unique secure room name
    const roomName = `UlasimArsiv-Room-${convId}-${Math.random().toString(36).substring(2, 8)}`;
    const meetingTitle = `${title} - Toplantı`;

    // 1. Open meeting modal locally
    messengerState.startMeeting(roomName, meetingTitle, false);

    // 2. Send meeting invitation message in conversation
    const invitePayload = {
      roomName: roomName,
      meetingTitle: meetingTitle,
      audioOnly: false,
      hostName: app.session.user.displayName ? app.session.user.displayName() : app.session.user.username()
    };

    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/messages',
      body: {
        data: {
          attributes: {
            conversationId: convId,
            content: JSON.stringify(invitePayload),
            type: 'meeting_invite'
          }
        }
      }
    }).then(response => {
      this.messages.push(response.data);
      m.redraw();
      this.scrollToBottom();
      messengerState.fetchConversations(false);
    });
  }

  triggerImageUpload() {
    const input = document.getElementById('MessengerDock-fileInput');
    if (input) input.click();
  }

  handleImageSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = (event) => {
      this.selectedImagePreview = event.target.result;
      m.redraw();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  clearSelectedImage() {
    this.selectedImageFile = null;
    this.selectedImagePreview = null;
    m.redraw();
  }

  sendMessage() {
    if (!messengerState.activeConversationId) return;

    // 1. If an image is selected with preview, send image first
    if (this.selectedImageFile) {
      const file = this.selectedImageFile;
      const text = this.newMessageContent.trim();
      this.clearSelectedImage();
      this.newMessageContent = '';
      this.isUploadingMedia = true;
      m.redraw();

      const formData = new FormData();
      formData.append('data[attributes][conversationId]', messengerState.activeConversationId);
      formData.append('data[attributes][type]', 'image');
      formData.append('media', file);

      app.request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/messages',
        serialize: data => data,
        body: formData
      }).then(response => {
        this.messages.push(response.data);
        this.isUploadingMedia = false;
        m.redraw();
        this.scrollToBottom();
        messengerState.fetchConversations(false);

        // If user also wrote text caption with the photo, send text message right after
        if (text) {
          app.request({
            method: 'POST',
            url: app.forum.attribute('apiUrl') + '/messages',
            body: {
              data: {
                attributes: {
                  conversationId: messengerState.activeConversationId,
                  content: text,
                  type: 'text'
                }
              }
            }
          }).then(res => {
            this.messages.push(res.data);
            m.redraw();
            this.scrollToBottom();
            messengerState.fetchConversations(false);
          });
        }
      }).catch(() => {
        this.isUploadingMedia = false;
        m.redraw();
        alert('Fotoğraf gönderilirken bir sorun oluştu.');
      });
      return;
    }

    if (!this.newMessageContent.trim()) return;

    const content = this.newMessageContent;
    this.newMessageContent = '';

    if (this.editingMessage) {
      app.request({
        method: 'PATCH',
        url: app.forum.attribute('apiUrl') + '/messages/' + this.editingMessage.id,
        body: { data: { attributes: { content: content } } }
      }).then(response => {
        const idx = this.messages.findIndex(m => m.id === response.data.id);
        if (idx !== -1) this.messages[idx] = response.data;
        this.editingMessage = null;
        m.redraw();
      });
      return;
    }

    const payload = {
      data: {
        attributes: {
          conversationId: messengerState.activeConversationId,
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
      messengerState.fetchConversations(false);
      this.playNotificationSound();
    });
  }

  playNotificationSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {}
  }

  starMessage(msg) {
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/messages/' + msg.id + '/star'
    }).then(response => {
      const idx = this.messages.findIndex(m => m.id === response.data.id);
      if (idx !== -1) {
        this.messages[idx] = response.data;
      }
      m.redraw();
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
        const idx = this.messages.findIndex(m => m.id === response.data.id);
        if (idx !== -1) {
          this.messages[idx] = response.data;
        }
        m.redraw();
      });
    }
  }

  endCall(msg, e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (confirm('Bu görüşmeyi sonlandırmak istediğinize emin misiniz?')) {
      app.request({
        method: 'DELETE',
        url: app.forum.attribute('apiUrl') + '/messages/' + msg.id
      }).then(response => {
        const idx = this.messages.findIndex(m => m.id === response.data.id);
        if (idx !== -1) {
          this.messages[idx] = response.data;
        }
        m.redraw();
      });
    }
  }

  cancelReply() {
    this.replyToMessage = null;
    m.redraw();
  }

  cancelEdit() {
    this.editingMessage = null;
    this.newMessageContent = '';
    m.redraw();
  }

  uploadMedia(fileBlob, type) {
    if (!messengerState.activeConversationId) return;

    const formData = new FormData();
    formData.append('data[attributes][conversationId]', messengerState.activeConversationId);
    formData.append('data[attributes][type]', type);
    formData.append('media', fileBlob);

    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/messages',
      serialize: data => data,
      body: formData
    }).then(response => {
      this.messages.push(response.data);
      m.redraw();
      this.scrollToBottom();
      messengerState.fetchConversations(false);
    }).catch(() => {
      alert('Medya gönderilirken bir sorun oluştu.');
    });
  }

  startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Tarayıcınız mikrofon kaydını desteklemiyor veya HTTPS gerektiriyor.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        this.isRecording = true;
        this.audioChunks = [];
        this.mediaRecorder = new MediaRecorder(stream);
        this.mediaRecorder.addEventListener('dataavailable', event => {
          this.audioChunks.push(event.data);
        });
        this.mediaRecorder.addEventListener('stop', () => {
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

  view() {
    if (!app.session || !app.session.user) return null;

    // Check if activeConversation changed
    if (messengerState.activeConversationId && String(this.currentChatId) !== String(messengerState.activeConversationId)) {
      this.loadMessages(messengerState.activeConversationId);
    }

    const activeConv = messengerState.conversations.find(c => String(c.id) === String(messengerState.activeConversationId));

    const filteredConversations = messengerState.conversations.filter(c => {
      if (!messengerState.searchQuery.trim()) return true;
      const title = c.attributes && c.attributes.title ? c.attributes.title.toLowerCase() : '';
      return title.includes(messengerState.searchQuery.toLowerCase().trim());
    });

    return (
      <div className="MessengerDock-root">
        {/* 1. DOCK POPUP: Conversations List (Facebook Messenger Style) */}
        {messengerState.isDockOpen && (
          <div className="MessengerDock-listPanel">
            <div className="MessengerDock-panelHeader">
              <div className="MessengerDock-panelTitle">
                <span>Sohbetler</span>
                {messengerState.totalUnread > 0 && (
                  <span className="MessengerDock-panelBadge">{messengerState.totalUnread}</span>
                )}
              </div>
              <div className="MessengerDock-headerActions">
                <button 
                  className="Button Button--icon Button--link" 
                  onclick={() => {
                    messengerState.closeDock();
                    m.route.set(app.route('direct-messages') + '?starred=1');
                  }}
                  title="Yıldızlı Mesajlar"
                  style="color: #fadb14;"
                >
                  <i className="fas fa-star"></i>
                </button>
                <button 
                  className="Button Button--icon Button--link" 
                  onclick={() => {
                    app.modal.show(NewConversationModal, {
                      onConversationCreated: (id) => {
                        messengerState.openConversation(id);
                      }
                    });
                  }}
                  title="Yeni Mesaj"
                >
                  <i className="far fa-edit"></i>
                </button>
                <button 
                  className="Button Button--icon Button--link" 
                  onclick={() => messengerState.closeDock()}
                  title="Kapat"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {/* Search Box */}
            <div className="MessengerDock-searchBox">
              <i className="fas fa-search"></i>
              <input 
                type="text" 
                placeholder="Messenger'da ara..." 
                value={messengerState.searchQuery}
                oninput={e => messengerState.searchQuery = e.target.value}
              />
              {messengerState.searchQuery && (
                <button className="Button Button--icon Button--link" onclick={() => messengerState.searchQuery = ''}>
                  <i className="fas fa-times-circle"></i>
                </button>
              )}
            </div>

            {/* Conversations List */}
            <div className="MessengerDock-conversationsList">
              {messengerState.loadingConversations ? (
                <div style="padding: 24px; text-align: center;"><LoadingIndicator /></div>
              ) : filteredConversations.length === 0 ? (
                <div className="MessengerDock-emptyState">
                  <i className="far fa-comments"></i>
                  <p>{messengerState.searchQuery ? 'Sohbet bulunamadı.' : 'Henüz mesajınız yok.'}</p>
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const unread = conv.attributes.unreadCount || 0;
                  const snippet = conv.attributes.lastMessageSnippet || 'Sohbet başladı.';
                  const isGroup = conv.attributes.isGroup;
                  const time = conv.attributes.lastMessageCreatedAt 
                    ? new Date(conv.attributes.lastMessageCreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : '';

                  const isOnline = !isGroup && conv.attributes.otherUserIsOnline;
                  const lastSeenAt = !isGroup ? conv.attributes.otherUserLastSeenAt : null;
                  let statusText = '';
                  if (!isGroup) {
                    if (isOnline) {
                      statusText = 'Çevrimiçi';
                    } else if (lastSeenAt) {
                      const diffMins = Math.floor((new Date() - new Date(lastSeenAt)) / 60000);
                      if (diffMins < 60) {
                        statusText = `${diffMins}dk önce aktifti`;
                      } else if (diffMins < 1440) {
                        statusText = `${Math.floor(diffMins / 60)}s önce aktifti`;
                      } else {
                        statusText = `${Math.floor(diffMins / 1440)}g önce aktifti`;
                      }
                    }
                  }

                  return (
                    <div 
                      className={`MessengerDock-convItem ${unread > 0 ? 'unread' : ''}`}
                      onclick={() => messengerState.openConversation(conv.id)}
                    >
                      <div className="MessengerDock-convAvatar">
                        {isGroup ? (
                          <div className="MessengerDock-groupAvatarIcon"><i className="fas fa-users"></i></div>
                        ) : conv.attributes.avatarUrl ? (
                          <img src={conv.attributes.avatarUrl} />
                        ) : (
                          <div className="MessengerDock-fallbackAvatar"><i className="fas fa-user"></i></div>
                        )}
                        {isOnline ? (
                          <span className="MessengerDock-onlineIndicator online" title="Çevrimiçi"></span>
                        ) : unread > 0 ? (
                          <span className="MessengerDock-onlineIndicator unreadDot"></span>
                        ) : null}
                      </div>

                      <div className="MessengerDock-convInfo">
                        <div className="MessengerDock-convTitleRow">
                          <span className="MessengerDock-convTitle">{conv.attributes.title}</span>
                          <span className="MessengerDock-convTime">{time}</span>
                        </div>
                        <div className="MessengerDock-convSnippetRow">
                          <span className="MessengerDock-convSnippet">
                            {snippet}
                          </span>
                          {unread > 0 ? (
                            <span className="MessengerDock-unreadCounter">{unread}</span>
                          ) : statusText ? (
                            <span className={`MessengerDock-statusBadge ${isOnline ? 'online' : ''}`}>
                              {statusText}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 2. CHAT POPUP WINDOW / HEAD (Facebook Messenger Window) */}
        {messengerState.activeConversationId && (
          <div className={`MessengerDock-chatWindow ${messengerState.minimized ? 'minimized' : ''}`}>
            {/* Header */}
            <div 
              className="MessengerDock-chatHeader" 
              onclick={() => {
                if (messengerState.minimized) messengerState.toggleMinimize();
              }}
            >
              <div className="MessengerDock-chatHeaderInfo">
                {/* Back to list button */}
                <button
                  className="Button Button--icon Button--link MessengerDock-backBtn"
                  onclick={(e) => {
                    e.stopPropagation();
                    messengerState.backToList();
                  }}
                  title="Sohbet Listesine Dön"
                >
                  <i className="fas fa-arrow-left"></i>
                </button>

                <div className="MessengerDock-chatHeaderAvatar">
                  {activeConv && activeConv.attributes.avatarUrl ? (
                    <img src={activeConv.attributes.avatarUrl} />
                  ) : (
                    <i className="fas fa-user-circle"></i>
                  )}
                </div>
                <div className="MessengerDock-chatHeaderText">
                  <div className="MessengerDock-chatHeaderName">
                    {activeConv && activeConv.attributes.otherUsername ? (
                      <Link 
                        href={`/u/${encodeURIComponent(activeConv.attributes.otherUsername)}`}
                        onclick={(e) => e.stopPropagation()}
                        style="color: inherit; text-decoration: none;"
                        title="Profile Git"
                      >
                        {activeConv.attributes.title}
                      </Link>
                    ) : (
                      <span>{activeConv ? activeConv.attributes.title : 'Sohbet'}</span>
                    )}
                  </div>
                  <div className="MessengerDock-chatHeaderSub">
                    {this.loadingMessages ? (
                      'Yükleniyor...'
                    ) : activeConv && !activeConv.attributes.isGroup ? (
                      activeConv.attributes.otherUserIsOnline ? (
                        <span className="MessengerDock-headerOnline"><i className="fas fa-circle"></i> Çevrimiçi</span>
                      ) : activeConv.attributes.otherUserLastSeenAt ? (
                        (() => {
                          const diff = Math.floor((new Date() - new Date(activeConv.attributes.otherUserLastSeenAt)) / 60000);
                          if (diff < 60) return `${diff} dakika önce aktifti`;
                          if (diff < 1440) return `${Math.floor(diff / 60)} saat önce aktifti`;
                          return `${Math.floor(diff / 1440)} gün önce aktifti`;
                        })()
                      ) : (
                        'Çevrimdışı'
                      )
                    ) : (
                      'Aktif'
                    )}
                  </div>
                </div>
              </div>

              <div className="MessengerDock-chatHeaderButtons">
                {/* Start Meeting (Video & Audio Conference) */}
                <button 
                  className="Button Button--icon Button--link MessengerDock-callBtn" 
                  onclick={(e) => { e.stopPropagation(); this.startCall(); }}
                  title="Görüntülü / Sesli Toplantı Başlat"
                >
                  <i className="fas fa-video"></i>
                </button>

                <button 
                  className="Button Button--icon Button--link" 
                  onclick={(e) => { e.stopPropagation(); messengerState.toggleMinimize(); }}
                  title={messengerState.minimized ? 'Büyüt' : 'Küçült'}
                >
                  <i className={messengerState.minimized ? 'fas fa-chevron-up' : 'fas fa-minus'}></i>
                </button>
                <button 
                  className="Button Button--icon Button--link" 
                  onclick={(e) => { e.stopPropagation(); messengerState.closeConversation(); }}
                  title="Kapat"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {/* Chat Body (Only shown when not minimized) */}
            {!messengerState.minimized && (
              <>
                <div id="MessengerDock-messagesStream" className="MessengerDock-messagesStream">
                  {this.loadingMessages ? (
                    <div style="padding: 24px; text-align: center;"><LoadingIndicator /></div>
                  ) : this.messages.length === 0 ? (
                    <div className="MessengerDock-emptyState" style="padding-top: 50px;">
                      <i className="far fa-paper-plane"></i>
                      <p>Sohbeti başlatmak için bir mesaj yazın!</p>
                    </div>
                  ) : (
                    this.messages.map(msg => {
                      const isMine = msg.relationships && msg.relationships.user && msg.relationships.user.data.id === app.session.user.id();
                      const type = msg.attributes.type;
                      const content = msg.attributes.content;
                      const isDeleted = msg.attributes.isDeleted;
                      const isEdited = msg.attributes.isEdited;

                      let bubbleContent;
                      if (isDeleted) {
                        bubbleContent = <span style="font-style: italic; opacity: 0.7;">🚫 Bu mesaj silindi.</span>;
                      } else if (type === 'image') {
                        bubbleContent = <img src={content} style="max-width: 100%; border-radius: 12px; cursor: pointer;" onclick={() => window.open(content, '_blank')} />;
                      } else if (type === 'audio') {
                        bubbleContent = <audio controls src={content} style="max-width: 180px; height: 36px;"></audio>;
                      } else if (type === 'post_share') {
                        let postData = {};
                        try {
                          postData = typeof content === 'string' ? JSON.parse(content) : content;
                        } catch (e) {
                          postData = {};
                        }

                        const targetUrl = postData.url || (postData.postId ? `/d/${postData.postId}` : '#');

                        bubbleContent = (
                          <div className="MessengerDock-sharedPostCard">
                            <a 
                              href={targetUrl} 
                              className="MessengerDock-sharedPostLink"
                              onclick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <div className="MessengerDock-sharedPostHeader">
                                <i className="far fa-newspaper"></i>
                                <span className="MessengerDock-sharedPostTitle">
                                  {postData.title || 'Paylaşılan Gönderi'}
                                </span>
                                <i className="fas fa-external-link-alt MessengerDock-externalIcon"></i>
                              </div>

                              {postData.imageUrl && (
                                <div className="MessengerDock-sharedPostImage">
                                  <img src={postData.imageUrl} alt="Gönderi Resmi" />
                                </div>
                              )}

                              {postData.excerpt && (
                                <div className="MessengerDock-sharedPostExcerpt">
                                  {postData.excerpt}
                                </div>
                              )}
                            </a>

                            {postData.userMessage && (
                              <div className="MessengerDock-sharedPostUserNote">
                                <i className="far fa-comment-dots"></i>
                                <span>{postData.userMessage}</span>
                              </div>
                            )}
                          </div>
                        );
                      } else if (type === 'meeting_invite') {
                        let inviteData = {};
                        try {
                          inviteData = typeof content === 'string' ? JSON.parse(content) : content;
                        } catch (e) {
                          inviteData = {};
                        }

                        const isAudioOnly = !!inviteData.audioOnly;
                        const roomName = inviteData.roomName;
                        const meetingTitle = inviteData.meetingTitle || 'Toplantı';

                        bubbleContent = (
                          <div className="MessengerDock-meetingCard">
                            <div className="MessengerDock-meetingIcon">
                              <i className="fas fa-video"></i>
                            </div>
                            <div className="MessengerDock-meetingInfo">
                              <span className="MessengerDock-meetingTitle">
                                Sesli & Görüntülü Toplantı
                              </span>
                              <span className="MessengerDock-meetingHost">
                                {inviteData.hostName ? `${inviteData.hostName} tarafından başlatıldı` : 'Google Meet Altyapısı'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="Button Button--primary MessengerDock-joinMeetingBtn"
                              onclick={(e) => {
                                e.stopPropagation();
                                messengerState.startMeeting(roomName, meetingTitle, isAudioOnly);
                              }}
                              title="Sınırsız Görüşmeye Katıl"
                            >
                              <i className="fas fa-video"></i> Katıl
                            </button>
                          </div>
                        );
                      } else {
                        bubbleContent = content;
                      }

                      // Reply block
                      let replySnippet = null;
                      if (msg.relationships && msg.relationships.replyTo && msg.relationships.replyTo.data) {
                        const rId = msg.relationships.replyTo.data.id;
                        const rMsg = this.messages.find(m => m.id === rId);
                        if (rMsg && !isDeleted) {
                          replySnippet = (
                            <div className="MessengerDock-replyQuote">
                              {rMsg.attributes.content || 'Medya'}
                            </div>
                          );
                        }
                      }

                      const isStarred = msg.attributes.isStarred;

                      let actionsMenu = new ItemList();
                      actionsMenu.add('reply', <button type="button" className="DirectMessenger-dropdownItem" onclick={(e) => { e.stopPropagation(); this.replyToMessage = msg; m.redraw(); }}><i className="fas fa-reply"></i> Yanıtla</button>);
                      actionsMenu.add('star', <button type="button" className="DirectMessenger-dropdownItem" onclick={(e) => { e.stopPropagation(); this.starMessage(msg); }}><i className={isStarred ? "fas fa-star" : "far fa-star"}></i> {isStarred ? 'Yıldızı Kaldır' : 'Yıldızla'}</button>);
                      if (isMine && type === 'text' && !isDeleted) {
                        actionsMenu.add('edit', <button type="button" className="DirectMessenger-dropdownItem" onclick={(e) => { e.stopPropagation(); this.editingMessage = msg; this.newMessageContent = msg.attributes.content; m.redraw(); }}><i className="fas fa-pencil-alt"></i> Düzenle</button>);
                      }
                      if (type === 'meeting_invite' && !isDeleted) {
                        actionsMenu.add('end_call', <button type="button" className="DirectMessenger-dropdownItem danger" onclick={(e) => this.endCall(msg, e)}><i className="fas fa-phone-slash"></i> Çağrıyı Sonlandır</button>);
                      }
                      if (isMine && !isDeleted) {
                        actionsMenu.add('delete', <button type="button" className="DirectMessenger-dropdownItem danger" onclick={(e) => this.deleteMessage(msg, e)}><i className="fas fa-trash"></i> Sil</button>);
                      }

                      // Read receipts check
                      let ticks = null;
                      if (isMine) {
                        const isRead = activeConv && activeConv.attributes.otherUserReadAt && 
                                       new Date(msg.attributes.createdAt) <= new Date(activeConv.attributes.otherUserReadAt);
                        ticks = (
                          <span style="font-size: 10px; margin-left: 4px; opacity: 0.9;" title={isRead ? 'Görüldü' : 'İletildi'}>
                            <i className={isRead ? "fas fa-check-double" : "fas fa-check"}></i>
                          </span>
                        );
                      }

                      return (
                        <div className={`MessengerDock-msgRow ${isMine ? 'mine' : 'other'}`}>
                          {/* Actions button for my messages (left of bubble) */}
                          {isMine && !isDeleted && (
                            <div className="MessengerDock-msgActionBtn" style="align-self: center; margin-right: 4px;">
                              <Dropdown
                                buttonClassName="Button Button--icon Button--flat"
                                menuClassName="Dropdown-menu--left MessengerDock-dropdownMenu"
                                icon="fas fa-ellipsis-v"
                              >
                                {actionsMenu.toArray()}
                              </Dropdown>
                            </div>
                          )}

                          <div className={`MessengerDock-msgBubble ${isMine ? 'bubbleMine' : 'bubbleOther'}`}>
                            {isStarred && (
                              <div style={`position: absolute; top: -6px; ${isMine ? 'left: -6px;' : 'right: -6px;'} background: #fadb14; color: #fff; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 9px; box-shadow: 0 1px 4px rgba(0,0,0,0.2); z-index: 5;`}>
                                <i className="fas fa-star"></i>
                              </div>
                            )}
                            {replySnippet}
                            {bubbleContent}
                            <div className="MessengerDock-msgMeta">
                              {isEdited && <span style="margin-right: 4px; font-style: italic; opacity: 0.8;">(düzenlendi)</span>}
                              <span>{new Date(msg.attributes.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {ticks}
                            </div>
                          </div>

                          {/* Actions button for others' messages (right of bubble) */}
                          {!isMine && !isDeleted && (
                            <div className="MessengerDock-msgActionBtn" style="align-self: center; margin-left: 4px;">
                              <Dropdown
                                buttonClassName="Button Button--icon Button--flat"
                                menuClassName="Dropdown-menu--right MessengerDock-dropdownMenu"
                                icon="fas fa-ellipsis-v"
                              >
                                {actionsMenu.toArray()}
                              </Dropdown>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input Area */}
                <div className="MessengerDock-inputSection">
                  {/* Photo Preview Card before sending */}
                  {this.selectedImagePreview && (
                    <div className="MessengerDock-imagePreviewCard">
                      <div className="MessengerDock-previewThumbnailWrapper">
                        <img src={this.selectedImagePreview} alt="Önizleme" />
                        <button 
                          className="MessengerDock-removePreviewBtn" 
                          onclick={this.clearSelectedImage.bind(this)}
                          title="Fotoğrafı Kaldır"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                      <div className="MessengerDock-previewInfo">
                        <span className="MessengerDock-previewTitle">Fotoğraf Gönderiliyor</span>
                        <span className="MessengerDock-previewSub">Aşağıya isteğe bağlı not yazabilirsiniz</span>
                      </div>
                    </div>
                  )}

                  {this.isUploadingMedia && (
                    <div className="MessengerDock-uploadingBanner">
                      <LoadingIndicator size="tiny" />
                      <span>Medya yükleniyor...</span>
                    </div>
                  )}

                  {/* Reply Banner */}
                  {this.replyToMessage && (
                    <div style="background: var(--dm-bg-hover); padding: 6px 10px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid #0284c7; font-size: 12px;">
                      <div style="flex: 1; overflow: hidden;">
                        <span style="font-weight: 700; color: #0284c7; display: block;">Yanıtlanıyor:</span>
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.85; display: block;">
                          {this.replyToMessage.attributes.content || 'Medya mesajı'}
                        </span>
                      </div>
                      <button 
                        className="Button Button--icon Button--link" 
                        onclick={this.cancelReply.bind(this)}
                        style="color: var(--dm-text-muted); padding: 2px;"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}

                  {/* Editing Banner */}
                  {this.editingMessage && (
                    <div style="background: var(--dm-bg-hover); padding: 6px 10px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid #f59e0b; font-size: 12px;">
                      <div style="flex: 1; overflow: hidden;">
                        <span style="font-weight: 700; color: #f59e0b; display: block;">Mesaj Düzenleniyor</span>
                        <span style="opacity: 0.85; font-size: 11px;">Kaydetmek için Enter'a basın</span>
                      </div>
                      <button 
                        className="Button Button--icon Button--link" 
                        onclick={this.cancelEdit.bind(this)}
                        style="color: var(--dm-text-muted); padding: 2px;"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}

                  {this.showEmojiPicker && (
                    <div className="MessengerDock-emojiPicker">
                      {['❤️', '👍', '😂', '🔥', '🎉', '👏', '😍', '😢', '🙏', '✨'].map(emoji => (
                        <button 
                          className="MessengerDock-emojiBtn" 
                          onclick={() => this.newMessageContent += emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  <input type="file" id="MessengerDock-fileInput" style="display:none;" accept="image/*" onchange={this.handleImageSelected.bind(this)} />

                  <div className="MessengerDock-inputRow">
                    <button 
                      className="Button Button--icon Button--link" 
                      style={`color: ${this.showEmojiPicker ? '#0284c7' : 'var(--dm-text-subtle)'}; padding: 4px;`}
                      onclick={() => this.showEmojiPicker = !this.showEmojiPicker}
                    >
                      <i className="far fa-smile" style="font-size: 16px;"></i>
                    </button>

                    <button 
                      className="Button Button--icon Button--link" 
                      style={`padding: 4px; ${this.selectedImagePreview ? 'color: #0284c7;' : 'color: var(--dm-text-subtle);'}`}
                      onclick={this.triggerImageUpload.bind(this)}
                      title="Fotoğraf Ekle"
                    >
                      <i className="far fa-image" style="font-size: 16px;"></i>
                    </button>

                    <button 
                      className="Button Button--icon Button--link" 
                      style={`padding: 4px; ${this.isRecording ? 'color: red;' : 'color: var(--dm-text-subtle);'}`}
                      onclick={this.isRecording ? this.stopRecording.bind(this) : this.startRecording.bind(this)}
                    >
                      <i className={this.isRecording ? 'fas fa-stop-circle' : 'fas fa-microphone'} style="font-size: 16px;"></i>
                    </button>

                    <input 
                      type="text" 
                      className="MessengerDock-inputField" 
                      placeholder={this.isRecording ? 'Ses kaydediliyor...' : this.selectedImagePreview ? 'Fotoğrafa bir not ekle...' : 'Bir mesaj yazın...'}
                      value={this.newMessageContent}
                      oninput={e => this.newMessageContent = e.target.value}
                      onkeypress={e => { if (e.key === 'Enter') this.sendMessage(); }}
                    />

                    <button 
                      className="Button Button--icon Button--link MessengerDock-sendBtn" 
                      onclick={this.sendMessage.bind(this)}
                      disabled={!this.newMessageContent.trim() && !this.selectedImageFile}
                    >
                      <i className="fas fa-paper-plane"></i>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. ACTIVE GOOGLE MEET / SFU VIDEO & AUDIO MODAL */}
        {messengerState.activeMeeting && (
          <MeetingModal
            roomName={messengerState.activeMeeting.roomName}
            meetingTitle={messengerState.activeMeeting.meetingTitle}
            audioOnly={messengerState.activeMeeting.audioOnly}
            onClose={() => messengerState.closeMeeting()}
          />
        )}
      </div>
    );
  }
}
