# 0.5.0 foundation verification

Historical local evidence for the 0.5.0 workspace foundation, included in the 0.6.0 release. Counts and artifact sizes below describe that intermediate snapshot, not current CI or the final 0.6.0 artifact. See [0.6.0 verification](VERIFICATION-0.6.0.md) for the current release boundary.

## Executed successfully

- Full `pnpm test` in a disposable, canonical temporary HOME. Exact client source/artifact check; skill mirrors; strict Host TypeScript; eight runtime syntax checks; package contract; client budget; 17 isolation/reader/bridge behavior cases; gallery and editor state suites; isolated Host search/revision/concurrency/HTTP409 tests; 126 self-test assertions; lifecycle two unload/reload cycles; one mandatory repository SSR fixture; 58 sandbox VM checks.
- Client artifact 180,628 bytes under 184,320-byte (180 KiB) cap; ten deterministic source fragments reconstruct the committed factory byte-for-byte.
- Expanded real-browser smoke via isolated installed Edge 155 over CDP: real iframe rendering; parent-realm side-effect probe stays unset; heading navigation and Range find; theme synchronization; source toggles preserve iframe; sanitization rejects active/network markup while keeping linked/button text; static print preview; dirty close choices; save-time typing; conflict review; browser reload draft recovery/discard.
- Generated sample PDF from sanitized static markup through Chromium PDF output and inspected corresponding real-browser screenshots in output/playwright/major-update/. This proves the sanitized content prints; an OS print dialog click/save destination was not automated.
- Real installed DSH **0.2.0-rc.2**, isolated DSH_HOME and managed HOME, real browser fresh context: plugin activation, authenticated report open, iframe heading, UI edit/save verified against disk, updated rendering, theme and close. One-time auth URLs/cookies were not logged. This is additional local compatibility evidence, not a fresh execution against the pinned 0.2.1-rc.2 checkout.
- npm pack --dry-run and git diff --check passed. Fixtures are included in the distributable because packaged tests depend on them.

## Not executed / not claimed

- GitHub Actions, the new real-browser CI job on pinned 0.2.1-rc.2, clean public-commit reinstall, Windows/Linux UI matrix, cross-browser printing, or live user-profile installation.
- No cloud sync, automatic history snapshots/semantic diff, collaborative editing, full TypeScript migration, persistent search index or pixel-perfect whole-report export.
- These intermediate runs did not install into the user’s active profile. Release publication is tracked separately from runtime evidence; see the 0.6.0 release record.

## Known boundaries

See WORKSPACE.md and SANDBOX.md: literal source search, scan/cache limits, browser-local draft retention/eviction, current-visible export, explicit unsafe compatibility mode, and external-process save races remain explicit constraints.
