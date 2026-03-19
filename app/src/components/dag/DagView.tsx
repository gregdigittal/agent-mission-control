/**
 * DagView — SVG task dependency graph component.
 *
 * Layout algorithm:
 * 1. Build an adjacency list from task.dependsOn relationships.
 * 2. Topological sort (Kahn's algorithm) — handles cycles gracefully by
 *    detecting unprocessed nodes and placing them in a fallback rank.
 * 3. Assign each node a rank (depth from roots) and a horizontal position
 *    within that rank.
 * 4. Render rounded-rect nodes and bezier-curve edges with arrowheads.
 */
import { useMemo, useState, useCallback } from 'react';
import type { KanbanTask, KanbanStatus } from '../../types';

// ──────────────────────────────────────────────────────────────────────────────
// Design tokens — kept in sync with kanban column colours
// ──────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<KanbanStatus, string> = {
  backlog:     '#4a5568',  // muted grey
  todo:        '#3b82f6',  // blue
  in_progress: '#8b5cf6',  // violet
  review:      '#f59e0b',  // amber
  done:        '#10b981',  // green
  blocked:     '#ef4444',  // rose/red
};

// ──────────────────────────────────────────────────────────────────────────────
// Layout constants
// ──────────────────────────────────────────────────────────────────────────────

const NODE_WIDTH  = 160;
const NODE_HEIGHT = 52;
const RANK_GAP    = 100; // vertical distance between ranks
const NODE_GAP    = 24;  // horizontal gap between nodes in the same rank

// ──────────────────────────────────────────────────────────────────────────────
// Layout types
// ──────────────────────────────────────────────────────────────────────────────

interface LayoutNode {
  task: KanbanTask;
  x: number;
  y: number;
  rank: number;
  indexInRank: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Topological layout
// ──────────────────────────────────────────────────────────────────────────────

function computeLayout(tasks: KanbanTask[]): LayoutNode[] {
  if (tasks.length === 0) return [];

  const idSet = new Set(tasks.map((t) => t.id));

  // Build in-degree map and adjacency list (dependency → dependent edges)
  // dependsOn: the task cannot start until those listed are done
  // Edge direction for rendering: dependency → dependent (left/top to right/bottom)
  const dependsOn: Map<string, string[]> = new Map();
  const inDegree:  Map<string, number>   = new Map();

  for (const task of tasks) {
    const deps = (task as KanbanTask & { dependsOn?: string[] }).dependsOn ?? [];
    // Filter out references to tasks not in the current set
    const validDeps = deps.filter((d) => idSet.has(d));
    dependsOn.set(task.id, validDeps);
    inDegree.set(task.id, (inDegree.get(task.id) ?? 0));
    inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + validDeps.length);
  }

  // Build reverse adjacency: dep → [tasks that depend on dep]
  const children: Map<string, string[]> = new Map(tasks.map((t) => [t.id, []]));
  for (const task of tasks) {
    const deps = dependsOn.get(task.id) ?? [];
    for (const dep of deps) {
      children.get(dep)?.push(task.id);
    }
  }

  // Kahn's algorithm — BFS topological sort with rank tracking
  const rank: Map<string, number> = new Map();
  const queue: string[] = [];

  for (const task of tasks) {
    if ((inDegree.get(task.id) ?? 0) === 0) {
      queue.push(task.id);
      rank.set(task.id, 0);
    }
  }

  const processed = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    processed.add(id);
    const currentRank = rank.get(id) ?? 0;
    for (const child of (children.get(id) ?? [])) {
      const newRank = currentRank + 1;
      if ((rank.get(child) ?? -1) < newRank) {
        rank.set(child, newRank);
      }
      const newInDegree = (inDegree.get(child) ?? 0) - 1;
      inDegree.set(child, newInDegree);
      if (newInDegree === 0) {
        queue.push(child);
      }
    }
  }

  // Handle cycles — any unprocessed node gets a fallback rank
  let maxRank = 0;
  for (const v of rank.values()) {
    if (v > maxRank) maxRank = v;
  }
  for (const task of tasks) {
    if (!processed.has(task.id)) {
      rank.set(task.id, maxRank + 1);
    }
  }

  // Group tasks by rank
  const byRank: Map<number, KanbanTask[]> = new Map();
  for (const task of tasks) {
    const r = rank.get(task.id) ?? 0;
    const list = byRank.get(r) ?? [];
    list.push(task);
    byRank.set(r, list);
  }

  // Compute x/y positions
  const nodes: LayoutNode[] = [];
  const sortedRanks = Array.from(byRank.keys()).sort((a, b) => a - b);

  // Find max rank width to centre ranks
  let maxRowWidth = 0;
  for (const r of sortedRanks) {
    const count = byRank.get(r)!.length;
    const rowWidth = count * NODE_WIDTH + (count - 1) * NODE_GAP;
    if (rowWidth > maxRowWidth) maxRowWidth = rowWidth;
  }

  for (const r of sortedRanks) {
    const rankTasks = byRank.get(r)!;
    const count = rankTasks.length;
    const rowWidth = count * NODE_WIDTH + (count - 1) * NODE_GAP;
    const startX = (maxRowWidth - rowWidth) / 2;

    rankTasks.forEach((task, idx) => {
      nodes.push({
        task,
        rank: r,
        indexInRank: idx,
        x: startX + idx * (NODE_WIDTH + NODE_GAP),
        y: r * (NODE_HEIGHT + RANK_GAP),
      });
    });
  }

  return nodes;
}

// ──────────────────────────────────────────────────────────────────────────────
// SVG helpers
// ──────────────────────────────────────────────────────────────────────────────

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  tasks: KanbanTask[];
  onTaskSelect?: (id: string) => void;
  width?: number;
  height?: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function DagView({ tasks, onTaskSelect, width, height }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const nodes = useMemo(() => computeLayout(tasks), [tasks]);

  // Build a lookup: taskId → LayoutNode
  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.task.id, n])),
    [nodes],
  );

  // Compute total canvas size
  const canvasWidth = useMemo(() => {
    if (nodes.length === 0) return width ?? 400;
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_WIDTH));
    return Math.max(width ?? 0, maxX + 32);
  }, [nodes, width]);

  const canvasHeight = useMemo(() => {
    if (nodes.length === 0) return height ?? 200;
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_HEIGHT));
    return Math.max(height ?? 0, maxY + 32);
  }, [nodes, height]);

  const handleNodeClick = useCallback(
    (id: string) => onTaskSelect?.(id),
    [onTaskSelect],
  );

  if (tasks.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: height ?? 200, color: 'var(--text-3)', fontSize: 'var(--font-xs)',
      }}>
        No tasks to display
      </div>
    );
  }

  // Build edges: for each task with dependsOn, draw from dependency → task
  const edges: Array<{ fromId: string; toId: string }> = [];
  for (const task of tasks) {
    const deps = (task as KanbanTask & { dependsOn?: string[] }).dependsOn ?? [];
    for (const dep of deps) {
      if (nodeMap.has(dep)) {
        edges.push({ fromId: dep, toId: task.id });
      }
    }
  }

  return (
    <div style={{ overflow: 'auto', width: '100%', height: height ? height : undefined }}>
      <svg
        width={canvasWidth + 32}
        height={canvasHeight + 32}
        aria-label="Task dependency graph"
        role="img"
        style={{ display: 'block' }}
      >
        <defs>
          {/* Arrowhead marker */}
          <marker
            id="dag-arrow"
            markerWidth={8}
            markerHeight={8}
            refX={7}
            refY={3}
            orient="auto"
          >
            <path d="M 0 0 L 0 6 L 8 3 z" fill="var(--border-1, #334)" />
          </marker>
          <marker
            id="dag-arrow-hover"
            markerWidth={8}
            markerHeight={8}
            refX={7}
            refY={3}
            orient="auto"
          >
            <path d="M 0 0 L 0 6 L 8 3 z" fill="var(--cyan, #22d3ee)" />
          </marker>
        </defs>

        {/* Padding offset group */}
        <g transform="translate(16,16)">
          {/* Edges — rendered below nodes */}
          {edges.map(({ fromId, toId }) => {
            const from = nodeMap.get(fromId);
            const to   = nodeMap.get(toId);
            if (!from || !to) return null;

            const x1 = from.x + NODE_WIDTH / 2;
            const y1 = from.y + NODE_HEIGHT;
            const x2 = to.x + NODE_WIDTH / 2;
            const y2 = to.y;

            const isHighlighted = hoveredId === fromId || hoveredId === toId;

            return (
              <path
                key={`${fromId}→${toId}`}
                d={bezierPath(x1, y1, x2, y2)}
                fill="none"
                stroke={isHighlighted ? 'var(--cyan, #22d3ee)' : 'var(--border-1, #334)'}
                strokeWidth={isHighlighted ? 2 : 1.5}
                markerEnd={isHighlighted ? 'url(#dag-arrow-hover)' : 'url(#dag-arrow)'}
                style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(({ task, x, y }) => {
            const color = STATUS_COLORS[task.status] ?? '#4a5568';
            const isHovered = hoveredId === task.id;

            return (
              <g
                key={task.id}
                transform={`translate(${x},${y})`}
                role="button"
                aria-label={`Task: ${task.title}, status: ${task.status}`}
                tabIndex={0}
                style={{ cursor: onTaskSelect ? 'pointer' : 'default' }}
                onClick={() => handleNodeClick(task.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNodeClick(task.id);
                  }
                }}
                onMouseEnter={() => setHoveredId(task.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(task.id)}
                onBlur={() => setHoveredId(null)}
              >
                {/* Rounded rect */}
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={6}
                  ry={6}
                  fill="var(--bg-2, #141922)"
                  stroke={isHovered ? 'var(--cyan, #22d3ee)' : color}
                  strokeWidth={isHovered ? 2 : 1.5}
                  style={{
                    filter: isHovered ? `drop-shadow(0 0 6px ${color}44)` : 'none',
                    transition: 'stroke 0.15s, stroke-width 0.15s, filter 0.15s',
                  }}
                />

                {/* Status colour stripe on left */}
                <rect
                  x={0}
                  y={0}
                  width={4}
                  height={NODE_HEIGHT}
                  rx={3}
                  ry={3}
                  fill={color}
                />

                {/* Task title */}
                <text
                  x={12}
                  y={20}
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--text-0, #e2e8f0)"
                  style={{ pointerEvents: 'none' }}
                >
                  <tspan>
                    {task.title.length > 18 ? task.title.slice(0, 17) + '…' : task.title}
                  </tspan>
                </text>

                {/* Status label */}
                <text
                  x={12}
                  y={36}
                  fontSize={9}
                  fill={color}
                  style={{ pointerEvents: 'none', textTransform: 'uppercase' }}
                >
                  {task.status.replace('_', ' ')}
                </text>

                {/* Priority dot */}
                {task.priority === 'critical' && (
                  <circle cx={NODE_WIDTH - 10} cy={10} r={4} fill="var(--rose, #ef4444)" />
                )}
                {task.priority === 'high' && (
                  <circle cx={NODE_WIDTH - 10} cy={10} r={4} fill="var(--amber, #f59e0b)" />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
