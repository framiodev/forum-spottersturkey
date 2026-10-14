import app from 'flarum/admin/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';

// [en kısa aralık (sn), etiket]: aralık, dış servisin zamanlama sapmasını tolere edecek kadar kısa tutulur
const FREQUENCIES = [
  ['50', 'Her dakika'],
  ['110', '2 dakikada bir'],
  ['290', '5 dakikada bir'],
  ['590', '10 dakikada bir'],
];

const DEFAULT_COMMANDS = 'drafts:publish\nfof:polls:publish-scheduled\nframio:social-share:process';

/**
 * Web Cron: paylaşımlı hostingte cron en az 15 dakikada bir çalışabildiği için, zamanlanmış içerik
 * komutlarının dış bir servis (ör. cron-job.org) tarafından daha sık tetiklenmesi.
 */
export default class WebCronTab extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    const s = app.data.settings;
    this.enabled = s['framio-general.web_cron_enabled'] === '1' || s['framio-general.web_cron_enabled'] === true;
    this.token = s['framio-general.web_cron_token'] || '';
    this.interval = s['framio-general.web_cron_min_interval'] || '120';
    this.commands = s['framio-general.web_cron_commands'] || DEFAULT_COMMANDS;
    this.saving = false;
  }

  frequency() {
    const v = String(this.interval);
    return FREQUENCIES.some(([sec]) => sec === v) ? v : '110';
  }

  url() {
    return this.token ? app.forum.attribute('baseUrl') + '/framio-cron/' + this.token : '';
  }

  generate() {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    this.token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  save() {
    this.saving = true;
    app
      .request({
        method: 'POST',
        url: app.forum.attribute('apiUrl') + '/settings',
        body: {
          'framio-general.web_cron_enabled': this.enabled ? '1' : '0',
          'framio-general.web_cron_token': this.token,
          'framio-general.web_cron_min_interval': this.frequency(),
          'framio-general.web_cron_commands': this.commands,
        },
      })
      .then(() => {
        Object.assign(app.data.settings, {
          'framio-general.web_cron_enabled': this.enabled ? '1' : '0',
          'framio-general.web_cron_token': this.token,
        });
        app.alerts.show({ type: 'success' }, 'Web cron ayarları kaydedildi.');
      })
      .finally(() => {
        this.saving = false;
        m.redraw();
      });
  }

  view() {
    return (
      <div className="container FramioWebCron">
        <h3>Zamanlanmış Görevler (Web Cron)</h3>
        <p className="helpText">
          Paylaşımlı hostingte sunucu cron'u en az 15 dakikada bir çalışabilir. Zamanlanmış taslak, anket ve sosyal medya paylaşımlarının
          zamanında yayımlanması için bu komutlar, aşağıdaki adres dış bir servis (ör. cron-job.org) tarafından düzenli çağrılarak çalıştırılır.
          Kuyruk ve diğer görevler sunucu cron'unda (schedule:run) kalır.
        </p>

        <div className="Form-group">
          <Switch state={this.enabled} onchange={(v) => (this.enabled = v)}>
            Web cron etkin
          </Switch>
        </div>

        <div className="Form-group">
          <label>Tetikleme adresi</label>
          <div className="FramioWebCron-url">
            <input className="FormControl" readonly value={this.url() || 'Önce anahtar üretin'} onclick={(e) => e.target.select()} />
            <Button className="Button" onclick={() => this.generate()}>
              {this.token ? 'Yeni anahtar üret' : 'Anahtar üret'}
            </Button>
          </div>
          <p className="helpText">
            Bu adresi gizli tutun; anahtar yanlışsa adres 404 döner. Yeni anahtar üretirseniz dış servisteki adresi de güncelleyin.
          </p>
        </div>

        <div className="Form-group">
          <label>Çalışma sıklığı</label>
          <select className="FormControl" value={this.frequency()} onchange={(e) => (this.interval = e.target.value)}>
            {FREQUENCIES.map(([sec, label]) => (
              <option value={sec}>{label}</option>
            ))}
          </select>
          <p className="helpText">
            Dış serviste (cron-job.org) aynı sıklığı seçin. Forum bu sıklıktan daha sık gelen çağrıları atlar; sunucu yükü seçilen sıklıkla sınırlı kalır.
          </p>
        </div>

        <div className="Form-group">
          <label>Çalıştırılacak komutlar</label>
          <textarea className="FormControl" rows="4" value={this.commands} oninput={(e) => (this.commands = e.target.value)} />
          <p className="helpText">Her satıra bir Flarum komut adı (argümansız). Yalnızca bu listedeki komutlar çalıştırılır.</p>
        </div>

        <Button className="Button Button--primary" loading={this.saving} onclick={() => this.save()}>
          Kaydet
        </Button>
      </div>
    );
  }
}
