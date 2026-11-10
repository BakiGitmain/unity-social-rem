-- Class schedule: sections (e.g. Social Science, Section 1) and their weekly timetable.
-- Times are local Addis Ababa time (EAT, UTC+3, no daylight saving).

create table public.class_sections (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_en        text not null,
  name_am        text not null,
  school_en      text not null default '',
  school_am      text not null default '',
  year_ec        int,                       -- academic year in the Ethiopian calendar, e.g. 2019
  is_default     boolean not null default false,
  created_at     timestamptz not null default now()
);

create table public.schedule_entries (
  id            uuid primary key default gen_random_uuid(),
  section_id    uuid not null references public.class_sections (id) on delete cascade,
  day_of_week   int  not null check (day_of_week between 1 and 7),  -- ISO: 1 = Monday ... 7 = Sunday
  start_time    time not null,
  end_time      time not null,
  period_label  text not null,                                       -- e.g. "6th–7th"
  period_start  int  not null check (period_start between 1 and 8),
  period_end    int  not null check (period_end between 1 and 8),
  subject_slug  text not null references public.subjects (slug),
  room_en       text not null,
  room_am       text not null,
  floor         int  not null,                                       -- 1 = 1st floor, 2 = 2nd floor ...
  created_at    timestamptz not null default now(),
  check (end_time > start_time),
  check (period_end >= period_start)
);

create index schedule_entries_section_day_idx on public.schedule_entries (section_id, day_of_week, start_time);

alter table public.class_sections   enable row level security;
alter table public.schedule_entries enable row level security;

create policy "Public can read class sections"   on public.class_sections   for select to anon, authenticated using (true);
create policy "Public can read schedule entries" on public.schedule_entries for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.class_sections, public.schedule_entries from anon, authenticated;

-- Seed: Social Science, Section 1 (2019 E.C., Unity University, Adama Campus)
insert into public.class_sections (slug, name_en, name_am, school_en, school_am, year_ec, is_default)
values ('social-science-1', 'Social Science, Section 1', 'ማኅበራዊ ሳይንስ፣ ክፍል 1',
        'Unity University, Adama Campus', 'ዩኒቲ ዩኒቨርሲቲ፣ አዳማ ካምፓስ', 2019, true);

insert into public.schedule_entries
  (section_id, day_of_week, start_time, end_time, period_label, period_start, period_end, subject_slug, room_en, room_am, floor)
select s.id, e.day, e.st::time, e.et::time, e.label, e.ps, e.pe, e.subject, e.room_en, e.room_am, e.floor
from public.class_sections s
cross join (values
  (1, '14:30', '16:25', '6th–7th', 6, 7, 'geography',   'Mini Hall B', 'ሚኒ አዳራሽ B', 1),
  (2, '10:30', '12:25', '3rd–4th', 3, 4, 'english',     'Room 12',     'ክፍል 12',     2),
  (2, '14:30', '16:25', '6th–7th', 6, 7, 'geography',   'Room 14',     'ክፍል 14',     2),
  (3, '08:30', '10:25', '1st–2nd', 1, 2, 'mathematics', 'Room 12',     'ክፍል 12',     2),
  (3, '10:30', '12:25', '3rd–4th', 3, 4, 'english',     'Room 12',     'ክፍል 12',     2),
  (3, '13:30', '16:25', '5th–7th', 5, 7, 'history',     'Mini Hall B', 'ሚኒ አዳራሽ B', 1),
  (5, '15:30', '17:25', '7th–8th', 7, 8, 'mathematics', 'Mini Hall B', 'ሚኒ አዳራሽ B', 1)
) as e(day, st, et, label, ps, pe, subject, room_en, room_am, floor)
where s.slug = 'social-science-1';
