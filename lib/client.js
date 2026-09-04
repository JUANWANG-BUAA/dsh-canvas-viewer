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
    var externalOpen = null;

    /* @client-module styles: static host/window/gallery tokens */
    var css = [
      /* Window chrome */
      "[data-dsh-cv-root],[data-dsh-cv-canvas],[data-dsh-cv-lib],[data-dsh-cv-tail]{--cv-editor:#171b21;--cv-chrome:rgba(26,29,34,.96);--cv-elevated:rgba(42,45,51,.96);--cv-fg:#f2f2f4;--cv-fg-2:#d0d2d7;--cv-fg-3:#989da5;--cv-fg-4:#737983;--cv-link:#b5c2ce;--cv-accent:#aebdca;--cv-accent-hover:#c7d3dc;--cv-on-accent:#131619;--cv-stroke-1:rgba(255,255,255,.12);--cv-stroke-2:rgba(0,0,0,.28);--cv-stroke-3:rgba(255,255,255,.055);--cv-stroke-focus:#c4d0da;--cv-fill-1:rgba(255,255,255,.1);--cv-fill-2:rgba(255,255,255,.065);--cv-fill-3:rgba(255,255,255,.045);--cv-fill-4:rgba(0,0,0,.12);--cv-cat-blue:#91b2c8;--cv-cat-green:#86c8a0;--cv-cat-orange:#dfbd7f;--cv-cat-red:#dc9298;--cv-cat-purple:#c4b8d2;--cv-cat-yellow:#d7bd76;--cv-cat-cyan:#89c1bb;--cv-cat-pink:#d3a2ba;--cv-cat-gray:#9ba3aa;--cv-glass:rgba(18,21,26,.88);--cv-glass-strong:rgba(34,37,43,.72);--cv-glass-line:rgba(0,0,0,.42);--cv-glass-inner:rgba(255,255,255,.1);--cv-glass-shadow:0 28px 72px rgba(0,0,0,.38),0 8px 24px rgba(0,0,0,.2);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','system-ui','Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei','Helvetica Neue',Helvetica,Arial,sans-serif;color:var(--cv-fg,#edf0f2);}",
      "html[data-dsh-cv-theme='light'] [data-dsh-cv-root],html[data-dsh-cv-theme='light'] [data-dsh-cv-canvas],html[data-dsh-cv-theme='light'] [data-dsh-cv-lib],html[data-dsh-cv-theme='light'] [data-dsh-cv-tail]{--cv-editor:#f2f3f5;--cv-chrome:rgba(252,252,253,.96);--cv-elevated:#fff;--cv-fg:#1c1c1e;--cv-fg-2:#48484a;--cv-fg-3:#6e6e73;--cv-fg-4:#8e8e93;--cv-link:#456579;--cv-accent:#718796;--cv-accent-hover:#5c7484;--cv-on-accent:#fff;--cv-stroke-1:rgba(60,60,67,.18);--cv-stroke-2:rgba(60,60,67,.14);--cv-stroke-3:rgba(60,60,67,.09);--cv-stroke-focus:#637b8b;--cv-fill-1:rgba(60,60,67,.11);--cv-fill-2:rgba(60,60,67,.07);--cv-fill-3:rgba(60,60,67,.045);--cv-fill-4:rgba(60,60,67,.025);--cv-glass:rgba(248,249,251,.98);--cv-glass-strong:rgba(252,252,253,.96);--cv-glass-line:rgba(60,60,67,.19);--cv-glass-inner:rgba(255,255,255,.94);--cv-glass-shadow:0 28px 72px rgba(43,50,58,.2),0 8px 24px rgba(43,50,58,.1);color:var(--cv-fg,#1c1c1e);}",
      "[data-dsh-cv-root] *,[data-dsh-cv-root] *::before,[data-dsh-cv-root] *::after{box-sizing:border-box;}",
      "@keyframes dshCvIn{from{opacity:0;transform:translateY(10px) scale(.98);}to{opacity:1;transform:none;}}",
      ".dsh-cv-win{position:fixed;z-index:2147483000;display:flex;flex-direction:column;min-width:480px;min-height:280px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);padding:1px;background:var(--cv-glass);color:var(--cv-fg,#edf0f2);border:1px solid var(--cv-glass-line);border-radius:19px;backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:var(--cv-glass-shadow),0 1px 0 var(--cv-glass-inner) inset;outline:none;overflow:hidden;isolation:isolate;animation:dshCvIn .24s cubic-bezier(.2,.72,.18,1);transition:top .28s cubic-bezier(.2,.72,.18,1),left .28s cubic-bezier(.2,.72,.18,1),width .28s cubic-bezier(.2,.72,.18,1),height .28s cubic-bezier(.2,.72,.18,1),border-radius .22s ease,background-color .18s ease;}",
      ".dsh-cv-win::before{content:'';position:absolute;z-index:0;inset:0;border-radius:18px;pointer-events:none;background:linear-gradient(145deg,rgba(255,255,255,.2),transparent 21% 78%,rgba(255,255,255,.045));opacity:.72;}",
      ".dsh-cv-win::after{content:'';position:absolute;z-index:0;inset:1px;border-radius:17px;pointer-events:none;box-shadow:inset 0 1px 0 var(--cv-glass-inner),inset 0 -1px 0 rgba(0,0,0,.16);}",
      ".dsh-cv-win[data-dragging='1'],body[data-dsh-liquid-glass] .dsh-cv-win[data-dsh-cv-root][data-dragging='1']{transition:none!important;}",
      "body[data-dsh-liquid-glass] .dsh-cv-win[data-dsh-cv-root][data-dsh-liquid-surface='dialog']{background:var(--cv-glass)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transition:top .28s cubic-bezier(.2,.72,.18,1),left .28s cubic-bezier(.2,.72,.18,1),width .28s cubic-bezier(.2,.72,.18,1),height .28s cubic-bezier(.2,.72,.18,1),border-radius .22s ease,background-color .18s ease!important;}",
      ".dsh-cv-win>*{position:relative;z-index:1;}",
      ".dsh-cv-bar{position:relative;display:flex;align-items:center;gap:8px;height:44px;padding:0 8px 0 12px;background:var(--cv-glass-strong);border-bottom:1px solid var(--cv-stroke-2);border-radius:17px 17px 0 0;box-shadow:0 1px 0 var(--cv-glass-inner) inset;cursor:grab;user-select:none;flex:0 0 auto;}",
      ".dsh-cv-bar:active{cursor:grabbing;}",
      ".dsh-cv-traffic{display:flex;align-items:center;gap:8px;padding:0 4px;flex:0 0 auto;}",
      ".dsh-cv-traffic-btn{appearance:none;display:grid;place-items:center;width:12px;height:12px;padding:0;border:0;border-radius:50%;color:rgba(38,27,24,.78);font:700 8px/1 -apple-system,BlinkMacSystemFont,sans-serif;cursor:default;box-shadow:0 0 0 .5px rgba(0,0,0,.24) inset;transition:filter .12s ease,transform .12s ease;}",
      ".dsh-cv-traffic-btn>span{opacity:0;transform:scale(.72);transition:opacity .1s ease,transform .12s ease;}",
      ".dsh-cv-traffic-btn[data-kind='close']>span{opacity:.64;transform:scale(1);}",
      ".dsh-cv-traffic:hover .dsh-cv-traffic-btn>span,.dsh-cv-traffic-btn:focus-visible>span{opacity:.82;transform:scale(1);}",
      ".dsh-cv-traffic-btn:hover{filter:brightness(1.05);}",
      ".dsh-cv-traffic-btn:active{transform:scale(.86);}",
      ".dsh-cv-traffic-btn:focus-visible{outline:2px solid color-mix(in srgb,var(--cv-stroke-focus) 76%,transparent);outline-offset:2px;}",
      ".dsh-cv-traffic-btn[data-kind='close']{background:#ff5f57;}",
      ".dsh-cv-traffic-btn[data-kind='minimize']{background:#febc2e;}",
      ".dsh-cv-traffic-btn[data-kind='zoom']{background:#28c840;}",
      ".dsh-cv-titlewrap{flex:1;min-width:0;display:block;}",
      ".dsh-cv-title{font-size:12.5px;font-weight:650;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--cv-fg,#ececec);}",
      ".dsh-cv-sub{display:none;}",
      ".dsh-cv-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto;}",
      ".dsh-cv-explicit-close{appearance:none;display:grid;place-items:center;width:30px;height:30px;padding:0;border:1px solid var(--cv-stroke-2);border-radius:9px;background:var(--cv-fill-2);color:var(--cv-fg-2);font:400 19px/1 -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer;box-shadow:0 1px 0 var(--cv-glass-inner) inset;transition:background .14s ease,color .14s ease,transform .12s ease,border-color .14s ease;}",
      ".dsh-cv-explicit-close:hover{border-color:color-mix(in srgb,var(--cv-cat-red) 32%,var(--cv-stroke-2));background:color-mix(in srgb,var(--cv-cat-red) 14%,var(--cv-fill-2));color:var(--cv-fg);}",
      ".dsh-cv-explicit-close:active{transform:scale(.94);}",
      ".dsh-cv-explicit-close:focus-visible{outline:2px solid color-mix(in srgb,var(--cv-stroke-focus) 74%,transparent);outline-offset:2px;}",
      ".dsh-cv-toolgroup{display:flex;align-items:center;height:30px;padding:2px;border:1px solid var(--cv-stroke-2);border-radius:9px;background:rgba(255,255,255,.045);box-shadow:0 1px 0 var(--cv-glass-inner) inset;}",
      ".dsh-cv-toolgroup .dsh-cv-btn+.dsh-cv-btn{border-left:1px solid var(--cv-stroke-2);border-radius:0 6px 6px 0;}",
      ".dsh-cv-toolgroup .dsh-cv-btn:first-child{border-radius:6px 0 0 6px;}",
      ".dsh-cv-toolgroup .dsh-cv-btn:only-child{border-radius:6px;}",
      ".dsh-cv-btn{appearance:none;border:0;border-radius:8px;background:transparent;color:var(--cv-fg-2,#c5c5c5);height:28px;padding:0 9px;font-size:11px;cursor:pointer;transition:background .12s ease,color .12s ease;}",
      ".dsh-cv-btn:hover{background:var(--cv-fill-2,#222);color:var(--cv-fg,#ececec);}",
      ".dsh-cv-btn:active{background:var(--cv-fill-1,#2a2a2a);transform:scale(.97);}",
      ".dsh-cv-btn:focus-visible{outline:2px solid color-mix(in srgb,var(--cv-stroke-focus) 74%,transparent);outline-offset:-2px;}",
      ".dsh-cv-btn[data-icon='1']{min-width:28px;padding:0 7px;font-size:12px;}",
      ".dsh-cv-zoom-value{min-width:44px;font-variant-numeric:tabular-nums;cursor:default;}",
      ".dsh-cv-btn[data-copied='1']{color:var(--cv-cat-green,#9ccc9c);}",
      ".dsh-cv-btn[data-variant='primary']{background:var(--cv-accent,#8ab4f8);color:var(--cv-on-accent,#0b0b0b);}",
      ".dsh-cv-btn[data-variant='primary']:hover{background:var(--cv-accent-hover,#a8c7fa);}",
      ".dsh-cv-btn[data-variant='secondary']{background:var(--cv-fill-1,#2a2a2a);}",
      ".dsh-cv-body{flex:1;min-height:0;overflow:auto;padding:28px 32px 56px;user-select:text;cursor:auto;background:var(--cv-editor);border-radius:0 0 17px 17px;overflow-wrap:anywhere;}",
      ".dsh-cv-body{scrollbar-width:none;}",
      ".dsh-cv-body::-webkit-scrollbar{width:0;height:0;}",
      ".dsh-cv-sandbox-wrap{width:100%;height:100%;display:flex;overflow:hidden;background:var(--cv-editor);}",
      ".dsh-cv-sandbox{flex:0 0 auto;width:calc(100% / var(--cv-scale,1));height:calc(100% / var(--cv-scale,1));min-width:0;min-height:0;border:0;background:var(--cv-editor);transform:scale(var(--cv-scale,1));transform-origin:top left;transition:transform .24s cubic-bezier(.2,.72,.18,1);}",
      ".dsh-cv-body:has(.dsh-cv-sandbox-wrap){padding:0;overflow:hidden;}",
      ".dsh-cv-body[data-split='1']{display:flex;padding:0;overflow:hidden;}",
      ".dsh-cv-render{flex:1;min-width:0;min-height:0;overflow:auto;padding:28px 32px 56px;user-select:text;cursor:auto;overflow-wrap:anywhere;}",
      ".dsh-cv-render:has(.dsh-cv-sandbox-wrap){padding:0;overflow:hidden;}",
      ".dsh-cv-render{scrollbar-width:none;}",
      ".dsh-cv-render::-webkit-scrollbar{width:0;height:0;}",
      ".dsh-cv-editor{display:flex;flex-direction:column;width:46%;min-width:280px;max-width:60%;border-left:1px solid var(--cv-stroke-2);background:var(--cv-chrome);flex:0 0 auto;}",
      ".dsh-cv-src-edit{flex:1;min-height:120px;resize:none;border:0;outline:0;background:transparent;color:var(--cv-fg-2,#c6cde2);font:12px/1.65 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:14px 16px;tab-size:2;white-space:pre;overflow:auto;}",
      ".dsh-cv-editor-meta{display:flex;align-items:center;gap:10px;padding:8px 12px;border-top:1px solid var(--cv-stroke-2);color:var(--cv-fg-3,#98a2c0);font-size:11px;flex:0 0 auto;}",
      ".dsh-cv-editor-meta .dsh-cv-btn{margin-left:auto;}",
      ".dsh-cv-btn[data-active='1']{background:var(--cv-accent);color:var(--cv-on-accent);border-color:var(--cv-accent);}",
      ".dsh-cv-sandbox-fallback{display:flex;flex-direction:column;gap:10px;align-items:flex-start;padding:24px;}",
      ".dsh-cv-err{font-size:12px;color:var(--cv-cat-red,#e8a0a0);white-space:pre-wrap;}",
      ".dsh-cv-src{font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;color:var(--cv-fg-2,#c5c5c5);}",
      ".dsh-cv-win[data-max='1']{border-radius:13px;}",
      ".dsh-cv-win[data-collapsed='1']{min-height:0;height:46px!important;}",
      ".dsh-cv-tabs,.dsh-cv-body{transition:opacity .14s ease;}",
      ".dsh-cv-win[data-collapsed='1'] .dsh-cv-tabs,.dsh-cv-win[data-collapsed='1'] .dsh-cv-body{opacity:0;pointer-events:none;}",
      ".dsh-cv-tabs{display:flex;align-items:flex-end;gap:4px;padding:8px 12px 0;background:color-mix(in srgb,var(--cv-chrome) 70%,var(--cv-editor));border-bottom:1px solid var(--cv-stroke-3);overflow-x:auto;flex:0 0 auto;}",
      ".dsh-cv-tab{display:inline-flex;align-items:center;gap:6px;max-width:230px;padding:5px 6px 6px 12px;border:1px solid var(--cv-stroke-2);border-bottom:0;border-radius:8px 8px 0 0;background:var(--cv-fill-4);color:var(--cv-fg-3);font-size:11px;cursor:pointer;white-space:nowrap;}",
      ".dsh-cv-tab[data-active='1']{background:var(--cv-editor);color:var(--cv-fg);border-color:var(--cv-stroke-1);position:relative;top:1px;}",
      ".dsh-cv-tab-name{overflow:hidden;text-overflow:ellipsis;max-width:170px;}",
      ".dsh-cv-tab-dirty{color:var(--cv-cat-orange);font-size:9px;}",
      ".dsh-cv-tab-close{border:0;background:transparent;color:var(--cv-fg-4);cursor:pointer;font-size:13px;line-height:1;padding:2px 5px;border-radius:6px;}",
      ".dsh-cv-tab-close:hover{color:var(--cv-fg);background:var(--cv-fill-2);}",
      /* Canvas surface tokens (Cursor-aligned dark) */

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
      ".cv-card-h[data-size=\"sm\"]{padding:8px 12px;font-size:12px;}",
      ".cv-card-h[data-size=\"lg\"]{padding:14px 18px;font-size:15px;}",
      ".cv-card-h[data-tone=\"success\"]{color:var(--cv-cat-green);}",
      ".cv-card-h[data-tone=\"danger\"]{color:var(--cv-cat-red);}",
      ".cv-card-h[data-tone=\"warning\"]{color:var(--cv-cat-orange);}",
      ".cv-card-h[data-tone=\"info\"]{color:var(--cv-cat-blue);}",
      ".cv-card-b{padding:14px;}",
      /* Callout */
      ".cv-callout{border:1px solid var(--cv-stroke-3);border-left:3px solid var(--cv-cat-blue);padding:12px 14px;font-size:14px;line-height:20px;background:var(--cv-chrome);border-radius:8px;}",
      ".cv-callout-title{display:block;font-weight:590;margin-bottom:4px;color:var(--cv-fg);}",
      ".cv-callout[data-tone='danger']{border-left-color:var(--cv-cat-red);background:#1f1616;}",
      ".cv-callout[data-tone='warning']{border-left-color:var(--cv-cat-orange);background:#1f1a12;}",
      ".cv-callout[data-tone='success']{border-left-color:var(--cv-cat-green);background:#121a16;}",
      ".cv-callout[data-tone='info']{border-left-color:var(--cv-cat-blue);}",
      "html[data-dsh-cv-theme='light'] .cv-callout[data-tone='danger']{background:color-mix(in srgb,var(--cv-cat-red) 11%,var(--cv-chrome));}",
      "html[data-dsh-cv-theme='light'] .cv-callout[data-tone='warning']{background:color-mix(in srgb,var(--cv-cat-orange) 12%,var(--cv-chrome));}",
      "html[data-dsh-cv-theme='light'] .cv-callout[data-tone='success']{background:color-mix(in srgb,var(--cv-cat-green) 11%,var(--cv-chrome));}",
      /* Table */
      ".cv-table-wrap{width:100%;border:1px solid var(--cv-stroke-3);border-radius:8px;overflow:auto;background:var(--cv-chrome);}",
      ".cv-table-wrap[data-framed='0']{border:0;border-radius:0;background:transparent;}",
      ".cv-table{width:100%;border-collapse:collapse;font-size:12px;line-height:16px;}",
      ".cv-table th,.cv-table td{border-bottom:1px solid var(--cv-stroke-3);text-align:left;padding:9px 12px;vertical-align:top;}",
      ".cv-table th{color:var(--cv-fg-3);font-weight:590;background:var(--cv-fill-3);position:static;}",
      ".cv-table[data-sticky='1'] thead th{position:sticky;top:0;z-index:1;}",
      ".cv-table th[data-sortable='1']{cursor:pointer;user-select:none;}",
      ".cv-table th[data-sortable='1']:hover{color:var(--cv-link);}",
      ".cv-table .cv-sort-ind{font-size:10px;color:var(--cv-fg-3);}",
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
      ".cv-chart-grid{stroke:var(--cv-stroke-3,#252525);stroke-width:1;shape-rendering:crispEdges;}",
      ".cv-chart-tick{font-size:9px;fill:var(--cv-fg-4,#6f6f6f);}",
      ".cv-chart-value{font-size:9px;fill:var(--cv-fg-3,#9a9a9a);}",
      ".cv-chart-legend{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:var(--cv-fg-3,#9a9a9a);margin-bottom:8px;}",
      ".cv-chart-legend i{display:inline-block;width:8px;height:8px;border-radius:99px;margin-right:5px;vertical-align:middle;}",
      ".cv-chart-ref{stroke:var(--cv-cat-orange,#f6c177);stroke-width:1;stroke-dasharray:4 3;opacity:.85;}",
      ".cv-chart-ref-label{font-size:9px;fill:var(--cv-cat-orange,#f6c177);}",
      ".cv-degraded{display:inline-flex;align-items:center;gap:4px;font-size:10px;line-height:1;color:var(--cv-cat-yellow,#e8c070);background:color-mix(in srgb,var(--cv-cat-yellow) 14%,transparent);border:1px solid color-mix(in srgb,var(--cv-cat-yellow) 30%,transparent);border-radius:999px;padding:3px 8px;margin-bottom:8px;vertical-align:middle;}",
      "@media (max-width:920px){[data-dsh-cv-root] .cv-grid,[data-dsh-cv-lib] .cv-grid{grid-template-columns:repeat(2,minmax(0,1fr)) !important;}}",
      "@media (max-width:560px){[data-dsh-cv-root] .cv-grid,[data-dsh-cv-lib] .cv-grid{grid-template-columns:1fr !important;}}",
      ".dsh-cv-win:focus{outline:none;}",
      ".dsh-cv-btn:focus-visible,.dsh-cv-close:focus-visible{outline:2px solid var(--cv-stroke-focus,#6aa4ff);outline-offset:-2px;}",
      ".dsh-cv-toast{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);max-width:86%;padding:7px 14px;border-radius:99px;background:var(--cv-elevated,#1f1f1f);border:1px solid var(--cv-stroke-2,#2e2e2e);color:var(--cv-fg,#ececec);font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.45);z-index:2;pointer-events:none;}",
      ".cv-chart-label{font-size:10px;fill:var(--cv-fg-3);}",
      /* Collapsible */
      ".cv-collapse{border-bottom:1px solid var(--cv-stroke-3);}",
      ".cv-collapse-h{width:100%;appearance:none;border:0;background:transparent;color:inherit;text-align:left;padding:10px 0;cursor:pointer;display:flex;gap:10px;align-items:center;}",
      ".cv-collapse-h:hover{color:var(--cv-fg);}",
      ".cv-collapse-b{padding:0 0 14px;}",
      /* Library / settings */
      ".dsh-cv-lib{display:flex;flex-direction:column;gap:18px;max-width:960px;}",
      ".dsh-cv-lib-head{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;}",
      ".dsh-cv-lib-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 14px;border-radius:16px;border:1px solid var(--cv-stroke-3);background:var(--cv-fill-4);}",
      ".dsh-cv-lib-search{flex:1;min-width:180px;height:36px;border-radius:10px;border:1px solid var(--cv-stroke-2);background:var(--cv-fill-3);color:inherit;padding:0 12px;font-size:13px;}",
      ".dsh-cv-lib-search:focus{outline:none;border-color:var(--cv-stroke-focus);}",
      ".dsh-cv-lib-seg{display:inline-flex;gap:2px;padding:3px;border-radius:12px;background:var(--cv-fill-3);}",
      ".dsh-cv-lib-seg button{appearance:none;border:0;border-radius:9px;background:transparent;color:var(--cv-fg-3);height:30px;padding:0 12px;font-size:12px;cursor:pointer;transition:background .12s ease,color .12s ease;}",
      ".dsh-cv-lib-seg button[data-on='1']{background:color-mix(in srgb,var(--cv-accent) 22%,transparent);color:var(--cv-fg);}",
      ".dsh-cv-lib-select{height:36px;border-radius:10px;border:1px solid var(--cv-stroke-2);background:var(--cv-fill-3);color:inherit;padding:0 10px;font-size:12px;}",
      ".dsh-cv-lib-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;}",
      ".dsh-cv-lib-row{display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:16px;border:1px solid var(--cv-stroke-3);background:var(--cv-fill-4);transition:border-color .12s ease,background .12s ease,transform .12s ease;}",
      ".dsh-cv-lib-row:hover{border-color:color-mix(in srgb,var(--cv-accent) 32%,transparent);background:var(--cv-fill-3);}",
      ".dsh-cv-lib-row[data-missing='1']{opacity:.55;}",
      ".dsh-cv-lib-row-main{display:flex;align-items:center;gap:14px;flex:1;min-width:0;}",
      ".dsh-cv-lib-thumb{width:72px;height:52px;flex:0 0 72px;object-fit:cover;border-radius:10px;border:1px solid var(--cv-stroke-3);background:var(--cv-fill-3);}",
      ".dsh-cv-lib-thumb[data-broken='1']{display:none;}",
      ".dsh-cv-lib-row-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}",
      ".dsh-cv-lib-row-title{font-size:13px;font-weight:650;overflow-wrap:anywhere;word-break:normal;}",
      ".dsh-cv-lib-row-path{font-size:11px;color:var(--cv-fg-3);word-break:break-all;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".dsh-cv-lib-danger{color:var(--cv-cat-red,#e8a0a0);}",
      ".dsh-cv-lib-danger:hover{background:#3a2226;}",
      ".dsh-cv-lib-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto;}",
      ".dsh-cv-lib-actions button{appearance:none;border:0;border-radius:10px;background:var(--cv-fill-2);color:var(--cv-fg-2);height:30px;padding:0 11px;font-size:12px;cursor:pointer;transition:background .12s ease,color .12s ease;}",
      ".dsh-cv-lib-actions button:hover{background:var(--cv-fill-1);color:var(--cv-fg);}",
      ".dsh-cv-lib-actions button[data-primary='1']{background:color-mix(in srgb,var(--cv-accent) 22%,transparent);color:var(--cv-fg);}",
      ".dsh-cv-lib-empty{font-size:13px;color:var(--cv-fg-3);padding:18px 4px;}",
      ".dsh-cv-lib-toast{position:fixed;right:20px;bottom:20px;z-index:2147483646;padding:10px 14px;border-radius:10px;background:var(--cv-elevated);border:1px solid color-mix(in srgb,var(--cv-accent) 25%,transparent);color:var(--cv-fg);font-size:12px;box-shadow:0 12px 40px rgba(0,0,0,.35);}",
      ".dsh-cv-title{font-size:13px;font-weight:650;letter-spacing:0;}",
      ".dsh-cv-sub{font-size:11px;color:var(--cv-fg-3);}",
      ".dsh-cv-chips{display:flex;align-items:center;gap:6px;flex:0 0 auto;margin:0 2px;}",
      ".dsh-cv-chip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:99px;font-size:10.5px;font-weight:600;letter-spacing:.02em;white-space:nowrap;color:var(--cv-fg-2);background:var(--cv-fill-2);border:1px solid var(--cv-stroke-2);}",
      ".dsh-cv-chip::before{content:'';width:6px;height:6px;border-radius:99px;background:var(--cv-fg-4);}",
      ".dsh-cv-chip[data-tone='ok']{color:var(--cv-cat-green);border-color:color-mix(in srgb,var(--cv-cat-green) 38%,transparent);}",
      ".dsh-cv-chip[data-tone='ok']::before{background:var(--cv-cat-green);}",
      ".dsh-cv-chip[data-tone='info']{color:var(--cv-cat-blue);border-color:color-mix(in srgb,var(--cv-cat-blue) 38%,transparent);}",
      ".dsh-cv-chip[data-tone='info']::before{background:var(--cv-cat-blue);}",
      ".dsh-cv-chip[data-tone='warn']{color:var(--cv-cat-orange);border-color:color-mix(in srgb,var(--cv-cat-orange) 38%,transparent);}",
      ".dsh-cv-chip[data-tone='warn']::before{background:var(--cv-cat-orange);}",
      ".dsh-cv-btn{height:32px;padding:0 12px;border-radius:8px;font-size:12px;font-weight:500;color:var(--cv-fg-2);}",
      ".dsh-cv-btn:hover{background:var(--cv-fill-1);color:var(--cv-fg);}",
      ".dsh-cv-btn[data-variant='primary']{background:var(--cv-accent);color:var(--cv-on-accent);box-shadow:0 1px 0 rgba(255,255,255,.22) inset;}",
      ".dsh-cv-btn[data-variant='primary']:hover{background:var(--cv-accent-hover);}",
      ".dsh-cv-btn[data-variant='secondary']{background:var(--cv-fill-1);border:1px solid var(--cv-stroke-2);}",
      ".dsh-cv-close{width:34px;padding:0;font-size:18px;line-height:32px;color:var(--cv-fg-3);}",
      ".dsh-cv-close:hover{background:color-mix(in srgb,var(--cv-cat-red) 16%,transparent);color:#ffc4c8;}",
      ".dsh-cv-loading{display:flex;flex-direction:column;gap:14px;padding:4px 2px;}",
      ".dsh-cv-loading .dsh-cv-sk{height:14px;border-radius:7px;background:linear-gradient(90deg,var(--cv-fill-2),var(--cv-fill-1),var(--cv-fill-2));background-size:200% 100%;animation:dshCvShimmer 1.2s linear infinite;}",
      ".dsh-cv-loading .dsh-cv-sk:nth-child(1){width:38%;height:24px;}",
      ".dsh-cv-loading .dsh-cv-sk:nth-child(2){width:88%;}",
      ".dsh-cv-loading .dsh-cv-sk:nth-child(3){width:72%;}",
      ".dsh-cv-loading .dsh-cv-sk:nth-child(4){width:92%;}",
      "@keyframes dshCvShimmer{to{background-position:-200% 0;}}",
      ".dsh-cv-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:64px 24px;color:var(--cv-fg-3);text-align:center;}",
      ".dsh-cv-empty .dsh-cv-empty-ico{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--cv-accent);background:color-mix(in srgb,var(--cv-accent) 12%,var(--cv-fill-2));box-shadow:0 8px 24px color-mix(in srgb,var(--cv-accent) 22%,transparent);}",
      ".dsh-cv-lib{max-width:980px;}",
      ".dsh-cv-lib-toolbar{display:grid;grid-template-columns:max-content minmax(160px,1fr) max-content;align-items:center;gap:8px;flex-wrap:nowrap;padding:10px 12px;}",
      ".dsh-cv-lib-search{width:100%;min-width:0;height:34px;padding:0 13px;border-radius:99px;border:1px solid var(--cv-stroke-2);background:color-mix(in srgb,var(--cv-fill-3) 72%,transparent);color:var(--cv-fg);font-size:13px;outline:none;transition:border-color .12s ease,box-shadow .12s ease;}",
      ".dsh-cv-lib-search:focus{border-color:var(--cv-stroke-focus);box-shadow:0 0 0 3px color-mix(in srgb,var(--cv-accent) 18%,transparent);}",
      ".dsh-cv-lib-select{height:34px;max-width:132px;padding:0 10px;border-radius:10px;border:1px solid var(--cv-stroke-2);background:color-mix(in srgb,var(--cv-fill-3) 72%,transparent);color:var(--cv-fg);font-size:12px;outline:none;}",
      ".dsh-cv-lib-row{border:1px solid var(--cv-stroke-3);border-radius:8px;background:var(--cv-chrome);padding:12px 14px;transition:border-color .12s ease,box-shadow .12s ease;}",
      ".dsh-cv-lib-row:hover{border-color:var(--cv-stroke-1);box-shadow:0 6px 16px rgba(0,0,0,.12);}",
      ".dsh-cv-lib-actions{gap:4px;padding:3px;border:1px solid color-mix(in srgb,var(--cv-fg) 8%,transparent);border-radius:10px;background:color-mix(in srgb,var(--cv-chrome) 40%,transparent);}",
      ".dsh-cv-lib-actions button{height:28px;padding:0 9px;border-radius:7px;border:0;background:transparent;color:var(--cv-fg-2);font-size:11px;cursor:pointer;transition:background .12s ease,color .12s ease;}",
      ".dsh-cv-lib-actions button:hover{background:var(--cv-fill-1);color:var(--cv-fg);}",
      ".dsh-cv-lib-actions button[data-primary='1']{background:color-mix(in srgb,var(--cv-accent) 82%,var(--cv-chrome));color:var(--cv-on-accent);border:0;}",
      ".dsh-cv-lib-actions button[data-primary='1']:hover{background:var(--cv-accent-hover);}",
      ".dsh-cv-lib-danger:hover{background:color-mix(in srgb,var(--cv-cat-red) 16%,transparent)!important;color:#ffc4c8!important;}",
      ".dsh-cv-lib-empty{padding:56px 24px;text-align:center;color:var(--cv-fg-3);border:1px dashed var(--cv-stroke-2);border-radius:16px;font-size:13px;line-height:1.8;}",
      ".dsh-cv-lib-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483100;}",
      /* Settings library: a compact macOS-like list, not a dashboard. */
      ".dsh-cv-lib{gap:12px;max-width:880px;padding:2px 0;}",
      ".dsh-cv-lib-topline{display:flex;align-items:center;gap:12px;padding:4px 2px 8px;}",
      ".dsh-cv-lib-head{gap:1px;}",
      ".dsh-cv-lib-title{font-size:17px;font-weight:680;letter-spacing:-.015em;}",
      ".dsh-cv-lib-desc{margin:0;font-size:12px;line-height:16px;color:var(--cv-fg-3);}",
      ".dsh-cv-lib-topline-actions{display:flex;align-items:center;gap:8px;margin-left:auto;}",
      ".dsh-cv-lib-count{font-size:11px;color:var(--cv-fg-4);font-variant-numeric:tabular-nums;}",
      ".dsh-cv-lib-toolbar{grid-template-columns:max-content minmax(120px,1fr) max-content;padding:6px 8px;border-radius:12px;background:color-mix(in srgb,var(--cv-chrome) 64%,transparent);}",
      ".dsh-cv-lib-seg{padding:2px;border-radius:9px;}",
      ".dsh-cv-lib-seg button{height:27px;padding:0 10px;border-radius:7px;font-size:11px;}",
      ".dsh-cv-lib-search,.dsh-cv-lib-select{height:30px;font-size:12px;}",
      ".dsh-cv-lib-list{gap:6px;}",
      ".dsh-cv-lib-row{position:relative;align-items:center;gap:10px;padding:11px 12px;border-radius:11px;background:color-mix(in srgb,var(--cv-chrome) 72%,transparent);box-shadow:none;}",
      ".dsh-cv-lib-row:hover{box-shadow:0 4px 14px rgba(0,0,0,.1);}",
      ".dsh-cv-lib-row-main{gap:0;}",
      ".dsh-cv-lib-row-text{gap:3px;}",
      ".dsh-cv-lib-row-title{font-size:12.5px;line-height:17px;}",
      ".dsh-cv-lib-row-path{font-size:10.5px;line-height:14px;}",
      ".dsh-cv-lib-row-summary{font-size:11.5px;line-height:16px;color:var(--cv-fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".dsh-cv-lib-row-meta{display:flex;flex-wrap:wrap;gap:0;font-size:10.5px;line-height:14px;color:var(--cv-fg-4);}",
      ".dsh-cv-lib-row-meta span+span::before{content:'·';margin:0 5px;color:var(--cv-fg-4);}",
      ".dsh-cv-lib-row-warn{color:var(--cv-cat-orange);}",
      ".dsh-cv-lib-actions{position:relative;gap:4px;padding:0;border:0;background:transparent;}",
      ".dsh-cv-lib-actions button{height:28px;padding:0 9px;border-radius:8px;font-size:11px;}",
      ".dsh-cv-lib-actions .dsh-cv-lib-more{min-width:28px;padding:0 7px;font-weight:700;letter-spacing:1px;}",
      ".dsh-cv-lib-menu{position:absolute;right:0;top:34px;z-index:4;display:flex;flex-direction:column;min-width:154px;padding:4px;border:1px solid var(--cv-stroke-2);border-radius:10px;background:var(--cv-elevated);box-shadow:0 12px 30px rgba(0,0,0,.26);}",
      ".dsh-cv-lib-menu button{width:100%;height:30px;padding:0 9px;text-align:left;background:transparent;}",
      ".dsh-cv-lib-menu .dsh-cv-lib-danger{color:var(--cv-cat-red);}",
      ".dsh-cv-lib-error{padding:8px 10px;border:1px solid color-mix(in srgb,var(--cv-cat-red) 34%,transparent);border-radius:9px;color:var(--cv-cat-red);font-size:12px;}",
      /* Native chat bubble uses the same glass material as the viewer shell. */
      ".dsh-cv-tail{display:flex;align-items:stretch;gap:5px;margin-top:12px;max-width:min(560px,100%);padding:4px;border-radius:14px;border:1px solid color-mix(in srgb,var(--cv-glass-line) 78%,transparent);background:var(--cv-glass);backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:0 8px 24px rgba(0,0,0,.16),0 1px 0 var(--cv-glass-inner) inset;overflow:hidden;}",
      ".dsh-cv-tail-open{display:flex;align-items:center;gap:9px;flex:1;min-width:0;min-height:42px;appearance:none;border:0;border-radius:10px;background:transparent;color:var(--cv-fg);padding:7px 9px;cursor:pointer;text-align:left;transition:background .16s ease,transform .16s ease;}",
      ".dsh-cv-tail-open:hover{background:var(--cv-fill-2);}",
      ".dsh-cv-tail-open:active{transform:scale(.99);}",
      ".dsh-cv-tail-open:focus-visible{outline:2px solid color-mix(in srgb,var(--cv-accent) 74%,transparent);outline-offset:-2px;}",
      ".dsh-cv-tail-icon{flex:0 0 auto;display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:color-mix(in srgb,var(--cv-fill-1) 82%,transparent);color:var(--cv-fg);font-size:14px;font-weight:650;box-shadow:0 1px 0 var(--cv-glass-inner) inset,0 0 0 1px color-mix(in srgb,var(--cv-stroke-1) 56%,transparent);}",
      ".dsh-cv-tail-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}",
      ".dsh-cv-tail-name{font-size:13px;font-weight:590;letter-spacing:-.01em;color:var(--cv-fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".dsh-cv-tail-sub{font-size:11px;line-height:15px;color:var(--cv-fg-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".dsh-cv-tail-cta{display:inline-flex;align-items:center;align-self:center;height:28px;padding:0 10px;border:1px solid color-mix(in srgb,var(--cv-stroke-1) 74%,transparent);border-radius:7px;font-size:11.5px;font-weight:590;color:var(--cv-fg-2);background:var(--cv-fill-1);box-shadow:0 1px 0 var(--cv-glass-inner) inset;transition:background .16s ease,color .16s ease;}",
      ".dsh-cv-tail-open:hover .dsh-cv-tail-cta{color:var(--cv-on-accent);background:var(--cv-accent);border-color:transparent;}",
      "@media (max-width:760px){",
      ".dsh-cv-body[data-split='1']{flex-direction:column;}",
      ".dsh-cv-editor{width:auto;min-width:0;max-width:none;flex:0 0 40%;border-left:0;border-top:1px solid var(--cv-stroke-2);}",
      ".dsh-cv-win{left:0!important;top:0!important;width:100vw!important;height:100dvh!important;max-width:100vw!important;max-height:100dvh!important;min-width:0;min-height:0;border-radius:0;border:0;}",
      ".dsh-cv-bar{height:48px;padding:0 8px 0 14px;border-radius:0;}",
      ".dsh-cv-body{padding:18px 16px;}",
      ".dsh-cv-btn{min-height:38px;padding:0 12px;}",
      ".dsh-cv-lib-toolbar{gap:8px;}",
      ".dsh-cv-lib-search{flex:1 1 100%;min-width:0;}",
      ".dsh-cv-lib-row{flex-wrap:wrap;gap:10px;}",
      ".dsh-cv-lib-actions{flex-wrap:wrap;}",
      ".dsh-cv-lib-actions button{min-height:38px;}",
      ".dsh-cv-tail{margin-left:6px;margin-right:6px;}",
      "}",
      "@media (max-width:420px){",
      ".dsh-cv-lib-row-main{flex-direction:column;align-items:flex-start;gap:6px;}",
      ".dsh-cv-chips{display:none;}",
      ".dsh-cv-actions{gap:4px;}",
      ".dsh-cv-actions .dsh-cv-btn{min-height:0;height:28px;padding:0 6px;}",
      ".dsh-cv-zoom-value{min-width:36px;}",
      "}",
      ".dsh-cv-bar::before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,.07),transparent 52%);}",
      ".dsh-cv-bar>*{position:relative;z-index:1;}",
      ".dsh-cv-sandbox-wrap{padding:0;border:0;border-radius:0;background:var(--cv-editor);box-shadow:none;}",
      ".dsh-cv-sandbox{border-radius:0;background:var(--cv-editor);box-shadow:none;}",
      ".dsh-cv-actions{background:transparent;border:0;padding:0;}",
      ".dsh-cv-chips{background:rgba(255,255,255,.045);border:1px solid rgba(0,0,0,.16);border-radius:9px;padding:2px;}",
      ".dsh-cv-actions .dsh-cv-btn{height:28px;padding:0 9px;border-radius:7px;}",
      ".dsh-cv-tail:before{display:none;}",
      ".dsh-cv-tail-open{background:transparent;}",
      ".dsh-cv-tail-cta{background:var(--cv-fill-1);box-shadow:0 1px 0 var(--cv-glass-inner) inset;}",
      ".dsh-cv-lib-toolbar{background:var(--cv-chrome);border-color:var(--cv-stroke-2);box-shadow:0 1px 0 var(--cv-glass-inner) inset;}",
      ".dsh-cv-lib-actions{flex-wrap:wrap;justify-content:flex-end;}",
      ".dsh-cv-lib-actions{background:rgba(255,255,255,.035);border-color:rgba(0,0,0,.16);}",
      ".dsh-cv-lib-actions button{height:28px;padding:0 9px;border-radius:8px;background:transparent;}",
      ".dsh-cv-lib-actions button[data-primary='1']{background:var(--cv-accent);}",
      "@media (max-width:760px){.dsh-cv-win{padding:0;}.dsh-cv-win::before,.dsh-cv-win::after{display:none;}.dsh-cv-bar{border-radius:0;}.dsh-cv-body{border-left:0;border-right:0;border-radius:0;}.dsh-cv-sandbox-wrap{padding:0;}.dsh-cv-sandbox{border-radius:0;}}",
      "@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important;}body[data-dsh-liquid-glass] .dsh-cv-win[data-dsh-cv-root][data-dsh-liquid-surface='dialog']{transition-duration:.01ms!important;}}",
    ].join("");

    var THEME_KEY = "dsh-cv-theme";
    var hostThemeObserver = null;
    function detectHostTheme() {
      try {
        if (document.body && document.body.hasAttribute("data-ds-dark-theme")) return "dark";
        var scheme = window.getComputedStyle(document.documentElement).colorScheme || "";
        if (scheme.indexOf("dark") >= 0) return "dark";
        if (scheme.indexOf("light") >= 0) return "light";
      } catch { /* use the stable fallback */ }
      return "dark";
    }
    var themeState = { value: detectHostTheme() };
    /* @client-module theme-and-dom: owned chrome and theme persistence */
    function applyTheme() {
      var v = themeState.value === "light" ? "light" : "dark";
      try {
        if (v === "light") { document.documentElement.setAttribute("data-dsh-cv-theme", "light"); }
        else { document.documentElement.removeAttribute("data-dsh-cv-theme"); }
        // Versions before 0.4.12 persisted an independent viewer theme, which could
        // make a light gallery appear inside a dark host dialog. Clear that stale key;
        // each page load now begins from the actual dsh appearance.
        window.localStorage.removeItem(THEME_KEY);
      } catch { /* ignore storage / attribute errors */ }
    }
    function toggleTheme() {
      themeState.value = themeState.value === "light" ? "dark" : "light";
      applyTheme();
      try { window.dispatchEvent(new CustomEvent("dsh:canvas:theme")); } catch { /* ignore */ }
    }
    function themeNow() { return themeState.value; }

    function ensureHostThemeSync() {
      if (hostThemeObserver || typeof MutationObserver === "undefined") return;
      var sync = function () {
        var next = detectHostTheme();
        if (next === themeState.value) return;
        themeState.value = next;
        applyTheme();
        try { window.dispatchEvent(new CustomEvent("dsh:canvas:theme")); } catch { /* ignore */ }
      };
      hostThemeObserver = new MutationObserver(sync);
      try {
        if (document.body) hostThemeObserver.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
      } catch { /* observer unavailable in partial DOM environments */ }
    }

    function ensureCss() {
      var style = document.getElementById(STYLE_ID);
      if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
      }
      style.textContent = css;
      applyTheme();
      ensureHostThemeSync();
    }

    function removeOwnedChrome() {
      var style = document.getElementById(STYLE_ID);
      if (style) style.remove();
      if (hostThemeObserver) hostThemeObserver.disconnect();
      hostThemeObserver = null;
      document.documentElement.removeAttribute("data-dsh-cv-theme");
    }

    /**
     * Single normalization rule for every .canvas.tsx entry point (chat-bubble
     * args, clicked text, gallery). Handles both a clean path and a ref that is
     * embedded in free text. Mirrors the Host cleanRef().
     */
    function normalizeCanvasRef(value) {
      if (typeof value !== "string") return "";
      var trimmed = value.trim().replace(/^["'`\[\]]+|["'`\]]+$/g, "");
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
      // 1) Explicit canvas affordances only: data-canvas/data-path attributes
      //    and real <a> links whose href is a canvas path. Titles are tooltips,
      //    not click targets — they must never open the viewer.
      for (var el = node; el && el !== document.body; el = el.parentElement) {
        var dataPath = el.getAttribute && (el.getAttribute("data-canvas") || el.getAttribute("data-path"));
        if (dataPath) {
          var fromData = normalizeCanvasRef(dataPath);
          if (fromData) return fromData;
        }
        if (el.tagName === "A") {
          var href = el.getAttribute("href") || el.getAttribute("to");
          if (href) {
            var fromHref = normalizeCanvasRef(href);
            if (fromHref) return fromHref;
          }
        }
      }
      // 2) Leaf text that is exactly a canvas path (whole text, not prose):
      //    clicking a bare "foo.canvas.tsx" still opens, clicking a question that
      //    merely mentions one does not.
      if (node.childElementCount === 0) {
        var text = (node.textContent || "").trim();
        if (text.indexOf(".canvas.tsx") >= 0) {
          var fromText = normalizeCanvasRef(text);
          if (fromText && text === fromText) return fromText;
        }
      }
      return "";
    }

    function requestOpenCanvas(path) {
      if (externalOpen) {
        externalOpen(path);
        return;
      }
      fetch(API + "/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: path }),
      }).catch(function () {});
    }


    /* @client-module canvas-sdk: dsh/canvas component and hook subset */
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
      /**
      * Give key-less array children stable keys so mixed children like
      * <Text>a<Code>x</Code></Text> never trigger React key warnings.
      * (Strings/numbers pass through untouched.)
      */
      function keyedChildren(children) {
        if (!Array.isArray(children)) return children;
        var out = [];
        for (var ki = 0; ki < children.length; ki++) {
          var kc = children[ki];
          if (kc && typeof kc === "object" && !Array.isArray(kc) && kc.key == null) {
            out.push(ReactLib.cloneElement(kc, { key: "cv-c" + ki }));
          } else {
            out.push(kc);
          }
        }
        return out;
      }
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
      function readLiveTheme() {
        var doc = typeof document !== "undefined" ? document : null;
        var root = doc ? (doc.querySelector("[data-dsh-cv-canvas]") || doc.documentElement) : null;
        var style = root && typeof window !== "undefined" && window.getComputedStyle
          ? window.getComputedStyle(root)
          : { getPropertyValue: function () { return ""; } };
        var light = !!(doc && doc.documentElement.getAttribute("data-dsh-cv-theme") === "light");
        var cv = function (name, fallback) {
          var value = style.getPropertyValue(name).trim();
          return value || fallback;
        };
        var tokens = {
          bg: {
            editor: cv("--cv-editor", light ? "#f2f3f5" : "#171b21"),
            chrome: cv("--cv-chrome", light ? "#fbfcfd" : "#1a1d22"),
            elevated: cv("--cv-elevated", light ? "#ffffff" : "#2a2d33"),
            sidebar: cv("--cv-chrome", light ? "#fbfcfd" : "#1a1d22"),
          },
          text: {
            primary: cv("--cv-fg", light ? "#1d2025" : "#f2f2f4"),
            secondary: cv("--cv-fg-2", light ? "#474d55" : "#d0d2d7"),
            tertiary: cv("--cv-fg-3", light ? "#6c737c" : "#989da5"),
            quaternary: cv("--cv-fg-4", light ? "#8f969e" : "#737983"),
            link: cv("--cv-link", light ? "#526b7d" : "#b5c2ce"),
            onAccent: cv("--cv-on-accent", light ? "#ffffff" : "#131619"),
          },
          stroke: {
            primary: cv("--cv-stroke-1", light ? "rgba(45,52,58,.15)" : "rgba(255,255,255,.12)"),
            secondary: cv("--cv-stroke-2", "rgba(45,52,58,.13)"),
            tertiary: cv("--cv-stroke-3", light ? "rgba(45,52,58,.07)" : "rgba(255,255,255,.055)"),
            focused: cv("--cv-stroke-focus", light ? "#637b8b" : "#c4d0da"),
          },
          fill: {
            primary: cv("--cv-fill-1", "rgba(255,255,255,.1)"),
            secondary: cv("--cv-fill-2", "rgba(255,255,255,.065)"),
            tertiary: cv("--cv-fill-3", "rgba(255,255,255,.045)"),
            quaternary: cv("--cv-fill-4", "rgba(0,0,0,.12)"),
          },
          accent: {
            primary: cv("--cv-accent", light ? "#718796" : "#aebdca"),
            control: cv("--cv-accent", light ? "#718796" : "#aebdca"),
            controlHover: cv("--cv-accent-hover", light ? "#5c7484" : "#c7d3dc"),
          },
          diff: {
            insertedLine: category.green,
            removedLine: category.red,
            stripAdded: light ? "#dcebdd" : "#1d3b1d",
            stripRemoved: light ? "#f1dddd" : "#3b1d1d",
          },
          category: category,
        };
        return Object.assign({
          kind: light ? "light" : "dark",
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
      }

      // Older chart implementations consume this closure directly. Keep the
      // snapshot live so existing canvases and the hook share one theme source.
      var theme = readLiveTheme();

      function useHostTheme() {
        var _theme = ReactLib.useState(theme);
        var liveTheme = _theme[0];
        var setLiveTheme = _theme[1];
        ReactLib.useEffect(function () {
          var refresh = function () {
            theme = readLiveTheme();
            setLiveTheme(theme);
          };
          window.addEventListener("dsh:canvas:themechange", refresh);
          window.addEventListener("dsh:canvas:theme", refresh);
          return function () {
            window.removeEventListener("dsh:canvas:themechange", refresh);
            window.removeEventListener("dsh:canvas:theme", refresh);
          };
        }, []);
        return liveTheme;
      }
      var canvasStateStore = new WeakMap();
      function useCanvasState(key, initial) {
        // Key-scoped state: scoped per mount instance so two canvases using the
        // same key string never collide, and per-key within one canvas.
        if (!key) return ReactLib.useState(initial);
        var instId = ReactLib.useState({})[0];
        var ns = canvasStateStore.get(instId);
        if (!ns) { ns = {}; canvasStateStore.set(instId, ns); }
        var pair = ReactLib.useState(ns[key] !== undefined ? ns[key] : initial);
        if (ns[key] === undefined) ns[key] = pair[0];
        var setter = function (v) {
          var next = typeof v === "function" ? v(pair[0]) : v;
          ns[key] = next;
          pair[1](next);
        };
        return [pair[0], setter];
      }
      function useCanvasAction() {
        // Real (minimal) action bus: dispatch fires a window CustomEvent the
        // viewer subscribes to and surfaces as a toast — no more silent noop.
        return function dispatch(action) {
          var type = action && action.type ? String(action.type) : "action";
          var payload = action && action.path ? String(action.path) : "";
          if (typeof window !== "undefined" && window.dispatchEvent) {
            try {
              window.dispatchEvent(new CustomEvent("dsh:canvas:action", { detail: action || {} }));
            } catch { /* ignore */ }
          }
          return { ok: true, type: type, payload: payload };
        };
      }

      function Stack(props) {
        return h("div", {
          className: "cv-stack",
          style: mergeStyle({ gap: gapStyle(props.gap) }, props.style),
        }, keyedChildren(props.children));
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
        }, keyedChildren(props.children));
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
        }, keyedChildren(props.children));
      }
      function H1(props) { return h("h1", { className: "cv-h1", style: props.style }, keyedChildren(props.children)); }
      function H2(props) { return h("h2", { className: "cv-h2", style: props.style }, keyedChildren(props.children)); }
      function H3(props) { return h("h3", { className: "cv-h3", style: props.style }, keyedChildren(props.children)); }
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
        }, keyedChildren(props.children));
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
        }, keyedChildren(props.children));
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
        }, keyedChildren(props.children));
      }
      function CardHeader(props) {
        var main = props.title != null ? props.title : props.children;
        var size = props.size === "sm" || props.size === "small" ? "sm" : (props.size === "lg" || props.size === "large" ? "lg" : "md");
        var tone = props.tone || props.variant;
        return h("div", {
          className: "cv-card-h",
          "data-size": size,
          "data-tone": tone || undefined,
          style: props.style,
        },
          h("div", { className: "cv-card-h-main" }, main),
          props.trailing ? h("div", { className: "cv-card-h-trail" }, props.trailing) : null,
        );
      }
      function CardBody(props) {
        return h("div", { className: "cv-card-b", style: props.style }, keyedChildren(props.children));
      }
      function Callout(props) {
        var tone = props.tone || props.variant || "info";
        return h("div", {
          className: "cv-callout",
          "data-tone": tone,
          style: props.style,
        },
          props.title ? h("strong", { className: "cv-callout-title" }, props.title) : null,
          keyedChildren(props.children),
        );
      }
      function Code(props) {
        return h("code", { className: "cv-code", style: props.style }, keyedChildren(props.children));
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
        }, keyedChildren(props.children));
      }
      function Link(props) {
        return h("a", {
          href: props.href || props.to || "#",
          target: props.target,
          style: mergeStyle({ color: "var(--cv-link)" }, props.style),
        }, keyedChildren(props.children));
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
        var sortable = !!props.sortable;
        if (!rows.length && props.emptyMessage != null) {
          return h("div", { className: "cv-table-wrap", "data-framed": framed ? "1" : "0", style: props.style },
            h("div", { className: "cv-table-empty" }, props.emptyMessage),
          );
        }
        // Row models decouple data order from display order so sorting never
        // detaches a row from its tone dot.
        var models = rows.map(function (row, i) {
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
          return { key: i, cells: cells.slice(0, headers.length), tone: tones[i] || "" };
        });
        var sortState = ReactLib.useState(null);
        var sort = sortState[0];
        var setSort = sortState[1];
        if (sortable && sort && sort.col < headers.length) {
          models = models.slice().sort(function (a, b) {
            var av = sortVal(a.cells[sort.col]);
            var bv = sortVal(b.cells[sort.col]);
            var cmp;
            if (av != null && bv != null) cmp = av - bv;
            else {
              var at = String(a.cells[sort.col] == null ? "" : a.cells[sort.col]);
              var bt = String(b.cells[sort.col] == null ? "" : b.cells[sort.col]);
              cmp = at.localeCompare(bt, "zh-Hans-CN");
            }
            return cmp * (sort.dir === "desc" ? -1 : 1);
          });
        }
        var toggleSort = function (i) {
          setSort(function (prev) {
            if (prev && prev.col === i) {
              if (prev.dir === "asc") return { col: i, dir: "desc" };
              return null;
            }
            return { col: i, dir: "asc" };
          });
        };
        var table = h("table", {
          className: "cv-table",
          "data-sticky": sticky ? "1" : "0",
          "data-sortable": sortable && sort ? "1" : "0",
        },
          h("thead", null, h("tr", null, headers.map(function (head, i) {
            var active = sort && sort.col === i;
            return h("th", {
              key: i,
              style: { textAlign: aligns[i] || "left" },
              "data-sortable": sortable ? "1" : "0",
              "aria-sort": active ? (sort.dir === "asc" ? "ascending" : "descending") : null,
              onClick: sortable ? function () { toggleSort(i); } : null,
            },
              head,
              active ? h("span", { key: "ind", className: "cv-sort-ind", "aria-hidden": "true" }, sort.dir === "asc" ? " ↑" : " ↓") : null);
          }))),
          h("tbody", null, models.map(function (model, i) {
            return h("tr", { key: model.key, "data-stripe": striped && i % 2 === 1 ? "1" : "0" }, model.cells.map(function (cell, j) {
              var content = cell;
              if (cell && typeof cell === "object" && !Array.isArray(cell) && (cell.href != null || cell.to != null)) {
                var cellLabel = cell.label != null ? cell.label : (cell.text != null ? cell.text : "");
                content = h("a", {
                  key: "a",
                  href: cell.href || cell.to,
                  target: cell.target,
                  style: { color: "var(--cv-link)" },
                }, String(cellLabel));
              }
              if (j === 0 && model.tone) {
                content = [h("span", { key: "dot", className: "cv-tone-dot", "data-tone": model.tone }), content];
              }
              return h("td", { key: j, style: { textAlign: aligns[j] || "left" } }, keyedChildren(content));
            }));
          })),
        );
        return h("div", {
          className: "cv-table-wrap",
          "data-framed": framed ? "1" : "0",
          style: props.style,
        },
          unsupportedBadge(props, ["encoding"]),
          table,
        );
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

      function numOf(d) {
        if (typeof d === "number") return d;
        if (d && d.y != null) return Number(d.y) || 0;
        if (d && d.value != null) return Number(d.value) || 0;
        return 0;
      }

      /**
      * Sort value for a table cell: numbers compare numerically even when the
      * cell renders as a decorated string; everything else compares as zh text.
      */
      function sortVal(cell) {
        if (typeof cell === "number") return cell;
        if (cell && typeof cell === "object") cell = cell.label != null ? cell.label : (cell.text != null ? cell.text : "");
        var s = String(cell == null ? "" : cell).trim();
        var n = Number(s.replace(/,/g, ""));
        return (s !== "" && n === n) ? n : null;
      }

      /**
      * Surface a prop the subset cannot render as a small ▤ badge instead of
      * silently dropping it (P0: no silent semantic loss).
      */
      function unsupportedBadge(props, keys) {
        var present = (keys || []).filter(function (k) {
          return props[k] !== undefined && props[k] !== null;
        });
        if (!present.length) return null;
        return h("span", {
          className: "cv-degraded",
          title: "降级渲染：忽略 " + present.join(", "),
          "aria-label": "降级渲染：忽略 " + present.join(", "),
        }, "▤ 降级 " + present.length);
      }

      function seriesLegend(series, colors) {
        if (!series || series.length < 2) return null;
        return h("div", { className: "cv-chart-legend" },
          series.map(function (s, i) {
            return h("span", { key: i },
              h("i", { style: { background: colors[i] } }),
              s.name || ("系列 " + (i + 1)),
            );
          }),
        );
      }

      function niceTicks(max, count) {
        if (!(max > 0) || !isFinite(max)) max = 1;
        var n = count || 4;
        var raw = max / n;
        var mag = Math.pow(10, Math.floor(Math.log10(raw)));
        var norm = raw / mag;
        var step;
        if (norm <= 1) step = 1;
        else if (norm <= 2) step = 2;
        else if (norm <= 5) step = 5;
        else step = 10;
        step = step * mag;
        var ticks = [];
        var v = 0;
        while (v <= max + step * 0.001) {
          ticks.push(Number(v.toPrecision(12)));
          v += step;
        }
        return { ticks: ticks, step: step, max: ticks[ticks.length - 1] };
      }

      function BarChart(props) {
        var series = normalizeSeries(props);
        var cats = props.categories || (series[0] && series[0].data
          ? series[0].data.map(function (d, i) { return d && (d.label != null ? d.label : (d.x != null ? d.x : String(i + 1))); })
          : []);
        var height = props.height || 160;
        var width = props.width || 420;
        var suffix = props.valueSuffix || "";
        var beginAtZero = props.beginAtZero !== false;
        var values = [];
        series.forEach(function (s) {
          (s.data || []).forEach(function (d) { values.push(numOf(d)); });
        });
        var dataMax = Math.max.apply(null, values.concat([1]));
        var yMax = props.yMax != null ? Number(props.yMax) : dataMax;
        if (beginAtZero) yMax = Math.max(yMax, 0);
        var tickInfo = niceTicks(yMax, 4);
        var yTop = Math.max(tickInfo.max, yMax);
        var yBottom = beginAtZero ? 0 : Math.min(0, props.yMin != null ? Number(props.yMin) : 0);
        var spanY = Math.max(yTop - yBottom, 1e-9);
        var padL = 30;
        var padR = 6;
        var plotTop = 18;
        var plotBottom = height - 24;
        var plotH = Math.max(plotBottom - plotTop, 1);
        var xFor = function (di) {
          return padL + (di * (width - padL - padR)) / Math.max(cats.length, 1);
        };
        var yFor = function (v) {
          return plotBottom - ((v - yBottom) / spanY) * plotH;
        };
        var groupW = (width - padL - padR) / Math.max(cats.length, 1);
        var barW = Math.max(3, (groupW - 8) / Math.max(series.length, 1));
        var showValues = props.showValues !== false && barW >= 10;
        var els = [];
        tickInfo.ticks.forEach(function (t) {
          var y = yFor(t);
          els.push(h("line", { key: "g" + t, className: "cv-chart-grid", x1: padL, x2: width - padR, y1: y, y2: y }));
          els.push(h("text", { key: "t" + t, className: "cv-chart-tick", x: padL - 5, y: y + 3, textAnchor: "end" }, String(t)));
        });
        series.forEach(function (s, si) {
          var color = category[s.color] || s.color || theme.palette[si % theme.palette.length];
          (s.data || []).forEach(function (d, di) {
            var v = numOf(d);
            var x = xFor(di) + si * barW + 4;
            var yTopBar = yFor(Math.max(v, yBottom));
            var yBotBar = yFor(Math.max(yBottom, 0));
            var tip = (series.length > 1 && s.name ? s.name + " · " : "")
              + (cats[di] != null && cats[di] !== "" ? cats[di] + ": " : "") + v + suffix;
            els.push(h("rect", {
              key: "b" + si + "-" + di,
              x: x,
              y: Math.min(yTopBar, yBotBar),
              width: barW,
              height: Math.abs(yBotBar - yTopBar),
              fill: color,
              rx: 2,
            },
              h("title", null, tip)));
            if (showValues) {
              els.push(h("text", {
                key: "v" + si + "-" + di,
                className: "cv-chart-value",
                x: x + barW / 2,
                y: yTopBar - 4,
                textAnchor: "middle",
              }, String(v) + suffix));
            }
          });
        });
        cats.forEach(function (label, i) {
          els.push(h("text", {
            key: "l" + i,
            className: "cv-chart-label",
            x: xFor(i) + groupW / 2,
            y: height - 7,
            textAnchor: "middle",
          }, String(label)));
        });
        (props.referenceLines || []).forEach(function (ref, i) {
          if (ref && ref.value != null) {
            var y = yFor(Number(ref.value));
            els.push(h("line", { key: "r" + i, className: "cv-chart-ref", x1: padL, x2: width - padR, y1: y, y2: y }));
            if (ref.label) {
              els.push(h("text", { key: "rl" + i, className: "cv-chart-ref-label", x: padL + 4, y: y - 3 }, ref.label));
            }
          }
        });
        var colors = series.map(function (s, si) { return category[s.color] || s.color || theme.palette[si % theme.palette.length]; });
        return h("div", { style: props.style },
          seriesLegend(series, colors),
          unsupportedBadge(props, ["stacked"]),
          h("svg", {
            className: "cv-chart",
            viewBox: "0 0 " + width + " " + height,
            role: "img",
            "aria-label": "柱状图：" + (cats.join("、") || "无数据"),
          }, els),
        );
      }

      function LineChart(props) {
        var series = normalizeSeries(props);
        var height = props.height || 160;
        var width = props.width || 420;
        var suffix = props.valueSuffix || "";
        var beginAtZero = props.beginAtZero !== false;
        var values = [];
        series.forEach(function (s) {
          (s.data || []).forEach(function (d) { values.push(numOf(d)); });
        });
        var dataMax = Math.max.apply(null, values.concat([1]));
        var dataMin = Math.min.apply(null, values.concat([0]));
        var yMax = props.yMax != null ? Number(props.yMax) : dataMax;
        var yMin = props.yMin != null ? Number(props.yMin) : (beginAtZero ? 0 : Math.min(dataMin, 0));
        if (yMax <= yMin) yMax = yMin + 1;
        var spanY = yMax - yMin;
        var padL = 30;
        var padR = 6;
        var plotTop = 14;
        var plotBottom = height - 24;
        var plotH = Math.max(plotBottom - plotTop, 1);
        var tickInfo = niceTicks(Math.max(Math.abs(yMax), Math.abs(yMin), 1), 4);
        var tickValues = tickInfo.ticks.filter(function (t) {
          return t >= yMin - spanY * 0.001 && t <= yMax + spanY * 0.001;
        });
        var yFor = function (v) { return plotBottom - ((v - yMin) / spanY) * plotH; };
        var xFor = function (i, n) { return padL + (i * (width - padL - padR)) / Math.max(n - 1, 1); };
        var els = [];
        tickValues.forEach(function (t) {
          var y = yFor(t);
          els.push(h("line", { key: "g" + t, className: "cv-chart-grid", x1: padL, x2: width - padR, y1: y, y2: y }));
          els.push(h("text", { key: "t" + t, className: "cv-chart-tick", x: padL - 5, y: y + 3, textAnchor: "end" }, String(t)));
        });
        series.forEach(function (s, si) {
          var color = category[s.color] || s.color || theme.palette[si % theme.palette.length];
          var data = s.data || [];
          if (!data.length) return;
          var pts = data.map(function (d, i) {
            var v = numOf(d);
            return xFor(i, data.length) + "," + yFor(v);
          });
          els.push(h("polyline", {
            key: "p" + si,
            fill: "none",
            stroke: color,
            strokeWidth: 2,
            points: pts.join(" "),
          }));
          if (props.showValues !== false && data.length <= 12) {
            data.forEach(function (d, i) {
              var v = numOf(d);
              els.push(h("text", {
                key: "v" + si + "-" + i,
                className: "cv-chart-value",
                x: xFor(i, data.length),
                y: yFor(v) - 5,
                textAnchor: "middle",
              }, String(v) + suffix));
            });
          }
          // Per-point hover targets: native <title> tooltips without a JS layer.
          data.forEach(function (d, i) {
            var v = numOf(d);
            var label = d && (d.label != null ? d.label : (d.x != null ? d.x : null));
            var tip = (series.length > 1 && s.name ? s.name + " · " : "")
              + (label != null ? label + ": " : "#" + (i + 1) + ": ") + v + suffix;
            els.push(h("circle", {
              key: "h" + si + "-" + i,
              cx: xFor(i, data.length),
              cy: yFor(v),
              r: 7,
              fill: "transparent",
            },
              h("title", null, tip)));
          });
        });
        (props.referenceLines || []).forEach(function (ref, i) {
          if (ref && ref.value != null) {
            var y = yFor(Number(ref.value));
            els.push(h("line", { key: "r" + i, className: "cv-chart-ref", x1: padL, x2: width - padR, y1: y, y2: y }));
            if (ref.label) {
              els.push(h("text", { key: "rl" + i, className: "cv-chart-ref-label", x: padL + 4, y: y - 3 }, ref.label));
            }
          }
        });
        var colors = series.map(function (s, si) { return category[s.color] || s.color || theme.palette[si % theme.palette.length]; });
        return h("div", { style: props.style },
          seriesLegend(series, colors),
          unsupportedBadge(props, ["stacked"]),
          h("svg", {
            className: "cv-chart",
            viewBox: "0 0 " + width + " " + height,
            role: "img",
            "aria-label": "折线图：" + (series.map(function (s) { return s.name; }).filter(Boolean).join("、") || "无数据"),
          }, els),
        );
      }

      function PieChart(props) {
        var data = props.data || props.segments || [];
        var size = props.size || 140;
        var suffix = props.valueSuffix || "";
        var cx = size / 2;
        var cy = size / 2;
        var r = size / 2 - 4;
        var total = data.reduce(function (sum, d) { return sum + (Number(d.value) || 0); }, 0) || 1;
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
          var pct = total ? Math.round(value / total * 100) : 0;
          var tip = (d.label || d.name || ("项 " + (i + 1))) + ": " + value + suffix + " (" + pct + "%)";
          return h("path", { key: i, d: path, fill: color },
            h("title", null, tip));
        });
        var legend = h("div", { className: "cv-chart-legend" },
          data.map(function (d, i) {
            var color = category[d.color] || d.color || theme.palette[i % theme.palette.length];
            var pct = total ? Math.round((Number(d.value) || 0) / total * 100) : 0;
            return h("span", { key: i },
              h("i", { style: { background: color } }),
              (d.label || d.name || ("项 " + (i + 1))) + " · " + (Number(d.value) || 0) + suffix + " (" + pct + "%)",
            );
          }),
        );
        return h("div", { style: props.style },
          legend,
          unsupportedBadge(props, ["doughnut", "donut", "innerRadius"]),
          h("svg", {
            className: "cv-chart",
            width: size,
            height: size,
            viewBox: "0 0 " + size + " " + size,
            role: "img",
            "aria-label": "饼图",
          }, paths),
        );
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

    var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    function vlqDecode(str) {
      var result = [];
      var shift = 0;
      var value = 0;
      for (var i = 0; i < str.length; i++) {
        var digit = B64.indexOf(str[i]);
        var cont = digit & 32;
        value += (digit & 31) << shift;
        if (cont) {
          shift += 5;
        } else {
          var negate = value & 1;
          value >>>= 1;
          result.push(negate ? -value : value);
          value = 0;
          shift = 0;
        }
      }
      return result;
    }

    /**
     * Map a runtime stack frame (line/col in the compiled string) back to the
     * original .canvas.tsx using the sucrase-generated source map. mapOffset is
     * the number of prelude lines before the sucrase output.
     */
    function createSourceMapper(sourceMap, mapOffset) {
      if (!sourceMap || typeof sourceMap.mappings !== "string") return null;
      var lines = sourceMap.mappings.split(";");
      var sources = sourceMap.sources || [];
      var file = sourceMap.file || "compiled.js";
      return function (stackLine, stackCol) {
        var genLine = stackLine - (mapOffset || 0);
        if (genLine < 0 || genLine >= lines.length) return null;
        var srcIdx = 0;
        var srcLine = 0;
        var srcCol = 0;
        var best = null;
        var col0 = Math.max(0, (stackCol || 1) - 1);
        for (var li = 0; li <= genLine; li++) {
          var segs = (lines[li] || "").split(",");
          for (var k = 0; k < segs.length; k++) {
            var seg = segs[k];
            if (!seg) continue;
            var f = vlqDecode(seg);
            if (!f.length) continue;
            if (f.length >= 4) {
              srcIdx += f[1] || 0;
              srcLine += f[2] || 0;
              srcCol += f[3] || 0;
            }
            if (li === genLine && f[0] <= col0) {
              best = { source: sources[srcIdx] || file, line: srcLine + 1, column: srcCol + 1 };
            }
          }
        }
        return best;
      };
    }

    function mapRenderError(error, mapper) {
      if (!mapper || !error) return null;
      var stack = error && error.stack ? String(error.stack) : "";
      var fm = stack.match(/<anonymous>:?(\d+):(\d+)/) || stack.match(/:?(\d+):(\d+)/);
      if (!fm) return null;
      var loc = mapper(Number(fm[1]), Number(fm[2]));
      if (!loc) return null;
      var src = loc.source.replace(/^\/Users\/[^/]+/, "~");
      return src + ":" + loc.line + ":" + loc.column;
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
          var msg = String(this.state.error && this.state.error.message || this.state.error);
          var mapped = mapRenderError(this.state.error, this.props.mapper);
          return h(ErrorBox, { message: mapped ? msg + "\n↳ " + mapped : msg });
        }
        return this.props.children;
      }
    }

    var TOKEN_SEL = "[data-dsh-cv-root],[data-dsh-cv-canvas],[data-dsh-cv-lib],[data-dsh-cv-tail]";
    var sandboxBundlePromise = null;
    function getSandboxBundle() {
      if (!sandboxBundlePromise) {
        sandboxBundlePromise = apiGet(API + "/sandbox").catch(function (err) {
          return { available: false, reason: String(err && err.message || err) };
        });
      }
      return sandboxBundlePromise;
    }
    function jsonSafe(value) {
      return JSON.stringify(value).replace(/<\//g, "<\\/");
    }
    function escAttr(value) {
      return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    }
    /* @client-module sandbox: iframe CSP, Blob modules, and MessageChannel */
    function SandboxedMount(props) {
      var frameRef = useRef(null);
      var _st = useState("loading");
      var status = _st[0];
      var setStatus = _st[1];
      var _em = useState("");
      var errMsg = _em[0];
      var setErrMsg = _em[1];
      useEffect(function () {
        var frame = frameRef.current;
        if (!frame) return undefined;
        var port = null;
        function handle(d) {
          if (!d || typeof d !== "object") return;
          if (d.type === "dsh:canvas:ready") { setStatus("ready"); return; }
          if (d.type === "dsh-cv:esc") {
            // Esc pressed inside the sandbox: keydown never bubbles out of an
            // iframe, so the canvas forwards it over the port instead.
            if (props.onEsc) props.onEsc();
            return;
          }
          if (d.type === "dsh:canvas:action") {
            try {
              window.dispatchEvent(new CustomEvent("dsh:canvas:action", { detail: d.action || {} }));
            } catch { /* ignore */ }
            return;
          }
          if (d.type === "dsh:canvas:error") {
            setStatus("error");
            setErrMsg(String(d.message || "sandbox render failed"));
          }
        }
        function onMsg(event) {
          if (event.source !== frame.contentWindow) return;
          handle(event.data);
        }
        // Theme changes must reach the opaque-origin iframe: the srcdoc only reads
        // the theme once at assembly, so live toggles travel over the port.
        function sendTheme() {
          var msg = { type: "dsh-cv:theme", theme: themeNow() };
          try { if (port) { port.postMessage(msg); return; } } catch { /* fall through */ }
          try { frame.contentWindow.postMessage(msg, "*"); } catch { /* ignore */ }
        }
        window.addEventListener("dsh:canvas:theme", sendTheme);
        // MessageChannel handshake: an unforgeable private port for iframe -> host
        // messages. srcdoc listeners may not exist at the first React effect tick, so
        // reconnect on the real iframe load event as well as attempting immediately.
        function connect() {
          if (port) { try { port.close(); } catch { /* ignore */ } }
          port = null;
          try {
            var chan = new MessageChannel();
            port = chan.port1;
            port.onmessage = function (event) { handle(event.data); };
            frame.contentWindow.postMessage({ type: "dsh-cv:init", theme: themeNow() }, "*", [chan.port2]);
          } catch { /* port unavailable -> rely on the source-checked window fallback */ }
        }
        frame.addEventListener("load", connect);
        connect();
        window.addEventListener("message", onMsg);
        return function () {
          frame.removeEventListener("load", connect);
          window.removeEventListener("message", onMsg);
          window.removeEventListener("dsh:canvas:theme", sendTheme);
          if (port) { try { port.close(); } catch { /* ignore */ } }
        };
      }, []);
      var srcdoc = useMemo(function () {
        if (!props.compiled) return "";
        var cssIn = (props.css || "")
          .replace(TOKEN_SEL, ":root")
          .replaceAll("html[data-dsh-cv-theme='light'] [data-dsh-cv-root]", ":root[data-dsh-cv-theme='light']")
          .replaceAll("html[data-dsh-cv-theme='light'] [data-dsh-cv-canvas]", ":root[data-dsh-cv-theme='light']")
          .replaceAll("html[data-dsh-cv-theme='light'] [data-dsh-cv-lib]", ":root[data-dsh-cv-theme='light']")
          .replaceAll("html[data-dsh-cv-theme='light'] [data-dsh-cv-tail]", ":root[data-dsh-cv-theme='light']");
        var light = props.theme === "light";
        // Opaque-origin iframes are painted onto an independent canvas by Chromium.
        // Keep one flat, dynamic pixel base; theme changes must never reveal the page
        // wallpaper or force the iframe to reload.
        var readingTokensDark = "--cv-canvas-base:#171b21;--cv-editor:#171b21!important;--cv-chrome:rgba(31,34,40,.96)!important;--cv-elevated:rgba(45,48,55,.98)!important;--cv-fill-1:rgba(255,255,255,.1)!important;--cv-fill-2:rgba(255,255,255,.065)!important;--cv-fill-3:rgba(255,255,255,.045)!important;--cv-fill-4:rgba(0,0,0,.12)!important;--cv-stroke-1:rgba(255,255,255,.12)!important;--cv-stroke-2:rgba(0,0,0,.28)!important;--cv-stroke-3:rgba(255,255,255,.055)!important;--cv-fg:#f2f2f4!important;--cv-fg-2:#d0d2d7!important;--cv-fg-3:#989da5!important;--cv-fg-4:#737983!important;";
        var readingTokensLight = "--cv-canvas-base:#f2f3f5;--cv-editor:#f2f3f5!important;--cv-chrome:rgba(252,252,253,.96)!important;--cv-elevated:#fff!important;--cv-fill-1:rgba(60,60,67,.11)!important;--cv-fill-2:rgba(60,60,67,.07)!important;--cv-fill-3:rgba(60,60,67,.045)!important;--cv-fill-4:rgba(60,60,67,.025)!important;--cv-stroke-1:rgba(60,60,67,.18)!important;--cv-stroke-2:rgba(60,60,67,.14)!important;--cv-stroke-3:rgba(60,60,67,.09)!important;--cv-fg:#1c1c1e!important;--cv-fg-2:#48484a!important;--cv-fg-3:#6e6e73!important;--cv-fg-4:#8e8e93!important;";
        var html =
          "<!doctype html><html><head><meta charset=\"utf-8\"><title>" + escAttr(props.path || "canvas") + "</title>" +
          // The default sandbox path uses Blob-backed ES modules, so compiled
          // reports do not require unsafe-eval. Network-capable sinks stay
          // denied by the rest of this policy.
          "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'; media-src 'none'\">" +
          "<style>" + cssIn + "</style>" +
          "<style>:root{" + readingTokensDark + "color-scheme:dark}:root[data-dsh-cv-theme='light']{" + readingTokensLight + "color-scheme:light}html,body{margin:0;padding:0;background:var(--cv-canvas-base)!important;scrollbar-width:none;}html::-webkit-scrollbar,body::-webkit-scrollbar{width:0;height:0;}.dsh-cv-sandbox-root{min-height:100%;background:var(--cv-canvas-base)!important;}</style>" +
          "</head><body><div class=\"dsh-cv-sandbox-root\" id=\"cv-root\"></div>" +
          "<script>" + props.preact + "</" + "script>" +
          "<script>" + props.preactHooks + "</" + "script>" +
          "<script>" + props.compat + "</" + "script>" +
          "<script>" +
            (light ? "document.documentElement.setAttribute('data-dsh-cv-theme','light');" : "") +
            "var React=window.preactCompat;var ReactDOM=window.preactCompat;" +
            "if(!ReactDOM.createRoot){ReactDOM.createRoot=function(c){return {render:function(v){return ReactDOM.render(v,c);}};};}" +
            "var __send=function(m){if(window.__cvPort){try{window.__cvPort.postMessage(m);return;}catch(e){}}try{window.parent.postMessage(m,'*');}catch(e){}};" +
            "function __cvTheme(t){try{if(t==='light'){document.documentElement.setAttribute('data-dsh-cv-theme','light');}else{document.documentElement.removeAttribute('data-dsh-cv-theme');}window.dispatchEvent(new CustomEvent('dsh:canvas:themechange'));}catch(e){}}" +
            "window.addEventListener('message',function(ev){var d=ev&&ev.data;if(!d)return;if(d.type==='dsh-cv:init'&&ev.ports&&ev.ports[0]){window.__cvPort=ev.ports[0];window.__cvPort.onmessage=function(pe){var pd=pe&&pe.data;if(pd&&pd.type==='dsh-cv:theme'){__cvTheme(pd.theme);}};if(window.__cvPort.start){window.__cvPort.start();}__cvTheme(d.theme);}else if(d.type==='dsh-cv:theme'){__cvTheme(d.theme);}},false);" +
            "document.addEventListener('keydown',function(ev){if(ev.key==='Escape'){ev.preventDefault();__send({type:'dsh-cv:esc'});}},false);" +
            "function __fail(e){__send({type:'dsh:canvas:error',message:String((e&&e.message)||e||'sandbox module failed')});}" +
            "function __loadModule(code,done){try{var u=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));var s=document.createElement('script');s.type='module';s.onload=function(){URL.revokeObjectURL(u);done();};s.onerror=function(){URL.revokeObjectURL(u);__fail(new Error('sandbox module load failed'));};s.src=u;document.head.appendChild(s);}catch(e){__fail(e);}}" +
            "var __sdkSrc=" + jsonSafe((props.sdk || "") + "\nglobalThis.__cvCreateSdk=createSdk;") + ";" +
            "var __moduleSrc=" + jsonSafe(props.moduleCode || props.compiled) + ";" +
            "__loadModule(__sdkSrc,function(){try{var __sdk=globalThis.__cvCreateSdk(React,React.createElement);globalThis.sdk=__sdk;globalThis.React=React;globalThis.ReactDOM=ReactDOM;globalThis.h=React.createElement;__loadModule(__moduleSrc,function(){try{var __App=globalThis.__cvCanvasApp;if(typeof __App!=='function')throw new Error('canvas module did not export a component');var __root=ReactDOM.createRoot(document.getElementById('cv-root'));__root.render(React.createElement(__App));__send({type:'dsh:canvas:ready'});}catch(e){__fail(e);}});}catch(e){__fail(e);}});" +
            "window.addEventListener('dsh:canvas:action',function(ev){__send({type:'dsh:canvas:action',action:(ev&&ev.detail)||{}});});" +
            "window.addEventListener('error',function(ev){__send({type:'dsh:canvas:error',message:String((ev&&ev.message)||'error')});});" +
          "</" + "script>" +
          "</body></html>";
        return html;
      }, [props.compiled, props.moduleCode, props.css, props.sdk, props.preact, props.preactHooks, props.compat, props.path, props.theme]);
      if (status === "error") {
        return h("div", { className: "dsh-cv-sandbox-fallback" },
          h("div", { className: "dsh-cv-err" }, "沙箱渲染失败：" + errMsg),
          h("button", { type: "button", className: "dsh-cv-btn", onClick: props.onFallback }, "使用兼容渲染"),
        );
      }
      return h("iframe", {
        ref: frameRef,
        className: "dsh-cv-sandbox",
        sandbox: "allow-scripts",
        srcDoc: srcdoc,
        title: props.path || "canvas",
        tabIndex: -1,
      });
    }

    function CanvasMount(props) {
      var mapper = useMemo(function () {
        return createSourceMapper(props.sourceMap, props.mapOffset);
      }, [props.sourceMap, props.mapOffset]);
      var _sb = useState(null);
      var sb = _sb[0];
      var setSb = _sb[1];
      var _us = useState(true);
      var useSandbox = _us[0];
      var setUseSandbox = _us[1];
      var _allowLegacy = useState(false);
      var allowLegacy = _allowLegacy[0];
      var setAllowLegacy = _allowLegacy[1];
      var legacySdk = useMemo(function () {
        var made = createSdk(React);
        try { Object.freeze(made); } catch { /* non-extensible environments */ }
        return made;
      }, []);
      var App = useMemo(function () {
        if (!props.compiled) return null;
        try {
          var factory = new Function("React", "sdk", props.compiled);
          return factory(React, legacySdk);
        } catch (err) {
          var fmsg = String(err && err.message || err);
          var fmapped = mapRenderError(err, mapper);
          return function Fail() {
            return h(ErrorBox, { message: fmapped ? fmsg + "\n↳ " + fmapped : fmsg });
          };
        }
      }, [props.compiled, mapper, legacySdk]);
      useEffect(function () {
        var cancelled = false;
        if (!props.compiled || !useSandbox || sb) return undefined;
        getSandboxBundle().then(function (bundle) {
          if (!cancelled) setSb(bundle);
        });
        return function () { cancelled = true; };
      }, [props.compiled, useSandbox, sb]);
      var modeReported = useRef("");
      useEffect(function () {
        var m = "";
        if (useSandbox && sb && sb.available && props.compiled) m = "sandbox";
        else if (props.compiled) m = "legacy";
        if (m && m !== modeReported.current) {
          modeReported.current = m;
          if (props.onMode) props.onMode(m);
        }
      }, [useSandbox, sb, props.compiled, props.onMode]);
      if (useSandbox && sb && sb.available && props.compiled) {
        return h("div", {
          className: "dsh-cv-sandbox-wrap",
          "data-dsh-cv-canvas": "",
          style: { "--cv-scale": String((props.zoom || 100) / 100) },
        },
          h(Boundary, { resetKey: props.path, mapper: mapper },
            h(SandboxedMount, {
              compiled: props.compiled,
              moduleCode: props.moduleCode,
              css: css,
              sdk: sb.sdk,
              preact: sb.preact,
              preactHooks: sb.preactHooks,
              compat: sb.compat,
              path: props.path,
              theme: props.theme,
              onEsc: props.onEsc,
              onFallback: function () { setAllowLegacy(true); setUseSandbox(false); },
            })));
      }
      if (useSandbox && sb && !sb.available && !allowLegacy && props.compiled) {
        return h("div", { className: "dsh-cv-sandbox-fallback" },
          h("div", { className: "dsh-cv-err" }, "沙箱不可用：" + String(sb.reason || "运行时资源缺失")),
          h("button", { type: "button", className: "dsh-cv-btn", onClick: function () { setAllowLegacy(true); setUseSandbox(false); } }, "允许兼容渲染"),
        );
      }
      if (props.error && !App) return h(ErrorBox, { message: props.error });
      if (!App) {
        return h("pre", { className: "dsh-cv-src" }, props.source || "");
      }
      return h("div", { "data-dsh-cv-canvas": "" },
        h(Boundary, { resetKey: props.path, mapper: mapper }, h(App)),
      );
    }

    /* @client-module viewer-shell: tabs, editor, window chrome, and fallback */
    function ViewerShell() {
      // Multi-canvas tabs: each tab is one open doc {payload..., editor, dirty}.
      var _tabs = useState([]);
      var tabs = _tabs[0];
      var setTabs = _tabs[1];
      var _active = useState(0);
      var activeIdx = _active[0];
      var setActive = _active[1];
      var closedSeqs = useRef({});
      var activateRef = useRef(null);
      var doc = activeIdx < tabs.length ? tabs[activeIdx] : null;
      var savedPos = null;
      try {
        savedPos = JSON.parse(window.localStorage.getItem("dsh-cv-pos") || "null");
      } catch {
        savedPos = null;
      }
      var defaultPos = {
        top: 48,
        left: Math.max(16, Math.round((window.innerWidth - Math.min(880, window.innerWidth - 40)) / 2)),
        width: Math.min(880, Math.max(480, window.innerWidth - 40)),
        height: Math.min(720, Math.round(window.innerHeight * 0.78)),
      };
      var _pos = useState(function () {
        return Object.assign({}, defaultPos, savedPos && typeof savedPos.top === "number" ? savedPos : {});
      });
      var pos = _pos[0];
      var setPos = _pos[1];
      var _max = useState(false);
      var maximized = _max[0];
      var setMaximized = _max[1];
      var _collapsed = useState(false);
      var collapsed = _collapsed[0];
      var setCollapsed = _collapsed[1];
      var _zoom = useState(function () {
        var savedZoom = 100;
        try { savedZoom = Number(window.localStorage.getItem("dsh-cv-zoom")) || 100; } catch { /* ignore */ }
        return Math.max(70, Math.min(140, savedZoom));
      });
      var zoom = _zoom[0];
      var setZoom = _zoom[1];
      var _copied = useState(false);
      var copied = _copied[0];
      var setCopied = _copied[1];
      var drag = useRef(null);
      var winRef = useRef(null);
      var lastFocused = useRef(null);
      var copyTimer = useRef(0);
      var toastApi = useToast();
      var _mode = useState("");
      var renderMode = _mode[0];
      var setRenderMode = _mode[1];
      var _showSrc = useState(false);
      var showSrc = _showSrc[0];
      var setShowSrc = _showSrc[1];
      var _saving = useState(false);
      var saving = _saving[0];
      var setSaving = _saving[1];
      var editorSrc = doc && doc.editor != null ? doc.editor : ((doc && doc.source) || "");
      // editorDirty derives from actual buffer content below; a previous
      // doc.dirty snapshot here was immediately shadowed and never read.
      useEffect(function () {
        var onAction = function (event) {
          var a = event && event.detail;
          var type = a && a.type ? String(a.type) : "action";
          var path = a && a.path ? String(a.path) : "";
          toastApi.show("只读预览 · " + type + (path ? " · " + path : ""));
        };
        window.addEventListener("dsh:canvas:action", onAction);
        return function () { window.removeEventListener("dsh:canvas:action", onAction); };
      }, [toastApi.show]);
      var closeTabByIndex = useCallback(function (i, event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        var t = tabs[i];
        if (!t) return;
        // remember the last seq so a late hot-reload push cannot resurrect the tab
        closedSeqs.current[t.path] = t.seq || 0;
        var newLen = tabs.length - 1;
        setTabs(function (prev) {
          if (i >= prev.length) return prev;
          var next = prev.slice();
          next.splice(i, 1);
          return next;
        });
        setActive(function (cur) {
          if (i < cur) return cur - 1;
          if (cur > newLen) return Math.max(0, newLen - 1);
          return cur;
        });
        setCopied(false);
      }, [tabs]);

      var close = useCallback(function (event) {
        closeTabByIndex(activeIdx, event);
      }, [closeTabByIndex, activeIdx]);

      // SandboxedMount registers its message listeners once at mount, so any
      // callback captured there is frozen forever. Esc must route through a
      // ref to the CURRENT close, or after switching tabs it closes whatever
      // tab index was current when the sandbox first mounted.
      var closeRef = useRef(close);
      useEffect(function () { closeRef.current = close; }, [close]);
      var escForSandbox = useCallback(function () { if (closeRef.current) closeRef.current(); }, []);

      var applyDoc = useCallback(function (payload, opts) {
        if (!payload || !payload.path) return;
        var path = payload.path;
        if (payload.seq && payload.seq <= (closedSeqs.current[path] || 0)) return;
        var resetEditor = !!(opts && opts.resetEditor);
        setTabs(function (prev) {
          var idx = -1;
          for (var i = 0; i < prev.length; i++) {
            if (prev[i].path === path) { idx = i; break; }
          }
          if (idx >= 0) {
            var old = prev[idx];
            if (payload.seq && old.seq && payload.seq <= old.seq) return prev; // stale push
            var merged = Object.assign({}, old, payload);
            // a dirty editor never gets clobbered by an external reload
            if (resetEditor || !old.dirty) { merged.editor = null; merged.dirty = false; }
            var next = prev.slice();
            next[idx] = merged;
            return next;
          }
          return prev.concat([Object.assign({ editor: null, dirty: false }, payload)]);
        });
        if (opts && opts.activate) activateRef.current = path;
      }, []);

      // opening a canvas activates its tab (hot reloads update silently)
      useEffect(function () {
        var want = activateRef.current;
        if (!want) return;
        activateRef.current = null;
        for (var i = 0; i < tabs.length; i++) {
          if (tabs[i].path === want) { setActive(i); break; }
        }
      }, [tabs]);

      var openPath = useCallback(function (path) {
        var norm = normalizeCanvasRef(path) || path;
        delete closedSeqs.current[norm];
        fetch(API + "/open", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: path }),
        }).then(function (res) { return res.json(); }).then(function (payload) {
          if (payload && payload.ok === false) throw new Error(payload.error || "open failed");
          applyDoc(payload, { activate: true });
        }).catch(function (err) {
          applyDoc({
            seq: 0,
            path: norm,
            title: norm.split("/").pop(),
            source: "",
            compiled: "",
            error: String(err && err.message || err),
          }, { activate: true });
        });
      }, [applyDoc]);

      var saveSource = useCallback(function () {
        if (!doc || !doc.path || saving) return;
        setSaving(true);
        fetch(API + "/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: doc.path, source: editorSrc }),
        }).then(function (res) { return res.json(); }).then(function (payload) {
          if (!payload || payload.ok === false) throw new Error((payload && payload.error) || "save failed");
          applyDoc(payload, { resetEditor: true });
          toastApi.show("已保存 · 已重编译");
        }).catch(function (err) {
          toastApi.show("保存失败：" + String(err && err.message || err));
        }).finally(function () { setSaving(false); });
      }, [doc, editorSrc, saving, applyDoc, toastApi.show]);

      // Hot reload: subscribe per open path; the host pushes recompiled payloads.
      useEffect(function () {
        if (!doc || !doc.path) return undefined;
        var path = doc.path;
        var es;
        try {
          es = new EventSource(API + "/watch?path=" + encodeURIComponent(path));
        } catch {
          return undefined;
        }
        es.onmessage = function (event) {
          var msg = null;
          try { msg = JSON.parse(event.data); } catch { return; }
          if (msg.type === "reload" && msg.payload && msg.payload.path === path) {
            applyDoc(msg.payload);
          } else if (msg.type === "deleted") {
            toastApi.show("源文件已被删除");
          }
        };
        return function () { es.close(); };
      }, [doc && doc.path, applyDoc, toastApi.show]);

      useEffect(function () {
        ensureCss();
        externalOpen = openPath;
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
          if (externalOpen === openPath) externalOpen = null;
          document.removeEventListener("click", onClick, true);
          window.removeEventListener("keydown", onKey);
        };
      }, [applyDoc, openPath, close]);

      useEffect(function () {
        try {
          window.localStorage.setItem("dsh-cv-pos", JSON.stringify(pos));
        } catch {
          // ignore storage errors
        }
      }, [pos]);

      useEffect(function () {
        try { window.localStorage.setItem("dsh-cv-zoom", String(zoom)); } catch { /* ignore */ }
      }, [zoom]);

      // Dialog a11y: move focus into the window on open, restore on close.
      useEffect(function () {
        if (doc) {
          lastFocused.current = document.activeElement;
          var node = winRef.current;
          if (node) {
            // Focus the dialog plane, not a destructive action. This announces
            // the new context without painting a keyboard focus ring during a
            // pointer-open transition; Tab still reaches both close controls.
            node.focus();
          }
        } else if (lastFocused.current && lastFocused.current.focus) {
          lastFocused.current.focus();
          lastFocused.current = null;
        }
      }, [doc]);

      var onBarDown = function (event) {
        if (event.button !== 0) return;
        if (maximized) return;
        if (event.target && event.target.closest && event.target.closest("button")) return;
        drag.current = {
          kind: "move",
          x: event.clientX,
          y: event.clientY,
          left: pos.left,
          top: pos.top,
        };
        if (winRef.current) winRef.current.setAttribute("data-dragging", "1");
        event.preventDefault();
      };
      var onBarToggleMax = function (event) {
        if (event.target && event.target.closest && event.target.closest("button")) return;
        setCollapsed(false);
        setMaximized(function (prev) { return !prev; });
      };
      useEffect(function () {
        var onMove = function (event) {
          var d = drag.current;
          if (!d) return;
          var dx = event.clientX - d.x;
          var dy = event.clientY - d.y;
          if (d.kind === "move") {
            setPos(function (prev) {
              return Object.assign({}, prev, {
                left: Math.max(8, d.left + dx),
                top: Math.max(8, d.top + dy),
              });
            });
          }
        };
        var onUp = function () {
          drag.current = null;
          if (winRef.current) winRef.current.removeAttribute("data-dragging");
        };
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
      var toggleCollapsed = function (event) {
        if (event) event.stopPropagation();
        setMaximized(false);
        setCollapsed(function (prev) { return !prev; });
      };
      var toggleMaximized = function (event) {
        if (event) event.stopPropagation();
        setCollapsed(false);
        setMaximized(function (prev) { return !prev; });
      };
      var adjustZoom = function (delta) {
        setZoom(function (value) { return Math.max(70, Math.min(140, value + delta)); });
      };

      if (!doc) return h("span", { "data-dsh-cv-idle": "" });

      var shortPath = (doc.path || "").replace(/^\/Users\/[^/]+/, "~");

      var editorDirty = editorSrc !== (doc.source || "");
      var editorBytes = 0;
      try { editorBytes = new Blob([editorSrc]).size; } catch { editorBytes = editorSrc.length; }
      var editorMeta = (editorSrc ? editorSrc.split("\n").length : 0) + " 行 · " + formatBytes(editorBytes);

      return h("div", {
        className: "dsh-cv-win",
        "data-dsh-cv-root": "",
        "data-max": maximized ? "1" : "0",
        "data-collapsed": collapsed ? "1" : "0",
        role: "dialog",
        // aria-modal intentionally omitted: the host app's mobile stylesheet targets
        // [aria-modal="true"]:has(> :first-child > :last-child > button) as its own nav
        // sheets, which our header-actions dialog would match and get forced into
        // absolute positioning on small screens. role=dialog + manual focus management
        // below preserve dialog semantics.
        "aria-label": (doc.title || "Canvas") + " 报告",
        ref: winRef,
        tabIndex: -1,
        style: maximized
          ? { top: "8px", left: "8px", width: "calc(100vw - 16px)", height: "calc(100vh - 16px)" }
          : {
              top: pos.top + "px",
              left: pos.left + "px",
              width: pos.width + "px",
              height: pos.height + "px",
            },
      },
        h("div", { className: "dsh-cv-bar", onMouseDown: onBarDown, onDoubleClick: onBarToggleMax, title: "拖动移动 · 双击最大化/还原" },
          h("div", { className: "dsh-cv-traffic", onMouseDown: stopDrag, "aria-label": "窗口控制" },
            h("button", {
              type: "button",
              className: "dsh-cv-traffic-btn dsh-cv-window-close",
              "data-kind": "close",
              title: "关闭",
              "aria-label": "关闭",
              onClick: close,
            }, h("span", { "aria-hidden": "true" }, "×")),
            h("button", {
              type: "button",
              className: "dsh-cv-traffic-btn",
              "data-kind": "minimize",
              title: collapsed ? "展开" : "收起",
              "aria-label": collapsed ? "展开窗口" : "收起窗口",
              onClick: toggleCollapsed,
            }, h("span", { "aria-hidden": "true" }, "−")),
            h("button", {
              type: "button",
              className: "dsh-cv-traffic-btn",
              "data-kind": "zoom",
              title: maximized ? "还原" : "最大化",
              "aria-label": maximized ? "还原窗口" : "最大化窗口",
              onClick: toggleMaximized,
            }, h("span", { "aria-hidden": "true" }, maximized ? "◆" : "+")),
          ),
          h("div", { className: "dsh-cv-titlewrap" },
            h("div", { className: "dsh-cv-title" }, doc.title || "Canvas"),
            h("div", { className: "dsh-cv-sub", title: doc.path }, shortPath),
          ),
          h("div", { className: "dsh-cv-chips", onMouseDown: stopDrag },
            renderMode === "sandbox" ? h("span", { className: "dsh-cv-chip", "data-tone": "ok" }, "沙箱渲染") : null,
            renderMode === "legacy" ? h("span", { className: "dsh-cv-chip", "data-tone": "info" }, "兼容渲染") : null,
          ),
          h("div", { className: "dsh-cv-actions", onMouseDown: stopDrag },
            h("div", { className: "dsh-cv-toolgroup", "aria-label": "画布缩放" },
              h("button", { type: "button", className: "dsh-cv-btn", title: "缩小", "aria-label": "缩小画布", disabled: zoom <= 70, onClick: function () { adjustZoom(-10); } }, "−"),
              h("button", { type: "button", className: "dsh-cv-btn dsh-cv-zoom-value", title: "恢复 100%", "aria-label": "当前缩放 " + zoom + "% · 点击恢复", onClick: function () { setZoom(100); } }, zoom + "%"),
              h("button", { type: "button", className: "dsh-cv-btn", title: "放大", "aria-label": "放大画布", disabled: zoom >= 140, onClick: function () { adjustZoom(10); } }, "+"),
            ),
            h("div", { className: "dsh-cv-toolgroup", "aria-label": "画布工具" },
              h("button", {
                type: "button",
                className: "dsh-cv-btn",
                "data-icon": "1",
                title: "切换浅色/深色主题",
                "aria-label": "切换主题",
                onClick: toggleTheme,
              }, "◐"),
              h("button", {
                type: "button",
                className: "dsh-cv-btn",
                "data-icon": "1",
                "data-active": showSrc ? "1" : "0",
                title: "源码 / 渲染分栏（保存即重编译）",
                "aria-label": editorDirty ? "源码（有未保存修改）" : "源码",
                "aria-pressed": showSrc ? "true" : "false",
                onClick: function () { setShowSrc(!showSrc); },
              }, editorDirty ? "</>•" : "</>"),
              h("button", {
                type: "button",
                className: "dsh-cv-btn",
                "data-icon": "1",
                "data-copied": copied ? "1" : "0",
                title: copied ? "已复制" : "复制源码",
                "aria-label": copied ? "已复制源码" : "复制源码",
                onClick: copySource,
              }, copied ? "✓" : "⧉"),
              h("button", { type: "button", className: "dsh-cv-btn", "data-icon": "1", title: "下载源码", "aria-label": "下载源码", onClick: downloadSource }, "↓"),
            ),
            h("button", {
              type: "button",
              className: "dsh-cv-explicit-close",
              title: "关闭 Canvas",
              "aria-label": "关闭 Canvas",
              onClick: close,
            }, "×"),
          ),
        ),
        tabs.length > 1 ? h("div", { className: "dsh-cv-tabs", role: "tablist", "aria-label": "已打开的画布" },
          tabs.map(function (t, i) {
            return h("div", {
              key: t.path,
              className: "dsh-cv-tab",
              role: "tab",
              "data-active": i === activeIdx ? "1" : "0",
              "aria-selected": i === activeIdx ? "true" : "false",
              title: t.path,
              onClick: function () { setActive(i); },
            },
              h("span", { className: "dsh-cv-tab-name" }, (t.title || t.path).replace(/\.canvas\.tsx$/, "")),
              t.dirty ? h("span", { className: "dsh-cv-tab-dirty", "aria-hidden": "true" }, "●") : null,
              h("button", {
                type: "button",
                className: "dsh-cv-tab-close",
                "aria-label": "关闭 " + (t.title || t.path),
                onClick: function (event) { closeTabByIndex(i, event); },
              }, "×"),
            );
          }),
        ) : null,
        h("div", { className: "dsh-cv-body", "data-dsh-cv-canvas": "", "data-split": showSrc ? "1" : "0" },
          showSrc
            ? h("div", { className: "dsh-cv-render" },
                h(CanvasMount, {
                  path: doc.path,
                  source: doc.source,
                  compiled: doc.compiled,
                  moduleCode: doc.moduleCode,
                  sourceMap: doc.sourceMap,
                  mapOffset: doc.mapOffset,
                  error: doc.error,
                  onMode: setRenderMode,
                  onEsc: escForSandbox,
                  theme: themeNow(),
                  zoom: zoom,
                }),
              )
            : h(CanvasMount, {
                path: doc.path,
                source: doc.source,
                compiled: doc.compiled,
                moduleCode: doc.moduleCode,
                sourceMap: doc.sourceMap,
                mapOffset: doc.mapOffset,
                error: doc.error,
                onMode: setRenderMode,
                onEsc: escForSandbox,
                theme: themeNow(),
                zoom: zoom,
              }),
          showSrc ? h("div", { className: "dsh-cv-editor" },
            h("textarea", {
              className: "dsh-cv-src-edit",
              value: editorSrc,
              spellCheck: false,
              "aria-label": "canvas 源码编辑",
              onChange: function (event) {
                var value = event.target.value;
                setTabs(function (prev) {
                  if (activeIdx >= prev.length) return prev;
                  var next = prev.slice();
                  next[activeIdx] = Object.assign({}, prev[activeIdx], { editor: value, dirty: true });
                  return next;
                });
              },
              onKeyDown: function (event) {
                if ((event.metaKey || event.ctrlKey) && (event.key === "s" || event.key === "S")) {
                  event.preventDefault();
                  saveSource();
                } else if (event.key === "Escape") {
                  // Editing Esc must not close the window and lose the buffer.
                  event.stopPropagation();
                }
              },
            }),
            h("div", { className: "dsh-cv-editor-meta" },
              h("span", null, editorMeta),
              h("span", null, editorDirty ? "未保存" : "已同步"),
              h("button", {
                type: "button",
                className: "dsh-cv-btn",
                disabled: saving || !editorDirty,
                onClick: saveSource,
              }, saving ? "保存中…" : "保存 ⌘S"),
            ),
          ) : null,
        ),
        toastApi.toast ? h("div", { className: "dsh-cv-toast", role: "status" }, toastApi.toast) : null,
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

    // Intentionally removed (D1): refreshBudget() fetched /capabilities into a
    // budgetState global that nothing ever consumed — the gallery already gets
    // per-row budget status from every /list and /history payload.

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

    // Keep uploads UI-only and local: decode in the browser, resize once, then
    // send a bounded data URI to the host's asset endpoint. Canvas reports still
    // reference the stable `asset://name.webp` name; the iframe never gets a
    // network capability or an arbitrary file path.
    function compressAsset(file) {
      return new Promise(function (resolve, reject) {
        if (!file || !/^image\//i.test(file.type || "")) { reject(new Error("请选择图片文件")); return; }
        var reader = new FileReader();
        reader.onerror = function () { reject(new Error("读取图片失败")); };
        reader.onload = function () {
          var image = new Image();
          image.onerror = function () { reject(new Error("图片解码失败")); };
          image.onload = function () {
            var max = 1600;
            var scale = Math.min(1, max / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
            var canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
            canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
            var ctx = canvas.getContext("2d");
            if (!ctx) { reject(new Error("浏览器不支持图片压缩")); return; }
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            var data = canvas.toDataURL("image/webp", 0.82);
            var stem = String(file.name || "image").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-") || "image";
            resolve({ name: stem + ".webp", data: data });
          };
          image.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    function canvasPathFromArgs(raw) {
      try {
        // Harness core records arguments as a JSON string; stay tolerant of a
        // pre-parsed object if a future shell hands that over.
        var obj = typeof raw === "string" ? JSON.parse(raw || "{}") : (raw && typeof raw === "object" ? raw : {});
        return typeof obj.path === "string" ? normalizeCanvasRef(obj.path) : "";
      } catch {
        return "";
      }
    }

    function addCanvasPaths(state, paths, seq) {
      var out = state.paths.slice();
      paths.forEach(function (raw) {
        var path = normalizeCanvasRef(raw);
        if (path && !out.some(function (row) { return row.path === path; })) {
          out.push({ path: path, seq: seq });
        }
      });
      return { turn: state.turn, paths: out };
    }

    // Any canvas ref is eligible: the host tool already validated HOME + suffix
    // before a successful result, and bare names resolve against the canvas dir.
    function isDshCanvasText(path) {
      return !!path;
    }

    // Bubble rule: a tail appears only for view_canvas calls that SUCCEEDED.
    // tool/call carries callId+arguments; tool/result carries message.{callId,isError}.
    // Recording on the result (not the call) keeps failed calls — e.g. a
    // placeholder path for a file that was never written — from faking a bubble.
    var canvasReportsDefinition = {
      kind: "canvas-reports",
      match: function (event) {
        if (event.type === "turn/start") {
          return { id: String(event.data.turn), role: "start" };
        }
        if (event.type === "tool/call" && event.data.name === "view_canvas") {
          return { id: String(event.data.turn), role: "update" };
        }
        if (event.type === "tool/result") {
          // results carry no tool name; update() resolves them via pending callIds
          return { id: String(event.data.turn), role: "update" };
        }
        return null;
      },
      start: function (_context, match) {
        return { turn: match.event.data.turn, paths: [], pending: {} };
      },
      update: function (context, match) {
        var ev = match.event;
        var state = context.state || { turn: ev.data.turn, paths: [], pending: {} };
        if (ev.type === "tool/call" && ev.data.name === "view_canvas") {
          var path = canvasPathFromArgs(ev.data.arguments);
          if (!path || !isDshCanvasText(path)) return state;
          var pending = Object.assign({}, state.pending);
          pending[ev.data.callId] = { path: path, seq: ev.seq };
          return Object.assign({}, state, { pending: pending });
        }
        if (ev.type === "tool/result") {
          var msg = ev.data.message;
          // Message shape per core/llm createToolResultMessage: callId lives in
          // source.callId (and content[0].toolCallId), isError in content[0].
          var callId = msg && msg.source && msg.source.kind === "tool" ? msg.source.callId
            : (msg && Array.isArray(msg.content) && msg.content[0] && msg.content[0].toolCallId) || (msg ? msg.callId : undefined);
          var isError = !!((msg && Array.isArray(msg.content) && msg.content[0] && msg.content[0].isError) || (msg && msg.isError));
          var entry = callId && state.pending ? state.pending[callId] : null;
          if (!entry) return state;
          var pending2 = Object.assign({}, state.pending);
          delete pending2[callId];
          if (isError) {
            // failed registration (missing file, hard budget, outside HOME): no bubble
            return Object.assign({}, state, { pending: pending2 });
          }
          var merged = addCanvasPaths({ turn: state.turn, paths: state.paths }, [entry.path], entry.seq);
          return Object.assign({}, state, { pending: pending2, paths: merged.paths });
        }
        return state;
      },
      buildLocationData: function (context, scope) {
        if (scope !== "turn" || !context.state) return null;
        return {
          kind: "turn",
          turn: context.state.turn,
          key: "canvas-reports",
          value: { paths: context.state.paths },
        };
      },
    };

    function selectCanvasPaths(owner) {
      try {
        var data = owner.turn && owner.turn.data ? owner.turn.data.get("canvas-reports") : undefined;
        if (!data || !Array.isArray(data.paths)) return null;
        var paths = data.paths
          .filter(function (row) { return row && row.path && row.seq <= owner.seq; })
          .map(function (row) { return row.path; });
        return paths.length ? paths : null;
      } catch {
        return null;
      }
    }

    /* @client-module conversation-tail: successful view_canvas bubble */
    function CanvasTurnTail(props) {
      var paths = props.matched || [];
      if (!paths.length) return null;
      var primary = paths[0];
      var name = primary.split("/").pop() || primary;
      var displayName = name.replace(/\.canvas\.tsx$/i, "");
      var reportCount = paths.length === 1 ? "Canvas 报告" : paths.length + " 个 Canvas 报告";
      return h("div", { className: "dsh-cv-tail", "data-dsh-cv-tail": "" },
        h("button", {
          type: "button",
          className: "dsh-cv-tail-open",
          title: primary,
          "aria-label": "打开 " + displayName,
          onClick: function () {
            requestOpenCanvas(primary);
          },
        },
          h("span", { className: "dsh-cv-tail-icon", "aria-hidden": "true" }, "▤"),
          h("span", { className: "dsh-cv-tail-text" },
            h("span", { className: "dsh-cv-tail-name" }, displayName),
            h("span", { className: "dsh-cv-tail-sub" }, reportCount + (paths.length > 1 ? " · 点击打开首份" : "")),
          ),
          h("span", { className: "dsh-cv-tail-cta" }, "打开"),
        ),
      );
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

    /* @client-module gallery: searchable settings library and asset thumbnails */
    function CanvasRow(props) {
      var item = props.item;
      var onOpen = props.onOpen;
      var onCopied = props.onCopied;
      var onForget = props.onForget;
      var onDelete = props.onDelete;
      var busy = useState("");
      var action = busy[0];
      var setAction = busy[1];
      var menuState = useState(false);
      var menuOpen = menuState[0];
      var setMenuOpen = menuState[1];

      var runCopy = function (kind) {
        setAction(kind);
        setMenuOpen(false);
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
          item.assetRef ? h("img", {
            className: "dsh-cv-lib-thumb",
            src: API + "/assets/raw?name=" + encodeURIComponent(item.assetRef.replace(/^asset:\/\//, "")),
            alt: "",
            loading: "lazy",
            onError: function (event) { event.currentTarget.dataset.broken = "1"; },
          }) : null,
          h("div", { className: "dsh-cv-lib-row-text" },
            h("div", { className: "dsh-cv-lib-row-title" }, item.title),
            h("div", { className: "dsh-cv-lib-row-path" }, item.shortPath || item.path),
            (item.preview && item.preview.headline) ? h("div", {
              className: "dsh-cv-lib-row-summary",
              title: item.preview.headline,
            }, item.preview.headline) : null,
            h("div", { className: "dsh-cv-lib-row-meta" },
              h("span", null, item.workspace || "Canvas"),
              h("span", null, formatBytes(item.bytes)),
              item.estimatedTokens ? h("span", null, "≈" + item.estimatedTokens + " tokens") : null,
              h("span", null, item.openedAt ? ("打开于 " + formatTime(item.openedAt)) : ("修改于 " + formatTime(item.mtimeMs))),
              item.overBudget ? h("span", { className: "dsh-cv-lib-row-warn" }, "超 " + ((item.violations || []).join("、") || "预算")) : null,
              item.warnings && item.warnings.length ? h("span", { className: "dsh-cv-lib-row-warn" }, "含 " + item.warnings.join("、")) : null,
              item.missing ? h("span", { className: "dsh-cv-lib-row-warn" }, "文件已失效") : null,
            ),
          ),
        ),
        h("div", { className: "dsh-cv-lib-actions" },
          h("button", {
            type: "button",
            "data-primary": "1",
            disabled: !!item.missing,
            onClick: function () { onOpen(item.path); },
          }, "打开"),
          h("button", {
            type: "button",
            className: "dsh-cv-lib-more",
            "aria-label": "更多操作",
            "aria-expanded": menuOpen ? "true" : "false",
            onClick: function () { setMenuOpen(!menuOpen); },
          }, "···"),
          menuOpen ? h("div", { className: "dsh-cv-lib-menu" },
            h("button", { type: "button", disabled: !!action, onClick: function () { runCopy("shortPath"); } }, action === "shortPath" ? "复制中…" : "复制路径"),
            h("button", { type: "button", disabled: !!action, onClick: function () { runCopy("markdownLink"); } }, "复制 Markdown"),
            h("button", { type: "button", disabled: !!action, onClick: function () { runCopy("mention"); } }, "复制 @ 引用"),
            onForget ? h("button", { type: "button", onClick: function () { setMenuOpen(false); onForget(item.path); } }, "移出最近") : null,
            onDelete ? h("button", {
              type: "button",
              className: "dsh-cv-lib-danger",
              disabled: !!item.missing,
              onClick: function () { setMenuOpen(false); onDelete(item.path, item.title); },
            }, "删除文件") : null,
          ) : null,
        ),
      );
    }

    function CanvasLibraryPage() {
      var toastApi = useToast();
      var modeState = useState("all");
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
      var uploadState = useState(false);
      var uploading = uploadState[0];
      var setUploading = uploadState[1];

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
        requestOpenCanvas(path);
        toastApi.show("已在浮窗打开");
      };

      var forget = function (path) {
        apiPost(API + "/history/forget", { path: path }).then(reload).catch(function (err) {
          toastApi.show(String(err && err.message || err));
        });
      };

      var removeFile = function (path, title) {
        if (!window.confirm("确定删除文件 " + (title || path) + " ？此操作不可恢复。")) return;
        apiPost(API + "/files/delete", { path: path }).then(function () {
          toastApi.show("已删除 " + (title || ""));
          reload();
        }).catch(function (err) {
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

      var uploadAsset = function (event) {
        var file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) return;
        setUploading(true);
        compressAsset(file).then(function (asset) {
          return apiPost(API + "/assets", asset);
        }).then(function (asset) {
          toastApi.show("已上传 " + asset.name + "（已压缩为 WebP）");
        }).catch(function (err) {
          toastApi.show(String(err && err.message || err));
        }).finally(function () { setUploading(false); });
      };

      return h("div", { className: "dsh-cv-lib", "data-dsh-cv-lib": "" },
        h("div", { className: "dsh-cv-lib-topline" },
          h("div", { className: "dsh-cv-lib-head" },
            h("h3", { className: "dsh-cv-lib-title" }, "Canvas 图库"),
            h("p", { className: "dsh-cv-lib-desc" }, "报告、引用与预览"),
          ),
          h("div", { className: "dsh-cv-lib-topline-actions" },
            h("span", { className: "dsh-cv-lib-count" }, data.loading ? "加载中" : (items.length + " 项")),
            h("button", {
              type: "button",
              className: "dsh-cv-btn",
              title: "切换浅色/深色主题",
              "aria-label": "切换主题",
              onClick: toggleTheme,
            }, "◐"),
          ),
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
          mode === "recent" ? h("button", { type: "button", className: "dsh-cv-btn", onClick: clearRecent }, "清空最近") : null,
          h("label", { className: "dsh-cv-btn", title: "浏览器端缩放并压缩为 WebP 后上传到 ~/.dsh/canvas-assets/" },
            uploading ? "压缩上传中…" : "上传图片",
            h("input", { type: "file", accept: "image/*", hidden: true, disabled: uploading, onChange: uploadAsset }),
          ),
        ),
        data.error ? h("div", { className: "dsh-cv-lib-error" }, "加载失败：" + data.error) : null,
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
                onDelete: mode === "all" ? removeFile : null,
              });
            }),
          ),
        toastApi.toast ? h("div", { className: "dsh-cv-lib-toast", role: "status" }, toastApi.toast) : null,
      );
    }

    var inject = ["slots", "conversationEvents"];

    /* @client-module cordis-entrypoint: reversible slot/effect registration */
    function apply(ctx) {
      ensureCss();
      ctx.conversationEvents.register(canvasReportsDefinition);

      ctx.slots.inject("conversation.chat.turnTail", function () {
        return ctx.slots.register({
          name: "conversation.chat.turnTail",
          select: selectCanvasPaths,
          priority: -10,
        }, CanvasTurnTail);
      });

      var container = document.createElement("div");
      container.dataset.dshCanvasViewer = "";
      document.body.appendChild(container);
      var root = ReactDOM.createRoot(container);
      root.render(h(ViewerShell));
      ctx.effect(function () {
        return function () {
          root.unmount();
          container.remove();
          removeOwnedChrome();
        };
      }, "canvas-viewer: floating-window");

      // First-level settings page (not hidden under Plugins).
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "canvas-library",
          order: 15,
          label: "Canvas 图库",
        }, CanvasLibraryPage);
      });

    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
