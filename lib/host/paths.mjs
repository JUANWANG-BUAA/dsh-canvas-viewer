import { basename, isAbsolute, join, resolve } from "node:path";
import { existsSync, realpathSync, statSync } from "node:fs";

/** Normalize the path-shaped references emitted by chat/tool surfaces. */
export function cleanRef(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/^["'`\[]+|["'`\]]+$/g, "")
    .replace(/[.,;:!?。，]+$/g, "");
}

export function isCanvasPath(path) {
  if (typeof path !== "string" || path.includes("\0")) return false;
  return cleanRef(path).endsWith(".canvas.tsx");
}

/**
 * Build the path policy around explicit roots and a history accessor. Keeping
 * the stateful history lookup outside this module makes the security boundary
 * easy to test without booting the whole dsh host.
 */
export function createCanvasPathResolver({ home, canvasDir, getHistory }) {
  const isDshCanvasPath = (path) => path === canvasDir || path.startsWith(`${canvasDir}/`);

  function assertInsideHome(resolved) {
    const homePrefix = home.endsWith("/") ? home : `${home}/`;
    if (resolved !== home && !resolved.startsWith(homePrefix)) {
      throw new Error("path must be inside the home directory");
    }
    return resolved;
  }

  function canonicalInsideHome(resolved) {
    if (!existsSync(resolved)) return assertInsideHome(resolved);
    let canonical;
    try {
      canonical = realpathSync(resolved);
    } catch {
      throw new Error("canvas path is not a readable file");
    }
    return assertInsideHome(canonical);
  }

  function findCanvasByName(name) {
    const base = basename(cleanRef(name));
    if (!base.endsWith(".canvas.tsx")) return null;
    const candidates = [];
    const push = (path) => {
      if (!path || candidates.includes(path)) return;
      try {
        if (existsSync(path) && statSync(path).isFile()) candidates.push(path);
      } catch {
        // Skip unreadable entries.
      }
    };

    push(join(canvasDir, base));
    for (const row of getHistory()) {
      if (isDshCanvasPath(row.path) && basename(row.path) === base) push(row.path);
    }
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    let best = candidates[0];
    let bestMtime = -1;
    for (const path of candidates) {
      try {
        const mtime = statSync(path).mtimeMs;
        if (mtime >= bestMtime) {
          best = path;
          bestMtime = mtime;
        }
      } catch {
        // Skip entries that disappear during the scan.
      }
    }
    return best;
  }

  function resolveCanvasPath(input) {
    if (!isCanvasPath(input)) throw new Error("path must end with .canvas.tsx");
    let trimmed = cleanRef(input);
    if (trimmed.startsWith("~/")) trimmed = join(home, trimmed.slice(2));

    if (isAbsolute(trimmed)) return canonicalInsideHome(resolve(trimmed));

    const fromCwd = resolve(process.cwd(), trimmed);
    if (existsSync(fromCwd)) return canonicalInsideHome(fromCwd);

    const found = findCanvasByName(trimmed);
    if (found) return canonicalInsideHome(found);
    throw new Error(`canvas not found: ${trimmed} (looked in cwd and ~/.dsh/canvases)`);
  }

  function resolveCanvasPathOrFind(pathInput) {
    try {
      return resolveCanvasPath(pathInput);
    } catch (error) {
      const found = findCanvasByName(pathInput);
      if (!found) throw error;
      return canonicalInsideHome(found);
    }
  }

  function resolveCanvasForOpen(pathInput) {
    try {
      return resolveCanvasPath(pathInput);
    } catch (error) {
      const found = findCanvasByName(pathInput);
      if (!found) throw error;
      return canonicalInsideHome(found);
    }
  }

  function shortHome(path) {
    if (path === home) return "~";
    const prefix = home.endsWith("/") ? home : `${home}/`;
    return path.startsWith(prefix) ? `~/${path.slice(prefix.length)}` : path;
  }

  function workspaceOf(path) {
    if (path.startsWith(`${canvasDir}/`) || path === canvasDir) {
      return { id: "dsh", label: "dsh 原生" };
    }
    const marker = `${join(home, ".cursor", "projects")}/`;
    if (!path.startsWith(marker)) return { id: "elsewhere", label: "其他位置" };
    const rest = path.slice(marker.length);
    const slash = rest.indexOf("/");
    const id = slash < 0 ? rest : rest.slice(0, slash);
    return { id, label: id.replace(/^Users-[^-]+-code-/, "").replace(/-/g, "/") || id };
  }

  return {
    isDshCanvasPath,
    findCanvasByName,
    resolveCanvasPath,
    resolveCanvasPathOrFind,
    resolveCanvasForOpen,
    canonicalInsideHome,
    shortHome,
    workspaceOf,
  };
}
