# dsh-canvas-viewer

[![CI](https://github.com/JUANWANG-BUAA/dsh-canvas-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/JUANWANG-BUAA/dsh-canvas-viewer/actions) [![Release](https://img.shields.io/github/v/release/JUANWANG-BUAA/dsh-canvas-viewer?display_name=tag)](https://github.com/JUANWANG-BUAA/dsh-canvas-viewer/releases) [![License](https://img.shields.io/badge/license-MIT-2f6fe5.svg)](LICENSE)

English: [README.en.md](README.en.md)

把调查、架构评审和设计结论变成 dsh 里真正可打开的 `.canvas.tsx` 报告：对话气泡负责“发现”，macOS 风格浮窗负责“阅读”，设置图库负责“管理”，沙箱负责“渲染”。

![dsh-canvas-viewer product preview](docs/assets/hero.svg)

## 先看结论

- 这是一个 **Host + Web UI + dsh skill** 插件，不是另一个 Canvas 编辑器。
- 报告源文件留在 `~/.dsh/canvases/`，图片留在 `~/.dsh/canvas-assets/`；默认不上传远程 CDN。
- Host 先做路径、预算和资产校验，再编译；浏览器默认在 opaque-origin iframe 中渲染，并禁止网络。
- `asset://diagram.webp` 让源码保持短小，图库只懒加载首张真实像素缩略图，不执行整份报告生成预览。
- client 仍是 dsh 要求的外部 factory；Host 的安全关键资产模块已迁移为严格 TypeScript 源码并保留可提交运行产物。
- 已验证与 DeepSeek Harness **0.1.1-rc.2**（npm `latest`/`next`）组合启动，CI 带真实 DSH profile smoke。

## 一分钟安装

把 `<40-character-commit-sha>` 换成你审阅过的完整 commit SHA。固定 commit 比默认分支更适合插件和 profile 的可复现安装。

```sh
# GitHub / 社区推荐方式
dsh plugin --profile web add github:JUANWANG-BUAA/dsh-canvas-viewer#<40-character-commit-sha>

# 查看最终组合
dsh --profile web --dump-config

# 插件集变更后重启；同一版本 client.js 内容编辑由 dsh Web HMR 接管
dsh web
```

社区里常说的 “`dsh add`” 指的就是上面的 `dsh plugin --profile web add`，不是一个绕过 profile 的独立命令。安装、激活、验证、停用和卸载边界见 [客户端架构](docs/CLIENT-ARCHITECTURE.md)。

本地开发：

```sh
git clone https://github.com/JUANWANG-BUAA/dsh-canvas-viewer.git
cd dsh-canvas-viewer
pnpm install
pnpm test
bash scripts/sync-install.sh
```

如果 web profile 里还有与本插件无关的 GitHub SSH 依赖，可只为这一次刷新指定传输层，不会改写全局 Git 配置；registry 也可显式指定：

```sh
DSH_GIT_URL_BASE=https://github.com/ \
DSH_NPM_REGISTRY=https://registry.npmjs.org \
DSH_PNPM_NO_OPTIONAL=1 \
bash scripts/sync-install.sh
```

`DSH_PNPM_NO_OPTIONAL=1` 只适合确认当前平台不需要 profile 中其它平台的可选包时使用。脚本始终通过 `dsh plugin --profile web add` 修改 profile，绝不会直接覆盖 `node_modules`。刷新前 dsh 可能重新解析 profile 中其它插件；若这些外部依赖不可达，应先修复网络/缓存后重试。

## 从 skill 到像素的完整链路

![dsh canvas workflow](docs/assets/workflow.svg)

| 阶段 | 实际动作 | 关键边界 |
| --- | --- | --- |
| Skill | `canvas-analysis-report` 写紧凑、可复现的报告 | 推荐约 80 行 / 16KB / 4k 估算 tokens |
| Host | `view_canvas` 校验 HOME、预算、编译和 `asset://` | 失败调用不会伪造聊天气泡 |
| Cordis | 注册工具、system prompt、Web 路由和可逆 effect | unload 会移除路由、watcher、SSE 和 UI |
| Client | 外部 factory 注入气泡、浮窗、图库 | 不依赖预构建 shell bundle |
| Browser | iframe sandbox + CSP + Preact compat | `connect-src 'none'`，默认无网络 |

## 你会得到什么

- **对话气泡**：只有成功的 `view_canvas` 才显示，点击后打开对应报告。
- **浮窗阅读器**：多 tab、源码/渲染分栏、原子保存、热更新、复制/下载、主题切换、Esc 关闭、手机全屏。
- **图库**：全部/最近、搜索、工作区过滤、复制路径/Markdown/@引用、`asset://` 真实像素缩略图、浏览器端 WebP 上传。
- **Canvas SDK 子集**：Stack、Grid、Table、DAG、Stats、Bar/Line/Pie、Callout、CollapsibleSection 等；不支持的 props 显示降级徽标。
- **诊断**：行数、字节、估算 tokens、inline-data/重复行提示、预算 soft/hard 策略和来源映射错误定位。

## 本地资产：为什么不直接做远程 CDN

本项目把图片当作 dsh 本机的受控数据，而不是公开静态站点：

```tsx
export default function Report() {
  return <img src="asset://architecture.webp" alt="architecture" />;
}
```

- 上传在浏览器端缩放到最长边 1600px，再压缩为 WebP；Host 限制单层文件名和 2MB 上限。
- Host 校验 PNG/JPEG/GIF/WebP/AVIF 文件签名，拒绝“扩展名像图片、内容不是图片”的伪装文件。
- `GET /api/canvas/assets/raw` 返回 `ETag`，图库重复打开时使用条件请求；响应带 `nosniff`、`same-origin` 和私有缓存策略。
- 原始资产不会给 iframe 增加网络能力；编译阶段才把受控图片内联为 data URI。
- 远程 CDN 不是默认选项：它会引入凭据、生命周期、跨域和隐私问题，也会削弱报告的离线可复现性。若未来需要团队共享，应新增显式 Host provider、权限和远程资产协议，而不是把 URL 直接塞进报告。

## Token 策略

system prompt 只保留触发规则；报告把证据放在 Canvas，聊天只给 2–4 句结论。建议值可在 `~/.dsh/canvas-viewer/settings.json` 调整：

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

`soft` 只标记，`hard` 才拒绝超限的 `view_canvas`。估算 tokens 是稳定的启发式诊断，不冒充计费 tokenizer；图片用 `asset://`，不要把 base64 塞进源码。

## Trust model

Canvas 是可执行的 TSX。默认 iframe 隔离了 DOM、网络和宿主 origin，但它不是“把不可信代码变安全”的承诺：只打开你信任的 `.canvas.tsx`。兼容渲染路径需要用户明确点击，并可能使用 `new Function`；不需要兼容性时保持默认沙箱路径。

## 工程与验证

```sh
pnpm typecheck       # 严格检查 src/host/*.mts
pnpm build:host      # 生成提交到仓库的 lib/host/*.mjs 运行产物
pnpm test             # skill 镜像、类型、Host、client contract、lifecycle、渲染、sandbox
pnpm test:browser    # Playwright：气泡 + 图库真实缩略图/上传 + iframe
pnpm audit --prod
npm pack --dry-run
```

TypeScript 迁移采用“源代码严格、运行产物稳定”的渐进策略：当前先迁移安全关键的资产边界，`lib/host/assets.mjs` 仍作为 dsh Git 安装可直接加载的产物；后续模块按同样方式迁移，避免要求用户在安装阶段执行构建脚本。

目录速览：

```text
lib/index.js                  Host 插件、view_canvas、路由与 system prompt
lib/client.js                 dsh external factory：浮窗、气泡、图库
src/host/assets.mts           TypeScript 资产策略（生成 lib/host/assets.mjs）
skills/canvas-analysis-report/  dsh-native skill 与 SDK 契约
scripts/                      类型、生命周期、浏览器、渲染和打包检查
docs/                         沙箱、客户端架构、资产与工作流说明
```

## 已知边界

- 报告级整图像素缩略图仍不默认开启；图库只显示源码首个 `asset://` 图片。
- 本地 Host 资产不是 CDN，也没有远程团队图库、压缩服务或权限同步。
- `lib/client.js` 必须保持单 factory 入口；UI 源码拆分不能改变 dsh 的加载协议。
- dsh profile 的 bundle add/remove 需要重启 Web；client 文件内容由 Host 的 stat-poll/SSE HMR 更新。

更多细节：[沙箱模型](docs/SANDBOX.md) · [客户端架构](docs/CLIENT-ARCHITECTURE.md) · [对比与取舍](docs/COMPARISON.md) · [变更记录](CHANGELOG.md)

## License

MIT
