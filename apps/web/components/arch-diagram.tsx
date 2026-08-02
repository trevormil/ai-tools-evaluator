import type { DeepDive } from "@aix/core";

type Architecture = NonNullable<DeepDive["architecture"]>;

const BOX_W = 172;
const BOX_H = 64;
const GAP_X = 56;
const GAP_Y = 18;

/**
 * Deterministic architecture diagram (ticket 0083): the evaluation's validated
 * component/flow graph laid out as a layered DAG and rendered as inline SVG in
 * the Test Bench language. Layout = longest-path layering (cycles clamp), boxes
 * are foreignObjects so labels wrap and inherit the theme's CSS variables.
 */
export function ArchDiagram({ architecture }: { architecture: Architecture }) {
  const { components, flows } = architecture;

  // Longest-path layering. Cycles (possible: flows only validate endpoint ids)
  // are clamped by bounding iterations at N — the layout degrades, never hangs.
  const layer = new Map<string, number>(components.map((c) => [c.id, 0]));
  for (let i = 0; i < components.length; i++) {
    let moved = false;
    for (const f of flows) {
      const want = (layer.get(f.from) ?? 0) + 1;
      if ((layer.get(f.to) ?? 0) < want && want < components.length) {
        layer.set(f.to, want);
        moved = true;
      }
    }
    if (!moved) break;
  }

  const layers = new Map<number, string[]>();
  for (const c of components) {
    const l = layer.get(c.id) ?? 0;
    layers.set(l, [...(layers.get(l) ?? []), c.id]);
  }
  const nLayers = Math.max(...layers.keys()) + 1;
  const maxRows = Math.max(...[...layers.values()].map((v) => v.length));
  const width = nLayers * BOX_W + (nLayers - 1) * GAP_X;
  const height = maxRows * BOX_H + (maxRows - 1) * GAP_Y;

  const pos = new Map<string, { x: number; y: number }>();
  for (const [l, ids] of layers) {
    const colH = ids.length * BOX_H + (ids.length - 1) * GAP_Y;
    ids.forEach((id, row) => {
      pos.set(id, {
        x: l * (BOX_W + GAP_X),
        y: (height - colH) / 2 + row * (BOX_H + GAP_Y),
      });
    });
  }

  const byId = new Map(components.map((c) => [c.id, c]));

  return (
    <div className="overflow-x-auto" data-testid="arch-diagram">
      <svg
        viewBox={`-2 -2 ${width + 4} ${height + 4}`}
        style={{ minWidth: Math.min(width, 720), maxWidth: width }}
        className="h-auto w-full"
        role="img"
        aria-label="Architecture diagram"
      >
        <defs>
          <marker
            id="arch-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0.5 L7.5,4 L0,7.5 Z" fill="var(--faint)" />
          </marker>
        </defs>

        {flows.map((f, i) => {
          const a = pos.get(f.from)!;
          const b = pos.get(f.to)!;
          const forward = b.x > a.x;
          const x1 = forward ? a.x + BOX_W : a.x;
          const y1 = a.y + BOX_H / 2;
          const x2 = forward ? b.x - 3 : b.x + BOX_W + 3;
          const y2 = b.y + BOX_H / 2;
          const mid = (x1 + x2) / 2;
          const labelY = (y1 + y2) / 2;
          return (
            <g key={i}>
              <path
                d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="var(--border-strong)"
                strokeWidth="1.5"
                markerEnd="url(#arch-arrow)"
              />
              {f.label && (
                <text
                  x={mid}
                  y={labelY - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="var(--font-mono), monospace"
                  fill="var(--faint)"
                >
                  {f.label}
                </text>
              )}
            </g>
          );
        })}

        {components.map((c) => {
          const p = pos.get(c.id)!;
          return (
            <g key={c.id}>
              <rect
                x={p.x}
                y={p.y}
                width={BOX_W}
                height={BOX_H}
                rx="8"
                fill="var(--surface)"
                stroke="var(--border-strong)"
                strokeWidth="1.5"
              />
              <foreignObject x={p.x} y={p.y} width={BOX_W} height={BOX_H}>
                <div className="flex h-full flex-col justify-center gap-0.5 px-3">
                  <p className="truncate text-[12px] font-bold leading-tight text-ink">{c.label}</p>
                  <p className="line-clamp-2 text-[10px] leading-tight text-faint">{c.role}</p>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
