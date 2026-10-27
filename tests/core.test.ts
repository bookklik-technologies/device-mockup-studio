import test from 'node:test';
import assert from 'node:assert/strict';
import { assertScene, cloneScene, computeFit, createAnimationTracks, createMockup, createScene, createShape, createText, deserializeScene, ease, evaluateScene, SceneStore, serializeScene, StudioError, uid, validateScene } from '@bookklik/device-mockup-studio/core';
import type { SceneDocument, SceneNode } from '@bookklik/device-mockup-studio/core';

function fixture(): SceneDocument {
  return createScene({ id: 'project', assets: [{ id: 'photo', kind: 'image', src: 'data:image/png;base64,AAAA', width: 1200, height: 800 }], nodes: [createMockup({ id: 'mockup', assetId: 'photo' }), createText({ id: 'title' }), createShape({ id: 'shape' })] });
}
function hasIssue(input: unknown, path: string): void {
  const issues = validateScene(input);
  assert.ok(issues.some(issue => issue.path === path), `Expected ${path}, got ${JSON.stringify(issues)}`);
}
function errorCode(code: string): (error: unknown) => boolean { return error => error instanceof StudioError && error.code === code; }

test('factories have complete independent defaults and canonical discriminants', () => {
  const scene = fixture(); assert.deepEqual(validateScene(scene), []); assert.equal(scene.version, 1);
  assert.equal(createMockup().type, 'mockup'); assert.equal(createShape().type, 'shape'); assert.equal(createText().type, 'text');
  const a = createMockup(), b = createMockup(); a.shadow.blur = 9; assert.notEqual(a.id, b.id); assert.notEqual(a.shadow.blur, b.shadow.blur);
  const input = fixture(), output = createScene(input); output.nodes[0]!.x = -5; assert.notEqual(input.nodes[0]!.x, -5);
  assert.equal(new Set(Array.from({ length: 2000 }, () => uid())).size, 2000);
  assert.throws(() => createScene({ width: 0 }), errorCode('INVALID_SCENE'));
});

test('deep validation rejects malformed top-level primitives, dimensions, effects and background', () => {
  for (const input of [null, [], true, 2, 'scene']) hasIssue(input, '');
  const scene = fixture();
  for (const [property, invalid] of [['width', 0], ['height', 32769], ['duration', 0], ['fps', 241], ['seed', 0.5], ['version', 2], ['name', 4]] as const) hasIssue({ ...scene, [property]: invalid }, property);
  hasIssue({ ...scene, effects: { ...scene.effects, noise: 1.1 } }, 'effects.noise');
  hasIssue({ ...scene, effects: { ...scene.effects, saturation: -1 } }, 'effects.saturation');
  hasIssue({ ...scene, background: { type: 'gradient', kind: 'bad', angle: 0, stops: [{ offset: 0, color: '#fff' }, { offset: 1, color: '#000' }] } }, 'background.kind');
  hasIssue({ ...scene, background: { type: 'gradient', kind: 'linear', angle: 0, stops: [{ offset: 0.8, color: '#fff' }, { offset: 0.2, color: '#000' }] } }, 'background.stops[1].offset');
  hasIssue({ ...scene, background: { type: 'gradient', kind: 'linear', angle: 0, stops: [{ offset: 0, color: '#fff' }] } }, 'background.stops');
  hasIssue({ ...scene, background: { type: 'image', assetId: 'missing', fit: 'cover', blur: 0, dim: 0 } }, 'background.assetId');
  hasIssue({ ...scene, background: { type: 'solid', color: '' } }, 'background.color');
  hasIssue({ ...scene, background: { type: 'unrecognized' } }, 'background.type');
  hasIssue({ ...scene, background: { type: 'transparent', extra: 1 } }, 'background.extra');
  assert.deepEqual(validateScene({ ...scene, background: { type: 'transparent' } }), []);
});

test('nonfinite, cyclic, accessor and non-JSON values are rejected without invoking accessors', () => {
  for (const value of [NaN, Infinity, -Infinity]) hasIssue({ ...fixture(), width: value }, 'width');
  const circular: Record<string, unknown> = { ...fixture() }; circular.self = circular; hasIssue(circular, 'self');
  hasIssue({ ...fixture(), extension: new Date() }, 'extension');
  hasIssue({ ...fixture(), extra: () => 1 }, 'extra');
  hasIssue({ ...fixture(), nodes: [undefined] }, 'nodes[0]');
  let accessed = false; const input = { ...fixture() }; Object.defineProperty(input, 'name', { enumerable: true, get: () => { accessed = true; return 'bad'; } });
  hasIssue(input, 'name'); assert.equal(accessed, false);
  hasIssue(JSON.parse(serializeScene(fixture()).replace('"version": 1', '"__proto__": {}, "version": 1')) as unknown, '__proto__');
});

test('cross references, duplicate identifiers and open device identifiers', () => {
  const scene = fixture(), node = scene.nodes[0]!;
  hasIssue({ ...scene, nodes: [node, node] }, 'nodes[1].id');
  hasIssue({ ...scene, nodes: [{ ...node, id: 'photo' }] }, 'nodes[0].id');
  hasIssue({ ...scene, nodes: [{ ...node, assetId: 'gone' }] }, 'nodes[0].assetId');
  hasIssue({ ...scene, nodes: [{ ...node, deviceId: '' }] }, 'nodes[0].deviceId');
  assert.deepEqual(validateScene({ ...scene, nodes: [{ ...node, deviceId: 'vendor:custom-tabletop-v2' }] }), []);
  hasIssue({ ...scene, assets: [{ ...scene.assets[0]!, kind: 'sound' }] }, 'assets[0].kind');
  hasIssue({ ...scene, assets: [{ ...scene.assets[0]!, width: -1 }] }, 'assets[0].width');
  hasIssue({ ...scene, assets: [{ ...scene.assets[0]!, kind: 'video' }], background: { type: 'image', assetId: 'photo', fit: 'cover', blur: 0, dim: 0 } }, 'background.assetId');
});

test('all node variants validate nested properties, enum values and ranges', () => {
  const scene = fixture(), mockup = createMockup({ id: 'node' });
  const bad = (patch: Record<string, unknown>, path: string): void => hasIssue({ ...scene, nodes: [{ ...mockup, ...patch }] }, `nodes[0].${path}`);
  for (const [property, value] of [['scale', 0], ['opacity', 1.1], ['tiltX', 90], ['width', -1], ['visible', 1], ['fit', 'invalid-fit'], ['style', 'fake'], ['focalX', 2], ['radius', -1], ['lighting', 2], ['playbackRate', 0], ['videoLoop', 'yes']] as const) bad({ [property]: value }, property);
  bad({ shadow: { ...mockup.shadow, opacity: 2 } }, 'shadow.opacity');
  bad({ shadow: { ...mockup.shadow, blur: -2 } }, 'shadow.blur');
  bad({ shadow: null }, 'shadow');
  bad({ borderColor: '' }, 'borderColor');
  bad({ type: 'group' }, 'type');
  hasIssue({ ...scene, nodes: [{ ...createText({ id: 'node' }), align: 'justify' }] }, 'nodes[0].align');
  hasIssue({ ...scene, nodes: [{ ...createText({ id: 'node' }), fontSize: 0 }] }, 'nodes[0].fontSize');
  hasIssue({ ...scene, nodes: [{ ...createShape({ id: 'node' }), shape: 'star' }] }, 'nodes[0].shape');
  hasIssue({ ...scene, nodes: [{ ...createShape({ id: 'node' }), strokeWidth: -1 }] }, 'nodes[0].strokeWidth');
});

test('track validation checks references, ordering, time bounds, easing and property bounds', () => {
  const scene = fixture(); const track = { id: 'track', nodeId: 'mockup', property: 'x', keyframes: [{ time: 0, value: 0 }, { time: 4, value: 100 }] };
  assert.deepEqual(validateScene({ ...scene, tracks: [track] }), []);
  const bad = (patch: Record<string, unknown>, path: string): void => hasIssue({ ...scene, tracks: [{ ...track, ...patch }] }, `tracks[0].${path}`);
  bad({ nodeId: 'missing' }, 'nodeId'); bad({ property: 'blur' }, 'property'); bad({ keyframes: [] }, 'keyframes');
  bad({ keyframes: [{ time: 4.1, value: 0 }] }, 'keyframes[0].time');
  bad({ keyframes: [{ time: 1, value: 0 }, { time: 1, value: 2 }] }, 'keyframes[1].time');
  bad({ property: 'opacity', keyframes: [{ time: 0, value: 1.1 }] }, 'keyframes[0].value');
  bad({ keyframes: [{ time: 0, value: 2, easing: 'cubic' }] }, 'keyframes[0].easing');
  hasIssue({ ...scene, tracks: [track, { ...track, id: 'second' }] }, 'tracks[1]');
});

test('serialization round trips, clones, and explicitly rejects unsupported versions', () => {
  const scene = fixture(), json = serializeScene(scene), parsed = deserializeScene(json);
  assert.deepEqual(parsed, scene); parsed.nodes[0]!.x = -9; assert.notEqual(parsed.nodes[0]!.x, scene.nodes[0]!.x);
  const clone = cloneScene(scene); clone.assets[0]!.src = 'elsewhere'; assert.notEqual(clone.assets[0]!.src, scene.assets[0]!.src);
  for (const version of [0, 2, '1', undefined]) assert.throws(() => deserializeScene(JSON.stringify({ ...scene, version })), errorCode('UNSUPPORTED_VERSION'));
  assert.throws(() => deserializeScene('{'), errorCode('INVALID_JSON'));
  assert.throws(() => deserializeScene('{}'), errorCode('UNSUPPORTED_VERSION'));
  assert.throws(() => assertScene({}), errorCode('INVALID_SCENE'));
});

test('deterministic seconds evaluator clamps time and interpolates outgoing easing', () => {
  const scene = fixture(); scene.tracks = [{ id: 'track', nodeId: 'mockup', property: 'x', keyframes: [{ time: 1, value: 10, easing: 'ease-in' }, { time: 3, value: 110 }] }];
  assert.equal(evaluateScene(scene, -10).nodes[0]!.x, 10); assert.equal(evaluateScene(scene, 2).nodes[0]!.x, 35); assert.equal(evaluateScene(scene, 99).nodes[0]!.x, 110);
  assert.equal(evaluateScene(scene, 3).nodes[0]!.x, 110); assert.deepEqual(evaluateScene(scene, 1.5), evaluateScene(scene, 1.5)); assert.equal(scene.nodes[0]!.x, 600);
  for (const t of [NaN, Infinity]) assert.throws(() => evaluateScene(scene, t), errorCode('INVALID_TIME'));
  scene.tracks[0]!.keyframes = [{ time: 0, value: 22 }]; assert.equal(evaluateScene(scene, 3).nodes[0]!.x, 22);
  for (const easing of ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring'] as const) { assert.equal(ease(0, easing), 0); assert.equal(ease(1, easing), 1); assert.ok(Number.isFinite(ease(0.6, easing))); }
  assert.equal(ease(0.5, 'linear'), 0.5); assert.equal(ease(0.5, 'ease-out'), 0.75);
});

test('all animation presets produce valid finite bounded tracks and evaluate without mutation', () => {
  for (const preset of ['float', 'orbit', 'reveal', 'zoom', 'parallax'] as const) {
    const scene = fixture(); scene.tracks = createAnimationTracks(scene.nodes[0]!, preset, scene.duration); assertScene(scene);
    const before = serializeScene(scene);
    for (let t = 0; t <= scene.duration; t += 0.125) assertScene(evaluateScene(scene, t));
    assert.equal(serializeScene(scene), before);
  }
  const scene = fixture(); scene.tracks = [{ id: 'track', nodeId: 'mockup', property: 'opacity', keyframes: [{ time: 0, value: 0, easing: 'spring' }, { time: 4, value: 1 }] }];
  assert.ok(evaluateScene(scene, 1.2).nodes[0]!.opacity <= 1);
  assert.throws(() => createAnimationTracks(scene.nodes[0]!, 'float', 0), errorCode('INVALID_DURATION'));
  assert.throws(() => createAnimationTracks(scene.nodes[0]!, 'nope' as 'float', 4), errorCode('UNKNOWN_ANIMATION'));
});

test('fit math computes cover crops and contain letterboxing without mutation', () => {
  assert.deepEqual(computeFit(200, 100, 100, 100), { sx: 50, sy: 0, sw: 100, sh: 100, dx: 0, dy: 0, dw: 100, dh: 100 });
  assert.deepEqual(computeFit(200, 100, 100, 100, 'contain'), { sx: 0, sy: 0, sw: 200, sh: 100, dx: 0, dy: 25, dw: 100, dh: 50 });
  assert.equal(computeFit(200, 100, 100, 100, 'cover', 1).sx, 100);
  assert.throws(() => computeFit(0, 10, 100, 100), errorCode('INVALID_FIT'));
});

test('store snapshots, retained drafts, listeners and caller nodes cannot mutate internal state', () => {
  const scene = fixture(), store = new SceneStore(scene); scene.name = 'mutated'; assert.notEqual(store.scene.name, scene.name);
  const snapshot = store.snapshot(); snapshot.nodes[0]!.x = -20; assert.equal(store.scene.nodes[0]!.x, 600);
  let retained: SceneDocument | undefined; store.update(draft => { retained = draft; draft.name = 'Edited'; }); retained!.name = 'Escaped'; assert.equal(store.scene.name, 'Edited');
  const observed: string[] = []; store.subscribe(next => { next.name = 'poison'; }); store.subscribe(next => { observed.push(next.name); });
  store.update(draft => { draft.name = 'Safe'; }); assert.deepEqual(observed, ['Safe']); assert.equal(store.scene.name, 'Safe');
  const added = createText(); store.addNode(added); added.text = 'outside'; assert.notEqual((store.scene.nodes.at(-1)! as ReturnType<typeof createText>).text, 'outside');
  store.subscribe(() => { throw new Error('observer'); }); assert.doesNotThrow(() => store.update(draft => { draft.name = 'Committed'; }));
});

test('store validates atomically, supports undo/redo and drops redo after new edits', () => {
  const store = new SceneStore(fixture()), original = store.snapshot();
  assert.equal(store.canUndo, false); assert.equal(store.undo(), false); assert.equal(store.redo(), false);
  assert.throws(() => store.update(draft => { draft.width = 0; }), errorCode('INVALID_SCENE')); assert.deepEqual(store.scene, original); assert.equal(store.canUndo, false);
  assert.throws(() => store.update(draft => { draft.name = 'uncommitted'; throw new Error('abort'); }), /abort/); assert.deepEqual(store.scene, original);
  store.update(draft => { draft.name = 'one'; }); store.update(draft => { draft.name = 'two'; }); assert.equal(store.canUndo, true);
  assert.equal(store.undo(), true); assert.equal(store.scene.name, 'one'); assert.equal(store.canRedo, true); assert.equal(store.redo(), true); assert.equal(store.scene.name, 'two');
  store.undo(); store.update(draft => { draft.name = 'three'; }); assert.equal(store.canRedo, false);
  const history = store.canUndo; store.update(() => {}); assert.equal(store.canUndo, history);
  store.setScene(createScene(), false); assert.equal(store.canUndo, false); assert.equal(store.canRedo, false);
});

test('store history is bounded to the latest 100 edits', () => {
  const store = new SceneStore(fixture()); for (let i = 0; i < 125; i++) store.update(draft => { draft.name = `edit-${i}`; });
  let count = 0; while (store.undo()) count++; assert.equal(count, 100); assert.equal(store.scene.name, 'edit-24');
  while (store.redo()) count--; assert.equal(count, 0); assert.equal(store.scene.name, 'edit-124');
});

test('store node mutations preserve references; duplicate animates independently; remove cascades', () => {
  const initial = fixture(); initial.tracks = createAnimationTracks(initial.nodes[0]!, 'float', 4);
  const store = new SceneStore(initial), duplicate = store.duplicateNode('mockup');
  assert.notEqual(duplicate.id, 'mockup'); assert.equal((duplicate as Extract<SceneNode, { type: 'mockup' }>).assetId, 'photo');
  assert.equal(store.scene.tracks.filter(track => track.nodeId === duplicate.id).length, 2);
  duplicate.x = -8; assert.notEqual(store.scene.nodes.find(node => node.id === duplicate.id)!.x, -8);
  store.updateNode('mockup', { x: 120 }); assert.equal(store.scene.nodes[0]!.x, 120);
  assert.throws(() => store.updateNode('mockup', { id: 'bad' }), errorCode('IMMUTABLE_NODE_ID'));
  assert.throws(() => store.updateNode('mockup', { type: 'text' }), errorCode('IMMUTABLE_NODE_TYPE'));
  assert.throws(() => store.updateNode('missing', { x: 1 }), errorCode('NODE_NOT_FOUND'));
  assert.throws(() => store.duplicateNode('missing'), errorCode('NODE_NOT_FOUND'));
  store.removeNode('mockup'); assert.equal(store.scene.tracks.some(track => track.nodeId === 'mockup'), false); assert.equal(store.scene.nodes.some(node => node.id === duplicate.id), true); assert.equal(store.scene.assets.length, 1);
  store.undo(); assert.equal(store.scene.nodes.some(node => node.id === 'mockup'), true);
});

test('transactions group history and notifications, nested savepoints and failure rollback', () => {
  const store = new SceneStore(fixture()); let notifications = 0; const dispose = store.subscribe(() => { notifications++; });
  store.transaction(tx => { tx.update(draft => { draft.name = 'group'; }); tx.updateNode('mockup', { x: 90 }); });
  assert.equal(notifications, 1); assert.equal(store.scene.name, 'group'); store.undo(); assert.equal(store.canUndo, false); assert.equal(store.scene.nodes[0]!.x, 600); store.redo();
  const before = store.scene;
  assert.throws(() => store.transaction(tx => { tx.update(draft => { draft.name = 'rollback'; }); tx.update(draft => { draft.width = -1; }); }), errorCode('INVALID_SCENE')); assert.deepEqual(store.scene, before);
  store.transaction(tx => { tx.update(draft => { draft.name = 'outer'; }); assert.throws(() => tx.transaction(inner => { inner.update(draft => { draft.name = 'inner'; }); throw new Error('nested'); }), /nested/); tx.updateNode('mockup', { y: 42 }); });
  assert.equal(store.scene.name, 'outer'); assert.equal(store.scene.nodes[0]!.y, 42);
  assert.throws(() => store.transaction(tx => { tx.undo(); }), errorCode('TRANSACTION_ACTIVE'));
  dispose(); const count = notifications; store.update(draft => { draft.name = 'no observer'; }); assert.equal(notifications, count);
  store.dispose(); assert.equal(store.canUndo, false); assert.throws(() => store.update(() => {}), errorCode('STORE_DISPOSED')); assert.throws(() => store.subscribe(() => {}), errorCode('STORE_DISPOSED')); assert.doesNotThrow(() => store.dispose());
});

test('store rejects nested writes from draft mutators and queues observer edits in commit order', () => {
  const store = new SceneStore(fixture()), before = store.scene;
  assert.throws(() => store.update(draft => { draft.name = 'discarded'; store.updateNode('mockup', { x: 5 }); }), errorCode('REENTRANT_MUTATION'));
  assert.deepEqual(store.scene, before); assert.equal(store.canUndo, false);
  const events: string[] = [];
  store.subscribe(next => { events.push(`first:${next.name}`); if (next.name === 'one') store.update(draft => { draft.name = 'two'; }); });
  store.subscribe(next => { events.push(`second:${next.name}`); });
  store.update(draft => { draft.name = 'one'; });
  assert.deepEqual(events, ['first:one', 'second:one', 'first:two', 'second:two']); assert.equal(store.scene.name, 'two');
});

test('metadata cloning preserves immutable payloads, deep independence and hostile descriptors for validation', async () => {
  const { copy } = await import('../packages/core/src/utils.js');
  const shared = { mutable: { value: 1 }, source: `data:image/png;base64,${'A'.repeat(2 * 1024 * 1024)}` };
  const original: Record<string, unknown> = { first: shared, second: shared, invalid: NaN };
  original.self = original;
  Object.defineProperty(original, '__proto__', { value: { polluted: true }, enumerable: true });
  let calls = 0;
  Object.defineProperty(original, 'accessor', { enumerable: true, get: () => { calls++; throw new Error('must not run'); } });
  const cloned = copy(original);
  assert.notEqual(cloned, original); assert.equal(cloned.self, cloned); assert.equal(cloned.first, cloned.second);
  assert.notEqual(cloned.first, shared); assert.equal((cloned.first as typeof shared).source, shared.source);
  (cloned.first as typeof shared).mutable.value = 9; assert.equal(shared.mutable.value, 1);
  assert.ok(Number.isNaN(cloned.invalid)); assert.equal(calls, 0);
  assert.equal(Object.getPrototypeOf(cloned), Object.prototype); assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(cloned, '__proto__'), true);
  assert.equal(Object.getOwnPropertyDescriptor(cloned, 'accessor')!.get, Object.getOwnPropertyDescriptor(original, 'accessor')!.get);
  const frozen = copy(Object.freeze({ nested: Object.freeze({ value: 1 }) })) as { nested: { value: number } }; frozen.nested.value = 2;
  assert.equal(frozen.nested.value, 2);
  const sparse = copy(new Array(2) as unknown[]); assert.equal(sparse.length, 2); assert.equal(0 in sparse, false);

  const scene = fixture(); scene.tracks = createAnimationTracks(scene.nodes[0]!, 'float', 4);
  const clone = cloneScene(scene);
  (clone.nodes[0]! as ReturnType<typeof createMockup>).shadow.blur = 99;
  clone.tracks[0]!.keyframes[0]!.value = 123; clone.assets[0]!.width = 77;
  assert.equal((scene.nodes[0]! as ReturnType<typeof createMockup>).shadow.blur, 48);
  assert.notEqual(scene.tracks[0]!.keyframes[0]!.value, 123); assert.equal(scene.assets[0]!.width, 1200);
});

test('factory validation rejects cycles/prototypes and preserves getters without running them', () => {
  const circular: Record<string, unknown> = {}; circular.self = circular;
  assert.throws(() => createScene({ background: circular } as unknown as Partial<SceneDocument>), errorCode('INVALID_SCENE'));
  assert.throws(() => createScene({ background: new Date() } as unknown as Partial<SceneDocument>), errorCode('INVALID_SCENE'));
  let calls = 0;
  const options: Partial<SceneDocument> = {};
  Object.defineProperty(options, 'name', { enumerable: true, get: () => { calls++; return 'injected'; } });
  assert.throws(() => createScene(options), errorCode('INVALID_SCENE'));
  const effects: Partial<SceneDocument> = {};
  Object.defineProperty(effects, 'effects', { enumerable: true, get: () => { calls++; return fixture().effects; } });
  assert.throws(() => createScene(effects), errorCode('INVALID_SCENE'));
  const shadow = { ...createMockup().shadow };
  Object.defineProperty(shadow, 'blur', { enumerable: true, get: () => { calls++; return 9; } });
  assert.throws(() => createScene({ nodes: [createMockup({ shadow })] }), errorCode('INVALID_SCENE'));
  assert.equal(calls, 0);
  const polluted = JSON.parse('{"__proto__":{"polluted":true}}') as Partial<SceneDocument>;
  assert.throws(() => createScene(polluted), errorCode('INVALID_SCENE'));
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test('scene-wide keyframe cap accepts 100000 and rejects larger aggregate before per-item work', () => {
  const nodes = [createShape({ id: 'many-a' }), createShape({ id: 'many-b' })];
  const properties = ['x', 'y', 'width', 'height', 'scale', 'rotation', 'tiltX', 'tiltY', 'opacity'] as const;
  const tracks: SceneDocument['tracks'] = Array.from({ length: 10 }, (_, i) => ({
    id: `many-${i}`, nodeId: nodes[Math.floor(i / 9)]!.id, property: properties[i % 9]!,
    keyframes: Array.from({ length: 10000 }, (_, j) => ({ time: j / 2500, value: 1 })),
  }));
  const scene = { ...fixture(), nodes, tracks };
  assert.deepEqual(validateScene(scene), []);
  const extra = { id: 'over-total', nodeId: nodes[1]!.id, property: 'y' as const, keyframes: [{ time: 0, value: 1 }] };
  const issues = validateScene({ ...scene, tracks: [...tracks, extra] });
  assert.ok(issues.some(issue => issue.path === 'tracks' && issue.message.includes('100000')));
  assert.throws(() => createScene({ ...scene, tracks: [...tracks, extra] }), errorCode('INVALID_SCENE'));
});

test('scene node and track counts are bounded at 2000 / 10000', () => {
  const nodes = Array.from({ length: 2000 }, (_, i) => createShape({ id: `bounded-node-${i}` }));
  const properties = ['x', 'y', 'width', 'height', 'scale'] as const;
  const tracks: SceneDocument['tracks'] = nodes.flatMap(node => properties.map(property => ({ id: `${node.id}-${property}`, nodeId: node.id, property, keyframes: [{ time: 0, value: 1 }] })));
  const scene = { ...fixture(), nodes, tracks };
  assert.deepEqual(validateScene(scene), []);
  hasIssue({ ...scene, nodes: [...nodes, createShape()] }, 'nodes');
  hasIssue({ ...scene, tracks: [...tracks, tracks[0]] }, 'tracks');
});

test('asset sources enforce 48 MiB per source and 128 MiB total without copying payloads', () => {
  const mib = 1024 * 1024;
  // Repeated aliases deliberately count for each asset, since serialized media is repeated too.
  const source48 = 'A'.repeat(48 * mib), source32 = 'B'.repeat(32 * mib);
  const asset = (id: string, src: string): SceneDocument['assets'][number] => ({ id, kind: 'image', src, width: 1, height: 1 });
  const scene = { ...fixture(), nodes: [], tracks: [], assets: [asset('limit-a', source48), asset('limit-b', source48), asset('limit-c', source32)] };
  assert.deepEqual(validateScene(scene), []);
  hasIssue({ ...scene, assets: [asset('too-large', `${source48}A`)] }, 'assets[0].src');
  const issues = validateScene({ ...scene, assets: [...scene.assets, asset('over-total', 'A')] });
  assert.ok(issues.some(issue => issue.path === 'assets' && issue.message.includes('128 MiB')));
  let calls = 0;
  const guarded = asset('accessor', 'unused'); Object.defineProperty(guarded, 'src', { enumerable: true, get: () => { calls++; return source48; } });
  hasIssue({ ...scene, assets: [guarded] }, 'assets[0].src'); assert.equal(calls, 0);
});

test('preflight detects sparse/accessor/symbol/prototype/depth errors without executing getters', () => {
  const scene = fixture();
  hasIssue({ ...scene, nodes: new Array(1) }, 'nodes[0]');
  let calls = 0; const accessor: unknown[] = [scene.nodes[0]];
  Object.defineProperty(accessor, '0', { get: () => { calls++; throw new Error('array getter'); } });
  hasIssue({ ...scene, nodes: accessor }, 'nodes[0]'); assert.equal(calls, 0);
  const extra: unknown[] = [];
  Object.defineProperty(extra, 'hidden', { get: () => { calls++; throw new Error('extra getter'); } });
  hasIssue({ ...scene, nodes: extra }, 'nodes'); assert.equal(calls, 0);
  const symbol = { ...scene, [Symbol('hidden')]: 1 }; hasIssue(symbol, '');
  const strange = [scene.nodes[0]]; Object.setPrototypeOf(strange, null); hasIssue({ ...scene, nodes: strange }, 'nodes');
  let deep: unknown = 0; for (let i = 0; i < 30; i++) deep = { child: deep };
  assert.ok(validateScene({ ...scene, extra: deep }).some(issue => issue.message.includes('nesting depth')));
  const sparse = [undefined]; hasIssue({ ...scene, nodes: sparse }, 'nodes[0]');
});

test('preflight immediately stops inspecting descriptors after 200 issues', () => {
  let largestIndex = -1, ownKeys = 0;
  const invalid = new Proxy(new Array(20000).fill(undefined) as unknown[], {
    getOwnPropertyDescriptor(target, key) { if (typeof key === 'string' && /^\d+$/.test(key)) largestIndex = Math.max(largestIndex, Number(key)); return Reflect.getOwnPropertyDescriptor(target, key); },
    ownKeys(target) { ownKeys++; return Reflect.ownKeys(target); },
  });
  const issues = validateScene({ ...fixture(), nodes: [], extra: invalid });
  assert.equal(issues.length, 200); assert.equal(largestIndex, 199); assert.equal(ownKeys, 0);
});

test('preflight bounds aliased graphs to 500000 visits instead of traversing millions of entries', () => {
  let tailInspected = false;
  const tail = new Proxy({}, { getPrototypeOf(target) { tailInspected = true; return Reflect.getPrototypeOf(target); } });
  const branch = new Array(20000).fill(1) as number[];
  // Only one small branch is allocated, but following every alias would visit 6 million entries.
  const branches: unknown[] = new Array(300).fill(branch); branches.push(tail);
  const issues = validateScene({ ...fixture(), extra: branches });
  assert.ok(issues.some(issue => issue.message.includes('traversal budget') && issue.message.includes('500000')));
  assert.equal(tailInspected, false);
});

test('deserialize rejects strings over 150 MiB before invoking JSON.parse', () => {
  const parse = JSON.parse;
  let parsed = false;
  JSON.parse = (() => { parsed = true; throw new Error('must not parse'); }) as typeof JSON.parse;
  try { assert.throws(() => deserializeScene(' '.repeat(150 * 1024 * 1024 + 1)), errorCode('INPUT_LIMIT')); }
  finally { JSON.parse = parse; }
  assert.equal(parsed, false);
});

test('100 edits with a 2 MiB asset avoid structuredClone/JSON.stringify and retain editing isolation', () => {
  const src = `data:image/png;base64,${'A'.repeat(2 * 1024 * 1024)}`;
  const initial = fixture(); initial.assets[0]!.src = src;
  initial.tracks = createAnimationTracks(initial.nodes[0]!, 'float', initial.duration);
  const structured = globalThis.structuredClone, stringify = JSON.stringify;
  globalThis.structuredClone = (() => { throw new Error('History must not structuredClone media'); }) as typeof structuredClone;
  JSON.stringify = (() => { throw new Error('History must not serialize media to compare edits'); }) as typeof JSON.stringify;
  try {
    const store = new SceneStore(initial); let escaped: SceneDocument | undefined;
    for (let i = 0; i < 100; i++) store.update(draft => {
      draft.name = `media-edit-${i}`;
      if (i === 0) { escaped = draft; (draft.nodes[0]! as ReturnType<typeof createMockup>).shadow.blur = 99; draft.tracks[0]!.keyframes[0]!.value = 42; }
    });
    escaped!.assets[0]!.src = 'mutated outside'; (escaped!.nodes[0]! as ReturnType<typeof createMockup>).shadow.blur = -1;
    escaped!.tracks[0]!.keyframes[0]!.value = -999;
    assert.equal(store.scene.assets[0]!.src, src); assert.equal((store.scene.nodes[0]! as ReturnType<typeof createMockup>).shadow.blur, 99);
    assert.equal(store.scene.tracks[0]!.keyframes[0]!.value, 42);
    const snapshot = store.scene; snapshot.assets[0]!.width = -1; snapshot.tracks[0]!.keyframes[0]!.value = -1;
    assert.equal(store.scene.assets[0]!.width, 1200); assert.equal(store.scene.tracks[0]!.keyframes[0]!.value, 42);
    let undos = 0; while (store.undo()) { undos++; assert.equal(store.scene.assets[0]!.src, src); }
    assert.equal(undos, 100); assert.equal(store.scene.name, initial.name);
    assert.equal((store.scene.nodes[0]! as ReturnType<typeof createMockup>).shadow.blur, 48);
    while (store.redo()) assert.equal(store.scene.assets[0]!.src, src);
    assert.equal(store.scene.name, 'media-edit-99'); store.dispose();
  } finally { globalThis.structuredClone = structured; JSON.stringify = stringify; }
  assert.equal(deserializeScene(serializeScene(initial)).assets[0]!.src, src);
});

test('structural equality ignores metadata property order and transactions reject unrecorded replacement', () => {
  const initial = fixture(), store = new SceneStore(initial); let events = 0; store.subscribe(() => { events++; });
  store.update(draft => { const { noise, ...rest } = draft.effects; draft.effects = { ...rest, noise }; });
  assert.equal(store.canUndo, false); assert.equal(events, 0);
  store.transaction(tx => { tx.update(draft => { draft.name = 'temporary'; }); tx.setScene(initial); });
  assert.equal(store.canUndo, false); assert.equal(events, 0);
  store.update(draft => { draft.name = 'prior'; }); store.update(draft => { draft.name = 'redoable'; }); store.undo();
  const before = store.scene, count = events;
  assert.throws(() => store.transaction(tx => {
    tx.update(draft => { draft.name = 'rolled back'; }); tx.setScene(createScene(), false);
  }), error => error instanceof StudioError && error.code === 'TRANSACTION_ACTIVE' && error.message.includes('setScene(scene, false)'));
  assert.deepEqual(store.scene, before); assert.equal(events, count); assert.equal(store.canRedo, true);
  assert.throws(() => store.transaction(tx => tx.transaction(inner => inner.setScene(initial, false))), errorCode('TRANSACTION_ACTIVE'));
  assert.equal(store.redo(), true); assert.equal(store.scene.name, 'redoable');
  store.transaction(tx => { tx.setScene(initial, true); }); assert.equal(store.scene.name, initial.name);
  assert.equal(store.undo(), true); assert.equal(store.scene.name, 'redoable');
  store.setScene(initial, false); assert.equal(store.canUndo, false); assert.equal(store.canRedo, false);
});
