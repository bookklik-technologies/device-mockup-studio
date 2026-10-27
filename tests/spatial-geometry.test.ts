import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { createRequire } from 'node:module';
// Three is an optional spatial-package dependency, not a root/core dependency.
const { Mesh, MeshBasicMaterial, Raycaster, Vector3 } = createRequire(new URL('../packages/spatial/package.json', import.meta.url))('three') as typeof import('three');
import { createScene, createMesh, createMockup, createShape, createSpatialSettings, type MeshGeometry } from '@bookklik/device-mockup-studio/core';
import { AssetManager, CanvasRenderer } from '@bookklik/device-mockup-studio/render';
import { SpatialRenderer, createMeshGeometry, createGlassRingGeometry, boundedSegments, getSpatialCapabilities, SPATIAL_LIMITS } from '../packages/spatial/src/index.js';

const asCanvas = (canvas: Canvas): HTMLCanvasElement => canvas as unknown as HTMLCanvasElement;
const factory = (w: number, h: number): HTMLCanvasElement => asCanvas(createCanvas(w, h));
const hash = (canvas: Canvas): string => createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex');
const close = (a: number, b: number): void => assert.ok(Math.abs(a - b) < .002, `${a} != ${b}`);
const geometryNames: MeshGeometry[] = ['box', 'rounded-box', 'sphere', 'torus', 'cylinder', 'cone', 'icosahedron'];

test('all seven spatial geometries have finite centered volumetric scene-pixel bounds without DOM', () => {
  for (const name of geometryNames) {
    const geometry = createMeshGeometry(createMesh({ geometry: name, width: 243, height: 171, depth: 95, bevel: 900, segments: 31 }));
    assert.ok(geometry.getAttribute('position').count > 20, name);
    assert.equal(geometry.getAttribute('position').count, geometry.getAttribute('normal').count, name);
    for (const key of ['position', 'normal']) for (const n of geometry.getAttribute(key).array) assert.ok(Number.isFinite(n), `${name} ${key}`);
    const bounds = geometry.boundingBox!;
    close(bounds.min.x, -121.5); close(bounds.max.x, 121.5);
    close(bounds.min.y, -85.5); close(bounds.max.y, 85.5);
    close(bounds.min.z, -47.5); close(bounds.max.z, 47.5);
    assert.ok(geometry.boundingSphere!.radius > 47);
    geometry.dispose();
  }
});

test('subdivision caps cannot turn ico detail or rounded bevel into exponential allocation', () => {
  assert.equal(boundedSegments(1e9), 64); assert.equal(boundedSegments(64, 'low'), 16); assert.equal(boundedSegments(64, 'medium'), 32);
  assert.throws(() => boundedSegments(NaN), /finite/);
  for (const name of geometryNames) {
    const geometry = createMeshGeometry({ geometry: name, width: 300, height: 200, depth: 140, bevel: 40, segments: 1e8 });
    assert.ok(geometry.getAttribute('position').count <= 12000, `${name} ${geometry.getAttribute('position').count}`);
    geometry.dispose();
  }
});

test('rounded boxes are actually beveled and reject nonfinite/invalid geometry', () => {
  const round = createMeshGeometry(createMesh({ geometry: 'rounded-box', bevel: 25 }));
  const sharp = createMeshGeometry(createMesh({ geometry: 'box' }));
  assert.ok(round.getAttribute('position').count > sharp.getAttribute('position').count);
  assert.throws(() => createMeshGeometry({ geometry: 'sphere', width: Infinity, height: 2, depth: 1, bevel: 0, segments: 24 }), /finite/);
  assert.throws(() => createMeshGeometry({ geometry: 'sphere', width: 10, height: 10, depth: 0, bevel: 0, segments: 24 }), /depth/);
  round.dispose(); sharp.dispose();
});

test('glass mockup geometry is a closed extruded ring with a true open media hole', () => {
  const geometry = createGlassRingGeometry({ width: 400, height: 280, depth: 32, radius: 28, screenRadius: 15, inset: { left: 20, right: 20, top: 44, bottom: 20 }, bevel: 4, segments: 32 });
  const bounds = geometry.boundingBox!;
  close(bounds.min.x, -200); close(bounds.max.x, 200); close(bounds.min.y, -140); close(bounds.max.y, 140); close(bounds.min.z, -16); close(bounds.max.z, 16);
  const material = new MeshBasicMaterial(), mesh = new Mesh(geometry, material);
  mesh.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(0, 0, 100), new Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(mesh).length, 0, 'center must not contain an opaque front face');
  ray.set(new Vector3(190, 0, 100), new Vector3(0, 0, -1));
  assert.ok(ray.intersectObject(mesh).length > 0, 'rim must have a real front face');
  ray.set(new Vector3(250, 0, 0), new Vector3(-1, 0, 0));
  assert.ok(ray.intersectObject(mesh).length > 0, 'rim must have actual extruded side walls');
  geometry.dispose(); material.dispose();
  assert.throws(() => createGlassRingGeometry({ width: 20, height: 20, depth: 2, radius: 3, screenRadius: 2, inset: { left: 0, right: 0, top: 0, bottom: 0 } }), /rim/);
});

test('optional renderer remains Node/import-safe and exactly delegates legacy Canvas2D', async () => {
  const first = createCanvas(1, 1), second = createCanvas(1, 1), assets = new AssetManager();
  const scene = createScene({ width: 180, height: 120, nodes: [createShape({ x: 90, y: 60, width: 100, height: 70, radius: 15, fill: '#fe793c', tiltY: 20 })] });
  const legacy = new CanvasRenderer(asCanvas(first), { assets, canvasFactory: factory });
  const spatial = new SpatialRenderer(asCanvas(second), { assets, canvasFactory: factory });
  assert.equal(spatial.supportsSpatial, true);
  await legacy.render(scene, .2, { scale: 2 }); await spatial.render(scene, .2, { scale: 2 });
  assert.equal(hash(first), hash(second));
  spatial.renderSync(scene, 0, 1); legacy.renderSync(scene, 0, 1); assert.equal(hash(first), hash(second));
  assert.equal(spatial.getDebugInfo().webglContextsCreated, 0); assert.equal(spatial.getDebugInfo().mode, 'legacy');
  const disabled = createScene({ ...scene, spatial: createSpatialSettings({ enabled: false }) });
  await spatial.render(disabled); assert.equal(spatial.getDebugInfo().webglContextsCreated, 0);
  spatial.dispose(); spatial.dispose(); legacy.dispose();
  assert.equal(spatial.getDebugInfo().disposed, true); assert.equal(spatial.getDebugInfo().resources.textures, 0);
  await assert.rejects(spatial.render(scene), (error: { code: string }) => error.code === 'DISPOSED');
  assert.throws(() => spatial.renderSync(scene), (error: { code: string }) => error.code === 'DISPOSED');
  assert.equal(assets.get('not-present'), undefined, 'borrowed asset manager is still alive'); assets.dispose();
});

test('spatial preflight, cancellation and missing WebGL errors never clear the last output', async () => {
  const canvas = createCanvas(1, 1), renderer = new SpatialRenderer(asCanvas(canvas), { canvasFactory: factory });
  const legacy = createScene({ width: 80, height: 60, background: { type: 'solid', color: '#123456' } });
  await renderer.render(legacy); const previous = hash(canvas);
  const spatial = createScene({ width: 80, height: 60, spatial: createSpatialSettings(), nodes: [createMesh({ x: 40, y: 30, width: 30, height: 30 })] });
  assert.throws(() => renderer.renderSync(spatial), (error: { code: string }) => error.code === 'SPATIAL_ASYNC_REQUIRED');
  await assert.rejects(renderer.render(spatial, 0, { scale: SPATIAL_LIMITS.outputSide }), (error: { code: string }) => error.code === 'SPATIAL_OUTPUT_LIMIT');
  const cancel = new AbortController(); cancel.abort();
  await assert.rejects(renderer.render(spatial, 0, { signal: cancel.signal }), (error: { code: string }) => error.code === 'ABORTED');
  await assert.rejects(renderer.render(spatial), (error: { code: string }) => error.code === 'SPATIAL_WEBGL2_REQUIRED');
  assert.equal(hash(canvas), previous);
  const capabilities = getSpatialCapabilities(); assert.equal(capabilities.webgl2, false); assert.equal(capabilities.maxTextureSize, 0); assert.ok(capabilities.reason);
  renderer.dispose();
});

test('physical mockup-rim count and textured-node count are bounded before GPU allocation', async () => {
  const renderer = new SpatialRenderer(factory(1, 1), { canvasFactory: factory });
  const scene = createScene({ spatial: createSpatialSettings(), nodes: Array.from({ length: 33 }, (_, i) => createMockup({ id: `glass-${i}`, style: 'glass-light' })) });
  await assert.rejects(renderer.render(scene), (error: { code: string }) => error.code === 'SPATIAL_MESH_LIMIT');
  scene.nodes = Array.from({ length: 257 }, (_, i) => createShape({ id: `shape-${i}` }));
  await assert.rejects(renderer.render(scene), (error: { code: string }) => error.code === 'SPATIAL_TEXTURE_LIMIT');
  assert.equal(renderer.getDebugInfo().webglContextsCreated, 0); renderer.dispose();
});

test('shared finishing is deterministic on a renderer-extension surface and validates time/dimensions', () => {
  const canvas=createCanvas(100,80),renderer=new CanvasRenderer(asCanvas(canvas),{canvasFactory:factory});
  const base=createScene({width:100,height:80,background:{type:'solid',color:'#aabbcc'}});
  const finished={...base,effects:{...base.effects,noise:.2,vignette:.4}};
  renderer.renderSync(base);renderer.applyEffects(finished,.5);const one=hash(canvas);
  renderer.renderSync(base);renderer.applyEffects(finished,.5);assert.equal(hash(canvas),one);
  assert.throws(()=>renderer.applyEffects(finished,NaN),/finite/);
  assert.throws(()=>renderer.applyEffects({...finished,width:NaN}),/finite/);renderer.dispose();
});
