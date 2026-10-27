import { type MaterialPreset, type MeshGeometry, type MeshNode, type MockupNode, type PhysicalMaterial, type SceneDocument, type ShapeNode, type SpatialSettings, type TextNode } from '@bookklik/device-mockup-studio-core';
export interface TemplateDesign {
    description: string;
    build(context: TemplateContext): void;
}
export interface MaterialDesign extends TemplateDesign {
    name: string;
    category: string;
}
type ArtworkOptions = Partial<Pick<ShapeNode, 'rotation' | 'opacity' | 'blur' | 'z' | 'radius'>>;
interface TypeOptions {
    font?: string;
    color?: string;
    weight?: number;
    align?: TextNode['align'];
    rotation?: number;
    z?: number;
}
interface MediaOptions {
    rotation?: number;
    tiltX?: number;
    tiltY?: number;
    dark?: boolean;
    z?: number;
    shadow?: number;
}
/** Shared drawing primitives only. Art direction and responsive placement belong to each design. */
export declare class TemplateContext {
    readonly scene: SceneDocument;
    private readonly mediaIds;
    private readonly previous;
    readonly w: number;
    readonly h: number;
    readonly u: number;
    readonly wide: boolean;
    readonly tall: boolean;
    constructor(scene: SceneDocument, mediaIds: string[], previous: MockupNode[]);
    n(landscape: number, square: number, portrait: number): number;
    background(color: string): void;
    rect(name: string, x: number, y: number, width: number, height: number, fill: string, options?: ArtworkOptions): ShapeNode;
    disc(name: string, x: number, y: number, diameter: number, fill: string, options?: ArtworkOptions): ShapeNode;
    ring(name: string, x: number, y: number, diameter: number, color: string, thickness?: number, options?: ArtworkOptions): ShapeNode;
    line(name: string, x1: number, y1: number, x2: number, y2: number, color: string, thickness?: number, z?: number): ShapeNode;
    /** Conservative Latin advance estimate; browser review checks actual bundled font metrics. */
    private advance;
    text(name: string, content: string, x: number, y: number, width: number, size: number, options?: TypeOptions): TextNode;
    /** Independent text lines allow display leading without adding fields to the scene format. */
    headline(lines: string[], x: number, y: number, width: number, size: number, options?: TypeOptions, leading?: number): TextNode[];
    label(content: string, x: number, y: number, width: number, color?: string, options?: TypeOptions): TextNode;
    media(deviceId: string, index: number, x: number, y: number, boxWidth: number, boxHeight: number, options?: MediaOptions): MockupNode;
    material(kind: MaterialPreset, color: string, overrides?: Partial<PhysicalMaterial>): PhysicalMaterial;
    mesh(name: string, geometry: MeshGeometry, x: number, y: number, width: number, height: number, depth: number, material: PhysicalMaterial, options?: Partial<Pick<MeshNode, 'z' | 'rotation' | 'tiltX' | 'tiltY' | 'bevel' | 'segments'>>): MeshNode;
    lights(options: Partial<SpatialSettings>): void;
}
export {};
//# sourceMappingURL=template-context.d.ts.map