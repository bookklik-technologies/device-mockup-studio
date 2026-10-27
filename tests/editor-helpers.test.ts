import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, createMockup, createAnimationTracks, evaluateScene } from '@bookklik/device-mockup-studio-core';
import { clientToScene, nodeCorners, hitTest, editNode } from '../packages/editor/src/helpers.js';

test('editor coordinates account for CSS fitting, offset and center-based nodes', () => {
  const point = clientToScene(325, 250, { left: 100, top: 100, width: 450, height: 300 }, { width: 1200, height: 800 });
  assert.deepEqual(point, { x: 600, y: 400 });
  const node = createMockup({ x: 600, y: 400, width: 300, height: 200 });
  assert.equal(hitTest(node, point), true);
  assert.equal(hitTest(node, { x: 800, y: 400 }), false);
});

test('editor picking respects perspective, rotation, visibility and locking', () => {
  const node = createMockup({ x: 600, y: 450, width: 300, height: 200, scale: 1.4, rotation: 35, tiltX: 19, tiltY: -25 });
  const corners = nodeCorners(node);
  assert.equal(corners.length, 4);
  assert.ok(corners.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.equal(hitTest(node, { x: 600, y: 450 }), true);
  assert.equal(hitTest({ ...node, locked: true }, { x: 600, y: 450 }), false);
  assert.equal(hitTest({ ...node, visible: false }, { x: 600, y: 450 }), false);
  assert.equal(hitTest(node, { x: 60, y: 45 }), false);
});

test('editor positional edits move motion tracks with the node', () => {
  const node = createMockup();
  const scene = createScene({ nodes: [node], tracks: createAnimationTracks(node, 'orbit', 4) });
  const before = evaluateScene(scene, 1.25).nodes[0]!;
  editNode(scene, node.id, draft => { draft.x += 143; draft.y -= 52; });
  const after = evaluateScene(scene, 1.25).nodes[0]!;
  assert.ok(Math.abs(after.x - before.x - 143) < 1e-8);
  assert.ok(Math.abs(after.y - before.y + 52) < 1e-8);
});

test('editor can be imported without a window or document', async () => {
  assert.equal(typeof globalThis.window, 'undefined');
  const { mountEditor } = await import('../packages/editor/src/index.js');
  assert.equal(typeof mountEditor, 'function');
});

test('spatial picking uses orthographic depth hulls without changing legacy projection', async () => {
  const { createMesh } = await import('@bookklik/device-mockup-studio-core');
  const node = createMesh({ x: 200, y: 150, width: 100, height: 80, depth: 200, tiltY: 45 });
  const hull = nodeCorners(node);
  assert.ok(hull.length >= 4 && hull.length <= 6);
  assert.ok(hull.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.equal(hitTest(node, { x: 290, y: 150 }), true, 'projected depth extends beyond flat face');
  assert.equal(hitTest(node, { x: 330, y: 150 }), false);
  const movedDepth = nodeCorners({ ...node, z: 1000 });
  assert.deepEqual(movedDepth, hull, 'orthographic depth position does not change projected scale');
  const plane = createMockup({ x: 200, y: 150, width: 100, height: 80, tiltY: 45 });
  assert.notDeepEqual(nodeCorners(plane), nodeCorners(plane, true));
  assert.equal(hitTest({ ...node, locked: true }, { x: 200, y: 150 }), false);
});
