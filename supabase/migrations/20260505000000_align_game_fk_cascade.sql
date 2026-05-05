-- Align FK delete policies on game-child tables to ON DELETE CASCADE on every
-- environment, regardless of how the existing constraints were originally
-- named or what their current policy is.
--
-- Background: during the early click-ops period, the FKs from game_sessions,
-- user_games, and user_game_library to games(id) were created via Supabase
-- Studio with inconsistent ON DELETE policies across environments. Prod ended
-- up with CASCADE on all three (some via manual ALTERs that were never
-- captured in a migration). Staging kept NO ACTION. The committed migration
-- files were also inconsistent: 20260126104957 / 20260126105011 declared
-- CASCADE for game_sessions / user_games, but 20260127000000 declared
-- user_game_library WITHOUT an ON DELETE clause (defaults to NO ACTION).
--
-- This migration converges all three FKs to CASCADE under canonical names
-- (<table>_game_id_fkey), regardless of what was there before. Idempotent:
-- - On staging: changes NO ACTION -> CASCADE on all three.
-- - On prod: drops and re-adds the existing CASCADE constraints under
--   normalized names — no behavioral change, but the constraint definitions
--   now live in the migration history instead of as ghost console ALTERs.
-- - Running twice: second run drops the canonical constraint and re-adds
--   it with the same definition. No-op end state.

do $$
declare
  tbl text;
  con record;
begin
  foreach tbl in array array['game_sessions', 'user_games', 'user_game_library'] loop

    -- Drop every FK from public.<tbl>(game_id) -> public.games(id),
    -- regardless of constraint name. Iterates because in theory a misconfigured
    -- env could have more than one (it shouldn't, but be defensive).
    for con in
      select c.conname
      from pg_constraint c
      join pg_class      t   on t.oid = c.conrelid
      join pg_namespace  tn  on tn.oid = t.relnamespace
      join pg_class      rt  on rt.oid = c.confrelid
      join pg_namespace  rtn on rtn.oid = rt.relnamespace
      join pg_attribute  a   on a.attrelid = c.conrelid
                            and a.attnum   = c.conkey[1]
      where c.contype = 'f'
        and cardinality(c.conkey) = 1
        and tn.nspname  = 'public'
        and t.relname   = tbl
        and rtn.nspname = 'public'
        and rt.relname  = 'games'
        and a.attname   = 'game_id'
    loop
      execute format(
        'alter table public.%I drop constraint %I',
        tbl,
        con.conname
      );
    end loop;

    -- Re-add the FK under the canonical name with ON DELETE CASCADE.
    execute format(
      'alter table public.%I add constraint %I foreign key (game_id) references public.games(id) on delete cascade',
      tbl,
      tbl || '_game_id_fkey'
    );

  end loop;
end$$;
