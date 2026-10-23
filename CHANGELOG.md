# Changelog

## 0.2.0 — 2026-10-22

Adds an optional seventh spatial package with Three.js/WebGL2, seven actual volumetric geometries, PBR materials, studio lights/environment/shadows and transmissive glass mockup rims. New material and scene factories, backward-compatible additive schema, wired editor controls and a two-scene demo. Browser pixel tests verify refraction, IOR, roughness and lighting changes; context recovery, resource bounds and spatial still/video export are tested. Legacy Canvas path remains unchanged. See docs/SPATIAL.md for limits, including recursive/path-traced glass.


## 0.1.0 — 2026-10-22

Initial working TypeScript release: six packages, framework-free editor/demo, pure scene/state engine, original procedural presets/devices, Canvas perspective rendering, local media palettes, deterministic animation, still and silent video export, portable JSON, provider interfaces and an optional headless example.

Validated with 108 automated tests, 16 real-Chromium checks and isolated package install/typechecking. See docs/FEATURES.md for partial/missing functionality.
