# Changelog

## 0.4.7

- **图库像素预览**：对源码明确引用的首张 `asset://` 图片增加受限原始资产路由和懒加载真实像素缩略图；不执行整个报告，不改变 iframe 禁网策略。
- **客户端工程契约**：增加源码模块边界、单 factory/无浏览器 import/180KB 体积检查，防止 `lib/client.js` 在等待构建层拆分期间继续无约束膨胀。
- **安装可靠性**：本地刷新同步中英文 README 与资产 Host 模块，避免 dsh profile 保留不完整副本。

## 0.4.6

- **沙箱安全**：默认 iframe CSP 改用 Blob ES modules 装载 SDK/报告，不再依赖 `unsafe-eval`；主线程 `new Function` 仅保留为用户明确点击后的兼容降级。
- **资产工作流**：图库新增浏览器端缩放/WebP 压缩上传；Host 提供受限的 `/api/canvas/assets` 列表与写入接口，资产仍只落在 `~/.dsh/canvas-assets/`，上限 2MB。
- **回归与文档**：sandbox e2e、浏览器 smoke 覆盖无 `unsafe-eval` 合同；补充中英文 README、发布安装说明与可信文件模型。

## 0.4.5

- **Token/体积**：新增 `asset://name.png` 编译期资产引用；报告源码不再携带 base64，Host 只从 `~/.dsh/canvas-assets/` 读取受支持图片并在 sandbox 内安全内联。
- **安全**：资产路径限制在专用目录、拒绝目录穿越/越界 symlink/不支持类型/超过 2MB 的文件；iframe 网络策略不变。
- **回归**：资产 mtime 参与编译缓存签名，新增真实 openCanvas 资产编译测试。
- **热更新**：已打开报告同时监听专用资产目录；替换图片会通过已有 SSE 刷新，不会在无打开报告时常驻 watcher。

## 0.4.4

本轮工程收边界（尚未 bump 版本号）：

- **安全**：srcdoc CSP 明确禁止网络、worker、form、嵌套 frame、object；为兼容现有 `Function()` 编译运行时显式保留 `unsafe-eval`，并在文档中说明这不是不可信代码执行承诺。
- **生命周期**：插件 fiber 卸载时关闭所有 canvas `fs.watch`、SSE 响应与 debounce 定时器，避免热更新资源跨 reload 泄漏。
- **安装**：`sync-install.sh` 仅通过 `dsh plugin` 修改 profile，不再自动批准无关构建脚本或手改 `node_modules` fallback；skill 镜像与第三方 notice 纳入同步/打包边界。
- **发布**：新增 npm 包边界检查与 GitHub Actions CI，锁定必需文件、排除开发产物，并在测试中校验 skill 镜像一致性。
- **本地开发**：同步脚本校验 profile 的实际安装副本；检测到 pnpm 复用旧的同版本 `file:` 包时，仅通过 dsh 对本插件执行 remove/add 刷新。

## 0.4.3

合规收尾 + 图库 IO 优化 + 回归修复：

- **修复 — 气泡门控真正落地**：移除上一轮排查残留的 `TEMP BISECT PROBE` DOM 调试块与 `tool/call` 早返回——它们让气泡又回到「调用即显示」的旧时序，`tool/result` 成功门控分支成为不可达代码。现在严格按 0.4.2 设计：`tool/call` 只登记 pending，`tool/result.isError` 才决定是否生成气泡。
- **合规 — `dsh.client.inject` 清空**：client 只依赖基线 `react`/`react-dom/client` 与 Cordis slot 服务，不再重复声明 `@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-slots`；boot graph 的 inject 边归零，避免预检/HMR 对不存在的模块边产生噪音。
- **性能 — 图库元数据缓存**：`/list` 与 `/history` 新增 `canvasMetaCache`（size+mtime 键控），未变化的画布不再每次 `readCanvasSource` 重扫预览/行数；save/delete/migration 自动失效。大目录图库二次打开显著变快。
- **性能 — sandbox bundle 缓存**：`GET /api/canvas/sandbox` 首次构建后缓存整个 Preact+SDK 包，重复打开/多浮窗不再重复读资产与 client.js。
- **回归 — 修复存量 canvas 非法 JSX**：`dsh-canvas-viewer-compliance-audit.canvas.tsx` 的 `{…}` 字面量改为 JSX 表达式 `{'{…}'}`，全量渲染回归恢复 35/35 通过。
- 测试：syntax(2) + self-test(72) + regression(35/35) + sandbox-e2e(55) 全绿。

## 0.4.2

修复 + 窗口升级（P1-5）：

- **修复 — 浮窗只剩一条窄边**：0.4.1 分栏改造给渲染层套的 `.dsh-cv-render` 包裹 div 断开了 `.dsh-cv-sandbox-wrap{height:100%}` 的高度链（非分栏时 body 非 flex，包裹层高度塌成 auto，沙箱 iframe 跟着塌陷）。现在**仅分栏时**才包裹，非分栏 DOM 结构与旧版完全一致。
- **修复 — 对话气泡假阳性 + 漏报**：气泡数据源从 `tool/call` 改为 **`tool/result` 成功门控**——`tool/call` 只登记 pending(callId→path)，`tool/result.message.isError` 为真（文件不存在/超预算拦截/HOME 外）一律不生成气泡，根治「占位路径 xxx.canvas.tsx 也弹气泡」；同时参数解析兼容 JSON 字符串与对象两种形状，路径过滤放宽（裸文件名/任意 HOME 画布路径均认，成功结果已由 host 校验），修复「35 个 view_canvas 调用 0 气泡」的漏报。旧会话已持久化的假气泡属于历史数据，不回写。
- **多画布 tab 条（P1-5）**：浮窗支持同时打开多张画布——标题栏下出现 tab 条（文件名 + 未保存 ● + 单 tab 关闭 ×），打开新画布自动激活对应 tab；热更新静默刷新对应 tab（不抢焦点）；关 tab 记忆 seq，迟到的推送不会复活已关 tab；Esc/× 关闭当前 tab，最后一个 tab 关窗。
- **窗口尺寸升级（P1-5）**：双击标题栏**最大化/还原**（最大化时禁止拖拽）；缩放手柄从只有底部纵向扩到 **e/s/se/sw 四向**（右缘调宽、底部调高、双角同步），宽度持久化到 `dsh-cv-pos`（与旧存档兼容合并）；手机端自动隐藏全部手柄维持全屏。
- 测试：sandbox-e2e 55 断言（+气泡门控/参数形状/tab/手柄/最大化标记）。

## 0.4.1

P0 功能四连（canvas 优化路线图 P0 批次）：

- **文件热更新（P0-1）**：新增 `GET /api/canvas/watch?path=`（SSE）——host 对打开中的画布做**目录级 fs.watch**（rename 替换不失效）+ 内容 sha256 去抖（200ms），磁盘一变即推送重编译 payload，浮窗**自动重渲染**（无需任何操作；seq 单调防回退）。实测：磁盘 +1 行 → 浮窗 meta `21→22 行` 自动更新。删除文件推送 `deleted` 事件（浮窗 toast 提示）。
- **源码/渲染分栏 + 保存即重编译（P0-2）**：浮窗新增「源码」按钮——左右分栏（窄屏自动上下分栏），左侧渲染右侧 monospace 编辑器；`⌘S`/`Ctrl+S` 或「保存」→ `POST /api/canvas/save`（原子写 tmp+rename，**仅限 `~/.dsh/canvases/`**，超 MAX_BYTES 拒绝）→ 返回重编译 payload 即时刷新。编辑器跟随热更新但**绝不覆盖未保存的修改**（dirty 守卫）；编辑器内 Esc 不关窗（防误丢缓冲）。
- **图表 hover tooltip（P0-3a）**：Bar/Line/Pie 全部支持原生 SVG `<title>` tooltip（系列 · 标签: 值 / 值+百分比），零 JS 层、零体积增量；`tooltip` 从降级徽标清单除名。
- **Table sortable 真实现（P0-3b）**：`sortable` prop 转正——表头点击排序（升→降→取消三态、数值感知、zh locale 文本比较、`aria-sort` 标注、行 tone 跟随不脱落）；`sortable` 从降级徽标清单除名。capabilities/sdk.md 四处镜像同步。
- **沙箱主题实时跟随（P0-4a）**：切主题时通过 MessageChannel 端口向 iframe 推送 `dsh-cv:theme`（init 握手也携带当前主题），srcdoc 内 `__cvTheme` 即时切换 `data-dsh-cv-theme`——不再需要重开画布。
- **沙箱内 Esc 转发（P0-4b）**：iframe 内 keydown 不冒泡到宿主，现由沙箱脚本经私有端口转发 `dsh-cv:esc`，宿主收到即关窗。实测：焦点进入沙箱后 Esc 关闭浮窗。
- **修复 — openCanvas 重构回归**：`readCanvasBuffer` 返回形状不一致导致所有 `/open` 500（`reading 'byteLength'`）；self-test 新增 openCanvas payload 形状回归断言（含 history.json 备份恢复，不污染真实记录）。
- 测试：self-test 67 断言（+openCanvas/save 守卫/特性广告）、sandbox-e2e 50（+真实 jsonSafe/主题与 Esc 链路标记/热更新与保存标记/tooltip 真渲染文本）。

## 0.4.0

- **修复 — 浮窗打开即闪崩（沙箱路径 jsonSafe 坏正则）**：`lib/client.js` 的 `jsonSafe` 正则 `/<//g` 丢失反斜杠（本意 `/<\//g`），语法合法但运行时抛 `ReferenceError: g is not defined`——且 `jsonSafe` 仅在沙箱 srcdoc 装配时调用，异常经 `<SandboxedMount>`（此前无 Boundary 包裹）直达 React root，整个插件 UI（浮窗/气泡容器）被卸载，直到刷新页面才恢复。修复正则，并把沙箱分支也包进 `Boundary`（沙箱路径渲染错误降级为 ErrorBox，不再炸根）。同步收紧 `sandbox-e2e`：改为**从 client.js 提取并执行真实 jsonSafe**（此前测试用的是自己的正确副本，shipped 版本坏掉也测不出）。
- **修复 — 打包白名单**：`package.json` `files` 补 `assets/` 与 `lib/preview.mjs`——此前 GitHub 安装路径会得到 `import "./preview.mjs"` 直接崩溃的 host + 缺失的沙箱资产（仅本地 `sync-install.sh` 路径可用）。
- **修复 — history 原子写**：`saveHistory` 由 tmp 写回读再写目标改为 `rename` 原子替换，不再残留 `history.json.tmp`。
- **测试 — factory 装载冒烟**：self-test 新增按 dsh Web loader 同款方式物化 client.js（stub `__ModuleLoader__` + react 桩），断言 factory id 等于包名、`react`/`react-dom/client` require 契约、导出 `apply`/`inject`（57 断言）。
- **测试 — 去机器耦合**：self-test/sandbox-e2e 对 `~/.dsh/canvases/dsh-canvas-viewer-audit.canvas.tsx` 的依赖改为仓库内 `fixtures/audit-sample.canvas.tsx`。
- **文档 — AGENTS.md 更正**：移除从未注册的 `web-ui.plugin.item`；补 client 装载契约说明（插件 client 永不进预构建 shell bundle；boot graph + `/plugins/<id>/client.js` 运行时懒加载；插件集变化需重启宿主，内容变化走 stat-poll HMR——"重建 Web assets / dev:web"对外部插件无效）。
- **澄清 — 「UI 乱码」未复现**：charset 管线全链路审计无缺陷（srcdoc 带 `<meta charset>`、所有读写显式 utf8、API/下载带 charset）；修复后实机扫描主界面/图库/浮窗文本 0 mojibake。此前疑似乱码应为旧缓存/旧版本残留。
- **沙箱体积 — React UMD → Preact 10 + compat**：`assets/` 由单个 React UMD（~142 KB）换成 `preact.umd.js`(11.5 KB) + `preact-hooks.umd.js`(3.8 KB) + `preact-compat.umd.js`(11.3 KB)，合计 ~26 KB，且天然即插即用 `React.createElement`/hooks/Fragment/`ReactDOM.render`（compat 提供，附 `createRoot` 兼容垫片）。Host `sandboxBundle()` 按 `runtime: "preact-compat"` 装配 srcdoc（现 4 个 script），客户端 srcdoc 用 `window.preactCompat` 定义 React/ReactDOM。渲染失败仍回退主线程兼容渲染，风险收敛在沙箱路径内。
- **沙箱 e2e 升级**：`scripts/sandbox-e2e.mjs` 27→43 断言，新增 vm 隔离内真实加载三个 Preact UMD + DOM 桩 + 同款 bootstrap，**真渲染 fixture canvas**（收集文本含 "0.4.0/自验收"，DOM 有子节点）——无需浏览器即可回归渲染路径。
- **120 行预算 → 可配置策略**：`~/.dsh/canvas-viewer/settings.json` 的 `budget.maxLines`（默认 120）+ `budget.enforce`（`soft` 提醒 / `hard` 拦截）。soft 下超限只在图库/元信息给「超N行」徽标；hard 下 `view_canvas` 直接拒绝执行（agent 必须拆分）。图库徽标与 `/api/canvas/capabilities` 的 `budget`/`recommendedMaxLines` **实时读取**，改配置无需重启宿主；`walkCanvases` 与历史列表同步标注 `overBudget`。
- **图库结构缩略卡片**：Host 新增 `lib/preview.mjs`（纯源码扫描、零 eval 零编译），为每行附 `preview`（标题、小节数、图表/表格/分栏标记、首个 tone、统计卡数）；客户端每行渲染紧凑缩略卡（headline + ▥▦▧§▤ glyphs + tone 色条），`/list` 与 `/history` 都带。
- **部署脚本修复**：`scripts/sync-install.sh` 的 rsync 白名单补上 `assets/***`（此前 Preact 资产不会同步到真实安装）；`dsh plugin add` 失败（pnpm `ERR_PNPM_IGNORED_BUILDS`）不再 `set -e` 中断，自动尝试 `pnpm approve-builds` 并继续。
## 0.3.0

- **UI/移动端 — 融入 dsh navy 设计语言**：token 全面换成与宿主一致的深蓝底（`--cv-editor:#131a2e` 等）+ DeepSeek 蓝强调色 + 宿主字体栈与柔和阴影；浮窗头部加渲染模式/预算徽标（沙箱渲染/兼容渲染/超120行）与深/浅主题切换（持久化，Light 用宿主 `#165dff`），底部加「行数 · 字节」元信息条；图库 Hero 重做（渐变卡片 + 主题按钮），列表卡片悬停抬升，搜索/选择圆角化；对话气泡卡片化。**手机端**：≤760px 浮窗全屏（无边框/圆角、隐藏拖拽、触控目标加大）、图库工具栏换行/搜索占满、≤420px 收窄列；修复宿主导航规则误伤——宿主移动端用 `[aria-modal=true]:has(...)` 给自家导航 sheet 加全屏样式，本插件浮窗结构签名恰好命中被压成 absolute，已去掉 `aria-modal`（保留 `role=dialog` + 焦点管理）规避。
- **沙箱第二阶段 — MessageChannel 握手**：iframe→宿主消息从裸 postMessage 升级为 MessageChannel 私有端口握手（宿主只信端口，杜绝跨窗口伪造），保留 source 校验兜底。
- **沙箱装配 e2e 并入测试**：新增 `scripts/sandbox-e2e.mjs`（27 断言），无浏览器验证 SDK 提取、srcdoc 装配（模拟 HTML 分词器计数真实 script 元素）、jsonSafe 防 `</script>` 逃逸、Light theme remap、以及真 eval SDK+编译产物得到可渲染组件；`pnpm test` = 语法(2)+自测(43)+回归(28)+沙箱装配(27)。
- **图库 provenance**：Host `listCanvases` 从迁移 manifest 注解每项 `provenance`（来源/sha256 短值/迁移时间），列表显示「自旧版迁移」徽标（悬停见详情）。

- **P0 修复 — CSS token 作用域**：`--cv-*` 变量定义从 `[data-dsh-cv-canvas]` 提到窗口/图库/气泡共用作用域，`.dsh-cv-win` 边框从失效(`border:0`)恢复为真实描边；图库 hero 边框同步修复。
- **P0 修复 — 统一路径解析**：客户端 `extractCanvasPath`/`cleanCanvasPath` 合并为单一 `normalizeCanvasRef`（气泡、点击、图库同一规则），Host 侧新增 `cleanRef` 镜像清洗；`title` 提示不再触发打开，普通提问气泡提及路径不会跳浮窗，仅 `data-canvas`/`data-path`、真实 `.canvas.tsx` 链接或整段等于路径的文本可点击打开。
- **P0 修复 — 渲染回归测试**：新增 `scripts/regression.mjs`，对 `~/.dsh/canvases/` 全部存量文件做 编译→求值→`renderToStaticMarkup` 渲染断言 + SDK 导入名 lint；SDK 直接从 `lib/client.js` 提取，永远镜像运行时。`pnpm test` = 自测(29 断言) + 回归。
- **P0 新增 — 能力协商**：`GET /api/canvas/capabilities` 返回组件/props/限制清单；`sdk.md` 同步；不支持的 props 以 ▤ 降级徽标提示，不再静默丢弃。
- **P0 新增 — 错误定位**：sucrase 编译错误带 `file:line:col` 与源行；运行时错误经 source map(VLQ) 映射回 `.canvas.tsx` 行列；`view_canvas` 输出 `lines`/`bytes`，超 120 行预算给模型反馈。
- **P1 — 图表升级**：Bar/Line 补 y 轴刻度、网格线、值标签、图例(多系列)、referenceLines，支持 `yMax/yMin/valueSuffix/beginAtZero`；Pie 补图例(值+百分比)；图表加 `aria-label`。
- **P1 — Grid 响应式**：窄窗自动收列(920px→2 列、560px→1 列)。
- **P1 — 无障碍**：浮窗 `role=dialog/aria-modal/aria-label`，打开聚焦、关闭还原焦点；按钮 focus-visible 轮廓。
- **P1 — 语义补齐**：`Table` 单元格支持 `{href,label}` 渲染链接；`CardHeader` 支持 `size/tone`。
- **P0/工程 — 测试管线加固**：`pnpm test` = 语法检查(`node --check` lib*) + 自测(29 断言) + 全量渲染回归；新增文档↔SDK lint（`sdk.md` import 清单 ⊆ `createSdk()` 导出）；`react`/`react-dom` 固定为 devDependencies，回归缺 React 直接失败而非静默跳过。
- **P1 — 伪交互修复**：`useCanvasState` 实现按挂载实例 + key 作用域的真实状态存储；`useCanvasAction` 改为真实 action 总线（`dsh:canvas:action` window 事件 + 浮窗 toast 可见反馈）。
- **P1 — React key 兜底**：SDK `keyedChildren` 给混合 children 补稳定 key；`Table` 单元格数组经 keyedChildren，回归 0 key 警告。
- **P1 — 编译缓存**：Host `compileCanvas` 按 mtime+size 键控缓存（≤200 条），重复打开不再重复 sucrase。
- **P1 — 迁移 provenance**：启动迁移记录 `~/.dsh/canvas-viewer/migration-manifest.json`（name/source/sha256/migratedAt）。
- **P1 — 图库删除 + 预算标签**：`POST /api/canvas/files/delete`（仅限 `~/.dsh/canvases/`，带确认）；列表展示超 120 行标签。
- **P1 — 死协议清理**：删除 `dsh-canvas://` `refs.openUrl`（无任何消费者）。
- **安全评估 — 沙箱**：新增 `docs/SANDBOX.md`（iframe 沙箱方案与分阶段计划）；本版加固 `Object.freeze(sdk)`，capabilities 暴露 `sandbox.level: trusted-files-only`。
- **沙箱第一阶段（新增）**：canvas 默认在 `<iframe sandbox="allow-scripts">`（opaque origin）内渲染——React 18 UMD（`assets/react*.production.min.js`，内置分发）内联进 srcdoc，SDK 由 Host 从 `lib/client.js` 提取经 `GET /api/canvas/sandbox` 下发（与回归同锚点，永远镜像运行时）；`useCanvasAction` 经 postMessage 桥回宿主 toast；宿主不可用（如未重启）时自动回退主线程兼容渲染。实机 Playwright 验证：隔离生效（宿主无法触碰 iframe DOM）、审计 canvas 完整渲染、tab 切换（useCanvasState）与 action 总线均工作。

## 0.2.0

- **去 Cursor 化**：新报告默认写入 `~/.dsh/canvases/`，新 import 协议为 `"dsh/canvas"`；图库只索引 `~/.dsh/canvases/`，`cursor/canvas` 仅兼容旧文件。
- **原生对话气泡**：注册 `canvas-reports` 会话事件与 `conversation.chat.turnTail`，`view_canvas` 只登记不自动弹窗，在对话尾部渲染可点击 Canvas 气泡。
- **省 token**：system prompt 缩到一句触发；skill 文档从 ~640 行压缩到 ~220 行；聊天只需短结论；气泡可识别对话中提到的 `~/.dsh/canvases/` canvas 路径。
- **修复**：气泡路径清理 + Host 回退解析（绝对路径缺失时按 basename 在 `~/.dsh/canvases` 查找）；启动时自动迁移旧 `~/.cursor/projects/*/canvases` 到 `~/.dsh/canvases/`，解决图库为空和「canvas not found」。
- **UI 细节**：设置图库提升为一级设置页，重做 hero/卡片/图标，浮窗动画与质感优化，气泡改为可点击卡片；浮窗位置持久化。
- 工具描述、README、自测同步为 dsh 原生。

## 0.1.3

- Fix click-to-open for bare filenames in chat (`foo.canvas.tsx`): resolve via `~/.cursor/projects/*/canvases` and `~/.dsh/canvases` instead of `process.cwd()` (avoids ENOENT under the plugin checkout).

## 0.1.2

- Canvas renderer overhaul aligned with Cursor canvas dark tokens (CSS variables).
- Components: `Table` (`rowTone`/`striped`/`framed`/`stickyHeader`), `CardHeader.trailing`, `TodoList`, `Swatch`, `UsageBar`, `BarChart`/`LineChart`/`PieChart`, `CollapsibleSection`, `mergeStyle`, richer `Pill`/`Stat`/`Text`/`Button`.
- `computeDAGLayout` now returns `width`/`height` on nodes and `points` on edges (SVG-ready).
- Skill `sdk.md` updated to the new subset.

## 0.1.1

- Skill `canvas-analysis-report` 改为 **dsh 自洽**：去掉对 `~/.cursor/skills-cursor/canvas` 的硬依赖；增加 [sdk.md](skills/canvas-analysis-report/sdk.md) 与 viewer 子集对齐的模板。
- Host：短 `systemPrompt` 段引导「写 canvas → `view_canvas`」；强化工具描述。
- 文档：赛道对照 [docs/COMPARISON.md](docs/COMPARISON.md)；安装改为 `~/.dsh/plugins` 实拷。
- 质量：`scripts/self-test.mjs`、`scripts/sync-install.sh`。

## 0.1.0

- 初版：Host 编译 + `/api/canvas/*`、浮窗 Client、设置图库、skill 初稿。
