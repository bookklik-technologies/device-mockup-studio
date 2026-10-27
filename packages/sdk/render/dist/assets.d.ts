import { type Asset, type SceneDocument, type MockupNode } from '@bookklik/device-mockup-studio/core';
export declare function sourceSize(source: CanvasImageSource): {
    width: number;
    height: number;
};
export declare function throwIfAborted(signal?: AbortSignal): void;
export declare function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T>;
/** Internal preflight shared by asynchronous preparation and synchronous drawing.
 * Same-timing reuse is safe. Independent timings require distinct asset IDs backed by
 * independent video sources; one decoder cannot supply two frames in a single draw.
 */
export declare function videoFrameSources(scene: SceneDocument, getSource: (id: string) => CanvasImageSource | undefined): Map<HTMLVideoElement, MockupNode>;
/** Browser-first media cache. Registered sources also make the renderer portable to Node canvas. */
export declare class AssetManager {
    private sources;
    private pending;
    private urls;
    private registered;
    private ownedVideos;
    private cleanups;
    private disposed;
    private importCounter;
    private frameQueue;
    private alive;
    get(id: string): CanvasImageSource | undefined;
    /** Borrow a source. Video-like sources participate in frame seeking, but disposal
     * never clears their src, reloads them, or closes caller-owned media.
     */
    register(id: string, source: CanvasImageSource): void;
    load(asset: Asset): Promise<CanvasImageSource>;
    private loadBrowser;
    importFile(file: File): Promise<Asset>;
    prepareFrame(scene: SceneDocument, time: number, signal?: AbortSignal): Promise<void>;
    private seek;
    dispose(): void;
}
//# sourceMappingURL=assets.d.ts.map