#!/usr/bin/env node
/**
 * Browser CI smoke test for the shipped client factory and sandbox iframe.
 * It uses the real Playwright Chromium browser, while a tiny local HTTP host
 * supplies the same API/assets contract as dsh Web.
 */
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { compileCanvas, sandboxBundle } from "../lib/index.js";
import { parseCanvasReport, reportToCanvasSource } from "../lib/report/schema.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixturePath = join(root, "fixtures", "audit-sample.canvas.tsx");
const fixtureSource = "globalThis.__canvasParentProbe = true;\n" + await readFile(fixturePath, "utf8");
const compiled = await compileCanvas(fixtureSource, fixturePath);
const bundle = await sandboxBundle();
const clientSource = await readFile(join(root, "lib", "client.js"), "utf8");
if (!clientSource.includes("dsh-cv-lib-thumb") || !clientSource.includes("/assets/raw?name=")) {
  throw new Error("gallery pixel thumbnail contract missing");
}
const assets = new Map([
  ["/assets/preact.umd.js", "preact"],
  ["/assets/preact-hooks.umd.js", "preactHooks"],
  ["/assets/preact-compat.umd.js", "compat"],
]);

let payload = {
  revision: createHash("sha256").update(fixtureSource).digest("hex"),
  ok: true,
  seq: 1,
  path: fixturePath,
  title: "audit-sample.canvas.tsx",
  source: fixtureSource,
  compiled: compiled.code,
  moduleCode: compiled.moduleCode,
  sourceMap: compiled.sourceMap,
  mapOffset: compiled.mapOffset,
  error: "",
  lines: fixtureSource.split("\n").length,
  bytes: Buffer.byteLength(fixtureSource),
};

// A real 1×1 PNG keeps this test independent of external assets while still
// proving that Chromium fetched and decoded the raw thumbnail endpoint.
const thumbnailBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const libraryItem = {
  path: fixturePath,
  title: "audit-sample.canvas.tsx",
  shortPath: "~/fixtures/audit-sample.canvas.tsx",
  bytes: payload.bytes,
  lines: payload.lines,
  estimatedTokens: Math.ceil(payload.bytes / 4),
  warnings: [],
  overBudget: false,
  violations: [],
  preview: { headline: "Browser smoke fixture", assetRef: "asset://thumb.png" },
  assetRef: "asset://thumb.png",
  mtimeMs: Date.now(),
  workspaceId: "browser-smoke",
  workspace: "Browser smoke",
};
let uploadedAsset = null;
const watchers = new Set();
let lastSave = null;
async function updatePayload(source) {
  const output = await compileCanvas(source);
  payload = { ...payload, seq: payload.seq + 1, source, revision: createHash("sha256").update(source).digest("hex"), compiled: output.code, moduleCode: output.moduleCode, sourceMap: output.sourceMap, mapOffset: output.mapOffset };
  for (const res of watchers) res.write("data: " + JSON.stringify({ type: "reload", payload }) + "\n\n");
  return payload;
}

function sendJson(res, value) {
  const body = JSON.stringify(value);
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
  if (url.pathname === "/") {
    const html = `<!doctype html><meta charset="utf-8"><title>Canvas browser smoke</title>
      <button id="open-link" data-canvas="audit-sample.canvas.tsx">打开 fixture</button>
      <div id="tail-mount"></div>
      <div id="library-mount"></div>
      <script src="/assets/preact.umd.js"></script>
      <script src="/assets/preact-hooks.umd.js"></script>
      <script src="/assets/preact-compat.umd.js"></script>
      <script>window.__ModuleLoader__={load:function(def){window.__pluginDef=def;}};</script>
      <script src="/client.js"></script>
      <script>
        var compat=window.preactCompat;
        if(!compat.createRoot){compat.createRoot=function(c){return {render:function(v){return compat.render(v,c);},unmount:function(){compat.render(null,c);}};};}
        var plugin=window.__pluginDef.factory(function(id){
          if(id==='react'||id==='react-dom/client') return compat;
          throw new Error('unexpected require: '+id);
        });
        window.__plugin=plugin;
        window.__fixturePath=${JSON.stringify(fixturePath)};
        var ctx={
          uiConversation:{events:{register:function(){return function(){};}}},
          slots:{inject:function(name,fn){if(name==='conversation.chat.turnTail'||name==='settings.section') fn();},register:function(def,component){if(def&&def.name==='conversation.chat.turnTail'){window.__tailSlot={def:def,component:component};}if(def&&def.name==='settings.section'){window.__settingsSlot={def:def,component:component};}return function(){};}},
          effect:function(fn){var dispose=fn();return dispose;}
        };
        plugin.apply(ctx);
        if(window.__tailSlot){
          var tailOwner={turn:{data:{get:function(){return {paths:[{path:window.__fixturePath,seq:1}]};}}},seq:1};
          compat.render(compat.createElement(window.__tailSlot.component,tailOwner),document.getElementById('tail-mount'));
        }
        if(window.__settingsSlot){
          compat.render(compat.createElement(window.__settingsSlot.component,{}),document.getElementById('library-mount'));
        }
      </script>`;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  if (url.pathname === "/client.js") {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    res.end(clientSource);
    return;
  }
  if (assets.has(url.pathname)) {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    res.end(bundle[assets.get(url.pathname)]);
    return;
  }
  if (url.pathname === "/api/canvas/capabilities") {
    sendJson(res, { ok: true, budget: { maxLines: null, maxBytes: null, maxTokens: null, enforce: "soft" } });
    return;
  }
  if (url.pathname === "/api/canvas/list" && req.method === "GET") {
    sendJson(res, {
      ok: true,
      count: 1, total: 1, nextOffset: null,
      truncated: false,
      items: [libraryItem],
      workspaces: [{ id: "browser-smoke", label: "Browser smoke" }],
    });
    return;
  }
  if (url.pathname === "/api/canvas/assets" && req.method === "GET") {
    sendJson(res, {
      ok: true,
      assets: [
        { name: "thumb.png", bytes: thumbnailBytes.length, href: "asset://thumb.png" },
        ...(uploadedAsset ? [uploadedAsset] : []),
      ],
    });
    return;
  }
  if (url.pathname === "/api/canvas/assets" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body || "{}");
    if (!request.name || !String(request.data || "").startsWith("data:image/")) {
      sendJson(res, { ok: false, error: "invalid asset upload" });
      return;
    }
    uploadedAsset = {
      name: String(request.name),
      bytes: Buffer.byteLength(String(request.data)),
      href: `asset://${String(request.name)}`,
    };
    sendJson(res, { ok: true, ...uploadedAsset });
    return;
  }
  if (url.pathname === "/api/canvas/assets/raw" && req.method === "GET") {
    if (url.searchParams.get("name") !== "thumb.png") {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "asset not found" }));
      return;
    }
    res.writeHead(200, {
      "content-type": "image/png",
      "content-length": thumbnailBytes.length,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(thumbnailBytes);
    return;
  }
  if (url.pathname === "/api/canvas/sandbox") {
    await new Promise(resolve => setTimeout(resolve, 150)); // exercise the pending execution boundary
    sendJson(res, bundle);
    return;
  }
  if (url.pathname === "/api/canvas/open") {
    req.resume();
    sendJson(res, payload);
    return;
  }
  if (url.pathname === "/api/canvas/save") {
    let body = ""; for await (const chunk of req) body += chunk;
    lastSave = JSON.parse(body);
    if (lastSave.baseRevision !== payload.revision) {
      res.writeHead(409, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, code: "revision-conflict", error: "changed", currentRevision: payload.revision })); return;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
    sendJson(res, await updatePayload(lastSave.source)); return;
  }
  if (url.pathname === "/api/canvas/watch") {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write("retry: 2000\n\n");
    watchers.add(res);
    req.on("close", () => { watchers.delete(res); res.end(); });
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const browser = process.env.CANVAS_CDP_URL ? await chromium.connectOverCDP(process.env.CANVAS_CDP_URL) : await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
try {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${address.port}/`);
  const sanitizeFunction = clientSource.slice(clientSource.indexOf("    function printableSnapshot("), clientSource.indexOf('    var DRAFT_KEY ='));
  const sanitized = await page.evaluate(({ helper }) => {
    const sanitize = new Function("css", helper + ";return printableSnapshot;") ("");
    return sanitize('<div><script>top.__unsafe=1</script><a href="https://example.invalid">keep linked text</a><button onclick="top.__unsafe=1">keep heading</button><img src="https://example.invalid/track" onerror="top.__unsafe=1"><svg><foreignObject><iframe src="https://example.invalid"></iframe></foreignObject><text>chart</text></svg><p style="background:url(https://example.invalid/track);color:red">body</p></div>');
  }, { helper: sanitizeFunction });
  assert(!sanitized.includes("<script") && !sanitized.includes("onclick") && !sanitized.includes("onerror"));
  assert(!sanitized.includes("example.invalid") && !sanitized.includes("foreignObject") && !sanitized.includes("<iframe"));
  assert(sanitized.includes("keep linked text") && sanitized.includes("keep heading") && sanitized.includes("chart"));
  const tail = page.locator(".dsh-cv-tail");
  await tail.waitFor({ state: "visible", timeout: 10_000 });
  const tailContract = await tail.evaluate((node) => ({
    label: node.querySelector("button")?.getAttribute("aria-label"),
    title: node.querySelector(".dsh-cv-tail-name")?.textContent,
    blur: getComputedStyle(node).backdropFilter || getComputedStyle(node).webkitBackdropFilter,
    background: getComputedStyle(node).backgroundColor,
    focusable: node.querySelector("button")?.getAttribute("type") === "button",
  }));
  if (!tailContract.label || !tailContract.title || !tailContract.focusable || tailContract.blur !== "none" || tailContract.background === "rgba(0, 0, 0, 0)") {
    throw new Error(`chat canvas bubble contract failed: ${JSON.stringify(tailContract)}`);
  }
  const library = page.locator(".dsh-cv-lib");
  await library.waitFor({ state: "visible", timeout: 10_000 });
  const thumbnail = library.locator(".dsh-cv-lib-thumb");
  await thumbnail.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(() => {
    const image = document.querySelector(".dsh-cv-lib-thumb");
    return !!image && image.complete && image.naturalWidth > 0;
  }, undefined, { timeout: 10_000 });
  const thumbnailContract = await thumbnail.evaluate((node) => ({
    src: node.getAttribute("src"),
    naturalWidth: node.naturalWidth,
    naturalHeight: node.naturalHeight,
  }));
  if (!thumbnailContract.src?.includes("/api/canvas/assets/raw?name=thumb.png") || thumbnailContract.naturalWidth < 1) {
    throw new Error(`gallery thumbnail contract failed: ${JSON.stringify(thumbnailContract)}`);
  }
  await library.locator("input[type=file]").setInputFiles({
    name: "browser-upload.png",
    mimeType: "image/png",
    buffer: thumbnailBytes,
  });
  await page.waitForFunction(() => {
    const node = document.querySelector(".dsh-cv-lib-toast");
    return !!node && /已上传/.test(node.textContent || "");
  }, undefined, { timeout: 10_000 });
  if (!uploadedAsset || !uploadedAsset.name.endsWith(".webp")) {
    throw new Error(`gallery upload contract failed: ${JSON.stringify(uploadedAsset)}`);
  }
  await page.locator("#open-link").click();
  const viewer = page.locator(".dsh-cv-win");
  await viewer.waitFor({ state: "visible", timeout: 10_000 });
  const frame = page.locator("iframe");
  try {
    await frame.waitFor({ state: "attached", timeout: 10_000 });
  } catch (error) {
    throw new Error(`sandbox iframe missing: ${String(error.message || error)}; console=${errors.join(" | ")}; body=${(await page.locator("body").innerText()).slice(0, 500)}`);
  }
  const iframeContract = await frame.evaluate((node) => ({
    sandbox: node.getAttribute("sandbox"),
    hasCsp: node.srcdoc.includes("Content-Security-Policy"),
    deniesNetwork: node.srcdoc.includes("connect-src 'none'"),
    allowsRuntime: node.srcdoc.includes("script-src 'unsafe-inline' blob:"),
    allowsBlobModules: node.srcdoc.includes("script-src 'unsafe-inline' blob:"),
    blocksEval: !node.srcdoc.includes("'unsafe-eval'"),
  }));
  if (iframeContract.sandbox !== "allow-scripts") throw new Error("iframe sandbox contract changed");
  if (!iframeContract.hasCsp || !iframeContract.deniesNetwork || !iframeContract.allowsBlobModules || !iframeContract.blocksEval) {
    throw new Error(`iframe CSP contract failed: ${JSON.stringify(iframeContract)}`);
  }
  const chromeContract = await viewer.evaluate((node) => ({
    backdrop: getComputedStyle(node).backdropFilter || getComputedStyle(node).webkitBackdropFilter,
    traffic: node.querySelectorAll(".dsh-cv-traffic-btn").length,
    toolgroups: node.querySelectorAll(".dsh-cv-toolgroup").length,
    explicitClose: node.querySelectorAll(".dsh-cv-explicit-close").length,
    wrapperPadding: getComputedStyle(node.querySelector(".dsh-cv-sandbox-wrap")).padding,
    iframeBackground: getComputedStyle(node.querySelector("iframe")).backgroundColor,
  }));
  if (chromeContract.backdrop !== "none" || chromeContract.traffic !== 3 || chromeContract.toolgroups !== 2 || chromeContract.explicitClose !== 1) {
    throw new Error(`viewer chrome contract failed: ${JSON.stringify(chromeContract)}`);
  }
  if (chromeContract.wrapperPadding !== "0px" || !chromeContract.iframeBackground.includes("23, 27, 33")) {
    throw new Error(`pixel-plane contract failed: ${JSON.stringify(chromeContract)}`);
  }
  await viewer.locator(".dsh-cv-traffic-btn[data-kind=minimize]").click();
  if (await viewer.getAttribute("data-collapsed") !== "1") throw new Error("window collapse control failed");
  await viewer.locator(".dsh-cv-traffic-btn[data-kind=minimize]").click();
  await viewer.locator(".dsh-cv-traffic-btn[data-kind=zoom]").click();
  if (await viewer.getAttribute("data-max") !== "1") throw new Error("window zoom control failed");
  await viewer.locator(".dsh-cv-traffic-btn[data-kind=zoom]").click();
  await viewer.getByRole("button", { name: "放大画布" }).click();
  const canvasScale = await viewer.locator(".dsh-cv-sandbox-wrap").evaluate((node) => getComputedStyle(node).getPropertyValue("--cv-scale").trim());
  if (canvasScale !== "1.1") throw new Error(`canvas zoom failed: ${canvasScale}`);
  await viewer.getByRole("button", { name: /当前缩放/ }).click();
  await viewer.getByRole("button", { name: "切换主题" }).click();
  const reportFrame = page.frames().find((candidate) => candidate !== page.mainFrame());
  if (!reportFrame) throw new Error("report iframe frame missing");
  try {
    await reportFrame.getByRole("heading", { name: "dsh-canvas-viewer 0.4.0 自验收样张", exact: true }).waitFor({ timeout: 10_000 });
  } catch (error) {
    throw new Error(`sandbox render failed: ${String(error.message || error)}; console=${errors.join(" | ")}`);
  }
  await reportFrame.waitForFunction(() => document.documentElement.getAttribute("data-dsh-cv-theme") === "light", undefined, { timeout: 10_000 });
  const lightCanvasBase = await reportFrame.evaluate(() => getComputedStyle(document.body).backgroundColor);
  if (!lightCanvasBase.includes("242, 243, 245")) throw new Error(`light canvas base failed: ${lightCanvasBase}`);
  await page.evaluate(() => document.body.setAttribute("data-ds-dark-theme", ""));
  await page.waitForFunction(() => document.documentElement.getAttribute("data-dsh-cv-theme") !== "light", undefined, { timeout: 10_000 });
  await reportFrame.waitForFunction(() => document.documentElement.getAttribute("data-dsh-cv-theme") !== "light", undefined, { timeout: 10_000 });
  const hostSyncedCanvasBase = await reportFrame.evaluate(() => getComputedStyle(document.body).backgroundColor);
  if (!hostSyncedCanvasBase.includes("23, 27, 33")) throw new Error(`host theme sync failed: ${hostSyncedCanvasBase}`);
  assert.equal(await page.evaluate(() => globalThis.__canvasParentProbe), undefined, "default report never executes on parent");
  const outline = reportFrame.getByRole("combobox", { name: "报告目录" });
  await outline.waitFor();
  await outline.selectOption({ label: "断言覆盖" });
  await reportFrame.getByRole("searchbox", { name: "查找报告正文" }).fill("headline");
  await reportFrame.getByRole("button", { name: "查找下一处" }).click();
  assert.equal(await reportFrame.evaluate(() => window.getSelection().toString().toLowerCase()), "headline");
  const frameMarker = await reportFrame.evaluate(() => { window.__readerMountMarker = Math.random(); return window.__readerMountMarker; });
  await viewer.getByRole("button", { name: "源码", exact: true }).click();
  await viewer.getByRole("button", { name: "源码", exact: true }).click();
  assert.equal(await reportFrame.evaluate(() => window.__readerMountMarker), frameMarker, "source panel toggles preserve reader mount");
  await viewer.getByRole("button", { name: "打印或导出 PDF" }).click();
  const printPreview = viewer.getByRole("dialog", { name: "打印预览", exact: true });
  await printPreview.waitFor();
  const printFrame = printPreview.locator("iframe");
  assert.equal(await printFrame.getAttribute("sandbox"), "allow-same-origin allow-modals");
  const staticMarkup = await printFrame.evaluate(node => node.srcdoc);
  assert(!staticMarkup.includes("<script"), "print snapshot is script-free");
  assert(staticMarkup.includes("自验收样张"));
  if (process.env.CANVAS_BROWSER_ARTIFACTS) {
    const dir = process.env.CANVAS_BROWSER_ARTIFACTS;
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: join(dir, "workspace-print-preview.png") });
    const printablePage = await context.newPage();
    await printablePage.setContent(staticMarkup);
    await printablePage.pdf({ path: join(dir, "workspace-sample.pdf"), format: "A4", printBackground: true });
    await printablePage.screenshot({ path: join(dir, "workspace-print-content.png"), fullPage: true });
    await printablePage.close();
  }
  await viewer.getByRole("button", { name: "关闭打印预览" }).click();
  await viewer.getByRole("button", { name: "源码", exact: true }).click();
  const editor = viewer.getByRole("textbox", { name: "canvas 源码编辑" });
  await editor.fill(fixtureSource + "\n// first draft");
  await viewer.getByRole("button", { name: "关闭 Canvas", exact: true }).click();
  await viewer.getByRole("alertdialog", { name: "未保存修改" }).waitFor();
  await viewer.getByRole("button", { name: "继续编辑", exact: true }).click();
  assert((await editor.inputValue()).includes("first draft"));
  await viewer.getByRole("button", { name: "关闭 Canvas", exact: true }).click();
  await viewer.getByRole("button", { name: "保留草稿并关闭" }).click();
  await viewer.waitFor({ state: "hidden" });
  await page.locator("#open-link").click();
  await viewer.waitFor();
  assert((await editor.inputValue()).includes("first draft"));
  await viewer.getByRole("button", { name: /保存 ⌘S/ }).click();
  // Edits typed while an earlier save is in flight must survive its response.
  await editor.fill(fixtureSource + "\n// newer draft");
  await page.waitForFunction(() => document.querySelector(".dsh-cv-toast")?.textContent.includes("已保存"));
  assert((await editor.inputValue()).includes("newer draft"));
  assert.match(lastSave.baseRevision, /^[a-f0-9]{64}$/);
  await viewer.getByRole("button", { name: /保存 ⌘S/ }).click();
  await page.waitForFunction(() => document.querySelector(".dsh-cv-editor-meta")?.textContent.includes("已同步"));
  await editor.fill(payload.source + "\n// local conflict");
  await updatePayload(payload.source + "\n// external update");
  await viewer.getByRole("alert").filter({ hasText: "磁盘版本已变化" }).waitFor();
  assert((await editor.inputValue()).includes("local conflict"));
  assert.equal(await viewer.getByRole("button", { name: /保存 ⌘S/ }).isDisabled(), true);
  await viewer.getByText("对比磁盘版本与草稿", { exact: true }).click();
  await viewer.getByRole("button", { name: "已核对，使用当前草稿替换此磁盘版本" }).click();
  await viewer.getByRole("button", { name: /保存 ⌘S/ }).click();
  await page.waitForFunction(() => document.querySelector(".dsh-cv-editor-meta")?.textContent.includes("已同步"));
  assert(payload.source.includes("local conflict"));
  await editor.fill(payload.source + "\n// recover after reload");
  await page.waitForFunction(() => localStorage.getItem("dsh-cv-drafts-v1")?.includes("recover after reload"));
  // Explicitly suppress the native unload prompt in the test; persistence itself is tested.
  page.once("dialog", dialog => dialog.accept());
  await page.reload();
  await page.locator("#open-link").click();
  await viewer.getByRole("button", { name: /^源码/ }).click();
  assert((await editor.inputValue()).includes("recover after reload"));
  await viewer.getByRole("button", { name: "关闭 Canvas", exact: true }).click();
  await viewer.getByRole("button", { name: "放弃修改并关闭" }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("dsh-cv-drafts-v1") || "[]").length), 0);
  const structuredPath = join(root, "fixtures", "dual-reader.canvas.json");
  const structuredSource = await readFile(structuredPath, "utf8");
  const structuredReport = parseCanvasReport(structuredSource);
  const structuredCompiled = await compileCanvas(reportToCanvasSource(structuredReport));
  payload = { ...payload, seq: payload.seq + 1, path: structuredPath, title: "dual-reader.canvas.json", source: structuredSource, revision: createHash("sha256").update(structuredSource).digest("hex"), compiled: structuredCompiled.code, moduleCode: structuredCompiled.moduleCode, sourceMap: structuredCompiled.sourceMap, mapOffset: structuredCompiled.mapOffset };
  await page.evaluate(path => { const a = document.getElementById("open-link"); a.setAttribute("data-canvas", path); a.setAttribute("href", path); a.click(); }, structuredPath);
  const dualFrame = viewer.frameLocator("iframe.dsh-cv-sandbox");
  await dualFrame.getByRole("heading", { name: structuredReport.title, exact: true }).waitFor();
  await dualFrame.getByRole("table").waitFor();
  await dualFrame.getByText("暂不支持", { exact: false }).first().waitFor();
  assert.equal(await page.evaluate(() => globalThis.__canvasParentProbe), undefined);
  await viewer.getByRole("button", { name: "关闭 Canvas", exact: true }).click();
  if (errors.length) throw new Error(`browser console errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({
    ok: true,
    tail: tailContract,
    gallery: { thumbnail: thumbnailContract, upload: uploadedAsset },
    iframe: iframeContract,
    chrome: chromeContract,
    interactions: { collapse: true, maximize: true, zoom: true, lightTheme: true, hostThemeSync: true, reader: true, sanitizedPrint: true, dirtyClose: true, draftRecovery: true, saveWhileTyping: true, diskConflict: true },
    rendered: true,
  }));
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
