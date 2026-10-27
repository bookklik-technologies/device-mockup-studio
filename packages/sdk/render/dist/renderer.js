import { evaluateScene, StudioError } from '@bookklik/device-mockup-studio/core';
import { getDevice } from '@bookklik/device-mockup-studio/presets';
import { abortable, AssetManager, sourceSize, throwIfAborted, videoFrameSources } from './assets.js';
import { clamp, context, defaultCanvasFactory, dimensions, fitted, rounded, texturedTriangle, MAX_OUTPUT_SIDE, MAX_OUTPUT_PIXELS } from './canvas.js';
const radians = (degrees) => degrees * Math.PI / 180;
const genericFontFamilies = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong']);
/** Deterministic Canvas2D renderer. Scene x/y positions are node centers. */
export class CanvasRenderer {
    /** Feature flag used by optional spatial renderer integrations. */
    supportsSpatial = false;
    canvas;
    assets;
    deviceAssets;
    factory;
    ownsAssets;
    ownsDeviceAssets;
    disposed = false;
    pending = Promise.resolve();
    renders = new Set();
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.assets = options.assets ?? new AssetManager();
        this.deviceAssets = options.deviceAssets ?? new AssetManager();
        this.ownsDeviceAssets = !options.deviceAssets;
        this.ownsAssets = !options.assets;
        this.factory = options.canvasFactory ?? defaultCanvasFactory;
        context(canvas);
    }
    alive() { if (this.disposed)
        throw new StudioError('DISPOSED', 'CanvasRenderer has been disposed.'); }
    check(scene, time, scale) {
        this.alive();
        if (scene.spatial?.enabled || scene.nodes.some(node => node.type === 'mesh'))
            throw new StudioError('SPATIAL_RENDERER_REQUIRED', 'This scene requires SpatialRenderer from @bookklik/device-mockup-studio/spatial. CanvasRenderer does not flatten 3D content.');
        if (!Number.isFinite(scale) || scale <= 0)
            throw new StudioError('SCALE_INVALID', 'Render scale must be a positive finite number.');
        if (!Number.isFinite(time))
            throw new StudioError('TIME_INVALID', 'Frame time must be finite.');
        if (!Number.isFinite(scene.width) || !Number.isFinite(scene.height) || scene.width <= 0 || scene.height <= 0)
            throw new StudioError('OUTPUT_LIMIT', 'Scene dimensions must be positive finite numbers.');
        dimensions(Math.round(scene.width * scale), Math.round(scene.height * scale));
    }
    render(scene, time = 0, options = {}) {
        const scale = options.scale ?? 1;
        try {
            this.check(scene, time, scale);
            throwIfAborted(options.signal);
        }
        catch (error) {
            return Promise.reject(error);
        }
        let evaluated;
        try {
            evaluated = evaluateScene(scene, time);
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = new AbortController();
        const abort = () => controller.abort(options.signal?.reason);
        options.signal?.addEventListener('abort', abort, { once: true });
        this.renders.add(controller);
        // Serialize asynchronous video seeking and drawing so simultaneous exports cannot race.
        const job = this.pending.then(async () => {
            this.alive();
            throwIfAborted(controller.signal);
            await this.assets.prepareFrame(evaluated, time, controller.signal);
            await this.prepareDeviceArtwork(evaluated, controller.signal);
            await this.prepareFonts(evaluated, controller.signal);
            this.alive();
            throwIfAborted(controller.signal);
            this.draw(evaluated, time, scale, controller.signal);
        }).finally(() => { this.renders.delete(controller); options.signal?.removeEventListener('abort', abort); });
        this.pending = job.catch(() => undefined);
        return abortable(job, controller.signal);
    }
    renderSync(scene, time = 0, scale = 1) {
        this.check(scene, time, scale);
        this.draw(evaluateScene(scene, time), time, scale);
    }
    /** Await only faces used by this scene. No DOM dependency for Node/SSR callers. */
    async prepareFonts(scene, signal) {
        const owner = 'ownerDocument' in this.canvas ? this.canvas.ownerDocument : undefined;
        const fonts = owner?.fonts ?? (typeof document !== 'undefined' ? document.fonts : undefined);
        if (!fonts)
            return;
        const requests = new Map();
        for (const node of scene.nodes)
            if (node.type === 'text' && node.visible && node.opacity > 0 && node.scale > 0) {
                const family = node.fontFamily.replace(/["\\\n\r]/g, '').trim();
                const name = genericFontFamilies.has(family.toLowerCase()) ? family.toLowerCase() : `"${family}"`;
                const font = `${Math.min(1000, Math.max(100, node.fontWeight))} 16px ${name}`;
                requests.set(font, (requests.get(font) ?? '') + node.text);
            }
        await abortable(Promise.all([...requests].map(([font, sample]) => fonts.load(font, sample || 'Aa'))), signal);
    }
    /** Prepare frame artwork separately from user media so their IDs cannot collide. */
    async prepareDeviceArtwork(scene, signal) {
        const ids = new Set(scene.nodes.filter(n => n.type === 'mockup' && n.visible && n.opacity > 0 && n.scale > 0).map(n => n.deviceId));
        for (const id of ids) {
            throwIfAborted(signal);
            const device = getDevice(id), art = device.artwork;
            if (!art)
                continue;
            try {
                await abortable(this.deviceAssets.load({ id, name: device.name, kind: 'image', src: art.src, width: art.width, height: art.height }), signal);
            }
            catch (error) {
                throwIfAborted(signal);
                throw new StudioError('DEVICE_ARTWORK_LOAD', `Could not load the frame for '${device.name}'.`, error);
            }
            this.deviceArtwork(device);
        }
    }
    deviceArtwork(device) {
        const source = this.deviceAssets.get(device.id);
        if (!source)
            throw new StudioError('DEVICE_ARTWORK_NOT_READY', `Frame '${device.name}' is not loaded. Await render(), or register it in renderer.deviceAssets by device ID before renderSync().`);
        const size = sourceSize(source);
        if (size.width !== device.artwork.width || size.height !== device.artwork.height)
            throw new StudioError('DEVICE_ARTWORK_SIZE', `Frame '${device.name}' does not match its declared dimensions.`);
        return source;
    }
    scratch(width, height) {
        width = Math.max(1, Math.ceil(width));
        height = Math.max(1, Math.ceil(height));
        dimensions(width, height);
        const canvas = this.factory(width, height);
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    asset(id) {
        const source = this.assets.get(id);
        if (!source)
            throw new StudioError('ASSET_NOT_READY', `Asset '${id}' is not loaded. Use await renderer.render(), or load/register assets before renderSync().`);
        sourceSize(source);
        return source;
    }
    draw(scene, time, scale, signal) {
        // Resolve every source before clearing the last successfully rendered frame.
        if (scene.background.type === 'image')
            this.asset(scene.background.assetId);
        for (const node of scene.nodes)
            if (node.visible && node.opacity > 0 && node.type === 'mockup' && node.assetId)
                this.asset(node.assetId);
        for (const node of scene.nodes)
            if (node.visible && node.opacity > 0 && node.scale > 0 && node.type === 'mockup') {
                const d = getDevice(node.deviceId);
                if (d.artwork)
                    this.deviceArtwork(d);
            }
        videoFrameSources(scene, id => this.assets.get(id));
        this.sceneWidth = scene.width;
        this.sceneHeight = scene.height;
        this.canvas.width = Math.round(scene.width * scale);
        this.canvas.height = Math.round(scene.height * scale);
        const ctx = context(this.canvas);
        const sx = this.canvas.width / scene.width, sy = this.canvas.height / scene.height;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();
        ctx.scale(sx, sy);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        this.background(ctx, scene, time, scale);
        for (const node of scene.nodes) {
            throwIfAborted(signal);
            if (!node.visible || node.opacity <= 0 || node.scale <= 0)
                continue;
            if (![node.x, node.y, node.width, node.height, node.scale, node.rotation, node.tiltX, node.tiltY, node.opacity].every(Number.isFinite) || node.width <= 0 || node.height <= 0)
                throw new StudioError('NODE_GEOMETRY', `Node '${node.id}' has invalid geometry.`);
            this.node(ctx, node, scale);
        }
        ctx.restore();
        throwIfAborted(signal);
        this.effects(ctx, scene, time, sx, sy);
    }
    background(ctx, scene, time, scale) {
        const { width: w, height: h, background: bg } = scene;
        if (bg.type === 'transparent')
            return;
        ctx.save();
        if (bg.type === 'solid') {
            ctx.fillStyle = bg.color;
            ctx.fillRect(0, 0, w, h);
        }
        else if (bg.type === 'gradient') {
            const angle = radians(bg.angle + (bg.speed ?? 0) * time * 30);
            let gradient;
            if (bg.kind === 'radial') {
                const travel = bg.speed ? Math.min(w, h) * 0.16 : 0;
                const cx = w / 2 + Math.cos(angle) * travel, cy = h / 2 + Math.sin(angle) * travel;
                gradient = ctx.createRadialGradient(cx, cy, 0, w / 2, h / 2, Math.hypot(w, h) * 0.65);
            }
            else {
                const dx = Math.sin(angle), dy = -Math.cos(angle), extent = Math.abs(w * dx) / 2 + Math.abs(h * dy) / 2;
                gradient = ctx.createLinearGradient(w / 2 - dx * extent, h / 2 - dy * extent, w / 2 + dx * extent, h / 2 + dy * extent);
            }
            if (!bg.stops.length)
                throw new StudioError('GRADIENT_STOPS', 'A gradient requires at least one color stop.');
            for (const stop of [...bg.stops].sort((a, b) => a.offset - b.offset))
                gradient.addColorStop(clamp(stop.offset), stop.color);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
        }
        else {
            const blur = clamp(bg.blur, 0, 100), bleed = blur * 3;
            if (blur)
                ctx.filter = `blur(${blur * scale}px)`;
            fitted(ctx, this.asset(bg.assetId), -bleed, -bleed, w + bleed * 2, h + bleed * 2, bg.fit);
            ctx.filter = 'none';
            if (bg.dim > 0) {
                ctx.fillStyle = `rgba(0,0,0,${clamp(bg.dim)})`;
                ctx.fillRect(0, 0, w, h);
            }
        }
        ctx.restore();
    }
    node(ctx, node, outputScale) {
        // High-resolution textures remain bounded even when a very large node is mostly offscreen.
        const padding = node.type === 'shape' ? clamp(node.blur, 0, 100) * 3 : 0;
        const meshWidth = node.width + padding * 2, meshHeight = node.height + padding * 2;
        const textureScale = Math.min(Math.max(outputScale * node.scale, 0.25), MAX_OUTPUT_SIDE / meshWidth, MAX_OUTPUT_SIDE / meshHeight, Math.sqrt(MAX_OUTPUT_PIXELS / (meshWidth * meshHeight)));
        // Floor bounded node textures before scratch() rounds dimensions. Explicit integer
        // caps also cover floating-point drift and subpixel sides promoted to one pixel.
        const textureWidth = Math.max(1, Math.min(MAX_OUTPUT_SIDE, Math.floor(meshWidth * textureScale)));
        const textureHeight = Math.max(1, Math.min(MAX_OUTPUT_SIDE, Math.floor(meshHeight * textureScale), Math.floor(MAX_OUTPUT_PIXELS / textureWidth)));
        const texture = this.scratch(textureWidth, textureHeight);
        const tc = context(texture);
        tc.scale(texture.width / meshWidth, texture.height / meshHeight);
        tc.translate(padding, padding);
        tc.imageSmoothingEnabled = true;
        tc.imageSmoothingQuality = 'high';
        if (node.type === 'mockup')
            this.mockup(tc, node);
        else if (node.type === 'shape')
            this.shape(tc, node);
        else if (node.type === 'text')
            this.text(tc, node);
        else
            throw new StudioError('SPATIAL_RENDERER_REQUIRED', 'Mesh nodes require SpatialRenderer.');
        ctx.save();
        ctx.globalAlpha = clamp(node.opacity);
        const w = node.width, h = node.height, cx = node.x, cy = node.y;
        const ax = radians(clamp(node.tiltX, -80, 80)), ay = radians(clamp(node.tiltY, -80, 80)), az = radians(node.rotation);
        const sinX = Math.sin(ax), cosX = Math.cos(ax), sinY = Math.sin(ay), cosY = Math.cos(ay), sinZ = Math.sin(az), cosZ = Math.cos(az);
        const focal = Math.max(meshWidth, meshHeight) * 2.4;
        const project = (u, v) => {
            const x = (u - 0.5) * meshWidth, y = (v - 0.5) * meshHeight;
            const ry = y * cosX, rz = y * sinX;
            const rx = x * cosY + rz * sinY, z = -x * sinY + rz * cosY;
            const perspective = focal / (focal + z);
            return { x: cx + (rx * cosZ - ry * sinZ) * perspective * node.scale, y: cy + (rx * sinZ + ry * cosZ) * perspective * node.scale, u: u * texture.width, v: v * texture.height };
        };
        const tilted = Math.abs(node.tiltX) + Math.abs(node.tiltY) > 0.001;
        if (node.type === 'mockup' && node.shadow.opacity > 0 && (node.shadow.blur > 0 || node.shadow.offsetX || node.shadow.offsetY || node.shadow.spread)) {
            if (getDevice(node.deviceId).artwork)
                this.artworkShadow(ctx, node, texture, project, outputScale, tilted);
            else
                this.shadow(ctx, node, project, outputScale, tilted);
        }
        if (!tilted) {
            ctx.translate(cx, cy);
            ctx.rotate(az);
            ctx.scale(node.scale, node.scale);
            ctx.drawImage(texture, -meshWidth / 2, -meshHeight / 2, meshWidth, meshHeight);
        }
        else {
            // A tessellated projective surface, not a scaled/squashed image. Interior grid vertices
            // carry independent projective UVs and each triangle gets its own affine transform.
            const divisions = 14;
            const grid = [];
            for (let y = 0; y <= divisions; y++) {
                const row = [];
                for (let x = 0; x <= divisions; x++)
                    row.push(project(x / divisions, y / divisions));
                grid.push(row);
            }
            // Composite triangles on one layer; avoids repeated node opacity at shared seams.
            const layer = this.scratch(this.canvas.width, this.canvas.height), lc = context(layer);
            lc.globalCompositeOperation = 'source-over';
            lc.scale(this.canvas.width / this.lastSceneWidth(), this.canvas.height / this.lastSceneHeight());
            for (let y = 0; y < divisions; y++)
                for (let x = 0; x < divisions; x++) {
                    const a = grid[y][x], b = grid[y][x + 1], c = grid[y + 1][x + 1], d = grid[y + 1][x];
                    texturedTriangle(lc, texture, a, b, c, 0.85 / outputScale);
                    texturedTriangle(lc, texture, a, c, d, 0.85 / outputScale);
                }
            ctx.drawImage(layer, 0, 0, this.lastSceneWidth(), this.lastSceneHeight());
            layer.width = 1;
            layer.height = 1;
        }
        ctx.restore();
        texture.width = 1;
        texture.height = 1;
    }
    sceneWidth = 1;
    sceneHeight = 1;
    lastSceneWidth() { return this.sceneWidth; }
    lastSceneHeight() { return this.sceneHeight; }
    shadow(ctx, node, project, scale, tilted) {
        const s = node.shadow;
        ctx.save();
        ctx.globalAlpha *= clamp(s.opacity);
        ctx.shadowColor = s.color;
        ctx.shadowBlur = clamp(s.blur, 0, 300) * scale * node.scale;
        ctx.shadowOffsetX = s.offsetX * scale;
        ctx.shadowOffsetY = s.offsetY * scale;
        ctx.fillStyle = s.color;
        const spread = clamp(s.spread, -Math.min(node.width, node.height) / 3, 200);
        const spreadX = spread / node.width, spreadY = spread / node.height;
        if (tilted) {
            const rx = clamp(node.radius / node.width, 0, .5), ry = clamp(node.radius / node.height, 0, .5);
            ctx.beginPath();
            let first = true;
            for (let corner = 0; corner < 4; corner++) {
                const centers = [[1 - rx + spreadX, ry - spreadY], [1 - rx + spreadX, 1 - ry + spreadY], [rx - spreadX, 1 - ry + spreadY], [rx - spreadX, ry - spreadY]];
                for (let step = 0; step <= 6; step++) {
                    const angle = -Math.PI / 2 + corner * Math.PI / 2 + step * Math.PI / 12;
                    const center = centers[corner];
                    const p = project(center[0] + Math.cos(angle) * rx, center[1] + Math.sin(angle) * ry);
                    if (first) {
                        ctx.moveTo(p.x, p.y);
                        first = false;
                    }
                    else
                        ctx.lineTo(p.x, p.y);
                }
            }
            ctx.closePath();
            ctx.fill();
        }
        else {
            ctx.translate(node.x, node.y);
            ctx.rotate(radians(node.rotation));
            ctx.scale(node.scale, node.scale);
            rounded(ctx, -node.width / 2 - spread, -node.height / 2 - spread, node.width + 2 * spread, node.height + 2 * spread, node.radius + spread);
            ctx.fill();
        }
        ctx.restore();
    }
    artworkShadow(ctx, node, texture, project, scale, tilted) {
        const layer = this.scratch(this.canvas.width, this.canvas.height), lc = context(layer), s = node.shadow;
        lc.scale(layer.width / this.sceneWidth, layer.height / this.sceneHeight);
        const spread = clamp(s.spread, -Math.min(node.width, node.height) / 3, 200);
        if (!tilted) {
            lc.save();
            lc.translate(node.x, node.y);
            lc.rotate(radians(node.rotation));
            lc.scale(node.scale, node.scale);
            lc.drawImage(texture, -node.width / 2 - spread, -node.height / 2 - spread, node.width + spread * 2, node.height + spread * 2);
            lc.restore();
        }
        else {
            const point = (u, v) => ({ ...project(.5 + (u - .5) * (1 + 2 * spread / node.width), .5 + (v - .5) * (1 + 2 * spread / node.height)), u: u * texture.width, v: v * texture.height });
            for (let y = 0; y < 14; y++)
                for (let x = 0; x < 14; x++) {
                    const a = point(x / 14, y / 14), b = point((x + 1) / 14, y / 14), c = point((x + 1) / 14, (y + 1) / 14), d = point(x / 14, (y + 1) / 14);
                    texturedTriangle(lc, texture, a, b, c, .85 / scale);
                    texturedTriangle(lc, texture, a, c, d, .85 / scale);
                }
        }
        lc.globalCompositeOperation = 'source-in';
        lc.fillStyle = s.color;
        lc.fillRect(0, 0, this.sceneWidth, this.sceneHeight);
        ctx.save();
        ctx.globalAlpha *= clamp(s.opacity);
        ctx.filter = `blur(${clamp(s.blur, 0, 300) * scale * node.scale}px)`;
        ctx.drawImage(layer, s.offsetX, s.offsetY, this.sceneWidth, this.sceneHeight);
        ctx.restore();
        layer.width = layer.height = 1;
    }
    mockup(ctx, node) {
        const device = getDevice(node.deviceId);
        if (device.artwork) {
            this.photographicMockup(ctx, node, device);
            return;
        }
        if (!device)
            throw new StudioError('DEVICE_MISSING', `Unknown device '${node.deviceId}'.`);
        const w = node.width, h = node.height;
        const unit = Math.min(w, h);
        let { left: l, right: r, top: t, bottom: b } = device.inset;
        const glass = node.style.startsWith('glass') || node.style === 'liquid-glass';
        const light = node.style === 'glass-light' || node.style === 'inset-light';
        const insetStyle = node.style.startsWith('inset');
        const stylePad = glass ? unit * 0.025 : insetStyle ? unit * 0.018 : node.style === 'border' ? node.borderWidth : node.style === 'outline' ? Math.max(1, node.borderWidth) : 0;
        l += stylePad;
        r += stylePad;
        t += stylePad;
        b += stylePad;
        // Invalid external devices must never generate negative drawImage rectangles.
        l = clamp(l, 0, w * 0.44);
        r = clamp(r, 0, w * 0.44);
        t = clamp(t, 0, h * 0.44);
        b = clamp(b, 0, h * 0.44);
        const x = l, y = t, sw = w - l - r, sh = h - t - b;
        const nativeRadius = device.radius;
        const radius = clamp(node.radius >= 0 ? node.radius : nativeRadius, 0, unit / 2);
        const screenNative = device.screenRadius;
        const screenRadius = clamp(device.category === 'screenshot' ? radius - stylePad : screenNative, 0, Math.min(sw, sh) / 2);
        const bodyH = device.chrome === 'stand' ? y + sh + (h - y - sh) * .23 : h;
        ctx.save();
        rounded(ctx, 0.7, 0.7, w - 1.4, h - 1.4, radius);
        ctx.clip();
        let frame = node.frameColor;
        if (glass) {
            frame = ctx.createLinearGradient(0, 0, w, h);
            frame.addColorStop(0, light ? '#f9fdff' : '#75808f');
            frame.addColorStop(0.4, light ? '#cbd8e4' : '#252c39');
            frame.addColorStop(1, light ? '#edf5fc' : '#10131b');
        }
        else if (insetStyle)
            frame = light ? '#e9edf4' : '#151923';
        else if (node.style === 'outline')
            frame = node.borderColor;
        ctx.fillStyle = frame;
        rounded(ctx, 0, 0, w, bodyH, radius);
        ctx.fill();
        // A procedural frame edge gives depth without borrowing photographic device artwork.
        if (device.category !== 'screenshot') {
            const edge = ctx.createLinearGradient(0, 0, w, h);
            edge.addColorStop(0, 'rgba(255,255,255,.48)');
            edge.addColorStop(.4, 'rgba(255,255,255,.03)');
            edge.addColorStop(1, 'rgba(0,0,0,.55)');
            rounded(ctx, 1.2, 1.2, w - 2.4, bodyH - 2.4, radius);
            ctx.strokeStyle = edge;
            ctx.lineWidth = Math.max(1, unit * .004);
            ctx.stroke();
        }
        ctx.save();
        rounded(ctx, x, y, sw, sh, screenRadius);
        ctx.clip();
        ctx.fillStyle = device.category === 'screenshot' ? node.frameColor : '#0c1018';
        ctx.fillRect(x, y, sw, sh);
        if (node.assetId)
            fitted(ctx, this.asset(node.assetId), x, y, sw, sh, node.fit, node.focalX, node.focalY);
        else {
            const empty = ctx.createLinearGradient(x, y, x + sw, y + sh);
            empty.addColorStop(0, '#f0f3fc');
            empty.addColorStop(1, '#c7d5ee');
            ctx.fillStyle = empty;
            ctx.fillRect(x, y, sw, sh);
        }
        if (insetStyle) {
            const inner = ctx.createLinearGradient(x, y, x, y + Math.min(sh * .12, 35));
            inner.addColorStop(0, light ? 'rgba(20,32,58,.35)' : 'rgba(0,0,0,.7)');
            inner.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = inner;
            ctx.fillRect(x, y, sw, Math.min(sh * .12, 35));
        }
        if (node.lighting > 0) {
            const shine = ctx.createLinearGradient(x, y, x + sw * .8, y + sh);
            shine.addColorStop(0, `rgba(255,255,255,${clamp(node.lighting) * .22})`);
            shine.addColorStop(.48, 'rgba(255,255,255,0)');
            shine.addColorStop(1, `rgba(0,0,0,${clamp(node.lighting) * .12})`);
            ctx.fillStyle = shine;
            ctx.fillRect(x, y, sw, sh);
        }
        ctx.restore();
        this.chrome(ctx, device, w, h, x, y, sw, sh, node);
        if (glass) {
            const rim = ctx.createLinearGradient(0, 0, w, h);
            rim.addColorStop(0, 'rgba(255,255,255,.95)');
            rim.addColorStop(.48, 'rgba(255,255,255,.1)');
            rim.addColorStop(1, 'rgba(255,255,255,.7)');
            rounded(ctx, 1.5, 1.5, w - 3, bodyH - 3, radius);
            ctx.strokeStyle = rim;
            ctx.lineWidth = node.style === 'liquid-glass' ? Math.max(3, unit * .012) : 1.5;
            ctx.stroke();
            if (node.style === 'liquid-glass') {
                rounded(ctx, 5, 5, w - 10, bodyH - 10, Math.max(0, radius - 4));
                ctx.strokeStyle = 'rgba(255,255,255,.18)';
                ctx.lineWidth = 2;
                ctx.stroke();
                const bloom = ctx.createLinearGradient(0, 0, w * .6, h);
                bloom.addColorStop(0, 'rgba(255,255,255,.18)');
                bloom.addColorStop(.35, 'rgba(255,255,255,0)');
                bloom.addColorStop(1, 'rgba(143,204,255,.06)');
                ctx.fillStyle = bloom;
                rounded(ctx, 0, 0, w, bodyH, radius);
                ctx.fill();
            }
        }
        if (node.borderWidth > 0 && node.style !== 'outline') {
            const bw = clamp(node.borderWidth, 0, unit / 4);
            rounded(ctx, bw / 2, bw / 2, w - bw, bodyH - bw, radius);
            ctx.lineWidth = bw;
            ctx.strokeStyle = node.borderColor;
            ctx.stroke();
        }
        if (node.lighting > 0) {
            rounded(ctx, 1, 1, w - 2, bodyH - 2, radius);
            const edge = ctx.createLinearGradient(0, 0, w, h);
            edge.addColorStop(0, `rgba(255,255,255,${clamp(node.lighting) * .85})`);
            edge.addColorStop(.5, 'rgba(255,255,255,0)');
            edge.addColorStop(1, `rgba(0,0,0,${clamp(node.lighting) * .4})`);
            ctx.strokeStyle = edge;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.restore();
    }
    photographicMockup(ctx, node, device) {
        const art = device.artwork, source = this.deviceArtwork(device), s = art.screen, rotated = art.orientation !== 0;
        const aw = rotated ? art.height : art.width, ah = rotated ? art.width : art.height;
        const x = art.orientation === 90 ? art.height - s.y - s.height : art.orientation === 270 ? s.y : s.x;
        const y = art.orientation === 90 ? s.x : art.orientation === 270 ? art.width - s.x - s.width : s.y;
        const sw = rotated ? s.height : s.width, sh = rotated ? s.width : s.height;
        ctx.save();
        ctx.scale(node.width / aw, node.height / ah);
        ctx.save();
        rounded(ctx, x, y, sw, sh, s.radius);
        ctx.clip();
        ctx.fillStyle = '#0c1018';
        ctx.fillRect(x, y, sw, sh);
        if (node.assetId)
            fitted(ctx, this.asset(node.assetId), x, y, sw, sh, node.fit, node.focalX, node.focalY);
        else {
            const empty = ctx.createLinearGradient(x, y, x + sw, y + sh);
            empty.addColorStop(0, '#f0f3fc');
            empty.addColorStop(1, '#c7d5ee');
            ctx.fillStyle = empty;
            ctx.fillRect(x, y, sw, sh);
        }
        if (node.lighting > 0) {
            const shine = ctx.createLinearGradient(x, y, x + sw, y + sh);
            shine.addColorStop(0, `rgba(255,255,255,${clamp(node.lighting) * .22})`);
            shine.addColorStop(.5, 'rgba(255,255,255,0)');
            shine.addColorStop(1, `rgba(0,0,0,${clamp(node.lighting) * .12})`);
            ctx.fillStyle = shine;
            ctx.fillRect(x, y, sw, sh);
        }
        ctx.restore();
        if (art.orientation === 90) {
            ctx.translate(art.height, 0);
            ctx.rotate(Math.PI / 2);
        }
        else if (art.orientation === 270) {
            ctx.translate(0, art.width);
            ctx.rotate(-Math.PI / 2);
        }
        ctx.drawImage(source, 0, 0, art.width, art.height);
        ctx.restore();
    }
    chrome(ctx, device, w, h, x, y, sw, sh, node) {
        const unit = Math.min(w, h);
        if (device.chrome === 'browser') {
            const bar = Math.max(0, y), centerY = bar / 2, rr = Math.min(bar * .13, w * .009);
            ['#ff6b70', '#ffc560', '#62d49b'].forEach((color, index) => { ctx.beginPath(); ctx.arc(x + rr * (2 + index * 3.2), centerY, Math.max(.5, rr), 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); });
            if (bar > 9) {
                rounded(ctx, w * .28, bar * .25, w * .44, bar * .5, bar * .13);
                ctx.fillStyle = 'rgba(128,140,160,.16)';
                ctx.fill();
                ctx.fillStyle = node.style === 'glass-light' ? '#69788f' : '#a0a9b8';
                ctx.font = `${Math.max(6, bar * .24)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('your-website.com', w / 2, centerY, w * .4);
            }
            ctx.beginPath();
            ctx.moveTo(x, y - .5);
            ctx.lineTo(x + sw, y - .5);
            ctx.strokeStyle = 'rgba(128,140,160,.2)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        if (device.camera) {
            const cameraY = Math.max(y * .5, y + unit * .022);
            if (device.camera === 'pill') {
                rounded(ctx, w / 2 - sw * .13, cameraY - unit * .012, sw * .26, unit * .036, unit * .018);
                ctx.fillStyle = '#07090e';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(w / 2 + sw * .075, cameraY + unit * .006, unit * .006, 0, Math.PI * 2);
                ctx.fillStyle = '#13243b';
                ctx.fill();
            }
            else {
                ctx.beginPath();
                ctx.arc(w / 2, cameraY, Math.max(1.2, unit * .012), 0, Math.PI * 2);
                ctx.fillStyle = '#060a12';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(w / 2 + .5, cameraY - .5, unit * .004, 0, Math.PI * 2);
                ctx.fillStyle = '#26466c';
                ctx.fill();
            }
            if (device.category === 'phone') {
                rounded(ctx, w * .36, y + sh - unit * .026, w * .28, Math.max(2, unit * .009), 4);
                ctx.fillStyle = 'rgba(255,255,255,.65)';
                ctx.fill();
            }
        }
        if (device.chrome === 'keyboard') {
            const top = y + sh + (h - y - sh) * .22;
            ctx.fillStyle = 'rgba(0,0,0,.3)';
            rounded(ctx, w * .035, top, w * .93, Math.max(2, (h - top) * .28), unit * .007);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,.24)';
            ctx.lineWidth = .7;
            for (let i = 1; i < 16; i++) {
                ctx.beginPath();
                ctx.moveTo(w * (.035 + .93 * i / 16), top);
                ctx.lineTo(w * (.035 + .93 * i / 16), top + (h - top) * .28);
                ctx.stroke();
            }
            rounded(ctx, w * .39, top + (h - top) * .42, w * .22, Math.max(2, (h - top) * .35), 3);
            ctx.fillStyle = 'rgba(255,255,255,.12)';
            ctx.fill();
        }
        if (device.chrome === 'stand') {
            const top = y + sh, available = h - top;
            ctx.fillStyle = '#10141d';
            ctx.fillRect(x, top, sw, available * .23);
            const metal = ctx.createLinearGradient(w * .4, 0, w * .6, 0);
            metal.addColorStop(0, '#6b7587');
            metal.addColorStop(.45, '#d4dce6');
            metal.addColorStop(1, '#687183');
            ctx.fillStyle = metal;
            ctx.beginPath();
            ctx.moveTo(w * .46, top + available * .23);
            ctx.lineTo(w * .54, top + available * .23);
            ctx.lineTo(w * .59, h - available * .12);
            ctx.lineTo(w * .41, h - available * .12);
            ctx.closePath();
            ctx.fill();
            rounded(ctx, w * .31, h - available * .13, w * .38, available * .07, 3);
            ctx.fill();
        }
    }
    shape(ctx, node) {
        const w = node.width, h = node.height;
        ctx.save();
        if (node.blur > 0)
            ctx.filter = `blur(${clamp(node.blur, 0, 100) * ctx.getTransform().a}px)`;
        const stroke = node.shape === 'ring' ? node.strokeWidth || Math.min(w, h) * .1 : Math.max(0, node.strokeWidth);
        const half = stroke / 2;
        ctx.beginPath();
        if (node.shape === 'rectangle')
            rounded(ctx, half, half, Math.max(0, w - 2 * half), Math.max(0, h - 2 * half), node.radius);
        else
            ctx.ellipse(w / 2, h / 2, Math.max(.01, w / 2 - half), Math.max(.01, h / 2 - half), 0, 0, Math.PI * 2);
        if (node.shape !== 'ring') {
            ctx.fillStyle = node.fill;
            ctx.fill();
        }
        if (node.strokeWidth > 0 || node.shape === 'ring') {
            ctx.strokeStyle = node.stroke;
            ctx.lineWidth = stroke;
            ctx.stroke();
        }
        ctx.restore();
    }
    text(ctx, node) {
        ctx.save();
        ctx.fillStyle = node.color;
        ctx.textAlign = node.align;
        ctx.textBaseline = 'top';
        const size = clamp(node.fontSize, 1, 2000);
        // Generic families must stay unquoted; quoting turns them into literal font names.
        // Quote named families so whitespace and punctuation cannot become CSS syntax.
        const family = node.fontFamily.replace(/["\\\n\r]/g, '').trim();
        const familyValue = genericFontFamilies.has(family.toLowerCase()) ? family.toLowerCase() : `"${family}"`;
        ctx.font = `${clamp(node.fontWeight, 100, 1000)} ${size}px ${familyValue}, sans-serif`;
        const lineHeight = size * 1.22, lines = [];
        for (const paragraph of node.text.split('\n')) {
            if (!paragraph) {
                lines.push('');
                continue;
            }
            let line = '';
            for (const word of paragraph.split(/\s+/)) {
                const candidate = line ? `${line} ${word}` : word;
                if (ctx.measureText(candidate).width <= node.width) {
                    line = candidate;
                    continue;
                }
                if (line) {
                    lines.push(line);
                    line = '';
                }
                if (ctx.measureText(word).width <= node.width)
                    line = word;
                else
                    for (const char of word) {
                        if (line && ctx.measureText(line + char).width > node.width) {
                            lines.push(line);
                            line = '';
                        }
                        line += char;
                    }
            }
            lines.push(line);
        }
        const x = node.align === 'center' ? node.width / 2 : node.align === 'right' ? node.width : 0;
        ctx.beginPath();
        ctx.rect(0, 0, node.width, node.height);
        ctx.clip();
        lines.forEach((line, index) => { if (index * lineHeight < node.height)
            ctx.fillText(line, x, index * lineHeight, node.width); });
        ctx.restore();
    }
    /** Finish pixels produced by a renderer extension using the same deterministic effects. */
    applyEffects(scene, time = 0) {
        this.alive();
        if (!Number.isFinite(time))
            throw new StudioError('TIME_INVALID', 'Effect time must be finite.');
        dimensions(this.canvas.width, this.canvas.height);
        if (![scene.width, scene.height].every(n => Number.isFinite(n) && n > 0))
            throw new StudioError('OUTPUT_LIMIT', 'Scene dimensions must be finite and positive.');
        this.effects(context(this.canvas), scene, time, this.canvas.width / scene.width, this.canvas.height / scene.height);
    }
    effects(ctx, scene, time, sx, sy) {
        const e = scene.effects;
        if (!e.noise && !e.vignette && !e.scanlines && !e.glitch && e.saturation === 1 && e.contrast === 1 && e.brightness === 1)
            return;
        const w = this.canvas.width, h = this.canvas.height;
        let image;
        try {
            image = ctx.getImageData(0, 0, w, h);
        }
        catch (error) {
            throw new StudioError('CANVAS_READ', 'Pixel effects could not read the canvas. Ensure every remote image permits CORS.', error);
        }
        const data = image.data;
        let seed = ((scene.seed | 0) ^ Math.imul(Math.floor(time * scene.fps), 0x9e3779b9)) >>> 0;
        const random = () => { seed += 0x6D2B79F5; let v = Math.imul(seed ^ seed >>> 15, 1 | seed); v ^= v + Math.imul(v ^ v >>> 7, 61 | v); return ((v ^ v >>> 14) >>> 0) / 4294967296; };
        const noise = clamp(e.noise) * 65, vignette = clamp(e.vignette), saturation = clamp(e.saturation, 0, 4), contrast = clamp(e.contrast, 0, 4), brightness = clamp(e.brightness, 0, 4), scanlines = clamp(e.scanlines);
        if (e.glitch > 0) {
            const original = new Uint8ClampedArray(data), strength = clamp(e.glitch);
            for (let y = 0; y < h; y++) {
                const band = Math.floor(y / Math.max(1, 9 * sy));
                // Coordinate-hashed bands, not timing-dependent state.
                const hash = Math.sin(band * 127.1 + scene.seed * 31.7 + Math.floor(time * scene.fps) * 17.3) * 43758.5453;
                const r = hash - Math.floor(hash);
                if (r > strength * .3)
                    continue;
                const offset = Math.round((r * 2 / Math.max(.001, strength * .3) - 1) * strength * 35 * sx);
                for (let x = 0; x < w; x++) {
                    const fromX = ((x + offset) % w + w) % w, to = (y * w + x) * 4, from = (y * w + fromX) * 4;
                    data[to] = original[from];
                    data[to + 1] = original[from + 1];
                    data[to + 2] = original[from + 2];
                    data[to + 3] = original[from + 3];
                }
            }
        }
        for (let y = 0; y < h; y++) {
            const yy = (y / h - .5) * 2;
            const scan = Math.floor(y / sy) % 3 === 0 ? 1 - scanlines * .35 : 1;
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                if (!data[i + 3])
                    continue;
                const xx = (x / w - .5) * 2, vig = (1 - vignette * clamp((xx * xx + yy * yy) * .54)) * scan;
                const n = noise ? (random() - .5) * noise : 0;
                const rr = data[i], gg = data[i + 1], bb = data[i + 2], luma = rr * .2126 + gg * .7152 + bb * .0722;
                data[i] = (((luma + (rr - luma) * saturation - 127.5) * contrast + 127.5) * brightness + n) * vig;
                data[i + 1] = (((luma + (gg - luma) * saturation - 127.5) * contrast + 127.5) * brightness + n) * vig;
                data[i + 2] = (((luma + (bb - luma) * saturation - 127.5) * contrast + 127.5) * brightness + n) * vig;
            }
        }
        ctx.putImageData(image, 0, 0);
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        for (const render of this.renders)
            render.abort(new StudioError('DISPOSED', 'Renderer disposed during rendering.'));
        this.renders.clear();
        if (this.ownsAssets)
            this.assets.dispose();
        if (this.ownsDeviceAssets)
            this.deviceAssets.dispose();
    }
}
//# sourceMappingURL=renderer.js.map