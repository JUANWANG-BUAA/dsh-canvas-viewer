import { basename } from "node:path";
import { statSync } from "node:fs";

const CANVAS_PRELUDE = `const {
  Stack, Row, Grid, H1, H2, H3, Text, Pill, Stat,
  Card, CardHeader, CardBody, Callout, Code, Divider, Spacer,
  Button, Link, Table, TodoList, TodoListCard,
  Swatch, UsageBar, BarChart, LineChart, PieChart, CollapsibleSection,
  mergeStyle,
  useHostTheme, useCanvasState, useCanvasAction, useState, useMemo, useEffect, useRef, useCallback, useId,
  computeDAGLayout, Fragment,
  categoryPaletteDark, colorPalette,
} = sdk;`;

const compileCache = new Map();
const COMPILE_CACHE_MAX = 200;
// Byte ceiling over cached payloads (code + moduleCode + sourcemap mappings,
// ×2 as a UTF-16 upper-bound estimate). Without it, 200 entries × 1.5MB
// sources could pin hundreds of MB of host memory.
const COMPILE_CACHE_MAX_BYTES = 64 * 1024 * 1024;
let compileCacheBytes = 0;

function compiledPayloadWeight(out) {
  const mappings = out.sourceMap && typeof out.sourceMap.mappings === "string" ? out.sourceMap.mappings.length : 0;
  return (out.code.length + out.moduleCode.length + mappings) * 2;
}

// Statement-scoped import stripping. The previous patterns used [\s\S]*?,
// which lazily spanned from an unrelated first import all the way to the
// canvas import — deleting every line between them. Class-level exclusions
// ('", ;) plus a line-end anchor keep each match inside one statement, so
// non-canvas imports and interleaved code survive untouched.
const TYPE_IMPORT_RE = /^[ \t]*import[ \t]+type[ \t]+(?:\{[^;'"]*\}|[A-Za-z_$][\w$]*)[ \t]*from[ \t]*['"][^'"]+['"][ \t]*;?[ \t]*$/gm;
const CANVAS_IMPORT_RE = /^[ \t]*import[ \t]*(?:[^;'"]*?[ \t]+from)?[ \t]*['"](?:cursor\/canvas|dsh\/canvas|@dsh\/canvas)['"][ \t]*;?[ \t]*$/gm;

function defaultExportName(source) {
  const fn = source.match(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)/);
  if (fn) return fn[1];
  const ident = source.match(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;/);
  if (ident) return ident[1];
  return "CanvasApp";
}

export function prepareSource(source) {
  const name = defaultExportName(source);
  let code = source;
  let removedLines = 0;
  const strip = (re) => {
    code = code.replace(re, (match) => {
      removedLines += (match.match(/\n/g) || []).length;
      return "";
    });
  };
  strip(TYPE_IMPORT_RE);
  strip(CANVAS_IMPORT_RE);
  code = code
    .replace(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)/, "function $1")
    .replace(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;/, "const __defaultExport = $1;");
  return { name, code, removedLines };
}

export function locateCompileError(error, source, filePath, removedLines) {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/\((\d+):(\d+)\)/);
  const line = match ? Number(match[1]) + (removedLines || 0) : 0;
  const column = match ? Number(match[2]) : 0;
  const sourceLines = source.split("\n");
  const sourceLine = line > 0 && line <= sourceLines.length ? sourceLines[line - 1].trim() : "";
  const loc = filePath
    ? `${filePath}:${line || "?"}:${column || "?"}`
    : `line ${line || "?"}, column ${column || "?"}`;
  const enriched = new Error(`${message} @ ${loc}${sourceLine ? `\n  ↳ ${sourceLine}` : ""}`);
  enriched.line = line;
  enriched.column = column;
  enriched.sourceLine = sourceLine;
  return enriched;
}

function compileCacheKey(filePath, cacheSalt = "") {
  if (!filePath) return null;
  try {
    const st = statSync(filePath);
    return `${filePath}:${st.mtimeMs}:${st.size}:${cacheSalt}`;
  } catch {
    return null;
  }
}

export async function compileCanvas(source, filePath, cacheSalt = "") {
  const cacheKey = compileCacheKey(filePath, cacheSalt);
  if (cacheKey && compileCache.has(cacheKey)) {
    // Refresh recency on hit: Map eviction walks insertion order, so a hot
    // entry must be re-inserted or it ages out while cold entries stay.
    const cached = compileCache.get(cacheKey);
    compileCache.delete(cacheKey);
    compileCache.set(cacheKey, cached);
    return cached;
  }
  const out = await doCompile(source, filePath);
  if (cacheKey) {
    const weight = compiledPayloadWeight(out);
    while (
      compileCache.size > 0
      && (compileCache.size >= COMPILE_CACHE_MAX || compileCacheBytes + weight > COMPILE_CACHE_MAX_BYTES)
    ) {
      const oldestKey = compileCache.keys().next().value;
      const oldest = compileCache.get(oldestKey);
      compileCache.delete(oldestKey);
      compileCacheBytes -= compiledPayloadWeight(oldest);
    }
    if (weight <= COMPILE_CACHE_MAX_BYTES) {
      compileCache.set(cacheKey, out);
      compileCacheBytes += weight;
    }
  }
  return out;
}

export async function doCompile(source, filePath) {
  const { name, code, removedLines } = prepareSource(source);
  const { transform } = await import("sucrase");
  let transformed;
  let sourceMap = null;
  try {
    const result = transform(code, {
      transforms: ["typescript", "jsx"],
      jsxRuntime: "classic",
      production: false,
      ...(filePath ? { filePath, sourceMapOptions: { compiledFilename: `${basename(filePath)}.js` } } : {}),
    });
    transformed = result.code;
    sourceMap = result.sourceMap || null;
  } catch (error) {
    throw locateCompileError(error, source, filePath, removedLines);
  }
  const pickExpression = name === "CanvasApp"
    ? `(typeof __defaultExport === "function" ? __defaultExport : (typeof CanvasApp === "function" ? CanvasApp : null))`
    : `(typeof ${name} === "function" ? ${name} : (typeof __defaultExport === "function" ? __defaultExport : null))`;
  const pick = `return ${pickExpression};`;
  return {
    code: `${CANVAS_PRELUDE}\n${transformed}\n${pick}`,
    moduleCode: `${CANVAS_PRELUDE}\n${transformed}\nglobalThis.__cvCanvasApp = ${pickExpression};`,
    sourceMap,
    mapOffset: CANVAS_PRELUDE.split("\n").length,
  };
}
