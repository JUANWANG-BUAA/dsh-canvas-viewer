import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sandboxBundle, compileCanvas } from "../lib/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const clientSrc = fs.readFileSync(path.join(root, "lib", "client.js"), "utf8");

const cssStart = clientSrc.indexOf("var css = [");
const arrEnd = clientSrc.indexOf("].join", cssStart);
if (cssStart < 0 || arrEnd < 0) throw new Error("css region not found");
const arrExpr = clientSrc.slice(cssStart + "var css = ".length, arrEnd + 1);
const css = new Function("return (" + arrExpr + ");")().join("");

const bundle = await sandboxBundle();
if (!bundle.available) throw new Error("bundle unavailable: " + bundle.reason);

const TOKEN_SEL = "[data-dsh-cv-root],[data-dsh-cv-canvas],[data-dsh-cv-lib],[data-dsh-cv-tail]";
function jsonSafe(value) { return JSON.stringify(value).replace(/<\//g, "<\\/"); }
function escAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
const cssIn = css.replace(TOKEN_SEL, ":root");

function buildSrcdoc(compiled, name) {
  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>' + escAttr(name) + "</title>" +
    "<style>" + cssIn + "</style>" +
    "<style>html,body{margin:0;padding:0;background:var(--cv-editor,#141414);}.dsh-cv-sandbox-root{min-height:100%;}</style>" +
    '</head><body><div class="dsh-cv-sandbox-root" id="cv-root"></div>' +
    "<script>" + bundle.preact + "</" + "script>" +
    "<script>" + bundle.preactHooks + "</" + "script>" +
    "<script>" + bundle.compat + "</" + "script>" +
    "<script>" +
      "var React=window.preactCompat;var ReactDOM=window.preactCompat;" +
      "if(!ReactDOM.createRoot){ReactDOM.createRoot=function(c){return {render:function(v){return ReactDOM.render(v,c);}};};}" +
      "var __sdkSrc=" + jsonSafe(bundle.sdk) + ";" +
      "var __makeSdk=new Function('ReactLib','h','return (function(){ '+__sdkSrc+';return createSdk(ReactLib); })();');" +
      "var __sdk=__makeSdk(React,React.createElement);" +
      "var __compiled=" + jsonSafe(compiled) + ";" +
      "var __App=new Function('React','sdk',__compiled)(React,__sdk);" +
      "var __root=ReactDOM.createRoot(document.getElementById('cv-root'));" +
      "__root.render(React.createElement(__App));" +
      "window.addEventListener('dsh:canvas:action',function(ev){try{window.parent.postMessage({type:'dsh:canvas:action',action:(ev&&ev.detail)||{}},'*');}catch(e){}});" +
      "window.addEventListener('error',function(ev){try{window.parent.postMessage({type:'dsh:canvas:error',message:String((ev&&ev.message)||'error')},'*');}catch(e){}});" +
      "window.addEventListener('message',function(ev){if(!ev.data||typeof ev.data!=='object')return;var d=ev.data;" +
        "if(d.type==='cv:ping'){try{var el=document.getElementById('cv-root');var txt=el?el.innerText:'';ev.source.postMessage({type:'cv:snapshot',text:String(txt).slice(0,2500),hasChart:!!document.querySelector('.cv-chart'),hasTable:!!document.querySelector('.cv-table'),hasPill:!!document.querySelector('.cv-pill')},'*');}catch(e2){}}" +
        "if(d.type==='cv:click'){try{var found=null;var nodes=document.querySelectorAll('button,[role=button],[tabindex],div,span,a');for(var i=0;i<nodes.length;i++){if((nodes[i].innerText||'').trim()===d.text){found=nodes[i];break;}}if(found){found.click();ev.source.postMessage({type:'cv:clicked',text:d.text},'*');}else{ev.source.postMessage({type:'cv:notfound',text:d.text},'*');}}catch(e3){}}" +
      "});" +
      "try{window.parent.postMessage({type:'dsh:canvas:ready'},'*');}catch(e){}" +
    "</" + "script>" +
    "</body></html>"
  );
}

function page(srcdoc) {
  const b64 = Buffer.from(srcdoc, "utf8").toString("base64");
  return (
    '<!doctype html><html><body style="margin:0">' +
    "<script>" +
    'window.__actions=[];window.__snapshot=null;window.__ready=0;window.__error=null;window.__clicked=null;' +
    'window.addEventListener("message",function(e){' +
    "if(e.data&&e.data.type==='dsh:canvas:action'){window.__actions.push(e.data.action);}" +
    "if(e.data&&e.data.type==='dsh:canvas:ready'){window.__ready=(window.__ready||0)+1;}" +
    "if(e.data&&e.data.type==='dsh:canvas:error'){window.__error=e.data.message;}" +
    "if(e.data&&e.data.type==='cv:snapshot'){window.__snapshot=e.data;}" +
    "if(e.data&&e.data.type==='cv:clicked'){window.__clicked=e.data.text;}" +
    "if(e.data&&e.data.type==='cv:notfound'){window.__clicked='NOTFOUND:'+e.data.text;}" +
    '});' +
    'var iframe=document.createElement("iframe");iframe.setAttribute("data-test","cv-sb");' +
    'iframe.setAttribute("sandbox","allow-scripts");' +
    'iframe.style.cssText="width:100vw;height:100vh;border:0";' +
    'var b=atob(' + JSON.stringify(b64) + ');var bytes=Uint8Array.from(b,function(c){return c.charCodeAt(0);});' +
    'iframe.srcdoc=new TextDecoder("utf-8").decode(bytes);' +
    'document.body.appendChild(iframe);' +
    "</script>" +
    "</body></html>"
  );
}

const outDir = "/tmp/cv-sandbox";
fs.mkdirSync(outDir, { recursive: true });
async function compile(name) {
  const src = fs.readFileSync(path.join(os.homedir(), ".dsh", "canvases", name), "utf8");
  return (await compileCanvas(src, name)).code;
}
const [auditCompiled, feasCompiled] = await Promise.all([
  compile("dsh-canvas-viewer-audit.canvas.tsx"),
  compile("session-git-feasibility.canvas.tsx"),
]);
fs.writeFileSync(path.join(outDir, "audit.html"), page(buildSrcdoc(auditCompiled, "audit")));
fs.writeFileSync(path.join(outDir, "feas.html"), page(buildSrcdoc(feasCompiled, "feas")));

const server = http.createServer((req, res) => {
  const file = req.url === "/feas" ? "feas.html" : "audit.html";
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(fs.readFileSync(path.join(outDir, file)));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
fs.writeFileSync(path.join(outDir, "port.json"), JSON.stringify({ port }));
console.log(JSON.stringify({ port }));
