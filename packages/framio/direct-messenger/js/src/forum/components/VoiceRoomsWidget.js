import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import ItemList from 'flarum/common/utils/ItemList';
import messengerState from '../states/messengerState';

export default class VoiceRoomsWidget extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    
    app.voiceRoomsWidget = this;

    this.isOpen = false;
    this.rooms = [];
    this.loading = true;
    this.activeRoomId = null;
    this.activeRoomData = null;
    this.isMuted = false;
    this.activeTab = 'text'; // 'text' | 'voice'

    // Text Channel States
    this.textChannels = [];
    this.selectedTextChannel = null;
    this.textMessages = [];
    this.loadingTextMessages = false;
    this.textMessageInput = '';
    this.sendingTextMessage = false;
    this.textPollInterval = null;

    // Text Channel Voice/Media Recording & Message Actions
    this.isRecordingAudio = false;
    this.audioMediaRecorder = null;
    this.audioChunks = [];
    this.isUploadingMedia = false;
    this.editingTextMessageId = null;
    this.editingTextMessageText = '';
    this.starredTextMessages = [];
    this.loadingStarredText = false;
    this.starredMode = null; // null | 'channel' | 'all'

    // Custom inline action menu state (replaces Flarum Dropdown — avoids positioning bugs)
    this.openActionMenuId = null; // msg.id of the message whose action popup is open

    // Sidebar collapse state (only relevant when a text channel is open)
    this.sidebarCollapsed = false;

    // Fullscreen mode state
    this.isFullscreen = false;

    // Custom WhatsApp-style Voice Message Player States
    this.playingAudioId = null;
    this.currentAudioObj = null;
    this.audioProgress = {}; // msgId -> { currentTime: 0, duration: 0, percent: 0 }
    
    // WebRTC Native Voice Mesh States
    this.localStream = null;
    this.peerConnections = {}; // targetUserId -> RTCPeerConnection
    this.remoteAudioEls = {}; // targetUserId -> HTMLAudioElement
    this.signalInterval = null;
    this.pendingSignals = [];
    this.knownParticipantIds = new Set();

    // Ice Servers: standard public STUN for NAT discovery (no 3rd party API, standard protocol)
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' }
      ]
    };
    
    this.loadRooms();
    this.loadTextChannels();
    
    // Periodic refresh of room participant list every 8 seconds
    this.reloadInterval = setInterval(() => this.loadRooms(false), 8000);
  }

  onremove(vnode) {
    super.onremove(vnode);
    clearInterval(this.reloadInterval);
    if (this.signalInterval) clearInterval(this.signalInterval);
    if (this.textPollInterval) clearInterval(this.textPollInterval);
    if (this.currentAudioObj) {
      this.currentAudioObj.pause();
      this.currentAudioObj = null;
    }
    if (this.activeRoomId) {
      this.leaveRoom();
    }
  }

  loadRooms(showLoading = true) {
    if (showLoading) this.loading = true;
    
    let url = app.forum.attribute('apiUrl') + '/voice-rooms';
    const tagSlug = this.getCurrentTagSlug();

    if (tagSlug) {
      url += '?tag_slug=' + encodeURIComponent(tagSlug);
    }
    
    app.request({
      method: 'GET',
      url: url
    }).then(response => {
      this.rooms = response.data || [];
      if (this.activeRoomId) {
        this.activeRoomData = this.rooms.find(r => String(r.id) === String(this.activeRoomId));
        this.checkParticipantChanges(this.activeRoomData);
      }
      if (showLoading) this.loading = false;
      m.redraw();
    }).catch(() => {
      if (showLoading) this.loading = false;
      m.redraw();
    });
  }

  checkParticipantChanges(roomData) {
    if (!roomData || !this.activeRoomId || !app.session || !app.session.user) return;
    const users = (roomData.attributes && roomData.attributes.users) ? roomData.attributes.users : [];
    const currentUserId = String(app.session.user.id());
    const currentRemoteIds = new Set(users.map(u => String(u.id)).filter(id => id !== currentUserId));

    if (this.knownParticipantIds.size > 0) {
      // Check if someone joined
      for (const id of currentRemoteIds) {
        if (!this.knownParticipantIds.has(id)) {
          this.playVoiceSound('connect');
          break;
        }
      }
      // Check if someone left
      for (const id of this.knownParticipantIds) {
        if (!currentRemoteIds.has(id)) {
          this.playVoiceSound('disconnect');
          break;
        }
      }
    }
    this.knownParticipantIds = currentRemoteIds;
  }

  loadTextChannels() {
    let url = app.forum.attribute('apiUrl') + '/text-channels';
    const discId = this.getCurrentDiscussionId();
    if (discId) {
      url += '?discussion_id=' + discId;
    }

    app.request({
      method: 'GET',
      url: url,
    }).then(response => {
      const raw = response.data || [];
      this.textChannels = raw.map(ch => {
        const attrs = ch.attributes || {};
        return {
          id: ch.id || attrs.id,
          name: ch.name || attrs.name || '',
          description: ch.description || attrs.description || '',
          icon: ch.icon || attrs.icon || 'fas fa-hashtag',
          sort_order: ch.sort_order || attrs.sortOrder || 0,
          is_active: ch.is_active !== undefined ? ch.is_active : (attrs.isActive !== undefined ? attrs.isActive : true),
          attributes: attrs
        };
      });
      m.redraw();
    }).catch(() => {});
  }

  getChannelVoiceRoom(channel) {
    if (!channel) return null;
    return this.rooms.find(r => r.attributes && String(r.attributes.channelId) === String(channel.id));
  }

  selectTextChannel(channel) {
    this.selectedTextChannel = channel;
    this.sidebarCollapsed = true; // User request: Soldaki menüden sohbet seçtiğimiz zaman, sol menü varsayılan olarak kapansın
    this.textMessages = [];
    this.loadingTextMessages = true;
    this.textMessageInput = '';

    if (this.textPollInterval) {
      clearInterval(this.textPollInterval);
      this.textPollInterval = null;
    }

    this.fetchTextMessages();
    this.loadRooms(false);

    // Poll messages every 2.5 seconds
    this.textPollInterval = setInterval(() => this.pollNewTextMessages(), 2500);
    m.redraw();
  }

  fetchTextMessages() {
    if (!this.selectedTextChannel) return;

    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + `/text-channels/${this.selectedTextChannel.id}/messages?limit=40`,
    }).then(response => {
      this.textMessages = response.data || [];
      this.loadingTextMessages = false;
      m.redraw();
      this.scrollMessagesToBottom();
    }).catch(() => {
      this.loadingTextMessages = false;
      m.redraw();
    });
  }

  pollNewTextMessages() {
    if (!this.selectedTextChannel || this.loadingTextMessages) return;

    const lastMsg = this.textMessages[this.textMessages.length - 1];
    const afterId = lastMsg ? lastMsg.id : 0;

    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + `/text-channels/${this.selectedTextChannel.id}/messages?after_id=${afterId}`,
    }).then(response => {
      const newMsgs = response.data || [];
      if (newMsgs.length > 0) {
        // Append unique messages
        const existingIds = new Set(this.textMessages.map(m => m.id));
        newMsgs.forEach(m => {
          if (!existingIds.has(m.id)) {
            this.textMessages.push(m);
          }
        });
        m.redraw();
        this.scrollMessagesToBottom();
      }
    }).catch(() => {});
  }

  sendTextMessage(e) {
    if (e) e.preventDefault();
    const text = (this.textMessageInput || '').trim();
    if (!text || !this.selectedTextChannel || this.sendingTextMessage) return;

    // Check if editing
    if (this.editingTextMessageId) {
      this.sendingTextMessage = true;
      app.request({
        method: 'PATCH',
        url: app.forum.attribute('apiUrl') + `/text-channel-messages/${this.editingTextMessageId}`,
        body: { message: text }
      }).then(response => {
        this.sendingTextMessage = false;
        this.editingTextMessageId = null;
        this.textMessageInput = '';
        if (response && response.data) {
          const idx = this.textMessages.findIndex(m => String(m.id) === String(response.data.id));
          if (idx !== -1) {
            this.textMessages[idx] = response.data;
          }
        }
        m.redraw();
      }).catch(err => {
        this.sendingTextMessage = false;
        alert((err.response && err.response.error) || 'Mesaj düzenlenemedi.');
        m.redraw();
      });
      return;
    }

    this.sendingTextMessage = true;
    const channelId = this.selectedTextChannel.id;

    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + `/text-channels/${channelId}/messages`,
      body: { message: text },
    }).then(response => {
      this.sendingTextMessage = false;
      this.textMessageInput = '';
      if (response && response.data) {
        const existingIds = new Set(this.textMessages.map(m => m.id));
        if (!existingIds.has(response.data.id)) {
          this.textMessages.push(response.data);
        }
      }
      m.redraw();
      this.scrollMessagesToBottom();
    }).catch(err => {
      this.sendingTextMessage = false;
      const msg = (err.response && err.response.error) || 'Mesaj gönderilemedi.';
      alert(msg);
      m.redraw();
    });
  }

  startEditTextMessage(msg) {
    this.editingTextMessageId = msg.id;
    this.textMessageInput = msg.message;
    m.redraw();
    setTimeout(() => {
      const input = document.getElementById('VoiceRooms-chatTextInput');
      if (input) {
        input.focus();
      }
    }, 50);
  }

  cancelEditTextMessage() {
    this.editingTextMessageId = null;
    this.textMessageInput = '';
    m.redraw();
  }

  deleteTextMessage(msg) {
    if (!confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;

    app.request({
      method: 'DELETE',
      url: app.forum.attribute('apiUrl') + `/text-channel-messages/${msg.id}`
    }).then(response => {
      if (response && response.data) {
        const idx = this.textMessages.findIndex(m => String(m.id) === String(response.data.id));
        if (idx !== -1) {
          this.textMessages[idx] = response.data;
        }
      }
      m.redraw();
    }).catch(err => {
      alert((err.response && err.response.error) || 'Mesaj silinemedi.');
    });
  }

  starTextMessage(msg) {
    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + `/text-channel-messages/${msg.id}/star`
    }).then(response => {
      if (response && response.data) {
        const idx = this.textMessages.findIndex(m => String(m.id) === String(response.data.id));
        if (idx !== -1) {
          this.textMessages[idx] = response.data;
        }
        // Also update in starred list if open
        const sIdx = this.starredTextMessages.findIndex(m => String(m.id) === String(response.data.id));
        if (sIdx !== -1) {
          if (!response.data.is_starred) {
            this.starredTextMessages.splice(sIdx, 1);
          } else {
            this.starredTextMessages[sIdx] = response.data;
          }
        }
      }
      m.redraw();
    }).catch(err => {
      alert((err.response && err.response.error) || 'İşlem başarısız.');
    });
  }

  uploadChannelMedia(file, type) {
    if (!this.selectedTextChannel || this.isUploadingMedia) return;

    this.isUploadingMedia = true;
    m.redraw();

    const formData = new FormData();
    formData.append('channel_id', this.selectedTextChannel.id);
    formData.append('type', type);
    formData.append('media', file);

    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + `/text-channels/${this.selectedTextChannel.id}/messages`,
      serialize: data => data,
      body: formData
    }).then(response => {
      this.isUploadingMedia = false;
      if (response && response.data) {
        const existingIds = new Set(this.textMessages.map(m => m.id));
        if (!existingIds.has(response.data.id)) {
          this.textMessages.push(response.data);
        }
      }
      m.redraw();
      this.scrollMessagesToBottom();
    }).catch(err => {
      this.isUploadingMedia = false;
      m.redraw();
      alert((err.response && err.response.error) || 'Dosya yüklenirken hata oluştu.');
    });
  }

  startAudioRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Tarayıcınız mikrofon kaydını desteklemiyor veya HTTPS gerektiriyor.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        this.isRecordingAudio = true;
        this.audioChunks = [];
        this.audioMediaRecorder = new MediaRecorder(stream);
        this.audioMediaRecorder.addEventListener('dataavailable', event => {
          this.audioChunks.push(event.data);
        });
        this.audioMediaRecorder.addEventListener('stop', () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.uploadChannelMedia(audioBlob, 'audio');
          stream.getTracks().forEach(track => track.stop());
        });
        this.audioMediaRecorder.start();
        m.redraw();
      })
      .catch(err => {
        alert('Mikrofon erişimi reddedildi: ' + err);
      });
  }

  stopAudioRecording() {
    if (this.audioMediaRecorder && this.isRecordingAudio) {
      this.audioMediaRecorder.stop();
      this.isRecordingAudio = false;
      m.redraw();
    }
  }

  triggerChannelMediaUpload(acceptType) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = acceptType;
    input.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      let type = 'image';
      if (file.type.startsWith('video/')) {
        type = 'video';
      } else if (file.type.startsWith('audio/')) {
        type = 'audio';
      }
      this.uploadChannelMedia(file, type);
    };
    input.click();
  }

  loadStarredTextMessages(channelOnly = false) {
    this.loadingStarredText = true;
    this.starredMode = channelOnly ? 'channel' : 'all';
    m.redraw();

    let url = app.forum.attribute('apiUrl') + '/starred-text-messages';
    if (channelOnly && this.selectedTextChannel) {
      url += `?channel_id=${this.selectedTextChannel.id}`;
    }

    app.request({
      method: 'GET',
      url: url
    }).then(response => {
      this.starredTextMessages = response.data || [];
      this.loadingStarredText = false;
      m.redraw();
    }).catch(() => {
      this.loadingStarredText = false;
      m.redraw();
    });
  }

  toggleVoicePlay(msg) {
    const msgId = msg.id;
    if (this.playingAudioId === msgId && this.currentAudioObj) {
      if (this.currentAudioObj.paused) {
        this.currentAudioObj.play();
      } else {
        this.currentAudioObj.pause();
      }
      m.redraw();
      return;
    }

    // Stop currently playing audio if any
    if (this.currentAudioObj) {
      this.currentAudioObj.pause();
      this.currentAudioObj = null;
    }

    this.playingAudioId = msgId;
    const audio = new Audio(msg.message);
    this.currentAudioObj = audio;

    if (!this.audioProgress[msgId]) {
      this.audioProgress[msgId] = { currentTime: 0, duration: 0, percent: 0 };
    }

    audio.addEventListener('loadedmetadata', () => {
      if (this.audioProgress[msgId]) {
        this.audioProgress[msgId].duration = audio.duration || 0;
        m.redraw();
      }
    });

    audio.addEventListener('timeupdate', () => {
      if (this.audioProgress[msgId] && audio.duration) {
        this.audioProgress[msgId].currentTime = audio.currentTime;
        this.audioProgress[msgId].duration = audio.duration;
        this.audioProgress[msgId].percent = (audio.currentTime / audio.duration) * 100;
        m.redraw();
      }
    });

    audio.addEventListener('ended', () => {
      if (this.audioProgress[msgId]) {
        this.audioProgress[msgId].currentTime = 0;
        this.audioProgress[msgId].percent = 0;
      }
      this.playingAudioId = null;
      this.currentAudioObj = null;
      m.redraw();
    });

    audio.play().catch(() => {});
    m.redraw();
  }

  seekVoiceAudio(msg, e) {
    const msgId = msg.id;
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));

    if (this.playingAudioId === msgId && this.currentAudioObj && this.currentAudioObj.duration) {
      this.currentAudioObj.currentTime = percent * this.currentAudioObj.duration;
      if (this.audioProgress[msgId]) {
        this.audioProgress[msgId].percent = percent * 100;
        this.audioProgress[msgId].currentTime = this.currentAudioObj.currentTime;
      }
      m.redraw();
    }
  }

  formatVoiceTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  closeStarredView() {
    this.starredMode = null;
    this.starredTextMessages = [];
    m.redraw();
  }

  scrollMessagesToBottom() {
    setTimeout(() => {
      const container = document.getElementById('VoiceRooms-messagesScroller');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  }

  closeTextChannel() {
    if (this.textPollInterval) {
      clearInterval(this.textPollInterval);
      this.textPollInterval = null;
    }
    this.selectedTextChannel = null;
    this.textMessages = [];
    m.redraw();
  }

  getCurrentTagSlug() {
    // 1. Try from route param 'slug'
    const routeSlug = m.route.param('slug');
    if (routeSlug) return routeSlug;

    // 2. Try from app.current.data.tag
    if (app.current && app.current.data && app.current.data.tag) {
      const t = app.current.data.tag;
      if (typeof t.slug === 'function') return t.slug();
      if (t.slug) return t.slug;
    }

    // 3. Try from app.current.data.discussion tags
    if (app.current && app.current.data && app.current.data.discussion) {
      const d = app.current.data.discussion;
      if (d.tags && typeof d.tags === 'function') {
        const tags = d.tags();
        if (tags && tags.length > 0) {
          // Parent tag or first tag
          const parentTag = tags.find(t => !t.parent || !t.parent());
          if (parentTag) return typeof parentTag.slug === 'function' ? parentTag.slug() : parentTag.slug;
          return typeof tags[0].slug === 'function' ? tags[0].slug() : tags[0].slug;
        }
      }
    }

    // 4. Try from URL path /t/{slug}
    const path = window.location.pathname || '';
    const match = path.match(/\/t\/([^/?#]+)/);
    if (match) return match[1];

    return null;
  }

  getCurrentDiscussionId() {
    // 1. Try from m.route.param('id')
    const routeId = m.route.param('id');
    if (routeId) {
      const match = String(routeId).match(/^(\d+)/);
      if (match) return match[1];
    }

    // 2. Try from app.current.data.discussion
    if (app.current && app.current.data && app.current.data.discussion) {
      const d = app.current.data.discussion;
      if (typeof d.id === 'function') return d.id();
      if (d.id) return d.id;
    }

    // 3. Try from URL path
    const path = window.location.pathname || '';
    const match = path.match(/\/d\/(\d+)/);
    if (match) return match[1];

    return null;
  }

  playVoiceSound(type) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      if (type === 'connect') {
        // Discord join sound: pleasant ascending dual-tone chime
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';

        osc1.frequency.setValueAtTime(440, now); // A4
        osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5

        osc2.frequency.setValueAtTime(554.37, now); // C#5
        osc2.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.3);
        osc2.stop(now + 0.3);
      } else if (type === 'disconnect') {
        // Discord leave sound: descending soft chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now); // E5
        osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.14); // E4

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.28);
      }
    } catch (e) {
      console.warn("Audio sound effect error:", e);
    }
  }

  joinRoom(room) {
    if (this.activeRoomId === room.id) return;
    
    if (this.activeRoomId) {
      this.leaveRoom();
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Tarayıcınız mikrofon kullanımına izin vermiyor veya bağlantınız HTTPS/localhost değil.");
      return;
    }

    // 1. Get user microphone stream directly
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        this.localStream = stream;
        this.activeRoomId = room.id;
        this.activeRoomData = room;

        // 2. Tell backend we joined this room
        this.playVoiceSound('connect');
        app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/voice-rooms/' + room.id + '/join'
        }).then(response => {
          if (response && response.data) {
            this.activeRoomData = response.data;
            const initialUsers = (this.activeRoomData.attributes && this.activeRoomData.attributes.users) ? this.activeRoomData.attributes.users : [];
            const curId = String(app.session.user.id());
            this.knownParticipantIds = new Set(initialUsers.map(u => String(u.id)).filter(id => id !== curId));
          }
          this.loadRooms(false);

          // 3. Connect to existing members in this room (mesh)
          const users = (room.attributes && room.attributes.users) ? room.attributes.users : [];
          const currentUserId = String(app.session.user.id());
          
          users.forEach(u => {
            const uid = String(u.id);
            if (uid !== currentUserId) {
              this.createPeerConnection(uid, true); // We are initiator
            }
          });

          // 4. Start internal signaling polling every 1.5s
          if (this.signalInterval) clearInterval(this.signalInterval);
          this.signalInterval = setInterval(() => this.syncSignals(), 1500);
          this.syncSignals(); // Immediate initial ping
        });

        m.redraw();
      })
      .catch(err => {
        console.error("Microphone error:", err);
        alert("Mikrofon açılamadı. Lütfen tarayıcı izinlerini kontrol edin.");
      });
  }

  createPeerConnection(targetUserId, isInitiator = false) {
    if (this.peerConnections[targetUserId]) {
      return this.peerConnections[targetUserId];
    }

    const pc = new RTCPeerConnection(this.rtcConfig);
    this.peerConnections[targetUserId] = pc;

    // Add our local audio track to the connection
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Handle ICE candidates generated by browser
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.queueSignal(targetUserId, 'ice-candidate', event.candidate);
      }
    };

    // When remote audio track arrives, play it directly in audio element
    pc.ontrack = (event) => {
      let audio = this.remoteAudioEls[targetUserId];
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.id = `webrtc-audio-${targetUserId}`;
        document.body.appendChild(audio);
        this.remoteAudioEls[targetUserId] = audio;
      }
      audio.srcObject = event.streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(targetUserId);
      }
    };

    // If initiator, create offer
    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true })
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          this.queueSignal(targetUserId, 'offer', pc.localDescription);
        })
        .catch(err => console.error("Error creating WebRTC offer:", err));
    }

    return pc;
  }

  queueSignal(targetUserId, type, data) {
    this.pendingSignals.push({
      target_id: targetUserId,
      type: type,
      data: data
    });
  }

  syncSignals() {
    if (!this.activeRoomId || !app.session || !app.session.user) return;

    const outgoing = [...this.pendingSignals];
    this.pendingSignals = [];

    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/voice-rooms/' + this.activeRoomId + '/signal',
      body: { signals: outgoing }
    }).then(response => {
      if (response && response.room) {
        this.activeRoomData = response.room;
        this.checkParticipantChanges(this.activeRoomData);
      }

      if (response && response.signals && Array.isArray(response.signals)) {
        response.signals.forEach(sig => {
          this.handleIncomingSignal(sig);
        });
      }
      m.redraw();
    }).catch(err => {
      // Re-queue signals on network glitch
      if (outgoing.length > 0) {
        this.pendingSignals = outgoing.concat(this.pendingSignals);
      }
    });
  }

  handleIncomingSignal(sig) {
    const senderId = String(sig.sender_id);
    const type = sig.type;
    const data = sig.data;

    let pc = this.peerConnections[senderId];

    if (type === 'offer') {
      if (!pc) {
        pc = this.createPeerConnection(senderId, false);
      }
      pc.setRemoteDescription(new RTCSessionDescription(data))
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
          this.queueSignal(senderId, 'answer', pc.localDescription);
        })
        .catch(err => console.error("Error handling WebRTC offer:", err));

    } else if (type === 'answer') {
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(data))
          .catch(err => console.error("Error setting remote answer:", err));
      }
    } else if (type === 'ice-candidate') {
      if (pc && data) {
        pc.addIceCandidate(new RTCIceCandidate(data))
          .catch(err => console.error("Error adding ICE candidate:", err));
      }
    }
  }

  closePeer(targetUserId) {
    const pc = this.peerConnections[targetUserId];
    if (pc) {
      pc.close();
      delete this.peerConnections[targetUserId];
    }
    const audio = this.remoteAudioEls[targetUserId];
    if (audio) {
      audio.remove();
      delete this.remoteAudioEls[targetUserId];
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
      });
    }
    m.redraw();
  }

  leaveRoom() {
    if (this.activeRoomId) {
      this.playVoiceSound('disconnect');
      app.request({
        method: 'DELETE',
        url: app.forum.attribute('apiUrl') + '/voice-rooms/leave'
      });
    }

    this.knownParticipantIds = new Set();

    if (this.signalInterval) {
      clearInterval(this.signalInterval);
      this.signalInterval = null;
    }

    // Close all WebRTC peers
    Object.keys(this.peerConnections).forEach(uid => this.closePeer(uid));
    this.peerConnections = {};
    this.pendingSignals = [];

    // Stop local microphone
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.activeRoomId = null;
    this.activeRoomData = null;
    this.isMuted = false;
    this.loadRooms(false);
    m.redraw();
  }

  togglePanel() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.loadRooms(false);
      this.loadTextChannels();
    }
    m.redraw();
  }

  view() {
    if (!app.session || !app.session.user) return null;

    const currentActiveRoom = this.rooms.find(r => String(r.id) === String(this.activeRoomId)) || this.activeRoomData;
    const channelVoiceRoom = this.selectedTextChannel ? this.getChannelVoiceRoom(this.selectedTextChannel) : null;
    const isChannelVoiceActive = channelVoiceRoom && String(this.activeRoomId) === String(channelVoiceRoom.id);
    const channelVoiceUsers = channelVoiceRoom && channelVoiceRoom.attributes && channelVoiceRoom.attributes.users ? channelVoiceRoom.attributes.users : [];

    return (
      <div className="VoiceRooms-root">
        {/* Floating Mini Bar when active & panel is closed */}
        {!this.isOpen && this.activeRoomId && currentActiveRoom && (
          <div 
            className="VoiceRooms-miniBar"
            onclick={() => this.togglePanel()}
            title="Odayı ve paneli aç"
          >
            <div className="VoiceRooms-miniBarInfo">
              <span className="VoiceRooms-miniPulse"></span>
              <i className="fas fa-volume-up"></i>
              <span className="VoiceRooms-miniName">{currentActiveRoom.attributes.name}</span>
            </div>
            <div className="VoiceRooms-miniActions" onclick={(e) => e.stopPropagation()}>
              <button 
                className={`VoiceRooms-miniBtn ${this.isMuted ? 'muted' : ''}`}
                onclick={() => this.toggleMute()}
                title={this.isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Sustur'}
              >
                <i className={this.isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone'}></i>
              </button>
              <button 
                className="VoiceRooms-miniBtn disconnect"
                onclick={() => this.leaveRoom()}
                title="Ayrıl"
              >
                <i className="fas fa-phone-slash"></i>
              </button>
            </div>
          </div>
        )}

        {/* Custom Community Lounge / Canlı Topluluk Merkezi */}
        {this.isOpen && (
          <div className={`VoiceRooms-panel ${this.selectedTextChannel ? 'has-active-chat' : ''} ${this.selectedTextChannel && this.sidebarCollapsed ? 'sidebar-collapsed' : ''} ${this.isFullscreen ? 'is-fullscreen' : ''}`}>
            {/* Sidebar / Hub Panel */}
            <div className={`VoiceRooms-sidebar ${this.selectedTextChannel && this.sidebarCollapsed ? 'is-hidden' : ''}`}>
              {/* Header */}
              <div className="VoiceRooms-panelHeader">
                <div className="VoiceRooms-panelTitle">
                  <div className="VoiceRooms-headerIconWrapper">
                    <i className="fas fa-satellite-dish"></i>
                  </div>
                  <div>
                    <span className="VoiceRooms-headerMainTitle">Topluluk Odaları</span>
                    <span className="VoiceRooms-headerSubTitle">Canlı Sohbet & Etkileşim</span>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <button 
                    className={`VoiceRooms-headerStarBtn ${this.starredMode === 'all' ? 'active' : ''}`}
                    onclick={() => {
                      if (this.starredMode === 'all') {
                        this.closeStarredView();
                      } else {
                        this.loadStarredTextMessages(false);
                      }
                    }}
                    title="Yıldızlı Kanal Mesajları"
                  >
                    <i className={this.starredMode === 'all' ? "fas fa-star" : "far fa-star"}></i>
                  </button>
                  <button 
                    className={`VoiceRooms-headerFullscreenBtn ${this.isFullscreen ? 'active' : ''}`}
                    onclick={() => {
                      this.isFullscreen = !this.isFullscreen;
                      m.redraw();
                    }}
                    title={this.isFullscreen ? 'Normal Boyuta Dön' : 'Tam Ekran Yap'}
                  >
                    <i className={this.isFullscreen ? 'fas fa-compress-arrows-alt' : 'fas fa-expand-arrows-alt'}></i>
                  </button>
                  <button 
                    className="VoiceRooms-closeBtn"
                    onclick={() => this.togglePanel()}
                    title="Kapat"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>

              {/* Segmented Tab Switcher */}
              <div className="VoiceRooms-tabs">
                <button
                  type="button"
                  className={`VoiceRooms-tabBtn ${this.activeTab === 'text' && !this.starredMode ? 'active' : ''}`}
                  onclick={() => {
                    this.activeTab = 'text';
                    this.starredMode = null;
                    m.redraw();
                  }}
                >
                  <i className="fas fa-comments"></i>
                  <span>Metin Kanalları</span>
                  {this.textChannels.length > 0 && (
                    <span className="VoiceRooms-tabCounter">{this.textChannels.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`VoiceRooms-tabBtn ${this.activeTab === 'voice' && !this.starredMode ? 'active' : ''}`}
                  onclick={() => {
                    this.activeTab = 'voice';
                    this.starredMode = null;
                    m.redraw();
                  }}
                >
                  <i className="fas fa-headphones-alt"></i>
                  <span>Sesli Odalar</span>
                  {this.rooms.length > 0 && (
                    <span className="VoiceRooms-tabCounter">{this.rooms.length}</span>
                  )}
                </button>
              </div>

              {/* Content List Area */}
              <div className="VoiceRooms-list">
                {/* TAB 3: YILDIZLANAN MESAJLAR LİSTESİ */}
                {this.starredMode && (
                  <div className="VoiceRooms-sectionContent">
                    <div className="VoiceRooms-sectionBanner" style="display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <i className="fas fa-star" style="color: #fadb14; margin-right: 6px;"></i>
                        <span>{this.starredMode === 'channel' && this.selectedTextChannel ? `${this.selectedTextChannel.name} Yıldızlı Mesajları` : 'Tüm Yıldızlı Kanal Mesajlarınız'}</span>
                      </div>
                      <button 
                        className="Button Button--link Button--icon" 
                        onclick={() => this.closeStarredView()}
                        style="color: inherit; opacity: 0.8;"
                        title="Listeye Dön"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>

                    {this.loadingStarredText ? (
                      <div style="padding: 30px; text-align: center;"><LoadingIndicator /></div>
                    ) : this.starredTextMessages.length === 0 ? (
                      <div className="VoiceRooms-emptyState">
                        <i className="far fa-star"></i>
                        <p>Henüz yıldızladığınız bir mesaj bulunmuyor.</p>
                      </div>
                    ) : (
                      <div className="VoiceRooms-cardsGrid">
                        {this.starredTextMessages.map(msg => {
                          const user = msg.user;
                          const isMine = String(msg.user_id) === String(app.session.user.id());
                          return (
                            <div key={msg.id} className="VoiceRooms-starredCard">
                              <div className="VoiceRooms-starredHeader">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                  <div className="VoiceRooms-messageAvatar" style="width: 24px; height: 24px; font-size: 10px;">
                                    {user && user.avatar_url ? (
                                      <img src={user.avatar_url} />
                                    ) : (
                                      <span>{(user && (user.display_name || user.username) ? (user.display_name || user.username)[0] : 'U').toUpperCase()}</span>
                                    )}
                                  </div>
                                  <span style="font-weight: 700; font-size: 12px; color: var(--dm-text);">
                                    {user ? (user.display_name || user.username) : 'Anonim'}
                                  </span>
                                  {msg.channel_name && (
                                    <span className="VoiceRooms-starredChannelBadge">
                                      <i className="fas fa-hashtag" style="font-size: 9px; margin-right: 3px;"></i>
                                      {msg.channel_name}
                                    </span>
                                  )}
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                  <span style="font-size: 11px; color: var(--dm-text-subtle);">{msg.created_at_human}</span>
                                  <button
                                    className="Button Button--icon Button--link"
                                    onclick={() => this.starTextMessage(msg)}
                                    title="Yıldızı Kaldır"
                                    style="color: #fadb14; padding: 2px;"
                                  >
                                    <i className="fas fa-star"></i>
                                  </button>
                                </div>
                              </div>
                              <div className="VoiceRooms-starredBody">
                                {msg.msg_type === 'image' ? (
                                  <img src={msg.message} style="max-width: 100%; max-height: 180px; border-radius: 8px; cursor: pointer;" onclick={() => window.open(msg.message, '_blank')} />
                                ) : msg.msg_type === 'audio' ? (
                                  (() => {
                                    const isPlaying = this.playingAudioId === msg.id && this.currentAudioObj && !this.currentAudioObj.paused;
                                    const progress = this.audioProgress[msg.id] || { currentTime: 0, duration: 0, percent: 0 };
                                    const displayTime = isPlaying && progress.currentTime > 0 
                                      ? this.formatVoiceTime(progress.currentTime) 
                                      : (progress.duration > 0 ? this.formatVoiceTime(progress.duration) : 'Ses Kaydı');

                                    return (
                                      <div className="VoiceRooms-voiceNotePlayer" style="padding: 0;">
                                        <button
                                          type="button"
                                          className={`VoiceRooms-voicePlayBtn ${isPlaying ? 'playing' : ''}`}
                                          onclick={(e) => { e.stopPropagation(); this.toggleVoicePlay(msg); }}
                                          title={isPlaying ? "Durdur" : "Dinle"}
                                        >
                                          <i className={isPlaying ? "fas fa-pause" : "fas fa-play"}></i>
                                        </button>
                                        <div className="VoiceRooms-voiceTrackWrap">
                                          <div 
                                            className="VoiceRooms-voiceProgressBar"
                                            onclick={(e) => { e.stopPropagation(); this.seekVoiceAudio(msg, e); }}
                                          >
                                            <div className="VoiceRooms-voiceProgressFill" style={{ width: `${progress.percent}%` }}></div>
                                            <div className="VoiceRooms-voiceProgressPin" style={{ left: `${progress.percent}%` }}></div>
                                          </div>
                                          <div className="VoiceRooms-voiceTrackMeta">
                                            <span className="VoiceRooms-voiceTimeText">{displayTime}</span>
                                            <span className="VoiceRooms-voiceWaveIcon"><i className="fas fa-wave-square"></i></span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()
                                ) : msg.msg_type === 'video' ? (
                                  <video controls src={msg.message} style="max-width: 100%; max-height: 200px; border-radius: 8px;"></video>
                                ) : (
                                  <span>{msg.message}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 1: METİN KANALLARI */}
                {!this.starredMode && this.activeTab === 'text' && (
                  <div className="VoiceRooms-sectionContent">
                    <div className="VoiceRooms-sectionBanner">
                      <i className="fas fa-info-circle"></i>
                      <span>Konu bazlı anlık metin kanalları. Bir kanala tıklayarak sohbete katılın.</span>
                    </div>

                    {this.textChannels.length === 0 ? (
                      <div className="VoiceRooms-emptyState">
                        <i className="fas fa-comment-slash"></i>
                        <p>Henüz aktif metin kanalı bulunmuyor.</p>
                      </div>
                    ) : (
                      <div className="VoiceRooms-cardsGrid">
                        {this.textChannels.map(ch => {
                          const isSelected = this.selectedTextChannel && this.selectedTextChannel.id === ch.id;
                          const vRoom = this.getChannelVoiceRoom(ch);
                          const vUsers = vRoom && vRoom.attributes && vRoom.attributes.users ? vRoom.attributes.users : [];
                          const isVoiceInThisChannel = vRoom && String(this.activeRoomId) === String(vRoom.id);

                          return (
                            <div 
                              key={ch.id}
                              className={`VoiceRooms-channelCard ${isSelected ? 'active' : ''}`}
                              onclick={() => this.selectTextChannel(ch)}
                            >
                              <div className="VoiceRooms-channelCardLeft">
                                <div className="VoiceRooms-channelIconBox">
                                  <i className={ch.icon || 'fas fa-hashtag'}></i>
                                </div>
                                <div className="VoiceRooms-channelMeta">
                                  <div style="display: flex; align-items: center; gap: 6px;">
                                    <span className="VoiceRooms-channelTitle">{ch.name}</span>
                                    {vUsers.length > 0 && (
                                      <span className={`VoiceRooms-channelVoicePill ${isVoiceInThisChannel ? 'in-call' : ''}`} title={`${vUsers.length} kişi sesli sohbette`}>
                                        <i className="fas fa-volume-up"></i> {vUsers.length}
                                      </span>
                                    )}
                                  </div>
                                  {ch.description ? (
                                    <span className="VoiceRooms-channelDesc">{ch.description}</span>
                                  ) : (
                                    <span className="VoiceRooms-channelDesc subtle">Genel sohbet kanalı</span>
                                  )}
                                </div>
                              </div>
                              <div className="VoiceRooms-channelAction">
                                <i className="fas fa-chevron-right"></i>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: SESLİ ODALAR */}
                {!this.starredMode && this.activeTab === 'voice' && (
                  <div className="VoiceRooms-sectionContent">
                    <div className="VoiceRooms-sectionBanner">
                      <i className="fas fa-microphone-alt"></i>
                      <span>Doğrudan tarayıcı üzerinden eşler arası canlı sesli iletişim.</span>
                    </div>

                    {this.loading ? (
                      <div style="padding: 24px; text-align: center;"><LoadingIndicator /></div>
                    ) : this.rooms.length === 0 ? (
                      <div className="VoiceRooms-emptyState">
                        <i className="fas fa-headset"></i>
                        <p>Kullanılabilir sesli oda bulunmuyor.</p>
                      </div>
                    ) : (
                      <div className="VoiceRooms-cardsGrid">
                        {this.rooms.map(room => {
                          const isActive = String(this.activeRoomId) === String(room.id);
                          const users = room.attributes && room.attributes.users ? room.attributes.users : [];
                          const isTag = !!room.attributes.tagId;
                          const isChannel = !!room.attributes.channelId;

                          return (
                            <div 
                              key={room.id}
                              className={`VoiceRooms-voiceCard ${isActive ? 'active' : ''} ${isTag ? 'tag-bound' : ''} ${isChannel ? 'channel-bound' : ''}`}
                            >
                              <div className="VoiceRooms-voiceCardHeader" onclick={() => this.joinRoom(room)}>
                                <div className="VoiceRooms-voiceCardLeft">
                                  <div className={`VoiceRooms-voiceIconBox ${isActive ? 'in-call' : ''}`}>
                                    <i className={isActive ? 'fas fa-volume-up' : (room.attributes.icon || 'fas fa-users')}></i>
                                  </div>
                                  <div className="VoiceRooms-voiceMeta">
                                    <div className="VoiceRooms-voiceNameRow">
                                      <span className="VoiceRooms-voiceTitle">{room.attributes.name}</span>
                                      {isTag && (
                                        <span className="VoiceRooms-topicTag tag-tag">Kategori Odası</span>
                                      )}
                                      {isChannel && (
                                        <span className="VoiceRooms-topicTag channel-tag">Kanal Odası</span>
                                      )}
                                    </div>
                                    <span className="VoiceRooms-voiceStatus">
                                      {isActive ? (
                                        <strong style="color: var(--primary-color);">● Odadasınız</strong>
                                      ) : users.length > 0 ? (
                                        `${users.length} kişi aktif`
                                      ) : (
                                        'Oda boş'
                                      )}
                                    </span>
                                  </div>
                                </div>

                                <div className="VoiceRooms-voiceCardBtn">
                                  <button 
                                    className={`VoiceRooms-joinBtn ${isActive ? 'active' : ''}`}
                                    onclick={(e) => {
                                      e.stopPropagation();
                                      if (isActive) {
                                        this.leaveRoom();
                                      } else {
                                        this.joinRoom(room);
                                      }
                                    }}
                                  >
                                    {isActive ? 'Ayrıl' : 'Katıl'}
                                  </button>
                                </div>
                              </div>

                              {/* Participants Avatar Deck */}
                              {users.length > 0 && (
                                <div className="VoiceRooms-participantsDeck">
                                  <div className="VoiceRooms-avatarPile">
                                    {users.slice(0, 5).map(u => {
                                      const isCurrent = String(u.id) === String(app.session.user.id());
                                      return (
                                        <div 
                                          key={u.id}
                                          className={`VoiceRooms-deckAvatar ${isActive && isCurrent ? 'speaking' : ''}`}
                                          title={u.displayName || u.username}
                                        >
                                          {u.avatarUrl ? (
                                            <img src={u.avatarUrl} alt={u.username} />
                                          ) : (
                                            <span>{(u.displayName || u.username || 'U')[0].toUpperCase()}</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                    {users.length > 5 && (
                                      <div className="VoiceRooms-deckAvatar more">
                                        +{users.length - 5}
                                      </div>
                                    )}
                                  </div>
                                  <span className="VoiceRooms-participantNames">
                                    {users.map(u => u.displayName || u.username).slice(0, 2).join(', ')}
                                    {users.length > 2 ? ` ve ${users.length - 2} kişi daha` : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Connected Bar */}
              {this.activeRoomId && currentActiveRoom && (
                <div className="VoiceRooms-connectionBar">
                  <div className="VoiceRooms-connStatus">
                    <div className="VoiceRooms-connBadge">
                      <span className="VoiceRooms-liveDot"></span>
                      <span>Sesli Bağlantı Aktif</span>
                    </div>
                    <div className="VoiceRooms-connRoomName">
                      {currentActiveRoom.attributes.name}
                    </div>
                  </div>

                  <div className="VoiceRooms-connActions">
                    <button 
                      className={`VoiceRooms-ctrlBtn ${this.isMuted ? 'muted' : ''}`}
                      title={this.isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Sustur'}
                      onclick={() => this.toggleMute()}
                    >
                      <i className={this.isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone'}></i>
                    </button>
                    <button 
                      className="VoiceRooms-ctrlBtn disconnect"
                      title="Bağlantıyı Kes"
                      onclick={() => this.leaveRoom()}
                    >
                      <i className="fas fa-phone-slash"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Active Text Chat Pane */}
            {this.selectedTextChannel && (
              <div className="VoiceRooms-chatPane">
                {/* Chat Header */}
                <div className="VoiceRooms-chatHeader">
                  <div className="VoiceRooms-chatChannelInfo">
                    <button 
                      className="VoiceRooms-mobileBackBtn"
                      onclick={() => this.closeTextChannel()}
                      title="Kanallara Geri Dön"
                    >
                      <i className="fas fa-arrow-left"></i>
                    </button>
                    <div className="VoiceRooms-chatHeaderIcon">
                      <i className={this.selectedTextChannel.icon || 'fas fa-hashtag'}></i>
                    </div>
                    <div>
                      <span className="VoiceRooms-chatChannelName">{this.selectedTextChannel.name}</span>
                      {this.selectedTextChannel.description && (
                        <div className="VoiceRooms-chatChannelDesc">{this.selectedTextChannel.description}</div>
                      )}
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <button
                      className={`VoiceRooms-chatActionBtn ${this.starredMode === 'channel' ? 'active' : ''}`}
                      onclick={() => {
                        if (this.starredMode === 'channel') {
                          this.closeStarredView();
                        } else {
                          this.loadStarredTextMessages(true);
                        }
                      }}
                      title="Bu Kanalın Yıldızlı Mesajları"
                    >
                      <i className={this.starredMode === 'channel' ? "fas fa-star" : "far fa-star"}></i>
                    </button>

                    {/* Native Forum WebRTC Voice Room Button */}
                    {channelVoiceRoom && (
                      <button
                        className={`VoiceRooms-chatActionBtn ${isChannelVoiceActive ? 'active in-voice' : (channelVoiceUsers.length > 0 ? 'has-voice-users' : '')}`}
                        onclick={() => {
                          if (isChannelVoiceActive) {
                            this.leaveRoom();
                          } else {
                            this.joinRoom(channelVoiceRoom);
                          }
                        }}
                        title={isChannelVoiceActive ? 'Sesli Sohbetten Ayrıl' : (channelVoiceUsers.length > 0 ? `${channelVoiceUsers.length} kişi seslide — Sohbete Katıl` : 'Sesli Sohbete Katıl')}
                      >
                        <i className={isChannelVoiceActive ? "fas fa-phone-slash" : "fas fa-headset"}></i>
                        {channelVoiceUsers.length > 0 && !isChannelVoiceActive && (
                          <span className="VoiceRooms-headerVoiceBadge">{channelVoiceUsers.length}</span>
                        )}
                      </button>
                    )}

                    <button
                      className={`VoiceRooms-chatActionBtn VoiceRooms-desktopOnly ${this.sidebarCollapsed ? 'active' : ''}`}
                      onclick={() => { this.sidebarCollapsed = !this.sidebarCollapsed; m.redraw(); }}
                      title={this.sidebarCollapsed ? 'Kanal Listesini Göster' : 'Kanal Listesini Gizle'}
                    >
                      <i className={this.sidebarCollapsed ? 'fas fa-indent' : 'fas fa-outdent'}></i>
                    </button>
                    <button
                      className={`VoiceRooms-chatActionBtn ${this.isFullscreen ? 'active' : ''}`}
                      onclick={() => { this.isFullscreen = !this.isFullscreen; m.redraw(); }}
                      title={this.isFullscreen ? 'Normal Boyuta Dön' : 'Tam Ekran Yap'}
                    >
                      <i className={this.isFullscreen ? 'fas fa-compress-arrows-alt' : 'fas fa-expand-arrows-alt'}></i>
                    </button>
                    <button 
                      className="VoiceRooms-chatCloseBtn"
                      onclick={() => this.closeTextChannel()}
                      title="Sohbeti Kapat"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                </div>

                {/* Embedded In-Chat Native Voice Bar */}
                {channelVoiceRoom && (isChannelVoiceActive || channelVoiceUsers.length > 0) && (
                  <div className={`VoiceRooms-channelVoiceBar ${isChannelVoiceActive ? 'is-connected' : 'is-available'}`}>
                    <div className="VoiceRooms-channelVoiceLeft">
                      <div className="VoiceRooms-channelVoiceStatus">
                        <span className={`VoiceRooms-voicePulseDot ${isChannelVoiceActive ? 'live' : ''}`}></span>
                        <span className="VoiceRooms-voiceStatusText">
                          {isChannelVoiceActive ? 'Sesli Sohbet Aktif' : 'Kanalda Sesli Sohbet Var'}
                        </span>
                        <span className="VoiceRooms-voiceCountBadge">
                          <i className="fas fa-user-friends" style="font-size: 10px; margin-right: 4px;"></i>
                          {channelVoiceUsers.length}
                        </span>
                      </div>

                      {/* Participant Avatars */}
                      <div className="VoiceRooms-channelVoiceAvatars">
                        {channelVoiceUsers.slice(0, 6).map(u => {
                          const isMe = String(u.id) === String(app.session.user.id());
                          return (
                            <div
                              key={u.id}
                              className={`VoiceRooms-voiceAvatarMini ${isMe && !this.isMuted ? 'speaking' : ''}`}
                              title={`${u.displayName || u.username}${isMe ? ' (Siz)' : ''}`}
                            >
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} alt={u.username} />
                              ) : (
                                <span>{(u.displayName || u.username || 'U')[0].toUpperCase()}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick Controls */}
                    <div className="VoiceRooms-channelVoiceActions">
                      {isChannelVoiceActive ? (
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <button
                            type="button"
                            className={`VoiceRooms-voiceMiniCtrl ${this.isMuted ? 'muted' : ''}`}
                            onclick={() => this.toggleMute()}
                            title={this.isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Sustur'}
                          >
                            <i className={this.isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone'}></i>
                            <span>{this.isMuted ? 'Aç' : 'Sustur'}</span>
                          </button>
                          <button
                            type="button"
                            className="VoiceRooms-voiceMiniCtrl disconnect"
                            onclick={() => this.leaveRoom()}
                            title="Ayrıl"
                          >
                            <i className="fas fa-phone-slash"></i>
                            <span>Ayrıl</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="VoiceRooms-voiceMiniCtrl join"
                          onclick={() => this.joinRoom(channelVoiceRoom)}
                        >
                          <i className="fas fa-headset"></i>
                          <span>Sohbete Katıl</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Message Log */}
                <div className="VoiceRooms-messagesContainer" id="VoiceRooms-messagesScroller">
                  {this.loadingTextMessages ? (
                    <div style="padding: 40px; text-align: center;"><LoadingIndicator /></div>
                  ) : this.textMessages.length === 0 ? (
                    <div className="VoiceRooms-messagesEmpty">
                      <div className="VoiceRooms-emptyIcon"><i className="fas fa-comments"></i></div>
                      <div className="VoiceRooms-emptyTitle">Sohbet Başlasın!</div>
                      <div className="VoiceRooms-emptySub">{this.selectedTextChannel.name} kanalında ilk mesajı siz paylaşın.</div>
                    </div>
                  ) : (
                    this.textMessages.map(msg => {
                      const isMe = String(msg.user_id) === String(app.session.user.id());
                      const user = msg.user;
                      const isStarred = !!msg.is_starred;
                      const isDeleted = !!msg.is_deleted;
                      const isEdited = !!msg.is_edited;
                      const type = msg.msg_type || 'text';

                      let messageContent = null;
                      if (isDeleted) {
                        messageContent = <span className="VoiceRooms-deletedText"><i className="fas fa-ban"></i> Bu mesaj silindi.</span>;
                      } else if (type === 'image') {
                        messageContent = (
                          <div className="VoiceRooms-mediaWrap">
                            <img src={msg.message} alt="Fotoğraf" onclick={() => window.open(msg.message, '_blank')} />
                          </div>
                        );
                      } else if (type === 'audio') {
                        const isPlaying = this.playingAudioId === msg.id && this.currentAudioObj && !this.currentAudioObj.paused;
                        const progress = this.audioProgress[msg.id] || { currentTime: 0, duration: 0, percent: 0 };
                        const displayTime = isPlaying && progress.currentTime > 0 
                          ? this.formatVoiceTime(progress.currentTime) 
                          : (progress.duration > 0 ? this.formatVoiceTime(progress.duration) : 'Ses Kaydı');

                        messageContent = (
                          <div className="VoiceRooms-voiceNotePlayer">
                            <button
                              type="button"
                              className={`VoiceRooms-voicePlayBtn ${isPlaying ? 'playing' : ''}`}
                              onclick={(e) => { e.stopPropagation(); this.toggleVoicePlay(msg); }}
                              title={isPlaying ? "Durdur" : "Dinle"}
                            >
                              <i className={isPlaying ? "fas fa-pause" : "fas fa-play"}></i>
                            </button>

                            <div className="VoiceRooms-voiceTrackWrap">
                              <div 
                                className="VoiceRooms-voiceProgressBar"
                                onclick={(e) => { e.stopPropagation(); this.seekVoiceAudio(msg, e); }}
                              >
                                <div className="VoiceRooms-voiceProgressFill" style={{ width: `${progress.percent}%` }}></div>
                                <div className="VoiceRooms-voiceProgressPin" style={{ left: `${progress.percent}%` }}></div>
                              </div>
                              <div className="VoiceRooms-voiceTrackMeta">
                                <span className="VoiceRooms-voiceTimeText">{displayTime}</span>
                                <span className="VoiceRooms-voiceWaveIcon"><i className="fas fa-wave-square"></i></span>
                              </div>
                            </div>
                          </div>
                        );
                      } else if (type === 'video') {
                        messageContent = (
                          <div className="VoiceRooms-videoWrap">
                            <video controls src={msg.message}></video>
                          </div>
                        );
                      } else if (type === 'post_share') {
                        let postData = {};
                        try {
                          postData = typeof msg.message === 'string' ? JSON.parse(msg.message) : msg.message;
                        } catch (e) {
                          postData = {};
                        }

                        const targetUrl = postData.url || (postData.postId ? `/d/${postData.postId}` : '#');

                        messageContent = (
                          <div className="VoiceRooms-sharedPostCard">
                            <a 
                              href={targetUrl} 
                              className="VoiceRooms-sharedPostLink"
                              onclick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <div className="VoiceRooms-sharedPostHeader">
                                <i className="far fa-newspaper"></i>
                                <span className="VoiceRooms-sharedPostTitle">
                                  {postData.title || 'Paylaşılan Gönderi'}
                                </span>
                                <i className="fas fa-external-link-alt VoiceRooms-externalIcon"></i>
                              </div>

                              {postData.imageUrl && (
                                <div className="VoiceRooms-sharedPostImage">
                                  <img src={postData.imageUrl} alt="Gönderi Resmi" />
                                </div>
                              )}

                              {postData.excerpt && (
                                <div className="VoiceRooms-sharedPostExcerpt">
                                  {postData.excerpt}
                                </div>
                              )}
                            </a>

                            {postData.userMessage && (
                              <div className="VoiceRooms-sharedPostUserNote">
                                <i className="far fa-comment-dots"></i>
                                <span>{postData.userMessage}</span>
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        messageContent = <div className="VoiceRooms-textBody">{msg.message}</div>;
                      }

                      const isActionMenuOpen = this.openActionMenuId === msg.id;


                      return (
                        <div className={`VoiceRooms-messageItem ${isMe ? 'is-me' : 'is-other'}`} key={msg.id}
                          onclick={(e) => {
                            // Close action menu if click is outside
                            if (this.openActionMenuId && !e.target.closest('.VoiceRooms-inlineActionMenu') && !e.target.closest('.VoiceRooms-moreBtn')) {
                              this.openActionMenuId = null;
                              m.redraw();
                            }
                          }}
                        >
                          {/* Discord-style Avatar */}
                          <div
                            className={`VoiceRooms-messageAvatar ${!isMe ? 'is-clickable' : ''}`}
                            onclick={!isMe && user ? (e) => {
                              e.stopPropagation();
                              messengerState.openWithUser({ id: user.id || msg.user_id, username: user.username });
                            } : undefined}
                            title={!isMe && user ? `${user.display_name || user.username} ile özel mesajlaş` : undefined}
                          >
                            {user && user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.display_name || user.username} />
                            ) : (
                              <span>{(user && (user.display_name || user.username) ? (user.display_name || user.username)[0] : 'U').toUpperCase()}</span>
                            )}
                          </div>

                          {/* Discord-style Message Body Column */}
                          <div className="VoiceRooms-messageContentWrap">
                            {/* Author & Header Row */}
                            <div className="VoiceRooms-messageHeader">
                              <span
                                className={`VoiceRooms-messageAuthor ${!isMe ? 'is-clickable' : ''}`}
                                onclick={!isMe && user ? (e) => {
                                  e.stopPropagation();
                                  messengerState.openWithUser({ id: user.id || msg.user_id, username: user.username });
                                } : undefined}
                              >
                                {user ? (user.display_name || user.username) : 'Anonim'}
                              </span>
                              {isMe && <span className="VoiceRooms-authorSelfTag">Siz</span>}
                              <span className="VoiceRooms-messageTimestamp">{msg.created_at_human}</span>
                              {isEdited && <span className="VoiceRooms-editedBadge">(düzenlendi)</span>}
                              {isStarred && (
                                <span className="VoiceRooms-starInline" title="Yıldızlı mesaj">
                                  <i className="fas fa-star"></i>
                                </span>
                              )}
                            </div>

                            {/* Main Content (Text, Image, Audio, Video, Shared Post) */}
                            <div className="VoiceRooms-messageBody">
                              {messageContent}
                            </div>
                          </div>

                          {/* Discord-style Floating Action Bar on message hover */}
                          {!isDeleted && (
                            <div className="VoiceRooms-messageActionsBar">
                              <button
                                type="button"
                                className={`VoiceRooms-actionQuickBtn ${isStarred ? 'starred' : ''}`}
                                onclick={(e) => { e.stopPropagation(); this.starTextMessage(msg); }}
                                title={isStarred ? 'Yıldızı Kaldır' : 'Yıldızla'}
                              >
                                <i className={isStarred ? "fas fa-star" : "far fa-star"}></i>
                              </button>
                              {isMe && type === 'text' && (
                                <button
                                  type="button"
                                  className="VoiceRooms-actionQuickBtn"
                                  onclick={(e) => { e.stopPropagation(); this.startEditTextMessage(msg); }}
                                  title="Düzenle"
                                >
                                  <i className="fas fa-pencil-alt"></i>
                                </button>
                              )}
                              {isMe && (
                                <button
                                  type="button"
                                  className="VoiceRooms-actionQuickBtn danger"
                                  onclick={(e) => { e.stopPropagation(); this.deleteTextMessage(msg); }}
                                  title="Sil"
                                >
                                  <i className="fas fa-trash-alt"></i>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Edit Message Banner */}
                {this.editingTextMessageId && (
                  <div className="VoiceRooms-editBanner">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <i className="fas fa-pencil-alt" style="color: var(--primary-color);"></i>
                      <span>Mesajı düzenliyorsunuz</span>
                    </div>
                    <button className="Button Button--icon Button--link" onclick={() => this.cancelEditTextMessage()}>
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                )}

                {/* Audio Recording Active Bar */}
                {this.isRecordingAudio && (
                  <div className="VoiceRooms-recordingBar">
                    <div className="VoiceRooms-recordingBadge">
                      <span className="VoiceRooms-liveDot"></span>
                      <span>Ses kaydediliyor...</span>
                    </div>
                    <button className="Button Button--danger VoiceRooms-stopRecordBtn" onclick={() => this.stopAudioRecording()}>
                      <i className="fas fa-stop"></i> Kaydı Tamamla & Gönder
                    </button>
                  </div>
                )}

                {/* Message Input Box with Multimedia Attachments */}
                <form className="VoiceRooms-chatInputForm" onsubmit={(e) => this.sendTextMessage(e)}>
                  <div className="VoiceRooms-chatInputWrap">
                    {/* Media Attachment Buttons */}
                    <div className="VoiceRooms-chatAttachGroup">
                      <button
                        type="button"
                        className="VoiceRooms-chatAttachBtn"
                        onclick={() => this.triggerChannelMediaUpload('image/*')}
                        title="Fotoğraf Gönder"
                        disabled={this.sendingTextMessage || this.isUploadingMedia || this.isRecordingAudio}
                      >
                        <i className="far fa-image"></i>
                      </button>
                      <button
                        type="button"
                        className="VoiceRooms-chatAttachBtn"
                        onclick={() => this.triggerChannelMediaUpload('video/*')}
                        title="Video Gönder"
                        disabled={this.sendingTextMessage || this.isUploadingMedia || this.isRecordingAudio}
                      >
                        <i className="fas fa-video"></i>
                      </button>
                      <button
                        type="button"
                        className={`VoiceRooms-chatAttachBtn ${this.isRecordingAudio ? 'active-record' : ''}`}
                        onclick={() => this.startAudioRecording()}
                        title="Sesli Mesaj Kaydet"
                        disabled={this.sendingTextMessage || this.isUploadingMedia || this.isRecordingAudio}
                      >
                        <i className="fas fa-microphone"></i>
                      </button>
                    </div>

                    <input
                      id="VoiceRooms-chatTextInput"
                      type="text"
                      className="VoiceRooms-chatInput"
                      placeholder={this.isUploadingMedia ? 'Medya yükleniyor...' : `Mesaj yaz... (${this.selectedTextChannel.name})`}
                      value={this.textMessageInput}
                      oninput={(e) => this.textMessageInput = e.target.value}
                      disabled={this.sendingTextMessage || this.isUploadingMedia || this.isRecordingAudio}
                    />
                    <button
                      type="submit"
                      className="VoiceRooms-chatSendBtn"
                      disabled={!this.textMessageInput || !this.textMessageInput.trim() || this.sendingTextMessage || this.isUploadingMedia}
                      title={this.editingTextMessageId ? "Kaydet" : "Gönder"}
                    >
                      <i className={this.editingTextMessageId ? "fas fa-check" : "fas fa-paper-plane"}></i>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}
