import type { SceneDocument } from '@bookklik/device-mockup-studio-core';
import type { ExportedFrame, ExportRenderer, FrameExportOptions } from './types.js';
/** Offline, pull-driven frame sequence. Does not need WebCodecs, MediaRecorder, or a playing video. */
export declare function exportFrames(renderer: ExportRenderer, scene: SceneDocument, options?: FrameExportOptions): AsyncGenerator<ExportedFrame>;
//# sourceMappingURL=frames.d.ts.map