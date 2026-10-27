import { createAnimationTracks, createMaterialPreset, resolveMockupGlassMaterial, createSpatialSettings, uid, type PhysicalMaterial, type SpatialSettings, type SpatialLight, type MeshNode, type SceneDocument, type SceneNode, type MockupStyle, type AnimationPreset } from '@mockup-studio/core';
import { framePresets, listDevices, getDevice, fontFamilies } from '@mockup-studio/presets';
import { button, check, color, disclosure, element, enhanceLayerFields, field, number, section, select, text } from './dom.js';
import { setButtonContent } from './icons.js';
import { editNode } from './helpers.js';
import type { Alignment } from './alignment.js';
import { deviceThumbnail } from './device-thumbnail.js';
import { animationPresets, type Fit } from '@mockup-studio/core';

export interface InspectorContext {
  doc: Document;
  parent: HTMLElement;
  scene: SceneDocument;
  selectedId: string | undefined;
  supportsSpatial: boolean;
  mode: 'layer' | 'canvas';
  update(edit: (scene: SceneDocument) => void): void;
  align(value: Alignment): void;
  duplicate(): void;
  remove(): void;
  reorder(direction: number): void;
  generateBackground(): void;
  importMedia(): void;
  close(): void;
}
const pendingMotion = new WeakMap<HTMLElement, Map<string, AnimationPreset>>();
const motionLabels: Record<AnimationPreset, string> = { float: 'Float', orbit: 'Orbit', reveal: 'Reveal', zoom: 'Zoom', parallax: 'Parallax', 'fade-in': 'Fade in', 'fade-out': 'Fade out', 'slide-left': 'Slide in from left', 'slide-right': 'Slide in from right', 'slide-up': 'Slide up', 'slide-down': 'Slide down', pulse: 'Pulse', bounce: 'Bounce', sway: 'Sway', spin: 'Spin', flip: 'Flip reveal' };
function currentMotion(scene: SceneDocument, node: SceneNode): AnimationPreset | 'none' | 'custom' {
  const tracks = scene.tracks.filter(track => track.nodeId === node.id);
  if (!tracks.length) return 'none';
  return animationPresets.find(preset => {
    const expected = createAnimationTracks(node, preset, scene.duration);
    return expected.length === tracks.length && expected.every(track => {
      const actual = tracks.find(item => item.property === track.property);
      return actual && actual.keyframes.length === track.keyframes.length && actual.keyframes.every((key, i) => {
        const other = track.keyframes[i]!;
        return Math.abs(key.time - other.time) < 1e-6 && Math.abs(key.value - other.value) < 1e-6 && (key.easing ?? 'linear') === (other.easing ?? 'linear');
      });
    });
  }) ?? 'custom';
}
export function renderInspector(ctx: InspectorContext): void {
  const { doc, parent, scene, update } = ctx;
  // Keep expanded groups stable while a property edit rebuilds the inspector.
  const contextKey = `${ctx.mode}:${ctx.selectedId ?? ''}`;
  const expanded = parent.dataset.context === contextKey ? Array.from(parent.querySelectorAll<HTMLDetailsElement>('details[data-section]')).map(node => [node.dataset.section!, node.open] as const) : [];
  parent.dataset.context = contextKey;
  parent.replaceChildren();
  const restoreGroups = () => { for (const [title, open] of expanded) { const group = Array.from(parent.querySelectorAll<HTMLDetailsElement>('details[data-section]')).find(node => node.dataset.section === title); if (group) group.open = open; } };
  if (ctx.mode === 'canvas') { canvasInspector(ctx); restoreGroups(); return; }
  const node = scene.nodes.find(item => item.id === ctx.selectedId);
  if (!node) return;
  const spatialActive = ctx.supportsSpatial && (scene.spatial?.enabled || scene.nodes.some(n => n.type === 'mesh'));
  const physicalGlass = spatialActive && node.type === 'mockup' && !getDevice(node.deviceId).artwork && ['glass-light', 'glass-dark', 'liquid-glass'].includes(node.style);
  const edit = (fn: (node: SceneNode) => void) => update(draft => { if (!draft.nodes.find(n => n.id === node.id)?.locked) editNode(draft, node.id, fn); });
  const header = element(doc, 'header', 'ms-properties-header');
  const heading = element(doc, 'div', 'ms-properties-heading');
  heading.append(element(doc, 'h2', '', 'Properties'), element(doc, 'span', 'ms-layer-type', node.type === 'mesh' ? '3D object' : node.type === 'mockup' ? 'Mockup' : node.type === 'text' ? 'Text' : 'Shape'));
  const close = button(doc, 'Close properties', ctx.close, 'ms-properties-close'); setButtonContent(close, 'Close properties', 'X', true); heading.append(close);
  header.append(heading); field(doc, header, 'Layer name', text(doc, node.name, value => edit(n => { n.name = value; })));
  const states = element(doc, 'div', 'ms-layer-states');
  field(doc, states, 'Visible', check(doc, node.visible, value => edit(n => { n.visible = value; })));
  const lock = check(doc, node.locked, value => update(draft => { const current = draft.nodes.find(n => n.id === node.id); if (current) current.locked = value; })); lock.dataset.unlock = 'true';
  field(doc, states, 'Locked', lock); header.append(states);
  if (node.locked) header.append(element(doc, 'p', 'ms-hint', 'Layer locked. Unlock to make changes.'));
  parent.append(header);
  const actions = section(doc, parent, 'Layer actions');
  const row = element(doc, 'div', 'ms-actions ms-icon-row');
  const duplicate = button(doc, 'Duplicate', ctx.duplicate); setButtonContent(duplicate, 'Duplicate', 'Copy', true);
  const remove = button(doc, 'Remove', ctx.remove); setButtonContent(remove, 'Remove', 'Trash2', true);
  const sendBack = button(doc, 'Send back', () => ctx.reorder(-1)); setButtonContent(sendBack, 'Send back', 'ArrowDown', true);
  const bringForward = button(doc, 'Bring forward', () => ctx.reorder(1)); setButtonContent(bringForward, 'Bring forward', 'ArrowUp', true);
  sendBack.disabled = scene.nodes[0]?.id === node.id;
  bringForward.disabled = scene.nodes.at(-1)?.id === node.id;
  row.append(duplicate, remove, sendBack, bringForward);
  actions.append(row);
  const group = section(doc, parent, 'Content');
  const appearance = section(doc, parent, 'Appearance');
  if (node.type === 'mockup') {
    const selectedDevice = getDevice(node.deviceId);
    const choices = listDevices({ includeLegacy: false }).map(d => ({ value: d.id, label: d.name }));
    if (!choices.some(d => d.value === node.deviceId)) choices.push({ value: node.deviceId, label: `${selectedDevice.name} (legacy)` });
    const preview = element(doc, 'div', 'ms-device-preview'); preview.append(deviceThumbnail(doc, selectedDevice), element(doc, 'span', '', selectedDevice.name)); group.append(preview);
    field(doc, group, 'Device', select(doc, choices, node.deviceId, value => edit(n => {
      if (n.type !== 'mockup') return; const device = getDevice(value); n.deviceId = value;
      const maxW = scene.width * .78, maxH = scene.height * .78;
      n.width = Math.min(maxW, maxH * device.aspect); n.height = n.width / device.aspect; n.radius = device.radius;
    })));
    if (!selectedDevice.artwork) {
      field(doc, appearance, 'Frame style', select(doc, [{value:'default',label:'Classic'}, {value:'glass-light',label:'Light glass'}, {value:'glass-dark',label:'Dark glass'}, {value:'liquid-glass',label:'Liquid glass'}, {value:'inset-light',label:'Light inset'}, {value:'inset-dark',label:'Dark inset'}, {value:'outline',label:'Outline'}, {value:'border',label:'Border'}], node.style, value => edit(n => { if (n.type === 'mockup') n.style = value as MockupStyle; })));
      if (!physicalGlass && (['default', 'border'].includes(node.style) || selectedDevice.category === 'screenshot')) field(doc, appearance, 'Frame color', color(doc, node.frameColor, value => edit(n => { if (n.type === 'mockup') n.frameColor = value; })));
      const frame = disclosure(doc, appearance, 'Frame details');
      field(doc, frame, 'Corner radius', number(doc, node.radius, value => edit(n => { if (n.type === 'mockup') n.radius = value; }), 0, 4096));
      if (!physicalGlass) {
        field(doc, frame, 'Border width', number(doc, node.borderWidth, value => edit(n => { if (n.type === 'mockup') n.borderWidth = value; }), 0, 200));
        if (node.borderWidth > 0 || node.style === 'outline') field(doc, frame, 'Border color', color(doc, node.borderColor, value => edit(n => { if (n.type === 'mockup') n.borderColor = value; })));
      }
      if (physicalGlass) {
        const glass = disclosure(doc, appearance, 'Physical glass');
        glass.append(element(doc, 'p', 'ms-hint', node.glass ? 'Custom material for this glass frame.' : 'Automatic frame material. Editing keeps these effective values and creates a custom override.'));
        materialInspector(doc, glass, resolveMockupGlassMaterial(node), material => edit(n => { if (n.type === 'mockup') n.glass = material; }));
        if (node.glass) glass.append(button(doc, 'Reset glass override', () => edit(n => { if (n.type === 'mockup') delete n.glass; })));
      }
    } else appearance.append(element(doc, 'p', 'ms-hint', 'This device uses a fixed artwork frame. Use Size & position to adjust its placement.'));
    const source = element(doc, 'div', 'ms-source'); group.insertBefore(source, group.children[1] ?? null);
    source.append(button(doc, 'Replace screenshot', ctx.importMedia, 'ms-primary ms-full-width'), element(doc, 'p', 'ms-hint', 'Choose an image or video from your device.'));
    field(doc, source, 'Media', select(doc, [{ value: '', label: 'Choose media' }, ...scene.assets.map(a => ({ value: a.id, label: a.name || a.id }))], node.assetId ?? '', value => edit(n => { if (n.type === 'mockup') { if (value) n.assetId = value; else delete n.assetId; } })));
    if (node.assetId) {
      field(doc, source, 'Image fit', select(doc, [{value:'cover',label:'Fill screen (crop)'}, {value:'contain',label:'Show whole image'}, {value:'stretch',label:'Stretch'}], node.fit, value => edit(n => { if (n.type === 'mockup') n.fit = value as Fit; })));
      if (node.fit === 'stretch') source.append(element(doc, 'p', 'ms-hint', 'Fills the screen without cropping. Image proportions may change.'));
      else {
        const crop = disclosure(doc, source, 'Adjust crop');
        crop.append(element(doc, 'p', 'ms-hint', 'Position the media inside the screen. 0 = left / top, 1 = right / bottom.'));
        for (const key of ['focalX', 'focalY'] as const) field(doc, crop, key === 'focalX' ? 'Horizontal' : 'Vertical', number(doc, node[key], value => edit(n => { if (n.type === 'mockup') n[key] = value; }), 0, 1, .05));
      }
    }
    if (scene.assets.find(a => a.id === node.assetId)?.kind === 'video') {
      field(doc, source, 'Video start (s)', number(doc, node.videoStart, value => edit(n => { if (n.type === 'mockup') n.videoStart = value; }), 0, 86400, .1));
      field(doc, source, 'Playback rate', number(doc, node.playbackRate, value => edit(n => { if (n.type === 'mockup') n.playbackRate = value; }), .01, 16, .1));
      field(doc, source, 'Loop video', check(doc, node.videoLoop, value => edit(n => { if (n.type === 'mockup') n.videoLoop = value; })));
    }
  } else if (node.type === 'text') {
    field(doc, group, 'Content', text(doc, node.text, value => edit(n => { if (n.type === 'text') n.text = value; }), true));
    field(doc, appearance, 'Color', color(doc, node.color, value => edit(n => { if (n.type === 'text') n.color = value; })));
    const familyPicker = element(doc, 'select');
    for (const category of ['Sans serif', 'Serif', 'Display', 'Monospace', 'Generic fallbacks', 'Project font']) {
      const names = category === 'Generic fallbacks' ? ['sans-serif', 'serif', 'monospace', 'system-ui']
        : category === 'Project font' ? (!fontFamilies.some(font => font.family === node.fontFamily) && !['sans-serif', 'serif', 'monospace', 'system-ui'].includes(node.fontFamily) ? [node.fontFamily] : [])
        : fontFamilies.filter(font => font.category === category).map(font => font.family);
      if (!names.length) continue;
      const group = element(doc, 'optgroup'); group.label = category;
      for (const name of names) { const option = element(doc, 'option', '', name); option.value = name; group.append(option); }
      familyPicker.append(group);
    }
    familyPicker.value = node.fontFamily;
    familyPicker.onchange = () => edit(n => { if (n.type === 'text') n.fontFamily = familyPicker.value; });
    field(doc, appearance, 'Font family', familyPicker);
    const sample = element(doc, 'p', 'ms-font-sample', 'The quick brown fox · Aa 0123');
    sample.style.fontFamily = ['sans-serif', 'serif', 'monospace', 'system-ui'].includes(node.fontFamily) ? node.fontFamily : `"${node.fontFamily.replace(/["\\\n\r]/g, '')}", sans-serif`;
    sample.style.fontWeight = String(node.fontWeight); sample.setAttribute('aria-label', `Font sample: ${node.fontFamily}`); appearance.append(sample);
    const typography = element(doc, 'div', 'ms-field-pair'); appearance.append(typography);
    field(doc, typography, 'Font size', number(doc, node.fontSize, value => edit(n => { if (n.type === 'text') n.fontSize = value; }), 1, 4096));
    field(doc, typography, 'Font weight', number(doc, node.fontWeight, value => edit(n => { if (n.type === 'text') n.fontWeight = value; }), 1, 1000, 100));
    field(doc, appearance, 'Alignment', select(doc, ['left', 'center', 'right'], node.align, value => edit(n => { if (n.type === 'text') n.align = value as 'left' | 'center' | 'right'; })));
  } else if (node.type === 'mesh') {
    const meshEdit = (fn: (mesh: MeshNode) => void) => edit(n => { if (n.type === 'mesh') fn(n); });
    field(doc, group, 'Geometry', select(doc, ['box', 'rounded-box', 'sphere', 'torus', 'cylinder', 'cone', 'icosahedron'], node.geometry, value => meshEdit(n => { n.geometry = value as MeshNode['geometry']; })));
    field(doc, group, 'Depth', number(doc, node.depth, value => meshEdit(n => { n.depth = value; }), .1, 4096, 1));
    const bevel = number(doc, node.bevel, value => meshEdit(n => { n.bevel = value; }), 0, 1024, 1);
    bevel.disabled = node.geometry !== 'rounded-box';
    if (bevel.disabled) bevel.title = 'Bevel applies to rounded-box geometry.';
    if (!bevel.disabled) field(doc, group, 'Bevel', bevel);
    const segments = number(doc, node.segments, value => meshEdit(n => { n.segments = Math.round(value); }), 8, 64, 1);
    segments.disabled = node.geometry === 'box';
    if (segments.disabled) segments.title = 'Box geometry has flat faces; choose a curved geometry to edit subdivisions.';
    if (!segments.disabled) field(doc, group, 'Segments', segments);
    field(doc, appearance, 'Cast shadow', check(doc, node.castShadow, value => meshEdit(n => { n.castShadow = value; })));
    field(doc, appearance, 'Receive shadow', check(doc, node.receiveShadow, value => meshEdit(n => { n.receiveShadow = value; })));
    group.append(element(doc, 'p', 'ms-hint', 'Depth sets the volume from front to back. Segments control surface smoothness.'));
    const material = disclosure(doc, appearance, 'Physical material');
    materialInspector(doc, material, node.material, value => meshEdit(n => { n.material = value; }));
  } else if (node.type === 'shape') {
    field(doc, group, 'Shape', select(doc, ['rectangle', 'ellipse', 'ring'], node.shape, value => edit(n => {
      if (n.type !== 'shape') return;
      n.shape = value as 'rectangle' | 'ellipse' | 'ring';
      if (value === 'ring') { if (n.stroke === 'transparent') n.stroke = n.fill; if (!n.strokeWidth) n.strokeWidth = Math.min(n.width, n.height) * .08; }
    })));
    if (node.shape !== 'ring') field(doc, appearance, 'Fill', color(doc, node.fill, value => edit(n => { if (n.type === 'shape') n.fill = value; })));
    field(doc, appearance, 'Stroke', color(doc, node.stroke, value => edit(n => { if (n.type === 'shape') n.stroke = value; })));
    field(doc, appearance, 'Stroke width', number(doc, node.strokeWidth, value => edit(n => { if (n.type === 'shape') n.strokeWidth = value; }), 0, 300));
    if (node.shape === 'ring') appearance.append(element(doc, 'p', 'ms-hint', node.strokeWidth === 0 ? `Automatic stroke: ${Math.round(Math.min(node.width, node.height) * .1 * 100) / 100} px. Set a width above 0 to customize.` : 'Set stroke width to 0 for automatic sizing (10% of the shorter side).'));
    if (node.shape === 'rectangle') field(doc, appearance, 'Radius', number(doc, node.radius, value => edit(n => { if (n.type === 'shape') n.radius = value; }), 0, 4096));
    field(doc, appearance, 'Blur', number(doc, node.blur, value => edit(n => { if (n.type === 'shape') n.blur = value; }), 0, 100));
  }
  const transform = disclosure(doc, parent, 'Size & position', true);
  const alignment = element(doc, 'div', 'ms-alignment');
  alignment.append(element(doc, 'span', 'ms-hint', 'Align to canvas'));
  const alignButtons = element(doc, 'div', 'ms-actions ms-icon-row'); alignButtons.setAttribute('role', 'group'); alignButtons.setAttribute('aria-label', 'Align to canvas');
  for (const [value, label, icon] of [
    ['left', 'Align left', 'AlignStartVertical'], ['center-x', 'Align horizontal center', 'AlignCenterVertical'], ['right', 'Align right', 'AlignEndVertical'],
    ['top', 'Align top', 'AlignStartHorizontal'], ['center-y', 'Align vertical center', 'AlignCenterHorizontal'], ['bottom', 'Align bottom', 'AlignEndHorizontal'],
  ] as const) {
    const control = button(doc, label, () => ctx.align(value)); setButtonContent(control, label, icon, true);
    control.disabled = node.locked || !node.visible || node.opacity <= 0; alignButtons.append(control);
  }
  alignment.append(alignButtons); transform.append(alignment);
  transform.append(element(doc, 'p', 'ms-hint', 'Position is measured from the center of the layer, in canvas pixels.'));
  const dimensions = [ ['x', 'Center X', -1e7, 1e7, 1], ['y', 'Center Y', -1e7, 1e7, 1], ['width', 'Width', .001, 131072, 1], ['height', 'Height', .001, 131072, 1], ['scale', 'Scale', .0001, 1000, .05], ['rotation', 'Rotation', -1e6, 1e6, 1] ] as const;
  dimensions.forEach(([key, label, min, max, step], i) => {
    if (i % 2 === 0) transform.append(element(doc, 'div', 'ms-field-pair'));
    field(doc, transform.lastElementChild as HTMLElement, label, number(doc, node[key], value => edit(n => { n[key] = value; }), min, max, step));
  });
  field(doc, transform, 'Opacity', number(doc, node.opacity * 100, value => edit(n => { n.opacity = value / 100; }), 0, 100));
  const perspective = disclosure(doc, transform, 'Perspective');
  for (const [key, label] of [['tiltX', 'Tilt X'], ['tiltY', 'Tilt Y']] as const) field(doc, perspective, label, number(doc, node[key], value => edit(n => { n[key] = value; }), -89, 89));
  if (ctx.supportsSpatial && (scene.spatial?.enabled || scene.nodes.some(n => n.type === 'mesh'))) field(doc, transform, 'Depth position Z', number(doc, node.z ?? 0, value => edit(n => { n.z = value; }), -4096, 8192));
  if (node.type === 'mockup' && !physicalGlass) field(doc, appearance, 'Lighting', number(doc, node.lighting, value => edit(n => { if (n.type === 'mockup') n.lighting = value; }), 0, 1, .05));
  if (node.type === 'mockup' && !spatialActive) {
    const shadow = disclosure(doc, appearance, 'Shadow & light');
    field(doc, shadow, 'Shadow color', color(doc, node.shadow.color, value => edit(n => { if (n.type === 'mockup') n.shadow.color = value; })));
    for (const [key, label, min, max, step] of [['opacity', 'Strength', 0, 1, .05], ['blur', 'Blur', 0, 300, 1], ['spread', 'Spread', -100, 200, 1], ['offsetX', 'Offset X', -300, 300, 1], ['offsetY', 'Offset Y', -300, 300, 1]] as const) field(doc, shadow, label, number(doc, node.shadow[key], value => edit(n => { if (n.type === 'mockup') n.shadow[key] = value; }), min, max, step));
  }
  // Keep content and common transforms ahead of appearance and advanced controls.
  parent.append(group, transform.parentElement!, appearance);
  const motion = disclosure(doc, parent, 'Motion');
  const activeMotion = currentMotion(scene, node);
  let pending = pendingMotion.get(parent); if (!pending) { pending = new Map(); pendingMotion.set(parent, pending); }
  for (const id of pending.keys()) if (!scene.nodes.some(n => n.id === id)) pending.delete(id);
  motion.append(element(doc, 'p', 'ms-hint', `Current motion: ${activeMotion === 'none' ? 'None' : activeMotion === 'custom' ? 'Custom' : motionLabels[activeMotion]}`));
  const picker = select(doc, animationPresets.map(value => ({ value, label: motionLabels[value] })), pending.get(node.id) ?? (animationPresets.includes(activeMotion as AnimationPreset) ? activeMotion : 'float'), value => { pending!.set(node.id, value as AnimationPreset); });
  field(doc, motion, 'Animation preset', picker);
  const motionActions = element(doc, 'div', 'ms-actions');
  motionActions.append(button(doc, activeMotion === 'none' ? 'Apply motion' : 'Replace motion', () => update(draft => {
    const current = draft.nodes.find(n => n.id === node.id)!;
    if (!current || current.locked) return;
    draft.tracks = draft.tracks.filter(t => t.nodeId !== node.id);
    draft.tracks.push(...createAnimationTracks(current, picker.value as AnimationPreset, draft.duration));
  })));
  const clear = button(doc, 'Clear motion', () => update(draft => { if (!draft.nodes.find(n => n.id === node.id)?.locked) draft.tracks = draft.tracks.filter(t => t.nodeId !== node.id); }));
  clear.disabled = activeMotion === 'none'; motionActions.append(clear);
  motion.append(motionActions, element(doc, 'p', 'ms-hint', 'Apply an animation, then open Animation below the canvas to preview it.'));
  parent.append(actions);
  for (const row of parent.querySelectorAll<HTMLElement>('.ms-field')) {
    if (row.querySelector('select,textarea,[aria-label="Layer name"]')) row.classList.add('ms-field-full');
    const control = row.querySelector<HTMLInputElement>('input[type=number]');
    if (control) {
      const label = control.getAttribute('aria-label')!;
      const unit = label === 'Opacity' ? '%' : /Rotation|Tilt/.test(label) ? '°' : label === 'Scale' ? '×' : /Width|Height|Center|Depth|radius|Radius|Blur|blur|Offset|Stroke width|Font size|Bevel|spread|Spread|Thickness/.test(label) ? 'px' : '';
      if (unit) { const wrap = element(doc, 'span', 'ms-number-control'); control.before(wrap); wrap.append(control, element(doc, 'span', 'ms-unit', unit)); }
    }
  }
  enhanceLayerFields(parent);
  if (node.locked) for (const control of parent.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea,button')) {
    if (!control.dataset.unlock && !control.classList.contains('ms-properties-close')) control.disabled = true;
  }
  restoreGroups();
}

function canvasInspector(ctx: InspectorContext): void {
  const { doc, parent, scene, update } = ctx;
  spatialInspector(ctx);
  const size = section(doc, parent, 'Artboard');
  const projectName = text(doc, scene.name, value => update(d => { d.name = value.trim() || d.name; })); projectName.maxLength = 1024;
  field(doc, size, 'Project name', projectName);
  const resize = (width: number, height: number) => update(draft => {
    const sx = width / draft.width, sy = height / draft.height;
    draft.width = width; draft.height = height;
    for (const node of draft.nodes) editNode(draft, node.id, n => { n.x *= sx; n.y *= sy; });
  });
  field(doc, size, 'Social frame', select(doc, [{ value: '', label: 'Custom size' }, ...framePresets.map(p => ({ value: p.id, label: p.name }))], framePresets.find(p => p.width === scene.width && p.height === scene.height)?.id ?? '', id => { const p = framePresets.find(p => p.id === id); if (p) resize(p.width, p.height); }));
  const maxSide = scene.spatial?.enabled || scene.nodes.some(n => n.type === 'mesh') ? 4096 : 8192;
  field(doc, size, 'Width', number(doc, scene.width, value => resize(value, scene.height), 1, maxSide));
  field(doc, size, 'Height', number(doc, scene.height, value => resize(scene.width, value), 1, maxSide));
  const bg = scene.background, background = section(doc, parent, 'Background');
  background.append(button(doc, 'Generate from media', ctx.generateBackground));
  field(doc, background, 'Type', select(doc, ['solid', 'gradient', 'image', 'transparent'], bg.type, type => update(draft => {
    if (type === 'transparent') draft.background = { type };
    if (type === 'solid') draft.background = { type, color: '#dce4f4' };
    if (type === 'gradient') draft.background = { type, kind: 'linear', angle: 135, stops: [{ offset: 0, color: '#dfeaff' }, { offset: 1, color: '#a4b8db' }] };
    if (type === 'image') {
      const asset = draft.assets.find(a => a.kind === 'image');
      if (!asset) throw new Error('Import an image first, then choose an image background.');
      draft.background = { type, assetId: asset.id, fit: 'cover', blur: 0, dim: 0 };
    }
  })));
  if (bg.type === 'solid') field(doc, background, 'Color', color(doc, bg.color, value => update(d => { if (d.background.type === 'solid') d.background.color = value; })));
  if (bg.type === 'gradient') {
    field(doc, background, 'Gradient', select(doc, ['linear', 'radial'], bg.kind, value => update(d => { if (d.background.type === 'gradient') d.background.kind = value as 'linear' | 'radial'; })));
    bg.stops.forEach((stop, i) => field(doc, background, `Color ${i + 1}`, color(doc, stop.color, value => update(d => { if (d.background.type === 'gradient') d.background.stops[i]!.color = value; }))));
    field(doc, background, 'Angle °', number(doc, bg.angle, value => update(d => { if (d.background.type === 'gradient') d.background.angle = value; }), -360, 360));
    field(doc, background, 'Motion speed', number(doc, bg.speed ?? 0, value => update(d => { if (d.background.type === 'gradient') d.background.speed = value; }), -10, 10, .1));
  }
  if (bg.type === 'image') {
    field(doc, background, 'Image', select(doc, scene.assets.filter(a => a.kind === 'image').map(a => ({ value: a.id, label: a.name || a.id })), bg.assetId, value => update(d => { if (d.background.type === 'image') d.background.assetId = value; })));
    field(doc, background, 'Fit', select(doc, [{value:'cover',label:'cover'}, {value:'contain',label:'contain'}, {value:'stretch',label:'Stretch'}], bg.fit, value => update(d => { if (d.background.type === 'image') d.background.fit = value as Fit; })));
    field(doc, background, 'Blur', number(doc, bg.blur, value => update(d => { if (d.background.type === 'image') d.background.blur = value; }), 0, 100));
    field(doc, background, 'Dim', number(doc, bg.dim, value => update(d => { if (d.background.type === 'image') d.background.dim = value; }), 0, 1, .05));
  }
  const effects = section(doc, parent, 'Finishing');
  for (const key of ['noise', 'vignette', 'saturation', 'contrast', 'brightness', 'scanlines', 'glitch'] as const) field(doc, effects, key[0]!.toUpperCase() + key.slice(1), number(doc, scene.effects[key], value => update(d => { d.effects[key] = value; }), 0, ['saturation', 'contrast', 'brightness'].includes(key) ? 4 : 1, .05));
  const timing = section(doc, parent, 'Timeline settings');
  field(doc, timing, 'Duration (s)', number(doc, scene.duration, value => update(d => {
    const ratio = value / d.duration;
    for (const track of d.tracks) for (const frame of track.keyframes) frame.time *= ratio;
    d.duration = value;
  }), .1, 3600, .1));
  field(doc, timing, 'Frame rate', number(doc, scene.fps, value => update(d => { d.fps = value; }), 1, 240));
  field(doc, timing, 'Random seed', number(doc, scene.seed, value => update(d => { d.seed = Math.round(value); }), 0, 4294967295));
}

/** Every physical parameter is scene data, so preview, JSON and exports agree. */
function materialInspector(doc: Document, parent: HTMLElement, material: PhysicalMaterial, change: (material: PhysicalMaterial) => void): void {
  const kinds = ['glass', 'metal', 'ceramic', 'plastic'] as const;
  const current = kinds.find(kind => { const preset = createMaterialPreset(kind); return (Object.keys(preset) as (keyof PhysicalMaterial)[]).every(key => preset[key] === material[key]); }) ?? '';
  const presets = select(doc, [{ value: '', label: 'Custom material' }, ...kinds], current, value => {
    if (value) change(createMaterialPreset(value as 'glass' | 'metal' | 'ceramic' | 'plastic'));
  });
  presets.options[0]!.disabled = true;
  field(doc, parent, 'Material preset', presets);
  parent.append(element(doc, 'p', 'ms-hint', 'Roughness softens reflections. Transmission controls transparency; IOR controls how strongly glass bends light.'));
  for (const [key, label] of [['color', 'Material color'], ['attenuationColor', 'Attenuation color']] as const) {
    field(doc, parent, label, color(doc, material[key], value => change({ ...material, [key]: value })));
  }
  const properties = [
    ['metalness', 'Metalness', 0, 1, .05], ['roughness', 'Roughness', 0, 1, .01],
    ['transmission', 'Transmission', 0, 1, .01], ['ior', 'IOR', 1, 2.5, .01],
    ['thickness', 'Thickness', 0, 1000, 1], ['attenuationDistance', 'Attenuation distance', 1, 100000, 10],
    ['clearcoat', 'Clearcoat', 0, 1, .05], ['clearcoatRoughness', 'Clearcoat roughness', 0, 1, .01],
    ['dispersion', 'Dispersion', 0, 1, .01],
  ] as const;
  for (const [key, label, min, max, step] of properties) field(doc, parent, label, number(doc, material[key], value => change({ ...material, [key]: value }), min, max, step));
}

function spatialInspector(ctx: InspectorContext): void {
  const { doc, parent, scene, update } = ctx;
  const group = section(doc, parent, 'Spatial studio');
  const enable = check(doc, scene.spatial?.enabled ?? false, value => update(draft => {
    draft.spatial = createSpatialSettings({ ...draft.spatial, enabled: value });
  }));
  enable.disabled = !ctx.supportsSpatial;
  if (!ctx.supportsSpatial) enable.title = 'Pass a SpatialRenderer through rendererFactory to enable 3D lighting and materials.';
  field(doc, group, 'Enable spatial', enable);
  if (!ctx.supportsSpatial) { group.append(element(doc, 'p', 'ms-hint', 'CanvasRenderer is 2D only. SpatialRenderer enables volumes, physical glass and studio lighting.')); return; }
  if (scene.nodes.some(n => n.type === 'mesh')) group.append(element(doc, 'p', 'ms-hint', '3D meshes always use the spatial renderer. Enable spatial for physical glass mockups and studio settings.'));
  if (!scene.spatial?.enabled && !scene.nodes.some(n => n.type === 'mesh')) return;
  const settings = scene.spatial ?? createSpatialSettings();
  const edit = (fn: (settings: SpatialSettings) => void) => update(draft => {
    draft.spatial ??= createSpatialSettings(); fn(draft.spatial);
  });
  field(doc, group, 'Ambient color', color(doc, settings.ambientColor, value => edit(s => { s.ambientColor = value; })));
  for (const [key, label, min, max] of [['ambientIntensity', 'Ambient intensity', 0, 5], ['environmentIntensity', 'Environment intensity', 0, 5], ['exposure', 'Exposure', .1, 5], ['shadowOpacity', 'Shadow opacity', 0, 1]] as const) {
    field(doc, group, label, number(doc, settings[key], value => edit(s => { s[key] = value; }), min, max, .05));
  }
  field(doc, group, 'Quality', select(doc, ['low', 'medium', 'high'], settings.quality, value => edit(s => { s.quality = value as SpatialSettings['quality']; })));
  field(doc, group, 'Studio shadows', check(doc, settings.shadows, value => edit(s => { s.shadows = value; })));
  group.append(element(doc, 'p', 'ms-hint', 'Procedural reflections · No external HDR assets. Spatial output: 4096 px per side, up to 16 MP.'));
  const lights = section(doc, parent, `Studio lights · ${settings.lights.length}/6`);
  const add = button(doc, 'Add light', () => edit(s => {
    if (s.lights.length >= 6) return;
    s.lights.push({ id: uid('light'), type: 'point', color: '#ffffff', intensity: 3, x: scene.width * .5, y: scene.height * .25, z: 700, castShadow: true });
  }));
  add.disabled = settings.lights.length >= 6;
  if (add.disabled) add.title = 'Maximum six studio lights. Remove a light before adding another.';
  lights.append(add);
  settings.lights.forEach((light, index) => {
    const card = element(doc, 'div', 'ms-light-card');
    card.append(element(doc, 'h4', '', `Light ${index + 1}`)); lights.append(card);
    const change = (fn: (light: SpatialLight) => void) => edit(s => { const current = s.lights.find(l => l.id === light.id); if (current) fn(current); });
    // Unique accessible names retain focus correctly across inspector re-renders.
    const label = (name: string) => `Light ${index + 1} ${name}`;
    field(doc, card, label('type'), select(doc, ['directional', 'point'], light.type, value => change(l => { l.type = value as SpatialLight['type']; })));
    field(doc, card, label('color'), color(doc, light.color, value => change(l => { l.color = value; })));
    field(doc, card, label('intensity'), number(doc, light.intensity, value => change(l => { l.intensity = value; }), 0, 20, .1));
    for (const key of ['x', 'y', 'z'] as const) field(doc, card, label(key.toUpperCase()), number(doc, light[key], value => change(l => { l[key] = value; }), key === 'z' ? -4096 : -32768, key === 'z' ? 8192 : 32768));
    field(doc, card, label('cast shadow'), check(doc, light.castShadow, value => change(l => { l.castShadow = value; })));
    card.append(button(doc, `Remove light ${index + 1}`, () => edit(s => { s.lights = s.lights.filter(l => l.id !== light.id); })));
  });
  if (!settings.lights.length) lights.append(element(doc, 'p', 'ms-hint', 'No direct lights. Ambient and environment illumination still apply.'));
}
