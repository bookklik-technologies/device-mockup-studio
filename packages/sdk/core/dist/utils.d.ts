import type { Fit } from './types.js';
/** Clone mutable metadata, not immutable primitive strings (notably embedded media).
 * Preserve descriptors/prototypes so validation can reject hostile values without invoking
 * getters or losing evidence. Defining own properties also makes __proto__ inert.
 * A worklist and identity map preserve cycles/aliases for subsequent validation. */
export declare function copy<T>(value: T): T;
/** Shallow, descriptor-safe option merging; never execute untrusted factory getters. */
export declare function merge<T extends object>(base: T, ...overrides: object[]): T;
/** Structural comparison of validated JSON metadata. Strings are compared directly,
 * never encoded/serialized/copied. Object property insertion order is not significant. */
export declare function metadataEqual(left: unknown, right: unknown): boolean;
export declare function clamp(value: number, min: number, max: number): number;
export declare function lerp(from: number, to: number, progress: number): number;
export interface FitRect {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
}
/** Canvas-compatible source/destination rectangles. Focal values are normalized (0..1). */
export declare function computeFit(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number, fit?: Fit, focalX?: number, focalY?: number): FitRect;
//# sourceMappingURL=utils.d.ts.map