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
      "[data-dsh-cv-root]{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#e8e8ea;}",
      "[data-dsh-cv-root] *,[data-dsh-cv-root] *::before,[data-dsh-cv-root] *::after{box-sizing:border-box;}",
      ".dsh-cv-win{position:fixed;z-index:2147483000;display:flex;flex-direction:column;min-width:480px;min-height:280px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);background:#161618;color:#e8e8ea;border:1px solid rgba(255,255,255,.08);border-radius:14px;box-shadow:0 28px 80px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.04);overflow:hidden;}",
      ".dsh-cv-bar{display:flex;align-items:center;gap:12px;height:52px;padding:0 8px 0 16px;background:#1c1c20;border-bottom:1px solid rgba(255,255,255,.06);cursor:grab;user-select:none;flex:0 0 auto;}",
      ".dsh-cv-bar:active{cursor:grabbing;}",
      ".dsh-cv-dot{width:8px;height:8px;border-radius:99px;background:#8bb4ff;flex:0 0 auto;box-shadow:0 0 0 4px rgba(139,180,255,.12);}",
      ".dsh-cv-titlewrap{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}",
      ".dsh-cv-title{font-size:13px;font-weight:600;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f3f3f5;}",
      ".dsh-cv-sub{font-size:10px;line-height:1.3;color:#8a8a90;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".dsh-cv-actions{display:flex;align-items:center;gap:4px;flex:0 0 auto;}",
      ".dsh-cv-btn{appearance:none;border:0;border-radius:8px;background:transparent;color:#c4c4c8;height:30px;padding:0 10px;font-size:12px;cursor:pointer;}",
      ".dsh-cv-btn:hover{background:rgba(255,255,255,.06);color:#fff;}",
      ".dsh-cv-btn[data-copied='1']{color:#9ccc9c;}",
      ".dsh-cv-close{width:32px;padding:0;font-size:18px;line-height:30px;color:#9a9aa0;}",
      ".dsh-cv-close:hover{background:#3a2226;color:#ffc4c8;}",
      ".dsh-cv-body{flex:1;min-height:0;overflow:auto;padding:22px 24px 40px;user-select:text;cursor:auto;background:#161618;}",
      ".dsh-cv-body::-webkit-scrollbar{width:10px;}",
      ".dsh-cv-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:99px;}",
      ".dsh-cv-err{font-size:12px;color:#f0b4b4;white-space:pre-wrap;}",
      ".dsh-cv-src{font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;color:#c8c8c8;}",
      ".dsh-cv-resize{position:absolute;left:0;right:0;bottom:0;height:14px;cursor:ns-resize;}",
      ".dsh-cv-resize::after{content:'';display:block;width:40px;height:3px;margin:6px auto 0;border-radius:99px;background:rgba(255,255,255,.2);}",
      ".cv-stack{display:flex;flex-direction:column;}",
      ".cv-row{display:flex;flex-wrap:wrap;align-items:center;}",
      ".cv-grid{display:grid;align-items:start;}",
      ".cv-h1{margin:0;font-size:24px;line-height:1.25;font-weight:650;letter-spacing:-.03em;color:#f6f6f7;}",
      ".cv-h2{margin:0;font-size:16px;line-height:1.35;font-weight:620;color:#f0f0f2;}",
      ".cv-h3{margin:0;font-size:13px;line-height:1.4;font-weight:600;color:#b8b8be;}",
      ".cv-text{margin:0;font-size:13px;line-height:1.6;color:#d2d2d6;}",
      ".cv-muted{color:#8f8f96;}",
      ".cv-pill{appearance:none;border:0;border-radius:999px;background:transparent;color:#9a9aa2;font-size:12px;padding:6px 12px;cursor:pointer;}",
      ".cv-pill:hover{background:rgba(255,255,255,.05);color:#e8e8ea;}",
      ".cv-pill[data-on='1']{background:rgba(139,180,255,.14);color:#d7e6ff;}",
      ".cv-stat{border:1px solid rgba(255,255,255,.06);background:#1c1c20;padding:12px 14px;min-width:0;border-radius:10px;}",
      ".cv-stat b{display:block;font-size:15px;font-weight:650;letter-spacing:-.02em;word-break:break-word;color:#f3f3f5;}",
      ".cv-stat span{display:block;margin-top:6px;font-size:11px;line-height:1.4;color:#8f8f96;}",
      ".cv-card{border:1px solid rgba(255,255,255,.06);background:#1c1c20;border-radius:10px;overflow:hidden;}",
      ".cv-card-h{padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px;font-weight:600;color:#f0f0f2;}",
      ".cv-card-b{padding:14px;}",
      ".cv-callout{border:1px solid rgba(255,255,255,.06);border-left:3px solid #8bb4ff;padding:12px 14px;font-size:13px;line-height:1.55;background:#1c1c20;border-radius:10px;}",
      ".cv-callout[data-tone='danger']{border-left-color:#e8a0a0;background:#241818;}",
      ".cv-callout[data-tone='warning']{border-left-color:#e0c07a;background:#231e14;}",
      ".cv-callout[data-tone='success']{border-left-color:#8fce9a;background:#142018;}",
      ".cv-table{width:100%;border-collapse:collapse;font-size:12px;}",
      ".cv-table th,.cv-table td{border-bottom:1px solid rgba(255,255,255,.06);text-align:left;padding:9px 10px;vertical-align:top;}",
      ".cv-table th{color:#8f8f96;font-weight:600;background:#1a1a1e;}",
      ".cv-code{font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;background:#111114;border:1px solid rgba(255,255,255,.06);padding:1px 6px;border-radius:4px;}",
      ".cv-div{height:1px;background:rgba(255,255,255,.06);border:0;margin:8px 0;}",
      ".dsh-cv-lib{display:flex;flex-direction:column;gap:14px;max-width:920px;}",
      ".dsh-cv-lib-head{display:flex;flex-direction:column;gap:4px;}",
      ".dsh-cv-lib-title{margin:0;font-size:18px;font-weight:650;letter-spacing:-.02em;}",
      ".dsh-cv-lib-desc{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-text-secondary,#8f8f96);}",
      ".dsh-cv-lib-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}",
      ".dsh-cv-lib-search{flex:1;min-width:180px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:inherit;padding:0 12px;font-size:13px;}",
      ".dsh-cv-lib-search:focus{outline:none;border-color:rgba(139,180,255,.45);}",
      ".dsh-cv-lib-seg{display:inline-flex;gap:2px;padding:3px;border-radius:10px;background:rgba(255,255,255,.04);}",
      ".dsh-cv-lib-seg button{appearance:none;border:0;border-radius:8px;background:transparent;color:#9a9aa2;height:28px;padding:0 10px;font-size:12px;cursor:pointer;}",
      ".dsh-cv-lib-seg button[data-on='1']{background:rgba(139,180,255,.16);color:#d7e6ff;}",
      ".dsh-cv-lib-select{height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:inherit;padding:0 10px;font-size:12px;}",
      ".dsh-cv-lib-meta{font-size:12px;color:#8f8f96;}",
      ".dsh-cv-lib-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;}",
      ".dsh-cv-lib-row{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);}",
      ".dsh-cv-lib-row[data-missing='1']{opacity:.62;}",
      ".dsh-cv-lib-row-main{display:flex;gap:12px;align-items:flex-start;}",
      ".dsh-cv-lib-row-text{flex:1;min-width:0;}",
      ".dsh-cv-lib-row-title{font-size:13px;font-weight:600;word-break:break-all;}",
      ".dsh-cv-lib-row-path{font-size:11px;color:#8f8f96;word-break:break-all;margin-top:3px;}",
      ".dsh-cv-lib-row-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}",
      ".dsh-cv-lib-chip{font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.05);color:#b8b8be;}",
      ".dsh-cv-lib-actions{display:flex;flex-wrap:wrap;gap:6px;}",
      ".dsh-cv-lib-actions button{appearance:none;border:0;border-radius:8px;background:rgba(255,255,255,.05);color:#d4d4d8;height:28px;padding:0 10px;font-size:12px;cursor:pointer;}",
      ".dsh-cv-lib-actions button:hover{background:rgba(255,255,255,.09);color:#fff;}",
      ".dsh-cv-lib-actions button[data-primary='1']{background:rgba(139,180,255,.18);color:#d7e6ff;}",
      ".dsh-cv-lib-empty{font-size:13px;color:#8f8f96;padding:18px 0;}",
      ".dsh-cv-lib-toast{position:fixed;right:20px;bottom:20px;z-index:2147483646;padding:10px 14px;border-radius:10px;background:#1f2430;border:1px solid rgba(139,180,255,.25);color:#e8eefc;font-size:12px;box-shadow:0 12px 40px rgba(0,0,0,.35);}",
      ".dsh-cv-card{list-style:none;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.03);overflow:hidden;}",
      ".dsh-cv-card-h{width:100%;appearance:none;border:0;background:transparent;color:inherit;text-align:left;padding:14px 16px;cursor:pointer;display:flex;gap:12px;align-items:center;}",
      ".dsh-cv-card-h:hover{background:rgba(255,255,255,.03);}",
      ".dsh-cv-card-name{display:block;font-size:14px;font-weight:600;}",
      ".dsh-cv-card-desc{display:block;font-size:12px;color:#8f8f96;margin-top:2px;}",
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
      ranks.forEach(function (r) {
        groups[r].forEach(function (id, order) {
          var x = direction === "horizontal"
            ? padding + r * (nodeWidth + rankGap)
            : padding + order * (nodeWidth + nodeGap);
          var y = direction === "horizontal"
            ? padding + order * (nodeHeight + nodeGap)
            : padding + r * (nodeHeight + rankGap);
          pos[id] = { id: id, x: x, y: y, rank: r, order: order };
          width = Math.max(width, x + nodeWidth + padding);
          height = Math.max(height, y + nodeHeight + padding);
        });
      });
      var layoutEdges = edges.map(function (edge) {
        var a = pos[edge.from];
        var b = pos[edge.to];
        if (!a || !b) return null;
        if (direction === "horizontal") {
          return {
            from: edge.from, to: edge.to,
            sourceX: a.x + nodeWidth, sourceY: a.y + nodeHeight / 2,
            targetX: b.x, targetY: b.y + nodeHeight / 2,
            isBackEdge: false,
          };
        }
        return {
          from: edge.from, to: edge.to,
          sourceX: a.x + nodeWidth / 2, sourceY: a.y + nodeHeight,
          targetX: b.x + nodeWidth / 2, targetY: b.y,
          isBackEdge: false,
        };
      }).filter(Boolean);
      return {
        nodes: ids.map(function (id) { return pos[id]; }).filter(Boolean),
        edges: layoutEdges,
        ranks: ranks,
        direction: direction,
        width: width,
        height: height,
      };
    }

    function createSdk(ReactLib) {
      var tokens = {
        bg: { editor: "#141414", chrome: "#1c1c1c", elevated: "#1f1f1f" },
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
        category: {
          blue: "#8ab4f8",
          green: "#9ccc9c",
          orange: "#f6c177",
          red: "#e8a0a0",
          purple: "#c4b5fd",
        },
      };
      var theme = Object.assign({
        kind: "dark",
        tokens: tokens,
        palette: ["#8ab4f8", "#f6c177", "#9ccc9c", "#e8a0a0", "#c4b5fd"],
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
          style: Object.assign({ gap: gapStyle(props.gap) }, props.style),
        }, props.children);
      }
      function Row(props) {
        return h("div", {
          className: "cv-row",
          style: Object.assign({
            gap: gapStyle(props.gap),
            alignItems: props.align || "center",
            flexWrap: props.wrap === false ? "nowrap" : "wrap",
          }, props.style),
        }, props.children);
      }
      function Grid(props) {
        var columns = props.columns || 2;
        return h("div", {
          className: "cv-grid",
          style: Object.assign({
            gap: gapStyle(props.gap),
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
        var tone = props.tone || props.variant;
        var tag = props.as || "p";
        return h(tag, {
          className: "cv-text" + (tone === "secondary" || tone === "muted" || tone === "tertiary" ? " cv-muted" : ""),
          style: Object.assign({
            display: tag === "span" ? "inline" : undefined,
            fontSize: props.size === "small" ? 12 : undefined,
            fontWeight: props.weight === "semibold" || props.weight === "bold" ? 600 : undefined,
          }, props.style),
        }, props.children);
      }
      function Pill(props) {
        var on = props.selected || props.active || props.current ? "1" : "0";
        return h("button", {
          type: "button",
          className: "cv-pill",
          "data-on": on,
          onClick: props.onClick,
          style: props.style,
        }, props.children);
      }
      function Stat(props) {
        return h("div", { className: "cv-stat", style: props.style },
          h("b", null, props.value != null ? String(props.value) : props.children),
          h("span", null, props.label || props.title || ""));
      }
      function Card(props) {
        return h("div", { className: "cv-card", style: props.style }, props.children);
      }
      function CardHeader(props) {
        return h("div", { className: "cv-card-h", style: props.style }, props.title || props.children);
      }
      function CardBody(props) {
        return h("div", { className: "cv-card-b", style: props.style }, props.children);
      }
      function Callout(props) {
        return h("div", {
          className: "cv-callout",
          "data-tone": props.tone || props.variant || "info",
          style: props.style,
        }, props.title ? [h("strong", { key: "t" }, props.title), " ", props.children] : props.children);
      }
      function Code(props) {
        return h("code", { className: "cv-code", style: props.style }, props.children);
      }
      function Divider() { return h("hr", { className: "cv-div" }); }
      function Spacer(props) {
        return h("div", { style: { flex: props.grow != null ? props.grow : 1, height: props.size || 8 } });
      }
      function Button(props) {
        return h("button", {
          type: "button",
          className: "dsh-cv-btn",
          onClick: props.onClick,
          style: props.style,
        }, props.children);
      }
      function Link(props) {
        return h("a", {
          href: props.href || props.to || "#",
          target: props.target,
          style: Object.assign({ color: "#8ab4f8" }, props.style),
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
        return h("table", { className: "cv-table", style: props.style },
          h("thead", null, h("tr", null, headers.map(function (head, i) {
            return h("th", { key: i }, head);
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
            return h("tr", { key: i }, cells.map(function (cell, j) {
              return h("td", { key: j }, cell);
            }));
          })),
        );
      }
      function TodoListCard(props) {
        var todos = props.todos || props.items || [];
        return h(Card, null,
          h(CardHeader, { title: props.title || "Todos" }),
          h(CardBody, null,
            h("ul", { style: { margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 } },
              todos.map(function (todo, i) {
                var label = typeof todo === "string" ? todo : (todo.content || todo.text || todo.title);
                var status = typeof todo === "string" ? "" : (todo.status || "");
                return h("li", { key: todo.id || i }, (status ? "[" + status + "] " : "") + label);
              }),
            ),
          ),
        );
      }

      return {
        Stack: Stack, Row: Row, Grid: Grid,
        H1: H1, H2: H2, H3: H3, Text: Text, Pill: Pill, Stat: Stat,
        Card: Card, CardHeader: CardHeader, CardBody: CardBody,
        Callout: Callout, Code: Code, Divider: Divider, Spacer: Spacer,
        Button: Button, Link: Link, Table: Table, TodoListCard: TodoListCard,
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
      return h(Boundary, { resetKey: props.path }, h(App));
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
        h("div", { className: "dsh-cv-body" },
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
