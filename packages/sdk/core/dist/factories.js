import { StudioError } from './types.js';
import { assertScene } from './validation.js';
import { copy, merge } from './utils.js';
let counter = 0;
/** Process-local collision-resistant identifiers. No DOM or crypto dependency. */
export function uid(prefix = 'id') {
    counter += 1;
    return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
function base(type) {
    return { id: uid(type), name: type[0].toUpperCase() + type.slice(1), type, x: 600, y: 450, width: 720, height: 480, scale: 1, rotation: 0, tiltX: 0, tiltY: 0, opacity: 1, visible: true, locked: false };
}
/** Merge nested option data without evaluating accessors; leave invalid values intact for validation. */
function nestedDefaults(target, key, defaults) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor && !('value' in descriptor))
        return target;
    const value = descriptor?.value;
    if (value !== undefined && (value === null || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)))
        return target;
    Object.defineProperty(target, key, { value: value === undefined ? defaults : merge(defaults, value), enumerable: true, configurable: true, writable: true });
    return target;
}
export function createMockup(options = {}) {
    const node = merge({ ...base('mockup'), deviceId: 'screenshot', style: 'default', fit: 'cover', focalX: 0.5, focalY: 0.5, radius: 22, borderWidth: 1, borderColor: '#ffffff40', frameColor: '#181c26', lighting: 0.3, videoStart: 0, playbackRate: 1, videoLoop: true }, options, { type: 'mockup' });
    return copy(nestedDefaults(node, 'shadow', { color: '#101426', opacity: 0.28, blur: 48, spread: 0, offsetX: 0, offsetY: 24 }));
}
export function createText(options = {}) {
    return copy(merge({ ...base('text'), width: 700, height: 100, text: 'Make something remarkable.', color: '#ffffff', fontFamily: 'sans-serif', fontSize: 56, fontWeight: 700, align: 'center' }, options, { type: 'text' }));
}
export function createShape(options = {}) {
    return copy(merge({ ...base('shape'), width: 240, height: 240, shape: 'rectangle', fill: '#b8adff', stroke: 'transparent', strokeWidth: 0, radius: 24, blur: 0 }, options, { type: 'shape' }));
}
/** Complete opaque ceramic defaults. Invalid option descriptors are preserved for scene validation. */
export function createPhysicalMaterial(options = {}) {
    return copy(merge({ color: '#b8adff', metalness: 0, roughness: 0.28, transmission: 0, ior: 1.45, thickness: 24, attenuationColor: '#ffffff', attenuationDistance: 1000, clearcoat: 1, clearcoatRoughness: 0.12, dispersion: 0 }, options));
}
/** Fresh, renderer-independent PBR presets; no shared mutable material instances. */
export function createMaterialPreset(kind) {
    switch (kind) {
        case 'glass': return createPhysicalMaterial({ color: '#ffffff', transmission: 0.98, roughness: 0.08, ior: 1.45, thickness: 24, attenuationDistance: 1000, clearcoat: 1, clearcoatRoughness: 0.04, dispersion: 0.03 });
        case 'metal': return createPhysicalMaterial({ color: '#c6cbd8', metalness: 1, roughness: 0.2, clearcoat: 0.35, clearcoatRoughness: 0.1 });
        case 'ceramic': return createPhysicalMaterial();
        case 'plastic': return createPhysicalMaterial({ color: '#8e9dff', roughness: 0.35, ior: 1.46, clearcoat: 0.5, clearcoatRoughness: 0.2 });
        default: throw new StudioError('UNKNOWN_MATERIAL_PRESET', `Unknown material preset: ${typeof kind === 'string' ? kind : '<invalid>'}`);
    }
}
/** Effective glass values shared by the inspector and spatial renderer. Always returns fresh data. */
export function resolveMockupGlassMaterial(node) {
    if (node.glass)
        return copy(node.glass);
    const material = createMaterialPreset('glass');
    if (node.style === 'glass-dark')
        return { ...material, color: '#dbe6f6', attenuationColor: '#536780', attenuationDistance: 220, roughness: .13, transmission: .95 };
    if (node.style === 'liquid-glass')
        return { ...material, roughness: .045, thickness: 36, ior: 1.48, dispersion: .08 };
    return material;
}
export function createMesh(options = {}) {
    const node = merge({ ...base('mesh'), width: 240, height: 240, z: 0, geometry: 'rounded-box', depth: 160, bevel: 20, segments: 24, castShadow: true, receiveShadow: true }, options, { type: 'mesh' });
    return copy(nestedDefaults(node, 'material', createMaterialPreset('ceramic')));
}
export function createSpatialSettings(options = {}) {
    return copy(merge({ enabled: true, ambientColor: '#fff4e8', ambientIntensity: 0.5, environmentIntensity: 0.8, exposure: 1, shadows: true, shadowOpacity: 0.25, quality: 'medium', lights: [
            { id: uid('light'), type: 'directional', color: '#ffd9be', intensity: 3, x: 250, y: 50, z: 900, castShadow: true },
            { id: uid('light'), type: 'directional', color: '#b9c8ff', intensity: 2, x: 1100, y: 250, z: 600, castShadow: false },
        ] }, options));
}
export function createScene(options = {}) {
    const scene = merge({ version: 1, id: uid('scene'), name: 'Untitled composition', width: 1200, height: 900, duration: 4, fps: 30, background: { type: 'gradient', kind: 'linear', angle: 135, stops: [{ offset: 0, color: '#e9e7ff' }, { offset: 1, color: '#b6c5f1' }] }, seed: 1, assets: [], nodes: [], tracks: [] }, options);
    nestedDefaults(scene, 'effects', { noise: 0, vignette: 0, saturation: 1, contrast: 1, brightness: 1, scanlines: 0, glitch: 0 });
    // Validate before deep cloning: hostile input cannot force an unbounded factory clone.
    assertScene(scene);
    return copy(scene);
}
//# sourceMappingURL=factories.js.map