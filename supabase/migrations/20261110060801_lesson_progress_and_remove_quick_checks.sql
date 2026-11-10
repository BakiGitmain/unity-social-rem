-- 1) Learn mode no longer has quick checks between parts.
alter table public.lesson_sections drop column if exists checks;

-- 2) Per-user lesson progress, so progress follows a logged-in student across devices.
create table public.lesson_progress (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id       uuid not null references public.lessons (id) on delete cascade,
  parts_done      int[] not null default '{}',          -- indices (0-based) of the parts the student finished
  total_parts     int not null default 0 check (total_parts >= 0),
  completed_at    timestamptz,
  best_quiz_score int check (best_quiz_score >= 0),
  best_quiz_total int check (best_quiz_total > 0),
  updated_at      timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index lesson_progress_user_id_idx on public.lesson_progress (user_id);

alter table public.lesson_progress enable row level security;

create policy "Users read their own progress"
  on public.lesson_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert their own progress"
  on public.lesson_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own progress"
  on public.lesson_progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own progress"
  on public.lesson_progress for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.lesson_progress from anon;

-- Save progress for the current user, always keeping the HIGHER value
-- (union of finished parts, earliest completion, best quiz score). Runs as the caller, so RLS applies.
create function public.save_lesson_progress(
  p_lesson_id   uuid,
  p_parts_done  int[],
  p_total_parts int,
  p_completed   boolean,
  p_quiz_score  int default null,
  p_quiz_total  int default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not logged in';
  end if;

  insert into public.lesson_progress as lp
    (user_id, lesson_id, parts_done, total_parts, completed_at, best_quiz_score, best_quiz_total, updated_at)
  values (
    v_uid, p_lesson_id,
    coalesce((select array_agg(distinct x order by x) from unnest(p_parts_done) as x where x >= 0), '{}'),
    greatest(coalesce(p_total_parts, 0), 0),
    case when p_completed then now() end,
    p_quiz_score, p_quiz_total, now()
  )
  on conflict (user_id, lesson_id) do update set
    parts_done = coalesce(
      (select array_agg(distinct x order by x) from unnest(lp.parts_done || excluded.parts_done) as x where x >= 0),
      '{}'),
    total_parts = greatest(lp.total_parts, excluded.total_parts),
    completed_at = coalesce(lp.completed_at, excluded.completed_at),
    best_quiz_total = case
      when excluded.best_quiz_score is not null
       and (lp.best_quiz_score is null or excluded.best_quiz_score > lp.best_quiz_score)
      then excluded.best_quiz_total else lp.best_quiz_total end,
    best_quiz_score = case
      when excluded.best_quiz_score is not null
       and (lp.best_quiz_score is null or excluded.best_quiz_score > lp.best_quiz_score)
      then excluded.best_quiz_score else lp.best_quiz_score end,
    updated_at = now();
end;
$$;

revoke execute on function public.save_lesson_progress(uuid, int[], int, boolean, int, int) from public, anon;
grant execute on function public.save_lesson_progress(uuid, int[], int, boolean, int, int) to authenticated;
