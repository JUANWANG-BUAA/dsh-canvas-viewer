# 0.6.0 verification record

This record separates local tests, real runtime observations, remote CI and publication. Creating a GitHub release does not prove active-user installation, npm publication or untested platform support. The intermediate [0.5.0 record](VERIFICATION-0.5.0.md) is historical.

## Local release gates

- Strict host/report TypeScript build and typecheck; deterministic client build/check (10 fragments, 180667 bytes, below the 184320-byte cap); skill mirrors byte-identical.
- Full pnpm test in canonical disposable HOME: 13 shipped runtime syntax checks, packed-file contract, 17 isolation/reader/bridge behavioral cases, gallery/editor state suites, shared Web-host JSON/TSX revision/concurrency/HTTP409 checks, 12 strict schema tests including actual compiler/SDK rendering and malicious strings, repository FIFO/symlink/cache/scan bounds, native reader formatting/input/async lifecycle, 126 self-test assertions, two Cordis unload/reload cycles, mandatory repository SSR fixture, 58 sandbox VM checks.
- npm pack --dry-run and git diff --check; generated artifacts committed. The package includes schema/reader/store/repository/manifest/fixtures/source fragments and its offline test files; temporary runtime profiles and output captures are excluded.

## Actual runtime and UI authority

| Check | Evidence scope | Not implied |
|---|---|---|
| Web browser suite, Edge155 CDP | Actual iframe, JSON/TSX render, isolation probe, edit/drafts/conflicts/reader/theme/print behavior with simulated Host transport | Actual DSH routing or other browsers |
| Installed DSH0.2.0-rc.2, disposable profile | Packed plugin activation and real authenticated Web iframe/edit-save/disk/theme/close | DSH0.2.1 run or active-user install |
| Installed TUI0.16.1 runtime smoke | Actual Cordis activation, mediated command, scene, store/timer teardown; two cycles | Full CLI/profile boot |
| Production admission-loader cold start | Actual Cordis Loader resolving ./tui package export and nearest manifest, automatic admission and reload | Late-arm catch-up (exploration did not admit an already ACTIVE row) |
| Host React/public renderer | ThemeProvider/AlternateScreen, Chinese text, sections, burst search/Enter, host Escape flags, library/close | Native OS terminal pixel/graphics coverage |
| Native scene → real node-pty → xterm6 → Edge155 | 12 captured visual checkpoints: 100×28 wide, 40×24 narrow, scroll/resize restore, dark/light, search, library, legacy, invalid schema and Esc close | HTML recreation or full CLI boot |

The runtime script reports its private test admission fixture separately from the independent real production-loader test. Private host APIs are only in the test driver, not the plugin. Browser terminal screenshots wait for write callbacks, render events and animation frames, not only buffer text.

Representative source-controlled evidence: [wide](assets/tui-wide.png), [narrow](assets/tui-narrow.png). Reproducible commands and dependencies: [TUI](TUI.md), [workspace](WORKSPACE.md), [release procedure](RELEASING.md). Full machine-local captures stay in ignored output directories.

## Remote CI

CI runs unit/contract and Web-browser jobs on Node22/24 Linux, plus a real DSH Web smoke pinned to DSH0.2.1-rc.2 / 687f282e8625c6b8d11ff58211a90524be2e4317, including packed installation and authenticated UI checks. A configured job is not a passing result: inspect [Actions](https://github.com/JUANWANG-BUAA/dsh-canvas-viewer/actions) for the exact release commit. Native TUI installed-runtime tests are opt-in local tests, not CI coverage.

## Known unverified boundaries

- Full TUI CLI/profile boot, user-profile installation, live grant revocation and future TUI versions.
- Windows test/UI matrix, terminal font/protocol/multiplexer variants, cross-browser/OS print dialogs.
- Clean public Git dependency reinstall until explicitly recorded; GitHub tag/release and local packed tests are distinct operations.
- No semantic/DOM search, durable search index, history timeline, automatic merges, cross-device drafts, terminal executable-report conversion or pixel-perfect export.

Source lookup can omit unreadable/oversized/raced files and skipped directories even with scanComplete:true; that flag describes traversal budgets, not guaranteed indexing of every file. Revision checks plus atomic rename do not provide compare-and-swap against external processes.
