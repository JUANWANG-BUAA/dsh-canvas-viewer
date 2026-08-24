import { Callout, Card, CardBody, CardHeader, Grid, H1, H2, Pill, Row, Stack, Stat, Table, Text, TodoListCard, computeDAGLayout, useCanvasState, useHostTheme } from "dsh/canvas";
const tabs = ["边界", "架构", "生命周期", "契约"];
const labels = { model: { title: "模型", sub: "结构化证据" }, sdk: { title: "SDK", sub: "安全子集" }, compiler: { title: "Host", sub: "编译 + 资产" }, sandbox: { title: "Sandbox", sub: "Preact + CSP" }, theme: { title: "Theme", sub: "亮 / 暗" }, user: { title: "用户", sub: "扫读 + 深入" } };
const layout = computeDAGLayout({ nodes: Object.keys(labels).map((id) => ({ id })), edges: [{ from: "model", to: "sdk" }, { from: "sdk", to: "compiler" }, { from: "compiler", to: "sandbox" }, { from: "theme", to: "sandbox" }, { from: "sandbox", to: "user" }], direction: "vertical" });
export default function VisualDataSystem() {
  const [tab, setTab] = useCanvasState("dsh-cv-visual-system", "边界");
  const theme = useHostTheme();
  return <Stack gap={20} style={{ maxWidth: 1120, margin: "0 auto", padding: 28 }}>
    <Stack gap={8}>
      <Row gap={8} align="center"><Pill active tone="info">设计方向</Pill><Text tone="tertiary" size="small">dsh-canvas-viewer 0.4.10 · 43 份存量报告</Text></Row>
      <H1>把“窗口有玻璃、内容仍是白板”的断层补上，用视觉组件替模型写长段落。</H1>
      <Text tone="secondary">方向：沙箱内绘制环境光；Glass、Metric、Chart 组件封装可复用叙事；skill 把“证据转视觉”设为默认。</Text>
    </Stack>
    <Callout tone="warning" title="最容易误读">不要用透明 iframe 去采样宿主：opaque-origin 是安全边界，且 Chromium 会把透明 iframe 合成到白底。玻璃感应在沙箱内由环境光 + 半透明表面自己生成。</Callout>
    <Grid columns={4} gap={12}><Stat value="43" label="存量报告" /><Stat value="230 行" label="平均源码行数" tone="warning" /><Stat value="11 / 43" label="使用 BarChart" tone="info" /><Stat value="0" label="Line / Pie 使用" tone="danger" /></Grid>
    <Row gap={8} wrap>{tabs.map((name) => <Pill key={name} active={tab === name} onClick={() => setTab(name)}>{name}</Pill>)}</Row>
    {tab === "边界" && <Boundary />}
    {tab === "架构" && <Architecture theme={theme} />}
    {tab === "生命周期" && <Lifecycle />}
    {tab === "契约" && <Contract />}
    <Text tone="tertiary" size="small">范围：lib/client.js SDK、lib/index.js sandbox、~/.dsh/canvases 存量；未改代码，不替代实现验收。</Text>
  </Stack>;
}
function Boundary() {
  return <Stack gap={16}>
    <Grid columns={2} gap={12}><Card><CardHeader title="做" /><CardBody><Text>CanvasAmbient + GlassSurface；MetricCard + Sparkline；Area/Heatmap/Donut；skill 视觉优先模板。</Text></CardBody></Card><Card><CardHeader title="不做" /><CardBody><Text>透明 iframe、外部图表库、装饰动画、远程 CDN、伪造指标。安全与体积优先。</Text></CardBody></Card></Grid>
    <Table headers={["层", "现在", "目标"]} rows={[["画布底", "#171b21 平底", "内部环境光 + 低噪点"], ["表面", ".cv-card 平面", "半透明 + 高光边"], ["数据", "Stat 单值", "Metric + delta + sparkline"], ["叙事", "<Text> 段落", "FindingCard：结论 / 证据 / 动作"]]} striped framed />
  </Stack>;
}
function Architecture({ theme }) {
  return <Stack gap={16}>
    <H2>分层：模型先产出结构化证据，SDK 负责像素。</H2>
    <svg width={layout.width} height={layout.height} style={{ maxWidth: "100%" }}>
      {layout.edges.map((e, i) => <path key={i} d={e.points.map((p, idx) => `${idx ? "L" : "M"}${p.x},${p.y}`).join(" ")} stroke={theme.border} fill="none" strokeWidth={1.5} />)}
      {layout.nodes.map((n) => { const l = labels[n.id] || { title: n.id, sub: "" }; return <g key={n.id} transform={`translate(${n.x},${n.y})`}><rect width={n.width} height={n.height} rx={8} fill={theme.panel} stroke={theme.border} /><text x={12} y={18} fill={theme.text} fontSize={12}>{l.title}</text><text x={12} y={34} fill={theme.textSecondary} fontSize={10}>{l.sub}</text></g>; })}
    </svg>
    <Table headers={["组件", "当前", "建议"]} rows={[["Card", "opaque panel", "GlassSurface：低 blur 只用于大面板"], ["Stat", "value / label", "MetricCard + 趋势 / 单位 / 来源"], ["Chart", "Bar only · fixed width", "responsive SVG + Area/Heatmap/Donut/Sparkline；<title> + <desc>"], ["Data", "无搜索 / 筛选", "DataGrid（sort / filter / copy）作为表格升级"]]} striped />
  </Stack>;
}
function Lifecycle() {
  return <Stack gap={16}>
    <H2>从模型到像素的可逆链路</H2>
    <Table headers={["阶段", "实测", "下一步"]} rows={[["生成", "模型写结构化数据", "预算 / 导入名校验"], ["编译", "Host 提取 SDK 并生成 module", "错误映射到源行"], ["渲染", "Preact + sandbox 成功渲染，无错误", "保留环境光与回退"], ["主题", "宿主已亮，iframe 仍保持深色（P0）", "修复 MessageChannel port 的 onmessage"], ["布局", "DAG 396 × 524px，需长滚动", "进一步横向 / 紧凑布局"]]} striped />
    <Callout tone="warning" title="本轮实测">真机确认：当前如果面没有 backdrop-filter，`.cv-card/.cv-stat` 计算值为 none；主题切换后 iframe 未收到更新。这正是“窗口有玻璃、内容仍是白板”的直接证据。</Callout>
    <Callout tone="success" title="性能边界">玻璃只分层一次：一个环境光层 + 少量大面板 blur；图表保持 SVG 静态数据，避免高频动画。</Callout>
  </Stack>;
}
function Contract() {
  return <Stack gap={16}>
    <H2>模型输出契约：不是少写字，而是让数字必须落到组件。</H2>
    <Table headers={["输出", "允许", "禁止"]} rows={[["结论", "H1 一句 + chat 2–4 句", "重复叙述"], ["发现", "FindingCard：影响 / 证据 / 动作", "无数据长段落"], ["趋势", "Area / Line + 参考线", "只写“趋势向上”"], ["分布", "Bar / Donut + 图例", "只写占比无数值"]]} striped />
    <TodoListCard title="建议顺序" todos={[{ id: "p0", content: "P0：CanvasAmbient + GlassSurface；修复 iframe 主题接收；建亮 / 暗浏览器截图基线", status: "pending" }, { id: "p1", content: "P1：MetricCard / Sparkline / FindingCard；更新 SKILL 模板与 capabilities", status: "pending" }, { id: "p2", content: "P2：DAG 紧凑化、筛选 / 导出 / 触屏 tooltip；视觉基线稳定后再做", status: "pending" }]} />
  </Stack>;
}
