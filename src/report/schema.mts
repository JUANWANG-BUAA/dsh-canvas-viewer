/** Version 1 data-only reports. No execution, URLs, HTML, or caller-defined props. */
export const CANVAS_REPORT_SCHEMA_VERSION = 1 as const;
export const CANVAS_REPORT_LIMITS = Object.freeze({
  maxSourceBytes: 1_500_000,
  maxSections: 64,
  maxBlocks: 512,
  maxIdLength: 128,
  maxTitleLength: 512,
  maxLabelLength: 256,
  maxTextLength: 32_768,
  maxTotalTextBytes: 1_000_000,
  maxItems: 256,
  maxTotalItems: 4_096,
  maxTableColumns: 32,
  maxTableRows: 256,
  maxTableCells: 8_192,
  maxTotalTableCells: 16_384,
  // Keeps the SDK's chart arithmetic finite, not just the input number itself.
  maxAbsNumber: 1e100,
});
export const CANVAS_REPORT_BLOCK_TYPES = Object.freeze([
  "text", "callout", "metrics", "table", "list", "bar-chart", "unsupported",
] as const);
export const CANVAS_REPORT_TONES = Object.freeze(["info", "success", "warning", "danger"] as const);
export type CalloutTone = typeof CANVAS_REPORT_TONES[number];
export type TableCell = string | number | boolean | null;
export type Block =
  | { type: "text"; text: string }
  | { type: "callout"; tone: CalloutTone; title?: string; text: string }
  | { type: "metrics"; items: { label: string; value: string | number; detail?: string }[] }
  | { type: "table"; columns: string[]; rows: TableCell[][] }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "bar-chart"; items: { label: string; value: number }[] }
  | { type: "unsupported"; label: string; reason: string };
export interface CanvasReportSection { id: string; title: string; blocks: Block[] }
export interface CanvasReport {
  schemaVersion: typeof CANVAS_REPORT_SCHEMA_VERSION;
  title: string;
  summary?: string;
  sections: CanvasReportSection[];
}

type DataObject = Record<string, unknown>;
interface Budget { textBytes: number; blocks: number; items: number; tableCells: number }
const limits = CANVAS_REPORT_LIMITS;
// C0/C1 (including ESC, CR, DEL, CSI/OSC) and bidirectional formatting controls.
// LF and TAB alone are allowed; values are always rendered as literal text.
const UNSAFE_TEXT = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
function fail(path: string, reason: string): never {
  // Only trusted schema paths/reasons enter errors, never untrusted property names/values.
  throw new TypeError("Invalid CanvasReport at " + path + ": " + reason);
}
function byteLength(value: string): number { return new TextEncoder().encode(value).byteLength; }

function object(input: unknown, path: string, required: readonly string[], optional: readonly string[] = []): DataObject {
  if (input === null || typeof input !== "object" || Array.isArray(input)) fail(path, "expected an object");
  const proto: unknown = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) fail(path, "expected a plain data object");
  const keys = Reflect.ownKeys(input);
  if (keys.length > required.length + optional.length) fail(path, "unknown keys");
  const result: DataObject = Object.create(null) as DataObject;
  for (const key of keys) {
    if (typeof key !== "string" || (!required.includes(key) && !optional.includes(key))) fail(path, "unknown keys");
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail(path, "expected enumerable data properties");
    result[key] = descriptor.value as unknown;
  }
  for (const key of required) if (!Object.hasOwn(result, key)) fail(path + "." + key, "required");
  return result;
}
function array(input: unknown, path: string, maximum: number): unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) fail(path, "expected a plain array");
  if (input.length > maximum) fail(path, "array limit exceeded");
  // Reject holes, accessors, symbols, custom properties and inherited values without invoking getters.
  const keys = Reflect.ownKeys(input);
  if (keys.length !== input.length + 1) fail(path, "expected a dense data array");
  const result: unknown[] = [];
  for (let i = 0; i < input.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail(path, "expected a dense data array");
    result.push(descriptor.value as unknown);
  }
  return result;
}
function text(input: unknown, path: string, budget: Budget, maximum: number = limits.maxTextLength): string {
  if (typeof input !== "string") fail(path, "expected a string");
  if (input.length > maximum) fail(path, "text length limit exceeded");
  if (UNSAFE_TEXT.test(input)) fail(path, "control or bidi formatting characters are forbidden");
  budget.textBytes += byteLength(input);
  if (budget.textBytes > limits.maxTotalTextBytes) fail(path, "total text byte limit exceeded");
  return input;
}
function number(input: unknown, path: string): number {
  if (typeof input !== "number" || !Number.isFinite(input) || Math.abs(input) > limits.maxAbsNumber) fail(path, "expected a bounded finite number");
  return input;
}
function optionalText(data: DataObject, key: string, path: string, budget: Budget, maximum: number = limits.maxTextLength): string | undefined {
  return Object.hasOwn(data, key) ? text(data[key], path + "." + key, budget, maximum) : undefined;
}
function items(input: unknown, path: string, budget: Budget): unknown[] {
  const result = array(input, path, limits.maxItems);
  budget.items += result.length;
  if (budget.items > limits.maxTotalItems) fail(path, "total item limit exceeded");
  return result;
}
function block(input: unknown, path: string, budget: Budget): Block {
  // Validate the discriminant without reading a getter or traversing target content.
  const type = input !== null && typeof input === "object" ? Object.getOwnPropertyDescriptor(input, "type") : undefined;
  if (!type || !("value" in type) || typeof type.value !== "string") fail(path + ".type", "required block type");
  switch (type.value as string) {
    case "text": {
      const data = object(input, path, ["type", "text"]);
      return { type: "text", text: text(data.text, path + ".text", budget) };
    }
    case "callout": {
      const data = object(input, path, ["type", "tone", "text"], ["title"]);
      if (typeof data.tone !== "string" || !CANVAS_REPORT_TONES.some(tone => tone === data.tone)) fail(path + ".tone", "unknown callout tone");
      const title = optionalText(data, "title", path, budget, limits.maxTitleLength);
      return { type: "callout", tone: data.tone as CalloutTone, text: text(data.text, path + ".text", budget), ...(title === undefined ? {} : { title }) };
    }
    case "metrics": {
      const data = object(input, path, ["type", "items"]);
      return { type: "metrics", items: items(data.items, path + ".items", budget).map((item, i) => {
        const p = path + ".items[" + i + "]";
        const entry = object(item, p, ["label", "value"], ["detail"]);
        const detail = optionalText(entry, "detail", p, budget);
        return { label: text(entry.label, p + ".label", budget, limits.maxLabelLength), value: typeof entry.value === "number" ? number(entry.value, p + ".value") : text(entry.value, p + ".value", budget), ...(detail === undefined ? {} : { detail }) };
      }) };
    }
    case "table": {
      const data = object(input, path, ["type", "columns", "rows"]);
      const columns = array(data.columns, path + ".columns", limits.maxTableColumns).map((value, i) => text(value, path + ".columns[" + i + "]", budget, limits.maxLabelLength));
      if (columns.length === 0) fail(path + ".columns", "at least one column required");
      const rawRows = array(data.rows, path + ".rows", limits.maxTableRows);
      const cells = columns.length * rawRows.length;
      budget.tableCells += cells;
      if (cells > limits.maxTableCells || budget.tableCells > limits.maxTotalTableCells) fail(path + ".rows", "table cell limit exceeded");
      const rows = rawRows.map((row, r) => {
        const p = path + ".rows[" + r + "]";
        const values = array(row, p, limits.maxTableColumns);
        if (values.length !== columns.length) fail(p, "row width must equal column count");
        return values.map((value, c): TableCell => {
          const cellPath = p + "[" + c + "]";
          if (value === null || typeof value === "boolean") return value;
          if (typeof value === "number") return number(value, cellPath);
          return text(value, cellPath, budget);
        });
      });
      return { type: "table", columns, rows };
    }
    case "list": {
      const data = object(input, path, ["type", "items"], ["ordered"]);
      if (Object.hasOwn(data, "ordered") && typeof data.ordered !== "boolean") fail(path + ".ordered", "expected a boolean");
      return { type: "list", items: items(data.items, path + ".items", budget).map((value, i) => text(value, path + ".items[" + i + "]", budget)), ...(Object.hasOwn(data, "ordered") ? { ordered: data.ordered as boolean } : {}) };
    }
    case "bar-chart": {
      const data = object(input, path, ["type", "items"]);
      return { type: "bar-chart", items: items(data.items, path + ".items", budget).map((item, i) => {
        const p = path + ".items[" + i + "]";
        const entry = object(item, p, ["label", "value"]);
        return { label: text(entry.label, p + ".label", budget, limits.maxLabelLength), value: number(entry.value, p + ".value") };
      }) };
    }
    case "unsupported": {
      const data = object(input, path, ["type", "label", "reason"]);
      return { type: "unsupported", label: text(data.label, path + ".label", budget, limits.maxLabelLength), reason: text(data.reason, path + ".reason", budget) };
    }
    default: return fail(path + ".type", "unknown block type");
  }
}

/** Validate unknown data and return an independent canonical copy. Does not coerce values. */
export function validateCanvasReport(input: unknown): CanvasReport {
  const data = object(input, "report", ["schemaVersion", "title", "sections"], ["summary"]);
  if (data.schemaVersion !== CANVAS_REPORT_SCHEMA_VERSION) fail("report.schemaVersion", "unsupported schema version");
  const budget: Budget = { textBytes: 0, blocks: 0, items: 0, tableCells: 0 };
  const title = text(data.title, "report.title", budget, limits.maxTitleLength);
  const summary = optionalText(data, "summary", "report", budget);
  const ids = new Set<string>();
  const sections = array(data.sections, "report.sections", limits.maxSections).map((section, i): CanvasReportSection => {
    const path = "report.sections[" + i + "]";
    const entry = object(section, path, ["id", "title", "blocks"]);
    const id = text(entry.id, path + ".id", budget, limits.maxIdLength);
    if (id.trim().length === 0) fail(path + ".id", "nonempty id required");
    if (ids.has(id)) fail(path + ".id", "duplicate section id");
    ids.add(id);
    const sectionTitle = text(entry.title, path + ".title", budget, limits.maxTitleLength);
    const rawBlocks = array(entry.blocks, path + ".blocks", limits.maxBlocks);
    budget.blocks += rawBlocks.length;
    if (budget.blocks > limits.maxBlocks) fail(path + ".blocks", "total block limit exceeded");
    return { id, title: sectionTitle, blocks: rawBlocks.map((value, n) => block(value, path + ".blocks[" + n + "]", budget)) };
  });
  const report: CanvasReport = { schemaVersion: CANVAS_REPORT_SCHEMA_VERSION, title, ...(summary === undefined ? {} : { summary }), sections };
  // Object callers have the same serialized byte ceiling as JSON callers. Only canonical data
  // reaches stringify: no getters, toJSON hooks, cycles or inherited properties can execute.
  if (byteLength(JSON.stringify(report)) > limits.maxSourceBytes) fail("report", "serialized source byte limit exceeded");
  return report;
}

/** Parse JSON only, with a UTF-8 byte ceiling checked before parsing. */
export function parseCanvasReport(source: string): CanvasReport {
  if (typeof source !== "string") fail("source", "expected JSON text");
  if (source.length > limits.maxSourceBytes || byteLength(source) > limits.maxSourceBytes) fail("source", "source byte limit exceeded");
  let input: unknown;
  try { input = JSON.parse(source) as unknown; }
  catch { return fail("source", "invalid JSON"); }
  return validateCanvasReport(input);
}

/** Generate only this fixed renderer; report strings never become JSX, HTML, props or URLs. */
export function reportToCanvasSource(report: CanvasReport): string {
  const data = JSON.stringify(validateCanvasReport(report))
    .replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
    // The legacy compileCanvas import/export scanner is textual, including inside strings.
    .replace(/export/g, "\\u0065xport");
  // Keep the real default export before the data literal: the legacy compiler locates the
  // first default-export spelling, which might also occur harmlessly inside a report string.
  return `import { Stack, Row, H1, H2, Text, Callout, Stat, Table, BarChart } from "dsh/canvas";
export default function CanvasReportView() {
  function renderBlock(block, index) {
    switch (block.type) {
      case "text": return <Text key={index}>{block.text}</Text>;
      case "callout": return <Callout key={index} tone={block.tone} title={block.title}><Text>{block.text}</Text></Callout>;
      case "metrics": return <Row key={index} gap={12} wrap>{block.items.map((item, n) => <Stack key={n} gap={4}><Stat label={item.label} value={item.value} />{item.detail !== undefined ? <Text tone="secondary">{item.detail}</Text> : null}</Stack>)}</Row>;
      case "table": return <Table key={index} headers={block.columns} rows={block.rows.map(row => row.map(cell => cell === null ? "" : String(cell)))} striped framed />;
      case "list": return <Stack key={index} gap={6}>{block.items.map((item, n) => <Text key={n}>{(block.ordered ? String(n + 1) + ". " : "• ") + item}</Text>)}</Stack>;
      case "bar-chart": return <BarChart key={index} data={block.items} categories={block.items.map(item => item.label)} beginAtZero={false} yMin={Math.min(0, ...block.items.map(item => item.value))} showValues />;
      case "unsupported": return <Callout key={index} tone="warning" title={block.label}><Text>{block.reason}</Text></Callout>;
      default: return null;
    }
  }
  return <Stack gap={20} style={{ whiteSpace: "pre-wrap" }}><H1>{report.title}</H1>{report.summary !== undefined ? <Text tone="secondary">{report.summary}</Text> : null}{report.sections.map(section => <Stack key={section.id} gap={12}><H2>{section.title}</H2>{section.blocks.map(renderBlock)}</Stack>)}</Stack>;
}
const report = ` + data + ";\n";
}
