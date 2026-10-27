# Spatial rendering — v0.3

The optional `@bookklik/device-mockup-studio/spatial` entry point adds real volumetric geometry and raster physically based rendering through Three.js r180/WebGL2. It belongs to the single `@bookklik/device-mockup-studio` package, not a separate install. It is not CSS perspective, a faceted screenshot, or a claim of path-traced optics. The existing Canvas2D renderer remains available and unchanged for legacy scenes.

## Use it

```ts
import {
  createScene, createMesh, createMaterialPreset, createSpatialSettings,
} from '@bookklik/device-mockup-studio/core';
import { SpatialRenderer } from '@bookklik/device-mockup-studio/spatial';
import { exportImage, exportVideo } from '@bookklik/device-mockup-studio/media';

const lens = createMesh({
  geometry: 'sphere', x: 600, y: 450, z: 160,
  width: 300, height: 300, depth: 280,
  material: { ...createMaterialPreset('glass'), ior: 1.5, thickness: 240 },
});
const scene = createScene({
  width: 1200, height: 900,
  spatial: createSpatialSettings(),
  // Add text, shapes or media BEHIND the lens to see scene refraction.
  nodes: [lens],
});
const renderer = new SpatialRenderer(document.createElement('canvas'));
try {
  await renderer.render(scene, 0);
  const png = await exportImage(renderer, scene);
  const webm = await exportVideo(renderer, scene, { format: 'webm' });
} finally { renderer.dispose(); }
```

For the editor:

```ts
mountEditor(container, {
  scene,
  rendererFactory: canvas => new SpatialRenderer(canvas),
});
```

The factory is used for preview AND dedicated export renderers. The default editor still uses CanvasRenderer and disables its 3D button with an explanation. The demo passes SpatialRenderer and offers a `3D glass studio` scene switch. Click `+ 3D` to add a volume, then edit geometry, material and depth. Canvas controls expose studio lighting, environment, exposure, shadows and quality.

## Scene additions and compatibility

Existing version-1 projects remain valid and render through the same Canvas2D code path. Optional spatial fields are additive; older library versions can reject newer projects containing them. New exports include createMesh, createPhysicalMaterial, createMaterialPreset and createSpatialSettings. No Three or DOM dependency is added to core or presets. The spatial package ships Three/WebGPU type declarations for consumer typechecking; WebGPU itself is not a runtime requirement.

- MeshNode has geometry, width/height/depth, bevel, subdivisions, material and cast/receive-shadow settings.
- Geometry: box, rounded-box, sphere/ellipsoid, torus, cylinder, cone, icosahedron. These are closed triangle volumes with normals and real side walls. No GLTF/model import in this release.
- All node types can carry optional z in [-32768,32768]. Positive z points toward the viewer. Omitted depth uses small node-order increments. Explicit z takes precedence over array order.
- Rotation is in degrees. x/y remain node-center artboard pixels. Geometry uses an orthographic, pixel-aligned camera; it is real 3D without a perspective lens camera.
- Existing timeline properties work for meshes. z, lights and material properties are editable scene data but are not animated by the current track schema.
- Scene.spatial stores enabled, ambient color/intensity, environment intensity, exposure, shadows/opacity, quality and up to six directional/point lights. Mesh presence always requires spatial rendering, even if enabled is false; remove meshes to return entirely to Canvas2D.

CanvasRenderer explicitly throws SPATIAL_RENDERER_REQUIRED rather than silently flattening 3D. SpatialRenderer delegates legacy scenes without creating a GPU context. Spatial renderSync throws SPATIAL_ASYNC_REQUIRED; await render instead. Importing the spatial package does not touch WebGL or the DOM; actual GPU rendering requires WebGL2. getSpatialCapabilities is an explicit probe, not an import side effect.

## Materials and optics

Each physical material has color, metalness, roughness, transmission, IOR, thickness, attenuation color/distance, clearcoat/roughness and chromatic dispersion. Presets: glass, metal, ceramic and plastic. Material thickness and attenuation distance use scene-pixel world units.

- Glass transmission samples the actual opaque scene buffer; curved normals distort the image behind the object.
- Higher roughness creates a frosted transmission response; IOR changes refraction; thickness/attenuation tint the transmitted path; dispersion separates channels.
- Clearcoat, metalness and procedural environment reflections affect real volume shading.
- Glass mockup styles use an extruded, beveled rounded rim with an actual screen hole. Media/chrome is rasterized separately inside that opening. MockupNode.glass can override the inferred style material.
- Ordinary mockups/text/2D shapes are per-node texture planes in the 3D world, not one flattened foreground image. This allows depth occlusion and opaque content to be seen through glass.
- Photographic device frames are textured planes even when a saved node has a glass style. They preload embedded artwork and use the same screen geometry as Canvas2D; no procedural glass rim replaces the hardware. See [device artwork](DEVICE-ARTWORK.md).

## Lighting and shadows

Ambient plus directional/point lights illuminate volumes. A generated RoomEnvironment/PMREM supplies studio reflections without external HDR files or network requests. Lights use artboard x/y and world z. Point intensity is scene-scaled into pixel-world inverse-square units so the 0–20 editor range remains useful.

Volumetric meshes cast/receive bounded PCF shadow maps on a backdrop receiver. This is shadow-map rasterization, not area-light path tracing, colored glass shadows or caustics. The background and raster artwork are unlit sRGB planes: light/exposure changes affect PBR volumes rather than recoloring user interface screenshots/text. Global finishing effects are applied once to the composited result.

## Hard limits and cleanup

- Spatial output: 4096px per side, 16,000,000 pixels, further constrained by actual GPU texture/renderbuffer limits.
- At most 32 physical volumes (including glass mockup rims), and 256 visible raster nodes.
- Per-node/background GPU textures: at most 2048px per side and 16MP combined, adaptively shared. Large exports can magnify these raster textures; do not assume native 4K text texture fidelity.
- Subdivision and LRU geometry/material caches are bounded. Requested quality caps mesh subdivisions and shadow/transmission resolutions.
- Shadow maps share an 8MP budget across requested lights. Room PMREM and render/transmission targets use additional GPU memory; 16MP is a texture-input limit, not a total-memory guarantee.
- One lazy owned GPU context per renderer, reusable frame scene/camera, explicit cancellation/queueing, and resource disposal. getDebugInfo exposes counters without returning internal Three objects.
- Missing WebGL, allocation limits and context loss produce explicit errors without replacing the last successful image. Browser-restored contexts rebuild and render again; if restoration is denied by the browser, create a new renderer.
- The output canvas remains Canvas2D for existing image/frame/WebCodecs export helpers. Video exports remain silent.

## Fidelity boundaries

This is Three's screen-buffer/opaque-buffer transmission model, not recursive scene ray tracing. It does not refract another transmissive object, show off-screen geometry through a lens, produce caustics, or guarantee spectral/physically exact glass. High roughness and low-quality transmission buffers are approximate. Glass shadows are uncolored shadow maps. Intersecting semitransparent raster planes have depth-sort limitations.

Procedural glass device rims use rounded footprints, not exact hardware meshes. Flat artwork stays unlit, arbitrary model/HDR uploads are absent, and 3D picking uses projected convex bounds (including torus holes), not triangle raycasting. No cross-GPU bit-identical guarantee is made. Deterministic pixels were measured only on the validated Chromium/SwiftShader runtime. Firefox, Safari and mobile GPU matrices remain unverified.

## Actual validation

Run `pnpm test:spatial` after `pnpm build`. The 31 spatial browser checks include real WebGL draws, pixel evidence that IOR and roughness alter refraction, direct-light response, backdrop shadows, depth occlusion, glass mockup rims, stable repeated resource counts, transparency and finishing, PNG and silent WebM/MP4 encoding/decoding, missing WebGL, cancellation, context loss/restoration and disposal. Results are written to artifacts/spatial-results.json; coverage limits are described above.
