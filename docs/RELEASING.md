# Release procedure

## Delivery and versioning

The repository ships a prebuilt Git-installable bundle with Web and optional native TUI entries. The version must agree in package.json, dsh-plugin.json, CHANGELOG.md and the v-prefixed tag. A GitHub release does **not** publish npm; registry publication is a separate explicitly authorized operation.

Keep the classic client factory and compiled host/report artifacts committed. No install-time build or sibling monorepo checkout is required. Do not commit node_modules, output, temporary browser profiles, session auth URLs/cookies, credentials or personal HOME paths. Source authoring skill mirrors must match the canonical skills directory.

## Before commit

```sh
pnpm install --frozen-lockfile --prod=false
pnpm build:host
pnpm build:client
node scripts/sync-skill-mirrors.mjs
pnpm test
git diff --check
npm pack --dry-run
```

Prefer a disposable HOME for tests that create fixtures. Do not replace the user’s active profile while verifying a release. pnpm test includes source/artifact equality, schema/reader/repository checks and packed-file contracts. Verify Markdown relative links and all new release files as well.

## Runtime checks

- Web: pnpm test:browser with installed Playwright Chromium, or CANVAS_CDP_URL pointing to an isolated system browser. This suite uses a simulated Host.
- Actual DSH: scripts/dsh-smoke.mjs with empty DSH_HOME and either pinned HARNESS_DIR or absolute DSH_BIN, PACK_PLUGIN=1 and DSH_BROWSER_SMOKE=1; credentials stay private. CI pins DSH0.2.1-rc.2. Test output against another version proves only that version.
- TUI: DSH_TUI_PACKAGE=/absolute/installed/package pnpm test:tui-runtime. This uses the actual installed runtime and reports private-fixture vs production-loader authority separately.
- Visual TUI: see [TUI browser reproduction](TUI.md#重现浏览器终端视觉检查). PTY/xterm visual checks are not full CLI/profile startup evidence.

## Commit, CI and release

1. Review git status/diff, stage only project deliverables and commit with a version-specific message. Never include ignored captures or unrelated work.
2. Push the intended branch normally; never force-push or amend shared history for a release.
3. Verify the GitHub Actions run on the exact pushed commit. Fix failures in new commits, rerun, and publish only after the required CI jobs succeed (or explicitly disclose a real external blocker instead of claiming green).
4. Create a fresh annotated vX.Y.Z tag at the verified commit and push that exact tag. Never move an existing release tag.
5. Create a GitHub release with explicit notes and target. If attaching an npm tarball, build it from the verified clean tree, confirm package version and file boundaries, and include its SHA256. Keep screenshots tied to real verification; do not call local screenshots OS-terminal coverage.
6. Read back the release URL, target/tag, prerelease/draft flags and asset metadata; check remote branch/tag SHAs and clean local status.

Consumers may install by tag for convenience or by the release commit’s full SHA for reproducibility:

```sh
dsh plugin --profile web add github:JUANWANG-BUAA/dsh-canvas-viewer#v0.6.0
# TUI uses the same root package, not a separate npm package
dsh plugin --profile dsh-tui add github:JUANWANG-BUAA/dsh-canvas-viewer#v0.6.0
```

Restart the selected surface after plugin-set changes. No release action silently migrates legacy executable TSX to JSON, installs into an active user profile, or broadens the supported contract matrix.
