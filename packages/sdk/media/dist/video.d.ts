import { type SceneDocument } from '@bookklik/device-mockup-studio/core';
import type { EncoderMuxerAdapter, ExportRenderer, VideoEncodingParameters, VideoExportOptions } from './types.js';
export declare function selectEncoderConfig(adapter: EncoderMuxerAdapter, parameters: VideoEncodingParameters, signal?: AbortSignal): Promise<VideoEncoderConfig>;
/** Offline, frame-stepped WebCodecs export. MediaRecorder is deliberately NOT a silent realtime fallback. */
export declare function exportVideo(renderer: ExportRenderer, scene: SceneDocument, options?: VideoExportOptions): Promise<Blob>;
//# sourceMappingURL=video.d.ts.map