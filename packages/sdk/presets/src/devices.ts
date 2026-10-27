import { StudioError } from '@bookklik/device-mockup-studio/core';
import type { DeviceDefinition } from '@bookklik/device-mockup-studio/core';
import { photographicDevices } from './photographic.js';

/** Original procedural frame parameters, not photographed or vendor-derived hardware assets.
 * Insets/radii are nominal output pixels; aspect is outer width / height. */
const originals: DeviceDefinition[] = [
  { id: 'screenshot', name: 'Canvas / landscape', category: 'screenshot', aspect: 1.5, inset: { top: 0, right: 0, bottom: 0, left: 0 }, radius: 22, screenRadius: 20 },
  { id: 'browser', name: 'Window / landscape', category: 'browser', aspect: 1.5, inset: { top: 36, right: 6, bottom: 6, left: 6 }, radius: 16, screenRadius: 10, chrome: 'browser' },
  { id: 'phone', name: 'Arc handset', category: 'phone', aspect: 0.49, inset: { top: 14, right: 11, bottom: 14, left: 11 }, radius: 44, screenRadius: 34, camera: 'pill' },
  { id: 'android', name: 'Dot handset', category: 'phone', aspect: 0.47, inset: { top: 12, right: 9, bottom: 12, left: 9 }, radius: 30, screenRadius: 23, camera: 'dot' },
  { id: 'tablet', name: 'Slate', category: 'tablet', aspect: 0.75, inset: { top: 20, right: 18, bottom: 20, left: 18 }, radius: 28, screenRadius: 14, camera: 'dot' },
  { id: 'laptop', name: 'Fold workstation', category: 'laptop', aspect: 1.52, inset: { top: 18, right: 14, bottom: 52, left: 14 }, radius: 14, screenRadius: 8, camera: 'dot', chrome: 'keyboard' },
  { id: 'desktop', name: 'Studio display', category: 'desktop', aspect: 1.28, inset: { top: 16, right: 16, bottom: 100, left: 16 }, radius: 16, screenRadius: 6, chrome: 'stand' },
];
const registry = new Map<string, DeviceDefinition>();
const legacyIds = new Set<string>();
for (const definition of originals) registry.set(definition.id, structuredClone(definition));
for (const definition of originals) {
  registry.set(`${definition.id}-portrait`, { ...structuredClone(definition), id: `${definition.id}-portrait`, name: `${definition.name} / portrait`, aspect: Math.min(definition.aspect, 1 / definition.aspect) });
}
for (const id of ['phone', 'android', 'tablet']) {
  const definition = registry.get(id)!;
  registry.set(`${id}-landscape`, { ...structuredClone(definition), id: `${id}-landscape`, name: `${definition.name} / landscape`, aspect: 1 / definition.aspect });
}
for (const id of registry.keys()) if (!['screenshot', 'browser'].includes(id)) legacyIds.add(id);
for (const definition of photographicDevices) registry.set(definition.id, structuredClone(definition));

export function getDevice(id: string): DeviceDefinition {
  const device = registry.get(id);
  if (!device) throw new StudioError('UNKNOWN_DEVICE', `Unknown device: ${id}. Register custom device definitions with registerDevice().`);
  return structuredClone(device);
}
/** The default preserves SDK compatibility; editors can hide legacy generic frames. */
export function listDevices(options: { includeLegacy?: boolean } = {}): DeviceDefinition[] { return [...registry.values()].filter(device => options.includeLegacy !== false || !legacyIds.has(device.id)).map(device => structuredClone(device)); }
/** Register or replace an original/custom definition without exposing mutable registry state. */
export function registerDevice(definition: DeviceDefinition): void {
  const d: unknown = definition;
  const fail = (message: string): never => { throw new StudioError('INVALID_DEVICE', message); };
  if (typeof d !== 'object' || d === null || Array.isArray(d)) fail('Device must be an object.');
  const value = d as Record<string, unknown>;
  const allowed = ['id', 'name', 'category', 'aspect', 'inset', 'radius', 'screenRadius', 'camera', 'chrome', 'artwork'];
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) fail('Device must be a plain object.');
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !allowed.includes(key))) fail('Unknown device field.');
  if (Object.values(Object.getOwnPropertyDescriptors(value)).some(descriptor => descriptor.get || descriptor.set)) fail('Device accessors are not supported.');
  for (const key of ['id', 'name']) if (typeof value[key] !== 'string' || !(value[key] as string).trim() || (value[key] as string).length > 256) fail(`Device ${key} must be a non-empty string (max 256 characters).`);
  if (typeof value.category !== 'string' || !['screenshot', 'browser', 'phone', 'tablet', 'laptop', 'desktop'].includes(value.category)) fail('Invalid device category.');
  const number = (n: unknown, min: number, max: number): boolean => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (!number(value.aspect, 0.05, 20)) fail('Aspect must be finite and between 0.05 and 20.');
  for (const key of ['radius', 'screenRadius']) if (!number(value[key], 0, 4096)) fail(`Invalid device ${key}.`);
  const inset = value.inset;
  if (typeof inset !== 'object' || inset === null || Array.isArray(inset)) fail('Insets must be an object.');
  const entries = inset as Record<string, unknown>;
  if (Object.getPrototypeOf(entries) !== Object.prototype && Object.getPrototypeOf(entries) !== null) fail('Insets must be a plain object.');
  if (Reflect.ownKeys(entries).some(key => typeof key !== 'string' || !['top', 'right', 'bottom', 'left'].includes(key))) fail('Unknown inset field.');
  if (Object.values(Object.getOwnPropertyDescriptors(entries)).some(descriptor => descriptor.get || descriptor.set)) fail('Inset accessors are not supported.');
  for (const side of ['top', 'right', 'bottom', 'left']) if (!number(entries[side], 0, 4096)) fail(`Invalid ${side} inset.`);
  if (value.camera !== undefined && (typeof value.camera !== 'string' || !['pill', 'dot'].includes(value.camera))) fail('Invalid camera.');
  if (value.chrome !== undefined && (typeof value.chrome !== 'string' || !['browser', 'stand', 'keyboard'].includes(value.chrome))) fail('Invalid chrome.');
  if (value.artwork !== undefined) {
    const plain = (input: unknown, keys: string[]): Record<string, unknown> => {
      if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Invalid artwork object.');
      const record = input as Record<string, unknown>;
      if (![Object.prototype, null].includes(Object.getPrototypeOf(record))) fail('Artwork must be plain data.');
      if (Reflect.ownKeys(record).some(key => typeof key !== 'string' || !keys.includes(key))) fail('Unknown artwork field.');
      if (Object.values(Object.getOwnPropertyDescriptors(record)).some(d => d.get || d.set)) fail('Artwork accessors are not supported.');
      return record;
    };
    const art = plain(value.artwork, ['src', 'width', 'height', 'screen', 'orientation']);
    if (typeof art.src !== 'string' || !art.src.length || art.src.length > 32 * 1024 * 1024) fail('Invalid artwork source.');
    try {
      const url = new URL(art.src as string, 'https://mockup-studio.invalid/');
      if (!['http:', 'https:', 'data:'].includes(url.protocol) || (url.protocol === 'data:' && !/^data:image\/(png|webp|jpeg);base64,/i.test(art.src as string))) fail('Invalid artwork URL.');
    } catch { fail('Invalid artwork URL.'); }
    for (const key of ['width', 'height']) if (!number(art[key], 1, 16384)) fail('Invalid artwork dimensions.');
    if (art.orientation !== 0 && art.orientation !== 90 && art.orientation !== 270) fail('Invalid artwork orientation.');
    const screen = plain(art.screen, ['x', 'y', 'width', 'height', 'radius']);
    for (const key of ['x', 'y', 'radius']) if (!number(screen[key], 0, 16384)) fail('Invalid screen geometry.');
    for (const key of ['width', 'height']) if (!number(screen[key], 1, 16384)) fail('Invalid screen size.');
    if ((screen.x as number) + (screen.width as number) > (art.width as number) || (screen.y as number) + (screen.height as number) > (art.height as number) || (screen.radius as number) > Math.min(screen.width as number, screen.height as number) / 2) fail('Screen must fit inside artwork.');
  }
  registry.set(definition.id, structuredClone(definition));
  legacyIds.delete(definition.id);
}

export const framePresets: ReadonlyArray<{ id: string; name: string; width: number; height: number }> = Object.freeze([
  { id: 'square', name: 'Square post', width: 1080, height: 1080 },
  { id: 'portrait-post', name: 'Portrait post', width: 1080, height: 1350 },
  { id: 'story', name: 'Story / short', width: 1080, height: 1920 },
  { id: 'landscape', name: 'Landscape 4:3', width: 1200, height: 900 },
  { id: 'widescreen', name: 'Video 16:9', width: 1920, height: 1080 },
  { id: 'social-card', name: 'Link preview', width: 1200, height: 630 },
  { id: 'pin', name: 'Vertical pin', width: 1000, height: 1500 },
  { id: 'banner', name: 'Profile banner', width: 1500, height: 500 },
  { id: 'presentation', name: 'Presentation 16:10', width: 1600, height: 1000 },
].map(frame => Object.freeze(frame)));
