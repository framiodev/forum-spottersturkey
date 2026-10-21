import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import Avatar from 'flarum/common/components/Avatar';
const avatar = (user, attrs = {}) => m(Avatar, { user, ...attrs });
import username from 'flarum/common/helpers/username';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';

const icon = (iconName, attrs = {}) => {
  attrs.className = (attrs.className || '') + ' icon ' + iconName;
  return m('i', attrs);
};

const CACHE_KEY = 'framio_latest_activity';
const KIND_ICONS = { photo: 'fas fa-camera', video: 'fas fa-video', link: 'fas fa-link', quote: 'fas fa-quote-right', text: 'fas fa-comment-alt' };
const KIND_TITLES = { photo: 'Fotoğraf', video: 'Video', link: 'Bağlantı', quote: 'Alıntı', text: 'Metin' };

export default class LatestActivity extends Component {
    oninit(vnode) {
        super.oninit(vnode);
        this.groupedPosts = [];
        this.loading = true;

        // Son bilinen tablo anında gösterilir (tarayıcıda saklı), arka planda tazelenir
        try {
            const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            if (saved && Array.isArray(saved)) { this.groupedPosts = this.toGroups(saved); this.loading = false; }
        } catch (e) {}

        this.fetchData();
    }

    oncreate(vnode) {
        super.oncreate(vnode);
        // Yeni mesaj (canlı yoklama) ya da sekmeye geri dönüş: tablo arka planda tazelenir
        this.onNewPosts = () => this.fetchData();
        this.onVisible = () => { if (!document.hidden) this.fetchData(); };
        window.addEventListener('framio:new-posts', this.onNewPosts);
        document.addEventListener('visibilitychange', this.onVisible);
        // Kullanıcının kendi gönderisi: yayımlanınca hemen
        this.onOwnPost = () => setTimeout(() => this.fetchData(), 800);
        window.addEventListener('framio:posted', this.onOwnPost);
    }

    onremove(vnode) {
        super.onremove(vnode);
        window.removeEventListener('framio:new-posts', this.onNewPosts);
        document.removeEventListener('visibilitychange', this.onVisible);
        window.removeEventListener('framio:posted', this.onOwnPost);
    }

    /** Hafif özet: kullanıcılar mağazaya eklenir (avatar/kullanıcı adı bileşenleri model bekler) */
    toGroups(rows) {
        return rows.map((r) => {
            const users = r.users.map((u) => app.store.getById('users', u.id) || app.store.pushObject({
                type: 'users', id: u.id,
                attributes: { username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl, color: u.color, slug: u.slug },
            }));
            return { discussion: r.discussion, latestPost: r.post, snippet: r.snippet, kind: r.kind || 'text', hot: !!r.hot, mainUser: users[0], recentUsers: users };
        }).filter((g) => g.mainUser);
    }

    fetchData() {
        app.request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/framio/latest-activity' }).then((res) => {
            const rows = (res && res.data) || [];
            this.groupedPosts = this.toGroups(rows);
            this.loading = false;
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(rows)); } catch (e) {}
            m.redraw();
        }).catch(() => { this.loading = false; m.redraw(); });
    }

    view() {
        if (this.loading) {
            const skeletonRows = Array.from({ length: 5 }, (_, i) => i);
            return (
                <div className="Framio-LatestTable-Wrapper">
                    <div className="Framio-LatestTable-Header">
                        <h3>Son Gönderilen Mesajlar</h3>
                    </div>
                    <div className="Framio-LatestTable" style={{ opacity: 0.6 }}>
                        <div className="TableRow TableHeader">
                            <div className="Col-User">KULLANICI</div>
                            <div className="Col-Snippet">İÇERİK BİLGİSİ</div>
                            <div className="Col-Subject">KONU BAŞLIĞI</div>
                            <div className="Col-Posters">SON YAZANLAR</div>
                            <div className="Col-Replies">CEVAP</div>
                        </div>
                        <div className="TableBody">
                            {skeletonRows.map(i => (
                                <div className="TableRow" key={`skeleton-${i}`}>
                                    <div className="Col-User" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div className="Spotters-Skeleton-Avatar"></div>
                                        <div className="Spotters-Skeleton-Text" style={{ width: '80px' }}></div>
                                    </div>
                                    <div className="Col-Snippet">
                                        <div className="Spotters-Skeleton-Text" style={{ width: '90%' }}></div>
                                    </div>
                                    <div className="Col-Subject">
                                        <div className="Spotters-Skeleton-Text" style={{ width: '100%' }}></div>
                                    </div>
                                    <div className="Col-Posters">
                                        <div className="Avatar-Cluster">
                                            <div className="Spotters-Skeleton-Avatar Overlap-Avatar"></div>
                                            <div className="Spotters-Skeleton-Avatar Overlap-Avatar" style={{ marginLeft: '-10px' }}></div>
                                        </div>
                                    </div>
                                    <div className="Col-Replies">
                                        <div className="Spotters-Skeleton-Text" style={{ width: '20px', margin: '0 auto' }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="Framio-LatestTable-Wrapper">
                <div className="Framio-LatestTable-Header">
                    <h3>Son Gönderilen Mesajlar</h3>
                </div>
                <div className="Framio-LatestTable">
                    
                    <div className="TableRow TableHeader">
                        <div className="Col-User">KULLANICI</div>
                        <div className="Col-Snippet">İÇERİK BİLGİSİ</div>
                        <div className="Col-Subject">KONU BAŞLIĞI</div>
                        <div className="Col-Posters">SON YAZANLAR</div>
                        <div className="Col-Replies">CEVAP</div>
                    </div>

                    <div className="TableBody">
                        {this.groupedPosts.map(group => {
                            const discussion = group.discussion;
                            const latestPost = group.latestPost;
                            const mainUser = group.mainUser;
                            const snippet = group.snippet;
                            
                            // Olimpiyat Dizilimi: En eski en sola, en yeni en sağa.
                            const overlapUsers = [...group.recentUsers].reverse();
                            
                            const replies = Math.max(0, discussion.replies);

                            return (
                                <div className="TableRow" style={{ cursor: 'pointer' }} onclick={() => m.route.set(app.route('discussion.near', { id: discussion.id + (discussion.slug ? '-' + discussion.slug : ''), near: latestPost.number }))}>
                                    
                                    <div className="Col-User">
                                        <Link href={app.route.user(mainUser)} className="AvatarWrapper" title={mainUser.displayName()} onclick={(e) => e.stopPropagation()}>
                                            {avatar(mainUser)}
                                        </Link>
                                        <Link href={app.route.user(mainUser)} className="UserName" title={mainUser.displayName()} style={{ textDecoration: 'none', color: 'inherit' }} onclick={(e) => e.stopPropagation()}>
                                            {username(mainUser)}
                                        </Link>
                                    </div>
                                    
                                    <div className="Col-Snippet">
                                        <span className="SnippetText" title={snippet}>{icon(KIND_ICONS[group.kind] || KIND_ICONS.text, { className: 'Snippet-Kind', title: KIND_TITLES[group.kind] || '', style: { color: 'var(--muted-color)', marginRight: '4px' } })} {snippet}</span>
                                    </div>

                                    <div className="Col-Subject">
                                        <span className="SubjectTitle" title={discussion.title}>{group.hot ? icon('fas fa-fire', { className: 'Subject-Hot', title: 'Hareketli konu', style: { color: '#ef4444', marginRight: '4px' } }) : null} {discussion.title}</span>
                                    </div>

                                    <div className="Col-Posters">
                                        <div className="Avatar-Cluster">
                                            {overlapUsers.map(u => (
                                                <Link href={app.route.user(u)} className="Overlap-Avatar" title={u.displayName()} onclick={(e) => e.stopPropagation()}>
                                                    {avatar(u)}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="Col-Replies">
                                        {replies}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="TableFooter" style={{ padding: '12px 20px', textAlign: 'center', background: 'var(--control-bg)', borderTop: '1px solid var(--border-color)' }}>
                        <Link href={app.route('index')} className="Button Button--link" style={{ fontWeight: 'bold', color: 'var(--muted-color)', textDecoration: 'none' }}>
                            Tüm Tartışmaları Gör {icon('fas fa-angle-right')}
                        </Link>
                    </div>

                </div>
            </div>
        );
    }
}