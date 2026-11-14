/*
 * Telegram bot @UnitySocialRemBot (code in src/lib/telegram and src/app/api/telegram).
 *
 * - Every table here is SERVICE ROLE ONLY: RLS on, no policies, and no table rights for anon / authenticated.
 *   The bot's server code (webhook + tick routes) is the only reader and writer.
 * - Every function here is executable ONLY by service_role.
 * - pg_cron + pg_net call /api/telegram/tick every 5 minutes. The tick URL and its secret live in Supabase Vault
 *   (set after the deploy by scripts/telegram-setup.mts → telegram_configure_tick); until then the job does nothing.
 * - Rem on Telegram counts in the same monthly AI budget as the site (ai_spend_since below).
 */

/* ------------------------------------------------------------ tables */

create table public.telegram_subscribers (
  chat_id      bigint primary key,
  username     text check (char_length(username) <= 64),
  first_name   text check (char_length(first_name) <= 128),
  language     text not null default 'en' check (language in ('en', 'am')),
  reminders_on boolean not null default true,
  -- false after the user blocked the bot (Telegram 403); set back to true when they write again
  active       boolean not null default true,
  -- optional link to a site account (Profile → Telegram bot); one Telegram chat per account
  profile_id   uuid unique references public.profiles (id) on delete set null,
  -- small bot state: running quiz, last follow-up questions, pending announcement
  state        jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object' and pg_column_size(state) < 20000),
  created_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);
create index telegram_subscribers_active_idx on public.telegram_subscribers (active, reminders_on);

-- Each lesson is announced once.
create table public.telegram_sent_lessons (
  lesson_id  uuid primary key references public.lessons (id) on delete cascade,
  lesson_key text not null check (char_length(lesson_key) <= 300), -- subject/grade/unit/slug
  sent_at    timestamptz not null default now(),
  recipients integer not null default 0
);

-- Each reminder is sent once: class id (or 'summary') + Addis Ababa date.
create table public.telegram_reminders_sent (
  class_id text not null check (char_length(class_id) <= 100),
  date     date not null,
  sent_at  timestamptz not null default now(),
  primary key (class_id, date)
);

-- Rem questions + tokens per chat per Addis Ababa day (limit 15 / day; tokens count in the monthly budget).
create table public.telegram_usage (
  chat_id       bigint not null references public.telegram_subscribers (chat_id) on delete cascade,
  day           date not null,
  rem           integer not null default 0 check (rem >= 0),
  token_calls   integer not null default 0 check (token_calls >= 0),
  input_tokens  bigint not null default 0,
  cached_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (chat_id, day)
);

-- Messages received / sent per Addis Ababa day (for /stats).
create table public.telegram_daily (
  day      date primary key,
  received integer not null default 0,
  sent     integer not null default 0
);

-- One-time links "Connect Telegram" (site) → t.me/UnitySocialRemBot?start=link_<token>. Valid 15 minutes.
create table public.telegram_link_tokens (
  token      text primary key check (char_length(token) between 20 and 64),
  user_id    uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes'
);

do $$
declare t text;
begin
  foreach t in array array['telegram_subscribers', 'telegram_sent_lessons', 'telegram_reminders_sent',
                           'telegram_usage', 'telegram_daily', 'telegram_link_tokens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Lessons that already exist are not announced again when the bot starts.
insert into public.telegram_sent_lessons (lesson_id, lesson_key, recipients)
select l.id, s.slug || '/' || g.slug || '/' || u.slug || '/' || l.slug, 0
  from public.lessons l
  join public.units u on u.id = l.unit_id
  join public.grades g on g.id = u.grade_id
  join public.subjects s on s.id = g.subject_id
on conflict do nothing;

/* ------------------------------------------------------------ functions (service_role only) */

/** Every incoming update: create / refresh the subscriber, count the message, return the row. */
create or replace function public.telegram_touch(p_chat_id bigint, p_username text, p_first_name text, p_language text)
returns public.telegram_subscribers
language plpgsql
security definer
set search_path = ''
as $$
declare r public.telegram_subscribers;
begin
  insert into public.telegram_subscribers as s (chat_id, username, first_name, language)
  values (p_chat_id, left(p_username, 64), left(p_first_name, 128), case when p_language = 'am' then 'am' else 'en' end)
  on conflict (chat_id) do update
    set username = excluded.username, first_name = excluded.first_name, active = true, last_seen = now()
  returning * into r;
  insert into public.telegram_daily as d (day, received) values (public.addis_today(), 1)
  on conflict (day) do update set received = d.received + 1;
  return r;
end;
$$;

/** Messages the bot sent (counted in memory per request, added once at the end). */
create or replace function public.telegram_bump_sent(p_sent integer)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.telegram_daily as d (day, sent) values (public.addis_today(), greatest(p_sent, 0))
  on conflict (day) do update set sent = d.sent + greatest(p_sent, 0)
$$;

/** Before a Rem question: kill switch + monthly budget (same as the site) + the bot's daily limit. */
create or replace function public.telegram_start_rem(p_chat_id bigint, p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  st jsonb := public.ai_status();
  s jsonb := (select value from public.app_settings where key = 'ai');
  v_used integer;
begin
  if not (st ->> 'available')::boolean then
    return jsonb_build_object('allowed', false, 'reason', st ->> 'reason');
  end if;
  insert into public.telegram_usage as u (chat_id, day, rem) values (p_chat_id, public.addis_today(), 1)
  on conflict (chat_id, day) do update set rem = u.rem + 1 where u.rem < p_limit
  returning u.rem into v_used;
  if v_used is null then
    return jsonb_build_object('allowed', false, 'reason', 'limit', 'used', p_limit, 'limit', p_limit);
  end if;
  return jsonb_build_object('allowed', true, 'used', v_used, 'limit', p_limit,
                            'model', s ->> 'model', 'system_prompt', s ->> 'system_prompt');
end;
$$;

/** Tokens of one Rem answer (capped, once per counted question), for the cost chart and the monthly budget. */
create or replace function public.telegram_record_rem_tokens(p_chat_id bigint, p_input integer, p_cached integer, p_output integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.telegram_usage
     set input_tokens  = input_tokens + least(greatest(coalesce(p_input, 0), 0), 60000),
         cached_tokens = cached_tokens + least(greatest(coalesce(p_cached, 0), 0), least(greatest(coalesce(p_input, 0), 0), 60000)),
         output_tokens = output_tokens + least(greatest(coalesce(p_output, 0), 0), 3000),
         token_calls   = token_calls + 1
   where chat_id = p_chat_id and day = public.addis_today() and token_calls < rem
$$;

/** /stats for the admin. */
create or replace function public.telegram_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'subscribers', (select count(*) from public.telegram_subscribers),
    'active',      (select count(*) from public.telegram_subscribers where active),
    'reminders',   (select count(*) from public.telegram_subscribers where active and reminders_on),
    'amharic',     (select count(*) from public.telegram_subscribers where active and language = 'am'),
    'linked',      (select count(*) from public.telegram_subscribers where profile_id is not null),
    'new_today',   (select count(*) from public.telegram_subscribers where (created_at at time zone 'Africa/Addis_Ababa')::date = public.addis_today()),
    'received',    coalesce((select received from public.telegram_daily where day = public.addis_today()), 0),
    'sent',        coalesce((select sent from public.telegram_daily where day = public.addis_today()), 0),
    'rem_today',   coalesce((select sum(rem) from public.telegram_usage where day = public.addis_today()), 0),
    'lessons_announced', (select count(*) from public.telegram_sent_lessons where recipients > 0)
  )
$$;

/** Rem's monthly spend now includes Rem on Telegram (same prices from app_settings.ai). */
create or replace function public.ai_spend_since(p_since date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  with s as (select value v from public.app_settings where key = 'ai'),
  site as (
    select coalesce(sum(
             ((u.input_tokens - u.cached_tokens) * coalesce((s.v ->> 'price_input')::numeric, 0.10)
              + u.cached_tokens * coalesce((s.v ->> 'price_cached')::numeric, 0.01)
              + u.output_tokens * coalesce((s.v ->> 'price_output')::numeric, 0.50)) / 1000000
             + u.searches * coalesce((s.v ->> 'price_search')::numeric, 10) / 1000
           ), 0) c
      from public.ai_usage u, s
     where u.day >= p_since
  ),
  tg as (
    select coalesce(sum(
             ((t.input_tokens - t.cached_tokens) * coalesce((s.v ->> 'price_input')::numeric, 0.10)
              + t.cached_tokens * coalesce((s.v ->> 'price_cached')::numeric, 0.01)
              + t.output_tokens * coalesce((s.v ->> 'price_output')::numeric, 0.50)) / 1000000
           ), 0) c
      from public.telegram_usage t, s
     where t.day >= p_since
  )
  select site.c + tg.c from site, tg
$$;
revoke all on function public.ai_spend_since(date) from public, anon, authenticated;

/* ------------------------------------------------------------ every 5 minutes: pg_cron → pg_net → /api/telegram/tick */

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

/** Saves the tick URL + CRON_SECRET in Vault (called once after the deploy by scripts/telegram-setup.mts). */
create or replace function public.telegram_configure_tick(p_url text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if p_url !~ '^https://' or char_length(p_secret) < 32 then
    raise exception 'bad tick config';
  end if;
  select id into v_id from vault.secrets where name = 'telegram_tick_url';
  if v_id is null then perform vault.create_secret(p_url, 'telegram_tick_url'); else perform vault.update_secret(v_id, p_url); end if;
  select id into v_id from vault.secrets where name = 'telegram_cron_secret';
  if v_id is null then perform vault.create_secret(p_secret, 'telegram_cron_secret'); else perform vault.update_secret(v_id, p_secret); end if;
end;
$$;

/** Called by pg_cron. Does nothing until the URL + secret are in Vault. */
create or replace function public.telegram_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_tick_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_cron_secret');
begin
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', v_secret),
    timeout_milliseconds := 60000
  );
end;
$$;

select cron.schedule('telegram-tick', '*/5 * * * *', 'select public.telegram_tick()');

-- Old pg_net responses are cleaned by pg_net itself; old reminder keys are not needed after a week.
select cron.schedule('telegram-cleanup', '17 3 * * *',
  $$delete from public.telegram_reminders_sent where date < public.addis_today() - 7;
    delete from public.telegram_link_tokens where expires_at < now();$$);

do $$
declare f text;
begin
  foreach f in array array[
    'telegram_touch(bigint, text, text, text)', 'telegram_bump_sent(integer)', 'telegram_start_rem(bigint, integer)',
    'telegram_record_rem_tokens(bigint, integer, integer, integer)', 'telegram_stats()',
    'telegram_configure_tick(text, text)', 'telegram_tick()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
