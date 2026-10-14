import app from 'flarum/common/app';
import Component from 'flarum/common/Component';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export default class FocusDragArea extends Component {
  oninit(vnode) {
    super.oninit(vnode);
    this.dragging = false;
    this.loaded = false;
    this.startPointer = { x: 0, y: 0 };
    this.startFocus = { x: 50, y: 50 };

    this.boundMove = this.onPointerMove.bind(this);
    this.boundUp = this.onPointerUp.bind(this);
  }

  view() {
    const { url, focusX = 50, focusY = 50, zoom = 1, height = 200 } = this.attrs;
    const x = clamp(focusX, 0, 100);
    const y = clamp(focusY, 0, 100);
    const z = clamp(zoom, 0.5, 4);

    return (
      <div
        className={'CoverStudio-FocusArea' + (this.dragging ? ' is-dragging' : '')}
        style={{ height: `${height}px` }}
        tabIndex="0"
        onpointerdown={this.onPointerDown.bind(this)}
        onwheel={this.onWheel.bind(this)}
      >
        {z < 1 && (
          <img
            className="CoverStudio-FocusArea-blur"
            src={url}
            alt=""
            draggable="false"
            style={{ objectPosition: `${x}% ${y}%` }}
          />
        )}
        <img
          className="CoverStudio-FocusArea-image"
          src={url}
          alt=""
          draggable="false"
          onload={() => {
            this.loaded = true;
            m.redraw();
          }}
          style={{
            objectPosition: `${x}% ${y}%`,
            transform: `scale(${z})`,
            transformOrigin: `${x}% ${y}%`,
          }}
        />

        {!this.loaded && (
          <div className="CoverStudio-FocusArea-loading">
            <LoadingIndicator />
          </div>
        )}

        <div className="CoverStudio-FocusArea-grid" />
        <div
          className="CoverStudio-FocusArea-crosshair"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
        <div className="CoverStudio-FocusArea-hint">
          {app.translator.trans('sycho-profile-cover.forum.drag_hint')}
        </div>
      </div>
    );
  }

  onPointerDown(e) {
    if (e.button !== 0) return;

    this.dragging = true;
    this.startPointer = { x: e.clientX, y: e.clientY };
    this.startFocus = {
      x: this.attrs.focusX ?? 50,
      y: this.attrs.focusY ?? 50,
    };

    window.addEventListener('pointermove', this.boundMove);
    window.addEventListener('pointerup', this.boundUp);
    window.addEventListener('pointercancel', this.boundUp);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    e.preventDefault();
  }

  onPointerMove(e) {
    if (!this.dragging || !this.element) return;

    const rect = this.element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // Pan hassasiyeti (zoom ile ters orantılı)
    const zoom = clamp(this.attrs.zoom ?? 1, 0.5, 4);
    const sensitivity = 100 / zoom;

    const deltaX = ((e.clientX - this.startPointer.x) / rect.width) * sensitivity;
    const deltaY = ((e.clientY - this.startPointer.y) / rect.height) * sensitivity;

    // Ters yönlü kaydırma: görseli sağa çekersek odak sola kaysın
    const newX = clamp(Math.round(this.startFocus.x - deltaX), 0, 100);
    const newY = clamp(Math.round(this.startFocus.y - deltaY), 0, 100);

    if (this.attrs.onchange) {
      this.attrs.onchange(newX, newY);
      m.redraw();
    }
  }

  onPointerUp(e) {
    if (!this.dragging) return;
    this.dragging = false;

    window.removeEventListener('pointermove', this.boundMove);
    window.removeEventListener('pointerup', this.boundUp);
    window.removeEventListener('pointercancel', this.boundUp);

    m.redraw();
  }

  onWheel(e) {
    if (!this.attrs.onzoom) return;
    e.preventDefault();

    const currentZoom = clamp(this.attrs.zoom ?? 1, 0.5, 4);
    const step = e.deltaY < 0 ? 0.1 : -0.1;
    const nextZoom = clamp(Math.round((currentZoom + step) * 100) / 100, 0.5, 4);

    this.attrs.onzoom(nextZoom);
    m.redraw();
  }

  onremove(vnode) {
    window.removeEventListener('pointermove', this.boundMove);
    window.removeEventListener('pointerup', this.boundUp);
    window.removeEventListener('pointercancel', this.boundUp);
    super.onremove(vnode);
  }
}
