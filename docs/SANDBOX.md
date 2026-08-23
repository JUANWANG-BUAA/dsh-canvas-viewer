# Canvas 执行沙箱（SANDBOX）

## 现状（0.4.5 · 资产与预算阶段已落地）

`CanvasMount` 默认在 **`<iframe sandbox="allow-scripts">`**（opaque origin）里渲染 canvas 报告：

- **执行隔离**：canvas 代码运行在 iframe 自己的 realm，与 dsh Web UI 完全隔离；opaque origin 隔离宿主 `window`/`document`/`localStorage`，srcdoc CSP 额外以 `connect-src 'none'` 禁止网络请求，并禁用 worker、form、嵌套 frame 与 object。
- **Preact 内联**：Preact 10 + compat UMD（`assets/preact*.umd.js`，~26 KB 合计，随插件分发）内联进 srcdoc，`React.createElement`/hooks/`ReactDOM.render` 由 compat 提供（附 `createRoot` 垫片），交互（tab/按钮/useCanvasState）在 iframe 内原生工作。
- **SDK 同源**：SDK 源码由 Host 从 `lib/client.js` 用与回归测试相同的锚点提取（`gapStyle` → `createSdk` 结尾），经 `GET /api/canvas/sandbox` 下发，iframe 内重建 —— 永远与运行时/回归镜像同一份。
- **资产引用**：报告可使用 `asset://name.png`；Host 只从 `~/.dsh/canvas-assets/` 读取受支持图片类型，在编译产物中转成 data URI。iframe 不需要也不能通过网络读取本地资产。
- **桥接**：`useCanvasAction` 在 iframe 内 `postMessage` 回宿主，宿主窗口重发 `dsh:canvas:action` 事件由浮窗 toast 承接。
- **降级**：sandbox bundle（UMD assets 或 client.js 缺失）不可用时显示明确按钮；只有用户显式点击“允许兼容渲染”才回到主线程 `new Function`。

## 信任模型

- 仍只打开可信 `.canvas.tsx`（Host 只读 HOME，`view_canvas` 拒绝外部路径）。
- iframe 是纵深防御：即使报告是恶意的，也碰不到宿主页面。

## 已落地加固

- `Object.freeze(sdk)`（主线程兼容路径同样加固）。
- `jsonSafe()` 序列化 SDK/编译产物时转义 `<`，杜绝 srcdoc 内 `</script>` 提前闭合。
- iframe 无 `allow-same-origin`（opaque origin），无 `allow-forms`/`allow-popups`/`allow-modals`。
- srcdoc CSP 只允许 inline script/style（并显式保留 `unsafe-eval` 以兼容当前 `Function()` 编译运行时）、data/blob 图片与 data 字体；`connect-src 'none'`、worker、form、frame 与 object 均禁用。报告仍是可执行代码，必须只打开可信文件。

## 已落地（0.3.0）

- **MessageChannel 握手**：iframe→宿主消息经私有端口传输，宿主只信端口（opaque origin 无法做 origin 比对，端口即身份），窗口 message 仅作 source 校验兜底。
- **降级可观测性**：浮窗头部徽标显示「沙箱渲染/兼容渲染」；预算策略由 settings.json 控制，默认不强制。
- **装配级 e2e**：`scripts/sandbox-e2e.mjs`（42 断言，无浏览器）校验 SDK 提取、srcdoc 装配（模拟 HTML 分词器计数真实 script 元素）、jsonSafe 防逃逸、Light theme remap、真 eval SDK+编译产物，并在 node:vm 隔离内真实加载三个 Preact UMD + DOM 桩 + 同款 bootstrap 真渲染审计 canvas；已并入 `pnpm test`。
- **主题切换**：深/浅色（Light 用宿主 `#165dff`），记忆偏好；iframe 内同步（remap 为 `:root[data-dsh-cv-theme=light]`）。

## 已落地（0.4.4–0.4.5）

- **体积 — React UMD → Preact 10 + compat**：`assets/` 换成 `preact.umd.js`(11.5 KB)+`preact-hooks.umd.js`(3.8 KB)+`preact-compat.umd.js`(11.3 KB)，合计 ~26 KB（原 React UMD ~142 KB）；srcdoc 现装配 4 个 script，compat 提供 `React`/`ReactDOM` 全局与 `createRoot` 垫片。渲染失败仍回退主线程兼容渲染，风险收敛在沙箱路径。
- **预算策略可配置**：`~/.dsh/canvas-viewer/settings.json` 的 `budget.maxLines`/`maxBytes`/`maxTokens`+`budget.enforce`（soft/hard）；浮窗徽标、图库徽标与 `capabilities` 实时读取；hard 下 `view_canvas` 拒绝超限文件。默认不设限；建议值是 80 行、16KB、约 4k tokens。估算 token 是启发式诊断；源码扫描还会提示 inline-data 与重复行。
- **图库结构缩略卡片**：`lib/preview.mjs` 纯源码扫描为每行生成 `preview`（标题/小节/图表/表格/分栏/tone/统计），客户端渲染缩略卡 —— 属「结构签名」，非像素渲染。

## 待续（后续轮次）

1. **像素级图库缩略图**：结构签名已落地；如需真实渲染缩略图需在客户端离屏沙箱渲染（成本高），暂不做 CI。
2. 浏览器端 iframe **交互回归**（真实点击/tab/action 桥）：由 `scripts/sandbox-harness.mjs` 手动演示页 + Playwright 实机验证覆盖；下一阶段将其纳入 CI 或可复现的 smoke job。
