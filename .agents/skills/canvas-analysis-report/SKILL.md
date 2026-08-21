---
name: canvas-analysis-report
description: >-
  Produces standalone .canvas.tsx investigation reports and design briefs for
  DeepSeek Harness (dsh-canvas-viewer): research first, verdict-first layout,
  evidence tables, tabbed sections, then view_canvas. Use for project analysis,
  optimization review, architecture review, design doc, investigation report,
  调查报告, 设计思路, 优化方向, 架构评审, or structured findings that should be a
  visual artifact rather than a markdown wall. Skip for code fixes, PRs, short
  answers, and work that belongs in another tool.
---

# Canvas analysis report (dsh-native)

Turn research into two artifacts: a **scannable `.canvas.tsx`** and a **stand-alone chat summary**. This skill is **self-contained for DeepSeek Harness** with `dsh-canvas-viewer`. Do **not** read `~/.cursor/skills-cursor/canvas` or any Cursor-only canvas skill.

## Host contract

| Step | Action |
|---|---|
| 1 | Research until claims are evidence-backed |
| 2 | Write `~/.cursor/projects/<workspace-slug>/canvases/<kebab-name>.canvas.tsx` with the Write tool |
| 3 | Call tool **`view_canvas`** with that absolute `path` so the in-page viewer opens |
| 4 | Chat briefing: verdict first + markdown link to the absolute path |

If `view_canvas` is missing, say the plugin is not mounted; still write the file.

## Path rules

- Directory: `~/.cursor/projects/<workspace-slug>/canvases/`
  - `<workspace-slug>` mirrors the Cursor project folder name (often derived from the absolute workspace path with `/` → `-`). Prefer an existing `canvases/` under that tree if present.
  - If no Cursor projects folder exists, write under `~/.dsh/canvases/<kebab-name>.canvas.tsx` instead (create parents only when needed).
- Filename: descriptive kebab-case; keep acronyms; rest lowercase.
  - Examples: `ds-fim-optimization-review.canvas.tsx`, `auth-service-architecture.canvas.tsx`
- Extension must be `.canvas.tsx`. Path must stay inside `$HOME` (viewer enforces this).
- Do **not** invent a second report format (`ReportDocument` JSON, HTML canvas plugins, etc.) for this skill.

## Allowed SDK (must match dsh-canvas-viewer)

Import **only** from `"cursor/canvas"`. The string is a shim identity: dsh-canvas-viewer strips these imports and injects its subset runtime. **Unsupported exports will break the preview.** Full prop contract: [sdk.md](sdk.md).

### Components & hooks (allowed)

| Export | Role |
|---|---|
| `Stack` `Row` `Grid` `Divider` `Spacer` `mergeStyle` | Layout |
| `H1` `H2` `H3` `Text` `Pill` `Stat` `Code` | Type / chrome |
| `Card` `CardHeader` `CardBody` `Callout` | Surfaces (`CardHeader.trailing` supported) |
| `Table` | Evidence (`rowTone`, `striped`, `framed`, `stickyHeader`) |
| `TodoList` `TodoListCard` | Roadmaps |
| `Swatch` `UsageBar` `BarChart` `LineChart` `PieChart` | Sparse metrics (only measured facts) |
| `CollapsibleSection` | Progressive disclosure |
| `Button` `Link` | Rare actions |
| hooks + `computeDAGLayout` `Fragment` | Theme / state / DAG |

### Forbidden

- Unknown Cursor-only exports not listed above
- Gradients, decorative shadows, emoji chrome
- Fake charts / empty placeholder rows


## When to use

Apply for a **new standalone analytical artifact**:

- Project / codebase analysis, optimization directions
- Architecture or product-boundary design
- Security / quality / UX audits with categorized findings
- Investigation reports with evidence, timelines, or trade-off tables

Do **not** apply when the user wants a code change, a PR, a message to send, or a dashboard in another product.

Match the **user's language** for all canvas copy and the chat briefing.

## Dual output

| Surface | Job |
|---|---|
| **Canvas** | Scannable artifact. Verdict, stats, tabs, evidence tables. |
| **Chat** | Briefing that stands alone. Lead with the answer. Link the canvas. Do not dump the tables again. |

Never put the whole report only in chat, and never ship a canvas with no chat briefing.

## Research before pixels

1. **Scope** — README, package manifests, task lists, changelog.
2. **Shape** — first-party source only (ignore `node_modules`).
3. **Hot paths** — user-facing pipeline.
4. **Claims vs code** — verify “done” claims in source.
5. **Stop** — enough evidence for a verdict.

Cite file names and concrete behaviors. Invented metrics and empty states are forbidden. If a number is a count you computed, say so in a caption.

## Page anatomy

One canvas, one default-export component. Shared chrome, then tab bodies as functions.

```
Stack(gap=24)
  Header: small Pill + tertiary source line · H1 = verdict · 2–4 sentence framing
  Optional Callout (the misread)
  Grid of 3–4 Stats (defendable facts only)
  Pill tab row (4–6 tabs)
  Tab body
  Footer caption: source + what this is not
```

**H1 is a sentence.** Bad: “Project Analysis”. Good: “ds-fim：下一阶段不要再堆功能”.

**Tabs are genres, not folders.** Investigation: 总览 | 质量 | 延迟 | 体验 | 建议顺序. Design: 产品边界 | 架构 | 生命周期 | 工具链.

**Mix density.** `H2` + `Table` for catalogs. `Card` only for a *named* entity. Two side-by-side cards max for 做 / 不做.

**Color is sparse.** Prefer tokens from `useHostTheme()`. `Table` supports `rowTone` dots; do not rainbow every row.

## Genre A — Investigation / audit / optimization

| Tab | Question |
|---|---|
| Overview | What is true, what to keep, success bar |
| Deep dives (2–3) | User-felt axes (quality, latency, UX) |
| Roadmap | Ordered next actions, P0/P1/P2, don’t-do |

Required: misread `Callout`; P0 `Card`s with filenames; evidence `Table`s; roadmap via `TodoListCard` or priority table.

Chat: verdict → 3–6 findings with file evidence → first move.

## Genre B — Design / architecture

| Tab | Question |
|---|---|
| Boundary | What it is / is not |
| Architecture | One core, few adapters. DAG + short prose |
| Lifecycle | One request / click / job |
| Contract or toolchain | API fields, stages, non-goals |

Required: explicit 做 / 不做; constraint `Stat`s; `computeDAGLayout` + SVG (≤8 nodes) using `useHostTheme()`; one lifecycle table.

Chat: the bet → the shape → first implementation slice.

## Chat contract

- Markdown-link the **full absolute path**.
- First canvas in a workspace: one sentence on what the viewer shows.
- Chat leads with the answer — never “I analyzed the repo”.

## Anti-patterns

- Restating README with nicer headings
- Tabs named after directories
- Adjective Stats; fake charts
- H1 inside `CardHeader`
- Implementing fixes in the same turn unless asked
- Depending on Cursor IDE typecheck — dsh has none; self-check against [sdk.md](sdk.md)

## After writing

1. Confirm imports ⊆ allowed table above.
2. Confirm default export is a function component.
3. Call **`view_canvas`** with the absolute path.
4. Deliver the chat briefing with the link.
