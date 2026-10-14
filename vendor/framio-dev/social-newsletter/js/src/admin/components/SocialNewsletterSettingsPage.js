import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import saveSettings from 'flarum/admin/utils/saveSettings';

export default class SocialNewsletterSettingsPage extends ExtensionPage {
    oninit(vnode) {
        super.oninit(vnode);

        this.loadingLeads = true;
        this.leads = [];
        this.showContactModal = false;
        this.selectedLead = null;

        app.request({
            method: 'GET',
            url: app.forum.attribute('apiUrl') + '/framio-social-leads'
        }).then(response => {
            this.leads = response.data;
            this.loadingLeads = false;
            m.redraw();
        });
    }

    content() {
        return (
            <div className="SocialNewsletterSettingsPage">
                <div className="container">
                    <h3>Framio Social Newsletter Ayarları</h3>

                    <div className="Form-group">
                        <label>Pop-up Başlığı</label>
                        <input className="FormControl" bidi={this.setting('framio-social-newsletter.popup_title')} />
                    </div>

                    <div className="Form-group">
                        <label>Pop-up Açıklaması</label>
                        <textarea className="FormControl" bidi={this.setting('framio-social-newsletter.popup_desc')}></textarea>
                    </div>

                    <div className="Form-group">
                        <label>Pop-up Gecikmesi (Saniye) - Kaydırma yapılmazsa bu süre sonunda açılır</label>
                        <input type="number" className="FormControl" bidi={this.setting('framio-social-newsletter.popup_delay')} />
                    </div>

                    <div className="Form-group">
                        <label>WhatsApp Şablon Mesajı</label>
                        <textarea className="FormControl" bidi={this.setting('framio-social-newsletter.wa_template')} placeholder="Merhaba {name}, Spotters Turkey'e numaranızı bırakmıştınız..."></textarea>
                    </div>

                    <div className="Form-group">
                        <label>Instagram Şablon Mesajı</label>
                        <textarea className="FormControl" bidi={this.setting('framio-social-newsletter.ig_template')} placeholder="Merhaba {name}, sitemizi ziyaret ettiğiniz için teşekkürler..."></textarea>
                    </div>

                    {this.submitButton()}

                    <hr />

                    <h3>Müşteri / Ziyaretçi Havuzu</h3>
                    {this.loadingLeads ? <LoadingIndicator /> : this.renderLeadsTable()}
                </div>
                {this.renderContactModal()}
            </div>
        );
    }

    renderLeadsTable() {
        if (this.leads.length === 0) {
            return <p>Henüz hiçbir ziyaretçi iletişim bilgisi bırakmamış.</p>;
        }

        return (
            <table className="SocialLeadsTable">
                <thead>
                    <tr>
                        <th>Tarih</th>
                        <th>İsim</th>
                        <th>Tercih</th>
                        <th>Numara / K.Adı</th>
                        <th>Ulaş</th>
                        <th>İletişime Geçildi</th>
                        <th>Takip Ediyor</th>
                        <th>Sil</th>
                    </tr>
                </thead>
                <tbody>
                    {this.leads.map(lead => (
                        <tr key={lead.id}>
                            <td>{new Date(lead.attributes.createdAt).toLocaleString('tr-TR')}</td>
                            <td>{lead.attributes.name}</td>
                            <td>
                                {lead.attributes.contact_type === 'whatsapp' ? <i className="fab fa-whatsapp" style={{color: '#25D366'}}></i> : <i className="fab fa-instagram" style={{color: '#E1306C'}}></i>}
                                {' '} {lead.attributes.contact_type}
                            </td>
                            <td>{lead.attributes.contact_value}</td>
                            <td>
                                {lead.attributes.contact_type === 'whatsapp' ? (
                                    <Button className="Button Button--primary" onclick={() => {this.selectedLead = lead; this.showContactModal = true;}}>
                                        WhatsApp'tan Ulaş
                                    </Button>
                                ) : (
                                    <Button className="Button Button--primary" onclick={() => {this.selectedLead = lead; this.showContactModal = true;}}>
                                        Instagram'dan Ulaş
                                    </Button>
                                )}
                            </td>
                            <td>
                                <input type="checkbox" checked={lead.attributes.is_contacted} onchange={(e) => this.updateLead(lead, 'is_contacted', e.target.checked)} />
                            </td>
                            <td>
                                <input type="checkbox" checked={lead.attributes.is_following} onchange={(e) => this.updateLead(lead, 'is_following', e.target.checked)} />
                            </td>
                            <td>
                                <Button className="Button Button--danger" onclick={() => this.deleteLead(lead)}>Sil</Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    getTemplateMessage(type, name) {
        let template = app.data.settings[`framio-social-newsletter.${type}_template`] || '';
        return template.replace(/{name}/g, name || 'Değerli Ziyaretçimiz');
    }

    copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        app.alerts.show({ type: 'success' }, 'Şablon mesaj panoya kopyalandı! Şimdi açılan pencereye yapıştırabilirsiniz.');
    }

    renderContactModal() {
        if (!this.showContactModal || !this.selectedLead) return null;

        const lead = this.selectedLead;
        const isWa = lead.attributes.contact_type === 'whatsapp';
        
        let url = '';
        const message = this.getTemplateMessage(isWa ? 'wa' : 'ig', lead.attributes.name);
        const encodedMessage = encodeURIComponent(message);
        
        if (isWa) {
            let phone = lead.attributes.contact_value.replace(/\D/g, '');
            if (!phone.startsWith('90') && phone.length === 10) phone = '90' + phone;
            url = `https://wa.me/${phone}?text=${encodedMessage}`;
        } else {
            let username = lead.attributes.contact_value.replace('@', '').trim();
            url = `https://ig.me/m/${username}`;
        }
        
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;

        return (
            <div className="SocialNewsletterModal-overlay" onclick={() => this.showContactModal = false}>
                <div className="SocialNewsletterModal-content" onclick={e => e.stopPropagation()} style={{maxWidth: '700px', width: '90%'}}>
                    <button className="SocialNewsletterModal-close" onclick={() => this.showContactModal = false}>
                        <i className="fas fa-times"></i>
                    </button>
                    <h3 style={{textAlign: 'center', marginBottom: '20px'}}>İletişime Geç: {lead.attributes.name}</h3>
                    
                    <div style={{display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap'}}>
                        <div style={{flex: '1 1 300px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center'}}>
                            <h4><i className="fas fa-qrcode"></i> Telefondan Aç (Önerilen)</h4>
                            <p style={{fontSize: '13px', color: '#666', marginTop: '10px'}}>Kişisel hesap riskini sıfırlamak için resmi telefonunuzun kamerasıyla okutun.</p>
                            <img src={qrUrl} alt="QR Code" style={{width: '200px', height: '200px', margin: '15px auto', display: 'block'}} />
                            <Button className="Button" onclick={() => this.updateLead(lead, 'is_contacted', true)}>
                                <i className="fas fa-check"></i> Mesajı Attım Olarak İşaretle
                            </Button>
                        </div>
                        
                        <div style={{flex: '1 1 300px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center'}}>
                            <h4><i className="fas fa-laptop"></i> Bilgisayardan Aç</h4>
                            <div className="Alert Alert--warning" style={{textAlign: 'left', margin: '15px 0', fontSize: '13px'}}>
                                <strong>⚠️ DİKKAT:</strong> Mesajı göndermeden önce tarayıcıda doğru işletme hesabınıza giriş yaptığınızdan emin olun!
                            </div>
                            <Button className="Button Button--primary Button--block" style={{marginTop: 'auto'}} onclick={() => {
                                this.copyToClipboard(message);
                                window.open(url, '_blank');
                                this.updateLead(lead, 'is_contacted', true);
                                this.showContactModal = false;
                            }}>
                                <i className={isWa ? "fab fa-whatsapp" : "fab fa-instagram"}></i> Anladım, Web'den Devam Et
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    updateLead(lead, field, value) {
        lead.attributes[field] = value;
        m.redraw();
        
        app.request({
            method: 'PATCH',
            url: app.forum.attribute('apiUrl') + '/framio-social-leads/' + lead.id,
            body: { data: { attributes: { [field]: value } } }
        });
    }

    deleteLead(lead) {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

        this.leads = this.leads.filter(l => l.id !== lead.id);
        m.redraw();

        app.request({
            method: 'DELETE',
            url: app.forum.attribute('apiUrl') + '/framio-social-leads/' + lead.id
        });
    }
}
