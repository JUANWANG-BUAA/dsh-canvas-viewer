#!/usr/bin/env node
// Real native scene -> node-pty -> xterm.js -> actual browser.
// This deliberately does not claim full dsh-tui CLI/profile boot coverage.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { join, resolve, sep } from "node:path";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { once } from "node:events";

const root = fileURLToPath(new URL("..", import.meta.url));
const host = process.env.DSH_TUI_PACKAGE;
if (!host) throw new Error("DSH_TUI_PACKAGE is required");
const hostRoot = resolve(host);
const requireHost = createRequire(join(hostRoot, "package.json"));
const scriptPath = fileURLToPath(import.meta.url);
const WAIT_TIMEOUT = 10_000;
const WIDE = { cols: 100, rows: 28, width: 1440, height: 1000 };
const NARROW = { cols: 40, rows: 24, width: 480, height: 850 };

async function runScene() {
  const React = requireHost("react");
  const ui = await import(pathToFileURL(join(hostRoot, "lib/types/ui.js")));
  const { createCanvasStore } = await import("../lib/tui/store.mjs");
  const { createCanvasScene } = await import("../lib/tui/reader.mjs");
  const store = createCanvasStore();
  store.requestOpen(join(process.env.HOME, ".dsh/canvases/dual.canvas.json"));
  const Scene = createCanvasScene(store);
  let instance;
  const close = () => {
    store.dispose();
    instance?.unmount();
    instance?.cleanup();
  };
  const scene = React.createElement(Scene, { React, ui, channel: {}, close });
  const themed = React.createElement(ui.ThemeProvider, {
    theme: process.env.CANVAS_VISUAL_THEME || "dark",
  }, scene);
  const screen = React.createElement(ui.AlternateScreen, { mouseTracking: false }, themed);
  instance = ui.renderSync(screen, {
    patchConsole: false,
    terminalImages: false,
    exitOnCtrlC: true,
  });
}

// Only the emulator and transport live in HTML: every report cell comes from the PTY.
const html = String.raw`<!doctype html>
<meta charset="utf-8">
<title>Canvas native terminal visual check</title>
<link rel="stylesheet" href="/xterm.css">
<style>
  html, body { margin: 0; background: #101419; color: #b8c1ce; font: 14px system-ui; }
  header { padding: 18px 24px; border-bottom: 1px solid #303946; }
  h1 { font-size: 17px; margin: 0 0 7px; }
  p { margin: 0; font-size: 12px; }
  #terminal { margin: 24px; display: inline-block; padding: 16px; background: #171b21;
    border: 1px solid #38404b; border-radius: 8px; }
  body.light { background: #e5e7eb; color: #29303a; }
  body.light #terminal { background: #fafafa; }
  @media (max-width: 600px) {
    header { padding: 12px; }
    #terminal { margin: 12px; padding: 10px; }
  }
</style>
<header>
  <h1>Canvas · Native TUI</h1>
  <p id="status">Real host React → native renderer → PTY → xterm.js. No HTML recreation.</p>
</header>
<div id="terminal"></div>
<script src="/xterm.js"></script>
<script>
  const params = new URLSearchParams(location.search);
  const light = params.get('theme') === 'light';
  if (light) document.body.className = 'light';
  const term = window.term = new Terminal({
    cols: 100, rows: 28,
    fontFamily: 'Menlo, "PingFang SC", monospace',
    fontSize: 15, lineHeight: 1.25,
    cursorBlink: false, allowProposedApi: false, scrollback: 100,
    theme: light
      ? { background: '#fafafa', foreground: '#222222' }
      : { background: '#171b21', foreground: '#e2e8f0' },
  });
  term.open(document.getElementById('terminal'));
  const status = document.getElementById('status');
  const ws = new WebSocket('ws://' + location.host + '/?theme=' + (light ? 'light' : 'dark'));
  let outputRevision = 0;
  let parsedRevision = 0;
  window.sceneExit = null;
  window.transportError = null;
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.type === 'output') {
      const revision = ++outputRevision;
      term.write(message.data, () => { parsedRevision = revision; });
    } else if (message.type === 'exit') {
      window.sceneExit = message.code;
      status.textContent = 'Scene closed · exit ' + message.code;
    }
  };
  ws.onerror = () => { window.transportError = 'WebSocket transport error'; };
  term.onData(data => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }));
  });
  window.setGrid = (cols, rows) => {
    term.resize(cols, rows);
    ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    status.textContent = cols + ' × ' + rows + ' · ' + (light ? 'light' : 'dark') + ' · real PTY';
    term.focus();
  };
  window.screenText = () => Array.from({ length: term.rows }, (_, i) =>
    term.buffer.active.getLine(term.buffer.active.viewportY + i)?.translateToString(true) || ''
  ).join('\n');
  window.ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket open timed out')), 10000);
    ws.onopen = () => {
      clearTimeout(timeout);
      term.focus();
      resolve();
    };
  });

  // A buffer match is not a painted frame. Drain writes, force a public-API render,
  // then cross two animation frames. Restart if new PTY output arrived meanwhile.
  window.flushTerminal = async () => {
    let timer;
    let renderSubscription;
    let expired = false;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        reject(new Error('Terminal render flush timed out'));
      }, 10000);
    });
    const flush = async () => {
      await document.fonts.ready;
      do {
        const revision = outputRevision;
        await new Promise(resolve => term.write('', resolve));
        if (expired) return;
        await new Promise(resolve => {
          renderSubscription = term.onRender(() => {
            renderSubscription.dispose();
            renderSubscription = null;
            resolve();
          });
          term.refresh(0, term.rows - 1);
        });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (revision === outputRevision && parsedRevision === outputRevision) return;
      } while (!expired);
    };
    try {
      await Promise.race([flush(), deadline]);
    } finally {
      clearTimeout(timer);
      renderSubscription?.dispose();
    }
  };
</script>`;

async function runBrowserSmoke() {
  const { chromium } = await import("playwright");
  const { WebSocketServer } = requireHost("ws");
  const pty = requireHost("node-pty");
  const emulator = resolve(process.env.CANVAS_XTERM_ROOT
    || join(root, "output/tui-visual-deps/node_modules/@xterm/xterm"));
  const artifact = resolve(process.env.CANVAS_TUI_ARTIFACTS || join(root, "output/tui-browser"));
  await mkdir(artifact, { recursive: true });
  const home = realpathSync(await mkdtemp(join(tmpdir(), "canvas-browser-tui-")));
  const sessions = new Set();
  const errors = [];
  const shots = [];
  let browser;
  let context;
  let server;
  let wss;
  let origin;

  try {
    const dir = join(home, ".dsh/canvases");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "dual.canvas.json"),
      await readFile(new URL("../fixtures/dual-reader.canvas.json", import.meta.url)));
    await writeFile(join(dir, "legacy.canvas.tsx"), 'throw new Error("must never execute");');
    await writeFile(join(dir, "invalid.canvas.json"), JSON.stringify({
      schemaVersion: 99, title: "Unsupported schema", sections: [],
    }));

    server = createServer(async (req, res) => {
      try {
        if (req.url === "/xterm.js" || req.url === "/xterm.css") {
          const script = req.url === "/xterm.js";
          res.setHeader("Content-Type", script ? "text/javascript" : "text/css");
          res.end(await readFile(join(emulator, script ? "lib/xterm.js" : "css/xterm.css")));
        } else {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
        }
      } catch (error) {
        res.writeHead(500);
        res.end("Asset unavailable");
        errors.push(String(error));
      }
    });
    wss = new WebSocketServer({ server, maxPayload: 8192 });
    wss.on("connection", (ws, req) => {
      if (req.headers.origin !== origin) {
        ws.close();
        return;
      }
      const theme = new URL(req.url, origin).searchParams.get("theme") === "light" ? "light" : "dark";
      const child = pty.spawn(process.execPath, [scriptPath, "--scene"], {
        name: "xterm-256color", cols: WIDE.cols, rows: WIDE.rows, cwd: root,
        env: {
          ...process.env,
          HOME: home,
          DSH_HOME: join(home, ".dsh"),
          DSH_TUI_SESSION_ROOT: join(home, "sessions"),
          TERM: "xterm-256color", COLORTERM: "truecolor", CANVAS_VISUAL_THEME: theme,
        },
      });
      sessions.add(child);
      child.onData(data => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "output", data }));
      });
      child.onExit(event => {
        sessions.delete(child);
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "exit", code: event.exitCode }));
      });
      ws.on("message", bytes => {
        try {
          const message = JSON.parse(bytes);
          if (message.type === "input" && typeof message.data === "string" && message.data.length <= 4096) {
            child.write(message.data);
          } else if (message.type === "resize"
            && Number.isInteger(message.cols) && Number.isInteger(message.rows)
            && message.cols >= 20 && message.cols <= 180 && message.rows >= 10 && message.rows <= 60) {
            child.resize(message.cols, message.rows);
          }
        } catch {
          ws.close();
        }
      });
      ws.on("close", () => {
        if (sessions.has(child)) {
          child.kill();
          sessions.delete(child);
        }
      });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    origin = "http://127.0.0.1:" + server.address().port;

    browser = await chromium.connectOverCDP(process.env.CANVAS_CDP_URL || "http://127.0.0.1:9332");
    context = await browser.newContext({
      viewport: { width: WIDE.width, height: WIDE.height }, deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(WAIT_TIMEOUT);
    page.on("pageerror", error => errors.push(String(error)));

    const wait = async text => {
      try {
        await page.waitForFunction(text => window.screenText?.().includes(text), text, { timeout: WAIT_TIMEOUT });
      } catch (error) {
        // Preserve best-effort diagnostics without obscuring the failed assertion.
        await page.evaluate(() => window.flushTerminal?.()).catch(() => {});
        await page.screenshot({ path: join(artifact, "failure.png"), fullPage: true }).catch(() => {});
        const state = await page.evaluate(() => ({
          screen: window.screenText?.(), status: document.body.innerText, transportError: window.transportError,
        })).catch(() => null);
        throw new Error("Waiting for " + text + ": " + JSON.stringify({ errors, state }), { cause: error });
      }
    };
    const shot = async name => {
      await page.evaluate(() => window.flushTerminal());
      await page.screenshot({ path: join(artifact, name + ".png"), fullPage: true });
      await writeFile(join(artifact, name + ".txt"), await page.evaluate(() => window.screenText()));
      shots.push(name);
    };
    const setGrid = async grid => {
      await page.setViewportSize({ width: grid.width, height: grid.height });
      await page.evaluate(({ cols, rows }) => window.setGrid(cols, rows), grid);
    };
    // The library retains its query after returning from a report.
    let libraryQuery = "";
    const filterLibrary = async query => {
      await page.keyboard.type("/");
      for (const _ of libraryQuery) await page.keyboard.press("Backspace");
      await page.keyboard.type(query);
      await wait("/" + query + "▏");
      await wait("1/1 reports");
      await page.keyboard.press("Enter");
      await wait("Search: " + query);
      libraryQuery = query;
    };

    await page.goto(origin);
    await page.evaluate(() => window.ready);
    await wait("关键指标");
    await shot("01-wide-overview");

    await page.keyboard.press("ArrowRight");
    await wait("证据与边界");
    await shot("02-wide-table");

    await page.keyboard.type("/schema");
    await wait("/schema▏");
    await page.keyboard.press("Enter");
    await wait("Search: schema");
    await wait("Section 1/2");
    await shot("03-search");

    await page.keyboard.press("Escape");
    await wait("Canvas Library");
    await wait("[invalid]");
    await shot("04-library");

    await filterLibrary("legacy");
    await page.keyboard.press("Enter");
    await wait("终端未执行源码");
    await shot("05-legacy");

    await page.keyboard.press("Escape");
    await wait("Canvas Library");
    await filterLibrary("invalid");
    await wait("[invalid]");
    await page.keyboard.press("Enter");
    await wait("Error: Invalid CanvasReport at report.schemaVersion: unsupported schema version");
    await wait("Press r to retry; Esc to go back.");
    await shot("06-invalid-schema");

    await page.keyboard.press("Escape");
    await wait("Canvas Library");
    await filterLibrary("dual");
    await page.keyboard.press("Enter");
    await wait("关键指标");
    await page.keyboard.press("ArrowRight");
    await wait("证据与边界");
    await setGrid(NARROW);
    await wait("Row 1");
    await wait("Esc back");
    await shot("07-narrow-table");

    const beforeScroll = await page.evaluate(() => window.screenText());
    await page.keyboard.press("PageDown");
    await page.waitForFunction(before => {
      const screen = window.screenText?.();
      const firstLine = Number(screen?.match(/Lines ([0-9]+)–/)?.[1]);
      return screen && screen !== before && firstLine > 1;
    }, beforeScroll, { timeout: WAIT_TIMEOUT });
    await shot("08-narrow-scroll");

    await page.keyboard.press("Escape");
    await wait("Canvas Library");
    await wait("[structured]");
    await wait("/ search");
    await wait("Esc close");
    await shot("09-narrow-library");
    await page.keyboard.press("Enter");
    await wait("关键指标");
    await page.keyboard.press("ArrowRight");
    await wait("证据与边界");
    await setGrid(WIDE);
    await wait("检查项");
    await shot("10-resize-restored");

    await page.goto(origin + "/?theme=light");
    await page.evaluate(() => window.ready);
    await wait("关键指标");
    await shot("11-light-overview");
    await page.keyboard.press("ArrowRight");
    await wait("证据与边界");
    await shot("12-light-table");

    // Reader -> library -> host close, not an artificial PTY kill.
    await page.keyboard.press("Escape");
    await wait("Canvas Library");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.sceneExit !== null, null, { timeout: WAIT_TIMEOUT });
    assert.equal(await page.evaluate(() => window.sceneExit), 0, "Scene must exit cleanly after Esc twice");
    await page.evaluate(() => window.flushTerminal());
    assert.equal(await page.locator("#status").textContent(), "Scene closed · exit 0");
    assert.deepEqual(errors, []);
    const result = {
      ok: true, transport: "native renderer -> real PTY -> xterm6 -> installed browser",
      shots, closedWithEscape: true,
      notCovered: ["full dsh-tui CLI/profile boot", "OS terminal font differences"],
    };
    await writeFile(join(artifact, "result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ok: true, artifact, shots, closedWithEscape: true }));
  } finally {
    // Do not let a browser disconnect prevent server/PTY/temp-home cleanup.
    try {
      await context?.close();
    } finally {
      try {
        await browser?.close(); // CDP disconnect only; leaves the externally owned browser running.
      } finally {
        for (const child of sessions) child.kill();
        for (const ws of wss?.clients || []) ws.terminate();
        if (wss) await new Promise(resolve => wss.close(resolve));
        if (server?.listening) await new Promise(resolve => server.close(resolve));
        const prefix = join(realpathSync(tmpdir()), "canvas-browser-tui-");
        assert(home.startsWith(prefix) && !home.slice(prefix.length).includes(sep));
        await rm(home, { recursive: true, force: true });
      }
    }
  }
}

if (process.argv.includes("--scene")) await runScene();
else await runBrowserSmoke();
