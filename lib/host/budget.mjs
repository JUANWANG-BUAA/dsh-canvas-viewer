import { readFileSync } from "node:fs";

// These are guidance values, not defaults. Existing installations remain
// unrestricted until a user opts into a budget in settings.json.
export const RECOMMENDED_MAX_LINES = 80;
export const RECOMMENDED_MAX_BYTES = 16_000;
export const RECOMMENDED_MAX_TOKENS = 4_000;

/**
 * A deliberately conservative, tokenizer-free estimate for model-facing
 * source cost. ASCII code/data is approximated at 4 chars/token; non-ASCII
 * text is counted at one code point/token. It is a signal, not billing data.
 */
export function estimateCanvasTokens(source) {
  if (typeof source !== "string" || source.length === 0) return 0;
  let ascii = 0;
  let nonAscii = 0;
  for (const ch of source) {
    if (ch.codePointAt(0) <= 0x7f) ascii += 1;
    else nonAscii += 1;
  }
  return Math.ceil(ascii / 4) + nonAscii;
}

/** Cheap source-shape signals used to catch costs line counts cannot see. */
export function sourceSignals(source) {
  if (typeof source !== "string" || source.length === 0) {
    return { maxLineBytes: 0, repeatedLineRatio: 0, inlineDataBytes: 0, warnings: [] };
  }
  const lines = source.split("\n");
  const meaningful = lines.map((line) => line.trim()).filter((line) => line && !line.startsWith("//"));
  const unique = new Set(meaningful);
  const repeatedLineRatio = meaningful.length ? 1 - unique.size / meaningful.length : 0;
  const maxLineBytes = Math.max(...lines.map((line) => Buffer.byteLength(line, "utf8")), 0);
  let inlineDataBytes = 0;
  const dataPattern = /data:[^\s"'`]+;base64,[A-Za-z0-9+/=]+/g;
  for (const match of source.matchAll(dataPattern)) inlineDataBytes += Buffer.byteLength(match[0], "utf8");
  const warnings = [];
  if (inlineDataBytes >= 8_000) warnings.push("inline-data");
  if (meaningful.length >= 20 && repeatedLineRatio >= 0.35) warnings.push("repeated-lines");
  return { maxLineBytes, repeatedLineRatio, inlineDataBytes, warnings };
}

export function normalizeBudget(raw) {
  const b = raw && typeof raw === "object" ? raw : {};
  const positive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
  return {
    maxLines: positive(b.maxLines),
    maxBytes: positive(b.maxBytes),
    maxTokens: positive(b.maxTokens),
    enforce: b.enforce === "hard" ? "hard" : "soft",
  };
}

export function readBudgetPolicy(settingsFile) {
  try {
    const parsed = JSON.parse(readFileSync(settingsFile, "utf8"));
    return normalizeBudget(parsed && parsed.budget);
  } catch {
    return normalizeBudget(null);
  }
}

export function budgetStatus({ lines = 0, bytes = 0, estimatedTokens = 0 }, policy) {
  const p = normalizeBudget(policy);
  const violations = [];
  if (p.maxLines !== null && lines > p.maxLines) violations.push("lines");
  if (p.maxBytes !== null && bytes > p.maxBytes) violations.push("bytes");
  if (p.maxTokens !== null && estimatedTokens > p.maxTokens) violations.push("tokens");
  return {
    overBudget: violations.length > 0,
    violations,
    overLines: p.maxLines !== null && lines > p.maxLines,
    overBytes: p.maxBytes !== null && bytes > p.maxBytes,
    overTokens: p.maxTokens !== null && estimatedTokens > p.maxTokens,
  };
}

export function budgetMessage(meta, policy) {
  const status = budgetStatus(meta, policy);
  if (!status.overBudget) return "";
  const p = normalizeBudget(policy);
  const details = [];
  if (status.overLines) details.push(`${meta.lines} 行 > ${p.maxLines}`);
  if (status.overBytes) details.push(`${meta.bytes}B > ${p.maxBytes}B`);
  if (status.overTokens) details.push(`≈${meta.estimatedTokens} tokens > ${p.maxTokens}`);
  return details.join("；");
}
