#!/usr/bin/env node
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = join(root, "skills", "canvas-analysis-report");
const targets = [
  join(root, ".agents", "skills", "canvas-analysis-report"),
  join(root, ".dsh", "skills", "canvas-analysis-report"),
];
const checkOnly = process.argv.includes("--check");

function files(dir) {
  return readdirSync(dir).filter((name) => statSync(join(dir, name)).isFile()).sort();
}

function same(left, right) {
  try {
    return readFileSync(left).equals(readFileSync(right));
  } catch {
    return false;
  }
}

const sourceFiles = files(source);
const problems = [];
for (const target of targets) {
  const targetFiles = files(target);
  for (const name of sourceFiles) {
    if (!same(join(source, name), join(target, name))) problems.push(`${target}/${name}`);
  }
  for (const name of targetFiles) {
    if (!sourceFiles.includes(name)) problems.push(`${target}/${name} (stale)`);
  }
  if (!checkOnly) {
    mkdirSync(target, { recursive: true });
    for (const name of sourceFiles) cpSync(join(source, name), join(target, name));
    for (const name of targetFiles) {
      if (!sourceFiles.includes(name)) rmSync(join(target, name), { force: true });
    }
  }
}

if (checkOnly && problems.length) {
  console.error("skill mirrors are out of sync:");
  for (const problem of problems) console.error(`- ${problem}`);
  console.error("Run: node scripts/sync-skill-mirrors.mjs");
  process.exit(1);
}

console.log(checkOnly ? "skill mirrors: in sync" : "skill mirrors: synchronized");
