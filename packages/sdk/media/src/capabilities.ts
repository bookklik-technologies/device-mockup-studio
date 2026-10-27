import type { ImageFormat, MediaCapabilities, VideoEncodingParameters, VideoFormat } from './types.js';
import { MEDIA_LIMITS, checkAbort, numberInRange } from './common.js';
import { encodeCanvasBlob, imageMime } from './images.js';
import { createMP4Adapter, createWebMAdapter, MP4_CODECS, WEBM_CODECS } from './muxers.js';
import { selectEncoderConfig } from './video.js';

/** Synchronous presence detection only. A present WebCodecs API does not imply a working codec. */
export function getCapabilities(): MediaCapabilities {
  const videoEncoder = typeof VideoEncoder !== 'undefined' && typeof VideoEncoder.isConfigSupported === 'function';
  const videoFrame = typeof VideoFrame !== 'undefined';
  const unavailable = !videoEncoder || !videoFrame;
  const image = (format: ImageFormat) => ({ kind: 'image' as const, mimeType: imageMime(format), supported: null });
  return {
    videoEncoder, videoFrame, mediaRecorder: typeof MediaRecorder !== 'undefined', offscreenCanvas: typeof OffscreenCanvas !== 'undefined', audio: false,
    formats: {
      png: image('png'), jpeg: image('jpeg'), webp: image('webp'),
      gif: { kind: 'image', mimeType: 'image/gif', supported: true },
      webm: { kind: 'video', mimeType: 'video/webm', supported: unavailable ? false : null, codecs: [...WEBM_CODECS], ...(unavailable ? { reason: 'WebCodecs VideoEncoder/VideoFrame unavailable; use exportFrames.' } : {}) },
      mp4: { kind: 'video', mimeType: 'video/mp4', supported: unavailable ? false : null, codecs: [...MP4_CODECS], ...(unavailable ? { reason: 'WebCodecs VideoEncoder/VideoFrame unavailable; use exportFrames.' } : {}) },
    },
  };
}
export interface CapabilityProbeOptions { width?: number; height?: number; fps?: number; bitrate?: number; signal?: AbortSignal }
/** Probe exact video configuration support, and real 2×2 image encodes including MIME/signature checks.
 * Video support is an isConfigSupported result, not a guarantee that hardware won't fail during export.
 */
export async function probeCapabilities(options: CapabilityProbeOptions = {}): Promise<MediaCapabilities> {
  checkAbort(options.signal);
  const capabilities = getCapabilities();
  const width = numberInRange(options.width ?? 1920, 'width', 2, MEDIA_LIMITS.maxVideoSide);
  const height = numberInRange(options.height ?? 1080, 'height', 2, MEDIA_LIMITS.maxVideoSide);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width % 2 || height % 2) throw new RangeError('Video probe dimensions must be even integers.');
  const fps = numberInRange(options.fps ?? 30, 'fps', 1, MEDIA_LIMITS.maxFps);
  const bitrate = numberInRange(options.bitrate ?? 8_000_000, 'bitrate', 64_000, 100_000_000);
  const parameters: VideoEncodingParameters = { width, height, fps, bitrate, frameCount: 1, duration: 1 / fps, maxOutputBytes: MEDIA_LIMITS.defaultOutputBytes };
  let canvas: HTMLCanvasElement | OffscreenCanvas | undefined;
  try {
    if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(2, 2);
    else if (typeof document !== 'undefined') { canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2; }
    if (canvas) {
      // convertToBlob() rejects an OffscreenCanvas that has never acquired a context.
      if (!canvas.getContext('2d')) throw new Error('Canvas2D context unavailable.');
      for (const format of ['png', 'jpeg', 'webp'] satisfies ImageFormat[]) {
        try { await encodeCanvasBlob(canvas, imageMime(format), .8, options.signal); capabilities.formats[format].supported = true; }
        catch (error) { checkAbort(options.signal); capabilities.formats[format].supported = false; capabilities.formats[format].reason = error instanceof Error ? error.message : String(error); }
      }
    }
  } catch (error) {
    checkAbort(options.signal);
    for (const format of ['png', 'jpeg', 'webp'] satisfies ImageFormat[]) {
      capabilities.formats[format].supported = false;
      capabilities.formats[format].reason = error instanceof Error ? error.message : String(error);
    }
  } finally { if (canvas) { canvas.width = 1; canvas.height = 1; } }
  for (const format of ['webm', 'mp4'] satisfies VideoFormat[]) {
    try {
      const config = await selectEncoderConfig(format === 'webm' ? createWebMAdapter() : createMP4Adapter(), parameters, options.signal);
      capabilities.formats[format] = { ...capabilities.formats[format], supported: true, selectedCodec: config.codec };
    } catch (error) { checkAbort(options.signal); capabilities.formats[format].supported = false; capabilities.formats[format].reason = error instanceof Error ? error.message : String(error); }
  }
  return capabilities;
}
