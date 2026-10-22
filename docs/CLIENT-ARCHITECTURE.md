# Client architecture (0.6.0)

The package has three deliberately separate runtime faces: the Web Host
(`lib/index.js`), the Web factory (`lib/client.js`), and the native TUI
entry (`lib/tui/index.mjs`, exported as `./tui`). Shared report schema and
filesystem policy live in `lib/report/`; the TUI must not import the Web root,
start its HTTP server, or bundle a second React runtime.

## Two report paths

| Input | Web | Native TUI |
|---|---|---|
| `.canvas.json` | Strict schema validation → fixed SDK template → viewer | Same schema → native read-only text/table/Unicode-bar reader |
| `.canvas.tsx` | Trusted executable report → compile → isolated iframe by default | Explicit legacy-format notice; no execution or automatic conversion |

The version-1 JSON schema is data-only: text/callout/metrics/table/list/bar-chart/
unsupported blocks, exact keys, bounded text/items/cells and finite numbers.
Strings never become HTML, URLs, JSX props or callbacks. Web may compile the
plugin-owned fixed renderer, but report data supplies no executable code. The
source editor continues to show and save JSON, not generated TSX. There are no
JSON image blocks; `asset://...` in JSON is literal text.

The TUI uses host-injected React/UI and a separate scene. `/canvas` is the alias
for command `canvas.viewer.open`, registered through
`tuiPluginHost.registerCommand(ctx, ...)`. Loader admission, manifest owner
`dsh-canvas-viewer` and scoped `commands.invoke` permission remain authoritative;
the adapter does not self-admit or bypass attribution with direct command
registration. Its scene/command/store dispose together. It does not register a
second `view_canvas` tool or offer arbitrary HTML, images, source editing or
report callbacks. Installation and runtime verification are distinct; see
[TUI.md](TUI.md) and [VERIFICATION-0.6.0.md](VERIFICATION-0.6.0.md).

## Web loading and source seams

`lib/client.js` is the one external classic factory entrypoint. The authenticated
DSH Web index exposes `globalThis["__DSH_BOOT__"]`; the runtime fetches immutable
`plugins/??...` combo scripts (document-relative since 0.2, root-absolute
`/plugins/??...` in 0.1.x). Sibling browser ESM imports and a stable
`/plugins/dsh-canvas-viewer/client.js` URL are not the pinned contract. Inspect
the boot graph, factory and mounted UI, not the prebuilt shell bundle.

Edit `src/client/*.js.part`, then run `pnpm build:client`. The deterministic
builder concatenates fixed-order fragments into the committed factory;
`pnpm test` includes synchronization checks. Fragments share factory scope;
this is neither a second runtime loader nor a full TypeScript migration.
The source seams checked by `scripts/client-contract.mjs` are:

1. `styles` — CSS and gallery/window chrome.
2. `theme-and-dom` — owned DOM and host appearance helpers.
3. `canvas-sdk` — Web `dsh/canvas` SDK extracted by the Host.
4. `sandbox` — CSP, Blob modules and private MessageChannel bridge.
5. `viewer-shell` — tabs, editor, reader, printing and explicit compatibility mode.
6. `conversation-tail` — successful Web `view_canvas` chat bubble.
7. `gallery` — managed library, upload and lazy asset thumbnails.
8. `cordis-entrypoint` — reversible slots/effects.

## State, persistence and gallery coverage

The Host owns files and acknowledged saves; client state is not durable success.
Each tab retains its draft and base SHA-256 revision. Hot reload updates the disk
preview without replacing a dirty editor. Close, tab-close and Escape use the
same dirty-close decision; save-pending blocks closure. Recovery drafts use
browser localStorage (up to 10 entries, 1 MiB serialized total, seven-day read
window), not a Host backup. Storage failures are surfaced. A save sends
`{path, source, baseRevision}`; HTTP 409 preserves the draft for comparison and
explicit resolution. See [SANDBOX.md](SANDBOX.md) for the non-CAS write boundary.

The shared safe repository scans only `~/.dsh/canvases/` recursively. Search is
case-insensitive literal matching of full source plus title/path/workspace,
before sorting and pagination—not just a title or first-line search. Metadata
caches are bounded to 256 entries / approximately 16 MiB; safely reading files
still precedes a cache hit. Each report is limited to 1,500,000 bytes.

A list scan has a 32 MiB cumulative source budget, maximum depth 32 and 20,000
visited entries. It returns `total`, `nextOffset`, `truncated` and
`scanComplete`. Pagination cannot complete an interrupted scan:
`scanComplete:false` means totals/workspaces are only those retained from that
scan. Even `true` is not a complete filesystem inventory: unreadable, oversized,
raced and disallowed entries, symlink directories, `.git` and `node_modules`
are excluded. The budget is checked after reading the current file; it is not a
hard OS I/O quota. Cards show source-derived structure; only Web TSX's first
recognized managed asset can supply a lazy pixel thumbnail. No report code is
executed to build gallery cards.

## Visual and print composition

Chrome is a high-opacity surface without full-window blur; content is an opaque
`#171b21` / `#f2f3f5` iframe plane. Zoom scales that plane from 70% to 140%
without recompilation. Appearance starts from and follows the Host; the local
toggle does not persist across reloads. Outline/find/scroll restore remain in
the report realm. Print/PDF uses a sanitized, script-free snapshot of currently
visible content, not the original executable app or hidden tabs.

## Typed source / committed artifacts

`src/host/assets.mts` and `src/report/schema.mts` are typed sources;
`lib/host/assets.mjs` and `lib/report/schema.mjs` are runtime artifacts.
`pnpm typecheck` checks source; `pnpm build:host` emits it. Committed artifacts
avoid install-time builds. These commands describe checks, not a claim that
this revision has passed them; release evidence belongs in the verification log.
