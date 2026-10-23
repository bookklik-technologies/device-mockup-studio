import { deserializeScene, serializeScene, type SceneDocument } from '@mockup-studio/sdk';

export interface DraftStorage {
  read(mode: '2d' | '3d'): Promise<SceneDocument | undefined>;
  write(mode: '2d' | '3d', scene: SceneDocument): Promise<void>;
  close(): void;
}

/** IndexedDB keeps embedded screenshots/videos out of localStorage's small quota. */
export function openDraftStorage(): Promise<DraftStorage> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mockup-studio-drafts', 1);
    let expired = false;
    const timer = window.setTimeout(() => { expired = true; reject(new Error('Local draft storage timed out.')); }, 2000);
    request.onupgradeneeded = () => { request.result.createObjectStore('scenes'); };
    request.onerror = () => { window.clearTimeout(timer); reject(request.error); };
    request.onblocked = () => { window.clearTimeout(timer); expired = true; reject(new Error('Local draft storage is blocked.')); };
    request.onsuccess = () => {
      window.clearTimeout(timer);
      const db = request.result;
      if (expired) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve({
        read: mode => new Promise((done, fail) => {
          const tx = db.transaction('scenes', 'readonly'); const read = tx.objectStore('scenes').get(mode);
          tx.onabort = () => fail(tx.error ?? new Error('Could not read local draft.'));
          read.onerror = () => fail(read.error);
          read.onsuccess = () => { try { done(typeof read.result === 'string' ? deserializeScene(read.result) : undefined); } catch (error) { fail(error); } };
        }),
        write: (mode, scene) => new Promise((done, fail) => {
          const json = serializeScene(scene);
          const tx = db.transaction('scenes', 'readwrite'); tx.objectStore('scenes').put(json, mode);
          tx.oncomplete = () => done();
          tx.onabort = () => fail(tx.error ?? new Error('Could not save local draft.'));
          tx.onerror = () => fail(tx.error);
        }),
        close: () => db.close(),
      });
    };
  });
}
