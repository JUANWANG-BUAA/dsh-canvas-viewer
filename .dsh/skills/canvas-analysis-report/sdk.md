# dsh-canvas-viewer SDK subset

Authoritative for agents writing `.canvas.tsx` files that `dsh-canvas-viewer` can render. Imports use `"cursor/canvas"`; the Host strips them and injects this runtime.

Aligned with Cursor canvas tokens (dark) and a practical subset of primitives — not the full IDE surface.

```ts
import {
  Stack, Row, Grid,
  H1, H2, H3, Text, Pill, Stat,
  Card, CardHeader, CardBody, Callout, Code, Divider, Spacer,
  Button, Link, Table, TodoList, TodoListCard,
  Swatch, UsageBar, BarChart, LineChart, PieChart, CollapsibleSection,
  mergeStyle,
  useHostTheme, useCanvasState, useCanvasAction,
  useState, useMemo, useEffect, useRef, useCallback, useId,
  computeDAGLayout, Fragment,
} from "cursor/canvas";
```

## Theme (`useHostTheme`)

Prefer tokens over hardcoded hex.

```ts
const theme = useHostTheme();
theme.kind                 // "dark"
theme.bg / theme.panel / theme.text / theme.textSecondary / theme.border / theme.accent
theme.text.primary|secondary|tertiary|quaternary|link
theme.bg.editor|chrome|elevated
theme.stroke.primary|secondary|tertiary|focused
theme.fill.primary|secondary|tertiary|quaternary
theme.category.blue|green|orange|red|purple|yellow|cyan|pink|gray
theme.palette              // ordered accent list for charts
```

## Layout

| Component | Key props |
|---|---|
| `Stack` | `gap`, `style` |
| `Row` | `gap`, `align` (`start`/`center`/`end`/`stretch`), `justify`, `wrap` |
| `Grid` | `columns` (number or CSS), `gap`, `align` |
| `Divider` | hairline |
| `Spacer` | flex spacer (`grow`) |
| `mergeStyle(base, override)` | shallow merge for small tweaks — no decorative gradients |

## Typography & chrome

- `H1` 24/30 · `H2` 18/24 · `H3` 16/22 · weight 590
- `Text` — `tone`: primary/secondary/tertiary/quaternary; `size`: body/small; `weight`; `italic`; `truncate`; `as`
- `Pill` — `active`/`selected`, `size`: sm, optional `tone`/`color`
- `Stat` — `value`, `label`, optional `tone`: success/danger/warning/info
- `Callout` — `tone`: info/warning/danger/success; optional `title`
- `Code` · `Button` (`variant`: ghost/primary/secondary) · `Link`

## Cards & lists

- `Card` / `CardHeader` (`title`, `trailing`) / `CardBody`
- `TodoList` / `TodoListCard` — `todos` with `content` + `status`

## `Table`

```tsx
<Table
  headers={["问题", "现状", "影响", "改法"]}
  rows={[["…", "…", "…", "…"]]}
  rowTone={["danger", "warning"]}
  striped
  columnAlign={["left", "left", "left", "left"]}
/>
```

Also: `framed` (default true), `stickyHeader`, `emptyMessage`, object rows + `columns`.

## Charts & meters

- `Swatch` — `color` category key or hex
- `UsageBar` — `segments: [{ label, value, color }]`
- `BarChart` / `LineChart` — `series` or `data`, optional `categories`/`height`/`width`
- `PieChart` — `data: [{ value, color?, label? }]`
- `CollapsibleSection` — `title`, `defaultOpen`, `trailing`

Use sparingly; invented metrics are still forbidden by the skill.

## DAG

```ts
const layout = computeDAGLayout({
  nodes: [{ id: "a" }, { id: "b" }],
  edges: [{ from: "a", to: "b" }],
  direction: "vertical",
});
// node: { id, x, y, width, height, rank, order }
// edge: { sourceX/Y, targetX/Y, points: [{x,y}…] }
```

Draw SVG with `theme.*` fills/strokes. Keep ≤ 8 nodes.

## File shape

```tsx
export default function MyReport() {
  return <Stack gap={24}>{/* … */}</Stack>;
}
```

One default-export function. Embed data inline.
