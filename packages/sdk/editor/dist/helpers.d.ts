import type { SceneDocument, SceneNode } from '@bookklik/device-mockup-studio/core';
export interface Point {
    x: number;
    y: number;
}
export declare function clientToScene(clientX: number, clientY: number, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, scene: Pick<SceneDocument, 'width' | 'height'>): Point;
/** Match the renderer's center-based rotation and perspective projection. */
export declare function nodeCorners(node: SceneNode, spatial?: boolean): Point[];
export declare function hitTest(node: SceneNode, point: Point, spatial?: boolean): boolean;
/** Geometry edits also translate existing animation tracks, preserving motion. */
export declare function editNode(scene: SceneDocument, id: string, edit: (node: SceneNode) => void): void;
//# sourceMappingURL=helpers.d.ts.map