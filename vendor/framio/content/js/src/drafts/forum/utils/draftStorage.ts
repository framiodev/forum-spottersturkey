/**
 * LocalStorage tabanlı offline taslak koruma ve kurtarma servisi.
 */
export interface LocalDraftBackup {
  title?: string;
  content: string;
  extra?: Record<string, any>;
  discussionId?: string | number;
  timestamp: number;
}

const STORAGE_KEY_PREFIX = 'framio_draft_local_';

export function saveLocalDraft(key: string, data: { title?: string; content: string; extra?: Record<string, any>; discussionId?: string | number }) {
  try {
    const payload: LocalDraftBackup = {
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(payload));
  } catch (e) {
    console.warn('DraftStorage save failed:', e);
  }
}

export function getLocalDraft(key: string): LocalDraftBackup | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as LocalDraftBackup;
  } catch (e) {
    return null;
  }
}

export function removeLocalDraft(key: string) {
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + key);
  } catch (e) {}
}

export function getDraftKeyForComposer(composerState: any): string {
  if (composerState.draft && composerState.draft.id()) {
    return 'id_' + composerState.draft.id();
  }

  const data = composerState.data?.() || {};
  if (data.relationships?.discussion?.id) {
    const disc = data.relationships.discussion;
    const discId = typeof disc.id === 'function' ? disc.id() : disc.id;
    return 'reply_disc_' + discId;
  }

  return 'new_discussion';
}
