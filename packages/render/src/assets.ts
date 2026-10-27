import { StudioError, type Asset, type SceneDocument, type MockupNode } from '@bookklik/device-mockup-studio/core';

const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 80_000_000;
const LOAD_TIMEOUT = 30_000;

export function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  const s = source as unknown as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number; width?: number; height?: number; displayWidth?: number; displayHeight?: number };
  const width = s.naturalWidth ?? s.videoWidth ?? s.displayWidth ?? s.width ?? 0;
  const height = s.naturalHeight ?? s.videoHeight ?? s.displayHeight ?? s.height ?? 0;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width * height > MAX_SOURCE_PIXELS || width > 32768 || height > 32768) {
    throw new StudioError('ASSET_DIMENSIONS', 'Asset has invalid dimensions or exceeds the 80 megapixel source limit.');
  }
  return { width, height };
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new StudioError('ABORTED', 'Rendering was cancelled.', signal.reason);
}

export function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => { cleanup(); reject(new StudioError('ABORTED', 'Asset preparation was cancelled.', signal.reason)); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

// Structural detection supports cross-realm elements and Node test doubles without DOM globals.
function isVideoSource(source: CanvasImageSource): source is HTMLVideoElement {
  const video = source as HTMLVideoElement;
  return typeof video.videoWidth === 'number' && typeof video.videoHeight === 'number'
    && typeof video.currentTime === 'number' && typeof video.duration === 'number'
    && typeof video.readyState === 'number' && typeof video.pause === 'function'
    && typeof video.addEventListener === 'function' && typeof video.removeEventListener === 'function';
}

/** Internal preflight shared by asynchronous preparation and synchronous drawing.
 * Same-timing reuse is safe. Independent timings require distinct asset IDs backed by
 * independent video sources; one decoder cannot supply two frames in a single draw.
 */
export function videoFrameSources(scene: SceneDocument, getSource: (id: string) => CanvasImageSource | undefined): Map<HTMLVideoElement, MockupNode> {
  const frames = new Map<HTMLVideoElement, MockupNode>();
  for (const node of scene.nodes) {
    if (node.type !== 'mockup' || !node.visible || node.opacity <= 0 || node.scale <= 0 || !node.assetId) continue;
    const source = getSource(node.assetId);
    if (!source || !isVideoSource(source)) continue;
    const previous = frames.get(source);
    if (previous && (previous.videoStart !== node.videoStart || previous.playbackRate !== node.playbackRate || previous.videoLoop !== node.videoLoop)) {
      throw new StudioError('VIDEO_TIMING_CONFLICT', `Visible mockups '${previous.id}' and '${node.id}' share video '${node.assetId}' with conflicting timing. Reuse identical videoStart/playbackRate/videoLoop, or use distinct asset IDs with independent video sources.`);
    }
    if (!previous) frames.set(source, node);
  }
  return frames;
}

/** Browser-first media cache. Registered sources also make the renderer portable to Node canvas. */
export class AssetManager {
  private sources = new Map<string, CanvasImageSource>();
  private pending = new Map<string, { src: string; promise: Promise<CanvasImageSource> }>();
  private urls = new Map<string, string>();
  private registered = new Set<string>();
  // Only manager-created videos are owned; register() borrows caller media.
  private ownedVideos = new Set<HTMLVideoElement>();
  private cleanups = new Set<() => void>();
  private disposed = false;
  private importCounter = 0;
  private frameQueue: Promise<void> = Promise.resolve();

  private alive(): void {
    if (this.disposed) throw new StudioError('DISPOSED', 'AssetManager has been disposed.');
  }

  get(id: string): CanvasImageSource | undefined { this.alive(); return this.sources.get(id); }

  /** Borrow a source. Video-like sources participate in frame seeking, but disposal
   * never clears their src, reloads them, or closes caller-owned media.
   */
  register(id: string, source: CanvasImageSource): void {
    this.alive();
    if (!id) throw new StudioError('ASSET_ID', 'Registered assets require an id.');
    sourceSize(source);
    this.registered.add(id);
    this.sources.set(id, source);
    this.urls.delete(id);
  }

  load(asset: Asset): Promise<CanvasImageSource> {
    try { this.alive(); } catch (error) { return Promise.reject(error); }
    if (!asset || !asset.id || !asset.src || !['image', 'video'].includes(asset.kind)) return Promise.reject(new StudioError('ASSET_INVALID', 'An asset requires an id, source, and supported kind.'));
    const cached = this.sources.get(asset.id);
    if (cached && (this.registered.has(asset.id) || this.urls.get(asset.id) === asset.src)) return Promise.resolve(cached);
    const inFlight = this.pending.get(asset.id);
    if (inFlight?.src === asset.src) return inFlight.promise;
    // Reject executable and nonportable URL schemes; remote resources use anonymous CORS.
    try {
      const url = new URL(asset.src, 'https://mockup-studio.invalid/');
      if (!['https:', 'http:', 'data:', 'blob:'].includes(url.protocol)) throw new Error('Unsupported scheme');
    } catch { return Promise.reject(new StudioError('ASSET_URL', 'Only HTTP(S), data, blob, or relative media URLs are supported.')); }
    const promise = this.loadBrowser(asset).then(source => {
      this.alive();
      sourceSize(source);
      // A later load/register must not be overwritten by an older request.
      if (this.pending.get(asset.id)?.promise === promise && !this.registered.has(asset.id)) {
        this.sources.set(asset.id, source);
        this.urls.set(asset.id, asset.src);
      }
      return this.registered.has(asset.id) ? this.sources.get(asset.id)! : source;
    }).finally(() => { if (this.pending.get(asset.id)?.promise === promise) this.pending.delete(asset.id); });
    this.pending.set(asset.id, { src: asset.src, promise });
    return promise;
  }

  private loadBrowser(asset: Asset): Promise<CanvasImageSource> {
    return new Promise((resolve, reject) => {
      let media: HTMLImageElement | HTMLVideoElement;
      if (asset.kind === 'image') {
        if (typeof Image === 'undefined') { reject(new StudioError('BROWSER_REQUIRED', `Image loading needs a browser. Register '${asset.id}' with a CanvasImageSource in Node.`)); return; }
        media = new Image();
      } else {
        if (typeof document === 'undefined') { reject(new StudioError('BROWSER_REQUIRED', 'Video loading requires a browser.')); return; }
        media = document.createElement('video');
      }
      const video = asset.kind === 'video' ? media as HTMLVideoElement : undefined;
      const event = video ? 'loadeddata' : 'load';
      let settled = false;
      const tidy = () => { clearTimeout(timer); media.removeEventListener(event, ready); media.removeEventListener('error', failed); this.cleanups.delete(cancel); };
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        tidy();
        if (error) { if (video) this.ownedVideos.delete(video); media.removeAttribute('src'); reject(error); }
        else resolve(media);
      };
      const ready = () => { try { sourceSize(media); finish(); } catch (error) { finish(error as Error); } };
      const failed = () => finish(new StudioError('ASSET_LOAD', `Could not load '${asset.name ?? asset.id}'. Check the URL, format, and server CORS headers.`));
      const cancel = () => finish(new StudioError('DISPOSED', 'AssetManager disposed during media loading.'));
      const timer = setTimeout(() => finish(new StudioError('ASSET_TIMEOUT', `Timed out loading '${asset.id}'.`)), LOAD_TIMEOUT);
      this.cleanups.add(cancel);
      media.crossOrigin = 'anonymous';
      if (video) {
        video.preload = 'auto'; video.muted = true; video.playsInline = true;
        this.ownedVideos.add(video);
      } else (media as HTMLImageElement).decoding = 'async';
      media.addEventListener(event, ready, { once: true });
      media.addEventListener('error', failed, { once: true });
      media.src = asset.src;
      if (video) video.load();
    });
  }

  async importFile(file: File): Promise<Asset> {
    this.alive();
    if (!file || !Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_FILE_BYTES) throw new StudioError('FILE_SIZE', 'Import a nonempty media file no larger than 32 MiB.');
    const mime = file.type.toLowerCase();
    if (!/^image\/(png|jpe?g|webp|gif|avif|bmp)$/.test(mime) && !/^video\/(mp4|webm|ogg|quicktime)$/.test(mime)) throw new StudioError('FILE_TYPE', 'Unsupported media type. Use PNG, JPEG, WebP, GIF, AVIF, BMP, MP4, WebM or Ogg.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    this.alive();
    if (typeof btoa !== 'function') throw new StudioError('BROWSER_REQUIRED', 'Base64 file import requires btoa support.');
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 0x8000) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
    const asset: Asset = { id: `asset_${Date.now().toString(36)}_${++this.importCounter}`, kind: mime.startsWith('video/') ? 'video' : 'image', src: `data:${mime};base64,${btoa(chunks.join(''))}`, width: 0, height: 0, mime, name: file.name };
    const source = await this.load(asset);
    Object.assign(asset, sourceSize(source));
    const duration = (source as HTMLVideoElement).duration;
    if (asset.kind === 'video' && Number.isFinite(duration)) asset.duration = duration;
    return asset;
  }

  async prepareFrame(scene: SceneDocument, time: number, signal?: AbortSignal): Promise<void> {
    this.alive(); throwIfAborted(signal);
    if (!Number.isFinite(time)) return Promise.reject(new StudioError('TIME_INVALID', 'Frame time must be finite.'));
    const work = async () => {
      this.alive(); throwIfAborted(signal);
      const ids = new Set<string>();
      if (scene.background.type === 'image') ids.add(scene.background.assetId);
      for (const node of scene.nodes) if (node.visible && node.opacity > 0 && node.scale > 0 && node.type === 'mockup' && node.assetId) ids.add(node.assetId);
      await Promise.all([...ids].map(async id => {
        if (this.registered.has(id)) { sourceSize(this.sources.get(id)!); return; }
        const asset = scene.assets.find(item => item.id === id);
        if (!asset) throw new StudioError('ASSET_MISSING', `No asset definition for '${id}'.`);
        await abortable(this.load(asset), signal);
      }));
      this.alive(); throwIfAborted(signal);
      // Preflight all timing before seeking any decoder; never silently render the first node's frame.
      const frames = videoFrameSources(scene, id => this.sources.get(id));
      for (const [video, node] of frames) {
        const duration = video.duration;
        if (!Number.isFinite(duration) || duration <= 0) throw new StudioError('VIDEO_DURATION', `Video '${node.assetId}' has no finite duration.`);
        const requested = Math.max(0, node.videoStart + Math.max(0, time) * node.playbackRate);
        const target = node.videoLoop ? requested % duration : Math.min(requested, Math.max(0, duration - 0.001));
        await this.seek(video, target, signal);
      }
    };
    const job = this.frameQueue.then(work);
    // The queue recovers after a failed frame; the returned job still rejects to the caller.
    this.frameQueue = job.catch(() => undefined);
    return abortable(job, signal);
  }

  private seek(video: HTMLVideoElement, target: number, signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    if (!video.seeking && Math.abs(video.currentTime - target) < 0.0001 && video.readyState >= 2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return; settled = true;
        clearTimeout(timer); video.removeEventListener('seeked', done); video.removeEventListener('error', failed); signal?.removeEventListener('abort', aborted); this.cleanups.delete(cancel);
        if (error) reject(error); else resolve();
      };
      const done = () => finish();
      const failed = () => finish(new StudioError('VIDEO_SEEK', 'Video failed while seeking.'));
      const aborted = () => finish(new StudioError('ABORTED', 'Video seek cancelled.', signal?.reason));
      const cancel = () => finish(new StudioError('DISPOSED', 'AssetManager disposed during video seeking.'));
      const timer = setTimeout(() => finish(new StudioError('VIDEO_TIMEOUT', 'Timed out seeking video.')), LOAD_TIMEOUT);
      this.cleanups.add(cancel);
      video.addEventListener('seeked', done, { once: true }); video.addEventListener('error', failed, { once: true }); signal?.addEventListener('abort', aborted, { once: true });
      try { video.pause(); video.currentTime = target; } catch (error) { finish(new StudioError('VIDEO_SEEK', 'Video time could not be set.', error)); }
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const cancel of [...this.cleanups]) cancel();
    this.cleanups.clear();
    for (const video of this.ownedVideos) { video.pause(); video.removeAttribute('src'); video.load(); }
    this.ownedVideos.clear(); this.pending.clear(); this.sources.clear(); this.urls.clear(); this.registered.clear();
  }
}
