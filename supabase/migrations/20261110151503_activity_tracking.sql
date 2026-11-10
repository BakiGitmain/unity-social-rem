-- ACTIVITY TRACKING (first-party, no third-party trackers): events, quiz attempts, last seen.
-- Writes happen only through the SECURITY DEFINER functions below, which the app calls from SERVER code
-- (/api/track, server actions, the tutor route). user_id is always auth.uid(), so nobody can log as someone else.

/* ------------------------------------------------------------ events */

create table public.events (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  type       text not null check (type in ('lesson_view', 'lesson_complete', 'quiz_start', 'quiz_finish', 'ai_message', 'signup', 'login')),
  lesson_id  uuid references public.lessons (id) on delete set null,
  metadata   jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) < 2000),
  created_at timestamptz not null default now()
);

create index events_created_at_idx on public.events (created_at desc);
create index events_type_created_idx on public.events (type, created_at desc);
create index events_user_idx on public.events (user_id, created_at desc);

alter table public.events enable row level security;
create policy "Admins read events" on public.events for select to authenticated using (public.is_admin());
revoke insert, update, delete, truncate on public.events from anon, authenticated;

/** Last seen: at most one write per user every 5 minutes. */
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles_private
     set last_seen_at = now()
   where id = (select auth.uid())
     and (last_seen_at is null or last_seen_at < now() - interval '5 minutes')
$$;

/**
 * Log one event for the caller. ai_message and quiz_finish are NOT accepted here: they are written by
 * start_ai_message() and record_quiz_attempt(), which check the real usage. Max 120 events/user/hour.
 */
create or replace function public.track_event(p_type text, p_lesson_id uuid, p_metadata jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if p_type not in ('lesson_view', 'lesson_complete', 'quiz_start', 'signup', 'login') then
    raise exception 'Unknown event';
  end if;
  if uid is null and p_type not in ('lesson_view', 'lesson_complete', 'quiz_start') then
    return;
  end if;
  if uid is not null and (
    select count(*) from public.events e where e.user_id = uid and e.created_at > now() - interval '1 hour'
  ) >= 120 then
    return;
  end if;
  if p_lesson_id is not null and not exists (select 1 from public.lessons where id = p_lesson_id) then
    p_lesson_id := null;
  end if;
  insert into public.events (user_id, type, lesson_id, metadata)
  values (uid, p_type, p_lesson_id, coalesce(p_metadata, '{}'::jsonb));
  if uid is not null then
    perform public.touch_last_seen();
  end if;
end;
$$;

revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;
revoke all on function public.track_event(text, uuid, jsonb) from public;
grant execute on function public.track_event(text, uuid, jsonb) to anon, authenticated;

/* ------------------------------------------------------------ quiz attempts */

create table public.quiz_attempts (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete cascade,
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  quiz_id     uuid not null references public.quizzes (id) on delete cascade,
  score       integer not null check (score >= 0),
  total       integer not null check (total > 0),
  -- [{ "question_id": uuid, "chosen": int | null, "correct": bool }]
  answers     jsonb not null check (jsonb_typeof(answers) = 'array'),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 86400000),
  created_at  timestamptz not null default now()
);

create index quiz_attempts_lesson_idx on public.quiz_attempts (lesson_id, created_at desc);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, created_at desc);
create index quiz_attempts_created_idx on public.quiz_attempts (created_at desc);

alter table public.quiz_attempts enable row level security;
create policy "Users read their own attempts, admins read all"
  on public.quiz_attempts for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());
revoke insert, update, delete, truncate on public.quiz_attempts from anon, authenticated;

/**
 * Record a finished quiz. The SCORE IS COMPUTED HERE from the real answers, never trusted from the browser.
 * p_answers: [{ "question_id": uuid, "chosen": int | null }]. Max 30 attempts/user/hour.
 */
create or replace function public.record_quiz_attempt(p_lesson_id uuid, p_answers jsonb, p_duration_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_quiz uuid;
  v_total integer;
  v_answers jsonb;
  v_score integer;
begin
  select id into v_quiz from public.quizzes where lesson_id = p_lesson_id;
  if v_quiz is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Unknown quiz';
  end if;
  if uid is not null and (
    select count(*) from public.quiz_attempts a where a.user_id = uid and a.created_at > now() - interval '1 hour'
  ) >= 30 then
    return jsonb_build_object('ok', false);
  end if;

  select count(*) into v_total from public.quiz_questions where quiz_id = v_quiz;
  if v_total = 0 then
    raise exception 'Empty quiz';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'question_id', q.id,
           'chosen', a.chosen,
           'correct', a.chosen is not null and a.chosen = q.correct_index
         ) order by q.sort_order), '[]'::jsonb),
         count(*) filter (where a.chosen is not null and a.chosen = q.correct_index)
    into v_answers, v_score
    from public.quiz_questions q
    left join lateral (
      select (x ->> 'chosen')::integer as chosen
        from jsonb_array_elements(p_answers) x
       where (x ->> 'question_id') = q.id::text
       limit 1
    ) a on true
   where q.quiz_id = v_quiz;

  insert into public.quiz_attempts (user_id, lesson_id, quiz_id, score, total, answers, duration_ms)
  values (uid, p_lesson_id, v_quiz, v_score, v_total, v_answers, least(greatest(coalesce(p_duration_ms, 0), 0), 86400000));

  insert into public.events (user_id, type, lesson_id, metadata)
  values (uid, 'quiz_finish', p_lesson_id, jsonb_build_object('score', v_score, 'total', v_total));

  if uid is not null then
    perform public.touch_last_seen();
  end if;
  return jsonb_build_object('ok', true, 'score', v_score, 'total', v_total);
end;
$$;

revoke all on function public.record_quiz_attempt(uuid, jsonb, integer) from public;
grant execute on function public.record_quiz_attempt(uuid, jsonb, integer) to anon, authenticated;

/* ------------------------------------------------------------ admin read access to existing tables */

create policy "Admins read all progress"
  on public.lesson_progress for select to authenticated using (public.is_admin());
create policy "Admins read all AI usage"
  on public.ai_usage for select to authenticated using (public.is_admin());
create policy "Admins read all chats"
  on public.ai_chats for select to authenticated using (public.is_admin());
create policy "Admins read all feedback"
  on public.ai_feedback for select to authenticated using (public.is_admin());

alter table public.ai_feedback
  add column reviewed_at timestamptz,
  add column reviewed_by uuid;

create policy "Admins review feedback"
  on public.ai_feedback for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
