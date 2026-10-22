#!/usr/bin/env node
// Each run gets a disposable HOME; never scans or mutates the real report library.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
if (!process.env.CANVAS_HOST_TEST_CHILD) {
  const home = realpathSync(await mkdtemp(join(tmpdir(), "canvas-host-test-")));
  assert(home.startsWith(realpathSync(tmpdir()) + "/canvas-host-test-"));
  try {
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, HOME: home, CANVAS_HOST_TEST_CHILD: "1" }, stdio: "inherit" });
    process.exitCode = result.status ?? 1;
  } finally { await rm(home, { recursive: true, force: true }); }
} else {
  const home = resolve(process.env.HOME);
  assert(home.includes("/canvas-host-test-"));
  const dir = join(home, ".dsh", "canvases");
  await mkdir(dir, { recursive: true });
  const { listCanvases, openCanvas, saveCanvasFile, apply } = await import("../lib/index.js");
  const source = (text) => 'import { H1 } from "dsh/canvas";\nexport default function Report(){return <H1>' + text + '</H1>;}\n';
  await Promise.all(Array.from({ length: 225 }, (_, i) => writeFile(join(dir, String(i).padStart(3, "0") + ".canvas.tsx"), source(i === 224 ? "OnlyBodyNeedle" : "body"))));
  const first = await listCanvases({ limit: 40 });
  assert.equal(first.count, 40); assert.equal(first.total, 225); assert.equal(first.nextOffset, 40);
  const second = await listCanvases({ offset: first.nextOffset, limit: 40 });
  assert.equal(second.count, 40); assert(!second.items.some((r) => first.items.some((x) => x.path === r.path)));
  const all = await listCanvases(); assert.equal(all.count, 200); assert.equal(all.nextOffset, 200);
  const tail = await listCanvases({ offset: 200 }); assert.equal(tail.count, 25); assert.equal(tail.nextOffset, null);
  const search = await listCanvases({ q: "onlybodyneedle", limit: 1 });
  assert.equal(search.total, 1); assert(search.items[0].path.endsWith("224.canvas.tsx"));
  assert(!JSON.stringify(search).includes("searchText"));
  const noWorkspace = await listCanvases({ workspace: "missing" });
  assert.equal(noWorkspace.total, 0); assert(first.workspaces.length > 0); assert.deepEqual(noWorkspace.workspaces, first.workspaces);
  await symlink(home, join(dir, "loop"));
  await symlink(join(dir, "224.canvas.tsx"), join(dir, "alias.canvas.tsx"));
  assert.equal((await listCanvases({ q: "OnlyBodyNeedle" })).total, 1);
  const path = join(dir, "000.canvas.tsx");
  const initial = await openCanvas(path); assert.match(initial.revision, /^[a-f0-9]{64}$/);
  const saved = await saveCanvasFile(path, source("saved"), initial.revision);
  assert.equal(saved.saveMode, "revision-checked"); assert.notEqual(saved.revision, initial.revision);
  await assert.rejects(saveCanvasFile(path, source("stale"), initial.revision), (e) => e.status === 409 && e.currentRevision === saved.revision);
  assert.equal(await readFile(path, "utf8"), source("saved"));
  const raced = await Promise.allSettled([saveCanvasFile(path, source("one"), saved.revision), saveCanvasFile(path, source("two"), saved.revision)]);
  assert.equal(raced.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(raced.filter((x) => x.status === "rejected" && x.reason.status === 409).length, 1);
  const legacy = await saveCanvasFile(path, source("legacy")); assert.equal(legacy.saveMode, "legacy-unconditional");
  assert.equal((await listCanvases({ q: "legacy" })).total, 1);
  const dualPath = join(dir, "dual.canvas.json");
  const dualSource = (await readFile(new URL("../fixtures/dual-reader.canvas.json", import.meta.url), "utf8")).replace("双读者报告 · Native TUI / Web", "asset://missing.png");
  await writeFile(dualPath, dualSource);
  const dual = await openCanvas(dualPath);
  assert.equal(dual.format, "structured"); assert.equal(dual.error, ""); assert(dual.compiled.includes("一份数据，两种读者")); assert(dual.compiled.includes("asset://missing.png"));
  assert.equal(dual.source, dualSource); assert.match(dual.revision, /^[a-f0-9]{64}$/);
  const jsonSaved = await saveCanvasFile(dualPath, dualSource + "\n", dual.revision); assert.equal(jsonSaved.error, "");
  assert((await listCanvases({ q: "一份数据，两种读者" })).items.some(row=>row.format==="structured"));
  const current = await openCanvas(path); await writeFile(path, source("external"));
  await assert.rejects(saveCanvasFile(path, source("draft"), current.revision), (e) => e.status === 409);
  await assert.rejects(saveCanvasFile(path, "x", "invalid"), /invalid baseRevision/);
  const routes = []; const disposers = [];
  apply({ effect(fn) { const d = fn(); if (d) disposers.push(d); }, webServer: { register(r) { routes.push(r); return () => {}; } }, tools: { register() {} }, systemPrompt: { section() {} } });
  const saveRoute = routes.find((r) => r.path === "/api/canvas/save");
  const { Readable } = await import("node:stream");
  const req = Readable.from([Buffer.from(JSON.stringify({ path, source: source("blocked"), baseRevision: current.revision }))]); req.method = "POST";
  let response; const res = { writeHead(status) { this.status = status; }, end(body) { response = { status: this.status, ...JSON.parse(body) }; } };
  await saveRoute.handler(req, res);
  assert.equal(response.status, 409); assert.equal(response.code, "revision-conflict"); assert.match(response.currentRevision, /^[a-f0-9]{64}$/);
  for (const dispose of disposers.reverse()) await dispose();
  console.log("workspace-host: full-source pagination, symlink exclusion, revision conflicts, concurrent/legacy saves and HTTP409 passed");
}
