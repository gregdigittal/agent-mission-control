-- Migration: 006_vps_nodes
-- Creates the vps_nodes table written by the bridge on startup and heartbeat.
-- The bridge uses the service role key (bypasses RLS) to write.
-- The dashboard reads via the anon/user key (subject to RLS).

CREATE TABLE IF NOT EXISTS vps_nodes (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name                  text        NOT NULL,
  hostname              text        NOT NULL,
  status                text        NOT NULL DEFAULT 'offline'
                                    CHECK (status IN ('online', 'offline', 'degraded')),
  current_agent_count   integer     NOT NULL DEFAULT 0,
  max_concurrent_agents integer     NOT NULL DEFAULT 5,
  last_heartbeat        timestamptz,
  agent_bridge_version  text,
  system_info           jsonb       NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE vps_nodes ENABLE ROW LEVEL SECURITY;

-- Dashboard users can read their own nodes
CREATE POLICY "vps_nodes_select" ON vps_nodes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Dashboard users can manually register a node (bridge uses service role)
CREATE POLICY "vps_nodes_insert" ON vps_nodes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Dashboard users can update/delete their own nodes
CREATE POLICY "vps_nodes_update" ON vps_nodes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "vps_nodes_delete" ON vps_nodes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS vps_nodes_user_idx ON vps_nodes (user_id);
