-- LIVE UPDATES: broadcast changes of these tables through Supabase Realtime.
-- Realtime applies each subscriber's RLS policies, so admin-only tables (events, ai_feedback) only reach admins
-- with a 2FA session, and students only receive public rows (live announcements, public settings, schedule).

do $$
declare
  t text;
begin
  foreach t in array array['events', 'profiles', 'ai_feedback', 'announcements', 'app_settings', 'schedule_overrides', 'schedule_entries'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
