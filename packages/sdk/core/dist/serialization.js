import { StudioError } from './types.js';
import { assertScene } from './validation.js';
import { copy } from './utils.js';
export function cloneScene(scene) { assertScene(scene); return copy(scene); }
export function serializeScene(scene) { assertScene(scene); return JSON.stringify(scene, null, 2); }
/** Version 1 is the only supported format. Never silently reinterpret future or unversioned projects. */
export function deserializeScene(json) {
    // Check the untrusted string length before JSON.parse can allocate its object graph.
    if (json.length > 150 * 1024 * 1024)
        throw new StudioError('INPUT_LIMIT', 'Project JSON exceeds the maximum size (150 MiB characters).');
    let parsed;
    try {
        parsed = JSON.parse(json);
    }
    catch (cause) {
        throw new StudioError('INVALID_JSON', 'Project is not valid JSON.', cause);
    }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && parsed.version !== 1)
        throw new StudioError('UNSUPPORTED_VERSION', `Unsupported scene version: ${String(parsed.version)}. Only version 1 is supported.`);
    assertScene(parsed);
    return copy(parsed);
}
//# sourceMappingURL=serialization.js.map