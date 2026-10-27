import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { animationPresets, assertScene, computeFit, createAnimationTracks, createMesh, createMockup, createScene, createShape, createText, deserializeScene, evaluateScene, SceneStore, serializeScene, type AnimationPreset, type Fit } from '@bookklik/device-mockup-studio/core';
import { AssetManager, CanvasRenderer } from '@bookklik/device-mockup-studio/render';

test('all 16 motion presets support every layer type, bounded extremes and short timelines', () => {
  assert.equal(animationPresets.length, 16); assert.equal(new Set(animationPresets).size, 16);
  for (const node of [createMockup(), createShape(), createText(), createMesh({ z: 170 }), createShape({ x: 1e7, y: -1e7, scale: 1000, rotation: 1e6, tiltX: -89, tiltY: 89, opacity: .35 })]) {
    const before = JSON.stringify(node);
    for (const preset of animationPresets) for (const duration of [.001, 4, 3600]) {
      const tracks = createAnimationTracks(node, preset, duration), scene = createScene({ nodes: [node], tracks, duration });
      assertScene(scene); assert.equal(new Set(tracks.map(t => t.property)).size, tracks.length);
      for (const fraction of [0, .1, .25, .5, .75, 1]) {
        const result = evaluateScene(scene, duration * fraction); assertScene(result);
        assert.equal(result.nodes[0]!.z, node.z);
      }
      assert.deepEqual(deserializeScene(serializeScene(scene)), scene);
    }
    assert.equal(JSON.stringify(node), before);
  }
});

test('fades, slides and flip have distinct entrances and preserve base transforms at the end', () => {
  const node = createMockup({ x: 350, y: 250, width: 240, height: 160, scale: 1.2, opacity: .65, tiltY: 14, rotation: 18 });
  const evaluate = (preset: AnimationPreset, time: number) => evaluateScene(createScene({ nodes: [node], tracks: createAnimationTracks(node, preset, 4) }), time).nodes[0]!;
  for (const preset of ['fade-in', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'flip'] as const) {
    assert.equal(evaluate(preset, 0).opacity, 0);
    const end = evaluate(preset, 4);
    for (const property of ['x', 'y', 'scale', 'rotation', 'tiltY', 'opacity'] as const) assert.equal(end[property], node[property], `${preset}.${property}`);
  }
  assert.ok(evaluate('slide-left', 0).x < node.x); assert.ok(evaluate('slide-right', 0).x > node.x);
  assert.ok(evaluate('slide-up', 0).y > node.y); assert.ok(evaluate('slide-down', 0).y < node.y);
  assert.ok(evaluate('flip', 0).tiltY < node.tiltY);
  assert.equal(evaluate('fade-out', 0).opacity, node.opacity); assert.equal(evaluate('fade-out', 4).opacity, 0);
});

test('pulse, bounce and sway loop while spin completes a linear revolution', () => {
  const node = createShape({ rotation: 17, scale: 1.3, y: 250 });
  for (const preset of ['pulse', 'bounce', 'sway'] as const) {
    const tracks = createAnimationTracks(node, preset, 4), scene = createScene({ nodes: [node], tracks });
    for (const track of tracks) assert.equal(track.keyframes[0]!.value, track.keyframes.at(-1)!.value);
    assert.notDeepEqual(evaluateScene(scene, preset === 'bounce' ? 4 / 6 : 1).nodes, evaluateScene(scene, 0).nodes);
  }
  const spin = createScene({ nodes: [node], tracks: createAnimationTracks(node, 'spin', 4) });
  assert.equal(evaluateScene(spin, 2).nodes[0]!.rotation, 197);
  assert.equal(evaluateScene(spin, 4).nodes[0]!.rotation, 377);
});

test('Stretch uses the whole source and destination regardless of focal position', () => {
  for (const [sw, sh, tw, th] of [[300, 100, 100, 100], [100, 300, 400, 160], [1, 1, 17.5, 22.5]]) {
    const expected = { sx: 0, sy: 0, sw, sh, dx: 0, dy: 0, dw: tw, dh: th };
    for (const focal of [-1, 0, .5, 1, 2]) assert.deepEqual(computeFit(sw!, sh!, tw!, th!, 'stretch', focal, focal), expected);
  }
  for (const invalid of [0, -1, NaN, Infinity]) assert.throws(() => computeFit(invalid, 100, 100, 100, 'stretch'), { code: 'INVALID_FIT' });
  assert.throws(() => computeFit(100, 100, 100, 100, 'unknown' as Fit), { code: 'INVALID_FIT' });
});

test('Stretch and motion survive serialization and one-step replacement Undo/Redo', () => {
  const asset = { id: 'media', kind: 'image' as const, src: 'data:image/png;base64,AA', width: 300, height: 100 };
  const node = createMockup({ id: 'screen', assetId: asset.id, fit: 'stretch', focalX: .2, focalY: .8 });
  const initial = createScene({ assets: [asset], nodes: [node], background: { type: 'image', assetId: asset.id, fit: 'stretch', blur: 0, dim: 0 }, tracks: createAnimationTracks(node, 'float', 4) });
  assert.deepEqual(deserializeScene(serializeScene(initial)), initial);
  const store = new SceneStore(initial);
  store.update(scene => { scene.tracks = createAnimationTracks(scene.nodes[0]!, 'bounce', scene.duration); });
  const after = store.scene; assert.equal(after.version, 1);
  store.undo(); assert.deepEqual(store.scene, initial); assert.equal(store.canUndo, false);
  store.redo(); assert.deepEqual(store.scene, after); store.dispose();
});

test('Stretch draws all source stripes across the screen and image background in sync and async rendering', async () => {
  const source = createCanvas(300, 100), ctx = source.getContext('2d');
  for (const [index, color] of ['#ff0000', '#00ff00', '#0000ff'].entries()) { ctx.fillStyle = color; ctx.fillRect(index * 100, 0, 100, 100); }
  const canvas = createCanvas(1, 1), assets = new AssetManager(); assets.register('stripes', source as unknown as CanvasImageSource);
  const renderer = new CanvasRenderer(canvas as unknown as HTMLCanvasElement, { assets, canvasFactory: (w, h) => createCanvas(w, h) as unknown as HTMLCanvasElement });
  const asset = { id: 'stripes', kind: 'image' as const, src: 'data:image/png;base64,registered', width: 300, height: 100 };
  const scene = createScene({ width: 200, height: 200, background: { type: 'transparent' }, assets: [asset], nodes: [createMockup({ assetId: asset.id, deviceId: 'screenshot', x: 100, y: 100, width: 100, height: 100, fit: 'stretch', focalX: 0, focalY: 1, radius: 0, borderWidth: 0, lighting: 0, shadow: { color: '#000', opacity: 0, blur: 0, spread: 0, offsetX: 0, offsetY: 0 } })] });
  const pixel = (x: number, y: number) => [...canvas.getContext('2d').getImageData(x, y, 1, 1).data];
  try {
    await renderer.render(scene);
    assert.deepEqual(pixel(60, 65), [255, 0, 0, 255]); assert.deepEqual(pixel(100, 65), [0, 255, 0, 255]); assert.deepEqual(pixel(140, 65), [0, 0, 255, 255]);
    const rendered = canvas.toBuffer('image/png'); renderer.renderSync(scene); assert.deepEqual(canvas.toBuffer('image/png'), rendered);
    scene.nodes = []; scene.background = { type: 'image', assetId: asset.id, fit: 'stretch', blur: 0, dim: 0 };
    renderer.renderSync(scene);
    assert.deepEqual(pixel(10, 10), [255, 0, 0, 255]); assert.deepEqual(pixel(100, 10), [0, 255, 0, 255]); assert.deepEqual(pixel(190, 10), [0, 0, 255, 255]);
  } finally { renderer.dispose(); assets.dispose(); }
});
