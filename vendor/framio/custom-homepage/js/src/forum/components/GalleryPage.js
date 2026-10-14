import { siteLabel, loadingText, emptyText, shareText, photoFallbackTitle } from '../texts';
import IndexPage from 'flarum/forum/components/IndexPage';
import CustomHomepage from './CustomHomepage';
import listItems from 'flarum/common/helpers/listItems';

const icon = (iconName, attrs = {}) => {
  attrs.className = (attrs.className || '') + ' icon ' + iconName;
  return m('i', attrs);
};
export default class GalleryPage extends IndexPage {
    oninit(vnode) {
        super.oninit(vnode);
        this.homepage = new CustomHomepage();
        this.homepage.oninit(vnode);
        this.gridColumns = localStorage.getItem('spottersGalleryColumns') || '3';
    }

    setTitle() {
        app.setTitle('Galeri');
    }

    oncreate(vnode) {
        super.oncreate(vnode);
        this.homepage.oncreate(vnode);
    }

    onremove(vnode) {
        super.onremove(vnode);
        this.homepage.onremove(vnode);
    }

    hero() {
        return m('header', { className: 'Hero TagHero' }, 
            m('div', { className: 'container' }, 
                m('div', { className: 'containerNarrow' }, 
                    m('h1', { className: 'Hero-title', style: { textAlign: 'center', marginBottom: 0 } }, [
                        m('i', { className: 'icon fas fa-camera-retro', style: { marginRight: '10px' } }),
                        'Galeri'
                    ])
                )
            )
        );
    }

    view() {
        const posts = this.homepage.galleryPosts;
        const loading = this.homepage.loadingGallery;

        return (
            <div className="IndexPage">
                {this.hero()}
                <div className="container">
                    <div className="sideNavContainer">
                        <nav className="IndexPage-nav sideNav">
                            <ul>{listItems(this.sidebarItems().toArray())}</ul>
                        </nav>
                        <div className="IndexPage-results sideNavOffset">
                            <div className="CustomHomepage-BottomArea">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div className="LayoutA-SectionTitle" style={{ margin: 0 }}>GALERİ</div>
                                    <div className="Gallery-GridToggle" style={{ display: 'flex', gap: '5px' }}>
                                        <button 
                                            className={"Button Button--icon " + (this.gridColumns === '2' ? 'Button--primary' : 'Button--link')}
                                            onclick={() => { this.gridColumns = '2'; localStorage.setItem('spottersGalleryColumns', '2'); }}
                                            title="2'li Görünüm"
                                        >
                                            <i className="fas fa-th-large"></i>
                                        </button>
                                        <button 
                                            className={"Button Button--icon " + (this.gridColumns === '3' ? 'Button--primary' : 'Button--link')}
                                            onclick={() => { this.gridColumns = '3'; localStorage.setItem('spottersGalleryColumns', '3'); }}
                                            title="3'lü Görünüm"
                                        >
                                            <i className="fas fa-th"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                {loading ? (
                                    <div className="Spotters-Skeleton-Container" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '20px 0', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                        {app.forum.attribute('logoUrl') ? (
                                            <img src={app.forum.attribute('logoUrl')} alt="Logo" style={{ maxHeight: '60px', marginBottom: '15px', opacity: '0.9', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                                        ) : (
                                            <div style={{ fontSize: '40px', color: 'var(--primary-color)', marginBottom: '15px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{icon('fas fa-camera-retro')}</div>
                                        )}
                                        <h3 style={{ fontFamily: '"Cairo", sans-serif', margin: '0', color: 'var(--heading-color)', fontSize: '20px', fontWeight: '700', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                            {loadingText()}
                                        </h3>
                                    </div>
                                ) : posts.length > 0 ? (
                                    <div className={"LayoutA-Grid" + (this.gridColumns === '2' ? ' Grid-2' : '')}>
                                        {posts.map((post, idx) => this.homepage.renderCard(post, idx))}
                                    </div>
                                ) : (
                                    <p>Gösterilecek fotoğraf bulunamadı.</p>
                                )}
                            </div>
                            {this.homepage.lightboxOpen && this.homepage.renderLightbox()}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}