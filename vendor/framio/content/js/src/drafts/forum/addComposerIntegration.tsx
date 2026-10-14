import { extend, override } from 'flarum/common/extend';
import Stream from 'flarum/common/utils/Stream';
import Button from 'flarum/common/components/Button';
import ComposerState from 'flarum/forum/states/ComposerState';
import app from 'flarum/forum/app';
import haptic from 'flarum/common/utils/haptic';
import deepEqual from './utils/deepEqual';
import { adjustDraftCount } from './utils/draftCount';
import fillRelationship from './utils/fillRelationship';
import { saveLocalDraft, removeLocalDraft, getDraftKeyForComposer } from './utils/draftStorage';
import ScheduleDraftModal from './components/ScheduleDraftModal';

export default function () {
  // Add changed() method to ComposerState
  ComposerState.prototype['changed'] = function (this: ComposerState): boolean {
    if (!this.body || !this.data) return false;

    const currentData = this.data();
    const draft = this.draft;

    const fields = Object.keys(currentData).filter((fieldName: string) => fieldName !== 'relationships');

    if (!fields || fields.length === 0) {
      return false;
    }

    // If there's no content, we don't want to save this draft
    // regardless of whether other attributes have changed.
    if (!this.fields.content()) {
      return false;
    }

    const getData = (fieldKey: string): string => (fieldKey === 'content' ? this.fields.content() : currentData[fieldKey]) || '';

    for (const field of fields) {
      const fieldValue = getData(field);
      const draftFieldValue = draft?.data?.attributes?.[field];

      if ((!draft && fieldValue) || (draft && !deepEqual(fieldValue, draftFieldValue))) {
        return true;
      }
    }

    // Check if relationships exist and need comparison
    if (!currentData.relationships && (!draft || !draft.relationships())) {
      return false;
    }

    // If only data has relationships but no draft exists, consider it changed
    if (currentData.relationships && !draft) {
      return true;
    }

    // If no relationships in data, no changes to check
    if (!currentData.relationships) {
      return false;
    }

    const relationships = Object.keys(currentData.relationships);

    const equalRelationships = (composerData: any, draftModel: any, relName: string): boolean => {
      if (
        (!composerData.relationships[relName] || !composerData.relationships[relName].length) &&
        (!(relName in draftModel.relationships()) || !draftModel.relationships()[relName].data?.length)
      ) {
        return true;
      } else if (
        !(relName in draftModel.relationships()) ||
        composerData.relationships[relName].length !== draftModel.relationships()[relName].data?.length
      ) {
        return false;
      }

      const getId = (relItem: any): string => (typeof relItem.id == 'function' ? relItem.id() : relItem.id);

      const dataIds = fillRelationship(composerData.relationships[relName], getId);
      const draftIds = fillRelationship(draftModel.relationships()[relName].data, getId);

      const dataIdsArray = Array.isArray(dataIds) ? dataIds : [dataIds];
      const draftIdsArray = Array.isArray(draftIds) ? draftIds : [draftIds];

      return !dataIdsArray.some((id: string, i: number) => id !== draftIdsArray[i]);
    };

    for (const relationship of relationships) {
      if (!draft) {
        if (currentData.relationships[relationship]) {
          return true;
        }
      } else {
        if (!equalRelationships(currentData, draft, relationship)) {
          return true;
        }
      }
    }

    return false;
  };

  // Add saveDraft() method to ComposerState
  ComposerState.prototype['saveDraft'] = function (this: ComposerState): Promise<any> {
    this.saving = true;
    this.lastSaveTime = null;
    m.redraw();

    const afterSave = (): void => {
      this.saving = false;
      this.justSaved = true;
      const now = new Date();
      const pad = (n: number) => (n < 10 ? '0' + n : n);
      this.lastSaveTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

      // Local storage backup
      try {
        const key = getDraftKeyForComposer(this);
        const data = this.data?.() || {};
        saveLocalDraft(key, {
          title: this.fields.title?.() || data.title,
          content: this.fields.content?.() || '',
          extra: data.extra,
        });
      } catch (e) {}

      setTimeout(() => {
        this.justSaved = false;
        m.redraw();
      }, 4000);
      m.redraw();
    };

    const draft = this.draft;

    if (draft && draft.id() && !draft.exists) {
      // Draft was deleted before autosave, no need to save.
      this.saving = false;
      return Promise.resolve();
    }

    // Helper to serialize relationships for API and filter read-only fields
    const serializeRelationships = (draftData: any): any => {
      const serialized = { ...draftData };

      // Remove read-only fields that shouldn't be sent to API
      delete serialized.scheduledValidationError;
      delete serialized.updatedAt;

      // Remove null relationships or format them properly
      if (draftData.relationships) {
        serialized.relationships = {};

        Object.keys(draftData.relationships).forEach((relationshipKey: string) => {
          const relationship = draftData.relationships[relationshipKey];

          if (Array.isArray(relationship)) {
            // Convert array of models to JSON:API format with data wrapper
            serialized.relationships[relationshipKey] = {
              data: relationship.map((relModel: any) => ({
                type: typeof relModel.data?.type === 'function' ? relModel.data.type() : relModel.data?.type || relModel.type?.() || 'unknown',
                id: typeof relModel.id === 'function' ? relModel.id() : relModel.id,
              })),
            };
          } else if (relationship && typeof relationship === 'object') {
            // Convert single model to JSON:API format with data wrapper
            serialized.relationships[relationshipKey] = {
              data: {
                type:
                  typeof relationship.data?.type === 'function'
                    ? relationship.data.type()
                    : relationship.data?.type || relationship.type?.() || 'unknown',
                id: typeof relationship.id === 'function' ? relationship.id() : relationship.id,
              },
            };
          }
        });
      }

      return serialized;
    };

    if (draft) {
      const rawData = this.data?.();
      if (!rawData) {
        this.saving = false;
        return Promise.resolve(draft);
      }

      const updatePayload = serializeRelationships(rawData);

      return draft
        .save(updatePayload)
        .then(() => {
          afterSave();
          return draft;
        })
        .catch((saveError: any) => {
          console.error('Draft save failed:', saveError);
          console.error('Response:', saveError.response);
          this.saving = false;
          m.redraw();
          throw saveError;
        });
    } else {
      const rawData = this.data?.();
      if (!rawData) {
        this.saving = false;
        return Promise.resolve();
      }

      const createPayload = serializeRelationships(rawData);

      return app.store
        .createRecord('drafts')
        .save(createPayload)
        .then((savedDraft: any) => {
          savedDraft.loadRelationships(true);
          this.draft = savedDraft;
          afterSave();
          return savedDraft;
        })
        .catch((createError: any) => {
          console.error('New draft save failed:', createError);
          console.error('Response:', createError.response);
          this.saving = false;
          m.redraw();
          throw createError;
        });
    }
  };

  // Add save draft button and status text to composer
  extend('flarum/forum/components/Composer', 'controlItems', function (items) {
    if (
      !(this.state.bodyMatches('flarum/forum/components/DiscussionComposer') || this.state.bodyMatches('flarum/forum/components/ReplyComposer')) ||
      !app.forum.attribute('canSaveDrafts') ||
      this.state.position === 'minimized'
    )
      return;

    const classNames = ['Button', 'Button--icon', 'Button--link'];

    if (this.state.saving) {
      classNames.push('saving');
    }

    if (this.state.justSaved) {
      classNames.push('justSaved');
    }

    let statusLabel = '';
    if (this.state.saving) {
      statusLabel = 'Kaydediliyor...';
    } else if (this.state.justSaved && this.state.lastSaveTime) {
      statusLabel = `Buluta kaydedildi (${this.state.lastSaveTime})`;
    }

    if (statusLabel) {
      items.add(
        'draft-status',
        <span className="Composer-draftStatus">
          <i className={this.state.saving ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-check'} style={{ marginRight: '5px' }}></i>
          {statusLabel}
        </span>,
        25
      );
    }

    const canSchedule =
      (app.forum.attribute<boolean>('canScheduleDrafts') ?? app.forum.attribute<boolean>('canSaveDrafts')) &&
      (app.forum.attribute<boolean>('drafts.enableScheduledDrafts') ?? true);

    if (canSchedule) {
      const isScheduled = Boolean(this.state.draft?.scheduledFor());
      const scheduleClassNames = ['Button', 'Button--icon', 'Button--link'];
      if (isScheduled) {
        scheduleClassNames.push('is-scheduled');
      }

      items.add(
        'schedule-draft',
        <Button
          icon={isScheduled ? 'fas fa-calendar-check' : 'fas fa-calendar-plus'}
          className={scheduleClassNames.join(' ')}
          itemClassName="App-backControl"
          title={isScheduled ? 'Planlandı: ' + this.state.draft.scheduledFor() : 'İçerik Planla'}
          aria-label="İçerik Planla"
          disabled={this.state.saving || this.loading}
          onclick={async () => {
            haptic('medium');
            try {
              let draft = this.state.draft;
              if (!draft) {
                draft = await this.state.saveDraft();
              }
              if (!draft && this.state.draft) {
                draft = this.state.draft;
              }
              if (draft) {
                app.modal.show(ScheduleDraftModal as any, { draft });
              }
            } catch (e) {
              console.error('Failed to prepare draft for scheduling:', e);
            }
          }}
        />,
        21
      );
    }

    items.add(
      'save-draft',
      <Button
        icon={this.state.justSaved ? 'fas fa-check' : this.state.saving ? 'fas fa-spinner fa-spin' : 'fas fa-floppy-disk'}
        className={classNames.join(' ')}
        itemClassName="App-backControl"
        title={app.translator.trans('fof-drafts.forum.composer.title')}
        aria-label={app.translator.trans('fof-drafts.forum.composer.title')}
        disabled={this.state.saving || this.state.justSaved || this.loading}
        onclick={() => {
          haptic('success');
          this.state.saveDraft();
        }}
      />,
      20
    );
  });

  // Set up autosave and keyup listener for local storage backup
  extend(ComposerState.prototype, 'load', function (this: ComposerState) {
    if (!app.forum.attribute('canSaveDrafts')) return;

    if (this.bodyMatches('flarum/forum/components/DiscussionComposer') || this.bodyMatches('flarum/forum/components/ReplyComposer')) {
      // Local autosave on input
      this.localSaveHandler = () => {
        try {
          const key = getDraftKeyForComposer(this);
          const data = this.data?.() || {};
          const content = this.fields?.content?.() || '';
          if (content.trim()) {
            saveLocalDraft(key, {
              title: this.fields?.title?.() || data.title,
              content: content,
              extra: data.extra,
            });
          }
        } catch (e) {}
      };

      // Periodic cloud auto-save
      // @ts-ignore - User preferences access
      const intervalSec = app.session.user?.preferences().draftAutosaveInterval || 30;
      // @ts-ignore - User preferences access
      const isAutoSaveEnabled = app.session.user?.preferences().draftAutosaveEnable ?? true;

      if (isAutoSaveEnabled) {
        this.autosaveInterval = setInterval(() => {
          if (this.changed?.() && !this.saving && !this.loading) {
            this.saveDraft?.();
          }
        }, 1000 * intervalSec);
      }
    }
  });

  // Clear draft on composer clear
  extend(ComposerState.prototype, 'clear', function (this: ComposerState) {
    try {
      const key = getDraftKeyForComposer(this);
      removeLocalDraft(key);
    } catch (e) {}

    this.draft = null;
    this.lastSaveTime = null;
    if (this.autosaveInterval) clearInterval(this.autosaveInterval);
  });

  // Override preventExit to handle drafts
  override(ComposerState.prototype, 'preventExit', function (this: ComposerState, original: () => boolean | void) {
    if (this.body && this.body.componentClass && this.draft) {
      this.body.attrs.confirmExit = app.translator.trans('fof-drafts.forum.composer.exit_alert') as string;
    }

    let prevented: boolean = false;
    if (this.changed?.()) {
      const result = original();
      prevented = result === true;
    }

    if (prevented) return prevented;

    if (!this.body || !this.body.componentClass) return;

    const draft = this.draft;
    if (
      draft &&
      !draft.title() &&
      !draft.content() &&
      confirm(app.translator.trans('fof-drafts.forum.composer.discard_empty_draft_alert') as string)
    ) {
      draft.delete().then(() => {
        adjustDraftCount(-1);
        m.redraw();
      });
    }

    return prevented;
  });

  // Initialize composer body with draft data
  function initComposerBody(this: any): void {
    Object.keys(this.attrs).forEach((attrKey: string) => {
      if (!['originalContent', 'title', 'user'].includes(attrKey)) {
        this[attrKey] = this.attrs[attrKey];
      } else if (attrKey === 'title') {
        this.title = Stream(this.attrs.title);
      }
    });

    if (this.data) {
      this.composer.data = this.data.bind(this);
    }

    if (this.attrs.draft) {
      this.composer.draft = this.attrs.draft;
    }

    // Auto backup on text input
    if (this.composer && this.composer.fields && this.composer.fields.content) {
      const originalContentStream = this.composer.fields.content;
      this.composer.fields.content = function (...args: any[]) {
        const res = originalContentStream.apply(this, args);
        if (args.length > 0 && app.composer && app.composer.localSaveHandler) {
          app.composer.localSaveHandler();
        }
        return res;
      };
    }
  }

  extend('flarum/forum/components/DiscussionComposer', 'oninit', initComposerBody);
  extend('flarum/forum/components/ReplyComposer', 'oninit', initComposerBody);

  // Delete drafts when submitted
  function deleteDraftsOnSubmit(this: any): void {
    try {
      const key = getDraftKeyForComposer(this.composer);
      removeLocalDraft(key);
    } catch (e) {}

    if (this.composer.draft) {
      this.composer.draft.delete().then(() => {
        adjustDraftCount(-1);
        m.redraw();
      });
    }
  }

  extend('flarum/forum/components/DiscussionComposer', 'onsubmit', deleteDraftsOnSubmit);
  extend('flarum/forum/components/ReplyComposer', 'onsubmit', deleteDraftsOnSubmit);



  // Handle byobu extension if present
  if ('fof-byobu' in flarum.extensions) {
    extend('ext:fof/byobu/forum/pages/discussions/PrivateDiscussionComposer', 'onsubmit', deleteDraftsOnSubmit);
  }
}
