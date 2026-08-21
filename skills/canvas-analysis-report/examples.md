# Worked patterns

Methods, not files to copy. Numbers and names must come from the current repo. Runtime = **dsh-canvas-viewer** subset ([sdk.md](sdk.md)).

## Investigation — optimization review

**User ask:** 分析本项目，给出优化方向和使用体验优化方向.

**Research that made the page true:** file-level evidence (not vibes).

**Page choices:**

| Slot | Choice | Why |
|---|---|---|
| H1 | 「下一阶段不要再堆功能」 | Topic titles waste the strongest line |
| Callout | 功能清单完成 ≠ 体验完成 | Stops treating TASKS.md as done |
| Stats | countable facts only | Viewer has no chart components |
| Tabs | 总览 / 质量 / 延迟 / 体验 / 建议顺序 | Axes the user feels |
| P0 card | `CardHeader title="file.ts · P0"` | Named file |
| Roadmap | `TodoListCard` + priority table | Order > wish list |

**After Write:** `view_canvas({ path })` then a short chat briefing with an absolute-path link.

**Bad version:** tab per folder; fake bar charts; Cursor-only props (`rowTone`, `trailing`).

## Design — architecture brief

| Slot | Choice |
|---|---|
| H1 | Product boundary sentence |
| 做/不做 | two `Card`s |
| DAG | `computeDAGLayout` + SVG, ≤8 nodes |
| Stats | constraints, not vanity KPIs |

## Genre picker

| Ask smells like | Genre |
|---|---|
| 优化、问题、审计、为什么慢、体验差、下一步 | Investigation |
| 怎么做、架构、要不要做 X、API | Design |
| 修这个 bug / 开 PR | Neither — no canvas |

## Split of labor that failed

| Wrong | What happens |
|---|---|
| Chat is the full report | User reads twice |
| Canvas first, research later | Empty / fake stats |
| Depend on Cursor canvas skill | Breaks on dsh-only installs |
| Skip `view_canvas` | File exists but nothing opens in Web UI |
