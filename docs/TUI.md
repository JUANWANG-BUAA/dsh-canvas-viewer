# Canvas 双端阅读（0.6.0）

## 安装与使用

0.6.0 提供 Git bundle 安装与 GitHub release 产物；不要把 GitHub release 等同于 npm registry 发布。验证基线是 dsh-tui **0.16.1**；测试使用临时 HOME，不会自动改动用户 profile。使用前将 bundle 安装到明确指定的 TUI profile 并重启：

```sh
pnpm build:host
pnpm build:client
# 在仓库根目录；本地安装会修改明确指定的 profile
dsh plugin --profile dsh-tui add .
```

不要把 `dsh-canvas-viewer/tui` 当成独立 npm 包；它是同一包的导出子入口。bundle patch 同时包含原 Web 行和 TUI 行，各自由服务依赖激活。纯 TUI 不需要加载 Web 根入口，Web 不会因缺少 TUI 服务而失败。需要对应宿主 Loader 提供 manifest admission；不支持私自调用 admit 或绕过命令授权。冷启动完成后使用 `/canvas`；建议重启，不保证已 ACTIVE 插件之后才启动 admission-loader 的热补准入。

```text
/canvas
/canvas ~/.dsh/canvases/report.canvas.json
/canvas "/absolute/path with spaces/report.canvas.json"
```

默认图库递归扫描 `~/.dsh/canvases/`。直接路径只允许 HOME 内文件，保留现有 basename 回退规则。可复制仓库 `fixtures/dual-reader.canvas.json` 到该目录体验。`view_canvas` 保持 Web 入口，不在 TUI 重复注册同名工具。

## 按键

| 按键 | 图库 | 报告 |
|---|---|---|
| ↑↓ | 选择 | 逐行滚动 |
| PgUp/PgDn | 上下页 | 翻页 |
| Home/End | 页首/尾 | 节首/尾 |
| Enter | 打开选中报告；搜索输入中先确认，再按一次打开 | 搜索时确认并跳转首项 |
| ←→ | — | 切换章节 |
| / | 输入图库搜索 | 输入正文搜索 |
| n / N | — | 下/上一命中，可跨章节 |
| r | 重扫 | 重读文件 |
| Esc | 关闭 | 返回图库；搜索中先结束输入 |

只读：不修改源文件、不运行报告代码、不写会话消息，不提供编辑/打印/图片或任意 HTML/SVG。Ctrl+C 仍交给宿主。窄终端表格转成逐条字段，宽终端用列布局；字素和显示宽度覆盖 CJK、组合字符和 emoji，但终端字体仍可能有差异。

## 格式与兼容

详见 [数据格式](../skills/canvas-analysis-report/report-data.md)。`schemaVersion:1` 支持 text/callout/metrics/table/list/bar-chart/unsupported 七类块。未知版本、键、类型、错宽表格、超量数据、控制协议或 bidi override 被拒绝。JSON 文本中的 HTML、代码、asset:// 等仅为文字；不会读取文字里的资产。

- **Web + JSON**：严格校验 → 固定 SDK 模板 → 现有隔离 iframe。源码面板仍显示/保存 JSON。
- **TUI + JSON**：严格校验 → 原生文本组件，注入宿主 React/ui，不加载 Web root/compiler。
- **Web + TSX**：保留既有编译/隔离执行/编辑/打印逻辑。
- **TUI + TSX**：显示 legacy 与未执行声明；请使用 Web 或另行编写数据版。不会猜测/自动执行 hooks 以转换它。

读取硬上限 1.5MB；图库最多遍历 20000 项、深度32、每轮候选源码32MiB，遇限 `scanComplete:false`，TUI 显示 PARTIAL SCAN。总数只是本轮扫描范围，不保证完整磁盘库存。预览摘要最多240字符；元数据缓存256项/约16MiB，全文搜索是源码字面匹配，不是语义检索。TUI格式器对行数和命中数也有显式截断提示。

## 三种入口与聊天图片

- `/canvas` 是阅读器命令，必须由已激活的 TUI 插件注册。未知命令表示当前会话没有提供它；只安装文件、不重启，或缺少宿主服务/准入，都不等于激活。
- `/canvas-analysis-report` 是报告生成 skill，不是打开图库的命令，也不会安装插件。只有实际暴露 `view_canvas` 工具的 Web 会话才可由助手直接调用它；工具缺失不能单独证明整个 Web 插件未挂载。
- 聊天截图附件走 dsh-tui 自身的图片预览链路，不经过 Canvas。0.16.1手册说明缩略图需要 Kitty graphics 或 Sixel 等能力，不满足时文字回退；只看到路径不能诊断为 `/canvas` 未激活，也不能确认唯一原因。Canvas首版自身不显示图片块。

## 生命周期与权限

TUI入口只硬依赖 commands/tuiScenes。命令通过 `tuiPluginHost.registerCommand` 精确归属 `canvas.viewer.open`；manifest 声明 Command 合约、scope权限与 Scene 贡献。`commands.invoke` 在0.16.1默认 allow，但显式 deny 优先；坏授权文件 fail-closed。Scene 本身是进程内扩展，不是安全沙箱。插件等待准入最多约20秒，失败记录日志，不降级绕过。卸载释放命令、场景、订阅与计时器；文件读取只读、路径归属检查、O_NOFOLLOW/O_NONBLOCK+regular-file检查，不执行 TSX。

## 已验证与未验证

```sh
pnpm test
pnpm test:tui
DSH_TUI_PACKAGE=/absolute/path/to/installed/dsh-tui pnpm test:tui-runtime
CANVAS_CDP_URL=http://127.0.0.1:PORT node scripts/browser-smoke.mjs
```

- 默认测试：严格 schema（12项）、恶意字符串/真实 SDK编译、共享仓储、FIFO/符号链接、JSON Web保存、native格式及注入hook行为、原有完整Web回归。
- 实际安装 TUI0.16.1：真实 Cordis activation、Command/Scene/PluginHost、两轮卸载重载；另以实际 Cordis Loader+生产 admission-loader 冷启动，包导出/最近manifest自动准入链路通过。脚本也含明确标注的私有 host fixture；私有接口仅在测试驱动中，不进入插件。
- 实际宿主 React + public terminal renderer + ThemeProvider/AlternateScreen：中文、章节/表格、同事件循环突发搜索、Enter跨章节、原始Esc回库/关闭通过。捕获真实 ANSI diff并重建屏幕，不将历史输出当作当前帧。
- Edge155 实际浏览器：旧TSX完整工作台以及JSON模板/表格渲染通过；Host网络部分由浏览器测试fixture模拟。
- 浏览器原生终端视觉：实际 Scene/宿主 React → node-pty 真 PTY → WebSocket → xterm.js 6 → Edge155；宽屏100×28、窄屏40×24、滚动/缩放恢复、深浅主题、搜索/返回、legacy与非法数据错误均保留截图。不是用HTML重写TUI，也不是完整CLI/profile启动证据。视觉复核修复了窄屏页脚隐藏搜索/Esc、图库非法文件误标structured及绝对路径挤占内容的问题。

### 重现浏览器终端视觉检查

测试依赖仅放忽略目录，不进入插件依赖或用户profile：

```sh
npm install --prefix output/tui-visual-deps --no-audit --no-fund --ignore-scripts --save-exact @xterm/xterm@6.0.0
# 先按系统浏览器CDP方式启动独立profile，勿使用日常浏览器profile
DSH_TUI_PACKAGE=/absolute/path/to/installed/dsh-tui \
  CANVAS_CDP_URL=http://127.0.0.1:9332 pnpm test:tui-browser
```

也可用 `CANVAS_XTERM_ROOT` 指向已经安装的 `@xterm/xterm` 包根目录；TUI宿主必须可解析 `node-pty` 与 `ws`。脚本只绑定loopback，每个页面启动临时HOME的只读Scene，输入和resize送到PTY，退出后清理PTY/server/临时HOME，不修改真实profile。截图及纯文字屏幕位于 `output/tui-browser/`，覆盖矩阵在 `result.json`。截图外围浏览器标题/边框只是测试容器，终端内部内容来自实际原生renderer。

未完成完整 `dsh-tui` CLI/profile 启动验收、用户 profile 的安装/重启、权限实时撤销、late-loader准入和未来TUI版本兼容验证。这些边界不因打标签或创建 release 而扩大。可选本机运行产物在忽略目录 `output/tui/` 与 `output/tui-browser/`；代表性截图随文档发布在 `docs/assets/`。
