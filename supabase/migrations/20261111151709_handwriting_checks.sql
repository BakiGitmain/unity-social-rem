/*
 * Handwriting checks ("Answer Paper"): the AI reads a handwritten answer (vision, low detail),
 * and "Check my working" gives one hint on the scratch paper.
 * - Login required; per-user daily limits (default 60 reads, 5 working hints), own ON/OFF switch.
 * - Counted in ai_usage; tokens go into the same token columns, so the cost chart and the monthly
 *   budget auto-stop include them.
 */

alter table public.ai_usage
  add column ink_checks      integer not null default 0 check (ink_checks >= 0),
  add column ink_hints       integer not null default 0 check (ink_hints >= 0),
  add column ink_token_calls integer not null default 0 check (ink_token_calls >= 0);

-- Defaults for the new settings (keeps any value an admin already set).
update public.app_settings
   set value = jsonb_build_object('ink_enabled', true, 'ink_daily_checks', 60, 'ink_daily_hints', 5) || value
 where key = 'ai';

/** The caller's handwriting status: available? used / limits today. */
create or replace function public.my_ink_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  s jsonb := (select value from public.app_settings where key = 'ai');
  st jsonb := public.ai_status();
  u record;
begin
  if uid is null then
    return jsonb_build_object('available', false, 'reason', 'login');
  end if;
  select coalesce(max(ink_checks), 0) c, coalesce(max(ink_hints), 0) h into u
    from public.ai_usage where user_id = uid and day = public.addis_today();
  return jsonb_build_object(
    'available', (st ->> 'available')::boolean and coalesce((s ->> 'ink_enabled')::boolean, true),
    'reason', case when not (st ->> 'available')::boolean then st ->> 'reason'
                   when not coalesce((s ->> 'ink_enabled')::boolean, true) then 'off' end,
    'checks', u.c,
    'limit', coalesce((s ->> 'ink_daily_checks')::integer, 60),
    'hints', u.h,
    'hint_limit', coalesce((s ->> 'ink_daily_hints')::integer, 5)
  );
end;
$$;
revoke all on function public.my_ink_status() from public, anon;
grant execute on function public.my_ink_status() to authenticated;

/**
 * Called by /api/handwriting before every AI call. p_kind: 'read' (answer) | 'hint' (check my working).
 * Checks the AI kill switch + budget, the handwriting switch and the daily limit, then counts it.
 */
create or replace function public.start_ink_check(p_kind text)
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
  v_used integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_kind not in ('read', 'hint') then
    raise exception 'bad kind';
  end if;
  if not (st ->> 'available')::boolean then
    return jsonb_build_object('allowed', false, 'reason', st ->> 'reason');
  end if;
  if not coalesce((s ->> 'ink_enabled')::boolean, true) then
    return jsonb_build_object('allowed', false, 'reason', 'off');
  end if;

  if p_kind = 'read' then
    v_limit := coalesce((s ->> 'ink_daily_checks')::integer, 60);
    insert into public.ai_usage as u (user_id, day, ink_checks) values (uid, public.addis_today(), 1)
    on conflict (user_id, day) do update set ink_checks = u.ink_checks + 1
    returning u.ink_checks into v_used;
  else
    v_limit := coalesce((s ->> 'ink_daily_hints')::integer, 5);
    insert into public.ai_usage as u (user_id, day, ink_hints) values (uid, public.addis_today(), 1)
    on conflict (user_id, day) do update set ink_hints = u.ink_hints + 1
    returning u.ink_hints into v_used;
  end if;

  if v_used > v_limit then
    return jsonb_build_object('allowed', false, 'reason', 'limit', 'used', v_used, 'limit', v_limit);
  end if;
  perform public.touch_last_seen();
  return jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_limit, 'model', s ->> 'ink_model', 'chat_model', s ->> 'model');
end;
$$;
revoke all on function public.start_ink_check(text) from public, anon;
grant execute on function public.start_ink_check(text) to authenticated;

/** Tokens of one handwriting call (one record per counted check, capped), added to the shared token totals. */
create or replace function public.record_ink_tokens(p_input integer, p_cached integer, p_output integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
     set input_tokens    = input_tokens + least(greatest(coalesce(p_input, 0), 0), 8000),
         cached_tokens   = cached_tokens + least(greatest(coalesce(p_cached, 0), 0), least(greatest(coalesce(p_input, 0), 0), 8000)),
         output_tokens   = output_tokens + least(greatest(coalesce(p_output, 0), 0), 600),
         ink_token_calls = ink_token_calls + 1
   where user_id = (select auth.uid()) and day = public.addis_today() and ink_token_calls < ink_checks + ink_hints
$$;
revoke all on function public.record_ink_tokens(integer, integer, integer) from public, anon;
grant execute on function public.record_ink_tokens(integer, integer, integer) to authenticated;

/* Admin AI stats: also count handwriting checks per day (their cost is already in the token totals). */

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
        'searches', x.searches, 'blocked', x.blocked, 'ink', x.ink,
        'cost', public.ai_spend_since(x.day) - public.ai_spend_since(x.day + 1)
      ) order by x.day)
      from (
        select g.day,
               coalesce(sum(u.messages), 0) as messages,
               coalesce(sum(u.input_tokens), 0) as input,
               coalesce(sum(u.cached_tokens), 0) as cached,
               coalesce(sum(u.output_tokens), 0) as output,
               coalesce(sum(u.searches), 0) as searches,
               coalesce(sum(u.blocked), 0) as blocked,
               coalesce(sum(u.ink_checks + u.ink_hints), 0) as ink
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
