# Device Mockup Studio

**device-mockup-studio** · TypeScript · [MIT license](LICENSE)

[GitHub repository](https://github.com/bookklik-technologies/device-mockup-studio) · [Open Device Mockup Studio](https://bookklik-technologies.github.io/device-mockup-studio/)

A library-first mockup composition toolkit. Framework-independent SDK, optional embeddable editor, working demo, strict TypeScript and ESM builds.

**v0.2 adds real volumetric 3D and raster physical glass.** See [features and limitations](docs/FEATURES.md) for supported functionality, including silent-video exports, screen-buffer refraction and unavailable audio/portrait effects.

## Included

- Versioned serializable scenes, strict validation, metadata-efficient undo/redo and atomic transactions.
- Canvas composition with crop/focal fit, shadows, lighting, perspective, text/shapes/watermarks, backgrounds and effects.
- Optional WebGL2 spatial package: seven volumetric geometries, PBR materials, directional/point studio lights, PMREM reflections, shadows and transmissive glass mockup rims.
- Glass controls for IOR, roughness, thickness, absorption, clearcoat and dispersion; actual artwork refraction, not just translucent edges.
- Eleven photorealistic device models in 19 views, plus 17 compatible procedural definitions; 16 composition recipes and nine social canvas frames. See [device artwork](docs/DEVICE-ARTWORK.md).
- Media-derived local palettes, animated gradients, five deterministic motion presets and keyframe APIs.
- PNG/JPEG/WebP, looping animated GIF, frame sequences, offline silent WebM and MP4 (runtime codec support required for video).
- Framework-free editor with scoped styling, import, layers, inspector, drag, history, preview, portable JSON and downloads.
- Optional Node/headless example; actual browser tests, rendered fixtures and release validation notes.

## Run the workspace

Requires Node.js 22+ and pnpm 10. Packages have already been built in this delivery; a clean development install uses:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

Open the local URL printed by the dev server (normally http://127.0.0.1:4173). Run `pnpm test:browser` for the legacy real-Chromium suite and `pnpm test:spatial` for the WebGL/refraction suite after building. The bundled Linux Chromium test binary is a dev-only convenience; set CHROMIUM_PATH to a compatible local executable on other platforms. Nothing is published or deployed by these commands.

## GitHub Pages

The demo's deployment URL is [bookklik-technologies.github.io/device-mockup-studio](https://bookklik-technologies.github.io/device-mockup-studio/). In the repository's **Settings → Pages**, select **GitHub Actions** as the publishing source. The [deployment workflow](.github/workflows/deploy-pages.yml) builds the workspace and publishes `apps/demo/dist` on pushes to `main` or a manual run. It does not run unit tests.

The demo uses relative script, font and icon paths so the same build works under `/device-mockup-studio/` and on the local development server.

## Use as a library

Package names are provisional and **not published to npm**. Install all seven local tarballs from artifacts/packages together, or consume the workspace packages. Do not run a registry install for these names expecting an official publication.

The workspace and product are named Device Mockup Studio (`device-mockup-studio`). Library packages retain the `@mockup-studio/*` namespace for import compatibility. Existing browser draft and theme storage keys are retained so saved work and preferences carry over.

```sh
npm install ./artifacts/packages/*.tgz
```

```ts
import {
  createScene, createMockup, CanvasRenderer, exportImage,
  createAnimationTracks, exportVideo,
} from '@mockup-studio/sdk';

const node = createMockup({
  assetId: 'design', deviceId: 'browser',
  x: 800, y: 600, width: 1200, height: 800, tiltY: -12,
});
const scene = createScene({
  width: 1600, height: 1200,
  assets: [{ id: 'design', kind: 'image', src: imageDataURL,
             width: 1440, height: 960 }],
  nodes: [node],
});
const renderer = new CanvasRenderer(document.createElement('canvas'));
try {
  const png = await exportImage(renderer, scene, { format: 'png', scale: 2 });
  scene.tracks = createAnimationTracks(node, 'parallax', scene.duration);
  const webm = await exportVideo(renderer, scene, { format: 'webm', fps: 30 });
  // png and webm are Blobs. Download/upload only where your app intends.
} finally {
  renderer.dispose();
}
```

`imageDataURL` above is your input. Remote HTTP(S) assets also work when their server allows anonymous CORS. A scene's x/y positions are **node centers**, distances are output pixels, rotations are degrees, and time is seconds.

### Embed the editor

```ts
import { mountEditor } from '@mockup-studio/editor';
const editor = mountEditor(container, {
  scene,
  theme: 'dark',
  onChange: updated => console.log(updated.id),
  onError: error => console.error(error.message),
});
// Later: editor.getScene(), editor.setScene(nextScene), editor.destroy().
```

For 3D, pass `rendererFactory: canvas => new SpatialRenderer(canvas)` and import SpatialRenderer from `@mockup-studio/spatial`. The demo offers **2D mockups** and **3D materials** workspaces. See [the spatial guide](docs/SPATIAL.md) for scene/material APIs and fidelity limits. Pass `editor.setScene(nextScene, false)` when switching independent workspaces to reset undo history.

Give the container a height (e.g. 800px). The editor uses no React and scopes its own CSS. Destroy it on unmount. The UI uses Lucide icons and the Outfit font family; embedders should provide Outfit through their own font stylesheet. The demo bundles a local Outfit font file.

The demo automatically saves separate 2D and 3D drafts in this browser's IndexedDB and restores them on reload. Storage failures are shown beside the workspace switcher; **Save project** downloads a portable `.json` copy with the original media embedded. Browser drafts belong to this device and origin and can be removed by clearing site data. The embeddable editor itself leaves persistence to the host through `onChange`.

The demo uses one compact header for branding, the editable project name, undo/redo, workspace switching, local save status, and Actions. Desktop uses one row; smaller screens use two. Phone workspace buttons display **2D / 3D** while retaining their full accessible names. The save indicator shows a short status, with its full message available on hover and to screen readers.

The left sidebar is one panel with four tabs: **Layers** (selected on startup), **Presets**, **Devices**, and **Media**. Each tab uses the full content area. Use Left/Right arrows to switch tabs, Home/End to jump to the first/last tab, and Tab to enter the content. On smaller screens, open the same panel with **Library**.

**Presets** offers 16 complete device templates in the 2D workspace and six material studies in 3D. Search by name or description, or filter by collection. The existing flat preset grid shows rendered compositions made with original sample artwork. Search and collection filters use the same underlined input and dropdown controls as the rest of the editor. Applying a template replaces the entire composition, including locked layers and animation, while keeping the project name, canvas size, timeline settings, and original media. It prefers the selected screen's media, then other screen media, then remaining assets. Empty projects receive embedded sample artwork. Every template layer is editable, and one Undo restores the previous composition. The SDK's legacy `getPresets()` / `applyPreset()` APIs retain their original behavior; use `getTemplates()` / `applyTemplate()` for complete compositions.

Each preset has its own art direction: asymmetric product layouts, editorial covers, cut-paper collage, Swiss grids, brutalist and kinetic posters, Bauhaus geometry, technical drawings, and minimal exhibitions. The six 3D studies use separate sculpture arrangements and lighting. Display type ranges from quiet editorial sizes to oversized poster lettering. Artwork remains editable, and each composition has landscape, square, and portrait arrangements. Some designs deliberately crop devices or decorative artwork at the canvas edge; primary copy stays within the canvas.

Text layers offer 12 locally bundled families: Outfit, Inter, DM Sans, Manrope, Space Grotesk, Plus Jakarta Sans, Sora, Lora, Playfair Display, Fraunces, Bricolage Grotesque, and JetBrains Mono, plus generic fallbacks and any custom family already in the project. The picker groups families by style and shows a live sample. The demo serves normal variable fonts from `fonts/fonts.css`; there are no runtime CDN requests. Embedders should serve that stylesheet and its WOFF2 files (or equivalent `@font-face` rules using these exact family names). Browser renderers await the scene's font faces before preview and export. Headless users must register their own fonts; `renderSync()` requires fonts to be loaded beforehand. Projects retain font names, not embedded font binaries.

The selected layer's **Properties** panel keeps its name, type, visibility, and lock state at the top. Content, Size & position, Appearance, Motion, and Layer actions follow in that order. Selects and toggles apply immediately; typed values commit on Enter or blur (multiline text commits on blur). Escape cancels an unfinished edit. Invalid numbers and colors restore the previous value with an inline explanation. Opacity is shown as a percentage. Space and Enter expand inspector sections without starting animation playback.

**Motion** offers 16 presets: Float, Orbit, Reveal, Zoom, Parallax, Fade in/out, four directional slide-ins, Pulse, Bounce, Sway, Spin, and Flip reveal. Apply or replace motion for the selected layer, then preview it in Animation. Replacing or clearing motion is undoable. **Image fit → Stretch** fills the device screen with the complete image or video, changing proportions if needed; crop controls return when switching back to Fill screen or Show whole image. Image backgrounds also support Stretch.

Locking a layer protects its properties, visibility, media, duplication, removal, and reordering through the editor UI. Select it in Layers to inspect or unlock it. Programmatic scene/store APIs and canvas-wide changes retain their existing behavior. On phones (560px wide or less), use **Properties** to open a modal bottom sheet; Close or Escape dismisses it and returns keyboard focus to the opener. Motion identifies None, a recognized preset, or Custom tracks; replacing motion replaces that layer's existing tracks.

**Snap** is enabled by default: dragging aligns a layer's projected edges and centers with the canvas or other visible layers, including locked references. Temporary dashed guides show each active alignment. Hold Alt/Option to bypass snapping or Shift to constrain movement to one axis. Under **Size & position**, **Align to canvas** places the selected layer at any canvas edge or center. With the canvas focused, arrow keys move the selection by 1 canvas pixel; Shift moves 10. Each drag, alignment command, or held arrow-key gesture creates one Undo step. Snapping preferences and guides stay in the editor and are excluded from project files and exports. Spatial alignment moves X/Y and preserves depth.

Click a color swatch in Properties or Canvas settings to open the visual picker. It includes saturation/brightness, hue, opacity, hex/hex-alpha entry, and preset swatches. Apply commits one undoable change; Cancel or Escape leaves the scene unchanged. Arrow keys adjust the color area and sliders. Existing color text fields still accept exact CSS values.

Use **Manage** in the header to open the project menu, which groups Upload media, Save project, Open project, Export PNG, Export video, Export GIF, and Light mode / Dark mode. GIF exports loop through the scene timeline at up to 30 fps, with 256 colors and one-bit transparency per frame; they do not require WebCodecs. File and export actions close the modal before continuing; theme changes keep it open. Close it with the close button, Escape, or the backdrop. Keyboard focus stays in the modal and returns to Manage when it closes. Export cancellation remains available in the header while an export runs.

The demo initially follows the system color preference, then remembers your choice on this browser. Themes apply to the editor and workspace bar. Embedders can pass `theme: 'light'`, call `editor.setTheme('light')` / `editor.getTheme()`, and handle `onThemeChange` to persist their own preference.

The header uses the vector mark from `logo.svg`, embedded in the editor so it needs no asset URL. It is cyan in dark mode and charcoal in light mode. Interface selections and focus use cyan/dark teal for contrast, and primary actions use cyan with charcoal text. The demo favicon is copied unchanged from `icon.svg` during the build. These interface colors do not change scene artwork or saved projects.

## Package boundaries

| Package | Purpose |
|---|---|
| @mockup-studio/core | DOM-free model, state/history, validation, math, animation |
| @mockup-studio/presets | Original devices, layouts and social frame definitions |
| @mockup-studio/render | Canvas renderer, assets and local palette extraction |
| @mockup-studio/spatial | Optional Three.js/WebGL2 volumes, PBR lighting and physical glass |
| @mockup-studio/media | Image/frame/video export, capability probes and provider seams |
| @mockup-studio/editor | Optional embeddable framework-free editor |
| @mockup-studio/sdk | Convenience facade over all six feature packages |

Use core alone in Node/SSR. Renderer/media/editor are safe to import without a DOM, but executing browser-only APIs requires a supported browser or explicit adapter. Separate packages keep codec/editor code out of lightweight core consumers. A browser ESM bundle is also in artifacts/mockup-studio.js.

## Safety and compatibility

- Chromium 141/Linux x64 is the validated browser. Firefox/Safari are not yet verified.
- WebCodecs requires a supported secure context; use capability probes. Presence alone is not format support.
- Video is silent, even-sized, up to 4096px/side and 10,000 frames, with output memory limits. See docs/MEDIA.md.
- Canvas2D output is bounded to 8192px/side and 32MP. Spatial output is WebGL2-dependent, at most 4096px/side and 16MP, with adaptive per-node texture limits. Input import is 32MiB/file. Projects and traversal also have aggregate caps.
- A shared video asset supports identical timing only. Use independently loaded asset IDs for different starts/rates; conflicting timing fails explicitly.
- Images/fonts/codecs can differ by runtime; no cross-browser bit-identical or universal performance claim.
- No automatic hosting, uploads, user tracking, stock-media calls, or credentials. Custom share providers are explicitly invoked by the caller.
- Raster glass refracts opaque scene-buffer content, not other transmissive objects or off-screen geometry. No path-traced caustics or recursive glass.
- This is an initial release, not a legal/security/compliance guarantee or a claim of production readiness.

## Documentation

- [Spatial geometry, lighting and glass](docs/SPATIAL.md)
- [API and integration](docs/API.md)
- [Features, limitations and remaining work](docs/FEATURES.md)
- [Rendering/export limitations](docs/MEDIA.md)
- [Third-party notices](docs/THIRD-PARTY.md)

`pnpm pack:all` creates the seven package tarballs. See LICENSE for source terms and third-party notices for dependency terms.
