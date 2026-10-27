# Features and limitations — v0.3.2

Supported functionality and current limits of Device Mockup Studio. See [device artwork](DEVICE-ARTWORK.md) for the current device catalog.

| Area | Status | Details and limitations |
|---|---|---|
| Image/file import | Implemented | PNG/JPEG/WebP/GIF/AVIF/BMP accepted if the browser decodes them. GIF imports as a still image. |
| Video source import | Implemented | Browser-decodable MP4/WebM/Ogg/QuickTime; codec availability varies. Data URL file imports capped at 32 MiB. |
| Screenshot frame | Implemented | Procedural frame with configurable appearance. |
| Device frames | Implemented | Eleven photographic device models in 19 views, plus 17 procedural definitions across seven families/orientations. |
| Frame styles | Implemented | Eight Canvas styles; SpatialRenderer adds extruded glass rims and opaque-scene-buffer transmission with IOR/thickness/roughness. No recursive/path-traced optics. |
| Corner radius and borders | Implemented | Numeric controls and public scene settings. |
| Shadows and lighting | Implemented | Canvas blur/spread/offset/opacity plus optional spatial PBR studio lights, procedural environment and shadow maps. |
| Fit, crop, positioning, rotation, tilt, opacity | Implemented | Center coordinates; focal crop/contain and projective mesh. UI drag; size/rotation via fields. |
| Layer visibility and locking | Implemented | Per-node visible/locked state and layer controls. |
| Multi-item layouts | Implemented | Duo/fan/stack/gallery/wall arrangements. Add objects first; presets arrange existing nodes. |
| Templates/presets | Implemented | 16 composition recipes. |
| Social/custom canvas | Implemented | Nine social frames and custom dimensions, subject to safety limits. |
| Transparent/solid/gradient/image backgrounds | Implemented | Linear/radial gradients; image fit/blur/dim; animated gradient angle. |
| Media-derived backgrounds | Implemented | Deterministic local quantized palette extraction and gradient generation. |
| Background collections | Partial | Gradients/presets and imported texture images. |
| Stock image services | Not bundled | External images/providers can be supplied by the host; no embedded API keys or search UI. |
| 3D scene shapes | Implemented / partial catalog | Seven volumetric geometries, PBR materials, procedural environment reflections, lights and shadow maps. No imported GLTF or arbitrary extrusions. |
| Shadow overlays | Partial | Blurred shape layers can create simple overlays. |
| Noise, glitch, VHS-style effects | Implemented | Seeded noise, scanlines, glitch, vignette and color adjustments. |
| Portrait effects/background removal | Not implemented | No segmentation, depth estimation or person cutout. |
| Text/custom watermarks | Implemented / partial | Text watermark button; image watermarks can use an unframed mockup with zero shadow/radius. No dedicated logo-upload inspector workflow. |
| Animation presets | Implemented | Five presets; public keyframe/easing APIs and deterministic preview/export evaluation. |
| Video zoom/parallax | Partial | Node-scale zoom and planar tilt parallax; no tracked zoom-to-region UI, camera system, cursor-follow or depth-map parallax. |
| Live backgrounds | Partial | Animated gradients. |
| Timeline | Partial | Preview/scrub, duration/fps and per-node timing API. No multi-clip or keyframe graph editor. |
| Audio | Not implemented | All video exports are silent. |
| Still export | Implemented | PNG/JPEG/WebP at custom scale with MIME/signature checks. |
| Video export | Implemented, browser-dependent | Offline WebM VP9/VP8; MP4 AVC where WebCodecs supports it. UI exposes PNG/WebM; JPEG/WebP/MP4 via SDK. No alpha video guarantee. |
| GIF export | Implemented | Looping GIF89a via SDK and Manage → Export GIF. Up to 256 colors and one-bit transparency per frame. |
| Undo/redo, shortcuts, reset | Implemented / partial | History, keyboard undo/redo/delete and scene replacement API. |
| Preview/performance mode | Partial | Fitted preview and sequential/coalesced rendering; no dedicated performance-mode switch. |
| Portable projects | Implemented | Versioned JSON and embedded data URLs; no ZIP project-bundle helper. |
| Shareable links | Provider-dependent | Explicit share-provider interface. Hosting and permanent link infrastructure must be supplied by the host. |
| Node/server use | Optional example | DOM-free core, Node-canvas injection and a headless Chromium example. Browser APIs require a browser or adapter. |
| Accounts, billing, cloud galleries | Not included | Outside library scope. |

## Remaining work

1. Independent per-node video decoders, trim/clip timing, audio and larger streaming project storage.
2. Richer spatial models/HDR environments, softer contact shadows, improved translucent ordering, portrait segmentation and tracked zoom-to-region.
3. Richer asset catalogs, tested provider integrations and more direct manipulation/editor controls.
4. Firefox/Safari verification, broader export fixtures and longer videos.
