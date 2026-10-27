import type { SceneDocument, SceneNode } from './types.js';
export type SceneListener = (scene: SceneDocument) => void;
export declare class SceneStore {
    private current;
    private past;
    private future;
    private listeners;
    private dead;
    private editing;
    private notifying;
    private notifications;
    private transactionDepth;
    constructor(scene: SceneDocument);
    get scene(): SceneDocument;
    snapshot(): SceneDocument;
    get canUndo(): boolean;
    get canRedo(): boolean;
    private alive;
    private writable;
    private notify;
    private commit;
    update(mutator: (scene: SceneDocument) => void): void;
    /** Replacing without history clears history, and is therefore forbidden inside transactions. */
    setScene(scene: SceneDocument, record?: boolean): void;
    /** Atomic grouped edits, with rollback on throw and one history entry/notification.
     * Nested transactions use savepoints. Each individual edit must still be valid.
     * setScene(scene, false) throws TRANSACTION_ACTIVE; transaction history is always recorded. */
    transaction(mutator: (store: SceneStore) => void): void;
    undo(): boolean;
    redo(): boolean;
    subscribe(listener: SceneListener): () => void;
    addNode(node: SceneNode): void;
    removeNode(id: string): void;
    updateNode(id: string, patch: Partial<SceneNode>): void;
    duplicateNode(id: string): SceneNode;
    dispose(): void;
}
//# sourceMappingURL=store.d.ts.map