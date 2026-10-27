# Getting started

Device Mockup Studio is a browser-based editor and framework-free TypeScript toolkit for turning images and videos into device presentations. You can use it three ways:

- **As an editor** — open the studio in your browser and compose scenes by hand.
- **As an embedded component** — mount the editor inside your own application with [`mountEditor`](#embed-the-editor).
- **As an SDK** — compose scenes programmatically, with or without a UI ([headless mode](/HEADLESS)).

**Open Device Mockup Studio** → <https://bookklik-technologies.github.io/device-mockup-studio/>

## Prerequisites

- Node.js **22+** and pnpm **10** (the exact pnpm version is pinned in `package.json`).
- No framework is required to consume the package — it is plain ESM with TypeScript declarations.

::: tip Using the npm package instead
The published package is `@bookklik/device-mockup-studio`, including the `/headless`, `/core`, `/presets`, `/render`, `/media`, `/editor`, and `/spatial` subpath entries. Install it with `npm install @bookklik/device-mockup-studio` once published, or build the tarball from source (see [Publishing & versioning](/PUBLISHING)).
:::

## Running from source

```bash
pnpm install --frozen-lockfile

pnpm dev          # build and start the editor at http://127.0.0.1:4173
pnpm typecheck    # TypeScript validation
pnpm build        # build all packages, the SDK bundle, and the demo
```

Build outputs:

| Output | Path |
|---|---|
| Demo application | `apps/demo/dist` |
| Standalone browser ESM bundle | `artifacts/mockup-studio.js` |
| Standalone headless bundle | `artifacts/mockup-studio-headless.js` |
| Release tarball (after `pnpm release:prepare`) | `artifacts/packages/bookklik-device-mockup-studio-<version>.tgz` |

The demo switches between a **2D** and a **3D workspace**, and persists drafts locally per workspace.

## Quickstart with the SDK

This browser example creates a scene from an image data URL and exports a PNG:

```typescript
import { createScene, createMockup, CanvasRenderer, exportImage } from '@bookklik/device-mockup-studio';

async function renderMockup(imageDataURL: string): Promise<Blob> {
  const scene = createScene({
    width: 1600,
    height: 1200,
    assets: [{
      id: 'design', kind: 'image', src: imageDataURL,
      width: 1440, height: 960,
    }],
    nodes: [createMockup({
      assetId: 'design', deviceId: 'browser',
      x: 800, y: 600, width: 1200, height: 800, tiltY: -12,
    })],
  });

  const renderer = new CanvasRenderer(document.createElement('canvas'));
  try {
    return await exportImage(renderer, scene, { format: 'png', scale: 2 });
  } finally {
    renderer.dispose();
  }
}
```

Make sure asset dimensions match your input. Scene positions use **node centers**, dimensions use output pixels, rotations use degrees, and animation time uses seconds. Remote HTTP(S) assets require anonymous CORS permission from their server.

## Headless embedding (bring your own UI)

`@bookklik/device-mockup-studio/headless` gives you state, undo/redo, rendering, and export without the editor UI and without Three.js:

```typescript
import { createHeadlessStudio, createScene } from '@bookklik/device-mockup-studio/headless';

const studio = createHeadlessStudio({
  canvas: document.querySelector<HTMLCanvasElement>('#preview')!,
  scene: createScene({ width: 1200, height: 900 }),
  onChange: scene => console.log(scene.name),
});

studio.store.update(scene => { scene.name = 'My embedded project'; });
await studio.render();
const png = await studio.exportImage({ format: 'png', scale: 2 });
const json = studio.serialize();
studio.destroy();
```

Importing the headless entry is SSR-safe; creating a studio in Node requires a canvas adapter. See the [Headless embedding guide](/HEADLESS) for Node rendering, assets, framework cleanup, and optional 3D.

## Embed the editor

```typescript
import { createScene } from '@bookklik/device-mockup-studio/core';
import { mountEditor } from '@bookklik/device-mockup-studio/editor';

const container = document.getElementById('editor')!;
container.style.height = '800px';

const editor = mountEditor(container, {
  scene: createScene(),
  theme: 'dark',
  onChange: scene => console.log(scene.id),
  onError: error => console.error(error.message),
});

// Call editor.destroy() when unmounting the editor.
```

The editor scopes its own CSS and uses no React. For 3D, supply `rendererFactory: canvas => new SpatialRenderer(canvas)` from `@bookklik/device-mockup-studio/spatial`; see the [Spatial guide](/SPATIAL).

## Where to go next

- [Features & limitations](/FEATURES) — the full capability list, including what the editor exposes versus the SDK.
- [Media formats & export limits](/MEDIA) — PNG/JPEG/WebP/GIF/frame/video exports, canvas caps, and codec probes.
- [Device artwork & catalog](/DEVICE-ARTWORK) — available frames, views, and artwork requirements.
- [Spatial guide](/SPATIAL) — 3D geometry, lighting, and glass.
- Programmatic samples live in [`examples/`](https://github.com/bookklik-technologies/device-mockup-studio/tree/main/examples).
