-- SCHEDULE OVERRIDES, ANNOUNCEMENTS, and admin-only statistics functions.

/* ------------------------------------------------------------ schedule */

create policy "Admins write class sections" on public.class_sections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Admins write schedule entries" on public.schedule_entries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

/**
 * One change on one date (Addis Ababa): cancel a class, an extra class, a room change, a holiday or an exam.
 * cancel / room → entry_id; extra / exam → subject + times; holiday → whole day off.
 */
create table public.schedule_overrides (
  id           uuid primary key default gen_random_uuid(),
  section_id   uuid not null references public.class_sections (id) on delete cascade,
  date         date not null,
  kind         text not null check (kind in ('cancel', 'extra', 'room', 'holiday', 'exam')),
  entry_id     uuid references public.schedule_entries (id) on delete cascade,
  subject_slug text references public.subjects (slug) on update cascade on delete set null,
  start_time   time,
  end_time     time,
  room_en      text check (char_length(room_en) <= 80),
  room_am      text check (char_length(room_am) <= 80),
  floor        integer check (floor is null or floor between 0 and 50),
  title_en     text check (char_length(title_en) <= 120),
  title_am     text check (char_length(title_am) <= 120),
  note_en      text check (char_length(note_en) <= 300),
  note_am      text check (char_length(note_am) <= 300),
  created_at   timestamptz not null default now(),
  check (kind not in ('cancel', 'room') or entry_id is not null),
  check (kind not in ('extra', 'exam') or (start_time is not null and end_time is not null and end_time > start_time))
);
create index schedule_overrides_date_idx on public.schedule_overrides (section_id, date);

alter table public.schedule_overrides enable row level security;
create policy "Public can read schedule overrides" on public.schedule_overrides for select to anon, authenticated using (true);
create policy "Admins write schedule overrides" on public.schedule_overrides for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

/* ------------------------------------------------------------ announcements */

create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title_en   text not null check (char_length(title_en) between 1 and 120),
  title_am   text not null default '' check (char_length(title_am) <= 120),
  message_en text not null default '' check (char_length(message_en) <= 600),
  message_am text not null default '' check (char_length(message_am) <= 600),
  type       text not null default 'info' check (type in ('info', 'success', 'warning', 'urgent')),
  link_url   text check (link_url is null or link_url ~ '^(https://|/)'),
  starts_at  timestamptz,
  ends_at    timestamptz,
  audience   text not null default 'everyone' check (audience in ('everyone', 'logged_in')),
  published  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;
create policy "Students see live announcements" on public.announcements for select to anon, authenticated
  using (
    (published
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
      and (audience = 'everyone' or (select auth.uid()) is not null))
    or public.is_admin()
  );
create policy "Admins write announcements" on public.announcements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

/* ------------------------------------------------------------ admin statistics (read-only) */

/** Every user with role, status and totals. Reads auth.users (ban state), so it is SECURITY DEFINER + is_admin(). */
create or replace function public.admin_users()
returns table (
  id uuid, username text, created_at timestamptz, role text, last_seen_at timestamptz, ai_daily_limit integer,
  banned_until timestamptz, last_sign_in_at timestamptz, lessons_completed bigint, avg_quiz numeric,
  quiz_attempts bigint, ai_messages bigint, mfa boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;
  return query
  select p.id, p.username, p.created_at, pp.role, pp.last_seen_at, pp.ai_daily_limit,
         u.banned_until, u.last_sign_in_at,
         (select count(*) from public.lesson_progress lp where lp.user_id = p.id and lp.complete),
         (select round(avg(a.score::numeric / a.total) * 100, 1) from public.quiz_attempts a where a.user_id = p.id),
         (select count(*) from public.quiz_attempts a where a.user_id = p.id),
         (select coalesce(sum(x.messages), 0)::bigint from public.ai_usage x where x.user_id = p.id),
         exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified')
    from public.profiles p
    left join public.profiles_private pp on pp.id = p.id
    left join auth.users u on u.id = p.id
   order by p.created_at desc;
end;
$$;

/** Overview numbers + daily series for the last p_days days (Addis Ababa days). */
create or replace function public.admin_stats(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d integer := least(greatest(coalesce(p_days, 30), 1), 366);
  today date := public.addis_today();
  since date := today - (d - 1);
  prev date := today - (2 * d - 1);
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;

  with ev as (
    select e.*, (e.created_at at time zone 'Africa/Addis_Ababa')::date as day
      from public.events e
     where e.created_at >= (prev::timestamp at time zone 'Africa/Addis_Ababa')
  ),
  days as (select generate_series(since, today, interval '1 day')::date as day),
  signups as (
    select (p.created_at at time zone 'Africa/Addis_Ababa')::date as day, count(*) n
      from public.profiles p group by 1
  ),
  att as (
    select a.*, (a.created_at at time zone 'Africa/Addis_Ababa')::date as day
      from public.quiz_attempts a where a.created_at >= (prev::timestamp at time zone 'Africa/Addis_Ababa')
  )
  select jsonb_build_object(
    'days', d,
    'users_total', (select count(*) from public.profiles),
    'users_new_today', (select coalesce(sum(n), 0) from signups where day = today),
    'users_new_week', (select coalesce(sum(n), 0) from signups where day > today - 7),
    'users_new_prev_week', (select coalesce(sum(n), 0) from signups where day <= today - 7 and day > today - 14),
    'users_new_period', (select coalesce(sum(n), 0) from signups where day >= since),
    'users_new_prev_period', (select coalesce(sum(n), 0) from signups where day >= prev and day < since),
    'dau', (select count(distinct user_id) from ev where day = today and user_id is not null),
    'dau_prev', (select count(distinct user_id) from ev where day = today - 1 and user_id is not null),
    'wau', (select count(distinct user_id) from ev where day > today - 7 and user_id is not null),
    'wau_prev', (select count(distinct user_id) from ev where day <= today - 7 and day > today - 14 and user_id is not null),
    'mau', (select count(distinct e.user_id) from public.events e where e.created_at > now() - interval '30 days' and e.user_id is not null),
    'lessons_published', (select count(*) from public.lessons where status = 'published'),
    'lessons_total', (select count(*) from public.lessons),
    'completions', (select count(*) from ev where type = 'lesson_complete' and day >= since),
    'completions_prev', (select count(*) from ev where type = 'lesson_complete' and day >= prev and day < since),
    'attempts', (select count(*) from att where day >= since),
    'attempts_prev', (select count(*) from att where day >= prev and day < since),
    'avg_score', (select round(avg(score::numeric / total) * 100, 1) from att where day >= since),
    'avg_score_prev', (select round(avg(score::numeric / total) * 100, 1) from att where day >= prev and day < since),
    'ai_today', (select coalesce(sum(messages), 0) from public.ai_usage where day = today),
    'ai_yesterday', (select coalesce(sum(messages), 0) from public.ai_usage where day = today - 1),
    'ai_cost_today', public.ai_spend_since(today) - public.ai_spend_since(today + 1),
    'ai_cost_month', public.ai_spend_since(date_trunc('month', today)::date),
    'ai_cost_prev_month', public.ai_spend_since((date_trunc('month', today) - interval '1 month')::date)
                          - public.ai_spend_since(date_trunc('month', today)::date),
    'ai_budget', coalesce(((select value from public.app_settings where key = 'ai') ->> 'monthly_budget')::numeric, 0),
    'series', (
      select jsonb_agg(jsonb_build_object(
        'day', days.day,
        'signups', coalesce((select n from signups s where s.day = days.day), 0),
        'active', (select count(distinct user_id) from ev where ev.day = days.day and user_id is not null),
        'views', (select count(*) from ev where ev.day = days.day and type = 'lesson_view'),
        'completions', (select count(*) from ev where ev.day = days.day and type = 'lesson_complete'),
        'ai', (select coalesce(sum(messages), 0) from public.ai_usage u where u.day = days.day),
        'ai_cost', public.ai_spend_since(days.day) - public.ai_spend_since(days.day + 1)
      ) order by days.day)
      from days
    ),
    'views_by_subject', (
      select coalesce(jsonb_agg(jsonb_build_object('subject', x.slug, 'views', x.n) order by x.n desc), '[]'::jsonb)
        from (
          select s.slug, count(*) n
            from ev
            join public.lessons l on l.id = ev.lesson_id
            join public.units un on un.id = l.unit_id
            join public.grades g on g.id = un.grade_id
            join public.subjects s on s.id = g.subject_id
           where ev.type = 'lesson_view' and ev.day >= since
           group by s.slug
        ) x
    )
  ) into r;
  return r;
end;
$$;

/** Per quiz question: answers, % correct and the most-chosen wrong option. */
create or replace function public.admin_question_stats()
returns table (
  question_id uuid, lesson_id uuid, sort_order integer, question_en text, options_en text[], correct_index integer,
  answered bigint, correct bigint, top_wrong integer, top_wrong_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;
  return query
  with a as (
    select (x ->> 'question_id')::uuid qid, (x ->> 'chosen')::integer chosen
      from public.quiz_attempts qa, jsonb_array_elements(qa.answers) x
  )
  select q.id, z.lesson_id, q.sort_order, q.question_en, q.options_en, q.correct_index,
         coalesce((select count(*) from a where a.qid = q.id and a.chosen is not null), 0),
         coalesce((select count(*) from a where a.qid = q.id and a.chosen = q.correct_index), 0),
         (select a.chosen from a where a.qid = q.id and a.chosen is not null and a.chosen <> q.correct_index
           group by a.chosen order by count(*) desc limit 1),
         coalesce((select max(c) from (select count(*) c from a where a.qid = q.id and a.chosen is not null and a.chosen <> q.correct_index group by a.chosen) w), 0)
    from public.quiz_questions q
    join public.quizzes z on z.id = q.quiz_id;
end;
$$;

/** Per lesson: quiz attempts, average %, and how many started quizzes were finished. */
create or replace function public.admin_lesson_quiz_stats()
returns table (lesson_id uuid, attempts bigint, avg_pct numeric, starts bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;
  return query
  select l.id,
         (select count(*) from public.quiz_attempts a where a.lesson_id = l.id),
         (select round(avg(a.score::numeric / a.total) * 100, 1) from public.quiz_attempts a where a.lesson_id = l.id),
         (select count(*) from public.events e where e.lesson_id = l.id and e.type = 'quiz_start')
    from public.lessons l;
end;
$$;

/** AI usage per day (tokens, cost), top users and most-asked lessons, for the last p_days days. */
create or replace function public.admin_ai_stats(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d integer := least(greatest(coalesce(p_days, 30), 1), 366);
  today date := public.addis_today();
  since date := today - (d - 1);
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;
  select jsonb_build_object(
    'series', (
      select jsonb_agg(jsonb_build_object(
        'day', g.day,
        'messages', coalesce(sum(u.messages), 0),
        'input', coalesce(sum(u.input_tokens), 0),
        'cached', coalesce(sum(u.cached_tokens), 0),
        'output', coalesce(sum(u.output_tokens), 0),
        'searches', coalesce(sum(u.searches), 0),
        'blocked', coalesce(sum(u.blocked), 0),
        'cost', public.ai_spend_since(g.day) - public.ai_spend_since(g.day + 1)
      ) order by g.day)
      from (select generate_series(since, today, interval '1 day')::date as day) g
      left join public.ai_usage u on u.day = g.day
      group by g.day
    ),
    'top_users', (
      select coalesce(jsonb_agg(t order by t.messages desc), '[]'::jsonb) from (
        select p.id, p.username, sum(u.messages) messages, sum(u.searches) searches,
               bool_or(u.messages >= coalesce(pp.ai_daily_limit, ((select value from public.app_settings where key = 'ai') ->> 'daily_messages')::integer, 30)) hit_limit
          from public.ai_usage u join public.profiles p on p.id = u.user_id
          left join public.profiles_private pp on pp.id = u.user_id
         where u.day >= since group by p.id, p.username order by 3 desc limit 10
      ) t
    ),
    'by_lesson', (
      select coalesce(jsonb_agg(t order by t.n desc), '[]'::jsonb) from (
        select l.id, l.code, l.title_en, count(*) n
          from public.events e join public.lessons l on l.id = e.lesson_id
         where e.type = 'ai_message' and e.created_at >= (since::timestamp at time zone 'Africa/Addis_Ababa')
         group by l.id, l.code, l.title_en order by 4 desc limit 10
      ) t
    ),
    'hit_limit_today', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'messages', u.messages)), '[]'::jsonb)
        from public.ai_usage u join public.profiles p on p.id = u.user_id
        left join public.profiles_private pp on pp.id = u.user_id
       where u.day = today
         and u.messages >= coalesce(pp.ai_daily_limit, ((select value from public.app_settings where key = 'ai') ->> 'daily_messages')::integer, 30)
    )
  ) into r;
  return r;
end;
$$;

/** Row counts and storage use for the System page. */
create or replace function public.admin_system_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb := '{}'::jsonb;
  t text;
  n bigint;
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;
  foreach t in array array[
    'subjects', 'grades', 'units', 'lessons', 'lesson_sections', 'quizzes', 'quiz_questions', 'profiles',
    'lesson_progress', 'quiz_attempts', 'events', 'ai_usage', 'ai_chats', 'ai_feedback', 'ai_moderation_log',
    'class_sections', 'schedule_entries', 'schedule_overrides', 'announcements', 'lesson_versions', 'admin_audit_log'
  ] loop
    execute format('select count(*) from public.%I', t) into n;
    r := r || jsonb_build_object(t, n);
  end loop;
  return jsonb_build_object(
    'tables', r,
    'storage_bytes', (select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects),
    'storage_files', (select count(*) from storage.objects),
    'db_bytes', pg_database_size(current_database())
  );
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'admin_users()', 'admin_stats(integer)', 'admin_question_stats()', 'admin_lesson_quiz_stats()',
    'admin_ai_stats(integer)', 'admin_system_stats()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
