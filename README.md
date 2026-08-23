# dsh-canvas-viewer

English: [README.en.md](README.en.md)

DeepSeek Harness **原生**插件：把 `.canvas.tsx` 调查/设计报告做成 dsh 里的浮窗 + 对话气泡 + 设置图库。**不再依赖 Cursor**：默认写入 `~/.dsh/canvases/`，新报告 import `"dsh/canvas"`，`cursor/canvas` 仅用于兼容旧文件。

## 核心能力

- **对话气泡**：模型调用 `view_canvas` 且**注册成功**（文件存在、预算内、HOME 内）后，该轮消息尾部才出现 Canvas 气泡——失败的调用（如占位路径）不弹；点击气泡打开渲染浮窗。
- **点击打开（克制版）**：只有点击带 `data-canvas`/`data-path` 的元素、真实的 `.canvas.tsx` 链接、或整段文本恰好等于一个 canvas 路径时才打开浮窗；普通提问/正文里顺带提及路径不会误跳，`title` 提示也不会触发。
- **浮窗查看器**：多画布 tab、未保存标记、拖动、双击最大化、Esc 关闭（含沙箱内 Esc 经私有端口转发）、复制源码、下载；渲染 dsh/canvas 子集（Stack/Grid/Table/DAG/图表…）；打开时聚焦、关闭还原焦点（`role=dialog`）。头部显示沙箱/兼容渲染状态，一键切换深/浅主题（记忆偏好，实时推送到沙箱 iframe）。
- **热更新**：画布打开期间磁盘文件一变（外部编辑/agent 重写），浮窗通过 `GET /api/canvas/watch`（SSE）自动重渲染；文件被删除时提示。
- **源码分栏 + 保存即重编译**：「源码」按钮切出编辑分栏，`⌘S` 保存（原子写，仅限 `~/.dsh/canvases/`）→ 立即重编译刷新；外部热更新不覆盖未保存的修改。
- **图表与表格交互**：Bar/Line/Pie 原生 hover tooltip（`<title>`）；`Table sortable` 表头点击排序（数值感知、`aria-sort`）。
- **iframe 沙箱渲染**：canvas 默认在 `<iframe sandbox="allow-scripts">`（opaque origin）内渲染，并由 srcdoc CSP 禁止网络、worker、form、嵌套 frame 与 object；Preact 10 + compat UMD 内置内联（~26 KB），SDK 由 Host 从运行时提取下发，iframe→宿主消息走 MessageChannel 私有端口。图片可写成 `asset://foo.png`，Host 从 `~/.dsh/canvas-assets/` 编译期受控内联，避免把 base64 写进报告源码。
- **本地资产上传**：图库的“上传图片”在浏览器端将图片缩放到最长边 1600px、压缩为 WebP 后发送给本机 Host；Host 只接受单层图片文件名，写入 `~/.dsh/canvas-assets/`，单文件上限 2MB。这里是本地工作流，不是远程 CDN 上传。
- **手机端适配**：窄屏（≤760px）浮窗全屏（无边框/无圆角/隐藏拖拽手柄），图库工具栏换行、搜索占满、按钮加大触控目标；平板宽度不受宿主导航规则干扰。
- **图表**：Bar/Line 支持 y 轴刻度、网格线、值标签、图例、`referenceLines`、`yMax/yMin/valueSuffix/beginAtZero`；Pie 带图例（值+百分比）；窄窗 Grid 自动收列。
- **能力协商**：`GET /api/canvas/capabilities` 返回组件/props/限制；不支持的 props（`tooltip`/`stacked`/`doughnut`/`encoding` 等）以 ▤ 降级徽标提示，不再静默丢弃。
- **设置图库**：设置 → Canvas 图库，浏览/搜索、复制路径 / Markdown / @引用；源码明确引用 `asset://` 时，列表按需显示首张图片的真实像素缩略图，其他报告仍使用结构签名（零执行）。迁移过的旧文件保留 provenance 数据供诊断，但不占主列表视觉空间。
- **省 token**：system prompt 只挂一小段触发；skill 目标 ≤80 行、≤16KB、约 ≤4k tokens，120 行为上限；行数只是软密度信号，不删必要证据；聊天只需短结论，细节进 canvas；`view_canvas` 回传 `lines`/`bytes`/估算 tokens，并识别 inline-data/重复行；预算策略可配置：`~/.dsh/canvas-viewer/settings.json` 的 `budget.maxLines`/`maxBytes`/`maxTokens` + `budget.enforce`（`soft` 提醒 / `hard` 拒绝），不配置时不强制上限。避免把图片内联成 base64；估算 token 是启发式信号，不是计费 tokenizer。

## 安装

```sh
# GitHub 安装：dsh plugin 会把 add 转发为 profile 内的 pnpm add。
# 请替换为可信发布 commit 的 40 位 SHA；不要依赖会漂移的默认分支。
dsh plugin --profile web add github:JUANWANG-BUAA/dsh-canvas-viewer#<40-character-commit-sha>
# 或本地开发
cd ~/code/agent_harness/dsh-canvas-viewer
pnpm test
bash scripts/sync-install.sh
```

当前版本已在 dsh `0.1.0-rc.6` 的 Web profile 验证；插件集变更后重启 `dsh web`，client 内容变更可由 HMR 更新。

> `dsh add` 不是独立的顶层命令；社区文档中的 GitHub “dsh add” 指上面的 `dsh plugin --profile web add …`，它会走 dsh 管理的 profile，避免手改 `node_modules`。

### 可选预算

```json
{
  "budget": {
    "maxLines": 120,
    "maxBytes": 24000,
    "maxTokens": 6000,
    "enforce": "soft"
  }
}
```

`soft` 只在图库、气泡和 `view_canvas` 摘要中标记；改为 `hard` 会拒绝超限的 `view_canvas`。三项都省略时保持历史兼容，不设默认硬上限。

## 使用

| 入口 | 作用 |
|---|---|
| 对话里的 Canvas 气泡 | 点击打开浮窗预览 |
| `view_canvas` | 打开指定 `.canvas.tsx`（回传 lines/bytes/估算 tokens） |
| 设置 → Canvas 图库 | 历史/全部浏览、复制引用 |
| skill `canvas-analysis-report` | 写报告的方法与子集契约 |

图片资产：将 PNG/JPEG/GIF/WebP/AVIF 放入 `~/.dsh/canvas-assets/`，或在图库使用“上传图片”（会生成 WebP），在报告中使用 `<img src="asset://name.webp" />`。每个资产上限 2MB；路径不会越过该目录，sandbox 仍不开放网络。

## 原生化约定

- 新文件路径：`~/.dsh/canvases/`
- 新文件 import：`"dsh/canvas"`
- 设置图库只索引 `~/.dsh/canvases/`；插件启动时会自动把现存 `~/.cursor/projects/*/canvases` 迁移到 dsh 目录（不覆盖已存在的 dsh 文件）
- 只读 HOME 内 `.canvas.tsx`，编译结果默认在 opaque-origin iframe 沙箱里执行（`allow-scripts` + srcdoc CSP）；宿主不提供沙箱包时不会自动执行兼容渲染，用户必须显式点击“允许兼容渲染”。

## 开发

```sh
pnpm test                 # skill 镜像校验 + 语法(2) + 自测(88) + 全量渲染回归 + 沙箱装配 e2e(57)
node scripts/self-test.mjs
node scripts/regression.mjs
node scripts/sandbox-e2e.mjs
node scripts/sandbox-harness.mjs   # 需要浏览器时：本地起 iframe 沙箱演示页（开发用）
bash scripts/sync-install.sh   # 只经 dsh plugin 管理本插件；会校验并按需定向刷新，不批准其他包的构建脚本
```

## License

MIT
