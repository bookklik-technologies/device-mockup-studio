import { StudioError } from './types.js';
import type { SceneDocument, SceneNode } from './types.js';
import { cloneScene } from './serialization.js';
import { uid } from './factories.js';
import { copy, merge, metadataEqual } from './utils.js';

export type SceneListener = (scene: SceneDocument) => void;
export class SceneStore {
  private current: SceneDocument;
  private past: SceneDocument[] = [];
  private future: SceneDocument[] = [];
  private listeners = new Set<SceneListener>();
  private dead = false;
  private editing = false;
  private notifying = false;
  private notifications: SceneDocument[] = [];
  private transactionDepth = 0;
  constructor(scene: SceneDocument) { this.current = cloneScene(scene); }
  get scene(): SceneDocument { return cloneScene(this.current); }
  snapshot(): SceneDocument { return this.scene; }
  get canUndo(): boolean { return !this.dead && this.past.length > 0; }
  get canRedo(): boolean { return !this.dead && this.future.length > 0; }
  private alive(): void { if (this.dead) throw new StudioError('STORE_DISPOSED', 'SceneStore has been disposed.'); }
  private writable(): void {
    this.alive();
    if (this.editing) throw new StudioError('REENTRANT_MUTATION', 'Use the provided draft inside update(); group store operations with transaction().');
  }
  private notify(): void {
    // Queue reentrant subscriber edits so every observer sees the same event in commit order.
    this.notifications.push(this.scene);
    if (this.notifying) return;
    this.notifying = true;
    try {
      while (this.notifications.length && !this.dead) {
        const snapshot = this.notifications.shift()!;
        for (const listener of [...this.listeners]) {
          if (!this.listeners.has(listener)) continue;
          try { listener(copy(snapshot)); } catch { /* Observer errors cannot roll back a committed edit. */ }
        }
      }
    } finally { this.notifying = false; }
  }
  private commit(next: SceneDocument, record: boolean): void {
    this.writable();
    const safe = cloneScene(next);
    if (metadataEqual(safe, this.current)) return;
    if (!this.transactionDepth) {
      if (record) { this.past.push(this.current); if (this.past.length > 100) this.past.shift(); }
      else this.past = [];
      this.future = [];
    }
    this.current = safe;
    if (!this.transactionDepth) this.notify();
  }
  update(mutator: (scene: SceneDocument) => void): void {
    this.writable();
    const draft = this.scene;
    this.editing = true;
    try { mutator(draft); } finally { this.editing = false; }
    this.commit(draft, true);
  }
  /** Replacing without history clears history, and is therefore forbidden inside transactions. */
  setScene(scene: SceneDocument, record = true): void {
    this.writable();
    if (!record && this.transactionDepth) throw new StudioError('TRANSACTION_ACTIVE', 'setScene(scene, false) is unavailable within a transaction; replace outside the transaction to clear history.');
    this.commit(scene, record);
  }
  /** Atomic grouped edits, with rollback on throw and one history entry/notification.
   * Nested transactions use savepoints. Each individual edit must still be valid.
   * setScene(scene, false) throws TRANSACTION_ACTIVE; transaction history is always recorded. */
  transaction(mutator: (store: SceneStore) => void): void {
    this.writable();
    const before = this.current;
    this.transactionDepth++;
    try { mutator(this); }
    catch (error) { this.current = before; throw error; }
    finally { this.transactionDepth--; }
    if (!this.transactionDepth && !metadataEqual(before, this.current)) {
      this.past.push(before); if (this.past.length > 100) this.past.shift(); this.future = []; this.notify();
    }
  }
  undo(): boolean {
    this.writable(); if (this.transactionDepth) throw new StudioError('TRANSACTION_ACTIVE', 'Undo is unavailable within a transaction.');
    const previous = this.past.pop(); if (!previous) return false;
    this.future.push(this.current); this.current = previous; this.notify(); return true;
  }
  redo(): boolean {
    this.writable(); if (this.transactionDepth) throw new StudioError('TRANSACTION_ACTIVE', 'Redo is unavailable within a transaction.');
    const next = this.future.pop(); if (!next) return false;
    this.past.push(this.current); this.current = next; this.notify(); return true;
  }
  subscribe(listener: SceneListener): () => void { this.alive(); this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  addNode(node: SceneNode): void { this.update(scene => { scene.nodes.push(copy(node)); }); }
  removeNode(id: string): void {
    this.update(scene => { scene.nodes = scene.nodes.filter(node => node.id !== id); scene.tracks = scene.tracks.filter(track => track.nodeId !== id); });
  }
  updateNode(id: string, patch: Partial<SceneNode>): void {
    const idDescriptor = Object.getOwnPropertyDescriptor(patch, 'id');
    if (idDescriptor && 'value' in idDescriptor && idDescriptor.value !== undefined && idDescriptor.value !== id) throw new StudioError('IMMUTABLE_NODE_ID', 'Node identity cannot be changed by a patch.');
    this.update(scene => {
      const index = scene.nodes.findIndex(node => node.id === id);
      if (index === -1) throw new StudioError('NODE_NOT_FOUND', `Unknown node: ${id}`);
      const old = scene.nodes[index]!;
      const typeDescriptor = Object.getOwnPropertyDescriptor(patch, 'type');
      if (typeDescriptor && 'value' in typeDescriptor && typeDescriptor.value !== undefined && typeDescriptor.value !== old.type) throw new StudioError('IMMUTABLE_NODE_TYPE', 'Node type cannot be changed by a patch.');
      // Descriptor merging preserves hostile accessors for commit validation without running them.
      scene.nodes[index] = merge(old, patch);
    });
  }
  duplicateNode(id: string): SceneNode {
    let result: SceneNode | undefined;
    this.update(scene => {
      const index = scene.nodes.findIndex(node => node.id === id);
      if (index === -1) throw new StudioError('NODE_NOT_FOUND', `Unknown node: ${id}`);
      const source = scene.nodes[index]!;
      result = { ...copy(source), id: uid(source.type), name: `${source.name} copy`, x: source.x + 20, y: source.y + 20 };
      scene.nodes.splice(index + 1, 0, result);
      const newId = result.id;
      for (const track of [...scene.tracks]) if (track.nodeId === id) scene.tracks.push({ ...copy(track), id: uid('track'), nodeId: newId, keyframes: track.keyframes.map(key => ({ ...key, value: key.value + (track.property === 'x' || track.property === 'y' ? 20 : 0) })) });
    });
    return copy(result!);
  }
  dispose(): void {
    if (this.dead) return;
    this.writable();
    if (this.transactionDepth) throw new StudioError('TRANSACTION_ACTIVE', 'Cannot dispose within a transaction.');
    this.dead = true; this.listeners.clear(); this.past = []; this.future = []; this.notifications = [];
  }
}
