import type { SceneDocument } from './types.js';
export declare function cloneScene(scene: SceneDocument): SceneDocument;
export declare function serializeScene(scene: SceneDocument): string;
/** Version 1 is the only supported format. Never silently reinterpret future or unversioned projects. */
export declare function deserializeScene(json: string): SceneDocument;
//# sourceMappingURL=serialization.d.ts.map