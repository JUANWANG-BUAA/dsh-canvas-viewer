import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { previewSignature, readCanvasSource } from "./preview.mjs";
import { cleanRef, createCanvasPathResolver, isCanvasPath } from "./host/paths.mjs";
import { compileCanvas } from "./host/compiler.mjs";
import { createHotReloadManager } from "./host/hot-reload.mjs";
import { ASSET_MAX_BYTES, findAssetRefs, listCanvasAssets, materializeCanvasAssets, readCanvasAsset, saveCanvasAsset } from "./host/assets.mjs";
import { getRoute, json, postRoute, queryOf, readJsonBody, requireMethod } from "./host/http.mjs";
import {
  RECOMMENDED_MAX_BYTES,
  RECOMMENDED_MAX_LINES,
  RECOMMENDED_MAX_TOKENS,
  budgetMessage,
  budgetStatus,
  estimateCanvasTokens,
  readBudgetPolicy,
  sourceSignals,
} from "./host/budget.mjs";

export const name = "canvas-viewer";
export const inject = ["webServer", "tools", "systemPrompt"];

const API = "/api/canvas";
const HOME = resolve(homedir());
const MAX_BYTES = 1_500_000;
const HISTORY_MAX = 40;
const LIST_LIMIT = 200;
const DSH_CANVAS_DIR = join(HOME, ".dsh", "canvases");
const DSH_CANVAS_ASSET_DIR = join(HOME, ".dsh", "canvas-assets");
const STORE_DIR = join(HOME, ".dsh", "canvas-viewer");

const HISTORY_FILE = join(STORE_DIR, "history.json");
const MIGRATION_MANIFEST = join(STORE_DIR, "migration-manifest.json");
const SETTINGS_FILE = join(STORE_DIR, "settings.json");

// Single source of truth for the advertised version; CAPABILITIES must never
// hardcode a number that can drift from the release manifest again.
const PLUGIN_VERSION = createRequire(import.meta.url)("../package.json").version;

function getBudgetPolicy() {
  return readBudgetPolicy(SETTINGS_FILE);
}
const CANVAS_PROMPT = `调查/设计/优化/架构评审：写 ~/.dsh/canvases/*.canvas.tsx（仅用 dsh/canvas；优先 Stats/Table/DAG；避免重复与 inline base64；目标 ≤80 行、≤16KB、≈≤4k tokens），调用 view_canvas，聊天只给 2–4 句结论。修复、PR、短问答不画布。`;


/** @type {{ seq: number, path: string, source: string, compiled: string, error: string, title: string } | null} */
let lastOpen = null;
let seq = 0;

/** @type {{ path: string, title: string, openedAt: number }[]} */
let history = [];
let historyLoaded = false;

const {
  isDshCanvasPath,
  findCanvasByName,
  resolveCanvasPath,
  resolveCanvasPathOrFind,
  resolveCanvasForOpen,
  canonicalInsideHome,
  shortHome,
  workspaceOf,
} = createCanvasPathResolver({
  home: HOME,
  canvasDir: DSH_CANVAS_DIR,
  getHistory: () => history,
});

export { findCanvasByName, resolveCanvasPath };

export { cleanRef, isCanvasPath };

export { compileCanvas, doCompile, locateCompileError, prepareSource } from "./host/compiler.mjs";

async function ensureHistory() {
  if (historyLoaded) return;
  historyLoaded = true;
  try {
    const raw = await readFile(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      history = parsed
        .filter((row) => row && typeof row.path === "string" && isCanvasPath(row.path))
        .map((row) => ({
          path: resolveCanvasPath(row.path),
          title: typeof row.title === "string" ? row.title : basename(row.path),
          openedAt: typeof row.openedAt === "number" ? row.openedAt : Date.now(),
        }))
        .slice(0, HISTORY_MAX);
    }
  } catch {
    history = [];
  }
}

async function saveHistory() {
  await mkdir(STORE_DIR, { recursive: true });
  const tmp = `${HISTORY_FILE}.tmp`;
  await writeFile(tmp, `${JSON.stringify(history, null, 2)}\n`, "utf8");
  await rename(tmp, HISTORY_FILE);
}

async function rememberOpen(path, title) {
  await ensureHistory();
  const openedAt = Date.now();
  history = [
    { path, title, openedAt },
    ...history.filter((row) => row.path !== path),
  ].slice(0, HISTORY_MAX);
  try {
    await saveHistory();
  } catch {
    // History is best-effort; opening still succeeds.
  }
}

async function readCanvasBuffer(path, pathInput) {
  try {
    return { path, buf: await readFile(path) };
  } catch (err) {
    const found = pathInput ? findCanvasByName(pathInput) : null;
    if (found && found !== path) return { path: found, buf: await readFile(found) };
    throw err;
  }
}

/** Compile a canvas into the viewer payload shape (bumps seq; no history side effects). */
async function buildCanvasPayload(path, pathInput) {
  const read = await readCanvasBuffer(path, pathInput);
  path = read.path;
  const buf = read.buf;
  if (buf.byteLength > MAX_BYTES) {
    throw new Error("file too large");
  }
  const source = buf.toString("utf8");
  let compiled = "";
  let moduleCode = "";
  let error = "";
  let sourceMap = null;
  let mapOffset = 0;
  let warnings = sourceSignals(source).warnings;
  try {
    const materialized = await materializeCanvasAssets(source, DSH_CANVAS_ASSET_DIR);
    const out = await compileCanvas(materialized.source, path, materialized.signature);
    compiled = out.code;
    moduleCode = out.moduleCode;
    sourceMap = out.sourceMap;
    mapOffset = out.mapOffset;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  seq += 1;
  return {
    seq,
    path,
    source,
    compiled,
    moduleCode,
    sourceMap,
    mapOffset,
    error,
    lines: source.split("\n").length,
    bytes: buf.byteLength,
    estimatedTokens: estimateCanvasTokens(source),
    warnings,
    title: basename(path),
  };
}

export async function openCanvas(pathInput) {
  const path = resolveCanvasForOpen(pathInput);
  const payload = await buildCanvasPayload(path, pathInput);
  lastOpen = payload;
  await rememberOpen(payload.path, payload.title);
  return lastOpen;
}

const hotReload = createHotReloadManager({
  buildPayload: (path) => buildCanvasPayload(path),
  watchDirs: [DSH_CANVAS_ASSET_DIR],
});

/** Saves are limited to the managed canvas directory, like /files/delete. */
export function writableCanvasTarget(pathInput) {
  if (typeof pathInput !== "string" || !pathInput.trim()) throw new Error("path required");
  const path = resolveCanvasPath(pathInput);
  if (!path.startsWith(DSH_CANVAS_DIR + sep)) {
    throw new Error("saves are limited to " + DSH_CANVAS_DIR);
  }
  // The lexical prefix above cannot see a directory symlink under the managed
  // dir; validate against the real root so a symlinked parent cannot carry a
  // fresh save outside ~/.dsh/canvases.
  let insideManagedRoot;
  try {
    const realRoot = realpathSync(DSH_CANVAS_DIR);
    let realTarget = null;
    try { realTarget = realpathSync(path); } catch { realTarget = realpathSync(dirname(path)); }
    insideManagedRoot = realTarget === realRoot || realTarget.startsWith(realRoot + sep);
  } catch {
    insideManagedRoot = false;
  }
  if (!insideManagedRoot) {
    throw new Error("saves are limited to " + DSH_CANVAS_DIR);
  }
  return path;
}

async function saveCanvasFile(pathInput, source) {
  if (typeof source !== "string") throw new Error("source required");
  const path = writableCanvasTarget(pathInput);
  const bytes = Buffer.byteLength(source, "utf8");
  if (bytes > MAX_BYTES) throw new Error("file too large");
  const tmp = `${path}.save-tmp`;
  await writeFile(tmp, source, "utf8");
  await rename(tmp, path);
  invalidateCanvasMeta(path);
  hotReload.setHash(path, source);
  return buildCanvasPayload(path);
}

function snapshot() {
  if (!lastOpen) {
    return {
      seq: 0,
      path: "",
      title: "",
      source: "",
      compiled: "",
      moduleCode: "",
      sourceMap: null,
      mapOffset: 0,
      error: "",
      lines: 0,
      bytes: 0,
      estimatedTokens: 0,
    };
  }
  return lastOpen;
}

function countLines(file) {
  try {
    const buf = readFileSync(file);
    if (buf.length > MAX_BYTES) return -1;
    let n = 1;
    for (let i = 0; i < buf.length; i += 1) if (buf[i] === 10) n += 1;
    return n;
  } catch {
    return -1;
  }
}
const SDK_REGION_START = "function gapStyle(gap) {";
const SDK_REGION_END = "function createSdk(ReactLib) {";

function sdkRegionFromSource(src) {
  const start = src.indexOf(SDK_REGION_START);
  const end = src.lastIndexOf(SDK_REGION_END);
  if (start < 0 || end < 0) return null;
  const tail = src.indexOf("{", end);
  if (tail < 0) return null;
  let depth = 0;
  let i = tail;
  for (; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") { depth -= 1; if (depth === 0) break; }
  }
  if (depth !== 0) return null;
  return src.slice(start, i + 1);
}

/** Static sandbox bundle is immutable per host process; cache after first build. */
let sandboxBundleCache = null;

export async function sandboxBundle() {
  if (sandboxBundleCache) return sandboxBundleCache;
  // Preact 10 + compat UMD assets committed under this repo (~26 KB vs React UMD's ~142 KB);
  // resolve relative to this file. compat provides the React-compatible surface (createElement,
  // Fragment, hooks incl. useId, cloneElement) that createSdk() + compiled canvases need.
  const here = fileURLToPath(new URL(".", import.meta.url));
  const assetsDir = join(here, "..", "assets");
  const files = ["preact.umd.js", "preact-hooks.umd.js", "preact-compat.umd.js"];
  const missing = files.filter((f) => !existsSync(join(assetsDir, f)));
  if (missing.length) {
    return { available: false, reason: "preact umd assets missing: " + missing.join(",") };
  }
  const clientFile = join(here, "client.js");
  if (!existsSync(clientFile)) {
    return { available: false, reason: "client.js not found" };
  }
  const sdkSrc = sdkRegionFromSource(readFileSync(clientFile, "utf8"));
  if (!sdkSrc) {
    return { available: false, reason: "sdk region not found" };
  }
  sandboxBundleCache = {
    available: true,
    preact: readFileSync(join(assetsDir, "preact.umd.js"), "utf8"),
    preactHooks: readFileSync(join(assetsDir, "preact-hooks.umd.js"), "utf8"),
    compat: readFileSync(join(assetsDir, "preact-compat.umd.js"), "utf8"),
    sdk: sdkSrc,
    runtime: "preact-compat",
    isolation: "iframe(allow-scripts, opaque origin)",
  };
  return sandboxBundleCache;
}
/**
 * Gallery metadata cache: keyed by file identity (size+mtime) so repeated
 * /list and /history calls avoid re-reading every canvas source just to build
 * the structural preview. Invalidated on save/delete/migration; budget policy
 * is read live, so budget status is always recomputed from cached metadata.
 * @type {Map<string, { key: string, bytes: number, lines: number, mtimeMs: number, preview: object }>}
 */
const canvasMetaCache = new Map();

async function getCanvasMeta(full, entryName) {
  const info = await stat(full);
  const key = `${info.size}:${info.mtimeMs}`;
  const cached = canvasMetaCache.get(full);
  if (cached && cached.key === key) return cached;
  const source = readCanvasSource(full);
  const preview = previewSignature(source);
  const assetRef = findAssetRefs(source)[0] || "";
  const signals = sourceSignals(source);
  const meta = {
    key,
    bytes: info.size,
    lines: countLines(full),
    estimatedTokens: estimateCanvasTokens(source),
    warnings: signals.warnings,
    mtimeMs: info.mtimeMs,
    preview: preview ? { ...preview, assetRef } : { assetRef },
  };
  canvasMetaCache.set(full, meta);
  return meta;
}

function invalidateCanvasMeta(full) {
  canvasMetaCache.delete(full);
}

async function walkCanvases(dir, out, limit) {
  if (out.length >= limit) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= limit) return;
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkCanvases(full, out, limit);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".canvas.tsx")) continue;
    try {
      const meta = await getCanvasMeta(full, entry.name);
      const ws = workspaceOf(full);
      out.push({
        path: full,
        title: entry.name,
        bytes: meta.bytes,
        lines: meta.lines,
        estimatedTokens: meta.estimatedTokens,
        warnings: meta.warnings,
        ...budgetStatus(meta, getBudgetPolicy()),
        preview: meta.preview,
        assetRef: meta.preview.assetRef || "",
        mtimeMs: meta.mtimeMs,
        workspaceId: ws.id,
        workspace: ws.label,
        shortPath: shortHome(full),
      });
    } catch {
      // skip unreadable
    }
  }
}

async function listCanvases(query) {
  const q = typeof query === "string" ? query.trim().toLowerCase() : "";
  const roots = [DSH_CANVAS_DIR].filter((dir) => existsSync(dir));
  const found = [];
  for (const root of roots) {
    await walkCanvases(root, found, LIST_LIMIT);
  }
  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const filtered = q
    ? found.filter((row) =>
      row.title.toLowerCase().includes(q)
      || row.path.toLowerCase().includes(q)
      || row.workspace.toLowerCase().includes(q))
    : found;
  let migrationBy = {};
  try {
    const manifest = JSON.parse(await readFile(MIGRATION_MANIFEST, "utf8"));
    if (Array.isArray(manifest)) {
      for (const rec of manifest) {
        if (rec && rec.name) migrationBy[rec.name] = rec;
      }
    }
  } catch {
    migrationBy = {};
  }
  for (const row of filtered) {
    const mig = migrationBy[row.title];
    if (mig) {
      row.provenance = {
        source: mig.source || "",
        sha256: (mig.sha256 || "").slice(0, 10) || "",
        migratedAt: mig.migratedAt ? Date.parse(mig.migratedAt) : 0,
      };
    }
  }
  const workspaces = [];
  const seen = new Set();
  for (const row of filtered) {
    if (seen.has(row.workspaceId)) continue;
    seen.add(row.workspaceId);
    workspaces.push({ id: row.workspaceId, label: row.workspace });
  }
  return {
    count: filtered.length,
    truncated: found.length >= LIST_LIMIT,
    items: filtered,
    workspaces,
  };
}

async function listHistory() {
  await ensureHistory();
  const items = [];
  for (const row of history) {
    if (!isDshCanvasPath(row.path)) continue;
    try {
      const meta = await getCanvasMeta(row.path, basename(row.path));
      const ws = workspaceOf(row.path);
      items.push({
        path: row.path,
        title: row.title || basename(row.path),
        openedAt: row.openedAt,
        bytes: meta.bytes,
        estimatedTokens: meta.estimatedTokens,
        warnings: meta.warnings,
        mtimeMs: meta.mtimeMs,
        workspaceId: ws.id,
        workspace: ws.label,
        shortPath: shortHome(row.path),
        missing: false,
        ...budgetStatus(meta, getBudgetPolicy()),
        preview: meta.preview,
        assetRef: meta.preview.assetRef || "",
      });
    } catch {
      items.push({
        path: row.path,
        title: row.title || basename(row.path),
        openedAt: row.openedAt,
        bytes: 0,
        estimatedTokens: 0,
        mtimeMs: 0,
        workspaceId: "missing",
        workspace: "已失效",
        shortPath: shortHome(row.path),
        missing: true,
        overBudget: false,
        violations: [],
        preview: null,
        assetRef: "",
      });
    }
  }
  return { count: items.length, items };
}

async function migrateLegacyCanvases() {
  const projectsRoot = join(HOME, ".cursor", "projects");
  if (!existsSync(projectsRoot)) return;
  let entries = [];
  try {
    entries = await readdir(projectsRoot, { withFileTypes: true });
  } catch {
    return;
  }
  await mkdir(DSH_CANVAS_DIR, { recursive: true }).catch(() => {
    // Unusable canvas dir (.dsh not a directory, EACCES, ...): migration cannot
    // proceed and an unhandled rejection here would take down the whole host.
    return null;
  });
  const seen = new Set();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const canvasesDir = join(projectsRoot, entry.name, "canvases");
    if (!existsSync(canvasesDir)) continue;
    try {
      const files = await readdir(canvasesDir, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".canvas.tsx")) continue;
        if (seen.has(file.name)) continue;
        seen.add(file.name);
        const source = join(canvasesDir, file.name);
        const target = join(DSH_CANVAS_DIR, file.name);
        try {
          await stat(target);
          continue;
        } catch {
          // target absent — safe to migrate
        }
        try {
          await copyFile(source, target);
          invalidateCanvasMeta(target);
          await recordMigration({ name: file.name, source, target, size: (await stat(source)).size });
        } catch {
          // skip unreadable/duplicate
        }
      }
    } catch {
      // skip unreadable workspace
    }
  }
}

async function recordMigration(record) {
  await mkdir(STORE_DIR, { recursive: true });
  let manifest = [];
  try {
    manifest = JSON.parse(await readFile(MIGRATION_MANIFEST, "utf8"));
  } catch {
    manifest = [];
  }
  let digest = "";
  try {
    digest = createHash("sha256").update(await readFile(record.source)).digest("hex");
  } catch {
    digest = "";
  }
  manifest.push({
    name: record.name,
    source: record.source,
    target: record.target,
    size: record.size || 0,
    sha256: digest,
    migratedAt: new Date().toISOString(),
  });
  try {
    await writeFile(MIGRATION_MANIFEST, JSON.stringify(manifest, null, 2));
  } catch {
    // best-effort provenance
  }
}


function buildRefs(pathInput) {
  const path = resolveCanvasPath(pathInput);
  const title = basename(path);
  const shortPath = shortHome(path);
  return {
    path,
    title,
    shortPath,
    refs: {
      path,
      shortPath,
      markdownLink: `[${title}](${path})`,
      markdownCode: `\`${shortPath}\``,
      mention: `@${path}`,
      toolHint: `请调用 view_canvas，path 为 ${path}`,
    },
  };
}

async function clearHistory() {
  await ensureHistory();
  history = [];
  await saveHistory();
  return { ok: true, count: 0 };
}

async function forgetHistory(pathInput) {
  const path = resolveCanvasPath(pathInput);
  await ensureHistory();
  history = history.filter((row) => row.path !== path);
  await saveHistory();
  return { ok: true, count: history.length };
}
async function deleteCanvasFile(pathInput) {
  const path = resolveCanvasPath(pathInput);
  // Only allow deleting files inside the dsh canvases directory (user-managed reports).
  if (!path.startsWith(DSH_CANVAS_DIR + sep)) {
    throw new Error("delete-denied: only files under ~/.dsh/canvases can be deleted");
  }
  await rm(path, { force: true });
  invalidateCanvasMeta(path);
  await ensureHistory();
  history = history.filter((row) => row.path !== path);
  await saveHistory();
  return { ok: true, path, deleted: true };
}

export const CAPABILITIES = {
  ok: true,
  plugin: "dsh-canvas-viewer",
  version: PLUGIN_VERSION,
  limits: {
    maxBytes: MAX_BYTES,
    maxAssetBytes: ASSET_MAX_BYTES,
    recommendedMaxLines: RECOMMENDED_MAX_LINES,
    recommendedMaxBytes: RECOMMENDED_MAX_BYTES,
    recommendedMaxTokens: RECOMMENDED_MAX_TOKENS,
    canvasDir: DSH_CANVAS_DIR,
  },
  budget: getBudgetPolicy(),
  sandbox: {
    level: "iframe-sandbox",
    executionIsolation: "iframe(allow-scripts, opaque origin)",
    runtime: "preact-compat",
    fallback: "fail-closed until the user explicitly allows main-thread new Function",
    note: "reports render inside a sandboxed iframe (opaque origin) with inlined Preact 10 + compat UMD (~26 KB vs React UMD ~142 KB) + extracted SDK region; host page only receives postMessage action events. See docs/SANDBOX.md.",
  },
  imports: {
    native: "dsh/canvas",
    legacy: "cursor/canvas",
  },
  assets: {
    scheme: "asset://",
    directory: DSH_CANVAS_ASSET_DIR,
    upload: "POST /api/canvas/assets {name, data: base64/data URI}; browser compression is recommended",
    preview: "GET /api/canvas/assets/raw?name=... serves one managed image with ETag revalidation for lazy gallery thumbnails",
    note: "quoted asset:// references are materialized to data URIs before sandbox execution; network remains disabled",
  },
  components: {
    Stack: { props: ["gap", "style"] },
    Row: { props: ["gap", "align", "justify", "wrap", "style"] },
    Grid: { props: ["columns", "gap", "align", "style"], note: "columns auto-clamp on narrow windows" },
    H1: {},
    H2: {},
    H3: {},
    Text: { props: ["tone", "size", "weight", "italic", "truncate", "as", "style"] },
    Pill: { props: ["active", "selected", "current", "size", "tone", "onClick", "style"] },
    Stat: { props: ["value", "label", "title", "tone", "style"] },
    Card: { props: ["size", "style"] },
    CardHeader: { props: ["title", "trailing", "size", "tone", "style"] },
    CardBody: { props: ["style"] },
    Callout: { props: ["tone", "title", "style"] },
    Code: { props: ["style"] },
    Divider: { props: ["style"] },
    Spacer: { props: ["grow", "size"] },
    Button: { props: ["variant", "onClick", "disabled", "style"] },
    Link: { props: ["href", "target", "style"] },
    Table: {
      props: ["headers", "rows", "columns", "rowTone", "striped", "framed", "stickyHeader", "columnAlign", "emptyMessage", "sortable", "style"],
      note: "object cells may carry {href, label} to render links; sortable=true enables click-to-sort headers (numeric-aware, zh locale)",
    },
    TodoList: { props: ["todos", "items"] },
    TodoListCard: { props: ["title", "todos", "items"] },
    Swatch: { props: ["color", "tone", "label", "style"] },
    UsageBar: { props: ["segments", "items", "showLabels", "style"] },
    BarChart: {
      props: ["series", "data", "categories", "height", "width", "yMin", "yMax", "valueSuffix", "beginAtZero", "referenceLines", "showValues", "showLegend", "style"],
      note: "renders y-axis gridlines, ticks, value labels, optional legend/referenceLines; native <title> hover tooltips on bars",
    },
    LineChart: {
      props: ["series", "data", "height", "width", "yMin", "yMax", "valueSuffix", "beginAtZero", "referenceLines", "showValues", "showLegend", "style"],
      note: "renders y-axis gridlines, ticks, value labels, optional legend/referenceLines; per-point <title> hover tooltips",
    },
    PieChart: { props: ["data", "segments", "size", "valueSuffix", "showLegend", "style"], note: "slice <title> hover tooltips (value + percent)" },
    CollapsibleSection: { props: ["title", "header", "defaultOpen", "trailing", "style"] },
  },
  hooks: [
    "useHostTheme", "useCanvasState", "useCanvasAction",
    "useState", "useMemo", "useEffect", "useRef", "useCallback", "useId",
  ],
  helpers: ["mergeStyle", "computeDAGLayout", "Fragment", "categoryPaletteDark", "colorPalette"],
  features: {
    hotReload: "GET /api/canvas/watch?path= (SSE) pushes recompiled payloads when the open canvas changes on disk; the viewer window re-renders automatically",
    sourceEdit: "POST /api/canvas/save {path, source} — atomic write (tmp+rename) limited to the canvas directory, returns the freshly compiled payload",
  },
  degraded: "Props outside the subset are ignored; detected drops show a ▤ degraded badge instead of failing silently.",
};

export function apply(ctx) {
  // Fire-and-forget boot work must never surface an unhandledRejection: Node's
  // default mode aborts the process, which would take the whole host with it.
  void ensureHistory().catch(() => {});
  void mkdir(DSH_CANVAS_DIR, { recursive: true }).catch(() => {});
  void mkdir(DSH_CANVAS_ASSET_DIR, { recursive: true }).catch(() => {});
  void migrateLegacyCanvases().catch(() => {});

  const routes = [
    getRoute(`${API}/capabilities`, () => {
      // budget is read live so a settings.json edit takes effect without a host restart
      const pol = getBudgetPolicy();
      return {
        ...CAPABILITIES,
        budget: pol,
        limits: {
          ...CAPABILITIES.limits,
          configuredMaxLines: pol.maxLines,
          configuredMaxBytes: pol.maxBytes,
          configuredMaxTokens: pol.maxTokens,
        },
      };
    }),
    getRoute(`${API}/peek`, () => snapshot()),
    {
      kind: "exact",
      path: `${API}/list`,
      handler(req, res) {
        if (!requireMethod(req, res, "GET")) return;
        const q = queryOf(req).get("q") || "";
        listCanvases(q).then(
          (value) => json(res, 200, value),
          (error) => json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }),
        );
      },
    },
    getRoute(`${API}/history`, () => listHistory()),
    getRoute(`${API}/sandbox`, () => sandboxBundle()),
    {
      kind: "exact",
      path: `${API}/assets`,
      handler(req, res) {
        if (req.method === "GET") {
          listCanvasAssets(DSH_CANVAS_ASSET_DIR).then(
            (value) => json(res, 200, value),
            (error) => json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }),
          );
          return;
        }
        if (req.method !== "POST") { json(res, 405, { ok: false, error: "method-not-allowed" }); return; }
        readJsonBody(req, 4 * 1024 * 1024)
          .then((body) => saveCanvasAsset(DSH_CANVAS_ASSET_DIR, body.name, body.data))
          .then((value) => json(res, 200, value))
          .catch((error) => json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }));
      },
    },
    {
      kind: "exact",
      path: `${API}/assets/raw`,
      handler(req, res) {
        if (!requireMethod(req, res, "GET")) return;
        const name = queryOf(req).get("name") || "";
        readCanvasAsset(DSH_CANVAS_ASSET_DIR, name).then((asset) => {
          if (req.headers["if-none-match"] === asset.etag) {
            res.writeHead(304, {
              etag: asset.etag,
              "cache-control": "private, max-age=60, must-revalidate",
            });
            res.end();
            return;
          }
          res.writeHead(200, {
            "content-type": asset.mime,
            "content-length": asset.bytes,
            etag: asset.etag,
            "cache-control": "private, max-age=60, must-revalidate",
            "x-content-type-options": "nosniff",
            "cross-origin-resource-policy": "same-origin",
            "referrer-policy": "no-referrer",
          });
          res.end(asset.data);
        }, (error) => {
          json(res, 404, { ok: false, error: error instanceof Error ? error.message : String(error) });
        });
      },
    },
    {
      kind: "exact",
      path: `${API}/refs`,
      handler(req, res) {
        if (!requireMethod(req, res, "GET")) return;
        try {
          const path = queryOf(req).get("path") || "";
          json(res, 200, buildRefs(path));
        } catch (error) {
          json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      },
    },
    postRoute(`${API}/open`, (body) => {
      if (typeof body.path !== "string") throw new Error("path required");
      return openCanvas(body.path);
    }),
    postRoute(`${API}/history/clear`, () => clearHistory()),
    postRoute(`${API}/history/forget`, (body) => {
      if (typeof body.path !== "string") throw new Error("path required");
      return forgetHistory(body.path);
    }),
    postRoute(`${API}/files/delete`, (body) => {
      if (typeof body.path !== "string") throw new Error("path required");
      return deleteCanvasFile(body.path);
    }),
    {
      kind: "exact",
      path: `${API}/watch`,
      handler(req, res) {
        if (!requireMethod(req, res, "GET")) return;
        let path;
        try {
          path = resolveCanvasPathOrFind(queryOf(req).get("path") || "");
        } catch (error) {
          json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
          return;
        }
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        res.write("retry: 2000\n\n");
        hotReload.open(path, res);
        const cleanup = () => hotReload.close(path, res);
        req.on("close", cleanup);
        res.on("close", cleanup);
      },
    },
    postRoute(`${API}/save`, (body) => {
      if (typeof body.path !== "string") throw new Error("path required");
      return saveCanvasFile(body.path, body.source);
    }),
  ];

  ctx.effect(() => {
    const disposers = routes.map((route) => ctx.webServer.register(route));
    return () => {
      for (const dispose of disposers) dispose();
      hotReload.closeAll();
    };
  }, "canvas-viewer: routes");

  ctx.systemPrompt.section({
    name: "tool:view_canvas",
    order: 118,
    text: CANVAS_PROMPT,
  });

  ctx.tools.register({
    name: "view_canvas",
    description:
      "Register an absolute-HOME dsh canvas report after writing it; the user opens it from the chat bubble.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute path to a .canvas.tsx file inside the home directory",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: "object",
        properties: {
          path: { type: "string" },
          title: { type: "string" },
          error: { type: "string" },
          lines: { type: "number" },
          bytes: { type: "number" },
          estimatedTokens: { type: "number" },
          overBudget: { type: "boolean" },
          violations: { type: "array", items: { type: "string" } },
          warnings: { type: "array", items: { type: "string" } },
        },
        required: ["path", "title", "error"],
        additionalProperties: false,
      },
      render(_args, value) {
        const err = value && value.error ? ` (${value.error})` : "";
        const size = value && value.lines
          ? ` · ${value.lines} 行 / ${value.bytes || 0}B / ≈${value.estimatedTokens || 0} tokens${value.overBudget ? ` ⚠ 超出 ${value.violations?.join("、") || "预算"}` : ""}`
          : "";
        return [{ type: "text", text: `Canvas ready: ${value.title}${size}${err}` }];
      },
    },
    presentCall(args) {
      return {
        card: "generic",
        title: "Canvas ready",
        kind: "read",
        locations: [{ path: args.path }],
      };
    },
    async execute(args) {
      const pol = getBudgetPolicy();
      if (pol.enforce === "hard" && (Number.isFinite(pol.maxLines) || Number.isFinite(pol.maxBytes) || Number.isFinite(pol.maxTokens))) {
        let path;
        try {
          path = resolveCanvasPathOrFind(args.path);
        } catch {
          // resolution failure -> let openCanvas report the real error below
        }
        if (path) {
          const source = readCanvasSource(path);
          const meta = { lines: source.split("\n").length, bytes: Buffer.byteLength(source, "utf8"), estimatedTokens: estimateCanvasTokens(source) };
          const reason = budgetMessage(meta, pol);
          if (reason) {
            throw new Error(`hard-budget 拦截：${reason}。请把报告拆分为多份 .canvas.tsx，再逐一 view_canvas（策略见 ~/.dsh/canvas-viewer/settings.json 的 budget.enforce）。`);
          }
        }
      }
      const opened = await openCanvas(args.path);
      if (opened.error) throw new Error(opened.error);
      const status = budgetStatus(opened, pol);
      return {
        path: opened.path,
        title: opened.title,
        error: opened.error,
        lines: opened.lines,
        bytes: opened.bytes,
        estimatedTokens: opened.estimatedTokens,
        ...(opened.warnings && opened.warnings.length ? { warnings: opened.warnings } : {}),
        ...(status.overBudget ? status : {}),
      };
    },
  });
}
