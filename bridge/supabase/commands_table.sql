-- Agent Mission Control — commands table
-- Run this in the Supabase SQL editor for your project.
-- This table is the command queue for remote bridge control.

create table if not exists public.commands (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,
  payload       jsonb not null default '{}',
  session_token text not null default '',
  created_by    uuid references auth.users(id),
  status        text not null default 'pending',  -- pending | processing | done | error
  created_at    timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);

-- Index for efficient pending command polling (bridge polls this every 2s)
create index if not exists commands_status_created_idx
  on public.commands (status, created_at asc)
  where status = 'pending';

-- RLS: authenticated users can insert and read their own commands
alter table public.commands enable row level security;

create policy "Users can insert commands"
  on public.commands for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Users can read own commands"
  on public.commands for select
  to authenticated
  using (created_by = auth.uid());

-- Enable realtime for command status updates (optional — lets dashboard see done/error status)
alter publication supabase_realtime add table public.commands;
