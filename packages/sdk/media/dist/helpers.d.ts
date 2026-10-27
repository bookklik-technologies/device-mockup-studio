import { type SceneDocument } from '@bookklik/device-mockup-studio/core';
import type { ShareProvider } from './types.js';
/** Call from a user gesture. Revocation is deferred so the browser can consume the download URL. */
export declare function downloadBlob(blob: Blob, filename: string): void;
export interface SceneJSONOptions {
    portable?: boolean;
    maxBytes?: number;
}
/** Portable by default: no expiring blob URLs or remote dependencies. Does not fetch/embed remote media. */
export declare function exportSceneJSON(scene: SceneDocument, options?: SceneJSONOptions): Blob;
/** Small sharing payloads only; object URLs/downloads are preferable for large exports. */
export declare function blobToDataURL(blob: Blob, options?: {
    maxBytes?: number;
    signal?: AbortSignal;
}): Promise<string>;
/** Explicit opt-in provider; the SDK itself supplies no hosting and sends no network requests. */
export declare function shareScene(scene: SceneDocument, provider: ShareProvider, signal?: AbortSignal): Promise<{
    url: string;
}>;
//# sourceMappingURL=helpers.d.ts.map