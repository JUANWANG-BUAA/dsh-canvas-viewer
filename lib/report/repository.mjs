import { homedir } from "node:os";
import { resolve, join, sep, basename } from "node:path";
import { realpathSync, constants } from "node:fs";
import { open, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createCanvasPathResolver, isCanvasPath } from "../host/paths.mjs";
import { previewSignature } from "../preview.mjs";
import { findAssetRefs } from "../host/assets.mjs";
import { sourceSignals, estimateCanvasTokens } from "../host/budget.mjs";
import { parseCanvasReport } from "./schema.mjs";

export const REPORT_MAX_BYTES = 1_500_000;
const safeLabel = value => String(value).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ");
export function createCanvasRepository({ home = homedir(), getHistory = () => [] } = {}) {
  home = realpathSync(resolve(home));
  const canvasDir = join(home, ".dsh", "canvases");
  const policy = createCanvasPathResolver({ home, canvasDir, getHistory });
  const cache = new Map();
  let cacheBytes = 0;
  function invalidate(path) { const old = cache.get(path); if (old) cacheBytes -= old.weight; cache.delete(path); }
  function inside(path) { if (path !== home && !path.startsWith(home + sep)) throw new Error("path must be inside the home directory"); return path; }
  async function read(pathInput) {
    const path = inside(policy.resolveCanvasForOpen(pathInput));
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
    try {
      const info = await handle.stat();
      if (!info.isFile()) throw new Error("canvas path must be a regular file");
      if (info.size > REPORT_MAX_BYTES) throw new Error("file too large");
      const buffer = Buffer.alloc(Math.min(REPORT_MAX_BYTES + 1, info.size + 1));
      let bytes = 0;
      while (bytes < buffer.length) { const got = await handle.read(buffer, bytes, buffer.length - bytes, bytes); if (!got.bytesRead) break; bytes += got.bytesRead; }
      if (bytes > REPORT_MAX_BYTES || bytes > info.size) throw new Error("file changed while reading; reopen");
      inside(realpathSync(path));
      return { path, buf: buffer.subarray(0, bytes), info };
    } finally { await handle.close(); }
  }
  async function metadata(path) {
    // Always acquire a safe handle before consulting metadata: no symlink entries.
    const { buf, info } = await read(path);
    const key = info.dev + ":" + info.ino + ":" + info.size + ":" + info.mtimeMs + ":" + info.ctimeMs;
    const old = cache.get(path);
    if (old && old.key === key) { cache.delete(path); cache.set(path, old); return old; }
    const source = buf.toString("utf8");
    const format = path.endsWith(".canvas.json") ? "structured" : "legacy";
    let preview = previewSignature(source), title = basename(path), error;
    if (format === "structured") {
      try {
        const report = parseCanvasReport(source);
        title = report.title;
        const blocks = report.sections.flatMap(section => section.blocks);
        preview = { headline: report.title, summary: (report.summary || "").slice(0, 240), hasTable: blocks.some(b => b.type === "table"), hasChart: blocks.some(b => b.type === "bar-chart"), sectionCount: report.sections.length };
      } catch (err) { error = String(err.message); }
    }
    const assetRef = format === "legacy" ? findAssetRefs(source)[0] || "" : "";
    const meta = { key, bytes: buf.length, lines: source.split("\n").length, searchText: source.toLowerCase(), title: safeLabel(title), format, ...(error ? { error } : {}), estimatedTokens: estimateCanvasTokens(source), warnings: sourceSignals(source).warnings, mtimeMs: info.mtimeMs, preview: { ...preview, assetRef } };
    meta.weight = meta.searchText.length * 2 + JSON.stringify(meta.preview).length * 2 + 4096;
    invalidate(path); cache.set(path, meta); cacheBytes += meta.weight;
    while (cache.size > 256 || cacheBytes > 16 * 1024 * 1024) invalidate(cache.keys().next().value);
    return meta;
  }
  async function list(query = {}) {
    if (typeof query === "string") query = { q: query };
    const q = typeof query.q === "string" ? query.q.trim().toLowerCase().slice(0, 1000) : "";
    const workspace = query.workspace || "all";
    const offset = Math.max(0, Math.min(20000, Math.floor(Number(query.offset) || 0)));
    const limit = Math.max(1, Math.min(200, Math.floor(Number(query.limit) || 200)));
    const found = [], workspaces = new Map();
    let visited = 0, scannedBytes = 0, scanComplete = true;
    async function walk(dir, depth) {
      if (depth > 32 || visited >= 20000) { scanComplete = false; return; }
      let entries;
      try { if (realpathSync(dir) !== resolve(dir)) return; inside(dir); entries = await readdir(dir, { withFileTypes: true }); }
      catch { return; }
      for (const entry of entries) {
        if (!scanComplete) return;
        if (++visited > 20000) { scanComplete = false; break; }
        if (["node_modules", ".git"].includes(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { await walk(full, depth + 1); continue; }
        if (!entry.isFile() || !isCanvasPath(entry.name)) continue;
        try {
          const meta = await metadata(full), ws = policy.workspaceOf(full);
          scannedBytes += meta.bytes;
          if (scannedBytes > 32 * 1024 * 1024) { scanComplete = false; return; }
          workspaces.set(ws.id, { id: ws.id, label: safeLabel(ws.label) });
          if (q && ![meta.title, full, ws.label, meta.searchText].some(value => value.toLowerCase().includes(q))) continue;
          if (workspace !== "all" && ws.id !== workspace) continue;
          const { key, searchText, weight, ...visible } = meta;
          found.push({ ...visible, path: full, assetRef: meta.preview.assetRef || "", workspaceId: ws.id, workspace: safeLabel(ws.label), shortPath: safeLabel(policy.shortHome(full)) });
        } catch { /* unreadable, oversized or raced files are not rendered */ }
      }
    }
    await walk(canvasDir, 0);
    found.sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));
    const items = found.slice(offset, offset + limit);
    return { items, count: items.length, total: found.length, offset, limit, nextOffset: offset + items.length < found.length ? offset + items.length : null, truncated: !scanComplete || offset + items.length < found.length, scanComplete, workspaces: [...workspaces.values()] };
  }
  async function openReport(input) {
    const { path, buf } = await read(input);
    const revision = createHash("sha256").update(buf).digest("hex");
    if (path.endsWith(".canvas.json")) { const report = parseCanvasReport(buf.toString("utf8")); return { path, title: report.title, report, revision, format: "structured" }; }
    return { path, title: safeLabel(basename(path)), revision, format: "legacy", legacy: true, warnings: ["这是可执行 TSX 报告；终端未执行源码。请使用 Web 阅读，或提供 .canvas.json 结构化版本。"] };
  }
  return { home, canvasDir, policy, read, list, metadata, invalidate, open: openReport };
}
