# Asset policy

Canvas assets are a local Host capability, not a public CDN. The data owner is the dsh Web Host; the browser client only requests a managed image for a gallery thumbnail, while the sandbox receives an inlined data URI during compilation.

## Data flow

```text
browser file picker
  → resize + WebP compression in the client
  → POST /api/canvas/assets
  → ~/.dsh/canvas-assets/<single-file-name>
  → GET /api/canvas/assets/raw?name=...
  → lazy gallery thumbnail

report source asset://name.webp
  → Host path/signature/size checks
  → compile-time data URI materialization
  → sandbox iframe (no network)
```

The Host accepts PNG, JPEG, GIF, WebP, and AVIF files up to 2 MB. Names are one file name only; URL-decoded separators, NUL bytes, unsupported extensions, traversal, escaping symlinks, and mismatched file signatures are rejected. Uploads use a random exclusive temporary file and an atomic rename.

The raw route returns `ETag`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer`, and a private revalidation cache policy. It never grants the iframe a network capability.

## Why no remote CDN by default

Keeping assets local preserves privacy, offline reproducibility, and one clear permission boundary. A future shared gallery should be a separately injected Host provider with explicit authorization, ownership, retention, and a typed remote-asset protocol. Do not replace `asset://` with arbitrary remote URLs: that would make report behavior dependent on third-party availability and weaken the sandbox contract.

## TypeScript migration

The policy is implemented in [`src/host/assets.mts`](../src/host/assets.mts) and emitted to [`lib/host/assets.mjs`](../lib/host/assets.mjs) with:

```sh
pnpm typecheck
pnpm build:host
```

The committed `.mjs` artifact is intentional: Git installs can load the plugin without executing a user-supplied build script. More Host modules can migrate to the same source/artifact pattern after their public contracts are typed.
