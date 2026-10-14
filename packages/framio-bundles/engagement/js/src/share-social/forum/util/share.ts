import { getPlainContent, truncate } from 'flarum/common/utils/string';
import Discussion from 'flarum/common/models/Discussion';

export type ShareData = {
  url: string;
  title: string;
  description: string;
};

export type CustomNetwork = {
  id: string;
  name: string;
  icon: string;
  urlTemplate: string;
  color?: string;
};

type NetworkAction = string | ((data: ShareData) => void);

export const networks: Record<string, NetworkAction> = {
  // En popüler mesajlaşma ve sosyal ağlar
  whatsapp: '//api.whatsapp.com/send/?phone&text={title}%20{url}',
  telegram: '//telegram.me/share/url?url={url}&text={title}',
  linkedin: '//linkedin.com/sharing/share-offsite/?url={url}',
  twitter: '//twitter.com/intent/tweet?url={url}&text={title}',
  facebook: '//facebook.com/sharer/sharer.php?u={url}',
  reddit: '//www.reddit.com/submit?url={url}&title={title}',
  threads: '//threads.net/intent/post?text={title}%20{url}',
  bluesky: '//bsky.app/intent/compose?text={title}%20{url}',
  mastodon: '//mastodonshare.com/?text={title}&url={url}',
  pinterest: '//pinterest.com/pin/create/button/?url={url}&description={title}',
  tumblr: '//www.tumblr.com/widgets/share/tool?canonicalUrl={url}&title={title}',
  viber: 'viber://forward?text={title}%20{url}',
  skype: '//web.skype.com/share?url={url}&text={title}',
  email: 'mailto:?subject={title}&body={url}',

  // Bölgesel ağlar
  vkontakte: '//vk.com/share.php?url={url}&title={title}&description={description}',
  odnoklassniki: '//connect.ok.ru/offer?url={url}',
  my_mail: '//connect.mail.ru/share?url={url}&title={title}&description={description}',
  qq: '//connect.qq.com/widget/shareqq/iframe_index.html?url={url}&title={title}',
  qzone: '//sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url={url}&summary={description}&title={title}',

  // Yerel tarayıcı paylaşımı
  native: (shareData) => navigator.share(getNativeData(shareData)),
};

export const networkIcons: Record<string, string> = {
  whatsapp: 'fab fa-whatsapp',
  telegram: 'fab fa-telegram',
  linkedin: 'fab fa-linkedin',
  twitter: 'fa-brands fa-x-twitter',
  facebook: 'fab fa-facebook',
  reddit: 'fab fa-reddit',
  threads: 'fa-brands fa-threads',
  bluesky: 'fa-brands fa-bluesky',
  mastodon: 'fa-brands fa-mastodon',
  pinterest: 'fab fa-pinterest',
  tumblr: 'fab fa-tumblr',
  viber: 'fab fa-viber',
  skype: 'fab fa-skype',
  email: 'fas fa-envelope',
  vkontakte: 'fab fa-vk',
  my_mail: 'fas fa-at',
  qq: 'fab fa-qq',
  qzone: 'fas fa-star',
  native: 'fas fa-share-square',
};

export const getNetworkIcon = (network: string): string => {
  return networkIcons[network] || `fab fa-${network}`;
};

export type ShareableDiscussion = Discussion & { shareUrl: () => string };

export const data = (discussion: ShareableDiscussion): ShareData => {
  const url = discussion.shareUrl();
  const title = discussion.title();
  const firstPost = discussion.firstPost();
  const description = (firstPost && truncate(getPlainContent(firstPost.contentHtml() as string), 150, 0)) || '';

  return { url, title, description };
};

export const getNativeData = ({ title, description, url }: ShareData): { title: string; text: string; url: string } => ({
  title,
  text: description,
  url,
});

export const canNativeShare = (discussion: ShareableDiscussion): boolean => {
  return !!navigator.canShare?.(getNativeData(data(discussion)));
};

/**
 * Yöneticinin panelden eklediği özel ağları ayrıştırır.
 * Format 1: JSON dizisi [{name, icon, url, color}]
 * Format 2: Satır satır: İsim | fa-icon | URL_Template | Renk
 */
export const parseCustomNetworks = (raw: string | null | undefined): CustomNetwork[] => {
  if (!raw || !raw.trim()) return [];

  const trimmed = raw.trim();

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => ({
          id: `custom_${idx}_` + (item.name || 'custom').toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name: item.name || 'Custom',
          icon: item.icon || 'fas fa-share',
          urlTemplate: item.url || item.urlTemplate || '',
          color: item.color || '#4D698E',
        })).filter(item => Boolean(item.urlTemplate));
      }
    } catch {
      // Hata durumunda satır satır ayrıştırmaya devam et
    }
  }

  const lines = trimmed.split('\n');
  const result: CustomNetwork[] = [];

  lines.forEach((line, idx) => {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith('#')) return;

    const parts = cleanLine.split('|').map(s => s.trim());
    if (parts.length >= 3) {
      const name = parts[0];
      const icon = parts[1];
      const urlTemplate = parts[2];
      const color = parts[3] || '#4D698E';

      result.push({
        id: `custom_${idx}_` + name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name,
        icon,
        urlTemplate,
        color,
      });
    }
  });

  return result;
};
