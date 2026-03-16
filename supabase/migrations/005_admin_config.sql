-- Migration: 005_admin_config
-- Owner: agent-api-2 (M8-004)
-- Adds the admin_config table for per-workspace budget and model restrictions.

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_config (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid        REFERENCES workspaces(id) ON DELETE CASCADE,
  max_session_budget_cents integer,           -- NULL = no cap
  max_agent_budget_cents   integer,           -- NULL = no cap
  allowed_models           text[],            -- NULL = all models allowed
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid        REFERENCES profiles(id) ON DELETE SET NULL
);

-- Only one config row per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS admin_config_workspace_unique
  ON admin_config (workspace_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated workspace member may read the config.
CREATE POLICY "admin_config_select" ON admin_config
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id   FROM workspaces       WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- INSERT: workspace owner only.
CREATE POLICY "admin_config_insert" ON admin_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- UPDATE: workspace owner only.
CREATE POLICY "admin_config_update" ON admin_config
  FOR UPDATE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- DELETE: workspace owner only.
CREATE POLICY "admin_config_delete" ON admin_config
  FOR DELETE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS admin_config_workspace_idx ON admin_config (workspace_id);
