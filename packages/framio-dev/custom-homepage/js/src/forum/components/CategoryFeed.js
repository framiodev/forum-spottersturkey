import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import CommentPost from 'flarum/forum/components/CommentPost';
import Link from 'flarum/common/components/Link';
import MobileFeedCard from './MobileFeedCard';

export default class CategoryFeed extends Component {
    oninit(vnode) {
        super.oninit(vnode);
        this.currentTag = vnode.attrs.tagSlug;
        this.currentSort = vnode.attrs.sort || 'feed';
        this.originalUrl = window.location.href;
        this.refreshBehavior = app.forum.attribute('framioFeedRefreshBehavior') || 'B';
        
        if (this.refreshBehavior === 'A') {
            sessionStorage.setItem('framioFeedContext', this.originalUrl);
            sessionStorage.setItem('framioFeedTitle', document.title);
        } else {
            document.cookie = "framio_lightbox_open=1; path=/";
            document.cookie = "framio_original_url=" + encodeURIComponent(this.originalUrl) + "; path=/";
        }
        
        this.posts = [];
        this.loading = true;
        this.visibleLimit = 10;
        
        this.loadPosts();
    }

    oncreate(vnode) {
        super.oncreate(vnode);
        this.initObserver();
        document.body.classList.add('Framio-Feed-Active');
    }

    onremove(vnode) {
        if (this.observer) this.observer.disconnect();
        
        if (this.refreshBehavior === 'A') {
            sessionStorage.removeItem('framioFeedContext');
            sessionStorage.removeItem('framioFeedTitle');
        } else {
            document.cookie = "framio_lightbox_open=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            document.cookie = "framio_original_url=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
        
        document.body.classList.remove('Framio-Feed-Active');
    }

    initObserver() {
        if (!window.IntersectionObserver) return;
        if (this.observer) this.observer.disconnect();
        
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const url = entry.target.getAttribute('data-url');
                    if (url && window.location.href !== url) {
                        window.history.replaceState(null, '', url);
                    }
                }
            });
        }, {
            root: null,
            rootMargin: '-20% 0px -50% 0px',
            threshold: 0
        });
        
        setTimeout(() => {
            if (!this.element) return;
            const items = this.element.querySelectorAll('.PostStream-item');
            items.forEach(item => this.observer.observe(item));
        }, 100);
    }

    onupdate(vnode) {
        super.onupdate(vnode);
        let needsReload = false;
        
        if (vnode.attrs.tagSlug !== this.currentTag) {
            this.currentTag = vnode.attrs.tagSlug;
            needsReload = true;
        }
        
        if (vnode.attrs.sort !== this.currentSort) {
            this.currentSort = vnode.attrs.sort;
            needsReload = true;
        }

        if (needsReload) {
            this.loading = true;
            this.loadPosts();
        }
    }

    loadPosts() {
        app.request({
            method: 'GET',
            url: app.forum.attribute('apiUrl') + '/framio/category-posts',
            params: { 
                tag: this.currentTag,
                include: 'discussion,user',
                sort: this.currentSort
            }
        }).catch(() => ({ data: [], meta: {}, included: [] }))
        .then((response) => {
            if (response && response.data) {
                // Uç nokta onay bilgisini göndermiyor; bilgi yokken onay eklentisi her mesaja
                // "Onay Bekliyor" yazıyordu. Akışa yalnızca yayımlanmış mesajlar gelir.
                (Array.isArray(response.data) ? response.data : [response.data]).forEach((d) => {
                    if (d.type === 'posts' && d.attributes && d.attributes.isApproved === undefined) d.attributes.isApproved = true;
                });
                // Parse API response using Flarum's store to get proper Post models
                const models = app.store.pushPayload(response);
                
                // Sort them manually if needed, though API should already sort them
                this.posts = models.sort((a, b) => {
                    if (this.currentSort === 'oldest') {
                        return a.createdAt() - b.createdAt();
                    } else {
                        return b.createdAt() - a.createdAt();
                    }
                });
            } else {
                this.posts = [];
            }
            
            this.loading = false;
            m.redraw();
            setTimeout(() => this.initObserver(), 200);
        });
    }

    loadMore() {
        this.visibleLimit += 10;
        m.redraw();
        setTimeout(() => this.initObserver(), 200);
    }

    renderPost(post) {
        if (!post) return null;

        // Telefonda Flarum mesaj bileşeni yerine Instagram düzeninde kendi kartımız
        if (window.matchMedia('(max-width: 767px)').matches) {
            return <div className="PostStream-item" key={post.id()}><MobileFeedCard post={post} /></div>;
        }
        
        const discussion = post.discussion();
        let postUrl = '';
        if (discussion) {
            const id = discussion.id();
            const slug = discussion.slug();
            const routeId = (slug && slug.toString().startsWith(id + '-')) ? slug : id + (slug ? '-' + slug : '');
            postUrl = app.route('discussion', { id: routeId }) + (post.number() ? '/' + post.number() : '');
        }
        
        return (
            <div className="PostStream-item" key={post.id()} data-url={postUrl}>
                <div className="PostListItem">
                    {discussion && (
                        <div className="PostListItem-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <div className="PostListItem-discussion" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                                {app.translator.trans('core.forum.user.in_discussion_text', {
                                    discussion: <Link href={app.route.post(post)} style={{ fontStyle: 'italic' }}>{discussion.title()}</Link>,
                                })}
                            </div>
                            <Link href={app.route.post(post)} className="Button Button--primary">
                                Konuya Git
                            </Link>
                        </div>
                    )}
                    <CommentPost post={post} />
                </div>
            </div>
        );
    }

    view() {
        if (this.loading) {
            return (
                <div className="CategoryFeed-Container">
                    <div style={{ textAlign: 'center', padding: '50px 0' }}>
                        <LoadingIndicator size="large" />
                    </div>
                </div>
            );
        }

        return (
            <div className="CategoryFeed-Container">
                {this.posts.length > 0 ? (
                    <div className="PostStream">
                        {this.posts.slice(0, this.visibleLimit).map(post => this.renderPost(post))}
                        
                        {this.visibleLimit < this.posts.length && (
                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <Button className="Button Button--primary" onclick={() => this.loadMore()}>
                                    Daha Fazla Göster
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '50px 0' }}>
                        <h3 style={{ color: 'var(--muted-more-color)' }}>Bu kategoride henüz gönderi bulunmuyor.</h3>
                    </div>
                )}
            </div>
        );
    }
}
