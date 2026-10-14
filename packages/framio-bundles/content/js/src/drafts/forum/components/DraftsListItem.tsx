import app from 'flarum/forum/app';
import haptic from 'flarum/common/utils/haptic';
import Component from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import HeaderListItem from 'flarum/forum/components/HeaderListItem';
import { truncate } from 'flarum/common/utils/string';
import Button from 'flarum/common/components/Button';
import Tooltip from 'flarum/common/components/Tooltip';
import humanTime from 'flarum/common/helpers/humanTime';
import tagsLabel from 'ext:flarum/tags/common/helpers/tagsLabel';

import type Mithril from 'mithril';
import Draft from '../models/Draft';
import DraftsListState from '../states/DraftsListState';
import DraftPreviewModal from './DraftPreviewModal';

export interface IAttrs {
  draft: Draft;
  state: DraftsListState;
}

export default class DraftsListItem extends Component<IAttrs> {
  private get canSchedule(): boolean {
    return Boolean(
      app.forum.attribute('canScheduleDrafts') ||
      app.forum.attribute('canSaveDrafts') ||
      app.session?.user
    );
  }

  getTags() {
    // Only show tags if flarum/tags is enabled
    if (!app.initializers.has('flarum-tags')) {
      return null;
    }

    // Get tags from relationships
    const relationships = this.attrs.draft.loadRelationships();
    if (!relationships.tags || !Array.isArray(relationships.tags) || relationships.tags.length === 0) {
      return null;
    }

    return relationships.tags;
  }

  getThumbnailUrl(content: string, extra: any): string | null {
    if (extra && extra.spotter_thumbnail) {
      return extra.spotter_thumbnail;
    }
    // UlasimArsiv image BBCode regex
    const bbMatch = content.match(/\[ulasimarsiv-image[^\]]*url="([^"]+)"/i);
    if (bbMatch && bbMatch[1]) {
      return bbMatch[1];
    }
    // Normal markdown image
    const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/i);
    if (mdMatch && mdMatch[1]) {
      return mdMatch[1];
    }
    return null;
  }

  view() {
    const { draft, state } = this.attrs;
    const rawContent = draft.content() || '';
    const extra = draft.extra?.() || {};

    let scheduledDraftIcon = 'far fa-calendar-plus';
    if (draft.scheduledValidationError()) scheduledDraftIcon = 'far fa-calendar-xmark';
    else if (draft.scheduledFor()) scheduledDraftIcon = 'far fa-calendar-check';

    const thumbUrl = this.getThumbnailUrl(rawContent, extra);

    // Build the content with scheduled icon if needed
    const content = (
      <>
        {draft.scheduledFor() && (
          <Tooltip
            showOnFocus={false}
            text={app.translator.trans('fof-drafts.forum.dropdown.scheduled_icon_tooltip', {
              datetime: dayjs(draft.scheduledFor()).format(app.translator.trans('fof-drafts.forum.dropdown.scheduled_icon_tooltip_formatter')[0]),
            })}
          >
            <Icon name="far fa-clock" className="draft--scheduledIcon" />
          </Tooltip>
        )}
        <span className="DraftListItem-titleText">
          {draft.type() === 'reply' ? (draft.loadRelationships().discussion?.title() ?? draft.title()) : draft.title() || 'Başlıksız Taslak'}
        </span>
      </>
    );

    // Get tags for display
    const tags = this.getTags();
    let tagsDisplay: Mithril.Children = null;
    if (tags && tags.length > 0 && tagsLabel) {
      tagsDisplay = tagsLabel(tags);
    }

    // Clean out image tags, alt text and brackets so only natural text remains in excerpt
    const cleanedContent = rawContent
      .replace(/\[ulasimarsiv-image[^\]]*\]/gi, '')
      .replace(/!\[.*?\]\([^\s)]+\)/gi, '')
      .replace(/\[upl-image-preview[^\]]*\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const excerptText = truncate(cleanedContent || (thumbUrl ? 'Fotoğraflı içerik' : ''), 150);

    // Build action buttons
    const actions = (
      <>
        <Tooltip showOnFocus={false} text="Önizle">
          <Button
            icon="far fa-eye"
            className="Button Button--link hasIcon draft--preview"
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
              $(e.currentTarget as HTMLElement).trigger('mouseleave');
              app.modal.show(DraftPreviewModal, {
                draft: draft,
                onedit: () => state.showComposer(draft),
              });
            }}
          />
        </Tooltip>

        <Tooltip showOnFocus={false} text={app.translator.trans('fof-drafts.forum.dropdown.delete_button')}>
          <Button
            icon="fas fa-trash-can"
            className="Button Button--link hasIcon draft--delete"
            onclick={(e: MouseEvent) => {
              $(e.currentTarget as HTMLElement).trigger('mouseleave');
              haptic('heavy');
              state.deleteDraft(draft);
              e.stopPropagation();
            }}
          />
        </Tooltip>

        {this.canSchedule && (
          <Tooltip showOnFocus={false} text={app.translator.trans('fof-drafts.forum.dropdown.schedule_button')}>
            <Button
              icon={scheduledDraftIcon}
              className="Button Button--link hasIcon draft--schedule"
              onclick={(e: MouseEvent) => {
                $(e.currentTarget as HTMLElement).trigger('mouseleave');
                haptic('medium');
                state.scheduleDraft(draft);
                e.stopPropagation();
              }}
            />
          </Tooltip>
        )}
      </>
    );

    return (
      <li className="DraftListItem-wrapper">
        <div
          className={`DraftListItem ${thumbUrl ? 'DraftListItem--hasThumb' : ''}`}
          onclick={(event: Event) => {
            state.showComposer(draft);
          }}
        >
          {thumbUrl && (
            <div className="DraftListItem-thumb">
              <img src={thumbUrl} alt="Taslak görseli" loading="lazy" />
            </div>
          )}
          <div className="DraftListItem-main">
            <div className="DraftListItem-headerRow">
              <div className="DraftListItem-titleLine">
                <span className="DraftListItem-typeIcon">
                  <Icon name={draft.icon()} />
                </span>
                <span className="DraftListItem-titleText">
                  {draft.type() === 'reply' ? (draft.loadRelationships().discussion?.title() ?? draft.title()) : draft.title() || 'Başlıksız Taslak'}
                </span>
                {draft.scheduledFor() && (
                  <span
                    className="DraftListItem-scheduledBadge"
                    title="Planlama zamanını düzenlemek için tıklayın"
                    onclick={(e: MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      haptic('medium');
                      state.scheduleDraft(draft);
                    }}
                  >
                    <Icon name="far fa-clock" /> {dayjs ? dayjs(draft.scheduledFor()).format('DD.MM.YYYY HH:mm') : new Date(draft.scheduledFor()).toLocaleString()} Planlandı
                  </span>
                )}
              </div>
            </div>

            {tagsDisplay && <div className="DraftListItem-tags">{tagsDisplay}</div>}

            <div className="DraftListItem-text">{excerptText}</div>

            <div className="DraftListItem-footer">
              <div className="DraftListItem-meta">
                {extra.spotter_image_count > 0 && (
                  <span className="DraftListItem-stat DraftListItem-stat--images">
                    <i className="fas fa-camera"></i> {extra.spotter_image_count} fotoğraf
                  </span>
                )}
                {extra.custom_music && (
                  <span className="DraftListItem-stat DraftListItem-stat--music">
                    <i className="fas fa-music"></i> {extra.custom_music.title || 'Müzik'}
                  </span>
                )}
                {draft.updatedAt() && (
                  <span className="DraftListItem-stat DraftListItem-stat--time">
                    <i className="far fa-clock"></i> {humanTime(draft.updatedAt())}
                  </span>
                )}
              </div>

              <div className="DraftListItem-actions" onclick={(e: MouseEvent) => e.stopPropagation()}>
                {actions}
              </div>
            </div>

            {draft.scheduledValidationError() && <p className="scheduledValidationError">{draft.scheduledValidationError()}</p>}
          </div>
        </div>
      </li>
    );
  }
}

