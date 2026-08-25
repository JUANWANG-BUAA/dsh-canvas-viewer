# Client architecture

`lib/client.js` is intentionally the one dsh external factory entrypoint. The
runtime fetches this file after the boot graph resolves the plugin; browser ESM
imports from sibling files are not part of the pinned contract.

The file therefore has explicit source seams, checked by `scripts/client-contract.mjs`:

1. `styles` — static CSS tokens and gallery/window chrome.
2. `theme-and-dom` — owned DOM, host-synchronized appearance, and helpers.
3. `canvas-sdk` — the `dsh/canvas` SDK subset extracted by the Host.
4. `sandbox` — iframe CSP, Blob module loading, and MessageChannel bridge.
5. `viewer-shell` — tabs, source editor, drag/maximize, and compatibility fallback.
6. `conversation-tail` — successful `view_canvas` chat bubble.
7. `gallery` — settings list, upload, and lazy asset thumbnails.
8. `cordis-entrypoint` — reversible slot/effect registration.

## Visual composition contract

The viewer intentionally separates chrome from content. The host window is a
clean, high-opacity composited surface with edge highlights but no full-window
blur or displacement filter. The sandbox is one opaque `#171b21` / `#f6f7f9`
pixel plane, so wallpaper detail never contaminates report text, charts, or
screenshots. Zoom changes the isolated iframe scale from 70% to 140% without
recompiling or reloading the report.

Canvas appearance begins from the dsh host theme on every page load and tracks
host appearance changes. A viewer-local toggle is immediate but deliberately
not persisted across reloads; this prevents a stale light Canvas library from
being embedded in a dark settings dialog (or the inverse).

This is a build-safe intermediate step: future extraction can move each seam to
source fragments and concatenate them into the same `client.js` artifact. A
second runtime loader or direct browser import would violate dsh's external
factory loading contract.

## Host source/artifact boundary

The security-sensitive asset policy follows the same discipline in reverse:
[`src/host/assets.mts`](../src/host/assets.mts) is the typed source of truth,
while [`lib/host/assets.mjs`](../lib/host/assets.mjs) is the committed runtime
artifact loaded by dsh Git installs. `pnpm typecheck` checks the source and
`pnpm build:host` regenerates the artifact. Keeping the artifact in Git avoids
running an install-time build script in a user's profile.
