-- MATH TOOLKIT: homework per lesson, new quiz answer types (number, set, venn), step-by-step explanations,
-- homework progress, and the admin lesson functions updated for these fields.

/* ------------------------------------------------------------ homework */

-- [{ id, question{en,am}, tip{en,am}, hints[{en,am}], answer{kind…}|null, solution{steps[…], answer{en,am}, venn?} }]
alter table public.lessons
  add column homework jsonb not null default '[]'::jsonb check (jsonb_typeof(homework) = 'array');

create table public.homework_progress (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  done       text[] not null default '{}',
  answers    jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) < 50000),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.homework_progress enable row level security;
create policy "Users read their own homework progress" on public.homework_progress for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());
create policy "Users insert their own homework progress" on public.homework_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update their own homework progress" on public.homework_progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own homework progress" on public.homework_progress for delete to authenticated
  using ((select auth.uid()) = user_id);

/* ------------------------------------------------------------ quiz answer types */

alter table public.quiz_questions
  add column kind text not null default 'choice' check (kind in ('choice', 'number', 'set', 'venn')),
  -- number: {"value": 9} · set: {"value": ["-1","0","1"]} (canonical: sorted, normalized) ·
  -- venn: {"sets": 2|3, "labels": [...], "regions": ["AB", ...], "elements": {...}}
  add column answer jsonb,
  -- step-by-step explanation shown after answering: [{"text":{en,am}, "why":{en,am}}]
  add column steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array');

-- The old option checks only apply to multiple choice now.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.quiz_questions'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ~ '(cardinality|correct_index)'
  loop
    execute format('alter table public.quiz_questions drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.quiz_questions
  add constraint quiz_questions_choice_check check (
    kind <> 'choice' or (
      cardinality(options_en) between 2 and 6
      and cardinality(options_am) = cardinality(options_en)
      and correct_index >= 0 and correct_index < cardinality(options_en)
    )
  ),
  add constraint quiz_questions_answer_check check (kind = 'choice' or jsonb_typeof(answer) = 'object');

/** Is a student's answer to one question correct? Computed IN the database (never trusted from the browser). */
create or replace function public.quiz_answer_correct(q public.quiz_questions, p_chosen integer, p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if q.kind = 'choice' then
    return p_chosen is not null and p_chosen = q.correct_index;
  elsif q.kind = 'number' then
    return jsonb_typeof(p_value) = 'number'
       and abs((p_value #>> '{}')::numeric - (q.answer ->> 'value')::numeric) < 0.000001;
  elsif q.kind = 'set' then
    return jsonb_typeof(p_value) = 'array'
       and (select coalesce(array_agg(distinct x order by x), '{}') from jsonb_array_elements_text(p_value) x)
         = (select coalesce(array_agg(distinct x order by x), '{}') from jsonb_array_elements_text(q.answer -> 'value') x);
  elsif q.kind = 'venn' then
    return jsonb_typeof(p_value) = 'array'
       and (select coalesce(array_agg(distinct x order by x), '{}') from jsonb_array_elements_text(p_value) x)
         = (select coalesce(array_agg(distinct x order by x), '{}') from jsonb_array_elements_text(q.answer -> 'regions') x);
  end if;
  return false;
end;
$$;

/**
 * Record a finished quiz. p_answers: [{ "question_id": uuid, "chosen": int|null, "value": json|null }].
 * The score is computed here for every answer type.
 */
create or replace function public.record_quiz_attempt(p_lesson_id uuid, p_answers jsonb, p_duration_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_quiz uuid;
  v_total integer;
  v_answers jsonb;
  v_score integer;
begin
  select id into v_quiz from public.quizzes where lesson_id = p_lesson_id;
  if v_quiz is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Unknown quiz';
  end if;
  if uid is not null and (
    select count(*) from public.quiz_attempts a where a.user_id = uid and a.created_at > now() - interval '1 hour'
  ) >= 30 then
    return jsonb_build_object('ok', false);
  end if;

  select count(*) into v_total from public.quiz_questions where quiz_id = v_quiz;
  if v_total = 0 then
    raise exception 'Empty quiz';
  end if;

  with given as (
    select q, a.chosen, a.value, public.quiz_answer_correct(q, a.chosen, a.value) as ok
      from public.quiz_questions q
      left join lateral (
        select case when jsonb_typeof(x -> 'chosen') = 'number' then (x ->> 'chosen')::integer end as chosen,
               x -> 'value' as value
          from jsonb_array_elements(p_answers) x
         where (x ->> 'question_id') = q.id::text
         limit 1
      ) a on true
     where q.quiz_id = v_quiz
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'question_id', (g.q).id, 'chosen', g.chosen, 'value', g.value, 'correct', coalesce(g.ok, false)
         ) order by (g.q).sort_order), '[]'::jsonb),
         count(*) filter (where g.ok)
    into v_answers, v_score
    from given g;

  insert into public.quiz_attempts (user_id, lesson_id, quiz_id, score, total, answers, duration_ms)
  values (uid, p_lesson_id, v_quiz, v_score, v_total, v_answers, least(greatest(coalesce(p_duration_ms, 0), 0), 86400000));

  insert into public.events (user_id, type, lesson_id, metadata)
  values (uid, 'quiz_finish', p_lesson_id, jsonb_build_object('score', v_score, 'total', v_total));

  if uid is not null then
    perform public.touch_last_seen();
  end if;
  return jsonb_build_object('ok', true, 'score', v_score, 'total', v_total);
end;
$$;

/* ------------------------------------------------------------ admin: snapshot + save with the new fields */

create or replace function public.admin_lesson_snapshot(p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;
  select jsonb_build_object(
    'lesson', jsonb_build_object(
      'id', l.id, 'code', l.code, 'slug', l.slug, 'status', l.status, 'minutes', l.minutes,
      'title_en', l.title_en, 'title_am', l.title_am, 'summary_en', l.summary_en, 'summary_am', l.summary_am,
      'section_code', l.section_code, 'section_title_en', l.section_title_en, 'section_title_am', l.section_title_am,
      'updated_at', l.updated_at
    ),
    'glossary', l.glossary,
    'main_topics', l.main_topics,
    'homework', l.homework,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'title_en', s.title_en, 'title_am', s.title_am, 'icon', s.icon, 'blocks', s.blocks)
                       order by s.sort_order)
        from public.lesson_sections s where s.lesson_id = l.id
    ), '[]'::jsonb),
    'quiz', (
      select jsonb_build_object(
        'id', q.id, 'title_en', q.title_en, 'title_am', q.title_am,
        'description_en', q.description_en, 'description_am', q.description_am,
        'questions', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', qq.id, 'kind', qq.kind, 'question_en', qq.question_en, 'question_am', qq.question_am,
                   'options_en', to_jsonb(qq.options_en), 'options_am', to_jsonb(qq.options_am),
                   'correct_index', qq.correct_index, 'answer', qq.answer, 'steps', qq.steps,
                   'explanation_en', qq.explanation_en, 'explanation_am', qq.explanation_am
                 ) order by qq.sort_order)
            from public.quiz_questions qq where qq.quiz_id = q.id
        ), '[]'::jsonb)
      )
      from public.quizzes q where q.lesson_id = l.id
    )
  )
  into r
  from public.lessons l
  where l.id = p_lesson_id;
  if r is null then
    raise exception 'Lesson not found';
  end if;
  return r;
end;
$$;

create or replace function public.admin_save_lesson(p_lesson_id uuid, p_data jsonb, p_note text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_version bigint;
  l jsonb := p_data -> 'lesson';
  s jsonb;
  q jsonb;
  i integer;
  v_quiz uuid;
  v_keep uuid[];
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;
  v_before := public.admin_lesson_snapshot(p_lesson_id);

  insert into public.lesson_versions (lesson_id, snapshot, note, created_by)
  values (p_lesson_id, v_before, left(coalesce(p_note, 'Before edit'), 200), (select auth.uid()))
  returning id into v_version;

  update public.lessons set
    title_en = coalesce(l ->> 'title_en', title_en),
    title_am = coalesce(l ->> 'title_am', title_am),
    summary_en = coalesce(l ->> 'summary_en', summary_en),
    summary_am = coalesce(l ->> 'summary_am', summary_am),
    section_title_en = coalesce(l ->> 'section_title_en', section_title_en),
    section_title_am = coalesce(l ->> 'section_title_am', section_title_am),
    minutes = coalesce((l ->> 'minutes')::integer, minutes),
    status = coalesce(l ->> 'status', status),
    glossary = coalesce(p_data -> 'glossary', glossary),
    main_topics = coalesce(p_data -> 'main_topics', main_topics),
    homework = coalesce(p_data -> 'homework', homework),
    updated_at = now()
  where id = p_lesson_id;

  select coalesce(array_agg((x ->> 'id')::uuid), '{}') into v_keep
    from jsonb_array_elements(coalesce(p_data -> 'sections', '[]'::jsonb)) x
   where x ->> 'id' is not null;
  delete from public.lesson_sections where lesson_id = p_lesson_id and not (id = any (v_keep));
  update public.lesson_sections set sort_order = -sort_order - 1000 where lesson_id = p_lesson_id;
  i := 0;
  for s in select * from jsonb_array_elements(coalesce(p_data -> 'sections', '[]'::jsonb)) loop
    i := i + 1;
    if s ->> 'id' is not null and exists (select 1 from public.lesson_sections where id = (s ->> 'id')::uuid and lesson_id = p_lesson_id) then
      update public.lesson_sections
         set sort_order = i, title_en = s ->> 'title_en', title_am = s ->> 'title_am',
             icon = coalesce(s ->> 'icon', 'book-open'), blocks = coalesce(s -> 'blocks', '[]'::jsonb)
       where id = (s ->> 'id')::uuid;
    else
      insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, blocks)
      values (p_lesson_id, i, s ->> 'title_en', s ->> 'title_am', coalesce(s ->> 'icon', 'book-open'), coalesce(s -> 'blocks', '[]'::jsonb));
    end if;
  end loop;

  if p_data -> 'quiz' is not null and jsonb_typeof(p_data -> 'quiz') = 'object' then
    select id into v_quiz from public.quizzes where lesson_id = p_lesson_id;
    if v_quiz is null then
      insert into public.quizzes (lesson_id, title_en, title_am)
      values (p_lesson_id, coalesce(p_data -> 'quiz' ->> 'title_en', 'Quiz'), coalesce(p_data -> 'quiz' ->> 'title_am', 'ፈተና'))
      returning id into v_quiz;
    else
      update public.quizzes set
        title_en = coalesce(p_data -> 'quiz' ->> 'title_en', title_en),
        title_am = coalesce(p_data -> 'quiz' ->> 'title_am', title_am),
        description_en = coalesce(p_data -> 'quiz' ->> 'description_en', description_en),
        description_am = coalesce(p_data -> 'quiz' ->> 'description_am', description_am)
      where id = v_quiz;
    end if;

    select coalesce(array_agg((x ->> 'id')::uuid), '{}') into v_keep
      from jsonb_array_elements(coalesce(p_data -> 'quiz' -> 'questions', '[]'::jsonb)) x
     where x ->> 'id' is not null;
    delete from public.quiz_questions where quiz_id = v_quiz and not (id = any (v_keep));
    update public.quiz_questions set sort_order = -sort_order - 1000 where quiz_id = v_quiz;
    i := 0;
    for q in select * from jsonb_array_elements(coalesce(p_data -> 'quiz' -> 'questions', '[]'::jsonb)) loop
      i := i + 1;
      if q ->> 'id' is not null and exists (select 1 from public.quiz_questions where id = (q ->> 'id')::uuid and quiz_id = v_quiz) then
        update public.quiz_questions set
          sort_order = i,
          kind = coalesce(q ->> 'kind', 'choice'),
          question_en = q ->> 'question_en', question_am = q ->> 'question_am',
          options_en = array(select jsonb_array_elements_text(coalesce(q -> 'options_en', '[]'::jsonb))),
          options_am = array(select jsonb_array_elements_text(coalesce(q -> 'options_am', '[]'::jsonb))),
          correct_index = coalesce((q ->> 'correct_index')::integer, 0),
          answer = q -> 'answer',
          steps = coalesce(q -> 'steps', '[]'::jsonb),
          explanation_en = coalesce(q ->> 'explanation_en', ''), explanation_am = coalesce(q ->> 'explanation_am', '')
        where id = (q ->> 'id')::uuid;
      else
        insert into public.quiz_questions (quiz_id, sort_order, kind, question_en, question_am, options_en, options_am, correct_index, answer, steps, explanation_en, explanation_am)
        values (
          v_quiz, i, coalesce(q ->> 'kind', 'choice'), q ->> 'question_en', q ->> 'question_am',
          array(select jsonb_array_elements_text(coalesce(q -> 'options_en', '[]'::jsonb))),
          array(select jsonb_array_elements_text(coalesce(q -> 'options_am', '[]'::jsonb))),
          coalesce((q ->> 'correct_index')::integer, 0), q -> 'answer', coalesce(q -> 'steps', '[]'::jsonb),
          coalesce(q ->> 'explanation_en', ''), coalesce(q ->> 'explanation_am', '')
        );
      end if;
    end loop;
  end if;

  delete from public.lesson_drafts where lesson_id = p_lesson_id;

  perform public.log_admin_action(
    'lesson.save', 'lesson', p_lesson_id::text,
    jsonb_build_object('version_id', v_version, 'title', v_before -> 'lesson' ->> 'title_en',
                       'parts', jsonb_array_length(v_before -> 'sections'),
                       'questions', coalesce(jsonb_array_length(v_before -> 'quiz' -> 'questions'), 0),
                       'homework', coalesce(jsonb_array_length(v_before -> 'homework'), 0)),
    jsonb_build_object('note', p_note, 'title', l ->> 'title_en',
                       'parts', jsonb_array_length(coalesce(p_data -> 'sections', '[]'::jsonb)),
                       'questions', coalesce(jsonb_array_length(p_data -> 'quiz' -> 'questions'), 0),
                       'homework', coalesce(jsonb_array_length(p_data -> 'homework'), 0))
  );
  return v_version;
end;
$$;
