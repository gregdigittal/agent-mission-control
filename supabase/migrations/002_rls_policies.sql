-- =============================================================================
-- Migration 002: RLS Policies for sessions and session_events
-- =============================================================================
--
-- POLICY RATIONALE
-- ----------------
-- Agent Mission Control uses a write-secret model for session ownership rather
-- than direct auth.uid() scoping. Sessions are created by the bridge daemon
-- (service-role / Edge Function context), not by individual users. A session
-- belongs to a project, and authenticated users read all sessions for their
-- project — they do not own sessions individually.
--
-- Threat model addressed:
--   • Unauthenticated reads: blocked by enabling RLS (deny-by-default).
--   • Cross-user reads: blocked by filtering on auth.uid() via the profiles
--     and projects relationship.
--   • Rogue inserts from the client: blocked — INSERT/UPDATE on sessions and
--     session_events is restricted to the service role only. The Supabase
--     anon key (used by the dashboard) cannot write to these tables.
--   • Replay / mass update: UPDATE and DELETE on sessions similarly restricted
--     to service role, preventing client-side state manipulation.
--
-- Tables covered: sessions, session_events
-- =============================================================================


-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read sessions that belong to a project they own.
-- Ownership path: auth.uid() → profiles.id → projects.owner_id → sessions.project_id
CREATE POLICY "sessions: authenticated users can select own project sessions"
  ON sessions
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- INSERT is restricted to the service role (bridge daemon / Edge Functions).
-- No policy is created for INSERT with the authenticated role; the service role
-- bypasses RLS by default in Supabase.

-- UPDATE is restricted to the service role for the same reason — session state
-- transitions (pending → running → completed) are driven by the bridge, not
-- the client.

-- DELETE is restricted to the service role. The dashboard never deletes sessions
-- directly; archival / cleanup is a bridge or Edge Function concern.


-- ---------------------------------------------------------------------------
-- session_events
-- ---------------------------------------------------------------------------

ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read events for sessions in their own projects.
-- This mirrors the sessions SELECT policy via a subquery join.
CREATE POLICY "session_events: authenticated users can select for own sessions"
  ON session_events
  FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN projects p ON p.id = s.project_id
      WHERE p.owner_id = auth.uid()
    )
  );

-- INSERT is restricted to the service role. Events are appended by the bridge
-- daemon and Edge Functions — never by the client directly.

-- No UPDATE or DELETE policies are created. Event rows are immutable once
-- written (append-only audit trail).
