import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { createHeadlessStudio, createScene, deserializeScene, AssetManager, CanvasRenderer, type CanvasBlobEncoder } from '../packages/sdk/src/headless.js';

const canvasFactory = (width: number, height: number) => createCanvas(width, height) as unknown as HTMLCanvasElement;
const encodeCanvas: CanvasBlobEncoder = async (canvas, { type }) => new Blob([new Uint8Array(await (canvas as unknown as Canvas).encode('png'))], { type });

test('headless studio renders and exports without a browser document', async () => {
  const studio = createHeadlessStudio({ scene: createScene({ width: 32, height: 24 }), canvasFactory, encodeCanvas });
  try {
    await studio.render();
    assert.equal(studio.canvas.width, 32);
    const blob = await studio.exportImage({ scale: 2 });
    assert.equal(blob.type, 'image/png');
    assert(blob.size > 0);
    assert.equal(studio.canvas.width, 64);
    assert.equal(studio.canvas.height, 48);
  } finally { studio.destroy(); }
});

test('headless scene editing, history, subscriptions and JSON stay available', () => {
  const changes: string[] = [];
  const studio = createHeadlessStudio({ canvasFactory, onChange: scene => changes.push(scene.name) });
  try {
    const original = studio.scene.name;
    studio.store.update(scene => { scene.name = 'Embedded'; });
    assert.deepEqual(changes, ['Embedded']);
    assert.equal(deserializeScene(studio.serialize()).name, 'Embedded');
    studio.store.undo();
    assert.equal(studio.scene.name, original);
    studio.store.redo();
    assert.equal(studio.scene.name, 'Embedded');
    const copy = studio.scene;
    copy.name = 'Not committed';
    assert.equal(studio.scene.name, 'Embedded');
    studio.load(JSON.stringify(createScene({ name: 'Loaded' })));
    assert.equal(studio.scene.name, 'Loaded');
    assert.throws(() => studio.load('{}'));
    assert.equal(studio.scene.name, 'Loaded');
  } finally { studio.destroy(); }
});

test('headless lifecycle rejects use after destroy and preserves borrowed assets', async () => {
  const assets = new AssetManager();
  const studio = createHeadlessStudio({ canvasFactory, assets });
  studio.destroy();
  studio.destroy();
  assert.throws(() => studio.serialize(), /destroyed/);
  await assert.rejects(studio.render(), /destroyed/);
  await assert.rejects(studio.exportImage(), /destroyed/);
  assert.doesNotThrow(() => assets.register('borrowed', canvasFactory(2, 2)));
  assets.dispose();
});

test('headless studio forwards renderer options to a custom factory', () => {
  const assets = new AssetManager();
  let calls = 0;
  const studio = createHeadlessStudio({
    canvasFactory, assets,
    rendererFactory(canvas, options) {
      calls++;
      assert.equal(options.assets, assets);
      assert.equal(options.canvasFactory, canvasFactory);
      return new CanvasRenderer(canvas, options);
    },
  });
  assert.equal(calls, 1);
  studio.destroy();
  assets.dispose();
});

test('headless studio recovers its operation queue after an aborted export', async () => {
  const studio = createHeadlessStudio({ canvasFactory, encodeCanvas });
  try {
    await assert.rejects(studio.exportImage({ signal: AbortSignal.abort() }), { name: 'AbortError' });
    assert((await studio.exportImage()).size > 0);
  } finally { studio.destroy(); }
});
