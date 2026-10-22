# Report workspace contracts (0.6.0)

The Web workspace accepts legacy `.canvas.tsx` and versioned `.canvas.json`. JSON is validated and translated by a fixed SDK template; its source editor always edits original JSON. Assets in JSON strings are literal text. Native TUI is read-only and shares the repository, not the Web editor or compiler; see [TUI](TUI.md) and [data schema](../skills/canvas-analysis-report/report-data.md).

## Ownership and editing

- Host remains the source of truth: reports in `~/.dsh/canvases/`, images in `~/.dsh/canvas-assets/`. Save/delete stay limited to the managed report root; read access is not expanded.
- Open/reload/save payloads carry `revision`: SHA256 of original source bytes, before asset materialization or compilation. A save acknowledgement is compiled from its submitted bytes, not a subsequent disk reread.
- New clients send `POST /api/canvas/save {path,source,baseRevision}`. Host compares the current source revision before writing and again before rename. Conflict returns HTTP 409 with `{ok:false,code:"revision-conflict",currentRevision,error}`. The browser keeps its draft, shows disk source separately, and requires an explicit review before updating the save base. A second disk change still conflicts.
- Plugin writes are queued by canonical path and use random exclusive temporary files with atomic same-directory rename. This is not a filesystem transaction/CAS across external editors: an external writer can still race between final comparison and rename. There is no history timeline or automatic merge in this release.
- Legacy API callers omitting baseRevision retain unconditional writes, marked `saveMode:"legacy-unconditional"`. null is create-only. The new UI never silently falls back when a revision is missing. Source size and realpath validation still apply.
- Saving disables close for that report, not typing. A response cannot discard newer typed text (including reverting to the old source); SSE and save response ordering preserve the submitted base. Closing a dirty report offers continue, keep draft, or discard. Discard does not roll back already saved disk changes.

## Drafts and cleanup

- Drafts are owned by the current browser origin's localStorage (`dsh-cv-drafts-v1`). Max 10 entries, 1 MiB serialized total (source + base source), seven-day expiry. Older entries are evicted; quota/unavailable storage is reported. Paths may be absolute. No draft is uploaded as a backup or sent to another machine.
- Drafts restore on explicit report reopen. If disk revision changed, restore is conflict-protected. Successful synchronization and discard remove the draft; retaining a draft preserves it after closing. Expired rows are ignored and removed on later writes. Browser refresh/closing warns while edits or saves are pending where beforeunload is supported.
- Clearing browser site data removes drafts; uninstalling the plugin does not automatically wipe browser localStorage. Use the discard choice or clear this origin's site storage if sensitive data must be removed. Different browser tabs are not a collaborative editor; server revision checks still arbitrate disk saves.

## Gallery search

`GET /api/canvas/list?q=&workspace=all&offset=0&limit=40` returns items, count (page length), total (filtered count), offset, limit, nextOffset (number/null), truncated, scanComplete, workspaces (choices from the scanned domain).

The query is case-insensitive literal source text plus title/path/workspace, **not rendered DOM or semantic search**. Scan/filter occurs before sorting and pagination. Default page size stays 200 for older clients; Web requests 40 and TUI 100. Symlink file/dir entries are not followed. Individual reads are capped at 1.5MB and reject non-regular files without blocking on FIFOs.

The shared repository bounds scans to depth 32, 20000 visited entries and 32MiB candidate source per request. At a safety limit, `scanComplete:false`; total/workspace choices describe only that scanned domain, not a complete disk inventory. The TUI discloses PARTIAL SCAN; API consumers must inspect scanComplete/truncated. The byte-limit file may be read before the threshold is detected but is not included.

Metadata cache is bounded to 256 entries / approximately 16MiB, accounting for source search text and retained preview fields; identity includes device/inode/size/mtime/ctime. JSON preview summaries are capped at 240 characters. A cache hit still performs a safe read before reusing metadata; this is not a persistent index or constant-time search. Concurrent list requests are independent and very large libraries still incur I/O latency. Concurrent mutation can shift offset pages; this is not a snapshot cursor.

## Reader and printable delivery

Directory, text find and scroll restoration run inside the opaque report iframe. Heading count and text traversal are bounded; find does not match across separate text nodes. Positions are remembered for at most 50 paths in page memory, not across page reloads.

PDF toolbar requests a private-port snapshot of current visible report DOM (UTF8 max 1 MiB). Parent reconstructs allowed tags/attributes/styles with script/event/link/network content stripped. Print preview is a separate no-script iframe; CSP denies network and allows only data raster images. User explicitly clicks Print / Save PDF. Hidden tabs and collapsed content are omitted; canvases, external media and interactive styling may not survive. Prefer static tables/SVG for printable reports. Source/draft downloads remain separate from print export.

## Build and verification

Edit `src/client/*.js.part`, then `pnpm build:client`. The committed lib/client.js stays a single classic ModuleLoader factory; no installation-time build is required. pnpm test rejects stale source/artifact pairs and runs isolation, pagination, draft/merge, conflict/save, lifecycle, repository fixture rendering and VM sandbox tests.

pnpm test:browser runs real Chromium with a simulated Host. CANVAS_CDP_URL can attach to an isolated installed browser using a fresh context. DSH_BROWSER_SMOKE=1 enables real DSH browser checks in scripts/dsh-smoke.mjs; use an empty disposable DSH_HOME plus HARNESS_DIR (pinned checkout) or absolute DSH_BIN (installed CLI). A separate managed HOME keeps plugin storage out of the user's library. Token launch URLs and cookies must never be logged. See CI for the pinned 0.2.1-rc.2 integration matrix; a run against a different installed CLI proves only that actual version.
