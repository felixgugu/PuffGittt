import type { GraphNode } from "../lib/graph";
import { laneColor, laneX } from "../lib/graph";

interface CommitGraphProps {
  node: GraphNode;
  width: number;
  height: number;
}

export function CommitGraph({ node, width, height }: CommitGraphProps) {
  const mid = height / 2;
  const nodeX = laneX(node.lane);
  const nodeColor = laneColor(node.lane);
  const before = node.before.map((value, lane) => ({ value, lane })).filter((entry) => entry.value);
  const after = node.after.map((value, lane) => ({ value, lane })).filter((entry) => entry.value);

  return (
    <svg className="commit-graph" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {before.map((entry) => (
        <line
          key={`b-${entry.lane}-${entry.value}`}
          x1={laneX(entry.lane)}
          x2={laneX(entry.lane)}
          y1={0}
          y2={mid}
          stroke={laneColor(entry.lane)}
          strokeWidth={2}
          opacity={0.7}
        />
      ))}
      {after.map((entry) => (
        <line
          key={`a-${entry.lane}-${entry.value}`}
          x1={laneX(entry.lane)}
          x2={laneX(entry.lane)}
          y1={mid}
          y2={height}
          stroke={laneColor(entry.lane)}
          strokeWidth={2}
          opacity={0.7}
        />
      ))}
      {node.edges.map((edge, index) => {
        if (edge.to === node.lane) {
          return (
            <line
              key={`e-${edge.parent}-${index}`}
              x1={nodeX}
              x2={nodeX}
              y1={mid}
              y2={height}
              stroke={laneColor(edge.to)}
              strokeWidth={2}
            />
          );
        }
        const target = laneX(edge.to);
        return (
          <path
            key={`e-${edge.parent}-${index}`}
            d={`M ${nodeX} ${mid} Q ${nodeX} ${height} ${target} ${height}`}
            fill="none"
            stroke={laneColor(edge.to)}
            strokeWidth={2}
          />
        );
      })}
      <circle cx={nodeX} cy={mid} r={4.5} fill={nodeColor} stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}

export { laneX };
