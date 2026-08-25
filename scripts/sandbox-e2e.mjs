#!/usr/bin/env node
/**
 * Headless sandbox E2E (no browser): verifies the exact iframe-sandbox assembly
 * path used by the live client — SDK extraction, preact UMD trio, srcdoc composition,
 * JSON <script>-closing hardening, MessageChannel init handshake, and a real
 * module execution of the compiled canvas against a React stub. Mirrors SandboxedMount.
 * Run: node scripts/sandbox-e2e.mjs   (also part of `pnpm test`)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sandboxBundle, compileCanvas } from "../lib/index.js";

let checks = 0;
const assert = (cond, message) => { checks += 1; if (!cond) throw new Error(message); };

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const clientSrc = fs.readFileSync(path.join(root, "lib", "client.js"), "utf8");

// --- client source contains the hardening markers ---
assert(clientSrc.includes("new MessageChannel()"), "client uses MessageChannel handshake");
assert(clientSrc.includes("dsh-cv:init"), "client posts dsh-cv:init init handshake");
assert(clientSrc.includes('{ type: "dsh-cv:init", theme: themeNow() }'), "init handshake carries current theme");
assert(clientSrc.includes('"dsh:canvas:theme", sendTheme'), "theme toggles are pushed into the sandbox iframe");
assert(clientSrc.includes('d.type === "dsh-cv:esc"'), "esc pressed inside the sandbox closes the host window");
assert(clientSrc.includes('new EventSource(API + "/watch'), "viewer subscribes to the hot-reload SSE stream");
assert(clientSrc.includes("connect-src 'none'") && clientSrc.includes("default-src 'none'"), "srcdoc CSP denies outbound connections by default");
assert(clientSrc.includes("script-src 'unsafe-inline' blob:") && !clientSrc.includes("script-src 'unsafe-inline' 'unsafe-eval'"), "sandbox CSP uses Blob ES modules without unsafe-eval");
assert(clientSrc.includes('API + "/save"'), "viewer saves edited source back to the host");
assert(clientSrc.includes('"data-split": showSrc ? "1" : "0"'), "source/render split view present");
assert(clientSrc.includes('"tool/result"') && clientSrc.includes("content[0].isError") && clientSrc.includes("source.callId"), "chat bubble gates on real tool/result message shape");
assert(clientSrc.includes('typeof raw === "string" ? JSON.parse'), "tool args parser accepts JSON string or object");
assert(clientSrc.includes('className: "dsh-cv-tabs"') && clientSrc.includes('role: "tab"'), "multi-canvas tab bar present");
assert(!clientSrc.includes('"resize-sw"') && !clientSrc.includes('"resize-se"'), "canvas-first window omits resize handles");
assert(clientSrc.includes("onBarToggleMax") && clientSrc.includes('"data-max": maximized'), "double-click title bar maximizes");
assert(clientSrc.includes("html[data-dsh-cv-theme='light'] [data-dsh-cv-root]"), "client remaps light theme for iframe");
assert(clientSrc.includes("jsonSafe(value)"), "client has jsonSafe helper");

// --- bundle ---
const bundle = await sandboxBundle();
assert(bundle.available === true, "sandbox bundle available");
assert(bundle.sdk.includes("function createSdk"), "sdk region extracted");
assert(bundle.runtime === "preact-compat", "bundle runtime is preact-compat");
assert(bundle.preact.length < 15000, "preact core UMD is small (<15KB)");
assert(bundle.preactHooks.length < 6000, "preact hooks UMD is small (<6KB)");
assert(bundle.compat.length < 15000, "preact compat UMD is small (<15KB)");
assert(!bundle.sdk.includes("CanvasMount"), "sdk region excludes mount code");
assert(!bundle.sdk.includes("useToast"), "sdk region excludes shell-only code");

// --- jsonSafe hardening: never a raw </script> in embedded JSON ---
// Extract the SHIPPED helper from client.js and execute it — a locally
// reimplemented copy here would pass even if the shipped one is broken
// (a mangled /<//g regex once parsed fine but threw "g is not defined"
// at runtime and crashed every floating-window open).
const jsonSafeStart = clientSrc.indexOf("function jsonSafe(value) {");
const jsonSafeEnd = clientSrc.indexOf("}", clientSrc.indexOf("return JSON.stringify", jsonSafeStart));
const jsonSafeSrc = clientSrc.slice(jsonSafeStart, jsonSafeEnd + 1);
assert(jsonSafeSrc.includes("replace(/<\\//g"), "shipped jsonSafe keeps the escaped </ regex");
const jsonSafe = new Function(jsonSafeSrc + "\nreturn jsonSafe;")();
assert(jsonSafe("</script><script>alert(1)").indexOf("</script>") === -1, "shipped jsonSafe escapes </script>");

// --- srcdoc assembly: balanced scripts, theme remap ---
const TOKEN_SEL = "[data-dsh-cv-root],[data-dsh-cv-canvas],[data-dsh-cv-lib],[data-dsh-cv-tail]";
function escAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function buildSrcdoc(moduleCode, sdk, preact, preactHooks, compat, theme) {
  const cssStart = clientSrc.indexOf("var css = [");
  const arrEnd = clientSrc.indexOf("].join", cssStart);
  const arrExpr = clientSrc.slice(cssStart + "var css = ".length, arrEnd + 1);
  const css = new Function("return (" + arrExpr + ");")().join("");
  const cssIn = css
    .replace(TOKEN_SEL, ":root")
    .replaceAll("html[data-dsh-cv-theme='light'] [data-dsh-cv-root]", ":root[data-dsh-cv-theme='light']")
    .replaceAll("html[data-dsh-cv-theme='light'] [data-dsh-cv-canvas]", ":root[data-dsh-cv-theme='light']")
    .replaceAll("html[data-dsh-cv-theme='light'] [data-dsh-cv-lib]", ":root[data-dsh-cv-theme='light']")
    .replaceAll("html[data-dsh-cv-theme='light'] [data-dsh-cv-tail]", ":root[data-dsh-cv-theme='light']");
  const light = theme === "light";
  const canvasBase = light ? "#f2f3f5" : "#171b21";
  const readingTokens = light
    ? "--cv-editor:rgba(244,245,246,.7)!important;--cv-chrome:rgba(255,255,255,.62)!important;--cv-elevated:rgba(255,255,255,.76)!important;--cv-fill-1:rgba(40,47,53,.1)!important;--cv-fill-2:rgba(40,47,53,.065)!important;--cv-fill-3:rgba(40,47,53,.045)!important;--cv-fill-4:rgba(255,255,255,.2)!important;--cv-stroke-1:rgba(45,52,58,.14)!important;--cv-stroke-2:rgba(45,52,58,.13)!important;--cv-stroke-3:rgba(45,52,58,.07)!important;--cv-fg:#202428!important;--cv-fg-2:#484f56!important;--cv-fg-3:#707880!important;--cv-fg-4:#92999f!important;"
    : "--cv-editor:rgba(18,19,21,.44)!important;--cv-chrome:rgba(31,32,35,.54)!important;--cv-elevated:rgba(45,46,50,.58)!important;--cv-fill-1:rgba(255,255,255,.1)!important;--cv-fill-2:rgba(255,255,255,.065)!important;--cv-fill-3:rgba(255,255,255,.045)!important;--cv-fill-4:rgba(0,0,0,.12)!important;--cv-stroke-1:rgba(255,255,255,.12)!important;--cv-stroke-2:rgba(0,0,0,.28)!important;--cv-stroke-3:rgba(255,255,255,.055)!important;--cv-fg:#edf0f2!important;--cv-fg-2:#c9ced3!important;--cv-fg-3:#9ba3aa!important;--cv-fg-4:#707980!important;";
  return (
    "<!doctype html><html><head><meta charset=\"utf-8\"><title>x</title>" +
    "<style>" + cssIn + "</style>" +
    "<style>:root,:root[data-dsh-cv-theme='light']{" + readingTokens + "}html,body{margin:0;padding:0;background:" + canvasBase + "!important;}.dsh-cv-sandbox-root{min-height:100%;background:" + canvasBase + "!important;}</style>" +
    "</head><body><div id=\"cv-root\"></div>" +
    "<script>" + preact + "</" + "script>" +
    "<script>" + preactHooks + "</" + "script>" +
    "<script>" + compat + "</" + "script>" +
    "<script>" +
      (light ? "document.documentElement.setAttribute('data-dsh-cv-theme','light');" : "") +
      "var React=window.preactCompat;var ReactDOM=window.preactCompat;" +
      "if(!ReactDOM.createRoot){ReactDOM.createRoot=function(c){return {render:function(v){return ReactDOM.render(v,c);}};};}" +
      "var __send=function(m){if(window.__cvPort){window.__cvPort.postMessage(m);}else{window.parent.postMessage(m,'*');}};" +
      "function __cvTheme(t){try{if(t==='light'){document.documentElement.setAttribute('data-dsh-cv-theme','light');}else{document.documentElement.removeAttribute('data-dsh-cv-theme');}}catch(e){}}" +
      "window.addEventListener('message',function(ev){var d=ev&&ev.data;if(!d)return;if(d.type==='dsh-cv:init'&&ev.ports&&ev.ports[0]){window.__cvPort=ev.ports[0];__cvTheme(d.theme);}else if(d.type==='dsh-cv:theme'){__cvTheme(d.theme);}},false);" +
      "document.addEventListener('keydown',function(ev){if(ev.key==='Escape'){ev.preventDefault();__send({type:'dsh-cv:esc'});}},false);" +
      "function __fail(e){__send({type:'dsh:canvas:error',message:String((e&&e.message)||e||'sandbox module failed')});}" +
      "function __loadModule(code,done){var u=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));var s=document.createElement('script');s.type='module';s.onload=function(){URL.revokeObjectURL(u);done();};s.onerror=function(){URL.revokeObjectURL(u);__fail(new Error('sandbox module load failed'));};s.src=u;document.head.appendChild(s);}" +
      "var __sdkSrc=" + jsonSafe(sdk + "\nglobalThis.__cvCreateSdk=createSdk;") + ";" +
      "var __moduleSrc=" + jsonSafe(moduleCode) + ";" +
      "__loadModule(__sdkSrc,function(){var __sdk=globalThis.__cvCreateSdk(React,React.createElement);globalThis.sdk=__sdk;globalThis.React=React;globalThis.ReactDOM=ReactDOM;globalThis.h=React.createElement;__loadModule(__moduleSrc,function(){var __App=globalThis.__cvCanvasApp;var __root=ReactDOM.createRoot(document.getElementById('cv-root'));__root.render(React.createElement(__App));});});" +
    "</" + "script>" +
    "</body></html>"
  );
}
const auditSource = fs.readFileSync(path.join(root, "fixtures", "audit-sample.canvas.tsx"), "utf8");
const compiledResult = await compileCanvas(auditSource, "audit.canvas.tsx");
const compiled = compiledResult.code;
const moduleCode = compiledResult.moduleCode;
const srcdocDark = buildSrcdoc(moduleCode, bundle.sdk, bundle.preact, bundle.preactHooks, bundle.compat, "dark");
const srcdocLight = buildSrcdoc(moduleCode, bundle.sdk, bundle.preact, bundle.preactHooks, bundle.compat, "light");
// Simulate the HTML tokenizer's script raw-text state: a "<script" inside a
// script's raw text is NOT a real element open (e.g. react-dom UMD contains the
// string "<script>\x3c/script>"). Only real elements must balance.
function countRealScripts(html) {
  let opens = 0, closes = 0, inScript = false, i = 0;
  while (i < html.length) {
    const oi = html.indexOf("<script", i);
    const ci = html.indexOf("</script", i);
    if (inScript) {
      if (ci === -1) break;
      closes += 1; i = ci + 8; inScript = false;
    } else {
      if (oi !== -1 && (ci === -1 || oi < ci)) { opens += 1; i = oi + 7; inScript = true; }
      else if (ci !== -1) { closes += 1; i = ci + 8; }
      else break;
    }
  }
  return { opens, closes };
}
const real = countRealScripts(srcdocDark);
assert(real.opens === real.closes && real.opens === 4,
  "srcdoc has 4 real script elements (preact+hooks+compat+bootstrap), balanced (" + JSON.stringify(real) + ")");
assert(srcdocDark.includes("--cv-editor:rgba(18,19,21,.44)!important"), "dark neutral material tokens are present in iframe document");
assert(srcdocDark.includes("background:#171b21!important"), "dark iframe has a stable neutral reading base");
assert(srcdocLight.includes(":root[data-dsh-cv-theme='light'],"), "light theme selector remapped for iframe");
assert(srcdocLight.includes("rgba(244,245,246,.7)!important"), "light neutral material token values present");

// --- real Preact compat surface: eval the vendored UMDs in a vm and verify the
// exact React-compatible APIs createSdk()/compiled canvases rely on. ---
import vm from "node:vm";
const ctx = { console, setTimeout, clearTimeout, Math, JSON };
ctx.self = ctx;
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(bundle.preact, ctx);
vm.runInContext(bundle.preactHooks, ctx);
vm.runInContext(bundle.compat, ctx);
const compat = vm.runInContext("window.preactCompat", ctx);
assert(typeof compat.createElement === "function", "compat exposes createElement");
assert(typeof compat.cloneElement === "function", "compat exposes cloneElement");
assert(compat.Fragment, "compat exposes Fragment");
for (const hk of ["useState", "useEffect", "useRef", "useMemo", "useCallback", "useId"]) {
  assert(typeof compat[hk] === "function", "compat re-exports hook " + hk);
}
assert(typeof compat.render === "function", "compat exposes render");

// --- real headless eval of SDK + compiled against a React stub ---
const reactStub = {
  createElement: (type, props) => ({ type, props: props || {}, children: [] }),
  cloneElement: (element, props) => ({ ...element, props: { ...(element && element.props || {}), ...(props || {}) } }),
  useState: () => [], useRef: () => ({}), useMemo: () => null, useCallback: () => () => {},
  useEffect: () => {}, Fragment: "Fragment", version: "stub",
};
function evalSdk() {
  const fn = new Function("ReactLib", "h", "return (function(){ " + bundle.sdk + ";return createSdk(ReactLib); })();");
  return fn(reactStub, reactStub.createElement);
}
const sdk = evalSdk();
assert(sdk && typeof sdk === "object", "createSdk() returns an SDK object");
for (const k of ["H1", "Stack", "Text", "Table", "BarChart", "Pill", "Grid", "Stat", "Card"]) {
  assert(typeof sdk[k] === "function", "sdk exposes " + k);
}
const App = new Function("React", "sdk", compiled)(reactStub, sdk);
assert(typeof App === "function", "compiled canvas factory returns a component");
const tree = App();
assert(tree && typeof tree === "object", "component renders (element tree)");
const realSdk = new Function("ReactLib", "h", "return (function(){ " + bundle.sdk + ";return createSdk(ReactLib, h); })();")(compat, compat.createElement);

// --- real Preact render (no browser): a minimal DOM stub is enough for the audit
// canvas' static tree (divs/spans/svg/text). This exercises the ACTUAL vendored
// preact+compat through the same createRoot shim + SDK + compiled canvas the srcdoc
// bootstrap uses. ---
{
  const domChildren = Symbol("domChildren");
  const mkNode = (tag) => {
    const el = {
      nodeType: 1, nodeName: String(tag).toUpperCase(), tagName: String(tag).toUpperCase(),
      [domChildren]: [], attributes: {}, style: {}, _listeners: {}, _text: "",
      parentNode: null,
      get childNodes() { return this[domChildren]; },
      get firstChild() { return this[domChildren][0] || null; },
      get lastChild() { return this[domChildren][this[domChildren].length - 1] || null; },
      get nextSibling() {
        if (!this.parentNode) return null;
        const sibs = this.parentNode[domChildren];
        const i = sibs.indexOf(this);
        return i >= 0 ? sibs[i + 1] || null : null;
      },
      getAttribute(k) { return this.attributes[k] ?? null; },
      setAttribute(k, v) { this.attributes[k] = String(v); if (k === "class") this.className = String(v); if (k === "id") this.id = String(v); },
      removeAttribute(k) { delete this.attributes[k]; },
      setAttributeNS(_, k, v) { this.setAttribute(k, v); },
      addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
      removeEventListener(t, fn) { const a = this._listeners[t]; if (a) { const i = a.indexOf(fn); if (i !== -1) a.splice(i, 1); } },
      appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this[domChildren].push(c); return c; },
      insertBefore(c, ref) {
        if (c.parentNode) c.parentNode.removeChild(c);
        c.parentNode = this;
        const i = ref ? this[domChildren].indexOf(ref) : -1;
        if (i === -1) this[domChildren].push(c); else this[domChildren].splice(i, 0, c);
        return c;
      },
      removeChild(c) { const i = this[domChildren].indexOf(c); if (i !== -1) { this[domChildren].splice(i, 1); c.parentNode = null; } return c; },
      replaceChild(n, o) { const i = this[domChildren].indexOf(o); if (i !== -1) { this[domChildren][i] = n; n.parentNode = this; o.parentNode = null; } return o; },
    };
    Object.defineProperty(el, "textContent", {
      get() { return this._text; },
      set(v) {
        this._text = String(v);
        // text node behavior: children cleared, plain text string stored
        if (this.nodeType === 3) this.nodeValue = String(v);
      },
    });
    return el;
  };
  const rootNode = mkNode("div");
  rootNode.id = "cv-root";
  ctx.document = {
    getElementById: (id) => (id === "cv-root" ? rootNode : null),
    createElement: (tag) => mkNode(String(tag)),
    createElementNS: (ns, tag) => mkNode(String(tag)),
    createTextNode: (t) => {
      const n = mkNode("#text"); n.nodeType = 3; n.nodeName = "#text"; n._text = String(t); n.nodeValue = String(t); return n;
    },
  };
  // The VM path mirrors the browser's post-Blob-module globals.  Keep the
  // SDK object in the context (JSON would erase its component functions), then
  // execute moduleCode as JavaScript so its global export assignment runs.
  ctx.sdk = realSdk;
  ctx.React = compat;
  ctx.ReactDOM = compat;
  ctx.h = compat.createElement;
  const boot =
    "var React=window.preactCompat;var ReactDOM=window.preactCompat;" +
    "if(!ReactDOM.createRoot){ReactDOM.createRoot=function(c){return {render:function(v){return ReactDOM.render(v,c);}};};}" +
    "globalThis.sdk=sdk;globalThis.React=React;globalThis.ReactDOM=ReactDOM;globalThis.h=React.createElement;" +
    moduleCode +
    ";" +
    "var __App=globalThis.__cvCanvasApp;" +
    "var __root=ReactDOM.createRoot(document.getElementById('cv-root'));" +
    "__root.render(React.createElement(__App));";
  try {
    vm.runInContext(boot, ctx);
  } catch (err) {
    throw new Error("preact real-render failed: " + (err && err.stack || err));
  }
  assert(rootNode.childNodes.length > 0, "preact rendered DOM children into cv-root");
  const collectText = (n) => {
    let s = n._text || "";
    for (const c of n.childNodes || []) s += collectText(c);
    return s;
  };
  const renderedText = collectText(rootNode);
  assert(renderedText.includes("自验收") && renderedText.includes("0.4.0"), "preact-rendered audit content contains title text");
  assert(renderedText.includes("编译: 4"), "bar chart renders native <title> hover tooltip text");
  assert(renderedText.length > 100, "preact rendered substantial content (" + renderedText.length + " chars)");
}

console.log(JSON.stringify({ ok: true, checks }, null, 2));
