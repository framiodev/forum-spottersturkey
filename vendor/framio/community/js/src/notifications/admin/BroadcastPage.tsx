import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';

const P = 'notifications.';

const STATUS: Record<string, string> = {
  pending: 'Bekliyor',
  sent: 'Gönderildi',
  failed: 'Hata',
  skipped: '—',
};

/**
 * Grup yayını: forum mesajlarını Telegram / WhatsApp gruplarına duyurur.
 * Üstte ayarlar, altta kuyruk (bekleyenler, elle gönderme, WhatsApp hazır metni).
 */
export default class BroadcastPage extends ExtensionPage {
  state: any = null;
  busy: string | null = null;
  copied = false;

  oninit(vnode: any) {
    super.oninit(vnode);
    this.load();
  }

  load() {
    app
      .request({ method: 'GET', url: app.forum.attribute('apiUrl') + '/framio-broadcast' })
      .then((res: any) => {
        this.state = res;
        m.redraw();
      })
      .catch(() => {});
  }

  action(action: string, data: Record<string, any> = {}, success?: string) {
    this.busy = action + (data.channel || '');
    m.redraw();
    app
      .request({ method: 'POST', url: app.forum.attribute('apiUrl') + '/framio-broadcast', body: { action, ...data } })
      .then((res: any) => {
        this.state = res;
        const errors = res.result && res.result.errors;
        if (errors && errors.length) app.alerts.show({ type: 'error' }, errors.join(' · '));
        else if (success) app.alerts.show({ type: 'success' }, success);
      })
      .catch(() => {})
      .finally(() => {
        this.busy = null;
        m.redraw();
      });
  }

  field(key: string, type: string, label: string, help?: string, extra: Record<string, any> = {}) {
    return this.buildSettingComponent({ setting: P + key, type, label, help, ...extra });
  }

  content() {
    const waMode = this.setting(P + 'whatsapp_mode', 'manual')();

    return (
      <div className="FramioBroadcastPage">
        <div className="container">
          <p className="helpText">
            Forumda yeni bir konu ya da mesaj paylaşıldığında grubunuza duyuru gider. Yalnızca herkese açık içerik gönderilir; gizli ve
            kısıtlı etiketlerdeki mesajlar gruba gitmez. Gönderim mesaj yazmayı yavaşlatmaz.
          </p>

          <h3>Gönderim</h3>
          {this.field('send_mode', 'select', 'Gönderim zamanı', 'Toplu modda biriken mesajlar tek bir derleme mesajı olarak gider.', {
            options: {
              instant: 'Anında — her mesaj ayrı duyurulur',
              batch: 'Toplu — belirli sayıda mesaj birikince',
              manual: 'Elle — yalnızca bu sayfadan gönderilir',
            },
            default: 'batch',
          })}
          {this.field('batch_size', 'number', 'Toplu gönderimde mesaj sayısı', '1–10 arası. Telegram albümleri en fazla 10 fotoğraf alır.', { min: 1, max: 10, placeholder: '5' })}
          {this.field('include_photos', 'boolean', 'Fotoğraflarıyla gönder (Telegram)', 'Tek mesajda fotoğraf + künye, toplu gönderimde albüm.', { default: true })}

          <h3>Telegram</h3>
          {this.field('telegram_enabled', 'boolean', 'Telegram duyurularını aç')}
          {this.field('telegram_bot_token', 'text', 'Bot Token', "BotFather'ın verdiği anahtar (123456789:ABC…). Kimseyle paylaşmayın.")}
          {this.field('telegram_chat_id', 'text', 'Grup / kanal kimliği', 'Örn. -1001234567890. Birden çok grup için virgülle ayırın.')}
          {this.field('telegram_thread_id', 'text', 'Konu (topic) kimliği — isteğe bağlı', 'Grubunuzda "Konular" açıksa duyuruların gideceği konunun kimliği.')}
          <details className="FramioBroadcast-guide">
            <summary>Telegram kurulumu nasıl yapılır?</summary>
            <ol>
              <li>Telegram'da <b>@BotFather</b> ile konuşun, <code>/newbot</code> yazın, bota bir ad ve kullanıcı adı verin. Size bir <b>Bot Token</b> verir; yukarıya yapıştırın.</li>
              <li>Botu duyuru yapılacak <b>gruba üye olarak ekleyin</b> (kanal kullanıyorsanız kanala <b>yönetici</b> olarak ekleyin, "Mesaj gönderme" izni açık olsun).</li>
              <li>Grupta herhangi bir mesaj yazın. Ardından tarayıcıda <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> adresini açın; <code>"chat":{'{'}"id":-100…</code> değeri grup kimliğidir.</li>
              <li>Kanal herkese açıksa kimlik yerine <code>@kanal_adi</code> da yazabilirsiniz.</li>
              <li>Kaydedip <b>Test mesajı gönder</b> düğmesine basın; gruba son forum mesajı gelmeli.</li>
            </ol>
          </details>
          <div className="Form-group">
            <Button className="Button" icon="fab fa-telegram" loading={this.busy === 'testtelegram'} onclick={() => this.action('test', { channel: 'telegram' }, 'Telegram test mesajı gönderildi.')}>
              Test mesajı gönder
            </Button>
          </div>

          <h3>WhatsApp</h3>
          {this.field('whatsapp_mode', 'select', 'WhatsApp gönderimi', undefined, {
            options: {
              off: 'Kapalı',
              manual: 'Elle — hazır metin, tek tıkla gruba (sunucu gerekmez)',
              gateway: 'Otomatik — barındırılan WhatsApp API servisi (ücretli)',
            },
            default: 'manual',
          })}
          <p className="helpText">
            WhatsApp'ın resmî API'si gruplara mesaj göndermeyi desteklemez. Ek sunucu olmadan <b>Elle</b> modu kullanılır: biriken mesajlar aşağıda hazır
            metin olarak bekler, <b>WhatsApp'ta Aç</b> ile grubu seçip gönderirsiniz. Otomatik gönderim için Whapi.Cloud, Green-API gibi grup destekli
            barındırılan bir servise üye olmanız gerekir.
          </p>
          {waMode === 'gateway' && [
            this.field('whatsapp_gateway_url', 'text', 'Servisin mesaj gönderme adresi', 'Servisin belgelerindeki "send text message" uç noktası.'),
            this.field('whatsapp_gateway_token', 'text', 'API anahtarı', 'Authorization: Bearer olarak gönderilir.'),
            this.field('whatsapp_group_id', 'text', 'Grup kimliği', 'Örn. 120363000000000000@g.us'),
            <div className="Form-group">
              <Button className="Button" icon="fab fa-whatsapp" loading={this.busy === 'testwhatsapp'} onclick={() => this.action('test', { channel: 'whatsapp' }, 'WhatsApp test mesajı gönderildi.')}>
                Test mesajı gönder
              </Button>
            </div>,
          ]}

          {this.submitButton()}

          <hr />
          {this.queue()}
        </div>
      </div>
    );
  }

  queue() {
    const s = this.state;
    if (!s) return <LoadingIndicator />;

    const draft = s.whatsapp_draft;

    return (
      <div className="FramioBroadcast-queue">
        <h3>Duyuru kuyruğu</h3>
        <p className="helpText">
          Bekleyen — Telegram: <b>{s.pending.telegram}</b> · WhatsApp: <b>{s.pending.whatsapp}</b>
        </p>
        <div className="Form-group">
          <Button className="Button Button--primary" icon="fas fa-paper-plane" loading={this.busy === 'send'} disabled={!s.pending.telegram && !(s.whatsapp_mode === 'gateway' && s.pending.whatsapp)} onclick={() => this.action('send', {}, 'Bekleyen duyurular gönderildi.')}>
            Bekleyenleri şimdi gönder
          </Button>{' '}
          <Button className="Button" icon="fas fa-sync" onclick={() => this.load()}>Yenile</Button>
        </div>

        {draft && draft.text ? (
          <div className="FramioBroadcast-draft">
            <h4>WhatsApp için hazır metin ({draft.ids.length} mesaj)</h4>
            <textarea className="FormControl" rows={8} readonly value={draft.text} />
            <div className="FramioBroadcast-draftActions">
              <Button
                className="Button"
                icon="fas fa-copy"
                onclick={() => {
                  navigator.clipboard.writeText(draft.text).then(() => {
                    this.copied = true;
                    m.redraw();
                  });
                }}
              >
                {this.copied ? 'Kopyalandı' : 'Kopyala'}
              </Button>{' '}
              <a className="Button" href={'https://wa.me/?text=' + encodeURIComponent(draft.text)} target="_blank" rel="noopener">
                <i className="fab fa-whatsapp" /> WhatsApp'ta Aç
              </a>{' '}
              <Button className="Button Button--primary" icon="fas fa-check" onclick={() => { this.copied = false; this.action('whatsapp_done', { ids: draft.ids }, 'WhatsApp duyurusu gönderildi olarak işaretlendi.'); }}>
                Gruba gönderdim
              </Button>
            </div>
          </div>
        ) : null}

        <table className="FramioBroadcast-table">
          <thead>
            <tr>
              <th>Mesaj</th>
              <th>Telegram</th>
              <th>WhatsApp</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {s.items.length === 0 ? (
              <tr>
                <td colspan="4" className="helpText">Henüz duyuru yok. Kanal açıkken yeni mesajlar burada görünür.</td>
              </tr>
            ) : (
              s.items.map((i: any) => (
                <tr key={i.id}>
                  <td>
                    <a href={app.forum.attribute('baseUrl') + '/d/' + i.discussion_id + (i.slug ? '-' + i.slug : '') + '/' + i.number} target="_blank" rel="noopener">
                      {i.kind === 'discussion' ? '🆕 ' : ''}
                      {i.title} #{i.number}
                    </a>
                    {i.error ? <div className="FramioBroadcast-error">{i.error}</div> : null}
                  </td>
                  <td className={'is-' + i.telegram}>{STATUS[i.telegram] || i.telegram}</td>
                  <td className={'is-' + i.whatsapp}>{STATUS[i.whatsapp] || i.whatsapp}</td>
                  <td>
                    {(i.telegram === 'failed' || i.telegram === 'pending') && (
                      <Button className="Button Button--link" icon="fas fa-redo" title="Şimdi gönder" onclick={() => this.action('send', { ids: [i.id] })} />
                    )}
                    {(i.telegram === 'pending' || i.whatsapp === 'pending') && (
                      <Button className="Button Button--link" icon="fas fa-ban" title="Gönderme" onclick={() => this.action('skip', { ids: [i.id] })} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }
}
