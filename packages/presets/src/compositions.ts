import { assertScene, clamp, cloneScene, StudioError } from '@bookklik/device-mockup-studio-core';
import type { AnimatableProperty, Background, MockupNode, MockupStyle, SceneDocument, SceneEffects, ScenePreset } from '@bookklik/device-mockup-studio-core';
import { getDevice } from './devices.js';

type Layout = 'center' | 'left' | 'right' | 'diagonal' | 'duo' | 'stack' | 'gallery' | 'portrait' | 'hero' | 'fan' | 'wall' | 'inset';
interface Recipe { id: string; name: string; category: string; background: Background; layout: Layout; style: MockupStyle; frameColor: string; rotation?: number; tiltX?: number; tiltY?: number; effects?: Partial<SceneEffects> }
function gradient(colors: string[], angle = 135, kind: 'linear' | 'radial' = 'linear'): Background {
  return { type: 'gradient', kind, angle, stops: colors.map((color, i) => ({ color, offset: i / (colors.length - 1) })) };
}
/** Original art direction: color fields and layouts generated solely from scene dimensions. */
const recipes: Recipe[] = [
  { id: 'aurora-field', name: 'Aurora Field', category: 'gradient', background: gradient(['#e4f7d2', '#89d5d1', '#8e99e6']), layout: 'center', style: 'glass-light', frameColor: '#dcefeb', tiltX: 5, tiltY: -7 },
  { id: 'midnight-signal', name: 'Midnight Signal', category: 'dark', background: gradient(['#253876', '#101629', '#060b14'], 45, 'radial'), layout: 'hero', style: 'glass-dark', frameColor: '#141d34', tiltX: 9, tiltY: -13, effects: { vignette: 0.42, noise: 0.035 } },
  { id: 'paper-margin', name: 'Paper Margin', category: 'editorial', background: { type: 'solid', color: '#f0eade' }, layout: 'right', style: 'border', frameColor: '#fcfaf4', rotation: -3, effects: { noise: 0.045 } },
  { id: 'coral-current', name: 'Coral Current', category: 'gradient', background: gradient(['#fce1b6', '#f49a85', '#d55d87'], 120), layout: 'diagonal', style: 'default', frameColor: '#552539', rotation: -9, tiltY: 8 },
  { id: 'cobalt-edition', name: 'Cobalt Edition', category: 'bold', background: { type: 'solid', color: '#2546e8' }, layout: 'left', style: 'outline', frameColor: '#101956', rotation: 5, effects: { contrast: 1.06 } },
  { id: 'lavender-drift', name: 'Lavender Drift', category: 'soft', background: gradient(['#f4e6ff', '#c4b2ec', '#91a9dc'], 25), layout: 'stack', style: 'liquid-glass', frameColor: '#eee4ff', rotation: -5, tiltX: 8 },
  { id: 'mint-archive', name: 'Mint Archive', category: 'editorial', background: { type: 'solid', color: '#d4e9dc' }, layout: 'gallery', style: 'inset-light', frameColor: '#f3faf5', effects: { noise: 0.025 } },
  { id: 'burnt-sienna', name: 'Burnt Sienna', category: 'warm', background: gradient(['#2d181a', '#9f503e', '#e2a26d'], 65), layout: 'right', style: 'inset-dark', frameColor: '#2d2422', tiltX: 7, tiltY: -11, effects: { vignette: 0.2 } },
  { id: 'split-dialogue', name: 'Split Dialogue', category: 'multi-device', background: gradient(['#e7ecfa', '#c1c8e3'], 0), layout: 'duo', style: 'default', frameColor: '#20283c', rotation: -5 },
  { id: 'gallery-noir', name: 'Gallery Noir', category: 'multi-device', background: { type: 'solid', color: '#17191b' }, layout: 'gallery', style: 'border', frameColor: '#323638', effects: { noise: 0.03, saturation: 0.8 } },
  { id: 'sunrise-portrait', name: 'Sunrise Portrait', category: 'portrait', background: gradient(['#fff4d0', '#ffd0b4', '#eea8bb'], 90), layout: 'portrait', style: 'glass-light', frameColor: '#fff0da', rotation: 3 },
  { id: 'prism-fan', name: 'Prism Fan', category: 'multi-device', background: gradient(['#f2b4bc', '#c3a9df', '#a5cee4'], 155), layout: 'fan', style: 'liquid-glass', frameColor: '#e7ddf6', rotation: -8, tiltY: 9 },
  { id: 'blueprint-wall', name: 'Blueprint Wall', category: 'multi-device', background: gradient(['#11243e', '#21536c'], 90), layout: 'wall', style: 'outline', frameColor: '#153749', tiltX: 14, tiltY: -12, effects: { scanlines: 0.035 } },
  { id: 'quiet-mono', name: 'Quiet Mono', category: 'minimal', background: { type: 'solid', color: '#e3e4e5' }, layout: 'inset', style: 'inset-light', frameColor: '#f4f4f4', effects: { saturation: 0, contrast: 1.04 } },
  { id: 'citrus-punch', name: 'Citrus Punch', category: 'bold', background: gradient(['#f1f974', '#bbdb48'], 40), layout: 'hero', style: 'border', frameColor: '#243c23', rotation: 8, tiltY: -6 },
  { id: 'rose-studio', name: 'Rose Studio', category: 'soft', background: gradient(['#eee0dc', '#c7a6a7', '#8d7d91'], 115, 'radial'), layout: 'center', style: 'glass-dark', frameColor: '#493d49', tiltX: -6, tiltY: 6, effects: { noise: 0.02, vignette: 0.12 } },
];

function place(node: MockupNode, index: number, count: number, recipe: Recipe, width: number, height: number): void {
  let cx = 0.5, cy = 0.5, boxWidth = 0.74, boxHeight = 0.73, rotation = recipe.rotation ?? 0;
  const fraction = count <= 1 ? 0 : index / (count - 1) - 0.5;
  switch (recipe.layout) {
    case 'center': cx += fraction * 0.25; cy += fraction * 0.12; boxWidth = count > 1 ? 0.6 : 0.74; break;
    case 'left': cx = 0.41 + fraction * 0.15; cy = 0.51 + fraction * 0.1; boxWidth = 0.66; break;
    case 'right': cx = 0.59 + fraction * 0.15; cy = 0.52 + fraction * 0.1; boxWidth = 0.66; break;
    case 'diagonal': cx = 0.5 + fraction * 0.46; cy = 0.5 - fraction * 0.3; boxWidth = count > 1 ? 0.52 : 0.76; boxHeight = 0.68; break;
    case 'duo': cx = count <= 1 ? 0.5 : 0.22 + index * 0.56 / Math.max(1, count - 1); cy = index % 2 ? 0.55 : 0.46; boxWidth = count <= 1 ? 0.64 : Math.max(0.12, 0.8 / count); boxHeight = 0.7; rotation *= index % 2 ? -1 : 1; break;
    case 'stack': cx = 0.5 + fraction * 0.2; cy = 0.5 + fraction * 0.24; boxWidth = 0.64; boxHeight = 0.65; rotation += fraction * 10; break;
    case 'gallery': case 'wall': {
      const columns = Math.ceil(Math.sqrt(count * width / height)); const rows = Math.ceil(count / columns);
      cx = (index % columns + 0.5) / columns; cy = (Math.floor(index / columns) + 0.5) / rows; boxWidth = 0.82 / columns; boxHeight = 0.78 / rows; break;
    }
    case 'portrait': cx = 0.5 + fraction * 0.36; cy = 0.5; boxWidth = count > 1 ? 0.48 : 0.58; boxHeight = 0.83; break;
    case 'hero': cx = 0.5 + fraction * 0.22; cy = 0.52 + fraction * 0.13; boxWidth = 0.83; boxHeight = 0.8; break;
    case 'fan': cx = 0.5 + fraction * 0.42; cy = 0.52 + Math.abs(fraction) * 0.08; rotation += fraction * 24; boxWidth = 0.55; boxHeight = 0.69; break;
    case 'inset': cx += fraction * 0.2; boxWidth = 0.61; boxHeight = 0.62; break;
  }
  let aspect = node.width / node.height;
  try { aspect = getDevice(node.deviceId).aspect; } catch { /* Custom project ids can be registered after project loading. */ }
  const w = Math.min(width * boxWidth, height * boxHeight * aspect);
  node.x = width * cx; node.y = height * cy; node.width = Math.max(0.001, w); node.height = Math.max(0.001, w / aspect); node.scale = 1;
  node.rotation = rotation; node.tiltX = recipe.tiltX ?? 0; node.tiltY = recipe.tiltY ?? 0; node.style = recipe.style; node.frameColor = recipe.frameColor;
  node.shadow = { ...node.shadow, opacity: recipe.category === 'minimal' ? 0.15 : 0.28, blur: Math.min(width, height) * 0.045, spread: 0, offsetX: 0, offsetY: Math.min(width, height) * 0.03 };
}
const bounds: Readonly<Record<AnimatableProperty, readonly [number, number]>> = { x: [-1e7, 1e7], y: [-1e7, 1e7], width: [0.001, 131072], height: [0.001, 131072], scale: [0.0001, 1000], rotation: [-1e6, 1e6], tiltX: [-89, 89], tiltY: [-89, 89], opacity: [0, 1] };
function applyRecipe(scene: SceneDocument, recipe: Recipe): SceneDocument {
  const output = cloneScene(scene);
  output.background = structuredClone(recipe.background);
  output.effects = { ...output.effects, ...recipe.effects };
  const nodes = output.nodes.filter((node): node is MockupNode => node.type === 'mockup' && !node.locked && node.visible);
  nodes.forEach((node, i) => {
    const before = { ...node };
    place(node, i, nodes.length, recipe, output.width, output.height);
    // Move existing animation coordinates with the layout; retain ids, keyframe timing and easing.
    for (const track of output.tracks) if (track.nodeId === node.id) {
      const property = track.property, [min, max] = bounds[property];
      const proportional = property === 'width' || property === 'height' || property === 'scale';
      for (const frame of track.keyframes) frame.value = clamp(proportional ? frame.value * node[property] / before[property] : frame.value + node[property] - before[property], min, max);
    }
  });
  assertScene(output);
  return output;
}
/** Fresh descriptors per call, no mutable recipe state escapes. Empty scenes remain empty. */
export function getPresets(): ScenePreset[] { return recipes.map(recipe => ({ id: recipe.id, name: recipe.name, category: recipe.category, apply: scene => applyRecipe(scene, recipe) })); }
export function applyPreset(scene: SceneDocument, id: string): SceneDocument {
  const recipe = recipes.find(candidate => candidate.id === id);
  if (!recipe) throw new StudioError('UNKNOWN_PRESET', `Unknown composition preset: ${id}`);
  return applyRecipe(scene, recipe);
}
