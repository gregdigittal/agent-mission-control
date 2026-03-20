import { useState, useMemo } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useProjectStore } from '../../stores/projectStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { Project, Session } from '../../types';

function generateId() {
  return crypto.randomUUID();
}

interface Props {
  paneId: string;
}

export function PaneProjectSelector({ paneId }: Props) {
  const panes = useSessionStore((s) => s.panes);
  const sessions = useSessionStore((s) => s.sessions);
  const screenProfile = useSessionStore((s) => s.screenProfile);
  const setPaneProject = useSessionStore((s) => s.setPaneProject);
  const setPaneSession = useSessionStore((s) => s.setPaneSession);
  const nextSessionColor = useSessionStore((s) => s.nextSessionColor);
  const { projects, addProject } = useProjectStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');

  const pane = useMemo(() => panes.find((p) => p.id === paneId), [panes, paneId]);
  const selectedProject = useMemo(
    () => (pane ? (projects.find((p) => p.id === pane.projectId) ?? null) : null),
    [projects, pane],
  );
  const projectSessions = useMemo(
    () => (pane ? sessions.filter((s) => s.projectId === pane.projectId) : []),
    [sessions, pane],
  );

  // Desktop only
  if (screenProfile === 'mobile') return null;
  if (!pane) return null;

  function handleSelectProject(project: Project) {
    setPaneProject(paneId, project.id);
  }

  function handleBack() {
    setPaneProject(paneId, '');
  }

  function handleSelectSession(session: Session) {
    setPaneSession(paneId, session.id);
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;

    const project: Project = {
      id: generateId(),
      name: newProjectName.trim(),
      local_path: newProjectPath.trim() || newProjectName.trim().toLowerCase().replace(/\s+/g, '-'),
      backlog_path: null,
      detected_stack: [],
      last_scanned_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          id: project.id,
          name: project.name,
          local_path: project.local_path,
          backlog_path: project.backlog_path,
          detected_stack: project.detected_stack,
          last_scanned_at: project.last_scanned_at,
        })
        .select()
        .single();

      if (error) {
        console.error('[PaneProjectSelector] create project error:', error);
        return;
      }
      if (data) addProject(data as Project);
    } else {
      addProject(project);
    }

    setNewProjectName('');
    setNewProjectPath('');
    setIsCreatingProject(false);
  }

  async function handleCreateSession() {
    if (!newSessionName.trim()) return;
    if (!isSupabaseConfigured() || !supabase) return;
    if (!selectedProject) return;

    const color = nextSessionColor();
    const { data, error } = await supabase
      .from('agent_sessions')
      .insert({
        name: newSessionName.trim(),
        project_id: selectedProject.id,
        created_at: new Date().toISOString(),
        color,
      })
      .select()
      .single();

    if (error) {
      console.error('[PaneProjectSelector] create session error:', error);
      return;
    }

    if (data) {
      setPaneSession(paneId, (data as Session).id);
    }

    setNewSessionName('');
    setIsCreating(false);
  }

  const containerStyle: React.CSSProperties = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 32px',
    gap: 16,
  };

  const panelStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 320,
    background: 'var(--bg-2)',
    border: '1px solid var(--border-0)',
    borderRadius: 8,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  // Step 1 — no project selected
  if (!selectedProject) {
    return (
      <div style={containerStyle}>
        <div style={panelStyle}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Select a project
          </div>

          {projects.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-3)' }}>
                No projects yet. Create one manually or start the bridge to auto-discover projects from your VPS.
              </div>
              {isCreatingProject ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Project name…"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setIsCreatingProject(false); setNewProjectName(''); setNewProjectPath(''); }
                    }}
                    style={{ padding: '6px 10px', fontSize: 'var(--font-xs)', color: 'var(--text-1)', background: 'var(--bg-4)', border: '1px solid var(--border-1)', borderRadius: 5, outline: 'none' }}
                  />
                  <input
                    type="text"
                    placeholder="Path on VPS (optional)"
                    value={newProjectPath}
                    onChange={(e) => setNewProjectPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { void handleCreateProject(); }
                      if (e.key === 'Escape') { setIsCreatingProject(false); setNewProjectName(''); setNewProjectPath(''); }
                    }}
                    style={{ padding: '6px 10px', fontSize: 'var(--font-xs)', color: 'var(--text-1)', background: 'var(--bg-4)', border: '1px solid var(--border-1)', borderRadius: 5, outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => { void handleCreateProject(); }}
                      style={{ flex: 1, padding: '5px 0', fontSize: 'var(--font-xs)', color: 'var(--bg-0)', background: 'var(--cyan)', borderRadius: 5, cursor: 'pointer' }}
                    >
                      Create
                    </button>
                    <button
                      onClick={() => { setIsCreatingProject(false); setNewProjectName(''); setNewProjectPath(''); }}
                      style={{ flex: 1, padding: '5px 0', fontSize: 'var(--font-xs)', color: 'var(--text-2)', background: 'var(--bg-4)', border: '1px solid var(--border-0)', borderRadius: 5, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreatingProject(true)}
                  style={{ padding: '7px 12px', fontSize: 'var(--font-xs)', color: 'var(--cyan)', background: 'transparent', border: '1px dashed var(--border-1)', borderRadius: 5, cursor: 'pointer', textAlign: 'left' }}
                >
                  + Create project
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 4,
                    padding: '10px 12px',
                    background: 'var(--bg-3)',
                    border: '1px solid var(--border-0)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cyan)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-0)';
                  }}
                >
                  <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-1)', fontWeight: 500 }}>
                    {project.name}
                  </span>
                  {project.detected_stack.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {project.detected_stack.map((tech) => (
                        <span
                          key={tech}
                          style={{
                            fontSize: 'var(--font-xxs)',
                            color: 'var(--text-3)',
                            background: 'var(--bg-4)',
                            padding: '1px 6px',
                            borderRadius: 3,
                          }}
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Add project button — always visible when list is showing */}
          {projects.length > 0 && !isCreatingProject && (
            <button
              onClick={() => setIsCreatingProject(true)}
              style={{ padding: '5px 8px', fontSize: 'var(--font-xs)', color: 'var(--text-3)', background: 'transparent', border: '1px dashed var(--border-0)', borderRadius: 5, cursor: 'pointer', textAlign: 'left', marginTop: 4 }}
            >
              + New project
            </button>
          )}
          {projects.length > 0 && isCreatingProject && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <input
                autoFocus
                type="text"
                placeholder="Project name…"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setIsCreatingProject(false); setNewProjectName(''); setNewProjectPath(''); }
                }}
                style={{ padding: '6px 10px', fontSize: 'var(--font-xs)', color: 'var(--text-1)', background: 'var(--bg-4)', border: '1px solid var(--border-1)', borderRadius: 5, outline: 'none' }}
              />
              <input
                type="text"
                placeholder="Path on VPS (optional)"
                value={newProjectPath}
                onChange={(e) => setNewProjectPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { void handleCreateProject(); }
                  if (e.key === 'Escape') { setIsCreatingProject(false); setNewProjectName(''); setNewProjectPath(''); }
                }}
                style={{ padding: '6px 10px', fontSize: 'var(--font-xs)', color: 'var(--text-1)', background: 'var(--bg-4)', border: '1px solid var(--border-1)', borderRadius: 5, outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { void handleCreateProject(); }} style={{ flex: 1, padding: '5px 0', fontSize: 'var(--font-xs)', color: 'var(--bg-0)', background: 'var(--cyan)', borderRadius: 5, cursor: 'pointer' }}>Create</button>
                <button onClick={() => { setIsCreatingProject(false); setNewProjectName(''); setNewProjectPath(''); }} style={{ flex: 1, padding: '5px 0', fontSize: 'var(--font-xs)', color: 'var(--text-2)', background: 'var(--bg-4)', border: '1px solid var(--border-0)', borderRadius: 5, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 2 — project selected, no session
  return (
    <div style={containerStyle}>
      <div style={panelStyle}>
        {/* Back button */}
        <button
          onClick={handleBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 'var(--font-xs)', color: 'var(--cyan)',
            padding: 0, background: 'none',
          }}
        >
          <span aria-hidden="true">←</span>
          {selectedProject.name}
        </button>

        {/* Active sessions */}
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Active sessions
        </div>

        {projectSessions.length === 0 ? (
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-3)' }}>
            No sessions yet for this project.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {projectSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleSelectSession(session)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px',
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border-0)',
                  borderRadius: 5,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cyan)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-0)';
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: `var(--${session.color})`,
                }} />
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-1)' }}>
                  {session.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* New session */}
        {isCreating ? (
          <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
            <input
              autoFocus
              type="text"
              placeholder="Session name…"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { void handleCreateSession(); }
                if (e.key === 'Escape') { setIsCreating(false); setNewSessionName(''); }
              }}
              style={{
                padding: '6px 10px',
                fontSize: 'var(--font-xs)',
                color: 'var(--text-1)',
                background: 'var(--bg-4)',
                border: '1px solid var(--border-1)',
                borderRadius: 5,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => { void handleCreateSession(); }}
                style={{
                  flex: 1, padding: '5px 0',
                  fontSize: 'var(--font-xs)',
                  color: 'var(--bg-0)',
                  background: 'var(--cyan)',
                  borderRadius: 5,
                  cursor: 'pointer',
                }}
              >
                Create
              </button>
              <button
                onClick={() => { setIsCreating(false); setNewSessionName(''); }}
                style={{
                  flex: 1, padding: '5px 0',
                  fontSize: 'var(--font-xs)',
                  color: 'var(--text-2)',
                  background: 'var(--bg-4)',
                  border: '1px solid var(--border-0)',
                  borderRadius: 5,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            style={{
              padding: '7px 12px',
              fontSize: 'var(--font-xs)',
              color: 'var(--cyan)',
              background: 'transparent',
              border: '1px dashed var(--border-1)',
              borderRadius: 5,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            + New session
          </button>
        )}
      </div>
    </div>
  );
}
