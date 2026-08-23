---
name: canvas-analysis-report
description: >-
  Produces concise .canvas.tsx investigation/design reports for dsh-canvas-viewer:
  verdict first, evidence tables, tabs, view_canvas. Use for analysis, optimization,
  architecture, 调查报告, 设计思路, 优化方向, 架构评审. Skip for code fixes, PRs, short answers.
---

# Canvas analysis report (dsh-native)

## Flow

1. Establish evidence, then write `~/.dsh/canvases/<kebab>.canvas.tsx`.
2. Import only from `"dsh/canvas"`; new files never use Cursor paths.
3. Default to **≤80 lines, ≤16KB, and roughly ≤4k source tokens**; 120 is a hard ceiling, not a target. Avoid inline base64/data-URI assets: they bypass line budgets and inflate both model context and browser payloads.
4. Call **`view_canvas`** with the absolute path; chat gives a 2–4 sentence verdict and link, never duplicates the report.

## Page skeleton

```
Stack(gap=24)
  Pill + tertiary source line
  H1 = sentence verdict
  Callout (the misread)
  Grid of 2–4 countable Stats
  Pill tabs only when views change the decision
  Tab bodies: H2 + Table / named Cards / one DAG ≤8
  Footer caption: source + limits
```

## Genre A — investigation / audit / optimization

Tabs: 总览 · 质量 · 体验 · 建议顺序.

Required: one misread `Callout`; P0 `Card`s with file names; one evidence `Table`; roadmap via `TodoListCard` or priority table.

## Genre B — design / architecture

Tabs: 边界 · 架构 · 生命周期 · 契约.

Required: explicit 做/不做 Cards; constraint Stats; `computeDAGLayout` + SVG (≤8 nodes); one lifecycle table.

## Rules

- Only exports in [sdk.md](sdk.md) are safe; unknown Cursor-only exports break preview.
- H1 is a sentence. One section answers one decision; tabs are user-felt axes, not folders.
- Prefer Stat/Table/DAG to prose. Each normal text block ≤35 words; never restate a title, stat, or table in prose.
- Color is sparse; no fake charts, invented metrics, gradients, or emoji chrome.
- Match the user's language.
- **Token budget: aim ≤80 lines, ≤16KB, roughly ≤4k source tokens.** Prefer tables/Stats/DAG, delete empty tabs and repeated explanations. Treat `view_canvas`'s estimated token count as a diagnostic signal, not exact billing.
- Chat leads with the answer and links the canvas; never ship only chat or only canvas.
- If `view_canvas` is missing, still write the file and say the plugin is not mounted.
