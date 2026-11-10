-- 1) Profiles: one row per auth user, holding the public @username.
--    Users sign in with a username; the app maps it to <username>@users.unitysocialrem.app.

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone may read usernames (needed for the live "username taken" check).
create policy "Anyone can read profiles"
  on public.profiles for select to anon, authenticated using (true);

-- Users may update only their own row. (No insert/delete policies: rows are created by the trigger below.)
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke insert, delete, truncate on public.profiles from anon, authenticated;

-- The username is also the login name (it is baked into the auth email), so it must never change.
create function public.prevent_username_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.username is distinct from old.username then
    raise exception 'Username cannot be changed';
  end if;
  return new;
end;
$$;

create trigger profiles_username_immutable
  before update on public.profiles
  for each row execute function public.prevent_username_change();

-- Create the profile automatically when a user signs up. The username comes from the sign-up metadata.
create function public.handle_new_user()
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
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Learn mode: key-term definitions per lesson, and quick-check questions per note part.

-- [{ "term": {en, am}, "definition": {en, am} }, ...]
alter table public.lessons
  add column glossary jsonb not null default '[]'::jsonb check (jsonb_typeof(glossary) = 'array');

-- Quiz question numbers (quiz_questions.sort_order) asked as a quick check after this part.
alter table public.lesson_sections
  add column checks int[] not null default '{}';
