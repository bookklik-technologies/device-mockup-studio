# API guide — v0.3

See [SPATIAL.md](SPATIAL.md) for the optional 3D renderer, physical materials and editor rendererFactory. All v0.1 APIs below remain available.

Public types are in packages/core/src/types.ts and each package's emitted declarations. All packages use ESM. There are no module-level DOM accesses.

## Headless SDK

Import `createHeadlessStudio` from `@mockup-studio/sdk/headless` for a UI-free integration. This entry re-exports core, presets, render and media, without importing the editor or Three.js. The full SDK also exports the factory.

- Options: `scene`, `canvas`, `canvasFactory`, `assets`, `deviceAssets`, `encodeCanvas`, `onChange`, and optional `rendererFactory(canvas, options)`.
- Exposes `store`, `renderer`, `canvas` and a copied `scene` snapshot.
- `render(time?, options?)` and `exportImage(options?)` are asynchronous, serialized, and capture the current scene when called. Edits do not automatically render.
- `serialize()` returns portable JSON; `load(json)` validates and replaces the scene with undo history.
- `destroy()` is idempotent and releases the store and renderer, but not borrowed asset managers. Later studio operations fail.
- SSR imports need no DOM. Node construction requires an injected canvas implementation, with a Blob encoder for export. Optional 3D requires an explicitly injected spatial renderer and WebGL2.

See [HEADLESS.md](HEADLESS.md) for complete browser and Node examples, asset loading, ownership and lifecycle behavior.

## Scene model and factories

- createScene(options?: Partial<SceneDocument>) supplies a 1200×900, 4s, 30fps scene. It validates the completed document.
- createMockup, createText, createShape supply node defaults. Validate the final document after adding arbitrary factory output; factories are construction helpers, not independent complete-scene validators.
- SceneDocument version 1 contains assets, nodes, tracks, background, effects, seed, canvas and timeline settings.
- x/y are center positions, width/height are local dimensions, scale is uniform, rotation/tiltX/tiltY are degrees. Node order is back-to-front. Hidden nodes do not draw.
- Assets are serializable metadata, not decoded handles. Prefer data URLs for portable projects. HTTP(S) and blob URLs can be used transiently but portability differs.
- Mockup nodes reference assets by ID. Device IDs resolve through the presets registry. Shape types are rectangle/ellipse/ring; text is wrapped within its local box.

```ts
import { createScene, createMockup, SceneStore } from '@mockup-studio/core';
const node = createMockup({ deviceId: 'phone', x: 540, y: 540, width: 320, height: 650 });
const store = new SceneStore(createScene({ width: 1080, height: 1080, nodes: [node] }));
store.update(draft => { draft.nodes[0].rotation = -8; });
store.transaction(tx => {
  tx.updateNode(node.id, { x: 520 });
  tx.updateNode(node.id, { y: 560 });
}); // one history entry
store.undo(); store.redo();
const unsubscribe = store.subscribe(scene => { /* isolated snapshot */ });
unsubscribe(); store.dispose();
```

SceneStore scene/snapshot getters and observers expose defensive mutable copies, never internal state. Immutable media strings are shared rather than duplicated in history. History keeps up to 100 entries. Use update's draft, not reentrant store updates inside update. Group edits with transaction. Nested transactions use rollback savepoints. setScene(scene,false) clears history outside a transaction; inside one it throws TRANSACTION_ACTIVE.

## Validation and JSON

validateScene(unknown) returns path/message issues; assertScene throws StudioError with code INVALID_SCENE. deserializeScene parses only explicit version 1; unsupported/future versions are rejected, never silently migrated. serializeScene emits pretty JSON. Unknown fields, invalid enums/numbers, cross-reference errors, accessors, custom prototypes, cycles and excessive structure are rejected. IDs are globally unique across the scene.

Bounded model input: 2,000 nodes; 10,000 tracks; 100,000 total keyframes; 48MiB characters per source string and 128MiB total; 500,000 preflight visits; 200 reported issues; 150MiB characters before JSON.parse. These limits are safeguards, not a promise that every maximum-sized scene renders interactively. Do not deserialize untrusted data on a server without your own resource and URL policy.

## Presets and devices

getPresets() returns fresh descriptors {id,name,category,apply}. applyPreset(scene,id) returns an independent scene, preserving assets, node IDs and animation timing. It arranges existing visible/unlocked mockups; empty scenes stay empty and text/shapes are not automatically reflowed. getDevice/listDevices return copies. registerDevice validates a procedural or photographic frame definition; registering a duplicate ID intentionally replaces that definition for future renders. listDevices({includeLegacy:false}) provides the editor catalog. See [device artwork](DEVICE-ARTWORK.md) for artwork metadata, embedded assets and headless frame registration.

The 17 definitions include seven primary families plus orientation variants. Insets/radii are nominal node-local pixels; they are not physical hardware measurements. framePresets lists nine social sizes. Custom catalogs can be supplied through your own UI and registerDevice.

## Complete scene templates and fonts

`getTemplates({ workspace?: '2d' | '3d' })` returns fresh `SceneTemplate` descriptors (`id`, `name`, `category`, `workspace`, `description`). `applyTemplate(scene, templateId, { assetId? })` returns a new version-1 scene with a complete editable composition. It retains project identity, canvas/timeline settings, seed, and all existing assets, replacing nodes, tracks, effects, and spatial settings. Unlike `applyPreset`, it replaces locked and hidden layers too. Apply it through `editor.setScene(next)` for a single undoable replacement and playback reset. The editor's Presets action also selects the main editable layer. Designs may intentionally crop devices and decorative artwork; primary copy stays inside the canvas.

The optional asset ID takes priority over media from existing mockups and other assets. Media cycles across available template slots. Playback settings come from the first existing mockup referencing each video, keeping repeated video instances synchronized. Without media, original embedded SVG sample assets are included. Unknown IDs throw `UNKNOWN_TEMPLATE`. The 3D templates require `SpatialRenderer`.

```ts
import { getTemplates, applyTemplate, fontFamilies } from '@mockup-studio/sdk';
const templates = getTemplates({ workspace: '2d' });
editor.setScene(applyTemplate(editor.getScene(), templates[0]!.id, { assetId: 'design' }));
// fontFamilies describes the twelve demo fonts: id, family, category, weights.
```

The demo bundles `fonts/fonts.css`, WOFF2 files, and individual licenses. Hosts must provide matching `@font-face` rules themselves; imported custom family names are preserved. Async CanvasRenderer and SpatialRenderer await visible text faces using the canvas document's FontFaceSet. Font loading errors reject the render; unregistered custom names retain browser fallback behavior. Node/SSR imports do not access document globals, and headless/synchronous callers register or preload fonts themselves. Normal Latin variable fonts are bundled; other scripts use available system fallbacks.

## Renderer and assets

```ts
import { CanvasRenderer, AssetManager, createMagicBackground } from '@mockup-studio/render';
const assets = new AssetManager();
const renderer = new CanvasRenderer(canvas, { assets });
const asset = await assets.importFile(file); // data URL, metadata and loaded handle
scene.assets.push(asset);
await renderer.render(scene, 0.5, { scale: 1, signal });
const source = assets.get(asset.id)!;
scene.background = createMagicBackground(source, { colors: 3, animated: true }).background;
renderer.dispose(); // does not dispose externally supplied assets
assets.dispose();
```

renderSync assumes every used asset is already loaded/registered and video has already been prepared for the requested time. Prefer await render for video. AssetManager.prepareFrame handles load/seek; it does not supply an independent decoder per node. Different timing on a reused video raises VIDEO_TIMING_CONFLICT. Register separate independently loaded IDs to avoid that ambiguity. Borrowed registered videos are paused while preparing frames but not destroyed on disposal.

A dedicated renderer/canvas should be used for each export job; a preview must not draw into that canvas during blob/frame capture. The editor follows this rule. Async render jobs on a renderer are serialized, but public renderSync deliberately remains immediate.

In Node, inject canvasFactory and register compatible decoded sources (see tests/render.test.ts); no browser source loader is silently substituted. Browser output is limited to 8192px/side and 32MP. Scene inputs may describe larger geometry that is texture-capped. Tilt rendering is clamped to ±80°, font size to 2000px, font weight to ≥100, blur to 100px and shadow blur to 300px for stability. Mesh perspective and translucent glass are approximations; tiny semitransparent mesh overlaps may vary by canvas backend. Text/font appearance depends on fonts installed and loaded by the caller.

createMagicBackground samples a 48×48 local raster, quantizes colors, prioritizes saturated/distinct clusters and constructs 2–6 gradient stops. It is deterministic for the same pixels, not an AI service. Fully transparent sources and tainted/CORS canvases fail explicitly.

## Animation

createAnimationTracks(node,preset,duration) supports the exported, readonly `animationPresets` list: float, orbit, reveal, zoom, parallax, fade-in, fade-out, slide-left, slide-right, slide-up, slide-down, pulse, bounce, sway, spin, and flip. Slides named left/right enter from that side; slide-up enters from below and slide-down from above. Float, orbit, parallax, pulse, bounce, sway, and spin loop visually. Entrances and fades hold their final value. Replace conflicting tracks for the node/property before appending; duplicate targets are invalid. Keyframes use seconds with strictly increasing times in [0,duration]. Easing lives on the outgoing/left keyframe: linear, ease-in, ease-out, ease-in-out or spring. evaluateScene(scene,time) returns a validated copy evaluated at clamped time; it does not mutate scene. Looping preview is controlled by the caller/editor; the evaluator holds endpoint values outside the range.

`Fit` accepts `cover`, `contain`, or `stretch` for mockup media and image backgrounds. `computeFit(..., 'stretch')` maps the complete source onto the complete destination, ignoring focal placement while retaining finite-value validation. Stretch may change proportions. The same fit math serves 2D rendering, spatial raster textures, video frames, and exports. Scene serialization remains version 1; older validators that only accept cover/contain will reject a scene using Stretch.

## Media export

- exportGIF(renderer,scene,{fps,duration,scale,onProgress,signal,maxOutputBytes}) returns a looping image/gif Blob without WebCodecs. Defaults to scene fps capped at 30; accepts 1–50 fps. Uses 256 colors and one-bit transparency per frame, with opacity below 50% made transparent. Frame delays use adjacent rounded centisecond timestamps.
- exportImage(renderer,scene,{format:'png'|'jpeg'|'webp',scale,quality,time,signal}) returns a Blob. Actual MIME and file signature are checked. No silent PNG fallback labeled as WebP. JPEG cannot retain alpha; set a solid scene background for a predictable matte rather than relying on the browser canvas encoder's flattening color.
- exportFrames(renderer,scene,{fps,duration,scale,format,onProgress,signal}) is an async generator of {index,time,blob}. It is a pull-driven fallback with no video encoder requirement.
- exportVideo(renderer,scene,{format:'webm'|'mp4',fps,duration,scale,bitrate,onProgress,signal,maxOutputBytes,adapter}) uses deterministic offline WebCodecs frame stepping. No MediaRecorder fallback is hidden underneath it.
- Video requires even output dimensions and supported secure-context encoders. Built-ins prefer VP9/VP8 for WebM and AVC for MP4. All outputs are SILENT; alpha is discarded. Fractional frame rates supported; whole frames round duration up.
- getCapabilities reports presence and unprobed formats as null, not true. Await probeCapabilities for format probing at target settings. Probe success still does not guarantee every media file or long export succeeds.
- EncoderMuxerAdapter and VideoMuxerAdapter are extension seams, not bundled FFmpeg/audio support. See MEDIA.md for limits and muxer caveats.

## Integration, persistence and sharing

exportSceneJSON(scene) requires embedded image/video data URLs by default. With portable:false it serializes references without fetching them. blobToDataURL has a small complete-URL size guard; it does not create hosted share links. shareScene(scene,provider,signal) invokes only your explicit ShareProvider. The SDK itself contains no storage service or credentials. downloadBlob must be used from a browser gesture.

For a tiny self-contained scene fragment link, encode your validated JSON and impose your own small URL limit; the SDK does not manage routers or promise large-link support. Larger projects should use a download or explicit hosting provider.

EditorHandle exposes store, renderer, getScene, setScene, destroy. EditorOptions.rendererFactory lets the optional SpatialRenderer supply both preview and export; the default CanvasRenderer remains 2D. Controlled-state integration can subscribe through onChange and feed setScene, but consumers must prevent their own update loops. The UI currently exposes PNG/WebM/GIF; other supported export formats are programmatic. There is no auto-save, stock-image provider, segmentation, audio, or SaaS backend. The optional spatial package now provides a real volumetric/PBR scene engine; it is not a path tracer.

Optional headless example: after pnpm build, run node examples/headless.mjs scene.json output.png. Requires the workspace Chromium/Playwright dev dependencies. CHROMIUM_PATH can select your platform's executable. The example selects SpatialRenderer for spatial/mesh scenes; it still needs Chromium/WebGL2. This is an example, not an independently published headless package.
