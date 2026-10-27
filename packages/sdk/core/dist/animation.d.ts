import type { AnimationTrack, Easing, SceneDocument, SceneNode } from './types.js';
export declare const animationPresets: readonly ["float", "orbit", "reveal", "zoom", "parallax", "fade-in", "fade-out", "slide-left", "slide-right", "slide-up", "slide-down", "pulse", "bounce", "sway", "spin", "flip"];
export type AnimationPreset = typeof animationPresets[number];
/** Easing belongs to the outgoing (left) keyframe. Spring is a damped, normalized step response. */
export declare function ease(progress: number, easing?: Easing): number;
export declare function evaluateScene(scene: SceneDocument, time: number): SceneDocument;
/** Presets are relative to base values. Float/orbit/parallax/pulse/bounce/sway/spin loop visually;
 * entrances and fades play once over the scene duration and hold their endpoint. */
export declare function createAnimationTracks(node: SceneNode, preset: AnimationPreset, duration?: number): AnimationTrack[];
//# sourceMappingURL=animation.d.ts.map