import type { Fit } from '@bookklik/device-mockup-studio/core';
export type StudioCanvas = HTMLCanvasElement | OffscreenCanvas;
export type CanvasFactory = (width: number, height: number) => StudioCanvas;
export declare const MAX_OUTPUT_SIDE = 8192;
export declare const MAX_OUTPUT_PIXELS = 32000000;
export declare const clamp: (value: number, low?: number, high?: number) => number;
export declare function dimensions(width: number, height: number): void;
export declare function defaultCanvasFactory(width: number, height: number): StudioCanvas;
export declare function context(canvas: StudioCanvas): CanvasRenderingContext2D;
export declare function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void;
export declare function fitted(ctx: CanvasRenderingContext2D, source: CanvasImageSource, x: number, y: number, width: number, height: number, fit: Fit, focalX?: number, focalY?: number): void;
export interface Point {
    x: number;
    y: number;
}
export interface MeshPoint extends Point {
    u: number;
    v: number;
}
/** Map an image-space triangle to an arbitrary screen-space triangle using an affine texture transform. */
export declare function texturedTriangle(ctx: CanvasRenderingContext2D, source: CanvasImageSource, a: MeshPoint, b: MeshPoint, c: MeshPoint, seam: number): void;
//# sourceMappingURL=canvas.d.ts.map