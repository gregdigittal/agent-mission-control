-- Migration: 003_workspaces
-- Adds the workspaces table with RLS policies for team workspace support.
-- Owner: agent-app-core (M8-001)

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  owner_id   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Workspace membership ─────────────────────────────────────────────────────
-- Allows future multi-user workspace access without schema changes.

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES profiles(id)   ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can see workspaces they own or are a member of.
CREATE POLICY "workspaces_select" ON workspaces
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- INSERT: authenticated users can create workspaces (they become the owner).
CREATE POLICY "workspaces_insert" ON workspaces
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- UPDATE: only the workspace owner may update.
CREATE POLICY "workspaces_update" ON workspaces
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- DELETE: only the workspace owner may delete.
CREATE POLICY "workspaces_delete" ON workspaces
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- workspace_members: SELECT for members themselves or the workspace owner.
CREATE POLICY "workspace_members_select" ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- workspace_members: INSERT — owners/admins can add members (enforced at app layer for now).
CREATE POLICY "workspace_members_insert" ON workspace_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- workspace_members: DELETE — owners can remove members; members can remove themselves.
CREATE POLICY "workspace_members_delete" ON workspace_members
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS workspaces_owner_idx ON workspaces (owner_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members (user_id);
