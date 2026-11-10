-- Fix: admin_users() counted completed lessons with a column that doesn't exist (lesson_progress.completed_at).

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
         (select count(*) from public.lesson_progress lp where lp.user_id = p.id and lp.completed_at is not null),
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
