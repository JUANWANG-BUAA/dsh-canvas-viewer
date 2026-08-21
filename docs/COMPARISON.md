# 赛道对照：dsh-canvas-viewer

与社区「画布 / Canvas」类 DeepSeek Harness 插件对比，明确本项目位置与不做的事。

## 同赛道插件

| 项目 | 渲染物 | 模型工具 | UI 形态 | 强项 | 与本项目差异 |
|---|---|---|---|---|---|
| [dsh-plugin-canvas](https://github.com/GHJIVHIDD/dsh-plugin-canvas) | HTML（iframe 沙箱） | `canvas_preview` render/annotate/clear | 会话视图环「画布」页签 | 原型评审、标注、隐私打码 | 面向 **HTML 原型**，不是结构化调查报告 |
| [dsh-html-canvas](https://github.com/Jinsong-Zhou/dsh-html-canvas) | HTML | 工具打开侧栏 | 侧栏可点选编辑文本 | 生成页可编辑 | HTML 工作流，非 `.canvas.tsx` 报告体裁 |
| deepseek-harness-genui（社区目录） | 代码定义 UI | genui 执行 | 内联/独立画布 | 通用 GenUI | 执行面更广，缺少本 skill 的「调查/设计」方法 |
| **dsh-canvas-viewer（本项目）** | `.canvas.tsx` 组件子集 | `view_canvas` | 浮窗 + 设置「Canvas 图库」 | Cursor 同源报告体裁、可检索历史、skill 自洽 | **不**做 HTML iframe；**不**做标注工具 |

## 社区优秀实践（我们对齐的点）

从 dsh-plugin-canvas / html-canvas / publish 指南学到并落地的：

1. **Host 拥有数据，Client 只展示** — 列表/历史/编译在 Host；浮窗与设置页经 HTTP。
2. **工具 + UI 闭环** — 模型可调用；人类可在设置里浏览/复制引用。
3. **安装可复现** — `dsh.bundle` + 实拷到 `~/.dsh/plugins`（避免长期 `link:`）。
4. **安全默认** — 仅 HOME 内 `.canvas.tsx`；编译后在浏览器 `new Function`（只打开可信文件）。
5. **文档写清不做的事** — 避免与 HTML canvas 插件抢同一心智模型。

## 本项目刻意不做

- 会话环整页 HTML 画布 / 沙箱 iframe 原型
- `annotate` 位置标注与隐私打码流水线（交给 HTML 赛道）
- 完整复刻 Cursor IDE `cursor/canvas`（只保证 viewer 子集）
- 把方法写进永久 systemPrompt 长文（skill 按需加载；插件只挂短触发段）

## 定位一句话

> **结构化调查/设计报告**用本插件（`.canvas.tsx` + skill + `view_canvas`）；**HTML 原型评审**用 dsh-plugin-canvas / html-canvas。
