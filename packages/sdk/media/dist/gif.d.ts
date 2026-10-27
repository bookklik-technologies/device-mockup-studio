import { type SceneDocument } from '@bookklik/device-mockup-studio-core';
import type { ExportRenderer, GIFExportOptions } from './types.js';
/** Offline, looping GIF89a animation. GIF has 256 colors and one-bit alpha per frame. */
export declare function exportGIF(renderer: ExportRenderer, scene: SceneDocument, options?: GIFExportOptions): Promise<Blob>;
//# sourceMappingURL=gif.d.ts.map