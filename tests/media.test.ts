import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { createScene, createShape, deserializeScene, type SceneDocument } from '@bookklik/device-mockup-studio/core';
import { CanvasRenderer } from '@bookklik/device-mockup-studio/render';
import { MEDIA_LIMITS, blobToDataURL, createMP4Adapter, createWebMAdapter, downloadBlob, exportFrames, exportImage, exportSceneJSON, exportVideo, getCapabilities, probeCapabilities, shareScene, type CanvasBlobEncoder, type EncoderMuxerAdapter, type ExportRenderer, type ImageFormat, type VideoFormat } from '@bookklik/device-mockup-studio/media';

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const jpeg = new Uint8Array([255, 216, 255, 224, 0, 0]);
const webp = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
const blobFor = (type = 'image/png') => new Blob([type === 'image/jpeg' ? jpeg : type === 'image/webp' ? webp : png], { type });
const scene = () => createScene({ width: 32, height: 24, fps: 10, duration: .4, background: { type: 'solid', color: '#d57a45' }, nodes: [createShape({ x: 16, y: 12, width: 12, height: 10, fill: '#224466' })] });
const asCanvas = (canvas: Canvas) => canvas as unknown as HTMLCanvasElement;
const napiEncoder: CanvasBlobEncoder = async (canvas, options) => {
  const format = options.type === 'image/jpeg' ? 'jpeg' : options.type === 'image/webp' ? 'webp' : 'png';
  const native = canvas as unknown as Canvas;
  const bytes = await (format === 'png' ? native.encode('png') : native.encode(format, Math.round((options.quality ?? .92) * 100)));
  return new Blob([new Uint8Array(bytes)], { type: options.type });
};
function fakeRenderer(encode: CanvasBlobEncoder = (_canvas, options) => blobFor(options.type)) {
  const calls: { scene: SceneDocument; time: number; scale: number; signal?: AbortSignal }[] = [];
  const canvas = { width: 1, height: 1, convertToBlob: (options: { type: string; quality?: number }) => encode(canvas as unknown as OffscreenCanvas, { ...options, type: options.type as 'image/png' }) };
  const renderer: ExportRenderer = {
    canvas: canvas as unknown as OffscreenCanvas,
    async render(document, time = 0, options = {}) {
      canvas.width = Math.round(document.width * (options.scale ?? 1)); canvas.height = Math.round(document.height * (options.scale ?? 1));
      calls.push({ scene: document, time, scale: options.scale ?? 1, signal: options.signal });
    },
  };
  return { renderer, canvas, calls };
}
function restoreGlobals(values: Record<string, unknown>) {
  const descriptors = Object.fromEntries(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  return () => { for (const [key, descriptor] of Object.entries(descriptors)) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); };
}
class FakeFrame {
  static frames: FakeFrame[] = [];
  timestamp: number; duration: number; closed = false;
  constructor(_canvas: unknown, init: VideoFrameInit) { this.timestamp = init.timestamp!; this.duration = init.duration!; FakeFrame.frames.push(this); }
  close() { this.closed = true; }
}
class FakeChunk {
  byteLength = 20;
  constructor(readonly timestamp: number, readonly duration: number, readonly type: EncodedVideoChunkType) {}
  copyTo(destination: AllowSharedBufferSource) {
    const array = ArrayBuffer.isView(destination) ? new Uint8Array(destination.buffer, destination.byteOffset, destination.byteLength) : new Uint8Array(destination);
    array.set([0x10, 0x00, 0x00, 0x9d, 0x01, 0x2a, 32, 0, 24, 0]);
  }
}
type EncoderMode = 'normal' | 'async-error' | 'encode-throw' | 'flush-reject' | 'flush-pending' | 'drop' | 'timestamp' | 'oversize' | 'configure-throw' | 'queue-zero';
class FakeEncoder extends EventTarget {
  static mode: EncoderMode = 'normal';
  static instances: FakeEncoder[] = [];
  static configs: VideoEncoderConfig[] = [];
  static supports: (config: VideoEncoderConfig) => boolean = config => config.codec === 'vp8' || config.codec.startsWith('avc1');
  static async isConfigSupported(config: VideoEncoderConfig) { FakeEncoder.configs.push(config); return { supported: FakeEncoder.supports(config), config }; }
  static reset(mode: EncoderMode = 'normal') { this.mode = mode; this.instances = []; this.configs = []; this.supports = config => config.codec === 'vp8' || config.codec.startsWith('avc1'); FakeFrame.frames = []; }
  state: CodecState = 'unconfigured'; encodeQueueSize = 0; maxQueue = 0; flushes = 0; closeCalls = 0;
  pending: { timestamp: number; duration: number; key: boolean }[] = [];
  config?: VideoEncoderConfig;
  constructor(private readonly init: VideoEncoderInit) { super(); FakeEncoder.instances.push(this); }
  configure(config: VideoEncoderConfig) { if (FakeEncoder.mode === 'configure-throw') throw new Error('configure exploded'); this.config = config; this.state = 'configured'; }
  encode(frame: FakeFrame, options: VideoEncoderEncodeOptions) {
    assert.equal(frame.closed, false); assert.equal(this.state, 'configured');
    if (FakeEncoder.mode === 'encode-throw') throw new Error('encode exploded');
    this.pending.push({ timestamp: frame.timestamp, duration: frame.duration, key: !!options.keyFrame });
    this.encodeQueueSize = FakeEncoder.mode === 'queue-zero' ? 0 : this.pending.length; this.maxQueue = Math.max(this.maxQueue, this.pending.length);
    if (FakeEncoder.mode === 'async-error') queueMicrotask(() => { this.state = 'closed'; this.init.error(new DOMException('hardware failed', 'EncodingError')); });
  }
  async flush(): Promise<void> {
    this.flushes++;
    if (FakeEncoder.mode === 'flush-pending') return new Promise(() => undefined);
    if (FakeEncoder.mode === 'flush-reject') throw new Error('flush exploded');
    const pending = this.pending.splice(0); this.encodeQueueSize = 0;
    for (const frame of pending) {
      if (FakeEncoder.mode === 'drop') continue;
      const chunk = new FakeChunk(FakeEncoder.mode === 'timestamp' ? frame.timestamp + 5 : frame.timestamp, frame.duration, frame.key ? 'key' : 'delta');
      if (FakeEncoder.mode === 'oversize') chunk.byteLength = 2 * 1024 * 1024;
      const metadata: EncodedVideoChunkMetadata = this.config?.codec.startsWith('avc1') ? { decoderConfig: { codec: this.config.codec, codedWidth: this.config.width, codedHeight: this.config.height, description: new Uint8Array([1, 66, 0, 31, 255, 225, 0, 4, 103, 66, 0, 31, 1, 0, 2, 104, 0]) } } : {};
      this.init.output(chunk as unknown as EncodedVideoChunk, metadata);
    }
  }
  close() { this.closeCalls++; this.state = 'closed'; this.pending = []; }
}
function codecs(mode: EncoderMode = 'normal') { FakeEncoder.reset(mode); return restoreGlobals({ VideoEncoder: FakeEncoder, VideoFrame: FakeFrame }); }
async function collect(generator: AsyncGenerator<{ index: number; time: number; blob: Blob }>) { const frames = []; for await (const frame of generator) frames.push(frame); return frames; }

// This module's static imports above execute successfully with no document/canvas/VideoEncoder in Node.
test('Node import and capabilities do not require or invent browser codec support', async () => {
  const restore = restoreGlobals({ VideoEncoder: undefined, VideoFrame: undefined, MediaRecorder: undefined, OffscreenCanvas: undefined });
  try {
    const capabilities = getCapabilities(); assert.equal(capabilities.videoEncoder, false); assert.equal(capabilities.mediaRecorder, false); assert.equal(capabilities.offscreenCanvas, false); assert.equal(capabilities.audio, false);
    assert.equal(capabilities.formats.webm.supported, false); assert.equal(capabilities.formats.png.supported, null);
    assert.equal((await probeCapabilities()).formats.mp4.supported, false);
    await assert.rejects(exportVideo(fakeRenderer().renderer, scene()), /WebCodecs.*exportFrames/);
  } finally { restore(); }
});

test('real PNG/JPEG/WebP exports through injectable napi encoder, scale, quality and scene time', async () => {
  const canvas = createCanvas(1, 1), renderer = new CanvasRenderer(asCanvas(canvas), { canvasFactory: (w, h) => asCanvas(createCanvas(w, h)) });
  try {
    for (const [format, mime] of [['png', 'image/png'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']] as const) {
      let receivedQuality: number | undefined;
      const blob = await exportImage(renderer, scene(), { format, scale: 2, quality: .73, time: .1, encodeCanvas: (canvas, options) => { receivedQuality = options.quality; return napiEncoder(canvas, options); } });
      assert.equal(blob.type, mime); assert.ok(blob.size > 40); assert.equal(canvas.width, 64); assert.equal(canvas.height, 48); assert.equal(receivedQuality, .73);
    }
    assert.deepEqual([...canvas.getContext('2d').getImageData(0, 0, 1, 1).data], [213, 122, 69, 255]);
  } finally { renderer.dispose(); }
});

test('image options fail fast, including malformed scale, time, dimensions, format and quality', async () => {
  const { renderer, calls } = fakeRenderer();
  for (const scale of [0, -1, Infinity, NaN, .0001, 10000]) await assert.rejects(exportImage(renderer, scene(), { scale }), /scale|dimensions/i);
  for (const quality of [-.01, 1.01, Infinity, NaN]) await assert.rejects(exportImage(renderer, scene(), { quality }), /quality/);
  for (const time of [-1, NaN, Infinity]) await assert.rejects(exportImage(renderer, scene(), { time }), /time/i);
  await assert.rejects(exportImage(renderer, scene(), { format: 'gif' as ImageFormat }), /format/);
  assert.equal(calls.length, 0);
  await exportImage(renderer, scene(), { quality: 0 }); await exportImage(renderer, scene(), { quality: 1 });
});

test('unsupported image MIME fallback, spoofed signature, empty blob and unavailable encoder reject', async () => {
  await assert.rejects(exportImage(fakeRenderer(() => blobFor('image/png')).renderer, scene(), { format: 'webp' }), /Requested image\/webp.*image\/png/);
  await assert.rejects(exportImage(fakeRenderer(() => new Blob([png], { type: 'image/jpeg' })).renderer, scene(), { format: 'jpeg' }), /bytes do not match/);
  await assert.rejects(exportImage(fakeRenderer(() => new Blob([], { type: 'image/png' })).renderer, scene()), /empty/);
  const missing = fakeRenderer(); Reflect.deleteProperty(missing.canvas, 'convertToBlob');
  await assert.rejects(exportImage(missing.renderer, scene()), /encodeCanvas adapter/);
  await assert.rejects(exportImage(fakeRenderer(() => { throw new DOMException('tainted', 'SecurityError'); }).renderer, scene()), /CORS/);
});

test('HTMLCanvas toBlob path uses requested MIME/quality and cancellation races an unresponsive encoder', async () => {
  const fixture = fakeRenderer(); Reflect.deleteProperty(fixture.canvas, 'convertToBlob');
  let callback: BlobCallback | undefined;
  Object.assign(fixture.canvas, { toBlob(fn: BlobCallback, type: string, quality: number) { assert.equal(type, 'image/jpeg'); assert.equal(quality, .4); callback = fn; fn(blobFor(type)); } });
  assert.equal((await exportImage(fixture.renderer, scene(), { format: 'jpeg', quality: .4 })).type, 'image/jpeg'); assert.ok(callback);
  Object.assign(fixture.canvas, { toBlob(_fn: BlobCallback) {} });
  const controller = new AbortController(); const pending = exportImage(fixture.renderer, scene(), { signal: controller.signal }); setTimeout(() => controller.abort('stop'), 5);
  await assert.rejects(pending, { name: 'AbortError' });
  const preaborted = new AbortController(); preaborted.abort();
  await assert.rejects(exportImage(fixture.renderer, scene(), { signal: preaborted.signal }), { name: 'AbortError' });
});

test('frames are lazy, pull-driven, deterministic scene seconds, snapshot-isolated and encoder-independent', async () => {
  const fixture = fakeRenderer(), document = scene(), ps: number[] = [];
  const generator = exportFrames(fixture.renderer, document, { fps: 10, duration: .21, scale: 1.5, onProgress: p => ps.push(p) });
  assert.equal(fixture.calls.length, 0);
  const first = await generator.next(); assert.equal(first.value?.time, 0); assert.equal(fixture.calls.length, 1);
  document.background = { type: 'solid', color: '#ffffff' };
  const rest = await collect(generator); assert.deepEqual(rest.map(f => [f.index, f.time]), [[1, .1], [2, .2]]);
  assert.equal(fixture.calls[1]?.scene.background.type, 'solid'); assert.deepEqual(fixture.calls[1]?.scene.background, { type: 'solid', color: '#d57a45' });
  assert.ok(fixture.calls.every(call => call.scale === 1.5)); assert.deepEqual(ps, [0, 1 / 3, 2 / 3, 1]);
  const again = await collect(exportFrames(fakeRenderer().renderer, scene(), { fps: 10, duration: .21 }));
  assert.deepEqual(again.map(frame => frame.time), [0, .1, .2]);
  assert.deepEqual(await again[0]!.blob.arrayBuffer(), await first.value!.blob.arrayBuffer());
  const exact = await collect(exportFrames(fakeRenderer().renderer, scene(), { fps: 30, duration: 1 / 30 * 3 })); assert.equal(exact.length, 3);
});

test('frames validate duration/rates and limits; cancel/early-return/progress errors release media lock', async () => {
  const fixture = fakeRenderer();
  for (const fps of [0, -1, NaN, Infinity, 241]) await assert.rejects(collect(exportFrames(fixture.renderer, scene(), { fps })), /fps/);
  for (const duration of [0, -1, NaN, Infinity, 3601]) await assert.rejects(collect(exportFrames(fixture.renderer, scene(), { duration })), /duration/i);
  await assert.rejects(collect(exportFrames(fixture.renderer, scene(), { fps: 240, duration: 100 })), /frame limit/);
  const controller = new AbortController();
  const generator = exportFrames(fixture.renderer, scene(), { signal: controller.signal }); await generator.next(); controller.abort();
  await exportImage(fixture.renderer, scene()); // cancellation releases even while paused at yield
  await assert.rejects(generator.next(), { name: 'AbortError' });
  const partial = exportFrames(fixture.renderer, scene()); await partial.next(); await partial.return(undefined); await exportImage(fixture.renderer, scene());
  await assert.rejects(collect(exportFrames(fixture.renderer, scene(), { onProgress: () => { throw new Error('progress failed'); } })), /progress failed/);
  await exportImage(fixture.renderer, scene());
  const preaborted = new AbortController(); preaborted.abort(); await assert.rejects(collect(exportFrames(fixture.renderer, scene(), { signal: preaborted.signal })), { name: 'AbortError' });
});

test('media helpers serialize concurrent jobs through both render and encode, and cancelled queued work releases', async () => {
  const fixture = fakeRenderer(); let resume!: () => void;
  const slowEncoder: CanvasBlobEncoder = () => new Promise(resolve => { resume = () => resolve(blobFor()); });
  const first = exportImage(fixture.renderer, scene(), { encodeCanvas: slowEncoder });
  while (!resume) await new Promise(resolve => setTimeout(resolve, 0));
  const controller = new AbortController();
  const second = exportImage(fixture.renderer, scene(), { signal: controller.signal });
  const third = exportImage(fixture.renderer, scene()); controller.abort();
  await assert.rejects(second, { name: 'AbortError' }); assert.equal(fixture.calls.length, 1);
  resume(); await first; await third; assert.equal(fixture.calls.length, 2);
});

test('offline WebM muxes real container bytes, exact timestamps/durations, bounded queue, flush and progress', async () => {
  const restore = codecs();
  try {
    const fixture = fakeRenderer(), ps: number[] = [];
    const blob = await exportVideo(fixture.renderer, scene(), { fps: 29.97, duration: .21, onProgress: p => ps.push(p) });
    assert.equal(blob.type, 'video/webm'); const bytes = new Uint8Array(await blob.arrayBuffer()); assert.deepEqual([...bytes.slice(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
    assert.equal(FakeFrame.frames.length, 7); assert.deepEqual(FakeFrame.frames.map(frame => frame.timestamp), Array.from({ length: 7 }, (_, i) => Math.round(i * 1_000_000 / 29.97)));
    assert.ok(FakeFrame.frames.every((frame, i) => frame.closed && frame.duration === Math.round((i + 1) * 1_000_000 / 29.97) - frame.timestamp));
    assert.deepEqual(fixture.calls.map(call => call.time), Array.from({ length: 7 }, (_, i) => i / 29.97));
    assert.equal(FakeEncoder.instances[0]!.maxQueue, MEDIA_LIMITS.maxPendingFrames); assert.ok(FakeEncoder.instances[0]!.flushes >= 2); assert.equal(FakeEncoder.instances[0]!.state, 'closed');
    assert.equal(ps[0], 0); assert.equal(ps.at(-1), 1); assert.ok(ps.every((p, i) => p >= 0 && p <= 1 && (!i || p >= ps[i - 1]!)));
    // Pinned muxer's last-start duration metadata is repaired to complete-frame endpoint.
    const durationOffset = bytes.findIndex((value, i) => value === 0x44 && bytes[i + 1] === 0x89 && bytes[i + 2] === 0x88);
    assert.ok(durationOffset > 0); assert.ok(Math.abs(new DataView(bytes.buffer).getFloat64(durationOffset + 3) - 7 / 29.97 * 1000) < .00001);
    assert.deepEqual(FakeEncoder.configs.map(config => config.codec), ['vp09.00.10.08', 'vp8']);
  } finally { restore(); }
});

test('MP4 adapter produces ftyp/moov/mdat and uses AVC length-prefixed configuration', async () => {
  const restore = codecs();
  try {
    const blob = await exportVideo(fakeRenderer().renderer, scene(), { format: 'mp4', fps: 29.97, duration: .21 });
    assert.equal(blob.type, 'video/mp4'); const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.slice(4, 8)), 'ftyp'); const text = new TextDecoder().decode(bytes); assert.ok(text.includes('moov')); assert.ok(text.includes('mdat')); assert.ok(text.includes('avcC'));
    assert.equal(FakeEncoder.instances[0]!.config?.avc?.format, 'avc'); assert.equal(FakeEncoder.instances[0]!.state, 'closed');
    assert.equal(FakeFrame.frames.length, 7); assert.equal(FakeFrame.frames[6]!.timestamp, Math.round(6 * 1_000_000 / 29.97));
  } finally { restore(); }
});

test('video validates all options, exact dimensions and supported configuration before creating encoder', async () => {
  const restore = codecs();
  try {
    for (const bitrate of [0, -1, Infinity, NaN, 100_000_001]) await assert.rejects(exportVideo(fakeRenderer().renderer, scene(), { bitrate }), /bitrate/);
    for (const maxOutputBytes of [0, Infinity, 256 * 1024 * 1024 + 1, 2048.5]) await assert.rejects(exportVideo(fakeRenderer().renderer, scene(), { maxOutputBytes }), /maxOutputBytes/);
    await assert.rejects(exportVideo(fakeRenderer().renderer, scene(), { format: 'avi' as VideoFormat }), /format/);
    await assert.rejects(exportVideo(fakeRenderer().renderer, { ...scene(), width: 33 }), /even/);
    await assert.rejects(exportVideo(fakeRenderer().renderer, scene(), { scale: 256 }), /dimensions/);
    await assert.rejects(exportVideo(fakeRenderer().renderer, scene(), { duration: 0 }), /duration/i);
    await assert.rejects(exportVideo(fakeRenderer().renderer, scene(), { fps: 0 }), /fps/);
    await assert.rejects(exportVideo(fakeRenderer().renderer, scene(), { duration: 100, fps: 240 }), /frame limit/);
    await assert.rejects(exportVideo(fakeRenderer().renderer, scene(), { maxOutputBytes: 1024 }), /Estimated video size/);
    assert.equal(FakeEncoder.instances.length, 0);
    FakeEncoder.supports = () => false; await assert.rejects(exportVideo(fakeRenderer().renderer, scene()), /No supported webm encoder/); assert.equal(FakeEncoder.instances.length, 0);
    FakeEncoder.isConfigSupported = async () => { throw new TypeError('codec rejected'); };
    await assert.rejects(exportVideo(fakeRenderer().renderer, scene()), /No supported webm encoder/);
  } finally { delete (FakeEncoder as unknown as { isConfigSupported?: unknown }).isConfigSupported; Object.defineProperty(FakeEncoder, 'isConfigSupported', { configurable: true, writable: true, value: async (config: VideoEncoderConfig) => { FakeEncoder.configs.push(config); return { supported: FakeEncoder.supports(config), config }; } }); restore(); }
});

test('encoder errors, configure/encode/flush failures, dropped/wrong frames all reject and close frames/encoders', async () => {
  const restore = codecs();
  try {
    for (const [mode, message] of [['async-error', /hardware failed/], ['configure-throw', /configure exploded/], ['encode-throw', /encode exploded/], ['flush-reject', /flush exploded/], ['drop', /incomplete export/], ['timestamp', /inaccurate export/]] as const) {
      FakeEncoder.reset(mode); const fixture = fakeRenderer();
      await assert.rejects(exportVideo(fixture.renderer, scene()), message);
      assert.ok(FakeFrame.frames.every(frame => frame.closed)); assert.ok(FakeEncoder.instances.every(encoder => encoder.state === 'closed'));
      FakeEncoder.reset(); await exportImage(fixture.renderer, scene());
    }
    FakeEncoder.reset('queue-zero'); await exportVideo(fakeRenderer().renderer, scene(), { duration: 1 }); assert.ok(FakeEncoder.instances[0]!.maxQueue <= 4, 'also bounds internally retained output when input queue reports zero');
  } finally { restore(); }
});

test('video cancellation while flush is hung is prompt; render and progress errors clean resources', async () => {
  const restore = codecs('flush-pending');
  try {
    const controller = new AbortController(); const fixture = fakeRenderer();
    const pending = exportVideo(fixture.renderer, scene(), { signal: controller.signal }); setTimeout(() => controller.abort('user cancelled'), 10);
    await assert.rejects(pending, { name: 'AbortError' }); assert.equal(FakeEncoder.instances[0]!.state, 'closed'); assert.ok(FakeFrame.frames.every(frame => frame.closed));
    FakeEncoder.reset(); await exportVideo(fixture.renderer, scene());
    FakeEncoder.reset(); const broken = fakeRenderer(); broken.renderer.render = async () => { throw new Error('asset failed'); };
    await assert.rejects(exportVideo(broken.renderer, scene()), /asset failed/); assert.equal(FakeEncoder.instances[0]!.state, 'closed');
    FakeEncoder.reset(); await assert.rejects(exportVideo(fixture.renderer, scene(), { onProgress: p => { if (p > 0) throw new Error('callback failed'); } }), /callback failed/); assert.equal(FakeEncoder.instances[0]!.state, 'closed');
    const preaborted = new AbortController(); preaborted.abort(); await assert.rejects(exportVideo(fixture.renderer, scene(), { signal: preaborted.signal }), { name: 'AbortError' });
  } finally { restore(); }
});

test('encoded bytes and actual muxed-container memory have hard limits', async () => {
  const restore = codecs('oversize');
  try {
    await assert.rejects(exportVideo(fakeRenderer().renderer, scene(), { duration: .1, bitrate: 64_000, maxOutputBytes: 65536 }), /memory limit/);
    assert.ok(FakeFrame.frames.every(frame => frame.closed)); assert.equal(FakeEncoder.instances[0]!.state, 'closed');
    // Metadata overhead, rather than payload bitrate, pushes this actual WebM over 1024 bytes.
    FakeEncoder.reset(); await assert.rejects(exportVideo(fakeRenderer().renderer, scene(), { duration: .1, bitrate: 64_000, maxOutputBytes: 1024 }), /byte limit/);
  } finally { restore(); }
});

test('custom codec/muxer adapter seam works, disposes after success/error/late cancellation', async () => {
  const restore = codecs(); let disposals = 0;
  const adapter: EncoderMuxerAdapter = { format: 'example', mimeType: 'video/x-example', configurations: p => [{ codec: 'vp8', width: p.width, height: p.height }], createMuxer: () => ({ addVideoChunk() {}, finalize: () => new Blob(['example'], { type: 'video/x-example' }), dispose() { disposals++; } }) };
  try {
    assert.equal((await exportVideo(fakeRenderer().renderer, scene(), { adapter })).type, 'video/x-example'); assert.equal(disposals, 1);
    await assert.rejects(exportVideo(fakeRenderer().renderer, scene(), { adapter, format: 'webm' }), /must match/);
    const failing: EncoderMuxerAdapter = { ...adapter, createMuxer: () => ({ addVideoChunk() { throw new Error('muxer failed'); }, finalize: () => blobFor(), dispose() { disposals++; } }) };
    await assert.rejects(exportVideo(fakeRenderer().renderer, scene(), { adapter: failing }), /muxer failed/); assert.equal(disposals, 2);
    const late = { ...adapter, createMuxer: async () => { await new Promise(resolve => setTimeout(resolve, 30)); return { addVideoChunk() {}, finalize: () => blobFor(), dispose() { disposals++; } }; } };
    const controller = new AbortController(); const pending = exportVideo(fakeRenderer().renderer, scene(), { adapter: late, signal: controller.signal }); setTimeout(() => controller.abort(), 5);
    await assert.rejects(pending, { name: 'AbortError' }); await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(disposals, 3);
    assert.equal(createWebMAdapter().format, 'webm'); assert.equal(createMP4Adapter().format, 'mp4');
  } finally { restore(); }
});

test('async capability probe distinguishes presence, exact codec support, MIME fallback, and cancellation', async () => {
  const restoreCodecs = codecs();
  class FakeOffscreen {
    constructor(public width: number, public height: number) {}
    getContext() { return {}; }
    convertToBlob(options: { type: string }) { return Promise.resolve(blobFor(options.type === 'image/webp' ? 'image/png' : options.type)); }
  }
  const restoreCanvas = restoreGlobals({ OffscreenCanvas: FakeOffscreen, MediaRecorder: class {} });
  try {
    const sync = getCapabilities(); assert.equal(sync.videoEncoder, true); assert.equal(sync.mediaRecorder, true); assert.equal(sync.formats.webm.supported, null);
    const cap = await probeCapabilities({ width: 640, height: 480, fps: 24, bitrate: 2_000_000 });
    assert.equal(cap.formats.png.supported, true); assert.equal(cap.formats.jpeg.supported, true); assert.equal(cap.formats.webp.supported, false); assert.equal(cap.formats.webm.selectedCodec, 'vp8'); assert.equal(cap.formats.mp4.supported, true);
    assert.ok(FakeEncoder.configs.every(config => config.width === 640 && config.height === 480 && config.framerate === 24));
    const controller = new AbortController(); controller.abort(); await assert.rejects(probeCapabilities({ signal: controller.signal }), { name: 'AbortError' });
    await assert.rejects(probeCapabilities({ width: 639 }), /even integers/);
  } finally { restoreCanvas(); restoreCodecs(); }
});

test('portable scene JSON, link size guard and explicit sharing providers', async () => {
  const document = scene(), blob = exportSceneJSON(document); assert.equal(blob.type, 'application/json'); assert.deepEqual(deserializeScene(await blob.text()), document);
  document.assets.push({ id: 'a', kind: 'image', src: 'https://example.test/image.png', width: 2, height: 2 });
  assert.throws(() => exportSceneJSON(document), /not.*data URL/); assert.ok(exportSceneJSON(document, { portable: false }).size > 0);
  document.assets[0]!.src = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E'; assert.ok(exportSceneJSON(document).size > 0);
  document.assets[0]!.src = 'data:image/png;base64,iVBORw0KGgo='; assert.ok(exportSceneJSON(document).size > 0); assert.throws(() => exportSceneJSON(document, { maxBytes: 10 }), /size limit/);
  assert.equal(await blobToDataURL(new Blob(['hello'], { type: 'text/plain' })), 'data:text/plain;base64,aGVsbG8=');
  await assert.rejects(blobToDataURL(blob, { maxBytes: 20 }), /link size guard/);
  let called = false;
  assert.deepEqual(await shareScene(document, { id: 'explicit', async share(request) { called = true; assert.equal(request.blob.type, 'application/json'); return { url: 'https://share.example.test/project' }; } }), { url: 'https://share.example.test/project' }); assert.equal(called, true);
  await assert.rejects(shareScene(document, { id: 'unsafe', async share() { return { url: 'javascript:alert(1)' }; } }), /HTTP/);
});

test('downloadBlob clicks temporary link, sanitizes filenames and defers object-URL revocation', async () => {
  let clicked = false, removed = false, revoked = false, appended = false, scheduled: (() => void) | undefined;
  const anchor = { href: '', download: '', rel: '', style: { display: '' }, click() { assert.equal(revoked, false); clicked = true; }, remove() { removed = true; } };
  const restore = restoreGlobals({ document: { createElement: () => anchor, body: { appendChild() { appended = true; } } }, URL: { createObjectURL: () => 'blob:test', revokeObjectURL(url: string) { assert.equal(url, 'blob:test'); revoked = true; } }, setTimeout: (fn: () => void, delay: number) => { assert.ok(delay > 0); scheduled = fn; return 1; } });
  try {
    downloadBlob(blobFor(), 'frame.png'); assert.ok(clicked && removed && appended); assert.equal(anchor.download, 'frame.png'); assert.equal(revoked, false); scheduled!(); assert.equal(revoked, true);
    assert.throws(() => downloadBlob(blobFor(), '../bad'), /filename/); assert.throws(() => downloadBlob(new Blob([]), 'empty'), /empty/);
  } finally { restore(); }
});
