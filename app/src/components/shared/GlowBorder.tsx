import type { CSSProperties, ReactNode } from 'react';

interface Props {
  color?: string;
  active?: boolean;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function GlowBorder({ color = 'var(--cyan)', active = false, children, style, className }: Props) {
  return (
    <div
      className={className}
      style={{
        border: `1px solid ${active ? color : 'var(--border-1)'}`,
        boxShadow: active ? `0 0 8px ${color}33` : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
