import Form from 'flarum/common/components/Form';
import app from 'flarum/forum/app';
import Alert from 'flarum/common/components/Alert';
import Button from 'flarum/common/components/Button';
import FormModal, { IFormModalAttrs } from 'flarum/common/components/FormModal';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Draft from '../models/Draft';

interface ScheduleDraftModalAttrs extends IFormModalAttrs {
  draft: Draft;
}

export default class ScheduleDraftModal extends FormModal<ScheduleDraftModalAttrs> {
  loading: boolean = false;
  titleError: boolean = false;
  date!: string;
  time!: string;
  previewFormatString!: string;

  oninit(vnode: any) {
    super.oninit(vnode);

    const now = dayjs();
    this.date = now.format('YYYY-MM-DD');
    this.time = now.format('HH:mm');

    this.previewFormatString = app.translator.trans('fof-drafts.forum.schedule_draft_modal.schedule_time_preview_formatter')[0] as string;
  }

  className(): string {
    return 'ScheduleDraftModal';
  }

  title(): string {
    return app.translator.trans('fof-drafts.forum.schedule_draft_modal.title') as string;
  }

  content() {
    if (this.loading) {
      return <LoadingIndicator />;
    }

    return [
      this.attrs.draft.scheduledFor() ? (
        <div className="Modal-alert">
          <Alert type="success" dismissible={false}>
            {app.translator.trans('fof-drafts.forum.schedule_draft_modal.scheduled_text', {
              datetime: this.formattedDateTime(),
            })}
          </Alert>
        </div>
      ) : (
        ''
      ),
      this.attrs.draft.scheduledValidationError() ? (
        <div className="Modal-alert">
          <Alert type="error" dismissible={false}>
            {app.translator.trans('fof-drafts.forum.schedule_draft_modal.scheduled_error', {
              error: this.attrs.draft.scheduledValidationError(),
            })}
          </Alert>
        </div>
      ) : (
        ''
      ),
      this.titleError ? (
        <div className="Modal-alert">
          <Alert type="error" dismissible={false}>
            {app.translator.trans('fof-drafts.forum.schedule_draft_modal.no_title_error')}
          </Alert>
        </div>
      ) : (
        ''
      ),

      <input style="display: none"></input>,

      <div className="Modal-body ScheduleDraftModal-body">
        <Form className="Form--centered">
          <div className="ScheduleDraftModal-header">
            <div className="ScheduleDraftModal-iconBadge">
              <i className="fas fa-clock"></i>
            </div>
            <div className="ScheduleDraftModal-headerText">
              <h4 className="ScheduleDraftModal-title">Otomatik İçerik Planlama</h4>
              <p className="ScheduleDraftModal-desc">
                Gönderinizin forumda otomatik olarak paylaşılmasını istediğiniz tarih ve saati belirleyin.
              </p>
            </div>
          </div>

          <div className="ScheduleDraftModal-section">
            <div className="ScheduleDraftModal-sectionTitle">
              <i className="fas fa-bolt"></i> Hızlı Seçenekler
            </div>
            <div className="ScheduleDraftModal-presets">
              <button
                type="button"
                className="ScheduleDraftModal-presetBtn"
                onclick={() => {
                  const target = dayjs().add(2, 'hour');
                  this.date = target.format('YYYY-MM-DD');
                  this.time = target.format('HH:mm');
                  m.redraw();
                }}
              >
                <i className="fas fa-clock"></i>
                <div className="ScheduleDraftModal-presetInfo">
                  <span className="ScheduleDraftModal-presetName">2 Saat Sonra</span>
                  <span className="ScheduleDraftModal-presetDetail">{dayjs().add(2, 'hour').format('HH:mm')}</span>
                </div>
              </button>
              <button
                type="button"
                className="ScheduleDraftModal-presetBtn"
                onclick={() => {
                  const target = dayjs().add(1, 'day').hour(9).minute(0);
                  this.date = target.format('YYYY-MM-DD');
                  this.time = target.format('HH:mm');
                  m.redraw();
                }}
              >
                <i className="fas fa-sun"></i>
                <div className="ScheduleDraftModal-presetInfo">
                  <span className="ScheduleDraftModal-presetName">Yarın Sabah</span>
                  <span className="ScheduleDraftModal-presetDetail">09:00</span>
                </div>
              </button>
              <button
                type="button"
                className="ScheduleDraftModal-presetBtn"
                onclick={() => {
                  const target = dayjs().add(1, 'day').hour(20).minute(0);
                  this.date = target.format('YYYY-MM-DD');
                  this.time = target.format('HH:mm');
                  m.redraw();
                }}
              >
                <i className="fas fa-moon"></i>
                <div className="ScheduleDraftModal-presetInfo">
                  <span className="ScheduleDraftModal-presetName">Yarın Akşam</span>
                  <span className="ScheduleDraftModal-presetDetail">20:00</span>
                </div>
              </button>
            </div>
          </div>

          <div className="ScheduleDraftModal-section">
            <div className="ScheduleDraftModal-sectionTitle">
              <i className="far fa-calendar-alt"></i> Tarih ve Saat Seçimi
            </div>
            <div className="ScheduleDraftModal-inputs">
              <div className="Form-group ScheduleDraftModal-fieldGroup">
                <label className="ScheduleDraftModal-label">Yayın Tarihi</label>
                <div className="ScheduleDraftModal-inputWrapper">
                  <i className="far fa-calendar-days ScheduleDraftModal-inputIcon"></i>
                  <input
                    name="scheduledForDate"
                    className="FormControl ScheduleDraftModal-dateInput"
                    type="date"
                    min={dayjs().format('YYYY-MM-DD')}
                    value={this.date}
                    oninput={(dateEvent: Event) => (this.date = (dateEvent.target as HTMLInputElement).value)}
                    onchange={(dateEvent: Event) => (this.date = (dateEvent.target as HTMLInputElement).value)}
                  />
                </div>
              </div>
              <div className="Form-group ScheduleDraftModal-fieldGroup">
                <label className="ScheduleDraftModal-label">Yayın Saati</label>
                <div className="ScheduleDraftModal-inputWrapper">
                  <i className="far fa-clock ScheduleDraftModal-inputIcon"></i>
                  <input
                    name="scheduledForTime"
                    className="FormControl ScheduleDraftModal-timeInput"
                    type="time"
                    value={this.time}
                    oninput={(timeEvent: Event) => (this.time = (timeEvent.target as HTMLInputElement).value)}
                    onchange={(timeEvent: Event) => (this.time = (timeEvent.target as HTMLInputElement).value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="ScheduleDraftModal-summaryCard">
            <div className="ScheduleDraftModal-summaryHeader">
              <span className="ScheduleDraftModal-summaryBadge">
                <i className="fas fa-paper-plane"></i> Planlama Özeti
              </span>
              <span className="ScheduleDraftModal-summaryStatus">
                <i className="fas fa-circle-check"></i> Zaman ayarlandı
              </span>
            </div>
            <div className="ScheduleDraftModal-summaryBody">
              <div className="ScheduleDraftModal-summaryRow">
                <span className="ScheduleDraftModal-summaryLabel">Hedef Yayın Zamanı:</span>
                <strong className="ScheduleDraftModal-summaryValue">{this.formattedDateTime()}</strong>
              </div>
              <div className="ScheduleDraftModal-summaryHint">
                <i className="fas fa-info-circle"></i> Zamanı geldiğinde taslak gönderiniz otomatik olarak forumda yayınlanacaktır.
              </div>
            </div>
          </div>

          <div className="Form-group ScheduleDraftModal-submitButtons">
            {this.isScheduled() && (
              <Button
                className="ScheduleDraftModal-unscheduleBtn Button Button--danger"
                icon="fas fa-calendar-xmark"
                loading={this.loading}
                onclick={this.unschedule.bind(this)}
              >
                Planlamayı Kaldır
              </Button>
            )}
            <Button
              className="ScheduleDraftModal-scheduleBtn Button Button--primary"
              icon={this.isScheduled() ? 'fas fa-calendar-check' : 'fas fa-calendar-plus'}
              type="submit"
              loading={this.loading}
              disabled={this.loading || !this.date || !this.time}
            >
              {this.isScheduled() ? 'Planlamayı Güncelle' : 'Planla ve Kaydet'}
            </Button>
          </div>
        </Form>
      </div>,
    ];
  }

  /**
   * Returns a Date object for currently entered values in the modal.
   */
  scheduledFor(): Date | null {
    const date = new Date(`${this.date} ${this.time}`);

    return date || null;
  }

  /**
   * Whether the modal's details have been modified.
   */
  changed(): boolean {
    const getTimeOrNull = (date: Date | null | undefined): number | null => (date ? date.getTime() || null : null);

    return getTimeOrNull(this.scheduledFor()) !== getTimeOrNull(this.attrs.draft.scheduledFor());
  }

  isScheduled(): boolean {
    return !!this.attrs.draft.scheduledFor();
  }

  formattedDateTime(): string {
    const date = dayjs(this.scheduledFor());

    const formatted = date.format(this.previewFormatString);

    return formatted;
  }

  unschedule(e: Event) {
    e.preventDefault();

    this.loading = true;

    // Save draft with no scheduled post time
    if (confirm(app.translator.trans('fof-drafts.forum.schedule_draft_modal.unschedule_warning') as string)) {
      this.attrs.draft
        .save({ scheduledFor: null, clearValidationError: true })
        .then(() => {
          (this as any).success = true;
          app.alerts.show({ type: 'success' }, 'İçerik planlaması kaldırıldı.');
          this.hide.call(this);
        })
        .catch(() => {})
        .then(this.loaded.bind(this));
    }
  }

  onsubmit(e: Event) {
    e.preventDefault();

    if (this.attrs.draft.type() !== 'reply' && !this.attrs.draft.title()?.trim()) {
      this.titleError = true;
      m.redraw();
      return;
    }
    this.titleError = false;

    this.loading = true;

    this.attrs.draft
      .save({ scheduledFor: this.scheduledFor(), clearValidationError: true })
      .then(() => {
        (this as any).success = true;
        app.alerts.show({ type: 'success' }, `İçerik ${this.formattedDateTime()} için başarıyla planlandı.`);
        this.hide();

        // Automatically hide/close the composer ("Yanıt Yaz" window)
        if (app.composer && app.composer.position !== 'hidden') {
          app.composer.hide();
        }
      })
      .catch((err: any) => {
        console.error('Schedule save failed:', err);
      })
      .then(this.loaded.bind(this));
  }
}
