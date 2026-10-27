import { StudioError } from './types.js';
const properties = ['x', 'y', 'width', 'height', 'scale', 'rotation', 'tiltX', 'tiltY', 'opacity'];
export const propertyBounds = {
    x: [-1e7, 1e7], y: [-1e7, 1e7], width: [0.001, 131072], height: [0.001, 131072], scale: [0.0001, 1000], rotation: [-1e6, 1e6], tiltX: [-89, 89], tiltY: [-89, 89], opacity: [0, 1],
};
function record(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
/** Complete structural validation, including cross references. Device ids are open identifiers,
 * deliberately not a closed enum: device availability is resolved by the presets registry. */
export function validateScene(input) {
    try {
        return validateSceneData(input);
    }
    catch {
        return [{ path: '', message: 'Scene metadata could not be inspected safely' }];
    }
}
function validateSceneData(input) {
    const issues = [];
    const issue = (path, message) => { if (issues.length < 200)
        issues.push({ path, message }); };
    const ancestors = new WeakSet();
    // Bound work over the actual graph, including repeated aliases, not just unique objects.
    // These budgets count string characters; data URLs are ASCII and require no byte copies.
    const maxVisited = 500000, maxKeyframes = 100000, maxSource = 48 * 1024 * 1024, maxSources = 128 * 1024 * 1024;
    let visited = 0, totalKeyframes = 0, totalSources = 0, stopped = false;
    const done = () => stopped || issues.length >= 200;
    // Validate an inert descriptor snapshot, never the original object's property reads.
    // This also prevents inherited Object.prototype getters and Proxy get traps from running.
    // Strings (including embedded media) remain shared immutable primitives, not copied bytes.
    const preflight = (value, path, depth) => {
        if (done())
            return;
        if (++visited > maxVisited) {
            issue(path, `Maximum validation traversal budget exceeded (${maxVisited})`);
            stopped = true;
            return;
        }
        if (depth > 24) {
            issue(path, 'Maximum nesting depth exceeded');
            return;
        }
        if (typeof value === 'number' && !Number.isFinite(value))
            issue(path, 'Must be finite');
        if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function')
            issue(path, 'Must be JSON-serializable');
        // Read source data only after its descriptor has been inspected below. No accessors run.
        if (typeof value === 'string' && /^assets\[\d+\]\.src$/.test(path)) {
            totalSources += value.length;
            if (value.length > maxSource) {
                issue(path, `Asset source exceeds maximum length (${maxSource} characters / 48 MiB)`);
                stopped = true;
            }
            if (totalSources > maxSources) {
                issue('assets', `Total asset sources exceed maximum length (${maxSources} characters / 128 MiB)`);
                stopped = true;
            }
        }
        if (value === null || typeof value !== 'object')
            return value;
        if (ancestors.has(value)) {
            issue(path, 'Circular references are not serializable');
            return;
        }
        const proto = Object.getPrototypeOf(value);
        const isArray = Array.isArray(value);
        if (isArray ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) {
            issue(path, 'Must be a plain object or array');
            return;
        }
        ancestors.add(value);
        const snapshot = isArray ? [] : Object.create(null);
        if (isArray) {
            const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
            const limit = path === 'spatial.lights' ? 6 : path === 'nodes' ? 2000 : path === 'tracks' ? 10000 : 20000;
            if (typeof length !== 'number' || !Number.isInteger(length) || length < 0 || length > limit) {
                issue(path, `Array exceeds maximum length (${limit})`);
                ancestors.delete(value);
                return;
            }
            if (/^tracks\[\d+\]\.keyframes$/.test(path)) {
                totalKeyframes += length;
                if (totalKeyframes > maxKeyframes) {
                    issue('tracks', `Scene exceeds maximum total keyframes (${maxKeyframes})`);
                    stopped = true;
                    ancestors.delete(value);
                    return;
                }
            }
            for (let i = 0; i < length && !done(); i++) {
                const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
                if (!descriptor) {
                    issue(`${path}[${i}]`, 'Sparse array entry');
                    continue;
                }
                if (!('value' in descriptor)) {
                    issue(`${path}[${i}]`, 'Accessors are not supported');
                    continue;
                }
                if (!descriptor.enumerable) {
                    issue(`${path}[${i}]`, 'Non-enumerable properties are not serializable');
                    continue;
                }
                if (descriptor.value === undefined)
                    issue(`${path}[${i}]`, 'Undefined array entry');
                else
                    Object.defineProperty(snapshot, i, { value: preflight(descriptor.value, `${path}[${i}]`, depth + 1), enumerable: true });
            }
            if (!done())
                for (const key of Reflect.ownKeys(value)) {
                    if (done())
                        break;
                    if (key === 'length' || (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length))
                        continue;
                    const descriptor = Object.getOwnPropertyDescriptor(value, key);
                    issue(path, typeof key === 'symbol' ? 'Symbol keys are not serializable' : !('value' in descriptor) ? 'Accessors are not supported' : 'Extra array properties are not serializable');
                }
        }
        else {
            for (const key of Reflect.ownKeys(value)) {
                if (done())
                    break;
                if (typeof key !== 'string') {
                    issue(path, 'Symbol keys are not serializable');
                    continue;
                }
                const descriptor = Object.getOwnPropertyDescriptor(value, key);
                if (!('value' in descriptor)) {
                    issue(path ? `${path}.${key}` : key, 'Accessors are not supported');
                    continue;
                }
                if (!descriptor.enumerable) {
                    issue(path ? `${path}.${key}` : key, 'Non-enumerable properties are not serializable');
                    continue;
                }
                Object.defineProperty(snapshot, key, { value: preflight(descriptor.value, path ? `${path}.${key}` : key, depth + 1), enumerable: true });
            }
        }
        ancestors.delete(value);
        return snapshot;
    };
    input = preflight(input, '', 0);
    if (issues.length)
        return issues;
    const each = (values, visit) => {
        for (let i = 0; i < values.length && !done(); i++)
            visit(values[i], i);
    };
    const obj = (value, path, keys) => {
        if (!record(value)) {
            issue(path, 'Must be an object');
            return false;
        }
        for (const key of Object.keys(value)) {
            if (done())
                break;
            if (!keys.includes(key))
                issue(path ? `${path}.${key}` : key, 'Unknown property');
        }
        return true;
    };
    const num = (value, path, min = -1e7, max = 1e7) => {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
            issue(path, `Must be a finite number in [${min}, ${max}]`);
            return false;
        }
        return true;
    };
    const str = (value, path, nonempty = true, max = 100000) => {
        if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim())) {
            issue(path, `Must be ${nonempty ? 'a non-empty' : 'a'} string (max ${max} characters)`);
            return false;
        }
        return true;
    };
    const bool = (value, path) => { if (typeof value !== 'boolean')
        issue(path, 'Must be a boolean'); };
    const en = (value, path, values) => { if (!values.includes(value))
        issue(path, `Must be one of: ${values.join(', ')}`); };
    const arr = (value, path, min = 0, max = 10000) => {
        if (!Array.isArray(value) || value.length < min || value.length > max) {
            issue(path, `Must be an array with ${min}..${max} entries`);
            return false;
        }
        return true;
    };
    const ids = new Set();
    const id = (value, path) => {
        if (str(value, path, true, 256)) {
            if (ids.has(value))
                issue(path, `Duplicate id: ${value}`);
            else
                ids.add(value);
        }
    };
    const shadow = (value, path) => {
        if (!obj(value, path, ['color', 'opacity', 'blur', 'spread', 'offsetX', 'offsetY']))
            return;
        str(value.color, `${path}.color`, true, 512);
        num(value.opacity, `${path}.opacity`, 0, 1);
        num(value.blur, `${path}.blur`, 0, 4096);
        num(value.spread, `${path}.spread`, -4096, 4096);
        num(value.offsetX, `${path}.offsetX`, -32768, 32768);
        num(value.offsetY, `${path}.offsetY`, -32768, 32768);
    };
    const material = (value, path) => {
        const ranges = {
            metalness: [0, 1], roughness: [0, 1], transmission: [0, 1], ior: [1, 2.5], thickness: [0, 1000],
            attenuationDistance: [1, 100000], clearcoat: [0, 1], clearcoatRoughness: [0, 1], dispersion: [0, 1],
        };
        if (!obj(value, path, ['color', 'attenuationColor', ...Object.keys(ranges)]))
            return;
        str(value.color, `${path}.color`, true, 512);
        str(value.attenuationColor, `${path}.attenuationColor`, true, 512);
        for (const [key, bounds] of Object.entries(ranges))
            num(value[key], `${path}.${key}`, bounds[0], bounds[1]);
    };
    if (!obj(input, '', ['version', 'id', 'name', 'width', 'height', 'duration', 'fps', 'background', 'effects', 'assets', 'nodes', 'tracks', 'seed', 'spatial']))
        return issues;
    en(input.version, 'version', [1]);
    id(input.id, 'id');
    str(input.name, 'name', false, 1024);
    num(input.width, 'width', 1, 32768);
    num(input.height, 'height', 1, 32768);
    num(input.duration, 'duration', 0.001, 3600);
    num(input.fps, 'fps', 1, 240);
    if (num(input.seed, 'seed', 0, 4294967295) && !Number.isInteger(input.seed))
        issue('seed', 'Must be an integer');
    const assetMap = new Map();
    if (arr(input.assets, 'assets', 0, 10000))
        each(input.assets, (asset, i) => {
            const p = `assets[${i}]`;
            if (!obj(asset, p, ['id', 'kind', 'src', 'width', 'height', 'name', 'mime', 'duration']))
                return;
            id(asset.id, `${p}.id`);
            en(asset.kind, `${p}.kind`, ['image', 'video']);
            str(asset.src, `${p}.src`, true, maxSource);
            num(asset.width, `${p}.width`, 1, 131072);
            num(asset.height, `${p}.height`, 1, 131072);
            if (asset.name !== undefined)
                str(asset.name, `${p}.name`, false, 1024);
            if (asset.mime !== undefined)
                str(asset.mime, `${p}.mime`, true, 256);
            if (asset.duration !== undefined)
                num(asset.duration, `${p}.duration`, 0, 86400);
            if (typeof asset.id === 'string')
                assetMap.set(asset.id, asset);
        });
    const ref = (value, path, imageOnly = false) => {
        if (!str(value, path, true, 256))
            return;
        const asset = assetMap.get(value);
        if (!asset)
            issue(path, `Unknown asset: ${value}`);
        else if (imageOnly && asset.kind !== 'image')
            issue(path, 'Background requires an image asset');
    };
    const bg = input.background;
    if (!record(bg))
        issue('background', 'Must be an object');
    else if (bg.type === 'transparent')
        obj(bg, 'background', ['type']);
    else if (bg.type === 'solid') {
        obj(bg, 'background', ['type', 'color']);
        str(bg.color, 'background.color', true, 512);
    }
    else if (bg.type === 'gradient') {
        obj(bg, 'background', ['type', 'kind', 'angle', 'stops', 'speed']);
        en(bg.kind, 'background.kind', ['linear', 'radial']);
        num(bg.angle, 'background.angle', -1e6, 1e6);
        if (bg.speed !== undefined)
            num(bg.speed, 'background.speed', -3600, 3600);
        if (arr(bg.stops, 'background.stops', 2, 64)) {
            let last = -1;
            each(bg.stops, (stop, i) => { const p = `background.stops[${i}]`; if (!obj(stop, p, ['offset', 'color']))
                return; if (num(stop.offset, `${p}.offset`, 0, 1)) {
                if (stop.offset < last)
                    issue(`${p}.offset`, 'Gradient stops must be sorted by offset');
                last = stop.offset;
            } str(stop.color, `${p}.color`, true, 512); });
        }
    }
    else if (bg.type === 'image') {
        obj(bg, 'background', ['type', 'assetId', 'fit', 'blur', 'dim']);
        ref(bg.assetId, 'background.assetId', true);
        en(bg.fit, 'background.fit', ['cover', 'contain', 'stretch']);
        num(bg.blur, 'background.blur', 0, 4096);
        num(bg.dim, 'background.dim', 0, 1);
    }
    else
        issue('background.type', 'Unknown background type');
    const effectKeys = ['noise', 'vignette', 'saturation', 'contrast', 'brightness', 'scanlines', 'glitch'];
    if (obj(input.effects, 'effects', effectKeys))
        for (const key of effectKeys)
            num(input.effects[key], `effects.${key}`, 0, ['saturation', 'contrast', 'brightness'].includes(key) ? 4 : 1);
    const nodeMap = new Map();
    let meshCount = 0;
    const baseKeys = ['id', 'name', 'type', ...properties, 'z', 'visible', 'locked'];
    if (arr(input.nodes, 'nodes', 0, 2000))
        each(input.nodes, (node, i) => {
            const p = `nodes[${i}]`;
            if (!record(node)) {
                issue(p, 'Must be an object');
                return;
            }
            const extra = node.type === 'mockup' ? ['assetId', 'deviceId', 'style', 'fit', 'focalX', 'focalY', 'radius', 'borderWidth', 'borderColor', 'frameColor', 'shadow', 'lighting', 'videoStart', 'playbackRate', 'videoLoop', 'glass'] : node.type === 'text' ? ['text', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'align'] : node.type === 'shape' ? ['shape', 'fill', 'stroke', 'strokeWidth', 'radius', 'blur'] : node.type === 'mesh' ? ['geometry', 'depth', 'bevel', 'segments', 'material', 'castShadow', 'receiveShadow'] : [];
            obj(node, p, [...baseKeys, ...extra]);
            id(node.id, `${p}.id`);
            str(node.name, `${p}.name`, false, 1024);
            en(node.type, `${p}.type`, ['mockup', 'text', 'shape', 'mesh']);
            for (const prop of properties) {
                const bounds = propertyBounds[prop];
                num(node[prop], `${p}.${prop}`, bounds[0], bounds[1]);
            }
            if (node.z !== undefined)
                num(node.z, `${p}.z`, -32768, 32768);
            bool(node.visible, `${p}.visible`);
            bool(node.locked, `${p}.locked`);
            if (typeof node.id === 'string')
                nodeMap.set(node.id, node);
            if (node.type === 'mockup') {
                if (node.glass !== undefined)
                    material(node.glass, `${p}.glass`);
                if (node.assetId !== undefined)
                    ref(node.assetId, `${p}.assetId`);
                str(node.deviceId, `${p}.deviceId`, true, 256);
                en(node.style, `${p}.style`, ['default', 'glass-light', 'glass-dark', 'liquid-glass', 'inset-light', 'inset-dark', 'outline', 'border']);
                en(node.fit, `${p}.fit`, ['cover', 'contain', 'stretch']);
                num(node.focalX, `${p}.focalX`, 0, 1);
                num(node.focalY, `${p}.focalY`, 0, 1);
                num(node.radius, `${p}.radius`, 0, 65536);
                num(node.borderWidth, `${p}.borderWidth`, 0, 4096);
                str(node.borderColor, `${p}.borderColor`, true, 512);
                str(node.frameColor, `${p}.frameColor`, true, 512);
                shadow(node.shadow, `${p}.shadow`);
                num(node.lighting, `${p}.lighting`, 0, 1);
                num(node.videoStart, `${p}.videoStart`, 0, 86400);
                num(node.playbackRate, `${p}.playbackRate`, 0.01, 16);
                bool(node.videoLoop, `${p}.videoLoop`);
            }
            else if (node.type === 'text') {
                str(node.text, `${p}.text`, false, 100000);
                str(node.color, `${p}.color`, true, 512);
                str(node.fontFamily, `${p}.fontFamily`, true, 512);
                num(node.fontSize, `${p}.fontSize`, 1, 4096);
                num(node.fontWeight, `${p}.fontWeight`, 1, 1000);
                en(node.align, `${p}.align`, ['left', 'center', 'right']);
            }
            else if (node.type === 'mesh') {
                if (++meshCount === 33)
                    issue('nodes', 'Scene exceeds maximum mesh count (32)');
                en(node.geometry, `${p}.geometry`, ['box', 'rounded-box', 'sphere', 'torus', 'cylinder', 'cone', 'icosahedron']);
                num(node.depth, `${p}.depth`, 0.1, 4096);
                num(node.bevel, `${p}.bevel`, 0, 1024);
                if (num(node.segments, `${p}.segments`, 8, 64) && !Number.isInteger(node.segments))
                    issue(`${p}.segments`, 'Must be an integer');
                material(node.material, `${p}.material`);
                bool(node.castShadow, `${p}.castShadow`);
                bool(node.receiveShadow, `${p}.receiveShadow`);
            }
            else if (node.type === 'shape') {
                en(node.shape, `${p}.shape`, ['rectangle', 'ellipse', 'ring']);
                str(node.fill, `${p}.fill`, true, 512);
                str(node.stroke, `${p}.stroke`, true, 512);
                num(node.strokeWidth, `${p}.strokeWidth`, 0, 4096);
                num(node.radius, `${p}.radius`, 0, 65536);
                num(node.blur, `${p}.blur`, 0, 4096);
            }
        });
    const targeted = new Map();
    if (arr(input.tracks, 'tracks'))
        each(input.tracks, (track, i) => {
            const p = `tracks[${i}]`;
            if (!obj(track, p, ['id', 'nodeId', 'property', 'keyframes']))
                return;
            id(track.id, `${p}.id`);
            str(track.nodeId, `${p}.nodeId`, true, 256);
            en(track.property, `${p}.property`, properties);
            if (typeof track.nodeId === 'string' && !nodeMap.has(track.nodeId))
                issue(`${p}.nodeId`, `Unknown node: ${track.nodeId}`);
            if (typeof track.nodeId === 'string' && typeof track.property === 'string') {
                const targets = targeted.get(track.nodeId) ?? new Set();
                if (targets.has(track.property))
                    issue(p, 'Multiple tracks target the same node property');
                targets.add(track.property);
                targeted.set(track.nodeId, targets);
            }
            if (arr(track.keyframes, `${p}.keyframes`, 1, 10000)) {
                let previous = -1;
                each(track.keyframes, (keyframe, j) => {
                    const kp = `${p}.keyframes[${j}]`;
                    if (!obj(keyframe, kp, ['time', 'value', 'easing']))
                        return;
                    if (num(keyframe.time, `${kp}.time`, 0, typeof input.duration === 'number' ? input.duration : 3600)) {
                        if (keyframe.time <= previous)
                            issue(`${kp}.time`, 'Keyframe times must be strictly increasing');
                        previous = keyframe.time;
                    }
                    const bounds = typeof track.property === 'string' && Object.hasOwn(propertyBounds, track.property) ? propertyBounds[track.property] : undefined;
                    num(keyframe.value, `${kp}.value`, bounds?.[0] ?? -1e7, bounds?.[1] ?? 1e7);
                    if (keyframe.easing !== undefined)
                        en(keyframe.easing, `${kp}.easing`, ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring']);
                });
            }
        });
    if (input.spatial !== undefined) {
        const settings = input.spatial, p = 'spatial';
        if (obj(settings, p, ['enabled', 'ambientColor', 'ambientIntensity', 'environmentIntensity', 'exposure', 'shadows', 'shadowOpacity', 'quality', 'lights'])) {
            bool(settings.enabled, `${p}.enabled`);
            str(settings.ambientColor, `${p}.ambientColor`, true, 512);
            num(settings.ambientIntensity, `${p}.ambientIntensity`, 0, 5);
            num(settings.environmentIntensity, `${p}.environmentIntensity`, 0, 5);
            num(settings.exposure, `${p}.exposure`, 0.1, 5);
            bool(settings.shadows, `${p}.shadows`);
            num(settings.shadowOpacity, `${p}.shadowOpacity`, 0, 1);
            en(settings.quality, `${p}.quality`, ['low', 'medium', 'high']);
            if (arr(settings.lights, `${p}.lights`, 0, 6))
                each(settings.lights, (light, i) => {
                    const lp = `${p}.lights[${i}]`;
                    if (!obj(light, lp, ['id', 'type', 'color', 'intensity', 'x', 'y', 'z', 'castShadow']))
                        return;
                    id(light.id, `${lp}.id`);
                    en(light.type, `${lp}.type`, ['directional', 'point']);
                    str(light.color, `${lp}.color`, true, 512);
                    num(light.intensity, `${lp}.intensity`, 0, 20);
                    num(light.x, `${lp}.x`, -32768, 32768);
                    num(light.y, `${lp}.y`, -32768, 32768);
                    num(light.z, `${lp}.z`, -4096, 8192);
                    bool(light.castShadow, `${lp}.castShadow`);
                });
        }
    }
    return issues;
}
export function assertScene(scene) {
    const issues = validateScene(scene);
    if (issues.length)
        throw new StudioError('INVALID_SCENE', issues.map(issue => `${issue.path || 'scene'}: ${issue.message}`).join('\n'), issues);
}
//# sourceMappingURL=validation.js.map