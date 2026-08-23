#!/usr/bin/env node
/** Quantify canvas source cost without compiling or evaluating user reports. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { estimateCanvasTokens, RECOMMENDED_MAX_BYTES, RECOMMENDED_MAX_LINES, RECOMMENDED_MAX_TOKENS } from "../lib/host/budget.mjs";

const root = join(homedir(), ".dsh", "canvases");
const rows = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith(".canvas.tsx")) {
      try {
        const source = readFileSync(full, "utf8");
        const bytes = statSync(full).size;
        const lines = source.split("\n").length;
        const estimatedTokens = estimateCanvasTokens(source);
        rows.push({ file: entry.name, lines, bytes, estimatedTokens });
      } catch { /* ignore a file removed during the scan */ }
    }
  }
}

walk(root);
const count = rows.length;
const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
const over = (key, limit) => rows.filter((row) => row[key] > limit).length;
const largest = [...rows].sort((a, b) => b.bytes - a.bytes).slice(0, 5);
console.log(JSON.stringify({
  root,
  recommendations: { maxLines: RECOMMENDED_MAX_LINES, maxBytes: RECOMMENDED_MAX_BYTES, maxTokens: RECOMMENDED_MAX_TOKENS },
  count,
  totals: { lines: sum("lines"), bytes: sum("bytes"), estimatedTokens: sum("estimatedTokens") },
  averages: count ? {
    lines: Math.round(sum("lines") / count * 10) / 10,
    bytes: Math.round(sum("bytes") / count),
    estimatedTokens: Math.round(sum("estimatedTokens") / count),
  } : { lines: 0, bytes: 0, estimatedTokens: 0 },
  overRecommended: {
    lines: over("lines", RECOMMENDED_MAX_LINES),
    bytes: over("bytes", RECOMMENDED_MAX_BYTES),
    estimatedTokens: over("estimatedTokens", RECOMMENDED_MAX_TOKENS),
  },
  largest,
}, null, 2));
