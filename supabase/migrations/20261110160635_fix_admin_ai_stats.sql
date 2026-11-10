-- Fix: admin_ai_stats() nested aggregates in the daily series. Aggregate per day first, then build the JSON.

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
  lim integer := coalesce(((select value from public.app_settings where key = 'ai') ->> 'daily_messages')::integer, 30);
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;
  select jsonb_build_object(
    'series', (
      select jsonb_agg(jsonb_build_object(
        'day', x.day, 'messages', x.messages, 'input', x.input, 'cached', x.cached, 'output', x.output,
        'searches', x.searches, 'blocked', x.blocked,
        'cost', public.ai_spend_since(x.day) - public.ai_spend_since(x.day + 1)
      ) order by x.day)
      from (
        select g.day,
               coalesce(sum(u.messages), 0) as messages,
               coalesce(sum(u.input_tokens), 0) as input,
               coalesce(sum(u.cached_tokens), 0) as cached,
               coalesce(sum(u.output_tokens), 0) as output,
               coalesce(sum(u.searches), 0) as searches,
               coalesce(sum(u.blocked), 0) as blocked
          from (select generate_series(since, today, interval '1 day')::date as day) g
          left join public.ai_usage u on u.day = g.day
         group by g.day
      ) x
    ),
    'top_users', (
      select coalesce(jsonb_agg(t order by t.messages desc), '[]'::jsonb) from (
        select p.id, p.username, sum(u.messages) as messages, sum(u.searches) as searches,
               bool_or(u.messages >= coalesce(pp.ai_daily_limit, lim)) as hit_limit
          from public.ai_usage u
          join public.profiles p on p.id = u.user_id
          left join public.profiles_private pp on pp.id = u.user_id
         where u.day >= since
         group by p.id, p.username
         order by 3 desc
         limit 10
      ) t
    ),
    'by_lesson', (
      select coalesce(jsonb_agg(t order by t.n desc), '[]'::jsonb) from (
        select l.id, l.code, l.title_en, count(*) as n
          from public.events e join public.lessons l on l.id = e.lesson_id
         where e.type = 'ai_message' and e.created_at >= (since::timestamp at time zone 'Africa/Addis_Ababa')
         group by l.id, l.code, l.title_en
         order by 4 desc
         limit 10
      ) t
    ),
    'hit_limit_today', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'messages', u.messages)), '[]'::jsonb)
        from public.ai_usage u
        join public.profiles p on p.id = u.user_id
        left join public.profiles_private pp on pp.id = u.user_id
       where u.day = today and u.messages >= coalesce(pp.ai_daily_limit, lim)
    )
  ) into r;
  return r;
end;
$$;
