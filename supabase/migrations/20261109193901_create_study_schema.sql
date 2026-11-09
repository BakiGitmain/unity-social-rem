-- Unity Social Rem: study content schema.
-- Hierarchy: subjects -> grades -> units -> lessons -> lesson_sections
--            lessons -> quizzes -> quiz_questions
-- All user-facing text is bilingual (*_en / *_am). Note blocks are JSON with {en, am} pairs.
-- Content is public read-only; it is only ever written by migrations.

create table public.subjects (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_en       text not null,
  name_am       text not null,
  description_en text not null default '',
  description_am text not null default '',
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

create table public.grades (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid not null references public.subjects (id) on delete cascade,
  number        int  not null check (number between 1 and 12),
  slug          text not null check (slug ~ '^[a-z0-9-]+$'),
  name_en       text not null,
  name_am       text not null,
  curriculum_en text not null default '',
  curriculum_am text not null default '',
  created_at    timestamptz not null default now(),
  unique (subject_id, number),
  unique (subject_id, slug)
);

create table public.units (
  id             uuid primary key default gen_random_uuid(),
  grade_id       uuid not null references public.grades (id) on delete cascade,
  number         int  not null check (number > 0),
  slug           text not null check (slug ~ '^[a-z0-9-]+$'),
  label_en       text not null,           -- e.g. "Unit One"
  label_am       text not null,
  title_en       text not null,           -- e.g. "The Concept of Geography and Map-Reading"
  title_am       text not null,
  description_en text not null default '',
  description_am text not null default '',
  created_at     timestamptz not null default now(),
  unique (grade_id, number),
  unique (grade_id, slug)
);

create table public.lessons (
  id                 uuid primary key default gen_random_uuid(),
  unit_id            uuid not null references public.units (id) on delete cascade,
  code               text not null check (code ~ '^[0-9]+(\.[0-9]+)*$'),  -- e.g. "1.1.1"
  slug               text not null check (slug ~ '^[a-z0-9-]+$'),         -- e.g. "1-1-1"
  sort_order         int  not null,
  section_code       text not null default '',                           -- e.g. "1.1"
  section_title_en   text not null default '',
  section_title_am   text not null default '',
  title_en           text not null,
  title_am           text not null,
  summary_en         text not null default '',
  summary_am         text not null default '',
  minutes            int  not null default 10,
  -- Main Topics: [{ "title": {en, am}, "points": [{en, am}, ...] }, ...]
  main_topics        jsonb not null default '[]'::jsonb check (jsonb_typeof(main_topics) = 'array'),
  created_at         timestamptz not null default now(),
  unique (unit_id, code),
  unique (unit_id, slug)
);

create table public.lesson_sections (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  sort_order  int  not null,
  title_en    text not null,
  title_am    text not null,
  icon        text not null default 'book-open',
  -- Note blocks: [{ "type": "paragraph", "text": {en, am} }, ...] (see src/lib/types.ts)
  blocks      jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  created_at  timestamptz not null default now(),
  unique (lesson_id, sort_order)
);

create table public.quizzes (
  id             uuid primary key default gen_random_uuid(),
  lesson_id      uuid not null unique references public.lessons (id) on delete cascade,
  title_en       text not null,
  title_am       text not null,
  description_en text not null default '',
  description_am text not null default '',
  created_at     timestamptz not null default now()
);

create table public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes (id) on delete cascade,
  sort_order     int  not null,
  question_en    text not null,
  question_am    text not null,
  options_en     text[] not null check (cardinality(options_en) between 2 and 6),
  options_am     text[] not null check (cardinality(options_am) between 2 and 6),
  correct_index  int  not null check (correct_index >= 0),
  explanation_en text not null default '',
  explanation_am text not null default '',
  created_at     timestamptz not null default now(),
  unique (quiz_id, sort_order),
  check (cardinality(options_en) = cardinality(options_am)),
  check (correct_index < cardinality(options_en))
);

create index grades_subject_id_idx          on public.grades (subject_id);
create index units_grade_id_idx             on public.units (grade_id);
create index lessons_unit_id_idx            on public.lessons (unit_id);
create index lesson_sections_lesson_id_idx  on public.lesson_sections (lesson_id);
create index quiz_questions_quiz_id_idx     on public.quiz_questions (quiz_id);

-- Row Level Security: public read only. No insert/update/delete policies exist,
-- so anon and authenticated users cannot write. Migrations run as the owner.
alter table public.subjects        enable row level security;
alter table public.grades          enable row level security;
alter table public.units           enable row level security;
alter table public.lessons         enable row level security;
alter table public.lesson_sections enable row level security;
alter table public.quizzes         enable row level security;
alter table public.quiz_questions  enable row level security;

create policy "Public can read subjects"        on public.subjects        for select to anon, authenticated using (true);
create policy "Public can read grades"          on public.grades          for select to anon, authenticated using (true);
create policy "Public can read units"           on public.units           for select to anon, authenticated using (true);
create policy "Public can read lessons"         on public.lessons         for select to anon, authenticated using (true);
create policy "Public can read lesson sections" on public.lesson_sections for select to anon, authenticated using (true);
create policy "Public can read quizzes"         on public.quizzes         for select to anon, authenticated using (true);
create policy "Public can read quiz questions"  on public.quiz_questions  for select to anon, authenticated using (true);

-- Belt and braces: only allow reading through the API roles.
revoke insert, update, delete, truncate on
  public.subjects, public.grades, public.units, public.lessons,
  public.lesson_sections, public.quizzes, public.quiz_questions
from anon, authenticated;

-- Seed: the 4 subjects and grades 9-12 for each.
insert into public.subjects (slug, name_en, name_am, description_en, description_am, sort_order) values
  ('mathematics', 'Mathematics', 'ሒሳብ',
   'Numbers, algebra, geometry and problem solving.',
   'ቁጥሮች፣ አልጀብራ፣ ጂኦሜትሪ እና ችግር መፍታት።', 1),
  ('english', 'English', 'እንግሊዝኛ',
   'Reading, writing, grammar and vocabulary.',
   'ንባብ፣ ጽሕፈት፣ ሰዋስው እና የቃላት እውቀት።', 2),
  ('geography', 'Geography', 'ጂኦግራፊ',
   'The Earth, its people, places and environments.',
   'ምድር፣ ሕዝቦቿ፣ ቦታዎቿ እና አካባቢዎቿ።', 3),
  ('history', 'History', 'ታሪክ',
   'The story of people, societies and civilizations.',
   'የሰዎች፣ የማኅበረሰቦች እና የሥልጣኔዎች ታሪክ።', 4);

insert into public.grades (subject_id, number, slug, name_en, name_am, curriculum_en, curriculum_am)
select s.id, g.number, 'grade-' || g.number, 'Grade ' || g.number, g.number || 'ኛ ክፍል',
       case when s.slug = 'geography' and g.number = 9 then 'Old curriculum textbook'
            when g.number between 10 and 12 then 'New MoE curriculum'
            else '' end,
       case when s.slug = 'geography' and g.number = 9 then 'የቀድሞው ሥርዓተ ትምህርት መጽሐፍ'
            when g.number between 10 and 12 then 'አዲሱ የትምህርት ሚኒስቴር ሥርዓተ ትምህርት'
            else '' end
from public.subjects s
cross join (values (9), (10), (11), (12)) as g(number);
