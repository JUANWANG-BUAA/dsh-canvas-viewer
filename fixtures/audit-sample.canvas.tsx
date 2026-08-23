import { Stack, Row, H1, H2, Text, Pill, Stat, Card, CardBody, Table, BarChart, Divider } from "dsh/canvas";

export default function AuditSample() {
  return (
    <Stack gap={16}>
      <Row gap={8} align="center">
        <Pill active size="sm" tone="blue">自验收</Pill>
        <Text size="small" tone="tertiary">dsh-canvas-viewer 0.4.0 · fixture</Text>
      </Row>
      <H1>dsh-canvas-viewer 0.4.0 自验收样张</H1>
      <Row gap={12}>
        <Stat value="0.4.0" label="版本一致性（fixture 断言锚点）" tone="success" />
        <Stat value="1" label="图表样例（BarChart）" tone="info" />
      </Row>
      <Divider />
      <H2>断言覆盖</H2>
      <Table
        sortable
        headers={["断言", "目的"]}
        rows={[
          ["renderedText 含 0.4.0 / 自验收", "sandbox-e2e 预演渲染文本锚点"],
          ["previewSignature hasChart", "图库结构缩略卡图表识别"],
          ["headline 提取", "缩略卡标题来自 H1"],
        ]}
      />
      <Card>
        <CardBody>
          <BarChart
            data={[
              { label: "编译", value: 4 },
              { label: "渲染", value: 4 },
              { label: "合规", value: 4 },
            ]}
          />
        </CardBody>
      </Card>
    </Stack>
  );
}
