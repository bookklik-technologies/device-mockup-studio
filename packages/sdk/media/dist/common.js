import { StudioError, cloneScene } from '@bookklik/device-mockup-studio/core';
export const MEDIA_LIMITS = Object.freeze({ maxSide: 8192, maxPixels: 32_000_000, maxVideoSide: 4096, maxVideoPixels: 16_777_216, maxFrames: 10_000, maxFps: 240, maxDuration: 3600, defaultOutputBytes: 128 * 1024 * 1024, maxOutputBytes: 256 * 1024 * 1024, maxPendingFrames: 4 });
export function abortError(signal) {
    const error = new Error('Media export cancelled.', { cause: signal?.reason });
    error.name = 'AbortError';
    return error;
}
export function checkAbort(signal) { if (signal?.aborted)
    throw abortError(signal); }
export function abortable(promise, signal) {
    if (!signal)
        return Promise.resolve(promise);
    if (signal.aborted) {
        void Promise.resolve(promise).catch(() => undefined);
        return Promise.reject(abortError(signal));
    }
    return new Promise((resolve, reject) => {
        const abort = () => { cleanup(); reject(abortError(signal)); };
        const cleanup = () => signal.removeEventListener('abort', abort);
        signal.addEventListener('abort', abort, { once: true });
        Promise.resolve(promise).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    });
}
export function numberInRange(value, name, min, max) {
    if (!Number.isFinite(value) || value < min || value > max)
        throw new StudioError('EXPORT_OPTIONS', `${name} must be finite and between ${min} and ${max}.`);
    return value;
}
export function outputDimensions(scene, scale = 1, video = false) {
    if (!Number.isFinite(scale) || scale <= 0)
        throw new StudioError('EXPORT_SCALE', 'Export scale must be positive and finite.');
    if (!Number.isFinite(scene.width) || !Number.isFinite(scene.height) || scene.width <= 0 || scene.height <= 0)
        throw new StudioError('EXPORT_DIMENSIONS', 'Scene dimensions must be positive and finite.');
    const width = Math.round(scene.width * scale), height = Math.round(scene.height * scale);
    const side = video ? MEDIA_LIMITS.maxVideoSide : MEDIA_LIMITS.maxSide;
    const pixels = video ? MEDIA_LIMITS.maxVideoPixels : MEDIA_LIMITS.maxPixels;
    if (width < 1 || height < 1 || width > side || height > side || width * height > pixels)
        throw new StudioError('EXPORT_DIMENSIONS', `Output dimensions exceed limits: 1–${side}px per side, ${pixels} pixels total (after rounding).`);
    if (video && (width % 2 || height % 2))
        throw new StudioError('EXPORT_DIMENSIONS', 'Video output dimensions must both be even; choose a different scene size or scale. No implicit cropping/padding is performed.');
    return { width, height, scale };
}
export function timeline(scene, options, video = false) {
    checkAbort(options.signal);
    const dimensions = outputDimensions(scene, options.scale, video);
    const fps = numberInRange(options.fps ?? scene.fps, 'fps', 1, MEDIA_LIMITS.maxFps);
    const duration = options.duration ?? scene.duration;
    if (!Number.isFinite(duration) || duration <= 0 || duration > MEDIA_LIMITS.maxDuration)
        throw new StudioError('EXPORT_DURATION', `Export duration must be positive, finite and at most ${MEDIA_LIMITS.maxDuration} seconds.`);
    // Avoid a floating-point phantom frame for mathematically integral durations (e.g. 1001/30000 * 30).
    const product = duration * fps;
    const frameCount = Math.max(1, Math.ceil(product - Math.min(1e-8, product * Number.EPSILON * 8)));
    if (frameCount > MEDIA_LIMITS.maxFrames)
        throw new StudioError('EXPORT_FRAME_LIMIT', `Export exceeds the ${MEDIA_LIMITS.maxFrames} frame limit. Reduce fps or duration.`);
    return { ...dimensions, fps, duration: frameCount / fps, requestedDuration: duration, frameCount };
}
export function snapshot(scene) { return cloneScene(scene); }
export function verifyDimensions(renderer, width, height) {
    if (renderer.canvas.width !== width || renderer.canvas.height !== height)
        throw new StudioError('RENDER_DIMENSIONS', 'Renderer output dimensions do not match the requested export.');
}
export function progress(callback, value, signal) {
    checkAbort(signal);
    callback?.(value);
    checkAbort(signal);
}
// Serialize media jobs for a renderer, including the encoding/snapshot step after render().
// Direct preview render() calls are outside this lock: callers should dedicate a renderer to export.
const rendererTails = new WeakMap();
export async function acquireRenderer(renderer, signal) {
    checkAbort(signal);
    const previous = rendererTails.get(renderer) ?? Promise.resolve();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const tail = previous.then(() => gate);
    rendererTails.set(renderer, tail);
    void tail.then(() => { if (rendererTails.get(renderer) === tail)
        rendererTails.delete(renderer); });
    try {
        await abortable(previous, signal);
        checkAbort(signal);
        return release;
    }
    catch (error) {
        release();
        throw error;
    }
}
export const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
//# sourceMappingURL=common.js.map