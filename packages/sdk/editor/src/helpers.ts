import type { SceneDocument, SceneNode } from '@bookklik/device-mockup-studio/core';

export interface Point { x: number; y: number }
export function clientToScene(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, scene: Pick<SceneDocument, 'width' | 'height'>): Point {
  return { x: (clientX - rect.left) * scene.width / Math.max(1, rect.width), y: (clientY - rect.top) * scene.height / Math.max(1, rect.height) };
}
/** Match the renderer's center-based rotation and perspective projection. */
export function nodeCorners(node: SceneNode, spatial = node.type === 'mesh'): Point[] {
  if (spatial) return spatialCorners(node);
  const radians = Math.PI / 180, ax = Math.max(-80, Math.min(80, node.tiltX)) * radians, ay = Math.max(-80, Math.min(80, node.tiltY)) * radians, az = node.rotation * radians;
  const focal = Math.max(node.width, node.height) * 2.4;
  return [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].map(([u, v]) => {
    const x = u! * node.width, y = v! * node.height;
    const ry = y * Math.cos(ax), rz = y * Math.sin(ax);
    const rx = x * Math.cos(ay) + rz * Math.sin(ay), z = -x * Math.sin(ay) + rz * Math.cos(ay), perspective = focal / (focal + z);
    return { x: node.x + (rx * Math.cos(az) - ry * Math.sin(az)) * perspective * node.scale, y: node.y + (rx * Math.sin(az) + ry * Math.cos(az)) * perspective * node.scale };
  });
}
/** Orthographic projected bounding hull. It includes mesh depth but deliberately
 * does not perform ray/triangle picking (sphere silhouettes, torus holes and glass
 * refraction are approximate). Legacy Canvas perspective stays untouched. */
function spatialCorners(node: SceneNode): Point[] {
  const r = Math.PI / 180, ax = node.tiltX * r, ay = node.tiltY * r, az = node.rotation * r;
  const depth = node.type === 'mesh' ? node.depth : 0;
  const points: Point[] = [];
  for (const z of depth ? [-depth / 2, depth / 2] : [0]) for (const x of [-node.width / 2, node.width / 2]) for (const y of [-node.height / 2, node.height / 2]) {
    // Equivalent to the spatial renderer's XYZ Euler transform in y-up world
    // coordinates, converted back into y-down artboard coordinates.
    const x1 = x * Math.cos(az) - y * Math.sin(az), y1 = x * Math.sin(az) + y * Math.cos(az);
    const x2 = x1 * Math.cos(ay) + z * Math.sin(ay), z2 = -x1 * Math.sin(ay) + z * Math.cos(ay);
    const y2 = y1 * Math.cos(ax) + z2 * Math.sin(ax);
    points.push({ x: node.x + x2 * node.scale, y: node.y + y2 * node.scale });
  }
  // Convex hull keeps depth-aware selection tight even when the box is tilted.
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lower: Point[] = [], upper: Point[] = [];
  for (const p of points) { while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...points].reverse()) { while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
export function hitTest(node: SceneNode, point: Point, spatial = node.type === 'mesh'): boolean {
  if (!node.visible || node.locked || node.opacity <= 0) return false;
  const polygon = nodeCorners(node, spatial); let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
/** Geometry edits also translate existing animation tracks, preserving motion. */
export function editNode(scene: SceneDocument, id: string, edit: (node: SceneNode) => void): void {
  const node = scene.nodes.find(n => n.id === id); if (!node) return;
  const before = { ...node }; edit(node);
  const bounds: Record<string, [number, number]> = { x: [-1e7, 1e7], y: [-1e7, 1e7], width: [.001, 131072], height: [.001, 131072], scale: [.0001, 1000], rotation: [-1e6, 1e6], tiltX: [-89, 89], tiltY: [-89, 89], opacity: [0, 1] };
  for (const track of scene.tracks) if (track.nodeId === id && node[track.property] !== before[track.property]) {
    const p = track.property, [min, max] = bounds[p]!;
    const proportional = p === 'scale' || p === 'width' || p === 'height';
    for (const frame of track.keyframes) frame.value = Math.min(max, Math.max(min, proportional ? frame.value * node[p] / before[p] : frame.value + node[p] - before[p]));
  }
}
