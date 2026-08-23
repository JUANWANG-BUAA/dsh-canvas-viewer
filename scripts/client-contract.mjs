#!/usr/bin/env node
/**
 * Guard the single-file dsh client factory while its implementation is being
 * migrated toward source-level modules. The browser must still receive one
 * external `window.__ModuleLoader__` factory, so this contract checks the
 * explicit module seams and prevents accidental bundle growth.
 */
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
const lines = source.split("\n").length;
const bytes = Buffer.byteLength(source, "utf8");
const names = ["styles", "theme-and-dom", "canvas-sdk", "sandbox", "viewer-shell", "conversation-tail", "gallery", "cordis-entrypoint"];
const markers = names.map((name) => `@client-module ${name}`);
const positions = markers.map((marker) => {
  const first = source.indexOf(marker);
  if (first < 0 || first !== source.lastIndexOf(marker)) throw new Error(`missing or duplicate client module marker: ${marker}`);
  return first;
});
for (let i = 1; i < positions.length; i += 1) {
  if (positions[i] <= positions[i - 1]) throw new Error(`client module order changed: ${names[i - 1]} → ${names[i]}`);
}
if (!source.startsWith("window.__ModuleLoader__.load({")) throw new Error("client must remain an external ModuleLoader bundle");
if ((source.match(/factory:\s*\(require\)/g) || []).length !== 1) throw new Error("client must expose exactly one factory");
if (/^\s*import\s/m.test(source) || /^\s*export\s/m.test(source)) throw new Error("client bundle cannot depend on browser ESM imports");
const maxBytes = 180 * 1024;
if (bytes > maxBytes) throw new Error(`client bundle grew beyond ${maxBytes} bytes: ${bytes}`);
const sections = positions.map((start, index) => ({
  module: names[index],
  lines: source.slice(start, positions[index + 1] ?? source.length).split("\n").length,
}));
console.log(JSON.stringify({ ok: true, lines, bytes, maxBytes, sections }, null, 2));
