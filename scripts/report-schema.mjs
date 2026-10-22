#!/usr/bin/env node
/** Run after pnpm build:host. No runtime schema library or browser required. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compileCanvas } from "../lib/host/compiler.mjs";
import {
  CANVAS_REPORT_SCHEMA_VERSION, CANVAS_REPORT_LIMITS as L,
  CANVAS_REPORT_BLOCK_TYPES, CANVAS_REPORT_TONES,
  parseCanvasReport, validateCanvasReport, reportToCanvasSource,
} from "../lib/report/schema.mjs";

const fixture = parseCanvasReport(await readFile(new URL("../fixtures/dual-reader.canvas.json", import.meta.url), "utf8"));
const base = () => ({ schemaVersion: 1, title: "Report", sections: [] });
const withBlocks = (...blocks) => ({ ...base(), sections: [{ id: "main", title: "Main", blocks }] });
const rejects = input => assert.throws(() => validateCanvasReport(input), /Invalid CanvasReport/);
const paragraphs = count => Array.from({ length: count }, () => ({ type: "text", text: "x" }));
const table = (rows = L.maxTableRows, columns = L.maxTableColumns) => ({
  type: "table", columns: Array(columns).fill("column"),
  rows: Array.from({ length: rows }, () => Array(columns).fill(null)),
});

// Extract only the checked-in SDK implementation, as scripts/regression.mjs does. Report
// data is never evaluated: the only executable report surface below is our fixed generator.
const client = await readFile(new URL("../src/client/03-canvas-sdk.js.part", import.meta.url), "utf8");
const start = client.indexOf("function gapStyle(gap) {");
const createStart = client.indexOf("function createSdk(ReactLib) {");
let depth = 0, end = -1;
for (let i = createStart; i < client.length; i++) {
  if (client[i] === "{") depth++;
  else if (client[i] === "}" && --depth === 0) { end = i + 1; break; }
}
assert.ok(start >= 0 && createStart >= 0 && end > createStart, "SDK extraction boundaries");
const sdk = runInNewContext("(function(){" + client.slice(start, end) + "; return createSdk(ReactLib); })()", { ReactLib: React, h: React.createElement });

async function render(report) {
  const source = reportToCanvasSource(report);
  assert.equal((source.match(/from "[^"]+"/g) || []).join(), 'from "dsh/canvas"');
  const { code, moduleCode } = await compileCanvas(source, "report-schema-generated.canvas.tsx");
  assert.ok(moduleCode.includes("globalThis.__cvCanvasApp"));
  const context = { React, sdk };
  const App = runInNewContext("(function(){" + code + "})()", context);
  assert.equal(typeof App, "function");
  const html = renderToStaticMarkup(React.createElement(App));
  assert.equal(context.__reportPwned, undefined);
  return { source, html };
}

test("versioned fixture is canonical, detached, and covers all block types", () => {
  assert.equal(CANVAS_REPORT_SCHEMA_VERSION, 1);
  assert.equal(Object.isFrozen(L), true);
  assert.deepEqual([...new Set(fixture.sections.flatMap(s => s.blocks.map(b => b.type)))].sort(), [...CANVAS_REPORT_BLOCK_TYPES].sort());
  const copy = validateCanvasReport(fixture);
  assert.deepEqual(copy, fixture);
  assert.notEqual(copy.sections, fixture.sections);
  copy.sections[0].blocks[0].text = "changed";
  assert.notEqual(copy.sections[0].blocks[0].text, fixture.sections[0].blocks[0].text);
  assert.deepEqual(validateCanvasReport(Object.assign(Object.create(null), base())), base());
});

test("rejects malformed JSON, executable input, missing version and nonobjects", () => {
  for (const source of ["", "undefined", "{", "null", "[]", "42", "true", '"text"', "(()=>({schemaVersion:1}))()", '{"schemaVersion":1,"title":"x","sections":[],}']) {
    assert.throws(() => parseCanvasReport(source), /Invalid CanvasReport/);
  }
  for (const input of [undefined, null, [], true, 3, "x", new Date(), Object.create(base()), { ...base(), schemaVersion: "1" }, { ...base(), schemaVersion: 2 }, { title: "x", sections: [] }, { ...base(), title: null }, { ...base(), summary: undefined }, { ...base(), sections: {} }]) rejects(input);
  assert.throws(() => parseCanvasReport(null), /expected JSON text/);
});

test("unknown keys fail closed at every data boundary; no prototype pollution", () => {
  const seeds = [
    { ...base(), url: "https://example.invalid" },
    { ...base(), sections: [{ id: "x", title: "x", blocks: [], source: "evil" }] },
    withBlocks({ type: "text", text: "x", style: {} }),
    withBlocks({ type: "callout", tone: "info", text: "x", href: "javascript:alert(1)" }),
    withBlocks({ type: "metrics", items: [{ label: "x", value: 1, html: "x" }] }),
    withBlocks({ type: "table", columns: ["x"], rows: [[{ href: "https://example.invalid", label: "link" }]] }),
    withBlocks({ type: "list", items: [], onClick: "x" }),
    withBlocks({ type: "bar-chart", items: [{ label: "x", value: 1, color: "url(x)" }] }),
    withBlocks({ type: "unsupported", label: "x", reason: "x", source: "x" }),
  ];
  for (const input of seeds) rejects(input);
  for (const key of ["__proto__", "constructor", "prototype"]) {
    const source = JSON.stringify(base()).replace('"sections":[]', '"sections":[],"' + key + '":{"__reportPolluted":true}');
    assert.throws(() => parseCanvasReport(source), /unknown keys/);
  }
  assert.equal({}.__reportPolluted, undefined);
  assert.equal(Object.prototype.__reportPolluted, undefined);
  rejects(Object.assign(base(), { [Symbol("unknown")]: true }));
  const hidden = base();
  Object.defineProperty(hidden, "hidden", { value: 1 });
  rejects(hidden);
});

test("validation never invokes ordinary getters or toJSON hooks", () => {
  let called = false;
  const getter = base();
  Object.defineProperty(getter, "title", { enumerable: true, get() { called = true; return "x"; } });
  rejects(getter);
  const item = { text: "x" };
  Object.defineProperty(item, "type", { enumerable: true, get() { called = true; return "text"; } });
  rejects(withBlocks(item));
  rejects({ ...base(), toJSON() { called = true; return base(); } });
  const values = ["x"];
  Object.defineProperty(values, "0", { enumerable: true, get() { called = true; return "x"; } });
  rejects(withBlocks({ type: "list", items: values }));
  assert.equal(called, false);
});

test("all text fields reject C0/C1 and bidi formatting except LF/TAB", () => {
  const setters = [
    s => ({ ...base(), title: s }), s => ({ ...base(), summary: s }),
    s => ({ ...base(), sections: [{ id: s, title: "x", blocks: [] }] }),
    s => ({ ...base(), sections: [{ id: "x", title: s, blocks: [] }] }),
    s => withBlocks({ type: "text", text: s }),
    s => withBlocks({ type: "callout", tone: "info", text: s }),
    s => withBlocks({ type: "callout", tone: "info", title: s, text: "x" }),
    s => withBlocks({ type: "metrics", items: [{ label: s, value: "x" }] }),
    s => withBlocks({ type: "metrics", items: [{ label: "x", value: s, detail: "x" }] }),
    s => withBlocks({ type: "metrics", items: [{ label: "x", value: "x", detail: s }] }),
    s => withBlocks({ type: "table", columns: [s], rows: [["x"]] }),
    s => withBlocks({ type: "table", columns: ["x"], rows: [[s]] }),
    s => withBlocks({ type: "list", items: [s] }),
    s => withBlocks({ type: "bar-chart", items: [{ label: s, value: 1 }] }),
    s => withBlocks({ type: "unsupported", label: s, reason: "x" }),
    s => withBlocks({ type: "unsupported", label: "x", reason: s }),
  ];
  const unsafe = Array.from({ length: 160 }, (_, n) => n).filter(n => n < 32 && n !== 9 && n !== 10 || n >= 127);
  unsafe.push(0x61c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069);
  for (const setter of setters) {
    for (const cp of unsafe) rejects(setter("safe" + String.fromCodePoint(cp) + "data"));
    validateCanvasReport(setter("中文\n\tالعربية"));
  }
  assert.throws(() => validateCanvasReport({ ...base(), ["\x1b[31m"]: true }), error => !error.message.includes("\x1b"));
});

test("strict block discriminants, required fields, primitive types and finite numbers", () => {
  const bad = [
    null, [], {}, { type: "unknown" }, { type: "__proto__" }, { type: 1 }, { type: "text", text: 1 },
    { type: "callout", tone: "notice", text: "x" }, { type: "callout", tone: "info" },
    { type: "metrics", items: [{ label: "x", value: true }] },
    { type: "metrics", items: [{ label: "x", value: null }] },
    { type: "list", items: [2] }, { type: "list", items: [], ordered: "yes" },
    { type: "bar-chart", items: [{ label: "x", value: "1" }] },
    { type: "unsupported", label: "x", reason: {} },
    { type: "table", columns: [2], rows: [] }, { type: "table", columns: [], rows: [] },
    { type: "table", columns: ["x"], rows: [[undefined]] },
  ];
  for (const value of [NaN, Infinity, -Infinity, 1e101, -1e101]) {
    bad.push({ type: "bar-chart", items: [{ label: "x", value }] }, { type: "metrics", items: [{ label: "x", value }] }, { type: "table", columns: ["x"], rows: [[value]] });
  }
  for (const value of bad) rejects(withBlocks(value));
  for (const tone of CANVAS_REPORT_TONES) validateCanvasReport(withBlocks({ type: "callout", tone, title: "", text: "" }));
  validateCanvasReport(withBlocks({ type: "table", columns: ["text", "number", "bool", "null"], rows: [["x", 0, false, null]] }));
  validateCanvasReport(withBlocks({ type: "bar-chart", items: [{ label: "x", value: -1e100 }, { label: "y", value: 1e100 }] }));
});

test("duplicate ids, wrong row widths and non-data arrays rejected", () => {
  rejects({ ...base(), sections: [{ id: "x", title: "a", blocks: [] }, { id: "x", title: "b", blocks: [] }] });
  rejects({ ...base(), sections: [{ id: "  ", title: "a", blocks: [] }] });
  for (const rows of [[["x", 1]], [[]], ["x"]]) rejects(withBlocks({ type: "table", columns: ["x"], rows }));
  const sparse = new Array(1);
  rejects(withBlocks({ type: "list", items: sparse }));
  const extra = ["x"]; extra.custom = true;
  rejects(withBlocks({ type: "list", items: extra }));
  class ArraySubclass extends Array {}
  rejects(withBlocks({ type: "list", items: new ArraySubclass("x") }));
});

test("UTF-8 source ceiling is checked before JSON parse, including whitespace", () => {
  const source = JSON.stringify(base());
  parseCanvasReport(source + " ".repeat(L.maxSourceBytes - Buffer.byteLength(source)));
  assert.throws(() => parseCanvasReport(source + " ".repeat(L.maxSourceBytes)), /source byte limit/);
  assert.throws(() => parseCanvasReport("中".repeat(Math.ceil(L.maxSourceBytes / 3) + 1)), /source byte limit/);
  assert.throws(() => parseCanvasReport("[".repeat(L.maxSourceBytes + 1)), /source byte limit/);
});

test("section, block, item, string and aggregate resource boundaries", () => {
  const sections = Array.from({ length: L.maxSections }, (_, n) => ({ id: String(n), title: "", blocks: [] }));
  validateCanvasReport({ ...base(), sections });
  rejects({ ...base(), sections: sections.concat({ id: "overflow", title: "", blocks: [] }) });
  validateCanvasReport(withBlocks(...paragraphs(L.maxBlocks)));
  rejects(withBlocks(...paragraphs(L.maxBlocks + 1)));
  rejects({ ...base(), sections: [{ id: "x", title: "", blocks: paragraphs(L.maxBlocks) }, { id: "y", title: "", blocks: paragraphs(1) }] });
  for (const type of ["list", "metrics", "bar-chart"]) {
    const make = () => type === "list" ? "x" : { label: "x", value: 1 };
    validateCanvasReport(withBlocks({ type, items: Array.from({ length: L.maxItems }, make) }));
    rejects(withBlocks({ type, items: Array.from({ length: L.maxItems + 1 }, make) }));
  }
  const lists = Array.from({ length: L.maxTotalItems / L.maxItems }, () => ({ type: "list", items: Array(L.maxItems).fill("x") }));
  validateCanvasReport(withBlocks(...lists));
  rejects(withBlocks(...lists, { type: "list", items: ["x"] }));
  for (const [field, limit] of [["title", L.maxTitleLength], ["summary", L.maxTextLength]]) {
    validateCanvasReport({ ...base(), [field]: "x".repeat(limit) });
    rejects({ ...base(), [field]: "x".repeat(limit + 1) });
  }
  validateCanvasReport(withBlocks({ type: "text", text: "x".repeat(L.maxTextLength) }));
  rejects(withBlocks({ type: "text", text: "x".repeat(L.maxTextLength + 1) }));
  rejects(withBlocks({ type: "metrics", items: [{ label: "x".repeat(L.maxLabelLength + 1), value: 1 }] }));
  rejects({ ...base(), sections: [{ id: "x".repeat(L.maxIdLength + 1), title: "", blocks: [] }] });
  rejects(withBlocks(...Array.from({ length: Math.ceil(L.maxTotalTextBytes / L.maxTextLength) }, () => ({ type: "text", text: "x".repeat(L.maxTextLength) }))));
  // Byte budget, not UTF-16 length: CJK text consumes three bytes per character.
  rejects(withBlocks(...Array.from({ length: 11 }, () => ({ type: "text", text: "中".repeat(L.maxTextLength) }))));
  // Escaped LF fits the text budget but not the canonical JSON source budget.
  rejects(withBlocks(...Array.from({ length: 24 }, () => ({ type: "text", text: "\n".repeat(L.maxTextLength) }))));
});

test("table row, column, per-table and aggregate cell budgets", () => {
  assert.equal(L.maxTableCells, L.maxTableRows * L.maxTableColumns);
  validateCanvasReport(withBlocks(table()));
  validateCanvasReport(withBlocks(table(), table()));
  rejects(withBlocks(table(), table(), table(1, 1)));
  rejects(withBlocks(table(L.maxTableRows + 1, 1)));
  rejects(withBlocks(table(1, L.maxTableColumns + 1)));
});

test("generated fixed SDK report compiles and renders every block", async () => {
  const { html } = await render(fixture);
  for (const value of [fixture.title, fixture.summary, ...fixture.sections.map(section => section.title), "交互式钻取", "版本 1 暂不支持", "有界数据", "true"]) assert.ok(html.includes(value), value);
  for (const marker of ['cv-stat', 'cv-table', 'cv-callout', '<svg', 'data-tone="warning"']) assert.ok(html.includes(marker), marker);
  assert.equal(/<a\b|<script\b|onerror=|href=/.test(html), false);
});

test("malicious strings stay literal through compilation; no source/HTML/URL injection", async () => {
  const attack = '</script><script>globalThis.__reportPwned = true</script><img src=x onerror="alert(1)"> {(() => { throw 1 })()} ";globalThis.__reportPwned=true;// export default Fake; export default function Evil(){} javascript:alert(1) https://example.invalid \u2028\u2029';
  const report = withBlocks({ type: "text", text: attack }, { type: "table", columns: ["Literal"], rows: [[attack]] }, { type: "list", items: [attack] });
  const { source, html } = await render(report);
  assert.equal(source.includes('</script>'), false);
  assert.ok(source.includes('\\u003c/script>'));
  assert.ok(source.includes('\\u2028') && source.includes('\\u2029'));
  assert.equal(source.includes('\u2028') || source.includes('\u2029'), false);
  assert.equal(source.includes('export default Fake'), false);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(/<script\b|<img\b|<a\b/.test(html), false);
  const generated = reportToCanvasSource(report);
  assert.equal(generated, source, "generation is deterministic");
  rejects({ ...report, title: '\x1b[31m' });
  assert.throws(() => reportToCanvasSource({ ...report, schemaVersion: 9 }), /schema version/);
});
