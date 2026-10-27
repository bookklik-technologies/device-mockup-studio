import { createScene, type SceneDocument } from '@bookklik/device-mockup-studio-core';
import { applyTemplate, getTemplates, type SceneTemplate } from '@bookklik/device-mockup-studio-presets';
import type { CanvasRenderer } from '@bookklik/device-mockup-studio-render';
import { button, element, field } from './dom.js';

/** One reusable renderer and a bounded preview cache. */
export class TemplateGallery {
  readonly root: HTMLDivElement;
  private readonly search: HTMLInputElement;
  private readonly category: HTMLSelectElement;
  private readonly grid: HTMLDivElement;
  private readonly count: HTMLParagraphElement;
  private workspace?: '2d' | '3d';
  private templates: SceneTemplate[] = [];
  private readonly cache = new Map<string, string>();
  private readonly queued = new Set<HTMLImageElement>();
  private queue: { template: SceneTemplate; image: HTMLImageElement }[] = [];
  private observer?: IntersectionObserver;
  private renderer?: CanvasRenderer;
  private canvas?: HTMLCanvasElement;
  private busy = false;
  private dead = false;
  private readonly lifecycle = new AbortController();

  constructor(private readonly doc: Document, panel: HTMLElement, private readonly supportsSpatial: boolean,
    private readonly createRenderer: (canvas: HTMLCanvasElement) => CanvasRenderer,
    private readonly apply: (id: string) => void) {
    this.root = element(doc, 'div', 'ms-template-gallery');
    this.search = element(doc, 'input'); this.search.type = 'search'; this.search.placeholder = 'Search templates…';
    field(doc, this.root, 'Search', this.search); this.search.setAttribute('aria-label', 'Search templates');
    this.category = element(doc, 'select');
    field(doc, this.root, 'Collection', this.category); this.category.setAttribute('aria-label', 'Template collection');
    this.count = element(doc, 'p', 'ms-hint'); this.count.setAttribute('role', 'status'); this.count.setAttribute('aria-live', 'polite');
    this.grid = element(doc, 'div', 'ms-preset-grid');
    this.root.append(element(doc, 'p', 'ms-hint', 'Replaces the current composition · Undo anytime'), this.count, this.grid);
    this.search.oninput = () => this.renderTemplates(); this.category.onchange = () => this.renderTemplates();
    const Observer = doc.defaultView?.IntersectionObserver;
    if (Observer) this.observer = new Observer(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        const image = entry.target as HTMLImageElement;
        const template = this.templates.find(candidate => candidate.id === image.dataset.template);
        if (template) this.enqueue(template, image);
        this.observer?.unobserve(image);
      }
    }, { root:panel, rootMargin:'120px' });
  }

  show(scene: SceneDocument): HTMLElement {
    const workspace = scene.spatial?.enabled || scene.nodes.some(node => node.type === 'mesh') ? '3d' : '2d';
    if (workspace !== this.workspace) {
      this.workspace = workspace; this.search.value = ''; this.category.replaceChildren();
      this.templates = getTemplates({ workspace });
      const all = element(this.doc, 'option', '', 'All collections'); all.value = ''; this.category.append(all);
      for (const category of [...new Set(this.templates.map(template => template.category))]) {
        const option = element(this.doc, 'option', '', category[0]!.toUpperCase() + category.slice(1)); option.value = category; this.category.append(option);
      }
      this.renderTemplates();
    }
    // The library detaches this DOM when another tab is selected. Resume any
    // previews whose queued work was skipped while they were disconnected.
    for (const image of this.grid.querySelectorAll<HTMLImageElement>('img[data-template]')) {
      const template = this.templates.find(candidate => candidate.id === image.dataset.template);
      if (!template || image.closest('button')?.disabled) continue;
      const cached = this.cache.get(template.id);
      if (cached) { image.src = cached; image.parentElement?.classList.add('ms-preview-ready'); }
      else if (!image.hasAttribute('src')) {
        if (this.observer) this.observer.observe(image); else this.enqueue(template, image);
      }
    }
    return this.root;
  }

  private renderTemplates(): void {
    this.observer?.disconnect(); this.queue = []; this.queued.clear(); this.grid.replaceChildren();
    const query = this.search.value.trim().toLowerCase();
    const templates = this.templates.filter(template => (!this.category.value || template.category === this.category.value)
      && `${template.name} ${template.description} ${template.category}`.toLowerCase().includes(query));
    this.count.textContent = `${templates.length} ${this.workspace === '3d' ? 'material' : 'device'} template${templates.length === 1 ? '' : 's'}`;
    for (const template of templates) {
      const choice = button(this.doc, `Apply ${template.name}`, () => this.apply(template.id), 'ms-preset');
      choice.title = `${template.name} · ${template.description}`;
      choice.disabled = template.workspace === '3d' && !this.supportsSpatial;
      if (choice.disabled) choice.title = 'This template requires a spatial renderer.';
      choice.replaceChildren();
      const art = element(this.doc, 'div', 'ms-preset-art');
      const image = element(this.doc, 'img'); image.alt = ''; image.dataset.template = template.id;
      image.width = 480; image.height = 360;
      art.append(image);
      choice.append(art, element(this.doc, 'span', 'ms-preset-name', template.name)); this.grid.append(choice);
      const cached = this.cache.get(template.id);
      if (cached) { image.src = cached; art.classList.add('ms-preview-ready'); }
      else if (!choice.disabled) {
        if (this.observer) this.observer.observe(image); else this.enqueue(template, image);
      }
    }
    if (!templates.length) this.grid.append(element(this.doc, 'p', 'ms-hint', 'No templates match. Try another search or collection.'));
  }

  private enqueue(template: SceneTemplate, image: HTMLImageElement): void {
    if (this.dead || this.queued.has(image)) return;
    this.queued.add(image); this.queue.push({ template, image });
    // Fallback browsers may enqueue before show() has attached the gallery.
    if (!this.busy) queueMicrotask(() => { if (!this.busy && !this.dead) void this.drain(); });
  }

  private async drain(): Promise<void> {
    this.busy = true;
    try {
      while (!this.dead && this.queue.length) {
        const item = this.queue.shift()!; this.queued.delete(item.image);
        if (!item.image.isConnected) continue;
        try {
          let src = this.cache.get(item.template.id);
          if (!src) {
            this.canvas ??= element(this.doc, 'canvas'); this.renderer ??= this.createRenderer(this.canvas);
            const scene = applyTemplate(createScene({ width:1440, height:1080 }), item.template.id);
            await this.renderer.render(scene, 0, { scale:1 / 3, signal:this.lifecycle.signal });
            if (this.dead) return;
            src = this.canvas.toDataURL('image/png'); this.cache.set(item.template.id, src);
          }
          if (item.image.isConnected) { item.image.src = src; item.image.parentElement?.classList.add('ms-preview-ready'); }
        } catch {
          if (!this.dead && item.image.isConnected) {
            const fallback = element(this.doc, 'span', 'ms-preview-error', 'Preview unavailable');
            item.image.parentElement?.replaceChildren(fallback);
          }
        }
      }
    } finally { this.busy = false; }
  }

  destroy(): void {
    this.dead = true; this.lifecycle.abort(); this.observer?.disconnect(); this.renderer?.dispose();
    if (this.canvas) { this.canvas.width = 1; this.canvas.height = 1; }
    this.queue = []; this.queued.clear(); this.cache.clear();
    this.search.oninput = null; this.category.onchange = null;
    for (const choice of this.root.querySelectorAll('button')) choice.onclick = null;
    this.root.remove();
  }
}
