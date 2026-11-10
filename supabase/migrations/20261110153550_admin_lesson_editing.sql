-- LESSON EDITING (admin): atomic load / save / restore of a whole lesson, plus reordering.
-- Everything runs in ONE transaction: version snapshot + content update + audit row.

/** The whole lesson as JSON (fields, parts, key terms, main topics, quiz). Used by the editor and for versions. */
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
                   'id', qq.id, 'question_en', qq.question_en, 'question_am', qq.question_am,
                   'options_en', to_jsonb(qq.options_en), 'options_am', to_jsonb(qq.options_am),
                   'correct_index', qq.correct_index,
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

/**
 * Save (publish) a lesson from editor JSON (same shape as the snapshot). The current version is stored in
 * lesson_versions first. Parts and questions keep their ids (so progress and quiz analytics stay linked);
 * removed ones are deleted, new ones (id null) are inserted. Returns the saved version id.
 */
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

  -- 1) lesson fields
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
    updated_at = now()
  where id = p_lesson_id;

  -- 2) parts: delete removed, move kept ones out of the way (unique sort_order), then upsert in order
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

  -- 3) quiz
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
          question_en = q ->> 'question_en', question_am = q ->> 'question_am',
          options_en = array(select jsonb_array_elements_text(q -> 'options_en')),
          options_am = array(select jsonb_array_elements_text(q -> 'options_am')),
          correct_index = (q ->> 'correct_index')::integer,
          explanation_en = coalesce(q ->> 'explanation_en', ''), explanation_am = coalesce(q ->> 'explanation_am', '')
        where id = (q ->> 'id')::uuid;
      else
        insert into public.quiz_questions (quiz_id, sort_order, question_en, question_am, options_en, options_am, correct_index, explanation_en, explanation_am)
        values (
          v_quiz, i, q ->> 'question_en', q ->> 'question_am',
          array(select jsonb_array_elements_text(q -> 'options_en')),
          array(select jsonb_array_elements_text(q -> 'options_am')),
          (q ->> 'correct_index')::integer,
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
                       'questions', coalesce(jsonb_array_length(v_before -> 'quiz' -> 'questions'), 0)),
    jsonb_build_object('note', p_note, 'title', l ->> 'title_en', 'status', l ->> 'status',
                       'parts', jsonb_array_length(coalesce(p_data -> 'sections', '[]'::jsonb)),
                       'questions', coalesce(jsonb_array_length(p_data -> 'quiz' -> 'questions'), 0))
  );
  return v_version;
end;
$$;

/** Drag-and-drop order for subjects (global) or lessons (within one unit). Two-phase for unique sort orders. */
create or replace function public.admin_reorder(p_kind text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i integer;
begin
  if not public.is_admin() then
    raise exception 'Not found';
  end if;
  if p_kind = 'subjects' then
    update public.subjects set sort_order = -sort_order - 1000 where id = any (p_ids);
    for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
      update public.subjects set sort_order = i where id = p_ids[i];
    end loop;
  elsif p_kind = 'lessons' then
    if (select count(distinct unit_id) from public.lessons where id = any (p_ids)) > 1 then
      raise exception 'Lessons must be in the same unit';
    end if;
    update public.lessons set sort_order = -sort_order - 1000 where id = any (p_ids);
    for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
      update public.lessons set sort_order = i where id = p_ids[i];
    end loop;
  else
    raise exception 'Unknown kind';
  end if;
  perform public.log_admin_action('content.reorder', p_kind, null, null, to_jsonb(p_ids));
end;
$$;

revoke all on function public.admin_lesson_snapshot(uuid) from public, anon;
revoke all on function public.admin_save_lesson(uuid, jsonb, text) from public, anon;
revoke all on function public.admin_reorder(text, uuid[]) from public, anon;
grant execute on function public.admin_lesson_snapshot(uuid) to authenticated;
grant execute on function public.admin_save_lesson(uuid, jsonb, text) to authenticated;
grant execute on function public.admin_reorder(text, uuid[]) to authenticated;
