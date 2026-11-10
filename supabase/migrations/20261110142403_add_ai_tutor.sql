-- AI study tutor "Rem": daily usage limits, saved chats per lesson, and answer feedback.
-- The day is the Addis Ababa calendar day (UTC+3), so limits reset at local midnight.

create or replace function public.addis_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Africa/Addis_Ababa')::date $$;

/* ---------------- ai_usage: messages + web searches per user per day ---------------- */

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  messages integer not null default 0 check (messages >= 0),
  searches integer not null default 0 check (searches >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

-- Users can only read their own row. Nobody writes directly: only through bump_ai_usage().
create policy "Users read their own AI usage"
  on public.ai_usage for select to authenticated using ((select auth.uid()) = user_id);

/**
 * Adds to today's counters for the calling user and returns the new totals.
 * Called by the server route (with the user's session). Counters only go up, so calling it
 * directly can only use up a user's own allowance. The limits themselves are checked on the server.
 */
create or replace function public.bump_ai_usage(p_messages integer, p_searches integer)
returns table (messages integer, searches integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_messages < 0 or p_messages > 1 or p_searches < 0 or p_searches > 5 then
    raise exception 'invalid increment';
  end if;

  return query
    insert into public.ai_usage as u (user_id, day, messages, searches)
    values (uid, public.addis_today(), p_messages, p_searches)
    on conflict (user_id, day) do update
      set messages = u.messages + excluded.messages,
          searches = u.searches + excluded.searches
    returning u.messages, u.searches;
end;
$$;

/** Today's counters for the calling user (0, 0 when nothing was used yet). */
create or replace function public.get_ai_usage()
returns table (messages integer, searches integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(max(u.messages), 0)::integer, coalesce(max(u.searches), 0)::integer
  from public.ai_usage u
  where u.user_id = (select auth.uid()) and u.day = public.addis_today()
$$;

revoke all on function public.bump_ai_usage(integer, integer) from public, anon;
grant execute on function public.bump_ai_usage(integer, integer) to authenticated;
revoke all on function public.get_ai_usage() from public, anon;
grant execute on function public.get_ai_usage() to authenticated;

/* ---------------- ai_chats: one saved conversation per user per lesson ---------------- */

create table public.ai_chats (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array' and pg_column_size(messages) < 300000),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.ai_chats enable row level security;

create policy "Users read their own chats"
  on public.ai_chats for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert their own chats"
  on public.ai_chats for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own chats"
  on public.ai_chats for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own chats"
  on public.ai_chats for delete to authenticated using ((select auth.uid()) = user_id);

/* ---------------- ai_feedback: thumbs up / down on answers (for quality checks) ---------------- */

create table public.ai_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  message_id text not null check (char_length(message_id) <= 100),
  rating smallint not null check (rating in (-1, 1)),
  question text check (char_length(question) <= 2000),
  answer text check (char_length(answer) <= 8000),
  created_at timestamptz not null default now(),
  unique (user_id, message_id)
);

create index ai_feedback_created_at_idx on public.ai_feedback (created_at desc);

alter table public.ai_feedback enable row level security;

create policy "Users read their own feedback"
  on public.ai_feedback for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert their own feedback"
  on public.ai_feedback for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own feedback"
  on public.ai_feedback for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
