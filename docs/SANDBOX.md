# Canvas 安全与执行边界（0.6.0）

## 两种格式，不同信任模型

| 格式 | Web | TUI |
|---|---|---|
| `.canvas.json` | 严格验证共享 schema，使用插件固定模板渲染 | 同一 schema，原生只读阅读 |
| `.canvas.tsx` | **可信可执行代码**，默认隔离 iframe | 明确提示旧格式；不执行、不自动转译 |

JSON schemaVersion 1 仅允许 text、callout、metrics、table、list、bar-chart、unsupported。
未知版本/字段/块类型、非法表格宽度、非有限或超界数字、控制序列和双向格式控制字符均拒绝，LF/TAB 除外。字段、总文本、数组、表格及源码大小均有限额；具体值见 [report-data.md](../skills/canvas-analysis-report/report-data.md)。
字符串按文本呈现，不解析 HTML、不提供 URL/图片/回调能力；`asset://...` 也是字面文本。Web 编译的是插件固定模板，不是 JSON 提供的代码。TUI 没有任意 HTML、图片、源码编辑或报告回调，不为旧 TSX 提供执行降级。

这不把 Host 插件变成工具沙箱：安装的插件仍以 DSH 进程权限运行。数据验证、路径限制、执行隔离是不同边界；不得把任一层描述为可安全打开任意恶意 TSX 的保证。

## Web 默认隔离与显式兼容

`CanvasMount` 默认使用 **`<iframe sandbox="allow-scripts">`**，没有 `allow-same-origin`、forms、popups 或 modals。opaque origin 隔离宿主 window/document/localStorage；srcdoc CSP 的 `connect-src 'none'` 禁网，并禁用 worker、form、嵌套 frame、object。样式和内联 bootstrap 由插件提供；报告通过一次性 Blob ES module 装载，默认不需要 `unsafe-eval`。

- 随包内联 Preact 10 + hooks + compat，提供 React/hooks/ReactDOM 和 createRoot 垫片。
- Host 从 `lib/client.js` 的 `gapStyle` → `createSdk` 锚点提取同份 SDK，经 `GET /api/canvas/sandbox` 传给 iframe；SDK 对象冻结。
- `jsonSafe()` 转义 `<`，避免数据中的 `</script>` 提前关闭 srcdoc 脚本。
- MessageChannel 私有端口承载桥接；握手核对窗口 source，不能用 opaque origin 做普通同源判断。
- `useCanvasAction` 仅转成宿主的 `dsh:canvas:action` 信息事件/toast，不赋予文件打开、写盘或任意 Host 命令权限。
- 加载中不求值主线程报告。bundle 缺失、拒绝、无效、iframe 失败均 **fail closed**，不自动降级。
- 只有用户点击「允许此报告兼容渲染」才创建主线程 SDK 并使用 `new Function`。该模式**失去 iframe 隔离**；path/source/compiled/moduleCode 任一变化即撤销许可，回到旧报告也不会自动恢复。

仅 Web TSX 的受识别 `asset://name.webp` 字面引用由 Host 校验并内联 data URI；不授予 iframe 本地文件或网络访问。素材所有权、签名及大小限制见 [ASSETS.md](ASSETS.md)。

## 文件、图库与终端边界

共享 repository 只打开 HOME 内受支持后缀的普通文件，安全句柄读取结合 realpath/HOME 校验、最终路径不跟随符号链接及 1,500,000 字节上限。图库只递归索引 `~/.dsh/canvases/`，不扫描整个 HOME；按完整源码做字面搜索，然后排序分页。

扫描有 32 MiB 累计源码预算、32 层深度和 20,000 项上限；元数据缓存限制为 256 条/约 16 MiB。`scanComplete:false` 表示 total/workspaces 不是全部符合条件文件；翻页不能补全被预算截断的扫描。`scanComplete:true` 也不证明未读、超限、竞态文件或排除目录不存在。32 MiB 在当前文件读取后检查，并非 OS 级 I/O 配额。图库卡片是静态结构签名，不运行报告；Web TSX 首个受识别素材可提供懒加载像素缩略图，报告级像素缩略图尚未默认提供。

TUI 入口 `./tui` 与 Web 根入口分开，使用宿主注入的 React/UI。`/canvas` 对应 `canvas.viewer.open`，由 `tuiPluginHost.registerCommand(ctx, ...)` 经 commands 服务归因。manifest owner 是 `dsh-canvas-viewer`；loader admission 和 `commands.invoke` 的精确 scope 不能由插件自行绕过。终端再过滤 OSC/CSI/DCS 等控制协议；原生阅读器的文本/行/匹配预算可能截断内容或搜索范围，并明确提示。终端不是 Web 浏览器，也不注册重复 `view_canvas` 工具。

## 编辑、草稿与写盘

Web 源码编辑器保留原格式（JSON 仍编辑 JSON）。每个 tab 独立保留 editor、dirty、baseSource、baseRevision；磁盘热更新不会覆盖未保存草稿。窗口关闭、tab 关闭和 Escape 走同一脏关闭流程，保存中拒绝关闭；用户可保存后关闭、丢弃或取消。

- Host 写入/删除仅限 `~/.dsh/canvases/` 的真实目录边界，不能借父目录符号链接越界。
- 保存协议 `POST /api/canvas/save {path, source, baseRevision}` 使用 SHA-256 源码 revision、每路径队列、随机独占临时文件和原子 rename。版本不符返回 HTTP 409/`revision-conflict`，保留草稿供对比；确认最新磁盘版本后才可显式替换。
- 未传 baseRevision 保留旧版无条件写模式；不得称所有 API 调用都有冲突保护。插件队列不约束外部编辑器；双重检查与 rename 之间仍有窄竞态，**不是 OS 级 compare-and-swap**。
- 成功写盘与成功渲染是两回事：非法 JSON/TSX 可被保存为源码，返回 payload 中的验证/编译错误必须显示，不能把它描述成有效报告。
- 草稿恢复使用浏览器 localStorage，最多 10 条、序列化总计 1 MiB、读取时限七天，包含源码和基准 revision；不是 Host 备份。容量/存储失败给出提示，卸载插件不会自动清除此浏览器数据。不要把敏感源码的草稿持久化误称为仅内存状态。

## 阅读与打印

- 目录/查找在报告 iframe 内运行，仅索引可见 heading（最多 200）和最多 5000 个文本节点。Range 查找不改写 React DOM；跨节点短语不匹配。
- 私有端口只发送有限滚动数字；父域使用闭包中路径，最多保留 50 个路径的会话内位置，刷新不保留。
- 打印在用户请求后，只接收匹配 requestId 的私有端口快照，UTF-8 上限 1 MiB。父域用 inert template 解析，再按标签/属性/样式白名单重建，丢弃危险节点，不接受远程图片或 URL 样式。
- 预览使用独立的**无脚本** iframe（`sandbox="allow-same-origin allow-modals"`），CSP default-src none、图片仅 data、样式仅 inline。同源只为父页调用打印；绝不将 allow-scripts 与 allow-same-origin 组合用于报告执行。
- 导出仅含当前可见内容，不含隐藏 tab/折叠内容，可能简化交互样式；不是可重放应用或像素级保真 PDF。

## 策略与验证声明

`~/.dsh/canvas-viewer/settings.json` 的 budget.maxLines/maxBytes/maxTokens 和 budget.enforce（soft/hard）由 Web 实时读取。默认不设这些编辑密度限额；建议 80 行、16 KB、约 4k source tokens 是创作目标，不是默认拒绝阈值。hard 模式下工具拒绝超策略文件；共享 reader/schema 的硬安全上限另算。

`sandbox-e2e.mjs` 是装配/VM 检查，不等于真实浏览器。模拟 Host/slots 的 Chromium smoke、真实 DSH Web 激活和原生 TUI renderer/PTY 检查也各有边界。脚本存在或 CI 配置存在不表示本次运行通过；请以 [VERIFICATION-0.6.0.md](VERIFICATION-0.6.0.md) 的实际命令、结果和未覆盖项为准。
