import { createCanvasRepository } from "../report/repository.mjs";

/** Read-only, per-plugin-activation store; no timers, watchers or Web dependency. */
export function createCanvasStore(options = {}) {
  const repository = createCanvasRepository(options);
  const listeners = new Set();
  let snapshot = Object.freeze({ path: undefined, request: 0 });
  let disposed = false;
  return {
    list(query) { if (disposed) return Promise.reject(new Error("Canvas reader disposed")); return repository.list(query); },
    open(path) { if (disposed) return Promise.reject(new Error("Canvas reader disposed")); return repository.open(path); },
    getSnapshot() { return snapshot; },
    requestOpen(path) {
      if (disposed) throw new Error("Canvas reader disposed");
      snapshot = Object.freeze({ path, request: snapshot.request + 1 });
      for (const listener of listeners) listener();
    },
    subscribe(listener) { if (disposed) return () => {}; listeners.add(listener); return () => listeners.delete(listener); },
    dispose() { disposed = true; listeners.clear(); },
  };
}
