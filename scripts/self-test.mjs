#!/usr/bin/env node
/**
 * Host-level checks: path guards, compile pipeline, source maps, error
 * localization, capabilities manifest. Render regression lives in
 * scripts/regression.mjs.
 * Run: node scripts/self-test.mjs
 */
import { CAPABILITIES, cleanRef, compileCanvas, findCanvasByName, isCanvasPath, locateCompileError, openCanvas, resolveCanvasPath, sandboxBundle, writableCanvasTarget } from "../lib/index.js";
import { previewSignature } from "../lib/preview.mjs";
import { budgetMessage, budgetStatus, estimateCanvasTokens, normalizeBudget, RECOMMENDED_MAX_BYTES, RECOMMENDED_MAX_LINES, RECOMMENDED_MAX_TOKENS, sourceSignals } from "../lib/host/budget.mjs";
import { listCanvasAssets, materializeCanvasAssets, readCanvasAsset, saveCanvasAsset } from "../lib/host/assets.mjs";
import { createHotReloadManager } from "../lib/host/hot-reload.mjs";
import { homedir, tmpdir } from "node:os";
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
  const { mkdir, symlink, unlink, writeFile } = await import("node:fs/promises");
  const link = join(homedir(), ".dsh", "canvases", "z-selftest-outside.canvas.tsx");
  const outside = join(tmpdir(), `dsh-canvas-viewer-outside-${process.pid}.canvas.tsx`);
  try {
    await mkdir(join(homedir(), ".dsh", "canvases"), { recursive: true });
    await writeFile(outside, "export default function Outside() { return null; }\n", "utf8");
    await unlink(link).catch(() => {});
    await symlink(outside, link);
    let symlinkRejected = false;
    try { resolveCanvasPath(link); } catch { symlinkRejected = true; }
    assert(symlinkRejected, "absolute symlink outside HOME must be rejected");
  } finally {
    await unlink(link).catch(() => {});
    await unlink(outside).catch(() => {});
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
assert(CAPABILITIES.limits.recommendedMaxLines === RECOMMENDED_MAX_LINES, "recommended line budget is advertised");
assert(CAPABILITIES.limits.recommendedMaxBytes === RECOMMENDED_MAX_BYTES, "recommended byte budget is advertised");
assert(CAPABILITIES.limits.recommendedMaxTokens === RECOMMENDED_MAX_TOKENS, "recommended token budget is advertised");
assert(CAPABILITIES.budget.maxLines === null && CAPABILITIES.budget.maxBytes === null && CAPABILITIES.budget.maxTokens === null, "budgets remain opt-in by default");
assert(CAPABILITIES.sandbox.level === "iframe-sandbox", "sandbox capability advertised");
assert(CAPABILITIES.assets.upload.includes("/api/canvas/assets"), "asset upload capability advertised");
assert(CAPABILITIES.assets.preview.includes("/api/canvas/assets/raw"), "asset preview capability advertised");
assert(CAPABILITIES.version === "0.4.10", "capabilities version matches package release");
assert(CAPABILITIES.sandbox.fallback.includes("fail-closed"), "sandbox fallback is fail-closed");
assert(readFileSync(new URL("../lib/index.js", import.meta.url), "utf8").includes("hard-budget 拦截"), "hard budget error remains explicit");
assert(readFileSync(new URL("../lib/client.js", import.meta.url), "utf8").includes("允许兼容渲染"), "legacy rendering requires explicit user action");
ok("capabilities manifest");

// --- budget telemetry ---
assert(estimateCanvasTokens("abcd") === 1, "ascii token estimate is stable");
assert(estimateCanvasTokens("中文") === 2, "non-ascii token estimate is conservative");
const budget = normalizeBudget({ maxLines: 2, maxBytes: 4, maxTokens: 1, enforce: "hard" });
const status = budgetStatus({ lines: 3, bytes: 5, estimatedTokens: 2 }, budget);
assert(status.overBudget && status.overLines && status.overBytes && status.overTokens && status.violations.join(",") === "lines,bytes,tokens", "budget reports all dimensions");
assert(budgetMessage({ lines: 3, bytes: 5, estimatedTokens: 2 }, budget).includes("tokens"), "budget message explains token overflow");
const signals = sourceSignals("const x = 'data:image/png;base64," + "A".repeat(9000) + "';\n" + "const y = 1;\n".repeat(20));
assert(signals.inlineDataBytes > 8_000 && signals.warnings.includes("inline-data"), "source signals catch inline assets");
ok("budget telemetry");

// --- source asset references ---
{
  const { mkdir, rm, writeFile } = await import("node:fs/promises");
  const assetDir = join(homedir(), ".dsh", "canvas-assets");
  const asset = join(assetDir, "z-selftest.png");
  const canvas = join(homedir(), ".dsh", "canvases", "z-selftest-asset.canvas.tsx");
  await mkdir(assetDir, { recursive: true });
  try {
    const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    await writeFile(asset, tinyPng);
    const tinyWebp = "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AA/vuUAAA=";
    const uploaded = await saveCanvasAsset(assetDir, "z-selftest-upload.webp", `data:image/webp;base64,${tinyWebp}`);
    assert(uploaded.name === "z-selftest-upload.webp" && uploaded.bytes > 0 && uploaded.etag.startsWith('"'), "asset upload writes validated bounded image data");
    assert((await listCanvasAssets(assetDir)).some((row) => row.name === uploaded.name), "asset listing exposes uploaded files");
    const raw = await readCanvasAsset(assetDir, uploaded.name);
    assert(raw.mime === "image/webp" && raw.data.length === uploaded.bytes && raw.etag === uploaded.etag, "asset preview reads only managed image bytes with a stable validator");
    const materialized = await materializeCanvasAssets('const src = "asset://z-selftest.png";', assetDir);
    assert(materialized.source.includes("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), "asset reference materializes as data URI");
    assert(materialized.signature.includes("z-selftest.png"), "asset mtime participates in compile cache signature");
    let escaped = false;
    try { await materializeCanvasAssets('const src = "asset://../secret.png";', assetDir); } catch { escaped = true; }
    assert(escaped, "asset reference cannot escape managed directory");
    let encodedEscape = false;
    try { await readCanvasAsset(assetDir, "%2e%2e%2Fsecret.png"); } catch { encodedEscape = true; }
    assert(encodedEscape, "encoded asset reference cannot escape managed directory");
    let spoofed = false;
    try { await saveCanvasAsset(assetDir, "z-selftest-spoof.png", "data:image/png;base64,bm90LWltYWdl"); } catch { spoofed = true; }
    assert(spoofed, "asset upload rejects content with a mismatched image signature");
    await writeFile(canvas, 'export default function AssetProbe() { return <img src="asset://z-selftest.png" />; }\n', "utf8");
    const payload = await openCanvas(canvas);
    assert(payload.source.includes("asset://z-selftest.png"), "openCanvas preserves compact asset source");
    assert(payload.compiled.includes("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), "openCanvas compiles asset into sandbox-safe data URI");
  } finally {
    await rm(asset, { force: true });
    await rm(join(assetDir, "z-selftest-upload.webp"), { force: true });
    await rm(join(assetDir, "z-selftest-spoof.png"), { force: true });
    await rm(canvas, { force: true });
  }
}
ok("canvas asset references");

// --- asset watcher refresh ---
{
  const { mkdir, rm, writeFile } = await import("node:fs/promises");
  const assetDir = join(homedir(), ".dsh", "canvas-assets");
  const asset = join(assetDir, "z-selftest-watch.png");
  const writes = [];
  const client = { write(message) { writes.push(String(message)); } };
  await mkdir(assetDir, { recursive: true });
  await writeFile(asset, "before", "utf8");
  const manager = createHotReloadManager({
    watchDirs: [assetDir],
    buildPayload: async () => ({ ok: true, reason: "asset-change" }),
  });
  try {
    manager.open(join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "audit-sample.canvas.tsx"), client);
    await new Promise((resolve) => setTimeout(resolve, 40));
    await writeFile(asset, "after", "utf8");
    await new Promise((resolve) => setTimeout(resolve, 420));
    assert(writes.some((message) => message.includes("asset-change")), "asset changes trigger an open canvas reload");
  } finally {
    manager.closeAll();
    await rm(asset, { force: true });
  }
  assert(manager.size() === 0, "asset watcher closes with hot reload manager");
}
ok("asset watcher refresh");

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
const hotReloadFile = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "host", "hot-reload.mjs");
const installFile = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "sync-install.sh");
const clientSrc = readFileSync(clientFile, "utf8");
const hostSrc = readFileSync(hostFile, "utf8");
const hotReloadSrc = readFileSync(hotReloadFile, "utf8");
const installSrc = readFileSync(installFile, "utf8");
assert(clientSrc.includes("data-dsh-cv-theme") && clientSrc.includes("toggleTheme"), "theme toggle wired");
assert(clientSrc.includes("detectHostTheme") && clientSrc.includes("data-ds-dark-theme") && clientSrc.includes("hostThemeObserver"), "canvas theme follows the dsh host by default and observes appearance changes");
assert(clientSrc.includes("localStorage.removeItem(THEME_KEY)") && !clientSrc.includes("localStorage.setItem(THEME_KEY"), "obsolete independent canvas theme persistence is removed");
assert(clientSrc.includes("dsh-cv-lib-topline-actions") && clientSrc.includes("dsh-cv-lib-count"), "gallery uses a compact title row with theme control and count");
assert(clientSrc.includes("dsh-cv-lib-menu") && clientSrc.includes("更多操作"), "gallery groups secondary actions in a compact menu");
assert(!clientSrc.includes("item.provenance"), "gallery removes low-value provenance chrome from the primary list");
assert(clientSrc.includes("@media (max-width:760px)") && clientSrc.includes("100dvh"), "mobile full-screen css present");
assert(!clientSrc.includes("dsh-cv-meta") && !clientSrc.includes("dsh-cv-resize") && clientSrc.includes('renderMode === "legacy"'), "canvas-first window has no metadata footer or resize rails");
assert(!clientSrc.includes("hasLineBudget") && !clientSrc.includes("metaInfo"), "footer cleanup leaves no stale metadata references in ViewerShell");
assert(!clientSrc.includes('"aria-modal": "true"'), "aria-modal omitted (host mobile-sheet selector collision)");
assert(clientSrc.includes("new MessageChannel()") && clientSrc.includes("dsh-cv:init"), "sandbox MessageChannel handshake present");
assert(clientSrc.includes("connect-src 'none'") && clientSrc.includes("worker-src 'none'"), "sandbox CSP blocks network and workers");
assert(clientSrc.includes("script-src 'unsafe-inline' blob:") && !clientSrc.includes("script-src 'unsafe-inline' 'unsafe-eval'"), "sandbox CSP uses Blob modules without unsafe-eval");
assert(clientSrc.includes("Content-Security-Policy"), "sandbox CSP meta is installed");
assert(hostSrc.includes("migrationBy") && hostSrc.includes("row.provenance"), "host annotates provenance from migration manifest");
assert(clientSrc.includes("budgetState") && clientSrc.includes("refreshBudget"), "client reads budget policy from capabilities");
assert(hostSrc.includes("getBudgetPolicy") && hostSrc.includes('budget.enforce') && hostSrc.includes("hard-budget 拦截"), "host budget policy (unrestricted default, hard opt-in)");
assert(hostSrc.includes("estimatedTokens") && hostSrc.includes("maxBytes") && hostSrc.includes("maxTokens"), "host exposes byte/token telemetry");
assert(hostSrc.includes("sourceSignals") && clientSrc.includes("含 "), "source-shape warnings reach the gallery");
assert(hostSrc.includes("let path;") && hostSrc.includes("if (path)"), "hard-budget rejection is outside the path-resolution catch");
assert(hostSrc.includes("preact.umd.js") && hostSrc.includes("preact-compat"), "host sandbox bundle serves preact-compat");
assert(clientSrc.includes("window.preactCompat") && clientSrc.includes("ReactDOM.createRoot"), "client srcdoc boots preact compat with createRoot shim");
assert(hostSrc.includes("hotReload.closeAll();") && hotReloadSrc.includes("function closeAll()"), "plugin disposal closes SSE watchers and clients");
assert(hostSrc.includes("watchDirs: [DSH_CANVAS_ASSET_DIR]") && hotReloadSrc.includes("ensureDirectoryWatchers"), "asset directory watcher is lifecycle-owned");
assert(installSrc.includes("verify_profile_copy") && installSrc.includes('dsh plugin --profile web remove "$PKG"'), "local install verifies and refreshes stale same-version packages");
assert(installSrc.includes("README.en.md") && installSrc.includes("lib/host/assets.mjs") && installSrc.includes("src/host/assets.mts") && installSrc.includes("tsconfig.json"), "local install syncs bilingual docs and typed asset source");
assert(!installSrc.includes("approve-builds"), "local install never approves unrelated build scripts");
assert(clientSrc.includes("dsh-cv-lib-row-summary"), "gallery presents one compact structural summary per report");
assert(hostSrc.includes("previewSignature") && hostSrc.includes("readCanvasSource"), "host annotates gallery rows with structural preview");
assert(!clientSrc.includes("TEMP BISECT PROBE") && !clientSrc.includes("mergedProbe"), "no leftover bisect probe / old call-timing bubble path");
assert(clientSrc.includes("pending[ev.data.callId]") && clientSrc.includes("tool/result") && clientSrc.includes("isError"), "bubble result-gating is reachable");
assert(hostSrc.includes("canvasMetaCache") && hostSrc.includes("invalidateCanvasMeta"), "gallery metadata cache present");
assert(hostSrc.includes("sandboxBundleCache"), "sandbox bundle cached");
assert(!clientSrc.includes("feDisplacementMap") && !clientSrc.includes("LIQUID_FILTER_ID"), "viewer avoids noisy optical displacement on the reading window");
assert(clientSrc.includes(".dsh-cv-win::before") && clientSrc.includes("backdrop-filter:none"), "window uses a clean composited edge without full-surface blur");
assert(clientSrc.includes("dsh-cv-traffic-btn") && clientSrc.includes("dsh-cv-toolgroup"), "macOS-style functional window controls and grouped tools are present");
assert(clientSrc.includes("dsh-cv-window-close") && !clientSrc.includes('className: "dsh-cv-traffic-btn dsh-cv-close"'), "traffic-light close control is isolated from legacy host class overrides");
assert(clientSrc.includes("dsh-cv-zoom") && clientSrc.includes("--cv-scale"), "canvas zoom control scales the isolated pixel plane");
assert(clientSrc.includes("--cv-canvas-base:#171b21") && clientSrc.includes("--cv-canvas-base:#f2f3f5"), "sandbox canvas has dynamic stable neutral reading bases");
assert(clientSrc.includes("dsh-cv-explicit-close") && clientSrc.includes('"aria-label": "关闭 Canvas"'), "viewer exposes an always-visible close action");
assert(clientSrc.includes("html[data-dsh-cv-theme='light'] .cv-callout[data-tone='warning']"), "light canvas overrides dark-only semantic callout fills");
assert(clientSrc.includes(".dsh-cv-sandbox-wrap{padding:0;border:0;border-radius:0"), "sandbox uses one undistorted opaque pixel plane without a translucent inset");
assert(clientSrc.includes("dsh:canvas:themechange") && clientSrc.includes("readLiveTheme"), "useHostTheme reacts to sandbox theme changes");
assert(clientSrc.includes("removeOwnedChrome") && !clientSrc.includes("svg.remove()"), "client-owned chrome cleanup has no obsolete SVG filter lifecycle");
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
