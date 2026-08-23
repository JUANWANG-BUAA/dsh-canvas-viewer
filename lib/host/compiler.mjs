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
  strip(/^\s*import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*/m);
  strip(/^\s*import\s+[\s\S]*?from\s+['"](?:cursor\/canvas|dsh\/canvas|@dsh\/canvas)['"]\s*;?\s*/m);
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

function compileCacheKey(filePath) {
  if (!filePath) return null;
  try {
    const st = statSync(filePath);
    return `${filePath}:${st.mtimeMs}:${st.size}`;
  } catch {
    return null;
  }
}

export async function compileCanvas(source, filePath) {
  const cacheKey = compileCacheKey(filePath);
  if (cacheKey && compileCache.has(cacheKey)) return compileCache.get(cacheKey);
  const out = await doCompile(source, filePath);
  if (cacheKey) {
    if (compileCache.size >= COMPILE_CACHE_MAX) {
      const oldest = compileCache.keys().next().value;
      if (oldest !== undefined) compileCache.delete(oldest);
    }
    compileCache.set(cacheKey, out);
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
  const pick = name === "CanvasApp"
    ? `return (typeof __defaultExport === "function" ? __defaultExport : (typeof CanvasApp === "function" ? CanvasApp : null));`
    : `return (typeof ${name} === "function" ? ${name} : (typeof __defaultExport === "function" ? __defaultExport : null));`;
  return {
    code: `${CANVAS_PRELUDE}\n${transformed}\n${pick}`,
    sourceMap,
    mapOffset: CANVAS_PRELUDE.split("\n").length,
  };
}
