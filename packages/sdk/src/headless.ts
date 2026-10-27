import { SceneStore, StudioError, createScene, deserializeScene, serializeScene, type SceneDocument, type SceneListener } from '@mockup-studio/core';
import { CanvasRenderer, type CanvasFactory, type RendererOptions, type RenderOptions } from '@mockup-studio/render';
import { exportImage, type CanvasBlobEncoder, type ImageExportOptions } from '@mockup-studio/media';

export * from '@mockup-studio/core';
export * from '@mockup-studio/presets';
export * from '@mockup-studio/render';
export * from '@mockup-studio/media';

export interface HeadlessStudioOptions extends RendererOptions {
  scene?: SceneDocument;
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  rendererFactory?: (canvas: HTMLCanvasElement | OffscreenCanvas, options: RendererOptions) => CanvasRenderer;
  encodeCanvas?: CanvasBlobEncoder;
  onChange?: SceneListener;
}

export interface HeadlessStudio {
  readonly store: SceneStore;
  readonly renderer: CanvasRenderer;
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly scene: SceneDocument;
  render(time?: number, options?: RenderOptions): Promise<void>;
  exportImage(options?: ImageExportOptions): Promise<Blob>;
  load(json: string): void;
  serialize(): string;
  destroy(): void;
}

function createCanvas(factory?: CanvasFactory): HTMLCanvasElement | OffscreenCanvas {
  if (factory) return factory(1, 1);
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(1, 1);
  if (typeof document !== 'undefined') return document.createElement('canvas');
  throw new StudioError('CANVAS_FACTORY', 'Supply canvas or canvasFactory when creating a headless studio outside a browser.');
}

export function createHeadlessStudio(options: HeadlessStudioOptions = {}): HeadlessStudio {
  const store = new SceneStore(options.scene ?? createScene());
  let renderer: CanvasRenderer;
  try {
    const canvas = options.canvas ?? createCanvas(options.canvasFactory);
    const rendererOptions: RendererOptions = { assets: options.assets, deviceAssets: options.deviceAssets, canvasFactory: options.canvasFactory };
    renderer = options.rendererFactory ? options.rendererFactory(canvas, rendererOptions) : new CanvasRenderer(canvas, rendererOptions);
  } catch (error) {
    store.dispose();
    throw error;
  }
  let destroyed = false;
  let pending: Promise<unknown> = Promise.resolve();
  if (options.onChange) store.subscribe(options.onChange);
  const alive = () => {
    if (destroyed) throw new StudioError('DISPOSED', 'Headless studio has been destroyed.');
  };
  const enqueue = <Result>(operation: () => Promise<Result>): Promise<Result> => {
    const result = pending.then(() => { alive(); return operation(); });
    pending = result.catch(() => undefined);
    return result;
  };
  return {
    store,
    renderer,
    canvas: renderer.canvas,
    get scene() { alive(); return store.scene; },
    async render(time = 0, renderOptions = {}) {
      alive();
      const scene = store.scene;
      await enqueue(() => renderer.render(scene, time, renderOptions));
    },
    async exportImage(exportOptions = {}) {
      alive();
      const scene = store.scene;
      return enqueue(() => exportImage(renderer, scene, { ...exportOptions, encodeCanvas: exportOptions.encodeCanvas ?? options.encodeCanvas }));
    },
    load(json) { alive(); store.setScene(deserializeScene(json)); },
    serialize() { alive(); return serializeScene(store.scene); },
    destroy() {
      if (destroyed) return;
      store.dispose();
      destroyed = true;
      renderer.dispose();
    },
  };
}
