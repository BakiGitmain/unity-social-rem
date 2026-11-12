/*
 * A1: admin sessions. The 2FA code is asked once per login (AAL2 session, no idle sign-out); admins can see
 *     their active sessions and sign devices out (Admin → System). Only their OWN sessions.
 * A2: needs_calculation per quiz question: shows "Calculation paper" + "Calculator" only where they help.
 *     True for Mathematics choice / number / set questions, false everywhere else.
 */

/* ------------------------------------------------------------ A1: admin sessions */

/** The calling admin's own login sessions (device = user agent; never other users' sessions). */
create or replace function public.admin_my_sessions()
returns table (id uuid, created_at timestamptz, last_active timestamptz, user_agent text, ip text, aal text, is_current boolean)
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
    select s.id, s.created_at,
           greatest(s.updated_at, coalesce(s.refreshed_at::timestamptz, s.updated_at)) as last_active,
           left(coalesce(s.user_agent, ''), 300), coalesce(host(s.ip), ''), coalesce(s.aal::text, ''),
           s.id::text = (select auth.jwt() ->> 'session_id')
      from auth.sessions s
     where s.user_id = (select auth.uid())
       and (s.not_after is null or s.not_after > now())
     order by 3 desc;
end;
$$;
revoke all on function public.admin_my_sessions() from public, anon;
grant execute on function public.admin_my_sessions() to authenticated;

/**
 * Sign one of the caller's OWN sessions out (p_id), or all OTHER sessions (p_id null). The current session is
 * never touched here (the browser signs itself out). Logged in the audit log.
 */
create or replace function public.admin_revoke_my_sessions(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cur text := (select auth.jwt() ->> 'session_id');
  n integer;
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;
  delete from auth.sessions s
   where s.user_id = uid
     and s.id::text <> coalesce(cur, '')
     and (p_id is null or s.id = p_id);
  get diagnostics n = row_count;
  perform public.log_admin_action(
    case when p_id is null then 'admin.sessions_revoke_others' else 'admin.session_revoke' end,
    'user', uid::text, null, jsonb_build_object('sessions', n)
  );
  return n;
end;
$$;
revoke all on function public.admin_revoke_my_sessions(uuid) from public, anon;
grant execute on function public.admin_revoke_my_sessions(uuid) to authenticated;

/* ------------------------------------------------------------ A2: needs_calculation */

alter table public.quiz_questions add column needs_calculation boolean not null default false;

update public.quiz_questions q
   set needs_calculation = (q.kind in ('choice', 'number', 'set'))
  from public.quizzes z
  join public.lessons l on l.id = z.lesson_id
  join public.units u on u.id = l.unit_id
  join public.grades g on g.id = u.grade_id
  join public.subjects s on s.id = g.subject_id
 where q.quiz_id = z.id
   and s.slug = 'mathematics';

/* Homework / practice items: an explicit false on every non-math lesson (math items default by type in the app). */
update public.lessons l
   set homework = coalesce((select jsonb_agg(e || '{"needs_calculation": false}'::jsonb order by o) from jsonb_array_elements(l.homework) with ordinality t(e, o)), '[]'::jsonb),
       practice = coalesce((select jsonb_agg(e || '{"needs_calculation": false}'::jsonb order by o) from jsonb_array_elements(l.practice) with ordinality t(e, o)), '[]'::jsonb)
  from public.units u
  join public.grades g on g.id = u.grade_id
  join public.subjects s on s.id = g.subject_id
 where l.unit_id = u.id
   and s.slug <> 'mathematics'
   and (jsonb_array_length(l.homework) > 0 or jsonb_array_length(l.practice) > 0);

/* Admin snapshot / save: carry needs_calculation for quiz questions. */
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
    'practice', l.practice,
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
                   'id', qq.id, 'kind', qq.kind, 'needs_calculation', qq.needs_calculation, 'question_en', qq.question_en, 'question_am', qq.question_am,
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
    practice = coalesce(p_data -> 'practice', practice),
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
          needs_calculation = coalesce((q ->> 'needs_calculation')::boolean, needs_calculation),
          question_en = q ->> 'question_en', question_am = q ->> 'question_am',
          options_en = array(select jsonb_array_elements_text(coalesce(q -> 'options_en', '[]'::jsonb))),
          options_am = array(select jsonb_array_elements_text(coalesce(q -> 'options_am', '[]'::jsonb))),
          correct_index = coalesce((q ->> 'correct_index')::integer, 0),
          answer = q -> 'answer',
          steps = coalesce(q -> 'steps', '[]'::jsonb),
          explanation_en = coalesce(q ->> 'explanation_en', ''), explanation_am = coalesce(q ->> 'explanation_am', '')
        where id = (q ->> 'id')::uuid;
      else
        insert into public.quiz_questions (quiz_id, sort_order, kind, needs_calculation, question_en, question_am, options_en, options_am, correct_index, answer, steps, explanation_en, explanation_am)
        values (
          v_quiz, i, coalesce(q ->> 'kind', 'choice'), coalesce((q ->> 'needs_calculation')::boolean, false), q ->> 'question_en', q ->> 'question_am',
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
