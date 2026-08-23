#!/usr/bin/env node
/**
 * Parse-only syntax check for shipped runtime files.
 * Catches spliced/quoted CSS strings, unbalanced braces, etc. before tests run.
 * Run: node scripts/syntax-check.mjs
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const files = [
  new URL("../lib/index.js", import.meta.url),
  new URL("../lib/client.js", import.meta.url),
].map(fileURLToPath);

let failed = false;
for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    console.log("ok  " + file.replace(process.cwd() + "/", ""));
  } catch (e) {
    failed = true;
    console.error("FAIL " + file);
    console.error(String(e.stderr || e.message));
  }
}
if (failed) process.exit(1);
console.log(JSON.stringify({ ok: true, checked: files.length }));