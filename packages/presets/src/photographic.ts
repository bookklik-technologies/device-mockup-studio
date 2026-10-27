import type { DeviceDefinition } from '@bookklik/device-mockup-studio/core';
import { artworkSources } from './artwork-data.js';

// Screen measurements are in original PNG pixels, including the transparent margin.
const models = [
  { id: 'iphone-17', name: 'iPhone 17 · Lavender', category: 'phone', width: 1024, height: 1536, screen: { x: 203, y: 53, width: 619, height: 1430, radius: 88 }, screenAspect: 1206 / 2622 },
  { id: 'iphone-17-pro', name: 'iPhone 17 Pro · Silver', category: 'phone', width: 1024, height: 1536, screen: { x: 182, y: 49, width: 661, height: 1438, radius: 88 }, screenAspect: 1206 / 2622 },
  { id: 'galaxy-s26', name: 'Samsung Galaxy S26 · Cobalt Violet', category: 'phone', width: 875, height: 1798, screen: { x: 75, y: 78, width: 725, height: 1648, radius: 85 }, screenAspect: 1080 / 2340 },
  { id: 'galaxy-s26-ultra', name: 'Samsung Galaxy S26 Ultra · Black', category: 'phone', width: 1024, height: 1536, screen: { x: 187, y: 34, width: 650, height: 1468, radius: 42 }, screenAspect: 1440 / 3120 },
  { id: 'pixel-10-pro', name: 'Google Pixel 10 Pro · Porcelain', category: 'phone', width: 1024, height: 1536, screen: { x: 193, y: 51, width: 639, height: 1440, radius: 90 }, screenAspect: 1280 / 2856 },
  { id: 'ipad-air-11-m4', name: 'iPad Air 11-inch (M4) · Blue', category: 'tablet', width: 1064, height: 1479, screen: { x: 93, y: 98, width: 878, height: 1282, radius: 26 }, screenAspect: 1640 / 2360 },
  { id: 'ipad-pro-11-m5', name: 'iPad Pro 11-inch (M5) · Silver', category: 'tablet', width: 1055, height: 1491, screen: { x: 76, y: 83, width: 905, height: 1316, radius: 24 }, screenAspect: 1668 / 2420 },
  { id: 'galaxy-tab-s11', name: 'Samsung Galaxy Tab S11 · Gray', category: 'tablet', width: 1024, height: 1536, screen: { x: 98, y: 107, width: 827, height: 1324, radius: 24 }, screenAspect: 1600 / 2560 },
  { id: 'macbook-air-13-m5', name: 'MacBook Air 13-inch (M5) · Sky Blue', category: 'laptop', width: 1536, height: 1024, screen: { x: 188, y: 132, width: 1161, height: 729, radius: 20 }, screenAspect: 2560 / 1664 },
  { id: 'macbook-pro-14-m5', name: 'MacBook Pro 14-inch (M5) · Silver', category: 'laptop', width: 1537, height: 1023, screen: { x: 135, y: 121, width: 1267, height: 742, radius: 24 }, screenAspect: 3024 / 1964 },
  { id: 'imac-24-m4', name: 'iMac 24-inch (M4) · Silver', category: 'desktop', width: 1536, height: 1024, screen: { x: 170, y: 54, width: 1197, height: 639, radius: 2 }, screenAspect: 16 / 9 },
] as const;

export const photographicDevices: DeviceDefinition[] = models.flatMap(model => {
  const { id, name, category, width, height, screen, screenAspect } = model;
  // Normalize the generated frame's screen to the hardware's published aspect ratio.
  const aspect = width / height * screenAspect / (screen.width / screen.height);
  const device: DeviceDefinition = { id, name, category, aspect, inset: { top: 0, right: 0, bottom: 0, left: 0 }, radius: 0, screenRadius: 0, artwork: { src: artworkSources[id]!, width, height, screen: { ...screen }, orientation: 0 } };
  if (category !== 'phone' && category !== 'tablet') return [device];
  return [device, { ...device, id: `${id}-landscape`, name: `${name} / landscape`, aspect: 1 / aspect, artwork: { ...device.artwork!, screen: { ...screen }, orientation: category === 'tablet' ? 270 : 90 } }];
});
