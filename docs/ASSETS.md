# Asset policy

Canvas assets are a **Web TSX-only** local Host capability in 0.6.0, not a public CDN. The data owner is the dsh Web Host; the browser uploads managed images and requests gallery thumbnails, while TSX compilation inlines supported images for the sandbox. Version-1 `.canvas.json` has no image/URL block: `asset://name.webp` in JSON is literal text, never an asset request or an image. The native TUI does not upload, render or execute image content.

## Data flow

```text
browser file picker
  → resize + WebP compression in the client
  → POST /api/canvas/assets
  → ~/.dsh/canvas-assets/<single-file-name>
  → GET /api/canvas/assets/raw?name=...
  → lazy gallery thumbnail

Web .canvas.tsx source: <img src="asset://name.webp" />
  → Host path/signature/size checks
  → compile-time data URI materialization
  → sandbox iframe (no network)
```

Only recognized quoted `asset://...` literals are materialized; computed names/URLs are not a dynamic resolver contract. Use a direct `<img src="asset://name.webp" />` in trusted TSX, not a remote URL or inline base64. Gallery cards may lazily show the first recognized asset, but do not execute the report or capture a whole-report pixel thumbnail.

Gallery uploads resize the longest edge to at most 1600 px and encode WebP at quality 0.82 before sending to the local Host. Files can also be placed in the managed directory directly; the same Host read validation still applies. The Host accepts PNG, JPEG, GIF, WebP, and AVIF files up to 2 MB. Names are one file name only; URL-decoded separators, NUL bytes, unsupported extensions, traversal, escaping symlinks, and mismatched file signatures are rejected. Uploads use a random exclusive temporary file and an atomic rename.

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
