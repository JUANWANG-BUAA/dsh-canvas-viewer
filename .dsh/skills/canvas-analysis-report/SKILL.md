---
name: canvas-analysis-report
description: >-
  Produces concise .canvas.tsx investigation/design reports for dsh-canvas-viewer:
  verdict first, evidence tables, tabs, view_canvas. Use for analysis, optimization,
  architecture, 调查报告, 设计思路, 优化方向, 架构评审. Skip for code fixes, PRs, short answers.
---

# Canvas analysis report (dsh-native)

## Flow

1. Research until claims are evidence-backed.
2. Write `~/.dsh/canvases/<kebab>.canvas.tsx` (no Cursor paths).
3. Import **only** from `"dsh/canvas"` (subset below; `cursor/canvas` is legacy-compatible, never write new).
4. Call tool **`view_canvas`** with the absolute path.
5. Chat: 2–4 sentence verdict + markdown link; do not duplicate tables.

## Page skeleton

```
Stack(gap=24)
  Pill + tertiary source line
  H1 = sentence verdict
  Callout (the misread)
  Grid of 3–4 countable Stats
  Pill tabs (4–6)
  Tab bodies: H2 + Table / named Cards / one DAG ≤8
  Footer caption: source + limits
```

## Genre A — investigation / audit / optimization

Tabs: 总览 · 质量 · 延迟 · 体验 · 建议顺序.

Required: misread `Callout`; P0 `Card`s with file names; evidence `Table`s; roadmap via `TodoListCard` or priority table.

## Genre B — design / architecture

Tabs: 边界 · 架构 · 生命周期 · 契约.

Required: explicit 做/不做 Cards; constraint Stats; `computeDAGLayout` + SVG (≤8 nodes); one lifecycle table.

## Rules

- Only exports in [sdk.md](sdk.md) are safe; unknown Cursor-only exports break preview.
- H1 is a sentence. Tabs are user-felt axes, not folders.
- Color is sparse; no fake charts, invented metrics, gradients, or emoji chrome.
- Match the user's language.
- **Token budget: aim ≤120 lines.** Prefer tables/Stats over prose, delete empty tabs, no repeated explanations.
- Chat leads with the answer and links the canvas; never ship only chat or only canvas.
- If `view_canvas` is missing, still write the file and say the plugin is not mounted.
