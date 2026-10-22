---
name: canvas-analysis-report
description: >-
  Produces concise investigation/design reports for dsh-canvas-viewer: data-only
  .canvas.json for TUI + Web, optional trusted Web .canvas.tsx; verdict first,
  evidence tables. Use for analysis, optimization, architecture, 调查报告,
  设计思路, 优化方向, 架构评审. Skip for code fixes, PRs, short answers.
---

# Canvas analysis report (dsh-native)

## Choose the reader format

- **Default: native TUI + Web** — `~/.dsh/canvases/<kebab>.canvas.json`, schemaVersion 1. See [report-data.md](report-data.md). Sections, text/callouts, metrics, tables, lists and bar charts; no report code, HTML, images, active URLs or callbacks. `asset://...` is literal text.
- **Optional trusted Web report** — `.canvas.tsx` for SDK interaction, custom SVG or managed images. See [sdk.md](sdk.md) and conditional [templates.md](templates.md). TUI shows a legacy notice, never executes it; do not promise automatic TSX/hooks/SVG conversion.
- Web `view_canvas` accepts either format; JSON is strictly validated and rendered by a fixed template. The Web editor still edits JSON, not generated TSX. TUI is a separate read-only reader, without arbitrary HTML/images/editing/callbacks or a duplicate model tool.

## Flow

1. Establish evidence and the audience; choose JSON unless Web-only custom rendering is necessary.
2. **JSON:** write `~/.dsh/canvases/<kebab>.canvas.json` using only [report-data.md](report-data.md). Use sections instead of interactive tabs, a boundary/edge table instead of SVG, and `unsupported` for a deliberate unrepresented feature. Do not embed imports, JSX or JavaScript.
3. **TSX only:** write `~/.dsh/canvases/<kebab>.canvas.tsx`, import only from `"dsh/canvas"`, default-export one component. Treat this as trusted executable code: default iframe isolation is defense in depth; explicit compatibility rendering executes in the host realm. Images use direct `<img src="asset://name.webp" />` literals backed by trusted PNG/JPEG/GIF/WebP/AVIF in `~/.dsh/canvas-assets/` or gallery upload. Avoid inline base64 and remote URLs.
4. Keep evidence dense: aim for ≤80 lines, ≤16 KB and roughly ≤4k source tokens, not empty brevity. These are authoring targets, not universal runtime ceilings; configured policy and JSON schema limits are separate. Never invent metrics or claim tests/CI passed without an actual result.
5. If `view_canvas` is exposed, call it with the absolute file path and check the result. Otherwise still write the file, give its path, and state **the tool is not exposed in this session**; that alone does not prove the Web plugin is unmounted. In native TUI tell the user to open `/canvas` or `/canvas <path.canvas.json>`. Only invoke tools actually available.
6. Chat gives a 2–4 sentence verdict, evidence/limits and a file link; do not duplicate the report. A file write alone is not verified rendering.

## Report skeleton

Verdict title → source/limits → likely misread callout → 2–4 defensible metrics → decision sections with evidence tables → prioritized actions. JSON uses fixed blocks; TSX can use Stack/Grid/Stat/Card/Pill and tabs only when the views change a decision.

### Investigation / audit / optimization

Sections: 总览 · 质量 · 体验 · 建议顺序. Include one misread, named files for high-priority issues, an evidence table and an ordered action list/priority table. TSX may use Cards/TodoListCard.

### Design / architecture

Sections: 边界 · 架构 · 生命周期 · 契约. Include 做/不做, measurable constraints and a lifecycle table. JSON expresses the architecture as nodes/edges tables; optional Web TSX may use `computeDAGLayout` + SVG (≤8 nodes).

## Rules

- H1/title is a sentence verdict. Each section answers a decision; no empty sections or repeated explanations.
- Prefer metrics/tables over prose; normal text blocks ≤35 words where practical. Do not repeat the title, metric or table in prose.
- Use sparse color; no invented charts, gradients or emoji chrome. Match the user's language.
- Only [sdk.md](sdk.md) exports belong to the **TSX** branch; unknown Cursor-only exports break preview. It is not a JSON props escape hatch.
- Estimated tokens are diagnostics, not exact billing. Gallery source-search totals can be partial when `scanComplete:false`; thumbnails are static structure/first TSX asset, not executed-report screenshots.
