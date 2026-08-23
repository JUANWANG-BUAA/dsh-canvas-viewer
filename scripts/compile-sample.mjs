#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { compileCanvas } from "../lib/index.js";

const sample =
  process.argv[2]
  ?? "/Users/juanwang/.cursor/projects/Users-juanwang-code-project-frontend-ds-fim/canvases/dsh-canvas-bridge.canvas.tsx";

const source = await readFile(sample, "utf8");
const { code } = await compileCanvas(source, sample);
if (!code.includes("function DshCanvasBridge") && !code.includes("return")) {
  throw new Error("compile produced unexpected output");
}
console.log(JSON.stringify({
  ok: true,
  file: sample,
  bytes: source.length,
  compiledBytes: code.length,
  hasDefault: /DshCanvasBridge|__defaultExport/.test(code),
}, null, 2));