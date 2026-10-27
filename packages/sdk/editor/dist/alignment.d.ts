import type { SceneDocument, SceneNode } from '@bookklik/device-mockup-studio-core';
import { type Point } from './helpers.js';
export interface Bounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}
export type Alignment = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom';
export interface SnapTarget {
    id: string;
    bounds: Bounds;
}
export interface SnapMatch {
    target: string;
    anchor: number;
    value: number;
}
export interface SnapState {
    x?: SnapMatch;
    y?: SnapMatch;
}
export interface SnapGuide {
    axis: 'x' | 'y';
    value: number;
    from: number;
    to: number;
}
/** Same projected geometry as selection, without shadows or blur. */
export declare function nodeBounds(node: SceneNode, spatial?: boolean): Bounds;
export declare function snapTargets(scene: SceneDocument, movingId: string): SnapTarget[];
export declare function alignmentDelta(bounds: Bounds, canvas: Pick<SceneDocument, 'width' | 'height'>, align: Alignment): Point;
export declare function constrainMovement(delta: Point, shift: boolean, axis?: 'x' | 'y'): {
    delta: Point;
    axis?: 'x' | 'y';
};
/** Input bounds are unsnapped. Thresholds are CSS pixels, independent of zoom. */
export declare function snapBounds(bounds: Bounds, targets: SnapTarget[], pixelsPerUnit: Point, previous?: SnapState, options?: {
    bypass?: boolean;
    axis?: 'x' | 'y';
}): {
    delta: Point;
    state: SnapState;
    guides: SnapGuide[];
};
//# sourceMappingURL=alignment.d.ts.map