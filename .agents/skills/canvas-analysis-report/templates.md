# Templates

Copy the skeleton that matches the genre. Replace names, tabs, and data. Import **only** from `"cursor/canvas"` using the [sdk.md](sdk.md) subset. Default-export the page component. Embed data inline.

Props not listed in sdk.md are **ignored or unsafe** — do not invent Cursor-only APIs beyond the documented subset. `rowTone` / `CardHeader trailing` / charts **are** supported.

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
          <Pill active>代码评审</Pill>
          <Text tone="tertiary" size="small">
            来源：packages/… · 对照 TASKS / README · 静态源码，非线上指标
          </Text>
        </Row>
        <H1>一句话结论，不要写「项目分析」</H1>
        <Text>
          两到四句：边界是否对、已经齐了什么、下一阶段的杠杆在哪。用{" "}
          <Text as="span" weight="semibold">加粗短语</Text>{" "}
          标出杠杆，不要加粗整段。
        </Text>
      </Stack>

      <Callout tone="warning" title="最容易误读的一点">
        文档声称已完成、但源码仍然会让用户觉得产品坏掉的那件事。
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat value="可辩护的数字" label="短标签" />
        <Stat value="可辩护的数字" label="短标签" />
        <Stat value="可辩护的数字" label="短标签" />
        <Stat value="可辩护的数字" label="短标签" />
      </Grid>

      <Row gap={8} wrap>
        <Pill active={tab === "overview"} onClick={() => setTab("overview")}>总览</Pill>
        <Pill active={tab === "quality"} onClick={() => setTab("quality")}>质量</Pill>
        <Pill active={tab === "latency"} onClick={() => setTab("latency")}>延迟</Pill>
        <Pill active={tab === "ux"} onClick={() => setTab("ux")}>体验</Pill>
        <Pill active={tab === "roadmap"} onClick={() => setTab("roadmap")}>建议顺序</Pill>
      </Row>

      {tab === "overview" ? <Overview /> : null}
      {tab === "quality" ? <Quality /> : null}
      {tab === "latency" ? <Latency /> : null}
      {tab === "ux" ? <Ux /> : null}
      {tab === "roadmap" ? <Roadmap /> : null}

      <Text tone="tertiary" size="small">
        依据本地源码静态评审。关键文件：a.ts、b.ts。写完后请调用 view_canvas。
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
      />
      <H2>用户实际感受到的差距</H2>
      <Table
        headers={["维度", "现在", "用户感受到的"]}
        rows={[["何时出现", "debounce 180ms", "有时连打两枪"]]}
      />
    </Stack>
  );
}

function Quality() {
  return (
    <Stack gap={20}>
      <H2>按用户能感觉到的轴拆，不要按目录拆</H2>
        <Card>
          <CardHeader title="file-name.ts" trailing={<Pill size="sm" tone="red" active>P0</Pill>} />
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
        headers={["优先级", "问题", "现状", "影响", "改法"]}
        rows={[["P0", "跳过过窄", "只跳过 markdown", "注释里乱补", "按 token 类型跳过"]]}
        rowTone={["danger"]}
        striped
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
          <CardHeader title="双触发" />
          <CardBody>
            <Text>两处独立 timer 的证据和合并办法。</Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="多候选成本" />
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
        title="建议顺序"
        todos={[
          { id: "p0", content: "可执行的第一项", status: "pending" },
          { id: "p1", content: "可执行的第二项", status: "pending" },
        ]}
      />
      <Table
        headers={["优先级", "项", "用户可感知结果", "工作量"]}
        rows={[["P0", "…", "…", "小"]]}
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
  const theme = useHostTheme();
  const layout = useMemo(
    () =>
      computeDAGLayout({
        nodes: [{ id: "editor" }, { id: "core" }, { id: "api" }],
        edges: [
          { from: "editor", to: "core" },
          { from: "core", to: "api" },
        ],
        direction: "vertical",
      }),
    [],
  );

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <Row gap={8} align="center">
          <Pill active>设计稿</Pill>
          <Text tone="tertiary" size="small">
            约束来自产品边界，不是愿望清单
          </Text>
        </Row>
        <H1>只做 Tab 补全</H1>
        <Text>一句话产品边界 + 为什么不做成 Agent。</Text>
      </Stack>

      <Callout tone="warning" title="不要走的捷径">
        点名一个看起来快、但会毁掉边界的选项。
      </Callout>

      <Grid columns={4} gap={12}>
        <Stat value="prefix+suffix" label="输入形状" />
        <Stat value="flash" label="默认模型档" />
        <Stat value="4K" label="输出上限" />
        <Stat value="非思考" label="延迟偏好" />
      </Grid>

      <Row gap={8} wrap>
        <Pill active={tab === "boundary"} onClick={() => setTab("boundary")}>产品边界</Pill>
        <Pill active={tab === "arch"} onClick={() => setTab("arch")}>架构</Pill>
        <Pill active={tab === "life"} onClick={() => setTab("life")}>生命周期</Pill>
        <Pill active={tab === "contract"} onClick={() => setTab("contract")}>工具链</Pill>
      </Row>

      {tab === "boundary" ? (
        <Grid columns={2} gap={12}>
          <Card>
            <CardHeader title="做" />
            <CardBody><Text>明确承诺的能力。</Text></CardBody>
          </Card>
          <Card>
            <CardHeader title="不做" />
            <CardBody><Text>明确拒绝的能力。</Text></CardBody>
          </Card>
        </Grid>
      ) : null}

      {tab === "arch" ? (
        <Stack gap={12}>
          <H2>核心 + 适配器</H2>
          <svg width={layout.width} height={layout.height} style={{ maxWidth: "100%" }}>
            {layout.edges.map((edge, i) => {
              const d = edge.points.map((p, idx) => `${idx ? "L" : "M"}${p.x},${p.y}`).join(" ");
              return <path key={i} d={d} stroke={theme.border} fill="none" strokeWidth={1.5} />;
            })}
            {layout.nodes.map((node) => {
              const label = LABELS[node.id] || { title: node.id, sub: "" };
              return (
                <g key={node.id} transform={`translate(${node.x},${node.y})`}>
                  <rect width={node.width} height={node.height} rx={8} fill={theme.panel} stroke={theme.border} />
                  <text x={12} y={18} fill={theme.text} fontSize={12}>{label.title}</text>
                  <text x={12} y={34} fill={theme.textSecondary} fontSize={10}>{label.sub}</text>
                </g>
              );
            })}
          </svg>
        </Stack>
      ) : null}

      {tab === "life" ? (
        <Table
          headers={["阶段", "输入", "工作", "失败"]}
          rows={[["触发", "按键", "组 window", "取消 / 超时"]]}
        />
      ) : null}

      {tab === "contract" ? (
        <Table
          headers={["字段", "含义", "备注"]}
          rows={[["prompt", "prefix+suffix", "hole 用特殊 token"]]}
        />
      ) : null}
    </Stack>
  );
}
```

After Write: call `view_canvas` with the absolute path.
