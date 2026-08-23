import { createHash } from "node:crypto";
import { dirname, basename } from "node:path";
import { existsSync, watch } from "node:fs";
import { readFile } from "node:fs/promises";

function hashOf(text) {
  return createHash("sha256").update(text).digest("hex");
}

function sseSend(res, message) {
  try {
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  } catch {
    // The close handler removes disconnected clients.
  }
}

/**
 * Own the entire watcher/SSE lifecycle behind one disposable seam. The host
 * only supplies payload construction; tests can exercise cleanup without a
 * Cordis or HTTP server mock.
 */
export function createHotReloadManager({ buildPayload, watchDirs = [] }) {
  const entries = new Map();
  const directoryWatchers = new Map();

  function schedule(path, force = false) {
    const entry = entries.get(path);
    if (!entry || !entry.clients.size) return;
    entry.forceReload = entry.forceReload || force;
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      void (async () => {
        let payload;
        try {
          const source = await readFile(path, "utf8");
          const hash = hashOf(source);
          const forceReload = entry.forceReload;
          entry.forceReload = false;
          if (!forceReload && hash === entry.lastHash) return;
          entry.lastHash = hash;
          payload = await buildPayload(path);
        } catch {
          for (const client of entry.clients) sseSend(client, { type: "deleted" });
          return;
        }
        for (const client of entry.clients) sseSend(client, { type: "reload", payload });
      })();
    }, 200);
  }

  function ensureDirectoryWatchers() {
    for (const dir of watchDirs) {
      if (directoryWatchers.has(dir) || !existsSync(dir)) continue;
      try {
        const watcher = watch(dir, () => {
          for (const path of entries.keys()) schedule(path, true);
        });
        directoryWatchers.set(dir, watcher);
      } catch {
        // The directory may be created after plugin boot; retry on next open.
      }
    }
  }

  function closeDirectoryWatchers() {
    for (const watcher of directoryWatchers.values()) {
      try { watcher.close(); } catch { /* already closed */ }
    }
    directoryWatchers.clear();
  }

  function open(path, client) {
    ensureDirectoryWatchers();
    let entry = entries.get(path);
    if (!entry) {
      entry = { clients: new Set(), watcher: null, timer: null, lastHash: "", name: basename(path) };
      entries.set(path, entry);
      try {
        entry.watcher = watch(dirname(path), (_event, filename) => {
          if (!filename || filename === entry.name) schedule(path);
        });
      } catch {
        // The SSE stream stays open and reports deleted on the first change.
      }
      void readFile(path, "utf8")
        .then((source) => { entry.lastHash = hashOf(source); })
        .catch(() => {});
    }
    entry.clients.add(client);
  }

  function close(path, client) {
    const entry = entries.get(path);
    if (!entry) return;
    entry.clients.delete(client);
    if (!entry.clients.size) {
      clearTimeout(entry.timer);
      try { entry.watcher?.close(); } catch { /* already closed */ }
      entries.delete(path);
      if (!entries.size) closeDirectoryWatchers();
    }
  }

  function setHash(path, source) {
    const entry = entries.get(path);
    if (entry) entry.lastHash = hashOf(source);
  }

  function closeAll() {
    for (const [path, entry] of entries) {
      clearTimeout(entry.timer);
      try { entry.watcher?.close(); } catch { /* already closed */ }
      for (const client of entry.clients) {
        try { client.end?.(); } catch { /* already closed */ }
      }
      entry.clients.clear();
      entries.delete(path);
    }
    closeDirectoryWatchers();
  }

  return { open, close, setHash, closeAll, size: () => entries.size };
}
