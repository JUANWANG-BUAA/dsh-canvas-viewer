# Worked patterns

These are *methods*, not files to copy. Numbers and names must come from the current repo.

## Investigation — optimization review

**User ask:** 分析本项目，给出优化方向和使用体验优化方向.

**Research that made the page true:**

- TASKS.md all checked vs `codebase-context.ts` still scoring by path and ignoring `currentText`
- `findFiles("**/*", max 500)` vs unused `CODE_GLOBS`
- `feedback.ts` never increments `shown`
- `readFimConfig` ignores `defaultApiBaseForProvider`
- debounce 180ms plus autoRetrigger 320ms

**Page choices:**

| Slot | Choice | Why |
|---|---|---|
| H1 | 「下一阶段不要再堆功能」 | Topic titles waste the strongest line |
| Callout | 功能清单完成 ≠ 体验完成 | Stops the reader from treating TASKS.md as done |
| Stats | 30+ settings, path scoring, shown=0, 0 keybindings | Each is a countable or named fact |
| Tabs | 总览 / 质量 / 延迟 / 体验 / 建议顺序 | Axes the user feels, not package names |
| P0 card | `codebase-context.ts` | Named file, not “retrieval is weak” |
| Roadmap | TodoListCard + P0/P1/P2 table | Order matters more than a wish list |
| Don’t-do | 不要加聊天 / Agent | Scope lock |

**Chat:** verdict first, then engineering vs UX, then a 5-step order. Tables stay on the canvas. Offer to implement P0.

**Bad version of the same ask:** a tab per folder, a “strengths / weaknesses” card wall, a bar chart of made-up impact scores.

## Design — architecture brief

**User ask:** 只做 Tab 补全，画出设计和架构.

**Research:** official FIM contract, editor inline-completion limits, what Continue would pull in.

**Page choices:**

| Slot | Choice | Why |
|---|---|---|
| H1 | 「只做 Tab 补全」 | Boundary is the product |
| Stats | prefix+suffix, flash, 4K, 非思考 | Constraints, not KPIs |
| Tabs | 产品边界 / 架构 / 生命周期 / 工具链 | Decision surfaces |
| 做/不做 cards | two-column contrast | Design docs fail without non-goals |
| DAG | editor → core → API, ≤5 nodes | More nodes become decoration |
| Strip SVG | prefix / hole / suffix | The mental model is spatial |
| Callout | 不要用 Continue 当底座 | Names a tempting wrong path |

**Chat:** the bet in one paragraph, then the first slice to implement.

## Split of labor that failed (do not repeat)

| Wrong | What happens |
|---|---|
| Chat contains the full markdown report, canvas is a restatement | User reads twice, neither is good |
| Canvas first, research later | Empty states, fake stats, skill violation |
| Tabs = `src/`, `tests/`, `docs/` | Reader cannot act |
| Every finding in its own Card | Wall of identical cards (slop) |
| Implementing while reporting | Mixes “what we learned” with a half-finished diff |

## Genre picker

| Ask smells like | Genre |
|---|---|
| 优化、问题、审计、为什么慢、体验差、下一步做什么 | Investigation |
| 怎么做、架构、要不要做 X、API 怎么接、边界 | Design |
| 两者都有（「分析并给出设计」） | Investigation overview + one design tab, or two canvases if they truly split |
| 修这个 bug / 开 PR | Neither — no canvas |
