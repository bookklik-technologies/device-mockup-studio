import { SceneStore, type SceneDocument } from '@bookklik/device-mockup-studio-core';
import { CanvasRenderer } from '@bookklik/device-mockup-studio-render';
export interface EditorOptions {
    scene?: SceneDocument;
    onChange?: (scene: SceneDocument) => void;
    onError?: (error: Error) => void;
    theme?: 'dark' | 'light';
    onThemeChange?: (theme: 'dark' | 'light') => void;
    /** Opt in to another renderer, e.g. SpatialRenderer. Used for preview AND exports. */
    rendererFactory?: (canvas: HTMLCanvasElement) => CanvasRenderer;
}
export interface EditorHandle {
    store: SceneStore;
    renderer: CanvasRenderer;
    getScene(): SceneDocument;
    /** Set recordHistory to false when switching independent workspaces. */
    setScene(scene: SceneDocument, recordHistory?: boolean): void;
    getTheme(): 'dark' | 'light';
    setTheme(theme: 'dark' | 'light'): void;
    destroy(): void;
}
/** Framework-free and safe to import before any browser globals exist. */
export declare function mountEditor(container: HTMLElement, options?: EditorOptions): EditorHandle;
//# sourceMappingURL=index.d.ts.map