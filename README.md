# dsh-canvas-viewer

DeepSeek Harness **Host + Web UI** 插件：把 Cursor 风格的 `.canvas.tsx` 调查/设计报告在 dsh Web 里浮窗打开，并提供设置页「Canvas 图库」。配套 **dsh 自洽** skill `canvas-analysis-report`（不依赖 `~/.cursor/skills-cursor/canvas`）。

定位对照见 [docs/COMPARISON.md](docs/COMPARISON.md)。

## 功能

- 工具 **`view_canvas`**：打开 HOME 内 `.canvas.tsx`
- 短 **system prompt** 段：调查/设计类需求 → 写 canvas → 调 `view_canvas`
- 浮窗：拖动、Esc 关闭、复制源码、下载
- 设置 → 插件 → **Canvas 图库**：最近/全部、搜索、复制路径 / Markdown / @引用
- Skill：路径规则 + **viewer 组件子集**（[skills/.../sdk.md](skills/canvas-analysis-report/sdk.md)）

## 安装

```sh
# GitHub（推荐钉 commit）
dsh plugin --profile web add github:JUANWANG-BUAA/dsh-canvas-viewer

# 或本地实拷（开发）
cd /path/to/dsh-canvas-viewer
pnpm test
bash scripts/sync-install.sh   # → ~/.dsh/plugins + ~/.dsh/skills
```

Skill 也会装到 `~/.dsh/skills/canvas-analysis-report`（`sync-install.sh`）。重启 `dsh web` 并硬刷新浏览器。

```sh
dsh --profile web --dump-config   # 应出现 # == dsh-canvas-viewer
```

## 使用

| 入口 | 作用 |
|---|---|
| 对话里点 `.canvas.tsx` | 浮窗预览 |
| `view_canvas` | 同上 |
| 设置 → 插件 → Canvas 图库 | 浏览 / 复制引用 |
| skill `canvas-analysis-report` | 写报告的方法与子集契约 |

## 开发

```sh
pnpm test              # 路径守卫 + sucrase 编译自检
node scripts/compile-sample.mjs [path.canvas.tsx]
bash scripts/sync-install.sh
```

交付形态遵循 [dsh.pub/develop-plugin.md](https://dsh.pub/develop-plugin.md)：路径 B bundle，UI 只经已验证 slot。

## 安全

只读 HOME 内 `.canvas.tsx`。浏览器对编译结果执行 `new Function`——只打开你信任的文件。

## 卸载

```sh
dsh plugin --profile web remove dsh-canvas-viewer
rm -rf ~/.dsh/plugins/dsh-canvas-viewer
rm -rf ~/.dsh/skills/canvas-analysis-report
```

## License

MIT
