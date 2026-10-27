# Device Mockup Studio

**Compose device mockups, animate your designs, and export them in your browser.**

Device Mockup Studio is a browser-based editor and TypeScript toolkit for turning images and videos into device presentations. Build layered compositions with photographic device frames, backgrounds, text, and motion, or explore 3D geometry and physical materials. Use the editor on its own, embed it in your application, or compose scenes through the framework-independent SDK.

[Open Device Mockup Studio](https://bookklik-technologies.github.io/device-mockup-studio/)

Distributed under the [MIT License](./LICENSE).

## Features

- **Device frames** — 11 photographic device models in 19 views, plus 17 procedural definitions, with image/video fit, crop, perspective, shadows, and lighting
- **Compositions** — 16 editable 2D templates, six 3D material studies, nine social canvas sizes, and custom dimensions; transparent, solid, gradient, and image backgrounds with local palette extraction
- **Canvas editing** — layers, visibility and locking, snapping guides, alignment, keyboard nudging, undo/redo, text, shapes, watermarks, and a visual color picker
- **3D materials** — optional WebGL2 renderer with seven volumetric geometries, PBR materials, studio lights, reflections, shadows, and glass that refracts opaque scene content
- **Motion** — 16 animation presets, timeline preview, animated gradients, and programmatic keyframes and easing
- **Export** — PNG, JPEG, WebP, looping GIF, frame sequences, and silent WebM/MP4 video; video encoding depends on browser codec support
- **Projects** — portable JSON files with embedded media, separate local 2D/3D browser drafts, light/dark themes, and 12 locally bundled font families in the demo
- **Integration** — framework-free embeddable editor, versioned scene model, validation, transactional history, and separate ESM packages with TypeScript declarations

The editor exposes PNG, WebM, and GIF export; additional formats are available through the SDK. See [features and limitations](./docs/FEATURES.md) and the [device artwork guide](./docs/DEVICE-ARTWORK.md) for details.

## Packages

| Package | Purpose |
|---|---|
| [`packages/core`](./packages/core) | `@mockup-studio/core` — DOM-free scene model, validation, state/history, math, and animation |
| [`packages/presets`](./packages/presets) | `@mockup-studio/presets` — device catalog, composition templates, layouts, and social canvas sizes |
| [`packages/render`](./packages/render) | `@mockup-studio/render` — Canvas renderer, asset loading, and local palette extraction |
| [`packages/spatial`](./packages/spatial) | `@mockup-studio/spatial` — optional Three.js/WebGL2 renderer, geometry, lighting, and physical glass |
| [`packages/media`](./packages/media) | `@mockup-studio/media` — image, GIF, frame, and video exports, capability probes, and provider interfaces |
| [`packages/editor`](./packages/editor) | `@mockup-studio/editor` — optional embeddable editor with scoped styles |
| [`packages/sdk`](./packages/sdk) | `@mockup-studio/sdk` — convenience facade over the six feature packages |

The demo application lives in [`apps/demo`](./apps/demo). Use `core` alone for Node/SSR scene manipulation; rendering and media operations require a browser or an explicit adapter.

## Development

Requires Node.js 22+ and pnpm 10. The exact pnpm version is pinned in [`package.json`](./package.json).

```bash
pnpm install --frozen-lockfile
pnpm dev          # build and start the editor at http://127.0.0.1:4173
```

To check types or create a production build:

```bash
pnpm typecheck    # TypeScript validation
pnpm build        # build all packages, the SDK bundle, and the demo
```

The demo build is written to `apps/demo/dist`; the standalone browser ESM bundle is `artifacts/mockup-studio.js`.

## GitHub Pages

1. Push the project to [`bookklik-technologies/device-mockup-studio`](https://github.com/bookklik-technologies/device-mockup-studio) on the `main` branch.
2. In the repository's **Settings → Pages**, select **GitHub Actions** as the publishing source.
3. Run **Deploy demo to GitHub Pages** from the **Actions** tab, or push a commit to `main`.

The [deployment workflow](./.github/workflows/deploy-pages.yml) installs dependencies with the pinned pnpm version, builds the workspace, and publishes `apps/demo/dist` to [bookklik-technologies.github.io/device-mockup-studio](https://bookklik-technologies.github.io/device-mockup-studio/). It runs the production build without unit tests. The deployment URL also appears in the workflow's `github-pages` environment.

The demo uses relative asset URLs, so the same build works under the repository subpath and on the local development server.

## SDK usage

The workspace is prepared for manual npm publication under `@mockup-studio/*`; preparation does not publish anything. Until you publish, consume packages within the workspace or prepare all seven tarballs:

```bash
pnpm release:prepare
```

Install all seven `.tgz` files from `artifacts/packages` together so their internal dependencies resolve locally. The product and repository use the name Device Mockup Studio; library imports retain the `@mockup-studio/*` namespace.

See [manual publishing](./docs/PUBLISHING.md) for scope ownership, versioning, release validation, and dependency-ordered publish commands. Preparation runs typechecking, builds and archive validation, not unit tests.

This browser example creates a scene from your image data URL and exports a PNG:

```typescript
import { createScene, createMockup, CanvasRenderer, exportImage } from '@mockup-studio/sdk';

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

Set asset dimensions to match your input. Scene positions use node centers, dimensions use output pixels, rotations use degrees, and animation time uses seconds. Remote HTTP(S) assets require anonymous CORS permission from their server.

### Headless embedding (bring your own UI)

Use `@mockup-studio/sdk/headless` for state, undo/redo, rendering and export without mounting the editor or importing its UI or Three.js. It does not create controls, attach DOM elements, save drafts, or render automatically:

```typescript
import { createHeadlessStudio, createScene } from '@mockup-studio/sdk/headless';

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

Importing the headless entry is SSR-safe; creating a studio in Node requires a canvas adapter. See the [headless integration guide](./docs/HEADLESS.md) for Node, assets, framework cleanup and optional 3D. A standalone browser ESM build is also generated at `artifacts/mockup-studio-headless.js`.

### Embed the editor

```typescript
import { createScene } from '@mockup-studio/core';
import { mountEditor } from '@mockup-studio/editor';

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

The editor scopes its own CSS and uses no React. Hosts provide fonts and persistence through their own integration; the demo bundles fonts and saves drafts in IndexedDB. **Save project** downloads a portable JSON copy. For 3D, supply `rendererFactory: canvas => new SpatialRenderer(canvas)` from `@mockup-studio/spatial`; see the [spatial guide](./docs/SPATIAL.md).

## Compatibility and limitations

- Chromium 141 on Linux x64 is the validated browser baseline; Firefox and Safari remain unverified. 3D rendering requires WebGL2.
- Video exports are silent and require supported WebCodecs encoders in a secure context. Probe codec support before exporting; GIF and frame exports do not require WebCodecs.
- Canvas output is limited to 8192 pixels per side and 32 megapixels; spatial output to 4096 pixels per side and 16 megapixels. File imports are capped at 32 MiB each. Additional project and export limits are documented in the [media guide](./docs/MEDIA.md).
- Reuse a video asset only for identical playback timing. Different start times or playback rates require independently loaded asset IDs.
- Glass uses raster scene-buffer refraction; it does not provide recursive glass or path-traced caustics. Audio, portrait segmentation, and background removal are not included.
- Media processing is local. Hosting, accounts, cloud storage, and permanent share links require a host-provided integration.

## Documentation

- [API and integration](./docs/API.md)
- [Headless embedding and Node rendering](./docs/HEADLESS.md)
- [Manual npm publishing](./docs/PUBLISHING.md)
- [3D geometry, lighting, and glass](./docs/SPATIAL.md)
- [Device artwork and catalog](./docs/DEVICE-ARTWORK.md)
- [Features, limitations, and remaining work](./docs/FEATURES.md)
- [Media formats and export limits](./docs/MEDIA.md)
- [Programmatic and headless examples](./examples)
- [Changelog](./CHANGELOG.md)
- [Third-party notices](./docs/THIRD-PARTY.md)
