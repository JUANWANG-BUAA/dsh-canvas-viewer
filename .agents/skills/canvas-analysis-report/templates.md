# Templates (compact)

**Choose format first.** For native TUI + Web, use the JSON skeleton in [report-data.md](report-data.md): verdict/title, summary, decision sections, evidence tables and ordered actions. There are no imports, callbacks, HTML, SVG or images in that schema; represent architecture as node/edge tables.

The following framework templates are **optional trusted Web `.canvas.tsx` only**, for cases requiring tabs, SDK interaction or SVG. They remain executable, are not TUI templates and are not an automatic conversion path. Import from `"dsh/canvas"`, use only [sdk.md](sdk.md), and default-export one component. Replace all placeholders with actual evidence; do not keep demonstration claims.

## Investigation skeleton (trim to your evidence)

```tsx
import { Callout, Card, CardBody, CardHeader, Grid, H1, H2, Pill, Row, Stack, Stat, Table, Text, TodoListCard, useState } from "dsh/canvas";

type TabId = "overview" | "quality" | "latency" | "ux" | "roadmap";

export default function Report() {
  const [tab, setTab] = useState<TabId>("overview");
  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <Row gap={8} align="center">
          <Pill active>代码评审</Pill>
          <Text tone="tertiary" size="small">来源：关键文件 · 本地静态证据</Text>
        </Row>
        <H1>一句话结论</H1>
        <Text>两到四句：边界、已齐、杠杆。用加粗短词，不要整段加粗。</Text>
      </Stack>
      <Callout tone="warning" title="最容易误读的点">文档完成 ≠ 用户感知完成。</Callout>
      <Grid columns={4} gap={12}>
        <Stat value="可辩护数字" label="短标签" />
        <Stat value="可辩护数字" label="短标签" />
        <Stat value="可辩护数字" label="短标签" />
        <Stat value="可辩护数字" label="短标签" />
      </Grid>
      <Row gap={8}>
        <Pill active={tab === "overview"} onClick={() => setTab("overview")}>总览</Pill>
        <Pill active={tab === "quality"} onClick={() => setTab("quality")}>质量</Pill>
        <Pill active={tab === "latency"} onClick={() => setTab("latency")}>延迟</Pill>
        <Pill active={tab === "ux"} onClick={() => setTab("ux")}>体验</Pill>
        <Pill active={tab === "roadmap"} onClick={() => setTab("roadmap")}>建议顺序</Pill>
      </Row>
      {tab === "overview" && <Overview />}
      {tab === "quality" && <Quality />}
      {tab === "latency" && <Latency />}
      {tab === "ux" && <Ux />}
      {tab === "roadmap" && <Roadmap />}
      <Text tone="tertiary" size="small">依据本地源码静态评审。工具可用时调用 view_canvas。</Text>
    </Stack>
  );
}

function Overview() { return (
  <Stack gap={20}>
    <H2>站得住的部分</H2><Table headers={["层","职责","评价"]} rows={[["core","…","边界清晰"]]} />
    <H2>用户感受到的差距</H2><Table headers={["维度","现在","感受"]} rows={[["次数","debounce 180ms","连打两枪"]]} />
  </Stack>
); }
function Quality() { return (
  <Stack gap={20}>
    <H2>按用户可感受的轴</H2>
    <Card><CardHeader title="file.ts" trailing={<Pill size="sm" tone="red" active>P0</Pill>} /><CardBody><Text>行为与后果，一句改法。</Text></CardBody></Card>
    <Table headers={["优先级","问题","影响","改法"]} rows={[["P0","…","…","…"]]} rowTone={["danger"]} striped />
  </Stack>
); }
function Latency() { return <Stack gap={20}><H2>延迟与成本</H2><Table headers={["路径","证据","合并办法"]} rows={[["双触发","两处 timer","一处"]} /></Stack>; }
function Ux() { return <Stack gap={20}><H2>用户路径</H2><Table headers={["步骤","现在","优化"]} rows={[["首次","无密钥提示弱","首次引导"]]} /></Stack>; }
function Roadmap() { return <Stack gap={20}><H2>建议顺序</H2><TodoListCard title="顺序" todos={[{id:"p0",content:"第一项",status:"pending"}]} /><Callout tone="success" title="保持边界">明确不做的事。</Callout></Stack>; }
```

## Design skeleton

```tsx
import { Callout, Card, CardBody, CardHeader, Grid, H1, H2, Pill, Row, Stack, Stat, Table, Text, computeDAGLayout, useHostTheme, useMemo, useState } from "dsh/canvas";

const LABELS = { core: { title:"core", sub:"window/cache" }, adapter: { title:"Adapter", sub:"接口" }, api: { title:"API", sub:"端点" } };

export default function Design() {
  const [tab, setTab] = useState("boundary");
  const theme = useHostTheme();
  const layout = useMemo(() => computeDAGLayout({ nodes:[{id:"core"},{id:"adapter"},{id:"api"}], edges:[{from:"core",to:"adapter"},{from:"adapter",to:"api"}], direction:"vertical" }), []);
  return (
    <Stack gap={24}>
      <Stack gap={8}><Pill active>设计方案</Pill><H1>产品边界一句话</H1><Text>核心承诺、关键约束。</Text></Stack>
      <Row gap={8}><Pill active={tab === "boundary"} onClick={() => setTab("boundary")}>边界</Pill><Pill active={tab === "arch"} onClick={() => setTab("arch")}>架构</Pill><Pill active={tab === "life"} onClick={() => setTab("life")}>生命周期</Pill><Pill active={tab === "contract"} onClick={() => setTab("contract")}>契约</Pill></Row>
      {tab === "boundary" && <Grid columns={2} gap={12}><Card><CardHeader title="做"/><CardBody><Text>承诺能力</Text></CardBody></Card><Card><CardHeader title="不做"/><CardBody><Text>明确拒绝</Text></CardBody></Card></Grid>}
      {tab === "arch" && (
        <Stack gap={12}><H2>核心 + 适配器</H2>
          <svg width={layout.width} height={layout.height} style={{ maxWidth: "100%" }}>
            {layout.edges.map((e,i) => <path key={i} d={e.points.map((p,idx) => `${idx ? "L" : "M"}${p.x},${p.y}`).join(" ")} stroke={theme.border} fill="none" strokeWidth={1.5} />)}
            {layout.nodes.map(n => { const l = LABELS[n.id] || { title:n.id, sub:"" }; return <g key={n.id} transform={`translate(${n.x},${n.y})`}><rect width={n.width} height={n.height} rx={8} fill={theme.panel} stroke={theme.border}/><text x={12} y={18} fill={theme.text} fontSize={12}>{l.title}</text><text x={12} y={34} fill={theme.textSecondary} fontSize={10}>{l.sub}</text></g>; })}
          </svg>
        </Stack>
      )}
      {tab === "life" && <Table headers={["阶段","输入","工作","失败"]} rows={[["触发","事件","处理","取消/超时"]]} />}
      {tab === "contract" && <Table headers={["字段","含义","备注"]} rows={[["token","…","…"]]} />}
      <Text tone="tertiary" size="small">view_canvas 可用时打开；否则提供文件路径。</Text>
    </Stack>
  );
}
```

Keep only tabs with real content; delete empty ones. No fake rows.
