/**
 * Header menüsü görünümü: forum ve admin önizlemesi aynı hesaplamayı kullanır.
 * nav_header.style değerleri CSS değişkenlerine ve body sınıflarına çevrilir.
 */
export const HEADER_STYLE_DEFAULTS = {
  placement: 'left', // left | center | right
  gap: 4,
  offset: 0, // menü bloğunu yatayda kaydırma (px)
  paddingX: 12,
  height: 36,
  fontSize: 14,
  fontWeight: 600,
  uppercase: false,
  letterSpacing: 0,
  iconMode: 'left', // left | top | only | none
  iconSize: 15,
  radius: 8,
  hover: 'pill', // pill | underline | color | none
  textColor: '',
  iconColor: '',
  hoverColor: '',
  hoverBg: '',
  headerBg: '',
  dropBg: '',
  dropColor: '',
  homeIcon: true,
  homeSize: 38,
  homeShape: 'circle', // circle | square | plain
};

export function headerStyleVars(st) {
  const s = { ...HEADER_STYLE_DEFAULTS, ...(st || {}) };
  const v = {
    '--fnav-gap': s.gap + 'px',
    '--fnav-offset': (s.offset || 0) + 'px',
    '--fnav-px': s.paddingX + 'px',
    '--fnav-h': s.height + 'px',
    '--fnav-fs': s.fontSize + 'px',
    '--fnav-fw': String(s.fontWeight),
    '--fnav-tt': s.uppercase ? 'uppercase' : 'none',
    '--fnav-ls': s.letterSpacing + 'px',
    '--fnav-icon': s.iconSize + 'px',
    '--fnav-radius': s.radius + 'px',
    '--fnav-home': s.homeSize + 'px',
  };
  if (s.textColor) v['--fnav-color'] = s.textColor;
  if (s.iconColor) v['--fnav-icon-color'] = s.iconColor;
  if (s.hoverColor) v['--fnav-hover-color'] = s.hoverColor;
  if (s.hoverBg) v['--fnav-hover-bg'] = s.hoverBg;
  if (s.dropBg) v['--fnav-drop-bg'] = s.dropBg;
  if (s.headerBg) v['--fnav-header-bg'] = s.headerBg;
  if (s.dropColor) v['--fnav-drop-color'] = s.dropColor;
  const cls = ['fnav-place-' + s.placement, 'fnav-icon-' + s.iconMode, 'fnav-hover-' + s.hover, 'fnav-home-' + s.homeShape];
  if (s.headerBg) cls.push('fnav-bg-custom');
  return { vars: v, classes: cls, style: s };
}

