/**
 * "Where it sits" — a bench schematic for each integration kind (ticket 0039).
 * One fixed You → Agent → Codebase signal path; the tool (cobalt) attaches at
 * the point that kind actually touches. Deterministic, no model call.
 */

type Spec = {
  /** Tool node position + label anchor. */
  tool: { x: number; y: number; w: number };
  /** Connector from the tool to the path (line coords). */
  link: { x1: number; y1: number; x2: number; y2: number };
  caption: string;
};

const W = 264;
const BASE_Y = 26;
const NODE = { w: 64, h: 24 };

const SPECS: Record<string, Spec> = {
  skill: {
    tool: { x: 104, y: BASE_Y + 5, w: 52 },
    link: { x1: 130, y1: BASE_Y + 5, x2: 130, y2: BASE_Y + 5 },
    caption: "A slash-command inside your agent — additive, low commitment.",
  },
  plugin: {
    tool: { x: 96, y: BASE_Y + 40, w: 60 },
    link: { x1: 126, y1: BASE_Y + 40, x2: 126, y2: BASE_Y + NODE.h },
    caption: "Extends a tool you already run.",
  },
  mcp: {
    tool: { x: 96, y: BASE_Y + 40, w: 60 },
    link: { x1: 126, y1: BASE_Y + 40, x2: 126, y2: BASE_Y + NODE.h },
    caption: "A server your agent talks to over MCP — real infra you now run.",
  },
  library: {
    tool: { x: 196, y: BASE_Y + 40, w: 60 },
    link: { x1: 226, y1: BASE_Y + 40, x2: 226, y2: BASE_Y + NODE.h },
    caption: "Imported into your own code.",
  },
  "standalone-app": {
    tool: { x: 96, y: BASE_Y + 40, w: 60 },
    link: { x1: 126, y1: BASE_Y + 40, x2: 126, y2: BASE_Y + NODE.h },
    caption: "A separate binary/app the agent shells out to.",
  },
  "workflow-shift": {
    tool: { x: 4, y: BASE_Y + 40, w: 252 },
    link: { x1: 130, y1: BASE_Y + 40, x2: 130, y2: BASE_Y + NODE.h },
    caption: "Changes how the whole loop works — the biggest commitment.",
  },
  knowledge: {
    tool: { x: 4, y: BASE_Y + 40, w: 60 },
    link: { x1: 34, y1: BASE_Y + 40, x2: 34, y2: BASE_Y + NODE.h },
    caption: "An idea you carry — nothing to install.",
  },
};

function Node({ x, label }: { x: number; label: string }) {
  return (
    <g>
      <rect
        x={x}
        y={BASE_Y}
        width={NODE.w}
        height={NODE.h}
        rx="5"
        fill="var(--surface-2)"
        stroke="var(--border-strong)"
      />
      <text
        x={x + NODE.w / 2}
        y={BASE_Y + 16}
        textAnchor="middle"
        fontSize="10"
        fontFamily="var(--font-mono)"
        fill="var(--muted)"
      >
        {label}
      </text>
    </g>
  );
}

export function IntegrationDiagram({ integration, title }: { integration: string; title: string }) {
  const spec = SPECS[integration] ?? SPECS["standalone-app"]!;
  const toolLabel = title.length > 12 ? `${title.slice(0, 11)}…` : title;
  const inline = integration === "skill";
  return (
    <figure className="flex flex-col gap-1.5">
      <svg
        viewBox={`0 0 ${W} 92`}
        className="w-full"
        role="img"
        aria-label={`Where ${title} sits: ${spec.caption}`}
      >
        {/* Signal path: You → Agent → Codebase */}
        <Node x={4} label="you" />
        <Node x={100} label="agent" />
        <Node x={196} label="codebase" />
        <line x1={68} y1={BASE_Y + 12} x2={100} y2={BASE_Y + 12} stroke="var(--border-strong)" />
        <line x1={164} y1={BASE_Y + 12} x2={196} y2={BASE_Y + 12} stroke="var(--border-strong)" />

        {!inline && (
          <line
            x1={spec.link.x1}
            y1={spec.link.y1}
            x2={spec.link.x2}
            y2={spec.link.y2}
            stroke="var(--brand)"
            strokeDasharray="3 2"
          />
        )}
        <rect
          x={spec.tool.x}
          y={inline ? BASE_Y + 4 : spec.tool.y}
          width={spec.tool.w}
          height={inline ? 16 : 20}
          rx="4"
          fill="var(--brand-soft)"
          stroke="var(--brand)"
        />
        <text
          x={spec.tool.x + spec.tool.w / 2}
          y={(inline ? BASE_Y + 4 : spec.tool.y) + (inline ? 11 : 13)}
          textAnchor="middle"
          fontSize="9"
          fontFamily="var(--font-mono)"
          fontWeight="600"
          fill="var(--brand)"
        >
          {toolLabel}
        </text>
      </svg>
      <figcaption className="text-xs text-muted">{spec.caption}</figcaption>
    </figure>
  );
}
