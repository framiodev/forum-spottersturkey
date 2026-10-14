import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import User from 'flarum/common/models/User';
import UserCard from 'flarum/forum/components/UserCard';
import UserControls from 'flarum/forum/utils/UserControls';
import Button from 'flarum/common/components/Button';
import Model from 'flarum/common/Model';

import CoverEditorModal from './components/CoverEditorModal';

app.initializers.add('sycho-profile-cover', () => {
  User.prototype.cover = Model.attribute('cover');
  User.prototype.cover_thumbnail = Model.attribute('cover_thumbnail');
  User.prototype.cover_focal_x = Model.attribute('cover_focal_x');
  User.prototype.cover_focal_y = Model.attribute('cover_focal_y');
  User.prototype.cover_zoom = Model.attribute('cover_zoom');
  User.prototype.canSetProfileCover = Model.attribute('canSetProfileCover');

  extend(UserCard.prototype, 'view', function (view) {
    if (!view.attrs.style || !this.attrs.user.cover()) return;

    let coverUrl = this.attrs.user.cover();
    let thumbnailUrl = this.attrs.user.cover_thumbnail();

    if (!coverUrl) return;

    if (this.attrs.controlsButtonClassName?.includes('Button--icon') && thumbnailUrl) {
      coverUrl = thumbnailUrl;
    }

    const focalX = this.attrs.user.attribute('cover_focal_x') ?? 50;
    const focalY = this.attrs.user.attribute('cover_focal_y') ?? 50;
    const zoom = this.attrs.user.attribute('cover_zoom') ?? 1.0;

    view.attrs.style = Object.assign(view.attrs.style, {
      '--background-image': `url(${coverUrl})`,
      '--cover-focal-x': `${focalX}%`,
      '--cover-focal-y': `${focalY}%`,
      '--cover-zoom': `${zoom}`,
    });

    view.attrs.className = (view.attrs.className || '') + ' CoverStudio-hasCover';
  });

  extend(UserControls, 'moderationControls', function (items, user) {
    if (!user.canSetProfileCover()) return;

    items.add(
      'cover',
      <Button icon="fas fa-image" onclick={() => app.modal.show(CoverEditorModal, { user })}>
        {app.translator.trans('sycho-profile-cover.forum.cover')}
      </Button>
    );

    return items;
  });
});
