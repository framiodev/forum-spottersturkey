import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import HeaderSecondary from 'flarum/forum/components/HeaderSecondary';
import CommentPost from 'flarum/forum/components/CommentPost';
import Button from 'flarum/common/components/Button';
import MessagesPage from './components/MessagesPage';
import MessagesDropdown from './components/MessagesDropdown';
import VoiceRoomsHeaderButton from './components/VoiceRoomsHeaderButton';
import NewConversationModal from './components/NewConversationModal';
import IndexPage from 'flarum/forum/components/IndexPage';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import VoiceRoomsWidget from './components/VoiceRoomsWidget';
import MessengerDock from './components/MessengerDock';
import messengerState from './states/messengerState';

import UserControls from 'flarum/forum/utils/UserControls';
import UserCard from 'flarum/forum/components/UserCard';

import DiscussionPage from 'flarum/forum/components/DiscussionPage';

app.initializers.add('framio-direct-messenger', () => {
  app.routes.messages = {
    path: '/messages',
    component: MessagesPage
  };

  extend(HeaderSecondary.prototype, 'items', function(items) {
    if (app.session && app.session.user) {
      items.add('direct-messages', <MessagesDropdown />, 15);
      items.add('voice-rooms-btn', <VoiceRoomsHeaderButton />, 14);
    }
  });

  // Add prominent, visible "Mesaj Gönder" button right on the user profile card header
  extend(UserCard.prototype, 'controlsItems', function(items) {
    const user = this.attrs.user;
    if (
      app.session && 
      app.session.user && 
      user && 
      String(user.id()) !== String(app.session.user.id())
    ) {
      items.add(
        'direct-message-btn',
        <Button
          className="Button"
          icon="far fa-paper-plane"
          onclick={(e) => {
            e.stopPropagation();
            messengerState.openWithUser(user);
          }}
        >
          Mesaj Gönder
        </Button>,
        110
      );
    }
  });

  // Also keep it inside UserControls for fallback
  extend(UserControls, 'userControls', function(items, user) {
    if (
      app.session && 
      app.session.user && 
      user && 
      String(user.id()) !== String(app.session.user.id())
    ) {
      items.add(
        'direct-message',
        <Button
          icon="far fa-paper-plane"
          onclick={() => {
            messengerState.openWithUser(user);
          }}
        >
          Mesaj Gönder
        </Button>,
        100
      );
    }
  });

  // Add Voice Room action in Discussion sidebar / actions (Category Voice Room)
  extend(DiscussionPage.prototype, 'sidebarItems', function(items) {
    if (!app.session || !app.session.user) return;
    const discussion = this.discussion;
    if (!discussion) return;

    // Find main tag
    let mainTag = null;
    if (discussion.tags && typeof discussion.tags === 'function') {
      const tags = discussion.tags();
      if (tags && tags.length > 0) {
        mainTag = tags.find(t => !t.parent || !t.parent()) || tags[0];
      }
    }

    const currentWidget = app.voiceRoomsWidget;
    const isJoined = currentWidget && currentWidget.activeRoomData && mainTag && (
      String(currentWidget.activeRoomData.attributes && currentWidget.activeRoomData.attributes.tagId) === String(mainTag.id())
    );

    const tagTitle = mainTag ? (typeof mainTag.name === 'function' ? mainTag.name() : mainTag.name) : 'Kategori';

    items.add(
      'discussion-voice-room',
      <Button
        className={`Button DiscussionHero-voiceRoomBtn ${isJoined ? 'active' : ''}`}
        icon={isJoined ? "fas fa-volume-up" : "fas fa-headset"}
        onclick={() => {
          if (app.voiceRoomsWidget) {
            app.voiceRoomsWidget.isOpen = true;
            m.redraw();

            if (mainTag) {
              const tagSlug = typeof mainTag.slug === 'function' ? mainTag.slug() : mainTag.slug;
              app.request({
                method: 'GET',
                url: app.forum.attribute('apiUrl') + '/voice-rooms?tag_slug=' + encodeURIComponent(tagSlug)
              }).then(response => {
                const rooms = response.data || [];
                const room = rooms.find(r => r.attributes && String(r.attributes.tagId) === String(mainTag.id()));
                if (room) {
                  app.voiceRoomsWidget.joinRoom(room);
                }
              });
            }
          }
        }}
      >
        {isJoined ? `${tagTitle} Ses Kanalındasınız` : `${tagTitle} Ses Kanalına Katıl`}
      </Button>,
      80
    );
  });

  // Add Voice Room action in IndexSidebar items (e.g. on tag pages)
  extend(IndexSidebar.prototype, 'items', function(items) {
    if (!app.session || !app.session.user) return;

    // Detect if viewing a tag (via app.currentTag() from tags extension or route params)
    let currentTag = null;
    if (typeof app.currentTag === 'function') {
      currentTag = app.currentTag();
    }
    if (!currentTag && app.current && app.current.data && app.current.data.tag) {
      currentTag = app.current.data.tag;
    }
    if (!currentTag) {
      const slug = (app.search && app.search.state && app.search.state.params && app.search.state.params().tags) || m.route.param('tags');
      if (slug && app.store) {
        currentTag = app.store.all('tags').find(t => {
          const s = typeof t.slug === 'function' ? t.slug() : t.slug;
          return s && s.localeCompare(slug, undefined, { sensitivity: 'base' }) === 0;
        });
      }
    }

    if (!currentTag) return;

    let mainTag = currentTag;
    if (typeof mainTag.parent === 'function' && mainTag.parent()) {
      mainTag = mainTag.parent();
    }

    const currentWidget = app.voiceRoomsWidget;
    const isJoined = currentWidget && currentWidget.activeRoomData && (
      String(currentWidget.activeRoomData.attributes && currentWidget.activeRoomData.attributes.tagId) === String(mainTag.id())
    );

    const tagTitle = typeof mainTag.name === 'function' ? mainTag.name() : mainTag.name;

    items.add(
      'tag-voice-room',
      <Button
        className={`Button DiscussionHero-voiceRoomBtn ${isJoined ? 'active' : ''}`}
        icon={isJoined ? "fas fa-volume-up" : "fas fa-headset"}
        itemClassName="App-primaryControl"
        onclick={() => {
          if (app.voiceRoomsWidget) {
            app.voiceRoomsWidget.isOpen = true;
            m.redraw();

            const tagSlug = typeof mainTag.slug === 'function' ? mainTag.slug() : mainTag.slug;
            app.request({
              method: 'GET',
              url: app.forum.attribute('apiUrl') + '/voice-rooms?tag_slug=' + encodeURIComponent(tagSlug)
            }).then(response => {
              const rooms = response.data || [];
              const room = rooms.find(r => r.attributes && String(r.attributes.tagId) === String(mainTag.id()));
              if (room) {
                app.voiceRoomsWidget.joinRoom(room);
              }
            });
          }
        }}
      >
        {isJoined ? `${tagTitle} Ses Kanalındasınız` : `${tagTitle} Ses Kanalına Katıl`}
      </Button>,
      8
    );
  });

  setTimeout(() => {
    if (app.session && app.session.user) {
      messengerState.init();

      // Mount Messenger floating dock
      const dockContainer = document.createElement('div');
      dockContainer.id = 'framio-messenger-dock';
      document.body.appendChild(dockContainer);
      m.mount(dockContainer, { view: () => m(MessengerDock) });

      // Mount VoiceRoomsWidget
      const vrContainer = document.createElement('div');
      document.body.appendChild(vrContainer);
      m.mount(vrContainer, { 
        view: () => m(VoiceRoomsWidget, { 
          oninit: (vnode) => {
            app.voiceRoomsWidget = vnode.state;
          }
        }) 
      });
    }
  }, 100);

  extend(CommentPost.prototype, 'actionItems', function(items) {
    const post = this.attrs.post;
    
    items.add('shareAsMessage', (
      <Button
        className="Button Button--link"
        icon="far fa-paper-plane"
        onclick={() => {
          app.modal.show(NewConversationModal, {
            sharePost: post,
            onConversationCreated: (id) => {
              messengerState.openConversation(id);
            }
          });
        }}
      >
        Gönder
      </Button>
    ));
  });
});
