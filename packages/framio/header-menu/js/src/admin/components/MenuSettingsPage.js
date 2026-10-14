import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import Button from 'flarum/common/components/Button';
import saveSettings from 'flarum/admin/utils/saveSettings';

export default class MenuSettingsPage extends ExtensionPage {
    oninit(vnode) {
        super.oninit(vnode);

        this.links = [];
        const savedLinks = app.data.settings['spottersturkey-header-menu.links'];
        if (savedLinks) {
            try {
                this.links = JSON.parse(savedLinks);
            } catch (e) {
                this.links = [];
            }
        }
    }

    content() {
        return (
            <div className="MenuSettingsPage">
                <div className="container">
                    <h3>Özel Header Menü Ayarları</h3>
                    <p className="helpText">Forumunuzun üst menüsüne (arama kutusu ile logo arasına) bağlantılar ekleyin.</p>

                    <div className="MenuItems">
                        {this.links.map((link, index) => (
                            <div className="MenuItem" key={index}>
                                <div className="MenuItem-main">
                                    <div className="Form-group">
                                        <label>Başlık</label>
                                        <input 
                                            className="FormControl" 
                                            value={link.label} 
                                            oninput={e => { link.label = e.target.value; }} 
                                            placeholder="Örn: Kurallar" 
                                        />
                                    </div>
                                    <div className="Form-group">
                                        <label>URL (Açılır menü başlığı ise boş bırakın)</label>
                                        <input 
                                            className="FormControl" 
                                            value={link.url} 
                                            oninput={e => { link.url = e.target.value; }} 
                                            placeholder="https://..." 
                                        />
                                    </div>
                                    <div className="Form-group">
                                        <label>İkon (FontAwesome)</label>
                                        <input 
                                            className="FormControl" 
                                            value={link.icon} 
                                            oninput={e => { link.icon = e.target.value; }} 
                                            placeholder="fas fa-book" 
                                        />
                                    </div>
                                    <div className="Form-group" style={{ flex: '0 0 auto', alignSelf: 'center', marginTop: '20px' }}>
                                        <label className="checkbox">
                                            <input 
                                                type="checkbox" 
                                                checked={link.target === '_blank'} 
                                                onchange={e => { link.target = e.target.checked ? '_blank' : '_self'; }} 
                                            />
                                            Yeni Sekme
                                        </label>
                                    </div>
                                    <Button className="Button Button--danger" onclick={() => this.removeLink(index)}>
                                        <i className="fas fa-trash"></i>
                                    </Button>
                                </div>
                                
                                <div className="MenuItem-sublinks">
                                    <h4>Alt Menü Bağlantıları (Dropdown)</h4>
                                    {(link.sublinks || []).map((sublink, subIndex) => (
                                        <div className="MenuItem-sublink" key={`sub-${subIndex}`}>
                                            <input className="FormControl" value={sublink.label} oninput={e => sublink.label = e.target.value} placeholder="Alt Başlık" />
                                            <input className="FormControl" value={sublink.url} oninput={e => sublink.url = e.target.value} placeholder="URL" />
                                            <input className="FormControl" value={sublink.icon} oninput={e => sublink.icon = e.target.value} placeholder="İkon (opsiyonel)" />
                                            <Button className="Button Button--danger" onclick={() => this.removeSublink(index, subIndex)}><i className="fas fa-times"></i></Button>
                                        </div>
                                    ))}
                                    <Button className="Button" onclick={() => this.addSublink(index)}><i className="fas fa-plus"></i> Alt Menü Ekle</Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                        <Button className="Button Button--primary" onclick={this.addLink.bind(this)}>
                            <i className="fas fa-plus"></i> Yeni Ana Link Ekle
                        </Button>
                        <Button className="Button Button--primary" onclick={this.saveMenu.bind(this)} loading={this.saving}>
                            <i className="fas fa-save"></i> Değişiklikleri Kaydet
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    addLink() {
        this.links.push({ label: '', url: '', icon: '', target: '_self', sublinks: [] });
    }

    removeLink(index) {
        this.links.splice(index, 1);
    }

    addSublink(index) {
        if (!this.links[index].sublinks) {
            this.links[index].sublinks = [];
        }
        this.links[index].sublinks.push({ label: '', url: '', icon: '' });
    }

    removeSublink(index, subIndex) {
        this.links[index].sublinks.splice(subIndex, 1);
    }

    saveMenu(e) {
        e.preventDefault();
        this.saving = true;

        saveSettings({
            'spottersturkey-header-menu.links': JSON.stringify(this.links)
        }).then(() => {
            this.saving = false;
            m.redraw();
            app.alerts.show({ type: 'success' }, 'Menü kaydedildi!');
        }).catch(() => {
            this.saving = false;
            m.redraw();
        });
    }
}
