/// <reference types="@webgpu/types" preserve="true" />
/** Optional WebGL2 extension. Importing is side-effect-free and does not probe the DOM/GPU. */
export { SpatialRenderer, getSpatialCapabilities, SPATIAL_LIMITS } from './renderer.js';
export type { SpatialCapabilities, SpatialDebugInfo } from './renderer.js';
export { createMeshGeometry, createGlassRingGeometry, boundedSegments, meshGeometryKey } from './geometry.js';
export type { MeshGeometryOptions, GlassRingOptions, SpatialQuality } from './geometry.js';
