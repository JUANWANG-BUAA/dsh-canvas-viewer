# dsh-canvas-viewer

[![CI](https://github.com/JUANWANG-BUAA/dsh-canvas-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/JUANWANG-BUAA/dsh-canvas-viewer/actions) [![Release](https://img.shields.io/github/v/release/JUANWANG-BUAA/dsh-canvas-viewer?display_name=tag)](https://github.com/JUANWANG-BUAA/dsh-canvas-viewer/releases) [![License](https://img.shields.io/badge/license-MIT-2f6fe5.svg)](LICENSE)

[中文](README.md) · [Documentation](docs/README.md) · [Changelog](CHANGELOG.md)

Turn investigations, architecture reviews and design conclusions into reports inside DeepSeek Harness: **native read-only TUI + Web report workspace**, sharing local source files. This is neither a chat-image protocol nor the full Cursor Canvas runtime.

![Web report workspace illustration](docs/assets/hero.svg)

## 0.6.0 at a glance

Upgrading from 0.4.15 brings:

- **Cross-reader data reports**: versioned `.canvas.json` with sections, text, callouts, metrics, tables, lists and bars. Neither reader executes report-supplied code for this format.
- **Native terminal reader**: `/canvas` library, section navigation, cross-section find, responsive tables, scrolling and refresh. TSX shows an explicit Web-only notice, never execution or automatic conversion.
- **Web workspace**: heading navigation/body find, page-session reading positions, full-source search and workspace pagination; revision conflicts, browser drafts and visible-content print/PDF.
- **Engineering contracts**: shared bounded repository and strict schema; client source fragments build the same external factory, with committed runtime artifacts ready for Git installation.

| Format / capability | Native TUI | Web |
| --- | --- | --- |
| `.canvas.json` (`schemaVersion: 1`) | Validated, rendered with host terminal components; read-only | Validated, converted to a fixed SDK template, read in an iframe; source editor still edits JSON |
| `.canvas.tsx` | Legacy / not-executed notice only | Compiles and executes trusted reports; SDK subset and controlled local images |
| Editing, drafts, printing | Not supported | Source editing, conflict review, drafts, visible-content print preview |
| HTML / SVG / images / hooks | No execution or arbitrary rich content | TSX follows SDK/sandbox contracts, not an unrestricted browser environment |

JSON rejects unknown versions, keys, block types and control sequences. HTML, URLs and `asset://` in text remain literal: no link interpretation or image loading. [Data contract](skills/canvas-analysis-report/report-data.md) · [Schema source](src/report/schema.mts) · [Complete example](fixtures/dual-reader.canvas.json)

### Actual native terminal captures

| Wide 100×28 | Narrow 40×24 |
| --- | --- |
| ![Native TUI wide report](docs/assets/tui-wide.png) | ![Native TUI narrow table](docs/assets/tui-narrow.png) |

Captured through the actual host renderer → real PTY → xterm.js 6 → Edge, not an HTML reimplementation. These are not evidence of full CLI/profile boot. [Keys and verification boundaries](docs/TUI.md)

## Install and activate

Requires an installed DSH and the appropriate Web/TUI profile. The package declares Node.js ≥20; CI uses Node.js 22/24. Install the **Git bundle**; this does not depend on publication of a same-named npm package.

Replace the placeholder with a reviewed full 40-character commit SHA:

```sh
dsh plugin --profile web add "github:JUANWANG-BUAA/dsh-canvas-viewer#<40-character-commit-sha>"
dsh --profile web --dump-config
dsh web
```

A release tag is a convenient alternative, e.g. `github:JUANWANG-BUAA/dsh-canvas-viewer#v0.6.0`; reproducible deployments should still pin its resolved full commit. Restart the target profile after bundle installation/removal. Use the one-time launch URL printed by `dsh web` to establish its Cookie; never log, share or reuse its token.

### Native TUI

```sh
dsh plugin --profile dsh-tui add "github:JUANWANG-BUAA/dsh-canvas-viewer#<40-character-commit-sha>"
# Restart the target TUI profile, then use its input box:
# /canvas
# /canvas ~/.dsh/canvases/report.canvas.json
```

`dsh-tui` is an example profile name; use your actual configuration. `dsh-canvas-viewer/tui` is a subpath of the same package, **not a separate npm package**:

- `cordis.patch.yml` declares both the Web root and `./tui` rows, activated by their respective service dependencies.
- The pure-TUI `./tui` entry hard-depends only on `commands` and `tuiScenes`, not a Web server, compiler or browser. React/UI are injected by the host.
- The host Loader must admit `dsh-plugin.json`; `tuiPluginHost.registerCommand` then attributes the command to `canvas.viewer.open`. The manifest declares the command, Scene and scoped command permission. No private admission calls or deny bypasses. Scenes are in-process plugins, **not security sandboxes**.

Prefer cold startup. Late admission-loader catch-up, live permission revocation and future TUI versions are not compatibility guarantees. [TUI installation contract](docs/TUI.md)

### Install the authoring skill (optional)

The bundle and filesystem skill are separate layers. Copy `skills/canvas-analysis-report/` to `~/.dsh/skills/canvas-analysis-report/`, then refresh skills through your host. Bundle installation alone does not install the skill.

For local development, `dsh plugin --profile web add ./` uses the checkout (keep it in place). `bash scripts/sync-install.sh` copies the plugin and skill into `~/.dsh/` and refreshes the **web profile** through DSH commands; it is not a TUI installer. Process-scoped `DSH_GIT_URL_BASE` / `DSH_NPM_REGISTRY` overrides do not alter global Git configuration. If unrelated profile dependencies are unreachable, fix network/cache access rather than overwriting `node_modules`.

## Three entry points, different contracts

| Entry | Purpose | Not a promise of… |
| --- | --- | --- |
| TUI `/canvas [path]` | Opens the library or an existing data report; no path scans `~/.dsh/canvases/` | Authoring, session messages, or a second `view_canvas` tool |
| `canvas-analysis-report` skill (the host may expose `/canvas-analysis-report`) | Guides evidence gathering and authoring; JSON for both readers, TSX for rich Web interaction | A reader command; slash-skill presentation is host-owned |
| Web `view_canvas({path})` | Called after writing a file; successful validation produces a clickable conversation-tail report card | A chat-image/screenshot attachment protocol or report pixel output |

Chat images still use image tools or attachment protocols actually provided by the current host. Markdown images, screenshot attachments and Canvas cards are not interchangeable. Pure TUI should use only available tools, not require a nonexistent `view_canvas`.

Suggested flow: gather evidence → write `~/.dsh/canvases/<name>.canvas.json` → read with `/canvas`. Web can use the same JSON or trusted TSX followed by `view_canvas`. Keep chat to a 2–4 sentence verdict and put detailed evidence in the report. [Authoring skill](skills/canvas-analysis-report/SKILL.md) · [Web SDK subset](skills/canvas-analysis-report/sdk.md)

## Web workspace and safe editing

- **Read**: tabbed floating window, 70%–140% zoom, live host appearance and mobile fullscreen. Iframe-local headings/find; reading positions for up to 50 paths live only in current-page memory. Toggling source does not reload the reader.
- **Find**: literal full-source/title/path/workspace search, filtered before pagination, with totals and stale-response protection. Not semantic search or a persistent index.
- **Save**: Host owns source files. UI saves carry the original-byte revision; HTTP 409 retains the local draft and requires review. Plugin writes are serialized with atomic rename, not filesystem CAS against external editors. No automatic merge, history timeline or collaboration.
- **Drafts**: dirty close offers continue/keep/discard. Typing during saves survives older responses. Drafts use current-browser/origin localStorage: 10 entries, 1 MiB total, seven-day expiry. Not server backups or device sync. Avoid shared browsers for sensitive source; uninstall does not clear drafts—discard or clear site data separately.
- **Print/PDF**: allowlist-rebuilt, script-free preview of currently visible content, followed by explicit user print/save. Hidden tabs/collapsed content are omitted. Not a complete interactive snapshot or pixel-perfect export.

[Workspace save, draft and print contracts](docs/WORKSPACE.md)

## Local data and trust boundaries

| Data | Default location / policy |
| --- | --- |
| Report source | `~/.dsh/canvases/`; direct reads stay inside HOME, Web save/delete inside the managed report root |
| TSX image assets | `~/.dsh/canvas-assets/`; use `<img src="asset://diagram.webp" />`, not inline base64 source |
| Budget settings | `budget` in `~/.dsh/canvas-viewer/settings.json`; `soft` annotates, `hard` rejects over-budget `view_canvas` |

- **JSON is data; TSX is code.** JSON uses strict schema and a fixed template. Open only trusted TSX. Default opaque-origin iframe/CSP disables network and avoids `unsafe-eval`; loading/errors never automatically fall back to parent execution. Compatibility execution needs explicit report-revision-scoped approval, may use `new Function`, and weakens isolation.
- Host plugins have DSH process authority, not automatic protection from the Agent tool sandbox. TUI reads are read-only and reject symlinks/non-regular files. Scans, cache, previews and formatted output are bounded; `PARTIAL SCAN` discloses limits, and totals are not a complete disk inventory.
- Browser uploads scale to a 1600px longest edge and compress to WebP. Host validates signatures, single-level names and a 2MB maximum. Controlled images are inlined at compile time; gallery thumbnails lazy-load only the first referenced image, never execute reports. No default remote CDN, team library or permission sync.
- Authoring target: approximately ≤80 lines / ≤16KB / ≈4k source tokens. Estimates are diagnostics, not billing tokenization. JSON also has a 1.5MB read ceiling and structural budgets; see the [schema contract](skills/canvas-analysis-report/report-data.md).

[Sandbox](docs/SANDBOX.md) · [Assets](docs/ASSETS.md) · [Trade-offs](docs/COMPARISON.md)

## Compatibility and verification scope

| Baseline | Actual scope |
| --- | --- |
| CI: DSH `0.2.1-rc.2` | `dsh-smoke` pins `dsh-v0.2.1-rc.2` / `687f282e8625c6b8d11ff58211a90524be2e4317`; real Web profile, token/Cookie, combo factory and UI smoke. Consult the corresponding CI run for current changes |
| Locally installed DSH: `0.2.0-rc.2` | Existing real Web composition/client activation evidence; **not the CI 0.2.1 baseline** |
| Installed dsh-tui: `0.16.1` | Actual Cordis Loader + production admission-loader cold start, command/Scene lifecycle and reload; actual React terminal renderer and PTY → xterm → Edge visual verification |
| Browser visuals | 12 capture scenarios covering wide/narrow, dark/light, search, scroll, resize, legacy and invalid data; actual Web workspace browser interactions also exist, with some Host behavior simulated by fixtures |

TUI checks **do not establish full `dsh-tui` CLI/profile boot or user-profile installation acceptance**, nor every system terminal font. CI, local historical checks, fixtures and native renderer evidence remain distinct. [0.6.0 verification record](docs/VERIFICATION-0.6.0.md) · [CI configuration](.github/workflows/ci.yml)

## Development, diagnosis and uninstall

```sh
pnpm install --frozen-lockfile
pnpm build:host       # src/**/*.mts → lib/host and lib/report artifacts
pnpm build:client     # src/client/*.js.part → one lib/client.js factory
pnpm test            # package/types/artifacts, Host, workspace, schema, TUI, sandbox, lifecycle
pnpm test:browser    # browser + simulated Host
# Optional installed-host checks (environment requirements: docs/TUI.md):
pnpm test:tui-runtime
pnpm test:tui-browser
```

Editing only `lib/client.js` fails artifact synchronization checks. Fragments share factory scope: no second runtime loader and no claim of a full TypeScript migration. Git contains runtime artifacts; installation does not require a build.

The authenticated Web page loads the client through `__DSH_BOOT__` / `__ModuleLoader__` and immutable `plugins/??...` combos, not the prebuilt shell. Diagnose the boot graph, `#dsh-canvas-viewer-css` and `[data-dsh-canvas-viewer]`. Client content changes use stat-poll/SSE HMR; restart after plugin-set or Host changes. [Client architecture](docs/CLIENT-ARCHITECTURE.md)

Disable/uninstall the bundle with `dsh plugin --profile web remove dsh-canvas-viewer` (substitute the TUI profile as needed), then restart. Remove the filesystem skill separately. Reports, assets and browser drafts are not automatically deleted; back up before cleanup.

## License

[MIT](LICENSE) · [Third-party notices](THIRD-PARTY-NOTICES.md)
