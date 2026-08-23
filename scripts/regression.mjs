#!/usr/bin/env node
/**
 * Render regression over every .canvas.tsx in ~/.dsh/canvases.
 *
 * For each file: compile (sucrase) -> eval `new Function("React","sdk", …)` ->
 * renderToStaticMarkup. Catches compile errors, eval errors, runtime render
 * errors and out-of-subset imports. The SDK is extracted verbatim from
 * lib/client.js at test time so the harness always mirrors the shipped runtime.
 *
 * Requires react + react-dom/server (falls back to the DeepSeek Harness copy;
 * skips with a warning if neither is resolvable).
 */
import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { compileCanvas } from "../lib/index.js";

const require = createRequire(import.meta.url);

function resolveReact() {
  const bases = [
    process.cwd(),
    "/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/node_modules",
    "/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules",
  ];
  for (const base of bases) {
    try {
      const path = require("node:path");
      const React = require(path.join(base, "react"));
      const rds = require(path.join(base, "react-dom/server.node.js")) || require(path.join(base, "react-dom/server"));
      if (React && rds && rds.renderToStaticMarkup) {
        return { React, renderToStaticMarkup: rds.renderToStaticMarkup };
      }
    } catch {
      // try next base
    }
  }
  return null;
}

const react = resolveReact();
if (!react) {
  // react/react-dom are devDependencies — a missing React is a broken install,
  // so this is a hard failure, never a silent skip.
  console.error(JSON.stringify({ ok: false, reason: "react/react-dom not resolvable — run pnpm install (they are devDependencies)" }));
  process.exit(1);
}

const { React, renderToStaticMarkup } = react;
const h = React.createElement;

// Extract the SDK-building region (helpers + createSdk) verbatim from
// lib/client.js and evaluate it in Node, so the harness mirrors the shipped runtime.
const clientSrc = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
const start = clientSrc.indexOf("function gapStyle(gap) {");
const createStart = clientSrc.indexOf("function createSdk(ReactLib) {");
if (start < 0 || createStart < 0) {
  console.log(JSON.stringify({ skipped: true, reason: "SDK region not found in lib/client.js" }, null, 2));
  process.exit(0);
}
let depth = 0;
let end = -1;
for (let i = createStart; i < clientSrc.length; i++) {
  const c = clientSrc[i];
  if (c === "{") depth += 1;
  else if (c === "}") {
    depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
}
const sdkSrc = clientSrc.slice(start, end);
const makeSdk = new Function("ReactLib", "h", sdkSrc + "\n;return createSdk;");
const sdk = makeSdk(React, h)(React);

// Doc↔SDK lint: every name advertised in sdk.md must exist on createSdk().
// (AGENTS.md requires skill docs to stay in sync with createSdk() exports.)
const sdkMd = readFileSync(new URL("../skills/canvas-analysis-report/sdk.md", import.meta.url), "utf8");
const sdkExportNames = new Set(Object.keys(sdk));
const docIssues = [];
const docImportRe = /import\s*\{([^}]*)\}\s*from\s*["']dsh\/canvas["']/;
const docMatch = sdkMd.match(docImportRe);
if (docMatch) {
  const names = docMatch[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
  for (const n of names) {
    if (!sdkExportNames.has(n)) docIssues.push({ name: n, reason: "documented in sdk.md but not exported by createSdk()" });
  }
} else {
  docIssues.push({ name: "(import block)", reason: "sdk.md has no dsh/canvas import block to lint" });
}

// Minimal browser-global shims in case a canvas touches window/document.
if (!globalThis.window) {
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    querySelector: () => null,
    addEventListener() {}, removeEventListener() {},
    head: { appendChild() {} }, body: { appendChild() {} },
    activeElement: null,
  };
  try { globalThis.navigator = { clipboard: undefined }; } catch { /* getter-only in newer Node */ }
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
}

const dir = join(homedir(), ".dsh", "canvases");
const failures = [];
const importIssues = [];
const stats = { total: 0, compiled: 0, rendered: 0, evalFailed: 0, renderFailed: 0, importIssues: 0, overBudget: 0 };

const files = (() => {
  try { return readdirSync(dir).filter((f) => f.endsWith(".canvas.tsx")).sort(); }
  catch { return []; }
})();

for (const file of files) {
  const full = join(dir, file);
  const source = readFileSync(full, "utf8");
  stats.total += 1;
  if (source.split("\n").length > 120) stats.overBudget += 1;

  // Capability lint: every imported name must exist in the SDK.
  const imp = source.match(/import\s*\{([^}]*)\}\s*from\s*["'](?:dsh\/canvas|cursor\/canvas)["']/);
  if (imp) {
    const names = imp[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    const missing = names.filter((n) => !(n in sdk));
    if (missing.length) {
      importIssues.push({ file, missing });
      stats.importIssues += 1;
    }
  }

  let code;
  try {
    const out = await compileCanvas(source, full);
    code = out.code;
    if (!out.sourceMap) failures.push({ file, stage: "sourcemap", error: "no source map generated" });
    stats.compiled += 1;
  } catch (e) {
    failures.push({ file, stage: "compile", error: String(e.message || e) });
    continue;
  }

  let App;
  try {
    const factory = new Function("React", "sdk", code);
    App = factory(React, sdk);
  } catch (e) {
    stats.evalFailed += 1;
    failures.push({ file, stage: "eval-factory", error: String(e.message || e) });
    continue;
  }
  if (typeof App !== "function") {
    failures.push({ file, stage: "default-export", error: "default export is not a function" });
    continue;
  }

  try {
    const html = renderToStaticMarkup(React.createElement(App));
    if (!html || !html.length) failures.push({ file, stage: "render", error: "empty output" });
    else stats.rendered += 1;
  } catch (e) {
    stats.renderFailed += 1;
    failures.push({ file, stage: "render", error: String((e && e.message) || e) });
  }
}

const result = {
  skipped: false,
  dir,
  stats,
  importIssues,
  docIssues,
  failures,
  ok: failures.length === 0 && importIssues.length === 0 && docIssues.length === 0,
};
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);

