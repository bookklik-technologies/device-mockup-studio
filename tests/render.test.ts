import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { createScene, createMockup, createShape, createText, evaluateScene, computeFit, StudioError, type Asset, type Background, type MockupStyle, type SceneDocument } from '@bookklik/device-mockup-studio-core';
import { registerDevice } from '@bookklik/device-mockup-studio-presets';
import { AssetManager, CanvasRenderer } from '@bookklik/device-mockup-studio-render';
import { fitted, MAX_OUTPUT_SIDE, MAX_OUTPUT_PIXELS } from '../packages/render/src/canvas.js';

// Explicit DOM compatibility casts: napi's Canvas is a CanvasImageSource at runtime,
// but deliberately has a smaller interface than a browser HTMLCanvasElement.
const asCanvas = (canvas: Canvas) => canvas as unknown as HTMLCanvasElement;
const asSource = (canvas: Canvas) => canvas as unknown as CanvasImageSource;
const canvasFactory = (width: number, height: number) => asCanvas(createCanvas(width, height));
const hash = (canvas: Canvas) => createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex');
const pixel = (canvas: Canvas, x: number, y: number) => [...canvas.getContext('2d').getImageData(x, y, 1, 1).data];
const asset: Asset = { id: 'screen', kind: 'image', src: 'data:image/png;base64,registered', width: 600, height: 420 };

function source(): Canvas {
  const c = createCanvas(600, 420), ctx = c.getContext('2d');
  ctx.fillStyle = '#f5f3ee'; ctx.fillRect(0, 0, 600, 420);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 122, 420);
  ctx.fillStyle = '#1b2d38'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('form /', 24, 38);
  const nav = ['Overview', 'Analytics', 'Customers', 'Projects', 'Settings'];
  nav.forEach((item, i) => { ctx.fillStyle = i === 0 ? '#e6eee8' : '#ffffff'; ctx.fillRect(12, 66 + i * 40, 98, 32); ctx.fillStyle = '#677569'; ctx.font = '11px sans-serif'; ctx.fillText(item, 25, 86 + i * 40); });
  ctx.fillStyle = '#26372e'; ctx.font = 'bold 24px sans-serif'; ctx.fillText('A little more clarity.', 145, 43);
  ctx.fillStyle = '#778177'; ctx.font = '11px sans-serif'; ctx.fillText('Your workspace, beautifully in focus.', 146, 65);
  const g = ctx.createLinearGradient(140, 80, 580, 230); g.addColorStop(0, '#dd7452'); g.addColorStop(1, '#f6bb85'); ctx.fillStyle = g; ctx.fillRect(144, 88, 432, 135);
  ctx.fillStyle = '#482c25'; ctx.font = '11px sans-serif'; ctx.fillText('THIS MONTH', 164, 113); ctx.font = 'bold 38px sans-serif'; ctx.fillText('$48,209', 164, 159); ctx.font = '12px sans-serif'; ctx.fillText('↑ 24.8%   Growing at your own pace.', 166, 191);
  ctx.strokeStyle = '#fff8e9'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(355, 182); ctx.bezierCurveTo(392, 168, 402, 195, 432, 144); ctx.bezierCurveTo(463, 103, 483, 173, 553, 114); ctx.stroke();
  for (let i = 0; i < 3; i++) { const x = 145 + i * 148; ctx.fillStyle = '#ffffff'; ctx.fillRect(x, 240, 137, 72); ctx.fillStyle = '#778177'; ctx.font = '10px sans-serif'; ctx.fillText(['Total revenue', 'Active projects', 'Happy customers'][i]!, x + 12, 261); ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#2d4034'; ctx.fillText(['$128k', '24', '1,204'][i]!, x + 12, 292); }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(145, 326, 432, 94);
  ctx.fillStyle = '#2e4136'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('Activity, at a glance', 160, 349);
  for (let i = 0; i < 17; i++) { ctx.fillStyle = i % 3 ? '#a4b8a4' : '#527b66'; ctx.fillRect(164 + i * 23, 407 - (14 + i * 13 % 48), 13, 14 + i * 13 % 48); }
  return c;
}

function setup(): { renderer: CanvasRenderer; canvas: Canvas; assets: AssetManager } {
  const canvas = createCanvas(1, 1), assets = new AssetManager();
  assets.register(asset.id, asSource(source()));
  return { canvas, assets, renderer: new CanvasRenderer(asCanvas(canvas), { assets, canvasFactory }) };
}
function document(background: Background = { type: 'solid', color: '#dce4dc' }): SceneDocument {
  return createScene({ width: 360, height: 280, background, assets: [asset], nodes: [createMockup({ id: 'node', x: 180, y: 140, width: 240, height: 170, assetId: asset.id, shadow: { color: '#18271f', opacity: .3, blur: 14, spread: 2, offsetX: 0, offsetY: 11 } })] });
}

// Importing all public modules above in Node must not touch browser globals.
test('scale-correct output, registered assets, and asynchronous/synchronous parity', async () => {
  const { renderer, canvas, assets } = setup(), scene = document();
  await renderer.render(scene, 0, { scale: 2 });
  assert.equal(canvas.width, 720); assert.equal(canvas.height, 560);
  const before = hash(canvas); renderer.renderSync(scene, 0, 2); assert.equal(hash(canvas), before);
  assert.deepEqual(pixel(canvas, 10, 10), [220, 228, 220, 255]);
  assert.notDeepEqual(pixel(canvas, 360, 280), [0, 0, 0, 255]);
  assert.equal(await assets.load(asset), assets.get(asset.id));
  renderer.dispose(); assert.ok(assets.get(asset.id), 'external manager remains usable'); assets.dispose();
});

test('transparent output and rounded screenshots preserve alpha', () => {
  const { renderer, canvas, assets } = setup();
  const scene = document({ type: 'transparent' });
  const node = scene.nodes[0]!;
  if (node.type === 'mockup') { node.shadow.opacity = 0; node.radius = 35; node.borderWidth = 0; }
  renderer.renderSync(scene);
  assert.equal(pixel(canvas, 0, 0)[3], 0); assert.equal(pixel(canvas, 61, 56)[3], 0);
  assert.equal(pixel(canvas, 180, 140)[3], 255);
  const empty = createScene({ width: 40, height: 30, background: { type: 'transparent' } }); renderer.renderSync(empty, 0, 1.5);
  assert.equal(canvas.width, 60); assert.equal(canvas.height, 45); assert.ok(canvas.getContext('2d').getImageData(0, 0, 60, 45).data.every(v => v === 0));
  renderer.dispose(); assets.dispose();
});

test('solid, linear, radial, animated, blurred/dimmed image backgrounds have distinct nonblack pixels', async () => {
  const { renderer, canvas, assets } = setup();
  const stops = [{ offset: 0, color: '#ffbb75' }, { offset: .5, color: '#b66ac8' }, { offset: 1, color: '#3564d5' }];
  const backgrounds: Background[] = [{ type: 'solid', color: '#f2e6da' }, { type: 'gradient', kind: 'linear', angle: 135, stops }, { type: 'gradient', kind: 'radial', angle: 0, stops }, { type: 'image', assetId: asset.id, fit: 'cover', blur: 8, dim: .3 }];
  const hashes = new Set<string>();
  for (const background of backgrounds) { const scene = document(background); scene.nodes = []; await renderer.render(scene); hashes.add(hash(canvas)); assert.equal(pixel(canvas, 90, 80)[3], 255); assert.ok(pixel(canvas, 90, 80).slice(0, 3).some(v => v > 20)); }
  assert.equal(hashes.size, backgrounds.length);
  const scene = document({ type: 'gradient', kind: 'linear', angle: 20, speed: 2, stops }); renderer.renderSync(scene, 0); const initial = hash(canvas); renderer.renderSync(scene, 1); assert.notEqual(hash(canvas), initial); const next = hash(canvas); renderer.renderSync(scene, 1); assert.equal(hash(canvas), next);
  renderer.dispose(); assets.dispose();
});

test('all procedural devices and frame styles produce distinct visual hashes', () => {
  const { renderer, canvas, assets } = setup(), scene = document();
  const node = scene.nodes[0]!; assert.equal(node.type, 'mockup'); if (node.type !== 'mockup') return;
  const hashes = new Set<string>();
  for (const deviceId of ['screenshot', 'browser', 'phone', 'android', 'tablet', 'laptop', 'desktop']) { node.deviceId = deviceId; renderer.renderSync(scene); hashes.add(hash(canvas)); assert.ok(pixel(canvas, 180, 140).slice(0, 3).some(v => v > 10)); }
  assert.equal(hashes.size, 7);
  node.deviceId = 'browser'; const styleHashes = new Set<string>();
  for (const style of ['default', 'glass-light', 'glass-dark', 'liquid-glass', 'inset-light', 'inset-dark', 'outline', 'border'] satisfies MockupStyle[]) { node.style = style; renderer.renderSync(scene); styleHashes.add(hash(canvas)); }
  assert.equal(styleHashes.size, 8);
  registerDevice({ id: 'render-test-custom', name: 'Custom rounded panel', category: 'browser', aspect: 1.4, inset: { top: 48, right: 14, bottom: 14, left: 14 }, radius: 26, screenRadius: 12, chrome: 'browser' });
  node.deviceId = 'render-test-custom'; renderer.renderSync(scene); assert.ok(!hashes.has(hash(canvas)));
  renderer.dispose(); assets.dispose();
});

test('cover/contain and focal crop use source aspect rather than stretching', () => {
  const { renderer, canvas, assets } = setup();
  const stripes = createCanvas(300, 100), ctx = stripes.getContext('2d');
  for (const [i, color] of ['#ff0000', '#00ff00', '#0000ff'].entries()) { ctx.fillStyle = color; ctx.fillRect(i * 100, 0, 100, 100); }
  assets.register('stripes', asSource(stripes));
  const a = { ...asset, id: 'stripes', width: 300, height: 100 };
  const node = createMockup({ id: 'crop', x: 100, y: 100, width: 100, height: 100, assetId: a.id, radius: 0, borderWidth: 0, lighting: 0, frameColor: '#ffffff', focalX: 0, shadow: { color: '#000000', opacity: 0, blur: 0, spread: 0, offsetX: 0, offsetY: 0 } });
  const scene = createScene({ width: 200, height: 200, background: { type: 'transparent' }, assets: [a], nodes: [node] });
  renderer.renderSync(scene); assert.deepEqual(pixel(canvas, 100, 100), [255, 0, 0, 255]);
  (scene.nodes[0] as typeof node).focalX = 1; renderer.renderSync(scene); assert.deepEqual(pixel(canvas, 100, 100), [0, 0, 255, 255]);
  (scene.nodes[0] as typeof node).fit = 'contain'; renderer.renderSync(scene); assert.deepEqual(pixel(canvas, 100, 65), [255, 255, 255, 255]); assert.deepEqual(pixel(canvas, 100, 100), [0, 255, 0, 255]);
  renderer.dispose(); assets.dispose();
});

test('contain and cover focal placement match core fit math on both axes, including clamped focal values', () => {
  for (const [sourceWidth, sourceHeight] of [[300, 100], [100, 300]]) {
    const source = asSource(createCanvas(sourceWidth!, sourceHeight!));
    for (const fit of ['contain', 'cover'] as const) for (const focalX of [-1, 0, .5, 1, 2]) for (const focalY of [-1, 0, .5, 1, 2]) {
      let args: unknown[] = [];
      const ctx = { drawImage: (...values: unknown[]) => { args = values; } } as unknown as CanvasRenderingContext2D;
      fitted(ctx, source, 7, 11, 100, 100, fit, focalX, focalY);
      const rect = computeFit(sourceWidth!, sourceHeight!, 100, 100, fit, focalX, focalY);
      assert.deepEqual(args, [source, rect.sx, rect.sy, rect.sw, rect.sh, 7 + rect.dx, 11 + rect.dy, rect.dw, rect.dh]);
    }
  }
});

test('node scratch allocations floor to the pixel and side budgets even at extreme aspect ratios', () => {
  // Stop at the first allocation after checking its dimensions: no need to allocate
  // several 32MP canvases merely to exercise the budget arithmetic.
  const stop = new Error('allocation inspected');
  for (const [width, height] of [[131072, 131072], [131072, 1], [1, 131072], [131072, 3907], [3907, 131072], [1, 1]]) {
    const renderer = new CanvasRenderer(asCanvas(createCanvas(1, 1)), { canvasFactory: (w, h) => {
      assert.ok(Number.isInteger(w) && Number.isInteger(h));
      assert.ok(w >= 1 && h >= 1 && w <= MAX_OUTPUT_SIDE && h <= MAX_OUTPUT_SIDE, `${w}x${h} exceeds side bounds`);
      assert.ok(w * h <= MAX_OUTPUT_PIXELS, `${w}x${h} exceeds pixel bounds`);
      throw stop;
    } });
    try {
      const scene = createScene({ width: 120, height: 100, nodes: [createShape({ width, height, blur: 100 })] });
      for (const scale of [.01, 1, 2.5]) assert.throws(() => renderer.renderSync(scene, 0, scale), error => error === stop);
    } finally { renderer.dispose(); }
  }
});

test('perspective is textured projective mesh, stable across frames and opacity', () => {
  const { renderer, canvas, assets } = setup(), scene = document({ type: 'transparent' });
  const node = scene.nodes[0]!; assert.equal(node.type, 'mockup'); if (node.type !== 'mockup') return;
  node.shadow.opacity = 0; node.radius = 0; node.borderWidth = 0; node.lighting = 0;
  renderer.renderSync(scene); const flat = hash(canvas);
  node.tiltX = 24; node.tiltY = -34; node.rotation = -7;
  renderer.renderSync(scene); const tilted = hash(canvas); assert.notEqual(flat, tilted);
  renderer.renderSync(scene); assert.equal(hash(canvas), tilted);
  // Compare left/right edge heights: a squash-only implementation has equal edge heights.
  const image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const span = (x: number) => { const ys: number[] = []; for (let y = 0; y < canvas.height; y++) if (image.data[(y * canvas.width + x) * 4 + 3]! > 230) ys.push(y); return (ys.at(-1) ?? 0) - (ys[0] ?? 0); };
  assert.ok(Math.abs(span(100) - span(250)) > 5);
  assert.equal(pixel(canvas, 180, 140)[3], 255, 'mesh interior has no alpha seams');
  node.opacity = .5; renderer.renderSync(scene); assert.ok(Math.abs(pixel(canvas, 180, 140)[3]! - 128) < 2, 'opacity applied once, not once per triangle');
  renderer.dispose(); assets.dispose();
});

test('all shape kinds, multiline/wrapped text, and calibrated color effects render', () => {
  const { renderer, canvas, assets } = setup();
  const scene = createScene({ width: 400, height: 300, background: { type: 'solid', color: '#cad8cb' }, nodes: [createShape({ id: 'r', x: 70, y: 75, width: 100, height: 90, shape: 'rectangle', fill: '#dd6f58', radius: 22 }), createShape({ id: 'e', x: 200, y: 75, width: 100, height: 90, shape: 'ellipse', fill: '#497361', blur: 2 }), createShape({ id: 'ring', x: 330, y: 75, width: 85, height: 85, shape: 'ring', stroke: '#8971a9', strokeWidth: 9 }), createText({ id: 'text', x: 200, y: 213, width: 340, height: 120, text: 'Shape a better\nkind of everyday.', fontSize: 30, align: 'center', color: '#273d31' })] });
  renderer.renderSync(scene); const before = hash(canvas);
  assert.deepEqual(pixel(canvas, 70, 75), [221, 111, 88, 255]);
  assert.deepEqual(pixel(canvas, 330, 75), [202, 216, 203, 255], 'ring center is not filled');
  scene.effects = { noise: .12, vignette: .25, saturation: 0, contrast: 1.15, brightness: .95, scanlines: .12, glitch: .5 }; renderer.renderSync(scene, .5); const after = hash(canvas); assert.notEqual(after, before); renderer.renderSync(scene, .5); assert.equal(hash(canvas), after);
  const [r, g, b] = pixel(canvas, 70, 75); assert.equal(r, g); assert.equal(g, b);
  renderer.dispose(); assets.dispose();
});

test('noise is seed- and time-deterministic and never fills transparent pixels', () => {
  const { renderer, canvas, assets } = setup();
  const scene = createScene({ width: 120, height: 80, background: { type: 'solid', color: '#808080' }, effects: { noise: .6, vignette: 0, saturation: 1, contrast: 1, brightness: 1, scanlines: 0, glitch: 0 }, seed: 42 });
  renderer.renderSync(scene, .5); const a = hash(canvas); renderer.renderSync(scene, .5); assert.equal(hash(canvas), a);
  scene.seed = 43; renderer.renderSync(scene, .5); assert.notEqual(hash(canvas), a);
  scene.background = { type: 'transparent' }; renderer.renderSync(scene); assert.equal(pixel(canvas, 60, 40)[3], 0);
  renderer.dispose(); assets.dispose();
});

test('tracks evaluate identically to pre-evaluated scene preview/export at supplied time', async () => {
  const { renderer, canvas, assets } = setup(), scene = document();
  scene.tracks = [{ id: 'motion', nodeId: 'node', property: 'tiltY', keyframes: [{ time: 0, value: -25 }, { time: 2, value: 25 }] }, { id: 'position', nodeId: 'node', property: 'x', keyframes: [{ time: 0, value: 140 }, { time: 2, value: 210 }] }];
  await renderer.render(scene, 1); const animated = hash(canvas);
  const evaluated = evaluateScene(scene, 1); evaluated.tracks = []; renderer.renderSync(evaluated, 1); assert.equal(hash(canvas), animated);
  renderer.dispose(); assets.dispose();
});

test('invalid scales, oversized output, failed media, cancellation and disposal reject explicitly', async () => {
  const { renderer, assets } = setup(), scene = document();
  for (const scale of [0, -1, Infinity, NaN]) { assert.throws(() => renderer.renderSync(scene, 0, scale), /scale/i); await assert.rejects(renderer.render(scene, 0, { scale }), /scale/i); }
  assert.throws(() => renderer.renderSync(scene, 0, 100), /Canvas dimensions/);
  assert.throws(() => renderer.renderSync({ ...scene, width: 8193 }), /Canvas dimensions/);
  assert.throws(() => renderer.renderSync({ ...scene, width: 8000, height: 8000 }), /Canvas dimensions/);
  const bad = createScene({ width: 100, height: 100, assets: [{ ...asset, id: 'bad', src: 'https://example.invalid/test.png' }], nodes: [createMockup({ assetId: 'bad' })] });
  await assert.rejects(renderer.render(bad), /browser|Register/i);
  assert.throws(() => renderer.renderSync(bad), /not loaded/i);
  const aborted = new AbortController(); aborted.abort(); await assert.rejects(renderer.render(scene, 0, { signal: aborted.signal }), /cancel/i);
  assert.throws(() => assets.register('empty', { width: 0, height: 0 } as unknown as CanvasImageSource), /dimensions/);
  renderer.dispose(); renderer.dispose(); assert.throws(() => renderer.renderSync(scene), /disposed/); await assert.rejects(renderer.render(scene), /disposed/); assert.ok(assets.get('screen'));
  assets.dispose(); assert.throws(() => assets.get('screen'), /disposed/); await assert.rejects(assets.load(asset), /disposed/);
  const owned = new CanvasRenderer(asCanvas(createCanvas(1, 1)), { canvasFactory }); owned.dispose(); assert.throws(() => owned.assets.get('x'), /disposed/);
});

class FakeImage extends EventTarget {
  naturalWidth = 4; naturalHeight = 3; crossOrigin = ''; decoding = ''; value = ''; static constructions = 0;
  constructor() { super(); FakeImage.constructions++; }
  set src(value: string) { this.value = value; queueMicrotask(() => this.dispatchEvent(new Event(value.includes('fail') ? 'error' : 'load'))); }
  get src() { return this.value; }
  removeAttribute() { this.value = ''; }
}

test('browser image cache loads anonymous-CORS, imports portable data URLs and propagates errors', async () => {
  const oldImage = globalThis.Image;
  Object.assign(globalThis, { Image: FakeImage });
  const assets = new AssetManager();
  try {
    const a: Asset = { ...asset, id: 'loaded', src: 'https://images.test/ok.png' };
    const first = assets.load(a), second = assets.load(a); assert.equal(first, second);
    const image = await first as unknown as FakeImage; assert.equal(image.crossOrigin, 'anonymous'); assert.equal(await assets.load(a), image);
    await assert.rejects(assets.load({ ...a, id: 'failed', src: 'https://images.test/fail.png' }), /Could not load/);
    await assert.rejects(assets.load({ ...a, id: 'script', src: 'javascript:alert(1)' }), /HTTP/);
    const bytes = source().toBuffer('image/png');
    const file = new File([new Uint8Array(bytes)], 'dashboard.png', { type: 'image/png' });
    const imported = await assets.importFile(file); assert.ok(imported.src.startsWith('data:image/png;base64,')); assert.equal(imported.width, 4); assert.equal(imported.height, 3); assert.equal(imported.name, file.name); assert.doesNotThrow(() => JSON.stringify(imported));
    await assert.rejects(assets.importFile(new File(['<svg/>'], 'unsafe.svg', { type: 'image/svg+xml' })), /Unsupported/);
    await assert.rejects(assets.importFile(new File([], 'empty.png', { type: 'image/png' })), /nonempty/);
    const pending = assets.load({ ...a, id: 'dispose-pending' }); assets.dispose(); await assert.rejects(pending, /disposed/);
  } finally { assets.dispose(); if (oldImage === undefined) delete (globalThis as { Image?: unknown }).Image; else globalThis.Image = oldImage; }
});

class FakeVideo extends EventTarget {
  videoWidth = 192; videoHeight = 108; duration = 5; readyState = 2; seeking = false; crossOrigin = ''; preload = ''; muted = false; playsInline = false; value = ''; time = 0; seekEvents = true; times: number[] = []; pauses = 0; loads = 0;
  set src(value: string) { this.value = value; }
  get src() { return this.value; }
  load() { this.loads++; if (this.value) queueMicrotask(() => this.dispatchEvent(new Event('loadeddata'))); }
  pause() { this.pauses++; }
  removeAttribute() { this.value = ''; }
  get currentTime() { return this.time; }
  set currentTime(value: number) { this.time = value; this.times.push(value); if (this.seekEvents) queueMicrotask(() => this.dispatchEvent(new Event('seeked'))); }
}

test('video frame preparation seeks, loops, clamps, cancels and releases resources', async () => {
  const oldDocument = globalThis.document, video = new FakeVideo();
  Object.assign(globalThis, { document: { createElement: () => video } });
  const assets = new AssetManager();
  try {
    const a: Asset = { id: 'video', kind: 'video', src: 'data:video/webm;base64,AAAA', width: 192, height: 108, duration: 5 };
    const node = createMockup({ assetId: a.id, videoStart: 1, playbackRate: 2, videoLoop: true });
    const scene = createScene({ assets: [a], nodes: [node] });
    await assets.prepareFrame(scene, 3); assert.equal(video.currentTime, 2); assert.equal(video.crossOrigin, 'anonymous');
    (scene.nodes[0] as typeof node).videoLoop = false; await assets.prepareFrame(scene, 10); assert.equal(video.currentTime, 4.999);
    video.seekEvents = false; const signal = new AbortController(); const pending = assets.prepareFrame(scene, 0, signal.signal); setTimeout(() => signal.abort(), 5); await assert.rejects(pending, /cancel/i);
    assets.dispose(); assert.equal(video.src, '');
  } finally { assets.dispose(); if (oldDocument === undefined) delete (globalThis as { document?: unknown }).document; else globalThis.document = oldDocument; }
});

const videoAsset: Asset = { id: 'video', kind: 'video', src: 'data:video/webm;base64,AAAA', width: 192, height: 108, duration: 5 };
const codeIs = (code: string) => (error: unknown) => error instanceof StudioError && error.code === code;

test('registered structural video sources seek without DOM globals and remain borrowed on disposal', async () => {
  const assets = new AssetManager(), video = new FakeVideo();
  video.src = videoAsset.src;
  assets.register(videoAsset.id, video as unknown as CanvasImageSource);
  const scene = createScene({ assets: [videoAsset], nodes: [createMockup({ assetId: videoAsset.id, videoStart: 1, playbackRate: 2 })] });
  try {
    await assets.prepareFrame(scene, 1);
    assert.equal(video.currentTime, 3);
    assert.equal(video.pauses, 1);
    const pauses = video.pauses, loads = video.loads;
    assets.dispose(); assets.dispose();
    assert.equal(video.src, videoAsset.src, 'borrowed video source must not be cleared');
    assert.equal(video.pauses, pauses, 'dispose must not manipulate caller-owned video');
    assert.equal(video.loads, loads, 'borrowed video must not be reloaded');
  } finally { assets.dispose(); }
});

test('zero-opacity and hidden mockups cannot hijack a registered video seek', async () => {
  const assets = new AssetManager(), video = new FakeVideo();
  assets.register(videoAsset.id, video as unknown as CanvasImageSource);
  const scene = createScene({ assets: [videoAsset], nodes: [
    createMockup({ id: 'transparent', assetId: videoAsset.id, videoStart: 3.5, opacity: 0 }),
    createMockup({ id: 'hidden', assetId: videoAsset.id, videoStart: 3, visible: false }),
    createMockup({ id: 'visible', assetId: videoAsset.id, videoStart: 0 }),
  ] });
  try { await assets.prepareFrame(scene, 1); assert.deepEqual(video.times, [1]); }
  finally { assets.dispose(); }
});

test('shared videos allow same-timing reuse, reject conflicting timing before seeking, and recover', async () => {
  const assets = new AssetManager(), video = new FakeVideo();
  assets.register(videoAsset.id, video as unknown as CanvasImageSource);
  const first = createMockup({ id: 'first', assetId: videoAsset.id, videoStart: 1 });
  try {
    for (const timing of [{ videoStart: 3 }, { playbackRate: 2 }, { videoLoop: false }]) {
      const scene = createScene({ assets: [videoAsset], nodes: [first, createMockup({ ...first, id: 'second', ...timing })] });
      await assert.rejects(assets.prepareFrame(scene, 0), codeIs('VIDEO_TIMING_CONFLICT'));
      assert.deepEqual(video.times, [], 'preflight must reject even if targets happen to match this frame');
    }
    const scene = createScene({ assets: [videoAsset], nodes: [first, createMockup({ ...first, id: 'second' })] });
    await assets.prepareFrame(scene, 1);
    assert.deepEqual(video.times, [2], 'same-timing reuse seeks exactly once');
    await assets.prepareFrame(scene, 1);
    assert.deepEqual(video.times, [2], 'repeated frame preparation is stable');
  } finally { assets.dispose(); }
});

test('independent video timings work through distinct asset IDs and independent sources', async () => {
  const assets = new AssetManager(), first = new FakeVideo(), second = new FakeVideo();
  assets.register('video', first as unknown as CanvasImageSource);
  assets.register('second', second as unknown as CanvasImageSource);
  const scene = createScene({ assets: [videoAsset, { ...videoAsset, id: 'second' }], nodes: [
    createMockup({ id: 'a', assetId: 'video', videoStart: 1 }),
    createMockup({ id: 'b', assetId: 'second', videoStart: 3, playbackRate: .5 }),
  ] });
  try {
    await assets.prepareFrame(scene, 1);
    assert.deepEqual(first.times, [2]); assert.deepEqual(second.times, [3.5]);
    assets.register('second', first as unknown as CanvasImageSource);
    await assert.rejects(assets.prepareFrame(scene, 1), codeIs('VIDEO_TIMING_CONFLICT'), 'aliasing one decoder under two IDs cannot hide timing conflicts');
  } finally { assets.dispose(); }
});

test('async and sync renders reject shared video timing conflicts without clearing the previous frame', async () => {
  const { renderer, canvas, assets } = setup(), video = new FakeVideo();
  try {
    renderer.renderSync(document()); const before = hash(canvas);
    assets.register(videoAsset.id, video as unknown as CanvasImageSource);
    const scene = createScene({ assets: [videoAsset], nodes: [
      createMockup({ id: 'a', assetId: videoAsset.id, videoStart: 1 }),
      createMockup({ id: 'b', assetId: videoAsset.id, videoStart: 2 }),
    ] });
    await assert.rejects(renderer.render(scene, 1), codeIs('VIDEO_TIMING_CONFLICT'));
    assert.equal(hash(canvas), before);
    assert.throws(() => renderer.renderSync(scene, 1), codeIs('VIDEO_TIMING_CONFLICT'));
    assert.equal(hash(canvas), before);
  } finally { renderer.dispose(); assets.dispose(); }
});

test('render attractive original art-direction fixture', async () => {
  const { renderer, canvas, assets } = setup();
  const scene = createScene({ width: 1200, height: 900, seed: 18, assets: [asset], background: { type: 'gradient', kind: 'radial', angle: 20, stops: [{ offset: 0, color: '#354e45' }, { offset: .6, color: '#1c302d' }, { offset: 1, color: '#111f23' }] }, effects: { noise: .045, vignette: .2, saturation: 1, contrast: 1, brightness: 1, scanlines: 0, glitch: 0 }, nodes: [
    createShape({ id: 'halo', x: 950, y: 200, width: 670, height: 670, shape: 'ring', stroke: '#71877a', strokeWidth: 1, opacity: .3, rotation: -25, tiltX: 40 }),
    createText({ id: 'eyebrow', x: 600, y: 82, width: 900, height: 40, text: 'P R I S M L E T   /   C O M P O S I T I O N   N º  0 1', color: '#b7c8af', fontSize: 13, fontWeight: 500, align: 'center' }),
    createText({ id: 'title', x: 600, y: 160, width: 1050, height: 125, text: 'A little more perspective.', color: '#f0eee0', fontFamily: 'Georgia', fontSize: 65, fontWeight: 400, align: 'center' }),
    createMockup({ id: 'desktop', assetId: asset.id, deviceId: 'browser', x: 550, y: 495, width: 820, height: 550, tiltX: 10, tiltY: -14, rotation: -5, radius: 20, style: 'glass-dark', frameColor: '#1b292b', lighting: .5, borderWidth: 1, shadow: { color: '#020a0a', opacity: .7, blur: 48, spread: 2, offsetX: 0, offsetY: 40 } }),
    createMockup({ id: 'phone', assetId: asset.id, deviceId: 'phone', x: 966, y: 587, width: 207, height: 420, fit: 'cover', focalX: .52, radius: 34, tiltX: 4, tiltY: -15, rotation: 9, style: 'default', frameColor: '#152321', lighting: .7, borderWidth: 1, shadow: { color: '#020a0a', opacity: .6, blur: 28, spread: 0, offsetX: 0, offsetY: 24 } }),
    createText({ id: 'footer', x: 600, y: 845, width: 1000, height: 35, text: 'Original frames. Thoughtful details. A canvas for your next idea.', color: '#a5b6a8', fontSize: 15, fontWeight: 400, align: 'center' }),
  ] });
  await renderer.render(scene);
  assert.equal(canvas.width, 1200); assert.equal(canvas.height, 900);
  await mkdir('artifacts', { recursive: true }); await writeFile('artifacts/render-fixture.png', canvas.toBuffer('image/png'));
  assert.ok(canvas.toBuffer('image/png').byteLength > 100_000);
  renderer.dispose(); assets.dispose();
});
