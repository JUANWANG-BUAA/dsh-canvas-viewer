#!/usr/bin/env node
/**
 * Render regression over repository fixtures (optional CANVAS_REGRESSION_DIR for trusted local reports).
 *
 * For each file: compile (sucrase) -> eval `new Function("React","sdk", …)` ->
 * renderToStaticMarkup. Catches compile errors, eval errors, runtime render
 * errors and out-of-subset imports. The SDK is extracted verbatim from
 * lib/client.js at test time so the harness always mirrors the shipped runtime.
 *
 * Requires react + react-dom/server (resolved through this repo's own
 * devDependencies; skips with a warning if neither is resolvable).
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createRequire } from "node:module";
import { compileCanvas } from "../lib/index.js";

const require = createRequire(import.meta.url);

function resolveReact() {
  // Bare specifiers resolve via node_modules walks rooted at this script —
  // correct under pnpm/npm. The previous implementation required absolute
  // paths like <cwd>/react plus hardcoded Homebrew global DSH copies, which
  // made the suite silently skip on every standard checkout (G4).
  try {
    const React = require("react");
    let rds;
    try { rds = require("react-dom/server.node.js"); } catch {
      rds = require("react-dom/server");
    }
    if (React && rds && rds.renderToStaticMarkup) {
      return { React, renderToStaticMarkup: rds.renderToStaticMarkup };
    }
  } catch {
    // fall through to the documented skip path
  }
  return null;
}

const react = resolveReact();
if (!react) {
  // The browser smoke covers the shipped Preact path. Keep this optional
  // React SSR regression runnable for full checkouts without making a minimal
  // production-oriented CI install fail before the host/sandbox checks run.
  throw new Error("react/react-dom required for regression; install devDependencies");
}

const { React, renderToStaticMarkup } = react;
const h = React.createElement;

// Extract the SDK-building region (helpers + createSdk) verbatim from
// lib/client.js and evaluate it in Node, so the harness mirrors the shipped runtime.
const clientSrc = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
const start = clientSrc.indexOf("function gapStyle(gap) {");
const createStart = clientSrc.indexOf("function createSdk(ReactLib) {");
if (start < 0 || createStart < 0) {
  throw new Error("SDK region not found in lib/client.js");
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

const dir = process.env.CANVAS_REGRESSION_DIR || fileURLToPath(new URL("../fixtures/", import.meta.url));
const failures = [];
const importIssues = [];
const stats = { total: 0, compiled: 0, rendered: 0, evalFailed: 0, renderFailed: 0, importIssues: 0, overBudget: 0 };

const files = (() => {
  try { return readdirSync(dir).filter((f) => f.endsWith(".canvas.tsx")).sort(); }
  catch { return []; }
})();

if (files.length === 0) throw new Error("regression fixture collection is empty");
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
