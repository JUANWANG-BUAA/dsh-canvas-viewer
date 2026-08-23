#!/usr/bin/env node
/**
 * Host-level checks: path guards, compile pipeline, source maps, error
 * localization, capabilities manifest. Render regression lives in
 * scripts/regression.mjs.
 * Run: node scripts/self-test.mjs
 */
import { CAPABILITIES, cleanRef, compileCanvas, findCanvasByName, isCanvasPath, locateCompileError, openCanvas, resolveCanvasPath, sandboxBundle, writableCanvasTarget } from "../lib/index.js";
import { previewSignature } from "../lib/preview.mjs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

let checks = 0;
const assert = (cond, message) => { checks += 1; if (!cond) throw new Error(message); };
const ok = () => {};

// --- path guards ---
assert(isCanvasPath("x.canvas.tsx"), "suffix ok");
assert(!isCanvasPath("x.tsx"), "reject non-canvas");
assert(isCanvasPath('"x.canvas.tsx"'), "strips quotes");
assert(isCanvasPath("[`~/x/foo.canvas.tsx`]"), "strips brackets/backticks");
assert(isCanvasPath("x.canvas.tsx."), "strips trailing punctuation, suffix ok");
assert(cleanRef("`foo.canvas.tsx`") === "foo.canvas.tsx", "cleanRef strips backticks");
assert(cleanRef("[x.canvas.tsx]") === "x.canvas.tsx", "cleanRef strips brackets");
ok("path guards");

const homeFile = join(homedir(), "demo.canvas.tsx");
assert(resolveCanvasPath(homeFile) === homeFile, "absolute home path");
assert(cleanRef("~/demo.canvas.tsx") === "~/demo.canvas.tsx", "tilde path preserved by cleanRef");
let rejected = false;
try { resolveCanvasPath("/tmp/evil.canvas.tsx"); } catch { rejected = true; }
assert(rejected, "must reject outside home");
let saveRejectedOutside = false;
try { writableCanvasTarget(homeFile); } catch { saveRejectedOutside = true; }
assert(saveRejectedOutside, "save must reject files outside the canvas directory");
let saveRejectedTmp = false;
try { writableCanvasTarget("/tmp/evil.canvas.tsx"); } catch { saveRejectedTmp = true; }
assert(saveRejectedTmp, "save must reject /tmp paths");
{
  const { symlink, unlink, writeFile } = await import("node:fs/promises");
  const link = join(homedir(), ".dsh", "canvases", "z-selftest-outside.canvas.tsx");
  try {
    await writeFile("/tmp/dsh-canvas-viewer-outside.canvas.tsx", "export default function Outside() { return null; }\n", "utf8");
    await unlink(link).catch(() => {});
    await symlink("/tmp/dsh-canvas-viewer-outside.canvas.tsx", link);
    let symlinkRejected = false;
    try { resolveCanvasPath(link); } catch { symlinkRejected = true; }
    assert(symlinkRejected, "absolute symlink outside HOME must be rejected");
  } finally {
    await unlink(link).catch(() => {});
    await unlink("/tmp/dsh-canvas-viewer-outside.canvas.tsx").catch(() => {});
  }
}
ok("resolve guards");

const probe = "ds-fim-engineering-doc.canvas.tsx";
const found = findCanvasByName(probe);
if (found) {
  assert(resolveCanvasPath(probe) === found, "basename resolves to canvases/");
  assert(found.includes("/canvases/"), "found under canvases");
}
ok("find by name");

// --- compile pipeline ---
const source = 'import { H1, Stack, Text, Table, mergeStyle } from "dsh/canvas";\n' +
  'export default function SelfTest() {\n' +
  '  return (\n' +
  '    <Stack gap={12} style={mergeStyle({ padding: 4 })}>\n' +
  '      <H1>ok</H1>\n' +
  '      <Text tone="secondary">probe</Text>\n' +
  '      <Table headers={["a"]} rows={[["1"]]} rowTone={["info"]} striped />\n' +
  '    </Stack>\n' +
  '  );\n' +
  '}\n';
const compiled = await compileCanvas(source, join(homedir(), "self-test.canvas.tsx"));
assert(typeof compiled.code === "string" && compiled.code.length > 0, "returns code string");
assert(compiled.sourceMap && typeof compiled.sourceMap.mappings === "string", "returns source map");
assert(typeof compiled.mapOffset === "number" && compiled.mapOffset > 0, "returns mapOffset");
assert(compiled.code.includes("function SelfTest"), "keeps component");
assert(compiled.code.includes("BarChart"), "prelude exports charts");
assert(compiled.code.includes("sdk"), "injects sdk prelude");
assert(!compiled.code.includes('from "dsh/canvas"'), "strips dsh import");
assert(!compiled.code.includes('from "cursor/canvas"'), "strips cursor import");
ok("compile pipeline");

// --- compile-error localization ---
const bad = 'export default function Bad() {\n  return <Stack\n}\n';
let localized = false;
try {
  await compileCanvas(bad, join(homedir(), "bad.canvas.tsx"));
} catch (e) {
  assert(typeof e.message === "string" && e.message.includes("bad.canvas.tsx"), "message includes file");
  assert(e.line > 0, "error exposes line");
  localized = true;
}
assert(localized, "syntax errors are localized to file:line");
ok("compile error localization");

// locateCompileError standalone
const enriched = locateCompileError(new Error("boom (3:7)"), "a\nb\nc", "/u/x.canvas.tsx", 0);
assert(enriched.line === 3 && enriched.column === 7, "parses (line:col)");
ok("locateCompileError");

// --- capabilities manifest ---
assert(CAPABILITIES.ok === true, "capabilities ok");
assert(CAPABILITIES.imports.native === "dsh/canvas", "native import declared");
assert(Array.isArray(CAPABILITIES.hooks) && CAPABILITIES.hooks.includes("useHostTheme"), "hooks listed");
assert(CAPABILITIES.components.BarChart.props.includes("referenceLines"), "chart props advertised");
assert(CAPABILITIES.components.Table.props.includes("sortable"), "table sortable advertised");
assert(CAPABILITIES.features.hotReload.includes("/api/canvas/watch"), "hot reload advertised");
assert(CAPABILITIES.features.sourceEdit.includes("/api/canvas/save"), "source save advertised");
assert(CAPABILITIES.limits.recommendedMaxLines === null, "line budget is opt-in by default");
assert(CAPABILITIES.sandbox.level === "iframe-sandbox", "sandbox capability advertised");
assert(CAPABILITIES.version === "0.4.3", "capabilities version matches package release");
assert(CAPABILITIES.sandbox.fallback.includes("fail-closed"), "sandbox fallback is fail-closed");
assert(readFileSync(new URL("../lib/index.js", import.meta.url), "utf8").includes("hard-budget 拦截"), "hard budget error remains explicit");
assert(readFileSync(new URL("../lib/client.js", import.meta.url), "utf8").includes("允许兼容渲染"), "legacy rendering requires explicit user action");
ok("capabilities manifest");

// --- sandbox bundle ---
const sb = await sandboxBundle();
assert(sb.available === true, "sandbox bundle available");
assert(sb.runtime === "preact-compat", "preact-compat runtime");
assert(typeof sb.preact === "string" && sb.preact.length < 15000, "preact core umd present & small");
assert(typeof sb.preactHooks === "string" && sb.preactHooks.length < 6000, "preact hooks umd present & small");
assert(typeof sb.compat === "string" && sb.compat.length < 15000, "preact compat umd present & small");
assert(sb.sdk.includes("function createSdk"), "sdk region extracted from client.js");
assert(sb.isolation.includes("iframe"), "isolation described");
ok("sandbox bundle");

// --- openCanvas payload shape (regression: buffer-shape mismatch once made every open fail) ---
{
  const { writeFile, mkdir, rm } = await import("node:fs/promises");
  const tmp = join(homedir(), ".dsh", "canvases", "z-selftest-tmp.canvas.tsx");
  const historyFile = join(homedir(), ".dsh", "canvas-viewer", "history.json");
  let historyBackup = null;
  try { historyBackup = readFileSync(historyFile, "utf8"); } catch { /* absent is fine */ }
  const fixtureSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "audit-sample.canvas.tsx"), "utf8");
  try {
    await writeFile(tmp, fixtureSrc, "utf8");
    const payload = await openCanvas(tmp);
    assert(payload && payload.ok !== false, "openCanvas resolves");
    assert(typeof payload.source === "string" && payload.source.length > 0, "openCanvas returns source");
    assert(typeof payload.compiled === "string" && payload.compiled.length > 0, "openCanvas returns compiled code");
    assert(typeof payload.bytes === "number" && payload.bytes > 0, "openCanvas returns nonzero bytes");
    assert(payload.lines > 5, "openCanvas returns line count");
  } finally {
    await rm(tmp, { force: true });
    if (historyBackup != null) {
      await mkdir(dirname(historyFile), { recursive: true });
      await writeFile(historyFile, historyBackup, "utf8");
    }
  }
}
ok("openCanvas payload");

// --- UI / mobile surface (source-level regression net) ---
const clientFile = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "client.js");
const hostFile = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "index.js");
const clientSrc = readFileSync(clientFile, "utf8");
const hostSrc = readFileSync(hostFile, "utf8");
assert(clientSrc.includes("data-dsh-cv-theme") && clientSrc.includes("toggleTheme"), "theme toggle wired");
assert(clientSrc.includes("dsh-cv-lib-topline-actions") && clientSrc.includes("dsh-cv-lib-count"), "gallery uses a compact title row with theme control and count");
assert(clientSrc.includes("dsh-cv-lib-menu") && clientSrc.includes("更多操作"), "gallery groups secondary actions in a compact menu");
assert(!clientSrc.includes("item.provenance"), "gallery removes low-value provenance chrome from the primary list");
assert(clientSrc.includes("@media (max-width:760px)") && clientSrc.includes("100dvh"), "mobile full-screen css present");
assert(!clientSrc.includes("dsh-cv-meta") && !clientSrc.includes("dsh-cv-resize") && clientSrc.includes('renderMode === "legacy"'), "canvas-first window has no metadata footer or resize rails");
assert(!clientSrc.includes("hasLineBudget") && !clientSrc.includes("metaInfo"), "footer cleanup leaves no stale metadata references in ViewerShell");
assert(!clientSrc.includes('"aria-modal": "true"'), "aria-modal omitted (host mobile-sheet selector collision)");
assert(clientSrc.includes("new MessageChannel()") && clientSrc.includes("dsh-cv:init"), "sandbox MessageChannel handshake present");
assert(clientSrc.includes("connect-src 'none'") && clientSrc.includes("worker-src 'none'"), "sandbox CSP blocks network and workers");
assert(clientSrc.includes("Content-Security-Policy"), "sandbox CSP meta is installed");
assert(hostSrc.includes("migrationBy") && hostSrc.includes("row.provenance"), "host annotates provenance from migration manifest");
assert(clientSrc.includes("budgetState") && clientSrc.includes("refreshBudget"), "client reads budget policy from capabilities");
assert(hostSrc.includes("getBudgetPolicy") && hostSrc.includes('budget.enforce') && hostSrc.includes("hard-budget 拦截"), "host budget policy (unrestricted default, hard opt-in)");
assert(hostSrc.includes("let path;") && hostSrc.includes("if (path)"), "hard-budget rejection is outside the path-resolution catch");
assert(hostSrc.includes("preact.umd.js") && hostSrc.includes("preact-compat"), "host sandbox bundle serves preact-compat");
assert(clientSrc.includes("window.preactCompat") && clientSrc.includes("ReactDOM.createRoot"), "client srcdoc boots preact compat with createRoot shim");
assert(clientSrc.includes("dsh-cv-lib-row-summary"), "gallery presents one compact structural summary per report");
assert(hostSrc.includes("previewSignature") && hostSrc.includes("readCanvasSource"), "host annotates gallery rows with structural preview");
assert(!clientSrc.includes("TEMP BISECT PROBE") && !clientSrc.includes("mergedProbe"), "no leftover bisect probe / old call-timing bubble path");
assert(clientSrc.includes("pending[ev.data.callId]") && clientSrc.includes("tool/result") && clientSrc.includes("isError"), "bubble result-gating is reachable");
assert(hostSrc.includes("canvasMetaCache") && hostSrc.includes("invalidateCanvasMeta"), "gallery metadata cache present");
assert(hostSrc.includes("sandboxBundleCache"), "sandbox bundle cached");
assert(clientSrc.includes("feDisplacementMap") && clientSrc.includes("LIQUID_FILTER_ID"), "liquid edge refraction filter is installed");
assert(clientSrc.includes(".dsh-cv-win::before") && clientSrc.includes("-webkit-mask-composite:xor"), "refraction is confined to the window perimeter");
assert(clientSrc.includes("backdrop-filter:url('#dsh-cv-liquid-edge')"), "edge filter samples the backdrop instead of only warping its highlight");
assert(clientSrc.includes('var canvasBase = light ? "#f6f7f9" : "#171b21"'), "sandbox canvas has a stable neutral reading base");
assert(clientSrc.includes(".dsh-cv-sandbox-wrap{padding:7px;overflow:hidden"), "sandbox wrapper uses a restrained inner boundary");
assert(clientSrc.includes("removeOwnedChrome") && clientSrc.includes("svg.remove()"), "client-owned chrome cleans up on unload");
{
  const pkgJson = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"));
  const inject = pkgJson.dsh && pkgJson.dsh.client && pkgJson.dsh.client.inject;
  assert(!inject || inject.length === 0, "client manifest declares no baseline inject duplicates");
}
{
  // Repo fixture keeps the test machine-independent; the live copy under
  // ~/.dsh/canvases is covered by regression.mjs when present.
  const auditSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "audit-sample.canvas.tsx"), "utf8");
  const p = previewSignature(auditSrc);
  assert(p && p.headline && p.headline.includes("自验收"), "previewSignature extracts headline from a real canvas");
  assert(typeof p.hasChart === "boolean" && p.hasChart === true, "previewSignature flags charts");
}
ok("ui/mobile surface");

// --- client factory bundle: materialize the way the dsh web loader does ---
{
  const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"));
  assert(clientSrc.startsWith('window.__ModuleLoader__.load({'), "client.js is a __ModuleLoader__ factory bundle");
  let spec = null;
  const loaderWindow = { localStorage: { getItem: () => null }, __ModuleLoader__: { load(s) { spec = s; } } };
  const prevWindow = globalThis.window;
  globalThis.window = loaderWindow;
  try {
    (0, eval)(clientSrc);
  } finally {
    globalThis.window = prevWindow;
  }
  assert(spec && spec.id === pkg.name, "factory id equals package name");
  const noop = () => ({});
  class ComponentStub {}
  const reactStub = new Proxy(
    { Component: ComponentStub, version: "18.3.1" },
    { get: (t, k) => (k in t ? t[k] : noop) },
  );
  const fakeRequire = (name) => {
    if (name === "react" || name === "react-dom/client") return reactStub;
    throw new Error("unexpected require: " + name);
  };
  const clientModule = spec.factory(fakeRequire);
  assert(typeof clientModule.apply === "function", "factory exports apply(ctx)");
  assert(Array.isArray(clientModule.inject) && clientModule.inject.includes("slots") && clientModule.inject.includes("conversationEvents"), "factory declares inject services");
}
ok("client factory bundle");

console.log(JSON.stringify({ ok: true, checks }, null, 2));
