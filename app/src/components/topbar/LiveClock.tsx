import { useState, useEffect } from 'react';

export function LiveClock() {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="mono" style={{ fontSize: 'var(--font-xxs)', color: 'var(--text-2)' }}>
      {time}
    </span>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour12: false });
}
