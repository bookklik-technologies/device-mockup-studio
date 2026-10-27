import { BufferGeometry } from 'three';
import { type MeshNode } from '@bookklik/device-mockup-studio/core';
export type SpatialQuality = 'low' | 'medium' | 'high';
export type MeshGeometryOptions = Pick<MeshNode, 'geometry' | 'width' | 'height' | 'depth' | 'bevel' | 'segments'>;
/** Subdivisions are deliberately not exponential. In particular, `segments` is NOT
 * passed through as the detail level of an icosahedron or rounded-box geometry. */
export declare function boundedSegments(segments: number, quality?: SpatialQuality): number;
export declare function meshGeometryKey(node: MeshGeometryOptions, quality?: SpatialQuality): string;
/** All seven geometries are real closed volumes, centered at the origin. Their
 * bounding boxes match the scene width/height/depth, including ellipsoids/tori.
 * The caller owns the returned geometry and must dispose it. Safe without DOM. */
export declare function createMeshGeometry(node: MeshGeometryOptions, quality?: SpatialQuality): BufferGeometry;
export interface GlassRingOptions {
    width: number;
    height: number;
    depth: number;
    radius: number;
    screenRadius: number;
    inset: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
    bevel?: number;
    segments?: number;
}
/** Rounded, beveled, extruded annulus with a genuine screen hole, not an opaque
 * plane pretending to be glass. Insets use the same pixel convention as getDevice.
 * Geometry is centered in XYZ; bevel is contained INSIDE the specified bounds. */
export declare function createGlassRingGeometry(options: GlassRingOptions): BufferGeometry;
//# sourceMappingURL=geometry.d.ts.map