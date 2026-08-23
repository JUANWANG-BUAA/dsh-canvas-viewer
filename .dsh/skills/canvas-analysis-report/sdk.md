# dsh-canvas-viewer SDK subset

Authoritative for agents writing `.canvas.tsx` files for `dsh-canvas-viewer`.
New files import from `"dsh/canvas"`; the Host accepts `cursor/canvas` only as a legacy shim.

```ts
import {
  Stack, Row, Grid, H1, H2, H3, Text, Pill, Stat,
  Card, CardHeader, CardBody, Callout, Code, Divider, Spacer,
  Button, Link, Table, TodoList, TodoListCard,
  Swatch, UsageBar, BarChart, LineChart, PieChart, CollapsibleSection,
  mergeStyle,
  useHostTheme, useCanvasState, useCanvasAction,
  useState, useMemo, useEffect, useRef, useCallback, useId,
  computeDAGLayout, Fragment,
} from "dsh/canvas";
```

## Theme

`useHostTheme()`: `kind`, `bg/panel/text/textSecondary/border/accent`, `text.*`, `bg.*`, `stroke.*`, `fill.*`, `category.*`, `palette`. Prefer tokens over hardcoded hex.

## Layout / type

- `Stack gap` · `Row gap/align/justify/wrap` · `Grid columns/gap/align` (columns auto-clamp on narrow windows)
- `H1` 24 · `H2` 18 · `H3` 16 · `Text` `tone|size|weight|italic|truncate|as`
- `Pill active/size/tone` · `Stat value/label/tone` · `Callout tone/title`
- `Code` · `Button variant` · `Link` · `Divider` · `Spacer` · `mergeStyle`

## Cards / lists / tables

- `Card`, `CardHeader(title,trailing,size,tone)`, `CardBody`
- `TodoList`, `TodoListCard` (`todos: {id,content,status}`)
- `Table` props: `headers`, `rows`, `rowTone`, `striped`, `framed`, `stickyHeader`, `columnAlign`, `emptyMessage`, `sortable`, object rows + `columns`; object cells `{href,label}` render links. `sortable` (opt-in) turns headers into click-to-sort toggles (asc → desc → off, numeric-aware compare, zh locale for text, `aria-sort` annotated).

## Charts (supported props)

- `BarChart` / `LineChart`: `series|data`, `categories`, `height`, `width`, `yMin`, `yMax`, `valueSuffix`, `beginAtZero`, `referenceLines: [{value,label}]`, `showValues`, `showLegend`, `style` — renders y-axis gridlines, ticks, value labels, legend (>1 series), reference lines. Hover tooltips are native: bars and line points carry `<title>` (label · series · value).
- `PieChart`: `data|segments` (`{label,value,color}`), `size`, `valueSuffix`, `style` — renders a legend with values + percentages; slices carry `<title>` hover tooltips (value + percent).
- `Swatch` · `UsageBar segments` · `CollapsibleSection title/defaultOpen/trailing`
- Unsupported props (e.g. `stacked`, `doughnut`, `encoding`) are ignored and flagged with a ▤ 降级 badge instead of failing silently.

## State & interaction

- `useCanvasState(key, initial)` — key-scoped state: scoped per canvas mount (two canvases using the same key never collide) and per key within one canvas. Returns `[value, setter]`; the setter accepts a value or updater function. No `key` behaves like `useState`.
- `useCanvasAction()` — returns `dispatch(action)` that fires a real `dsh:canvas:action` window event; the viewer surfaces it as a toast. Reports are read-only, so actions are informational, not file-opening.

## Capability negotiation

Host exposes `GET /api/canvas/capabilities` (machine-readable components/props/limits). `view_canvas` returns `lines`/`bytes`/estimated tokens. Target **≤80 lines, ≤16KB, ≈≤4k source tokens**; treat 120 as the ceiling. Prefer a compact table or Stat over repeated prose. Images should use `asset://name.webp` (gallery upload resizes to WebP), not inline base64. Reports remain executable and must be trusted, even though the default iframe module path does not require `unsafe-eval`.

## DAG

```ts
const layout = computeDAGLayout({ nodes:[{id}], edges:[{from,to}], direction:"vertical" });
// nodes: x,y,width,height,rank,order · edges: sourceX/Y,targetX/Y,points
```

Draw SVG with `theme.*`. Keep ≤8 nodes.

## File shape

One default-export function, data inline, imports from `"dsh/canvas"`.
