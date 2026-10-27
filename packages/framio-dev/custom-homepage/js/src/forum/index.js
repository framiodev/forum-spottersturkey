import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import PageStructure from 'flarum/forum/components/PageStructure';
import DiscussionList from 'flarum/forum/components/DiscussionList';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import LinkButton from 'flarum/common/components/LinkButton';
import CustomHomepage from './components/CustomHomepage';
import GalleryPage from './components/GalleryPage';
import HeroSlider from './components/HeroSlider';
import LatestActivity from './components/LatestActivity'; 
import TagCarousel from './components/TagCarousel'; 
import CategoryGallery from './components/CategoryGallery';
import CategoryFeed from './components/CategoryFeed';
import registerNavMenu from './navMenu';
import ExplorePage from './components/ExplorePage';
import Component from 'flarum/common/Component';
import MobileTabBar from './components/MobileTabBar';
import MobileChips from './components/MobileChips';
import MobileCategoriesPage from './components/MobileCategoriesPage';
import MobileFeedCard from './components/MobileFeedCard';
import MobileCommentRow from './components/MobileCommentRow';
import MobileTagHeader from './components/MobileTagHeader';
import { discussionThumb } from './utils/mobileThumbs';
import installMobileViewer from './components/MobileViewer';

/** /gallery → galeri görünümü (yönlendirme) */
class GalleryRedirect extends Component {
    oninit(vnode) {
        super.oninit(vnode);
        setTimeout(() => m.route.set(app.route('index', { sort: 'gallery' }), null, { replace: true }), 0);
    }

    view() {
        return null;
    }
}

// Menü yöneticisi (en son çalışan başlatıcı olarak kaydolur)
registerNavMenu();

app.initializers.add('framio-custom-homepage', () => {
    // Keşfet sayfası (/kesfet). Ana sayfa yapmak için Yönetim → Temel → Varsayılan Rota = /kesfet
    app.routes['framio.explore'] = { path: '/kesfet', component: ExplorePage };

    // Telefon alt sekme çubuğu: uygulama kökünün dışında kendi bağlama noktasında yaşar.
    // Uygulama ve oturum hazır olduktan sonra (ilk sayfa çizildiğinde) bir kez bağlanır.
    app.routes['framio.categories'] = { path: '/kategoriler', component: MobileCategoriesPage };

    // Telefon mesaj sayfası (onaylı maket, A yönü): fotoğraflı mesaj = Akış kartı,
    // fotoğrafsız cevap = Instagram yorumu. Düzenleme sırasında ve masaüstünde Flarum görünümü kalır.
    override('flarum/forum/components/CommentPost', 'view', function (original, ...args) {
        try {
            const post = this.attrs.post;
            const phone = window.matchMedia('(max-width: 767px)').matches;
            const onDiscussion = /^discussion/.test(app.current.get('routeName') || '');
            const editing = this.isEditing && this.isEditing();
            if (phone && onDiscussion && !editing && !post.isHidden() && post.contentType() === 'comment') {
                const hasPhoto = /<img\b(?![^>]*\bemoji\b)/i.test(post.contentHtml() || '');
                return (
                    <div className={'MobilePost' + (hasPhoto ? ' MobilePost--photo' : ' MobilePost--comment')} data-id={post.id()}>
                        {hasPhoto ? <MobileFeedCard post={post} inDiscussion /> : <MobileCommentRow post={post} />}
                    </div>
                );
            }
        } catch (e) {}
        return original(...args);
    });
    installMobileViewer();

    // Başlatıcılar uygulama bağlanmadan önce çalışır; setTimeout ile bağlandıktan hemen sonra
    // (her sayfa türünde, PageStructure kullanmayan sayfalarda da) bir kez kurulur.
    setTimeout(() => {
        if (document.querySelector('.MobileTabBar-mount') || !document.getElementById('content')) return;

        // Telefonda site ilk açıldığında ana sayfa yerine Akış (admin'den kapatılabilir)
        if (window.matchMedia('(max-width: 767px)').matches && app.forum.attribute('framioMobileHomeFeed') !== '0'
            && window.location.pathname.replace(/\/+$/, '') === (app.forum.attribute('basePath') || '')) {
            setTimeout(() => m.route.set('/all?sort=feed', null, { replace: true }), 0);
        }

        const tabBarEl = document.createElement('div');
        tabBarEl.className = 'MobileTabBar-mount';
        document.body.appendChild(tabBarEl);
        m.mount(tabBarEl, { view: () => { try { return m(MobileTabBar); } catch (e) { return null; } } });

        // Kategori çipleri: sayfa içeriğinin hemen üstünde
        const content = document.getElementById('content');
        if (content && content.parentNode) {
            const chipsEl = document.createElement('div');
            chipsEl.className = 'MobileChips-mount';
            content.parentNode.insertBefore(chipsEl, content);
            m.mount(chipsEl, { view: () => { try { return m(MobileChips); } catch (e) { return null; } } });
        }
    }, 0);

    // Lightbox açıkken konan yenileme çerezi, yeni sekmede açılan bağlantılarla
    // (Konuya Git vb.) sunucuya gidip o sekmeyi ana sayfaya yönlendiriyordu.
    // Bağlantıya tıklanırken çerez kısa süre kaldırılır, sonra geri konur.
    const releaseLightboxCookie = (e) => {
        const a = e.target.closest && e.target.closest('a[href]');
        if (!a || !/(^|; )framio_lightbox_open=1/.test(document.cookie)) return;
        document.cookie = 'framio_lightbox_open=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        setTimeout(() => {
            if (document.querySelector('.SpottersGallery-Lightbox')) document.cookie = 'framio_lightbox_open=1; path=/';
        }, 2000);
    };
    document.addEventListener('click', releaseLightboxCookie, true);
    document.addEventListener('auxclick', releaseLightboxCookie, true);

    // Telefonda çekirdek başlık logoyu çekmeceye taşıyor; üst çubukta hamburgerin yanında logo göster
    // Başlatıcılar forum verisi yüklenmeden çalışır: veri gelince ekle
    const addMobileLogo = () => {
    if (!app.forum) { setTimeout(addMobileLogo, 100); return; }
    const logoUrl = app.forum.attribute('logoUrl');
    if (logoUrl && !document.querySelector('.Framio-MobileLogo')) {
        const a = document.createElement('a');
        a.className = 'Framio-MobileLogo';
        a.href = app.forum.attribute('baseUrl') || '/';
        a.setAttribute('aria-label', app.forum.attribute('title') || '');
        const img = document.createElement('img');
        img.src = logoUrl;
        img.alt = app.forum.attribute('title') || '';
        a.appendChild(img);
        a.addEventListener('click', (e) => { e.preventDefault(); m.route.set('/'); });
        document.body.appendChild(a);
    }
    };
    addMobileLogo();
    
    // /gallery adresi (eski bağlantılar, menü) galeri görünümüne yönlenir; eskiden ana sayfaya düşüyordu
    app.routes['spotters.gallery'] = {
        path: '/gallery',
        component: GalleryRedirect,
    };

    const originalTrans = app.translator.trans.bind(app.translator);
    app.translator.trans = function(id, parameters) {
        if (id === 'core.forum.index_sort.gallery_button') {
            return 'Fotoğraflar';
        }
        if (id === 'core.forum.index_sort.feed_button') {
            return 'Akış';
        }
        if (id === 'flarum-tags.forum.index.tags_link' || id === 'tags.forum.index.tags_link') {
            return 'Ana Sayfa';
        }
        if (id === 'core.forum.index.meta_title_text') {
            if (app.current && app.current.get('routeName') === 'index') {
                if (m.route.param('sort') === 'feed') return 'Akış';
                if (m.route.param('sort') === 'gallery') return 'Galeri';
            }
        }
        return originalTrans(id, parameters);
    };

    const isHomePage = () => {
        const path = m.route.get();
        const routeName = app.current && app.current.get('routeName');
        // Yalnızca sitenin kök adresi: "Tüm Tartışmalar" (/all) ana sayfanın karşılama alanını ve tablosunu tekrar etmez
        return path === '/' || path === '' || path === '/tags' || routeName === 'tags';
    };

    // Galeri/akış görünümü kategoriye taşınmaz: Flarum sıralama parametresini (sort=gallery) bağlantılara
    // yapışık taşıdığı için başka sayfadan bir kategoriye girilince ?sort kaldırılır ve kategori kendi
    // varsayılan düzeniyle açılır. Kategorinin içinde galeriye geçmek serbesttir.
    let lastTag = null;
    extend(IndexPage.prototype, 'oninit', function () {
        const route = app.current.get('routeName');
        const tag = route === 'tag' ? m.route.param('tags') : null;
        const sort = m.route.param('sort');
        if (tag && lastTag !== tag && (sort === 'gallery' || sort === 'feed')) {
            const params = Object.assign({}, m.route.param());
            delete params.sort;
            lastTag = tag;
            setTimeout(() => m.route.set(app.route('tag', params), null, { replace: true }), 0);
            return;
        }
        lastTag = tag;
    });

    extend(IndexPage.prototype, 'oncreate', function () {
        if (app.forum.attribute('framioCategoryGalleryActive') !== '0') {
            const isCarouselMode = app.forum.attribute('framioTagLayoutMode') === 'carousel';
            if (isHomePage() && isCarouselMode) {
                document.body.classList.add('Framio-CarouselMode-Active');
            }
            if (isHomePage()) {
                document.body.classList.add('Framio-HomePage-Active');
            }
        }
    });

    // İstatistik widget'ının yerleşimi artık Forum İstatistikleri ayarlarından yönetiliyor

    override(IndexSidebar.prototype, 'navItems', function (original) {
        const items = original();
        if (items.has('allDiscussions')) {
            items.remove('allDiscussions');
        }

        if (items.has('tags')) {
            const tagsItem = items.get('tags');
            if (tagsItem && tagsItem.attrs) {
                tagsItem.attrs.icon = 'fas fa-home';
            }
        }

        items.add(
            'akis',
            <LinkButton href={app.route('index', { sort: 'feed' })} icon="fas fa-stream" active={app.current.get('routeName') === 'index' && m.route.param('sort') === 'feed'}>
                Akış
            </LinkButton>,
            90
        );

        if (app.forum.attribute('framioExploreActive') !== '0') {
            items.add(
                'explore',
                <LinkButton href={app.route('framio.explore')} icon="fas fa-compass" active={app.current.get('routeName') === 'framio.explore'}>
                    {app.forum.attribute('framioExploreTitle') || 'Keşfet'}
                </LinkButton>,
                75
            );
        }

        if (app.forum.attribute('framioGalleryActive') !== '0') {
            items.add(
                'gallery',
                <LinkButton href={app.route('index', { sort: 'gallery' })} icon="fas fa-camera-retro" active={app.current.get('routeName') === 'index' && m.route.param('sort') === 'gallery'}>
                    Galeri
                </LinkButton>,
                80
            );
        }

        // Menü yöneticisinde sıra tanımlıysa varsayılan sıralama uygulanmaz
        const origToArray = items.toArray.bind(items);
        const managed = (() => { try { return JSON.parse(app.forum.attribute('framioNavMenu') || '[]').length > 0; } catch (e) { return false; } })();
        if (!managed) items.toArray = function () {
            if (this.has('tags')) this.setPriority('tags', 100);
            if (this.has('akis')) this.setPriority('akis', 90);
            if (this.has('gallery')) this.setPriority('gallery', 80);
            if (this.has('following')) this.setPriority('following', 70);
            if (this.has('subscriptions')) this.setPriority('subscriptions', 70);
            if (this.has('fof-user-directory')) this.setPriority('fof-user-directory', 60);
            return origToArray();
        };

        return items;
    });

    extend(IndexPage.prototype, 'oncreate', function () {
        if (isHomePage()) {
            document.body.classList.add('Framio-HomePage-Active');
            if (app.forum.attribute('framioTagLayoutMode') === 'carousel') {
                document.body.classList.add('Framio-CarouselMode-Active');
            }
            if (app.forum.attribute('framioSliderActive') !== '0') {
                document.body.classList.add('Framio-Slider-Active');
            }
        }
    });

    extend(IndexPage.prototype, 'view', function (vdom) {
        if (vdom && vdom.attrs) {
            const sortParam = m.route.param('sort');
            const isIndex = app.current.get('routeName') === 'index';
            
            // Clean up all instances of the classes
            vdom.attrs.className = (vdom.attrs.className || '')
                .replace(/\bFramio-Feed-Active\b/g, '')
                .replace(/\bFramio-Gallery-Active\b/g, '')
                .trim();
            
            if (isIndex && sortParam === 'feed') {
                vdom.attrs.className += ' Framio-Feed-Active';
            } else if (isIndex && sortParam === 'gallery') {
                vdom.attrs.className += ' Framio-Gallery-Active';
            }
        }
    });

    // Telefon kategori sayfası, Tartışmalar sekmesi: satırın solunda tartışmanın ilk fotoğrafı.
    // Mithril'in yönettiği DOM'a öğe eklenmez; görsel CSS değişkeniyle verilir.
    const setThumb = function () {
        try {
            if (!document.documentElement.classList.contains('MobileTagPage') || !this.element) return;
            const d = this.attrs.discussion;
            const url = d && discussionThumb(d.id());
            if (url) {
                this.element.style.setProperty('--fc-thumb', 'url("' + url.replace(/"/g, '%22') + '")');
                this.element.classList.add('has-thumb');
            }
        } catch (e) {}
    };
    extend('flarum/forum/components/DiscussionListItem', 'oncreate', setThumb);
    extend('flarum/forum/components/DiscussionListItem', 'onupdate', setThumb);

    // Telefon kategori sayfası (onaylı maket 2b): büyük başlık kutusu yerine kategori başlığı
    override(IndexPage.prototype, 'hero', function (original) {
        try {
            // Flarum 2'de IndexPage.currentTag yok: kategori adresteki kısa addan bulunur
            const slug = app.current.get('routeName') === 'tag' ? String(m.route.param('tags') || '').toLowerCase() : '';
            const tag = slug && app.store.all('tags').find((t) => t.slug().toLowerCase() === slug);
            if (tag && window.matchMedia('(max-width: 767px)').matches) {
                document.documentElement.classList.add('MobileTagPage');
                return <MobileTagHeader category={tag} />;
            }
        } catch (e) {}
        document.documentElement.classList.remove('MobileTagPage');
        return original();
    });

    // Akış ve Galeri sayfalarının başlık alanı (admin → Akış & Galeri Sayfaları)
    override(IndexPage.prototype, 'hero', function (original) {
        const sortParam = m.route.param('sort');
        const isIndex = app.current.get('routeName') === 'index';
        if (!isIndex || (sortParam !== 'feed' && sortParam !== 'gallery')) return original();

        const defaults = {
            feed: { title: 'Akış', icon: 'fas fa-stream' },
            gallery: { title: 'Galeri', icon: 'fas fa-camera-retro' },
        };
        let all = {};
        try { all = JSON.parse(app.forum.attribute('framioPageHeroes') || '{}') || {}; } catch (e) {}
        const c = { active: true, align: 'center', size: 'normal', ...defaults[sortParam], ...(all[sortParam] || {}) };
        if (c.active === false) return null;

        const pad = { compact: '12px', normal: '24px', large: '48px' }[c.size] || '24px';
        const style = { paddingTop: pad, paddingBottom: pad, textAlign: c.align };
        if (c.bgColor) style.background = c.bgColor;
        if (c.bgImage) {
            style.backgroundImage = (c.overlay !== false ? 'linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), ' : '') + 'url(' + c.bgImage + ')';
            style.backgroundSize = 'cover';
            style.backgroundPosition = 'center';
        }
        const color = c.textColor || (c.bgImage ? '#fff' : undefined);

        return m('header', { className: 'Hero TagHero Framio-PageHero Framio-PageHero--' + sortParam, style },
            m('div', { className: 'container' },
                m('div', { className: 'containerNarrow', style: { margin: c.align === 'center' ? '0 auto' : undefined, maxWidth: c.align === 'center' ? undefined : 'none' } }, [
                    c.title || c.icon ? m('h1', { className: 'Hero-title', style: { textAlign: c.align, marginBottom: c.subtitle ? '6px' : 0, color } }, [
                        c.icon ? m('i', { className: 'icon ' + c.icon, style: { marginRight: c.title ? '10px' : 0 } }) : null,
                        c.title,
                    ]) : null,
                    c.subtitle ? m('div', { className: 'Hero-subtitle', style: { textAlign: c.align, color, opacity: .85 } }, c.subtitle) : null,
                ])
            )
        );
    });

    extend(IndexPage.prototype, 'onremove', function () {
        document.body.classList.remove('Framio-HomePage-Active');
        document.body.classList.remove('Framio-CarouselMode-Active');
        document.body.classList.remove('Framio-Slider-Active');
    });

    extend(PageStructure.prototype, 'mainItems', function (items) {
        if (isHomePage() && app.forum.attribute('framioSliderActive') !== '0') {
            // priority 50 is below 'hero' (100) and above 'container' (10)
            items.add('framioSlider', <HeroSlider />, 50);
        }
        
        if (isHomePage()) {
            // LatestActivity just above the main container (priority > 10)
            items.add('framioLatestActivity', <div className="container"><LatestActivity /></div>, 20);
        }
    });

    const injectToContentItems = function (items) {
        if (isHomePage()) {
            // Priority reference for TagsPage:
            // tagTiles: 100
            
            // To be at the VERY BOTTOM (below categories), CustomHomepage must have priority < 100
            if (app.forum.attribute('framioGalleryActive') !== '0') {
                items.add('framioCustomHomepage', <CustomHomepage />, 50);
            }
        }
    };

    extend(IndexPage.prototype, 'contentItems', injectToContentItems);
    
    const TagsPage = (app.routes.tags && app.routes.tags.component) || (window.flarum && flarum.reg && flarum.reg.get('flarum-tags', 'forum/components/TagsPage'));
    if (TagsPage) {
        extend(TagsPage.prototype, 'oncreate', function () {
            if (isHomePage()) {
                document.body.classList.add('Framio-HomePage-Active');
                if (app.forum.attribute('framioTagLayoutMode') === 'carousel') {
                    document.body.classList.add('Framio-CarouselMode-Active');
                }
                if (app.forum.attribute('framioSliderActive') !== '0') {
                    document.body.classList.add('Framio-Slider-Active');
                }
            }
        });

        extend(TagsPage.prototype, 'onremove', function () {
            document.body.classList.remove('Framio-HomePage-Active');
            document.body.classList.remove('Framio-CarouselMode-Active');
            document.body.classList.remove('Framio-Slider-Active');
        });

        extend(TagsPage.prototype, 'contentItems', function (items) {
            injectToContentItems(items);
            
            const isCarouselMode = app.forum.attribute('framioTagLayoutMode') === 'carousel';

            if (isHomePage() && isCarouselMode) {
                items.add('framioTagCarousel', <TagCarousel />, 125);
            }
        });
    }

    override(DiscussionListState.prototype, 'sortMap', function (original) {
        const map = original();
        const currentRoute = app.current.get('routeName');
        
        if (currentRoute === 'tag' && app.forum.attribute('framioCategoryGalleryActive') !== '0') {
            const tagSlug = m.route.param('tags');
            const tag = app.store.all('tags').find(t => t.slug() === tagSlug);
            const isSecondary = tag && tag.parent() ? true : false;
            
            let overrides = {};
            try { overrides = JSON.parse(app.forum.attribute('framioTagGalleryOverrides') || '{}'); } catch(e) {}
            const tagOverride = overrides[tagSlug];
            const isCustom = tagOverride && tagOverride.override_active === '1';

            const isGalleryActive = isCustom 
                ? tagOverride.gallery_active !== '0' 
                : (isSecondary ? app.forum.attribute('framioSecondaryGalleryActive') !== '0' : app.forum.attribute('framioPrimaryGalleryActive') !== '0');
            
            const defaultSort = isCustom 
                ? tagOverride.default_sort || 'gallery' 
                : (isSecondary ? app.forum.attribute('framioSecondaryDefaultSort') || 'gallery' : app.forum.attribute('framioPrimaryDefaultSort') || 'gallery');

            if (isGalleryActive) {
                if (defaultSort === 'gallery') {
                    const newMap = { gallery: 'gallery', feed: 'feed' };
                    for (const key in map) newMap[key] = map[key];
                    return newMap;
                } else if (defaultSort === 'feed') {
                    const newMap = { feed: 'feed', gallery: 'gallery' };
                    for (const key in map) newMap[key] = map[key];
                    return newMap;
                } else {
                    const newMap = {};
                    for (const key in map) newMap[key] = map[key];
                    newMap['gallery'] = 'gallery';
                    newMap['feed'] = 'feed';
                    return newMap;
                }
            }
        } else if (currentRoute === 'index') {
            const newMap = {};
            for (const key in map) newMap[key] = map[key];
            newMap['feed'] = 'feed';
            newMap['gallery'] = 'gallery';
            return newMap;
        }
        
        return map;
    });

    override(DiscussionListState.prototype, 'requestParams', function (original) {
        const params = original();
        if (params.sort === 'gallery' || params.sort === 'feed') {
            delete params.sort;
        }
        return params;
    });

    override(DiscussionList.prototype, 'view', function (original) {
        const currentRoute = app.current.get('routeName');
        const state = this.attrs.state;

        if (currentRoute === 'index') {
            const sortParam = m.route.param('sort') || Object.keys(state.sortMap())[0];
            if (sortParam === 'feed') {
                return (
                    <div className={"DiscussionList" + (state.isSearchResults() ? " DiscussionList--searchResults" : "")}>
                        <div className="DiscussionList-FeedView">
                            <CategoryFeed sort={sortParam} />
                        </div>
                    </div>
                );
            }
            if (sortParam === 'gallery') {
                return (
                    <div className={"DiscussionList" + (state.isSearchResults() ? " DiscussionList--searchResults" : "")}>
                        <div className="DiscussionList-GalleryView">
                            <CategoryGallery isMainGallery={true} sort={sortParam} />
                        </div>
                    </div>
                );
            }
        }

        if (currentRoute === 'tag' && app.forum.attribute('framioCategoryGalleryActive') !== '0') {
            
            const tagSlug = m.route.param('tags');
            const tag = app.store.all('tags').find(t => t.slug() === tagSlug);
            const isSecondary = tag && tag.parent() ? true : false;
            
            let overrides = {};
            try { overrides = JSON.parse(app.forum.attribute('framioTagGalleryOverrides') || '{}'); } catch(e) {}
            const tagOverride = overrides[tagSlug];
            const isCustom = tagOverride && tagOverride.override_active === '1';

            const isGalleryActive = isCustom 
                ? tagOverride.gallery_active !== '0' 
                : (isSecondary ? app.forum.attribute('framioSecondaryGalleryActive') !== '0' : app.forum.attribute('framioPrimaryGalleryActive') !== '0');
                
            const showInOtherTabs = isCustom 
                ? tagOverride.other_tabs_active !== '0' 
                : (isSecondary ? app.forum.attribute('framioSecondaryOtherTabsActive') !== '0' : app.forum.attribute('framioPrimaryOtherTabsActive') !== '0');
                
            const galleryPosition = isCustom 
                ? tagOverride.position || 'top' 
                : (isSecondary ? app.forum.attribute('framioSecondaryGalleryPosition') || 'top' : app.forum.attribute('framioPrimaryGalleryPosition') || 'top');

            if (!isGalleryActive) {
                return original();
            }

            const sortParam = m.route.param('sort') || Object.keys(state.sortMap())[0];
            
            if (sortParam === 'gallery') {
                return (
                    <div className={"DiscussionList" + (state.isSearchResults() ? " DiscussionList--searchResults" : "")}>
                        <div className="DiscussionList-GalleryView">
                            <CategoryGallery tagSlug={tagSlug} isMainGallery={true} sort={sortParam} />
                        </div>
                    </div>
                );
            }
            if (sortParam === 'feed') {
                return (
                    <div className={"DiscussionList" + (state.isSearchResults() ? " DiscussionList--searchResults" : "")}>
                        <div className="DiscussionList-FeedView">
                            <CategoryFeed tagSlug={tagSlug} sort={sortParam} />
                        </div>
                    </div>
                );
            }

            const origContent = original();
            
            if (showInOtherTabs) {
                return (
                    <div className="Framio-DiscussionList-WithGallery">
                        {galleryPosition === 'top' && (
                            <div className="DiscussionList-GalleryView" style={{ marginBottom: '30px' }}>
                                <CategoryGallery tagSlug={tagSlug} isMainGallery={false} sort={sortParam} />
                            </div>
                        )}
                        
                        {origContent}
                        
                        {galleryPosition === 'bottom' && (
                            <div className="DiscussionList-GalleryView" style={{ marginTop: '30px' }}>
                                <CategoryGallery tagSlug={tagSlug} isMainGallery={false} sort={sortParam} />
                            </div>
                        )}
                    </div>
                );
            }

            return origContent;
        }

        return original();
    });
});