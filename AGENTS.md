## DeepSeek Harness plugin development

Before changing plugin code, read https://dsh.pub/develop-plugin.md completely. Follow the pinned runtime contract and verification boundaries there; this repository's own security, testing, and release rules remain authoritative.

This repo is a **Host + Web UI bundle** plus a **dsh-native** filesystem skill.

| Piece | Path | Role |
|---|---|---|
| Host | `lib/index.js` | Compile `.canvas.tsx`, `/api/canvas/*`, `view_canvas`, short systemPrompt |
| Client | `lib/client.js` | Factory bundle (`window.__ModuleLoader__.load`, id = package name): floating window + native chat bubble + `settings.section` |
| Skill | `skills/canvas-analysis-report/` | Self-contained method + SDK subset (`sdk.md`) |
| Install | `~/.dsh/plugins/dsh-canvas-viewer` · `~/.dsh/skills/...` | Real copies via `scripts/sync-install.sh` |

**Registered slots:** `settings.section` (Canvas 图库), `conversation.chat.turnTail` (chat bubble). The client bundle requires only baseline runtime pieces (`react` / `react-dom/client` and Cordis slot services); no non-baseline `dsh.client.inject` edges are declared, so package.json omits the inject list.

**Verified DSH version:** DeepSeek Harness **0.1.2-rc.1** (`dsh-v0.1.2-rc.1`, commit `a66e4702047846cdaa10c66c9d3df3951f5ea70d`).

**Client loading contract (verified against the pinned harness):** plugin clients are NEVER bundled into the prebuilt shell (`/assets/index-*.js` — searching it for plugin markers proves nothing). In 0.1.2, `dsh web` prints a one-time `?token=` launch URL that establishes a `dsh-auth-*` HttpOnly browser cookie; never log or reuse that URL. The authenticated index exposes `window.__ModuleLoader__` and `globalThis["__DSH_BOOT__"]`; application factories, including this package, arrive through immutable `/plugins/??...` combo scripts rather than a stable per-package URL. Plugin-set changes (add/remove in the `web` profile) need a `dsh web` restart; `lib/client.js` content changes reach the browser automatically via the host's stat-poll + SSE HMR — no web rebuild, no `dev:web` needed for this external plugin. Diagnose activation in the browser (boot graph entry, combo script containing `dsh-canvas-viewer`, `#dsh-canvas-viewer-css` + `[data-dsh-canvas-viewer]` presence), not by grepping shell bundles.

Do not ship Cursor's `cursor/canvas` runtime — only the viewer subset. Keep skill docs in sync with `createSdk()` exports in `lib/client.js`.
