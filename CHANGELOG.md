# Changelog

## 0.3.0 — 2026-10-27

- Add `@mockup-studio/sdk/headless` and `createHeadlessStudio` for custom UI integrations, with scene history, explicit rendering, serialized image export, JSON persistence hooks and resource cleanup.
- Add standalone headless ESM output and a native Node canvas example; make the optional Chromium example portable to Windows/macOS.
- Prepare seven public npm packages with Node engine metadata, packaged notices, cross-platform packing, archive validation and a hash manifest. Preserve authored package documentation and licenses during builds.
- Document manual dependency-ordered publication. Release preparation does not publish packages or run tests.
- Refine mobile canvas sizing, light-theme actions, media thumbnails and browser theme colors; restore the project-name control.
- Fix gifenc Node ESM interoperability and update artwork/browser regression coverage.

## 0.2.0 — 2026-10-22

Adds an optional seventh spatial package with Three.js/WebGL2, seven actual volumetric geometries, PBR materials, studio lights/environment/shadows and transmissive glass mockup rims. New material and scene factories, backward-compatible additive schema, wired editor controls and a two-scene demo. Browser pixel tests verify refraction, IOR, roughness and lighting changes; context recovery, resource bounds and spatial still/video export are tested. Legacy Canvas path remains unchanged. See docs/SPATIAL.md for limits, including recursive/path-traced glass.


## 0.1.0 — 2026-10-22

Initial working TypeScript release: six packages, framework-free editor/demo, pure scene/state engine, original procedural presets/devices, Canvas perspective rendering, local media palettes, deterministic animation, still and silent video export, portable JSON, provider interfaces and an optional headless example.

Validated with 108 automated tests, 16 real-Chromium checks and isolated package install/typechecking. See docs/FEATURES.md for partial/missing functionality.
