import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, ExtrudeGeometry, IcosahedronGeometry, Path, Shape, SphereGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { StudioError, type MeshNode } from '@mockup-studio/core';

export type SpatialQuality = 'low' | 'medium' | 'high';
export type MeshGeometryOptions = Pick<MeshNode, 'geometry' | 'width' | 'height' | 'depth' | 'bevel' | 'segments'>;
const finite = (n: number, min: number, max: number): boolean => Number.isFinite(n) && n >= min && n <= max;

/** Subdivisions are deliberately not exponential. In particular, `segments` is NOT
 * passed through as the detail level of an icosahedron or rounded-box geometry. */
export function boundedSegments(segments: number, quality: SpatialQuality = 'high'): number {
  if (!Number.isFinite(segments)) throw new StudioError('SPATIAL_GEOMETRY', 'Segments must be finite.');
  return Math.max(8, Math.min(quality === 'low' ? 16 : quality === 'medium' ? 32 : 64, Math.floor(segments)));
}

function checkDimensions(width: number, height: number, depth: number): void {
  if (!finite(width, .001, 131072) || !finite(height, .001, 131072) || !finite(depth, .1, 4096)) {
    throw new StudioError('SPATIAL_GEOMETRY', 'Spatial geometry requires finite positive width/height and depth between .1 and 4096.');
  }
}

export function meshGeometryKey(node: MeshGeometryOptions, quality: SpatialQuality = 'high'): string {
  return [node.geometry, node.width, node.height, node.depth, node.bevel, boundedSegments(node.segments, quality)].join(':');
}

/** All seven geometries are real closed volumes, centered at the origin. Their
 * bounding boxes match the scene width/height/depth, including ellipsoids/tori.
 * The caller owns the returned geometry and must dispose it. Safe without DOM. */
export function createMeshGeometry(node: MeshGeometryOptions, quality: SpatialQuality = 'high'): BufferGeometry {
  const { width: w, height: h, depth: d } = node;
  checkDimensions(w, h, d);
  if (!finite(node.bevel, 0, 1024)) throw new StudioError('SPATIAL_GEOMETRY', 'Bevel must be between 0 and 1024.');
  const s = boundedSegments(node.segments, quality);
  let geometry: BufferGeometry;
  switch (node.geometry) {
    case 'box': geometry = new BoxGeometry(w, h, d); break;
    case 'rounded-box': {
      const radius = Math.min(node.bevel, w / 2, h / 2, d / 2);
      geometry = radius > 0 ? new RoundedBoxGeometry(w, h, d, Math.max(1, Math.min(8, Math.floor(s / 8))), radius) : new BoxGeometry(w, h, d);
      break;
    }
    case 'sphere': geometry = new SphereGeometry(.5, s, Math.max(8, Math.floor(s / 2))); break;
    case 'torus': geometry = new TorusGeometry(.35, .15, Math.max(8, Math.floor(s / 2)), s); break;
    case 'cylinder': geometry = new CylinderGeometry(.5, .5, 1, s, 1, false); break;
    case 'cone': geometry = new ConeGeometry(.5, 1, s, 1, false); break;
    case 'icosahedron': geometry = new IcosahedronGeometry(.5, Math.min(3, Math.max(0, Math.floor(s / 16)))); break;
    default: throw new StudioError('SPATIAL_GEOMETRY', `Unsupported mesh geometry '${String(node.geometry)}'.`);
  }
  // Normalize actual polygonal bounds, not an assumed analytic radius. This also
  // keeps odd radial subdivision counts pixel-aligned in an orthographic camera.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const cx = (box.min.x + box.max.x) / 2, cy = (box.min.y + box.max.y) / 2, cz = (box.min.z + box.max.z) / 2;
  const sx = box.max.x - box.min.x, sy = box.max.y - box.min.y, sz = box.max.z - box.min.z;
  geometry.translate(-cx, -cy, -cz);
  geometry.scale(w / sx, h / sy, d / sz);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export interface GlassRingOptions {
  width: number; height: number; depth: number; radius: number; screenRadius: number;
  inset: { left: number; right: number; top: number; bottom: number };
  bevel?: number; segments?: number;
}

/** Draw a rounded rectangle in world coordinates (Y up). */
function outline(path: Path, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  path.moveTo(x + r, y); path.lineTo(x + w - r, y);
  if (r) path.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x + w, y + h - r);
  if (r) path.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  path.lineTo(x + r, y + h);
  if (r) path.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x, y + r);
  if (r) path.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  path.closePath();
}

/** Rounded, beveled, extruded annulus with a genuine screen hole, not an opaque
 * plane pretending to be glass. Insets use the same pixel convention as getDevice.
 * Geometry is centered in XYZ; bevel is contained INSIDE the specified bounds. */
export function createGlassRingGeometry(options: GlassRingOptions): BufferGeometry {
  const { width: w, height: h, depth: d, inset } = options;
  checkDimensions(w, h, d);
  if (![options.radius, options.screenRadius, inset.left, inset.right, inset.top, inset.bottom].every(n => finite(n, 0, 131072))) {
    throw new StudioError('SPATIAL_GEOMETRY', 'Glass ring radii and insets must be finite and nonnegative.');
  }
  const sw = w - inset.left - inset.right, sh = h - inset.top - inset.bottom;
  if (sw <= 0 || sh <= 0 || Math.min(inset.left, inset.right, inset.top, inset.bottom) <= 0) throw new StudioError('SPATIAL_GEOMETRY', 'Glass rings require a positive inner hole and rim.');
  const b = Math.max(0, Math.min(options.bevel ?? 2, d / 4, Math.min(inset.left, inset.right, inset.top, inset.bottom) / 3));
  const shape = new Shape();
  outline(shape, -w / 2 + b, -h / 2 + b, w - b * 2, h - b * 2, Math.max(0, options.radius - b));
  const hole = new Path();
  outline(hole, -w / 2 + inset.left - b, -h / 2 + inset.bottom - b, sw + b * 2, sh + b * 2, options.screenRadius + b);
  shape.holes.push(hole);
  const s = boundedSegments(options.segments ?? 24);
  const geometry = new ExtrudeGeometry(shape, {
    depth: d - b * 2, steps: 1, bevelEnabled: b > 0, bevelThickness: b,
    bevelSize: b, bevelSegments: Math.min(6, Math.max(1, Math.floor(s / 8))), curveSegments: Math.min(16, Math.max(3, Math.floor(s / 4))),
  });
  geometry.translate(0, 0, -d / 2 + b);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
