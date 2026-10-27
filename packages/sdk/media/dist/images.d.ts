import { type SceneDocument } from '@bookklik/device-mockup-studio/core';
import type { CanvasBlobEncoder, ExportCanvas, ExportRenderer, ImageExportOptions, ImageFormat, ImageMimeType } from './types.js';
export declare function imageMime(format?: ImageFormat): ImageMimeType;
export declare function imageQuality(quality?: number): number | undefined;
/** Check MIME AND magic bytes: browsers may silently return PNG for an unsupported requested MIME. */
export declare function verifyImageBlob(blob: Blob, type: ImageMimeType, signal?: AbortSignal): Promise<void>;
export declare function encodeCanvasBlob(canvas: ExportCanvas, type: ImageMimeType, quality?: number, signal?: AbortSignal, encoder?: CanvasBlobEncoder): Promise<Blob>;
export declare function exportImage(renderer: ExportRenderer, scene: SceneDocument, options?: ImageExportOptions): Promise<Blob>;
//# sourceMappingURL=images.d.ts.map