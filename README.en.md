# dsh-canvas-viewer

中文：[README.md](README.md)

Native DeepSeek Harness plugin for opening `.canvas.tsx` investigation and design reports in a floating viewer, a conversation tail bubble, and a settings gallery. It uses `dsh/canvas` and stores new reports under `~/.dsh/canvases/`; `cursor/canvas` is accepted only for legacy files.

## Features

- Successful `view_canvas` calls produce a compact chat bubble; failed or out-of-home calls do not.
- macOS-style floating window with tabs, source editing, atomic save, drag/maximize, focus restore, light/dark theme, and mobile full-screen layout.
- Default iframe sandbox (`allow-scripts`, opaque origin) with `connect-src 'none'`, no workers/forms/frames/objects, and private `MessageChannel` action bridging.
- Blob ES modules load the SDK and compiled report in the default sandbox path, so the default CSP does not need `unsafe-eval`. Main-thread `new Function` exists only behind an explicit compatibility action for degraded environments.
- Browser-side asset upload resizes images to a 1600px longest edge and compresses them to WebP before sending them to the local host. Assets are stored in `~/.dsh/canvas-assets/`, limited to 2MB each, and referenced as `asset://name.webp`.
- Structural gallery previews, budget telemetry, source-shape warnings, SSE hot reload, and cached gallery metadata keep token and IO costs predictable.

## Install from GitHub

Pin a trusted commit instead of a moving branch:

```sh
dsh plugin --profile web add github:JUANWANG-BUAA/dsh-canvas-viewer#<40-character-commit-sha>
```

`dsh plugin --profile web add` is the supported GitHub “dsh add” workflow: dsh forwards `add` to the managed profile's package manager, so the profile remains reproducible. Restart `dsh web` after changing the plugin set; client file edits are picked up by the host's stat-poll/SSE HMR.

For local development:

```sh
cd ~/code/agent_harness/dsh-canvas-viewer
pnpm install
pnpm test
bash scripts/sync-install.sh
```

## Asset references

Put PNG, JPEG, GIF, WebP, or AVIF files in `~/.dsh/canvas-assets/`, or use the gallery's **Upload image** control. In a report:

```tsx
export default function Report() {
  return <img src="asset://diagram.webp" alt="architecture" />;
}
```

The upload endpoint is local to the dsh web host (`POST /api/canvas/assets`); it is not a remote CDN and does not grant network access to the iframe. Asset paths are single file names and cannot traverse outside the managed directory.

## Trust and token model

Canvas files are executable code. Open only trusted `.canvas.tsx` files even though the default iframe is isolated. Keep reports concise (roughly 80 lines, 16KB, and 4k estimated tokens) and use the gallery/`view_canvas` telemetry as a soft signal, not as a billing tokenizer. Inline base64 is discouraged; use `asset://` references.

## Development and verification

```sh
pnpm test             # mirrors, syntax, host checks, lifecycle, regressions, sandbox e2e
pnpm test:browser     # Playwright smoke: chat tail + real sandbox iframe
pnpm audit --prod
npm pack --dry-run
```

The repository intentionally keeps `lib/client.js` as the dsh external factory entrypoint. UI extraction must preserve that runtime contract; source-level modularization is a follow-up build concern, not a reason to ship a second client loader. Pixel-perfect gallery thumbnails are opt-in future work because each thumbnail requires an isolated render and cache invalidation; the current gallery uses cheap structural signatures.

## License

MIT
