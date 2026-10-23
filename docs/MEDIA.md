# Browser media/export package (v0.1)

`@mockup-studio/media` is browser-first, strict TypeScript, safe to import from Node, and does not inspect/create browser globals at import time. It exports real image encodes, looping animated GIFs, pull-driven image sequences and offline WebCodecs video. **All video exports are silent. There is no audio track, audio mixing, audio passthrough, MediaRecorder export or real-time recording fallback in v0.1.** A video asset's visual frames are sought by the renderer; its audio is not exported.

## Main API

```ts
import {
  exportGIF, exportImage, exportFrames, exportVideo, getCapabilities,
  probeCapabilities, downloadBlob,
} from '@mockup-studio/media';

const controller = new AbortController();
const png = await exportImage(renderer, scene, {
  format: 'png', scale: 2, time: 0.5, signal: controller.signal,
});
downloadBlob(png, 'composition.png'); // invoke download from a user gesture

// Offline PNG sequence. No VideoEncoder required. Consume incrementally; do not
// collect thousands of full-resolution blobs unless you have your own storage budget.
for await (const { index, time, blob } of exportFrames(renderer, scene, {
  fps: 30, duration: 2, scale: 1, signal: controller.signal,
})) {
  await saveFrameSomewhere(index, time, blob);
}

const webm = await exportVideo(renderer, scene, {
  format: 'webm', fps: 30, duration: 2, bitrate: 8_000_000,
  signal: controller.signal, onProgress: p => updateProgress(p),
});
downloadBlob(webm, 'composition.webm');

const gif = await exportGIF(renderer, scene, {
  fps: 20, duration: 2, signal: controller.signal,
  onProgress: p => updateProgress(p),
});
downloadBlob(gif, 'composition.gif');
```

All time inputs and frame `time` values are **scene seconds**. An image defaults to `time: 0`, `scale: 1`, `format: 'png'`. `quality` is optional, finite, inclusive 0–1, and passed to the native encoder; browsers ignore it for PNG. Frames default to scene fps/duration and PNG; optional `format: 'jpeg' | 'webp'` and `quality` are also supported. Format names and invalid numeric values are rejected rather than coerced/clamped. Image time must be nonnegative and finite.

### Determinism and renderer ownership

The scene is cloned/validated once at export start. Each render is awaited, including asset loading/video seeking. Frame indices are `0…ceil(duration * fps)-1`; scene render time is exactly `index / fps`, never elapsed wall-clock time. Near-integer products are stabilized against floating-point phantom frames. **The final frame is complete**, so video duration is `frameCount / fps` and may exceed the requested duration by less than one frame. There is no duplicate endpoint frame. A duration <= 0 is an error, not an empty or corrupt video.

Pixels are deterministic to the renderer's guarantees for the same scene, assets, fonts, scale, time and runtime. Native JPEG/WebP/video encoders are not promised byte-identical across browsers/devices. Browser fonts/CORS/video decode remain platform-dependent. Image byte signatures and MIME labels are verified; a browser silently falling back to PNG for WebP/JPEG is an explicit error suggesting PNG. JPEG cannot preserve alpha; choose an opaque scene background for predictable compositing. Video deliberately discards alpha and is not a transparent-video implementation.

Media calls sharing a renderer are serialized through render **and** encode. For consistent export, dedicate a renderer/canvas to the export job (share its AssetManager only if the renderer's video-seeking ownership permits it). Direct preview `renderer.render()` calls are outside the media lock and must not draw into the same canvas during export. `exportFrames` holds the lock while its generator is open; consume it in `for await` or call `return()` when abandoning it. Aborting its signal releases the renderer even if the consumer is paused at `yield`. No renderer/AssetManager supplied by the caller is disposed by the media package.

## Offline video and formats

- **WebM:** VP9 (`vp09.00.10.08`) preferred, VP8 fallback. Exact-size/fps/bitrate configuration is probed with `VideoEncoder.isConfigSupported` before creating the encoder. WebM is the minimum format; a browser without either codec gets a useful rejection and can still use `exportFrames`.
- **MP4 (optional):** AVC/H.264 configurations are tried in descending profile/level compatibility, using WebCodecs AVC-length-prefixed (`avc.format: 'avc'`) output and `mp4-muxer`. This is a real silent MP4 when the browser offers H.264 encoding, not a renamed WebM. Output uses a conventional final `moov` atom (not fast-start or fragmented MP4). Codec availability and any codec patent/licensing obligations are the integrator's responsibility.
- **GIF:** `exportGIF` writes a looping GIF89a using the bundled JavaScript encoder, with no WebCodecs dependency. Defaults to scene duration and scene fps capped at 30; explicit fps must be 1–50. Adjacent rounded centisecond timestamps avoid timing drift. Each frame has up to 256 colors and one-bit alpha (alpha below 128 becomes transparent); partial opacity is not preserved. Frames clear to transparent between displays so moving objects leave no trails. GIF requires a readable Canvas2D renderer, including the spatial renderer's public Canvas2D output. Image dimension limits apply, including odd dimensions. The usual frame/duration limits and 128 MiB default / 256 MiB maximum `maxOutputBytes` apply. The byte limit is checked after each encoded frame; working memory includes a raw frame, palette indices, one encoded frame, accumulated output and the final Blob. Progress reaches 1 only after Blob creation; cancellation is checked between rendering, quantization and frames.
- There is no APNG, arbitrary video transcoding, audio, zip, server export or MediaRecorder recorder in this package. A frame sequence is **not equivalent to a finished video**, and is not called a realtime fallback.

`VideoFrame` timestamps are `round(index * 1_000_000 / fps)` microseconds; durations use adjacent rounded timestamps, preventing accumulation drift at fractional fps. Keyframes are requested at frame 0 and approximately every two seconds. The codec is configured with `latencyMode: 'realtime'` **only to avoid reordered/B-frame output**; the process is still entirely offline and can run faster/slower than playback. Reordered/dropped/duplicate frames, non-key initial output, wrong frame counts and malformed outputs are rejected rather than quietly producing inaccurate media.

WebM's upstream muxer stores timecodes at millisecond resolution (less than 1 ms quantization from the supplied microseconds) and a nanosecond `DefaultDuration`. Its pinned version stores the final frame **start** in `Segment/Info/Duration`; this package parses the EBML element boundaries and repairs only that float64 duration metadata to `frameCount / fps`. The container, sample blocks, cues, headers and track metadata are created by the muxer, not a homegrown WebM implementation. MP4 sample timestamps/durations are provided on the same microsecond frame grid. For integer fps its muxer uses that frame rate as timescale; for fractional fps it uses the muxer's 57,600 Hz timescale (less than 17.4 µs timebase quantization), since its `frameRate` option accepts integers only.

### Backpressure, cancellation and progress

- At most four submitted frames may be pending; the encoder is flushed after each four-frame batch, when its queue reaches four, or when four outputs remain outstanding. This bounds retained frames even when `encodeQueueSize` is zero but output is buffered. All frames are closed immediately after `encode()`, including throws.
- A final awaited `flush()` precedes mux finalization. Encoder configuration probes and flushes have 30-second timeouts. Asynchronous VideoEncoder errors are raced against rendering/flushing and propagated. Encoders are closed and retained mux data released on success, error and cancellation, including late asynchronous adapter creation.
- Pass `AbortSignal` to all helpers. Pre-aborted requests never start work; pending render/encode/flush operations are raced with cancellation. Browsers may complete a native canvas encode after cancellation, but its result is not returned. Aborts reject with an `Error` named `AbortError`, with original signal reason as its cause.
- Progress is monotonic 0–1: images have no progress callback; frames report completed image blobs; video reserves 0–0.95 for emitted/muxed samples and emits 1 only after successful finalization. Cancellation/error never emits a success completion. Callback exceptions reject and clean up. Use progress for UI feedback, not as a wall-clock estimate.

### Resource limits (also exported as `MEDIA_LIMITS`)

| Resource | Limit |
| --- | --- |
| Images/frame sequence output | 8192 px per side, 32,000,000 pixels total |
| Video output | **Even** dimensions, <=4096 px per side, <=16,777,216 pixels; actual codec may support less |
| FPS | Finite 1–240, fractional rates allowed |
| Duration | Positive finite, at most 3600 seconds |
| Samples | At most 10,000 frames per operation |
| Requested bitrate | 64,000–100,000,000 bits/sec; default size/fps heuristic, 1–20 Mbit/sec |
| Encoded/container bytes | 128 MiB default; `maxOutputBytes` integer 1024…256 MiB |
| Per-output codec description | At most 4 MiB |

Scaled dimensions use `Math.round(sceneDimension * scale)`, matching the renderer. Tiny/huge scales are rejected before allocation; odd video dimensions are rejected explicitly, never silently cropped/padded. A conservative bitrate × complete duration estimate must fit the output budget. VBR overshoot is still checked against the hard encoded-payload limit before allocating/copying chunks, and actual container writes are capped before storage allocation.

The muxer uses a seekable fixed-64-KiB-page StreamTarget sink; header rewrites overwrite existing bytes, not corrupt append-only concatenation. Retained output cannot grow beyond the configured budget (up to one page per allocated portion), sample metadata is bounded by the frame limit, and decoder descriptions are bounded. This is **not a zero-copy constant-memory streaming-to-disk API**: muxer working buffers, the final Blob, page storage and native encoder memory can temporarily coexist (budget for several times the byte cap, plus canvases and <=4 raw frames). On memory-constrained devices choose smaller dimensions/byte budgets, or consume `exportFrames` into your own incremental storage. This v0.1 API does not retain an unbounded array of input frames or encoded samples.

## Capability detection

`getCapabilities()` is synchronous and allocation-free: `{ videoEncoder, videoFrame, mediaRecorder, offscreenCanvas, audio: false, formats }`. `formats` includes PNG/JPEG/WebP/GIF/WebM/MP4 MIME types, candidate video codecs and `supported: boolean | null`. GIF reports `true` because its encoder is bundled; supplying a readable Canvas2D renderer remains the caller's responsibility. **`null` means unprobed**; constructor presence is not codec support. `mediaRecorder` reports presence only and does not imply this SDK records realtime video.

`await probeCapabilities({width: 1920, height: 1080, fps: 30, bitrate: 8_000_000, signal})` checks exact video configurations and real 2×2 image encodes with MIME/signature verification. A returned `selectedCodec` is an `isConfigSupported` result, not a guarantee of future GPU/driver availability. If there is no browser canvas (e.g. Node with an injected renderer), image capability remains `null`; export may still work using an encoding adapter. A WebCodecs secure context is normally required (HTTPS or localhost).

## Node/injected canvas encoding

No browser or Node-canvas objects are constructed on module import. `exportImage`/`exportFrames` accept an `encodeCanvas` adapter; dimensions are still validated, and its returned Blob's actual MIME **and bytes** are checked. Prefer this explicit adapter to pretending a Node Canvas implements all HTMLCanvas APIs.

```ts
const encodeCanvas = async (canvas, { type, quality }) => {
  const format = type === 'image/jpeg' ? 'jpeg' : type === 'image/webp' ? 'webp' : 'png';
  // canvas is your @napi-rs/canvas instance, explicitly cast in strict TS.
  const data = format === 'png'
    ? await canvas.encode('png')
    : await canvas.encode(format, Math.round((quality ?? .92) * 100));
  return new Blob([new Uint8Array(data)], { type });
};
const image = await exportImage(renderer, scene, { encodeCanvas });
```

The default adapter uses OffscreenCanvas `convertToBlob`, else HTMLCanvas `toBlob`. CORS/taint/null results reject. There is no data-URL conversion fallback that hides unsupported MIME encodes. Real Node image encodes are tested with `@napi-rs/canvas`; WebCodecs lifecycle/muxing tests use explicit mocks and do not claim synthetic samples are decodable video. A separate one-off Chromium 141 smoke also verified real PNG/JPEG/WebP decode at 320×180, six frames at 24 fps, and both silent VP9/WebM and AVC/MP4 with 0.25-second metadata, successful midpoint seeking and expected decoded background pixels (within lossy chroma tolerance). The root browser suite remains the maintained browser integration entry point.

## Adapter seam / dependencies and licenses

GIF encoding uses pinned [`gifenc` 1.0.3](https://github.com/mattdesl/gifenc), MIT, Copyright (c) 2017 Matt DesLauriers. Its license is copied to `artifacts/licenses/gifenc-LICENSE.txt` when building the browser bundles.

`EncoderMuxerAdapter` provides `{format, mimeType, configurations(parameters), createMuxer(parameters, config)}`. The muxer implements `{addVideoChunk, finalize, dispose}`. The central export loop retains capability checking, exact scene/timestamp stepping, hard encoded-size checks, backpressure, cancellation and cleanup. A custom muxer **must** bound its own retained/container output, synchronously consume/copy each chunk and idempotently dispose its data. Omit `format` when using a non-built-in adapter. `createWebMAdapter()` and `createMP4Adapter()` are exported reference implementations.

Pinned dependencies: [`webm-muxer` 5.1.4](https://github.com/Vanilagy/webm-muxer) and [`mp4-muxer` 5.2.2](https://github.com/Vanilagy/mp4-muxer), both **MIT**; upstream notices are `Copyright (c) 2022 Vanilagy` (WebM) and `Copyright (c) 2023 Vanilagy` (MP4). See each distributed package's LICENSE for the complete permission/warranty notice. **Both upstream packages are deprecated in favor of Mediabunny.** They are used here deliberately as narrow, proven v0.1 muxers rather than writing containers from scratch; the adapter seam allows replacing them. Retain their MIT notices when bundling/distributing; do not present this package's MIT license as overriding codec patent obligations.

## Saving / sharing / download helpers

- `downloadBlob(blob, filename)` clicks a temporary hidden download link, removes it, and revokes its object URL **after 1000 ms**, not synchronously before the browser consumes it. Filenames cannot contain path separators/control characters; empty data is rejected. It requires a browser and should be called from a user gesture.
- `exportSceneJSON(scene, {portable: true, maxBytes: 64*1024*1024})` returns versioned `application/json`. Portable is default and requires image/video data URLs for every asset (base64 or URI-encoded, including the demo's original SVG fixture); it does **not** fetch remote assets, rewrite resources referenced inside media, or embed expiring blob URLs. Import assets via the renderer/core workflow first. `portable: false` deliberately allows externally referenced projects. There is no hosted storage. Reopen using core `deserializeScene`.
- `blobToDataURL(blob, {maxBytes: 2*1024*1024, signal})` guards the **complete ASCII link size including base64 expansion** (maximum configurable guard 8 MiB). Large media should be downloaded, not put into a URL.
- `ShareProvider` / `shareScene(scene, provider, signal)` are explicit opt-in interfaces. A provider gets portable JSON plus the cloned scene and owns its authentication/storage/privacy policy. The package includes no provider, network upload or analytics. Returned URLs must be HTTP(S); portable scenes may contain private image/video bytes, so obtain user consent before invoking a network provider.
