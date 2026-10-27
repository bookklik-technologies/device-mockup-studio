import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, createShape, createMesh, createMockup, createAnimationTracks, evaluateScene, SceneStore } from '@bookklik/device-mockup-studio/core';
import { alignmentDelta, constrainMovement, nodeBounds, snapBounds, snapTargets, type Alignment, type Bounds, type SnapTarget } from '../packages/editor/src/alignment.js';
import { editNode, nodeCorners } from '../packages/editor/src/helpers.js';

const bounds: Bounds = { left: 197, right: 297, top: 233, bottom: 313 };
const target: SnapTarget = { id: 'node:reference', bounds: { left: 300, right: 400, top: 500, bottom: 600 } };
const pixels = { x: 1, y: 1 };

test('snap captures at 6 CSS pixels, retains to 10 and releases beyond 10', () => {
  const captured = snapBounds(bounds, [target], pixels);
  assert.equal(captured.delta.x, 3);
  assert.equal(captured.guides[0]?.axis, 'x');
  const shifted = { ...bounds, left: 191, right: 291 };
  assert.equal(snapBounds(shifted, [target], pixels).state.x, undefined);
  assert.equal(snapBounds(shifted, [target], pixels, captured.state).delta.x, 9);
  assert.equal(snapBounds({ ...bounds, left: 189, right: 289 }, [target], pixels, captured.state).state.x, undefined);
  assert.equal(snapBounds({ ...bounds, left: 194, right: 294 }, [target], pixels).delta.x, 6);
  assert.equal(snapBounds({ ...bounds, left: 190, right: 290 }, [target], pixels, captured.state).delta.x, 10);
});

test('snap thresholds adapt independently to CSS fitting on each axis', () => {
  const fitted = snapBounds({ left: 188, right: 288, top: 420, bottom: 492 }, [target], { x: .5, y: .75 });
  assert.deepEqual(fitted.delta, { x: 12, y: 8 });
  assert.equal(fitted.guides.length, 2);
  assert.equal(snapBounds({ ...bounds, left: 193, right: 293 }, [target], pixels).delta.x, 0);
});

test('nearest target wins; canvas wins equal distances regardless of input order', () => {
  const canvas = { id: 'canvas', bounds: { left: 294, right: 1000, top: 0, bottom: 1000 } };
  assert.equal(snapBounds(bounds, [target, canvas], pixels).state.x?.target, 'canvas');
  const closer = { id: 'node:closer', bounds: { left: 298, right: 600, top: 900, bottom: 1000 } };
  assert.equal(snapBounds(bounds, [canvas, target, closer], pixels).state.x?.target, 'node:closer');
  const old = snapBounds(bounds, [target], pixels).state;
  assert.equal(snapBounds(bounds, [closer, target], pixels, old).state.x?.target, target.id, 'active target stays stable');
  assert.equal(snapBounds(bounds, [closer], pixels, old).state.x?.target, closer.id, 'removed target is discarded');
});

test('Alt bypass clears state and guides; axis locking prevents perpendicular snapping', () => {
  const initial = snapBounds(bounds, [target], pixels);
  assert.deepEqual(snapBounds(bounds, [target], pixels, initial.state, { bypass: true }), { delta: { x: 0, y: 0 }, state: {}, guides: [] });
  assert.equal(snapBounds(bounds, [target], pixels, initial.state, { axis: 'y' }).state.x, undefined);
  assert.deepEqual(constrainMovement({ x: 20, y: 5 }, true), { delta: { x: 20, y: 0 }, axis: 'x' });
  assert.deepEqual(constrainMovement({ x: 2, y: 50 }, true, 'x'), { delta: { x: 2, y: 0 }, axis: 'x' });
  assert.deepEqual(constrainMovement({ x: 2, y: 50 }, false, 'x'), { delta: { x: 2, y: 50 } });
});

test('targets include canvas and locked references but exclude moving, hidden, transparent layers', () => {
  const moving = createShape({ id: 'moving' }), locked = createShape({ id: 'locked', locked: true });
  const scene = createScene({ nodes: [moving, locked, createShape({ id: 'hidden', visible: false }), createShape({ id: 'clear', opacity: 0 })] });
  assert.deepEqual(snapTargets(scene, moving.id).map(t => t.id), ['canvas', 'node:locked']);
  assert.equal(snapTargets(createScene({ nodes: [] }), 'missing').length, 1);
});

test('all six alignments place projected edges or centers on the canvas', () => {
  const scene = createScene({ width: 1200, height: 800 });
  const node = createMockup({ x: 380, y: 310, width: 260, height: 160, scale: 1.3, rotation: 31, tiltX: 17, tiltY: -23 });
  const expected: Record<Alignment, number> = { left: 0, 'center-x': 600, right: 1200, top: 0, 'center-y': 400, bottom: 800 };
  for (const align of Object.keys(expected) as Alignment[]) {
    const delta = alignmentDelta(nodeBounds(node), scene, align);
    const after = nodeBounds({ ...node, x: node.x + delta.x, y: node.y + delta.y });
    const value = align === 'center-x' ? (after.left + after.right) / 2 : align === 'center-y' ? (after.top + after.bottom) / 2 : after[align];
    assert.ok(Math.abs(value - expected[align]) < 1e-8, align);
  }
});

test('spatial bounds include projected depth; mixed scenes use spatial projection for planes', () => {
  const mesh = createMesh({ id: 'mesh', depth: 240, rotation: 20, tiltY: 42, z: 81 });
  const plane = createMockup({ id: 'plane', tiltX: 23, tiltY: 31 });
  const scene = createScene({ nodes: [mesh, plane] });
  const targetPlane = snapTargets(scene, mesh.id).find(t => t.id === 'node:plane')!;
  assert.deepEqual(targetPlane.bounds, nodeBounds(plane, true));
  assert.notDeepEqual(targetPlane.bounds, nodeBounds(plane, false));
  const b = nodeBounds(mesh), corners = nodeCorners(mesh);
  assert.equal(b.right, Math.max(...corners.map(p => p.x)));
  assert.deepEqual(nodeBounds({ ...mesh, z: 800 }), b);
  assert.deepEqual(nodeBounds({ ...plane, shadow: { ...plane.shadow, blur: 200, offsetX: 100 } }), nodeBounds(plane));
});

test('alignment at a nonzero playhead shifts animation tracks and is one undoable edit', () => {
  const node = createMockup({ id: 'animated', x: 300, y: 280, width: 220, height: 140, rotation: 12 });
  const scene = createScene({ width: 1200, height: 800, nodes: [node], tracks: createAnimationTracks(node, 'orbit', 4) });
  const store = new SceneStore(scene), before = evaluateScene(scene, 1.25).nodes[0]!;
  const delta = alignmentDelta(nodeBounds(before), scene, 'right');
  store.update(draft => editNode(draft, node.id, n => { n.x += delta.x; }));
  const after = evaluateScene(store.scene, 1.25).nodes[0]!;
  assert.ok(Math.abs(nodeBounds(after).right - 1200) < 1e-8);
  assert.equal(after.y, before.y); assert.equal(after.rotation, before.rotation);
  const aligned = store.scene;
  assert.equal(store.undo(), true); assert.deepEqual(store.scene, scene); assert.equal(store.canUndo, false);
  assert.equal(store.redo(), true); assert.deepEqual(store.scene, aligned);
  store.update(draft => editNode(draft, node.id, () => undefined));
  store.undo(); assert.deepEqual(store.scene, scene, 'no-op edits do not add history');
  store.dispose();
});
