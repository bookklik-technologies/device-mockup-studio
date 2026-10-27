import { SceneStore, createScene, createMockup, createShape, createText, createMesh, createSpatialSettings, deserializeScene, serializeScene, evaluateScene, cloneScene, type SceneDocument, type SceneNode, type Asset } from '@bookklik/device-mockup-studio/core';
import { CanvasRenderer, createMagicBackground } from '@bookklik/device-mockup-studio/render';
import { getDevice, listDevices, applyTemplate } from '@bookklik/device-mockup-studio/presets';
import { exportGIF, exportImage, exportVideo } from '@bookklik/device-mockup-studio/media';
import { button, element } from './dom.js';
import { clientToScene, editNode, hitTest, nodeCorners } from './helpers.js';
import { alignmentDelta, constrainMovement, nodeBounds, snapBounds, snapTargets, type Alignment, type SnapGuide, type SnapState, type SnapTarget } from './alignment.js';
import { renderInspector } from './inspector.js';
import { deviceThumbnail } from './device-thumbnail.js';
import { TemplateGallery } from './template-gallery.js';
import { styles } from './styles.js';
import { brandMark } from './brand.js';
import { icon, setButtonContent, type IconName } from './icons.js';

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
interface RenderRequest { scene: SceneDocument; time: number; revision: number }
interface Movement {
  id: string;
  original: SceneDocument;
  draft: SceneDocument;
}
interface Drag extends Movement {
  pointerId: number;
  start: { x: number; y: number };
  moved: boolean;
  targets: SnapTarget[];
  snap: SnapState;
  axis?: 'x' | 'y';
  client: { x: number; y: number };
}
let editorSequence = 0;
const libraryTabNames = ['layers', 'presets', 'devices', 'media'] as const;
type LibraryTab = typeof libraryTabNames[number];

/** Framework-free and safe to import before any browser globals exist. */
export function mountEditor(container: HTMLElement, options: EditorOptions = {}): EditorHandle {
  return new Editor(container, options);
}

class Editor implements EditorHandle {
  readonly store: SceneStore;
  readonly renderer: CanvasRenderer;
  private readonly doc: Document;
  private readonly win: Window;
  private readonly root: HTMLDivElement;
  private readonly view: HTMLCanvasElement;
  private readonly buffer: HTMLCanvasElement;
  private readonly wrap: HTMLDivElement;
  private readonly viewport: HTMLDivElement;
  private readonly selection: SVGSVGElement;
  private readonly snapGuides: SVGSVGElement;
  private snapping = true;
  private nudge?: Movement;
  private readonly nudgeKeys = new Set<string>();
  private readonly catalog: HTMLDivElement;
  private readonly layers: HTMLDivElement;
  private readonly libraryPanel: HTMLDivElement;
  private readonly inspector: HTMLElement;
  private readonly propertiesDialog: HTMLDialogElement;
  private readonly propertiesToggle: HTMLButtonElement;
  private propertiesReturnFocus?: HTMLElement;
  private readonly status: HTMLSpanElement;
  private readonly dimensions: HTMLSpanElement;
  private readonly undo: HTMLButtonElement;
  private readonly redo: HTMLButtonElement;
  private readonly play: HTMLButtonElement;
  private readonly scrubber: HTMLInputElement;
  private readonly timeLabel: HTMLSpanElement;
  private readonly track: HTMLDivElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly fileInput: HTMLInputElement;
  private readonly jsonInput: HTMLInputElement;
  private readonly libraryToggle: HTMLButtonElement;
  private readonly libraryClose: HTMLButtonElement;
  private readonly guide: HTMLElement;
  private readonly notice: HTMLDivElement;
  private readonly themeToggle: HTMLButtonElement;
  private readonly actionsDialog: HTMLDialogElement;
  private readonly actionsToggle: HTMLButtonElement;
  private readonly canvasToggle: HTMLButtonElement;
  private readonly exportButtons: HTMLButtonElement[] = [];
  private readonly listeners: (() => void)[] = [];
  private readonly objectUrls = new Set<string>();
  private readonly downloadTimers = new Set<number>();
  private readonly motions = new Map<HTMLElement, Animation>();
  private actionsClosing = false;
  private readonly lifecycle = new AbortController();
  private unsubscribe: () => void;
  private observer?: ResizeObserver;
  private selectedId: string | undefined;
  private inspectorMode: 'layer' | 'canvas' | 'hidden' = 'layer';
  private libraryTab: LibraryTab = 'layers';
  private libraryTabs: HTMLDivElement;
  private dead = false;
  private time = 0;
  private playing = false;
  private playStart = 0;
  private playOffset = 0;
  private animationFrame = 0;
  private fitFrame = 0;
  private focusIntent?: HTMLElement;
  private focusFrame = 0;
  private revision = 0;
  private pending?: RenderRequest;
  private rendering = false;
  private renderAbort?: AbortController;
  private drag?: Drag;
  private exporting?: AbortController;
  private exportRenderer?: CanvasRenderer;
  private exportCanvas?: HTMLCanvasElement;
  private lastError = '';
  private templateGallery?: TemplateGallery;

  constructor(container: HTMLElement, private readonly options: EditorOptions) {
    this.doc = container.ownerDocument;
    const win = this.doc.defaultView; if (!win) throw new Error('mountEditor requires a live browser document.');
    this.win = win;
    const instanceId = ++editorSequence;
    this.store = new SceneStore(options.scene ?? createScene({ nodes: [createMockup({ deviceId: 'browser', width: 860, height: 574 })] }));
    this.selectedId = this.store.scene.nodes.at(-1)?.id;
    this.root = element(this.doc, 'div', `ms-editor${options.theme === 'light' ? ' ms-light' : ''}`);
    this.root.tabIndex = -1; this.root.setAttribute('role', 'region'); this.root.setAttribute('aria-label', 'Device Mockup Studio editor');
    const sheet = element(this.doc, 'style'); sheet.textContent = styles; this.root.append(sheet);
    const header = element(this.doc, 'header', 'ms-header');
    const brand = element(this.doc, 'div', 'ms-brand'); const mark = element(this.doc, 'span', 'ms-mark'); mark.append(brandMark(this.doc)); brand.append(mark, element(this.doc, 'span', '', 'Device Mockup Studio'));
    this.undo = this.action('Undo', () => { this.stop(); this.store.undo(); });
    this.redo = this.action('Redo', () => { this.stop(); this.store.redo(); });
    setButtonContent(this.undo, 'Undo', 'Undo2', true); setButtonContent(this.redo, 'Redo', 'Redo2', true);
    const history = element(this.doc, 'div', 'ms-history'); history.setAttribute('role', 'group'); history.setAttribute('aria-label', 'Edit history'); history.append(this.undo, this.redo);
    const spacer = element(this.doc, 'div', 'ms-spacer');
    const tools = element(this.doc, 'div', 'ms-toolbar');
    this.actionsDialog = element(this.doc, 'dialog', 'ms-actions-dialog');
    this.actionsDialog.id = `ms-actions-${instanceId}`;
    const dialogTitle = element(this.doc, 'h2', '', 'Manage'); dialogTitle.id = `${this.actionsDialog.id}-title`;
    this.actionsDialog.setAttribute('aria-labelledby', dialogTitle.id);
    const dialogIntro = element(this.doc, 'p', 'ms-dialog-intro', 'Manage your project, download your work, or change appearance.'); dialogIntro.id = `${this.actionsDialog.id}-description`;
    this.actionsDialog.setAttribute('aria-describedby', dialogIntro.id);
    this.actionsToggle = this.action('Manage studio', () => this.openActions());
    setButtonContent(this.actionsToggle, 'Manage', 'Menu'); this.actionsToggle.setAttribute('aria-label', 'Manage studio');
    this.actionsToggle.setAttribute('aria-haspopup', 'dialog'); this.actionsToggle.setAttribute('aria-controls', this.actionsDialog.id); this.actionsToggle.setAttribute('aria-expanded', 'false');
    this.canvasToggle = this.action('Canvas panel', () => this.toggleInspector());
    setButtonContent(this.canvasToggle, 'Canvas', 'PanelsTopLeft'); this.canvasToggle.setAttribute('aria-controls', `ms-inspector-${instanceId}`); this.canvasToggle.setAttribute('aria-expanded', 'false');
    const closeActions = this.action('Close', () => this.closeActions()); setButtonContent(closeActions, 'Close', 'X', true); closeActions.autofocus = true;
    const dialogHeading = element(this.doc, 'div', 'ms-dialog-header'); dialogHeading.append(dialogTitle, closeActions);
    const closeBefore = (action: () => void) => () => { this.closeActions(); action(); };
    this.fileInput = element(this.doc, 'input'); this.fileInput.type = 'file'; this.fileInput.accept = 'image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp,video/mp4,video/webm,video/ogg,video/quicktime'; this.fileInput.multiple = true; this.fileInput.className = 'ms-hidden'; this.fileInput.setAttribute('aria-label', 'Import media files');
    this.jsonInput = element(this.doc, 'input'); this.jsonInput.type = 'file'; this.jsonInput.accept = '.json,application/json'; this.jsonInput.className = 'ms-hidden'; this.jsonInput.setAttribute('aria-label', 'Load JSON project');
    this.listen(this.fileInput, 'change', () => { const files = Array.from(this.fileInput.files ?? []); this.fileInput.value = ''; void this.importFiles(files); });
    this.listen(this.jsonInput, 'change', () => { const file = this.jsonInput.files?.[0]; this.jsonInput.value = ''; if (file) void this.loadProject(file); });
    const png = this.action('Export PNG', closeBefore(() => { void this.runExport('png'); }), 'ms-primary');
    const webm = this.action('Export video', closeBefore(() => { void this.runExport('webm'); }));
    const gif = this.action('Export GIF', closeBefore(() => { void this.runExport('gif'); }));
    gif.title = 'Download a looping animated GIF (up to 30 fps, 256 colors per frame)';
    png.title = 'Download a PNG image at the canvas size'; webm.title = 'Download an animated WebM video';
    // Runtime feature detection only; the editor module itself has no browser dependency.
    if (typeof globalThis.VideoEncoder === 'undefined') webm.title = 'WebM requires browser WebCodecs (VideoEncoder). Click for details.';
    this.exportButtons.push(png, webm, gif);
    this.cancelButton = this.action('Cancel export', () => this.exporting?.abort()); this.cancelButton.classList.add('ms-hidden');
    const save = this.action('Save project', closeBefore(() => { void this.saveProject(); })); save.title = 'Download an editable project (.json), including your media';
    const open = this.action('Open project', closeBefore(() => this.jsonInput.click())); open.title = 'Open a previously saved Device Mockup Studio project (.json)';
    this.themeToggle = this.action('Light mode', () => this.setTheme(this.getTheme() === 'dark' ? 'light' : 'dark'));
    this.setTheme(options.theme ?? 'dark');
    const projectActions = element(this.doc, 'section', 'ms-dialog-section'); projectActions.append(element(this.doc, 'h3', '', 'Project'), this.action('Upload media', closeBefore(() => this.fileInput.click())), save, open);
    const exportActions = element(this.doc, 'section', 'ms-dialog-section'); exportActions.append(element(this.doc, 'h3', '', 'Export'), png, webm, gif);
    const appearance = element(this.doc, 'section', 'ms-dialog-section'); appearance.append(element(this.doc, 'h3', '', 'Appearance'), this.themeToggle);
    this.actionsDialog.append(dialogHeading, dialogIntro, projectActions, exportActions, appearance);
    this.listen(this.actionsDialog, 'cancel', event => { event.preventDefault(); this.closeActions(); });
    this.listen(this.actionsDialog, 'close', () => { this.actionsToggle.setAttribute('aria-expanded', String(this.actionsDialog.open)); if (!this.dead && !this.actionsDialog.open) this.actionsToggle.focus({ preventScroll: true }); });
    let backdropPress = false;
    this.listen(this.actionsDialog, 'pointerdown', event => { backdropPress = event.target === this.actionsDialog && this.outsideActions(event as PointerEvent); });
    this.listen(this.actionsDialog, 'click', event => { if (backdropPress && event.target === this.actionsDialog && this.outsideActions(event as MouseEvent)) this.closeActions(); backdropPress = false; });
    tools.append(history, this.canvasToggle, this.actionsToggle, this.cancelButton);
    header.append(brand, spacer, tools, this.fileInput, this.jsonInput);
    this.guide = element(this.doc, 'section', 'ms-guide'); this.guide.setAttribute('aria-label', 'Quick start guide');
    const welcome = element(this.doc, 'div', 'ms-guide-intro'); welcome.append(element(this.doc, 'strong', '', 'Make this mockup yours'), element(this.doc, 'span', '', 'Start with the example. Create in three steps.'));
    const steps = element(this.doc, 'ol', 'ms-steps');
    const guideSteps: [string, string, () => void][] = [
      ['Add your screenshot', 'Replace the selected screen', () => {
        const scene = this.store.scene, mesh = scene.nodes.find(n => n.id === this.selectedId && n.type === 'mesh') ?? scene.nodes.find(n => n.type === 'mesh');
        if (mesh) {
          this.select(mesh.id);
          const material = Array.from(this.inspector.querySelectorAll<HTMLDetailsElement>('details[data-section]')).find(node => node.dataset.section === 'Physical material');
          if (material) { material.open = true; material.scrollIntoView({ block: 'nearest' }); material.querySelector('select')?.focus(); }
        } else this.fileInput.click();
      }],
      ['Make it your own', 'Try a style, device, or text', () => { this.setLibraryTab('presets'); this.setLibrary(true); this.catalog.querySelector<HTMLButtonElement>('button')?.focus(); }],
      ['Export your mockup', 'Download a full-size PNG', () => { void this.runExport('png'); }],
    ];
    guideSteps.forEach(([title, hint, action], index) => { const item = element(this.doc, 'li'); const choice = this.action(title, action, 'ms-guide-step'); const copy = element(this.doc, 'span'); copy.append(element(this.doc, 'strong', '', title), element(this.doc, 'small', '', hint)); choice.replaceChildren(element(this.doc, 'span', 'ms-step-number', String(index + 1)), copy); item.append(choice); steps.append(item); });
    const hideGuide = this.action('Hide guide', () => { this.guide.hidden = true; this.queueFit(); }); setButtonContent(hideGuide, 'Hide guide', 'X', true);
    this.guide.append(welcome, steps, hideGuide);
    this.notice = element(this.doc, 'div', 'ms-notice'); this.notice.hidden = true; this.notice.setAttribute('role', 'alert');
    const workspace = element(this.doc, 'div', 'ms-workspace');
    const left = element(this.doc, 'aside', 'ms-left'); left.setAttribute('aria-label', 'Library and layers'); left.id = `ms-library-${instanceId}`;
    const libraryHeading = element(this.doc, 'div', 'ms-library-heading');
    this.libraryClose = this.action('Close library', () => this.setLibrary(false)); setButtonContent(this.libraryClose, 'Close library', 'X', true); libraryHeading.append(this.libraryClose);
    this.libraryTabs = element(this.doc, 'div', 'ms-tabs ms-library-tabs'); this.libraryTabs.setAttribute('role', 'tablist'); this.libraryTabs.setAttribute('aria-label', 'Layers and assets');
    this.libraryPanel = element(this.doc, 'div', 'ms-library-panel'); this.libraryPanel.id = `ms-library-content-${instanceId}`; this.libraryPanel.setAttribute('role', 'tabpanel'); this.libraryPanel.tabIndex = 0;
    this.catalog = element(this.doc, 'div', 'ms-catalog'); this.layers = element(this.doc, 'div', 'ms-layers'); this.libraryPanel.append(this.layers, this.catalog); left.append(libraryHeading, this.libraryTabs, this.libraryPanel);
    this.listen(this.libraryTabs, 'keydown', event => {
      const key = event as KeyboardEvent, index = libraryTabNames.indexOf(this.libraryTab);
      const next = key.key === 'ArrowRight' ? (index + 1) % libraryTabNames.length : key.key === 'ArrowLeft' ? (index + libraryTabNames.length - 1) % libraryTabNames.length : key.key === 'Home' ? 0 : key.key === 'End' ? libraryTabNames.length - 1 : undefined;
      if (next === undefined) return;
      key.preventDefault(); key.stopPropagation(); this.setLibraryTab(libraryTabNames[next]!);
      this.libraryTabs.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    });
    const stage = element(this.doc, 'main', 'ms-stage');
    const bar = element(this.doc, 'div', 'ms-stage-bar');
    this.buffer = element(this.doc, 'canvas'); this.renderer = this.createRenderer(this.buffer);
    const add3d = this.action('3D object', () => this.addMesh());
    add3d.disabled = !this.renderer.supportsSpatial;
    if (add3d.disabled) add3d.title = '3D objects require SpatialRenderer. Pass rendererFactory when mounting the editor.';
    this.libraryToggle = this.action('Library', () => this.setLibrary(!this.root.classList.contains('ms-show-library')), 'ms-mobile-toggle'); this.libraryToggle.setAttribute('aria-expanded', 'false'); this.libraryToggle.setAttribute('aria-controls', left.id);
    this.propertiesToggle = this.action('Properties', () => this.openProperties(), 'ms-properties-toggle');
    setButtonContent(this.propertiesToggle, 'Properties', 'MousePointer2'); this.propertiesToggle.setAttribute('aria-haspopup', 'dialog'); this.propertiesToggle.setAttribute('aria-expanded', 'false'); this.propertiesToggle.setAttribute('aria-controls', `ms-properties-${instanceId}`);
    this.dimensions = element(this.doc, 'span', 'ms-dimensions');
    const help = this.action('Quick start', () => { this.guide.hidden = !this.guide.hidden; this.queueFit(); }); setButtonContent(help, 'Quick start', 'CircleHelp', true);
    const snap = this.action('Snap', () => { this.snapping = !this.snapping; snap.setAttribute('aria-pressed', String(this.snapping)); this.clearGuides(); });
    setButtonContent(snap, 'Snap', 'Magnet'); snap.setAttribute('aria-pressed', 'true'); snap.title = 'Snap to edges and centers · Hold Alt/Option to bypass';
    bar.append(this.libraryToggle, this.action('Mockup', () => this.addDevice('browser')), this.action('Text', () => this.addText(false)), this.action('Shape', () => this.addShape()), add3d, this.action('Watermark', () => this.addText(true)), this.propertiesToggle, snap, element(this.doc, 'div', 'ms-spacer'), this.dimensions, help);
    this.viewport = element(this.doc, 'div', 'ms-viewport'); this.wrap = element(this.doc, 'div', 'ms-canvas-wrap');
    this.view = element(this.doc, 'canvas'); this.view.setAttribute('aria-label', 'Composition canvas. Drag to position. Alt or Option bypasses snapping; Shift constrains movement. Arrow keys move 1 pixel, Shift moves 10.'); this.view.tabIndex = 0;
    this.selection = this.doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); this.selection.classList.add('ms-selection'); this.selection.setAttribute('aria-hidden', 'true');
    this.snapGuides = this.doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); this.snapGuides.classList.add('ms-selection', 'ms-snap-guides'); this.snapGuides.setAttribute('aria-hidden', 'true');
    this.wrap.append(this.view, this.selection, this.snapGuides); this.viewport.append(this.wrap);
    const timeline = element(this.doc, 'details', 'ms-timeline'); timeline.open = this.store.scene.tracks.length > 0;
    const timelineSummary = element(this.doc, 'summary'); timelineSummary.append(icon(this.doc, 'Film'), element(this.doc, 'strong', '', 'Animation'), element(this.doc, 'span', '', 'Optional'), icon(this.doc, 'ChevronDown')); timeline.append(timelineSummary);
    this.listen(timeline, 'toggle', () => this.queueFit());
    const controls = element(this.doc, 'div', 'ms-time-controls'); this.play = this.action('Play', () => this.togglePlay());
    this.scrubber = element(this.doc, 'input'); this.scrubber.type = 'range'; this.scrubber.min = '0'; this.scrubber.value = '0'; this.scrubber.setAttribute('aria-label', 'Timeline playhead in seconds');
    this.listen(this.scrubber, 'input', () => { this.stop(); this.time = this.scrubber.valueAsNumber; this.updateTimeline(); this.schedule(this.store.scene); });
    this.timeLabel = element(this.doc, 'span', 'ms-time-label');
    this.track = element(this.doc, 'div', 'ms-track'); controls.append(this.play, this.scrubber, this.timeLabel); timeline.append(controls, this.track);
    this.setupTimelineMotion(timeline, timelineSummary);
    stage.append(bar, this.viewport, timeline);
    const backdrop = this.action('Close library', () => this.setLibrary(false), 'ms-library-backdrop'); backdrop.tabIndex = -1;
    this.inspector = element(this.doc, 'aside', 'ms-right'); this.inspector.id = `ms-inspector-${instanceId}`; this.inspector.setAttribute('aria-label', 'Properties inspector'); workspace.append(left, stage, this.inspector, backdrop);
    this.propertiesDialog = element(this.doc, 'dialog', 'ms-properties-dialog'); this.propertiesDialog.id = `ms-properties-${instanceId}`; this.propertiesDialog.setAttribute('aria-label', 'Layer properties');
    this.listen(this.propertiesDialog, 'cancel', event => { event.preventDefault(); this.closeProperties(); });
    this.listen(this.propertiesDialog, 'click', event => {
      if (event.target !== this.propertiesDialog) return;
      const rect = this.propertiesDialog.getBoundingClientRect(), pointer = event as MouseEvent;
      if (pointer.clientY < rect.top || pointer.clientX < rect.left || pointer.clientX > rect.right || pointer.clientY > rect.bottom) this.closeProperties();
    });
    this.status = element(this.doc, 'span', 'ms-sr-only', 'Ready · Upload a screenshot to replace the example'); this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
    this.root.append(header, this.guide, this.notice, workspace, this.status, this.actionsDialog, this.propertiesDialog); container.append(this.root);
    this.setupLibraryResize(left);
    this.listen(this.view, 'pointerdown', event => this.pointerDown(event as PointerEvent));
    this.listen(this.view, 'pointermove', event => this.pointerMove(event as PointerEvent));
    this.listen(this.view, 'pointerup', event => this.pointerEnd(event as PointerEvent, true));
    this.listen(this.view, 'pointercancel', event => this.pointerEnd(event as PointerEvent, false));
    this.listen(this.view, 'lostpointercapture', event => this.pointerEnd(event as PointerEvent, false));
    this.listen(this.root, 'keydown', event => this.keyDown(event as KeyboardEvent));
    this.listen(this.win, 'keyup', event => {
      const key = (event as KeyboardEvent).key;
      this.nudgeKeys.delete(key); if (!this.nudgeKeys.size) this.finishNudge();
      if (key === 'Alt' || key === 'Shift') this.updateDragModifiers(event as KeyboardEvent);
    });
    this.listen(this.view, 'blur', () => { this.finishNudge(); this.cancelDrag(); });
    this.listen(this.win, 'blur', () => { this.finishNudge(); this.cancelDrag(); });
    this.listen(this.root, 'pointerdown', event => { const target = (event.target as Element | null)?.closest<HTMLElement>('button,input,select,textarea,summary,canvas'); if (target) this.rememberFocus(target); });
    this.listen(this.root, 'focusin', () => undefined);
    this.listen(this.win, 'resize', () => { if (!this.win.matchMedia('(max-width: 560px)').matches && this.propertiesDialog.open) this.closeProperties(false); this.queueFit(); });
    if (typeof ResizeObserver !== 'undefined') { this.observer = new ResizeObserver(() => this.queueFit()); this.observer.observe(this.viewport); }
    this.unsubscribe = this.store.subscribe(scene => {
      if (this.dead) return;
      this.safe(() => {
        this.stop();
        const movement = this.drag ?? this.nudge;
        if (movement && (scene.id !== movement.original.id || scene.width !== movement.original.width || scene.height !== movement.original.height || !scene.nodes.some(n => n.id === movement.id && !n.locked && n.visible && n.opacity > 0))) {
          this.nudge = undefined; this.nudgeKeys.clear(); this.cancelDrag();
        }
        if (!scene.nodes.some(n => n.id === this.selectedId)) this.selectedId = undefined;
        this.time = Math.min(this.time, scene.duration); this.refresh(scene); this.schedule(scene);
        if (this.drag || this.nudge) this.previewMovement((this.drag ?? this.nudge)!);
        options.onChange?.(scene);
      });
    });
    this.refresh(this.store.scene); this.schedule(this.store.scene); this.queueFit();
  }

  private createRenderer(canvas: HTMLCanvasElement): CanvasRenderer {
    return this.options.rendererFactory?.(canvas) ?? new CanvasRenderer(canvas);
  }
  private listen(target: EventTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener); this.listeners.push(() => target.removeEventListener(type, listener));
  }
  private animate(element: HTMLElement, frames: Keyframe[], complete?: () => void): void {
    this.motions.get(element)?.cancel(); this.motions.delete(element);
    if (this.dead || this.win.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof element.animate !== 'function') { complete?.(); return; }
    const motion = element.animate(frames, { duration:220, easing:'cubic-bezier(.2,.8,.2,1)' });
    this.motions.set(element, motion);
    void motion.finished.then(() => {
      if (this.motions.get(element) !== motion) return;
      this.motions.delete(element); if (!this.dead) complete?.();
    }).catch(() => { /* A new interaction can replace an in-flight transition. */ });
  }
  private setupTimelineMotion(timeline: HTMLDetailsElement, summary: HTMLElement): void {
    timeline.dataset.expanded = String(timeline.open);
    this.listen(summary, 'click', event => {
      event.preventDefault();
      const expanded = timeline.dataset.expanded !== 'true';
      const height = timeline.getBoundingClientRect().height;
      this.motions.get(timeline)?.cancel(); this.motions.delete(timeline);
      timeline.dataset.expanded = String(expanded); timeline.open = true;
      const targetHeight = expanded ? timeline.getBoundingClientRect().height : summary.getBoundingClientRect().height + 1;
      timeline.style.overflow = 'hidden';
      this.animate(timeline, [{ height:`${height}px` }, { height:`${targetHeight}px` }], () => {
        timeline.open = expanded; timeline.style.removeProperty('overflow'); this.queueFit();
      });
      this.queueFit();
    });
  }
  private setupLibraryResize(panel: HTMLElement): void {
    const handle = element(this.doc, 'div', 'ms-library-resizer');
    handle.tabIndex = 0; handle.setAttribute('role', 'separator'); handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', 'Resize left sidebar'); handle.setAttribute('aria-controls', panel.id);
    handle.title = 'Drag to resize sidebar. Use arrow keys when focused.';
    panel.append(handle);
    let width: number | undefined;
    let drag: { pointerId: number; x: number; width: number } | undefined;
    const bounds = () => {
      const max = Math.floor(Math.min(this.win.innerWidth, this.root.clientWidth) * .4);
      return { min: Math.min(180, max), max };
    };
    const sync = () => {
      const { min, max } = bounds();
      if (width !== undefined) {
        width = Math.max(min, Math.min(max, width));
        this.root.style.setProperty('--ms-library-width', `${width}px`);
      }
      handle.setAttribute('aria-valuemin', String(min)); handle.setAttribute('aria-valuemax', String(max));
      const current = width ?? (panel.getBoundingClientRect().width || min);
      handle.setAttribute('aria-valuenow', String(Math.round(Math.max(min, Math.min(max, current)))));
    };
    const resize = (next: number) => { width = next; sync(); this.queueFit(); };
    this.listen(handle, 'pointerdown', event => {
      const pointer = event as PointerEvent;
      if (pointer.button !== 0 || drag) return;
      event.preventDefault(); handle.focus({ preventScroll: true });
      handle.setPointerCapture(pointer.pointerId);
      drag = { pointerId: pointer.pointerId, x: pointer.clientX, width: panel.getBoundingClientRect().width };
      this.root.classList.add('ms-resizing-library');
    });
    this.listen(handle, 'pointermove', event => {
      const pointer = event as PointerEvent;
      if (drag?.pointerId === pointer.pointerId) resize(drag.width + pointer.clientX - drag.x);
    });
    const finish = (event: Event) => {
      const pointer = event as PointerEvent;
      if (drag?.pointerId !== pointer.pointerId) return;
      drag = undefined; this.root.classList.remove('ms-resizing-library');
      if (handle.hasPointerCapture(pointer.pointerId)) handle.releasePointerCapture(pointer.pointerId);
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.listen(handle, type, finish);
    this.listen(handle, 'keydown', event => {
      const key = event as KeyboardEvent, { min, max } = bounds(), current = panel.getBoundingClientRect().width;
      const next = key.key === 'ArrowLeft' ? current - 10 : key.key === 'ArrowRight' ? current + 10 : key.key === 'Home' ? min : key.key === 'End' ? max : undefined;
      if (next === undefined) return;
      event.preventDefault(); event.stopPropagation(); resize(next);
    });
    this.listen(this.win, 'resize', sync);
    sync();
  }
  private action(label: string, action: () => void, className = ''): HTMLButtonElement {
    return button(this.doc, label, () => { if (!this.dead) this.safe(action); }, className);
  }
  private safe(action: () => void): void { try { action(); } catch (error) { this.fail(error); } }
  private fail(cause: unknown): void {
    if (this.dead) return;
    const error = cause instanceof Error ? cause : new Error(String(cause));
    this.status.textContent = error.message; this.status.classList.add('ms-error');
    const dismiss = this.action('Dismiss message', () => { this.notice.hidden = true; this.queueFit(); }); setButtonContent(dismiss, 'Dismiss message', 'X', true);
    this.notice.replaceChildren(element(this.doc, 'span', '', error.message), dismiss); this.notice.hidden = false; this.queueFit();
    if (error.message !== this.lastError) { this.lastError = error.message; try { this.options.onError?.(error); } catch { /* Error observers cannot break the editor. */ } }
  }
  private message(message: string): void { if (this.dead) return; this.status.textContent = message; this.status.classList.remove('ms-error'); if (!this.notice.hidden) { this.notice.hidden = true; this.queueFit(); } this.lastError = ''; }
  private update(edit: (scene: SceneDocument) => void): boolean {
    this.finishNudge(); this.cancelDrag();
    let succeeded = false;
    this.safe(() => { this.stop(); this.message('Updated · Save project to download an editable copy'); this.store.update(edit); succeeded = true; });
    if (!this.dead) this.renderInspector();
    return succeeded;
  }
  getScene(): SceneDocument { return this.store.scene; }
  getTheme(): 'dark' | 'light' { return this.root.classList.contains('ms-light') ? 'light' : 'dark'; }
  setTheme(theme: 'dark' | 'light'): void {
    if (this.dead) return;
    const changed = this.getTheme() !== theme;
    this.root.classList.toggle('ms-light', theme === 'light');
    const label = theme === 'light' ? 'Dark mode' : 'Light mode';
    setButtonContent(this.themeToggle, label, theme === 'light' ? 'Moon' : 'Sun');
    this.themeToggle.setAttribute('aria-label', `Switch to ${label.toLowerCase()}`); this.themeToggle.title = `Switch to ${label.toLowerCase()}`;
    if (changed) this.safe(() => this.options.onThemeChange?.(theme));
  }
  setScene(scene: SceneDocument, recordHistory = true): void {
    if (this.dead) throw new Error('Editor has been destroyed.');
    this.nudge = undefined; this.nudgeKeys.clear(); this.cancelDrag();
    this.stop(); this.time = 0; this.selectedId = scene.nodes.at(-1)?.id;
    this.inspectorMode = this.selectedId ? 'layer' : 'hidden';
    this.store.setScene(scene, recordHistory); this.refresh(this.store.scene); this.schedule(this.store.scene);
  }
  private refresh(scene: SceneDocument): void {
    this.undo.disabled = !this.store.canUndo; this.redo.disabled = !this.store.canRedo;
    const spatial = scene.nodes.some(node => node.type === 'mesh');
    const firstStep = this.guide.querySelector<HTMLButtonElement>('.ms-guide-step');
    if (firstStep) { const title = spatial ? 'Explore a material' : 'Add your screenshot'; firstStep.setAttribute('aria-label', title); firstStep.title = title; firstStep.querySelector('strong')!.textContent = title; firstStep.querySelector('small')!.textContent = spatial ? 'Try glass, metal, or ceramic' : 'Replace the selected screen'; }
    this.renderLibrary(scene); this.renderLayers(scene); this.renderInspector(); this.updateTimeline(); this.drawSelection(scene); this.queueFit();
  }
  private retainFocus(): () => void {
    const previous = this.focusIntent?.isConnected ? this.focusIntent : this.doc.activeElement as HTMLElement | null;
    if (!previous || !this.root.contains(previous)) return () => undefined;
    const label = previous.getAttribute('aria-label');
    const editable = previous as HTMLInputElement | HTMLTextAreaElement;
    const start = 'selectionStart' in editable ? editable.selectionStart : null, end = 'selectionEnd' in editable ? editable.selectionEnd : null;
    return () => {
      if (previous.isConnected || this.dead) return;
      const replacement = label ? Array.from(this.root.querySelectorAll<HTMLElement>('[aria-label]')).find(node => node.getAttribute('aria-label') === label) : undefined;
      (replacement ?? this.root).focus({ preventScroll: true });
      if (replacement && start !== null && end !== null && 'setSelectionRange' in replacement) (replacement as HTMLInputElement).setSelectionRange(start, end);
    };
  }
  private rememberFocus(target: HTMLElement): void {
    this.focusIntent = target; this.win.cancelAnimationFrame(this.focusFrame);
    this.focusFrame = this.win.requestAnimationFrame(() => {
      const label = target.getAttribute('aria-label');
      if (!this.dead && !target.isConnected && label && (this.doc.activeElement === this.doc.body || this.doc.activeElement === this.root)) {
        Array.from(this.root.querySelectorAll<HTMLElement>('[aria-label]')).find(node => node.getAttribute('aria-label') === label)?.focus({ preventScroll: true });
      }
      this.focusIntent = undefined; this.focusFrame = 0;
    });
  }
  private renderInspector(): void {
    if (this.dead) return;
    this.syncLayerProtection();
    const restoreFocus = this.retainFocus();
    const mode = this.inspectorMode === 'canvas' ? 'canvas' : this.selectedId ? 'layer' : 'hidden';
    const previousMode = this.inspector.dataset.mode, scroll = this.inspector.scrollTop;
    const previousContext = this.inspector.dataset.context;
    this.root.classList.toggle('ms-inspector-hidden', mode === 'hidden');
    this.canvasToggle.setAttribute('aria-expanded', String(mode === 'canvas'));
    this.inspector.dataset.mode = mode;
    this.propertiesToggle.disabled = mode === 'hidden';
    if (mode === 'hidden') {
      if (this.propertiesDialog.open) this.closeProperties();
      if (this.inspector.contains(this.doc.activeElement)) this.canvasToggle.focus({ preventScroll:true });
      this.inspector.inert = true; this.inspector.setAttribute('aria-hidden', 'true');
      if (previousMode !== 'hidden') {
        const finish = () => { this.inspector.hidden = true; this.inspector.replaceChildren(); this.queueFit(); };
        if (previousMode) this.animate(this.inspector, [{ opacity:1, transform:'translateX(0)' }, { opacity:0, transform:'translateX(20px)' }], finish);
        else finish();
      }
      restoreFocus(); return;
    }
    this.inspector.hidden = false; this.inspector.inert = false; this.inspector.removeAttribute('aria-hidden');
    renderInspector({ doc: this.doc, parent: this.inspector, scene: this.store.scene, selectedId: this.selectedId, mode, supportsSpatial: this.renderer.supportsSpatial, importMedia: () => { if (!this.layerLocked()) this.fileInput.click(); }, close: () => this.closeProperties(),
      update: edit => this.update(edit), align: value => this.align(value), duplicate: () => this.duplicate(), remove: () => this.remove(), reorder: direction => this.reorder(direction), generateBackground: () => { void this.generateBackground(); } });
    if (mode === 'canvas') {
      const heading = element(this.doc, 'header', 'ms-properties-header ms-properties-heading'); heading.append(element(this.doc, 'h2', '', 'Canvas properties'));
      const close = this.action('Close properties', () => this.closeProperties(), 'ms-properties-close'); setButtonContent(close, 'Close properties', 'X', true); heading.append(close); this.inspector.prepend(heading);
    }
    this.propertiesDialog.setAttribute('aria-label', mode === 'canvas' ? 'Canvas properties' : `Properties: ${this.store.scene.nodes.find(n => n.id === this.selectedId)?.name || 'Selected layer'}`);
    this.inspector.scrollTop = previousMode === mode && previousContext === this.inspector.dataset.context ? scroll : 0; restoreFocus();
    if (previousMode && previousMode !== mode) this.animate(this.inspector, [{ opacity:0, transform:'translateX(20px)' }, { opacity:1, transform:'translateX(0)' }]);
  }
  private toggleInspector(): void {
    if (this.inspectorMode === 'canvas') this.inspectorMode = this.selectedId ? 'layer' : 'hidden';
    else this.inspectorMode = 'canvas';
    this.renderInspector(); this.queueFit();
    if (this.win.matchMedia('(max-width: 560px)').matches) this.openProperties();
  }
  private openProperties(): void {
    if (!this.win.matchMedia('(max-width: 560px)').matches || this.propertiesDialog.open || this.inspector.dataset.mode === 'hidden') return;
    this.propertiesReturnFocus = this.doc.activeElement as HTMLElement;
    this.setLibrary(false); this.propertiesDialog.append(this.inspector); this.propertiesDialog.showModal();
    this.propertiesToggle.setAttribute('aria-expanded', 'true'); this.inspector.querySelector<HTMLButtonElement>('.ms-properties-close')?.focus({ preventScroll: true });
  }
  private closeProperties(restoreFocus = true): void {
    if (!this.propertiesDialog.open) return;
    this.propertiesDialog.close(); this.root.querySelector('.ms-workspace')!.append(this.inspector); this.propertiesToggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      const previous = this.propertiesReturnFocus;
      const fallback = this.propertiesToggle.disabled ? this.canvasToggle : this.propertiesToggle;
      (previous?.isConnected && previous.getClientRects().length && !previous.matches(':disabled') ? previous : fallback).focus({ preventScroll: true });
    } else this.view.focus({ preventScroll: true });
  }
  private layerLocked(id = this.selectedId): boolean {
    return this.store.scene.nodes.find(node => node.id === id)?.locked ?? false;
  }
  private syncLayerProtection(): void {
    const locked = this.layerLocked();
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('button[aria-label="Upload media"],button.ms-device,button.ms-media')) button.disabled = locked;
    const guideImport = this.guide.querySelector<HTMLButtonElement>('.ms-guide-step');
    if (guideImport) guideImport.disabled = locked && !this.store.scene.nodes.some(node => node.type === 'mesh');
  }
  private async generateBackground(): Promise<void> {
    try {
      const scene = this.store.scene;
      const selected = scene.nodes.find(n => n.id === this.selectedId);
      const id = selected?.type === 'mockup' ? selected.assetId : undefined;
      const asset = scene.assets.find(a => a.id === id) ?? scene.assets.find(a => a.kind === 'image');
      if (!asset) throw new Error('Import an image or video before generating a background.');
      const source = await this.renderer.assets.load(asset);
      if (this.dead) return;
      const result = createMagicBackground(source, { canvasFactory: (w, h) => { const c = this.doc.createElement('canvas'); c.width=w;c.height=h;return c; } });
      this.update(draft => { draft.background = result.background; });
      this.message('Local media-derived palette applied · No upload or AI service used');
    } catch (error) { this.fail(error); }
  }
  private select(id?: string): void {
    this.finishNudge(); this.cancelDrag();
    this.selectedId = id;
    if (id) this.inspectorMode = 'layer'; else this.inspectorMode = 'hidden';
    this.renderLayers(this.store.scene); this.renderInspector(); this.drawSelection(this.store.scene); this.updateTimeline(); this.queueFit();
  }
  private setLibrary(open: boolean): void {
    this.root.classList.toggle('ms-show-library', open); this.libraryToggle.setAttribute('aria-expanded', String(open));
    if (this.win.matchMedia('(max-width: 820px)').matches) (open ? this.libraryClose : this.libraryToggle).focus();
  }
  private openActions(): void {
    if (this.actionsDialog.open && !this.actionsClosing) return;
    this.actionsClosing = false; this.actionsDialog.classList.remove('ms-dialog-closing');
    if (this.root.classList.contains('ms-show-library')) this.setLibrary(false);
    if (!this.actionsDialog.open) this.actionsDialog.showModal();
    this.actionsToggle.setAttribute('aria-expanded', 'true');
    this.animate(this.actionsDialog, [{ opacity:0, transform:'translateY(12px) scale(.97)' }, { opacity:1, transform:'translateY(0) scale(1)' }]);
  }
  private closeActions(): void {
    if (this.dead) {
      if (this.actionsDialog.open) this.actionsDialog.close();
      this.actionsToggle.setAttribute('aria-expanded', 'false'); return;
    }
    if (!this.actionsDialog.open || this.actionsClosing) return;
    this.actionsClosing = true; this.actionsDialog.classList.add('ms-dialog-closing');
    this.animate(this.actionsDialog, [{ opacity:1, transform:'translateY(0) scale(1)' }, { opacity:0, transform:'translateY(8px) scale(.98)' }], () => {
      this.actionsDialog.close(); this.actionsClosing = false; this.actionsDialog.classList.remove('ms-dialog-closing');
      this.actionsToggle.setAttribute('aria-expanded', 'false');
    });
  }
  private outsideActions(event: MouseEvent): boolean {
    const bounds = this.actionsDialog.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  }
  private setLibraryTab(tab: LibraryTab): void {
    const previous = this.libraryTab;
    this.libraryTab = tab; this.libraryPanel.scrollTop = 0; this.renderLibrary(this.store.scene);
    if (previous !== tab) {
      const direction = libraryTabNames.indexOf(tab) > libraryTabNames.indexOf(previous) ? 1 : -1;
      this.animate(this.libraryPanel, [{ opacity:0, transform:`translateX(${direction * 10}px)` }, { opacity:1, transform:'translateX(0)' }]);
    }
  }
  private renderLibrary(scene: SceneDocument): void {
    const restoreFocus = this.retainFocus();
    this.libraryTabs.replaceChildren();
    for (const tab of libraryTabNames) {
      const selected = this.libraryTab === tab;
      const choice = this.action(tab[0]!.toUpperCase() + tab.slice(1), () => this.setLibraryTab(tab), selected ? 'ms-selected' : 'ms-quiet');
      choice.id = `${this.libraryPanel.id}-${tab}`; choice.setAttribute('role', 'tab'); choice.setAttribute('aria-selected', String(selected)); choice.setAttribute('aria-controls', this.libraryPanel.id); choice.tabIndex = selected ? 0 : -1;
      this.libraryTabs.append(choice);
      if (selected) this.libraryPanel.setAttribute('aria-labelledby', choice.id);
    }
    this.layers.hidden = this.libraryTab !== 'layers'; this.catalog.hidden = this.libraryTab === 'layers';
    this.catalog.replaceChildren();
    if (this.libraryTab === 'layers') { restoreFocus(); return; }
    if (this.libraryTab === 'presets') {
      this.templateGallery ??= new TemplateGallery(this.doc, this.libraryPanel, this.renderer.supportsSpatial, canvas => this.createRenderer(canvas), id => this.safe(() => {
        const scene = this.store.scene, selected = scene.nodes.find(node => node.id === this.selectedId);
        const next = applyTemplate(scene, id, { assetId:selected?.type === 'mockup' ? selected.assetId : undefined });
        this.setScene(next);
        this.select(next.nodes.find(node => node.name.startsWith('Hero ·'))?.id);
        this.message('Template applied · Edit any layer to make it yours · Undo to restore the previous composition'); this.setLibrary(false);
      }));
      this.catalog.append(this.templateGallery.show(scene));
    } else if (this.libraryTab === 'devices') {
      for (const device of listDevices({ includeLegacy: false })) {
        const choice = this.action(device.name, () => this.chooseDevice(device.id), 'ms-device'); choice.replaceChildren();
        choice.append(deviceThumbnail(this.doc, device), element(this.doc, 'span', '', device.name)); this.catalog.append(choice);
      }
    } else {
      this.catalog.append(this.action('Upload media', () => this.fileInput.click()));
      for (const asset of scene.assets) {
        const choice = this.action(asset.name || asset.id, () => this.assignAsset(asset.id), 'ms-media'); choice.replaceChildren();
        if (asset.kind === 'image') { const image = element(this.doc, 'img'); image.src = asset.src; image.alt = ''; image.loading = 'lazy'; choice.append(image); }
        else choice.append(icon(this.doc, 'Film'));
        choice.append(element(this.doc, 'span', '', asset.name || asset.id)); choice.title = `${asset.name || asset.id} · ${asset.width} × ${asset.height}`; this.catalog.append(choice);
      }
    }
    this.syncLayerProtection(); restoreFocus();
  }
  private renderLayers(scene: SceneDocument): void {
    const restoreFocus = this.retainFocus();
    const title = element(this.doc, 'h3', 'ms-layer-title', `Layers · ${scene.nodes.length}`); this.layers.replaceChildren(title);
    for (const node of [...scene.nodes].reverse()) {
      const row = element(this.doc, 'div', `ms-layer${this.selectedId === node.id ? ' ms-layer-selected' : ''}`);
      const nodeIcon: IconName = node.type === 'mockup' ? 'PanelsTopLeft' : node.type === 'text' ? 'Type' : node.type === 'mesh' ? 'Box' : 'Shapes';
      const name = this.action(node.name || node.type, () => { this.select(node.id); this.setLibrary(false); this.openProperties(); }, 'ms-layer-name'); setButtonContent(name, node.name || node.type, nodeIcon); name.setAttribute('aria-pressed', String(this.selectedId === node.id));
      const visible = this.action(`${node.visible ? 'Hide' : 'Show'} ${node.name}`, () => this.update(s => { const n = s.nodes.find(item => item.id === node.id)!; if (!n.locked) n.visible = !n.visible; }), 'ms-mini'); setButtonContent(visible, visible.title, node.visible ? 'Eye' : 'EyeOff', true); visible.disabled = node.locked;
      const lock = this.action(`${node.locked ? 'Unlock' : 'Lock'} ${node.name}`, () => this.update(s => { const n = s.nodes.find(item => item.id === node.id)!; n.locked = !n.locked; }), 'ms-mini'); setButtonContent(lock, lock.title, node.locked ? 'Lock' : 'Unlock', true);
      row.append(name, visible, lock); this.layers.append(row);
    }
    restoreFocus();
  }
  private addDevice(id: string, assetId?: string): void {
    const scene = this.store.scene, device = getDevice(id), width = Math.min(scene.width * .74, scene.height * .74 * device.aspect);
    const node = createMockup({ name: device.name, deviceId: id, x: scene.width / 2, y: scene.height / 2, width, height: width / device.aspect, radius: device.radius, ...(assetId ? { assetId } : {}) });
    this.selectedId = node.id; this.inspectorMode = 'layer'; this.update(s => { s.nodes.push(node); });
  }
  private chooseDevice(id: string): void {
    this.setLibrary(false);
    const selected = this.store.scene.nodes.find(n => n.id === this.selectedId);
    if (selected?.locked) { this.message('Unlock the selected layer to change its device.'); return; }
    if (selected?.type !== 'mockup') { this.addDevice(id); return; }
    const device = getDevice(id);
    this.update(scene => editNode(scene, selected.id, n => {
      if (n.type !== 'mockup') return;
      n.deviceId = id; n.radius = device.radius; n.width = Math.min(scene.width * .74, scene.height * .74 * device.aspect); n.height = n.width / device.aspect;
    }));
  }
  private addText(watermark: boolean): void {
    const scene = this.store.scene;
    const node = createText({ name: watermark ? 'Watermark' : 'Headline', x: scene.width / 2, y: watermark ? scene.height * .94 : scene.height * .15, width: scene.width * .8, height: scene.height * .1, text: watermark ? 'MADE WITH DEVICE MOCKUP STUDIO' : 'Made to stand out.', fontFamily: 'Outfit', fontSize: scene.width * (watermark ? .014 : .044), fontWeight: watermark ? 500 : 700, opacity: watermark ? .55 : 1 });
    this.selectedId = node.id; this.inspectorMode = 'layer'; this.update(s => { s.nodes.push(node); });
  }
  private addShape(): void {
    const scene = this.store.scene, size = Math.min(scene.width, scene.height) * .24;
    const node = createShape({ x: scene.width / 2, y: scene.height / 2, width: size, height: size, fill: '#709aff', name: 'Accent shape' });
    this.selectedId = node.id; this.inspectorMode = 'layer'; this.update(s => { s.nodes.push(node); });
  }
  private addMesh(): void {
    if (!this.renderer.supportsSpatial) throw new Error('3D objects require SpatialRenderer.');
    const scene = this.store.scene;
    if (scene.nodes.filter(n => n.type === 'mesh').length >= 32) throw new Error('A scene supports at most 32 3D objects.');
    const size = Math.min(scene.width, scene.height) * .26;
    const node = createMesh({ x: scene.width / 2, y: scene.height / 2, width: size, height: size, depth: size * .65, name: '3D volume' });
    this.selectedId = node.id; this.inspectorMode = 'layer';
    this.update(draft => { draft.spatial = createSpatialSettings({ ...draft.spatial, enabled: true }); draft.nodes.push(node); });
  }
  private assignAsset(id: string): void {
    const node = this.store.scene.nodes.find(n => n.id === this.selectedId);
    if (node?.locked) { this.message('Unlock the selected layer to replace its media.'); return; }
    if (node?.type === 'mockup') this.update(s => { const target = s.nodes.find(n => n.id === node.id); if (target?.type === 'mockup') target.assetId = id; });
    else this.addDevice('browser', id);
  }
  private duplicate(): void {
    if (!this.selectedId || this.layerLocked()) return;
    this.safe(() => { this.stop(); const copy = this.store.duplicateNode(this.selectedId!); this.select(copy.id); });
  }
  private remove(): void {
    if (!this.selectedId || this.layerLocked()) return;
    const id = this.selectedId;
    this.update(scene => { scene.nodes = scene.nodes.filter(n => n.id !== id); scene.tracks = scene.tracks.filter(t => t.nodeId !== id); });
  }
  private reorder(direction: number): void {
    if (this.layerLocked()) return;
    this.update(scene => {
      const index = scene.nodes.findIndex(n => n.id === this.selectedId), target = index + direction;
      if (index < 0 || target < 0 || target >= scene.nodes.length) return;
      const [node] = scene.nodes.splice(index, 1); scene.nodes.splice(target, 0, node!);
    });
  }
  private async importFiles(files: File[]): Promise<void> {
    try {
      if (!files.length || this.dead) return;
      const targetId = this.selectedId;
      if (this.layerLocked(targetId)) { this.message('Unlock the selected layer to replace its media.'); return; }
      this.message('Importing media…');
      // Sequential imports avoid unbounded decoder allocations and preserve file order.
      const imported: Asset[] = [];
      for (const file of files) { if (this.dead) return; imported.push(await this.renderer.assets.importFile(file)); }
      if (this.dead || !imported.length) return;
      if (this.layerLocked(targetId)) throw new Error('The target layer was locked while importing. Unlock it and try again.');
      const succeeded = this.update(scene => {
        scene.assets.push(...imported);
        let target = scene.nodes.find(n => n.id === targetId);
        imported.forEach((asset, index) => {
          if (index === 0 && target?.type === 'mockup') target.assetId = asset.id;
          else {
            const width = Math.min(scene.width * .74, scene.height * .74 * 1.5);
            const node = createMockup({ name: asset.name || 'Imported media', assetId: asset.id, deviceId: 'browser', x: scene.width / 2 + index * 16, y: scene.height / 2 + index * 16, width, height: width / 1.5 });
            scene.nodes.push(node); target = node; this.selectedId = node.id;
          }
        });
      });
      if (!succeeded) return;
      this.setLibraryTab('media'); this.inspectorMode = 'layer'; this.renderInspector(); this.setLibrary(false); this.message(`Added ${imported.length} ${imported.length === 1 ? 'file' : 'files'} · Your mockup is ready to customize`);
    } catch (error) { this.fail(error); }
  }
  private async loadProject(file: File): Promise<void> {
    try {
      if (file.size > 180 * 1024 * 1024) throw new Error('JSON project exceeds the 180 MiB loading limit.');
      const scene = deserializeScene(await file.text()); if (this.dead) return;
      this.setScene(scene); this.message('Project loaded · Media is being prepared');
    } catch (error) { this.fail(error); }
  }
  private async saveProject(): Promise<void> {
    try {
      this.message('Preparing your editable project…');
      const scene = this.store.scene;
      for (const asset of scene.assets) {
        if (this.dead) return;
        if (asset.src.startsWith('data:')) continue;
        const url = new URL(asset.src, this.doc.baseURI);
        if (!['http:', 'https:', 'blob:'].includes(url.protocol)) throw new Error('Cannot embed a media URL with an unsupported protocol.');
        const response = await fetch(url.href, { signal: this.lifecycle.signal, credentials: 'omit' });
        if (!response.ok) throw new Error(`Cannot embed media '${asset.name || asset.id}': HTTP ${response.status}`);
        const blob = await response.blob(); const bytes = new Uint8Array(await blob.arrayBuffer());
        const chunks: string[] = []; for (let i = 0; i < bytes.length; i += 0x8000) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)));
        asset.src = `data:${blob.type || asset.mime || 'application/octet-stream'};base64,${btoa(chunks.join(''))}`;
      }
      if (this.dead) return;
      this.download(new Blob([serializeScene(scene)], { type: 'application/json' }), `${this.filename(scene.name)}.json`);
      this.message('Project downloaded · Open this .json file later to keep editing');
    } catch (error) { this.fail(error); }
  }
  private filename(name: string): string { return name.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'mockup'; }
  private download(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob); this.objectUrls.add(url);
    const link = element(this.doc, 'a'); link.href = url; link.download = name; link.className = 'ms-hidden'; this.root.append(link); link.click(); link.remove();
    // A short grace period lets the browser consume the download without retaining
    // large export blobs for the entire editor session. Destroy also clears these.
    const timer = this.win.setTimeout(() => { URL.revokeObjectURL(url); this.objectUrls.delete(url); this.downloadTimers.delete(timer); }, 10000);
    this.downloadTimers.add(timer);
  }
  private async runExport(format: 'png' | 'webm' | 'gif'): Promise<void> {
    if (this.exporting || this.dead) return;
    this.stop();
    if (format === 'webm' && typeof globalThis.VideoEncoder === 'undefined') { this.fail(new Error('WebM export needs WebCodecs VideoEncoder. Use a recent Chromium browser in a secure context, or export PNG.')); return; }
    const controller = new AbortController(); this.exporting = controller;
    const canvas = element(this.doc, 'canvas'); let renderer: CanvasRenderer | undefined; this.exportCanvas = canvas;
    this.exportButtons.forEach(b => { b.disabled = true; }); this.cancelButton.classList.remove('ms-hidden'); this.message(`Exporting ${format.toUpperCase()}…`);
    try {
      renderer = this.createRenderer(canvas); this.exportRenderer = renderer;
      const scene = this.store.scene;
      let blob: Blob;
      if (format === 'png') {
        const still = evaluateScene(scene, this.time); still.tracks = [];
        blob = await exportImage(renderer, still, { format: 'png', signal: controller.signal });
      } else {
        const options = { duration: scene.duration, signal: controller.signal, onProgress: (progress: number) => this.message(`Exporting ${format.toUpperCase()} · ${Math.round(progress * 100)}%`) };
        blob = format === 'gif'
          ? await exportGIF(renderer, scene, { ...options, fps: Math.min(scene.fps, 30) })
          : await exportVideo(renderer, scene, { ...options, format: 'webm', fps: scene.fps });
      }
      if (this.dead || controller.signal.aborted) return;
      this.download(blob, `${this.filename(scene.name)}.${format}`); this.message(`${format.toUpperCase()} exported · ${(blob.size / 1024).toFixed(0)} KB`);
    } catch (error) { if (controller.signal.aborted) this.message('Export cancelled'); else this.fail(error); }
    finally {
      renderer?.dispose(); canvas.width = 1; canvas.height = 1; this.exportRenderer = undefined; this.exportCanvas = undefined; this.exporting = undefined;
      if (!this.dead) { this.exportButtons.forEach(b => { b.disabled = false; }); this.cancelButton.classList.add('ms-hidden'); }
    }
  }

  /** Only one preview render in flight; newer requests replace the pending snapshot.
   * Draw into a private buffer so an old async decode can never flash stale pixels. */
  private schedule(scene: SceneDocument): void {
    if (this.dead) return;
    const revision = ++this.revision;
    this.pending = { scene, time: this.time, revision };
    // Playback does not abort a frame on every RAF: doing so would starve slow decoders.
    if (!this.playing) this.renderAbort?.abort();
    if (!this.rendering) void this.drain();
  }
  private async drain(): Promise<void> {
    this.rendering = true;
    while (!this.dead && this.pending) {
      const request = this.pending; this.pending = undefined;
      const abort = new AbortController(); this.renderAbort = abort;
      try {
        const rect = this.wrap.getBoundingClientRect();
        const pixelRatio = Math.min(2, this.win.devicePixelRatio || 1);
        const scale = Math.min(1, Math.max(.1, rect.width * pixelRatio / request.scene.width));
        await this.renderer.render(request.scene, request.time, { scale, signal: abort.signal });
        if (this.dead || abort.signal.aborted) continue;
        // Playback may advance while a frame is rendering; present completed frames in
        // order, but edits and scrubbing must always match the latest requested revision.
        if (!this.playing && request.revision !== this.revision) continue;
        this.view.width = this.buffer.width; this.view.height = this.buffer.height;
        const context = this.view.getContext('2d'); if (!context) throw new Error('Canvas2D is unavailable.');
        context.drawImage(this.buffer, 0, 0); this.drawSelection(request.scene, request.time);
      } catch (error) { if (!abort.signal.aborted) { this.stop(); this.fail(error); } }
    }
    this.renderAbort = undefined; this.rendering = false;
  }
  private queueFit(): void {
    if (this.dead || this.fitFrame) return;
    this.fitFrame = this.win.requestAnimationFrame(() => {
      this.fitFrame = 0; if (this.dead) return;
      const scene = this.store.scene, rect = this.viewport.getBoundingClientRect();
      const headerHeight = this.root.querySelector('.ms-header')?.getBoundingClientRect().height;
      if (headerHeight) this.root.style.setProperty('--ms-header-height', `${headerHeight}px`);
      const padding = rect.width < 400 ? 28 : 56;
      const factor = Math.max(.01, Math.min((rect.width - padding) / scene.width, (rect.height - padding) / scene.height));
      this.wrap.style.width = `${Math.max(1, scene.width * factor)}px`; this.wrap.style.height = `${Math.max(1, scene.height * factor)}px`;
      this.dimensions.textContent = `${scene.width} × ${scene.height} · ${Math.round(factor * 100)}%`;
      if (this.drag || this.nudge) this.previewMovement((this.drag ?? this.nudge)!);
      else this.schedule(scene);
    });
  }
  private drawSelection(scene: SceneDocument, time = this.time): void {
    this.selection.replaceChildren(); this.selection.setAttribute('viewBox', `0 0 ${scene.width} ${scene.height}`);
    const evaluated = evaluateScene(scene, time), node = evaluated.nodes.find(n => n.id === this.selectedId);
    if (!node || !node.visible || this.playing) return;
    const corners = nodeCorners(node, !!scene.spatial?.enabled || scene.nodes.some(n => n.type === 'mesh')), polygon = this.doc.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', corners.map(p => `${p.x},${p.y}`).join(' ')); this.selection.append(polygon);
  }
  private pointerDown(event: PointerEvent): void {
    if (this.dead || event.button !== 0 || this.drag) return;
    this.safe(() => {
      this.finishNudge(); this.stop(); this.view.focus({ preventScroll: true });
      const scene = this.store.scene, point = clientToScene(event.clientX, event.clientY, this.view.getBoundingClientRect(), scene);
      const spatial = !!scene.spatial?.enabled || scene.nodes.some(n => n.type === 'mesh');
      const nodes = evaluateScene(scene, this.time).nodes.map((node, order) => ({ node, order }));
      // Orthographic depth order is a useful approximation, not GPU triangle picking.
      if (spatial) nodes.sort((a, b) => (a.node.z ?? a.order * .1) - (b.node.z ?? b.order * .1));
      const node = nodes.reverse().find(({ node }) => hitTest(node, point, spatial))?.node;
      this.select(node?.id); if (!node) return;
      this.drag = { pointerId: event.pointerId, id: node.id, start: point, original: scene, draft: scene, moved: false, targets: snapTargets(evaluateScene(scene, this.time), node.id), snap: {}, client: { x: event.clientX, y: event.clientY } };
      this.view.setPointerCapture(event.pointerId); event.preventDefault();
    });
  }
  private pointerMove(event: PointerEvent): void {
    const drag = this.drag; if (!drag || drag.pointerId !== event.pointerId) return;
    drag.client = { x: event.clientX, y: event.clientY };
    this.moveDrag(event.shiftKey, event.altKey); event.preventDefault();
  }
  private updateDragModifiers(event: KeyboardEvent): void {
    if (this.drag) this.moveDrag(event.shiftKey, event.altKey);
  }
  private moveDrag(shift: boolean, alt: boolean): void {
    const drag = this.drag; if (!drag) return;
    const rect = this.view.getBoundingClientRect(), point = clientToScene(drag.client.x, drag.client.y, rect, drag.original);
    const raw = { x: point.x - drag.start.x, y: point.y - drag.start.y };
    if (Math.abs(raw.x) + Math.abs(raw.y) < .5 && !drag.moved) return;
    const constrained = constrainMovement(raw, shift, drag.axis); drag.axis = constrained.axis;
    const draft = cloneScene(drag.original); editNode(draft, drag.id, n => { n.x += constrained.delta.x; n.y += constrained.delta.y; });
    const evaluated = evaluateScene(draft, this.time), node = evaluated.nodes.find(n => n.id === drag.id)!;
    const result = snapBounds(nodeBounds(node, !!draft.spatial?.enabled || draft.nodes.some(n => n.type === 'mesh')), drag.targets,
      { x: rect.width / draft.width, y: rect.height / draft.height }, drag.snap, { bypass: alt || !this.snapping, axis: drag.axis });
    editNode(draft, drag.id, n => { n.x += result.delta.x; n.y += result.delta.y; });
    drag.snap = result.state; drag.draft = draft; drag.moved = true;
    this.previewMovement(drag); this.drawGuides(result.guides, draft);
  }
  private clearGuides(): void {
    this.snapGuides.replaceChildren(); if (this.drag) this.drag.snap = {};
  }
  private drawGuides(guides: SnapGuide[], scene: SceneDocument): void {
    this.snapGuides.replaceChildren(); this.snapGuides.setAttribute('viewBox', `0 0 ${scene.width} ${scene.height}`);
    for (const guide of guides) {
      const line = this.doc.createElementNS('http://www.w3.org/2000/svg', 'line');
      const x = guide.axis === 'x';
      for (const [key, value] of Object.entries({ x1: x ? guide.value : guide.from, x2: x ? guide.value : guide.to, y1: x ? guide.from : guide.value, y2: x ? guide.to : guide.value })) line.setAttribute(key, String(value));
      this.snapGuides.append(line);
    }
  }
  private previewMovement(movement: Movement): void {
    const scene = this.store.scene;
    this.applyMovement(scene, movement); this.schedule(scene); this.drawSelection(scene);
  }
  private applyMovement(scene: SceneDocument, movement: Movement): void {
    const before = movement.original.nodes.find(n => n.id === movement.id), after = movement.draft.nodes.find(n => n.id === movement.id);
    if (!before || !after || !scene.nodes.some(n => n.id === movement.id && !n.locked)) return;
    editNode(scene, movement.id, n => { n.x += after.x - before.x; n.y += after.y - before.y; });
  }
  private commitMovement(movement: Movement): void {
    this.update(scene => this.applyMovement(scene, movement));
  }
  private cancelDrag(): void {
    const drag = this.drag; this.drag = undefined; this.clearGuides();
    if (!drag) return;
    if (this.view.hasPointerCapture(drag.pointerId)) this.view.releasePointerCapture(drag.pointerId);
    if (!this.dead) { this.schedule(this.store.scene); this.drawSelection(this.store.scene); }
  }
  private finishNudge(): void {
    const movement = this.nudge; this.nudge = undefined; this.nudgeKeys.clear();
    if (movement && !this.dead) this.commitMovement(movement);
  }
  private align(value: Alignment): void {
    this.finishNudge(); this.cancelDrag(); this.stop();
    const scene = this.store.scene, node = evaluateScene(scene, this.time).nodes.find(n => n.id === this.selectedId);
    if (!node || node.locked || !node.visible || node.opacity <= 0) return;
    const delta = alignmentDelta(nodeBounds(node, !!scene.spatial?.enabled || scene.nodes.some(n => n.type === 'mesh')), scene, value);
    if (Math.abs(delta.x) + Math.abs(delta.y) < 1e-8) return;
    this.update(draft => editNode(draft, node.id, n => { n.x += delta.x; n.y += delta.y; }));
    this.message('Layer aligned to canvas');
  }
  private pointerEnd(event: PointerEvent, commit: boolean): void {
    const drag = this.drag; if (!drag || drag.pointerId !== event.pointerId) return;
    this.drag = undefined;
    this.clearGuides();
    if (this.view.hasPointerCapture(event.pointerId)) this.view.releasePointerCapture(event.pointerId);
    if (commit && drag.moved) {
      // Exactly one history operation on pointerup. Apply only the positional delta,
      // retaining unrelated external-store edits that arrived during the gesture.
      this.commitMovement(drag);
    } else { this.schedule(this.store.scene); this.drawSelection(this.store.scene); }
  }
  private keyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (event.key === 'Alt' || event.key === 'Shift') { if (this.drag) event.preventDefault(); this.updateDragModifiers(event); }
    if (this.nudge && !event.key.startsWith('Arrow') && event.key !== 'Shift') this.finishNudge();
    if (this.propertiesDialog.open) {
      if (event.key === 'Escape') { event.preventDefault(); this.closeProperties(); }
      if (event.key === 'Tab') {
        const controls = Array.from(this.propertiesDialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary')).filter(node => node.tabIndex >= 0 && node.getClientRects().length);
        const index = controls.indexOf(event.target as HTMLElement);
        const next = controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length];
        if (next) { event.preventDefault(); this.rememberFocus(next); next.focus({ preventScroll: true }); }
      }
      return;
    }
    // Keep keyboard navigation in the dialog and suspend canvas shortcuts.
    if (this.actionsDialog.open) {
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const choices = Array.from(this.actionsDialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter(node => node.tabIndex >= 0 && node.getClientRects().length);
        const first = choices[0], last = choices.at(-1), focused = this.doc.activeElement;
        if (first && last && (!choices.includes(focused as HTMLButtonElement) || (event.shiftKey && focused === first) || (!event.shiftKey && focused === last))) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
      }
      return;
    }
    if (event.key === 'Escape' && this.root.classList.contains('ms-show-library')) { event.preventDefault(); this.setLibrary(false); return; }
    if (event.key === 'Tab' && this.root.classList.contains('ms-show-library') && this.win.matchMedia('(max-width: 820px)').matches) {
      const choices = Array.from(this.root.querySelectorAll<HTMLElement>('.ms-left button:not(:disabled),.ms-left [tabindex="0"]')).filter(node => node.tabIndex >= 0 && node.getClientRects().length);
      const first = choices[0], last = choices.at(-1), focused = this.doc.activeElement;
      if (first && last && (!choices.includes(focused as HTMLButtonElement) || (event.shiftKey && focused === first) || (!event.shiftKey && focused === last))) { event.preventDefault(); (event.shiftKey ? last : first).focus(); return; }
    }
    const target = event.target as HTMLElement | null;
    if (event.key === 'Tab' && target?.closest('.ms-right')) {
      const controls = Array.from(this.root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not([type=file]):not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,canvas')).filter(node => node.tabIndex >= 0 && node.getClientRects().length);
      const next = controls[controls.indexOf(target) + (event.shiftKey ? -1 : 1)]; if (next) this.rememberFocus(next);
    }
    if (target?.closest('input,textarea,select,[contenteditable="true"],[role="textbox"],[role="separator"]')) return;
    const key = event.key.toLowerCase(), command = event.ctrlKey || event.metaKey;
    if (event.key.startsWith('Arrow') && event.target === this.view && !command && !event.altKey && !this.drag) {
      const node = this.store.scene.nodes.find(n => n.id === this.selectedId);
      if (!node || node.locked || !node.visible || node.opacity <= 0) return;
      event.preventDefault(); this.stop();
      if (!this.nudge) { const scene = this.store.scene; this.nudge = { id: node.id, original: scene, draft: cloneScene(scene) }; }
      this.nudgeKeys.add(event.key);
      const step = event.shiftKey ? 10 : 1;
      editNode(this.nudge.draft, node.id, n => { if (event.key === 'ArrowLeft') n.x -= step; if (event.key === 'ArrowRight') n.x += step; if (event.key === 'ArrowUp') n.y -= step; if (event.key === 'ArrowDown') n.y += step; });
      this.previewMovement(this.nudge); return;
    }
    if (command && (key === 'z' || key === 'y')) {
      event.preventDefault(); this.cancelDrag(); this.safe(() => { this.stop(); if (key === 'y' || event.shiftKey) this.store.redo(); else this.store.undo(); });
    } else if (command && key === 'd') { event.preventDefault(); this.duplicate(); }
    else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); this.remove(); }
    else if (event.code === 'Space' && !target?.closest('button,a,summary')) { event.preventDefault(); this.togglePlay(); }
    else if (event.key === 'Escape') {
      if (this.drag) this.cancelDrag();
      else if (this.inspectorMode === 'canvas') { this.inspectorMode = this.selectedId ? 'layer' : 'hidden'; this.renderInspector(); this.queueFit(); }
      else this.select(undefined);
    }
  }
  private updateTimeline(): void {
    const scene = this.store.scene;
    this.scrubber.max = String(scene.duration); this.scrubber.step = String(1 / scene.fps); this.scrubber.value = String(this.time);
    this.timeLabel.textContent = `${this.time.toFixed(2)} / ${scene.duration.toFixed(2)} s`;
    const playLabel = this.playing ? 'Pause preview' : 'Play preview';
    if (this.play.getAttribute('aria-label') !== playLabel) setButtonContent(this.play, playLabel, this.playing ? 'Pause' : 'Play', true);
    const count = scene.tracks.filter(t => !this.selectedId || t.nodeId === this.selectedId).length;
    this.track.textContent = count ? `${count} animation tracks · Press play to preview` : 'Animation is optional · Select a layer, then open Motion to add it';
  }
  private togglePlay(): void {
    if (this.dead) return;
    this.finishNudge(); this.cancelDrag();
    if (this.playing) { this.stop(); return; }
    this.playing = true; this.playStart = this.win.performance.now(); this.playOffset = this.time >= this.store.scene.duration ? 0 : this.time;
    this.updateTimeline();
    const tick = (now: number) => {
      if (!this.playing || this.dead) return;
      const scene = this.store.scene;
      this.time = (this.playOffset + (now - this.playStart) / 1000) % scene.duration;
      this.updateTimeline(); this.schedule(scene); this.animationFrame = this.win.requestAnimationFrame(tick);
    };
    this.animationFrame = this.win.requestAnimationFrame(tick);
  }
  private stop(): void {
    if (!this.playing) return;
    this.playing = false; this.win.cancelAnimationFrame(this.animationFrame); this.animationFrame = 0;
    if (!this.dead) { this.updateTimeline(); this.schedule(this.store.scene); }
  }
  destroy(): void {
    if (this.dead) return;
    this.dead = true; this.playing = false; this.pending = undefined;
    for (const motion of this.motions.values()) motion.cancel(); this.motions.clear();
    this.closeActions();
    if (this.drag && this.view.hasPointerCapture(this.drag.pointerId)) this.view.releasePointerCapture(this.drag.pointerId);
    this.drag = undefined; this.nudge = undefined; this.nudgeKeys.clear(); this.clearGuides();
    this.win.cancelAnimationFrame(this.animationFrame); this.win.cancelAnimationFrame(this.fitFrame); this.win.cancelAnimationFrame(this.focusFrame);
    this.renderAbort?.abort(); this.exporting?.abort(); this.lifecycle.abort(); this.observer?.disconnect();
    this.templateGallery?.destroy();
    this.unsubscribe(); this.listeners.forEach(remove => remove()); this.listeners.length = 0;
    // Controls use handler properties so every inline component can be explicitly
    // disconnected even when a caller retains the destroyed handle or DOM nodes.
    for (const node of this.root.querySelectorAll<HTMLElement>('*')) { node.onclick = null; node.onchange = null; node.oninput = null; node.onblur = null; node.onkeydown = null; node.oncancel = null; node.onpointerdown = null; node.onpointermove = null; node.onpointerup = null; }
    this.root.replaceChildren();
    this.renderer.dispose(); this.exportRenderer?.dispose(); this.store.dispose();
    this.view.width = 1; this.view.height = 1; this.buffer.width = 1; this.buffer.height = 1;
    if (this.exportCanvas) { this.exportCanvas.width = 1; this.exportCanvas.height = 1; }
    for (const timer of this.downloadTimers) this.win.clearTimeout(timer); this.downloadTimers.clear();
    for (const url of this.objectUrls) URL.revokeObjectURL(url); this.objectUrls.clear();
    this.root.remove();
  }
}
