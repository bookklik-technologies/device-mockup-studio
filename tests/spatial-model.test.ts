import test from 'node:test';
import assert from 'node:assert/strict';
import { assertScene, cloneScene, createAnimationTracks, createMaterialPreset, createMesh, createMockup, createPhysicalMaterial, createScene, createShape, createSpatialSettings, createText, deserializeScene, evaluateScene, SceneStore, serializeScene, StudioError, validateScene } from '@bookklik/device-mockup-studio-core';
import type { MaterialPreset, MeshNode, MeshOptions, PhysicalMaterial, SceneDocument, SceneNode, SpatialLight, SpatialSettings } from '@bookklik/device-mockup-studio-core';

const errorCode = (code: string) => (error: unknown): boolean => error instanceof StudioError && error.code === code;
function fixture(): SceneDocument {
  return createScene({ id: 'spatial-scene', nodes: [createMesh({ id: 'mesh' }), createMockup({ id: 'screen', style: 'glass-light', glass: createMaterialPreset('glass') }), createText({ id: 'title', z: 300 }), createShape({ id: 'backdrop', z: -100 })], spatial: createSpatialSettings() });
}
function hasIssue(input: unknown, path: string): void {
  const issues = validateScene(input);
  assert.ok(issues.some(issue => issue.path === path), `Expected ${path}, got ${JSON.stringify(issues)}`);
}
function meshScene(patch: Record<string, unknown>): unknown { return { ...fixture(), nodes: [{ ...createMesh({ id: 'mesh' }), ...patch }] }; }
function settingsScene(patch: Record<string, unknown>): unknown { return { ...fixture(), spatial: { ...createSpatialSettings(), ...patch } }; }
function lightScene(patch: Record<string, unknown>): unknown {
  const settings = createSpatialSettings();
  return { ...fixture(), spatial: { ...settings, lights: [{ ...settings.lights[0]!, ...patch }] } };
}

test('v1 spatial documents round trip without reinterpreting existing v1 scenes', () => {
  const scene = fixture();
  assert.equal(scene.version, 1); assertScene(scene);
  assert.deepEqual(deserializeScene(serializeScene(scene)), scene);
  const clone = cloneScene(scene); (clone.nodes[0]! as MeshNode).material.roughness = 0.7;
  clone.spatial!.lights[0]!.x = 42;
  assert.notEqual((scene.nodes[0]! as MeshNode).material.roughness, 0.7); assert.notEqual(scene.spatial!.lights[0]!.x, 42);
  const legacy = createScene({ nodes: [createMockup(), createText(), createShape()] });
  assert.equal(Object.hasOwn(legacy, 'spatial'), false);
  for (const node of legacy.nodes) { assert.equal(Object.hasOwn(node, 'z'), false); assert.equal(Object.hasOwn(node, 'glass'), false); }
  assert.deepEqual(deserializeScene(serializeScene(legacy)), legacy);
  const disabled = createScene({ spatial: createSpatialSettings({ enabled: false }) });
  assert.equal(disabled.spatial!.enabled, false);
  assert.throws(() => deserializeScene(JSON.stringify({ ...scene, version: 2 })), errorCode('UNSUPPORTED_VERSION'));
});

test('mesh factories preserve every animation field, canonical type, nested defaults and independent options', () => {
  const mesh = createMesh();
  assert.equal(mesh.type, 'mesh'); assert.equal(mesh.geometry, 'rounded-box');
  assert.deepEqual([mesh.x, mesh.y, mesh.width, mesh.height, mesh.depth, mesh.bevel, mesh.segments, mesh.z], [600, 450, 240, 240, 160, 20, 24, 0]);
  for (const property of ['x', 'y', 'width', 'height', 'scale', 'rotation', 'tiltX', 'tiltY', 'opacity'] as const) assert.ok(Number.isFinite(mesh[property]));
  assert.equal(mesh.visible, true); assert.equal(mesh.locked, false);
  assert.equal(mesh.castShadow, true); assert.equal(mesh.receiveShadow, true);
  assert.deepEqual(mesh.material, createMaterialPreset('ceramic'));
  assert.equal(createMesh({ type: 'text' } as unknown as MeshOptions).type, 'mesh');
  const material = { roughness: 0.6 }, partial: Partial<MeshNode> = { geometry: 'sphere' };
  const a = createMesh({ ...partial, material }), b = createMesh();
  assert.equal(a.geometry, 'sphere'); assert.equal(a.material.roughness, 0.6); assert.equal(a.material.ior, 1.45);
  material.roughness = 0.9; assert.equal(a.material.roughness, 0.6);
  a.material.color = '#000'; assert.notEqual(b.material.color, '#000'); assert.notEqual(a.id, b.id);
  assertScene(createScene({ nodes: [a, b] }));
});

test('complete physical materials and all four presets match contract defaults', () => {
  const ceramic = createPhysicalMaterial(); assert.equal(ceramic.transmission, 0); assert.equal(ceramic.metalness, 0);
  const glass = createMaterialPreset('glass');
  assert.deepEqual([glass.transmission, glass.roughness, glass.ior, glass.thickness, glass.color, glass.attenuationDistance, glass.clearcoat, glass.dispersion], [0.98, 0.08, 1.45, 24, '#ffffff', 1000, 1, 0.03]);
  assert.equal(createMaterialPreset('metal').metalness, 1);
  assert.equal(createMaterialPreset('plastic').transmission, 0);
  for (const kind of ['glass', 'metal', 'ceramic', 'plastic'] as const) {
    const material = createMaterialPreset(kind);
    assert.equal(Object.keys(material).length, 11);
    assertScene(createScene({ nodes: [createMesh({ material }), createMockup({ glass: material })] }));
    material.color = '#000'; assert.notEqual(createMaterialPreset(kind).color, '#000');
  }
  for (const invalid of ['mirror', '', undefined, null, 1]) assert.throws(() => createMaterialPreset(invalid as MaterialPreset), errorCode('UNKNOWN_MATERIAL_PRESET'));
  let calls = 0;
  assert.throws(() => createMaterialPreset({ toString() { calls++; throw new Error('coercion'); } } as unknown as MaterialPreset), errorCode('UNKNOWN_MATERIAL_PRESET'));
  assert.equal(calls, 0);
});

test('spatial settings supply independent complete lights and preserve explicit overrides', () => {
  const a = createSpatialSettings(), b = createSpatialSettings();
  assert.deepEqual([a.enabled, a.ambientIntensity, a.environmentIntensity, a.exposure, a.shadows, a.shadowOpacity, a.quality], [true, 0.5, 0.8, 1, true, 0.25, 'medium']);
  assert.equal(a.lights.length, 2); assert.equal(new Set([...a.lights, ...b.lights].map(light => light.id)).size, 4);
  assert.deepEqual(a.lights.map(light => [light.type, light.x, light.y, light.z]), [['directional', 250, 50, 900], ['directional', 1100, 250, 600]]);
  assert.notEqual(a.lights[0]!.color, a.lights[1]!.color);
  a.lights[0]!.color = '#000'; assert.notEqual(b.lights[0]!.color, '#000');
  const lights: SpatialLight[] = [{ id: 'custom-light', type: 'point', color: '#fff', intensity: 20, x: -32768, y: 32768, z: 8192, castShadow: false }];
  const settings = createSpatialSettings({ quality: 'high', exposure: 2, lights });
  lights[0]!.intensity = 1; assert.equal(settings.lights[0]!.intensity, 20); assert.equal(settings.ambientIntensity, 0.5);
  assertScene(createScene({ spatial: settings }));
  assert.equal(createSpatialSettings({ lights: [] }).lights.length, 0);
  assert.throws(() => createScene({ spatial: { enabled: true } as SpatialSettings }), errorCode('INVALID_SCENE'));
});

test('mesh edits, deep snapshots, history, duplication and removal retain material and z', () => {
  const initial = fixture(), store = new SceneStore(initial);
  store.updateNode('mesh', { geometry: 'torus', z: 260, material: createMaterialPreset('glass') });
  let mesh = store.scene.nodes[0]! as MeshNode;
  assert.equal(mesh.geometry, 'torus'); assert.equal(mesh.material.transmission, 0.98); assert.equal(mesh.z, 260);
  assert.equal(store.undo(), true); assert.deepEqual(store.scene, initial); assert.equal(store.redo(), true);
  const duplicate = store.duplicateNode('mesh') as MeshNode;
  assert.equal(duplicate.type, 'mesh'); assert.equal(duplicate.z, 260); assert.equal(duplicate.geometry, 'torus');
  assert.equal(duplicate.x, mesh.x + 20); assert.equal(duplicate.y, mesh.y + 20); assert.notEqual(duplicate.id, mesh.id);
  duplicate.material.color = '#f00'; assert.notEqual((store.scene.nodes[1]! as MeshNode).material.color, '#f00');
  store.update(draft => { (draft.nodes[0]! as MeshNode).material.roughness = 0.5; draft.spatial!.lights[0]!.intensity = 1; });
  mesh = store.scene.nodes[0]! as MeshNode; assert.equal(mesh.material.roughness, 0.5);
  assert.notEqual((store.scene.nodes[1]! as MeshNode).material.roughness, 0.5);
  store.undo(); assert.equal((store.scene.nodes[0]! as MeshNode).material.roughness, 0.08);
  const before = store.scene;
  assert.throws(() => store.updateNode('mesh', { depth: NaN }), errorCode('INVALID_SCENE')); assert.deepEqual(store.scene, before);
  store.removeNode('mesh'); assert.equal(store.scene.nodes.some(node => node.id === 'mesh'), false);
  store.undo(); assert.equal(store.scene.nodes[0]!.id, 'mesh');
});

test('all existing animation properties and presets work with meshes; z remains deliberately unanimated', () => {
  for (const preset of ['float', 'orbit', 'reveal', 'zoom', 'parallax'] as const) {
    const node = createMesh({ id: 'animated', z: 160 }), tracks = createAnimationTracks(node, preset, 4);
    const scene = createScene({ nodes: [node], tracks, spatial: createSpatialSettings() }), before = serializeScene(scene);
    for (const time of [-1, 0, 0.125, 1, 2, 3.99, 4, 99]) {
      const evaluated = evaluateScene(scene, time); assertScene(evaluated);
      assert.equal(evaluated.nodes[0]!.z, 160); assert.deepEqual((evaluated.nodes[0]! as MeshNode).material, node.material);
    }
    assert.equal(serializeScene(scene), before);
    const store = new SceneStore(scene), duplicate = store.duplicateNode(node.id);
    assert.equal(store.scene.tracks.filter(track => track.nodeId === duplicate.id).length, tracks.length);
    for (const track of tracks) {
      const copied = store.scene.tracks.find(candidate => candidate.nodeId === duplicate.id && candidate.property === track.property)!;
      assert.notEqual(copied.id, track.id);
      assert.equal(copied.keyframes[0]!.value - track.keyframes[0]!.value, ['x', 'y'].includes(track.property) ? 20 : 0);
    }
    store.removeNode(node.id); assert.equal(store.scene.tracks.some(track => track.nodeId === node.id), false);
  }
  const node = createMesh({ id: 'mesh' });
  const tracks: SceneDocument['tracks'] = (['x', 'y', 'width', 'height', 'scale', 'rotation', 'tiltX', 'tiltY', 'opacity'] as const).map((property, i) => ({ id: `track-${i}`, nodeId: node.id, property, keyframes: [{ time: 0, value: node[property] }, { time: 4, value: node[property] }] }));
  assertScene(createScene({ nodes: [node], tracks }));
  hasIssue({ ...createScene({ nodes: [node] }), tracks: [{ id: 'bad-track', nodeId: node.id, property: 'z', keyframes: [{ time: 0, value: 0 }] }] }, 'tracks[0].property');
});

test('mesh geometry, depth, bevel, integer segment and boolean validation checks every range', () => {
  for (const geometry of ['box', 'rounded-box', 'sphere', 'torus', 'cylinder', 'cone', 'icosahedron'] as const) assertScene(createScene({ nodes: [createMesh({ geometry })] }));
  for (const patch of [{ depth: 0.1, bevel: 0, segments: 8 }, { depth: 4096, bevel: 1024, segments: 64 }]) assertScene(createScene({ nodes: [createMesh(patch)] }));
  for (const [property, values] of Object.entries({ geometry: ['plane', '', 1], depth: [0, -1, 4096.01, '160'], bevel: [-0.1, 1024.01], segments: [7, 65, 24.5, '24'], castShadow: [0, 'true'], receiveShadow: [null, 1], z: [NaN, Infinity, -Infinity, '0'] })) for (const value of values) hasIssue(meshScene({ [property]: value }), `nodes[0].${property}`);
  for (const property of ['depth', 'bevel', 'segments', 'z']) for (const value of [NaN, Infinity, -Infinity]) hasIssue(meshScene({ [property]: value }), `nodes[0].${property}`);
  hasIssue(meshScene({ unknown: true }), 'nodes[0].unknown');
  const missing = createMesh(); delete (missing as Partial<MeshNode>).material;
  hasIssue({ ...fixture(), nodes: [missing] }, 'nodes[0].material');
});

test('every physical material field is required and deeply range-checked for meshes and mockup glass', () => {
  const ranges: Record<string, [number, number]> = { metalness: [0, 1], roughness: [0, 1], transmission: [0, 1], ior: [1, 2.5], thickness: [0, 1000], attenuationDistance: [1, 100000], clearcoat: [0, 1], clearcoatRoughness: [0, 1], dispersion: [0, 1] };
  for (const [property, [min, max]] of Object.entries(ranges)) {
    for (const value of [min, max]) assertScene(createScene({ nodes: [createMesh({ material: { [property]: value } })] }));
    for (const value of [min - 0.01, max + 0.01, NaN, Infinity, -Infinity, '1', null, undefined]) {
      const material = { ...createPhysicalMaterial(), [property]: value };
      hasIssue(meshScene({ material }), `nodes[0].material.${property}`);
      hasIssue({ ...fixture(), nodes: [{ ...createMockup(), glass: material }] }, `nodes[0].glass.${property}`);
    }
  }
  for (const property of ['color', 'attenuationColor']) for (const value of ['', ' ', null, 123, 'x'.repeat(513)]) hasIssue(meshScene({ material: { ...createPhysicalMaterial(), [property]: value } }), `nodes[0].material.${property}`);
  for (const material of [null, [], true, 'glass', {}]) hasIssue(meshScene({ material }), material && typeof material === 'object' && !Array.isArray(material) ? 'nodes[0].material.color' : 'nodes[0].material');
  hasIssue(meshScene({ material: { ...createPhysicalMaterial(), opacity: 1 } }), 'nodes[0].material.opacity');
  hasIssue({ ...fixture(), nodes: [{ ...createMockup(), glass: { roughness: 0.2 } }] }, 'nodes[0].glass.color');
});

test('spatial settings, lights and all declared enums/ranges are deeply validated even when disabled', () => {
  for (const quality of ['low', 'medium', 'high'] as const) assertScene(createScene({ spatial: createSpatialSettings({ quality }) }));
  for (const [property, values] of Object.entries({ enabled: [1, null], ambientColor: ['', 123, 'x'.repeat(513)], ambientIntensity: [-0.01, 5.01], environmentIntensity: [-0.01, 5.01], exposure: [0.09, 5.01], shadows: [1, 'true'], shadowOpacity: [-0.01, 1.01], quality: ['ultra', '', 1], lights: [null, {}, 'lights'] })) for (const value of values) hasIssue(settingsScene({ [property]: value }), `spatial.${property}`);
  for (const property of ['ambientIntensity', 'environmentIntensity', 'exposure', 'shadowOpacity']) for (const value of [NaN, Infinity, -Infinity]) hasIssue(settingsScene({ [property]: value }), `spatial.${property}`);
  for (const [property, values] of Object.entries({ id: ['', 1], type: ['ambient', 'rect-area', '', 1], color: ['', 1], intensity: [-0.01, 20.01], x: [-32768.01, 32768.01], y: [-32768.01, 32768.01], z: [-4096.01, 8192.01], castShadow: [1, 'true'] })) for (const value of values) hasIssue(lightScene({ [property]: value }), `spatial.lights[0].${property}`);
  for (const property of ['intensity', 'x', 'y', 'z']) for (const value of [NaN, Infinity, -Infinity]) hasIssue(lightScene({ [property]: value }), `spatial.lights[0].${property}`);
  for (const patch of [{ intensity: 0, x: -32768, y: -32768, z: -4096 }, { intensity: 20, x: 32768, y: 32768, z: 8192, type: 'point' }]) assert.deepEqual(validateScene(lightScene(patch)), []);
  hasIssue(settingsScene({ enabled: false, exposure: 0 }), 'spatial.exposure');
  hasIssue(settingsScene({ rectAreaLights: [] }), 'spatial.rectAreaLights'); hasIssue(lightScene({ distance: 100 }), 'spatial.lights[0].distance');
  hasIssue({ ...fixture(), spatial: null }, 'spatial');
});

test('mesh and light safety caps are inclusive and SceneStore rejects over-cap duplication atomically', () => {
  const nodes = Array.from({ length: 32 }, (_, i) => createMesh({ id: `mesh-${i}` }));
  const lights = Array.from({ length: 6 }, (_, i): SpatialLight => ({ id: `light-${i}`, type: i % 2 ? 'point' : 'directional', color: '#fff', intensity: 1, x: 1, y: 1, z: 1, castShadow: true }));
  const scene = createScene({ nodes, spatial: createSpatialSettings({ lights }) }); assertScene(scene);
  hasIssue({ ...scene, nodes: [...nodes, createMesh()] }, 'nodes');
  hasIssue({ ...scene, spatial: { ...scene.spatial!, lights: [...lights, { ...lights[0]!, id: 'seventh' }] } }, 'spatial.lights');
  const store = new SceneStore(scene); assert.throws(() => store.duplicateNode('mesh-0'), errorCode('INVALID_SCENE'));
  assert.deepEqual(store.scene, scene); assert.equal(store.canUndo, false);
  assertScene(createScene({ nodes: [...nodes, ...Array.from({ length: 5 }, () => createShape())] }));
});

test('light identifiers share the global scene/asset/node/track namespace and reject duplicate lights', () => {
  const scene = fixture();
  scene.assets = [{ id: 'asset', kind: 'image', src: 'data:image/png;base64,AAAA', width: 1, height: 1 }];
  scene.tracks = [{ id: 'track', nodeId: 'mesh', property: 'x', keyframes: [{ time: 0, value: 100 }] }];
  for (const id of [scene.id, 'asset', 'mesh', 'track']) hasIssue({ ...scene, spatial: { ...scene.spatial!, lights: [{ ...scene.spatial!.lights[0]!, id }] } }, 'spatial.lights[0].id');
  hasIssue({ ...scene, spatial: { ...scene.spatial!, lights: [scene.spatial!.lights[0], scene.spatial!.lights[0]] } }, 'spatial.lights[1].id');
});

test('spatial/accessor factory options and patches never evaluate user getters', () => {
  let calls = 0;
  const getter = { enumerable: true, get() { calls++; throw new Error('must not execute'); } };
  const material = createPhysicalMaterial(); Object.defineProperty(material, 'roughness', getter);
  const options: MeshOptions = {}; Object.defineProperty(options, 'material', getter);
  assert.throws(() => createScene({ nodes: [createMesh(options)] }), errorCode('INVALID_SCENE'));
  assert.throws(() => createScene({ nodes: [createMesh({ material })] }), errorCode('INVALID_SCENE'));
  const materialOptions: Partial<PhysicalMaterial> = {}; Object.defineProperty(materialOptions, 'transmission', getter);
  assert.throws(() => createScene({ nodes: [createMesh({ material: createPhysicalMaterial(materialOptions) })] }), errorCode('INVALID_SCENE'));
  const settingsOptions: Partial<SpatialSettings> = {}; Object.defineProperty(settingsOptions, 'lights', getter);
  assert.throws(() => createScene({ spatial: createSpatialSettings(settingsOptions) }), errorCode('INVALID_SCENE'));
  const scene = fixture(); Object.defineProperty(scene, 'spatial', getter); hasIssue(scene, 'spatial');
  const light = createSpatialSettings().lights[0]!; Object.defineProperty(light, 'intensity', getter);
  hasIssue(settingsScene({ lights: [light] }), 'spatial.lights[0].intensity');
  const store = new SceneStore(fixture()), before = store.scene;
  for (const property of ['id', 'type', 'material', 'depth']) {
    const patch: Partial<SceneNode> = {}; Object.defineProperty(patch, property, getter);
    assert.throws(() => store.updateNode('mesh', patch), errorCode('INVALID_SCENE')); assert.deepEqual(store.scene, before);
  }
  const patch: Partial<MeshNode> = { material };
  assert.throws(() => store.updateNode('mesh', patch), errorCode('INVALID_SCENE')); assert.equal(store.canUndo, false);
  assert.equal(calls, 0);
});

test('hostile prototypes, hidden/unknown keys, sparse lights and exceptional proxies are rejected safely', () => {
  for (const value of [new Date(), Object.create({ roughness: 0.2 }) as object]) {
    hasIssue(meshScene({ material: value }), 'nodes[0].material');
    assert.throws(() => createPhysicalMaterial(value), errorCode('INVALID_SCENE'));
    assert.throws(() => createMesh(value), errorCode('INVALID_SCENE'));
    assert.throws(() => createSpatialSettings(value), errorCode('INVALID_SCENE'));
  }
  const polluted = JSON.parse('{"__proto__":{"polluted":true}}') as Partial<PhysicalMaterial>;
  hasIssue(meshScene({ material: createPhysicalMaterial(polluted) }), 'nodes[0].material.__proto__');
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  const hidden = createPhysicalMaterial(); Object.defineProperty(hidden, 'extra', { value: 1 });
  hasIssue(meshScene({ material: hidden }), 'nodes[0].material.extra');
  const symbol = { ...createPhysicalMaterial(), [Symbol('hidden')]: 1 };
  hasIssue(meshScene({ material: symbol }), 'nodes[0].material');
  hasIssue(settingsScene({ lights: new Array(1) }), 'spatial.lights[0]');
  let calls = 0; const lights: SpatialLight[] = [];
  Object.defineProperty(lights, '0', { get() { calls++; throw new Error('array getter'); } });
  hasIssue(settingsScene({ lights }), 'spatial.lights[0]'); assert.equal(calls, 0);
  const revoked = Proxy.revocable({}, {}); revoked.revoke(); assert.ok(validateScene(revoked.proxy).length);
  const exceptional = new Proxy({}, { getPrototypeOf() { throw new Error('hostile reflection'); } });
  assert.doesNotThrow(() => validateScene(meshScene({ material: exceptional })));
  assert.throws(() => assertScene(meshScene({ material: exceptional })), errorCode('INVALID_SCENE'));
  const nullPrototype = Object.assign(Object.create(null) as PhysicalMaterial, createPhysicalMaterial());
  assertScene(createScene({ nodes: [createMesh({ material: nullPrototype })] }));
});

test('unknown-document validation reads descriptors, not inherited values or Proxy get traps', () => {
  let calls = 0;
  const material = createPhysicalMaterial(), scene = fixture();
  delete (material as Partial<PhysicalMaterial>).roughness;
  Object.defineProperty(Object.prototype, 'roughness', { configurable: true, get() { calls++; throw new Error('inherited getter'); } });
  try { hasIssue(meshScene({ material }), 'nodes[0].material.roughness'); }
  finally { delete (Object.prototype as Partial<PhysicalMaterial>).roughness; }
  assert.equal(calls, 0);
  const trap = { get() { calls++; throw new Error('must not read through a Proxy'); } };
  const settings = scene.spatial!;
  settings.lights = new Proxy(settings.lights.map(light => new Proxy(light, trap)), trap);
  scene.spatial = new Proxy(settings, trap);
  (scene.nodes[0]! as MeshNode).material = new Proxy(createPhysicalMaterial(), trap);
  assert.deepEqual(validateScene(new Proxy(scene, trap)), []);
  assert.equal(calls, 0);
});

test('world depth is bounded before it reaches floating-point GPU matrices', () => {
  for (const z of [-32768, 32768]) assertScene(createScene({nodes:[createMesh({z})]}));
  for (const z of [-32769,32769,1e300]) assert.ok(validateScene({...createScene(),nodes:[createMesh({z})]}).some(i=>i.path==='nodes[0].z'));
});
