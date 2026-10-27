import { StudioError } from '@bookklik/device-mockup-studio/core';
import { abortable, acquireRenderer, checkAbort, numberInRange, outputDimensions, snapshot, verifyDimensions } from './common.js';
export function imageMime(format = 'png') {
    switch (format) {
        case 'png': return 'image/png';
        case 'jpeg': return 'image/jpeg';
        case 'webp': return 'image/webp';
        default: throw new StudioError('IMAGE_FORMAT', `Unsupported image format '${String(format)}'. Choose png, jpeg, or webp.`);
    }
}
export function imageQuality(quality) { return quality === undefined ? undefined : numberInRange(quality, 'quality', 0, 1); }
const browserCanvasEncoder = (canvas, options) => {
    if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function')
        return canvas.convertToBlob({ type: options.type, quality: options.quality });
    if ('toBlob' in canvas && typeof canvas.toBlob === 'function')
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new StudioError('IMAGE_ENCODE', 'Canvas encoder returned no image (it may be tainted by a non-CORS asset).')), options.type, options.quality);
        });
    throw new StudioError('IMAGE_ENCODER_MISSING', 'Canvas has neither convertToBlob nor toBlob. Supply an encodeCanvas adapter, for example for @napi-rs/canvas.');
};
/** Check MIME AND magic bytes: browsers may silently return PNG for an unsupported requested MIME. */
export async function verifyImageBlob(blob, type, signal) {
    checkAbort(signal);
    if (!blob || typeof blob.arrayBuffer !== 'function' || !blob.size)
        throw new StudioError('IMAGE_ENCODE', 'Canvas encoder returned an empty or invalid Blob.');
    const actual = blob.type.toLowerCase().split(';')[0];
    if (actual !== type)
        throw new StudioError('IMAGE_MIME', `Requested ${type}, but canvas encoded ${actual || 'an unknown MIME type'}. This browser does not support the requested format; try PNG.`);
    const bytes = new Uint8Array(await abortable(blob.slice(0, 16).arrayBuffer(), signal));
    const match = type === 'image/png'
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)
        : type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80;
    if (!match)
        throw new StudioError('IMAGE_SIGNATURE', `Encoded bytes do not match ${type}; refusing a mislabeled image.`);
}
export async function encodeCanvasBlob(canvas, type, quality, signal, encoder = browserCanvasEncoder) {
    checkAbort(signal);
    let blob;
    try {
        blob = await abortable(Promise.resolve().then(() => encoder(canvas, { type, quality, signal })), signal);
    }
    catch (error) {
        if (error instanceof StudioError || error instanceof Error && error.name === 'AbortError')
            throw error;
        throw new StudioError('IMAGE_ENCODE', 'Canvas image encoding failed. Check image CORS permissions and browser format support.', error);
    }
    await verifyImageBlob(blob, type, signal);
    checkAbort(signal);
    return blob;
}
export async function exportImage(renderer, scene, options = {}) {
    checkAbort(options.signal);
    const type = imageMime(options.format), quality = imageQuality(options.quality);
    const { width, height, scale } = outputDimensions(scene, options.scale);
    const time = options.time ?? 0;
    if (!Number.isFinite(time) || time < 0)
        throw new StudioError('EXPORT_TIME', 'Image time must be finite and non-negative scene seconds.');
    const document = snapshot(scene);
    const release = await acquireRenderer(renderer, options.signal);
    try {
        await abortable(renderer.render(document, time, { scale, signal: options.signal }), options.signal);
        checkAbort(options.signal);
        verifyDimensions(renderer, width, height);
        return await encodeCanvasBlob(renderer.canvas, type, quality, options.signal, options.encodeCanvas);
    }
    finally {
        release();
    }
}
//# sourceMappingURL=images.js.map