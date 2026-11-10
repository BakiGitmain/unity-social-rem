-- ADMIN SECURITY: roles, is_admin(), profile guard, append-only audit log.
--
-- Roles live in profiles_private (NOT in public.profiles): profiles is public-read for the "username taken"
-- check, so a role column there would reveal who the admins are. profiles_private is readable only by the
-- user themself and by admins.

/* ------------------------------------------------------------ profiles_private */

create table public.profiles_private (
  id             uuid primary key references public.profiles (id) on delete cascade,
  role           text not null default 'student' check (role in ('student', 'admin')),
  last_seen_at   timestamptz,
  ai_daily_limit integer check (ai_daily_limit is null or ai_daily_limit between 0 and 1000),
  updated_at     timestamptz not null default now()
);

insert into public.profiles_private (id) select id from public.profiles on conflict do nothing;

-- Role only (no 2FA check): lets the server decide between "404" and "show the 2FA screen".
create or replace function public.has_admin_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles_private p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
$$;

-- Admin AND a 2FA (AAL2) session. Every admin RLS policy and admin function uses this.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2' and public.has_admin_role()
$$;

revoke all on function public.has_admin_role() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.has_admin_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles_private enable row level security;

create policy "Users read their own private profile, admins read all"
  on public.profiles_private for select to authenticated
  using ((select auth.uid()) = id or public.is_admin());

-- Only admins update (role, AI limit). Users never write this table directly.
create policy "Admins update private profiles"
  on public.profiles_private for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke insert, delete, truncate on public.profiles_private from anon, authenticated;

/**
 * Guard (works even if a policy is ever wrong):
 * - nobody changes their OWN role, and only admins change anyone's role or AI limit;
 * - migrations / the service role (no auth.uid()) are allowed.
 */
create or replace function public.guard_profiles_private()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    new.role := 'student';
    return new;
  end if;
  if uid is not null then
    if new.role is distinct from old.role and (new.id = uid or not public.is_admin()) then
      raise exception 'Not allowed to change this role';
    end if;
    if new.ai_daily_limit is distinct from old.ai_daily_limit and not public.is_admin() then
      raise exception 'Not allowed';
    end if;
    if new.id is distinct from old.id then
      raise exception 'Not allowed';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_private_guard
  before insert or update on public.profiles_private
  for each row execute function public.guard_profiles_private();

/* ------------------------------------------------------------ profiles */

-- Users had an "update own profile" policy, but there is nothing they may change. Admins may rename.
drop policy "Users can update their own profile" on public.profiles;
create policy "Admins update profiles"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Usernames: still immutable for everyone except admins (who also update the auth email server-side).
create or replace function public.prevent_username_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.username is distinct from old.username
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'Username cannot be changed';
  end if;
  if new.id is distinct from old.id then
    raise exception 'Not allowed';
  end if;
  return new;
end;
$$;

-- New users get a profiles_private row (role is forced to 'student' by the guard).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(trim(new.raw_user_meta_data ->> 'username'));
begin
  if v_username is null or v_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'A valid username is required';
  end if;
  insert into public.profiles (id, username) values (new.id, v_username);
  insert into public.profiles_private (id) values (new.id);
  return new;
end;
$$;

/* ------------------------------------------------------------ first admin */

update public.profiles_private pp
   set role = 'admin'
  from public.profiles p
 where p.id = pp.id and p.username = 'eyosiyas';

/* ------------------------------------------------------------ audit log (append-only) */

create table public.admin_audit_log (
  id             bigint generated always as identity primary key,
  admin_id       uuid,            -- no FK: deleting an admin must never touch the log
  admin_username text,
  action         text not null check (char_length(action) <= 80),
  target_type    text check (char_length(target_type) <= 40),
  target_id      text check (char_length(target_id) <= 200),
  before         jsonb,
  after          jsonb,
  created_at     timestamptz not null default now()
);

create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_action_idx on public.admin_audit_log (action);

alter table public.admin_audit_log enable row level security;

create policy "Admins read the audit log"
  on public.admin_audit_log for select to authenticated using (public.is_admin());

revoke insert, update, delete, truncate on public.admin_audit_log from anon, authenticated;

create or replace function public.audit_log_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The admin audit log is append-only';
end;
$$;

create trigger admin_audit_log_no_update_delete
  before update or delete on public.admin_audit_log
  for each row execute function public.audit_log_is_append_only();
create trigger admin_audit_log_no_truncate
  before truncate on public.admin_audit_log
  for each statement execute function public.audit_log_is_append_only();

/** The only way to write the log: as the signed-in admin (with 2FA). admin_id is always the caller. */
create or replace function public.log_admin_action(
  p_action text, p_target_type text, p_target_id text, p_before jsonb, p_after jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;
  insert into public.admin_audit_log (admin_id, admin_username, action, target_type, target_id, before, after)
  values (
    (select auth.uid()),
    (select username from public.profiles where id = (select auth.uid())),
    p_action, p_target_type, left(p_target_id, 200), p_before, p_after
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.log_admin_action(text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.log_admin_action(text, text, text, jsonb, jsonb) to authenticated;

/* ------------------------------------------------------------ admin-only helpers */

/** Force logout: delete a user's sessions (refresh tokens go with them). Access tokens expire within the hour. */
create or replace function public.admin_revoke_sessions(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;
  delete from auth.sessions where user_id = p_user;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.admin_revoke_sessions(uuid) from public, anon;
grant execute on function public.admin_revoke_sessions(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- LOST YOUR AUTHENTICATOR? Create a NEW migration with this line, push it, then log in and open
-- /admin to set up 2FA again:
--   delete from auth.mfa_factors where user_id = (select id from public.profiles where username = 'eyosiyas');
-- ---------------------------------------------------------------------------------------------
