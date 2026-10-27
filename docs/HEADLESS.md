# Headless embedding

Headless means a UI-free SDK, not an iframe or a hidden instance of the editor. You own the canvas, controls, persistence, loading indicators, and scheduling. The same scene format works with the full editor.

## Entry points

- `@bookklik/device-mockup-studio`: complete SDK including editor and optional spatial exports.
- `@bookklik/device-mockup-studio/headless`: core, presets, Canvas2D rendering, media and `createHeadlessStudio`; no editor or Three.js imports.
- `@bookklik/device-mockup-studio/core`: DOM-free state/validation/serialization only, no canvas required.
- `@bookklik/device-mockup-studio/render` and `/media`: lower-level APIs from the same installed package. These subpath imports avoid loading unrelated module graphs; all external dependencies are still installed with the single package.

The build also writes standalone browser ESM bundles to `artifacts/mockup-studio.js` and `artifacts/mockup-studio-headless.js`. They are build artifacts, not npm export paths. Host them yourself and preserve dependency license notices.

## Browser or framework component

```ts
import { createHeadlessStudio, createScene, createMockup } from '@bookklik/device-mockup-studio/headless';

const studio = createHeadlessStudio({
  canvas: document.querySelector<HTMLCanvasElement>('#preview')!,
  scene: createScene({
    width: 1200, height: 900,
    nodes: [createMockup({ deviceId: 'browser', x: 600, y: 450, width: 900, height: 600 })],
  }),
  onChange: scene => console.log('Scene changed:', scene.name),
});

await studio.render();
studio.store.update(scene => { scene.name = 'Launch campaign'; });
studio.store.undo();
studio.store.redo();
await studio.render();
const png = await studio.exportImage({ format: 'png', scale: 2 });
const saved = studio.serialize();
studio.load(saved);
studio.destroy();
```

Create the studio after your framework mounts the canvas and call `destroy()` in its cleanup/unmount hook. No React/Vue/Svelte dependency is required. `render()` and `exportImage()` return promises: show errors/loading states in the host and catch rejected operations. Calls through the studio are serialized so image encoding cannot race a later preview draw; each captures the scene at call time. Prefer these methods over direct renderer calls when sharing a canvas. Destruction rejects queued work and disposes active renderer jobs; await exports before destroying if you need their output.

The studio does not append a canvas, inject CSS, start an animation loop, automatically render on change, load fonts, or save projects. With no canvas supplied, it allocates an OffscreenCanvas where supported, otherwise a detached HTML canvas. Use an attached HTML canvas for a visible preview. Rendering changes its backing dimensions; CSS display sizing is up to you. Browser rendering waits for used font faces, but hosts must install/load the desired fonts first.

`onChange` is a SceneStore subscription, not an initial-ready callback. Observer exceptions do not roll back edits. Use `store.subscribe()` for an unsubscribe handle. Scene getters return copies. Call `store.setScene(scene, false)` outside a transaction to replace a project and clear history; `load(json)` retains undo history. Do not dispose the exposed store or renderer independently; use `studio.destroy()`.

## Images and assets

Define image/video entries in `scene.assets` and reference their IDs from nodes. Browser remote URLs need CORS permission. For decoded media, pass an `AssetManager` through `assets` and register sources under the scene asset IDs. Supplied `assets` and `deviceAssets` managers are borrowed: dispose them separately after all users finish. A renderer created by `rendererFactory` is owned and disposed by the studio.

## Node without Chromium

The import itself does not read `window` or `document`. Node must provide a compatible Canvas2D implementation and encoder, for example optional host dependency `@napi-rs/canvas`:

```sh
npm install @bookklik/device-mockup-studio @napi-rs/canvas
```

See [`examples/headless-node.mjs`](../examples/headless-node.mjs) for a complete scene-to-PNG example. After a workspace build, run:

```sh
node examples/headless-node.mjs artifacts/headless.png
```

In a consuming project replace its relative SDK import with `@bookklik/device-mockup-studio/headless`. This is a subpath of the one published package, not a separate install. The example's `canvasFactory` creates both output and intermediate canvases, and `encodeCanvas` returns correctly typed PNG/JPEG/WebP Blobs. In TypeScript, native canvas interfaces may require explicit `unknown` casts to the SDK's DOM-shaped canvas types; the runtime does not require a DOM.

Node does not automatically decode scene assets or device-frame data URLs. Decode images yourself (for example with `loadImage`) and register them in an injected AssetManager. For photographic frames, register decoded frame images by device ID in `deviceAssets`. Register fonts using your canvas implementation. Video decoding, browser fonts, WebCodecs and WebGL2 are not supplied by this adapter.

For browser-identical rendering, [`examples/headless.mjs`](../examples/headless.mjs) remains the optional Playwright/Chromium adapter. It needs the workspace build and development dependencies. On Windows/macOS install Playwright Chromium (`pnpm exec playwright install chromium`) or set `CHROMIUM_PATH`; Linux defaults to the server Chromium dependency. Treat untrusted asset URLs according to your server's network/SSRF policy; neither adapter is an untrusted-content sandbox.

## Optional 3D

```ts
import { createHeadlessStudio } from '@bookklik/device-mockup-studio/headless';
import { SpatialRenderer } from '@bookklik/device-mockup-studio/spatial';

const studio = createHeadlessStudio({
  canvas: document.querySelector<HTMLCanvasElement>('#preview')!,
  rendererFactory: (canvas, options) => new SpatialRenderer(canvas, options),
});
```

This requires a WebGL2 browser context (or a suitably configured headless browser). Native Canvas2D does not provide 3D. The default renderer intentionally rejects spatial scenes. For GIF/video/frame export, use the headless entry's media functions with `studio.renderer` and a scene snapshot, without concurrent direct rendering. See [media](MEDIA.md) and [spatial](SPATIAL.md) limits.
