import { nodeCorners } from './helpers.js';
/** Same projected geometry as selection, without shadows or blur. */
export function nodeBounds(node, spatial = node.type === 'mesh') {
    const points = nodeCorners(node, spatial);
    return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
}
export function snapTargets(scene, movingId) {
    const spatial = !!scene.spatial?.enabled || scene.nodes.some(n => n.type === 'mesh');
    return [{ id: 'canvas', bounds: { left: 0, right: scene.width, top: 0, bottom: scene.height } },
        ...scene.nodes.filter(n => n.id !== movingId && n.visible && n.opacity > 0).map(n => ({ id: `node:${n.id}`, bounds: nodeBounds(n, spatial) }))];
}
function anchors(b, axis) {
    return axis === 'x' ? [b.left, (b.left + b.right) / 2, b.right] : [b.top, (b.top + b.bottom) / 2, b.bottom];
}
export function alignmentDelta(bounds, canvas, align) {
    switch (align) {
        case 'left': return { x: -bounds.left, y: 0 };
        case 'center-x': return { x: canvas.width / 2 - (bounds.left + bounds.right) / 2, y: 0 };
        case 'right': return { x: canvas.width - bounds.right, y: 0 };
        case 'top': return { x: 0, y: -bounds.top };
        case 'center-y': return { x: 0, y: canvas.height / 2 - (bounds.top + bounds.bottom) / 2 };
        case 'bottom': return { x: 0, y: canvas.height - bounds.bottom };
    }
}
export function constrainMovement(delta, shift, axis) {
    if (!shift)
        return { delta };
    const locked = axis ?? (Math.abs(delta.x) >= Math.abs(delta.y) ? 'x' : 'y');
    return { delta: { x: locked === 'x' ? delta.x : 0, y: locked === 'y' ? delta.y : 0 }, axis: locked };
}
/** Input bounds are unsnapped. Thresholds are CSS pixels, independent of zoom. */
export function snapBounds(bounds, targets, pixelsPerUnit, previous = {}, options = {}) {
    const delta = { x: 0, y: 0 }, state = {}, guides = [];
    if (options.bypass)
        return { delta, state, guides };
    for (const axis of ['x', 'y']) {
        if (options.axis && options.axis !== axis)
            continue;
        const source = anchors(bounds, axis), scale = Math.max(1e-9, pixelsPerUnit[axis]);
        let match, distance = Infinity;
        const old = previous[axis];
        if (old && targets.some(t => t.id === old.target && anchors(t.bounds, axis).includes(old.value)) && Math.abs(old.value - source[old.anchor]) * scale <= 10)
            match = old;
        if (!match)
            for (const target of targets)
                for (const value of anchors(target.bounds, axis))
                    for (let anchor = 0; anchor < 3; anchor++) {
                        const d = Math.abs(value - source[anchor]) * scale;
                        // Canvas wins exact ties; iteration order resolves remaining ties stably.
                        if (d <= 6 && (d < distance - 1e-9 || (Math.abs(d - distance) <= 1e-9 && target.id === 'canvas' && match?.target !== 'canvas'))) {
                            match = { target: target.id, anchor, value };
                            distance = d;
                        }
                    }
        if (!match)
            continue;
        state[axis] = match;
        delta[axis] = match.value - source[match.anchor];
        const target = targets.find(t => t.id === match.target).bounds;
        guides.push({ axis, value: match.value, from: Math.min(axis === 'x' ? bounds.top : bounds.left, axis === 'x' ? target.top : target.left), to: Math.max(axis === 'x' ? bounds.bottom : bounds.right, axis === 'x' ? target.bottom : target.right) });
    }
    // Extend guides to the final position when both axes snap.
    for (const guide of guides) {
        const offset = guide.axis === 'x' ? delta.y : delta.x;
        guide.from = Math.min(guide.from, (guide.axis === 'x' ? bounds.top : bounds.left) + offset);
        guide.to = Math.max(guide.to, (guide.axis === 'x' ? bounds.bottom : bounds.right) + offset);
    }
    return { delta, state, guides };
}
//# sourceMappingURL=alignment.js.map