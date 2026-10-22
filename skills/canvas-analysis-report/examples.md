# Worked patterns

Numbers and names must come from current evidence; never claim tests or CI passed merely because scripts exist. Default to `.canvas.json` for native TUI + Web using [report-data.md](report-data.md). Use sections, metrics, callouts, tables and lists. The Card/Stat/tab/SVG patterns below are optional **trusted Web TSX** ([sdk.md](sdk.md)); they do not add capabilities to JSON or native TUI.

## Investigation / optimization

- H1 = sentence verdict, not “项目分析”.
- Callout = the most likely misread.
- Tabs = user-felt axes, not folders.
- P0 Card = named file + one-line fix.
- After writing either format: call `view_canvas` only if exposed; check the result, then give a short verdict and absolute-path link. If absent, still deliver the file and say the tool is not exposed—not that the Web plugin is unmounted. Native TUI readers open `/canvas` or `/canvas <path.canvas.json>`.

## Design / architecture

- H1 = product boundary sentence.
- 做/不做 = two Cards.
- JSON architecture = node/edge and lifecycle tables; an `unsupported` block can explain an omitted visual. Optional Web TSX DAG = `computeDAGLayout` + SVG, ≤8 nodes.
- Stats = constraints, not vanity KPIs.

## Genre picker

| Ask smells like | Genre |
|---|---|
| 优化、问题、审计、为什么慢、体验差 | Investigation |
| 怎么做、架构、要不要做 X | Design |
| 修 bug / 开 PR | No canvas |
