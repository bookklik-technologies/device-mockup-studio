import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { createMockup, createScene, StudioError, type DeviceDefinition } from '@bookklik/device-mockup-studio/core';
import { getDevice, listDevices, registerDevice } from '@bookklik/device-mockup-studio/presets';
import { AssetManager, CanvasRenderer } from '@bookklik/device-mockup-studio/render';

const definition = (): DeviceDefinition => ({ id: 'test:artwork', name: 'Test artwork', category: 'phone', aspect: .6, inset: { top: 0, left: 0, bottom: 0, right: 0 }, radius: 0, screenRadius: 0, artwork: { src: 'data:image/png;base64,AA==', width: 60, height: 100, screen: { x: 10, y: 10, width: 40, height: 80, radius: 0 }, orientation: 0 } });
const code = (expected: string) => (error: unknown) => error instanceof StudioError && error.code === expected;

test('artwork metadata is validated and cloned; legacy device lookup remains available', () => {
  const d = definition(); registerDevice(d); d.artwork!.screen.x = 999;
  assert.equal(getDevice(d.id).artwork!.screen.x, 10);
  for (const patch of [{ width: 0 }, { orientation: 45 }, { src: 'javascript:alert(1)' }, { src: 'data:text/html;base64,AA==' }, { screen: { x: 40, y: 10, width: 40, height: 80, radius: 0 } }, { screen: { x: 10, y: 10, width: 40, height: 80, radius: 50 } }, { extra: true }]) {
    const value = definition(); Object.assign(value.artwork!, patch); assert.throws(() => registerDevice(value), code('INVALID_DEVICE'));
  }
  assert.equal(getDevice('phone').name, 'Arc handset');
  assert.ok(!listDevices({ includeLegacy: false }).some(d => d.id === 'phone'));
  assert.equal(listDevices({ includeLegacy: false }).filter(d => d.artwork && !d.id.startsWith('test:')).length, 19);
  for (const id of ['iphone-17', 'galaxy-s26', 'pixel-10-pro', 'ipad-air-11-m4', 'galaxy-tab-s11']) {
    const portrait = getDevice(id), landscape = getDevice(`${id}-landscape`);
    assert.ok(portrait.artwork?.src.startsWith('data:image/png;base64,'));
    assert.equal(landscape.aspect, 1 / portrait.aspect);
    assert.equal(landscape.artwork?.src, portrait.artwork?.src);
  }
  assert.equal(getDevice('macbook-air-13-m5').category, 'laptop');
});

test('landscape rotates frame and cutout while keeping media upright; shared caches survive disposal', async () => {
  const d = definition(); d.artwork!.orientation = 90; d.aspect = 100 / 60; registerDevice(d);
  const frame = createCanvas(60, 100), f = frame.getContext('2d'); f.fillStyle = '#000'; f.fillRect(0, 0, 60, 100); f.clearRect(10, 10, 40, 80); f.fillRect(27, 12, 6, 6);
  const content = createCanvas(80, 40), c = content.getContext('2d'); c.fillStyle = '#f00'; c.fillRect(0, 0, 40, 40); c.fillStyle = '#00f'; c.fillRect(40, 0, 40, 40);
  const assets = new AssetManager(), frames = new AssetManager(); assets.register('screen', content as unknown as CanvasImageSource); frames.register(d.id, frame as unknown as CanvasImageSource);
  const output = createCanvas(100, 60), renderer = new CanvasRenderer(output as unknown as HTMLCanvasElement, { assets, deviceAssets: frames, canvasFactory: (w, h) => createCanvas(w, h) as unknown as HTMLCanvasElement });
  // Scene validation requires the asset reference; rendering uses the registered node canvas.
  const scene = createScene({ width: 100, height: 60, background: { type: 'transparent' }, assets: [{ id: 'screen', kind: 'image', src: 'data:image/png;base64,AA==', width: 80, height: 40 }], nodes: [createMockup({ deviceId: d.id, assetId: 'screen', x: 50, y: 30, width: 100, height: 60, lighting: 0, shadow: { color: '#000', opacity: 0, blur: 0, spread: 0, offsetX: 0, offsetY: 0 } })] });
  await renderer.render(scene);
  const pixel = (x: number, y: number) => [...output.getContext('2d').getImageData(x, y, 1, 1).data];
  assert.deepEqual(pixel(25, 30), [255, 0, 0, 255]); assert.deepEqual(pixel(65, 30), [0, 0, 255, 255]); assert.deepEqual(pixel(85, 30), [0, 0, 0, 255]);
  const before = output.toBuffer('image/png'); renderer.renderSync(scene); assert.deepEqual(output.toBuffer('image/png'), before);
  renderer.dispose(); assert.ok(frames.get(d.id)); frames.dispose(); assets.dispose();
});

test('missing or failed artwork never clears the last successful canvas', async () => {
  const d = definition(); registerDevice(d);
  const output = createCanvas(20, 20), renderer = new CanvasRenderer(output as unknown as HTMLCanvasElement, { canvasFactory: (w, h) => createCanvas(w, h) as unknown as HTMLCanvasElement });
  const scene = createScene({ width: 20, height: 20, nodes: [] }); renderer.renderSync(scene); const before = output.toBuffer('image/png');
  scene.nodes.push(createMockup({ deviceId: d.id, x: 10, y: 10, width: 12, height: 20 }));
  assert.throws(() => renderer.renderSync(scene), code('DEVICE_ARTWORK_NOT_READY'));
  await assert.rejects(renderer.render(scene), code('DEVICE_ARTWORK_LOAD'));
  assert.deepEqual(output.toBuffer('image/png'), before); renderer.dispose();
});
