import { StudioError, serializeScene } from '@bookklik/device-mockup-studio-core';
import { abortable, checkAbort, numberInRange, snapshot } from './common.js';
/** Call from a user gesture. Revocation is deferred so the browser can consume the download URL. */
export function downloadBlob(blob, filename) {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function')
        throw new StudioError('DOWNLOAD_UNAVAILABLE', 'downloadBlob requires a browser document and object URLs.');
    if (!blob || !blob.size)
        throw new StudioError('DOWNLOAD_EMPTY', 'Cannot download an empty Blob.');
    if (!filename.trim() || /[\u0000-\u001f/\\]/.test(filename))
        throw new StudioError('DOWNLOAD_FILENAME', 'Provide a nonempty filename without control characters or path separators.');
    const url = URL.createObjectURL(blob);
    let anchor;
    try {
        anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.rel = 'noopener';
        anchor.style.display = 'none';
        (document.body ?? document.documentElement).appendChild(anchor);
        anchor.click();
    }
    finally {
        anchor?.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
/** Portable by default: no expiring blob URLs or remote dependencies. Does not fetch/embed remote media. */
export function exportSceneJSON(scene, options = {}) {
    const maxBytes = numberInRange(options.maxBytes ?? 64 * 1024 * 1024, 'maxBytes', 1, 256 * 1024 * 1024);
    let estimated = 0;
    for (const asset of scene.assets) {
        estimated += asset.src.length;
        if (estimated > maxBytes)
            throw new StudioError('PROJECT_SIZE_LIMIT', 'Project assets exceed the JSON size limit.');
        // Data URLs may be base64 or URI-encoded (e.g. an SVG fixture).
        // Validate the envelope only: serialization neither decodes nor executes media.
        if (options.portable !== false && !/^data:(image|video)\/[a-z0-9.+-]+(?:;[a-z0-9.+_-]+(?:=[^;,\s]+)?)*,.+$/is.test(asset.src))
            throw new StudioError('PROJECT_NOT_PORTABLE', `Asset '${asset.id}' is not an image/video data URL. Import/embed its media before saving a portable project.`);
    }
    const json = serializeScene(scene);
    const blob = new Blob([json], { type: 'application/json' });
    if (blob.size > maxBytes)
        throw new StudioError('PROJECT_SIZE_LIMIT', 'Serialized project exceeds the JSON size limit.');
    return blob;
}
/** Small sharing payloads only; object URLs/downloads are preferable for large exports. */
export async function blobToDataURL(blob, options = {}) {
    checkAbort(options.signal);
    const limit = numberInRange(options.maxBytes ?? 2 * 1024 * 1024, 'maxBytes', 1, 8 * 1024 * 1024);
    const mime = blob.type || 'application/octet-stream';
    if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mime))
        throw new StudioError('DATA_URL_MIME', 'Data URL requires a simple MIME type.');
    // maxBytes bounds the complete ASCII URL, INCLUDING base64 expansion and prefix.
    if (4 * Math.ceil(blob.size / 3) + mime.length + 13 > limit)
        throw new StudioError('DATA_URL_SIZE_LIMIT', 'Data URL would exceed the link size guard. Download or use an explicit share provider instead.');
    const bytes = new Uint8Array(await abortable(blob.arrayBuffer(), options.signal));
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 8192) {
        checkAbort(options.signal);
        chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
    }
    if (typeof btoa !== 'function')
        throw new StudioError('DATA_URL_UNAVAILABLE', 'This runtime does not provide base64 encoding (btoa).');
    checkAbort(options.signal);
    return `data:${mime};base64,${btoa(chunks.join(''))}`;
}
/** Explicit opt-in provider; the SDK itself supplies no hosting and sends no network requests. */
export async function shareScene(scene, provider, signal) {
    checkAbort(signal);
    const document = snapshot(scene), blob = exportSceneJSON(document);
    const result = await abortable(provider.share({ blob, scene: document, filename: 'scene.mockup.json', signal }), signal);
    const url = new URL(result.url);
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
        throw new StudioError('SHARE_URL', 'Share provider must return an HTTP(S) URL.');
    return { url: url.href };
}
//# sourceMappingURL=helpers.js.map