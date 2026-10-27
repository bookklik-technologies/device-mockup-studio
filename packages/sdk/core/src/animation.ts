import { StudioError } from './types.js';
import type { AnimatableProperty, AnimationTrack, Easing, SceneDocument, SceneNode } from './types.js';
import { uid } from './factories.js';
import { cloneScene } from './serialization.js';
import { clamp, lerp } from './utils.js';
import { propertyBounds } from './validation.js';

export const animationPresets = Object.freeze(['float', 'orbit', 'reveal', 'zoom', 'parallax', 'fade-in', 'fade-out', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'pulse', 'bounce', 'sway', 'spin', 'flip'] as const);
export type AnimationPreset = typeof animationPresets[number];
/** Easing belongs to the outgoing (left) keyframe. Spring is a damped, normalized step response. */
export function ease(progress: number, easing: Easing = 'linear'): number {
  const t = clamp(progress, 0, 1);
  if (t === 0 || t === 1) return t;
  switch (easing) {
    case 'linear': return t;
    case 'ease-in': return t * t;
    case 'ease-out': return 1 - (1 - t) ** 2;
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    case 'spring': { const response = (x: number): number => 1 - Math.exp(-7 * x) * Math.cos(10 * x); return response(t) / response(1); }
  }
}
export function evaluateScene(scene: SceneDocument, time: number): SceneDocument {
  if (!Number.isFinite(time)) throw new StudioError('INVALID_TIME', 'Animation time must be finite seconds.');
  const output = cloneScene(scene), t = clamp(time, 0, scene.duration);
  const nodes = new Map(output.nodes.map(node => [node.id, node]));
  for (const track of output.tracks) {
    const node = nodes.get(track.nodeId)!;
    const keys = track.keyframes;
    let value = keys[0]!.value;
    if (t >= keys[keys.length - 1]!.time) value = keys[keys.length - 1]!.value;
    else if (t > keys[0]!.time) {
      // Binary search the right edge; deterministic for arbitrary keyframe spacing.
      let lo = 1, hi = keys.length - 1;
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (keys[mid]!.time <= t) lo = mid + 1; else hi = mid; }
      const left = keys[lo - 1]!, right = keys[lo]!;
      value = lerp(left.value, right.value, ease((t - left.time) / (right.time - left.time), left.easing));
    }
    const bounds = propertyBounds[track.property]!;
    node[track.property] = clamp(value, bounds[0], bounds[1]);
  }
  return output;
}
/** Presets are relative to base values. Float/orbit/parallax/pulse/bounce/sway/spin loop visually;
 * entrances and fades play once over the scene duration and hold their endpoint. */
export function createAnimationTracks(node: SceneNode, preset: AnimationPreset, duration = 4): AnimationTrack[] {
  if (!Number.isFinite(duration) || duration < 0.001 || duration > 3600) throw new StudioError('INVALID_DURATION', 'Animation duration must be between 0.001 and 3600 seconds.');
  const track = (property: AnimatableProperty, values: number[], easing: Easing = 'ease-in-out'): AnimationTrack => {
    const bounds = propertyBounds[property]!;
    if (!Number.isFinite(node[property])) throw new StudioError('INVALID_NODE', `Node ${property} must be finite.`);
    return { id: uid('track'), nodeId: node.id, property, keyframes: values.map((value, i) => ({ time: duration * i / (values.length - 1), value: clamp(value, bounds[0], bounds[1]), easing })) };
  };
  const distance = Math.min(node.width, node.height) * 0.06;
  switch (preset) {
    case 'float': return [track('y', [node.y, node.y - distance, node.y]), track('rotation', [node.rotation - 1.5, node.rotation + 1.5, node.rotation - 1.5])];
    case 'orbit': return [track('x', [node.x, node.x + distance, node.x, node.x - distance, node.x]), track('y', [node.y - distance, node.y, node.y + distance, node.y, node.y - distance]), track('tiltY', [node.tiltY - 7, node.tiltY, node.tiltY + 7, node.tiltY, node.tiltY - 7])];
    case 'reveal': return [track('opacity', [0, node.opacity, node.opacity], 'ease-out'), track('y', [node.y + distance * 2, node.y, node.y], 'ease-out')];
    case 'zoom': return [track('scale', [node.scale * 0.85, node.scale], 'ease-out')];
    case 'parallax': return [track('tiltX', [node.tiltX - 5, node.tiltX + 5, node.tiltX - 5]), track('tiltY', [node.tiltY + 9, node.tiltY - 9, node.tiltY + 9]), track('x', [node.x - distance / 2, node.x + distance / 2, node.x - distance / 2])];
    case 'fade-in': return [track('opacity', [0, node.opacity], 'ease-out')];
    case 'fade-out': return [track('opacity', [node.opacity, 0], 'ease-in')];
    case 'slide-left': return [track('x', [node.x - node.width * node.scale * .45, node.x, node.x], 'ease-out'), track('opacity', [0, node.opacity, node.opacity], 'ease-out')];
    case 'slide-right': return [track('x', [node.x + node.width * node.scale * .45, node.x, node.x], 'ease-out'), track('opacity', [0, node.opacity, node.opacity], 'ease-out')];
    case 'slide-up': return [track('y', [node.y + node.height * node.scale * .45, node.y, node.y], 'ease-out'), track('opacity', [0, node.opacity, node.opacity], 'ease-out')];
    case 'slide-down': return [track('y', [node.y - node.height * node.scale * .45, node.y, node.y], 'ease-out'), track('opacity', [0, node.opacity, node.opacity], 'ease-out')];
    case 'pulse': return [track('scale', [node.scale, node.scale * 1.08, node.scale])];
    case 'bounce': {
      const bounce = track('y', [node.y, node.y - distance * 2, node.y, node.y - distance, node.y, node.y - distance * .4, node.y]);
      bounce.keyframes.forEach((key, index) => { key.easing = index % 2 === 0 ? 'ease-out' : 'ease-in'; });
      return [bounce];
    }
    case 'sway': return [track('rotation', [node.rotation, node.rotation + 5, node.rotation, node.rotation - 5, node.rotation])];
    case 'spin': return [track('rotation', [node.rotation, node.rotation + 360], 'linear')];
    case 'flip': return [track('tiltY', [node.tiltY - 65, node.tiltY, node.tiltY], 'ease-out'), track('opacity', [0, node.opacity, node.opacity], 'ease-out')];
    default: throw new StudioError('UNKNOWN_ANIMATION', `Unknown animation preset: ${String(preset)}`);
  }
}
