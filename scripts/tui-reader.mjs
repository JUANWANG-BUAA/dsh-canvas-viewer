import assert from 'node:assert/strict';
import { createCanvasScene, formatReport, displayWidth, clipText, sanitizeText } from '../lib/tui/reader.mjs';

const report = {
  schemaVersion: 1, title: '终端报告 👩🏽‍💻', summary: 'Verdict first.', sections: [
    { id: 'overview', title: '概览', blocks: [
      { type: 'text', text: '中文组合 e\u0301 👨‍👩‍👧‍👦 🇨🇳 abcdefghijk needle\n' + Array.from({ length: 32 }, (_, i) => 'line-' + i).join('\n') },
      { type: 'callout', tone: 'warning', title: 'Attention', text: 'Keep this callout.' },
      { type: 'metrics', items: [{ label: 'Latency', value: 17, detail: 'milliseconds' }] },
      { type: 'table', columns: ['Name', 'Value', 'Details'], rows: [['ALPHA', 42, 'important-last-column'], ['BETA', false, 'second-row']] },
      { type: 'list', items: ['first item', 'second item'], ordered: true },
      { type: 'bar-chart', items: [{ label: 'Positive', value: 9 }, { label: 'Negative', value: -3 }, { label: 'Zero', value: 0 }] },
      { type: 'unsupported', label: 'interactive', reason: 'Native text only' },
    ] },
    { id: 'details', title: 'Details', blocks: [{ type: 'text', text: 'second needle\nThird NEEDLE' }] },
  ],
};

assert.equal(displayWidth('中文'), 4);
assert.equal(displayWidth('e\u0301'), 1);
assert.equal(displayWidth('👩🏽‍💻'), 2);
assert.equal(displayWidth('👨‍👩‍👧‍👦'), 2);
assert.equal(displayWidth('🇨🇳'), 2);
assert.equal(displayWidth('1️⃣'), 2);
assert.equal(clipText('中👨‍👩‍👧‍👦e\u0301', 4), '中👨‍👩‍👧‍👦');
assert.equal(clipText('e\u0301x', 1), 'e\u0301');
assert.equal(sanitizeText('a\x1b[31mred\x1b[0mz\x1b]52;c;ZXZpbA==\x07x\x1bPimage\x1b\\\x00\u202e'), 'aredzx');
assert.equal(sanitizeText('a\x1b]8;;https://evil.test\x1b\\link\x1b]8;;\x1b\\b'), 'alinkb');
assert.equal(sanitizeText('a\x1b]unfinished'), 'a');
for (const width of [1, 2, 3, 8, 24, 80, 160]) {
  const result = formatReport(report, { width, query: 'needle' });
  assert.equal(result.matchCount, 3);
  assert.equal(result.sectionCount, 2);
  assert.equal(result.truncated, false);
  assert(result.lines.every(line => displayWidth(line) <= width), 'every line fits width ' + width);
  assert(result.matches.some(match => match.sectionIndex === 1));
  const joined = result.lines.join('').replace(/ /g, '');
  assert(joined.includes('important-last-column'), 'narrow tables keep last column');
  assert(joined.includes('second-row'), 'tables retain every row');
  assert(joined.includes('Latency:17—milliseconds'));
  assert(joined.includes('1.firstitem'));
  assert(joined.includes('Negative:-3'));
  assert(joined.includes('[Unsupported:interactive]Nativetextonly'));
}
assert(formatReport(report, { width: 160 }).lines.some(line => line.includes(' | ')), 'wide table columns');
assert(formatReport(report, { width: 24 }).lines.some(line => line === 'Row 1'), 'narrow labeled rows');
assert.equal(formatReport(report, { sectionIndex: 999 }).sectionIndex, 1);
const wrappedTable = { schemaVersion: 1, title: 'Table', sections: [{ title: 'Body', blocks: [{ type: 'table', columns: ['Content'], rows: [['x'.repeat(34) + 'NEEDLE' + 'y'.repeat(14)]] }] }] };
for (const width of [80, 16]) {
  const found = formatReport(wrappedTable, { width, query: 'needle' });
  assert.equal(found.matchCount, 1, 'cell search crosses table soft wraps');
  assert(found.lines[found.matches[0].line].includes('NE'), 'jump points at cell match');
}
const manyMatches = formatReport({ schemaVersion: 1, title: 'Many', sections: [{ title: 'Body', blocks: [{ type: 'text', text: 'a'.repeat(12000) }] }] }, { width: 80, query: 'a' });
assert.equal(manyMatches.matchCount, 10000);
assert(manyMatches.matchesTruncated);
assert(manyMatches.lines.join('').includes('Search safety limit'));
assert.equal(manyMatches.truncated, false, 'match limit does not imply dropped content');
assert.equal(formatReport(null).lines[0], 'Unsupported Canvas report schema (expected schemaVersion: 1).');
const huge = formatReport({ schemaVersion: 1, title: 'Huge', sections: [{ title: 'Body', blocks: [{ type: 'text', text: 'x\n'.repeat(20000) }] }] }, { width: 40 });
assert(huge.truncated);
assert.equal(huge.searchCoverage, 'retained');
assert(huge.lines.length < 10010);
assert(huge.lines.join('\n').includes('content truncated'));
const safe = formatReport({ schemaVersion: 1, title: '\x1b[2Jbad', sections: [{ title: 'X', blocks: [{ type: 'text', text: '\x1b]52;c;evil\x07ok\x07' }] }] });
assert(!/[\x00-\x1f\x7f-\x9f]/u.test(safe.lines.join('')));

// A deterministic hooks runner, deliberately independent of any React package.
// Effects have cleanup/dependency semantics; every state update drives a render.
function mount(store, { columns = 100, rows = 14 } = {}) {
  const slots = [];
  let cursor = 0, dirty = true, dead = false, tree, handler, closed = 0, lateUpdates = 0;
  let effects = [];
  const size = { columns, rows };
  const same = (left, right) => left && right && left.length === right.length && left.every((value, i) => Object.is(value, right[i]));
  const React = {
    createElement(type, props, ...children) { return { type, props, children }; },
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => {
        if (dead) { lateUpdates++; return; }
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: factory(), deps };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) {
        const old = slots[index]; slots[index] = { deps, cleanup: old?.cleanup };
        effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const ui = { Box: 'Box', Text: 'Text', useTerminalSize: () => size,
    useInput(fn, options) { assert.equal(options.isActive, true); assert.equal(options.prepend, true); handler = fn; } };
  const Scene = createCanvasScene(store);
  function render() {
    let turns = 0;
    while (dirty && !dead) {
      assert(++turns < 30, 'no render loop');
      dirty = false; cursor = 0;
      tree = Scene({ React, ui, close() { closed++; } });
      const pending = effects; effects = []; pending.forEach(effect => effect());
    }
    return tree;
  }
  async function flush() { for (let i = 0; i < 8; i++) { render(); await Promise.resolve(); } render(); }
  const text = () => { render(); return tree.children.map(child => child.children.join('')).join('\n'); };
  const api = {
    flush, text, get tree() { render(); return tree; }, get closed() { return closed; }, get lateUpdates() { return lateUpdates; },
    async key(input = '', key = {}, event = {}) {
      render(); let stopped = false;
      handler(input, key, { stopImmediatePropagation() { stopped = true; }, ...event });
      if (!key.ctrl && !key.meta && !key.super) assert(stopped);
      await flush();
    },
    async resize(columns, rows) { Object.assign(size, { columns, rows }); dirty = true; await flush(); },
    unmount() { dead = true; for (const slot of slots) slot?.cleanup?.(); },
  };
  render();
  return api;
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function makeStore(path) {
  const listeners = new Set(), calls = { list: [], open: [] };
  let snapshot = { path };
  const items = Array.from({ length: 103 }, (_, i) => ({ path: 'report-' + i + '.canvas.json', title: 'Report ' + i, format: 'structured' }));
  const store = {
    calls, listeners,
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    requestOpen(path) { snapshot = { path }; for (const listener of listeners) listener(); },
    async list(args) { calls.list.push(args); const found = items.filter(item => !args.q || item.title.includes(args.q)); const end = args.offset + args.limit;
      return { items: found.slice(args.offset, end), total: found.length, nextOffset: end < found.length ? end : null }; },
    async open(path) { calls.open.push(path); return { path, title: report.title, revision: 'one', report }; },
  };
  return store;
}

const store = makeStore();
const app = mount(store);
assert(app.text().includes('Loading'));
await app.flush();
assert(app.text().includes('Canvas Library'));
assert(app.text().includes('› [structured] Report 0'));
assert.deepEqual(store.calls.list[0], { q: '', offset: 0, limit: 100 });
await app.key('', { downArrow: true });
assert(app.text().includes('› [structured] Report 1'));
await app.key('', { end: true });
assert(app.text().includes('Report 99'));
await app.key('', { pageDown: true });
assert.equal(store.calls.list.at(-1).offset, 100);
assert(app.text().includes('Report 100'));
await app.key('', { pageUp: true });
assert.equal(store.calls.list.at(-1).offset, 0);
await app.key('/'); await app.key('Report 10');
assert.equal(store.calls.list.at(-1).q, 'Report 10');
assert(app.text().includes('4 matches'));
await app.key('', { return: true });
await app.key('', { return: true });
assert.equal(store.calls.open.at(-1), 'report-10.canvas.json');
assert(app.text().includes('终端报告'));
assert(app.text().includes('Section 1/2'));
await app.key('', { pageDown: true });
assert(!app.text().includes('Verdict first.'));
await app.key('', { end: true });
assert(app.text().includes('Native text only'));
await app.key('', { home: true });
assert(app.text().includes('Verdict first.'));
await app.key('', { rightArrow: true });
assert(app.text().includes('Section 2/2'));
await app.key('', { leftArrow: true });
await app.key('/'); await app.key('needle');
assert(app.text().includes('3 matches'));
await app.key('', { return: true });
await app.key('n');
assert(app.text().includes('Section 2/2'));
await app.key('N');
assert(app.text().includes('Section 1/2'));
await app.key('r');
assert.equal(store.calls.open.length, 2);
await app.key('', { escape: true, meta: true });
assert(app.text().includes('Canvas Library'));
await app.key('', { escape: true, meta: true });
assert.equal(app.closed, 1);
await app.resize(14, 5);
assert.equal(app.tree.children.length, 5);
assert(app.tree.children.every(child => displayWidth(child.children[0]) <= 14));
await app.resize(1, 1);
assert.equal(app.tree.children.length, 1);
app.unmount();
assert.equal(store.listeners.size, 0);

// Browser visual regression: narrow layouts keep search/Escape discoverable.
const narrowStore = makeStore('narrow');
const narrowApp = mount(narrowStore); await narrowApp.flush(); await narrowApp.resize(40, 24);
assert(narrowApp.text().includes('/ search')); assert(narrowApp.text().includes('Esc back'));
assert(narrowApp.text().includes('Read-only · no source execution'));
assert.equal(narrowApp.tree.children.length, 24);
await narrowApp.key('', { escape: true, meta: true });
assert(narrowApp.text().includes('Esc close')); narrowApp.unmount();
const invalidStore = makeStore();
invalidStore.list = async () => ({ items: [{path:'/very-long-private-home/bad.canvas.json', shortPath:'~/bad.canvas.json',title:'Bad',format:'structured',error:'invalid schema'}],total:1,nextOffset:null });
const invalidApp = mount(invalidStore); await invalidApp.flush();
assert(invalidApp.text().includes('[invalid] Bad')); assert(invalidApp.text().includes('~/bad.canvas.json'));
assert(!invalidApp.text().includes('/very-long-private-home')); invalidApp.unmount();

// Commands can replace the currently open path, even with the same path.
const remote = makeStore('first');
const remoteApp = mount(remote);
await remoteApp.flush();
remote.requestOpen('second'); await remoteApp.flush();
assert.equal(remote.calls.open.at(-1), 'second');
remote.requestOpen('second'); await remoteApp.flush();
assert.equal(remote.calls.open.length, 3);
remote.requestOpen(undefined); await remoteApp.flush();
assert(remoteApp.text().includes('Canvas Library'));
remoteApp.unmount();

// Older open/list work cannot overwrite a newer request or update after unmount.
const slow = makeStore('old'), older = deferred(), newer = deferred();
slow.open = path => path === 'old' ? older.promise : newer.promise;
const slowApp = mount(slow);
await slowApp.flush(); slow.requestOpen('new'); await slowApp.flush();
newer.resolve({ path: 'new', title: 'NEW RESULT', report }); await slowApp.flush();
older.resolve({ path: 'old', title: 'STALE RESULT', report }); await slowApp.flush();
assert(slowApp.text().includes('NEW RESULT'));
assert(!slowApp.text().includes('STALE RESULT'));
const last = deferred(); slow.open = () => last.promise;
slow.requestOpen('last'); await slowApp.flush(); slowApp.unmount();
last.resolve({ path: 'last', report }); await slowApp.flush();
assert.equal(slowApp.lateUpdates, 0);
const slowList = makeStore(), listFirst = deferred(), listSecond = deferred();
slowList.list = args => args.q ? listSecond.promise : listFirst.promise;
const listApp = mount(slowList); await listApp.flush();
await listApp.key('/'); await listApp.key('new');
listSecond.resolve({ items: [{ path: 'new', title: 'NEW LIST', format: 'structured' }], total: 1, nextOffset: null }); await listApp.flush();
listFirst.resolve({ items: [{ path: 'old', title: 'STALE LIST', format: 'structured' }], total: 1, nextOffset: null }); await listApp.flush();
assert(listApp.text().includes('NEW LIST'));
assert(!listApp.text().includes('STALE LIST'));
listApp.unmount();

const failures = makeStore('bad');
failures.open = () => { throw new Error('Denied\x1b[2J'); };
const failureApp = mount(failures); await failureApp.flush();
assert(failureApp.text().includes('Error: Denied'));
failures.open = async path => ({ path, title: 'Old TSX', legacy: true, warnings: ['Unsafe code is not run.'], revision: 'old' });
await failureApp.key('r');
assert(failureApp.text().includes('Legacy .canvas.tsx'));
assert(failureApp.text().includes('No TSX/source code is evaluated.'));
assert(failureApp.text().includes('Unsafe code is not run.'));
await failureApp.key('', { escape: true });
failures.list = async () => { throw new Error('Listing failed'); };
await failureApp.key('r');
assert(failureApp.text().includes('Listing failed'));
failureApp.unmount();

// Search paste is text, never a shortcut/submit; Unicode deletion is grapheme-safe.
const pasteStore = makeStore(), pasteApp = mount(pasteStore);
await pasteApp.flush(); await pasteApp.key('/');
await pasteApp.key('👨‍👩‍👧‍👦', { isPasted: true });
await pasteApp.key('', { backspace: true });
assert.equal(pasteStore.calls.list.at(-1).q, '');
await pasteApp.key('r', { isPasted: true });
assert.equal(pasteStore.calls.list.at(-1).q, 'r');
await pasteApp.key('', { escape: true });
const callsBefore = pasteStore.calls.list.length;
await pasteApp.key('r', { isPasted: true });
assert.equal(pasteStore.calls.list.length, callsBefore);
pasteApp.unmount();
console.log('tui-reader: Unicode/block formatting + injected scene behavior passed');
