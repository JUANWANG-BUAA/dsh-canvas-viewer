# Templates

Copy the skeleton that matches the genre. Replace names, tabs, and data. Import only from `cursor/canvas`. Default-export the page component. Embed data inline.

Read `~/.cursor/skills-cursor/canvas/sdk/index.d.ts` if any prop is unclear.

## Investigation skeleton

```tsx
import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Code,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  TodoListCard,
  useState,
} from "cursor/canvas";

type TabId = "overview" | "quality" | "latency" | "ux" | "roadmap";

export default function InvestigationReport() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <Row gap={8} align="center">
          <Pill active size="sm">
            代码评审
          </Pill>
          <Text tone="tertiary" size="small">
            来源：packages/… · 对照 TASKS / README · 静态源码，非线上指标
          </Text>
        </Row>
        <H1>一句话结论，不要写「项目分析」</H1>
        <Text>
          两到四句：边界是否对、已经齐了什么、下一阶段的杠杆在哪。用{" "}
          <Text as="span" weight="semibold">
            加粗短语
          </Text>{" "}
          标出杠杆，不要加粗整段。
        </Text>
      </Stack>

      <Callout tone="warning" title="最容易误读的一点">
        文档声称已完成、但源码仍然会让用户觉得产品坏掉的那件事。
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat value="可辩护的数字" label="短标签" tone="warning" />
        <Stat value="可辩护的数字" label="短标签" tone="danger" />
        <Stat value="可辩护的数字" label="短标签" />
        <Stat value="可辩护的数字" label="短标签" />
      </Grid>

      <Row gap={8} wrap>
        <Pill active={tab === "overview"} onClick={() => setTab("overview")}>
          总览
        </Pill>
        <Pill active={tab === "quality"} onClick={() => setTab("quality")}>
          质量
        </Pill>
        <Pill active={tab === "latency"} onClick={() => setTab("latency")}>
          延迟
        </Pill>
        <Pill active={tab === "ux"} onClick={() => setTab("ux")}>
          体验
        </Pill>
        <Pill active={tab === "roadmap"} onClick={() => setTab("roadmap")}>
          建议顺序
        </Pill>
      </Row>

      {tab === "overview" ? <Overview /> : null}
      {tab === "quality" ? <Quality /> : null}
      {tab === "latency" ? <Latency /> : null}
      {tab === "ux" ? <Ux /> : null}
      {tab === "roadmap" ? <Roadmap /> : null}

      <Text tone="tertiary" size="small">
        依据本地源码静态评审。关键文件：a.ts、b.ts。
      </Text>
    </Stack>
  );
}

function Overview() {
  return (
    <Stack gap={20}>
      <H2>现在站得住的部分</H2>
      <Text>先写保留什么，再写差距。避免整页否定开头。</Text>
      <Table
        headers={["层", "职责", "评价"]}
        rows={[["core", "…", "可测，边界清晰"]]}
        rowTone={["success"]}
      />
      <H2>用户实际感受到的差距</H2>
      <Table
        headers={["维度", "现在", "用户感受到的"]}
        rows={[["何时出现", "debounce 180ms", "有时连打两枪"]]}
        striped
      />
    </Stack>
  );
}

function Quality() {
  return (
    <Stack gap={20}>
      <H2>按用户能感觉到的轴拆，不要按目录拆</H2>
      <Card>
        <CardHeader trailing={<Pill size="sm">P0</Pill>}>file-name.ts</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Text>
              行为：<Code>fn</Code> 做了 X。后果：用户看到 Y。
            </Text>
            <Text tone="secondary" size="small">
              建议：具体改法，一句话。
            </Text>
          </Stack>
        </CardBody>
      </Card>
      <Table
        headers={["问题", "现状", "影响", "改法"]}
        rows={[["跳过过窄", "只跳过 markdown", "注释里乱补", "按 token 类型跳过"]]}
        rowTone={["danger"]}
        striped
        stickyHeader
      />
    </Stack>
  );
}

function Latency() {
  return (
    <Stack gap={20}>
      <H2>延迟与成本</H2>
      <Text>只写你读到的调度 / 缓存 / 重复请求事实。</Text>
      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader>双触发</CardHeader>
          <CardBody>
            <Text>两处独立 timer 的证据和合并办法。</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>多候选成本</CardHeader>
          <CardBody>
            <Text>N 次完整请求，而不是 API n。</Text>
          </CardBody>
        </Card>
      </Grid>
    </Stack>
  );
}

function Ux() {
  return (
    <Stack gap={20}>
      <H2>按用户路径拆，不要按 UI 文件拆</H2>
      <H3>第一次打开</H3>
      <Table
        headers={["步骤", "现在", "优化"]}
        rows={[["无密钥", "状态栏变黄", "首次 InformationMessage + 试连"]]}
        striped
      />
    </Stack>
  );
}

function Roadmap() {
  return (
    <Stack gap={20}>
      <H2>建议落地顺序</H2>
      <Text>先修「看起来像坏了」的，再提命中率，最后收表面。</Text>
      <TodoListCard
        defaultExpanded
        todos={[
          { id: "p0", content: "可执行的第一项", status: "pending" },
          { id: "p1", content: "可执行的第二项", status: "pending" },
        ]}
      />
      <Table
        headers={["优先级", "项", "用户可感知结果", "工作量"]}
        rows={[["P0", "…", "…", "小"]]}
        rowTone={["danger"]}
        striped
      />
      <Callout tone="success" title="保持产品边界">
        明确不要做的事，避免下一轮把范围撑开。
      </Callout>
    </Stack>
  );
}
```

If a tab would be empty, delete it. Do not ship “TODO” bodies.

## Design / architecture skeleton

```tsx
import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Code,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  computeDAGLayout,
  useHostTheme,
  useMemo,
  useState,
} from "cursor/canvas";

type TabId = "boundary" | "arch" | "life" | "contract";

const LABELS: Record<string, { title: string; sub: string }> = {
  editor: { title: "Editor adapter", sub: "InlineCompletion" },
  core: { title: "core", sub: "window / cache" },
  api: { title: "Provider API", sub: "POST /completions" },
};

export default function DesignBrief() {
  const [tab, setTab] = useState<TabId>("boundary");

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <Row gap={8} align="center">
          <Pill active size="sm">
            设计稿
          </Pill>
          <Text tone="tertiary" size="small">
            来源：官方文档 · 编辑器 API · 本仓库约束
          </Text>
        </Row>
        <H1>产品的一句话定义</H1>
        <Text>它做什么、输入是什么、明确不做什么。</Text>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat value="prefix + suffix" label="唯一输入形态" />
        <Stat value="flash" label="默认模型（延迟优先）" tone="info" />
        <Stat value="4K" label="官方输出上限" />
        <Stat value="非思考" label="FIM 唯一允许的模式" tone="warning" />
      </Grid>

      <Row gap={8} wrap>
        <Pill active={tab === "boundary"} onClick={() => setTab("boundary")}>
          产品边界
        </Pill>
        <Pill active={tab === "arch"} onClick={() => setTab("arch")}>
          架构
        </Pill>
        <Pill active={tab === "life"} onClick={() => setTab("life")}>
          生命周期
        </Pill>
        <Pill active={tab === "contract"} onClick={() => setTab("contract")}>
          契约
        </Pill>
      </Row>

      {tab === "boundary" ? <Boundary /> : null}
      {tab === "arch" ? <Architecture /> : null}
      {tab === "life" ? <Lifecycle /> : null}
      {tab === "contract" ? <Contract /> : null}
    </Stack>
  );
}

function Boundary() {
  return (
    <Stack gap={20}>
      <H2>做 / 不做</H2>
      <Grid columns={2} gap={16}>
        <Card>
          <CardHeader trailing={<Pill active size="sm">做</Pill>}>产品内核</CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text>当前文件 prefix / suffix</Text>
              <Text>防抖、取消、后处理</Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill size="sm">不做</Pill>}>刻意砍掉</CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text>Chat / Agent / MCP</Text>
              <Text>全仓向量检索</Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>
    </Stack>
  );
}

function Architecture() {
  const theme = useHostTheme();
  const layout = useMemo(
    () =>
      computeDAGLayout({
        nodes: [{ id: "editor" }, { id: "core" }, { id: "api" }],
        edges: [
          { from: "editor", to: "core" },
          { from: "core", to: "api" },
        ],
        direction: "horizontal",
        nodeWidth: 168,
        nodeHeight: 52,
        rankGap: 72,
        nodeGap: 36,
        padding: 8,
      }),
    [],
  );

  return (
    <Stack gap={20}>
      <H2>一个核心，少数适配器</H2>
      <Text>逻辑只写一次。适配器不承载策略。</Text>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width="100%"
        height={layout.height}
        role="img"
        aria-label="architecture"
      >
        {layout.edges.map((edge) => (
          <line
            key={`${edge.from}-${edge.to}`}
            x1={edge.sourceX}
            y1={edge.sourceY}
            x2={edge.targetX}
            y2={edge.targetY}
            stroke={theme.stroke.primary}
            strokeWidth={1.5}
          />
        ))}
        {layout.nodes.map((node) => {
          const meta = LABELS[node.id]!;
          const isCore = node.id === "core";
          return (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={168}
                height={52}
                fill={isCore ? theme.fill.secondary : theme.bg.elevated}
                stroke={isCore ? theme.accent.primary : theme.stroke.primary}
              />
              <text
                x={node.x + 84}
                y={node.y + 22}
                textAnchor="middle"
                fill={theme.text.primary}
                fontSize="12"
                fontFamily="system-ui"
              >
                {meta.title}
              </text>
              <text
                x={node.x + 84}
                y={node.y + 40}
                textAnchor="middle"
                fill={theme.text.tertiary}
                fontSize="10"
                fontFamily="system-ui"
              >
                {meta.sub}
              </text>
            </g>
          );
        })}
      </svg>
    </Stack>
  );
}

function Lifecycle() {
  return (
    <Stack gap={20}>
      <H2>一次请求</H2>
      <Table
        headers={["步", "发生什么", "失败时"]}
        rows={[["1", "debounce + abort 上一次", "用户继续输入则丢弃"]]}
        striped
      />
    </Stack>
  );
}

function Contract() {
  return (
    <Stack gap={20}>
      <H2>外部契约</H2>
      <Table
        headers={["字段", "值", "本侧策略"]}
        rows={[["endpoint", "POST /completions", "不要走 chat/completions"]]}
        striped
      />
      <Callout tone="warning" title="不要用错底座">
        说明一个看起来顺手、但会破坏产品边界的依赖。
      </Callout>
    </Stack>
  );
}
```

## ReportDocument (dsh Web / dual-host)

This is the object dsh must publish so a Conversation Node can render. Cursor may compile the same data into `.canvas.tsx`; dsh Web never runs that file.

```ts
type ReportKind = "investigation" | "design";
type Tone = "neutral" | "info" | "success" | "warning" | "danger";

type ReportDocument = {
  kind: ReportKind;
  title: string;          // H1, a verdict sentence
  sourceLine: string;
  verdict: string;        // 2–4 sentences
  tension?: { title: string; body: string; tone?: Tone };
  stats: Array<{ value: string; label: string; tone?: Tone }>;
  tabs: Array<{
    id: string;
    label: string;
    blocks: ReportBlock[];
  }>;
  caption?: string;
};

type ReportBlock =
  | { type: "prose"; text: string }
  | { type: "callout"; title?: string; body: string; tone?: Tone }
  | { type: "table"; headers: string[]; rows: string[][]; rowTone?: Tone[] }
  | { type: "card"; title: string; badge?: string; body: string[] }
  | { type: "todos"; items: Array<{ id: string; content: string; status: "pending" | "in_progress" | "completed" }> };
```

Publish one document per report. Omit empty tabs and empty blocks.

## SVG note

`computeDAGLayout` only returns numbers. You draw `rect` / `line` / `text`. All colors from `useHostTheme()`. No hex, no gradients, no drop shadow.

For a simple strip (prefix / hole / suffix), a small inline SVG is better than a DAG.
