export { default as Friendship } from './models/Friendship';
export { default as FriendshipRequest } from './models/FriendshipRequest';
export { default as FriendshipEvent } from './models/FriendshipEvent';

export function getContrastColor(hex: string): string {
  let clean = hex.replace('#', '');

  // Expand shorthand (#abc -> #aabbcc) before validating length, so a
  // 3-digit hex typed into the admin's text field (the picker itself always
  // emits 6 digits) doesn't fall through to the invalid-input branch.
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }

  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return 'rgba(0,0,0,0.82)';
  }

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 135 ? 'rgba(0,0,0,0.82)' : '#fff';
}
