#!/usr/bin/env node
// Actual installed public renderer + host React; not a full DSH CLI/loader test.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { PassThrough } from "node:stream";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { createCanvasStore } from "../lib/tui/store.mjs";
import { createCanvasScene } from "../lib/tui/reader.mjs";

const packageRoot = process.env.DSH_TUI_PACKAGE;
if (!packageRoot) throw new Error("DSH_TUI_PACKAGE must point to an installed dsh-tui package");
const require = createRequire(join(resolve(packageRoot), "package.json"));
const React = require("react");
const { default: stringWidth } = await import(pathToFileURL(require.resolve("string-width")));

// Decode the renderer's actual ANSI output, including cursor-only diff patches.
// Keep its trailing parking row as well as the 28 visible content rows. This
// intentionally supports only the emitted protocol subset and rejects others.
function terminalScreen(columns, rows) {
  const cells = Array.from({ length: rows + 1 }, () => Array(columns).fill(" "));
  const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let x = 0, y = 0, pending = "";
  const erase = (row, start = 0, end = columns) => cells[row].fill(" ", start, end);
  return {
    write(chunk) {
      pending += chunk;
      while (pending) {
        if (pending.startsWith("\x1b]")) {
          const end = /\x07|\x1b\\/.exec(pending);
          if (!end) return;
          pending = pending.slice(end.index + end[0].length);
          continue;
        }
        if (pending.startsWith("\x1b[")) {
          const sequence = /^\x1b\[([0-?]*)([ -/]*)([@-~])/.exec(pending);
          if (!sequence) return;
          const [, args, , command] = sequence;
          const values = args.split(";").map(Number);
          const count = values[0] || 1;
          if (command === "A") y = Math.max(0, y - count);
          else if (command === "B") y = Math.min(rows, y + count);
          else if (command === "C") x = Math.min(columns - 1, x + count);
          else if (command === "D") x = Math.max(0, x - count);
          else if (command === "G") x = count - 1;
          else if (command === "H" || command === "f") { y = count - 1; x = (values[1] || 1) - 1; }
          else if (command === "K") erase(y, args === "1" || args === "2" ? 0 : x, args === "1" ? x + 1 : columns);
          else if (command === "J" && (args === "2" || args === "3")) cells.forEach((_, row) => erase(row));
          else if (command === "J" && (args === "" || args === "0")) { erase(y, x); for (let row = y + 1; row <= rows; row++) erase(row); }
          else assert(["m", "h", "l", "u", "q", "t", "c"].includes(command), "unsupported terminal sequence: " + JSON.stringify(sequence[0]));
          pending = pending.slice(sequence[0].length);
          continue;
        }
        if (pending[0] === "\x1b") { if (pending.length === 1) return; throw new Error("unsupported terminal escape"); }
        const part = segments.segment(pending)[Symbol.iterator]().next().value.segment;
        pending = pending.slice(part.length);
        if (part === "\r") x = 0;
        else if (part === "\n" || part === "\r\n") { y = Math.min(rows, y + 1); if (part.length === 2) x = 0; }
        else {
          const width = stringWidth(part);
          assert(x + width <= columns, "unexpected terminal autowrap");
          cells[y][x] = part;
          if (width === 2) cells[y][x + 1] = "";
          x += width;
        }
      }
    },
    text() { return cells.map(row => row.join("").trimEnd()).join("\n").trimEnd(); },
  };
}
const ui = await import(pathToFileURL(join(resolve(packageRoot), "lib/types/ui.js")));
const home = realpathSync(await mkdtemp(join(tmpdir(), "canvas-tui-render-")));
try {
  const dir = join(home, ".dsh", "canvases");
  await mkdir(dir, { recursive: true });
  const path = join(dir, "dual.canvas.json");
  await writeFile(path, await readFile(new URL("../fixtures/dual-reader.canvas.json", import.meta.url)));
  const store = createCanvasStore({ home });
  store.requestOpen(path);
  const Scene = createCanvasScene(store);
  const inputs = [];
  const commits = [];
  // Instrument only the dependencies actually injected into Scene. Keep the real
  // hook, current handler, decoded key flags and originating event unchanged.
  const observedReact = { ...React, useState(initial) {
    const result = React.useState(initial);
    React.useLayoutEffect(() => {
      const state = result[0];
      commits.push({ mode: state.mode, searching: state.searching, query: state.reportQuery, sectionIndex: state.sectionIndex });
    }, [result[0]]);
    return result;
  } };
  const observedUi = { ...ui, useInput(handler, options) {
    return ui.useInput((input, key, event) => {
      inputs.push({ input, key: { ...key }, isPasted: event?.isPasted, committed: commits.at(-1) });
      handler(input, key, event);
    }, options);
  } };
  const stdout = new PassThrough();
  Object.assign(stdout, { columns: 100, rows: 28, isTTY: true });
  // A terminal is a UTF-8 stream, not separately decoded arbitrary Buffer chunks.
  stdout.setEncoding("utf8");
  const screen = terminalScreen(stdout.columns, stdout.rows);
  let output = "", transcript = "";
  stdout.on("data", chunk => { screen.write(chunk); output = screen.text(); transcript += chunk; });
  const stdin = new PassThrough();
  Object.assign(stdin, { isTTY: true, setRawMode() {}, ref() {}, unref() {} });
  stdin.setEncoding("utf8");
  let closed = false;
  const checkpoints = {};
  const instance = ui.renderSync(
    React.createElement(ui.AlternateScreen, { mouseTracking: false },
      React.createElement(ui.ThemeProvider, { theme: "dark" },
        React.createElement(Scene, { React: observedReact, ui: observedUi, channel: {}, close() { closed = true; } }))),
    { stdout, stdin, stderr: stdout, patchConsole: false, terminalImages: false, exitOnCtrlC: false },
  );
  const waitFor = async (predicate, label) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error("timed out: " + label + "\nRecent input/commits: "
      + JSON.stringify({ inputs: inputs.slice(-4), commits: commits.slice(-4) })
      + "\nRecent terminal output: " + output.slice(-3000));
  };
  const send = bytes => { output = ""; stdin.write(bytes); };
  try {
    await waitFor(() => output.includes("双读者报告") && output.includes("关键指标") && output.includes("Schema"), "structured report");
    checkpoints.report = output;
    assert(!output.includes("\ufffd"), "UTF-8 report must not contain decoding replacements");
    send("\x1b[C");
    await waitFor(() => output.includes("证据与边界") && output.includes("Section 2/2"), "section navigation");
    checkpoints.section = output;
    send("/");
    await waitFor(() => output.includes("Search: type text"), "search prompt");
    // A real terminal can deliver several keystrokes before React commits.
    // Send the entire burst in this turn, without per-character awaits.
    const query = "schema";
    const beforeQuery = inputs.length;
    for (const character of query) send(character);
    await waitFor(() => output.includes("/schema▏ · 1 matches"), "burst search query committed");
    assert.equal(inputs.slice(beforeQuery).map(entry => entry.input).join(""), query, "all burst characters must reach the real hook");
    checkpoints.query = output;
    send("\r");
    // Delivery alone does not prove React applied Enter. Verify search has
    // finished AND the matching section has visibly changed before Escape.
    await waitFor(() => output.includes("Search: schema") && output.includes("Section 1/2")
      && output.includes("Schema") && output.includes("Esc library"), "search Enter committed");
    checkpoints.applied = output;
    const enter = inputs.findLast(entry => entry.key.return);
    assert(enter && !enter.key.shift && !enter.key.meta && !enter.key.isPasted, "plain Enter must reach the real handler");
    const beforeEscape = inputs.length;
    send("\x1b");
    await waitFor(() => inputs.slice(beforeEscape).some(entry => entry.key.escape), "escape delivery");
    await waitFor(() => output.includes("Canvas Library") && output.includes("[structured]")
      && output.includes("1/1 reports"), "back to populated library");
    checkpoints.library = output;
    send("\x1b");
    await waitFor(() => closed, "close");
    const escapes = inputs.slice(beforeEscape).filter(entry => entry.key.escape);
    assert.equal(escapes.length, 2, "one native Escape must back out, the next must close");
    assert(escapes.every(entry => entry.key.meta && !entry.key.shift), "installed decoder Escape flags must remain unmodified");
    assert.equal(escapes[0].committed.searching, false, "Enter must commit before Escape");
    assert.equal(escapes[1].committed.mode, "library", "close must run from library");
    console.log("tui-render: actual host React + ThemeProvider + public renderer; UTF-8 report, sections, committed search, Escape library/close passed");
  } finally {
    try {
      if (process.env.CANVAS_TUI_ARTIFACTS) {
        const artifacts = resolve(process.env.CANVAS_TUI_ARTIFACTS);
        await mkdir(artifacts, { recursive: true });
        await writeFile(join(artifacts, "native-reader.ansi.txt"), transcript);
        await writeFile(join(artifacts, "native-reader.screen.txt"), Object.entries(checkpoints).map(([name, text]) => "=== " + name + " ===\n" + text).join("\n\n"));
        await writeFile(join(artifacts, "native-reader.trace.json"), JSON.stringify({ inputs, commits, checkpoints, transcript }, null, 2));
      }
    } finally {
      // unmount releases renderer resources; waitUntilExit waits for useApp.exit,
      // which a scene close callback does not call and is not the cleanup API.
      instance.unmount();
      instance.cleanup();
      store.dispose();
      stdin.destroy();
      stdout.destroy();
    }
  }
} finally {
  assert(home.startsWith(realpathSync(tmpdir()) + "/canvas-tui-render-"));
  await rm(home, { recursive: true, force: true });
}
