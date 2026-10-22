#!/usr/bin/env node
/** Behavioral regression for the shipped factory: hook mocks run render + effects,
 * host nodes stay inert (the srcdoc must never execute in the parent realm).
 * No copied CanvasMount implementation, browser dependency, or installs required. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
const anchor = "    exports.apply = apply;";
assert.equal(source.split(anchor).length, 2, "stable factory probe anchor");
const instrumented = source.replace(anchor,
  "    window.__mountProbe = { CanvasMount, SandboxedMount, installSandboxReader, setBundle: function (promise) { sandboxBundlePromise = promise; } };\n" + anchor);
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

function harness(bundlePromise) {
  const instances = new Map();
  const listeners = new Map();
  let current, cursor, effects, dirty, tree, props, exported;
  const channels = [], initMessages = [];
  const modes = [];
  const context = { console, sideEffects: { top: 0, render: 0 } };
  const React = {
    Component: class { constructor(p) { this.props = p; } },
    createElement(type, attributes, ...children) { return { type, props: { ...attributes, children } }; },
    useState(initial) {
      const instance = current, index = cursor++;
      if (!(index in instance.hooks)) instance.hooks[index] = typeof initial === "function" ? initial() : initial;
      return [instance.hooks[index], (next) => {
        const value = typeof next === "function" ? next(instance.hooks[index]) : next;
        if (!Object.is(value, instance.hooks[index])) { instance.hooks[index] = value; dirty = true; }
      }];
    },
    useMemo(make, deps) {
      const index = cursor++, old = current.hooks[index];
      if (!old || !sameDeps(old.deps, deps)) current.hooks[index] = { deps, value: make() };
      return current.hooks[index].value;
    },
    useRef(initial) { return React.useMemo(() => ({ current: initial }), []); },
    useCallback(fn, deps) { return React.useMemo(() => fn, deps); },
    useEffect(run, deps) {
      const instance = current, index = cursor++, old = instance.hooks[index];
      if (!old || !sameDeps(old.deps, deps)) effects.push(() => {
        old?.cleanup?.();
        instance.hooks[index] = { deps, cleanup: run() };
      });
    },
  };
  const frame = { contentWindow: { postMessage(message) { initMessages.push(message); } }, addEventListener() {}, removeEventListener() {} };
  const window = {
    __ModuleLoader__: { load({ id, factory }) {
      assert.equal(id, "dsh-canvas-viewer");
      exported = factory((name) => {
        if (name === "react") return React;
        if (name === "react-dom/client") return {};
        throw new Error("unexpected dependency: " + name);
      });
    } },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatchEvent() {},
  };
  Object.assign(context, { window, Blob, MessageChannel: class {
    constructor() { this.port1 = { postMessage(message) { channels.at(-1).sent.push(message); }, close() {} }; this.port2 = {}; this.sent = []; channels.push(this); }
  }, document: { querySelector() { return null; }, documentElement: { getAttribute() { return "dark"; } } } });
  vm.runInNewContext(instrumented, context, { filename: "shipped-client.js" });
  assert.equal(typeof exported.apply, "function");
  window.__mountProbe.setBundle(bundlePromise);

  function visit(node, path, active) {
    if (Array.isArray(node)) return node.map((child, i) => visit(child, path + "/" + i, active));
    if (!node || typeof node !== "object") return node;
    if (typeof node.type === "function") {
      const key = path + ":" + (node.props.key ?? "");
      let instance = instances.get(key);
      if (!instance || instance.type !== node.type) {
        instance?.hooks.forEach((hook) => hook?.cleanup?.());
        instance = { type: node.type, hooks: [] }; instances.set(key, instance);
      }
      active.add(key);
      const previous = current, previousCursor = cursor;
      current = instance; cursor = 0;
      const children = node.props.children.length === 1 ? node.props.children[0] : node.props.children;
      const p = { ...node.props, children };
      let result;
      if (node.type.prototype?.render) { result = new node.type(p).render(); }
      else result = node.type(p);
      current = previous; cursor = previousCursor;
      return visit(result, key + "/result", active);
    }
    if (node.type === "iframe" && node.props.ref) node.props.ref.current = frame;
    return { ...node, props: { ...node.props, children: visit(node.props.children, path + "/children", active) } };
  }
  function render(next = props) {
    props = next;
    let rounds = 0;
    do {
      assert(++rounds < 20, "render/effect loop");
      dirty = false; effects = []; const active = new Set();
      tree = visit(React.createElement(window.__mountProbe.CanvasMount, props), "root", active);
      for (const [key, instance] of instances) if (!active.has(key)) {
        instance.hooks.forEach((hook) => hook?.cleanup?.()); instances.delete(key);
      }
      effects.forEach((run) => run());
    } while (dirty);
    return tree;
  }
  return {
    context, modes, render, channels, initMessages, installReader: () => window.__mountProbe.installSandboxReader(),
    privateMessage(data) { channels.at(-1).port1.onmessage({ data }); return render(); },
    props(overrides = {}) { return { path: "one.canvas.tsx", source: "report source", compiled: compiled(), onMode: (mode) => modes.push(mode), ...overrides }; },
    async settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); return render(); },
    message(data) { for (const fn of listeners.get("message") || []) fn({ source: frame.contentWindow, data }); return render(); },
    get tree() { return tree; },
    approve() { const button = nodes(tree).find((node) => node.type === "button"); assert(button, "explicit approval button"); button.props.onClick(); return render(); },
    safe() { assert.deepEqual(context.sideEffects, { top: 0, render: 0 }, "no parent top-level or render side effect"); assert(!modes.includes("legacy"), "no premature legacy mode"); },
  };
}
function compiled(extra = "") { return "globalThis.sideEffects.top++;" + extra + "return function Report(){globalThis.sideEffects.render++;return React.createElement('p',null,'report');};"; }
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object") return [];
  return [node, ...nodes(node.props?.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (!node || typeof node !== "object") return String(node ?? "");
  return text(node.props.children);
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const available = { available: true, sdk: "function createSdk(){}", preact: "/* preact */", preactHooks: "/* hooks */", compat: "/* compat */" };
let count = 0;
function pass(label) { count++; console.log("PASS " + label); }

const pending = deferred(), loading = harness(pending.promise);
loading.render(loading.props()); loading.safe();
assert.match(text(loading.tree), /加载/); assert.equal(loading.modes.at(-1), "loading");
assert.equal(nodes(loading.tree).filter((n) => n.type === "button").length, 0);
pass("bundle loading never evaluates or renders parent code");
pending.resolve(available); await loading.settle(); loading.safe();
const iframe = nodes(loading.tree).find((n) => n.type === "iframe");
assert(iframe); assert.equal(iframe.props.sandbox, "allow-scripts");
assert.match(iframe.props.srcDoc, /connect-src 'none'/); assert(!iframe.props.srcDoc.includes("unsafe-eval"));
for (const match of iframe.props.srcDoc.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1], { filename: "shipped-srcdoc-inline.js" });
assert.equal(loading.modes.at(-1), "loading", "available bundle is not ready render");
loading.message({ type: "dsh:canvas:ready" }); loading.safe(); assert.equal(loading.modes.at(-1), "sandbox");
pass("available bundle executes only inside opaque-origin sandbox");
loading.message({ type: "dsh:canvas:error", message: "render exploded" }); loading.safe();
assert.match(text(loading.tree), /render exploded/); assert.equal(loading.modes.at(-1), "error");
loading.approve(); assert.deepEqual(loading.context.sideEffects, { top: 1, render: 1 }); assert.equal(loading.modes.at(-1), "legacy");
pass("sandbox error remains closed until explicit compatibility approval");

for (const [label, bundle] of [["unavailable", { available: false, reason: "missing" }], ["malformed", { available: true }], ["null", null]]) {
  const h = harness(Promise.resolve(bundle)); h.render(h.props()); await h.settle(); h.safe();
  assert.equal(h.modes.at(-1), "blocked"); assert.match(text(h.tree), /主页面执行/);
  h.approve(); assert.deepEqual(h.context.sideEffects, { top: 1, render: 1 }); assert.equal(h.modes.at(-1), "legacy");
  pass(label + " bundle requires explicit approval");
}
const rejected = deferred(), failure = harness(rejected.promise);
failure.render(failure.props()); rejected.reject(new Error("bundle rejected")); await failure.settle(); failure.safe();
assert.match(text(failure.tree), /bundle rejected/); assert.equal(failure.modes.at(-1), "blocked");
pass("rejected bundle promise fails closed and is handled");

for (const change of [{ path: "two.canvas.tsx" }, { source: "changed source" }, { compiled: compiled("/* changed */") }, { moduleCode: "changed module" }]) {
  const h = harness(Promise.resolve({ available: false })); const initial = h.props();
  h.render(initial); await h.settle(); h.approve();
  const before = { ...h.context.sideEffects };
  h.render({ ...initial, ...change }); assert.deepEqual(h.context.sideEffects, before, "revoked before render/effects");
  assert.equal(h.modes.at(-1), "blocked");
  h.render(initial); assert.deepEqual(h.context.sideEffects, before, "return navigation cannot revive approval");
  h.approve(); assert.equal(h.context.sideEffects.top, before.top + 1);
  pass("approval revoked by " + Object.keys(change)[0] + " and cannot revive");
}
const topFailure = harness(Promise.resolve({ available: false }));
topFailure.render(topFailure.props({ compiled: "globalThis.sideEffects.top++;throw new Error('top-level failure');" }));
await topFailure.settle(); topFailure.safe(); topFailure.approve();
assert.match(text(topFailure.tree), /top-level failure/); assert.equal(topFailure.modes.at(-1), "error");
assert.equal(topFailure.context.sideEffects.render, 0);
pass("approved factory error is contained and reported honestly");
const plain = harness(Promise.resolve(available)); plain.render(plain.props({ compiled: "", error: "compile failed" }));
plain.safe(); assert.match(text(plain.tree), /compile failed/); assert.equal(plain.modes.at(-1), "error");
plain.render(plain.props({ compiled: "", source: "plain text" })); plain.safe(); assert.equal(plain.modes.at(-1), "source");
pass("compile errors and source-only reports stay inert");
let requestSnapshot, snapshots = [];
const bridge = harness(Promise.resolve(available));
const bridgeProps = bridge.props({ onBridgeReady: (fn) => { requestSnapshot = fn; }, onSnapshot: (value) => snapshots.push(value) });
bridge.render(bridgeProps); await bridge.settle(); bridge.safe();
assert.equal(requestSnapshot(""), false); assert.equal(requestSnapshot("x".repeat(81)), false);
assert.equal(requestSnapshot("print-1"), true);
assert.equal(bridge.channels.at(-1).sent.at(-1).type, "dsh-cv:export-request");
bridge.message({ type: "dsh-cv:export-snapshot", requestId: "print-1", html: "untrusted window message" });
bridge.privateMessage({ type: "dsh-cv:export-snapshot", requestId: "wrong", html: "wrong id" });
bridge.privateMessage({ type: "dsh-cv:export-snapshot", requestId: "print-1", html: "x".repeat(1048577) });
bridge.privateMessage({ type: "dsh-cv:export-snapshot", requestId: "print-1", html: "汉".repeat(400000) });
assert.equal(snapshots.length, 0, "unrequested, oversized, or non-private snapshots rejected");
bridge.privateMessage({ type: "dsh-cv:export-snapshot", requestId: "print-1", html: "<p>snapshot</p>" });
assert.equal(snapshots.length, 1); assert.equal(snapshots[0].requestId, "print-1");
bridge.privateMessage({ type: "dsh-cv:export-snapshot", requestId: "print-1", html: "replay" });
assert.equal(snapshots.length, 1, "snapshot replay rejected");
pass("export bridge requires private port, pending id, and bounded UTF-8 payload");
bridge.privateMessage({ type: "dsh-cv:reader-position", path: "spoofed.canvas.tsx", top: 321 });
bridge.render({ ...bridgeProps, path: "two.canvas.tsx" });
assert.equal(bridge.initMessages.at(-1).readerTop, 0, "position cannot cross paths");
bridge.render(bridgeProps); assert.equal(bridge.initMessages.at(-1).readerTop, 321, "closed-over path restored");
bridge.message({ type: "dsh-cv:reader-position", top: 999 });
for (const top of [NaN, Infinity, -1, 10000001, "111"]) bridge.privateMessage({ type: "dsh-cv:reader-position", top });
bridge.render({ ...bridgeProps, path: "three.canvas.tsx" }); bridge.render(bridgeProps);
assert.equal(bridge.initMessages.at(-1).readerTop, 321, "invalid or non-private scroll positions ignored");
pass("reader position is finite, private-port-only, and scoped to report path");
const staleRequest = requestSnapshot;
bridge.message({ type: "dsh:canvas:error", message: "stop" });
assert.equal(requestSnapshot, null); assert.equal(staleRequest("after-error"), false);
bridge.message({ type: "dsh:canvas:ready" }); assert.equal(bridge.modes.at(-1), "error", "ready cannot erase render failure");
bridge.safe();
pass("sandbox failure is terminal and invalidates export bridge");
// Exercise the shipped iframe-only reader with a deliberately tiny DOM fixture.
// Selection uses Range; no report element/text is rewritten by search or outline.
const readerHarness = harness(Promise.resolve(available));
const controls = [], sent = [], selections = [], scrolls = [];
function element(tag, value = "", shown = true) {
  const e = { tag, textContent: value, value: "", style: {}, children: [], handlers: {},
    setAttribute() {}, appendChild(child) { this.children.push(child); },
    addEventListener(type, fn) { this.handlers[type] = fn; },
    closest() { return shown ? null : {}; }, getClientRects() { return shown ? [{}] : []; },
    scrollIntoView() { scrolls.push(this); },
  }; return e;
}
const title = element("h1", "Visible heading"), hidden = element("h2", "Hidden heading", false), paragraph = element("p", "first needle second needle");
const textNode = { textContent: paragraph.textContent, parentElement: paragraph };
const root = { querySelectorAll() { return [title, hidden]; } };
Object.assign(readerHarness.context.document, {
  getElementById(id) { assert.equal(id, "cv-root"); return root; },
  createElement(tag) { const el = element(tag); controls.push(el); return el; },
  body: { insertBefore(nav, before) { assert.equal(before, root); assert.equal(nav.tag, "nav"); } },
  createTreeWalker() { let i = 0; return { nextNode() { return i++ === 0 ? textNode : null; } }; },
  createRange() { return { setStart(node, offset) { this.start = [node, offset]; }, setEnd(node, offset) { this.end = [node, offset]; } }; },
});
const readerWindow = readerHarness.context.window;
Object.assign(readerWindow, { getComputedStyle() { return { visibility: "visible" }; },
  getSelection() { return { removeAllRanges() {}, addRange(range) { selections.push(range); } }; },
  requestAnimationFrame(fn) { fn(); }, scrollTo(x, y) { scrolls.push([x, y]); },
});
readerHarness.context.__send = (message) => sent.push(message);
const reader = readerHarness.installReader();
reader.restore(432); reader.ready();
assert.deepEqual(scrolls.at(-1), [0, 432]);
const outline = controls.find((e) => e.tag === "select");
assert.equal(outline.children.filter((e) => e.tag === "option").length, 2, "prompt and visible heading only");
outline.value = "0"; outline.handlers.change(); assert.equal(scrolls.at(-1), title);
const find = controls.find((e) => e.tag === "input"), next = controls.find((e) => e.tag === "button");
find.value = "needle"; next.handlers.click(); next.handlers.click(); next.handlers.click();
assert.deepEqual(selections.map((r) => r.start[1]), [6, 20, 6], "find selects successive matches and wraps");
assert.equal(paragraph.textContent, "first needle second needle"); assert.equal(paragraph.children.length, 0);
assert.equal(title.textContent, "Visible heading");
reader.restore(Infinity); assert.deepEqual(scrolls.filter(Array.isArray).at(-1), [0, 432]);
pass("shipped reader filters outline, finds via non-mutating Range, and bounds position restore");
console.log(JSON.stringify({ ok: true, cases: count, artifact: "lib/client.js", method: "shipped factory + mocked React hook lifecycle" }));
