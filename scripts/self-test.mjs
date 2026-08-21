#!/usr/bin/env node
/**
 * Lightweight regression checks for Host compile + path guards.
 * Run: node scripts/self-test.mjs
 */
import { compileCanvas, findCanvasByName, isCanvasPath, resolveCanvasPath } from "../lib/index.js";
import { homedir } from "node:os";
import { join } from "node:path";

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(isCanvasPath("x.canvas.tsx"), "suffix ok");
assert(!isCanvasPath("x.tsx"), "reject non-canvas");

const homeFile = join(homedir(), "demo.canvas.tsx");
assert(resolveCanvasPath(homeFile) === homeFile, "absolute home path");

let rejected = false;
try {
  resolveCanvasPath("/tmp/evil.canvas.tsx");
} catch {
  rejected = true;
}
assert(rejected, "must reject outside home");

const probe = "ds-fim-engineering-doc.canvas.tsx";
const found = findCanvasByName(probe);
if (found) {
  assert(resolveCanvasPath(probe) === found, "basename resolves to canvases/");
  assert(found.includes("/canvases/"), "found under canvases");
}

const source = `import { H1, Stack, Text, Table, mergeStyle } from "cursor/canvas";
export default function SelfTest() {
  return (
    <Stack gap={12} style={mergeStyle({ padding: 4 })}>
      <H1>ok</H1>
      <Text tone="secondary">probe</Text>
      <Table headers={["a"]} rows={[["1"]]} rowTone={["info"]} striped />
    </Stack>
  );
}
`;
const compiled = await compileCanvas(source);
assert(compiled.includes("function SelfTest"), "keeps component");
assert(compiled.includes("BarChart"), "prelude exports charts");
assert(compiled.includes("sdk"), "injects sdk prelude");
assert(!compiled.includes('from "cursor/canvas"'), "strips import");

console.log(JSON.stringify({ ok: true, checks: 7 }, null, 2));
