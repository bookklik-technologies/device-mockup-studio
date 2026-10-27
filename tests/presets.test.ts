import test from 'node:test';
import assert from 'node:assert/strict';
import { assertScene, createAnimationTracks, createMockup, createScene, createShape, createText, evaluateScene, serializeScene, StudioError } from '@bookklik/device-mockup-studio-core';
import type { DeviceDefinition, SceneDocument } from '@bookklik/device-mockup-studio-core';
import { applyPreset, framePresets, getDevice, getPresets, listDevices, registerDevice } from '@bookklik/device-mockup-studio-presets';

function scene(): SceneDocument {
  const node = createMockup({ id: 'hero', assetId: 'media', deviceId: 'phone' });
  return createScene({ id: 'project', nodes: [node, createMockup({ id: 'sidekick', assetId: 'media', deviceId: 'browser' }), createText({ id: 'caption', text: 'A real caption' }), createShape({ id: 'decoration' })], assets: [{ id: 'media', kind: 'image', src: 'data:image/png;base64,AAAA', width: 600, height: 1000 }], tracks: createAnimationTracks(node, 'parallax', 4) });
}
const errorCode = (code: string) => (error: unknown): boolean => error instanceof StudioError && error.code === code;

test('procedural device registry has every required device and portrait variants', () => {
  for (const id of ['screenshot', 'browser', 'phone', 'android', 'tablet', 'laptop', 'desktop']) {
    assert.equal(getDevice(id).id, id); assert.ok(getDevice(`${id}-portrait`).aspect <= 1);
  }
  assert.equal(getDevice('android').camera, 'dot'); assert.equal(getDevice('phone').camera, 'pill');
  assert.equal(getDevice('browser').chrome, 'browser'); assert.equal(getDevice('laptop').chrome, 'keyboard'); assert.equal(getDevice('desktop').chrome, 'stand');
  const devices = listDevices(); assert.ok(devices.length >= 14); assert.equal(new Set(devices.map(device => device.id)).size, devices.length);
  for (const device of devices) { assert.ok(Number.isFinite(device.aspect) && device.aspect > 0); for (const inset of Object.values(device.inset)) assert.ok(Number.isFinite(inset) && inset >= 0); }
  assert.throws(() => getDevice('missing'), errorCode('UNKNOWN_DEVICE'));
});

test('device registration is extensible, validated and defensively cloned', () => {
  const definition: DeviceDefinition = { id: 'test:original-watch', name: 'Original watch', category: 'screenshot', aspect: 1, inset: { top: 10, left: 10, right: 10, bottom: 10 }, radius: 30, screenRadius: 20 };
  registerDevice(definition); definition.inset.top = 100; assert.equal(getDevice(definition.id).inset.top, 10);
  const fetched = getDevice(definition.id); fetched.inset.top = 999; assert.equal(getDevice(definition.id).inset.top, 10);
  const listed = listDevices(); listed[0]!.inset.top = 999; assert.notEqual(listDevices()[0]!.inset.top, 999);
  const custom = createScene({ nodes: [createMockup({ deviceId: definition.id })] }); assert.doesNotThrow(() => assertScene(custom));
  registerDevice({ ...fetched, name: 'Replacement', inset: { top: 0, right: 0, bottom: 0, left: 0 } }); assert.equal(getDevice(definition.id).name, 'Replacement');
  for (const patch of [{ aspect: 0 }, { aspect: NaN }, { radius: -1 }, { screenRadius: Infinity }, { id: '' }, { category: 'watch' }, { camera: 'lens' }, { chrome: 'toolbar' }, { inset: { top: -1, left: 0, right: 0, bottom: 0 } }, { inset: {} }, { extra: true }]) {
    assert.throws(() => registerDevice({ ...fetched, ...patch } as DeviceDefinition), errorCode('INVALID_DEVICE'));
  }
});

test('social frames are unique, frozen and practical export dimensions', () => {
  assert.ok(framePresets.length >= 8); assert.equal(new Set(framePresets.map(frame => frame.id)).size, framePresets.length);
  for (const frame of framePresets) { assert.ok(Number.isInteger(frame.width) && frame.width > 0); assert.ok(Number.isInteger(frame.height) && frame.height > 0); assert.ok(Object.isFrozen(frame)); }
  assert.deepEqual(framePresets.find(frame => frame.id === 'story'), { id: 'story', name: 'Story / short', width: 1080, height: 1920 });
  assert.ok(Object.isFrozen(framePresets));
});

test('at least twelve original distinctive composition presets exist and descriptors are isolated', () => {
  const presets = getPresets(); assert.ok(presets.length >= 12); assert.equal(new Set(presets.map(preset => preset.id)).size, presets.length);
  assert.ok(new Set(presets.map(preset => preset.category)).size >= 6);
  presets[0]!.name = 'Changed outside'; assert.notEqual(getPresets()[0]!.name, 'Changed outside');
  const original = scene(); const outputs = getPresets().map(preset => serializeScene(preset.apply(original)));
  assert.equal(new Set(outputs).size, outputs.length);
  assert.throws(() => applyPreset(original, 'missing'), errorCode('UNKNOWN_PRESET'));
});

test('every preset preserves assets, media references, node identity, timing and untouched text/shapes', () => {
  const original = scene(), before = serializeScene(original);
  for (const preset of getPresets()) {
    const output = applyPreset(original, preset.id); assertScene(output);
    assert.equal(serializeScene(original), before, preset.id); assert.notEqual(output, original);
    assert.deepEqual(output.assets, original.assets); assert.equal(output.nodes.length, original.nodes.length);
    assert.deepEqual(output.nodes.map(node => node.id), original.nodes.map(node => node.id));
    assert.deepEqual(output.nodes.slice(2), original.nodes.slice(2));
    for (let i = 0; i < 2; i++) { const current = output.nodes[i]!, input = original.nodes[i]!; assert.ok(current.type === 'mockup' && input.type === 'mockup'); assert.equal(current.assetId, input.assetId); assert.equal(current.deviceId, input.deviceId); }
    assert.deepEqual(output.tracks.map(track => [track.id, track.nodeId, track.property, track.keyframes.map(frame => [frame.time, frame.easing])]), original.tracks.map(track => [track.id, track.nodeId, track.property, track.keyframes.map(frame => [frame.time, frame.easing])]));
    for (const time of [0, 1, 2, 3, 4]) assertScene(evaluateScene(output, time));
    output.assets[0]!.src = 'changed'; assert.notEqual(original.assets[0]!.src, 'changed');
  }
});

test('preset coordinate changes carry existing animation offsets into the new layout', () => {
  const original = scene(), beforeNode = original.nodes[0]!, output = applyPreset(original, 'paper-margin'), afterNode = output.nodes[0]!;
  for (let i = 0; i < original.tracks.length; i++) {
    const property = original.tracks[i]!.property;
    for (let j = 0; j < original.tracks[i]!.keyframes.length; j++) assert.ok(Math.abs((output.tracks[i]!.keyframes[j]!.value - afterNode[property]) - (original.tracks[i]!.keyframes[j]!.value - beforeNode[property])) < 1e-8);
  }
});

test('all layouts adapt to portrait, square and widescreen scenes and do not accumulate nodes', () => {
  for (const [width, height] of [[1080, 1920], [1080, 1080], [1920, 1080], [200, 200], [1, 1]]) {
    const original = scene(); original.width = width!; original.height = height!;
    for (const preset of getPresets()) {
      const first = preset.apply(original), second = preset.apply(first); assertScene(first); assertScene(second); assert.equal(second.nodes.length, original.nodes.length);
      assert.equal(first.width, width); assert.equal(first.height, height);
    }
  }
});

test('locked/invisible nodes, empty scenes and unknown custom frame ids remain safe', () => {
  const original = scene(); original.nodes[0]!.locked = true; original.nodes[1]!.visible = false;
  for (const preset of getPresets()) { const output = preset.apply(original); assert.deepEqual(output.nodes, original.nodes); assert.deepEqual(output.tracks, original.tracks); assert.equal(preset.apply(createScene()).nodes.length, 0); }
  const custom = createScene({ nodes: [createMockup({ deviceId: 'custom:registered-later', width: 500, height: 700 })] });
  assert.doesNotThrow(() => assertScene(applyPreset(custom, 'aurora-field')));
});
