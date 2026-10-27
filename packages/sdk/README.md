# @bookklik/device-mockup-studio

Framework-independent device mockup composition, rendering, media export and an optional embeddable editor. One npm package, ESM only, TypeScript declarations and source maps included. Node.js 22+ for server-side integrations.

## Install

```sh
npm install @bookklik/device-mockup-studio
```

Before publication install the single `bookklik-device-mockup-studio-0.3.2.tgz` archive instead. No other `@bookklik` package is required. See the [publishing guide](https://github.com/bookklik-technologies/device-mockup-studio/blob/main/docs/PUBLISHING.md).

## Headless embed: your canvas and UI

```ts
import { createHeadlessStudio, createScene } from '@bookklik/device-mockup-studio/headless';

const studio = createHeadlessStudio({
  canvas: document.querySelector<HTMLCanvasElement>('#preview')!,
  scene: createScene({ width: 1200, height: 900 }),
});

studio.store.update(scene => { scene.name = 'My project'; });
await studio.render();
const png = await studio.exportImage({ format: 'png' });
studio.destroy();
```

`/headless` re-exports core, presets, Canvas2D rendering and media utilities without importing the editor or Three.js. Its import graph is UI-free, but all declared external dependencies are installed with the one package. Scene edits do not auto-render or persist. Manage loading/error UI yourself. `store` provides subscriptions, transactions and undo/redo. `load(json)` replaces the scene with history; `serialize()` returns portable project JSON; `destroy()` releases resources but not borrowed asset managers.

SSR imports are safe without a DOM. Creating a studio in Node needs a canvas/canvasFactory; image export needs an encodeCanvas adapter when the canvas has no browser Blob encoder. See the [headless guide](https://github.com/bookklik-technologies/device-mockup-studio/blob/main/docs/HEADLESS.md).

## Full editor

```ts
import { createScene, mountEditor } from '@bookklik/device-mockup-studio';

const editor = mountEditor(document.querySelector<HTMLElement>('#editor')!, {
  scene: createScene(),
  theme: 'dark',
  onError: error => console.error(error.message),
});
```

Give the host container a nonzero height and call `editor.destroy()` on unmount.

## Subpath imports

All of these belong to this single installed package:

- `/core`: DOM-free scenes, validation, state and serialization.
- `/presets`: devices, templates and compositions.
- `/render`: Canvas2D rendering and asset management.
- `/media`: image, frame, GIF and video export.
- `/editor`: the framework-independent editor.
- `/spatial`: optional WebGL2/Three.js rendering.
- `/headless`: UI-free SDK and studio controller.

For example, import `SpatialRenderer` from `@bookklik/device-mockup-studio/spatial` and supply it through `rendererFactory`. The default headless renderer is Canvas2D and intentionally rejects 3D scenes.

[Demo](https://bookklik-technologies.github.io/device-mockup-studio/) · [API guide](https://github.com/bookklik-technologies/device-mockup-studio/blob/main/docs/API.md)

License: MIT. See LICENSE and dist/THIRD-PARTY.md for dependency and device-artwork notices.
