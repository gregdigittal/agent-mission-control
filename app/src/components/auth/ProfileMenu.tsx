import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { AdminPanel } from '../admin/AdminPanel';

export function ProfileMenu() {
  const { user, signOut } = useAuthStore();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const initials = user.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 26, height: 26, borderRadius: '50%',
          background: 'var(--bg-4)', border: '1px solid var(--border-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--font-xxs)', color: 'var(--cyan)', fontWeight: 600,
        }}
        title={user.email}
      >
        {initials}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: 'var(--bg-3)', border: '1px solid var(--border-2)',
          borderRadius: 6, minWidth: 260, zIndex: 200,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {/* User info */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-1)' }}>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>Signed in as</div>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-0)', marginTop: 2 }}>
              {user.email}
            </div>
          </div>

          {/* Admin section — only visible to workspace owners via AdminPanel's own guard */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-1)' }}>
            <AdminPanel />
          </div>

          {/* Sign out */}
          <button
            onClick={() => { setOpen(false); signOut(); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '8px 12px', fontSize: 'var(--font-sm)', color: 'var(--red)',
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
