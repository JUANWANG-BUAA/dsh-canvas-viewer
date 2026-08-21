# dsh-canvas-viewer SDK subset

Authoritative for agents writing `.canvas.tsx` files that `dsh-canvas-viewer` can render. Imports use the module id `"cursor/canvas"`; the Host strips them and injects this runtime.

```ts
import {
  Stack, Row, Grid,
  H1, H2, H3, Text, Pill, Stat,
  Card, CardHeader, CardBody, Callout, Code, Divider, Spacer,
  Button, Link, Table, TodoListCard,
  useHostTheme, useCanvasState, useCanvasAction,
  useState, useMemo, useEffect, useRef, useCallback, useId,
  computeDAGLayout, Fragment,
} from "cursor/canvas";
```

## Layout

### `Stack` / `Row`

| Prop | Type | Default |
|---|---|---|
| `gap` | `number` | `10` |
| `align` | string (`Row`) | `"center"` |
| `wrap` | boolean (`Row`) | `true` |
| `style` | CSSProperties | |
| `children` | ReactNode | |

### `Grid`

| Prop | Type | Notes |
|---|---|---|
| `columns` | `number` \| `string` | number → `repeat(n, minmax(0,1fr))` |
| `gap` | `number` | |
| `style` | CSSProperties | |
| `children` | ReactNode | |

## Typography & chrome

- `H1` / `H2` / `H3` — `children`, optional `style`
- `Text` — `tone` | `variant`: `secondary` | `muted` | `tertiary`; `size`: `small`; `weight`: `semibold` | `bold`; `as`: `span` | `p`
- `Pill` — button; selected when `active` | `selected` | `current`; `onClick`
- `Stat` — `value`, `label` | `title`
- `Callout` — `tone` | `variant`: `info` | `warning` | `danger` | `success`; optional `title`
- `Code` — inline
- `Divider` — no props
- `Spacer` — `size` height or `grow`
- `Button` / `Link` — prefer rare use in reports (`href` | `to`)

## Cards & lists

- `Card` / `CardHeader` (`title` or children) / `CardBody`
- `TodoListCard` — `title`, `todos` | `items`: string or `{ id?, content|text|title, status? }`

## `Table`

Prefer:

```tsx
<Table
  headers={["问题", "现状", "影响", "改法"]}
  rows={[
    ["…", "…", "…", "…"],
  ]}
/>
```

Also accepts `columns` + object `rows`. **No `rowTone` support** — put priority in a column or a trailing `Pill`.

## Hooks & layout helpers

```ts
const theme = useHostTheme();
// { bg, panel, text, textSecondary, border, accent }

const layout = computeDAGLayout({
  nodes: [{ id: "a" }, { id: "b" }],
  edges: [{ from: "a", to: "b" }],
  direction: "vertical", // or "horizontal"
});
// layout.nodes[i] => { id, x, y, width, height }
// layout.edges[i] => { from, to, points: [{x,y}, ...] }
// layout.width, layout.height
```

Draw SVG yourself with `theme.*` fills/strokes. Keep ≤ 8 nodes.

`useCanvasState` ≈ `useState`. `useCanvasAction` is a no-op — do not depend on it.

## File shape

```tsx
export default function MyReport() {
  return <Stack gap={24}>{/* … */}</Stack>;
}
```

One default-export function. No other modules. Embed data inline.
