#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { createCanvasRepository } from "../lib/report/repository.mjs";
import { createCanvasStore } from "../lib/tui/store.mjs";
const home = realpathSync(await mkdtemp(join(tmpdir(), "canvas-repository-")));
try {
  const dir = join(home, ".dsh", "canvases"); await mkdir(dir, { recursive: true });
  const fixture = await readFile(new URL("../fixtures/dual-reader.canvas.json", import.meta.url), "utf8");
  await writeFile(join(dir, "dual.canvas.json"), fixture);
  await writeFile(join(dir, "legacy.canvas.tsx"), 'globalThis.__canvasExecuted=true; throw new Error("DO NOT RUN");');
  await writeFile(join(dir, "bad.canvas.json"), '{"schemaVersion":99}');
  await writeFile(join(dir, "large.canvas.json"), " ".repeat(1_500_001));
  const repo = createCanvasRepository({ home });
  const all = await repo.list(); assert.equal(all.total, 3); assert(all.scanComplete);
  assert(all.items.find(r=>r.title.endsWith("bad.canvas.json")).error);
  const structured = await repo.open("dual.canvas.json"); assert.equal(structured.report.schemaVersion, 1);
  const legacy = await repo.open("legacy.canvas.tsx"); assert(legacy.legacy); assert.equal(globalThis.__canvasExecuted, undefined);
  await assert.rejects(repo.open("bad.canvas.json"), /Invalid CanvasReport/);
  await assert.rejects(repo.open("large.canvas.json"), /large/);
  await assert.rejects(repo.open("/etc/passwd"));
  await symlink("/etc/passwd", join(dir, "outside.canvas.json"));
  await symlink(dir, join(dir, "loop"));
  await assert.rejects(repo.open(join(dir, "outside.canvas.json")));
  assert.equal((await repo.list()).total, 3);
  if (process.platform !== "win32") {
    const fifo = join(dir,"pipe.canvas.json"); execFileSync("mkfifo",[fifo]);
    await assert.rejects(repo.open(fifo), /regular file/);
  }
  const summaryReport = JSON.parse(fixture); summaryReport.summary = "s".repeat(32000);
  const summaryPath = join(dir,"summary.canvas.json"); await writeFile(summaryPath,JSON.stringify(summaryReport));
  assert.equal((await repo.metadata(summaryPath)).preview.summary.length,240);
  const search = await repo.list({q:"DO NOT RUN",limit:1}); assert.equal(search.total,1); assert.equal(search.items[0].format,"legacy");
  const store = createCanvasStore({home}); let notifications=0; const off=store.subscribe(()=>notifications++);
  store.requestOpen(structured.path); assert.equal(store.getSnapshot().path,structured.path); assert.equal(notifications,1);
  off(); store.requestOpen(undefined); assert.equal(notifications,1);
  store.dispose(); assert.throws(()=>store.requestOpen("x"),/disposed/); await assert.rejects(store.list(),/disposed/);
  const largeDir = join(dir,"bounded"); await mkdir(largeDir);
  const padded = fixture + " ".repeat(1_450_000 - Buffer.byteLength(fixture));
  await Promise.all(Array.from({length:24},(_,i)=>writeFile(join(largeDir,"bounded-"+i+".canvas.json"),padded)));
  const bounded = await repo.list({q:"双读者"}); assert.equal(bounded.scanComplete,false); assert(bounded.total < 24);
  console.log("report-repository: structured/inert legacy, FIFO/symlinks, summary/cache/scan bounds, full-source search and store lifecycle passed");
} finally {
  assert(home.startsWith(realpathSync(tmpdir())+"/canvas-repository-")); await rm(home,{recursive:true,force:true});
}
