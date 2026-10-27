import type { SceneDocument } from '@bookklik/device-mockup-studio/core';
import type { CanvasRenderer } from '@bookklik/device-mockup-studio/render';
export type ImageFormat = 'png' | 'jpeg' | 'webp';
export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp';
export type VideoFormat = 'webm' | 'mp4';
export type ExportCanvas = HTMLCanvasElement | OffscreenCanvas;
/** Structural so custom renderers and Node canvases can be injected without a DOM implementation. */
export type ExportRenderer = Pick<CanvasRenderer, 'canvas' | 'render'>;
export type CanvasBlobEncoder = (canvas: ExportCanvas, options: {
    type: ImageMimeType;
    quality?: number;
    signal?: AbortSignal;
}) => Blob | Promise<Blob>;
export interface ImageExportOptions {
    format?: ImageFormat;
    scale?: number;
    quality?: number;
    /** Scene seconds, not milliseconds. Defaults to zero. */
    time?: number;
    signal?: AbortSignal;
    /** Optional encoding adapter, e.g. for @napi-rs/canvas. The actual MIME and file signature are still verified. */
    encodeCanvas?: CanvasBlobEncoder;
}
export interface TimelineExportOptions {
    fps?: number;
    duration?: number;
    scale?: number;
    signal?: AbortSignal;
    onProgress?: (progress: number) => void;
}
export interface FrameExportOptions extends TimelineExportOptions {
    format?: ImageFormat;
    quality?: number;
    encodeCanvas?: CanvasBlobEncoder;
}
export interface ExportedFrame {
    index: number;
    time: number;
    blob: Blob;
}
export interface GIFExportOptions extends TimelineExportOptions {
    /** 1–50 fps; defaults to the scene rate capped at 30. GIF delays use centiseconds. */
    fps?: number;
    /** 128 MiB default, at most 256 MiB. Checked after each encoded frame. */
    maxOutputBytes?: number;
}
export interface VideoExportOptions extends TimelineExportOptions {
    format?: VideoFormat;
    bitrate?: number;
    /** 128 MiB default, at most 256 MiB. This is a hard payload AND container limit, not a bitrate estimate. */
    maxOutputBytes?: number;
    /** Extension seam for other codecs/containers. If supplied, format must be omitted or match adapter.format. */
    adapter?: EncoderMuxerAdapter;
}
export interface VideoEncodingParameters {
    width: number;
    height: number;
    fps: number;
    bitrate: number;
    frameCount: number;
    /** Complete frames are exported; duration is frameCount / fps. */
    duration: number;
    maxOutputBytes: number;
}
export interface VideoMuxerAdapter {
    /** Must consume/copy the chunk synchronously, or throw. No audio is supplied. */
    addVideoChunk(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata): void;
    finalize(): Blob | Promise<Blob>;
    /** Release retained data on success, cancellation and error. Must be idempotent. */
    dispose(): void;
}
/** WebCodecs encoding stays in exportVideo; formats provide exact configs and a bounded muxer. */
export interface EncoderMuxerAdapter {
    readonly format: string;
    readonly mimeType: string;
    configurations(parameters: VideoEncodingParameters): readonly VideoEncoderConfig[];
    createMuxer(parameters: VideoEncodingParameters, config: VideoEncoderConfig): VideoMuxerAdapter | Promise<VideoMuxerAdapter>;
}
export interface FormatCapability {
    kind: 'image' | 'video';
    mimeType: string;
    /** null means not probed, NEVER an assertion of codec support. */
    supported: boolean | null;
    codecs?: string[];
    selectedCodec?: string;
    reason?: string;
}
export interface MediaCapabilities {
    videoEncoder: boolean;
    videoFrame: boolean;
    mediaRecorder: boolean;
    offscreenCanvas: boolean;
    audio: false;
    formats: Record<ImageFormat | VideoFormat | 'gif', FormatCapability>;
}
export interface ShareRequest {
    blob: Blob;
    filename: string;
    scene: SceneDocument;
    signal?: AbortSignal;
}
/** Providers own authentication/storage and must disclose their privacy policy to their caller. */
export interface ShareProvider {
    id: string;
    share(request: ShareRequest): Promise<{
        url: string;
    }>;
}
//# sourceMappingURL=types.d.ts.map