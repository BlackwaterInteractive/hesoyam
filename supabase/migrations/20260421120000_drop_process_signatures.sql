-- Drop process_signatures: desktop-agent era table, superseded by Discord RP resolution.
-- Prod dropped this on 2026-02-06; staging also no longer has it. This migration
-- aligns the repo with live state, so any fresh rebuild ends up without the table.
--
-- CASCADE drops the table's indexes and RLS policies. No other table has an
-- FK pointing to process_signatures, so CASCADE scope is self-contained.

drop table if exists public.process_signatures cascade;
