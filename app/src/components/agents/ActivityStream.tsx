import { useRef, useState, useCallback, useMemo } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import type { AgentEvent, EventType } from '../../types';

// ─── Lightweight Virtualizer ──────────────────────────────────────────────────
// Renders only the rows visible in the scroll container plus a small overscan
// buffer. Prevents DOM bloat when event streams grow to thousands of entries.
// Each EventRow is fixed-height (ROW_HEIGHT px).
const ROW_HEIGHT = 24; // px — must match EventRow padding/font metrics
const OVERSCAN = 10;  // rows to render above/below visible range

function useVirtualizer(totalCount: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  const onScroll = useCallback(() => {
    setScrollTop(containerRef.current?.scrollTop ?? 0);
  }, []);

  const onResize = useCallback((entries: ResizeObserverEntry[]) => {
    setContainerHeight(entries[0]?.contentRect.height ?? 400);
  }, []);

  // Attach ResizeObserver on first render via callback ref
  const attachRef = useCallback(
    (el: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      if (el) {
        const ro = new ResizeObserver(onResize);
        ro.observe(el);
        el.addEventListener('scroll', onScroll, { passive: true });
        // cleanup stored on element to detach later (not critical for this use-case)
      }
    },
    [onScroll, onResize],
  );

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalCount - 1, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);
  const totalHeight = totalCount * ROW_HEIGHT;
  const offsetTop = startIndex * ROW_HEIGHT;

  return { attachRef, startIndex, endIndex, totalHeight, offsetTop };
}
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<EventType, string> = {
  tool_call:         'var(--cyan)',
  tool_result:       'var(--text-2)',
  message:           'var(--text-1)',
  error:             'var(--red)',
  approval_request:  'var(--amber)',
  approval_granted:  'var(--green)',
  approval_rejected: 'var(--red)',
  cost_alert:        'var(--amber)',
  cost_milestone:    'var(--amber)',
  stage_change:      'var(--violet)',
  agent_start:       'var(--green)',
  agent_stop:        'var(--text-3)',
};

interface Props {
  sessionId: string;
}

export function ActivityStream({ sessionId }: Props) {
  const rawEvents = useAgentStore((s) => s.events);
  const eventFilter = useAgentStore((s) => s.eventFilter);
  const setEventFilter = useAgentStore((s) => s.setEventFilter);
  const events = useMemo(
    () => rawEvents
      .filter((e) => e.sessionId === sessionId)
      .filter((e) => !eventFilter || e.agentId === eventFilter),
    [rawEvents, eventFilter, sessionId],
  );
  const { attachRef, startIndex, endIndex, totalHeight, offsetTop } = useVirtualizer(events.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px var(--density-pad)',
        borderBottom: '1px solid var(--border-0)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-2)', marginRight: 4 }}>Filter:</span>
        <button
          onClick={() => setEventFilter(null)}
          style={{
            padding: '1px 6px', borderRadius: 3, fontSize: 'var(--font-xxs)',
            background: !eventFilter ? 'var(--bg-4)' : 'transparent',
            color: !eventFilter ? 'var(--text-0)' : 'var(--text-3)',
            border: '1px solid var(--border-1)',
          }}
        >
          All
        </button>
        {events.length > 100 && (
          <span style={{ marginLeft: 'auto', fontSize: 'var(--font-xxs)', color: 'var(--text-3)' }}>
            {events.length.toLocaleString()} events
          </span>
        )}
      </div>

      {/* Virtualized events list */}
      <div
        ref={attachRef}
        style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
      >
        {events.length === 0 ? (
          <div style={{ color: 'var(--text-3)', fontSize: 'var(--font-xs)', textAlign: 'center', marginTop: 24 }}>
            No events yet
          </div>
        ) : (
          /* Total height spacer keeps scrollbar proportional */
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ position: 'absolute', top: offsetTop, left: 0, right: 0 }}>
              {events.slice(startIndex, endIndex + 1).map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: AgentEvent }) {
  const color = EVENT_COLORS[event.type] ?? 'var(--text-2)';
  const time = new Date(event.ts).toLocaleTimeString('en-GB', { hour12: false });

  return (
    <div style={{
      display: 'flex', gap: 8, padding: '3px 0',
      borderBottom: '1px solid var(--border-0)',
      animation: 'fadeIn 0.15s ease-out',
    }}>
      <span className="mono" style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-3)', flexShrink: 0, paddingTop: 1 }}>
        {time}
      </span>
      <span style={{ fontSize: 'var(--font-xxs)', color, flexShrink: 0, paddingTop: 1, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {event.type.replace('_', ' ')}
      </span>
      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {event.message}
      </span>
      {event.costUsd != null && (
        <span style={{ fontSize: 'var(--font-xxs)', color: 'var(--amber)', flexShrink: 0 }}>
          ${event.costUsd.toFixed(5)}
        </span>
      )}
    </div>
  );
}
