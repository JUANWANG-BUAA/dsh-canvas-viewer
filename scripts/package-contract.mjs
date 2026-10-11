#!/usr/bin/env node
/** Verify the npm package boundary without creating an archive. */
import { execFileSync } from "node:child_process";

const raw = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const report = JSON.parse(raw);
// npm <= 11 reports an array of pack results; npm 12 keys the report object by
// package name. Accept both shapes so the contract holds across CI and local npm.
const entry = Array.isArray(report) ? report[0] : Object.values(report)[0];
const files = new Set(entry?.files?.map((file) => file.path) || []);
const required = [
  "lib/index.js",
  "lib/client.js",
  "lib/preview.mjs",
  "lib/host/paths.mjs",
  "lib/host/http.mjs",
  "lib/host/compiler.mjs",
  "lib/host/hot-reload.mjs",
  "lib/host/budget.mjs",
  "lib/host/assets.mjs",
  "src/host/assets.mts",
  "tsconfig.json",
  "cordis.patch.yml",
  "THIRD-PARTY-NOTICES.md",
  "skills/canvas-analysis-report/SKILL.md",
  "skills/canvas-analysis-report/sdk.md",
];
for (const file of required) {
  if (!files.has(file)) throw new Error(`package missing required file: ${file}`);
}
for (const file of files) {
  if (file.startsWith("node_modules/") || file.startsWith(".git/")) {
    throw new Error(`package leaked development artifact: ${file}`);
  }
}
console.log(JSON.stringify({ ok: true, files: files.size, checked: required.length }));
