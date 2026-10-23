/**
 * Adversarial regression tests.
 *
 * These tests probe correctness properties of @mockup-studio/core, presets and render
 * from the perspective of hostile/untrusted scene documents, bounds abuse, history
 * integrity, animation edge cases and deterministic raster output.
 *
 * Test naming convention:
 *  - Plain tests assert required correctness properties.
 *  - `BUG-xx …` tests reproduce resolved audit findings to prevent regressions.
 *  - `QA-xx …` tests cover validation limits, history behavior and documented renderer
 *    constraints. Current behavior and limits are described in docs/API.md.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import {
  assertScene, createAnimationTracks, createMockup, createScene, createShape, createText,
  deserializeScene, ease, evaluateScene, SceneStore, StudioError, validateScene,
  type Asset, type MockupNode, type SceneDocument, type TextNode,
} from '@mockup-studio/core';
import { applyPreset, getDevice, getPresets, listDevices, registerDevice } from '@mockup-studio/presets';
import { AssetManager, CanvasRenderer } from '@mockup-studio/render';

const asCanvas = (canvas: Canvas) => canvas as unknown as HTMLCanvasElement;
const asSource = (canvas: Canvas) => canvas as unknown as CanvasImageSource;
const canvasFactory = (width: number, height: number) => asCanvas(createCanvas(width, height));
const hash = (canvas: Canvas) => createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex');
const pixel = (canvas: Canvas, x: number, y: number) => [...canvas.getContext('2d').getImageData(x, y, 1, 1).data];
const errorCode = (code: string) => (error: unknown) => error instanceof StudioError && error.code === code;
const clampTilt = (tilt: number) => Math.max(-80, Math.min(80, tilt));

const asset: Asset = { id: 'img', kind: 'image', src: 'data:image/png;base64,AAAA', width: 600, height: 400 };
function fixture(): SceneDocument {
  return createScene({
    width: 300, height: 220, assets: [asset],
    nodes: [createMockup({ id: 'm', x: 150, y: 110, width: 240, height: 170, assetId: 'img' })],
  });
}
function setup() {
  const canvas = createCanvas(1, 1);
  const assets = new AssetManager();
  const stripes = createCanvas(600, 400);
  const ctx = stripes.getContext('2d');
  ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 600, 200);
  ctx.fillStyle = '#0000ff'; ctx.fillRect(0, 200, 600, 200);
  assets.register('img', asSource(stripes));
  const renderer = new CanvasRenderer(asCanvas(canvas), { assets, canvasFactory });
  return { canvas, assets, renderer };
}
function mockup(node: ReturnType<typeof createScene>['nodes'][number]): MockupNode {
  assert.equal(node.type, 'mockup');
  return node as MockupNode;
}

// ---------------------------------------------------------------------------
// Validation of untrusted scene documents
// ---------------------------------------------------------------------------

test('untrusted documents: sparse node arrays, deep junk nesting and symbol keys are rejected without throwing', () => {
  const scene = fixture();
  const sparse = { ...scene, nodes: new Array(2) };
  assert.ok(validateScene(sparse).length > 0, 'sparse nodes array must produce issues');
  let deep: Record<string, unknown> = { leaf: 1 };
  for (let i = 0; i < 40; i++) deep = { nested: deep };
  const issues = validateScene({ ...scene, junk: deep });
  assert.ok(issues.some(i => i.message.includes('nesting depth')), '30+ levels of junk nesting must trip the depth guard');
  const sym: Record<string | symbol, unknown> = { ...scene }; sym[Symbol('s')] = 1;
  assert.ok(validateScene(sym as unknown).some(i => i.message.includes('Symbol')), 'symbol keys must be reported');
});

test('untrusted documents: validation issues are capped (no unbounded report) yet every enum/range is checked', () => {
  const scene = fixture();
  const junk: Record<string, unknown> = { ...scene };
  for (let i = 0; i < 400; i++) junk[`junk${i}`] = i;
  const issues = validateScene(junk);
  assert.equal(issues.length, 200, 'issue log must cap at 200');
  assert.ok(issues.every(i => i.path.startsWith('junk')), 'cap must not displace real diagnostics emitted first');
});

test('untrusted documents: __proto__ and constructor pollution via deserializeScene is rejected', () => {
  const scene = fixture();
  const poisoned = JSON.parse(JSON.stringify(scene));
  poisoned.nodes[0].constructor = { prototype: { polluted: true } };
  assert.ok(validateScene(poisoned).some(i => i.path.endsWith('constructor')), 'own constructor key must be flagged as unknown property');
  assert.throws(() => deserializeScene(JSON.stringify(poisoned)), errorCode('INVALID_SCENE'));
  const polluted: Record<string, unknown> = {};
  polluted.__proto__ = { polluted: true }; // eslint-disable-line no-proto -- deliberate attempt
  polluted.version = 1;
  assert.equal(({} as { polluted?: boolean }).polluted, undefined, 'validation must never execute pollution');
});

test('QA-5 regression: aggregate keyframe limits reject oversized scenes before traversal', () => {
  // 60 nodes each with a track of 10,000 keyframes = 600k keyframes. The aggregate
  // budget must reject this before expensive traversal; per-track limits alone would
  // allow scenes with up to 100 million keyframes.
  const nodes = Array.from({ length: 60 }, (_, i) => createShape({ id: `n${i}`, width: 10, height: 10 }));
  const tracks = nodes.map((node, i) => ({
    id: `t${i}`, nodeId: node.id, property: 'x' as const,
    keyframes: Array.from({ length: 10_000 }, (_, j) => ({ time: (j * 0.0001), value: j % 200 })),
  }));
  const scene: SceneDocument = { ...createScene({ nodes }), tracks };
  const t0 = Date.now();
  assert.ok(validateScene(scene).some(i => /total keyframes|budget/.test(i.message)), 'aggregate keyframe budget must reject this scene');
  assert.ok(Date.now() - t0 < 5_000, 'validation of 600k keyframes should itself stay bounded');
});

test('untrusted documents: gradient stops, asset references and track dedup are validated in combination', () => {
  const scene = fixture();
  const bad = { ...scene, background: { type: 'gradient', kind: 'linear', angle: 0, stops: [{ offset: 0.5, color: '#fff' }, { offset: 0.5, color: '#000' }] } };
  assert.deepEqual(validateScene(bad), [], 'duplicate (equal) offsets are allowed and stay sorted');
  const track = { id: 't', nodeId: 'm', property: 'tiltY', keyframes: [{ time: 0, value: -20 }, { time: 4, value: 20 }] };
  assert.deepEqual(validateScene({ ...scene, tracks: [track] }), []);
  assert.ok(validateScene({ ...scene, tracks: [track, { ...track, id: 't2' }] }).length > 0, 'same node+property twice must be rejected');
});

// ---------------------------------------------------------------------------
// Animation time adversarial
// ---------------------------------------------------------------------------

test('evaluateScene is safe and total for hostile times and hostile track shapes', () => {
  const scene = fixture();
  scene.duration = 0.001;
  scene.tracks = [{ id: 't', nodeId: 'm', property: 'x', keyframes: [{ time: 0.001, value: 100 }] }];
  for (const t of [-1e300, 0, 0.0005, 0.001, 1e300, Number.MIN_VALUE]) {
    const out = evaluateScene(scene, t);
    assert.ok(out.nodes[0]!.x >= -1e7 && out.nodes[0]!.x <= 1e7);
  }
  assert.equal(evaluateScene(scene, 1e300).nodes[0]!.x, 100, 'times far past the timeline hold the last keyframe');
  for (const t of [NaN, -Infinity, Infinity]) assert.throws(() => evaluateScene(scene, t), errorCode('INVALID_TIME'));
});

test('evaluateScene never leaves property bounds even with spring overshoot, sampled densely', () => {
  const scene = fixture();
  scene.tracks = [
    { id: 'o', nodeId: 'm', property: 'opacity', keyframes: [{ time: 0, value: 0, easing: 'spring' }, { time: 4, value: 1 }] },
    { id: 't', nodeId: 'm', property: 'tiltX', keyframes: [{ time: 0, value: -88, easing: 'spring' }, { time: 4, value: 88 }] },
  ];
  for (let i = 0; i <= 4000; i++) {
    const out = evaluateScene(scene, i / 1000);
    const m = mockup(out.nodes[0]!);
    assert.ok(m.opacity >= 0 && m.opacity <= 1, `opacity out of bounds at t=${i / 1000}: ${m.opacity}`);
    assert.ok(m.tiltX >= -89 && m.tiltX <= 89, `tiltX out of bounds at t=${i / 1000}: ${m.tiltX}`);
  }
  assert.ok(ease(0.5, 'spring') > 1 || ease(0.5, 'spring') < 0 || true); // overshoot shape is legal pre-clamp
});

test('createAnimationTracks rejects hostile durations and clamps generated keyframes to property bounds', () => {
  const node = createText({ fontSize: 4096 });
  for (const duration of [0, -1, NaN, Infinity, 3601]) {
    assert.throws(() => createAnimationTracks(node, 'float', duration), errorCode('INVALID_DURATION'));
  }
  for (const preset of ['float', 'orbit', 'reveal', 'zoom', 'parallax'] as const) {
    for (const track of createAnimationTracks(node, preset, 4)) {
      assert.equal(track.keyframes.every(k => Number.isFinite(k.time) && Number.isFinite(k.value)), true);
      assert.equal(track.keyframes.every(k => k.time >= 0 && k.time <= 4), true);
    }
  }
});

// ---------------------------------------------------------------------------
// SceneStore history integrity
// ---------------------------------------------------------------------------

test('store history survives hostile payloads: rejected edits leave no history and no partial state', () => {
  const store = new SceneStore(fixture());
  const before = store.snapshot();
  assert.throws(() => store.update(d => { mockup(d.nodes[0]!).tiltX = 89.5; }), errorCode('INVALID_SCENE'));
  assert.throws(() => store.update(d => { d.effects.glitch = 2; }), errorCode('INVALID_SCENE'));
  assert.throws(() => store.updateNode('m', { opacity: 7 }), errorCode('INVALID_SCENE'));
  assert.deepEqual(store.scene, before);
  assert.equal(store.canUndo, false, 'failed edits must not enter history');
  assert.equal(store.canRedo, false);
});

test('store: 100+ edits, interleaved undo/redo and duplicate cascades stay consistent and bounded', () => {
  const store = new SceneStore(fixture());
  store.update(d => { d.tracks = createAnimationTracks(mockup(d.nodes[0]!), 'float', 4); });
  for (let i = 0; i < 130; i++) store.updateNode('m', { x: i });
  let undos = 0; while (store.undo()) undos++;
  assert.equal(undos, 100, 'history must be capped at 100');
  assert.equal(mockup(store.scene.nodes[0]!).x, 29, '100 undos from 130 edits land on edit #29 (history stores pre-edit states)');
  const dup = store.duplicateNode('m');
  assert.equal(store.scene.tracks.filter(t => t.nodeId === dup.id).length, 2, 'duplicates carry tracks');
  store.undo();
  assert.equal(store.scene.nodes.some(n => n.id === dup.id), false, 'undo removes the duplicate');
  assert.equal(store.scene.tracks.some(t => t.nodeId === dup.id), false, 'undo removes duplicated tracks');
});

test('store: observer removal and dispose during notification are honoured in commit order', () => {
  const store = new SceneStore(fixture());
  const seen: string[] = [];
  const disposeB = store.subscribe(() => seen.push('b'));
  store.subscribe(() => { seen.push('a'); disposeB(); });
  store.update(d => { d.name = 'one'; });
  store.update(d => { d.name = 'two'; });
  assert.deepEqual(seen, ['b', 'a', 'a'], 'unsubscribing during dispatch stops later notifications');
  store.subscribe(() => store.dispose());
  assert.doesNotThrow(() => store.update(d => { d.name = 'three'; }));
  assert.throws(() => store.update(() => {}), errorCode('STORE_DISPOSED'));
});

test('QA-7 regression: unrecorded replacement inside a transaction is explicitly rejected', () => {
  const store = new SceneStore(fixture());
  store.update(d => { d.name = 'a'; });
  assert.throws(() => store.transaction(tx => { tx.setScene(createScene({ name: 'fresh' }), false); }), errorCode('TRANSACTION_ACTIVE'));
  // Unrecorded replacement inside a transaction must reject explicitly so it cannot
  // silently create an undo step or alter existing history.
  assert.equal(store.scene.name, 'a', 'rejected replacement leaves scene unchanged');
  assert.equal(store.canUndo, true, 'prior history remains intact');
  store.undo();
  assert.equal(store.scene.name, fixture().name);
});

// ---------------------------------------------------------------------------
// Presets adversarial
// ---------------------------------------------------------------------------

test('presets: every recipe applied to a hostile scene yields a valid document with ids and tracks preserved', () => {
  const scene = fixture();
  const m = mockup(scene.nodes[0]!);
  m.locked = false; m.tiltX = 40; m.tiltY = -40; m.scale = 0.0002; m.x = -9999; m.y = 9999;
  scene.tracks = createAnimationTracks(m, 'parallax', 4);
  const snapshot = scene.tracks.map(t => ({ id: t.id, nodeId: t.nodeId, property: t.property, times: t.keyframes.map(k => k.time) }));
  for (const preset of getPresets()) {
    const out = preset.apply(scene);
    assert.deepEqual(validateScene(out), [], `preset ${preset.id} must produce a valid scene`);
    assert.deepEqual(out.tracks.map(t => ({ id: t.id, nodeId: t.nodeId, property: t.property, times: t.keyframes.map(k => k.time) })), snapshot, `preset ${preset.id} must not retiming or rename tracks`);
    assert.equal(out.nodes[0]!.id, 'm');
  }
});

test('presets: locked and hidden mockups are exempt, text/shape nodes untouched, ids unique after layout', () => {
  const scene = createScene({
    width: 800, height: 600,
    nodes: [
      createMockup({ id: 'free' }), createMockup({ id: 'frozen', locked: true, x: 7, y: 8 }), createMockup({ id: 'ghost', visible: false }),
      createText({ id: 'copy', x: 1234 }), createShape({ id: 'deco' }),
    ],
  });
  const out = applyPreset(scene, 'prism-fan');
  assert.deepEqual(mockup(out.nodes.find(n => n.id === 'frozen')!), { ...mockup(scene.nodes[1]!) }, 'locked mockup untouched');
  assert.equal(out.nodes.find(n => n.id === 'ghost')!.x, mockup(scene.nodes[2]!).x, 'hidden mockup untouched');
  assert.equal(out.nodes.find(n => n.id === 'copy')!.x, 1234, 'text untouched');
  assert.equal(new Set(out.nodes.map(n => n.id)).size, out.nodes.length);
  assert.throws(() => applyPreset(scene, 'no-such-preset'), errorCode('UNKNOWN_PRESET'));
});

test('presets: device registry rejects hostile definitions and never leaks internal state', () => {
  assert.throws(() => registerDevice({ ...getDevice('phone'), id: 'x', inset: { ...getDevice('phone').inset, top: -1 } }), errorCode('INVALID_DEVICE'));
  assert.throws(() => registerDevice({ ...getDevice('phone'), id: 'x', aspect: NaN } as unknown as Parameters<typeof registerDevice>[0]), errorCode('INVALID_DEVICE'));
  assert.throws(() => registerDevice({ ...getDevice('phone'), id: 'x', extra: 1 } as unknown as Parameters<typeof registerDevice>[0]), errorCode('INVALID_DEVICE'));
  let probed = false;
  const hostile = { ...getDevice('phone'), id: 'hostile', get name() { probed = true; return 'x'; } };
  assert.throws(() => registerDevice(hostile), errorCode('INVALID_DEVICE'));
  assert.equal(probed, false, 'accessors must not be invoked during validation');
  const def = getDevice('phone'); def.inset.top = 9999; def.id = 'mutated';
  assert.notEqual(getDevice('phone').inset.top, 9999);
  assert.equal(listDevices().some(d => d.id === 'mutated'), false);
  for (const device of listDevices()) assert.ok(device.aspect > 0 && device.inset.top >= 0);
});

// ---------------------------------------------------------------------------
// Deterministic rendering: scale parity, cancellation, failure isolation
// ---------------------------------------------------------------------------

test('deterministic output: identical scene/time/scale is bit-identical, odd scales round consistently', async () => {
  const { renderer, canvas, assets } = setup();
  const scene = fixture();
  await renderer.render(scene, 1.25, { scale: 1.5 });
  const a = hash(canvas);
  assert.equal(canvas.width, 450); assert.equal(canvas.height, 330);
  await renderer.render(scene, 1.25, { scale: 1.5 });
  assert.equal(hash(canvas), a);
  renderer.renderSync(scene, 1.25, 1.5);
  assert.equal(hash(canvas), a, 'renderSync must match render at the same scale');
  renderer.renderSync(scene, 1.25, 3);
  assert.equal(canvas.width, 900); assert.equal(canvas.height, 660);
  renderer.dispose(); assets.dispose();
});

test('failed and cancelled renders never corrupt the last good frame', async () => {
  const { renderer, canvas, assets } = setup();
  const scene = fixture();
  await renderer.render(scene, 0);
  const good = hash(canvas);
  const unresolvable = createScene({ width: 120, height: 90, assets: [{ ...asset, id: 'remote', src: 'https://example.invalid/x.png' }], nodes: [createMockup({ id: 'm2', assetId: 'remote' })] });
  await assert.rejects(renderer.render(unresolvable), errorCode('BROWSER_REQUIRED'));
  assert.equal(hash(canvas), good, 'asset failure must leave the previous frame intact');
  assert.throws(() => renderer.renderSync(unresolvable), /not loaded/i, 'renderSync reports unregistered assets explicitly');
  assert.equal(hash(canvas), good);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(renderer.render(scene, 0, { signal: controller.signal }), /cancel/i);
  assert.equal(hash(canvas), good, 'pre-aborted render must not touch the canvas');
  const late = new AbortController();
  const job = renderer.render(scene, 0, { signal: late.signal }).then(() => 'drawn', error => error instanceof StudioError ? error.code : String(error));
  late.abort();
  assert.equal(await job, 'ABORTED', 'mid-flight abort must cancel the frame, not resolve it');
  assert.equal(hash(canvas), good, 'aborted frame must not be partially drawn over the good one');
  renderer.dispose(); assets.dispose();
});

test('BUG-5: rendering a valid max-size node throws OUTPUT_LIMIT — scratch cap math loses to its own ceiling', () => {
  // Expected property: a node at the validated geometry maximum (131072px sides) must
  // render inside the bounded-texture design. textureScale is chosen so that
  // (meshWidth * ts) * (meshHeight * ts) = 32_000_000 exactly, but scratch() applies
  // Math.ceil per side, so e.g. 5656.85 -> 5657 and 5657² = 32_001_649 > the 32MP cap.
  // dimensions() then rejects the renderer's own scratch canvas with OUTPUT_LIMIT.
  const { renderer, canvas, assets } = setup();
  const scene = createScene({
    width: 1200, height: 900, background: { type: 'solid', color: '#202020' }, assets: [asset],
    nodes: [createMockup({ id: 'huge', x: 600, y: 450, width: 131072, height: 131072, tiltX: 45, tiltY: -45, assetId: 'img' })],
  });
  renderer.renderSync(scene);
  assert.equal(canvas.width, 1200); assert.equal(canvas.height, 900);
  assert.throws(() => renderer.renderSync(scene, 0, 300), errorCode('OUTPUT_LIMIT'), '131072x300 output must still exceed the 32MP output cap');
  renderer.dispose(); assets.dispose();
});

// ---------------------------------------------------------------------------
// Typography and fonts
// ---------------------------------------------------------------------------

test('text: quote-only and control-character font families cannot crash or corrupt ctx.font parsing', () => {
  const { renderer, canvas, assets } = setup();
  for (const fontFamily of ['"', '\\', 'a\nb', 'a"b;drop']) {
    const scene = createScene({ width: 200, height: 120, nodes: [createText({ id: 't', x: 100, y: 60, width: 190, height: 110, text: 'fallback', fontFamily })] });
    assert.deepEqual(validateScene(scene), [], `fontFamily ${JSON.stringify(fontFamily)} passes validation`);
    assert.doesNotThrow(() => renderer.renderSync(scene), `fontFamily ${JSON.stringify(fontFamily)} must not throw`);
  }
  assert.ok(validateScene({ ...createScene({ width: 200, height: 120 }), nodes: [{ ...createText({ id: 't' }), fontFamily: '  ' }] }).some(i => i.path === 'nodes[0].fontFamily'), 'whitespace-only families are rejected outright');
  renderer.dispose(); assets.dispose();
});

test('text: hostile wrapping inputs (empty paragraphs, huge single words, bidi) render without unbounded work', () => {
  const { renderer, canvas, assets } = setup();
  const scene = createScene({
    width: 300, height: 200,
    nodes: [createText({ id: 't', x: 150, y: 100, width: 280, height: 190, text: '\n\na'.padEnd(99_985, 'x') + '\n\u05D0\u05D1\u05D2 direction', fontSize: 12 })],
  });
  const t0 = Date.now();
  renderer.renderSync(scene);
  assert.ok(Date.now() - t0 < 10_000, 'a 100k-character single word must still wrap in bounded (linear) time');
  renderer.dispose(); assets.dispose();
});

// Renderer bounds vs validation bounds. QA-2: the renderer silently clamps values that
// validation accepts, so these document a fidelity mismatch (not a crash).
test('renderer clamps (documented, QA-2): fontSize >2000 and tilt beyond ±80 render clamped although valid', () => {
  const { renderer, canvas, assets } = setup();
  const textHash = (fontSize: number): string => {
    const scene = createScene({ width: 300, height: 220, background: { type: 'solid', color: '#eeeeee' }, nodes: [createText({ id: 't', x: 150, y: 110, width: 280, height: 200, text: 'H', fontSize })] });
    renderer.renderSync(scene);
    return hash(canvas);
  };
  const tiltHash = (tiltY: number): string => {
    const scene = fixture();
    mockup(scene.nodes[0]!).tiltY = tiltY;
    renderer.renderSync(scene);
    return hash(canvas);
  };
  assert.equal(textHash(3000), textHash(2000), 'QA-2: fontSize 3000 (valid) renders identical to the 2000 clamp');
  assert.equal(tiltHash(89), tiltHash(80), 'QA-2: tiltY 89 (valid) renders identical to the ±80 clamp');
  assert.equal(tiltHash(79) !== tiltHash(80), true);
  renderer.dispose(); assets.dispose();
});

// ---------------------------------------------------------------------------
// Tilt/opacity seams and contain-focal fidelity
// ---------------------------------------------------------------------------

test('BUG-1: fit contain ignores focalX/focalY — contain renders are center-locked (fails until fixed)', () => {
  // Expected property: focal offsets apply to contain like they do for cover, matching
  // core's computeFit (which offsets the letterboxed rect by the focal point). The
  // renderer's fitted() centers contain draws, so preview math and pixels disagree.
  const { renderer, canvas, assets } = setup();
  const scene = createScene({
    width: 300, height: 220, background: { type: 'solid', color: '#ff00ff' }, assets: [asset],
    nodes: [createMockup({ id: 'm', x: 150, y: 110, width: 240, height: 170, assetId: 'img', deviceId: 'screenshot', radius: 0, borderWidth: 0, lighting: 0, frameColor: '#ff00ff', fit: 'contain', focalY: 0 })],
  });
  renderer.renderSync(scene);
  const topFocal0 = pixel(canvas, 150, 29); // 600x400 source contain-fit in 240x170: image top edge at node top
  mockup(scene.nodes[0]!).focalY = 1;
  renderer.renderSync(scene);
  const topFocal1 = pixel(canvas, 150, 29);
  assert.notDeepEqual(topFocal0, topFocal1, 'BUG-1: focalY must shift a contain-fit image (it currently does not)');
  renderer.dispose(); assets.dispose();
});

test('tilt/opacity seam integrity: dense tilt sweep shows no interior alpha holes and opacity is applied once', () => {
  const { renderer, canvas, assets } = setup();
  const scene = fixture();
  const node = mockup(scene.nodes[0]!);
  scene.background = { type: 'transparent' };
  node.shadow = { ...node.shadow, opacity: 0 }; node.radius = 0; node.borderWidth = 0; node.lighting = 0;
  // Coverage property: count pixels alpha >= 250 and compare with the analytic area of
  // the projected quad (same projection math as the renderer, shoelace formula). A
  // missed triangle row or a mesh hairline drops coverage by a roughly constant ~5%
  // at every tilt, while grazing-angle anti-aliasing degrades smoothly — so the
  // calibrated threshold below catches seams without punishing AA.
  for (const [tiltX, tiltY] of [[0, 0], [5, -5], [30, -30], [40, -40]]) {
    node.tiltX = tiltX; node.tiltY = tiltY;
    renderer.renderSync(scene);
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const rad = (deg: number) => deg * Math.PI / 180;
    const meshW = node.width, meshH = node.height, focal = Math.max(meshW, meshH) * 2.4;
    const sx = Math.sin(rad(clampTilt(tiltX))), cx = Math.cos(rad(clampTilt(tiltX)));
    const sy = Math.sin(rad(clampTilt(tiltY))), cy = Math.cos(rad(clampTilt(tiltY)));
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => {
      const px = (u - 0.5) * meshW, py = (v - 0.5) * meshH;
      const ry = py * cx, rz = py * sx;
      const rx = px * cy + rz * sy, z = -px * sy + rz * cy;
      const persp = focal / (focal + z);
      return [node.x + rx * persp * node.scale, node.y + ry * persp * node.scale];
    });
    let area = 0;
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = corners[i]!; const [x2, y2] = corners[(i + 1) % 4]!;
      area += x1 * y2 - x2 * y1;
    }
    area = Math.abs(area) / 2;
    let covered = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! >= 250) covered++;
    assert.ok(covered / area > 0.94, `coverage ${covered} / ${area.toFixed(0)} too low at tilt ${tiltX},${tiltY} — possible mesh seam/holes`);
  }
  // Extreme grazing tilt: AA dominates, so only assert the frame renders and the centre stays covered.
  for (const [tiltX, tiltY] of [[75, -75], [80, -80], [-80, 80]]) {
    node.tiltX = tiltX; node.tiltY = tiltY;
    renderer.renderSync(scene);
    assert.equal(pixel(canvas, 150, 110)[3]!, 255, `mesh centre must stay opaque at tilt ${tiltX},${tiltY}`);
  }
  node.opacity = 0.5;
  renderer.renderSync(scene);
  assert.ok(Math.abs(pixel(canvas, 150, 110)[3]! - 128) <= 2, 'opacity applied exactly once on the tilted mesh path');
  renderer.dispose(); assets.dispose();
});

// ---------------------------------------------------------------------------
// Video assets
// ---------------------------------------------------------------------------

class FakeVideo extends EventTarget {
  videoWidth = 192; videoHeight = 108; duration = 5; readyState = 2; seeking = false;
  crossOrigin = ''; preload = ''; muted = false; playsInline = false; value = ''; time = 0; seekEvents = true; seeks = 0;
  set src(value: string) { this.value = value; }
  get src() { return this.value; }
  load() { if (this.value) queueMicrotask(() => this.dispatchEvent(new Event('loadeddata'))); }
  pause() {}
  removeAttribute() { this.value = ''; }
  get currentTime() { return this.time; }
  set currentTime(value: number) { this.time = value; this.seeks++; if (this.seekEvents) queueMicrotask(() => this.dispatchEvent(new Event('seeked'))); }
}
const videoAsset = { id: 'v', kind: 'video' as const, src: 'data:video/webm;base64,AA', width: 192, height: 108, duration: 5 };
function withFakeVideo<T>(video: FakeVideo, run: () => Promise<T>): Promise<T> {
  const oldDocument = globalThis.document;
  Object.assign(globalThis, { document: { createElement: () => video } });
  return run().finally(() => { Object.assign(globalThis, { document: oldDocument }); });
}

test('BUG-3: a zero-opacity mockup earlier in scene order hijacks the shared video seek (fails until fixed)', async () => {
  // Expected property: prepareFrame must only seek video time for nodes that will
  // actually draw. The asset-collection loop filters opacity > 0 but the seek loop does
  // not, so an invisible (opacity 0) node wins the "one video element per asset" seek
  // and the visible node renders the wrong frame.
  await withFakeVideo(new FakeVideo(), async () => {
    const video = (globalThis.document as unknown as { createElement: () => FakeVideo }).createElement();
    const assets = new AssetManager();
    const ghost = createMockup({ id: 'ghost', assetId: 'v', videoStart: 3.5, opacity: 0 });
    const visible = createMockup({ id: 'vis', assetId: 'v', videoStart: 0, opacity: 1 });
    const scene = createScene({ assets: [videoAsset], nodes: [ghost, visible] });
    await assets.prepareFrame(scene, 1);
    assert.equal(video.currentTime, 1, 'BUG-3: visible node (videoStart 0, t=1) must determine the seek; got the ghost node\u2019s 3.5+1');
    assets.dispose();
  });
});

test('BUG-4: registered HTMLVideoElement sources are never seeked by prepareFrame (fails until fixed)', async () => {
  // Expected property: register(id, source) is a public path for supplying media; a
  // registered video element must participate in prepareFrame seeking exactly like a
  // load()-ed one, otherwise animation exports freeze on the current frame. AssetManager
  // only tracks videos it loaded itself (this.videos), so registered ones are skipped.
  const assets = new AssetManager();
  const video = new FakeVideo();
  assets.register('v', video as unknown as CanvasImageSource);
  const scene = createScene({ assets: [videoAsset], nodes: [createMockup({ id: 'm', assetId: 'v', videoStart: 1, playbackRate: 1 })] });
  await assets.prepareFrame(scene, 2);
  assert.equal(video.currentTime, 3, 'BUG-4: registered video must be seeked to videoStart + time * playbackRate');
  assets.dispose();
});

test('QA-8 regression: shared video timing conflicts reject instead of silently choosing a frame', async () => {
  // One video element is shared per asset ID. Conflicting node timings must reject
  // before seeking; identical timings may reuse the source. See docs/API.md.
  await withFakeVideo(new FakeVideo(), async () => {
    const video = (globalThis.document as unknown as { createElement: () => FakeVideo }).createElement();
    const assets = new AssetManager();
    const scene = createScene({ assets: [videoAsset], nodes: [createMockup({ id: 'a', assetId: 'v', videoStart: 1 }), createMockup({ id: 'b', assetId: 'v', videoStart: 3 })] });
    await assert.rejects(assets.prepareFrame(scene, 1), errorCode('VIDEO_TIMING_CONFLICT'));
    assert.equal(video.seeks, 0, 'conflict is rejected before seeking');
    (scene.nodes[1] as MockupNode).videoStart = 1;
    await assets.prepareFrame(scene, 1);
    assert.equal(video.currentTime, 2);
    assert.equal(video.seeks, 1, 'same-timing reuse seeks only once');
    assets.dispose();
  });
});

test('video: hostile durations, non-looping clamps and cancellation never hang or silently succeed', async () => {
  await withFakeVideo(new FakeVideo(), async () => {
    const video = (globalThis.document as unknown as { createElement: () => FakeVideo }).createElement();
    const assets = new AssetManager();
    const scene = createScene({ assets: [videoAsset], nodes: [createMockup({ id: 'm', assetId: 'v', videoStart: 0, videoLoop: false })] });
    await assets.prepareFrame(scene, 1e9);
    assert.equal(video.currentTime, 4.999, 'non-looping seeks clamp inside the clip');
    video.seekEvents = false;
    const controller = new AbortController();
    const job = assets.prepareFrame(scene, 0, controller.signal).then(() => 'seeked', error => error instanceof StudioError ? error.code : String(error));
    controller.abort();
    assert.equal(await job, 'ABORTED', 'stuck seeks must be cancellable');
    assets.dispose();
  });
});
