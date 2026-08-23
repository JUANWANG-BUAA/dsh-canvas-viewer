# 赛道对照：dsh-canvas-viewer

## 定位

**结构化调查/设计报告**用本插件（`.canvas.tsx` + skill + `view_canvas` + 对话气泡）；**HTML 原型评审**用 `dsh-plugin-canvas` / `dsh-html-canvas`。

## 同赛道差异

| 项目 | 渲染物 | 模型工具 | UI 形态 | 与本项目差异 |
|---|---|---|---|---|
| dsh-plugin-canvas | HTML（iframe 沙箱） | `canvas_preview` | 画布页签 | HTML 原型，非结构化报告 |
| dsh-html-canvas | HTML | 工具打开侧栏 | 可编辑侧栏 | HTML 工作流，非 `.canvas.tsx` |
| **dsh-canvas-viewer（本项目）** | `.canvas.tsx` | `view_canvas` | 对话气泡 + 浮窗 + 图库 | Cursor 报告体裁，dsh 原生，不依赖 Cursor |

## 对齐的优秀实践

1. Host 拥有数据，Client 只展示。
2. 工具 + UI 闭环（模型调用，人类可浏览/复制）。
3. 安装可复现。
4. 安全默认：只读 HOME 内 `.canvas.tsx`。
5. 不把方法写进长 system prompt，skill 按需加载。

## 本项目刻意不做

- 整页 HTML 画布 / iframe 原型
- 标注 / 打码流水线
- 完整复刻 Cursor IDE `cursor/canvas`
- 依赖 Cursor 项目树（新报告固定写 `~/.dsh/canvases/`，图库也只索引这里）
