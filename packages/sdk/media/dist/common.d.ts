import { type SceneDocument } from '@bookklik/device-mockup-studio/core';
import type { ExportRenderer, TimelineExportOptions } from './types.js';
export declare const MEDIA_LIMITS: Readonly<{
    maxSide: 8192;
    maxPixels: 32000000;
    maxVideoSide: 4096;
    maxVideoPixels: 16777216;
    maxFrames: 10000;
    maxFps: 240;
    maxDuration: 3600;
    defaultOutputBytes: number;
    maxOutputBytes: number;
    maxPendingFrames: 4;
}>;
export declare function abortError(signal?: AbortSignal): Error;
export declare function checkAbort(signal?: AbortSignal): void;
export declare function abortable<T>(promise: PromiseLike<T>, signal?: AbortSignal): Promise<T>;
export declare function numberInRange(value: number, name: string, min: number, max: number): number;
export declare function outputDimensions(scene: SceneDocument, scale?: number, video?: boolean): {
    width: number;
    height: number;
    scale: number;
};
export declare function timeline(scene: SceneDocument, options: TimelineExportOptions, video?: boolean): {
    fps: number;
    duration: number;
    requestedDuration: number;
    frameCount: number;
    width: number;
    height: number;
    scale: number;
};
export declare function snapshot(scene: SceneDocument): SceneDocument;
export declare function verifyDimensions(renderer: ExportRenderer, width: number, height: number): void;
export declare function progress(callback: TimelineExportOptions['onProgress'], value: number, signal?: AbortSignal): void;
export declare function acquireRenderer(renderer: ExportRenderer, signal?: AbortSignal): Promise<() => void>;
export declare const yieldTask: () => Promise<void>;
//# sourceMappingURL=common.d.ts.map