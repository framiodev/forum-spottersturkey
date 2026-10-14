import app from 'flarum/forum/app';
import ItemList from 'flarum/common/utils/ItemList';
import Button from 'flarum/common/components/Button';
import classList from 'flarum/common/utils/classList';
import { CustomNetwork, data, getNetworkIcon, networks, parseCustomNetworks, ShareableDiscussion } from './share';
import pupa from 'pupa';
import Mithril from 'mithril';

export const getNetworkButton = ({
  network,
  discussion,
  isRounded = false,
}: {
  network: string;
  discussion: ShareableDiscussion;
  isRounded?: boolean;
}): Mithril.Children => {
  return (
    <Button
      className={classList(`Button Button--block Share--${network}`, isRounded && 'Button--rounded')}
      icon={`${getNetworkIcon(network)} fa-lg fa-fw`}
      onclick={onNetworkButtonClick.bind(null, network, discussion)}
    >
      {app.translator.trans(`fof-share-social.lib.networks.${network}`)}
    </Button>
  );
};

export const getCustomNetworkButton = ({
  customNet,
  discussion,
  isRounded = false,
}: {
  customNet: CustomNetwork;
  discussion: ShareableDiscussion;
  isRounded?: boolean;
}): Mithril.Children => {
  return (
    <Button
      className={classList(`Button Button--block Share--custom Share--${customNet.id}`, isRounded && 'Button--rounded')}
      icon={`${customNet.icon} fa-lg fa-fw`}
      style={{
        backgroundColor: customNet.color || '#4D698E',
        color: '#ffffff',
        borderColor: 'transparent',
      }}
      onclick={() => onCustomNetworkButtonClick(customNet, discussion)}
    >
      {customNet.name}
    </Button>
  );
};

export const onNetworkButtonClick = (network: string, discussion: ShareableDiscussion): void => {
  const payload = data(discussion);
  const action = networks[network];

  if (!action) return;

  if (typeof action === 'function') {
    action(payload);
    return;
  }

  // mailto ve viber gibi özel protokolleri window.open yerine doğrudan yönlendir
  if (action.startsWith('mailto:') || action.startsWith('viber:')) {
    const encodedPayload: Record<string, string> = {};
    for (const key in payload) {
      encodedPayload[key] = encodeURIComponent(payload[key as keyof typeof payload]);
    }
    window.location.href = pupa(action, encodedPayload);
    return;
  }

  const width = 1000;
  const height = 500;
  const top = window.innerHeight / 2 - height / 2;
  const left = window.innerWidth / 2 - width / 2;
  const windowParams = `width=${width}, height=${height}, top=${top}, left=${left}, status=no, scrollbars=no, resizable=no`;

  const encodedPayload: Record<string, string> = {};
  for (const key in payload) {
    encodedPayload[key] = encodeURIComponent(payload[key as keyof typeof payload]);
  }

  window.open(pupa(action, encodedPayload), app.title, windowParams);
};

export const onCustomNetworkButtonClick = (customNet: CustomNetwork, discussion: ShareableDiscussion): void => {
  const payload = data(discussion);
  const action = customNet.urlTemplate;

  if (action.startsWith('mailto:') || action.startsWith('viber:') || action.startsWith('tg:') || action.startsWith('whatsapp:')) {
    const encodedPayload: Record<string, string> = {};
    for (const key in payload) {
      encodedPayload[key] = encodeURIComponent(payload[key as keyof typeof payload]);
    }
    window.location.href = pupa(action, encodedPayload);
    return;
  }

  const width = 1000;
  const height = 500;
  const top = window.innerHeight / 2 - height / 2;
  const left = window.innerWidth / 2 - width / 2;
  const windowParams = `width=${width}, height=${height}, top=${top}, left=${left}, status=no, scrollbars=no, resizable=no`;

  const encodedPayload: Record<string, string> = {};
  for (const key in payload) {
    encodedPayload[key] = encodeURIComponent(payload[key as keyof typeof payload]);
  }

  window.open(pupa(action, encodedPayload), app.title, windowParams);
};

export const getNetworkButtons = (discussion: ShareableDiscussion, isRounded?: boolean): ItemList<Mithril.Children> => {
  const list = new ItemList<Mithril.Children>();
  const enabledNetworks: string[] = app.forum.attribute('fof-share-social.networks') || [];
  const def: string = app.forum.attribute('fof-share-social.default');
  const customNetworksRaw: string = app.forum.attribute('fof-share-social.custom-networks') || '';

  // 1. Yerleşik aktif ağları ekle
  for (const network of enabledNetworks) {
    if (network === 'native' && !navigator.canShare?.(data(discussion))) continue;
    list.add(network, getNetworkButton({ network, discussion, isRounded }));
  }

  // 2. Yöneticinin eklediği dinamik özel ağları ekle
  const customNetworks = parseCustomNetworks(customNetworksRaw);
  for (const customNet of customNetworks) {
    list.add(customNet.id, getCustomNetworkButton({ customNet, discussion, isRounded }));
  }

  if (list.has(def)) {
    list.setPriority(def, 1000);
  }

  return list;
};
