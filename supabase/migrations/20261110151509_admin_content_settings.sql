-- SETTINGS, AI CONTROL, CONTENT STATUS / EDITING, IMAGE STORAGE.

/* ------------------------------------------------------------ app settings */

create table public.app_settings (
  key        text primary key check (key ~ '^[a-z_]+$'),
  value      jsonb not null check (jsonb_typeof(value) = 'object'),
  is_public  boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.app_settings enable row level security;
create policy "Public settings are public, the rest admin-only"
  on public.app_settings for select to anon, authenticated using (is_public or public.is_admin());
create policy "Admins write settings"
  on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.app_settings (key, value, is_public) values
  ('site', '{"name": "Unity Social Rem", "logo_url": null, "default_locale": "en"}', true),
  ('maintenance', '{"enabled": false, "message_en": "", "message_am": ""}', true),
  ('features', '{"signups": true, "ai_tutor": true, "schedule": true, "learn_mode": true}', true),
  -- prices: USD per 1M tokens; search: USD per 1,000 calls. model / system_prompt null = code default.
  ('ai', '{"web_search": true, "model": null, "daily_messages": 30, "daily_searches": 3,
           "price_input": 0.10, "price_cached": 0.01, "price_output": 0.50, "price_search": 10,
           "monthly_budget": 5, "system_prompt": null}', false)
on conflict (key) do nothing;

create table public.ai_prompt_versions (
  id         bigint generated always as identity primary key,
  prompt     text check (char_length(prompt) <= 20000), -- null = reset to the default prompt
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.ai_prompt_versions enable row level security;
create policy "Admins manage prompt versions"
  on public.ai_prompt_versions for all to authenticated using (public.is_admin()) with check (public.is_admin());

/* ------------------------------------------------------------ AI usage: tokens, cost, moderation */

alter table public.ai_usage
  add column input_tokens  bigint  not null default 0,
  add column cached_tokens bigint  not null default 0,
  add column output_tokens bigint  not null default 0,
  add column token_calls   integer not null default 0,
  add column blocked       integer not null default 0;

create table public.ai_moderation_log (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  lesson_id  uuid references public.lessons (id) on delete set null,
  message    text not null check (char_length(message) <= 1000),
  categories jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index ai_moderation_log_created_idx on public.ai_moderation_log (created_at desc);
alter table public.ai_moderation_log enable row level security;
create policy "Admins read moderation log" on public.ai_moderation_log for select to authenticated using (public.is_admin());
revoke insert, update, delete, truncate on public.ai_moderation_log from anon, authenticated;

/** Estimated USD spent on the AI tutor since a day (Addis Ababa), using the prices in settings. */
create or replace function public.ai_spend_since(p_since date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  with s as (select value v from public.app_settings where key = 'ai')
  select coalesce(sum(
           ((u.input_tokens - u.cached_tokens) * coalesce((s.v ->> 'price_input')::numeric, 0.10)
            + u.cached_tokens * coalesce((s.v ->> 'price_cached')::numeric, 0.01)
            + u.output_tokens * coalesce((s.v ->> 'price_output')::numeric, 0.50)) / 1000000
           + u.searches * coalesce((s.v ->> 'price_search')::numeric, 10) / 1000
         ), 0)
    from public.ai_usage u, s
   where u.day >= p_since
$$;
revoke all on function public.ai_spend_since(date) from public, anon, authenticated;

/** Is Rem available right now? (kill switch + monthly budget). Safe for anyone: no numbers. */
create or replace function public.ai_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  f jsonb := (select value from public.app_settings where key = 'features');
  s jsonb := (select value from public.app_settings where key = 'ai');
  budget numeric := coalesce((s ->> 'monthly_budget')::numeric, 0);
begin
  if not coalesce((f ->> 'ai_tutor')::boolean, true) then
    return jsonb_build_object('available', false, 'reason', 'off');
  end if;
  if budget > 0 and public.ai_spend_since(date_trunc('month', public.addis_today())::date) >= budget then
    return jsonb_build_object('available', false, 'reason', 'budget');
  end if;
  return jsonb_build_object('available', true);
end;
$$;
revoke all on function public.ai_status() from public;
grant execute on function public.ai_status() to anon, authenticated;

/** The caller's AI usage today and their effective limits. */
create or replace function public.my_ai_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  s jsonb := (select value from public.app_settings where key = 'ai');
  u record;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select coalesce(max(messages), 0) m, coalesce(max(searches), 0) se into u
    from public.ai_usage where user_id = uid and day = public.addis_today();
  return public.ai_status() || jsonb_build_object(
    'messages', u.m,
    'limit', coalesce((select ai_daily_limit from public.profiles_private where id = uid), (s ->> 'daily_messages')::integer, 30)
  );
end;
$$;
revoke all on function public.my_ai_status() from public, anon;
grant execute on function public.my_ai_status() to authenticated;

/**
 * Called by the tutor route for every question: checks the kill switch, the budget and the caller's limit,
 * counts the message, logs an ai_message event and returns the runtime config (model, prompt, search).
 */
create or replace function public.start_ai_message(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  s jsonb := (select value from public.app_settings where key = 'ai');
  st jsonb := public.ai_status();
  v_limit integer;
  v_search_limit integer := coalesce((s ->> 'daily_searches')::integer, 3);
  v_messages integer;
  v_searches integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if not (st ->> 'available')::boolean then
    return jsonb_build_object('allowed', false, 'reason', st ->> 'reason');
  end if;
  v_limit := coalesce((select ai_daily_limit from public.profiles_private where id = uid), (s ->> 'daily_messages')::integer, 30);

  insert into public.ai_usage as u (user_id, day, messages)
  values (uid, public.addis_today(), 1)
  on conflict (user_id, day) do update set messages = u.messages + 1
  returning u.messages, u.searches into v_messages, v_searches;

  if v_messages > v_limit then
    return jsonb_build_object('allowed', false, 'reason', 'limit', 'messages', v_messages, 'limit', v_limit);
  end if;

  if p_lesson_id is not null and not exists (select 1 from public.lessons where id = p_lesson_id) then
    p_lesson_id := null;
  end if;
  insert into public.events (user_id, type, lesson_id) values (uid, 'ai_message', p_lesson_id);
  perform public.touch_last_seen();

  return jsonb_build_object(
    'allowed', true,
    'messages', v_messages,
    'limit', v_limit,
    'searches', v_searches,
    'search_allowed', coalesce((s ->> 'web_search')::boolean, true) and v_searches < v_search_limit,
    'model', s ->> 'model',
    'system_prompt', s ->> 'system_prompt'
  );
end;
$$;
revoke all on function public.start_ai_message(uuid) from public, anon;
grant execute on function public.start_ai_message(uuid) to authenticated;

/**
 * Token usage of one answer. Only one record per counted message (token_calls < messages) and capped,
 * so nobody can inflate the cost (which could trip the budget kill switch).
 */
create or replace function public.record_ai_tokens(p_input integer, p_cached integer, p_output integer, p_searches integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
     set input_tokens  = input_tokens + least(greatest(coalesce(p_input, 0), 0), 60000),
         cached_tokens = cached_tokens + least(greatest(coalesce(p_cached, 0), 0), least(greatest(coalesce(p_input, 0), 0), 60000)),
         output_tokens = output_tokens + least(greatest(coalesce(p_output, 0), 0), 2000),
         searches      = searches + least(greatest(coalesce(p_searches, 0), 0), 2),
         token_calls   = token_calls + 1
   where user_id = (select auth.uid()) and day = public.addis_today() and token_calls < messages
$$;
revoke all on function public.record_ai_tokens(integer, integer, integer, integer) from public, anon;
grant execute on function public.record_ai_tokens(integer, integer, integer, integer) to authenticated;

/** A message blocked by moderation (one log row per counted message at most). */
create or replace function public.log_ai_moderation(p_lesson_id uuid, p_message text, p_categories jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  update public.ai_usage set blocked = blocked + 1
   where user_id = uid and day = public.addis_today() and blocked < messages;
  if not found then
    return;
  end if;
  insert into public.ai_moderation_log (user_id, lesson_id, message, categories)
  values (uid, (select id from public.lessons where id = p_lesson_id), left(coalesce(p_message, ''), 1000), coalesce(p_categories, '[]'::jsonb));
end;
$$;
revoke all on function public.log_ai_moderation(uuid, text, jsonb) from public, anon;
grant execute on function public.log_ai_moderation(uuid, text, jsonb) to authenticated;

/* ------------------------------------------------------------ content status */

alter table public.subjects
  add column status text not null default 'published' check (status in ('published', 'draft', 'coming_soon')),
  add column color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  add column icon text check (icon is null or icon ~ '^[a-z0-9-]{1,40}$'),
  add column illustration text check (illustration is null or char_length(illustration) <= 500);
alter table public.grades
  add column status text not null default 'published' check (status in ('published', 'draft', 'coming_soon'));
alter table public.units
  add column status text not null default 'published' check (status in ('published', 'draft', 'coming_soon'));
alter table public.lessons
  add column status text not null default 'published' check (status in ('published', 'draft', 'coming_soon')),
  add column updated_at timestamptz not null default now();

-- Drafts are hidden from students (admins with 2FA still see them).
drop policy "Public can read subjects" on public.subjects;
drop policy "Public can read grades" on public.grades;
drop policy "Public can read units" on public.units;
drop policy "Public can read lessons" on public.lessons;
drop policy "Public can read lesson sections" on public.lesson_sections;
drop policy "Public can read quizzes" on public.quizzes;
drop policy "Public can read quiz questions" on public.quiz_questions;

create policy "Public reads non-draft subjects" on public.subjects for select to anon, authenticated
  using (status <> 'draft' or public.is_admin());
create policy "Public reads non-draft grades" on public.grades for select to anon, authenticated
  using (status <> 'draft' or public.is_admin());
create policy "Public reads non-draft units" on public.units for select to anon, authenticated
  using (status <> 'draft' or public.is_admin());
create policy "Public reads non-draft lessons" on public.lessons for select to anon, authenticated
  using (status <> 'draft' or public.is_admin());
-- Notes and quizzes only for PUBLISHED lessons ("Coming soon" lessons show no content).
create policy "Public reads sections of published lessons" on public.lesson_sections for select to anon, authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id and l.status = 'published') or public.is_admin());
create policy "Public reads quizzes of published lessons" on public.quizzes for select to anon, authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id and l.status = 'published') or public.is_admin());
create policy "Public reads questions of published lessons" on public.quiz_questions for select to anon, authenticated
  using (exists (
    select 1 from public.quizzes q join public.lessons l on l.id = q.lesson_id
     where q.id = quiz_id and l.status = 'published'
  ) or public.is_admin());

create policy "Admins write subjects" on public.subjects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins write grades" on public.grades for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins write units" on public.units for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins write lessons" on public.lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins write lesson sections" on public.lesson_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins write quizzes" on public.quizzes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins write quiz questions" on public.quiz_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

/* ------------------------------------------------------------ lesson drafts + version history */

create table public.lesson_drafts (
  lesson_id  uuid primary key references public.lessons (id) on delete cascade,
  data       jsonb not null check (pg_column_size(data) < 2000000),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.lesson_drafts enable row level security;
create policy "Admins manage lesson drafts" on public.lesson_drafts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table public.lesson_versions (
  id         bigint generated always as identity primary key,
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  snapshot   jsonb not null check (pg_column_size(snapshot) < 2000000),
  note       text check (char_length(note) <= 200),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index lesson_versions_lesson_idx on public.lesson_versions (lesson_id, created_at desc);
alter table public.lesson_versions enable row level security;
create policy "Admins read lesson versions" on public.lesson_versions for select to authenticated using (public.is_admin());
create policy "Admins add lesson versions" on public.lesson_versions for insert to authenticated with check (public.is_admin());

/* ------------------------------------------------------------ image storage */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "Admins upload media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
create policy "Admins update media" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin()) with check (bucket_id = 'media' and public.is_admin());
create policy "Admins delete media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
create policy "Admins list media" on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_admin());
