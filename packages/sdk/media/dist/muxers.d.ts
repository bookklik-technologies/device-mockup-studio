import type { EncoderMuxerAdapter } from './types.js';
export declare const WEBM_CODECS: readonly ["vp09.00.10.08", "vp8"];
export declare const MP4_CODECS: readonly ["avc1.640034", "avc1.4d0034", "avc1.420034", "avc1.64002a", "avc1.4d002a", "avc1.42002a", "avc1.42001f"];
export declare function createWebMAdapter(): EncoderMuxerAdapter;
export declare function createMP4Adapter(): EncoderMuxerAdapter;
//# sourceMappingURL=muxers.d.ts.map