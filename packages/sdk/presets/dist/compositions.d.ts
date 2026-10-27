import type { SceneDocument, ScenePreset } from '@bookklik/device-mockup-studio/core';
/** Fresh descriptors per call, no mutable recipe state escapes. Empty scenes remain empty. */
export declare function getPresets(): ScenePreset[];
export declare function applyPreset(scene: SceneDocument, id: string): SceneDocument;
//# sourceMappingURL=compositions.d.ts.map