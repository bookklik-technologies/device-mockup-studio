# @mockup-studio/sdk

Device Mockup Studio: framework-independent scene composition, rendering, media export, and an optional embeddable editor. ESM only, TypeScript declarations and source maps included. Node.js 22+ for server-side integrations.

## Install

```sh
npm install @mockup-studio/sdk
```

This command requires the packages to have been published. Before publication, install all seven workspace tarballs together; see the [publishing guide](https://github.com/bookklik-technologies/device-mockup-studio/blob/main/docs/PUBLISHING.md).

## Headless embed: your canvas and UI

```ts
import { createHeadlessStudio, createScene } from '@mockup-studio/sdk/headless';

const studio = createHeadlessStudio({
  canvas: document.querySelector<HTMLCanvasElement>('#preview')!,
  scene: createScene({ width: 1200, height: 900 }),
});

studio.store.update(scene => { scene.name = 'My project'; });
await studio.render();
const png = await studio.exportImage({ format: 'png' });
studio.destroy();
```

The headless entry does not import the editor or Three.js. It exports core, presets, Canvas2D rendering, media utilities, and `createHeadlessStudio`. The umbrella package still installs its declared dependencies; use the individual core/render/media packages when minimal installed dependencies matter.

Scene mutations do not auto-render or persist. Call `render()` explicitly; manage your own loading/error UI. `store` provides subscriptions, transactions, undo/redo, and validated edits. `load(json)` replaces the scene with history; `serialize()` returns portable project JSON. `destroy()` releases the store and renderer; injected asset managers remain caller-owned.

In SSR/Node, importing is safe without a DOM. Creating a studio requires a canvas/canvasFactory; image export also needs an encodeCanvas adapter if the canvas has no browser Blob encoder. See the [headless guide](https://github.com/bookklik-technologies/device-mockup-studio/blob/main/docs/HEADLESS.md).

## Full editor

```ts
import { createScene, mountEditor } from '@mockup-studio/sdk';

const editor = mountEditor(document.querySelector<HTMLElement>('#editor')!, {
  scene: createScene(),
  theme: 'dark',
  onError: error => console.error(error.message),
});
// Host container needs a nonzero height. Call editor.destroy() on unmount.
```

For optional WebGL2 rendering import `SpatialRenderer` from `@mockup-studio/spatial` and supply it through `rendererFactory`. The default headless renderer is Canvas2D and rejects 3D scenes rather than silently flattening them.

[Demo](https://bookklik-technologies.github.io/device-mockup-studio/) · [API guide](https://github.com/bookklik-technologies/device-mockup-studio/blob/main/docs/API.md)

License: MIT. See LICENSE and dist/THIRD-PARTY.md for dependency and device-artwork notices.
