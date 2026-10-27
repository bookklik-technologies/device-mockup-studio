import { type SceneDocument } from '@bookklik/device-mockup-studio-core';
export interface SceneTemplate {
    id: string;
    name: string;
    category: string;
    workspace: '2d' | '3d';
    description: string;
}
export interface TemplateOptions {
    assetId?: string;
}
/** Fresh descriptors; identifiers and legacy composition APIs remain compatible. */
export declare function getTemplates(options?: {
    workspace?: '2d' | '3d';
}): SceneTemplate[];
/** Replaces the composition, retaining project metadata, media and video playback settings. */
export declare function applyTemplate(scene: SceneDocument, templateId: string, options?: TemplateOptions): SceneDocument;
//# sourceMappingURL=templates.d.ts.map