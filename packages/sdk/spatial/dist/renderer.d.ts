import { type SceneDocument } from '@bookklik/device-mockup-studio-core';
import { CanvasRenderer, type RendererOptions, type RenderOptions } from '@bookklik/device-mockup-studio-render';
type StudioCanvas = CanvasRenderer['canvas'];
export declare const SPATIAL_LIMITS: Readonly<{
    outputSide: 4096;
    outputPixels: 16000000;
    textureSide: 2048;
    texturePixels: 16000000;
    volumes: 32;
    texturedNodes: 256;
}>;
export interface SpatialCapabilities {
    webgl2: boolean;
    maxTextureSize: number;
    reason?: string;
}
/** Explicit runtime probe. Allocates and immediately releases a temporary context;
 * it is never called on import or by a legacy Canvas2D render. */
export declare function getSpatialCapabilities(): SpatialCapabilities;
export interface SpatialDebugInfo {
    mode: 'unrendered' | 'legacy' | 'spatial';
    disposed: boolean;
    contextLost: boolean;
    webglContextsCreated: number;
    output: {
        width: number;
        height: number;
    };
    resources: {
        geometries: number;
        materials: number;
        textures: number;
        texturePixels: number;
        volumes: number;
        planes: number;
        environment: number;
    };
    limits: typeof SPATIAL_LIMITS;
    renderer: null | {
        memory: {
            geometries: number;
            textures: number;
        };
        programs: number;
        render: {
            calls: number;
            triangles: number;
            points: number;
            lines: number;
        };
    };
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
export declare class SpatialRenderer extends CanvasRenderer {
    readonly supportsSpatial: boolean;
    private readonly spatialFactory;
    private spatialDisposed;
    private spatialPending;
    private spatialControllers;
    private queued;
    private mode;
    private gpu?;
    private gpuCanvas?;
    private gpuLost;
    private contextsCreated;
    private gpuMaximum;
    private environment?;
    private environmentDirty;
    private geometries;
    private physicalMaterials;
    private textures;
    private plane?;
    private raster?;
    private rasterCanvas?;
    private frameScene?;
    private spatialCamera?;
    private frameMaterials;
    private volumes;
    private planes;
    constructor(canvas: StudioCanvas, options?: RendererOptions);
    private spatialAlive;
    private isSpatial;
    render(scene: SceneDocument, time?: number, options?: RenderOptions): Promise<void>;
    renderSync(scene: SceneDocument, time?: number, scale?: number): void;
    private preflight;
    private readonly lost;
    private readonly restored;
    private ensureGPU;
    private checkGPU;
    private ensureEnvironment;
    private makeCanvas;
    private plans;
    private texture;
    private dropTexture;
    private localScene;
    /** Raster through the existing renderer and shared assets, never a second media
     * loader or animation evaluator. Giant artboard nodes are normalized before the
     * base renderer's minimum .25 scratch scale, keeping its temporary surface <=2048.
     * At >8192 world pixels, nominal device insets stay nominal in the normalized
     * mockup raster; physical glass layout itself always uses original scene pixels. */
    private rasterNode;
    private ensureRaster;
    private fillTexture;
    private glassNode;
    private glassMaterial;
    private ringLayout;
    private fillGlassScreen;
    /** Original procedural marks on a separate transparent screen/chrome raster.
     * The physical glass body remains a rounded footprint, not a vendor device model. */
    private glassChrome;
    private geometry;
    private material;
    private transform;
    private planeMesh;
    private addLights;
    private releaseFrame;
    private trimCaches;
    private renderSpatial;
    getDebugInfo(): SpatialDebugInfo;
    dispose(): void;
}
export {};
//# sourceMappingURL=renderer.d.ts.map