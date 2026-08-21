## DeepSeek Harness plugin development

Before changing plugin code, read https://dsh.pub/develop-plugin.md completely. Follow the pinned runtime contract and verification boundaries there; this repository's own security, testing, and release rules remain authoritative.

This repo is a **Host + Web UI bundle** plus a **dsh-native** filesystem skill.

| Piece | Path | Role |
|---|---|---|
| Host | `lib/index.js` | Compile `.canvas.tsx`, `/api/canvas/*`, `view_canvas`, short systemPrompt |
| Client | `lib/client.js` | Floating window + `settings.plugins.tab` + `web-ui.plugin.item` |
| Skill | `skills/canvas-analysis-report/` | Self-contained method + SDK subset (`sdk.md`) |
| Install | `~/.dsh/plugins/dsh-canvas-viewer` · `~/.dsh/skills/...` | Real copies via `scripts/sync-install.sh` |

**Inspected slots:** `settings.plugins.tab`, `web-ui.plugin.item`.

Do not ship Cursor's `cursor/canvas` runtime — only the viewer subset. Keep skill docs in sync with `createSdk()` exports in `lib/client.js`.
