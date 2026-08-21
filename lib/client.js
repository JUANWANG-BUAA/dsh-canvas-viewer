window.__ModuleLoader__.load({
  id: "dsh-canvas-viewer",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");
    var ReactDOM = require("react-dom/client");

    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useRef = React.useRef;
    var useMemo = React.useMemo;
    var useCallback = React.useCallback;

    var API = "/api/canvas";
    var CANVAS_RE = /(?:^|[\s"'`(])((?:~\/|\.{0,2}\/)?[^\s"'`)]+\.canvas\.tsx)\b/;
    var STYLE_ID = "dsh-canvas-viewer-css";

    var css = [
      /* Window chrome */
      "[data-dsh-cv-root]{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--cv-fg,#ececec);}",
      "[data-dsh-cv-root] *,[data-dsh-cv-root] *::before,[data-dsh-cv-root] *::after{box-sizing:border-box;}",
      ".dsh-cv-win{position:fixed;z-index:2147483000;display:flex;flex-direction:column;min-width:480px;min-height:280px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);background:var(--cv-editor,#141414);color:var(--cv-fg,#ececec);border:1px solid var(--cv-stroke-2,#2e2e2e);border-radius:12px;box-shadow:0 28px 80px rgba(0,0,0,.55);overflow:hidden;}",
      ".dsh-cv-bar{display:flex;align-items:center;gap:12px;height:48px;padding:0 8px 0 14px;background:var(--cv-chrome,#1c1c1c);border-bottom:1px solid var(--cv-stroke-3,#252525);cursor:grab;user-select:none;flex:0 0 auto;}",
      ".dsh-cv-bar:active{cursor:grabbing;}",
      ".dsh-cv-dot{width:8px;height:8px;border-radius:99px;background:var(--cv-accent,#8ab4f8);flex:0 0 auto;box-shadow:0 0 0 4px color-mix(in srgb,var(--cv-accent,#8ab4f8) 18%,transparent);}",
      ".dsh-cv-titlewrap{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}",
      ".dsh-cv-title{font-size:13px;font-weight:600;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--cv-fg,#ececec);}",
      ".dsh-cv-sub{font-size:10px;line-height:1.3;color:var(--cv-fg-3,#9a9a9a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".dsh-cv-actions{display:flex;align-items:center;gap:4px;flex:0 0 auto;}",
      ".dsh-cv-btn{appearance:none;border:0;border-radius:6px;background:transparent;color:var(--cv-fg-2,#c5c5c5);height:30px;padding:0 10px;font-size:12px;cursor:pointer;}",
      ".dsh-cv-btn:hover{background:var(--cv-fill-2,#222);color:var(--cv-fg,#ececec);}",
      ".dsh-cv-btn[data-copied='1']{color:var(--cv-cat-green,#9ccc9c);}",
      ".dsh-cv-btn[data-variant='primary']{background:var(--cv-accent,#8ab4f8);color:var(--cv-on-accent,#0b0b0b);}",
      ".dsh-cv-btn[data-variant='primary']:hover{background:var(--cv-accent-hover,#a8c7fa);}",
      ".dsh-cv-btn[data-variant='secondary']{background:var(--cv-fill-1,#2a2a2a);}",
      ".dsh-cv-close{width:32px;padding:0;font-size:18px;line-height:30px;color:var(--cv-fg-3,#9a9a9a);}",
      ".dsh-cv-close:hover{background:#3a2226;color:#ffc4c8;}",
      ".dsh-cv-body{flex:1;min-height:0;overflow:auto;padding:24px 28px 48px;user-select:text;cursor:auto;background:var(--cv-editor,#141414);}",
      ".dsh-cv-body::-webkit-scrollbar{width:10px;}",
      ".dsh-cv-body::-webkit-scrollbar-thumb{background:var(--cv-fill-1,#2a2a2a);border-radius:99px;}",
      ".dsh-cv-err{font-size:12px;color:var(--cv-cat-red,#e8a0a0);white-space:pre-wrap;}",
      ".dsh-cv-src{font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;color:var(--cv-fg-2,#c5c5c5);}",
      ".dsh-cv-resize{position:absolute;left:0;right:0;bottom:0;height:14px;cursor:ns-resize;}",
      ".dsh-cv-resize::after{content:'';display:block;width:40px;height:3px;margin:6px auto 0;border-radius:99px;background:var(--cv-stroke-1,#3a3a3a);}",
      /* Canvas surface tokens (Cursor-aligned dark) */
      "[data-dsh-cv-canvas]{--cv-editor:#141414;--cv-chrome:#1c1c1c;--cv-elevated:#1f1f1f;--cv-fg:#ececec;--cv-fg-2:#c5c5c5;--cv-fg-3:#9a9a9a;--cv-fg-4:#6f6f6f;--cv-link:#8ab4f8;--cv-accent:#8ab4f8;--cv-accent-hover:#a8c7fa;--cv-on-accent:#0b0b0b;--cv-stroke-1:#3a3a3a;--cv-stroke-2:#2e2e2e;--cv-stroke-3:#252525;--cv-stroke-focus:#6aa4ff;--cv-fill-1:#2a2a2a;--cv-fill-2:#222222;--cv-fill-3:#1a1a1a;--cv-fill-4:#161616;--cv-cat-blue:#8ab4f8;--cv-cat-green:#9ccc9c;--cv-cat-orange:#f6c177;--cv-cat-red:#e8a0a0;--cv-cat-purple:#c4b5fd;--cv-cat-yellow:#e8c070;--cv-cat-cyan:#7ec8c8;--cv-cat-pink:#e8a0c4;--cv-cat-gray:#9a9a9a;color:var(--cv-fg);}",
      /* Layout */
      ".cv-stack{display:flex;flex-direction:column;}",
      ".cv-row{display:flex;flex-wrap:wrap;align-items:center;}",
      ".cv-grid{display:grid;align-items:start;}",
      /* Type */
      ".cv-h1{margin:0;font-size:24px;line-height:30px;font-weight:590;letter-spacing:-.02em;color:var(--cv-fg);}",
      ".cv-h2{margin:0;font-size:18px;line-height:24px;font-weight:590;color:var(--cv-fg);}",
      ".cv-h3{margin:0;font-size:16px;line-height:22px;font-weight:590;color:var(--cv-fg-2);}",
      ".cv-text{margin:0;font-size:14px;line-height:20px;font-weight:400;color:var(--cv-fg);}",
      ".cv-text[data-size='small']{font-size:12px;line-height:16px;}",
      ".cv-text[data-tone='secondary']{color:var(--cv-fg-2);}",
      ".cv-text[data-tone='tertiary'],.cv-text[data-tone='muted']{color:var(--cv-fg-3);}",
      ".cv-text[data-tone='quaternary']{color:var(--cv-fg-4);}",
      ".cv-text[data-weight='medium']{font-weight:500;}",
      ".cv-text[data-weight='semibold']{font-weight:590;}",
      ".cv-text[data-weight='bold']{font-weight:700;}",
      ".cv-text[data-italic='1']{font-style:italic;}",
      ".cv-text[data-truncate='end']{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".cv-text[data-truncate='start']{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left;}",
      /* Pill */
      ".cv-pill{appearance:none;border:0;border-radius:999px;background:transparent;color:var(--cv-fg-3);font-size:12px;line-height:16px;padding:6px 12px;cursor:pointer;}",
      ".cv-pill[data-size='sm']{padding:4px 10px;font-size:11px;}",
      ".cv-pill:hover{background:var(--cv-fill-3);color:var(--cv-fg);}",
      ".cv-pill[data-on='1']{background:color-mix(in srgb,var(--cv-accent) 18%,transparent);color:var(--cv-fg);}",
      ".cv-pill[data-tone='blue'][data-on='1']{background:color-mix(in srgb,var(--cv-cat-blue) 18%,transparent);}",
      ".cv-pill[data-tone='green']{color:var(--cv-cat-green);}",
      ".cv-pill[data-tone='red']{color:var(--cv-cat-red);}",
      ".cv-pill[data-tone='orange']{color:var(--cv-cat-orange);}",
      /* Stat */
      ".cv-stat{border:1px solid var(--cv-stroke-3);background:var(--cv-chrome);padding:12px 14px;min-width:0;border-radius:8px;}",
      ".cv-stat b{display:block;font-size:16px;line-height:22px;font-weight:590;letter-spacing:-.02em;word-break:break-word;color:var(--cv-fg);}",
      ".cv-stat span{display:block;margin-top:6px;font-size:12px;line-height:16px;color:var(--cv-fg-3);}",
      ".cv-stat[data-tone='success'] b{color:var(--cv-cat-green);}",
      ".cv-stat[data-tone='danger'] b{color:var(--cv-cat-red);}",
      ".cv-stat[data-tone='warning'] b{color:var(--cv-cat-orange);}",
      ".cv-stat[data-tone='info'] b{color:var(--cv-cat-blue);}",
      /* Card */
      ".cv-card{border:1px solid var(--cv-stroke-3);background:var(--cv-chrome);border-radius:8px;overflow:hidden;}",
      ".cv-card-h{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--cv-stroke-3);font-size:13px;font-weight:590;color:var(--cv-fg);}",
      ".cv-card-h-main{flex:1;min-width:0;}",
      ".cv-card-h-trail{flex:0 0 auto;display:flex;align-items:center;gap:6px;}",
      ".cv-card-b{padding:14px;}",
      /* Callout */
      ".cv-callout{border:1px solid var(--cv-stroke-3);border-left:3px solid var(--cv-cat-blue);padding:12px 14px;font-size:14px;line-height:20px;background:var(--cv-chrome);border-radius:8px;}",
      ".cv-callout-title{display:block;font-weight:590;margin-bottom:4px;color:var(--cv-fg);}",
      ".cv-callout[data-tone='danger']{border-left-color:var(--cv-cat-red);background:#1f1616;}",
      ".cv-callout[data-tone='warning']{border-left-color:var(--cv-cat-orange);background:#1f1a12;}",
      ".cv-callout[data-tone='success']{border-left-color:var(--cv-cat-green);background:#121a16;}",
      ".cv-callout[data-tone='info']{border-left-color:var(--cv-cat-blue);}",
      /* Table */
      ".cv-table-wrap{width:100%;border:1px solid var(--cv-stroke-3);border-radius:8px;overflow:auto;background:var(--cv-chrome);}",
      ".cv-table-wrap[data-framed='0']{border:0;border-radius:0;background:transparent;}",
      ".cv-table{width:100%;border-collapse:collapse;font-size:12px;line-height:16px;}",
      ".cv-table th,.cv-table td{border-bottom:1px solid var(--cv-stroke-3);text-align:left;padding:9px 12px;vertical-align:top;}",
      ".cv-table th{color:var(--cv-fg-3);font-weight:590;background:var(--cv-fill-3);position:static;}",
      ".cv-table[data-sticky='1'] thead th{position:sticky;top:0;z-index:1;}",
      ".cv-table tbody tr[data-stripe='1'] td{background:var(--cv-fill-4);}",
      ".cv-table .cv-tone-dot{display:inline-block;width:7px;height:7px;border-radius:99px;margin-right:8px;vertical-align:middle;background:var(--cv-fg-3);}",
      ".cv-table .cv-tone-dot[data-tone='success']{background:var(--cv-cat-green);}",
      ".cv-table .cv-tone-dot[data-tone='danger']{background:var(--cv-cat-red);}",
      ".cv-table .cv-tone-dot[data-tone='warning']{background:var(--cv-cat-orange);}",
      ".cv-table .cv-tone-dot[data-tone='info']{background:var(--cv-cat-blue);}",
      ".cv-table-empty{padding:16px;color:var(--cv-fg-3);font-size:13px;}",
      /* Code / chrome */
      ".cv-code{font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--cv-fill-4);border:1px solid var(--cv-stroke-3);padding:1px 6px;border-radius:4px;color:var(--cv-fg);}",
      ".cv-div{height:1px;background:var(--cv-stroke-3);border:0;margin:8px 0;}",
      /* Todo */
      ".cv-todo{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;}",
      ".cv-todo li{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.5;}",
      ".cv-todo-mark{width:16px;height:16px;border-radius:4px;border:1px solid var(--cv-stroke-1);flex:0 0 auto;margin-top:2px;}",
      ".cv-todo li[data-status='completed'] .cv-todo-mark,.cv-todo li[data-status='done'] .cv-todo-mark{background:var(--cv-cat-green);border-color:var(--cv-cat-green);}",
      ".cv-todo li[data-status='in_progress'] .cv-todo-mark,.cv-todo li[data-status='pending'] .cv-todo-mark{background:transparent;}",
      ".cv-todo li[data-status='cancelled']{opacity:.55;text-decoration:line-through;}",
      /* Swatch / UsageBar / Charts */
      ".cv-swatch{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--cv-fg-2);}",
      ".cv-swatch i{width:10px;height:10px;border-radius:99px;display:inline-block;}",
      ".cv-usage{display:flex;flex-direction:column;gap:8px;}",
      ".cv-usage-labels{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:var(--cv-fg-3);}",
      ".cv-usage-track{display:flex;height:8px;border-radius:99px;overflow:hidden;background:var(--cv-fill-3);}",
      ".cv-usage-seg{height:100%;}",
      ".cv-chart{width:100%;overflow:visible;}",
      ".cv-chart-label{font-size:10px;fill:var(--cv-fg-3);}",
      /* Collapsible */
      ".cv-collapse{border-bottom:1px solid var(--cv-stroke-3);}",
      ".cv-collapse-h{width:100%;appearance:none;border:0;background:transparent;color:inherit;text-align:left;padding:10px 0;cursor:pointer;display:flex;gap:10px;align-items:center;}",
      ".cv-collapse-h:hover{color:var(--cv-fg);}",
      ".cv-collapse-b{padding:0 0 14px;}",
      /* Library / settings (unchanged structure, tokenized) */
      ".dsh-cv-lib{display:flex;flex-direction:column;gap:14px;max-width:920px;}",
      ".dsh-cv-lib-head{display:flex;flex-direction:column;gap:4px;}",
      ".dsh-cv-lib-title{margin:0;font-size:18px;font-weight:650;letter-spacing:-.02em;}",
      ".dsh-cv-lib-desc{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-text-secondary,var(--cv-fg-3));}",
      ".dsh-cv-lib-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}",
      ".dsh-cv-lib-search{flex:1;min-width:180px;height:34px;border-radius:8px;border:1px solid var(--cv-stroke-2);background:var(--cv-fill-3);color:inherit;padding:0 12px;font-size:13px;}",
      ".dsh-cv-lib-search:focus{outline:none;border-color:var(--cv-stroke-focus);}",
      ".dsh-cv-lib-seg{display:inline-flex;gap:2px;padding:3px;border-radius:10px;background:var(--cv-fill-3);}",
      ".dsh-cv-lib-seg button{appearance:none;border:0;border-radius:8px;background:transparent;color:var(--cv-fg-3);height:28px;padding:0 10px;font-size:12px;cursor:pointer;}",
      ".dsh-cv-lib-seg button[data-on='1']{background:color-mix(in srgb,var(--cv-accent) 18%,transparent);color:var(--cv-fg);}",
      ".dsh-cv-lib-select{height:34px;border-radius:8px;border:1px solid var(--cv-stroke-2);background:var(--cv-fill-3);color:inherit;padding:0 10px;font-size:12px;}",
      ".dsh-cv-lib-meta{font-size:12px;color:var(--cv-fg-3);}",
      ".dsh-cv-lib-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;}",
      ".dsh-cv-lib-row{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border-radius:12px;border:1px solid var(--cv-stroke-3);background:var(--cv-fill-4);}",
      ".dsh-cv-lib-row[data-missing='1']{opacity:.62;}",
      ".dsh-cv-lib-row-main{display:flex;gap:12px;align-items:flex-start;}",
      ".dsh-cv-lib-row-text{flex:1;min-width:0;}",
      ".dsh-cv-lib-row-title{font-size:13px;font-weight:600;word-break:break-all;}",
      ".dsh-cv-lib-row-path{font-size:11px;color:var(--cv-fg-3);word-break:break-all;margin-top:3px;}",
      ".dsh-cv-lib-row-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}",
      ".dsh-cv-lib-chip{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--cv-fill-2);color:var(--cv-fg-2);}",
      ".dsh-cv-lib-actions{display:flex;flex-wrap:wrap;gap:6px;}",
      ".dsh-cv-lib-actions button{appearance:none;border:0;border-radius:8px;background:var(--cv-fill-2);color:var(--cv-fg-2);height:28px;padding:0 10px;font-size:12px;cursor:pointer;}",
      ".dsh-cv-lib-actions button:hover{background:var(--cv-fill-1);color:var(--cv-fg);}",
      ".dsh-cv-lib-actions button[data-primary='1']{background:color-mix(in srgb,var(--cv-accent) 18%,transparent);color:var(--cv-fg);}",
      ".dsh-cv-lib-empty{font-size:13px;color:var(--cv-fg-3);padding:18px 0;}",
      ".dsh-cv-lib-toast{position:fixed;right:20px;bottom:20px;z-index:2147483646;padding:10px 14px;border-radius:10px;background:var(--cv-elevated);border:1px solid color-mix(in srgb,var(--cv-accent) 25%,transparent);color:var(--cv-fg);font-size:12px;box-shadow:0 12px 40px rgba(0,0,0,.35);}",
      ".dsh-cv-card{list-style:none;border:1px solid var(--cv-stroke-2);border-radius:12px;background:var(--cv-fill-4);overflow:hidden;}",
      ".dsh-cv-card-h{width:100%;appearance:none;border:0;background:transparent;color:inherit;text-align:left;padding:14px 16px;cursor:pointer;display:flex;gap:12px;align-items:center;}",
      ".dsh-cv-card-h:hover{background:var(--cv-fill-3);}",
      ".dsh-cv-card-name{display:block;font-size:14px;font-weight:600;}",
      ".dsh-cv-card-desc{display:block;font-size:12px;color:var(--cv-fg-3);margin-top:2px;}",
      ".dsh-cv-card-b{padding:0 16px 16px;display:flex;flex-direction:column;gap:10px;}",
    ].join("");

    function ensureCss() {
      var style = document.getElementById(STYLE_ID);
      if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
      }
      style.textContent = css;
    }

    function extractCanvasPath(value) {
      if (typeof value !== "string") return "";
      var trimmed = value.trim().replace(/^["'`]+|["'`]+$/g, "");
      if (
        trimmed.endsWith(".canvas.tsx")
        && trimmed.length < 500
        && trimmed.indexOf("\n") < 0
        && trimmed.indexOf("..") < 0
      ) {
        return trimmed;
      }
      var match = trimmed.match(CANVAS_RE);
      return match ? match[1] : "";
    }

    function pathFromEvent(event) {
      var node = event.target;
      if (node && node.nodeType !== 1) node = node.parentElement;
      if (!node || !node.closest) return "";
      if (node.closest(".dsh-cv-win") || node.closest("[data-dsh-canvas-viewer]")) return "";
      for (var el = node; el && el !== document.body; el = el.parentElement) {
        var attrs = ["data-path", "title", "href", "aria-label"];
        for (var i = 0; i < attrs.length; i++) {
          var found = extractCanvasPath(el.getAttribute(attrs[i]) || "");
          if (found) return found;
        }
        if (el.childElementCount === 0) {
          var fromText = extractCanvasPath((el.textContent || "").trim());
          if (fromText) return fromText;
        }
      }
      return "";
    }

    function gapStyle(gap) {
      if (gap == null) return 10;
      if (typeof gap === "number") return gap;
      return 10;
    }

    function alignItems(align) {
      if (align === "start") return "flex-start";
      if (align === "end") return "flex-end";
      if (align === "stretch") return "stretch";
      return "center";
    }

    function justifyContent(justify) {
      if (justify === "center") return "center";
      if (justify === "end") return "flex-end";
      if (justify === "space-between") return "space-between";
      return "flex-start";
    }

    function mergeStyle(base, override) {
      return Object.assign({}, base || {}, override || {});
    }

    function computeDAGLayout(input) {
      var nodes = (input && input.nodes) || [];
      var edges = (input && input.edges) || [];
      var direction = (input && input.direction) || "vertical";
      var nodeWidth = (input && input.nodeWidth) || 160;
      var nodeHeight = (input && input.nodeHeight) || 44;
      var rankGap = (input && input.rankGap) || 64;
      var nodeGap = (input && input.nodeGap) || 28;
      var padding = (input && input.padding) || 24;
      var ids = nodes.map(function (n) { return n.id; });
      var rank = {};
      ids.forEach(function (id) { rank[id] = 0; });
      var changed = true;
      var guard = 0;
      while (changed && guard < 64) {
        changed = false;
        guard += 1;
        edges.forEach(function (edge) {
          if (rank[edge.from] == null || rank[edge.to] == null) return;
          var next = rank[edge.from] + 1;
          if (rank[edge.to] < next) {
            rank[edge.to] = next;
            changed = true;
          }
        });
      }
      var groups = {};
      ids.forEach(function (id) {
        var r = rank[id] || 0;
        if (!groups[r]) groups[r] = [];
        groups[r].push(id);
      });
      var ranks = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
      var pos = {};
      var width = padding;
      var height = padding;
      var rankBoxes = [];
      ranks.forEach(function (r) {
        var minX = Infinity;
        var minY = Infinity;
        var maxX = 0;
        var maxY = 0;
        groups[r].forEach(function (id, order) {
          var x = direction === "horizontal"
            ? padding + r * (nodeWidth + rankGap)
            : padding + order * (nodeWidth + nodeGap);
          var y = direction === "horizontal"
            ? padding + order * (nodeHeight + nodeGap)
            : padding + r * (nodeHeight + rankGap);
          pos[id] = {
            id: id, x: x, y: y, rank: r, order: order,
            width: nodeWidth, height: nodeHeight,
          };
          width = Math.max(width, x + nodeWidth + padding);
          height = Math.max(height, y + nodeHeight + padding);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + nodeWidth);
          maxY = Math.max(maxY, y + nodeHeight);
        });
        rankBoxes.push({
          rank: r, x: minX, y: minY,
          width: maxX - minX, height: maxY - minY,
          nodeIds: groups[r].slice(),
        });
      });
      var layoutEdges = edges.map(function (edge) {
        var a = pos[edge.from];
        var b = pos[edge.to];
        if (!a || !b) return null;
        var sourceX;
        var sourceY;
        var targetX;
        var targetY;
        if (direction === "horizontal") {
          sourceX = a.x + nodeWidth;
          sourceY = a.y + nodeHeight / 2;
          targetX = b.x;
          targetY = b.y + nodeHeight / 2;
        } else {
          sourceX = a.x + nodeWidth / 2;
          sourceY = a.y + nodeHeight;
          targetX = b.x + nodeWidth / 2;
          targetY = b.y;
        }
        var midX = (sourceX + targetX) / 2;
        var midY = (sourceY + targetY) / 2;
        return {
          from: edge.from, to: edge.to,
          sourceX: sourceX, sourceY: sourceY,
          targetX: targetX, targetY: targetY,
          isBackEdge: false,
          points: [
            { x: sourceX, y: sourceY },
            { x: midX, y: midY },
            { x: targetX, y: targetY },
          ],
        };
      }).filter(Boolean);
      return {
        nodes: ids.map(function (id) { return pos[id]; }).filter(Boolean),
        edges: layoutEdges,
        ranks: rankBoxes,
        direction: direction,
        width: width,
        height: height,
      };
    }

    function createSdk(ReactLib) {
      var category = {
        gray: "#9a9a9a",
        purple: "#c4b5fd",
        green: "#9ccc9c",
        yellow: "#e8c070",
        cyan: "#7ec8c8",
        pink: "#e8a0c4",
        blue: "#8ab4f8",
        orange: "#f6c177",
        red: "#e8a0a0",
      };
      var tokens = {
        bg: { editor: "#141414", chrome: "#1c1c1c", elevated: "#1f1f1f", sidebar: "#1c1c1c" },
        text: {
          primary: "#ececec",
          secondary: "#c5c5c5",
          tertiary: "#9a9a9a",
          quaternary: "#6f6f6f",
          link: "#8ab4f8",
          onAccent: "#0b0b0b",
        },
        stroke: {
          primary: "#3a3a3a",
          secondary: "#2e2e2e",
          tertiary: "#252525",
          focused: "#6aa4ff",
        },
        fill: {
          primary: "#2a2a2a",
          secondary: "#222222",
          tertiary: "#1a1a1a",
          quaternary: "#161616",
        },
        accent: { primary: "#8ab4f8", control: "#8ab4f8", controlHover: "#a8c7fa" },
        diff: {
          insertedLine: "#9ccc9c",
          removedLine: "#e8a0a0",
          stripAdded: "#1d3b1d",
          stripRemoved: "#3b1d1d",
        },
        category: category,
      };
      // Flat aliases used by many existing canvases + nested Cursor-shaped tokens.
      var theme = Object.assign({
        kind: "dark",
        tokens: tokens,
        category: category,
        palette: [category.blue, category.orange, category.green, category.red, category.purple],
        bg: tokens.bg.editor,
        panel: tokens.bg.chrome,
        text: tokens.text.primary,
        textSecondary: tokens.text.secondary,
        border: tokens.stroke.tertiary,
        accent: tokens.accent.primary,
      }, tokens);

      function useHostTheme() {
        return theme;
      }
      function useCanvasState(key, initial) {
        return ReactLib.useState(initial);
      }
      function useCanvasAction() {
        return function noop() {};
      }

      function Stack(props) {
        return h("div", {
          className: "cv-stack",
          style: mergeStyle({ gap: gapStyle(props.gap) }, props.style),
        }, props.children);
      }
      function Row(props) {
        return h("div", {
          className: "cv-row",
          style: mergeStyle({
            gap: gapStyle(props.gap),
            alignItems: alignItems(props.align),
            justifyContent: justifyContent(props.justify),
            flexWrap: props.wrap === false ? "nowrap" : "wrap",
          }, props.style),
        }, props.children);
      }
      function Grid(props) {
        var columns = props.columns || 2;
        return h("div", {
          className: "cv-grid",
          style: mergeStyle({
            gap: gapStyle(props.gap),
            alignItems: alignItems(props.align || "start"),
            gridTemplateColumns: typeof columns === "number"
              ? "repeat(" + columns + ", minmax(0, 1fr))"
              : String(columns),
            width: "100%",
          }, props.style),
        }, props.children);
      }
      function H1(props) { return h("h1", { className: "cv-h1", style: props.style }, props.children); }
      function H2(props) { return h("h2", { className: "cv-h2", style: props.style }, props.children); }
      function H3(props) { return h("h3", { className: "cv-h3", style: props.style }, props.children); }
      function Text(props) {
        var tone = props.tone || props.variant || "primary";
        if (tone === "muted") tone = "tertiary";
        var tag = props.as || "p";
        var truncate = props.truncate === true ? "end" : (props.truncate || undefined);
        return h(tag, {
          className: "cv-text",
          "data-tone": tone,
          "data-size": props.size === "small" ? "small" : "body",
          "data-weight": props.weight || "normal",
          "data-italic": props.italic ? "1" : undefined,
          "data-truncate": truncate,
          style: mergeStyle({ display: tag === "span" ? "inline" : undefined }, props.style),
        }, props.children);
      }
      function Pill(props) {
        var on = props.selected || props.active || props.current ? "1" : "0";
        return h("button", {
          type: "button",
          className: "cv-pill",
          "data-on": on,
          "data-size": props.size === "sm" || props.size === "small" ? "sm" : "md",
          "data-tone": props.tone || props.color || undefined,
          onClick: props.onClick,
          style: props.style,
        }, props.children);
      }
      function Stat(props) {
        return h("div", {
          className: "cv-stat",
          "data-tone": props.tone || undefined,
          style: props.style,
        },
          h("b", null, props.value != null ? String(props.value) : props.children),
          h("span", null, props.label || props.title || ""));
      }
      function Card(props) {
        return h("div", {
          className: "cv-card",
          "data-size": props.size || "md",
          style: props.style,
        }, props.children);
      }
      function CardHeader(props) {
        var main = props.title != null ? props.title : props.children;
        return h("div", { className: "cv-card-h", style: props.style },
          h("div", { className: "cv-card-h-main" }, main),
          props.trailing ? h("div", { className: "cv-card-h-trail" }, props.trailing) : null,
        );
      }
      function CardBody(props) {
        return h("div", { className: "cv-card-b", style: props.style }, props.children);
      }
      function Callout(props) {
        var tone = props.tone || props.variant || "info";
        return h("div", {
          className: "cv-callout",
          "data-tone": tone,
          style: props.style,
        },
          props.title ? h("strong", { className: "cv-callout-title" }, props.title) : null,
          props.children,
        );
      }
      function Code(props) {
        return h("code", { className: "cv-code", style: props.style }, props.children);
      }
      function Divider(props) { return h("hr", { className: "cv-div", style: props && props.style }); }
      function Spacer(props) {
        return h("div", { style: { flex: props && props.grow != null ? props.grow : 1, height: (props && props.size) || undefined, minWidth: 0 } });
      }
      function Button(props) {
        var variant = props.variant || "ghost";
        return h("button", {
          type: "button",
          className: "dsh-cv-btn",
          "data-variant": variant,
          onClick: props.onClick,
          disabled: props.disabled,
          style: props.style,
        }, props.children);
      }
      function Link(props) {
        return h("a", {
          href: props.href || props.to || "#",
          target: props.target,
          style: mergeStyle({ color: "var(--cv-link)" }, props.style),
        }, props.children);
      }
      function Table(props) {
        var headers = props.headers;
        var rows = props.rows || [];
        if (!headers && Array.isArray(props.columns)) {
          headers = props.columns.map(function (col) {
            return typeof col === "string" ? col : (col.header || col.label || col.key);
          });
        }
        if (!headers && rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0])) {
          headers = Object.keys(rows[0]);
        }
        headers = headers || [];
        var framed = props.framed !== false;
        var striped = !!props.striped;
        var sticky = !!props.stickyHeader;
        var aligns = props.columnAlign || [];
        var tones = props.rowTone || [];
        if (!rows.length && props.emptyMessage != null) {
          return h("div", { className: "cv-table-wrap", "data-framed": framed ? "1" : "0", style: props.style },
            h("div", { className: "cv-table-empty" }, props.emptyMessage),
          );
        }
        var table = h("table", {
          className: "cv-table",
          "data-sticky": sticky ? "1" : "0",
        },
          h("thead", null, h("tr", null, headers.map(function (head, i) {
            return h("th", { key: i, style: { textAlign: aligns[i] || "left" } }, head);
          }))),
          h("tbody", null, rows.map(function (row, i) {
            var cells;
            if (Array.isArray(row)) cells = row;
            else if (row && typeof row === "object") {
              cells = headers.map(function (head, idx) {
                var col = (props.columns && props.columns[idx]) || head;
                var key = typeof col === "string" ? col : col.key;
                return row[key] != null ? row[key] : row[head];
              });
            } else cells = [row];
            while (cells.length < headers.length) cells.push("");
            cells = cells.slice(0, headers.length);
            var tone = tones[i];
            return h("tr", { key: i, "data-stripe": striped && i % 2 === 1 ? "1" : "0" }, cells.map(function (cell, j) {
              var content = cell;
              if (j === 0 && tone) {
                content = [h("span", { key: "dot", className: "cv-tone-dot", "data-tone": tone }), cell];
              }
              return h("td", { key: j, style: { textAlign: aligns[j] || "left" } }, content);
            }));
          })),
        );
        return h("div", {
          className: "cv-table-wrap",
          "data-framed": framed ? "1" : "0",
          style: props.style,
        }, table);
      }

      function renderTodoItems(todos) {
        return h("ul", { className: "cv-todo" },
          todos.map(function (todo, i) {
            var label = typeof todo === "string" ? todo : (todo.content || todo.text || todo.title);
            var status = typeof todo === "string" ? "pending" : (todo.status || "pending");
            return h("li", { key: (todo && todo.id) || i, "data-status": status },
              h("span", { className: "cv-todo-mark", "aria-hidden": "true" }),
              h("span", null, label),
            );
          }),
        );
      }
      function TodoList(props) {
        return renderTodoItems(props.todos || props.items || []);
      }
      function TodoListCard(props) {
        return h(Card, null,
          h(CardHeader, { title: props.title || "Todos" }),
          h(CardBody, null, renderTodoItems(props.todos || props.items || [])),
        );
      }

      function Swatch(props) {
        var color = props.color || props.tone || "blue";
        var hex = category[color] || color;
        return h("span", { className: "cv-swatch", style: props.style },
          h("i", { style: { background: hex } }),
          props.children || props.label || color,
        );
      }

      function UsageBar(props) {
        var segments = props.segments || props.items || [];
        var total = segments.reduce(function (sum, seg) {
          return sum + (Number(seg.value) || 0);
        }, 0) || 1;
        return h("div", { className: "cv-usage", style: props.style },
          props.showLabels !== false ? h("div", { className: "cv-usage-labels" },
            segments.map(function (seg, i) {
              var color = category[seg.color] || seg.color || theme.palette[i % theme.palette.length];
              return h("span", { key: i },
                h("i", { style: { display: "inline-block", width: 8, height: 8, borderRadius: 99, background: color, marginRight: 6 } }),
                (seg.label || seg.name || "") + " · " + (seg.value != null ? seg.value : ""),
              );
            }),
          ) : null,
          h("div", { className: "cv-usage-track" },
            segments.map(function (seg, i) {
              var color = category[seg.color] || seg.color || theme.palette[i % theme.palette.length];
              var pct = ((Number(seg.value) || 0) / total) * 100;
              return h("div", {
                key: i,
                className: "cv-usage-seg",
                style: { width: pct + "%", background: color },
                title: String(seg.label || ""),
              });
            }),
          ),
        );
      }

      function normalizeSeries(props) {
        if (Array.isArray(props.series)) return props.series;
        if (Array.isArray(props.data)) {
          return [{ name: props.name || "series", data: props.data }];
        }
        return [];
      }

      function BarChart(props) {
        var series = normalizeSeries(props);
        var cats = props.categories || (series[0] && series[0].data
          ? series[0].data.map(function (d, i) { return d.label || d.x || String(i + 1); })
          : []);
        var height = props.height || 160;
        var width = props.width || 420;
        var pad = 28;
        var values = [];
        series.forEach(function (s) {
          (s.data || []).forEach(function (d) {
            values.push(typeof d === "number" ? d : Number(d.y != null ? d.y : d.value) || 0);
          });
        });
        var max = Math.max.apply(null, values.concat([1]));
        var groupW = (width - pad * 2) / Math.max(cats.length, 1);
        var barW = Math.max(4, (groupW - 8) / Math.max(series.length, 1));
        return h("svg", { className: "cv-chart", viewBox: "0 0 " + width + " " + height, style: props.style },
          series.map(function (s, si) {
            var color = category[s.color] || s.color || theme.palette[si % theme.palette.length];
            return (s.data || []).map(function (d, di) {
              var v = typeof d === "number" ? d : Number(d.y != null ? d.y : d.value) || 0;
              var hBar = ((height - pad * 1.5) * v) / max;
              var x = pad + di * groupW + si * barW + 4;
              var y = height - pad - hBar;
              return h("rect", { key: si + "-" + di, x: x, y: y, width: barW, height: hBar, fill: color, rx: 2 });
            });
          }),
          cats.map(function (label, i) {
            return h("text", {
              key: "l" + i,
              className: "cv-chart-label",
              x: pad + i * groupW + groupW / 2,
              y: height - 8,
              textAnchor: "middle",
            }, String(label));
          }),
        );
      }

      function LineChart(props) {
        var series = normalizeSeries(props);
        var height = props.height || 160;
        var width = props.width || 420;
        var pad = 24;
        var values = [];
        series.forEach(function (s) {
          (s.data || []).forEach(function (d) {
            values.push(typeof d === "number" ? d : Number(d.y != null ? d.y : d.value) || 0);
          });
        });
        var max = Math.max.apply(null, values.concat([1]));
        var min = Math.min.apply(null, values.concat([0]));
        var span = Math.max(max - min, 1);
        return h("svg", { className: "cv-chart", viewBox: "0 0 " + width + " " + height, style: props.style },
          series.map(function (s, si) {
            var color = category[s.color] || s.color || theme.palette[si % theme.palette.length];
            var data = s.data || [];
            var pts = data.map(function (d, i) {
              var v = typeof d === "number" ? d : Number(d.y != null ? d.y : d.value) || 0;
              var x = pad + (i * (width - pad * 2)) / Math.max(data.length - 1, 1);
              var y = height - pad - ((v - min) / span) * (height - pad * 2);
              return x + "," + y;
            }).join(" ");
            return h("polyline", {
              key: si,
              fill: "none",
              stroke: color,
              strokeWidth: 2,
              points: pts,
            });
          }),
        );
      }

      function PieChart(props) {
        var data = props.data || props.segments || [];
        var size = props.size || 140;
        var cx = size / 2;
        var cy = size / 2;
        var r = size / 2 - 4;
        var total = data.reduce(function (sum, d) {
          return sum + (Number(d.value) || 0);
        }, 0) || 1;
        var angle = -Math.PI / 2;
        var paths = data.map(function (d, i) {
          var value = Number(d.value) || 0;
          var slice = (value / total) * Math.PI * 2;
          var x1 = cx + r * Math.cos(angle);
          var y1 = cy + r * Math.sin(angle);
          angle += slice;
          var x2 = cx + r * Math.cos(angle);
          var y2 = cy + r * Math.sin(angle);
          var large = slice > Math.PI ? 1 : 0;
          var color = category[d.color] || d.color || theme.palette[i % theme.palette.length];
          var path = ["M", cx, cy, "L", x1, y1, "A", r, r, 0, large, 1, x2, y2, "Z"].join(" ");
          return h("path", { key: i, d: path, fill: color });
        });
        return h("svg", { className: "cv-chart", width: size, height: size, viewBox: "0 0 " + size + " " + size, style: props.style }, paths);
      }

      function CollapsibleSection(props) {
        var openState = ReactLib.useState(props.defaultOpen !== false);
        var open = openState[0];
        var setOpen = openState[1];
        return h("div", { className: "cv-collapse", style: props.style },
          h("button", {
            type: "button",
            className: "cv-collapse-h",
            "aria-expanded": open ? "true" : "false",
            onClick: function () { setOpen(!open); },
          },
            h("span", { "aria-hidden": "true" }, open ? "▾" : "▸"),
            h("span", { style: { flex: 1, fontWeight: 590 } }, props.title || props.header),
            props.trailing || null,
          ),
          open ? h("div", { className: "cv-collapse-b" }, props.children) : null,
        );
      }

      return {
        Stack: Stack, Row: Row, Grid: Grid,
        H1: H1, H2: H2, H3: H3, Text: Text, Pill: Pill, Stat: Stat,
        Card: Card, CardHeader: CardHeader, CardBody: CardBody,
        Callout: Callout, Code: Code, Divider: Divider, Spacer: Spacer,
        Button: Button, Link: Link, Table: Table,
        TodoList: TodoList, TodoListCard: TodoListCard,
        Swatch: Swatch, UsageBar: UsageBar,
        BarChart: BarChart, LineChart: LineChart, PieChart: PieChart,
        CollapsibleSection: CollapsibleSection,
        mergeStyle: mergeStyle,
        useHostTheme: useHostTheme,
        useCanvasState: useCanvasState,
        useCanvasAction: useCanvasAction,
        useState: ReactLib.useState,
        useMemo: ReactLib.useMemo,
        useEffect: ReactLib.useEffect,
        useRef: ReactLib.useRef,
        useCallback: ReactLib.useCallback,
        useId: ReactLib.useId,
        computeDAGLayout: computeDAGLayout,
        Fragment: ReactLib.Fragment,
        categoryPaletteDark: category,
        colorPalette: category,
      };
    }

    function ErrorBox(props) {
      return h("div", { className: "dsh-cv-err" }, props.message || "Render failed");
    }

    class Boundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) {
        return { error: error };
      }
      componentDidCatch() {}
      componentDidUpdate(prev) {
        if (prev.resetKey !== this.props.resetKey && this.state.error) {
          this.setState({ error: null });
        }
      }
      render() {
        if (this.state.error) {
          return h(ErrorBox, { message: String(this.state.error && this.state.error.message || this.state.error) });
        }
        return this.props.children;
      }
    }

    function CanvasMount(props) {
      var sdk = useMemo(function () { return createSdk(React); }, []);
      var App = useMemo(function () {
        if (!props.compiled) return null;
        try {
          var factory = new Function("React", "sdk", props.compiled);
          return factory(React, sdk);
        } catch (err) {
          return function Fail() {
            return h(ErrorBox, { message: String(err && err.message || err) });
          };
        }
      }, [props.compiled]);
      if (props.error && !App) return h(ErrorBox, { message: props.error });
      if (!App) {
        return h("pre", { className: "dsh-cv-src" }, props.source || "");
      }
      return h("div", { "data-dsh-cv-canvas": "" },
        h(Boundary, { resetKey: props.path }, h(App)),
      );
    }

    function ViewerShell() {
      var _open = useState(null);
      var doc = _open[0];
      var setDoc = _open[1];
      var _pos = useState({
        top: 48,
        left: Math.max(16, Math.round((window.innerWidth - Math.min(880, window.innerWidth - 40)) / 2)),
        height: Math.min(720, Math.round(window.innerHeight * 0.78)),
      });
      var pos = _pos[0];
      var setPos = _pos[1];
      var _copied = useState(false);
      var copied = _copied[0];
      var setCopied = _copied[1];
      var seen = useRef(0);
      var dismissed = useRef(0);
      var drag = useRef(null);
      var copyTimer = useRef(0);

      var close = useCallback(function (event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        dismissed.current = seen.current;
        setCopied(false);
        setDoc(null);
      }, []);

      var applyDoc = useCallback(function (payload) {
        if (!payload || !payload.path) return;
        var seq = payload.seq || 0;
        if (seq && seq <= dismissed.current) return;
        seen.current = seq || seen.current;
        setDoc(payload);
      }, []);

      var openPath = useCallback(function (path) {
        dismissed.current = 0;
        fetch(API + "/open", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: path }),
        }).then(function (res) { return res.json(); }).then(function (payload) {
          if (payload && payload.ok === false) throw new Error(payload.error || "open failed");
          applyDoc(payload);
        }).catch(function (err) {
          setDoc({
            seq: seen.current,
            path: path,
            title: path.split("/").pop(),
            source: "",
            compiled: "",
            error: String(err && err.message || err),
          });
        });
      }, [applyDoc]);

      useEffect(function () {
        ensureCss();
        var timer = window.setInterval(function () {
          fetch(API + "/peek").then(function (res) { return res.json(); }).then(function (payload) {
            if (payload && payload.seq && payload.seq > seen.current && payload.seq > dismissed.current) {
              applyDoc(payload);
            }
          }).catch(function () {});
        }, 700);
        var onClick = function (event) {
          var path = pathFromEvent(event);
          if (!path) return;
          event.preventDefault();
          event.stopPropagation();
          openPath(path);
        };
        var onKey = function (event) {
          if (event.key === "Escape") close();
        };
        document.addEventListener("click", onClick, true);
        window.addEventListener("keydown", onKey);
        return function () {
          window.clearInterval(timer);
          document.removeEventListener("click", onClick, true);
          window.removeEventListener("keydown", onKey);
        };
      }, [applyDoc, openPath, close]);

      var onBarDown = function (event) {
        if (event.button !== 0) return;
        if (event.target && event.target.closest && event.target.closest("button")) return;
        drag.current = {
          kind: "move",
          x: event.clientX,
          y: event.clientY,
          left: pos.left,
          top: pos.top,
        };
        event.preventDefault();
      };
      var onResizeDown = function (event) {
        drag.current = {
          kind: "resize",
          y: event.clientY,
          height: pos.height,
        };
        event.preventDefault();
      };

      useEffect(function () {
        var onMove = function (event) {
          var d = drag.current;
          if (!d) return;
          if (d.kind === "move") {
            setPos(function (prev) {
              return Object.assign({}, prev, {
                left: Math.max(8, d.left + (event.clientX - d.x)),
                top: Math.max(8, d.top + (event.clientY - d.y)),
              });
            });
          } else {
            setPos(function (prev) {
              return Object.assign({}, prev, {
                height: Math.max(240, d.height + (event.clientY - d.y)),
              });
            });
          }
        };
        var onUp = function () { drag.current = null; };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return function () {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
      }, []);

      var copySource = function (event) {
        if (event) event.stopPropagation();
        if (!doc || !doc.source) return;
        var done = function () {
          setCopied(true);
          window.clearTimeout(copyTimer.current);
          copyTimer.current = window.setTimeout(function () { setCopied(false); }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(doc.source).then(done, done);
        } else {
          done();
        }
      };
      var downloadSource = function (event) {
        if (event) event.stopPropagation();
        if (!doc || !doc.source) return;
        var blob = new Blob([doc.source], { type: "text/plain;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = doc.title || "report.canvas.tsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      };
      var stopDrag = function (event) { event.stopPropagation(); };

      if (!doc) return h("span", { "data-dsh-cv-idle": "" });

      var shortPath = (doc.path || "").replace(/^\/Users\/[^/]+/, "~");

      return h("div", {
        className: "dsh-cv-win",
        "data-dsh-cv-root": "",
        style: {
          top: pos.top + "px",
          left: pos.left + "px",
          width: "min(880px, calc(100vw - 40px))",
          height: pos.height + "px",
        },
      },
        h("div", { className: "dsh-cv-bar", onMouseDown: onBarDown },
          h("span", { className: "dsh-cv-dot", "aria-hidden": "true" }),
          h("div", { className: "dsh-cv-titlewrap" },
            h("div", { className: "dsh-cv-title" }, doc.title || "Canvas"),
            h("div", { className: "dsh-cv-sub", title: doc.path }, shortPath),
          ),
          h("div", { className: "dsh-cv-actions", onMouseDown: stopDrag },
            h("button", {
              type: "button",
              className: "dsh-cv-btn",
              "data-copied": copied ? "1" : "0",
              onClick: copySource,
            }, copied ? "已复制" : "复制源码"),
            h("button", { type: "button", className: "dsh-cv-btn", onClick: downloadSource }, "下载"),
            h("button", {
              type: "button",
              className: "dsh-cv-btn dsh-cv-close",
              "aria-label": "关闭",
              onClick: close,
            }, "×"),
          ),
        ),
        h("div", { className: "dsh-cv-body", "data-dsh-cv-canvas": "" },
          h(CanvasMount, {
            path: doc.path,
            source: doc.source,
            compiled: doc.compiled,
            error: doc.error,
          }),
        ),
        h("div", { className: "dsh-cv-resize", onMouseDown: onResizeDown }),
      );
    }

    function formatBytes(n) {
      if (!n) return "0 B";
      if (n < 1024) return n + " B";
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
      return (n / (1024 * 1024)).toFixed(1) + " MB";
    }

    function formatTime(ms) {
      if (!ms) return "—";
      try {
        return new Date(ms).toLocaleString();
      } catch {
        return String(ms);
      }
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return Promise.reject(new Error("clipboard unavailable"));
    }

    function apiGet(path) {
      return fetch(path).then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok || body.ok === false) throw new Error((body && body.error) || ("HTTP " + res.status));
          return body;
        });
      });
    }

    function apiPost(path, body) {
      return fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {}),
      }).then(function (res) {
        return res.json().then(function (payload) {
          if (!res.ok || payload.ok === false) throw new Error((payload && payload.error) || ("HTTP " + res.status));
          return payload;
        });
      });
    }

    function useToast() {
      var state = useState("");
      var toast = state[0];
      var setToast = state[1];
      var timer = useRef(0);
      var show = useCallback(function (message) {
        setToast(message);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(function () { setToast(""); }, 1600);
      }, []);
      return { toast: toast, show: show };
    }

    function CanvasRow(props) {
      var item = props.item;
      var onOpen = props.onOpen;
      var onCopied = props.onCopied;
      var onForget = props.onForget;
      var busy = useState("");
      var action = busy[0];
      var setAction = busy[1];

      var runCopy = function (kind) {
        setAction(kind);
        apiGet(API + "/refs?path=" + encodeURIComponent(item.path)).then(function (payload) {
          var refs = payload.refs || {};
          var text = refs[kind] || refs.path || item.path;
          return copyText(text).then(function () {
            onCopied(kind === "markdownLink" ? "已复制 Markdown 链接" : kind === "mention" ? "已复制 @ 引用" : kind === "toolHint" ? "已复制工具提示" : "已复制路径");
          });
        }).catch(function (err) {
          onCopied(String(err && err.message || err));
        }).finally(function () { setAction(""); });
      };

      return h("li", { className: "dsh-cv-lib-row", "data-missing": item.missing ? "1" : "0" },
        h("div", { className: "dsh-cv-lib-row-main" },
          h("div", { className: "dsh-cv-lib-row-text" },
            h("div", { className: "dsh-cv-lib-row-title" }, item.title),
            h("div", { className: "dsh-cv-lib-row-path" }, item.shortPath || item.path),
            h("div", { className: "dsh-cv-lib-row-tags" },
              h("span", { className: "dsh-cv-lib-chip" }, item.workspace || "工作区"),
              h("span", { className: "dsh-cv-lib-chip" }, formatBytes(item.bytes)),
              h("span", { className: "dsh-cv-lib-chip" }, item.openedAt ? ("打开于 " + formatTime(item.openedAt)) : ("修改于 " + formatTime(item.mtimeMs))),
              item.missing ? h("span", { className: "dsh-cv-lib-chip" }, "文件已失效") : null,
            ),
          ),
        ),
        h("div", { className: "dsh-cv-lib-actions" },
          h("button", {
            type: "button",
            "data-primary": "1",
            disabled: !!item.missing,
            onClick: function () { onOpen(item.path); },
          }, "打开预览"),
          h("button", { type: "button", disabled: !!action, onClick: function () { runCopy("shortPath"); } }, action === "shortPath" ? "…" : "复制路径"),
          h("button", { type: "button", disabled: !!action, onClick: function () { runCopy("markdownLink"); } }, "Markdown"),
          h("button", { type: "button", disabled: !!action, onClick: function () { runCopy("mention"); } }, "@引用"),
          h("button", { type: "button", disabled: !!action, onClick: function () { runCopy("toolHint"); } }, "工具提示"),
          onForget ? h("button", {
            type: "button",
            onClick: function () { onForget(item.path); },
          }, "移出最近") : null,
        ),
      );
    }

    function CanvasLibraryPage() {
      var toastApi = useToast();
      var modeState = useState("recent");
      var mode = modeState[0];
      var setMode = modeState[1];
      var queryState = useState("");
      var query = queryState[0];
      var setQuery = queryState[1];
      var wsState = useState("all");
      var workspace = wsState[0];
      var setWorkspace = wsState[1];
      var dataState = useState({ loading: true, error: "", items: [], workspaces: [], count: 0 });
      var data = dataState[0];
      var setData = dataState[1];

      var reload = useCallback(function () {
        setData(function (prev) { return Object.assign({}, prev, { loading: true, error: "" }); });
        var req = mode === "recent"
          ? apiGet(API + "/history")
          : apiGet(API + "/list?q=" + encodeURIComponent(query));
        req.then(function (payload) {
          setData({
            loading: false,
            error: "",
            items: payload.items || [],
            workspaces: payload.workspaces || [],
            count: payload.count || 0,
            truncated: !!payload.truncated,
          });
        }).catch(function (err) {
          setData({
            loading: false,
            error: String(err && err.message || err),
            items: [],
            workspaces: [],
            count: 0,
          });
        });
      }, [mode, query]);

      useEffect(function () {
        var timer = window.setTimeout(reload, mode === "all" ? 220 : 0);
        return function () { window.clearTimeout(timer); };
      }, [reload, mode]);

      var items = (data.items || []).filter(function (item) {
        return workspace === "all" || item.workspaceId === workspace;
      });

      var openPath = function (path) {
        apiPost(API + "/open", { path: path }).then(function () {
          toastApi.show("已在浮窗打开");
        }).catch(function (err) {
          toastApi.show(String(err && err.message || err));
        });
      };

      var forget = function (path) {
        apiPost(API + "/history/forget", { path: path }).then(reload).catch(function (err) {
          toastApi.show(String(err && err.message || err));
        });
      };

      var clearRecent = function () {
        apiPost(API + "/history/clear", {}).then(function () {
          toastApi.show("已清空最近记录");
          reload();
        }).catch(function (err) {
          toastApi.show(String(err && err.message || err));
        });
      };

      return h("div", { className: "dsh-cv-lib", "data-dsh-cv-lib": "" },
        h("div", { className: "dsh-cv-lib-head" },
          h("h3", { className: "dsh-cv-lib-title" }, "Canvas 图库"),
          h("p", { className: "dsh-cv-lib-desc" },
            "浏览本机 Cursor canvases，打开页面内预览，或复制路径 / Markdown / @引用给对话使用。"),
        ),
        h("div", { className: "dsh-cv-lib-toolbar" },
          h("div", { className: "dsh-cv-lib-seg" },
            h("button", { type: "button", "data-on": mode === "recent" ? "1" : "0", onClick: function () { setMode("recent"); } }, "最近"),
            h("button", { type: "button", "data-on": mode === "all" ? "1" : "0", onClick: function () { setMode("all"); } }, "全部"),
          ),
          mode === "all" ? h("input", {
            className: "dsh-cv-lib-search",
            value: query,
            placeholder: "搜索文件名、路径或工作区…",
            onChange: function (event) { setQuery(event.target.value); },
          }) : null,
          h("select", {
            className: "dsh-cv-lib-select",
            value: workspace,
            onChange: function (event) { setWorkspace(event.target.value); },
          },
            h("option", { value: "all" }, "全部工作区"),
            (data.workspaces || []).map(function (ws) {
              return h("option", { key: ws.id, value: ws.id }, ws.label);
            }),
          ),
          h("button", { type: "button", className: "dsh-cv-btn", onClick: reload }, "刷新"),
          mode === "recent" ? h("button", { type: "button", className: "dsh-cv-btn", onClick: clearRecent }, "清空最近") : null,
        ),
        h("div", { className: "dsh-cv-lib-meta" },
          data.loading ? "加载中…" : (data.error ? ("加载失败：" + data.error) : ("共 " + items.length + " 项" + (data.truncated ? "（已截断前 200）" : ""))),
        ),
        !data.loading && !data.error && items.length === 0
          ? h("div", { className: "dsh-cv-lib-empty" }, mode === "recent" ? "还没有打开记录。点对话里的 .canvas.tsx，或切到「全部」浏览。" : "没有匹配的 canvas 文件。")
          : h("ul", { className: "dsh-cv-lib-list" },
            items.map(function (item) {
              return h(CanvasRow, {
                key: item.path + String(item.openedAt || item.mtimeMs || 0),
                item: item,
                onOpen: openPath,
                onCopied: toastApi.show,
                onForget: mode === "recent" ? forget : null,
              });
            }),
          ),
        toastApi.toast ? h("div", { className: "dsh-cv-lib-toast", role: "status" }, toastApi.toast) : null,
      );
    }

    function WebUiCanvasCard() {
      var openState = useState(true);
      var open = openState[0];
      var setOpen = openState[1];
      var toastApi = useToast();
      var recentState = useState([]);
      var recent = recentState[0];
      var setRecent = recentState[1];

      useEffect(function () {
        if (!open) return;
        apiGet(API + "/history").then(function (payload) {
          setRecent((payload.items || []).slice(0, 5));
        }).catch(function () {
          setRecent([]);
        });
      }, [open]);

      return h("li", { className: "dsh-cv-card" },
        h("button", {
          type: "button",
          className: "dsh-cv-card-h",
          "aria-expanded": open ? "true" : "false",
          onClick: function () { setOpen(!open); },
        },
          h("span", { style: { flex: 1, minWidth: 0 } },
            h("span", { className: "dsh-cv-card-name" }, "Canvas Viewer"),
            h("span", { className: "dsh-cv-card-desc" }, "浏览历史 canvas、预览浮窗、复制引用链接"),
          ),
          h("span", { "aria-hidden": "true" }, open ? "▾" : "▸"),
        ),
        open ? h("div", { className: "dsh-cv-card-b" },
          h("p", { className: "dsh-cv-lib-desc" },
            "完整图库在「设置 → 插件 → Canvas 图库」。这里快速打开最近文件。"),
          recent.length === 0
            ? h("div", { className: "dsh-cv-lib-empty" }, "暂无最近记录")
            : h("ul", { className: "dsh-cv-lib-list" },
              recent.map(function (item) {
                return h(CanvasRow, {
                  key: item.path,
                  item: item,
                  onOpen: function (path) {
                    apiPost(API + "/open", { path: path }).then(function () {
                      toastApi.show("已在浮窗打开");
                    }).catch(function (err) {
                      toastApi.show(String(err && err.message || err));
                    });
                  },
                  onCopied: toastApi.show,
                });
              }),
            ),
          toastApi.toast ? h("div", { className: "dsh-cv-lib-toast", role: "status" }, toastApi.toast) : null,
        ) : null,
      );
    }

    var inject = ["slots"];

    function apply(ctx) {
      ensureCss();

      var container = document.createElement("div");
      container.dataset.dshCanvasViewer = "";
      document.body.appendChild(container);
      var root = ReactDOM.createRoot(container);
      root.render(h(ViewerShell));
      ctx.effect(function () {
        return function () {
          root.unmount();
          container.remove();
        };
      }, "canvas-viewer: floating-window");

      // Inspected extension point: settings.plugins.tab (Plugins section tabs).
      ctx.slots.inject("settings.plugins.tab", function () {
        return ctx.slots.register({
          name: "settings.plugins.tab",
          id: "canvas-library",
          order: 40,
          label: "Canvas 图库",
        }, CanvasLibraryPage);
      });

      // Optional companion card inside the community Web UI plugin group.
      ctx.slots.inject("web-ui.plugin.item", function () {
        return ctx.slots.register({
          name: "web-ui.plugin.item",
          id: "canvas-viewer",
          order: 150,
        }, WebUiCanvasCard);
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
