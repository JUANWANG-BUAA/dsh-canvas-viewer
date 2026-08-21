# Changelog

## 0.1.1

- Skill `canvas-analysis-report` 改为 **dsh 自洽**：去掉对 `~/.cursor/skills-cursor/canvas` 的硬依赖；增加 [sdk.md](skills/canvas-analysis-report/sdk.md) 与 viewer 子集对齐的模板。
- Host：短 `systemPrompt` 段引导「写 canvas → `view_canvas`」；强化工具描述。
- 文档：赛道对照 [docs/COMPARISON.md](docs/COMPARISON.md)；安装改为 `~/.dsh/plugins` 实拷。
- 质量：`scripts/self-test.mjs`、`scripts/sync-install.sh`。

## 0.1.0

- 初版：Host 编译 + `/api/canvas/*`、浮窗 Client、设置图库、skill 初稿。
