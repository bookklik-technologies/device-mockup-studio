import { ACESFilmicToneMapping, AddEquation, AmbientLight, Box3, CanvasTexture, Color, CustomBlending, DirectionalLight, DoubleSide, Group, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, OneFactor, OneMinusSrcAlphaFactor, OrthographicCamera, PCFSoftShadowMap, PlaneGeometry, PMREMGenerator, PointLight, Scene, ShadowMaterial, SrcAlphaFactor, SRGBColorSpace, WebGLRenderer, } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { resolveMockupGlassMaterial, createSpatialSettings, evaluateScene, StudioError, } from '@bookklik/device-mockup-studio/core';
import { getDevice } from '@bookklik/device-mockup-studio/presets';
import { CanvasRenderer } from '@bookklik/device-mockup-studio/render';
import { createGlassRingGeometry, createMeshGeometry, meshGeometryKey } from './geometry.js';
export const SPATIAL_LIMITS = Object.freeze({ outputSide: 4096, outputPixels: 16_000_000, textureSide: 2048, texturePixels: 16_000_000, volumes: 32, texturedNodes: 256 });
const NO_EFFECTS = { noise: 0, vignette: 0, saturation: 1, contrast: 1, brightness: 1, scanlines: 0, glitch: 0 };
const rad = (n) => n * Math.PI / 180;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const context2D = (canvas) => {
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new StudioError('CANVAS_CONTEXT', 'A Canvas2D context is required for spatial compositing.');
    return ctx;
};
function cancelled(signal) {
    if (signal?.aborted) {
        // Preserve useful disposal/context-loss errors rather than disguising them as a user cancellation.
        if (signal.reason instanceof StudioError && ['DISPOSED', 'SPATIAL_CONTEXT_LOST'].includes(signal.reason.code))
            throw signal.reason;
        throw new StudioError('ABORTED', 'Spatial rendering was cancelled.', signal.reason);
    }
}
function abortable(promise, signal) {
    return new Promise((resolve, reject) => {
        const abort = () => { cleanup(); try {
            cancelled(signal);
        }
        catch (error) {
            reject(error);
        } };
        const cleanup = () => signal.removeEventListener('abort', abort);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted)
            abort();
        promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    });
}
function newCanvas(width, height) {
    // Deliberately inside a function: importing this optional package is safe in Node.
    if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    if (typeof OffscreenCanvas !== 'undefined')
        return new OffscreenCanvas(width, height);
    throw new StudioError('SPATIAL_WEBGL2_REQUIRED', 'Spatial rendering requires a browser/worker with WebGL2. Legacy scenes still support a supplied Node Canvas2D factory.');
}
function webglContext(canvas) {
    try {
        return canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    }
    catch {
        return null;
    }
}
/** Explicit runtime probe. Allocates and immediately releases a temporary context;
 * it is never called on import or by a legacy Canvas2D render. */
export function getSpatialCapabilities() {
    let canvas;
    try {
        canvas = newCanvas(1, 1);
        const gl = webglContext(canvas);
        if (!gl)
            return { webgl2: false, maxTextureSize: 0, reason: 'WebGL2 is unavailable or disabled.' };
        const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return { webgl2: true, maxTextureSize };
    }
    catch (error) {
        return { webgl2: false, maxTextureSize: 0, reason: error instanceof Error ? error.message : 'WebGL2 is unavailable.' };
    }
    finally {
        if (canvas) {
            canvas.width = 1;
            canvas.height = 1;
        }
    }
}
/** Optional raster-PBR compositor. Owns ONE lazy WebGL2 canvas, while the inherited
 * public canvas stays Canvas2D for export/preview APIs and uses the same AssetManager.
 *
 * This is real volume/transmission rendering, NOT ray tracing: Three's transmission
 * buffer refracts opaque scene contents, not other transmissive surfaces. It cannot
 * produce recursive/multi-glass refraction or caustics. Glass casts uncolored shadow
 * maps, not colored absorption shadows. Flat raster planes are unlit sRGB artwork;
 * PBR exposure/light changes affect volumes, not the typography/media. Alpha artwork
 * uses an opaque-pass alpha blend so it participates in refraction; intersecting
 * semitransparent planes have the usual depth-order limitations. A transparent scene
 * background provides no opaque pixels to refract (use a solid/grid behind glass).
 *
 * At most 32 physical volumes (mesh nodes plus glass mockup rims), 256 raster nodes,
 * 2048px per node/background texture and 16MP combined GPU canvas textures. Texture
 * resolution is adaptively shared across nodes. One reusable raster workspace and
 * CanvasRenderer's temporary node surface may each use another <=4MP of CPU canvas.
 */
export class SpatialRenderer extends CanvasRenderer {
    supportsSpatial = true;
    spatialFactory;
    spatialDisposed = false;
    spatialPending = Promise.resolve();
    spatialControllers = new Set();
    queued = 0;
    mode = 'unrendered';
    gpu;
    gpuCanvas;
    gpuLost = false;
    contextsCreated = 0;
    gpuMaximum = 0;
    environment;
    environmentDirty = false;
    geometries = new Map();
    physicalMaterials = new Map();
    textures = new Map();
    plane;
    raster;
    rasterCanvas;
    frameScene;
    spatialCamera;
    frameMaterials = [];
    volumes = 0;
    planes = 0;
    constructor(canvas, options = {}) {
        super(canvas, options);
        this.spatialFactory = options.canvasFactory ?? newCanvas;
    }
    spatialAlive() { if (this.spatialDisposed)
        throw new StudioError('DISPOSED', 'SpatialRenderer has been disposed.'); }
    isSpatial(scene) { return !!scene.spatial?.enabled || scene.nodes.some(node => node.type === 'mesh'); }
    render(scene, time = 0, options = {}) {
        let snapshot;
        const scale = options.scale ?? 1;
        try {
            this.spatialAlive();
            cancelled(options.signal);
            if (!Number.isFinite(time))
                throw new StudioError('TIME_INVALID', 'Frame time must be finite.');
            if (!Number.isFinite(scale) || scale <= 0)
                throw new StudioError('SCALE_INVALID', 'Render scale must be positive and finite.');
            // Validate and snapshot NOW, not after queued asset loading. Shared evaluator is
            // the sole animation implementation for preview, still and deterministic exports.
            snapshot = evaluateScene(scene, time);
            if (this.isSpatial(snapshot))
                this.preflight(snapshot, scale);
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = new AbortController();
        const abort = () => controller.abort(options.signal?.reason);
        options.signal?.addEventListener('abort', abort, { once: true });
        if (options.signal?.aborted)
            abort();
        this.spatialControllers.add(controller);
        this.queued++;
        const job = this.spatialPending.then(async () => {
            this.spatialAlive();
            cancelled(controller.signal);
            if (!this.isSpatial(snapshot)) {
                // Do not initialize GPU resources or change legacy render algorithms/assets.
                await super.render(snapshot, time, { scale, signal: controller.signal });
                this.mode = 'legacy';
                return;
            }
            await this.assets.prepareFrame(snapshot, time, controller.signal);
            await this.prepareDeviceArtwork(snapshot, controller.signal);
            await this.prepareFonts(snapshot, controller.signal);
            this.spatialAlive();
            cancelled(controller.signal);
            this.ensureGPU();
            this.checkGPU();
            this.preflight(snapshot, scale, this.gpuMaximum);
            this.renderSpatial(snapshot, time, scale, controller.signal);
        }).finally(() => {
            this.queued--;
            this.spatialControllers.delete(controller);
            options.signal?.removeEventListener('abort', abort);
        });
        this.spatialPending = job.catch(() => undefined);
        return abortable(job, controller.signal);
    }
    renderSync(scene, time = 0, scale = 1) {
        this.spatialAlive();
        const snapshot = evaluateScene(scene, time);
        if (this.isSpatial(snapshot))
            throw new StudioError('SPATIAL_ASYNC_REQUIRED', 'Use await SpatialRenderer.render() for spatial scenes.');
        if (this.queued)
            throw new StudioError('SPATIAL_BUSY', 'Wait for pending renders before rendering synchronously.');
        super.renderSync(snapshot, time, scale);
        this.mode = 'legacy';
    }
    preflight(scene, scale, maximum = SPATIAL_LIMITS.outputSide) {
        const w = Math.round(scene.width * scale), h = Math.round(scene.height * scale), max = Math.min(maximum, SPATIAL_LIMITS.outputSide);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1 || w > max || h > max || w * h > SPATIAL_LIMITS.outputPixels) {
            throw new StudioError('SPATIAL_OUTPUT_LIMIT', `Spatial output is limited to ${max}px per side and 16 megapixels; reduce export scale.`);
        }
        const active = scene.nodes.filter(node => node.visible && node.opacity > 0 && node.scale > 0);
        if (active.filter(node => node.type === 'mesh' || this.glassNode(node)).length > SPATIAL_LIMITS.volumes)
            throw new StudioError('SPATIAL_MESH_LIMIT', 'At most 32 physical volumes (meshes plus glass mockup rims) may be visible.');
        if (active.filter(node => node.type !== 'mesh').length > SPATIAL_LIMITS.texturedNodes)
            throw new StudioError('SPATIAL_TEXTURE_LIMIT', 'Spatial scenes support at most 256 visible raster nodes.');
        // Resolve device definitions before allocating GPU resources or replacing output.
        for (const node of active)
            if (node.type === 'mockup')
                getDevice(node.deviceId);
    }
    lost = (event) => {
        event.preventDefault();
        this.gpuLost = true;
        for (const controller of this.spatialControllers)
            controller.abort(new StudioError('SPATIAL_CONTEXT_LOST', 'WebGL context was lost. Wait for restoration and render again.'));
    };
    restored = () => { this.gpuLost = false; this.environmentDirty = true; };
    ensureGPU() {
        if (this.gpu)
            return;
        const canvas = newCanvas(1, 1), gl = webglContext(canvas);
        if (!gl) {
            canvas.width = 1;
            canvas.height = 1;
            throw new StudioError('SPATIAL_WEBGL2_REQUIRED', 'WebGL2 is unavailable. Enable WebGL2 or use CanvasRenderer with a legacy scene.');
        }
        canvas.addEventListener('webglcontextlost', this.lost);
        canvas.addEventListener('webglcontextrestored', this.restored);
        let renderer;
        try {
            renderer = new WebGLRenderer({ canvas: canvas, context: gl, alpha: true, antialias: true, premultipliedAlpha: true });
        }
        catch (cause) {
            canvas.removeEventListener('webglcontextlost', this.lost);
            canvas.removeEventListener('webglcontextrestored', this.restored);
            gl.getExtension('WEBGL_lose_context')?.loseContext();
            throw new StudioError('SPATIAL_WEBGL2_REQUIRED', 'Could not initialize the WebGL2 spatial renderer.', cause);
        }
        this.gpuCanvas = canvas;
        this.gpu = renderer;
        this.contextsCreated++;
        this.gpuMaximum = Math.min(renderer.capabilities.maxTextureSize, Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)));
        renderer.setPixelRatio(1);
        renderer.outputColorSpace = SRGBColorSpace;
        renderer.toneMapping = ACESFilmicToneMapping;
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.type = PCFSoftShadowMap;
        renderer.info.autoReset = false;
        this.environmentDirty = true;
        this.plane = new PlaneGeometry(1, 1);
    }
    checkGPU() {
        if (this.gpuLost || this.gpu?.getContext().isContextLost())
            throw new StudioError('SPATIAL_CONTEXT_LOST', 'WebGL2 context is lost. Wait for restoration before rendering again.');
    }
    ensureEnvironment() {
        if (!this.environmentDirty && this.environment)
            return;
        this.environment?.dispose();
        const generator = new PMREMGenerator(this.gpu);
        const room = new RoomEnvironment();
        try {
            this.environment = generator.fromScene(room, .04);
            this.environmentDirty = false;
        }
        finally {
            room.dispose();
            generator.dispose();
        }
    }
    makeCanvas(w, h) {
        if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > SPATIAL_LIMITS.textureSide || h > SPATIAL_LIMITS.textureSide)
            throw new StudioError('SPATIAL_TEXTURE_LIMIT', 'Raster canvas exceeds the 2048px spatial limit.');
        const canvas = this.spatialFactory(w, h);
        canvas.width = w;
        canvas.height = h;
        context2D(canvas);
        return canvas;
    }
    plans(scene, scale) {
        const side = Math.min(SPATIAL_LIMITS.textureSide, this.gpuMaximum);
        const plans = [{ key: 'background', worldWidth: scene.width, worldHeight: scene.height, width: 1, height: 1 }];
        for (const node of scene.nodes) {
            if (!node.visible || node.opacity <= 0 || node.scale <= 0 || node.type === 'mesh')
                continue;
            const pad = node.type === 'shape' ? clamp(node.blur, 0, 100) * 3 : 0;
            const worldWidth = Math.max(1, node.width + pad * 2), worldHeight = Math.max(1, node.height + pad * 2);
            plans.push({ key: `node:${node.id}`, node, worldWidth, worldHeight, width: 1, height: 1 });
        }
        // Determine all allocations before creating even one texture. A shared resolution
        // factor prevents a row of mockups from accidentally allocating 256 * 2048².
        let desiredPixels = 0;
        const factors = plans.map(plan => {
            const factor = Math.min(side / plan.worldWidth, side / plan.worldHeight, scale * (plan.node?.scale ?? 1));
            desiredPixels += Math.max(1, Math.floor(plan.worldWidth * factor)) * Math.max(1, Math.floor(plan.worldHeight * factor));
            return factor;
        });
        const share = Math.min(1, Math.sqrt((SPATIAL_LIMITS.texturePixels - plans.length * 2) / Math.max(1, desiredPixels)));
        let total = 0;
        plans.forEach((plan, index) => {
            plan.width = Math.max(1, Math.min(side, Math.floor(plan.worldWidth * factors[index] * share)));
            plan.height = Math.max(1, Math.min(side, Math.floor(plan.worldHeight * factors[index] * share)));
            total += plan.width * plan.height;
        });
        if (total > SPATIAL_LIMITS.texturePixels)
            throw new StudioError('SPATIAL_TEXTURE_LIMIT', 'Combined raster texture budget exceeds 16 megapixels.');
        const keep = new Set(plans.map(plan => plan.key));
        for (const [key, entry] of this.textures)
            if (!keep.has(key) || plans.some(plan => plan.key === key && (plan.width !== entry.width || plan.height !== entry.height)))
                this.dropTexture(key, entry);
        return plans;
    }
    texture(plan) {
        let entry = this.textures.get(plan.key);
        if (entry)
            return entry;
        const canvas = this.makeCanvas(plan.width, plan.height), texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.magFilter = LinearFilter;
        texture.anisotropy = Math.min(4, this.gpu.capabilities.getMaxAnisotropy());
        const material = new MeshBasicMaterial({ map: texture, side: DoubleSide, toneMapped: false, alphaTest: .001, depthWrite: true });
        // Three's transmission buffer excludes the transparent render list. Using a
        // custom alpha blend in the opaque list preserves media/text anti-aliasing AND
        // makes those opaque portions available to the physical refraction shader.
        material.transparent = false;
        material.blending = CustomBlending;
        material.blendEquation = AddEquation;
        material.blendSrc = SrcAlphaFactor;
        material.blendDst = OneMinusSrcAlphaFactor;
        material.blendEquationAlpha = AddEquation;
        material.blendSrcAlpha = OneFactor;
        material.blendDstAlpha = OneMinusSrcAlphaFactor;
        entry = { canvas, texture, material, width: plan.width, height: plan.height };
        this.textures.set(plan.key, entry);
        return entry;
    }
    dropTexture(key, entry) {
        entry.texture.dispose();
        entry.material.dispose();
        entry.canvas.width = 1;
        entry.canvas.height = 1;
        this.textures.delete(key);
    }
    localScene(scene, width, height, node) {
        const { spatial: _spatial, ...base } = scene;
        return { ...base, width, height, background: { type: 'transparent' }, effects: { ...NO_EFFECTS }, tracks: [], nodes: node ? [node] : [] };
    }
    /** Raster through the existing renderer and shared assets, never a second media
     * loader or animation evaluator. Giant artboard nodes are normalized before the
     * base renderer's minimum .25 scratch scale, keeping its temporary surface <=2048.
     * At >8192 world pixels, nominal device insets stay nominal in the normalized
     * mockup raster; physical glass layout itself always uses original scene pixels. */
    rasterNode(scene, node, worldWidth, worldHeight, targetWidth, targetHeight, time) {
        this.ensureRaster();
        const n = Math.min(1, 8190 / Math.max(worldWidth, worldHeight));
        const width = Math.max(1, worldWidth * n), height = Math.max(1, worldHeight * n);
        const local = { ...node, x: width / 2, y: height / 2, width: Math.max(.001, node.width * n), height: Math.max(.001, node.height * n), rotation: 0, tiltX: 0, tiltY: 0, scale: 1, opacity: 1 };
        if (local.type === 'text')
            local.fontSize = Math.max(1, local.fontSize * n);
        if (local.type === 'shape') {
            local.radius *= n;
            local.strokeWidth *= n;
            local.blur = clamp(local.blur, 0, 100) * n;
        }
        if (local.type === 'mockup') {
            local.radius *= n;
            local.borderWidth *= n;
            local.shadow = { ...local.shadow, opacity: 0, blur: 0, spread: 0, offsetX: 0, offsetY: 0 };
        }
        // Round conservatively: CanvasRenderer's output must never round to 2049.
        const scale = Math.min(targetWidth / width, targetHeight / height, (SPATIAL_LIMITS.textureSide - .51) / width, (SPATIAL_LIMITS.textureSide - .51) / height);
        const viewportWidth = Math.max(width, 1 / scale), viewportHeight = Math.max(height, 1 / scale);
        local.x = viewportWidth / 2;
        local.y = viewportHeight / 2;
        this.raster.renderSync(this.localScene(scene, viewportWidth, viewportHeight, local), time, scale);
        return this.rasterCanvas;
    }
    ensureRaster() {
        if (this.raster)
            return;
        this.rasterCanvas = this.makeCanvas(1, 1);
        // The base renderer's temporary node surfaces are bounded by normalization in
        // rasterNode. This guard also catches future base-renderer allocation regressions.
        const factory = (w, h) => this.makeCanvas(w, h);
        this.raster = new CanvasRenderer(this.rasterCanvas, { assets: this.assets, deviceAssets: this.deviceAssets, canvasFactory: factory });
    }
    fillTexture(scene, plan, entry, time) {
        const ctx = context2D(entry.canvas);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, entry.width, entry.height);
        if (!plan.node) {
            this.ensureRaster();
            const scale = Math.min(plan.width / scene.width, plan.height / scene.height);
            const local = this.localScene(scene, Math.max(scene.width, 1 / scale), Math.max(scene.height, 1 / scale));
            local.background = scene.background;
            this.raster.renderSync(local, time, scale);
            ctx.drawImage(this.rasterCanvas, 0, 0, entry.width, entry.height);
        }
        else if (plan.node.type === 'mockup' && this.glassNode(plan.node)) {
            this.fillGlassScreen(scene, plan.node, entry, time);
        }
        else {
            const node = plan.node;
            const raster = this.rasterNode(scene, node, plan.worldWidth, plan.worldHeight, entry.width, entry.height, time);
            ctx.drawImage(raster, 0, 0, entry.width, entry.height);
        }
        entry.texture.needsUpdate = true;
        entry.material.opacity = plan.node?.opacity ?? 1;
    }
    glassNode(node) { return node.type === 'mockup' && !getDevice(node.deviceId).artwork && (node.style === 'glass-light' || node.style === 'glass-dark' || node.style === 'liquid-glass'); }
    glassMaterial(node) {
        return resolveMockupGlassMaterial(node);
    }
    ringLayout(node, material) {
        const d = getDevice(node.deviceId), w = node.width, h = node.height, pad = Math.min(w, h) * .025;
        const left = clamp(d.inset.left + pad, .00001, w * .44), right = clamp(d.inset.right + pad, .00001, w * .44);
        const top = clamp(d.inset.top + pad, .00001, h * .44), bottom = clamp(d.inset.bottom + pad, .00001, h * .44);
        const width = w - left - right, height = h - top - bottom;
        const radius = clamp(node.radius, 0, Math.min(w, h) / 2);
        return { left, right, top, bottom, width, height, radius, screenRadius: clamp(d.category === 'screenshot' ? radius - pad : d.screenRadius, 0, Math.min(width, height) / 2), depth: clamp(material.thickness, .1, 1000) };
    }
    fillGlassScreen(scene, node, entry, time) {
        const layout = this.ringLayout(node, this.glassMaterial(node));
        // Render just the actual media through a plain screenshot node. No old glass
        // gradient, bloom, opaque frame or fake reflective edge is ever placed over PBR.
        const screen = { ...node, deviceId: 'screenshot', style: 'default', width: layout.width, height: layout.height, radius: layout.screenRadius, lighting: 0, borderWidth: 0, frameColor: '#0c1018' };
        const raster = this.rasterNode(scene, screen, layout.width, layout.height, Math.max(1, Math.floor(entry.width * layout.width / node.width)), Math.max(1, Math.floor(entry.height * layout.height / node.height)), time);
        const ctx = context2D(entry.canvas);
        ctx.save();
        ctx.scale(entry.width / node.width, entry.height / node.height);
        ctx.drawImage(raster, layout.left, layout.top, layout.width, layout.height);
        this.glassChrome(ctx, node, layout);
        ctx.restore();
    }
    /** Original procedural marks on a separate transparent screen/chrome raster.
     * The physical glass body remains a rounded footprint, not a vendor device model. */
    glassChrome(ctx, node, l) {
        const d = getDevice(node.deviceId), w = node.width, h = node.height, unit = Math.min(w, h);
        if (d.chrome === 'browser') {
            const r = Math.max(.5, Math.min(l.top * .1, w * .008));
            ['#ff6b70', '#ffc560', '#62d49b'].forEach((color, i) => { ctx.beginPath(); ctx.arc(l.left + r * (2 + i * 3.2), l.top / 2, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); });
            if (l.top > 9) {
                ctx.fillStyle = node.style === 'glass-dark' ? '#dbe5f3' : '#354257';
                ctx.font = `${Math.max(6, l.top * .24)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('your-website.com', w / 2, l.top / 2, w * .44);
            }
        }
        if (d.camera) {
            const y = Math.max(l.top * .5, l.top + unit * .022);
            ctx.fillStyle = '#07090e';
            ctx.beginPath();
            if (d.camera === 'pill')
                ctx.roundRect(w / 2 - l.width * .13, y - unit * .012, l.width * .26, unit * .036, unit * .018);
            else
                ctx.arc(w / 2, y, Math.max(1.2, unit * .012), 0, Math.PI * 2);
            ctx.fill();
            if (d.category === 'phone') {
                ctx.fillStyle = 'rgba(255,255,255,.65)';
                ctx.beginPath();
                ctx.roundRect(w * .36, l.top + l.height - unit * .026, w * .28, Math.max(2, unit * .009), 4);
                ctx.fill();
            }
        }
        if (d.chrome === 'keyboard') {
            const y = l.top + l.height + (h - l.top - l.height) * .22;
            ctx.fillStyle = 'rgba(10,14,22,.7)';
            ctx.fillRect(w * .04, y, w * .92, Math.max(2, (h - y) * .28));
            ctx.strokeStyle = 'rgba(255,255,255,.35)';
            ctx.lineWidth = .7;
            for (let i = 1; i < 16; i++) {
                const x = w * (.04 + .92 * i / 16);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + (h - y) * .28);
                ctx.stroke();
            }
        }
    }
    geometry(key, make) {
        let geometry = this.geometries.get(key);
        if (geometry)
            this.geometries.delete(key);
        else
            geometry = make();
        this.geometries.set(key, geometry);
        return geometry;
    }
    material(material, opacity) {
        const key = JSON.stringify([material, opacity]);
        let result = this.physicalMaterials.get(key);
        if (result)
            this.physicalMaterials.delete(key);
        else
            result = new MeshPhysicalMaterial({
                color: new Color(material.color), metalness: material.metalness, roughness: material.roughness,
                transmission: material.transmission, ior: material.ior, thickness: material.thickness,
                attenuationColor: new Color(material.attenuationColor), attenuationDistance: material.attenuationDistance,
                clearcoat: material.clearcoat, clearcoatRoughness: material.clearcoatRoughness, dispersion: material.dispersion,
                opacity, transparent: opacity < 1, depthWrite: opacity >= 1,
            });
        this.physicalMaterials.set(key, result);
        return result;
    }
    transform(object, node, index, scene) {
        object.position.set(node.x - scene.width / 2, scene.height / 2 - node.y, node.z ?? index * .1);
        object.rotation.set(rad(node.tiltX), -rad(node.tiltY), -rad(node.rotation), 'ZYX');
        object.scale.setScalar(node.scale);
    }
    planeMesh(entry, width, height) {
        const mesh = new Mesh(this.plane, entry.material);
        mesh.scale.set(width, height, 1);
        this.planes++;
        return mesh;
    }
    addLights(world, settings, width, height, minZ, maxZ) {
        world.add(new AmbientLight(settings.ambientColor, settings.ambientIntensity));
        const requestedMapSize = settings.quality === 'low' ? 512 : settings.quality === 'high' ? 2048 : 1024;
        // Point shadows use an atlas of 4x2 cells for six faces. Share an 8MP
        // shadow-map budget across ALL enabled lights rather than ignoring flags.
        const cells = Math.max(1, settings.lights.reduce((sum, light) => sum + (light.castShadow ? light.type === 'point' ? 8 : 1 : 0), 0));
        const budgetMapSize = 2 ** Math.floor(Math.log2(Math.sqrt(8_388_608 / cells)));
        for (const source of settings.lights) {
            const light = source.type === 'point'
                // Scene units are pixels. Convert point intensity to pixel-world candela so
                // moving the light by 500px does not make the inspector's 0..20 range useless.
                ? new PointLight(source.color, source.intensity * Math.max(width, height) ** 2 / 4, 0, 2)
                : new DirectionalLight(source.color, source.intensity);
            light.position.set(source.x - width / 2, height / 2 - source.y, source.z);
            light.castShadow = settings.shadows && source.castShadow;
            const mapSize = Math.min(requestedMapSize, budgetMapSize, this.gpuMaximum / (source.type === 'point' ? 4 : 1));
            light.shadow.mapSize.set(mapSize, mapSize);
            light.shadow.bias = -.00015;
            light.shadow.normalBias = .4;
            light.shadow.camera.near = .1;
            light.shadow.camera.far = Math.max(2000, maxZ - minZ + Math.max(width, height) * 4 + Math.abs(source.z));
            if (light instanceof DirectionalLight) {
                const extent = Math.max(width, height) * .9;
                light.shadow.camera.left = -extent;
                light.shadow.camera.right = extent;
                light.shadow.camera.top = extent;
                light.shadow.camera.bottom = -extent;
                light.target.position.set(0, 0, (minZ + maxZ) / 2);
                world.add(light.target);
            }
            light.shadow.camera.updateProjectionMatrix();
            world.add(light);
        }
    }
    releaseFrame() {
        this.frameScene?.traverse(object => {
            if (object instanceof DirectionalLight || object instanceof PointLight)
                object.shadow.dispose();
        });
        this.frameScene?.clear();
        for (const material of this.frameMaterials)
            material.dispose();
        this.frameMaterials = [];
    }
    trimCaches() {
        // Current frames have <=32 physical geometries/materials; LRU slack keeps
        // common inspector changes warm without retaining a project's entire history.
        while (this.geometries.size > 64) {
            const [key, geometry] = this.geometries.entries().next().value;
            geometry.dispose();
            this.geometries.delete(key);
        }
        while (this.physicalMaterials.size > 64) {
            const [key, material] = this.physicalMaterials.entries().next().value;
            material.dispose();
            this.physicalMaterials.delete(key);
        }
    }
    renderSpatial(scene, time, scale, signal) {
        this.checkGPU();
        cancelled(signal);
        const settings = scene.spatial ?? createSpatialSettings();
        const renderer = this.gpu;
        renderer.setSize(Math.round(scene.width * scale), Math.round(scene.height * scale), false);
        renderer.toneMappingExposure = settings.exposure;
        renderer.shadowMap.enabled = settings.shadows;
        renderer.transmissionResolutionScale = settings.quality === 'low' ? .5 : 1;
        this.ensureEnvironment();
        const plans = this.plans(scene, scale), entries = new Map();
        for (const plan of plans) {
            cancelled(signal);
            const entry = this.texture(plan);
            this.fillTexture(scene, plan, entry, time);
            entries.set(plan.key, entry);
        }
        this.releaseFrame();
        this.volumes = 0;
        this.planes = 0;
        // Reuse scene AND camera identity. Three owns one transmission render target
        // per scene/camera; replacing either every frame leaks GPU targets internally.
        const world = this.frameScene ?? new Scene();
        this.frameScene = world;
        world.environment = this.environment.texture;
        world.environmentIntensity = settings.environmentIntensity;
        let minZ = 0, maxZ = 0;
        scene.nodes.forEach((node, index) => {
            cancelled(signal);
            if (!node.visible || node.opacity <= 0 || node.scale <= 0)
                return;
            const group = new Group();
            this.transform(group, node, index, scene);
            if (node.type === 'mesh') {
                const mesh = new Mesh(this.geometry(meshGeometryKey(node, settings.quality), () => createMeshGeometry(node, settings.quality)), this.material(node.material, node.opacity));
                mesh.castShadow = settings.shadows && node.castShadow;
                mesh.receiveShadow = settings.shadows && node.receiveShadow;
                group.add(mesh);
                this.volumes++;
            }
            else {
                const entry = entries.get(`node:${node.id}`);
                const plan = plans.find(item => item.node?.id === node.id);
                const flat = this.planeMesh(entry, plan.worldWidth, plan.worldHeight);
                // Stable far-to-near order for partial-alpha artwork in the opaque pass.
                flat.renderOrder = 10 + (node.z ?? index * .1) * .0001;
                if (node.type === 'mockup' && this.glassNode(node)) {
                    const material = this.glassMaterial(node), l = this.ringLayout(node, material);
                    const options = { width: node.width, height: node.height, depth: l.depth, radius: l.radius, screenRadius: l.screenRadius,
                        inset: { left: l.left, right: l.right, top: l.top, bottom: l.bottom }, bevel: Math.min(node.width, node.height) * .008, segments: settings.quality === 'high' ? 48 : settings.quality === 'low' ? 16 : 24 };
                    const key = `ring:${JSON.stringify(options)}`;
                    const rim = new Mesh(this.geometry(key, () => createGlassRingGeometry(options)), this.material(material, node.opacity));
                    rim.castShadow = settings.shadows && node.shadow.opacity > 0;
                    rim.receiveShadow = settings.shadows;
                    // Screen is inside the open ring, slightly recessed from its front face.
                    flat.position.z = l.depth / 2 - Math.min(2, l.depth * .15);
                    group.add(rim);
                    this.volumes++;
                }
                else if (node.type === 'mockup')
                    flat.castShadow = settings.shadows && node.shadow.opacity > 0;
                group.add(flat);
            }
            world.add(group);
            group.updateMatrixWorld(true);
            const bounds = new Box3().setFromObject(group);
            if (!bounds.isEmpty()) {
                minZ = Math.min(minZ, bounds.min.z);
                maxZ = Math.max(maxZ, bounds.max.z);
            }
        });
        const backdropZ = minZ - Math.max(8, Math.min(scene.width, scene.height) * .025);
        const background = this.planeMesh(entries.get('background'), scene.width, scene.height);
        background.position.z = backdropZ;
        background.renderOrder = -10000;
        world.add(background);
        if (settings.shadows && settings.shadowOpacity > 0) {
            const material = new ShadowMaterial({ color: '#000000', opacity: settings.shadowOpacity, depthWrite: false });
            this.frameMaterials.push(material);
            const receiver = new Mesh(this.plane, material);
            receiver.scale.set(scene.width, scene.height, 1);
            receiver.position.z = backdropZ + .05;
            receiver.receiveShadow = true;
            world.add(receiver);
            this.planes++;
        }
        this.addLights(world, settings, scene.width, scene.height, backdropZ, maxZ);
        const cameraZ = maxZ + Math.max(scene.width, scene.height) * 2 + 100;
        const camera = this.spatialCamera ?? new OrthographicCamera();
        this.spatialCamera = camera;
        camera.left = -scene.width / 2;
        camera.right = scene.width / 2;
        camera.top = scene.height / 2;
        camera.bottom = -scene.height / 2;
        camera.near = .1;
        camera.far = cameraZ - backdropZ + 100;
        camera.updateProjectionMatrix();
        camera.position.z = cameraZ;
        camera.updateMatrixWorld();
        renderer.info.reset();
        try {
            renderer.render(world, camera);
        }
        catch (cause) {
            this.checkGPU();
            throw new StudioError('SPATIAL_RENDER_FAILED', 'The GPU could not render this spatial scene.', cause);
        }
        this.checkGPU();
        cancelled(signal);
        this.spatialAlive();
        // Only commit after validation, media preparation, texture building and GPU
        // drawing succeeded. The previous 2D image survives all preflight/load/GL errors.
        this.canvas.width = renderer.domElement.width;
        this.canvas.height = renderer.domElement.height;
        const ctx = context2D(this.canvas);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.drawImage(renderer.domElement, 0, 0);
        this.applyEffects(scene, time);
        this.mode = 'spatial';
        this.trimCaches();
    }
    getDebugInfo() {
        const info = this.gpu?.info;
        return {
            mode: this.mode, disposed: this.spatialDisposed, contextLost: this.gpuLost, webglContextsCreated: this.contextsCreated,
            output: { width: this.canvas.width, height: this.canvas.height },
            resources: { geometries: this.geometries.size + (this.plane ? 1 : 0), materials: this.physicalMaterials.size + this.textures.size + this.frameMaterials.length, textures: this.textures.size,
                texturePixels: [...this.textures.values()].reduce((sum, entry) => sum + entry.width * entry.height, 0), volumes: this.volumes, planes: this.planes, environment: this.environment ? 1 : 0 },
            limits: SPATIAL_LIMITS,
            renderer: info ? { memory: { geometries: info.memory.geometries, textures: info.memory.textures }, programs: info.programs?.length ?? 0,
                render: { calls: info.render.calls, triangles: info.render.triangles, points: info.render.points, lines: info.render.lines } } : null,
        };
    }
    dispose() {
        if (this.spatialDisposed)
            return;
        this.spatialDisposed = true;
        for (const controller of this.spatialControllers)
            controller.abort(new StudioError('DISPOSED', 'SpatialRenderer disposed during rendering.'));
        this.spatialControllers.clear();
        this.releaseFrame();
        this.frameScene = undefined;
        this.spatialCamera = undefined;
        this.raster?.dispose();
        this.raster = undefined;
        if (this.rasterCanvas) {
            this.rasterCanvas.width = 1;
            this.rasterCanvas.height = 1;
            this.rasterCanvas = undefined;
        }
        for (const [key, entry] of this.textures)
            this.dropTexture(key, entry);
        for (const geometry of this.geometries.values())
            geometry.dispose();
        this.geometries.clear();
        for (const material of this.physicalMaterials.values())
            material.dispose();
        this.physicalMaterials.clear();
        this.plane?.dispose();
        this.plane = undefined;
        this.environment?.dispose();
        this.environment = undefined;
        this.gpuCanvas?.removeEventListener('webglcontextlost', this.lost);
        this.gpuCanvas?.removeEventListener('webglcontextrestored', this.restored);
        this.gpu?.dispose();
        this.gpu?.forceContextLoss();
        this.gpu = undefined;
        if (this.gpuCanvas) {
            this.gpuCanvas.width = 1;
            this.gpuCanvas.height = 1;
            this.gpuCanvas = undefined;
        }
        this.volumes = 0;
        this.planes = 0;
        super.dispose();
    }
}
//# sourceMappingURL=renderer.js.map