import type { SceneDocument } from '@bookklik/device-mockup-studio-core';
import type { ExportedFrame, ExportRenderer, FrameExportOptions } from './types.js';
import { abortable, acquireRenderer, checkAbort, progress, snapshot, timeline, verifyDimensions, yieldTask } from './common.js';
import { encodeCanvasBlob, imageMime, imageQuality } from './images.js';

/** Offline, pull-driven frame sequence. Does not need WebCodecs, MediaRecorder, or a playing video. */
export async function* exportFrames(renderer: ExportRenderer, scene: SceneDocument, options: FrameExportOptions = {}): AsyncGenerator<ExportedFrame> {
  const plan = timeline(scene, options), document = snapshot(scene);
  const type = imageMime(options.format), quality = imageQuality(options.quality);
  const release = await acquireRenderer(renderer, options.signal);
  // A generator can be paused at yield indefinitely. Cancellation must release the
  // renderer even if its consumer never calls next()/return() again.
  options.signal?.addEventListener('abort', release, { once: true });
  try {
    progress(options.onProgress, 0, options.signal);
    for (let index = 0; index < plan.frameCount; index++) {
      checkAbort(options.signal);
      const time = index / plan.fps;
      await abortable(renderer.render(document, time, { scale: plan.scale, signal: options.signal }), options.signal);
      checkAbort(options.signal); verifyDimensions(renderer, plan.width, plan.height);
      const blob = await encodeCanvasBlob(renderer.canvas, type, quality, options.signal, options.encodeCanvas);
      progress(options.onProgress, (index + 1) / plan.frameCount, options.signal);
      yield { index, time, blob };
      // A Node/custom encoder can resolve synchronously: allow UI cancellation/macrotasks between frames.
      await abortable(yieldTask(), options.signal);
    }
  } finally { options.signal?.removeEventListener('abort', release); release(); }
}
