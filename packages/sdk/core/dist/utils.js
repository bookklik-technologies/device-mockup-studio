import { StudioError } from './types.js';
/** Clone mutable metadata, not immutable primitive strings (notably embedded media).
 * Preserve descriptors/prototypes so validation can reject hostile values without invoking
 * getters or losing evidence. Defining own properties also makes __proto__ inert.
 * A worklist and identity map preserve cycles/aliases for subsequent validation. */
export function copy(value) {
    if (value === null || typeof value !== 'object')
        return value;
    const seen = new WeakMap();
    const pending = [];
    const allocate = (source) => {
        const existing = seen.get(source);
        if (existing)
            return existing;
        const target = Array.isArray(source) ? [] : Object.create(Object.getPrototypeOf(source));
        if (Array.isArray(source))
            Object.setPrototypeOf(target, Object.getPrototypeOf(source));
        seen.set(source, target);
        pending.push([source, target]);
        return target;
    };
    const result = allocate(value);
    while (pending.length) {
        const [source, target] = pending.pop();
        for (const key of Reflect.ownKeys(source)) {
            const descriptor = Object.getOwnPropertyDescriptor(source, key);
            if (Array.isArray(source) && key === 'length') {
                Object.defineProperty(target, key, { value: descriptor.value });
            }
            else if ('value' in descriptor) {
                const child = descriptor.value;
                Object.defineProperty(target, key, { value: child !== null && typeof child === 'object' ? allocate(child) : child, enumerable: descriptor.enumerable, configurable: true, writable: true });
            }
            else {
                Object.defineProperty(target, key, { ...descriptor, configurable: true });
            }
        }
    }
    return result;
}
/** Shallow, descriptor-safe option merging; never execute untrusted factory getters. */
export function merge(base, ...overrides) {
    const target = Object.create(Object.getPrototypeOf(base));
    for (const source of [base, ...overrides]) {
        if (source === null || typeof source !== 'object' || (Object.getPrototypeOf(source) !== Object.prototype && Object.getPrototypeOf(source) !== null))
            throw new StudioError('INVALID_SCENE', 'Factory options must be plain objects.');
        for (const key of Reflect.ownKeys(source)) {
            const descriptor = Object.getOwnPropertyDescriptor(source, key);
            Object.defineProperty(target, key, { ...descriptor, configurable: true });
        }
    }
    return target;
}
/** Structural comparison of validated JSON metadata. Strings are compared directly,
 * never encoded/serialized/copied. Object property insertion order is not significant. */
export function metadataEqual(left, right) {
    if (left === right)
        return true;
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object')
        return false;
    if (Array.isArray(left) !== Array.isArray(right))
        return false;
    const keys = Object.keys(left);
    if (keys.length !== Object.keys(right).length)
        return false;
    return keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && metadataEqual(left[key], right[key]));
}
export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
export function lerp(from, to, progress) { return from + (to - from) * progress; }
/** Canvas-compatible source/destination rectangles. Focal values are normalized (0..1). */
export function computeFit(sourceWidth, sourceHeight, targetWidth, targetHeight, fit = 'cover', focalX = 0.5, focalY = 0.5) {
    if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(focalX) || !Number.isFinite(focalY) || !['cover', 'contain', 'stretch'].includes(fit))
        throw new StudioError('INVALID_FIT', 'Fit requires finite positive dimensions and cover/contain/stretch mode.');
    if (fit === 'stretch')
        return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight, dx: 0, dy: 0, dw: targetWidth, dh: targetHeight };
    const ratio = fit === 'cover' ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight) : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    if (fit === 'contain') {
        const dw = sourceWidth * ratio, dh = sourceHeight * ratio;
        return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight, dx: (targetWidth - dw) * clamp(focalX, 0, 1), dy: (targetHeight - dh) * clamp(focalY, 0, 1), dw, dh };
    }
    const sw = targetWidth / ratio, sh = targetHeight / ratio;
    return { sx: (sourceWidth - sw) * clamp(focalX, 0, 1), sy: (sourceHeight - sh) * clamp(focalY, 0, 1), sw, sh, dx: 0, dy: 0, dw: targetWidth, dh: targetHeight };
}
//# sourceMappingURL=utils.js.map