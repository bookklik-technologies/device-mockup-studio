import { StudioError, type SceneDocument } from '@bookklik/device-mockup-studio-core';
import type { EncoderMuxerAdapter, ExportRenderer, VideoEncodingParameters, VideoExportOptions, VideoMuxerAdapter } from './types.js';
import { MEDIA_LIMITS, abortError, abortable, acquireRenderer, checkAbort, numberInRange, progress, snapshot, timeline, verifyDimensions, yieldTask } from './common.js';
import { createMP4Adapter, createWebMAdapter } from './muxers.js';

function timeout<T>(promise: PromiseLike<T>, operation: string, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(abortError(signal)); };
    const timer = setTimeout(() => { cleanup(); reject(new StudioError('ENCODER_TIMEOUT', `${operation} timed out after 30 seconds.`)); }, 30_000);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    Promise.resolve(promise).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}
export async function selectEncoderConfig(adapter: EncoderMuxerAdapter, parameters: VideoEncodingParameters, signal?: AbortSignal): Promise<VideoEncoderConfig> {
  checkAbort(signal);
  if (typeof VideoEncoder === 'undefined' || typeof VideoEncoder.isConfigSupported !== 'function' || typeof VideoFrame === 'undefined') throw new StudioError('VIDEO_UNAVAILABLE', 'Offline video export requires WebCodecs VideoEncoder and VideoFrame (usually a secure context). Use exportFrames as the non-realtime fallback.');
  let lastError: unknown;
  for (const config of adapter.configurations(parameters)) {
    checkAbort(signal);
    if (config.width !== parameters.width || config.height !== parameters.height || !config.codec) throw new StudioError('ADAPTER_CONFIG', 'Adapter must provide an exact-size VideoEncoder configuration with a codec.');
    try {
      const support = await abortable(timeout(VideoEncoder.isConfigSupported(config), 'VideoEncoder configuration probe', signal), signal);
      checkAbort(signal);
      if (support.supported) return config;
    } catch (error) { checkAbort(signal); lastError = error; }
  }
  throw new StudioError('VIDEO_UNSUPPORTED', `No supported ${adapter.format} encoder configuration for ${parameters.width}×${parameters.height} at ${parameters.fps} fps. Use exportFrames or change size/frame rate.`, lastError);
}

/** Offline, frame-stepped WebCodecs export. MediaRecorder is deliberately NOT a silent realtime fallback. */
export async function exportVideo(renderer: ExportRenderer, scene: SceneDocument, options: VideoExportOptions = {}): Promise<Blob> {
  const plan = timeline(scene, options, true);
  if (options.format !== undefined && options.format !== 'webm' && options.format !== 'mp4') throw new StudioError('VIDEO_FORMAT', `Unsupported video format '${String(options.format)}'. Built-ins: webm and mp4.`);
  const adapter = options.adapter ?? (options.format === 'mp4' ? createMP4Adapter() : createWebMAdapter());
  if (options.format && adapter.format !== options.format) throw new StudioError('VIDEO_FORMAT', 'The format option must match adapter.format, or be omitted.');
  if (!adapter.mimeType.startsWith('video/')) throw new StudioError('ADAPTER_MIME', 'Video adapter must declare a video MIME type.');
  const bitrate = numberInRange(options.bitrate ?? Math.round(Math.min(20_000_000, Math.max(1_000_000, plan.width * plan.height * plan.fps * .12))), 'bitrate', 64_000, 100_000_000);
  const maxOutputBytes = numberInRange(options.maxOutputBytes ?? MEDIA_LIMITS.defaultOutputBytes, 'maxOutputBytes', 1024, MEDIA_LIMITS.maxOutputBytes);
  if (!Number.isSafeInteger(maxOutputBytes)) throw new StudioError('EXPORT_OPTIONS', 'maxOutputBytes must be an integer.');
  // Not a guarantee of encoder output size; the hard limits below are still enforced for VBR overshoot.
  if (bitrate * plan.duration / 8 > maxOutputBytes) throw new StudioError('EXPORT_SIZE_LIMIT', 'Estimated video size exceeds maxOutputBytes. Reduce duration/bitrate or raise the limit (at most 256 MiB).');
  const parameters: VideoEncodingParameters = { ...plan, bitrate, maxOutputBytes };
  const document = snapshot(scene), controller = new AbortController();
  const forwardAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', forwardAbort, { once: true });
  if (options.signal?.aborted) forwardAbort();
  const signal = controller.signal;
  let encoder: VideoEncoder | undefined, muxer: VideoMuxerAdapter | undefined, release: (() => void) | undefined;
  let active = true, failure: unknown, rejectFailure!: (error: unknown) => void;
  const failed = new Promise<never>((_resolve, reject) => { rejectFailure = reject; });
  void failed.catch(() => undefined);
  const fail = (error: unknown) => {
    if (failure !== undefined || !active) return;
    failure = error instanceof Error ? error : new StudioError('VIDEO_ENCODER', 'Video encoder failed.', error);
    rejectFailure(failure);
  };
  const wait = <T>(promise: PromiseLike<T>): Promise<T> => abortable(Promise.race([Promise.resolve(promise), failed]), signal);
  const flush = async () => {
    if (failure !== undefined) throw failure;
    await wait(timeout(encoder!.flush(), 'VideoEncoder flush', signal));
    if (failure !== undefined) throw failure;
    // In addition to bounded input queues, periodically yield to browser controls/AbortController.
    await wait(yieldTask());
  };
  try {
    progress(options.onProgress, 0, signal);
    const config = await selectEncoderConfig(adapter, parameters, signal);
    release = await acquireRenderer(renderer, signal);
    const pendingMuxer = Promise.resolve(adapter.createMuxer(parameters, config)).then(value => {
      // Adopt before the awaiting continuation: even an abort in that microtask gap
      // must not lose a newly created adapter. A late creator is disposed on arrival.
      if (!active || signal.aborted) value.dispose(); else muxer = value;
      return value;
    });
    muxer = await wait(pendingMuxer);
    checkAbort(signal);
    let outputCount = 0, inputCount = 0, encodedBytes = 0;
    encoder = new VideoEncoder({
      output(chunk, metadata) {
        if (failure !== undefined || !active) return;
        try {
          checkAbort(signal);
          const expectedTimestamp = Math.round(outputCount * 1_000_000 / plan.fps);
          if (outputCount >= inputCount || chunk.timestamp !== expectedTimestamp || outputCount === 0 && chunk.type !== 'key') throw new StudioError('ENCODER_TIMESTAMPS', 'Encoder returned dropped, reordered, duplicate, unexpected or non-key initial frames. Refusing an inaccurate export.');
          if (!Number.isSafeInteger(chunk.byteLength) || chunk.byteLength <= 0) throw new StudioError('VIDEO_EMPTY', 'Encoder returned an empty or invalid video chunk.');
          encodedBytes += chunk.byteLength;
          const descriptionBytes = metadata?.decoderConfig?.description?.byteLength ?? 0;
          if (encodedBytes > maxOutputBytes || descriptionBytes > 4 * 1024 * 1024) throw new StudioError('EXPORT_SIZE_LIMIT', 'Encoded video exceeds the output/metadata memory limit. Reduce duration, dimensions or bitrate.');
          muxer!.addVideoChunk(chunk, metadata); outputCount++;
          progress(options.onProgress, .95 * outputCount / plan.frameCount, signal);
        } catch (error) { fail(error); }
      },
      error(error) { fail(new StudioError('VIDEO_ENCODER', `VideoEncoder error: ${error.message}`, error)); },
    });
    if (failure !== undefined) throw failure;
    encoder.configure(config);
    if (failure !== undefined) throw failure;
    const keyInterval = Math.max(1, Math.round(plan.fps * 2));
    for (let index = 0; index < plan.frameCount; index++) {
      checkAbort(signal); if (failure !== undefined) throw failure;
      await wait(renderer.render(document, index / plan.fps, { scale: plan.scale, signal }));
      checkAbort(signal); if (failure !== undefined) throw failure;
      verifyDimensions(renderer, plan.width, plan.height);
      const timestamp = Math.round(index * 1_000_000 / plan.fps);
      const duration = Math.round((index + 1) * 1_000_000 / plan.fps) - timestamp;
      let frame: VideoFrame | undefined;
      try {
        frame = new VideoFrame(renderer.canvas, { timestamp, duration, alpha: 'discard' });
        // Increment BEFORE encode, to also support synchronous output implementations/test adapters.
        inputCount++; encoder.encode(frame, { keyFrame: index % keyInterval === 0 });
      } finally { frame?.close(); }
      if (failure !== undefined) throw failure;
      // Queue size alone is insufficient: an encoder may dequeue input but retain output internally.
      if ((index + 1) % MEDIA_LIMITS.maxPendingFrames === 0 || encoder.encodeQueueSize >= MEDIA_LIMITS.maxPendingFrames || inputCount - outputCount >= MEDIA_LIMITS.maxPendingFrames) await flush();
    }
    await flush();
    if (outputCount !== plan.frameCount) throw new StudioError('VIDEO_EMPTY', `Encoder emitted ${outputCount} of ${plan.frameCount} frames; refusing an incomplete export.`);
    const blob = await wait(Promise.resolve(muxer.finalize()));
    checkAbort(signal);
    if (!blob || !blob.size || blob.type.toLowerCase().split(';')[0] !== adapter.mimeType || blob.size > maxOutputBytes) throw new StudioError('VIDEO_CONTAINER', 'Muxer returned empty, oversized or incorrectly labeled video.');
    progress(options.onProgress, 1, signal);
    return blob;
  } catch (error) {
    // An encoder error callback may close the codec between an awaited render and
    // encode/configure. Preserve that root cause over a secondary InvalidStateError.
    throw failure !== undefined ? failure : error;
  } finally {
    active = false; controller.abort();
    options.signal?.removeEventListener('abort', forwardAbort);
    try { if (encoder && encoder.state !== 'closed') encoder.close(); } catch { /* Preserve original failure. */ }
    try { muxer?.dispose(); } catch { /* Cleanup must not mask an encoder/render/abort error. */ } finally { release?.(); }
  }
}
