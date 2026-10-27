import { type SceneDocument } from '@bookklik/device-mockup-studio/core';
import type { Alignment } from './alignment.js';
export interface InspectorContext {
    doc: Document;
    parent: HTMLElement;
    scene: SceneDocument;
    selectedId: string | undefined;
    supportsSpatial: boolean;
    mode: 'layer' | 'canvas';
    update(edit: (scene: SceneDocument) => void): void;
    align(value: Alignment): void;
    duplicate(): void;
    remove(): void;
    reorder(direction: number): void;
    generateBackground(): void;
    importMedia(): void;
    close(): void;
}
export declare function renderInspector(ctx: InspectorContext): void;
//# sourceMappingURL=inspector.d.ts.map