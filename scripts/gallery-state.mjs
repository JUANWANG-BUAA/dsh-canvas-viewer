#!/usr/bin/env node
// Execute the actual gallery hooks with deterministic React-style lifecycle,
// timers and deferred fetches. No browser, server, filesystem fixtures or HOME.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
const start = source.indexOf("    /* @client-module gallery:");
const end = source.indexOf('    var inject = ["slots", "uiConversation"];', start);
assert.ok(start >= 0 && end > start, "gallery module boundaries exist");
const gallery = source.slice(start, end);

function harness(kind = "hook") {
  const slots = [], timers = new Map(), requests = [], opened = [];
  let cursor = 0, dirty = true, value, mounted = true, timerId = 0, writes = 0;
  let args = ["all", "", "all"];
  let effects = [];
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  function useState(initial) {
    const i = cursor++;
    if (!slots[i]) slots[i] = { value: initial };
    return [slots[i].value, (next) => {
      assert.ok(mounted, "no state writes after unmount");
      writes++;
      slots[i].value = typeof next === "function" ? next(slots[i].value) : next;
      dirty = true;
    }];
  }
  function useRef(initial) {
    const i = cursor++;
    if (!slots[i]) slots[i] = { current: initial };
    return slots[i];
  }
  function useCallback(fn, deps) {
    const i = cursor++;
    if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { fn, deps };
    return slots[i].fn;
  }
  function useEffect(fn, deps) {
    const i = cursor++;
    if (!slots[i] || !equal(slots[i].deps, deps)) {
      effects.push(() => {
        slots[i]?.cleanup?.();
        slots[i] = { deps, cleanup: fn() };
      });
    }
  }
  function fetch(url, options) {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    // Intentionally ignore abort: the sequence guard must also reject late replies.
    requests.push({ url, signal: options.signal,
      reply(body, ok = true, status = 200) { resolve({ ok, status, json: () => Promise.resolve(body) }); },
      reject,
    });
    return promise;
  }
  const window = {
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    confirm: () => true,
  };
  const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) });
  const compile = new Function("useState", "useRef", "useCallback", "useEffect", "fetch", "window", "API", "h", "useToast", "toggleTheme", "requestOpenCanvas", "apiPost", gallery + ";return { useCanvasLibraryData, CanvasLibraryPage };");
  const components = compile(useState, useRef, useCallback, useEffect, fetch, window, "/api/canvas", h,
    () => ({ toast: "", show() {} }), () => {}, (path) => opened.push(path), () => Promise.resolve({ ok: true }));
  function render() {
    let rounds = 0;
    do {
      assert.ok(rounds++ < 20, "render converges");
      dirty = false; cursor = 0; effects = [];
      value = kind === "hook" ? components.useCanvasLibraryData(...args) : components.CanvasLibraryPage();
      effects.forEach((fn) => fn());
    } while (dirty);
    return value;
  }
  render();
  return {
    requests, opened,
    get value() { return value; },
    get writes() { return writes; },
    render,
    change(...next) { args = next; return render(); },
    tick() { const pending = [...timers.values()]; timers.clear(); pending.forEach((fn) => fn()); render(); },
    async settle() { for (let i = 0; i < 10; i++) await Promise.resolve(); render(); },
    unmount() { slots.forEach((slot) => slot.cleanup?.()); mounted = false; },
  };
}
const row = (name, workspaceId = "a") => ({ path: "/fixture/" + name + ".canvas.tsx", title: name, workspaceId });
const workspaces = [{ id: "a", label: "A" }, { id: "b", label: "B" }];
const page = (items, total, nextOffset) => ({ ok: true, items, count: items.length, total, nextOffset, workspaces });
const paths = (test) => test.value.data.items.map((item) => item.path);
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  return [node, ...node.children.flatMap(nodes)];
}
function text(node) {
  return typeof node === "string" ? node : !node || typeof node !== "object" ? "" : node.children.map(text).join("");
}
function button(test, label) {
  const found = nodes(test.value).find((node) => node.type === "button" && text(node) === label);
  assert.ok(found, "button exists: " + label);
  return found;
}

// Server pagination, cursor use, deduplication, double-click guard and retry.
{
  const test = harness();
  assert.equal(test.value.data.loading, true);
  test.tick();
  let url = new URL(test.requests[0].url, "http://fixture");
  assert.equal(url.searchParams.get("limit"), "40");
  assert.equal(url.searchParams.get("offset"), "0");
  assert.equal(url.searchParams.get("workspace"), "all");
  test.requests[0].reply(page([row("one"), row("two")], 3, 2));
  await test.settle();
  assert.equal(test.value.data.total, 3);
  test.value.loadMore(); test.value.loadMore(); test.render();
  assert.equal(test.requests.length, 2, "overlapping load-more suppressed");
  assert.equal(test.value.data.loadingMore, true);
  assert.equal(paths(test).length, 2, "loaded rows remain during append");
  url = new URL(test.requests[1].url, "http://fixture");
  assert.equal(url.searchParams.get("offset"), "2");
  test.requests[1].reject(new Error("offline"));
  await test.settle();
  assert.equal(test.value.data.error, "offline");
  assert.equal(test.value.data.nextOffset, 2, "failed cursor retained for retry");
  assert.equal(paths(test).length, 2);
  test.value.loadMore();
  test.requests[2].reply(page([row("two"), row("three")], 3, null));
  await test.settle();
  assert.deepEqual(paths(test), [row("one").path, row("two").path, row("three").path]);
  assert.equal(test.value.data.error, "");
  assert.equal(test.value.data.nextOffset, null);
  test.value.loadMore();
  assert.equal(test.requests.length, 3, "last page has no further request");
  test.unmount();
}

// Filters invalidate in-flight pages immediately, including during debounce.
{
  const test = harness(); test.tick();
  test.requests[0].reply(page([row("old")], 2, 1)); await test.settle();
  test.value.loadMore(); test.render();
  test.change("all", "报告 & body", "b");
  assert.equal(test.requests[1].signal.aborted, true);
  assert.equal(test.value.data.loading, true);
  assert.deepEqual(paths(test), [], "old rows hidden before debounce completes");
  test.requests[1].reply(page([row("stale")], 2, null)); await test.settle();
  assert.deepEqual(paths(test), []);
  test.tick();
  const url = new URL(test.requests[2].url, "http://fixture");
  assert.equal(url.searchParams.get("q"), "报告 & body");
  assert.equal(url.searchParams.get("workspace"), "b");
  assert.equal(url.searchParams.get("offset"), "0");
  test.requests[2].reply(page([row("new", "b")], 1, null)); await test.settle();
  assert.deepEqual(paths(test), [row("new").path]);
  test.value.reload(); test.render();
  assert.equal(test.value.data.loading, true, "refresh cannot display stale success");
  test.tick();
  test.requests[3].reply(page([], 0, null)); await test.settle();
  assert.deepEqual(paths(test), []);
  test.unmount();
}

// A request that completes after its replacement cannot overwrite newer results.
{
  const test = harness(); test.tick();
  test.change("all", "new query", "b"); test.tick();
  test.requests[1].reply(page([row("current", "b")], 1, null)); await test.settle();
  test.requests[0].reply(page([row("obsolete")], 1, null)); await test.settle();
  assert.deepEqual(paths(test), [row("current", "b").path]);
  test.unmount();
}

// Mode switches and disposal ignore aborted failures/successes.
{
  const test = harness(); test.tick();
  test.change("recent", "ignored", "a");
  assert.equal(test.requests[0].signal.aborted, true);
  test.requests[0].reject(new Error("stale failure")); await test.settle();
  assert.equal(test.value.data.error, "");
  test.tick();
  assert.equal(test.requests[1].url, "/api/canvas/history", "recent keeps history API");
  const before = test.writes;
  test.unmount();
  assert.equal(test.requests[1].signal.aborted, true);
  test.requests[1].reply(page([row("late")], 1, null));
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(test.writes, before);
}

// Initial HTTP/malformed payload failures are not empty-success states.
for (const [body, ok, status, expected] of [
  [{ error: "denied" }, false, 403, "denied"],
  [{ items: "bad" }, true, 200, "items"],
  [page([row("bad cursor")], 2, 0), true, 200, "游标"],
]) {
  const test = harness(); test.tick();
  test.requests[0].reply(body, ok, status); await test.settle();
  assert.equal(test.value.data.loading, false);
  assert.ok(test.value.data.error.includes(expected));
  assert.deepEqual(paths(test), []);
  test.unmount();
}

// Actual page controls and labels, including local history workspace filtering.
{
  const test = harness("page"); test.tick();
  const search = nodes(test.value).find((node) => node.type === "input" && node.props.className === "dsh-cv-lib-search");
  assert.ok(search.props["aria-label"].includes("报告正文"));
  test.requests[0].reply(page([row("one")], 2, 1)); await test.settle();
  assert.ok(text(test.value).includes("已加载 1 / 2 项"));
  button(test, "加载更多").props.onClick(); test.render();
  assert.equal(button(test, "加载更多中…").props.disabled, true);
  test.requests[1].reject(new Error("network")); await test.settle();
  assert.ok(text(test.value).includes("加载更多失败：network"));
  button(test, "重试").props.onClick();
  test.requests[2].reply(page([row("two")], 2, null)); await test.settle();
  assert.equal(nodes(test.value).filter((node) => node.props.item).length, 2);
  button(test, "最近").props.onClick(); test.render(); test.tick();
  assert.equal(test.requests[3].url, "/api/canvas/history");
  test.requests[3].reply(page([row("one", "a"), row("two", "b")], 2, null)); await test.settle();
  const select = nodes(test.value).find((node) => node.type === "select");
  select.props.onChange({ target: { value: "b" } }); test.render(); test.tick();
  assert.equal(test.requests[4].url, "/api/canvas/history");
  test.requests[4].reply(page([row("one", "a"), row("two", "b")], 2, null)); await test.settle();
  const rows = nodes(test.value).filter((node) => node.props.item);
  assert.deepEqual(rows.map((node) => node.props.item.title), ["two"]);
  assert.equal(typeof rows[0].props.onForget, "function");
  assert.equal(rows[0].props.onDelete, null);
  test.unmount();
}
console.log("gallery-state: pagination, filters, stale responses, history and loading/error UI passed");
