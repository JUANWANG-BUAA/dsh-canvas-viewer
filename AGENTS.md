## DeepSeek Harness plugin development

Before changing plugin code, read https://dsh.pub/develop-plugin.md completely. Follow the pinned runtime contract and verification boundaries there; this repository's own security, testing, and release rules remain authoritative.

This repo is a **Host + Web UI + native TUI bundle** plus a **dsh-native** filesystem skill. Prefer versioned `.canvas.json` for both readers; legacy `.canvas.tsx` executes only through the Web path.

| Piece | Path | Role |
|---|---|---|
| Host | `lib/index.js` | Validate JSON / compile TSX, `/api/canvas/*`, Web `view_canvas`, short systemPrompt |
| Client | `lib/client.js` | Factory bundle (`window.__ModuleLoader__.load`, id = package name): floating window + native chat bubble + `settings.section` |
| TUI | `lib/tui/index.mjs`, `reader.mjs`, `store.mjs` | Separate `./tui` entrypoint, attributed `/canvas`, host-injected React/UI; no TSX execution |
| Report | `src/report/schema.mts`, `lib/report/` | Versioned data-only schema, fixed Web template and shared safe repository |
| Skill | `skills/canvas-analysis-report/` | Self-contained method + SDK subset (`sdk.md`) |
| Install | `~/.dsh/plugins/dsh-canvas-viewer` · `~/.dsh/skills/...` | Real copies via `scripts/sync-install.sh` |

**Registered slots:** `settings.section` (Canvas 图库), `conversation.chat.turnTail` (chat bubble). The client bundle requires only baseline runtime pieces: `react` / `react-dom/client`, the `slots` service, and the `uiConversation` service (0.2 renamed the 0.1.x `conversationEvents` registry to `uiConversation.events`; injecting the removed name leaves the plugin permanently `pending`). Both services ship with the core Web client bundles, so package.json omits the inject list.

**CI-pinned DSH version (historical successful CI baseline; inspect the current run for new changes):** DeepSeek Harness **0.2.1-rc.2** (`dsh-v0.2.1-rc.2`, commit `687f282e8625c6b8d11ff58211a90524be2e4317`), the release DeepSeek Harness Desktop 0.2.1 bundles; the CI `dsh-smoke` job pins that tag.

**TUI verification:** installed dsh-tui 0.16.1; actual Cordis loader cold-start admission, command/scene lifecycle, host React renderer, and real PTY → xterm.js → Edge visual checks. This is not full TUI CLI/profile boot or late-loader catch-up verification. Never import the Web root or a separate React into the TUI entry. See `docs/TUI.md` and `docs/VERIFICATION-0.6.0.md`.

**Client source/build:** edit `src/client/*.js.part`, then run `pnpm build:client`; never hand-edit only the generated `lib/client.js`. `pnpm test` checks exact byte-for-byte source/artifact synchronization. These are build-time fragments sharing factory scope, not a second runtime loader or a full TypeScript migration.

**Client loading contract (verified against the pinned harness):** plugin clients are NEVER bundled into the prebuilt shell (`/assets/index-*.js` — searching it for plugin markers proves nothing). Since 0.1.2, `dsh web` prints a one-time `?token=` launch URL that establishes a `dsh-auth-*` HttpOnly browser cookie; never log or reuse that URL. The authenticated index exposes `window.__ModuleLoader__` and `globalThis["__DSH_BOOT__"]`; application factories, including this package, arrive through immutable combo scripts rather than a stable per-package URL. Harness 0.2 emits those combo references as document-relative `plugins/??...` URLs, while 0.1.x used root-absolute `/plugins/??...`; a scanner must accept both spellings (`scripts/dsh-smoke.mjs`). Plugin-set changes (add/remove in the `web` profile) need a `dsh web` restart; `lib/client.js` content changes reach the browser automatically via the host's stat-poll + SSE HMR — no web rebuild, no `dev:web` needed for this external plugin. Diagnose activation in the browser (boot graph entry, combo script containing `dsh-canvas-viewer`, `#dsh-canvas-viewer-css` + `[data-dsh-canvas-viewer]` presence), not by grepping shell bundles.

Do not ship Cursor's `cursor/canvas` runtime — only the viewer subset. Keep skill docs in sync with `createSdk()` exports in `lib/client.js`.
