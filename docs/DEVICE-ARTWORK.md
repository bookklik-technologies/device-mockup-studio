# Photographic device frames

The editor offers original generated front-view artwork for these devices. These are recognizable illustrations, not manufacturer-provided renders or exact engineering models.

| Device ID | Model / finish | Views |
| --- | --- | --- |
| `iphone-17` | iPhone 17 / lavender | Portrait, landscape |
| `iphone-17-pro` | iPhone 17 Pro / silver | Portrait, landscape |
| `galaxy-s26` | Samsung Galaxy S26 / cobalt violet | Portrait, landscape |
| `galaxy-s26-ultra` | Samsung Galaxy S26 Ultra / black | Portrait, landscape |
| `pixel-10-pro` | Google Pixel 10 Pro / porcelain | Portrait, landscape |
| `ipad-air-11-m4` | iPad Air 11-inch M4 / blue | Portrait, landscape |
| `ipad-pro-11-m5` | iPad Pro 11-inch M5 / silver | Portrait, landscape |
| `galaxy-tab-s11` | Samsung Galaxy Tab S11 / gray | Portrait, landscape |
| `macbook-air-13-m5` | MacBook Air 13-inch M5 / sky blue | Landscape |
| `macbook-pro-14-m5` | MacBook Pro 14-inch M5 / silver | Landscape |
| `imac-24-m4` | iMac 24-inch M4 / silver | Landscape |

The collection contains 11 models in 19 views. Phone and tablet landscape IDs append `-landscape`. Tablets rotate counterclockwise to keep their cameras on the top bezel. Screen media stays upright in every view. Canvas and Browser remain available. Existing generic IDs and all their orientation variants remain registered; saved scenes are not migrated.

## Assets and packaging

The eleven original PNGs and the complete prompts (`prompts.json` and `prompts-expanded.json`) are in `packages/presets/artwork/`. They were generated with the built-in image-generation tool on 2026-10-23 and inspected on a contrasting background. No downloaded mockup packs are included. Device names identify the depicted hardware; there is no manufacturer endorsement.

`scripts/embed-device-artwork.mjs` discovers the PNGs in the artwork directory and embeds them into `packages/presets/src/artwork-data.ts`. The generated module is checked in for direct source imports, and the build refreshes it only when its contents change. All eleven images total about 7.8 MB, or 10.4 MB as base64 before transport compression. They are included in the SDK/demo and require no external host. Artwork is decoded on demand and cached separately from user media.

The original images have longest sides of approximately 1500–1800 pixels. Larger exports retain screenshot resolution but can magnify the raster frame. Transparent padding is part of each artwork's intrinsic bounds. Screen geometry is measured in those coordinates; model aspects normalize the display to its published aspect ratio.

Display proportions for the expansion follow the manufacturers' specifications: [iPhone 17](https://www.apple.com/iphone-17/specs/), [Galaxy S26](https://www.samsungmobilepress.com/articles/samsung-unveils-galaxy-s26-series-intuitive-galaxy-ai), [Pixel 10 Pro](https://store.google.com/product/pixel_10_pro_specs?hl=en-US), [iPad Air](https://www.apple.com/ipad-air/specs/), [Galaxy Tab S11](https://news.samsung.com/ph/meet-samsung-galaxy-tab-s11-series-packing-everything-you-expect-from-a-premium-tablet), and [MacBook Air](https://www.apple.com/macbook-air/specs/).

## Public interfaces

`DeviceDefinition.artwork` is optional:

```ts
interface DeviceArtwork {
  src: string;
  width: number;
  height: number;
  screen: { x: number; y: number; width: number; height: number; radius: number };
  orientation: 0 | 90 | 270; // clockwise degrees, frame only
}
```

`registerDevice()` validates plain data, source URLs, dimensions, orientation and screen bounds, and defensively clones the definition. Definitions without artwork retain the procedural renderer. `listDevices()` preserves the full registry; `listDevices({ includeLegacy: false })` hides the built-in generic alternatives while including custom registrations.

`CanvasRenderer` accepts `deviceAssets?: AssetManager` and exposes `renderer.deviceAssets`. This cache is isolated from screenshot/video asset IDs. For Node rendering, decode each frame with your canvas implementation and register it by **device ID** in this cache, including each orientation used. Inject `canvasFactory` as usual. Externally supplied caches remain caller-owned.

`await renderer.render()` prepares artwork before replacing the output. `renderSync()` requires previously loaded or registered frames. Failures use `DEVICE_ARTWORK_LOAD`, `DEVICE_ARTWORK_NOT_READY` or `DEVICE_ARTWORK_SIZE`; a failed preflight preserves the last successful output.

## Rendering and editor behavior

Screen media is clipped to the declared opening and drawn beneath the alpha frame. Camera cutouts belong to the artwork. Crop/focal fit, screen lighting, silhouette shadows, transforms, animation, image and video exports remain available. Width and height animation still follow the existing scene semantics.

Photographic frames ignore procedural style, frame color, radius, border and glass-material properties; the inspector hides those controls. Style and color values are retained when switching back to a procedural frame; changing devices resets the radius to the selected definition. Spatial rendering uses a textured plane and does not generate a glass rim for photographic devices. Tilt does not reveal hardware sides or backs.

Projects continue to store `deviceId` in the existing version-1 scene format. Built-in artwork resolves from the installed catalog; custom artwork definitions must be registered by the host before loading custom scenes, as with existing custom procedural devices.

## Validation

Type checking: `node node_modules/typescript/bin/tsc --noEmit`.
Build: `node scripts/build.mjs`.
Browser integration and visual checks: `node scripts/device-artwork-browser-check.mjs` (set `CHROMIUM_PATH` outside the default Windows Chrome installation).

The browser check produces contact sheets (including `artifacts/device-additions.png` for the six new models), editor and spatial screenshots, and `artifacts/device-browser-results.json`. It covers all 19 views, image exports, video seeking, history, JSON reload, legacy rendering, spatial glass bypass and offline loading. Focused unit regression cases live in `tests/device-artwork.test.ts`; request permission before running unit tests.
