import { type SceneDocument } from '@bookklik/device-mockup-studio-core';
import type { CanvasRenderer } from '@bookklik/device-mockup-studio-render';
/** One reusable renderer and a bounded preview cache. */
export declare class TemplateGallery {
    private readonly doc;
    private readonly supportsSpatial;
    private readonly createRenderer;
    private readonly apply;
    readonly root: HTMLDivElement;
    private readonly search;
    private readonly category;
    private readonly grid;
    private readonly count;
    private workspace?;
    private templates;
    private readonly cache;
    private readonly queued;
    private queue;
    private observer?;
    private renderer?;
    private canvas?;
    private busy;
    private dead;
    private readonly lifecycle;
    constructor(doc: Document, panel: HTMLElement, supportsSpatial: boolean, createRenderer: (canvas: HTMLCanvasElement) => CanvasRenderer, apply: (id: string) => void);
    show(scene: SceneDocument): HTMLElement;
    private renderTemplates;
    private enqueue;
    private drain;
    destroy(): void;
}
//# sourceMappingURL=template-gallery.d.ts.map