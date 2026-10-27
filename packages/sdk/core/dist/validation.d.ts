import type { SceneDocument, ValidationIssue } from './types.js';
export declare const propertyBounds: Readonly<Record<string, readonly [number, number]>>;
/** Complete structural validation, including cross references. Device ids are open identifiers,
 * deliberately not a closed enum: device availability is resolved by the presets registry. */
export declare function validateScene(input: unknown): ValidationIssue[];
export declare function assertScene(scene: unknown): asserts scene is SceneDocument;
//# sourceMappingURL=validation.d.ts.map