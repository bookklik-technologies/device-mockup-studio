import test from 'node:test';
import assert from 'node:assert/strict';
import { assertScene, createAnimationTracks, createMockup, createScene, createText, deserializeScene, serializeScene, SceneStore } from '@bookklik/device-mockup-studio-core';
import { applyTemplate, fontFamilies, getTemplates } from '@bookklik/device-mockup-studio-presets';

test('complete templates have isolated metadata and cover both workspaces', () => {
  assert.equal(getTemplates({ workspace:'2d' }).length, 16);
  assert.equal(getTemplates({ workspace:'3d' }).length, 6);
  assert.equal(new Set(getTemplates().map(template => template.id)).size, 22);
  const first = getTemplates()[0]!; first.name = 'outside mutation';
  assert.notEqual(getTemplates()[0]!.name, first.name);
  assert.equal(fontFamilies.length, 12); assert.ok(Object.isFrozen(fontFamilies));
  assert.throws(() => applyTemplate(createScene(), 'missing'), { code:'UNKNOWN_TEMPLATE' });
});

test('replacement retains project metadata and media, removes old composition, and never mutates input', () => {
  const node = createMockup({ id:'old-screen', assetId:'media', locked:true });
  const input = createScene({ id:'my-project', name:'My project', width:1080, height:1920, duration:7, fps:24, seed:42,
    assets:[{ id:'media', kind:'image', src:'data:image/png;base64,AAAA', width:800, height:600 }],
    nodes:[node, createText({ id:'old-heading', text:'Original heading' })], tracks:createAnimationTracks(node, 'float', 7),
  });
  const before = serializeScene(input);
  for (const template of getTemplates()) {
    const output = applyTemplate(input, template.id); assertScene(output);
    for (const key of ['version','id','name','width','height','duration','fps','seed'] as const) assert.equal(output[key], input[key]);
    assert.deepEqual(output.assets, input.assets); assert.equal(output.tracks.length, 0);
    assert.ok(output.nodes.every(node => node.id !== 'old-screen' && node.id !== 'old-heading' && !node.locked));
    assert.ok(output.nodes.some(node => node.type === 'text'));
    assert.equal(!!output.spatial?.enabled, template.workspace === '3d');
    assert.equal(serializeScene(input), before);
    assert.deepEqual(deserializeScene(serializeScene(output)), output);
    output.assets[0]!.name = 'outside mutation'; assert.equal(input.assets[0]!.name, undefined);
  }
});

test('all templates adapt to portrait, square and landscape without accumulating layers or sample assets', () => {
  for (const [width,height] of [[1920,1080],[1080,1080],[1080,1920]]) {
    for (const template of getTemplates()) {
      const first = applyTemplate(createScene({ width, height }), template.id);
      const second = applyTemplate(first, template.id); assertScene(first); assertScene(second);
      assert.equal(second.nodes.length, first.nodes.length); assert.deepEqual(second.assets, first.assets);
      assert.equal(second.width, width); assert.equal(second.height, height);
      assert.equal(new Set(second.nodes.map(node => node.id)).size, second.nodes.length);
      assert.ok(second.assets.every(asset => asset.src.startsWith('data:image/svg+xml')));
      for (const node of second.nodes) if (node.type === 'mockup') assert.ok(second.assets.some(asset => asset.id === node.assetId));
      assert.ok(second.nodes.every(node => node.x >= 0 && node.x <= width! && node.y >= 0 && node.y <= height!));
    }
  }
});

test('media priority prefers selection, then existing screens, then other assets', () => {
  const input = createScene({ assets:['unused','existing','selected'].map(id => ({ id, kind:'image' as const, src:'data:image/png;base64,AAAA', width:800, height:600 })),
    nodes:[createMockup({ assetId:'existing' })] });
  const output = applyTemplate(input, 'mint-archive', { assetId:'selected' });
  assert.deepEqual(output.nodes.filter(node => node.type === 'mockup').map(node => node.assetId), ['selected','existing','unused','selected']);
  const fallback = applyTemplate(input, 'mint-archive', { assetId:'not-in-this-project' });
  assert.equal(fallback.nodes.find(node => node.type === 'mockup')?.assetId, 'existing');
});

test('repeated video slots share playback settings from the original media instance', () => {
  const input = createScene({ assets:[{ id:'video', kind:'video', src:'data:video/webm;base64,AAAA', width:600, height:900, duration:8 }],
    nodes:[createMockup({ assetId:'video', videoStart:2, playbackRate:.5, videoLoop:false })] });
  const output = applyTemplate(input, 'prism-fan');
  const screens = output.nodes.filter(node => node.type === 'mockup'); assert.equal(screens.length, 3);
  for (const screen of screens) {
    assert.equal(screen.assetId, 'video'); assert.equal(screen.videoStart, 2); assert.equal(screen.playbackRate, .5); assert.equal(screen.videoLoop, false);
  }
});

test('art directions remain structurally distinct without color, font family, device identity or copy', () => {
  const signatures = getTemplates().map(template => {
    const scene = applyTemplate(createScene({ width:1920, height:1080 }), template.id);
    return JSON.stringify(scene.nodes.map(node => ({ type:node.type,
      x:Math.round(node.x), y:Math.round(node.y), width:Math.round(node.width), height:Math.round(node.height), rotation:node.rotation,
      ...(node.type === 'text' ? { size:Math.round(node.fontSize), weight:node.fontWeight, align:node.align } : {}),
      ...(node.type === 'shape' ? { shape:node.shape } : {}), ...(node.type === 'mesh' ? { geometry:node.geometry, depth:node.depth } : {}),
    })));
  });
  assert.equal(new Set(signatures).size, getTemplates().length);
  const scales = getTemplates({ workspace:'2d' }).map(template => {
    const scene = applyTemplate(createScene({ width:1920, height:1080 }), template.id);
    return Math.max(...scene.nodes.flatMap(node => node.type === 'text' && node.name.startsWith('Headline') ? [node.fontSize] : []));
  });
  assert.ok(Math.max(...scales) / Math.min(...scales) > 5, 'the collection includes both small editorial and oversized display typography');
});

test('primary typography stays inside the canvas in all formats, independently of decorative cropping', () => {
  for (const [width,height] of [[1920,1080],[1080,1080],[1080,1920],[1080,1350]]) {
    for (const template of getTemplates()) {
      const scene = applyTemplate(createScene({ width, height }), template.id);
      const headlines = scene.nodes.filter(node => node.type === 'text' && node.name.startsWith('Headline'));
      assert.ok(headlines.length > 0, template.id);
      for (const node of headlines) {
        assert.equal(node.rotation, 0, 'expressive rotation belongs to artwork and secondary labels');
        assert.ok(node.x - node.width / 2 >= -.001 && node.x + node.width / 2 <= width! + .001, `${template.id}: headline fits horizontally`);
        assert.ok(node.y - node.height / 2 >= -.001 && node.y + node.height / 2 <= height! + .001, `${template.id}: headline fits vertically`);
      }
    }
  }
  const scene = applyTemplate(createScene({ width:1920, height:1080 }), 'cobalt-edition');
  assert.ok(scene.nodes.some(node => node.type === 'mockup' && node.y + node.height / 2 > scene.height), 'the poster deliberately crops its oversized device');
});

test('material scenes use independent object staging and studio light arrangements', () => {
  const scenes = getTemplates({ workspace:'3d' }).map(template => applyTemplate(createScene(), template.id));
  const staging = scenes.map(scene => JSON.stringify(scene.nodes.filter(node => node.type === 'mesh').map(node => [node.geometry,node.x,node.y,node.width,node.height,node.rotation,node.tiltX,node.tiltY])));
  const lighting = scenes.map(scene => JSON.stringify(scene.spatial!.lights.map(light => [light.type,light.x,light.y,light.z,light.intensity])));
  assert.equal(new Set(staging).size, scenes.length); assert.equal(new Set(lighting).size, scenes.length);
  for (const scene of scenes) {
    assert.ok(scene.nodes.some(node => node.name.startsWith('Hero ·') && node.type === 'mesh'));
    assert.ok(scene.nodes.some(node => node.type === 'mockup'), 'project artwork remains part of each material study');
    assert.notEqual(scene.background.type, 'image', 'art direction is built from editable scene nodes');
  }
});

test('switching between independent art directions remains one undoable project replacement', () => {
  const original = applyTemplate(createScene(), 'mint-archive');
  const store = new SceneStore(original);
  try {
    const next = applyTemplate(store.scene, 'optical-glass'); store.setScene(next);
    assert.deepEqual(store.scene, next); assert.equal(store.canUndo, true);
    store.undo(); assert.deepEqual(store.scene, original); assert.equal(store.canUndo, false);
    store.redo(); assert.deepEqual(store.scene, next);
  } finally { store.dispose(); }
});

test('material studies scale to large canvases without exceeding material and light limits', () => {
  for (const template of getTemplates({ workspace:'3d' })) {
    assertScene(applyTemplate(createScene({ width:3840, height:3840 }), template.id));
  }
});

test('generated studio light IDs cannot collide with retained media IDs', () => {
  const input = createScene({ assets:[{ id:'chrome-rim', kind:'image', src:'data:image/png;base64,AAAA', width:800, height:600 }] });
  const output = applyTemplate(input, 'dark-chrome'); assertScene(output);
  assert.equal(output.assets[0]!.id, 'chrome-rim');
  assert.ok(output.spatial!.lights.every(light => light.id !== 'chrome-rim'));
});
