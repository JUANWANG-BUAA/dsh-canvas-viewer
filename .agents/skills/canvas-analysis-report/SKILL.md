---
name: canvas-analysis-report
description: >-
  Produces standalone Cursor Canvas investigation reports and design briefs:
  research first, verdict-first layout, evidence tables, tabbed sections, and a
  chat summary that links the canvas. Use when the user asks for a project
  analysis, optimization review, architecture review, design doc, investigation
  report, 调查报告, 设计思路, 优化方向, 架构评审, or any structured findings that should be
  a visual artifact rather than a markdown wall. Skip for code fixes, PRs,
  short answers, and work that belongs in another tool.
---

# Canvas analysis report

Turn research into two artifacts: a **scannable Canvas** (the report) and a **stand-alone chat summary** (the briefing). This skill is the *content method*. Mechanical Canvas rules live in the built-in canvas skill — read that first and obey it.

## Prerequisite

1. Read `~/.cursor/skills-cursor/canvas/SKILL.md` (path, imports, slop, self-check, how to introduce the file).
2. Read `~/.cursor/skills-cursor/canvas/sdk/index.d.ts` before using a component you have not used this session. Guessing exports is the usual compile error.
3. Then come back here for *what to put on the page*.

If the canvas skill says **do not** use a canvas, stop. Do not override it.

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
| **Canvas** | Scannable artifact. Verdict, stats, tabs, evidence tables. A reader who never opens chat should still get the conclusion. |
| **Chat** | Briefing that stands alone. Lead with the answer. Link the canvas. Do not dump the tables again. |

Never put the whole report only in chat, and never ship a canvas with no chat briefing.

Canvas path (from the built-in skill): `/Users/<user>/.cursor/projects/<workspace>/canvases/<kebab-name>.canvas.tsx`. Write the file with the Write tool. Do not mkdir the canvases folder.

Filename: descriptive kebab-case, acronyms kept, rest lowercase. Examples: `ds-fim-optimization-review.canvas.tsx`, `auth-service-architecture.canvas.tsx`.

## Research before pixels

Do not design the page until the facts exist. Typical pass:

1. **Scope** — README, package manifests, task lists, changelog. What the thing claims to be.
2. **Shape** — first-party source only (ignore `node_modules`). Entry points, packages, main types.
3. **Hot paths** — the user-facing pipeline (request, click, completion, deploy).
4. **Claims vs code** — if a doc or TASKS file says “done”, open the file and check.
5. **Stop** — enough evidence for a verdict. Do not canvas from vibes.

Cite **file names and concrete behaviors**, not impressions. Invented metrics, fake charts, and placeholder rows are forbidden (canvas skill: no empty states).

If a number is a count you computed (files, settings, tests), say so in a caption. If you did not measure latency/error-rate, do not draw a latency chart.

## Page anatomy

One canvas, one default-export component. Shared chrome, then tab bodies as functions.

```
Stack(gap=24)
  Header
    small Pill (genre) + tertiary source line
    H1 = the verdict, not the topic
    2–4 sentence framing
  Optional Callout (the tension / the one thing that would be misread)
  Grid of 3–4 Stats (only facts you can defend)
  Pill tab row (4–6 tabs, not 12)
  Tab body
  Footer caption: source + what this is not
```

**H1 is a sentence.** Bad: “Project Analysis”. Good: “ds-fim：下一阶段不要再堆功能”.

**Tabs are genres, not folders.** Each tab must answer a different question. Investigation example: 总览 | 质量 | 延迟 | 体验 | 建议顺序. Design example: 产品边界 | 架构 | 生命周期 | 工具链.

**Mix density.** Open `H2` + `Table` for catalogs. `Card` only for a *named* entity (a file, a P0 bug, a service). Two side-by-side cards max for a contrast (做 / 不做). Never a column of identical cards.

**Color is sparse.** `rowTone` / `Stat tone` / one `Callout`. Most of the page stays neutral.

Skeletons: [templates.md](templates.md). Worked patterns: [examples.md](examples.md).

## Genre A — Investigation / audit / optimization

Use when the user already has a system and wants “what’s wrong / what to do next”.

| Tab | Question it answers |
|---|---|
| Overview | What is true, what to keep, what the success bar is |
| Deep dives (2–3) | Split by *user-felt* axes (quality, latency, UX), not by package name |
| Roadmap | Ordered next actions, P0/P1/P2, effort |

Required pieces:

- One **Callout** that names the misread (e.g. “feature list done ≠ experience done”).
- **P0 cards** for bugs you can point at in code (`CardHeader` = filename, trailing `Pill` = P0).
- **Tables** with columns like 问题 / 现状 / 影响 / 改法. `rowTone`: danger=P0, warning=P1, info=P2.
- A **roadmap** (`TodoListCard` or a priority table). Include **don’t-do** so the next agent does not inflate scope.

Chat briefing: verdict → 3–6 findings with file evidence → recommended first move. Offer to implement P0 if appropriate.

## Genre B — Design / architecture

Use when the user is deciding what to build, or needs a shared picture of the system.

| Tab | Question it answers |
|---|---|
| Boundary | What it is, what it is not |
| Architecture | One core, few adapters. DAG + short prose |
| Lifecycle | One request / click / job, step by step |
| Contract or toolchain | API fields, stages, non-goals |

Required pieces:

- Explicit **做 / 不做** (two cards or a table). Design docs without non-goals sprawl.
- **Stats** that encode constraints (output cap, default model, input shape) — not vanity KPIs.
- Architecture as `computeDAGLayout` + SVG (`useHostTheme()` fills/strokes). Labels in a map keyed by node id. Keep node count ≤ 8.
- One **lifecycle table** or strip: trigger → work → result → failure.

Chat briefing: the bet (one paragraph) → the shape → the first implementation slice.

## Evidence and tone

- Every non-obvious claim should be traceable to a file, setting, or observed behavior.
- Prefer “`relatedFiles` takes `currentText` and ignores it” over “retrieval is weak”.
- Priority: user-visible breakage first, then quality, then surface chrome, then CI/tests.
- Keep the product boundary. Optimization reports should say what **not** to add.

## Chat contract

When you mention the canvas, markdown-link the **full absolute path** with a short label (canvas skill).

- First canvas in that workspace’s `canvases/` folder: one sentence on what a canvas is.
- User did not ask for a canvas: one sentence on why the artifact is better than a markdown wall.
- Later mentions: still link; skip the intro.

Chat leads with the answer. It does not open with “I analyzed the repo”. It does not paste the tables.

## Anti-patterns

- Canvas that restates README with nicer headings
- Tabs named after directories (`packages/core`, `packages/vscode`)
- Stats that are adjectives (“good”, “needs work”) instead of facts
- Fake quantitative charts
- Rainbow `rowTone` on every row
- H1 inside `CardHeader`
- Implementing fixes in the same turn unless the user asked

## After writing

Run the canvas skill’s pre-delivery self-check. If the Write tool reports `Canvas TypeScript check` errors, fix them before talking to the user.

## When the host is dsh (DeepSeek Harness)

dsh can load this skill (global store: `~/.dsh/skills`). It **cannot** compile `cursor/canvas`. Do not treat `.canvas.tsx` as the thing the Web UI will show.

**Detect dsh:** a `skill` tool exists, or there is no Cursor canvas type-check on writes.

**dsh primary artifact:** a `ReportDocument` object (see [templates.md](templates.md) “ReportDocument”). Publish it by calling `publish_report` if that tool exists; otherwise write `reports/<kebab-name>.json` **and** put the same JSON in the assistant message inside a fenced `report` block so a Client node can parse it. Chat briefing stays short.

**Do not:** output `import from "cursor/canvas"` as the Web-visible UI. A file chip that opens source is not a browsable report.

**If Cursor’s canvases folder is also present:** you may additionally write `.canvas.tsx` for the IDE. That is a second renderer, not the dsh Web view.
