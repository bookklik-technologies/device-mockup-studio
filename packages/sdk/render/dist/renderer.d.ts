import { type SceneDocument } from '@bookklik/device-mockup-studio/core';
import { AssetManager } from './assets.js';
import { type CanvasFactory, type StudioCanvas } from './canvas.js';
export interface RendererOptions {
    assets?: AssetManager;
    canvasFactory?: CanvasFactory; /** Optional frame cache. Register images by device ID for headless rendering. */
    deviceAssets?: AssetManager;
}
export interface RenderOptions {
    scale?: number;
    signal?: AbortSignal;
}
/** Deterministic Canvas2D renderer. Scene x/y positions are node centers. */
export declare class CanvasRenderer {
    /** Feature flag used by optional spatial renderer integrations. */
    readonly supportsSpatial: boolean;
    readonly canvas: StudioCanvas;
    readonly assets: AssetManager;
    readonly deviceAssets: AssetManager;
    private readonly factory;
    private readonly ownsAssets;
    private readonly ownsDeviceAssets;
    private disposed;
    private pending;
    private renders;
    constructor(canvas: StudioCanvas, options?: RendererOptions);
    private alive;
    private check;
    render(scene: SceneDocument, time?: number, options?: RenderOptions): Promise<void>;
    renderSync(scene: SceneDocument, time?: number, scale?: number): void;
    /** Await only faces used by this scene. No DOM dependency for Node/SSR callers. */
    protected prepareFonts(scene: SceneDocument, signal?: AbortSignal): Promise<void>;
    /** Prepare frame artwork separately from user media so their IDs cannot collide. */
    protected prepareDeviceArtwork(scene: SceneDocument, signal?: AbortSignal): Promise<void>;
    private deviceArtwork;
    private scratch;
    private asset;
    private draw;
    private background;
    private node;
    private sceneWidth;
    private sceneHeight;
    private lastSceneWidth;
    private lastSceneHeight;
    private shadow;
    private artworkShadow;
    private mockup;
    private photographicMockup;
    private chrome;
    private shape;
    private text;
    /** Finish pixels produced by a renderer extension using the same deterministic effects. */
    applyEffects(scene: SceneDocument, time?: number): void;
    private effects;
    dispose(): void;
}
//# sourceMappingURL=renderer.d.ts.map