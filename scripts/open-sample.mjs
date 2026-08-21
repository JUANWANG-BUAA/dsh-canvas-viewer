#!/usr/bin/env node
const sample =
  process.argv[2]
  ?? "/Users/juanwang/.cursor/projects/Users-juanwang-code-project-frontend-ds-fim/canvases/dsh-canvas-bridge.canvas.tsx";
const base = process.env.DSH_WEB_URL ?? "http://127.0.0.1:3080";

const res = await fetch(`${base}/api/canvas/open`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ path: sample }),
});
const body = await res.json();
if (!res.ok || body.ok === false) {
  console.error(body);
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  seq: body.seq,
  path: body.path,
  title: body.title,
  error: body.error || "",
  sourceBytes: (body.source || "").length,
  compiledBytes: (body.compiled || "").length,
}, null, 2));
