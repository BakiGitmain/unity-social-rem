/*
 * NOTES: a visual study board system. A board always belongs to ONE lesson and to ONE user.
 * PRIVACY: users can only see and change their OWN boards, cards, arrows, flashcards and images. There is NO admin
 * policy on these tables: admins only get counts (admin_user_notes_stats). Images: private bucket note-images,
 * one folder per user ("<user id>/…").
 * Limits (app_settings.notes, public, editable in Admin → Site settings): boards per user, cards per board,
 * image size, total image storage per user. Deleted boards go to "Recently deleted" for 30 days.
 */

insert into public.app_settings (key, value, is_public) values
  ('notes', '{"max_boards": 200, "max_cards": 1000, "image_mb": 2, "storage_mb": 100}', true)
on conflict (key) do nothing;

/* ------------------------------------------------------------ tables */

create table public.boards (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id     uuid references public.subjects (id) on delete set null,
  lesson_id      uuid not null references public.lessons (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 120),
  emoji          text not null default '📝' check (char_length(emoji) <= 16),
  colour         text not null default 'teal' check (char_length(colour) <= 20),
  template       text not null default 'blank' check (char_length(template) <= 20),
  viewport       jsonb check (viewport is null or jsonb_typeof(viewport) = 'object'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  last_opened_at timestamptz,
  deleted_at     timestamptz
);
create index boards_user_lesson_idx on public.boards (user_id, lesson_id);
create index boards_user_recent_idx on public.boards (user_id, last_opened_at desc nulls last);

create table public.board_nodes (
  id         uuid primary key,
  board_id   uuid not null references public.boards (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type       text not null check (type in ('note', 'sticky', 'quote', 'image', 'drawing', 'link', 'checklist', 'frame')),
  x          double precision not null,
  y          double precision not null,
  w          double precision not null check (w > 0 and w < 10000),
  h          double precision not null check (h > 0 and h < 10000),
  z_index    integer not null default 0,
  parent_id  uuid,
  data       jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 300000),
  updated_at timestamptz not null default now()
);
create index board_nodes_board_idx on public.board_nodes (board_id);

create table public.board_edges (
  id         uuid primary key,
  board_id   uuid not null references public.boards (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source     uuid not null,
  target     uuid not null,
  label      text check (label is null or char_length(label) <= 80),
  style      jsonb not null default '{}'::jsonb check (jsonb_typeof(style) = 'object'),
  updated_at timestamptz not null default now()
);
create index board_edges_board_idx on public.board_edges (board_id);

create table public.flashcards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  board_id   uuid not null references public.boards (id) on delete cascade,
  node_id    uuid not null,
  front      text not null check (char_length(front) between 1 and 2000),
  back       text not null default '' check (char_length(back) <= 4000),
  ease       numeric(4, 2) not null default 2.5,
  interval   integer not null default 0,
  reps       integer not null default 0,
  lapses     integer not null default 0,
  due_at     timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, node_id)
);
create index flashcards_due_idx on public.flashcards (user_id, due_at);

/* ------------------------------------------------------------ RLS: own rows only, no admin access */

alter table public.boards enable row level security;
alter table public.board_nodes enable row level security;
alter table public.board_edges enable row level security;
alter table public.flashcards enable row level security;

create policy "Own boards: read" on public.boards for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own boards: add" on public.boards for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own boards: change" on public.boards for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own boards: delete" on public.boards for delete to authenticated using ((select auth.uid()) = user_id);

/** Is this board mine? (used by the card / arrow / flashcard policies) */
create or replace function public.owns_board(p_board uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.boards b where b.id = p_board and b.user_id = (select auth.uid()))
$$;
revoke all on function public.owns_board(uuid) from public, anon;
grant execute on function public.owns_board(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['board_nodes', 'board_edges', 'flashcards'] loop
    execute format('create policy "Own %1$s: read" on public.%1$s for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "Own %1$s: add" on public.%1$s for insert to authenticated with check ((select auth.uid()) = user_id and public.owns_board(board_id))', t);
    execute format('create policy "Own %1$s: change" on public.%1$s for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and public.owns_board(board_id))', t);
    execute format('create policy "Own %1$s: delete" on public.%1$s for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

/* ------------------------------------------------------------ limits */

create or replace function public.notes_limit(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(((select value from public.app_settings where key = 'notes') ->> p_key)::integer, p_default)
$$;

create or replace function public.notes_check_board_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.boards where user_id = new.user_id and deleted_at is null) >= public.notes_limit('max_boards', 200) then
    raise exception 'Board limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger boards_limit before insert on public.boards for each row execute function public.notes_check_board_limit();

create or replace function public.notes_check_card_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.board_nodes where board_id = new.board_id) >= public.notes_limit('max_cards', 1000) then
    raise exception 'Card limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger board_nodes_limit before insert on public.board_nodes for each row execute function public.notes_check_card_limit();

/* a deleted card takes its flashcard with it */
create or replace function public.notes_node_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.flashcards where node_id = old.id and user_id = old.user_id;
  return old;
end;
$$;
create trigger board_nodes_deleted after delete on public.board_nodes for each row execute function public.notes_node_deleted();

/* ------------------------------------------------------------ images: private bucket, own folder */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-images', 'note-images', false, 2097152, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

/** Bytes of note images a user has stored. */
create or replace function public.notes_storage_used(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
    from storage.objects o
   where o.bucket_id = 'note-images' and (storage.foldername(o.name))[1] = p_user::text
$$;
revoke all on function public.notes_storage_used(uuid) from public, anon;

create or replace function public.my_notes_storage()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('used', public.notes_storage_used((select auth.uid())), 'limit', public.notes_limit('storage_mb', 100)::bigint * 1048576)
$$;
revoke all on function public.my_notes_storage() from public, anon;
grant execute on function public.my_notes_storage() to authenticated;

create policy "Own note images: read" on storage.objects for select to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own note images: upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'note-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.notes_storage_used((select auth.uid())) < public.notes_limit('storage_mb', 100)::bigint * 1048576
  );
create policy "Own note images: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

/* ------------------------------------------------------------ admin: counts only (no content) */

create or replace function public.admin_user_notes_stats(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;
  return jsonb_build_object(
    'boards', (select count(*) from public.boards where user_id = p_user and deleted_at is null),
    'cards', (select count(*) from public.board_nodes where user_id = p_user),
    'flashcards', (select count(*) from public.flashcards where user_id = p_user),
    'storage_bytes', public.notes_storage_used(p_user)
  );
end;
$$;
revoke all on function public.admin_user_notes_stats(uuid) from public, anon;
grant execute on function public.admin_user_notes_stats(uuid) to authenticated;

/* ------------------------------------------------------------ recently deleted: purge after 30 days */

create or replace function public.purge_my_deleted_boards()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  delete from public.boards where user_id = (select auth.uid()) and deleted_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_my_deleted_boards() from public, anon;
grant execute on function public.purge_my_deleted_boards() to authenticated;

/* ------------------------------------------------------------ math homework: explicit calculation flags */

update public.lessons l
   set homework = $j$[{"id":"w1","type":"written","warmup":true,"question":{"en":"Warm-up: using the drawing, find $(A \\cap B) \\setminus C$ and $(A \\cup B) \\setminus C$.","am":"ማሟሟቂያ፦ ሥዕሉን በመጠቀም $(A \\cap B) \\setminus C$ እና $(A \\cup B) \\setminus C$ን ፈልጉ።"},"tip":{"en":"First write A, B and C as sets of region numbers from the drawing.","am":"መጀመሪያ A፣ B እና Cን ከሥዕሉ በክፍል ቁጥሮች እንደ ስብስብ ጻፉ።"},"hints":[{"en":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$.","am":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$."},{"en":"Work out the inside bracket first, then the outside operation.","am":"መጀመሪያ በቅንፉ ውስጥ ያለውን ሥሩ፣ ከዚያ የውጩን ሥራ።"}],"figure":{"venn":{"sets":3,"labels":["A","B","C"],"elements":{"A":["1"],"B":["2"],"C":["3"],"AC":["4"],"AB":["5"],"BC":["6"],"ABC":["7"],"none":["8"]}},"caption":{"en":"The drawing from class: each region has a number. Tap a region to see its number.","am":"ከክፍል የተሰጠው ሥዕል፦ እያንዳንዱ ክፍል ቁጥር አለው። ቁጥሩን ለማየት ክፍሉን ንኩ።"}},"answers":[{"label":{"en":"$(A \\cap B) \\setminus C$","am":"$(A \\cap B) \\setminus C$"},"spec":{"kind":"set","value":["5"]}},{"label":{"en":"$(A \\cup B) \\setminus C$","am":"$(A \\cup B) \\setminus C$"},"spec":{"kind":"set","value":["1","2","5"]}}],"solution":{"venn":{"sets":3,"labels":["A","B","C"],"elements":{"A":["1"],"B":["2"],"C":["3"],"AC":["4"],"AB":["5"],"BC":["6"],"ABC":["7"],"none":["8"]}},"steps":[{"text":{"en":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$","am":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$"},"why":{"en":"Read each circle from the drawing: write every region number inside it.","am":"እያንዳንዱን ክበብ ከሥዕሉ አንብቡ፦ በውስጡ ያሉትን የክፍል ቁጥሮች በሙሉ ጻፉ።"}},{"text":{"en":"$A \\cap B = \\{5, 7\\}$","am":"$A \\cap B = \\{5, 7\\}$"},"why":{"en":"Numbers in BOTH A and B.","am":"በA እና በB ሁለቱም ያሉ ቁጥሮች።"},"shade":"A∩B"},{"text":{"en":"$(A \\cap B) \\setminus C = \\{5\\}$","am":"$(A \\cap B) \\setminus C = \\{5\\}$"},"why":{"en":"Remove the numbers that are also in C (7).","am":"በC ውስጥም ያሉትን ቁጥሮች (7) አስወግዱ።"},"shade":"(A∩B)∖C"},{"text":{"en":"$A \\cup B = \\{1, 2, 4, 5, 6, 7\\}$","am":"$A \\cup B = \\{1, 2, 4, 5, 6, 7\\}$"},"why":{"en":"Numbers in A OR B.","am":"በA ወይም በB ያሉ ቁጥሮች።"},"shade":"A∪B"},{"text":{"en":"$(A \\cup B) \\setminus C = \\{1, 2, 5\\}$","am":"$(A \\cup B) \\setminus C = \\{1, 2, 5\\}$"},"why":{"en":"Remove 4, 6 and 7, which are in C.","am":"በC ውስጥ ያሉትን 4፣ 6 እና 7 አስወግዱ።"},"shade":"(A∪B)∖C"}],"answer":{"en":"$(A \\cap B) \\setminus C = \\{5\\}$, $(A \\cup B) \\setminus C = \\{1, 2, 5\\}$","am":"$(A \\cap B) \\setminus C = \\{5\\}$, $(A \\cup B) \\setminus C = \\{1, 2, 5\\}$"}},"needs_calculation":true},{"id":"h1","type":"written","question":{"en":"Using the numbered drawing, show that $A \\cup (B \\cap C) = (A \\cup B) \\cap (A \\cup C)$. Find each side as a set of region numbers.","am":"በቁጥር የተሰየመውን ሥዕል በመጠቀም $A \\cup (B \\cap C) = (A \\cup B) \\cap (A \\cup C)$ መሆኑን አሳዩ። እያንዳንዱን ጎን በክፍል ቁጥሮች ስብስብ ፈልጉ።"},"tip":{"en":"First write A, B and C as sets of region numbers from the drawing.","am":"መጀመሪያ A፣ B እና Cን ከሥዕሉ በክፍል ቁጥሮች እንደ ስብስብ ጻፉ።"},"hints":[{"en":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$.","am":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$."},{"en":"Work out the inside bracket first, then the outside operation.","am":"መጀመሪያ በቅንፉ ውስጥ ያለውን ሥሩ፣ ከዚያ የውጩን ሥራ።"}],"figure":{"venn":{"sets":3,"labels":["A","B","C"],"elements":{"A":["1"],"B":["2"],"C":["3"],"AC":["4"],"AB":["5"],"BC":["6"],"ABC":["7"],"none":["8"]}},"caption":{"en":"The drawing from class: each region has a number. Tap a region to see its number.","am":"ከክፍል የተሰጠው ሥዕል፦ እያንዳንዱ ክፍል ቁጥር አለው። ቁጥሩን ለማየት ክፍሉን ንኩ።"}},"compare":[{"label":{"en":"Left side: $A \\cup (B \\cap C)$","am":"ግራ ጎን፦ $A \\cup (B \\cap C)$"},"shade":"A∪(B∩C)"},{"label":{"en":"Right side: $(A \\cup B) \\cap (A \\cup C)$","am":"ቀኝ ጎን፦ $(A \\cup B) \\cap (A \\cup C)$"},"shade":"(A∪B)∩(A∪C)"}],"answers":[{"label":{"en":"$B \\cap C$","am":"$B \\cap C$"},"group":{"en":"Left side","am":"ግራ ጎን"},"spec":{"kind":"set","value":["6","7"]}},{"label":{"en":"$A \\cup (B \\cap C)$","am":"$A \\cup (B \\cap C)$"},"group":{"en":"Left side","am":"ግራ ጎን"},"spec":{"kind":"set","value":["1","4","5","6","7"]}},{"label":{"en":"$A \\cup B$","am":"$A \\cup B$"},"group":{"en":"Right side","am":"ቀኝ ጎን"},"spec":{"kind":"set","value":["1","2","4","5","6","7"]}},{"label":{"en":"$A \\cup C$","am":"$A \\cup C$"},"group":{"en":"Right side","am":"ቀኝ ጎን"},"spec":{"kind":"set","value":["1","3","4","5","6","7"]}},{"label":{"en":"$(A \\cup B) \\cap (A \\cup C)$","am":"$(A \\cup B) \\cap (A \\cup C)$"},"group":{"en":"Right side","am":"ቀኝ ጎን"},"spec":{"kind":"set","value":["1","4","5","6","7"]}},{"label":{"en":"Left side = Right side?","am":"ግራ ጎን = ቀኝ ጎን?"},"group":{"en":"Conclusion","am":"መደምደሚያ"},"spec":{"kind":"choice","options":[{"en":"Equal ✓","am":"እኩል ናቸው ✓"},{"en":"Not equal ✗","am":"እኩል አይደሉም ✗"}],"correct":0}}],"solution":{"venn":{"sets":3,"labels":["A","B","C"],"elements":{"A":["1"],"B":["2"],"C":["3"],"AC":["4"],"AB":["5"],"BC":["6"],"ABC":["7"],"none":["8"]}},"steps":[{"text":{"en":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$","am":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$"},"why":{"en":"Read each circle from the drawing: write every region number inside it.","am":"እያንዳንዱን ክበብ ከሥዕሉ አንብቡ፦ በውስጡ ያሉትን የክፍል ቁጥሮች በሙሉ ጻፉ።"}},{"text":{"en":"$B \\cap C = \\{6, 7\\}$","am":"$B \\cap C = \\{6, 7\\}$"},"why":{"en":"Left side, bracket first: numbers in both B and C.","am":"ግራ ጎን፣ መጀመሪያ ቅንፍ፦ በB እና በC ሁለቱም ያሉ ቁጥሮች።"},"shade":"B∩C"},{"text":{"en":"$A \\cup (B \\cap C) = \\{1, 4, 5, 6, 7\\}$","am":"$A \\cup (B \\cap C) = \\{1, 4, 5, 6, 7\\}$"},"why":{"en":"Add every number of A: 1, 4, 5, 7.","am":"የAን ቁጥሮች በሙሉ ጨምሩ፦ 1፣ 4፣ 5፣ 7።"},"shade":"A∪(B∩C)"},{"text":{"en":"$A \\cup B = \\{1, 2, 4, 5, 6, 7\\}$","am":"$A \\cup B = \\{1, 2, 4, 5, 6, 7\\}$"},"why":{"en":"Right side: everything in A or B.","am":"ቀኝ ጎን፦ በA ወይም በB ያለ ሁሉ።"},"shade":"A∪B"},{"text":{"en":"$A \\cup C = \\{1, 3, 4, 5, 6, 7\\}$","am":"$A \\cup C = \\{1, 3, 4, 5, 6, 7\\}$"},"why":{"en":"Everything in A or C.","am":"በA ወይም በC ያለ ሁሉ።"},"shade":"A∪C"},{"text":{"en":"$(A \\cup B) \\cap (A \\cup C) = \\{1, 4, 5, 6, 7\\}$","am":"$(A \\cup B) \\cap (A \\cup C) = \\{1, 4, 5, 6, 7\\}$"},"why":{"en":"Keep the numbers that are in BOTH lists.","am":"በሁለቱም ዝርዝሮች ያሉትን ቁጥሮች ያዙ።"},"shade":"(A∪B)∩(A∪C)"},{"text":{"en":"Both sides are $\\{1, 4, 5, 6, 7\\}$, so they are equal ✓","am":"ሁለቱም ጎኖች $\\{1, 4, 5, 6, 7\\}$ ናቸው፤ ስለዚህ እኩል ናቸው ✓"},"why":{"en":"Two sets with exactly the same elements are equal.","am":"በትክክል አንድ ዓይነት አባላት ያሏቸው ሁለት ስብስቦች እኩል ናቸው።"},"shade":"A∪(B∩C)"}],"answer":{"en":"$A \\cup (B \\cap C) = (A \\cup B) \\cap (A \\cup C) = \\{1, 4, 5, 6, 7\\}$","am":"$A \\cup (B \\cap C) = (A \\cup B) \\cap (A \\cup C) = \\{1, 4, 5, 6, 7\\}$"}},"needs_calculation":true},{"id":"h2","type":"written","question":{"en":"Using the numbered drawing, show that $A - (B \\cup C) = (A - B) \\cap (A - C)$, the same as $A \\setminus (B \\cup C) = (A \\setminus B) \\cap (A \\setminus C)$. Find each side as a set of region numbers.","am":"በቁጥር የተሰየመውን ሥዕል በመጠቀም $A - (B \\cup C) = (A - B) \\cap (A - C)$ መሆኑን አሳዩ፤ ይህም $A \\setminus (B \\cup C) = (A \\setminus B) \\cap (A \\setminus C)$ ማለት ነው። እያንዳንዱን ጎን በክፍል ቁጥሮች ስብስብ ፈልጉ።"},"tip":{"en":"First write A, B and C as sets of region numbers from the drawing.","am":"መጀመሪያ A፣ B እና Cን ከሥዕሉ በክፍል ቁጥሮች እንደ ስብስብ ጻፉ።"},"hints":[{"en":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$.","am":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$."},{"en":"Work out the inside bracket first, then the outside operation.","am":"መጀመሪያ በቅንፉ ውስጥ ያለውን ሥሩ፣ ከዚያ የውጩን ሥራ።"}],"figure":{"venn":{"sets":3,"labels":["A","B","C"],"elements":{"A":["1"],"B":["2"],"C":["3"],"AC":["4"],"AB":["5"],"BC":["6"],"ABC":["7"],"none":["8"]}},"caption":{"en":"The drawing from class: each region has a number. Tap a region to see its number.","am":"ከክፍል የተሰጠው ሥዕል፦ እያንዳንዱ ክፍል ቁጥር አለው። ቁጥሩን ለማየት ክፍሉን ንኩ።"}},"compare":[{"label":{"en":"Left side: $A \\setminus (B \\cup C)$","am":"ግራ ጎን፦ $A \\setminus (B \\cup C)$"},"shade":"A∖(B∪C)"},{"label":{"en":"Right side: $(A \\setminus B) \\cap (A \\setminus C)$","am":"ቀኝ ጎን፦ $(A \\setminus B) \\cap (A \\setminus C)$"},"shade":"(A∖B)∩(A∖C)"}],"answers":[{"label":{"en":"$B \\cup C$","am":"$B \\cup C$"},"group":{"en":"Left side","am":"ግራ ጎን"},"spec":{"kind":"set","value":["2","3","4","5","6","7"]}},{"label":{"en":"$A \\setminus (B \\cup C)$","am":"$A \\setminus (B \\cup C)$"},"group":{"en":"Left side","am":"ግራ ጎን"},"spec":{"kind":"set","value":["1"]}},{"label":{"en":"$A \\setminus B$","am":"$A \\setminus B$"},"group":{"en":"Right side","am":"ቀኝ ጎን"},"spec":{"kind":"set","value":["1","4"]}},{"label":{"en":"$A \\setminus C$","am":"$A \\setminus C$"},"group":{"en":"Right side","am":"ቀኝ ጎን"},"spec":{"kind":"set","value":["1","5"]}},{"label":{"en":"$(A \\setminus B) \\cap (A \\setminus C)$","am":"$(A \\setminus B) \\cap (A \\setminus C)$"},"group":{"en":"Right side","am":"ቀኝ ጎን"},"spec":{"kind":"set","value":["1"]}},{"label":{"en":"Left side = Right side?","am":"ግራ ጎን = ቀኝ ጎን?"},"group":{"en":"Conclusion","am":"መደምደሚያ"},"spec":{"kind":"choice","options":[{"en":"Equal ✓","am":"እኩል ናቸው ✓"},{"en":"Not equal ✗","am":"እኩል አይደሉም ✗"}],"correct":0}}],"solution":{"venn":{"sets":3,"labels":["A","B","C"],"elements":{"A":["1"],"B":["2"],"C":["3"],"AC":["4"],"AB":["5"],"BC":["6"],"ABC":["7"],"none":["8"]}},"steps":[{"text":{"en":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$","am":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$"},"why":{"en":"Read each circle from the drawing: write every region number inside it.","am":"እያንዳንዱን ክበብ ከሥዕሉ አንብቡ፦ በውስጡ ያሉትን የክፍል ቁጥሮች በሙሉ ጻፉ።"}},{"text":{"en":"$B \\cup C = \\{2, 3, 4, 5, 6, 7\\}$","am":"$B \\cup C = \\{2, 3, 4, 5, 6, 7\\}$"},"why":{"en":"Left side, bracket first: everything in B or C.","am":"ግራ ጎን፣ መጀመሪያ ቅንፍ፦ በB ወይም በC ያለ ሁሉ።"},"shade":"B∪C"},{"text":{"en":"$A \\setminus (B \\cup C) = \\{1\\}$","am":"$A \\setminus (B \\cup C) = \\{1\\}$"},"why":{"en":"From A = {1, 4, 5, 7} remove every number of $B \\cup C$.","am":"ከA = {1, 4, 5, 7} የ$B \\cup C$ን ቁጥሮች በሙሉ አስወግዱ።"},"shade":"A∖(B∪C)"},{"text":{"en":"$A \\setminus B = \\{1, 4\\}$","am":"$A \\setminus B = \\{1, 4\\}$"},"why":{"en":"Right side: A without 5 and 7 (they are in B).","am":"ቀኝ ጎን፦ ያለ 5 እና 7 ያለው A (በB ውስጥ ናቸው)።"},"shade":"A∖B"},{"text":{"en":"$A \\setminus C = \\{1, 5\\}$","am":"$A \\setminus C = \\{1, 5\\}$"},"why":{"en":"A without 4 and 7 (they are in C).","am":"ያለ 4 እና 7 ያለው A (በC ውስጥ ናቸው)።"},"shade":"A∖C"},{"text":{"en":"$(A \\setminus B) \\cap (A \\setminus C) = \\{1\\}$","am":"$(A \\setminus B) \\cap (A \\setminus C) = \\{1\\}$"},"why":{"en":"Only 1 is in both lists.","am":"በሁለቱም ዝርዝሮች ያለው 1 ብቻ ነው።"},"shade":"(A∖B)∩(A∖C)"},{"text":{"en":"Both sides are $\\{1\\}$, so they are equal ✓","am":"ሁለቱም ጎኖች $\\{1\\}$ ናቸው፤ ስለዚህ እኩል ናቸው ✓"},"why":{"en":"$A - B$ and $A \\setminus B$ are two ways to write the same thing.","am":"$A - B$ እና $A \\setminus B$ አንድን ነገር የሚጽፉባቸው ሁለት መንገዶች ናቸው።"},"shade":"A∖(B∪C)"}],"answer":{"en":"$A - (B \\cup C) = (A - B) \\cap (A - C) = \\{1\\}$","am":"$A - (B \\cup C) = (A - B) \\cap (A - C) = \\{1\\}$"}},"needs_calculation":true},{"id":"h3","type":"written","question":{"en":"Using the numbered drawing, show that $A \\setminus B = A \\setminus (A \\cap B)$, the same as $A - B = A - (A \\cap B)$. Find each side as a set of region numbers.","am":"በቁጥር የተሰየመውን ሥዕል በመጠቀም $A \\setminus B = A \\setminus (A \\cap B)$ መሆኑን አሳዩ፤ ይህም $A - B = A - (A \\cap B)$ ማለት ነው። እያንዳንዱን ጎን በክፍል ቁጥሮች ስብስብ ፈልጉ።"},"tip":{"en":"First write A, B and C as sets of region numbers from the drawing.","am":"መጀመሪያ A፣ B እና Cን ከሥዕሉ በክፍል ቁጥሮች እንደ ስብስብ ጻፉ።"},"hints":[{"en":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$.","am":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$."},{"en":"Work out the inside bracket first, then the outside operation.","am":"መጀመሪያ በቅንፉ ውስጥ ያለውን ሥሩ፣ ከዚያ የውጩን ሥራ።"}],"figure":{"venn":{"sets":3,"labels":["A","B","C"],"elements":{"A":["1"],"B":["2"],"C":["3"],"AC":["4"],"AB":["5"],"BC":["6"],"ABC":["7"],"none":["8"]}},"caption":{"en":"The drawing from class: each region has a number. Tap a region to see its number.","am":"ከክፍል የተሰጠው ሥዕል፦ እያንዳንዱ ክፍል ቁጥር አለው። ቁጥሩን ለማየት ክፍሉን ንኩ።"}},"compare":[{"label":{"en":"Left side: $A \\setminus B$","am":"ግራ ጎን፦ $A \\setminus B$"},"shade":"A∖B"},{"label":{"en":"Right side: $A \\setminus (A \\cap B)$","am":"ቀኝ ጎን፦ $A \\setminus (A \\cap B)$"},"shade":"A∖(A∩B)"}],"answers":[{"label":{"en":"$A \\setminus B$","am":"$A \\setminus B$"},"group":{"en":"Left side","am":"ግራ ጎን"},"spec":{"kind":"set","value":["1","4"]}},{"label":{"en":"$A \\cap B$","am":"$A \\cap B$"},"group":{"en":"Right side","am":"ቀኝ ጎን"},"spec":{"kind":"set","value":["5","7"]}},{"label":{"en":"$A \\setminus (A \\cap B)$","am":"$A \\setminus (A \\cap B)$"},"group":{"en":"Right side","am":"ቀኝ ጎን"},"spec":{"kind":"set","value":["1","4"]}},{"label":{"en":"Left side = Right side?","am":"ግራ ጎን = ቀኝ ጎን?"},"group":{"en":"Conclusion","am":"መደምደሚያ"},"spec":{"kind":"choice","options":[{"en":"Equal ✓","am":"እኩል ናቸው ✓"},{"en":"Not equal ✗","am":"እኩል አይደሉም ✗"}],"correct":0}}],"solution":{"venn":{"sets":3,"labels":["A","B","C"],"elements":{"A":["1"],"B":["2"],"C":["3"],"AC":["4"],"AB":["5"],"BC":["6"],"ABC":["7"],"none":["8"]}},"steps":[{"text":{"en":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$","am":"$A = \\{1, 4, 5, 7\\}$, $B = \\{2, 5, 6, 7\\}$, $C = \\{3, 4, 6, 7\\}$"},"why":{"en":"Read each circle from the drawing: write every region number inside it.","am":"እያንዳንዱን ክበብ ከሥዕሉ አንብቡ፦ በውስጡ ያሉትን የክፍል ቁጥሮች በሙሉ ጻፉ።"}},{"text":{"en":"$A \\setminus B = \\{1, 4\\}$","am":"$A \\setminus B = \\{1, 4\\}$"},"why":{"en":"Left side: A without the numbers that are in B (5 and 7).","am":"ግራ ጎን፦ በB ውስጥ ያሉት ቁጥሮች (5 እና 7) የሌሉበት A።"},"shade":"A∖B"},{"text":{"en":"$A \\cap B = \\{5, 7\\}$","am":"$A \\cap B = \\{5, 7\\}$"},"why":{"en":"Right side, bracket first: numbers in both A and B.","am":"ቀኝ ጎን፣ መጀመሪያ ቅንፍ፦ በA እና በB ሁለቱም ያሉ ቁጥሮች።"},"shade":"A∩B"},{"text":{"en":"$A \\setminus (A \\cap B) = \\{1, 4\\}$","am":"$A \\setminus (A \\cap B) = \\{1, 4\\}$"},"why":{"en":"From A remove 5 and 7.","am":"ከA 5 እና 7ን አስወግዱ።"},"shade":"A∖(A∩B)"},{"text":{"en":"Both sides are $\\{1, 4\\}$, so they are equal ✓","am":"ሁለቱም ጎኖች $\\{1, 4\\}$ ናቸው፤ ስለዚህ እኩል ናቸው ✓"},"why":{"en":"Removing B from A only removes the part of B inside A, which is $A \\cap B$.","am":"Bን ከA ማስወገድ በA ውስጥ ያለውን የB ክፍል ብቻ ያስወግዳል፤ ይህም $A \\cap B$ ነው።"},"shade":"A∖B"}],"answer":{"en":"$A \\setminus B = A \\setminus (A \\cap B) = \\{1, 4\\}$","am":"$A \\setminus B = A \\setminus (A \\cap B) = \\{1, 4\\}$"}},"needs_calculation":true},{"id":"h4","type":"choice","question":{"en":"Exam question: For sets A, B and C, if $A \\cup C = \\{x \\in \\mathbb{Z} \\mid -3 < x < 3\\}$ and $B \\cup C = \\{x \\in \\mathbb{R} \\mid x^3 = x\\}$, then $(A \\cap B) \\cup C$ is equal to:","am":"የፈተና ጥያቄ፦ ለስብስቦች A፣ B እና C፣ $A \\cup C = \\{x \\in \\mathbb{Z} \\mid -3 < x < 3\\}$ እና $B \\cup C = \\{x \\in \\mathbb{R} \\mid x^3 = x\\}$ ከሆኑ፣ $(A \\cap B) \\cup C$ ከምን ጋር እኩል ነው?"},"tip":{"en":"Use the distributive law: $(A \\cap B) \\cup C = (A \\cup C) \\cap (B \\cup C)$. Then you only need the two sets you are given.","am":"የማሰራጨት ሕግን ተጠቀሙ፦ $(A \\cap B) \\cup C = (A \\cup C) \\cap (B \\cup C)$። ከዚያ የተሰጡትን ሁለት ስብስቦች ብቻ ትፈልጋላችሁ።"},"hints":[{"en":"List $A \\cup C$: the integers between −3 and 3 (not including them).","am":"$A \\cup C$ን ዘርዝሩ፦ በ−3 እና በ3 መካከል ያሉ ኢንቲጀሮች (እነሱን ሳይጨምር)።"},{"en":"Solve $x^3 = x$ by factoring: $x(x - 1)(x + 1) = 0$.","am":"$x^3 = x$ን በመፍታት ፈቱ፦ $x(x - 1)(x + 1) = 0$።"}],"answers":[{"label":{"en":"Choose the answer","am":"መልሱን ምረጡ"},"spec":{"kind":"choice","options":[{"en":"$\\{0, 1, 2\\}$","am":"$\\{0, 1, 2\\}$"},{"en":"$\\{-1, 0, 1\\}$","am":"$\\{-1, 0, 1\\}$"},{"en":"$\\{-2, -1, 0, 1, 2\\}$","am":"$\\{-2, -1, 0, 1, 2\\}$"},{"en":"$\\{0\\}$","am":"$\\{0\\}$"}],"correct":1}}],"solution":{"steps":[{"text":{"en":"$A \\cup C = \\{-2, -1, 0, 1, 2\\}$","am":"$A \\cup C = \\{-2, -1, 0, 1, 2\\}$"},"why":{"en":"Integers strictly between −3 and 3.","am":"በ−3 እና በ3 መካከል ብቻ ያሉ ኢንቲጀሮች።"}},{"text":{"en":"$x^3 = x \\Rightarrow x^3 - x = 0$","am":"$x^3 = x \\Rightarrow x^3 - x = 0$"},"why":{"en":"Move everything to one side so we can factor.","am":"ለመፍታት ሁሉንም ወደ አንድ ጎን አምጡ።"}},{"text":{"en":"$x(x^2 - 1) = 0 \\Rightarrow x(x - 1)(x + 1) = 0$","am":"$x(x^2 - 1) = 0 \\Rightarrow x(x - 1)(x + 1) = 0$"},"why":{"en":"Take out x, then $x^2 - 1$ is a difference of squares.","am":"xን አውጡ፣ ከዚያ $x^2 - 1$ የካሬዎች ልዩነት ነው።"}},{"text":{"en":"$x = 0,\\ 1,\\ -1$, so $B \\cup C = \\{-1, 0, 1\\}$","am":"$x = 0,\\ 1,\\ -1$፤ ስለዚህ $B \\cup C = \\{-1, 0, 1\\}$"},"why":{"en":"A product is 0 when one factor is 0.","am":"ብዜት 0 የሚሆነው አንዱ ተባዥ 0 ሲሆን ነው።"}},{"text":{"en":"$(A \\cap B) \\cup C = (A \\cup C) \\cap (B \\cup C)$","am":"$(A \\cap B) \\cup C = (A \\cup C) \\cap (B \\cup C)$"},"why":{"en":"Distributive law: union distributes over intersection.","am":"የማሰራጨት ሕግ፦ ውህደት በመገናኛ ላይ ይሰራጫል።"}},{"text":{"en":"$= \\{-2, -1, 0, 1, 2\\} \\cap \\{-1, 0, 1\\} = \\{-1, 0, 1\\}$","am":"$= \\{-2, -1, 0, 1, 2\\} \\cap \\{-1, 0, 1\\} = \\{-1, 0, 1\\}$"},"why":{"en":"Keep the elements that are in both sets.","am":"በሁለቱም ስብስቦች ያሉትን አባላት ያዙ።"}}],"answer":{"en":"b) $\\{-1, 0, 1\\}$","am":"ለ) $\\{-1, 0, 1\\}$"}},"needs_calculation":true},{"id":"h5","type":"choice","question":{"en":"Exam question: In a group of 40 boys, 28 like football while 18 like basketball. If 3 boys like neither of the games, then the number of boys who like both games is:","am":"የፈተና ጥያቄ፦ በ40 ወንዶች ቡድን ውስጥ 28ቱ እግር ኳስ፣ 18ቱ ቅርጫት ኳስ ይወዳሉ። 3 ወንዶች ሁለቱንም ጨዋታ ካልወደዱ፣ ሁለቱንም ጨዋታ የሚወዱ ወንዶች ቁጥር ስንት ነው?"},"tip":{"en":"First find how many like at least one game, then use $n(F \\cup B) = n(F) + n(B) - n(F \\cap B)$.","am":"መጀመሪያ ቢያንስ አንዱን ጨዋታ የሚወዱትን ፈልጉ፣ ከዚያ $n(F \\cup B) = n(F) + n(B) - n(F \\cap B)$ን ተጠቀሙ።"},"hints":[{"en":"Boys who like at least one game: $40 - 3$.","am":"ቢያንስ አንዱን ጨዋታ የሚወዱ፦ $40 - 3$።"},{"en":"$37 = 28 + 18 - x$. Solve for x.","am":"$37 = 28 + 18 - x$። xን ፈልጉ።"}],"answers":[{"label":{"en":"Choose the answer","am":"መልሱን ምረጡ"},"spec":{"kind":"choice","options":[{"en":"4","am":"4"},{"en":"6","am":"6"},{"en":"9","am":"9"},{"en":"12","am":"12"}],"correct":2}}],"solution":{"venn":{"sets":2,"labels":["F","B"],"elements":{"A":["19"],"AB":["9"],"B":["9"],"none":["3"]}},"steps":[{"text":{"en":"$n(F \\cup B) = 40 - 3 = 37$","am":"$n(F \\cup B) = 40 - 3 = 37$"},"why":{"en":"Everyone except the 3 who like neither game.","am":"ሁለቱንም ከማይወዱት 3 በስተቀር ሁሉም።"},"shade":"F∪B"},{"text":{"en":"$n(F \\cup B) = n(F) + n(B) - n(F \\cap B)$","am":"$n(F \\cup B) = n(F) + n(B) - n(F \\cap B)$"},"why":{"en":"Adding F and B counts the boys in both twice, so subtract them once.","am":"Fን እና Bን መደመር በሁለቱም ያሉትን ሁለት ጊዜ ይቆጥራል፤ ስለዚህ አንድ ጊዜ ቀንሱ።"}},{"text":{"en":"$37 = 28 + 18 - x = 46 - x$","am":"$37 = 28 + 18 - x = 46 - x$"},"why":{"en":"Put in the numbers, with x = boys who like both.","am":"ቁጥሮቹን አስገቡ፤ x = ሁለቱንም የሚወዱ።"}},{"text":{"en":"$x = 46 - 37 = 9$","am":"$x = 46 - 37 = 9$"},"why":{"en":"Move x to one side.","am":"xን ወደ አንድ ጎን አምጡ።"},"shade":"F∩B"},{"text":{"en":"Check: only football $28 - 9 = 19$, both 9, only basketball $18 - 9 = 9$, neither 3. $19 + 9 + 9 + 3 = 40$ ✓","am":"ማረጋገጫ፦ እግር ኳስ ብቻ $28 - 9 = 19$፣ ሁለቱም 9፣ ቅርጫት ኳስ ብቻ $18 - 9 = 9$፣ ምንም 3። $19 + 9 + 9 + 3 = 40$ ✓"},"why":{"en":"The four regions of the Venn diagram must add up to all 40 boys.","am":"የቬን ዲያግራሙ አራቱ ክፍሎች ሁሉንም 40 ወንዶች መሆን አለባቸው።"},"shade":"U"}],"answer":{"en":"c) 9","am":"ሐ) 9"}},"needs_calculation":true}]$j$::jsonb,
       practice = $j$[{"id":"hw1","question":{"en":"Describe $\\{2, 4, 6, 8, 10\\}$ using set-builder notation.","am":"$\\{2, 4, 6, 8, 10\\}$ን በስብስብ መገንቢያ ግለጹ።"},"tip":{"en":"Find the rule: they are even natural numbers up to 10.","am":"ሕጉን ፈልጉ፦ እስከ 10 ያሉ ሙሉ ጥንድ የተፈጥሮ ቁጥሮች ናቸው።"},"hints":[{"en":"Every element is $2 \\times$ something.","am":"እያንዳንዱ አባል $2 \\times$ የሆነ ነገር ነው።"},{"en":"Try $x = 2k$ where $k \\in \\mathbb{N}$ and $k \\le 5$.","am":"$x = 2k$ ሞክሩ፤ $k \\in \\mathbb{N}$ እና $k \\le 5$።"}],"answers":[],"solution":{"steps":[{"text":{"en":"Look for the pattern: $2, 4, 6, 8, 10$ are $2\\times1, 2\\times2, \\dots, 2\\times5$.","am":"ቅደም ተከተሉን ፈልጉ፦ $2, 4, 6, 8, 10$ $2\\times1, 2\\times2, \\dots, 2\\times5$ ናቸው።"},"why":{"en":"Set-builder needs the RULE, so find what all the elements have in common.","am":"የስብስብ መገንቢያ ሕጉን ይፈልጋል፤ ስለዚህ የሁሉም አባላት የጋራ ባሕርይ ፈልጉ።"}},{"text":{"en":"Write the rule with $k$: $x = 2k$, $k \\in \\mathbb{N}$, $k \\le 5$.","am":"ሕጉን በ$k$ ጻፉ፦ $x = 2k$፣ $k \\in \\mathbb{N}$፣ $k \\le 5$።"},"why":{"en":"$k$ counts from 1 to 5, which gives exactly our five numbers.","am":"$k$ ከ1 እስከ 5 ይቆጥራል፤ ይህም በትክክል አምስቱን ቁጥሮቻችንን ይሰጣል።"}}],"answer":{"en":"$\\{x \\mid x = 2k,\\ k \\in \\mathbb{N},\\ k \\le 5\\}$ or $\\{x \\mid x \\text{ is an even natural number and } x \\le 10\\}$","am":"$\\{x \\mid x = 2k,\\ k \\in \\mathbb{N},\\ k \\le 5\\}$ ወይም $\\{x \\mid x \\text{ ሙሉ ጥንድ የተፈጥሮ ቁጥር እና } x \\le 10\\}$"}},"needs_calculation":false},{"id":"hw2","question":{"en":"Let $A = \\{a, b, c, d\\}$. (i) How many subsets does A have? (ii) How many proper subsets?","am":"$A = \\{a, b, c, d\\}$ ይሁን። (i) A ስንት ንዑስ ስብስቦች አሉት? (ii) ስንት ትክክለኛ ንዑስ ስብስቦች?"},"tip":{"en":"Use $2^n$ and $2^n - 1$ with $n = n(A)$.","am":"$2^n$ እና $2^n - 1$ን በ$n = n(A)$ ተጠቀሙ።"},"hints":[{"en":"First count: $n(A) = 4$.","am":"መጀመሪያ ቁጠሩ፦ $n(A) = 4$።"},{"en":"$2^4 = 2 \\times 2 \\times 2 \\times 2$.","am":"$2^4 = 2 \\times 2 \\times 2 \\times 2$."}],"answers":[{"label":{"en":"(i) subsets","am":"(i) ንዑስ ስብስቦች"},"spec":{"kind":"number","value":16}},{"label":{"en":"(ii) proper subsets","am":"(ii) ትክክለኛ ንዑስ ስብስቦች"},"spec":{"kind":"number","value":15}}],"solution":{"steps":[{"text":{"en":"$n(A) = 4$","am":"$n(A) = 4$"},"why":{"en":"A has 4 elements: a, b, c, d.","am":"A 4 አባላት አሉት፦ a፣ b፣ c፣ d።"}},{"text":{"en":"Subsets $= 2^4 = 16$","am":"ንዑስ ስብስቦች $= 2^4 = 16$"},"why":{"en":"Each element is either in a subset or not: 2 choices, 4 times.","am":"እያንዳንዱ አባል በንዑስ ስብስቡ ውስጥ አለ ወይም የለም፦ 2 ምርጫዎች፣ 4 ጊዜ።"}},{"text":{"en":"Proper subsets $= 16 - 1 = 15$","am":"ትክክለኛ ንዑስ ስብስቦች $= 16 - 1 = 15$"},"why":{"en":"All subsets except A itself.","am":"ከA ራሱ በስተቀር ሁሉም ንዑስ ስብስቦች።"}}],"answer":{"en":"(i) 16 (ii) 15","am":"(i) 16 (ii) 15"}},"needs_calculation":true},{"id":"hw3","question":{"en":"Let $U = \\{1, 2, \\dots, 10\\}$, $A$ = even numbers in U, $B$ = multiples of 3 in U. Find $A \\cup B$, $A \\cap B$, $A'$, $A \\setminus B$ and $A \\,\\Delta\\, B$.","am":"$U = \\{1, 2, \\dots, 10\\}$፣ $A$ = በU ውስጥ ያሉ ጥንድ ቁጥሮች፣ $B$ = በU ውስጥ ያሉ የ3 ብዜቶች ይሁኑ። $A \\cup B$፣ $A \\cap B$፣ $A'$፣ $A \\setminus B$ እና $A \\,\\Delta\\, B$ን ፈልጉ።"},"tip":{"en":"First list A and B. Then place each number in a Venn diagram.","am":"መጀመሪያ Aን እና Bን ዘርዝሩ። ከዚያ እያንዳንዱን ቁጥር በቬን ዲያግራም ውስጥ አስቀምጡ።"},"hints":[{"en":"$A = \\{2, 4, 6, 8, 10\\}$ and $B = \\{3, 6, 9\\}$.","am":"$A = \\{2, 4, 6, 8, 10\\}$ እና $B = \\{3, 6, 9\\}$።"},{"en":"Only 6 is in both; 1, 5, 7 are in neither.","am":"በሁለቱም ያለው 6 ብቻ ነው፤ 1፣ 5፣ 7 በምንም ውስጥ የሉም።"}],"answers":[{"label":{"en":"$A \\cup B$","am":"$A \\cup B$"},"spec":{"kind":"set","value":["2","3","4","6","8","9","10"]}},{"label":{"en":"$A \\cap B$","am":"$A \\cap B$"},"spec":{"kind":"set","value":["6"]}},{"label":{"en":"$A'$","am":"$A'$"},"spec":{"kind":"set","value":["1","3","5","7","9"]}},{"label":{"en":"$A \\setminus B$","am":"$A \\setminus B$"},"spec":{"kind":"set","value":["2","4","8","10"]}},{"label":{"en":"$A \\,\\Delta\\, B$","am":"$A \\,\\Delta\\, B$"},"spec":{"kind":"set","value":["2","3","4","8","9","10"]}}],"solution":{"venn":{"sets":2,"labels":["A","B"],"elements":{"A":["2","4","8","10"],"AB":["6"],"B":["3","9"],"none":["1","5","7"]}},"steps":[{"text":{"en":"$A = \\{2, 4, 6, 8, 10\\}$, $B = \\{3, 6, 9\\}$","am":"$A = \\{2, 4, 6, 8, 10\\}$, $B = \\{3, 6, 9\\}$"},"why":{"en":"List both sets before doing any operation.","am":"ማንኛውንም ስሌት ከመሥራታችሁ በፊት ሁለቱንም ስብስቦች ዘርዝሩ።"}},{"text":{"en":"$A \\cup B = \\{2, 3, 4, 6, 8, 9, 10\\}$","am":"$A \\cup B = \\{2, 3, 4, 6, 8, 9, 10\\}$"},"why":{"en":"Join them; write 6 only once.","am":"አንድ አድርጓቸው፤ 6ን አንድ ጊዜ ብቻ ጻፉ።"},"shade":"A∪B"},{"text":{"en":"$A \\cap B = \\{6\\}$","am":"$A \\cap B = \\{6\\}$"},"why":{"en":"6 is the only even multiple of 3 up to 10.","am":"እስከ 10 ያለ ብቸኛ ጥንድ የ3 ብዜት 6 ነው።"},"shade":"A∩B"},{"text":{"en":"$A' = \\{1, 3, 5, 7, 9\\}$","am":"$A' = \\{1, 3, 5, 7, 9\\}$"},"why":{"en":"Everything in U that is not even.","am":"በU ውስጥ ጥንድ ያልሆነ ሁሉ።"},"shade":"A′"},{"text":{"en":"$A \\setminus B = \\{2, 4, 8, 10\\}$","am":"$A \\setminus B = \\{2, 4, 8, 10\\}$"},"why":{"en":"A without 6.","am":"A ያለ 6።"},"shade":"A∖B"},{"text":{"en":"$B \\setminus A = \\{3, 9\\}$, so $A \\,\\Delta\\, B = \\{2, 3, 4, 8, 9, 10\\}$","am":"$B \\setminus A = \\{3, 9\\}$፣ ስለዚህ $A \\,\\Delta\\, B = \\{2, 3, 4, 8, 9, 10\\}$"},"why":{"en":"Join the two differences.","am":"ሁለቱን ልዩነቶች አንድ አድርጉ።"},"shade":"AΔB"}],"answer":{"en":"$\\{2,3,4,6,8,9,10\\}$, $\\{6\\}$, $\\{1,3,5,7,9\\}$, $\\{2,4,8,10\\}$, $\\{2,3,4,8,9,10\\}$","am":"$\\{2,3,4,6,8,9,10\\}$, $\\{6\\}$, $\\{1,3,5,7,9\\}$, $\\{2,4,8,10\\}$, $\\{2,3,4,8,9,10\\}$"}},"needs_calculation":true},{"id":"hw4","question":{"en":"Using the sets in Question 3, verify that $(A \\cap B)' = A' \\cup B'$.","am":"በጥያቄ 3 ያሉትን ስብስቦች በመጠቀም $(A \\cap B)' = A' \\cup B'$ መሆኑን አረጋግጡ።"},"tip":{"en":"Work out the left side and the right side separately, then compare.","am":"የግራውንና የቀኙን ጎን ለየብቻ ሥሩ፣ ከዚያ አወዳድሩ።"},"hints":[{"en":"Left: $A \\cap B = \\{6\\}$, so take everything in U except 6.","am":"ግራ፦ $A \\cap B = \\{6\\}$፤ ስለዚህ ከ6 በስተቀር በU ያለውን ሁሉ ውሰዱ።"},{"en":"Right: $B' = \\{1, 2, 4, 5, 7, 8, 10\\}$; join it with $A'$.","am":"ቀኝ፦ $B' = \\{1, 2, 4, 5, 7, 8, 10\\}$፤ ከ$A'$ ጋር አንድ አድርጉት።"}],"answers":[{"label":{"en":"$(A \\cap B)'$","am":"$(A \\cap B)'$"},"spec":{"kind":"set","value":["1","2","3","4","5","7","8","9","10"]}}],"solution":{"venn":{"sets":2,"labels":["A","B"],"elements":{"A":["2","4","8","10"],"AB":["6"],"B":["3","9"],"none":["1","5","7"]}},"steps":[{"text":{"en":"Left: $(A \\cap B)' = U \\setminus \\{6\\} = \\{1,2,3,4,5,7,8,9,10\\}$","am":"ግራ፦ $(A \\cap B)' = U \\setminus \\{6\\} = \\{1,2,3,4,5,7,8,9,10\\}$"},"why":{"en":"The complement of $\\{6\\}$ is everything else in U.","am":"የ$\\{6\\}$ ማሟያ በU ውስጥ ያለው ሌላው ሁሉ ነው።"},"shade":"(A∩B)′"},{"text":{"en":"Right: $A' = \\{1,3,5,7,9\\}$, $B' = \\{1,2,4,5,7,8,10\\}$","am":"ቀኝ፦ $A' = \\{1,3,5,7,9\\}$፣ $B' = \\{1,2,4,5,7,8,10\\}$"},"why":{"en":"Find each complement from U.","am":"እያንዳንዱን ማሟያ ከU ፈልጉ።"}},{"text":{"en":"$A' \\cup B' = \\{1,2,3,4,5,7,8,9,10\\}$","am":"$A' \\cup B' = \\{1,2,3,4,5,7,8,9,10\\}$"},"why":{"en":"Join them: every number except 6.","am":"አንድ አድርጓቸው፦ ከ6 በስተቀር ሁሉም ቁጥሮች።"},"shade":"A′∪B′"}],"answer":{"en":"Left $=$ Right $= \\{1,2,3,4,5,7,8,9,10\\}$ ✓","am":"ግራ $=$ ቀኝ $= \\{1,2,3,4,5,7,8,9,10\\}$ ✓"}},"needs_calculation":true},{"id":"hw5","question":{"en":"Using Venn diagrams, show that $A \\cap (B \\cup C) = (A \\cap B) \\cup (A \\cap C)$. Shade the left side and the right side: they must match.","am":"በቬን ዲያግራም $A \\cap (B \\cup C) = (A \\cap B) \\cup (A \\cap C)$ መሆኑን አሳዩ። ግራውንና ቀኙን ጎን አጥሉ፤ አንድ ዓይነት መሆን አለባቸው።"},"tip":{"en":"Shade $B \\cup C$ first, then keep only the part inside A.","am":"መጀመሪያ $B \\cup C$ን አጥሉ፣ ከዚያ በA ውስጥ ያለውን ክፍል ብቻ ያዙ።"},"hints":[{"en":"$B \\cup C$ is everything inside circle B or circle C.","am":"$B \\cup C$ በክበብ B ወይም በክበብ C ውስጥ ያለ ሁሉ ነው።"},{"en":"Inside A, that leaves three small regions: A∩B only, A∩C only and the centre.","am":"በA ውስጥ ሦስት ትንንሽ ክፍሎች ይቀራሉ፦ A∩B ብቻ፣ A∩C ብቻ እና መሀሉ።"}],"answers":[{"label":{"en":"Left side: $A \\cap (B \\cup C)$","am":"ግራ ጎን፦ $A \\cap (B \\cup C)$"},"spec":{"kind":"venn","venn":{"sets":3,"labels":["A","B","C"]},"regions":["AB","AC","ABC"]}},{"label":{"en":"Right side: $(A \\cap B) \\cup (A \\cap C)$","am":"ቀኝ ጎን፦ $(A \\cap B) \\cup (A \\cap C)$"},"spec":{"kind":"venn","venn":{"sets":3,"labels":["A","B","C"]},"regions":["AB","AC","ABC"]}}],"solution":{"venn":{"sets":3,"labels":["A","B","C"]},"steps":[{"text":{"en":"Left: shade $B \\cup C$.","am":"ግራ፦ $B \\cup C$ን አጥሉ።"},"why":{"en":"Work inside the bracket first.","am":"መጀመሪያ በቅንፉ ውስጥ ሥሩ።"},"shade":"B∪C"},{"text":{"en":"Keep only the part inside A: regions $A\\cap B$, $A \\cap C$ and the centre.","am":"በA ውስጥ ያለውን ብቻ ያዙ፦ $A\\cap B$፣ $A \\cap C$ እና መሀሉ።"},"why":{"en":"Intersection with A means: stay inside circle A.","am":"ከA ጋር መገናኘት ማለት በክበብ A ውስጥ መቆየት ማለት ነው።"},"shade":"A∩(B∪C)"},{"text":{"en":"Right: $A \\cap B$ and $A \\cap C$, then join them.","am":"ቀኝ፦ $A \\cap B$ እና $A \\cap C$፣ ከዚያ አንድ አድርጓቸው።"},"why":{"en":"Each is a lens-shaped overlap; together they cover the same three regions.","am":"እያንዳንዳቸው የመገናኛ ክፍል ናቸው፤ አንድ ላይ ተመሳሳዩን ሦስት ክፍሎች ይሸፍናሉ።"},"shade":"(A∩B)∪(A∩C)"}],"answer":{"en":"Both sides shade the same regions, so the identity is true.","am":"ሁለቱም ጎኖች ተመሳሳይ ክፍሎችን ያጠላሉ፤ ስለዚህ ማንነቱ እውነት ነው።"}},"type":"venn","needs_calculation":false},{"id":"hw6","question":{"en":"If $n(A) = 20$, $n(B) = 15$ and $n(A \\cap B) = 6$, find $n(A \\cup B)$, $n(A \\setminus B)$ and $n(B \\setminus A)$.","am":"$n(A) = 20$፣ $n(B) = 15$ እና $n(A \\cap B) = 6$ ከሆኑ $n(A \\cup B)$፣ $n(A \\setminus B)$ እና $n(B \\setminus A)$ን ፈልጉ።"},"tip":{"en":"$n(A \\setminus B) = n(A) - n(A \\cap B)$.","am":"$n(A \\setminus B) = n(A) - n(A \\cap B)$።"},"hints":[{"en":"Use the formula $n(A \\cup B) = n(A) + n(B) - n(A \\cap B)$.","am":"ቀመሩን ተጠቀሙ፦ $n(A \\cup B) = n(A) + n(B) - n(A \\cap B)$።"},{"en":"$20 + 15 - 6 = ?$","am":"$20 + 15 - 6 = ?$"}],"answers":[{"label":{"en":"$n(A \\cup B)$","am":"$n(A \\cup B)$"},"spec":{"kind":"number","value":29}},{"label":{"en":"$n(A \\setminus B)$","am":"$n(A \\setminus B)$"},"spec":{"kind":"number","value":14}},{"label":{"en":"$n(B \\setminus A)$","am":"$n(B \\setminus A)$"},"spec":{"kind":"number","value":9}}],"solution":{"venn":{"sets":2,"labels":["A","B"],"elements":{"A":["14"],"AB":["6"],"B":["9"]}},"steps":[{"text":{"en":"$n(A \\cup B) = 20 + 15 - 6 = 29$","am":"$n(A \\cup B) = 20 + 15 - 6 = 29$"},"why":{"en":"The 6 shared elements were counted twice, so subtract them once.","am":"6ቱ የጋራ አባላት ሁለት ጊዜ ተቆጥረዋል፤ ስለዚህ አንድ ጊዜ ቀንሷቸው።"},"shade":"A∪B"},{"text":{"en":"$n(A \\setminus B) = 20 - 6 = 14$","am":"$n(A \\setminus B) = 20 - 6 = 14$"},"why":{"en":"A without the shared part.","am":"A ያለ የጋራው ክፍል።"},"shade":"A∖B"},{"text":{"en":"$n(B \\setminus A) = 15 - 6 = 9$","am":"$n(B \\setminus A) = 15 - 6 = 9$"},"why":{"en":"B without the shared part.","am":"B ያለ የጋራው ክፍል።"},"shade":"B∖A"}],"answer":{"en":"29, 14, 9","am":"29, 14, 9"}},"needs_calculation":true},{"id":"hw7","question":{"en":"In a class of 50 students, 30 like Mathematics, 25 like English and 10 like both. How many like neither subject?","am":"50 ተማሪዎች ባሉበት ክፍል 30ዎቹ ሒሳብ፣ 25ቱ እንግሊዝኛ፣ 10ሩ ሁለቱንም ይወዳሉ። ስንቶቹ ሁለቱንም አይወዱም?"},"tip":{"en":"Find $n(M \\cup E)$ first, then subtract from 50.","am":"መጀመሪያ $n(M \\cup E)$ን ፈልጉ፣ ከዚያ ከ50 ቀንሱ።"},"hints":[{"en":"$n(M \\cup E) = 30 + 25 - 10$.","am":"$n(M \\cup E) = 30 + 25 - 10$።"},{"en":"Neither $= 50 - n(M \\cup E)$.","am":"በምንም $= 50 - n(M \\cup E)$።"}],"answers":[{"label":{"en":"Neither","am":"በምንም"},"spec":{"kind":"number","value":5}}],"solution":{"venn":{"sets":2,"labels":["M","E"],"elements":{"A":["20"],"AB":["10"],"B":["15"],"none":["5"]}},"steps":[{"text":{"en":"$n(M \\cup E) = 30 + 25 - 10 = 45$","am":"$n(M \\cup E) = 30 + 25 - 10 = 45$"},"why":{"en":"Students who like at least one subject.","am":"ቢያንስ አንድ ትምህርት የሚወዱ ተማሪዎች።"},"shade":"M∪E"},{"text":{"en":"Neither $= 50 - 45 = 5$","am":"በምንም $= 50 - 45 = 5$"},"why":{"en":"Everyone else is outside both circles.","am":"ሌሎቹ ሁሉ ከሁለቱም ክበቦች ውጭ ናቸው።"},"shade":"(M∪E)′"}],"answer":{"en":"5 students","am":"5 ተማሪዎች"}},"needs_calculation":true},{"id":"hw8","question":{"en":"Out of 100 students: 45 study Geography (G), 40 History (H), 35 Mathematics (M); 15 study G and H, 10 study G and M, 12 study H and M, and 5 study all three. (i) How many study at least one subject? (ii) None? (iii) Only Geography?","am":"ከ100 ተማሪዎች፦ 45ቱ ጂኦግራፊ (G)፣ 40ው ታሪክ (H)፣ 35ቱ ሒሳብ (M)፤ 15ቱ G እና H፣ 10ሩ G እና M፣ 12ቱ H እና M፣ 5ቱ ሦስቱንም ያጠናሉ። (i) ቢያንስ አንድ የሚያጠኑ ስንት ናቸው? (ii) ምንም? (iii) ጂኦግራፊ ብቻ?"},"tip":{"en":"Start from the centre (all three = 5) and work outwards in the Venn diagram.","am":"ከመሀሉ (ሦስቱም = 5) ጀምራችሁ በቬን ዲያግራሙ ወደ ውጭ ሥሩ።"},"hints":[{"en":"Use the 3-set formula: add singles, subtract pairs, add the triple.","am":"የ3 ስብስብ ቀመሩን ተጠቀሙ፦ ነጠላዎችን ደምሩ፣ ጥንዶችን ቀንሱ፣ ሦስቱን ደምሩ።"},{"en":"Only G = $45 - 15 - 10 + 5$.","am":"G ብቻ = $45 - 15 - 10 + 5$።"}],"answers":[{"label":{"en":"(i) at least one","am":"(i) ቢያንስ አንድ"},"spec":{"kind":"number","value":88}},{"label":{"en":"(ii) none","am":"(ii) ምንም"},"spec":{"kind":"number","value":12}},{"label":{"en":"(iii) only Geography","am":"(iii) ጂኦግራፊ ብቻ"},"spec":{"kind":"number","value":25}}],"solution":{"venn":{"sets":3,"labels":["G","H","M"],"elements":{"A":["25"],"B":["18"],"C":["18"],"AB":["10"],"AC":["5"],"BC":["7"],"ABC":["5"],"none":["12"]}},"steps":[{"text":{"en":"$45 + 40 + 35 = 120$","am":"$45 + 40 + 35 = 120$"},"why":{"en":"Add the singles.","am":"ነጠላዎቹን ደምሩ።"}},{"text":{"en":"$120 - 15 - 10 - 12 = 83$","am":"$120 - 15 - 10 - 12 = 83$"},"why":{"en":"Subtract the pairs (they were counted twice).","am":"ጥንዶቹን ቀንሱ (ሁለት ጊዜ ተቆጥረዋል)።"}},{"text":{"en":"$83 + 5 = 88$","am":"$83 + 5 = 88$"},"why":{"en":"Add back the triple, which we subtracted too many times.","am":"ከልክ በላይ የቀነስነውን ሦስቱን መልሳችሁ ደምሩ።"},"shade":"G∪H∪M"},{"text":{"en":"None $= 100 - 88 = 12$","am":"ምንም $= 100 - 88 = 12$"},"why":{"en":"Everyone outside all three circles.","am":"ከሦስቱም ክበቦች ውጭ ያሉ ሁሉ።"},"shade":"(G∪H∪M)′"},{"text":{"en":"Only G $= 45 - 15 - 10 + 5 = 25$","am":"G ብቻ $= 45 - 15 - 10 + 5 = 25$"},"why":{"en":"Subtract both pairs with G, then add back the 5 that were subtracted twice.","am":"ከG ጋር ያሉትን ሁለቱን ጥንዶች ቀንሱ፣ ከዚያ ሁለት ጊዜ የተቀነሱትን 5 መልሳችሁ ደምሩ።"},"shade":"G∖(H∪M)"}],"answer":{"en":"(i) 88 (ii) 12 (iii) 25","am":"(i) 88 (ii) 12 (iii) 25"}},"needs_calculation":true},{"id":"hw9","question":{"en":"$A = \\{x \\in \\mathbb{Z} \\mid -2 \\le x \\le 2\\}$ and $B = \\{x \\in \\mathbb{N} \\mid x < 4\\}$. Find $A \\cap B$, $A \\setminus B$ and $B \\setminus A$.","am":"$A = \\{x \\in \\mathbb{Z} \\mid -2 \\le x \\le 2\\}$ እና $B = \\{x \\in \\mathbb{N} \\mid x < 4\\}$። $A \\cap B$፣ $A \\setminus B$ እና $B \\setminus A$ን ፈልጉ።"},"tip":{"en":"List both sets first. Remember $\\mathbb{N}$ starts at 1.","am":"መጀመሪያ ሁለቱንም ስብስቦች ዘርዝሩ። $\\mathbb{N}$ ከ1 እንደሚጀምር አስታውሱ።"},"hints":[{"en":"$A = \\{-2, -1, 0, 1, 2\\}$ ($-2$ and $2$ ARE included).","am":"$A = \\{-2, -1, 0, 1, 2\\}$ ($-2$ እና $2$ ይካተታሉ)።"},{"en":"$B = \\{1, 2, 3\\}$.","am":"$B = \\{1, 2, 3\\}$."}],"answers":[{"label":{"en":"$A \\cap B$","am":"$A \\cap B$"},"spec":{"kind":"set","value":["1","2"]}},{"label":{"en":"$A \\setminus B$","am":"$A \\setminus B$"},"spec":{"kind":"set","value":["-2","-1","0"]}},{"label":{"en":"$B \\setminus A$","am":"$B \\setminus A$"},"spec":{"kind":"set","value":["3"]}}],"solution":{"venn":{"sets":2,"labels":["A","B"],"elements":{"A":["-2","-1","0"],"AB":["1","2"],"B":["3"]}},"steps":[{"text":{"en":"$A = \\{-2, -1, 0, 1, 2\\}$, $B = \\{1, 2, 3\\}$","am":"$A = \\{-2, -1, 0, 1, 2\\}$, $B = \\{1, 2, 3\\}$"},"why":{"en":"$\\le$ includes the end numbers; $\\mathbb{N}$ has no 0.","am":"$\\le$ የመጨረሻ ቁጥሮችን ያካትታል፤ $\\mathbb{N}$ 0 የለውም።"}},{"text":{"en":"$A \\cap B = \\{1, 2\\}$","am":"$A \\cap B = \\{1, 2\\}$"},"why":{"en":"In both sets.","am":"በሁለቱም ስብስቦች።"},"shade":"A∩B"},{"text":{"en":"$A \\setminus B = \\{-2, -1, 0\\}$","am":"$A \\setminus B = \\{-2, -1, 0\\}$"},"why":{"en":"A without 1 and 2.","am":"A ያለ 1 እና 2።"},"shade":"A∖B"},{"text":{"en":"$B \\setminus A = \\{3\\}$","am":"$B \\setminus A = \\{3\\}$"},"why":{"en":"B without 1 and 2.","am":"B ያለ 1 እና 2።"},"shade":"B∖A"}],"answer":{"en":"$\\{1, 2\\}$, $\\{-2, -1, 0\\}$, $\\{3\\}$","am":"$\\{1, 2\\}$, $\\{-2, -1, 0\\}$, $\\{3\\}$"}},"needs_calculation":true},{"id":"hw10","question":{"en":"True or false? (i) $\\emptyset \\subset \\{0\\}$ (ii) $0 \\in \\emptyset$ (iii) $\\{0\\} = \\emptyset$","am":"እውነት ወይስ ሐሰት? (i) $\\emptyset \\subset \\{0\\}$ (ii) $0 \\in \\emptyset$ (iii) $\\{0\\} = \\emptyset$"},"tip":{"en":"$\\emptyset$ has NO elements, but $\\{0\\}$ has one element: 0.","am":"$\\emptyset$ አባል የለውም፤ $\\{0\\}$ ግን አንድ አባል አለው፦ 0።"},"hints":[{"en":"The empty set is a subset of every set.","am":"ባዶ ስብስብ የሁሉም ስብስቦች ንዑስ ስብስብ ነው።"},{"en":"Can anything be an element of a set with no elements?","am":"አባል በሌለው ስብስብ ውስጥ አንድ ነገር አባል ሊሆን ይችላል?"}],"answers":[{"label":{"en":"(i)","am":"(i)"},"spec":{"kind":"choice","options":[{"en":"True","am":"እውነት"},{"en":"False","am":"ሐሰት"}],"correct":0}},{"label":{"en":"(ii)","am":"(ii)"},"spec":{"kind":"choice","options":[{"en":"True","am":"እውነት"},{"en":"False","am":"ሐሰት"}],"correct":1}},{"label":{"en":"(iii)","am":"(iii)"},"spec":{"kind":"choice","options":[{"en":"True","am":"እውነት"},{"en":"False","am":"ሐሰት"}],"correct":1}}],"solution":{"steps":[{"text":{"en":"(i) True","am":"(i) እውነት"},"why":{"en":"$\\emptyset$ is a subset of every set, and $\\emptyset \\ne \\{0\\}$, so it is a PROPER subset.","am":"$\\emptyset$ የሁሉም ስብስቦች ንዑስ ስብስብ ነው፤ $\\emptyset \\ne \\{0\\}$ ስለሆነ ትክክለኛ ንዑስ ስብስብ ነው።"}},{"text":{"en":"(ii) False","am":"(ii) ሐሰት"},"why":{"en":"$\\emptyset$ has no elements, so 0 cannot be in it.","am":"$\\emptyset$ አባል ስለሌለው 0 በውስጡ ሊኖር አይችልም።"}},{"text":{"en":"(iii) False","am":"(iii) ሐሰት"},"why":{"en":"$\\{0\\}$ has one element, $\\emptyset$ has none.","am":"$\\{0\\}$ አንድ አባል አለው፤ $\\emptyset$ ምንም የለውም።"}}],"answer":{"en":"True, False, False","am":"እውነት፣ ሐሰት፣ ሐሰት"}},"needs_calculation":true}]$j$::jsonb
 where l.slug = '1-1'
   and l.unit_id in (
         select u.id from public.units u
           join public.grades g on g.id = u.grade_id
           join public.subjects s on s.id = g.subject_id
          where s.slug = 'mathematics' and g.number = 9 and u.number = 1)
   and not exists (select 1 from public.lesson_versions v where v.lesson_id = l.id);
