# Documentation / 文档索引

## 使用与创作

| 文档 | 内容 |
|---|---|
| [中文首页](../README.md) · [English](../README.en.md) | 安装、功能矩阵、快速开始 |
| [原生 TUI](TUI.md) | /canvas、键盘、数据格式、图片显示区别、测试边界 |
| [Web 工作台](WORKSPACE.md) | 修订号保存、草稿、图库查询、打印、所有权与资源上限 |
| [数据报告格式](../skills/canvas-analysis-report/report-data.md) | schemaVersion:1、七类块与校验约束 |
| [报告 skill](../skills/canvas-analysis-report/SKILL.md) | 选择 JSON / TSX 的创作流程 |
| [Web SDK](../skills/canvas-analysis-report/sdk.md) · [模板](../skills/canvas-analysis-report/templates.md) · [示例](../skills/canvas-analysis-report/examples.md) | 仅 TSX Web 报告的组件契约与范式 |

## 开发、安全与发布

| 文档 | 内容 |
|---|---|
| [架构](CLIENT-ARCHITECTURE.md) | classic factory、构建片段、Host / Web / TUI 分工 |
| [安全边界](SANDBOX.md) | JSON 数据、TSX iframe、兼容模式、打印桥和终端清理 |
| [资产](ASSETS.md) | Web TSX asset://、本地图片校验与预览 |
| [产品边界对比](COMPARISON.md) | 做什么、不做什么；与完整 Canvas 编辑器的差异 |
| [0.6.0 验证](VERIFICATION-0.6.0.md) | 当前版本实际执行的验证与尚未覆盖项 |
| [0.5.0 历史验证](VERIFICATION-0.5.0.md) | 工作台阶段性快照，不是最新测试计数 |
| [发布流程](RELEASING.md) · [0.6.0 说明](RELEASE-0.6.0.md) | 构建、测试、提交、CI、tag/release 与 Git 安装 |
| [Changelog](../CHANGELOG.md) · [开发约束](../AGENTS.md) · [第三方声明](../THIRD-PARTY-NOTICES.md) | 历史、贡献边界和许可 |

## 实际终端截图

截图来自原生阅读器 → 真 PTY → xterm.js 6 → Edge155，不是 HTML 重写 TUI；浏览器外框只是测试容器。

[宽屏 100×28](assets/tui-wide.png) · [窄屏 40×24](assets/tui-narrow.png)

安装、激活、运行测试、创建 GitHub release 和发布 npm 是不同状态。文档不会把打标签当作用户 profile 已安装，也不会将“只能看到图片路径”诊断为 Canvas 未激活。
