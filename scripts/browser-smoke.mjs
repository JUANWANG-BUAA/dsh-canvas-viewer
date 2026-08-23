#!/usr/bin/env node
/**
 * Browser CI smoke test for the shipped client factory and sandbox iframe.
 * It uses the real Playwright Chromium browser, while a tiny local HTTP host
 * supplies the same API/assets contract as dsh Web.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { compileCanvas, sandboxBundle } from "../lib/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixturePath = join(root, "fixtures", "audit-sample.canvas.tsx");
const fixtureSource = await readFile(fixturePath, "utf8");
const compiled = await compileCanvas(fixtureSource, fixturePath);
const bundle = await sandboxBundle();
const clientSource = await readFile(join(root, "lib", "client.js"), "utf8");
const assets = new Map([
  ["/assets/preact.umd.js", "preact"],
  ["/assets/preact-hooks.umd.js", "preactHooks"],
  ["/assets/preact-compat.umd.js", "compat"],
]);

const payload = {
  ok: true,
  seq: 1,
  path: fixturePath,
  title: "audit-sample.canvas.tsx",
  source: fixtureSource,
  compiled: compiled.code,
  sourceMap: compiled.sourceMap,
  mapOffset: compiled.mapOffset,
  error: "",
  lines: fixtureSource.split("\n").length,
  bytes: Buffer.byteLength(fixtureSource),
};

function sendJson(res, value) {
  const body = JSON.stringify(value);
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/") {
    const html = `<!doctype html><meta charset="utf-8"><title>Canvas browser smoke</title>
      <button id="open-link" data-canvas="audit-sample.canvas.tsx">打开 fixture</button>
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
        var ctx={
          conversationEvents:{register:function(){return function(){};}},
          slots:{inject:function(){},register:function(){return function(){};}},
          effect:function(fn){var dispose=fn();return dispose;}
        };
        plugin.apply(ctx);
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
  if (url.pathname === "/api/canvas/sandbox") {
    sendJson(res, bundle);
    return;
  }
  if (url.pathname === "/api/canvas/open") {
    req.resume();
    sendJson(res, payload);
    return;
  }
  if (url.pathname === "/api/canvas/watch") {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write("retry: 2000\n\n");
    req.on("close", () => res.end());
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.locator("#open-link").click();
  const frame = page.locator("iframe");
  await frame.waitFor({ state: "attached", timeout: 10_000 });
  const iframeContract = await frame.evaluate((node) => ({
    sandbox: node.getAttribute("sandbox"),
    hasCsp: node.srcdoc.includes("Content-Security-Policy"),
    deniesNetwork: node.srcdoc.includes("connect-src 'none'"),
    allowsRuntime: node.srcdoc.includes("script-src 'unsafe-inline' 'unsafe-eval'"),
  }));
  if (iframeContract.sandbox !== "allow-scripts") throw new Error("iframe sandbox contract changed");
  if (!iframeContract.hasCsp || !iframeContract.deniesNetwork || !iframeContract.allowsRuntime) {
    throw new Error(`iframe CSP contract failed: ${JSON.stringify(iframeContract)}`);
  }
  const reportFrame = page.frames().find((candidate) => candidate !== page.mainFrame());
  if (!reportFrame) throw new Error("report iframe frame missing");
  await reportFrame.getByText("dsh-canvas-viewer 0.4.0 自验收样张").waitFor({ timeout: 10_000 });
  if (errors.length) throw new Error(`browser console errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ ok: true, iframe: iframeContract, rendered: true }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
