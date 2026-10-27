import { StudioError, type SceneDocument } from '@bookklik/device-mockup-studio-core';
import * as gifencModule from 'gifenc';
import type { ExportRenderer, GIFExportOptions } from './types.js';
import { MEDIA_LIMITS, abortable, acquireRenderer, checkAbort, numberInRange, progress, snapshot, timeline, verifyDimensions, yieldTask } from './common.js';

/** gifenc ships a CommonJS entry that hides its named exports from Node ESM,
 * while bundlers expose them both as named exports and on the default record. */
const gifenc = gifencModule.default ?? gifencModule;

/** Offline, looping GIF89a animation. GIF has 256 colors and one-bit alpha per frame. */
export async function exportGIF(renderer: ExportRenderer, scene: SceneDocument, options: GIFExportOptions = {}): Promise<Blob> {
  checkAbort(options.signal);
  // Most viewers clamp shorter delays. Keep each frame at least two centiseconds.
  const fps = numberInRange(options.fps ?? Math.min(scene.fps, 30), 'GIF fps', 1, 50);
  const plan = timeline(scene, { ...options, fps });
  const maxOutputBytes = numberInRange(options.maxOutputBytes ?? MEDIA_LIMITS.defaultOutputBytes, 'maxOutputBytes', 1024, MEDIA_LIMITS.maxOutputBytes);
  if (!Number.isSafeInteger(maxOutputBytes)) throw new StudioError('EXPORT_OPTIONS', 'maxOutputBytes must be an integer.');
  const document = snapshot(scene), signal = options.signal;
  const release = await acquireRenderer(renderer, signal);
  const encoder = gifenc.GIFEncoder({ auto: false });
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let outputBytes = 0;
  try {
    progress(options.onProgress, 0, signal);
    for (let index = 0; index < plan.frameCount; index++) {
      checkAbort(signal);
      await abortable(renderer.render(document, index / plan.fps, { scale: plan.scale, signal }), signal);
      checkAbort(signal); verifyDimensions(renderer, plan.width, plan.height);
      const ctx = renderer.canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      if (!ctx) throw new StudioError('GIF_CANVAS', 'GIF export requires a readable Canvas2D renderer.');
      const { data } = ctx.getImageData(0, 0, plan.width, plan.height);
      // Reserve index zero for transparency in every local palette. This also makes
      // disposal-to-background clear moving objects instead of leaving trails.
      for (let pixel = 0; pixel < data.length; pixel += 4) {
        if (data[pixel + 3] < 128) data[pixel] = data[pixel + 1] = data[pixel + 2] = 0;
      }
      const colors = gifenc.quantize(data, 255);
      await abortable(yieldTask(), signal);
      const indices = gifenc.applyPalette(data, colors);
      for (let pixel = 0; pixel < indices.length; pixel++) indices[pixel] = data[pixel * 4 + 3] < 128 ? 0 : indices[pixel] + 1;
      // Adjacent rounded timestamps prevent cumulative drift at rates such as 30 fps.
      const delay = (Math.round((index + 1) * 100 / fps) - Math.round(index * 100 / fps)) * 10;
      if (index === 0) encoder.writeHeader();
      encoder.writeFrame(indices, plan.width, plan.height, {
        first: index === 0, palette: [[0, 0, 0], ...colors], delay, repeat: 0,
        transparent: true, transparentIndex: 0, dispose: 2,
      });
      if (index === plan.frameCount - 1) encoder.finish();
      const bytes = encoder.bytesView();
      outputBytes += bytes.byteLength;
      if (outputBytes > maxOutputBytes) throw new StudioError('EXPORT_SIZE_LIMIT', 'GIF exceeds maxOutputBytes. Reduce duration, fps or scale.');
      chunks.push(new Uint8Array(bytes));
      encoder.reset();
      progress(options.onProgress, .95 * (index + 1) / plan.frameCount, signal);
      await abortable(yieldTask(), signal);
    }
    const blob = new Blob(chunks, { type: 'image/gif' });
    progress(options.onProgress, 1, signal);
    return blob;
  } finally { chunks.length = 0; encoder.reset(); release(); }
}
