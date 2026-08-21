import { homedir } from "node:os";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { existsSync, readdirSync, statSync } from "node:fs";

export const name = "canvas-viewer";
export const inject = ["webServer", "tools", "systemPrompt"];

const API = "/api/canvas";
const HOME = resolve(homedir());
const MAX_BYTES = 1_500_000;
const HISTORY_MAX = 40;
const LIST_LIMIT = 200;
const STORE_DIR = join(HOME, ".dsh", "canvas-viewer");
const HISTORY_FILE = join(STORE_DIR, "history.json");

const CANVAS_PROMPT = `When the user asks for an investigation report, architecture/design brief, optimization review, 调查报告, 设计思路, 优化方向, or 架构评审, prefer a visual .canvas.tsx artifact over a markdown wall:
1. Load skill canvas-analysis-report if available (it is dsh-native; do not read Cursor-only canvas skills).
2. Write ~/.cursor/projects/<workspace>/canvases/<kebab-name>.canvas.tsx (or ~/.dsh/canvases/ if no Cursor projects tree) using only the cursor/canvas exports supported by dsh-canvas-viewer.
3. Immediately call view_canvas with that absolute path.
4. Keep the chat reply as a short briefing with a markdown link to the absolute path.
Skip this flow for code fixes, PRs, and short Q&A.`;


/** @type {{ seq: number, path: string, source: string, compiled: string, error: string, title: string } | null} */
let lastOpen = null;
let seq = 0;

/** @type {{ path: string, title: string, openedAt: number }[]} */
let history = [];
let historyLoaded = false;

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function requireMethod(req, res, method) {
  if (req.method === method) return true;
  json(res, 405, { ok: false, error: "method-not-allowed" });
  return false;
}

function readJsonBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 256 * 1024) {
        reject(new Error("body-too-large"));
        queueMicrotask(() => req.destroy());
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("invalid-json"));
      }
    });
    req.on("error", reject);
  });
}

export function isCanvasPath(path) {
  if (typeof path !== "string" || path.includes("\0")) return false;
  const trimmed = path.trim().replace(/^["'`]+|["'`]+$/g, "");
  return trimmed.endsWith(".canvas.tsx");
}

function assertInsideHome(resolved) {
  const homePrefix = HOME.endsWith("/") ? HOME : `${HOME}/`;
  if (resolved !== HOME && !resolved.startsWith(homePrefix)) {
    throw new Error("path must be inside the home directory");
  }
  return resolved;
}

/**
 * Chat chips often show only the basename (e.g. `foo.canvas.tsx`).
 * Resolve those against known canvas roots instead of process.cwd().
 */
export function findCanvasByName(name) {
  const base = basename(name);
  if (!base.endsWith(".canvas.tsx")) return null;
  /** @type {string[]} */
  const candidates = [];
  const push = (path) => {
    if (!path || candidates.includes(path)) return;
    try {
      if (existsSync(path) && statSync(path).isFile()) candidates.push(path);
    } catch {
      // skip
    }
  };

  push(join(HOME, ".dsh", "canvases", base));

  const projectsRoot = join(HOME, ".cursor", "projects");
  if (existsSync(projectsRoot)) {
    let entries = [];
    try {
      entries = readdirSync(projectsRoot);
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      push(join(projectsRoot, entry, "canvases", base));
    }
  }

  // Prefer an exact history hit when the same basename was opened before.
  for (const row of history) {
    if (basename(row.path) === base) push(row.path);
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
      // skip
    }
  }
  return best;
}

export function resolveCanvasPath(input) {
  if (!isCanvasPath(input)) {
    throw new Error("path must end with .canvas.tsx");
  }
  let trimmed = input.trim().replace(/^["'`]+|["'`]+$/g, "");
  if (trimmed.startsWith("~/")) trimmed = join(HOME, trimmed.slice(2));

  if (isAbsolute(trimmed)) {
    return assertInsideHome(resolve(trimmed));
  }

  // Relative / bare filename from chat: prefer real canvas locations over cwd.
  const fromCwd = resolve(process.cwd(), trimmed);
  if (existsSync(fromCwd)) {
    return assertInsideHome(fromCwd);
  }

  const found = findCanvasByName(trimmed);
  if (found) return assertInsideHome(found);

  throw new Error(
    `canvas not found: ${trimmed} (looked in cwd, ~/.dsh/canvases, ~/.cursor/projects/*/canvases)`,
  );
}

function shortHome(path) {
  if (path === HOME) return "~";
  const prefix = HOME.endsWith("/") ? HOME : `${HOME}/`;
  if (path.startsWith(prefix)) return `~/${path.slice(prefix.length)}`;
  return path;
}

function workspaceOf(path) {
  const marker = `${join(HOME, ".cursor", "projects")}/`;
  if (!path.startsWith(marker)) {
    return { id: "elsewhere", label: "其他位置" };
  }
  const rest = path.slice(marker.length);
  const slash = rest.indexOf("/");
  const id = slash < 0 ? rest : rest.slice(0, slash);
  return { id, label: id.replace(/^Users-[^-]+-code-/, "").replace(/-/g, "/") || id };
}

function defaultExportName(source) {
  const fn = source.match(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)/);
  if (fn) return fn[1];
  const ident = source.match(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;/);
  if (ident) return ident[1];
  return "CanvasApp";
}

export function prepareSource(source) {
  const name = defaultExportName(source);
  let code = source
    .replace(/^\s*import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*/gm, "")
    .replace(/^\s*import\s+[\s\S]*?from\s+['"]cursor\/canvas['"]\s*;?\s*/gm, "")
    .replace(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)/, "function $1")
    .replace(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;/, "const __defaultExport = $1;");
  return { name, code };
}

export async function compileCanvas(source) {
  const { name, code } = prepareSource(source);
  const { transform } = await import("sucrase");
  const transformed = transform(code, {
    transforms: ["typescript", "jsx"],
    jsxRuntime: "classic",
    production: false,
  }).code;
  const prelude = `const {
  Stack, Row, Grid, H1, H2, H3, Text, Pill, Stat,
  Card, CardHeader, CardBody, Callout, Code, Divider, Spacer,
  Button, Link, Table, TodoList, TodoListCard,
  Swatch, UsageBar, BarChart, LineChart, PieChart, CollapsibleSection,
  mergeStyle,
  useHostTheme, useCanvasState, useCanvasAction, useState, useMemo, useEffect, useRef, useCallback, useId,
  computeDAGLayout, Fragment,
  categoryPaletteDark, colorPalette,
} = sdk;`;
  const pick = name === "CanvasApp"
    ? `return (typeof __defaultExport === "function" ? __defaultExport : (typeof CanvasApp === "function" ? CanvasApp : null));`
    : `return (typeof ${name} === "function" ? ${name} : (typeof __defaultExport === "function" ? __defaultExport : null));`;
  return `${prelude}\n${transformed}\n${pick}`;
}

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
  await writeFile(HISTORY_FILE, await readFile(tmp));
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

async function openCanvas(pathInput) {
  const path = resolveCanvasPath(pathInput);
  const buf = await readFile(path);
  if (buf.byteLength > MAX_BYTES) {
    throw new Error("file too large");
  }
  const source = buf.toString("utf8");
  let compiled = "";
  let error = "";
  try {
    compiled = await compileCanvas(source);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  seq += 1;
  lastOpen = {
    seq,
    path,
    source,
    compiled,
    error,
    title: basename(path),
  };
  await rememberOpen(path, lastOpen.title);
  return lastOpen;
}

function snapshot() {
  if (!lastOpen) {
    return { seq: 0, path: "", title: "", source: "", compiled: "", error: "" };
  }
  return lastOpen;
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
      const info = await stat(full);
      const ws = workspaceOf(full);
      out.push({
        path: full,
        title: entry.name,
        bytes: info.size,
        mtimeMs: info.mtimeMs,
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
  const roots = [
    join(HOME, ".cursor", "projects"),
    join(HOME, "code"),
  ].filter((dir) => existsSync(dir));
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
    try {
      const info = await stat(row.path);
      const ws = workspaceOf(row.path);
      items.push({
        path: row.path,
        title: row.title || basename(row.path),
        openedAt: row.openedAt,
        bytes: info.size,
        mtimeMs: info.mtimeMs,
        workspaceId: ws.id,
        workspace: ws.label,
        shortPath: shortHome(row.path),
        missing: false,
      });
    } catch {
      items.push({
        path: row.path,
        title: row.title || basename(row.path),
        openedAt: row.openedAt,
        bytes: 0,
        mtimeMs: 0,
        workspaceId: "missing",
        workspace: "已失效",
        shortPath: shortHome(row.path),
        missing: true,
      });
    }
  }
  return { count: items.length, items };
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
      openUrl: `dsh-canvas://open?path=${encodeURIComponent(path)}`,
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

function getRoute(path, run) {
  return {
    kind: "exact",
    path,
    handler(req, res) {
      if (!requireMethod(req, res, "GET")) return;
      Promise.resolve()
        .then(run)
        .then((value) => json(res, 200, value))
        .catch((error) => {
          json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
        });
    },
  };
}

function postRoute(path, run) {
  return {
    kind: "exact",
    path,
    handler(req, res) {
      if (!requireMethod(req, res, "POST")) return Promise.resolve();
      return readJsonBody(req)
        .then((body) => {
          const record = typeof body === "object" && body !== null ? body : {};
          return run(record);
        })
        .then((value) => json(res, 200, value))
        .catch((error) => {
          json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
        });
    },
  };
}

function queryOf(req) {
  try {
    return new URL(req.url ?? "/", "http://canvas.local").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

export function apply(ctx) {
  void ensureHistory();

  const routes = [
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
  ];

  ctx.effect(() => {
    const disposers = routes.map((route) => ctx.webServer.register(route));
    return () => {
      for (const dispose of disposers) dispose();
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
      "Open a .canvas.tsx report in the dsh-canvas-viewer floating window. Call this immediately after writing a canvas-analysis-report artifact (investigation/design). Path must be absolute and under the home directory. The viewer renders a fixed cursor/canvas subset (Stack/Row/Grid/H1–H3/Text/Pill/Stat/Card/Callout/Table/TodoListCard/computeDAGLayout/hooks) — not Cursor IDE chrome.",
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
        },
        required: ["path", "title", "error"],
        additionalProperties: false,
      },
      render(_args, value) {
        const err = value && value.error ? ` (${value.error})` : "";
        return [{ type: "text", text: `Opened canvas ${value.title}${err}` }];
      },
    },
    presentCall(args) {
      return {
        card: "generic",
        title: "Open canvas",
        kind: "read",
        locations: [{ path: args.path }],
      };
    },
    async execute(args) {
      const opened = await openCanvas(args.path);
      return { path: opened.path, title: opened.title, error: opened.error };
    },
  });
}
