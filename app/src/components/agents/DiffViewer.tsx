/**
 * DiffViewer — renders a unified diff string with color-coded line annotations.
 *
 * Accepts a raw unified diff string (the kind produced by `git diff`) and
 * renders it with: green for additions, red for deletions, gray for context lines.
 * No external diff library required — parsing is implemented inline.
 */

import React from 'react';

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header' | 'file';
  content: string;
  lineNumber?: { old: number | null; new: number | null };
}

function parseDiff(raw: string): DiffLine[] {
  const lines = raw.split('\n');
  const result: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
      result.push({ type: 'file', content: line });
      continue;
    }
    if (line.startsWith('@@ ')) {
      // Parse @@ -a,b +c,d @@ format
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      result.push({ type: 'header', content: line });
      continue;
    }
    if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.slice(1), lineNumber: { old: null, new: newLine++ } });
    } else if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.slice(1), lineNumber: { old: oldLine++, new: null } });
    } else if (line.startsWith('\\')) {
      // "\ No newline at end of file"
      result.push({ type: 'context', content: line });
    } else if (line !== '') {
      result.push({ type: 'context', content: line.slice(1), lineNumber: { old: oldLine++, new: newLine++ } });
    }
  }

  return result;
}

const LINE_STYLES: Record<DiffLine['type'], React.CSSProperties> = {
  add: { background: 'rgba(34,197,94,0.15)', color: 'var(--green, #4ade80)' },
  remove: { background: 'rgba(239,68,68,0.15)', color: 'var(--red, #f87171)' },
  context: { background: 'transparent', color: 'var(--text-dim, #94a3b8)' },
  header: { background: 'rgba(96,165,250,0.1)', color: 'var(--blue, #60a5fa)', fontStyle: 'italic' },
  file: { background: 'rgba(148,163,184,0.08)', color: 'var(--text-muted, #64748b)', fontWeight: 600 },
};

const LINE_PREFIXES: Record<DiffLine['type'], string> = {
  add: '+',
  remove: '-',
  context: ' ',
  header: '',
  file: '',
};

interface DiffViewerProps {
  diff: string;
  maxLines?: number;
  /** If true, show old/new line number gutters */
  showLineNumbers?: boolean;
}

export function DiffViewer({ diff, maxLines = 500, showLineNumbers = true }: DiffViewerProps) {
  const lines = parseDiff(diff).slice(0, maxLines);
  const truncated = parseDiff(diff).length > maxLines;

  if (!diff.trim()) {
    return (
      <div style={{ color: 'var(--text-dim, #94a3b8)', padding: '16px', textAlign: 'center' }}>
        No diff available
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: '12px',
        lineHeight: '1.6',
        overflowX: 'auto',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} style={LINE_STYLES[line.type]}>
              {showLineNumbers && (
                <>
                  <td
                    style={{
                      width: '36px',
                      minWidth: '36px',
                      textAlign: 'right',
                      paddingRight: '8px',
                      opacity: 0.4,
                      userSelect: 'none',
                      fontSize: '11px',
                      verticalAlign: 'top',
                    }}
                  >
                    {line.lineNumber?.old ?? ''}
                  </td>
                  <td
                    style={{
                      width: '36px',
                      minWidth: '36px',
                      textAlign: 'right',
                      paddingRight: '8px',
                      opacity: 0.4,
                      userSelect: 'none',
                      fontSize: '11px',
                      verticalAlign: 'top',
                    }}
                  >
                    {line.lineNumber?.new ?? ''}
                  </td>
                </>
              )}
              <td
                style={{
                  width: '16px',
                  minWidth: '16px',
                  textAlign: 'center',
                  opacity: 0.6,
                  userSelect: 'none',
                }}
              >
                {LINE_PREFIXES[line.type]}
              </td>
              <td style={{ paddingLeft: '4px', whiteSpace: 'pre', overflowX: 'visible' }}>
                {line.content}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {truncated && (
        <div
          style={{
            padding: '8px 16px',
            color: 'var(--text-muted, #64748b)',
            fontStyle: 'italic',
            fontSize: '11px',
          }}
        >
          … diff truncated at {maxLines} lines
        </div>
      )}
    </div>
  );
}
