import type { Commit } from "../types";

export interface GraphNode {
  lane: number;
  before: (string | null)[];
  after: (string | null)[];
  edges: { to: number; parent: string }[];
}

export interface GraphLayout {
  nodes: GraphNode[];
  maxLanes: number;
  width: number;
}

const LANE_WIDTH = 16;

export function buildGraph(commits: Commit[]): GraphLayout {
  const lanes: (string | null)[] = [];
  const nodes: GraphNode[] = [];

  const firstFree = () => {
    const index = lanes.findIndex((value) => value === null);
    if (index >= 0) return index;
    lanes.push(null);
    return lanes.length - 1;
  };

  for (const commit of commits) {
    let lane = lanes.indexOf(commit.oid);
    if (lane === -1) {
      lane = firstFree();
      lanes[lane] = commit.oid;
    }

    const before = lanes.slice();
    lanes[lane] = null;
    const edges: { to: number; parent: string }[] = [];

    commit.parents.forEach((parent, index) => {
      let parentLane = lanes.indexOf(parent);
      if (parentLane === -1) {
        if (index === 0 && lanes[lane] === null) {
          parentLane = lane;
          lanes[parentLane] = parent;
        } else {
          parentLane = firstFree();
          lanes[parentLane] = parent;
        }
      }
      edges.push({ to: parentLane, parent });
    });

    nodes.push({ lane, before, after: lanes.slice(), edges });
  }

  const maxLanes = Math.max(1, ...nodes.map((node) => Math.max(node.before.length, node.after.length, node.lane + 1)));
  return { nodes, maxLanes, width: maxLanes * LANE_WIDTH + 8 };
}

const COLORS = [
  "#60cdff",
  "#7bd88f",
  "#f7b267",
  "#d6a4ff",
  "#ff8a8a",
  "#76d7c4",
  "#f7d154",
  "#b4a7ff",
  "#89c2ff",
  "#f29ac0",
];

export function laneX(lane: number): number {
  return 8 + lane * LANE_WIDTH;
}

export function laneColor(lane: number): string {
  return COLORS[Math.abs(lane) % COLORS.length];
}

export { LANE_WIDTH };
