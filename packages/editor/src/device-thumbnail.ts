import type { DeviceDefinition } from '@mockup-studio/core';
import { element } from './dom.js';
import { icon } from './icons.js';

export function deviceThumbnail(doc: Document, device: DeviceDefinition): HTMLElement {
  const holder = element(doc, 'span', 'ms-device-thumbnail');
  holder.setAttribute('aria-hidden', 'true');
  if (!device.artwork) { holder.append(icon(doc, device.category === 'browser' ? 'PanelsTopLeft' : 'Monitor')); return holder; }
  const art = device.artwork, rotated = art.orientation !== 0;
  const factor = Math.min(76 / (rotated ? art.height : art.width), 68 / (rotated ? art.width : art.height));
  const image = element(doc, 'img'); image.src = art.src; image.alt = ''; image.decoding = 'async'; image.loading = 'lazy';
  image.style.width = `${art.width * factor}px`; image.style.height = `${art.height * factor}px`;
  if (rotated) image.style.transform = `rotate(${art.orientation}deg)`;
  holder.append(image); return holder;
}
