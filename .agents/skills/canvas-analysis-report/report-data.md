# Data-only reports for TUI + Web

Prefer `~/.dsh/canvases/<kebab>.canvas.json` for both terminal and browser readers. Version 1 is strict data-only: no imports, JavaScript expressions, arbitrary properties, image/URL blocks, HTML interpretation or callbacks. A URL or `asset://name.webp` string is literal text, not an active link or image; asset materialization belongs only to trusted Web TSX. Native TUI is read-only: no arbitrary HTML, image rendering, source editing or report callbacks.

```json
{
  "schemaVersion": 1,
  "title": "先收紧执行边界，再扩展报告工作台",
  "summary": "结论优先；随后给证据和行动。",
  "sections": [
    {
      "id": "verdict",
      "title": "结论",
      "blocks": [
        {"type":"callout","tone":"warning","title":"边界","text":"终端只读，不运行报告代码。"},
        {"type":"metrics","items":[{"label":"已验证","value":3,"detail":"只填写有证据的指标"}]},
        {"type":"table","columns":["证据","结论"],"rows":[["路径:行号","具体事实"]]},
        {"type":"list","ordered":true,"items":["先验证","再推进"]}
      ]
    }
  ]
}
```

Block types (exact keys only):

- `text`: `text:string`.
- `callout`: `tone:info|success|warning|danger`, optional `title:string`, `text:string`.
- `metrics`: `items:[{label:string,value:string|number,detail?:string}]`.
- `table`: `columns:string[]`, `rows:(string|number|boolean|null)[][]`; every row must match the column count.
- `list`: `items:string[]`, optional `ordered:boolean`.
- `bar-chart`: `items:[{label:string,value:number}]`; TUI uses Unicode bars, Web uses fixed SDK charts.
- `unsupported`: `label:string`, `reason:string`; explicitly describes content not represented in this data model, not a way to inject arbitrary markup.

Keep files concise. Runtime hard ceilings (not authoring targets):

- Source: 1,500,000 UTF-8 bytes; canonical serialized data is also checked.
- Sections: 64, unique nonempty IDs (128 characters each); 512 blocks total.
- Items: 256 per metrics/list/bar-chart block, 4096 total.
- Tables: 1–32 columns, up to 256 rows, 8192 cells per table / 16384 total; every row exactly matches its columns.
- Titles: 512 characters; labels: 256; other text: 32,768; total text: 1,000,000 UTF-8 bytes.
- Numbers: finite, absolute value ≤1e100.

Control sequences and bidi formatting controls are rejected; LF and TAB are permitted. Unknown schema versions, keys and types are rejected, not ignored or coerced. Text is literal; do not embed markup expecting it to render. Aim for a sentence verdict, concise summary and evidence-driven sections, not the runtime maximum.

The terminal reader is read-only. `/canvas` opens the library; `/canvas <path>` opens a file. It uses the separately admitted `canvas.viewer.open` command, not a duplicate `view_canvas` tool. Web `view_canvas`, when exposed, accepts the same JSON and renders a fixed plugin-owned template; its source editor edits JSON, never generated TSX. If the tool is absent, still write and link the file; only report that the tool is not exposed. Missing tool visibility does not establish Web activation state. Existing TSX remains trusted Web-only, with an explicit terminal legacy notice—not automatic conversion. See repository `fixtures/dual-reader.canvas.json` for all seven block types.

The managed library searches full source before pagination but uses bounded scanning (32 MiB cumulative source, depth/entry limits); `scanComplete:false` means totals are partial, and `true` still excludes unreadable/oversized/disallowed entries. The native reader can visibly truncate at its own line/text/match safety limits, so search coverage is then retained content, not the entire original report. A file write, successful source save or gallery listing alone does not prove successful rendering.
