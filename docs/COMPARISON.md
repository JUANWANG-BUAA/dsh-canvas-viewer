# 赛道对照：dsh-canvas-viewer 0.6.0

## 定位

**结构化调查/设计报告**用本插件：优先 `.canvas.json`，让同份数据通过 Web 与原生 TUI 阅读；需要受信任自定义交互、SVG 或图片时，仍可选择 Web 专用 `.canvas.tsx`。它不是任意 HTML 原型浏览器，也不依赖 Cursor 运行时。

## 形态对照

以下是工作流定位，不是其他项目当前版本的安全或兼容认证；选型时仍应核对其实际文档与版本。

| 项目 | 主要内容 | 入口/界面定位 | 与本项目差异 |
|---|---|---|---|
| dsh-plugin-canvas | HTML 原型 | `canvas_preview` / 画布页签 | 侧重 HTML 预览，不是共享 JSON 报告 schema |
| dsh-html-canvas | HTML | HTML 侧栏工作流 | 不是本项目的结构化双 reader 报告协议 |
| **dsh-canvas-viewer** | 数据型 JSON + 旧版可执行 TSX | Web `view_canvas`、对话气泡、浮窗、图库；TUI `/canvas` | 结论/证据/行动体裁；同份 JSON 双端只读呈现，Web 另有源码编辑与打印 |

## 本项目的格式边界

| 能力 | JSON（Web + TUI） | TSX（Web） |
|---|---|---|
| 内容 | text/callout/metrics/table/list/bar-chart/unsupported | `dsh/canvas` SDK 子集、自定义可信组件 |
| 信任 | 严格数据 schema，文本不解析 HTML/URL/回调 | 可执行报告，默认隔离 iframe；显式兼容会在宿主 realm 执行 |
| 图片 | 无图片块；`asset://...` 只是文本 | Host 校验并内联受识别素材字面引用 |
| 终端行为 | 原生文字、表格、Unicode 条形图；导航/查找 | 明确旧格式提示，不执行，不保证自动转换 |

## 对齐的实践与限制

1. Host/repository 拥有文件；Web 保存要等 Host 确认，不能把乐观 UI 当写盘成功。TUI 是独立入口，使用宿主 React/UI，不导入 Web 根模块。
2. Web 模型工具和 TUI 人类命令不混同：`/canvas` 通过 commands mediation 注册为 `canvas.viewer.open`，保留 manifest owner、loader admission 与权限；TUI 不重复注册 `view_canvas`。
3. 同份 JSON 共享版本化严格 schema；未知字段/类型失败，不静默丢弃。可执行 TSX 只应来自可信来源。
4. 图库只索引 `~/.dsh/canvases/`，支持完整源码字面搜索后分页，但受 32 MiB/深度/项数扫描预算限制。`scanComplete:false` 的 total 只是本次已扫描结果；`true` 也不覆盖不可读、超限或排除目录。
5. 原生终端不提供任意 HTML、图片、源码编辑或报告回调；Web 打印是当前可见内容的无脚本净化快照，不保证隐藏 tab 或像素级 PDF。
6. 方法和模板按需放在 skill，不堆进长 system prompt；安装、激活、渲染和发布验证分别记录，不因存在 CI 文件就声称通过。

## 刻意不做

- 整页任意 HTML 原型、标注/打码流水线。
- 完整复刻 Cursor IDE 的 `cursor/canvas`；旧 import 仅兼容垫片，新 TSX 使用 `dsh/canvas`。
- 将任意 TSX/hooks/SVG 自动转换成原生 TUI。
- 依赖 Cursor 项目树。新报告写入 `~/.dsh/canvases/`；HOME 内其他位置可显式打开，但不等于图库索引或允许写回。

详细契约见 [CLIENT-ARCHITECTURE.md](CLIENT-ARCHITECTURE.md)、[SANDBOX.md](SANDBOX.md) 和 [ASSETS.md](ASSETS.md)。
