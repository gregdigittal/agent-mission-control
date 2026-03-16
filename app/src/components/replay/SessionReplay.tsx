/**
 * SessionReplay — horizontal scrollable timeline of a session's events
 * with an overlaid cumulative cost SVG curve (right Y-axis).
 *
 * Design:
 * - X-axis: time relative to session start, labelled in minutes.
 * - Each event is a dot coloured by type.
 * - Hovering a dot shows a tooltip (type, timestamp, cost at point).
 * - A cost curve SVG path overlaid on the timeline.
 * - A "total cost" badge in the top-right corner.
 */
import { useMemo, useState } from 'react';
import type { SessionEvent, EventType } from '../../types';

// ──────────────────────────────────────────────────────────────────────────────
// Design constants
// ──────────────────────────────────────────────────────────────────────────────

const TIMELINE_HEIGHT = 120; // px — inner SVG canvas height
const DOT_RADIUS      = 5;   // px
const AXIS_LABEL_H    = 18;  // px reserved below timeline for X-axis labels
const COST_AXIS_W     = 48;  // px reserved on right for Y-axis labels
const PAD_X           = 16;  // px horizontal padding inside the SVG
const PAD_Y           = 12;  // px vertical padding
const MIN_WIDTH       = 640; // minimum scrollable canvas width in px

/** Colour map for dot types. */
const DOT_COLORS: Partial<Record<EventType, string>> = {
  tool_call:        '#3b82f6', // blue
  tool_result:      '#3b82f6', // blue
  error:            '#ef4444', // red
  approval_request: '#f59e0b', // amber
  approval_granted: '#f59e0b', // amber
  approval_rejected:'#f59e0b', // amber
  cost_milestone:   '#10b981', // green
  cost_alert:       '#10b981', // green
  message:          '#94a3b8', // muted
  stage_change:     '#8b5cf6', // violet
  agent_start:      '#22d3ee', // cyan
  agent_stop:       '#22d3ee', // cyan
};

function dotColor(type: EventType): string {
  return DOT_COLORS[type] ?? '#94a3b8';
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function formatMinutes(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatCostCents(usd: number): string {
  return `${(usd * 100).toFixed(1)}¢`;
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────────────────

export interface SessionReplayProps {
  readonly sessionId: string;
  readonly events: SessionEvent[];
  readonly costCents: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tooltip
// ──────────────────────────────────────────────────────────────────────────────

interface TooltipData {
  event: SessionEvent;
  x: number;
  y: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function SessionReplay({ events, costCents }: SessionReplayProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Sort events by timestamp ascending
  const sorted = useMemo(
    () => [...events].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()),
    [events],
  );

  // Determine time range
  const startMs = useMemo(
    () => (sorted.length > 0 ? new Date(sorted[0].ts).getTime() : 0),
    [sorted],
  );
  const endMs = useMemo(
    () => (sorted.length > 1 ? new Date(sorted[sorted.length - 1].ts).getTime() : startMs + 60000),
    [sorted, startMs],
  );
  const durationMs = endMs - startMs || 60000;

  // Canvas width scales with duration (1px per second, min MIN_WIDTH)
  const canvasWidth = useMemo(
    () => Math.max(MIN_WIDTH, Math.ceil(durationMs / 1000)),
    [durationMs],
  );

  // Drawable width (subtracting right-axis reservation + padding)
  const drawW = canvasWidth - PAD_X * 2 - COST_AXIS_W;
  const drawH = TIMELINE_HEIGHT - PAD_Y * 2;

  // Centre Y of the dot lane
  const laneY = PAD_Y + drawH / 2;

  // Map a timestamp to an X coordinate
  const tsToX = (ts: string): number => {
    const elapsed = new Date(ts).getTime() - startMs;
    return PAD_X + (elapsed / durationMs) * drawW;
  };

  // Compute cumulative cost series for the cost curve
  const costSeries = useMemo((): Array<{ x: number; cumUsd: number }> => {
    let cum = 0;
    return sorted.map((ev) => {
      cum += ev.costUsd ?? ev.cumulativeCostUsd ?? 0;
      return { x: tsToX(ev.ts), cumUsd: ev.cumulativeCostUsd ?? cum };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, startMs, durationMs, drawW]);

  const maxCostUsd = useMemo(
    () => Math.max(...costSeries.map((p) => p.cumUsd), 0),
    [costSeries],
  );

  const hasCostCurve = maxCostUsd > 0;

  // Map cumulative USD to SVG Y (inverted — higher cost = lower Y value)
  const costToY = (usd: number): number => {
    if (maxCostUsd === 0) return PAD_Y + drawH;
    return PAD_Y + drawH - (usd / maxCostUsd) * drawH;
  };

  // Build SVG path for cost curve
  const costPath = useMemo((): string => {
    if (!hasCostCurve || costSeries.length === 0) return '';
    const pts = costSeries.map((p) => `${p.x},${costToY(p.cumUsd)}`);
    return `M ${pts[0]} ` + pts.slice(1).map((p) => `L ${p}`).join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costSeries, hasCostCurve, maxCostUsd, drawH]);

  // X-axis minute tick positions
  const minuteTicks = useMemo((): number[] => {
    const intervalMs = 60000;
    const ticks: number[] = [0];
    let t = intervalMs;
    while (t < durationMs) {
      ticks.push(t);
      t += intervalMs;
    }
    return ticks;
  }, [durationMs]);

  // Total SVG height
  const svgHeight = TIMELINE_HEIGHT + AXIS_LABEL_H;

  return (
    <div
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
      data-testid="session-replay"
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px', flexShrink: 0,
        borderBottom: '1px solid var(--border-0)',
      }}>
        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Session Replay
        </span>

        {/* Total cost badge */}
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 12,
            background: 'var(--green, #10b981)22',
            border: '1px solid var(--green, #10b981)44',
            color: 'var(--green, #10b981)',
            fontSize: 'var(--font-xxs)',
            fontWeight: 700,
            fontFamily: 'var(--font-mono, monospace)',
          }}
          aria-label={`Total session cost: ${costCents} cents`}
        >
          {costCents.toFixed(1)}¢ total
        </span>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 12, padding: '4px 12px', flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {([
          ['tool_call',        'Tool Call',        '#3b82f6'],
          ['error',            'Error',             '#ef4444'],
          ['approval_request', 'Approval',          '#f59e0b'],
          ['cost_milestone',   'Cost Milestone',    '#10b981'],
        ] as const).map(([type, label, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xxs)', color: 'var(--text-2)' }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill={color} /></svg>
            {label}
          </div>
        ))}
        {hasCostCurve && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-xxs)', color: 'var(--text-2)' }}>
            <svg width={16} height={10}><path d="M0,8 L16,2" stroke="#10b981" strokeWidth={1.5} fill="none" strokeDasharray="3,2" /></svg>
            Cost curve
          </div>
        )}
      </div>

      {/* Scrollable timeline */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: 0 }}>
        {events.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--text-3)', fontSize: 'var(--font-xs)',
          }}>
            No events to display
          </div>
        ) : (
          <svg
            width={canvasWidth}
            height={svgHeight}
            aria-label={`Session timeline with ${events.length} event${events.length !== 1 ? 's' : ''}`}
            role="img"
            style={{ display: 'block' }}
            data-testid="timeline-svg"
          >
            {/* Background lane */}
            <line
              x1={PAD_X}
              y1={laneY}
              x2={PAD_X + drawW}
              y2={laneY}
              stroke="var(--border-1, #334)"
              strokeWidth={1}
            />

            {/* Minute tick marks and labels */}
            {minuteTicks.map((offsetMs) => {
              const x = PAD_X + (offsetMs / durationMs) * drawW;
              return (
                <g key={offsetMs}>
                  <line
                    x1={x} y1={laneY - 8}
                    x2={x} y2={laneY + 8}
                    stroke="var(--border-1, #334)"
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={svgHeight - 2}
                    textAnchor="middle"
                    fontSize={9}
                    fill="var(--text-3, #4a5568)"
                  >
                    {formatMinutes(offsetMs)}
                  </text>
                </g>
              );
            })}

            {/* Cost curve (overlaid) */}
            {hasCostCurve && costPath && (
              <>
                {/* Right Y-axis */}
                <line
                  x1={PAD_X + drawW + 8}
                  y1={PAD_Y}
                  x2={PAD_X + drawW + 8}
                  y2={PAD_Y + drawH}
                  stroke="var(--border-1, #334)"
                  strokeWidth={1}
                />
                {/* Y-axis labels — top (max) and bottom (0) */}
                <text
                  x={PAD_X + drawW + 12}
                  y={PAD_Y + 4}
                  fontSize={8}
                  fill="var(--green, #10b981)"
                  dominantBaseline="hanging"
                >
                  {formatCostCents(maxCostUsd)}
                </text>
                <text
                  x={PAD_X + drawW + 12}
                  y={PAD_Y + drawH}
                  fontSize={8}
                  fill="var(--text-3, #4a5568)"
                  dominantBaseline="auto"
                >
                  0¢
                </text>
                {/* Cost path */}
                <path
                  d={costPath}
                  fill="none"
                  stroke="var(--green, #10b981)"
                  strokeWidth={1.5}
                  strokeDasharray="4,3"
                  opacity={0.7}
                  data-testid="cost-curve"
                />
              </>
            )}

            {/* Event dots */}
            {sorted.map((ev, i) => {
              const x = tsToX(ev.ts);
              const color = dotColor(ev.type);
              const costPoint = costSeries[i];

              return (
                <circle
                  key={ev.id}
                  cx={x}
                  cy={laneY}
                  r={DOT_RADIUS}
                  fill={color}
                  stroke="var(--bg-1, #0e1117)"
                  strokeWidth={1.5}
                  style={{ cursor: 'pointer' }}
                  aria-label={`${ev.type} at ${formatTimestamp(ev.ts)}`}
                  role="img"
                  onMouseEnter={(e) => {
                    const rect = (e.currentTarget as SVGCircleElement).getBoundingClientRect();
                    setTooltip({ event: ev, x: rect.left, y: rect.top });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onFocus={(e) => {
                    const rect = (e.currentTarget as SVGCircleElement).getBoundingClientRect();
                    setTooltip({ event: ev, x: rect.left, y: rect.top });
                  }}
                  onBlur={() => setTooltip(null)}
                  tabIndex={0}
                  data-testid={`event-dot-${ev.id}`}
                  data-cost={costPoint?.cumUsd ?? 0}
                />
              );
            })}
          </svg>
        )}
      </div>

      {/* Tooltip (portal-style, fixed position) */}
      {tooltip && (
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            zIndex: 9000,
            background: 'var(--bg-2, #141922)',
            border: '1px solid var(--border-1, #334)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 'var(--font-xxs)',
            color: 'var(--text-0)',
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            minWidth: 140,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={8} height={8}>
              <circle cx={4} cy={4} r={3.5} fill={dotColor(tooltip.event.type)} />
            </svg>
            <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>
              {tooltip.event.type.replace(/_/g, ' ')}
            </span>
          </div>
          <div style={{ color: 'var(--text-2)' }}>
            {formatTimestamp(tooltip.event.ts)}
          </div>
          {tooltip.event.message && (
            <div style={{ color: 'var(--text-1)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tooltip.event.message}
            </div>
          )}
          {(tooltip.event.costUsd !== undefined || tooltip.event.cumulativeCostUsd !== undefined) && (
            <div style={{ color: 'var(--green, #10b981)', fontFamily: 'var(--font-mono, monospace)' }}>
              {tooltip.event.cumulativeCostUsd !== undefined
                ? `cum. ${formatCostCents(tooltip.event.cumulativeCostUsd)}`
                : `+${formatCostCents(tooltip.event.costUsd ?? 0)}`
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}
