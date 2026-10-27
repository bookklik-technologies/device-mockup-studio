import { type Background } from '@bookklik/device-mockup-studio/core';
import { type CanvasFactory } from './canvas.js';
export interface MagicBackgroundOptions {
    colors?: number;
    angle?: number;
    animated?: boolean;
    canvasFactory?: CanvasFactory;
}
export interface MagicBackgroundResult {
    palette: string[];
    background: Background;
}
/** Deterministic, local palette sampling without network requests.
 * The caller must load the source first. Remote sources require CORS for pixel access. */
export declare function createMagicBackground(source: CanvasImageSource, options?: MagicBackgroundOptions): MagicBackgroundResult;
//# sourceMappingURL=backgrounds.d.ts.map