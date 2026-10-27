import type { MediaCapabilities } from './types.js';
/** Synchronous presence detection only. A present WebCodecs API does not imply a working codec. */
export declare function getCapabilities(): MediaCapabilities;
export interface CapabilityProbeOptions {
    width?: number;
    height?: number;
    fps?: number;
    bitrate?: number;
    signal?: AbortSignal;
}
/** Probe exact video configuration support, and real 2×2 image encodes including MIME/signature checks.
 * Video support is an isConfigSupported result, not a guarantee that hardware won't fail during export.
 */
export declare function probeCapabilities(options?: CapabilityProbeOptions): Promise<MediaCapabilities>;
//# sourceMappingURL=capabilities.d.ts.map