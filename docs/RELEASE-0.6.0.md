# v0.6.0 — Canvas 双端阅读与安全报告工作台

从 v0.4.15 升级，本次合并 0.5.0 工作台基础与 0.6.0 原生终端阅读。

## 主要变化

- **原生 TUI 阅读器**：独立 ./tui 入口，通过 Loader 准入与归属命令注册提供 /canvas 图库、直接文件阅读、章节/滚动/搜索/刷新/返回；使用宿主 React/ui，不引入独立 React 或 Web 服务器依赖。
- **一份数据，两端阅读**：严格版本化 .canvas.json 支持文本、callout、指标、表格、列表、条形图和明确 unsupported 块。Web 使用固定 SDK 模板，TUI 直接排版；报告不提供可执行代码、任意HTML、回调或URL属性。旧 .canvas.tsx 保持 Web 兼容，终端明确不执行。
- **更安全的 Web 工作台**：opaque-origin iframe 默认隔离；加载失败不再自动执行父页面代码，兼容模式必须逐报告修订明确批准。修订号保存、HTTP409冲突、保存期间输入保护、关闭选择与有界浏览器草稿；目录、查找、阅读位置和无脚本打印预览。
- **共享图库和文件边界**：全文源文本字面搜索、工作区过滤、分页、过期请求保护；有界元数据与扫描、预览截断、非regular文件/FIFO拒绝，JSON中的asset://保持字面文本。
- **可维护构建与验证**：十个源码片段构建单一 classic client factory；新增严格schema、仓储、原生reader、真实loader/renderer及PTY→xterm浏览器视觉检查；双语首页、文档索引、格式/安装/边界/发布流程全面更新。

## 安装

```sh
dsh plugin --profile web add github:JUANWANG-BUAA/dsh-canvas-viewer#v0.6.0
dsh plugin --profile dsh-tui add github:JUANWANG-BUAA/dsh-canvas-viewer#v0.6.0
```

只安装需要的 profile；完成后重启对应界面。TUI 包子入口不是独立 npm 包。GitHub release/tarball 不代表 npm registry 发布，也不会修改你的实际 profile。

TUI 用 /canvas；/canvas-analysis-report 是生成报告的 skill。聊天中图片附件显示依赖终端协议，不等于 Canvas 激活状态。

## 验证与限制

验证记录：[VERIFICATION-0.6.0.md](VERIFICATION-0.6.0.md)。本地完整回归通过；TUI0.16.1 实际 Loader/Command/Scene 生命周期、宿主renderer和 Edge155+真PTY+xterm12视觉检查点通过。CI 的 DSH集成固定0.2.1-rc.2，具体结果以本tag所指commit的Actions为准。

仍不提供：终端图片/任意HTML/SVG、终端编辑、旧TSX自动转换、云同步、协作编辑、历史时间线、像素级整报告PDF导出。完整TUI CLI/profile启动、late-loader补准入、live grant撤销、Windows UI/不同终端字体未作通过承诺。外部编辑器保存竞争不是OS级CAS；打印只包含当前可见内容。

## English summary

Version 0.6.0 combines the new native read-only terminal reader and data-only JSON reports with the safer Web workspace foundation. Existing TSX remains Web-compatible and is never evaluated by the terminal reader. This release adds revision-protected saves, bounded drafts/search, explicit compatibility execution, script-free print preparation, reproducible factory sources, extensive regressions and real PTY/browser visual evidence.

Install the root Git bundle into the chosen Web or TUI profile, restart, and use /canvas in the terminal. A GitHub release does not publish npm or install into user profiles. See the verification record for exact runtime authority and untested boundaries.
