import type { MaterialPreset, MeshNode, MockupNode, PhysicalMaterial, SceneDocument, ShapeNode, SpatialSettings, TextNode } from './types.js';
/** Process-local collision-resistant identifiers. No DOM or crypto dependency. */
export declare function uid(prefix?: string): string;
export declare function createMockup(options?: Partial<MockupNode>): MockupNode;
export declare function createText(options?: Partial<TextNode>): TextNode;
export declare function createShape(options?: Partial<ShapeNode>): ShapeNode;
/** Complete opaque ceramic defaults. Invalid option descriptors are preserved for scene validation. */
export declare function createPhysicalMaterial(options?: Partial<PhysicalMaterial>): PhysicalMaterial;
/** Fresh, renderer-independent PBR presets; no shared mutable material instances. */
export declare function createMaterialPreset(kind: MaterialPreset): PhysicalMaterial;
/** Effective glass values shared by the inspector and spatial renderer. Always returns fresh data. */
export declare function resolveMockupGlassMaterial(node: Pick<MockupNode, 'style' | 'glass'>): PhysicalMaterial;
export type MeshOptions = Omit<Partial<MeshNode>, 'material'> & {
    material?: Partial<PhysicalMaterial>;
};
export declare function createMesh(options?: MeshOptions): MeshNode;
export declare function createSpatialSettings(options?: Partial<SpatialSettings>): SpatialSettings;
export declare function createScene(options?: Partial<SceneDocument>): SceneDocument;
//# sourceMappingURL=factories.d.ts.map