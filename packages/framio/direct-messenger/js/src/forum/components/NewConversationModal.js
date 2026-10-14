import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Stream from 'flarum/common/utils/Stream';
import Avatar from 'flarum/common/components/Avatar';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import messengerState from '../states/messengerState';

export default class NewConversationModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);

    this.targetType = 'users'; // 'users' | 'channels'
    this.searchQuery = Stream('');
    this.searchResults = [];
    this.suggestedUsers = [];
    this.loading = false;
    this.selectedUsers = [];
    this.groupTitle = Stream('');
    this.userMessage = Stream('');

    // Community Channels
    this.channels = [];
    this.loadingChannels = false;
    this.selectedChannel = null;

    // Fetch suggested/active users on open
    this.loadSuggestedUsers();
    this.loadChannels();
  }

  loadChannels() {
    this.loadingChannels = true;
    app.request({
      method: 'GET',
      url: app.forum.attribute('apiUrl') + '/text-channels'
    }).then(response => {
      const raw = response.data || [];
      this.channels = raw.map(ch => {
        const attrs = ch.attributes || {};
        return {
          id: ch.id || attrs.id,
          name: ch.name || attrs.name || '',
          description: ch.description || attrs.description || '',
          icon: ch.icon || attrs.icon || 'fas fa-hashtag',
          isActive: ch.is_active !== undefined ? ch.is_active : (attrs.isActive !== undefined ? attrs.isActive : true)
        };
      }).filter(ch => ch.isActive);
      this.loadingChannels = false;
      m.redraw();
    }).catch(() => {
      this.loadingChannels = false;
      m.redraw();
    });
  }

  loadSuggestedUsers() {
    this.loading = true;

    // Get frequently/recently contacted user IDs from messengerState
    const frequentUserIds = [];
    if (messengerState.conversations && messengerState.conversations.length > 0) {
      messengerState.conversations.forEach(c => {
        if (c.attributes && c.attributes.otherUserId) {
          frequentUserIds.push(String(c.attributes.otherUserId));
        }
      });
    }

    app.store.find('users', { page: { limit: 30 } }).then(results => {
      const allUsers = results.filter(u => String(u.id()) !== String(app.session.user.id()));
      
      // Sort: Contacted users first (in order of recent conversation), then others
      allUsers.sort((a, b) => {
        const aIndex = frequentUserIds.indexOf(String(a.id()));
        const bIndex = frequentUserIds.indexOf(String(b.id()));

        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return 0;
      });

      this.suggestedUsers = allUsers;
      this.loading = false;
      m.redraw();
    }).catch(() => {
      this.loading = false;
      m.redraw();
    });
  }

  className() {
    return 'NewConversationModal Modal--small Modal--instagramDirect';
  }

  title() {
    return this.attrs.sharePost ? 'Gönderiyi Paylaş' : 'Yeni Mesaj';
  }

  content() {
    const isSearching = this.searchQuery().trim().length >= 2;
    const usersToDisplay = isSearching ? this.searchResults : this.suggestedUsers;

    return (
      <div className="Modal-body NewConversationModal-body">
        {/* Destination Switcher Tabs (Direct Message vs Community Channel) */}
        <div className="NewConversationModal-modeTabs">
          <button
            type="button"
            className={`NewConversationModal-modeTab ${this.targetType === 'users' ? 'active' : ''}`}
            onclick={() => { this.targetType = 'users'; }}
          >
            <i className="far fa-paper-plane"></i>
            <span>Üyelere Mesaj</span>
          </button>
          <button
            type="button"
            className={`NewConversationModal-modeTab ${this.targetType === 'channels' ? 'active' : ''}`}
            onclick={() => { this.targetType = 'channels'; }}
          >
            <i className="fas fa-comments"></i>
            <span>Topluluk Odasına Gönder</span>
          </button>
        </div>

        {/* 1. COMMUNITY CHANNELS TAB */}
        {this.targetType === 'channels' && (
          <div className="NewConversationModal-channelPane">
            {this.attrs.sharePost && (
              <div className="NewConversationModal-shareRow">
                <input
                  className="NewConversationModal-groupInput"
                  placeholder="Kanalda gönderiyle birlikte iletmek istediğiniz not (isteğe bağlı)..."
                  value={this.userMessage()}
                  oninput={e => this.userMessage(e.target.value)}
                />
              </div>
            )}

            <div className="NewConversationModal-sectionHeader">
              <span>Paylaşmak İstediğiniz Kanalı Seçin</span>
            </div>

            <div className="NewConversationModal-channelsScroll">
              {this.loadingChannels ? (
                <div className="NewConversationModal-loading">
                  <LoadingIndicator />
                </div>
              ) : this.channels.length === 0 ? (
                <div className="NewConversationModal-empty">
                  <p>Kullanılabilir topluluk kanalı bulunamadı.</p>
                </div>
              ) : (
                <div className="NewConversationModal-channelsList">
                  {this.channels.map(ch => {
                    const isSelected = this.selectedChannel && String(this.selectedChannel.id) === String(ch.id);
                    return (
                      <div
                        key={ch.id}
                        className={`NewConversationModal-channelItem ${isSelected ? 'selected' : ''}`}
                        onclick={() => { this.selectedChannel = isSelected ? null : ch; }}
                      >
                        <div className="NewConversationModal-channelItemIcon">
                          <i className={ch.icon || 'fas fa-hashtag'}></i>
                        </div>
                        <div className="NewConversationModal-channelItemInfo">
                          <div className="NewConversationModal-channelItemName">{ch.name}</div>
                          {ch.description && (
                            <div className="NewConversationModal-channelItemDesc">{ch.description}</div>
                          )}
                        </div>
                        <div className={`NewConversationModal-channelItemCheck ${isSelected ? 'checked' : ''}`}>
                          {isSelected && <i className="fas fa-check"></i>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="NewConversationModal-bottomAction">
              <Button
                className="Button Button--primary NewConversationModal-chatBtn"
                disabled={!this.selectedChannel}
                onclick={this.sendToChannel.bind(this)}
              >
                {this.selectedChannel ? `${this.selectedChannel.name} Kanalında Paylaş` : 'Kanal Seçin'}
              </Button>
            </div>
          </div>
        )}

        {/* 2. DIRECT USERS TAB */}
        {this.targetType === 'users' && (
          <>
            {/* Instagram DM Search & Chips Header Bar */}
            <div className="NewConversationModal-toSection">
              <span className="NewConversationModal-toLabel">Kime:</span>
              
              <div className="NewConversationModal-toInputArea">
                {/* Selected user chips inside input row */}
                {this.selectedUsers.map(user => (
                  <span className="NewConversationModal-chip">
                    <span>{user.displayName ? user.displayName() : user.username()}</span>
                    <button 
                      type="button" 
                      className="NewConversationModal-chipRemove" 
                      onclick={() => this.toggleUser(user)}
                      title="Kaldır"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </span>
                ))}

                <input
                  className="NewConversationModal-inlineInput"
                  placeholder={this.selectedUsers.length === 0 ? "Ara..." : ""}
                  value={this.searchQuery()}
                  oninput={(e) => {
                    this.searchQuery(e.target.value);
                    this.searchUsers();
                  }}
                  autofocus
                />
              </div>
            </div>

            {/* Group title field if 2+ users selected */}
            {this.selectedUsers.length > 1 && (
              <div className="NewConversationModal-groupRow">
                <input
                  className="NewConversationModal-groupInput"
                  placeholder="Grup adı verin (isteğe bağlı)..."
                  value={this.groupTitle()}
                  oninput={e => this.groupTitle(e.target.value)}
                />
              </div>
            )}

            {/* Post share note if applicable */}
            {this.attrs.sharePost && this.selectedUsers.length > 0 && (
              <div className="NewConversationModal-shareRow">
                <input
                  className="NewConversationModal-groupInput"
                  placeholder="Gönderi ile birlikte iletmek istediğiniz not..."
                  value={this.userMessage()}
                  oninput={e => this.userMessage(e.target.value)}
                />
              </div>
            )}

            {/* List Section Title */}
            <div className="NewConversationModal-sectionHeader">
              <span>{isSearching ? 'Arama Sonuçları' : 'Önerilenler'}</span>
            </div>

            {/* Users Grid: 3 Profiles per row (Instagram Direct style) */}
            <div className="NewConversationModal-usersScroll">
              {this.loading ? (
                <div className="NewConversationModal-loading">
                  <LoadingIndicator />
                </div>
              ) : usersToDisplay.length > 0 ? (
                <div className="NewConversationModal-grid">
                  {usersToDisplay.map(user => {
                    const isSelected = this.selectedUsers.find(u => String(u.id()) === String(user.id()));
                    const isRecent = !isSearching && messengerState.conversations && messengerState.conversations.some(c => c.attributes && String(c.attributes.otherUserId) === String(user.id()));

                    return (
                      <div 
                        className={`NewConversationModal-gridCard ${isSelected ? 'selected' : ''}`}
                        onclick={() => this.toggleUser(user)}
                        title={user.displayName ? `${user.displayName()} (@${user.username()})` : `@${user.username()}`}
                      >
                        <div className="NewConversationModal-gridAvatarWrapper">
                          <Avatar user={user} className="Avatar" />
                          
                          {/* Selection Check Circle */}
                          <span className={`NewConversationModal-gridCheck ${isSelected ? 'checked' : ''}`}>
                            {isSelected && <i className="fas fa-check"></i>}
                          </span>
                        </div>
                        
                        <div className="NewConversationModal-gridInfo">
                          <span className="NewConversationModal-gridName">
                            {user.displayName ? user.displayName() : user.username()}
                          </span>
                          <span className="NewConversationModal-gridUsername">
                            @{user.username()}
                          </span>
                        </div>

                        {isRecent && !isSelected && (
                          <span className="NewConversationModal-recentBadge">Sık Görüşülen</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="NewConversationModal-empty">
                  <p>Kullanıcı bulunamadı.</p>
                </div>
              )}
            </div>

            {/* Bottom Chat Button */}
            <div className="NewConversationModal-bottomAction">
              <Button
                className="Button Button--primary NewConversationModal-chatBtn"
                disabled={this.selectedUsers.length === 0}
                onclick={this.startConversation.bind(this)}
              >
                {this.selectedUsers.length > 1 ? `Sohbet Başlat (${this.selectedUsers.length})` : 'Sohbet'}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  searchUsers() {
    const query = this.searchQuery().trim();
    if (query.length < 2) {
      this.searchResults = [];
      return;
    }

    this.loading = true;
    m.redraw();

    app.store.find('users', { filter: { q: query }, page: { limit: 8 } }).then(results => {
      this.searchResults = results.filter(u => String(u.id()) !== String(app.session.user.id()));
      this.loading = false;
      m.redraw();
    });
  }

  toggleUser(user) {
    const index = this.selectedUsers.findIndex(u => String(u.id()) === String(user.id()));
    if (index !== -1) {
      this.selectedUsers.splice(index, 1);
    } else {
      this.selectedUsers.push(user);
    }
  }

  sendToChannel() {
    if (!this.selectedChannel) return;

    let payloadMessage = '';
    let payloadType = 'text';

    if (this.attrs.sharePost) {
      const post = this.attrs.sharePost;
      const html = post.contentHtml() || '';
      const imgMatch = html.match(/<img[^>]+src="([^">]+)"/);
      const imageUrl = imgMatch ? imgMatch[1] : null;

      const postData = {
        postId: post.id(),
        title: post.discussion().title(),
        url: app.route.post(post),
        imageUrl: imageUrl,
        excerpt: html.replace(/<[^>]+>/g, '').substring(0, 100) + '...',
        userMessage: this.userMessage()
      };

      payloadMessage = JSON.stringify(postData);
      payloadType = 'post_share';
    } else {
      payloadMessage = this.userMessage() || 'Merhaba!';
    }

    const channel = this.selectedChannel;

    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + `/text-channels/${channel.id}/messages`,
      body: {
        message: payloadMessage,
        type: payloadType
      }
    }).then(response => {
      this.hide();
      app.alerts.show({ type: 'success' }, `${channel.name} kanalında başarıyla paylaşıldı!`);

      // Open VoiceRoomsWidget and select this channel
      if (app.voiceRoomsWidget) {
        app.voiceRoomsWidget.isOpen = true;
        app.voiceRoomsWidget.activeTab = 'text';
        app.voiceRoomsWidget.selectTextChannel(channel);
        m.redraw();
      }
    }).catch(err => {
      const msg = (err.response && err.response.error) || 'Kanalda paylaşılırken hata oluştu.';
      alert(msg);
    });
  }

  startConversation() {
    if (this.selectedUsers.length === 0) return;

    const payload = {
      data: {
        attributes: {
          recipientIds: this.selectedUsers.map(u => u.id())
        }
      }
    };

    if (this.selectedUsers.length > 1 && this.groupTitle().trim()) {
      payload.data.attributes.title = this.groupTitle().trim();
    }

    app.request({
      method: 'POST',
      url: app.forum.attribute('apiUrl') + '/conversations',
      body: payload
    }).then(response => {
      this.hide();
      
      const conversationId = response.data.id;
      
      // Eğer bir gönderi paylaşılıyorsa, konuşma oluştuktan sonra otomatik mesaj at
      if (this.attrs.sharePost) {
        const post = this.attrs.sharePost;
        const html = post.contentHtml() || '';
        const imgMatch = html.match(/<img[^>]+src="([^">]+)"/);
        const imageUrl = imgMatch ? imgMatch[1] : null;

        const postData = {
          postId: post.id(),
          title: post.discussion().title(),
          url: app.route.post(post),
          imageUrl: imageUrl,
          excerpt: html.replace(/<[^>]+>/g, '').substring(0, 100) + '...',
          userMessage: this.userMessage()
        };
        
        app.request({
          method: 'POST',
          url: app.forum.attribute('apiUrl') + '/messages',
          body: {
            data: {
              attributes: {
                conversationId: conversationId,
                content: JSON.stringify(postData),
                type: 'post_share'
              }
            }
          }
        }).then(() => {
          app.alerts.show({type: 'success'}, 'Gönderi mesaj olarak paylaşıldı!');
          if (this.attrs.onConversationCreated) {
            this.attrs.onConversationCreated(conversationId);
          }
        });
      } else {
        if (this.attrs.onConversationCreated) {
          this.attrs.onConversationCreated(conversationId);
        }
      }
    });
  }
}
