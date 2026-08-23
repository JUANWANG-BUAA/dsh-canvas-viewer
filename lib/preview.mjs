// Structural preview signature for the gallery: pure source scanning (no eval,
// no compile) so the host stays eval-free. Every scan uses indexOf + charCodeAt so
// the file contains no backslash escapes and no single-quote string literals.
import { readFileSync } from "node:fs";

export function readCanvasSource(file) {
  try { return readFileSync(file, "utf8"); } catch { return ""; }
}

export function previewSignature(src) {
  if (typeof src !== "string" || !src) return null;
  const SPACE = 32, TAB = 9, NL = 10, CR = 13, DOUBLE = 34, SINGLE = 39;
  function isSpace(ch) {
    if (ch === undefined) return false;
    const c = ch.charCodeAt(0);
    return c === SPACE || c === TAB || c === NL || c === CR;
  }
  function tagText(tag, max) {
    const open = "<" + tag + ">";
    const i = src.indexOf(open);
    if (i < 0) return "";
    const j = src.indexOf("</" + tag + ">", i);
    return j < 0 ? "" : src.slice(i + open.length, j).trim().slice(0, max);
  }
  function callText(tag, max) {
    const mark = tag + "(";
    const i = src.indexOf(mark);
    if (i < 0) return "";
    let j = i + mark.length;
    while (j < src.length && isSpace(src[j])) j += 1;
    if (j >= src.length) return "";
    const q = src.charCodeAt(j);
    if (q !== DOUBLE && q !== SINGLE) return "";
    const end = src.indexOf(src[j], j + 1);
    return end < 0 ? "" : src.slice(j + 1, end).trim().slice(0, max);
  }
  function countSub(marker) {
    let n = 0, at = 0;
    while ((at = src.indexOf(marker, at)) >= 0) { n += 1; at += marker.length; }
    return n;
  }
  const headline = tagText("H1", 60) || callText("H1", 60) || tagText("h1", 60);
  let tone = "";
  const isWordChar = (ch) => ch !== undefined && /[A-Za-z0-9_]/.test(ch);
  let ti = -1;
  // scan all "tone" hits; skip word-prefixed (rowTone) and non-attribute (string) hits
  for (;;) {
    ti = src.indexOf("tone", ti + 1);
    if (ti < 0) break;
    if (ti > 0 && isWordChar(src[ti - 1])) continue;
    let k = ti + 4;
    while (k < src.length && isSpace(src[k])) k += 1;
    if (src[k] !== "=" && src[k] !== ":") continue;
    k += 1;
    while (k < src.length && isSpace(src[k])) k += 1;
    const q = src.charCodeAt(k);
    if (q !== DOUBLE && q !== SINGLE) continue;
    const end = src.indexOf(src[k], k + 1);
    if (end > 0) { tone = src.slice(k + 1, end); break; }
  }
  return {
    headline: headline || "",
    sectionCount: countSub("<H2") + countSub("H2("),
    hasChart: src.indexOf("BarChart") >= 0 || src.indexOf("LineChart") >= 0 || src.indexOf("PieChart") >= 0 || src.indexOf("AreaChart") >= 0,
    hasTable: src.indexOf("<Table") >= 0 || src.indexOf("Table(") >= 0,
    hasTabs: src.indexOf("report-tab") >= 0 || src.indexOf("useCanvasState") >= 0,
    tone: tone.slice(0, 12),
    statCount: countSub("<Stat") + countSub("Stat({") + countSub("Stat("),
  };
}
