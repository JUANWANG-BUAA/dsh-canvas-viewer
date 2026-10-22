#!/usr/bin/env node
// Development-only concatenation: the shipped client remains one classic-script
// ModuleLoader factory with no runtime fragment loader or import dependency.
import { readFile, writeFile } from "node:fs/promises";
import { Script } from "node:vm";

const modules = [
  "styles", "theme-and-dom", "canvas-sdk", "sandbox", "viewer-shell",
  "conversation-tail", "gallery", "cordis-entrypoint",
];
const files = [
  "00-prologue.js.part",
  ...modules.map((name, index) => String(index + 1).padStart(2, "0") + "-" + name + ".js.part"),
  "09-epilogue.js.part",
];
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
  throw new Error("Usage: node scripts/build-client.mjs [--check]");
}
const check = args[0] === "--check";
const parts = await Promise.all(files.map((file) => readFile(new URL("../src/client/" + file, import.meta.url))));
for (const [index, name] of modules.entries()) {
  const text = parts[index + 1].toString("utf8");
  if (!text.startsWith("    /* @client-module " + name + ":") || (text.match(/@client-module /g) || []).length !== 1) {
    throw new Error("Invalid client module boundary: " + files[index + 1]);
  }
}
const output = Buffer.concat(parts);
const text = output.toString("utf8");
if (!text.startsWith("window.__ModuleLoader__.load({")
  || text.split("window.__ModuleLoader__.load(").length !== 2
  || (text.match(/factory:\s*\(require\)/g) || []).length !== 1
  || !text.includes('id: "dsh-canvas-viewer"')) {
  throw new Error("Client must contain exactly one dsh-canvas-viewer ModuleLoader factory");
}
new Script(text, { filename: "lib/client.js" });
const destination = new URL("../lib/client.js", import.meta.url);
let current = null;
try {
  current = await readFile(destination);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const matches = current !== null && output.equals(current);
if (check && !matches) {
  throw new Error("lib/client.js differs from src/client fragments (generated " + output.length
    + " bytes, current " + (current?.length ?? "missing") + "); run node scripts/build-client.mjs");
}
if (!check && !matches) await writeFile(destination, output);
console.log(JSON.stringify({ ok: true, check, changed: !check && !matches, fragments: files.length, bytes: output.length }));
