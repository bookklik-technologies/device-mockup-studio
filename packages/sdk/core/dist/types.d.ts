/** Serializable scene contract. All distances are output pixels; time is seconds. */
export type Fit = 'cover' | 'contain' | 'stretch';
export type MockupStyle = 'default' | 'glass-light' | 'glass-dark' | 'liquid-glass' | 'inset-light' | 'inset-dark' | 'outline' | 'border';
export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
export interface Asset {
    id: string;
    kind: 'image' | 'video';
    src: string;
    width: number;
    height: number;
    name?: string;
    mime?: string;
    duration?: number;
}
export interface GradientStop {
    offset: number;
    color: string;
}
export type Background = {
    type: 'transparent';
} | {
    type: 'solid';
    color: string;
} | {
    type: 'gradient';
    kind: 'linear' | 'radial';
    angle: number;
    stops: GradientStop[];
    speed?: number;
} | {
    type: 'image';
    assetId: string;
    fit: Fit;
    blur: number;
    dim: number;
};
export interface Shadow {
    color: string;
    opacity: number;
    blur: number;
    spread: number;
    offsetX: number;
    offsetY: number;
}
export interface BaseNode {
    id: string;
    name: string;
    type: 'mockup' | 'text' | 'shape' | 'mesh';
    x: number;
    y: number;
    z?: number;
    width: number;
    height: number;
    scale: number;
    rotation: number;
    tiltX: number;
    tiltY: number;
    opacity: number;
    visible: boolean;
    locked: boolean;
}
export interface MockupNode extends BaseNode {
    type: 'mockup';
    assetId?: string;
    deviceId: string;
    style: MockupStyle;
    fit: Fit;
    focalX: number;
    focalY: number;
    radius: number;
    borderWidth: number;
    borderColor: string;
    frameColor: string;
    shadow: Shadow;
    lighting: number;
    videoStart: number;
    playbackRate: number;
    videoLoop: boolean;
    glass?: PhysicalMaterial;
}
export interface TextNode extends BaseNode {
    type: 'text';
    text: string;
    color: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    align: 'left' | 'center' | 'right';
}
export interface ShapeNode extends BaseNode {
    type: 'shape';
    shape: 'rectangle' | 'ellipse' | 'ring';
    fill: string;
    stroke: string;
    strokeWidth: number;
    radius: number;
    blur: number;
}
/** PBR values are renderer-independent scene metadata; scene pixels are world units. */
export interface PhysicalMaterial {
    color: string;
    metalness: number;
    roughness: number;
    transmission: number;
    ior: number;
    thickness: number;
    attenuationColor: string;
    attenuationDistance: number;
    clearcoat: number;
    clearcoatRoughness: number;
    dispersion: number;
}
export type MaterialPreset = 'glass' | 'metal' | 'ceramic' | 'plastic';
export type MeshGeometry = 'box' | 'rounded-box' | 'sphere' | 'torus' | 'cylinder' | 'cone' | 'icosahedron';
export interface MeshNode extends BaseNode {
    type: 'mesh';
    geometry: MeshGeometry;
    depth: number;
    bevel: number;
    segments: number;
    material: PhysicalMaterial;
    castShadow: boolean;
    receiveShadow: boolean;
}
export interface SpatialLight {
    id: string;
    type: 'directional' | 'point';
    color: string;
    intensity: number;
    x: number;
    y: number;
    z: number;
    castShadow: boolean;
}
export interface SpatialSettings {
    enabled: boolean;
    ambientColor: string;
    ambientIntensity: number;
    environmentIntensity: number;
    exposure: number;
    shadows: boolean;
    shadowOpacity: number;
    quality: 'low' | 'medium' | 'high';
    lights: SpatialLight[];
}
export type SceneNode = MockupNode | TextNode | ShapeNode | MeshNode;
export type AnimatableProperty = 'x' | 'y' | 'width' | 'height' | 'scale' | 'rotation' | 'tiltX' | 'tiltY' | 'opacity';
export interface Keyframe {
    time: number;
    value: number;
    easing?: Easing;
}
export interface AnimationTrack {
    id: string;
    nodeId: string;
    property: AnimatableProperty;
    keyframes: Keyframe[];
}
export interface SceneEffects {
    noise: number;
    vignette: number;
    saturation: number;
    contrast: number;
    brightness: number;
    scanlines: number;
    glitch: number;
}
export interface SceneDocument {
    version: 1;
    id: string;
    name: string;
    width: number;
    height: number;
    duration: number;
    fps: number;
    background: Background;
    effects: SceneEffects;
    assets: Asset[];
    nodes: SceneNode[];
    tracks: AnimationTrack[];
    seed: number;
    spatial?: SpatialSettings;
}
/** Coordinates are pixels in the unrotated artwork. Clockwise rotation affects the frame, not screen content. */
export interface DeviceArtwork {
    src: string;
    width: number;
    height: number;
    screen: {
        x: number;
        y: number;
        width: number;
        height: number;
        radius: number;
    };
    orientation: 0 | 90 | 270;
}
export interface DeviceDefinition {
    id: string;
    name: string;
    category: 'screenshot' | 'browser' | 'phone' | 'tablet' | 'laptop' | 'desktop';
    aspect: number;
    inset: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    radius: number;
    screenRadius: number;
    camera?: 'pill' | 'dot';
    chrome?: 'browser' | 'stand' | 'keyboard';
    artwork?: DeviceArtwork;
}
export interface ScenePreset {
    id: string;
    name: string;
    category: string;
    apply(scene: SceneDocument): SceneDocument;
}
export interface ValidationIssue {
    path: string;
    message: string;
}
export declare class StudioError extends Error {
    readonly code: string;
    readonly cause?: unknown | undefined;
    constructor(code: string, message: string, cause?: unknown | undefined);
}
//# sourceMappingURL=types.d.ts.map