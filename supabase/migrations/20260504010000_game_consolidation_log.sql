-- Audit log for admin Consolidate Games actions (issue #194 PR 2).
--
-- Captures every consolidation: which canonical row survived, which orphan
-- was folded in, what got moved/deleted, and who did it. Append-only;
-- consolidations are destructive (orphan game row is deleted) so this is
-- the only forward record of the action.
--
-- No FK on canonical_game_id or actor_id intentionally — the log must
-- survive future game deletions / user deletions so the audit trail is
-- never silently broken. Snapshot fields (orphan_name, moved_application_ids)
-- preserve enough context that the row is meaningful even after both sides
-- of the original consolidation are gone.
--
-- Concept: Provenance / Data Lineage (concepts.md).

create table public.game_consolidation_log (
  id                     uuid primary key default gen_random_uuid(),
  canonical_game_id      uuid not null,
  orphan_game_id         uuid not null,
  orphan_name            text not null,
  moved_application_ids  text[] not null default '{}',
  sessions_deleted       integer not null default 0,
  sessions_repointed     integer not null default 0,
  library_deleted        integer not null default 0,
  library_repointed      integer not null default 0,
  actor_id               uuid,
  created_at             timestamptz not null default now()
);

create index game_consolidation_log_canonical_game_id_idx
  on public.game_consolidation_log (canonical_game_id);
create index game_consolidation_log_created_at_idx
  on public.game_consolidation_log (created_at desc);

comment on table public.game_consolidation_log is
  'Append-only audit log for admin Consolidate Games actions. Records every fold of an orphan game row into a canonical, including snapshots of what was moved/deleted (sessions, library entries, Discord app ids) and who performed it. Issue #194 PR 2.';

-- RLS: enable but no public policy. Service-role (admin path) bypasses RLS;
-- regular users have no read access. Mirrors how admin_remap and
-- admin_delete logs would be handled — no end-user-facing surface.
alter table public.game_consolidation_log enable row level security;
