/*
 * Homework vs Extra practice.
 * - lessons.practice: optional "Extra practice" questions (same shape as homework, never counted as homework).
 * - Admin snapshot / save include practice.
 * - Mathematics 9 · 1.1: homework = ONLY the 5 exercises from the board (3 Venn "show that", 2 exam questions);
 *   the earlier 10 exercises move to Extra practice. Only while the lesson was never edited in the admin.
 */
alter table public.lessons
  add column practice jsonb not null default '[]'::jsonb check (jsonb_typeof(practice) = 'array');

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

update public.lessons l
   set homework = $j$[{"id":"h1","type":"venn","question":{"en":"Using Venn diagrams, show that $A \\cup (B \\cap C) = (A \\cup B) \\cap (A \\cup C)$. Shade the left side and the right side: they must match.","am":"በቬን ዲያግራም $A \\cup (B \\cap C) = (A \\cup B) \\cap (A \\cup C)$ መሆኑን አሳዩ። ግራውንና ቀኙን ጎን አጥሉ፤ አንድ ዓይነት መሆን አለባቸው።"},"tip":{"en":"Do the brackets first. On the left, shade $B \\cap C$, then add all of A. On the right, shade $A \\cup B$ and $A \\cup C$ and keep only where they overlap.","am":"መጀመሪያ ቅንፉን ሥሩ። በግራ $B \\cap C$ን አጥሉ፣ ከዚያ A ሙሉውን ጨምሩ። በቀኝ $A \\cup B$ እና $A \\cup C$ን አጥላችሁ የሚገናኙበትን ብቻ ያዙ።"},"hints":[{"en":"$B \\cap C$ is the overlap of circles B and C (2 small regions).","am":"$B \\cap C$ የክበብ B እና C መገናኛ ነው (2 ትንንሽ ክፍሎች)።"},{"en":"Both sides end up as: all of circle A plus the part where B and C overlap outside A.","am":"ሁለቱም ጎኖች፦ ሙሉ ክበብ A እና ከA ውጭ B እና C የሚገናኙበት ክፍል ይሆናሉ።"}],"answers":[{"label":{"en":"Left side: $A \\cup (B \\cap C)$","am":"ግራ ጎን፦ $A \\cup (B \\cap C)$"},"spec":{"kind":"venn","venn":{"sets":3,"labels":["A","B","C"]},"regions":["A","AB","AC","ABC","BC"]}},{"label":{"en":"Right side: $(A \\cup B) \\cap (A \\cup C)$","am":"ቀኝ ጎን፦ $(A \\cup B) \\cap (A \\cup C)$"},"spec":{"kind":"venn","venn":{"sets":3,"labels":["A","B","C"]},"regions":["A","AB","AC","ABC","BC"]}}],"solution":{"venn":{"sets":3,"labels":["A","B","C"]},"steps":[{"text":{"en":"Left side: shade $B \\cap C$.","am":"ግራ ጎን፦ $B \\cap C$ን አጥሉ።"},"why":{"en":"Brackets first: the part inside both B and C.","am":"መጀመሪያ ቅንፍ፦ በB እና በC ውስጥ ያለው ክፍል።"},"shade":"B∩C"},{"text":{"en":"Add all of A: $A \\cup (B \\cap C)$.","am":"ሙሉ Aን ጨምሩ፦ $A \\cup (B \\cap C)$።"},"why":{"en":"Union means: everything in A OR in $B \\cap C$.","am":"ውህደት ማለት፦ በA ወይም በ$B \\cap C$ ያለ ሁሉ።"},"shade":"A∪(B∩C)"},{"text":{"en":"Right side: shade $A \\cup B$.","am":"ቀኝ ጎን፦ $A \\cup B$ን አጥሉ።"},"why":{"en":"First bracket: circles A and B together.","am":"የመጀመሪያው ቅንፍ፦ ክበብ A እና B አንድ ላይ።"},"shade":"A∪B"},{"text":{"en":"Shade $A \\cup C$.","am":"$A \\cup C$ን አጥሉ።"},"why":{"en":"Second bracket: circles A and C together.","am":"ሁለተኛው ቅንፍ፦ ክበብ A እና C አንድ ላይ።"},"shade":"A∪C"},{"text":{"en":"Keep only the overlap: $(A \\cup B) \\cap (A \\cup C)$.","am":"መገናኛውን ብቻ ያዙ፦ $(A \\cup B) \\cap (A \\cup C)$።"},"why":{"en":"Intersection = shaded in BOTH pictures. That is all of A plus $B \\cap C$.","am":"መገናኛ = በሁለቱም ሥዕሎች የተጠለለ። ይህም ሙሉ A እና $B \\cap C$ ነው።"},"shade":"(A∪B)∩(A∪C)"},{"text":{"en":"Both diagrams are the same, so the sets are equal.","am":"ሁለቱ ዲያግራሞች አንድ ናቸው፤ ስለዚህ ስብስቦቹ እኩል ናቸው።"},"why":{"en":"Same shaded regions = same set.","am":"አንድ ዓይነት የተጠለሉ ክፍሎች = አንድ ስብስብ።"},"shade":"A∪(B∩C)"}],"answer":{"en":"$A \\cup (B \\cap C) = (A \\cup B) \\cap (A \\cup C)$ (union distributes over intersection).","am":"$A \\cup (B \\cap C) = (A \\cup B) \\cap (A \\cup C)$ (ውህደት በመገናኛ ላይ ይሰራጫል)።"}}},{"id":"h2","type":"venn","question":{"en":"Using Venn diagrams, show that $A - (B \\cup C) = (A - B) \\cap (A - C)$, which is the same as $A \\setminus (B \\cup C) = (A \\setminus B) \\cap (A \\setminus C)$. Shade both sides.","am":"በቬን ዲያግራም $A - (B \\cup C) = (A - B) \\cap (A - C)$ መሆኑን አሳዩ፤ ይህም $A \\setminus (B \\cup C) = (A \\setminus B) \\cap (A \\setminus C)$ ማለት ነው። ሁለቱንም ጎኖች አጥሉ።"},"tip":{"en":"$A - B$ and $A \\setminus B$ mean the same thing: the part of A that is NOT in B.","am":"$A - B$ እና $A \\setminus B$ አንድ ናቸው፦ በB ውስጥ የሌለው የA ክፍል።"},"hints":[{"en":"Left: shade $B \\cup C$, then take it away from A.","am":"ግራ፦ $B \\cup C$ን አጥሉ፣ ከዚያ ከA ቀንሱት።"},{"en":"Both sides leave only the part of A that touches neither B nor C (1 region).","am":"ሁለቱም ጎኖች B ወይም Cን የማይነካውን የA ክፍል ብቻ ይተዋሉ (1 ክፍል)።"}],"answers":[{"label":{"en":"Left side: $A - (B \\cup C)$","am":"ግራ ጎን፦ $A - (B \\cup C)$"},"spec":{"kind":"venn","venn":{"sets":3,"labels":["A","B","C"]},"regions":["A"]}},{"label":{"en":"Right side: $(A - B) \\cap (A - C)$","am":"ቀኝ ጎን፦ $(A - B) \\cap (A - C)$"},"spec":{"kind":"venn","venn":{"sets":3,"labels":["A","B","C"]},"regions":["A"]}}],"solution":{"venn":{"sets":3,"labels":["A","B","C"]},"steps":[{"text":{"en":"Left side: shade $B \\cup C$.","am":"ግራ ጎን፦ $B \\cup C$ን አጥሉ።"},"why":{"en":"Brackets first: everything in B or C.","am":"መጀመሪያ ቅንፍ፦ በB ወይም በC ያለ ሁሉ።"},"shade":"B∪C"},{"text":{"en":"Remove it from A: $A - (B \\cup C)$.","am":"ከA ቀንሱት፦ $A - (B \\cup C)$።"},"why":{"en":"Keep only the part of A outside B and outside C.","am":"ከB ውጭና ከC ውጭ ያለውን የA ክፍል ብቻ ያዙ።"},"shade":"A∖(B∪C)"},{"text":{"en":"Right side: shade $A - B$.","am":"ቀኝ ጎን፦ $A - B$ን አጥሉ።"},"why":{"en":"A without B (also written $A \\setminus B$).","am":"ያለ B ያለው A ($A \\setminus B$ ተብሎም ይጻፋል)።"},"shade":"A∖B"},{"text":{"en":"Shade $A - C$.","am":"$A - C$ን አጥሉ።"},"why":{"en":"A without C.","am":"ያለ C ያለው A።"},"shade":"A∖C"},{"text":{"en":"Keep the overlap: $(A - B) \\cap (A - C)$.","am":"መገናኛውን ያዙ፦ $(A - B) \\cap (A - C)$።"},"why":{"en":"In both: in A, not in B AND not in C.","am":"በሁለቱም፦ በA ውስጥ፣ በB ውስጥ ያልሆነና በC ውስጥ ያልሆነ።"},"shade":"(A∖B)∩(A∖C)"},{"text":{"en":"Same region on both sides, so they are equal.","am":"በሁለቱም ጎኖች አንድ ክፍል ነው፤ ስለዚህ እኩል ናቸው።"},"why":{"en":"This is De Morgan's law inside A.","am":"ይህ በA ውስጥ ያለ የደ ሞርጋን ሕግ ነው።"},"shade":"A∖(B∪C)"}],"answer":{"en":"$A - (B \\cup C) = (A - B) \\cap (A - C)$, i.e. $A \\setminus (B \\cup C) = (A \\setminus B) \\cap (A \\setminus C)$.","am":"$A - (B \\cup C) = (A - B) \\cap (A - C)$፣ ማለትም $A \\setminus (B \\cup C) = (A \\setminus B) \\cap (A \\setminus C)$።"}}},{"id":"h3","type":"venn","question":{"en":"Using Venn diagrams, show that $A \\setminus B = A \\setminus (A \\cap B)$, which is the same as $A - B = A - (A \\cap B)$. Shade both sides.","am":"በቬን ዲያግራም $A \\setminus B = A \\setminus (A \\cap B)$ መሆኑን አሳዩ፤ ይህም $A - B = A - (A \\cap B)$ ማለት ነው። ሁለቱንም ጎኖች አጥሉ።"},"tip":{"en":"Taking away B from A only removes the part of B that is inside A, which is exactly $A \\cap B$.","am":"Bን ከA መቀነስ የሚያስወግደው በA ውስጥ ያለውን የB ክፍል ብቻ ነው፤ ይህም በትክክል $A \\cap B$ ነው።"},"hints":[{"en":"Left: shade A, then remove the lens where A and B overlap.","am":"ግራ፦ Aን አጥሉ፣ ከዚያ A እና B የሚገናኙበትን ክፍል አስወግዱ።"},{"en":"Right: $A \\cap B$ is that same lens, so removing it gives the same picture.","am":"ቀኝ፦ $A \\cap B$ ያው ክፍል ነው፤ ስለዚህ ማስወገዱ ያንኑ ሥዕል ይሰጣል።"}],"answers":[{"label":{"en":"Left side: $A \\setminus B$","am":"ግራ ጎን፦ $A \\setminus B$"},"spec":{"kind":"venn","venn":{"sets":2,"labels":["A","B"]},"regions":["A"]}},{"label":{"en":"Right side: $A \\setminus (A \\cap B)$","am":"ቀኝ ጎን፦ $A \\setminus (A \\cap B)$"},"spec":{"kind":"venn","venn":{"sets":2,"labels":["A","B"]},"regions":["A"]}}],"solution":{"venn":{"sets":2,"labels":["A","B"]},"steps":[{"text":{"en":"Left side: shade A.","am":"ግራ ጎን፦ Aን አጥሉ።"},"why":{"en":"Start with everything in A.","am":"በA ውስጥ ባለው ሁሉ ጀምሩ።"},"shade":"A"},{"text":{"en":"Remove B: $A \\setminus B$.","am":"Bን አስወግዱ፦ $A \\setminus B$።"},"why":{"en":"Only the part of A outside B stays.","am":"ከB ውጭ ያለው የA ክፍል ብቻ ይቀራል።"},"shade":"A∖B"},{"text":{"en":"Right side: shade $A \\cap B$.","am":"ቀኝ ጎን፦ $A \\cap B$ን አጥሉ።"},"why":{"en":"The bracket: the overlap of A and B.","am":"ቅንፉ፦ የA እና B መገናኛ።"},"shade":"A∩B"},{"text":{"en":"Remove it from A: $A \\setminus (A \\cap B)$.","am":"ከA አስወግዱት፦ $A \\setminus (A \\cap B)$።"},"why":{"en":"Removing the overlap leaves the same region as before.","am":"መገናኛውን ማስወገድ ከዚህ በፊት የነበረውን ክፍል ይተዋል።"},"shade":"A∖(A∩B)"}],"answer":{"en":"$A \\setminus B = A \\setminus (A \\cap B)$, i.e. $A - B = A - (A \\cap B)$.","am":"$A \\setminus B = A \\setminus (A \\cap B)$፣ ማለትም $A - B = A - (A \\cap B)$።"}}},{"id":"h4","type":"choice","question":{"en":"Exam question: For sets A, B and C, if $A \\cup C = \\{x \\in \\mathbb{Z} \\mid -3 < x < 3\\}$ and $B \\cup C = \\{x \\in \\mathbb{R} \\mid x^3 = x\\}$, then $(A \\cap B) \\cup C$ is equal to:","am":"የፈተና ጥያቄ፦ ለስብስቦች A፣ B እና C፣ $A \\cup C = \\{x \\in \\mathbb{Z} \\mid -3 < x < 3\\}$ እና $B \\cup C = \\{x \\in \\mathbb{R} \\mid x^3 = x\\}$ ከሆኑ፣ $(A \\cap B) \\cup C$ ከምን ጋር እኩል ነው?"},"tip":{"en":"Use the distributive law: $(A \\cap B) \\cup C = (A \\cup C) \\cap (B \\cup C)$. Then you only need the two sets you are given.","am":"የማሰራጨት ሕግን ተጠቀሙ፦ $(A \\cap B) \\cup C = (A \\cup C) \\cap (B \\cup C)$። ከዚያ የተሰጡትን ሁለት ስብስቦች ብቻ ትፈልጋላችሁ።"},"hints":[{"en":"List $A \\cup C$: the integers between −3 and 3 (not including them).","am":"$A \\cup C$ን ዘርዝሩ፦ በ−3 እና በ3 መካከል ያሉ ኢንቲጀሮች (እነሱን ሳይጨምር)።"},{"en":"Solve $x^3 = x$ by factoring: $x(x - 1)(x + 1) = 0$.","am":"$x^3 = x$ን በመፍታት ፈቱ፦ $x(x - 1)(x + 1) = 0$።"}],"answers":[{"label":{"en":"Choose the answer","am":"መልሱን ምረጡ"},"spec":{"kind":"choice","options":[{"en":"$\\{0, 1, 2\\}$","am":"$\\{0, 1, 2\\}$"},{"en":"$\\{-1, 0, 1\\}$","am":"$\\{-1, 0, 1\\}$"},{"en":"$\\{-2, -1, 0, 1, 2\\}$","am":"$\\{-2, -1, 0, 1, 2\\}$"},{"en":"$\\{0\\}$","am":"$\\{0\\}$"}],"correct":1}}],"solution":{"steps":[{"text":{"en":"$A \\cup C = \\{-2, -1, 0, 1, 2\\}$","am":"$A \\cup C = \\{-2, -1, 0, 1, 2\\}$"},"why":{"en":"Integers strictly between −3 and 3.","am":"በ−3 እና በ3 መካከል ብቻ ያሉ ኢንቲጀሮች።"}},{"text":{"en":"$x^3 = x \\Rightarrow x^3 - x = 0$","am":"$x^3 = x \\Rightarrow x^3 - x = 0$"},"why":{"en":"Move everything to one side so we can factor.","am":"ለመፍታት ሁሉንም ወደ አንድ ጎን አምጡ።"}},{"text":{"en":"$x(x^2 - 1) = 0 \\Rightarrow x(x - 1)(x + 1) = 0$","am":"$x(x^2 - 1) = 0 \\Rightarrow x(x - 1)(x + 1) = 0$"},"why":{"en":"Take out x, then $x^2 - 1$ is a difference of squares.","am":"xን አውጡ፣ ከዚያ $x^2 - 1$ የካሬዎች ልዩነት ነው።"}},{"text":{"en":"$x = 0,\\ 1,\\ -1$, so $B \\cup C = \\{-1, 0, 1\\}$","am":"$x = 0,\\ 1,\\ -1$፤ ስለዚህ $B \\cup C = \\{-1, 0, 1\\}$"},"why":{"en":"A product is 0 when one factor is 0.","am":"ብዜት 0 የሚሆነው አንዱ ተባዥ 0 ሲሆን ነው።"}},{"text":{"en":"$(A \\cap B) \\cup C = (A \\cup C) \\cap (B \\cup C)$","am":"$(A \\cap B) \\cup C = (A \\cup C) \\cap (B \\cup C)$"},"why":{"en":"Distributive law: union distributes over intersection.","am":"የማሰራጨት ሕግ፦ ውህደት በመገናኛ ላይ ይሰራጫል።"}},{"text":{"en":"$= \\{-2, -1, 0, 1, 2\\} \\cap \\{-1, 0, 1\\} = \\{-1, 0, 1\\}$","am":"$= \\{-2, -1, 0, 1, 2\\} \\cap \\{-1, 0, 1\\} = \\{-1, 0, 1\\}$"},"why":{"en":"Keep the elements that are in both sets.","am":"በሁለቱም ስብስቦች ያሉትን አባላት ያዙ።"}}],"answer":{"en":"b) $\\{-1, 0, 1\\}$","am":"ለ) $\\{-1, 0, 1\\}$"}}},{"id":"h5","type":"choice","question":{"en":"Exam question: In a group of 40 boys, 28 like football while 18 like basketball. If 3 boys like neither of the games, then the number of boys who like both games is:","am":"የፈተና ጥያቄ፦ በ40 ወንዶች ቡድን ውስጥ 28ቱ እግር ኳስ፣ 18ቱ ቅርጫት ኳስ ይወዳሉ። 3 ወንዶች ሁለቱንም ጨዋታ ካልወደዱ፣ ሁለቱንም ጨዋታ የሚወዱ ወንዶች ቁጥር ስንት ነው?"},"tip":{"en":"First find how many like at least one game, then use $n(F \\cup B) = n(F) + n(B) - n(F \\cap B)$.","am":"መጀመሪያ ቢያንስ አንዱን ጨዋታ የሚወዱትን ፈልጉ፣ ከዚያ $n(F \\cup B) = n(F) + n(B) - n(F \\cap B)$ን ተጠቀሙ።"},"hints":[{"en":"Boys who like at least one game: $40 - 3$.","am":"ቢያንስ አንዱን ጨዋታ የሚወዱ፦ $40 - 3$።"},{"en":"$37 = 28 + 18 - x$. Solve for x.","am":"$37 = 28 + 18 - x$። xን ፈልጉ።"}],"answers":[{"label":{"en":"Choose the answer","am":"መልሱን ምረጡ"},"spec":{"kind":"choice","options":[{"en":"4","am":"4"},{"en":"6","am":"6"},{"en":"9","am":"9"},{"en":"12","am":"12"}],"correct":2}}],"solution":{"venn":{"sets":2,"labels":["F","B"],"elements":{"A":["19"],"AB":["9"],"B":["9"],"none":["3"]}},"steps":[{"text":{"en":"$n(F \\cup B) = 40 - 3 = 37$","am":"$n(F \\cup B) = 40 - 3 = 37$"},"why":{"en":"Everyone except the 3 who like neither game.","am":"ሁለቱንም ከማይወዱት 3 በስተቀር ሁሉም።"},"shade":"F∪B"},{"text":{"en":"$n(F \\cup B) = n(F) + n(B) - n(F \\cap B)$","am":"$n(F \\cup B) = n(F) + n(B) - n(F \\cap B)$"},"why":{"en":"Adding F and B counts the boys in both twice, so subtract them once.","am":"Fን እና Bን መደመር በሁለቱም ያሉትን ሁለት ጊዜ ይቆጥራል፤ ስለዚህ አንድ ጊዜ ቀንሱ።"}},{"text":{"en":"$37 = 28 + 18 - x = 46 - x$","am":"$37 = 28 + 18 - x = 46 - x$"},"why":{"en":"Put in the numbers, with x = boys who like both.","am":"ቁጥሮቹን አስገቡ፤ x = ሁለቱንም የሚወዱ።"}},{"text":{"en":"$x = 46 - 37 = 9$","am":"$x = 46 - 37 = 9$"},"why":{"en":"Move x to one side.","am":"xን ወደ አንድ ጎን አምጡ።"},"shade":"F∩B"},{"text":{"en":"Check: only football $28 - 9 = 19$, both 9, only basketball $18 - 9 = 9$, neither 3. $19 + 9 + 9 + 3 = 40$ ✓","am":"ማረጋገጫ፦ እግር ኳስ ብቻ $28 - 9 = 19$፣ ሁለቱም 9፣ ቅርጫት ኳስ ብቻ $18 - 9 = 9$፣ ምንም 3። $19 + 9 + 9 + 3 = 40$ ✓"},"why":{"en":"The four regions of the Venn diagram must add up to all 40 boys.","am":"የቬን ዲያግራሙ አራቱ ክፍሎች ሁሉንም 40 ወንዶች መሆን አለባቸው።"},"shade":"U"}],"answer":{"en":"c) 9","am":"ሐ) 9"}}}]$j$::jsonb,
       practice = $j$[{"id":"hw1","question":{"en":"Describe $\\{2, 4, 6, 8, 10\\}$ using set-builder notation.","am":"$\\{2, 4, 6, 8, 10\\}$ን በስብስብ መገንቢያ ግለጹ።"},"tip":{"en":"Find the rule: they are even natural numbers up to 10.","am":"ሕጉን ፈልጉ፦ እስከ 10 ያሉ ሙሉ ጥንድ የተፈጥሮ ቁጥሮች ናቸው።"},"hints":[{"en":"Every element is $2 \\times$ something.","am":"እያንዳንዱ አባል $2 \\times$ የሆነ ነገር ነው።"},{"en":"Try $x = 2k$ where $k \\in \\mathbb{N}$ and $k \\le 5$.","am":"$x = 2k$ ሞክሩ፤ $k \\in \\mathbb{N}$ እና $k \\le 5$።"}],"answers":[],"solution":{"steps":[{"text":{"en":"Look for the pattern: $2, 4, 6, 8, 10$ are $2\\times1, 2\\times2, \\dots, 2\\times5$.","am":"ቅደም ተከተሉን ፈልጉ፦ $2, 4, 6, 8, 10$ $2\\times1, 2\\times2, \\dots, 2\\times5$ ናቸው።"},"why":{"en":"Set-builder needs the RULE, so find what all the elements have in common.","am":"የስብስብ መገንቢያ ሕጉን ይፈልጋል፤ ስለዚህ የሁሉም አባላት የጋራ ባሕርይ ፈልጉ።"}},{"text":{"en":"Write the rule with $k$: $x = 2k$, $k \\in \\mathbb{N}$, $k \\le 5$.","am":"ሕጉን በ$k$ ጻፉ፦ $x = 2k$፣ $k \\in \\mathbb{N}$፣ $k \\le 5$።"},"why":{"en":"$k$ counts from 1 to 5, which gives exactly our five numbers.","am":"$k$ ከ1 እስከ 5 ይቆጥራል፤ ይህም በትክክል አምስቱን ቁጥሮቻችንን ይሰጣል።"}}],"answer":{"en":"$\\{x \\mid x = 2k,\\ k \\in \\mathbb{N},\\ k \\le 5\\}$ or $\\{x \\mid x \\text{ is an even natural number and } x \\le 10\\}$","am":"$\\{x \\mid x = 2k,\\ k \\in \\mathbb{N},\\ k \\le 5\\}$ ወይም $\\{x \\mid x \\text{ ሙሉ ጥንድ የተፈጥሮ ቁጥር እና } x \\le 10\\}$"}}},{"id":"hw2","question":{"en":"Let $A = \\{a, b, c, d\\}$. (i) How many subsets does A have? (ii) How many proper subsets?","am":"$A = \\{a, b, c, d\\}$ ይሁን። (i) A ስንት ንዑስ ስብስቦች አሉት? (ii) ስንት ትክክለኛ ንዑስ ስብስቦች?"},"tip":{"en":"Use $2^n$ and $2^n - 1$ with $n = n(A)$.","am":"$2^n$ እና $2^n - 1$ን በ$n = n(A)$ ተጠቀሙ።"},"hints":[{"en":"First count: $n(A) = 4$.","am":"መጀመሪያ ቁጠሩ፦ $n(A) = 4$።"},{"en":"$2^4 = 2 \\times 2 \\times 2 \\times 2$.","am":"$2^4 = 2 \\times 2 \\times 2 \\times 2$."}],"answers":[{"label":{"en":"(i) subsets","am":"(i) ንዑስ ስብስቦች"},"spec":{"kind":"number","value":16}},{"label":{"en":"(ii) proper subsets","am":"(ii) ትክክለኛ ንዑስ ስብስቦች"},"spec":{"kind":"number","value":15}}],"solution":{"steps":[{"text":{"en":"$n(A) = 4$","am":"$n(A) = 4$"},"why":{"en":"A has 4 elements: a, b, c, d.","am":"A 4 አባላት አሉት፦ a፣ b፣ c፣ d።"}},{"text":{"en":"Subsets $= 2^4 = 16$","am":"ንዑስ ስብስቦች $= 2^4 = 16$"},"why":{"en":"Each element is either in a subset or not: 2 choices, 4 times.","am":"እያንዳንዱ አባል በንዑስ ስብስቡ ውስጥ አለ ወይም የለም፦ 2 ምርጫዎች፣ 4 ጊዜ።"}},{"text":{"en":"Proper subsets $= 16 - 1 = 15$","am":"ትክክለኛ ንዑስ ስብስቦች $= 16 - 1 = 15$"},"why":{"en":"All subsets except A itself.","am":"ከA ራሱ በስተቀር ሁሉም ንዑስ ስብስቦች።"}}],"answer":{"en":"(i) 16 (ii) 15","am":"(i) 16 (ii) 15"}}},{"id":"hw3","question":{"en":"Let $U = \\{1, 2, \\dots, 10\\}$, $A$ = even numbers in U, $B$ = multiples of 3 in U. Find $A \\cup B$, $A \\cap B$, $A'$, $A \\setminus B$ and $A \\,\\Delta\\, B$.","am":"$U = \\{1, 2, \\dots, 10\\}$፣ $A$ = በU ውስጥ ያሉ ጥንድ ቁጥሮች፣ $B$ = በU ውስጥ ያሉ የ3 ብዜቶች ይሁኑ። $A \\cup B$፣ $A \\cap B$፣ $A'$፣ $A \\setminus B$ እና $A \\,\\Delta\\, B$ን ፈልጉ።"},"tip":{"en":"First list A and B. Then place each number in a Venn diagram.","am":"መጀመሪያ Aን እና Bን ዘርዝሩ። ከዚያ እያንዳንዱን ቁጥር በቬን ዲያግራም ውስጥ አስቀምጡ።"},"hints":[{"en":"$A = \\{2, 4, 6, 8, 10\\}$ and $B = \\{3, 6, 9\\}$.","am":"$A = \\{2, 4, 6, 8, 10\\}$ እና $B = \\{3, 6, 9\\}$።"},{"en":"Only 6 is in both; 1, 5, 7 are in neither.","am":"በሁለቱም ያለው 6 ብቻ ነው፤ 1፣ 5፣ 7 በምንም ውስጥ የሉም።"}],"answers":[{"label":{"en":"$A \\cup B$","am":"$A \\cup B$"},"spec":{"kind":"set","value":["2","3","4","6","8","9","10"]}},{"label":{"en":"$A \\cap B$","am":"$A \\cap B$"},"spec":{"kind":"set","value":["6"]}},{"label":{"en":"$A'$","am":"$A'$"},"spec":{"kind":"set","value":["1","3","5","7","9"]}},{"label":{"en":"$A \\setminus B$","am":"$A \\setminus B$"},"spec":{"kind":"set","value":["2","4","8","10"]}},{"label":{"en":"$A \\,\\Delta\\, B$","am":"$A \\,\\Delta\\, B$"},"spec":{"kind":"set","value":["2","3","4","8","9","10"]}}],"solution":{"venn":{"sets":2,"labels":["A","B"],"elements":{"A":["2","4","8","10"],"AB":["6"],"B":["3","9"],"none":["1","5","7"]}},"steps":[{"text":{"en":"$A = \\{2, 4, 6, 8, 10\\}$, $B = \\{3, 6, 9\\}$","am":"$A = \\{2, 4, 6, 8, 10\\}$, $B = \\{3, 6, 9\\}$"},"why":{"en":"List both sets before doing any operation.","am":"ማንኛውንም ስሌት ከመሥራታችሁ በፊት ሁለቱንም ስብስቦች ዘርዝሩ።"}},{"text":{"en":"$A \\cup B = \\{2, 3, 4, 6, 8, 9, 10\\}$","am":"$A \\cup B = \\{2, 3, 4, 6, 8, 9, 10\\}$"},"why":{"en":"Join them; write 6 only once.","am":"አንድ አድርጓቸው፤ 6ን አንድ ጊዜ ብቻ ጻፉ።"},"shade":"A∪B"},{"text":{"en":"$A \\cap B = \\{6\\}$","am":"$A \\cap B = \\{6\\}$"},"why":{"en":"6 is the only even multiple of 3 up to 10.","am":"እስከ 10 ያለ ብቸኛ ጥንድ የ3 ብዜት 6 ነው።"},"shade":"A∩B"},{"text":{"en":"$A' = \\{1, 3, 5, 7, 9\\}$","am":"$A' = \\{1, 3, 5, 7, 9\\}$"},"why":{"en":"Everything in U that is not even.","am":"በU ውስጥ ጥንድ ያልሆነ ሁሉ።"},"shade":"A′"},{"text":{"en":"$A \\setminus B = \\{2, 4, 8, 10\\}$","am":"$A \\setminus B = \\{2, 4, 8, 10\\}$"},"why":{"en":"A without 6.","am":"A ያለ 6።"},"shade":"A∖B"},{"text":{"en":"$B \\setminus A = \\{3, 9\\}$, so $A \\,\\Delta\\, B = \\{2, 3, 4, 8, 9, 10\\}$","am":"$B \\setminus A = \\{3, 9\\}$፣ ስለዚህ $A \\,\\Delta\\, B = \\{2, 3, 4, 8, 9, 10\\}$"},"why":{"en":"Join the two differences.","am":"ሁለቱን ልዩነቶች አንድ አድርጉ።"},"shade":"AΔB"}],"answer":{"en":"$\\{2,3,4,6,8,9,10\\}$, $\\{6\\}$, $\\{1,3,5,7,9\\}$, $\\{2,4,8,10\\}$, $\\{2,3,4,8,9,10\\}$","am":"$\\{2,3,4,6,8,9,10\\}$, $\\{6\\}$, $\\{1,3,5,7,9\\}$, $\\{2,4,8,10\\}$, $\\{2,3,4,8,9,10\\}$"}}},{"id":"hw4","question":{"en":"Using the sets in Question 3, verify that $(A \\cap B)' = A' \\cup B'$.","am":"በጥያቄ 3 ያሉትን ስብስቦች በመጠቀም $(A \\cap B)' = A' \\cup B'$ መሆኑን አረጋግጡ።"},"tip":{"en":"Work out the left side and the right side separately, then compare.","am":"የግራውንና የቀኙን ጎን ለየብቻ ሥሩ፣ ከዚያ አወዳድሩ።"},"hints":[{"en":"Left: $A \\cap B = \\{6\\}$, so take everything in U except 6.","am":"ግራ፦ $A \\cap B = \\{6\\}$፤ ስለዚህ ከ6 በስተቀር በU ያለውን ሁሉ ውሰዱ።"},{"en":"Right: $B' = \\{1, 2, 4, 5, 7, 8, 10\\}$; join it with $A'$.","am":"ቀኝ፦ $B' = \\{1, 2, 4, 5, 7, 8, 10\\}$፤ ከ$A'$ ጋር አንድ አድርጉት።"}],"answers":[{"label":{"en":"$(A \\cap B)'$","am":"$(A \\cap B)'$"},"spec":{"kind":"set","value":["1","2","3","4","5","7","8","9","10"]}}],"solution":{"venn":{"sets":2,"labels":["A","B"],"elements":{"A":["2","4","8","10"],"AB":["6"],"B":["3","9"],"none":["1","5","7"]}},"steps":[{"text":{"en":"Left: $(A \\cap B)' = U \\setminus \\{6\\} = \\{1,2,3,4,5,7,8,9,10\\}$","am":"ግራ፦ $(A \\cap B)' = U \\setminus \\{6\\} = \\{1,2,3,4,5,7,8,9,10\\}$"},"why":{"en":"The complement of $\\{6\\}$ is everything else in U.","am":"የ$\\{6\\}$ ማሟያ በU ውስጥ ያለው ሌላው ሁሉ ነው።"},"shade":"(A∩B)′"},{"text":{"en":"Right: $A' = \\{1,3,5,7,9\\}$, $B' = \\{1,2,4,5,7,8,10\\}$","am":"ቀኝ፦ $A' = \\{1,3,5,7,9\\}$፣ $B' = \\{1,2,4,5,7,8,10\\}$"},"why":{"en":"Find each complement from U.","am":"እያንዳንዱን ማሟያ ከU ፈልጉ።"}},{"text":{"en":"$A' \\cup B' = \\{1,2,3,4,5,7,8,9,10\\}$","am":"$A' \\cup B' = \\{1,2,3,4,5,7,8,9,10\\}$"},"why":{"en":"Join them: every number except 6.","am":"አንድ አድርጓቸው፦ ከ6 በስተቀር ሁሉም ቁጥሮች።"},"shade":"A′∪B′"}],"answer":{"en":"Left $=$ Right $= \\{1,2,3,4,5,7,8,9,10\\}$ ✓","am":"ግራ $=$ ቀኝ $= \\{1,2,3,4,5,7,8,9,10\\}$ ✓"}}},{"id":"hw5","question":{"en":"Using Venn diagrams, show that $A \\cap (B \\cup C) = (A \\cap B) \\cup (A \\cap C)$. Shade the left side and the right side: they must match.","am":"በቬን ዲያግራም $A \\cap (B \\cup C) = (A \\cap B) \\cup (A \\cap C)$ መሆኑን አሳዩ። ግራውንና ቀኙን ጎን አጥሉ፤ አንድ ዓይነት መሆን አለባቸው።"},"tip":{"en":"Shade $B \\cup C$ first, then keep only the part inside A.","am":"መጀመሪያ $B \\cup C$ን አጥሉ፣ ከዚያ በA ውስጥ ያለውን ክፍል ብቻ ያዙ።"},"hints":[{"en":"$B \\cup C$ is everything inside circle B or circle C.","am":"$B \\cup C$ በክበብ B ወይም በክበብ C ውስጥ ያለ ሁሉ ነው።"},{"en":"Inside A, that leaves three small regions: A∩B only, A∩C only and the centre.","am":"በA ውስጥ ሦስት ትንንሽ ክፍሎች ይቀራሉ፦ A∩B ብቻ፣ A∩C ብቻ እና መሀሉ።"}],"answers":[{"label":{"en":"Left side: $A \\cap (B \\cup C)$","am":"ግራ ጎን፦ $A \\cap (B \\cup C)$"},"spec":{"kind":"venn","venn":{"sets":3,"labels":["A","B","C"]},"regions":["AB","AC","ABC"]}},{"label":{"en":"Right side: $(A \\cap B) \\cup (A \\cap C)$","am":"ቀኝ ጎን፦ $(A \\cap B) \\cup (A \\cap C)$"},"spec":{"kind":"venn","venn":{"sets":3,"labels":["A","B","C"]},"regions":["AB","AC","ABC"]}}],"solution":{"venn":{"sets":3,"labels":["A","B","C"]},"steps":[{"text":{"en":"Left: shade $B \\cup C$.","am":"ግራ፦ $B \\cup C$ን አጥሉ።"},"why":{"en":"Work inside the bracket first.","am":"መጀመሪያ በቅንፉ ውስጥ ሥሩ።"},"shade":"B∪C"},{"text":{"en":"Keep only the part inside A: regions $A\\cap B$, $A \\cap C$ and the centre.","am":"በA ውስጥ ያለውን ብቻ ያዙ፦ $A\\cap B$፣ $A \\cap C$ እና መሀሉ።"},"why":{"en":"Intersection with A means: stay inside circle A.","am":"ከA ጋር መገናኘት ማለት በክበብ A ውስጥ መቆየት ማለት ነው።"},"shade":"A∩(B∪C)"},{"text":{"en":"Right: $A \\cap B$ and $A \\cap C$, then join them.","am":"ቀኝ፦ $A \\cap B$ እና $A \\cap C$፣ ከዚያ አንድ አድርጓቸው።"},"why":{"en":"Each is a lens-shaped overlap; together they cover the same three regions.","am":"እያንዳንዳቸው የመገናኛ ክፍል ናቸው፤ አንድ ላይ ተመሳሳዩን ሦስት ክፍሎች ይሸፍናሉ።"},"shade":"(A∩B)∪(A∩C)"}],"answer":{"en":"Both sides shade the same regions, so the identity is true.","am":"ሁለቱም ጎኖች ተመሳሳይ ክፍሎችን ያጠላሉ፤ ስለዚህ ማንነቱ እውነት ነው።"}},"type":"venn"},{"id":"hw6","question":{"en":"If $n(A) = 20$, $n(B) = 15$ and $n(A \\cap B) = 6$, find $n(A \\cup B)$, $n(A \\setminus B)$ and $n(B \\setminus A)$.","am":"$n(A) = 20$፣ $n(B) = 15$ እና $n(A \\cap B) = 6$ ከሆኑ $n(A \\cup B)$፣ $n(A \\setminus B)$ እና $n(B \\setminus A)$ን ፈልጉ።"},"tip":{"en":"$n(A \\setminus B) = n(A) - n(A \\cap B)$.","am":"$n(A \\setminus B) = n(A) - n(A \\cap B)$።"},"hints":[{"en":"Use the formula $n(A \\cup B) = n(A) + n(B) - n(A \\cap B)$.","am":"ቀመሩን ተጠቀሙ፦ $n(A \\cup B) = n(A) + n(B) - n(A \\cap B)$።"},{"en":"$20 + 15 - 6 = ?$","am":"$20 + 15 - 6 = ?$"}],"answers":[{"label":{"en":"$n(A \\cup B)$","am":"$n(A \\cup B)$"},"spec":{"kind":"number","value":29}},{"label":{"en":"$n(A \\setminus B)$","am":"$n(A \\setminus B)$"},"spec":{"kind":"number","value":14}},{"label":{"en":"$n(B \\setminus A)$","am":"$n(B \\setminus A)$"},"spec":{"kind":"number","value":9}}],"solution":{"venn":{"sets":2,"labels":["A","B"],"elements":{"A":["14"],"AB":["6"],"B":["9"]}},"steps":[{"text":{"en":"$n(A \\cup B) = 20 + 15 - 6 = 29$","am":"$n(A \\cup B) = 20 + 15 - 6 = 29$"},"why":{"en":"The 6 shared elements were counted twice, so subtract them once.","am":"6ቱ የጋራ አባላት ሁለት ጊዜ ተቆጥረዋል፤ ስለዚህ አንድ ጊዜ ቀንሷቸው።"},"shade":"A∪B"},{"text":{"en":"$n(A \\setminus B) = 20 - 6 = 14$","am":"$n(A \\setminus B) = 20 - 6 = 14$"},"why":{"en":"A without the shared part.","am":"A ያለ የጋራው ክፍል።"},"shade":"A∖B"},{"text":{"en":"$n(B \\setminus A) = 15 - 6 = 9$","am":"$n(B \\setminus A) = 15 - 6 = 9$"},"why":{"en":"B without the shared part.","am":"B ያለ የጋራው ክፍል።"},"shade":"B∖A"}],"answer":{"en":"29, 14, 9","am":"29, 14, 9"}}},{"id":"hw7","question":{"en":"In a class of 50 students, 30 like Mathematics, 25 like English and 10 like both. How many like neither subject?","am":"50 ተማሪዎች ባሉበት ክፍል 30ዎቹ ሒሳብ፣ 25ቱ እንግሊዝኛ፣ 10ሩ ሁለቱንም ይወዳሉ። ስንቶቹ ሁለቱንም አይወዱም?"},"tip":{"en":"Find $n(M \\cup E)$ first, then subtract from 50.","am":"መጀመሪያ $n(M \\cup E)$ን ፈልጉ፣ ከዚያ ከ50 ቀንሱ።"},"hints":[{"en":"$n(M \\cup E) = 30 + 25 - 10$.","am":"$n(M \\cup E) = 30 + 25 - 10$።"},{"en":"Neither $= 50 - n(M \\cup E)$.","am":"በምንም $= 50 - n(M \\cup E)$።"}],"answers":[{"label":{"en":"Neither","am":"በምንም"},"spec":{"kind":"number","value":5}}],"solution":{"venn":{"sets":2,"labels":["M","E"],"elements":{"A":["20"],"AB":["10"],"B":["15"],"none":["5"]}},"steps":[{"text":{"en":"$n(M \\cup E) = 30 + 25 - 10 = 45$","am":"$n(M \\cup E) = 30 + 25 - 10 = 45$"},"why":{"en":"Students who like at least one subject.","am":"ቢያንስ አንድ ትምህርት የሚወዱ ተማሪዎች።"},"shade":"M∪E"},{"text":{"en":"Neither $= 50 - 45 = 5$","am":"በምንም $= 50 - 45 = 5$"},"why":{"en":"Everyone else is outside both circles.","am":"ሌሎቹ ሁሉ ከሁለቱም ክበቦች ውጭ ናቸው።"},"shade":"(M∪E)′"}],"answer":{"en":"5 students","am":"5 ተማሪዎች"}}},{"id":"hw8","question":{"en":"Out of 100 students: 45 study Geography (G), 40 History (H), 35 Mathematics (M); 15 study G and H, 10 study G and M, 12 study H and M, and 5 study all three. (i) How many study at least one subject? (ii) None? (iii) Only Geography?","am":"ከ100 ተማሪዎች፦ 45ቱ ጂኦግራፊ (G)፣ 40ው ታሪክ (H)፣ 35ቱ ሒሳብ (M)፤ 15ቱ G እና H፣ 10ሩ G እና M፣ 12ቱ H እና M፣ 5ቱ ሦስቱንም ያጠናሉ። (i) ቢያንስ አንድ የሚያጠኑ ስንት ናቸው? (ii) ምንም? (iii) ጂኦግራፊ ብቻ?"},"tip":{"en":"Start from the centre (all three = 5) and work outwards in the Venn diagram.","am":"ከመሀሉ (ሦስቱም = 5) ጀምራችሁ በቬን ዲያግራሙ ወደ ውጭ ሥሩ።"},"hints":[{"en":"Use the 3-set formula: add singles, subtract pairs, add the triple.","am":"የ3 ስብስብ ቀመሩን ተጠቀሙ፦ ነጠላዎችን ደምሩ፣ ጥንዶችን ቀንሱ፣ ሦስቱን ደምሩ።"},{"en":"Only G = $45 - 15 - 10 + 5$.","am":"G ብቻ = $45 - 15 - 10 + 5$።"}],"answers":[{"label":{"en":"(i) at least one","am":"(i) ቢያንስ አንድ"},"spec":{"kind":"number","value":88}},{"label":{"en":"(ii) none","am":"(ii) ምንም"},"spec":{"kind":"number","value":12}},{"label":{"en":"(iii) only Geography","am":"(iii) ጂኦግራፊ ብቻ"},"spec":{"kind":"number","value":25}}],"solution":{"venn":{"sets":3,"labels":["G","H","M"],"elements":{"A":["25"],"B":["18"],"C":["18"],"AB":["10"],"AC":["5"],"BC":["7"],"ABC":["5"],"none":["12"]}},"steps":[{"text":{"en":"$45 + 40 + 35 = 120$","am":"$45 + 40 + 35 = 120$"},"why":{"en":"Add the singles.","am":"ነጠላዎቹን ደምሩ።"}},{"text":{"en":"$120 - 15 - 10 - 12 = 83$","am":"$120 - 15 - 10 - 12 = 83$"},"why":{"en":"Subtract the pairs (they were counted twice).","am":"ጥንዶቹን ቀንሱ (ሁለት ጊዜ ተቆጥረዋል)።"}},{"text":{"en":"$83 + 5 = 88$","am":"$83 + 5 = 88$"},"why":{"en":"Add back the triple, which we subtracted too many times.","am":"ከልክ በላይ የቀነስነውን ሦስቱን መልሳችሁ ደምሩ።"},"shade":"G∪H∪M"},{"text":{"en":"None $= 100 - 88 = 12$","am":"ምንም $= 100 - 88 = 12$"},"why":{"en":"Everyone outside all three circles.","am":"ከሦስቱም ክበቦች ውጭ ያሉ ሁሉ።"},"shade":"(G∪H∪M)′"},{"text":{"en":"Only G $= 45 - 15 - 10 + 5 = 25$","am":"G ብቻ $= 45 - 15 - 10 + 5 = 25$"},"why":{"en":"Subtract both pairs with G, then add back the 5 that were subtracted twice.","am":"ከG ጋር ያሉትን ሁለቱን ጥንዶች ቀንሱ፣ ከዚያ ሁለት ጊዜ የተቀነሱትን 5 መልሳችሁ ደምሩ።"},"shade":"G∖(H∪M)"}],"answer":{"en":"(i) 88 (ii) 12 (iii) 25","am":"(i) 88 (ii) 12 (iii) 25"}}},{"id":"hw9","question":{"en":"$A = \\{x \\in \\mathbb{Z} \\mid -2 \\le x \\le 2\\}$ and $B = \\{x \\in \\mathbb{N} \\mid x < 4\\}$. Find $A \\cap B$, $A \\setminus B$ and $B \\setminus A$.","am":"$A = \\{x \\in \\mathbb{Z} \\mid -2 \\le x \\le 2\\}$ እና $B = \\{x \\in \\mathbb{N} \\mid x < 4\\}$። $A \\cap B$፣ $A \\setminus B$ እና $B \\setminus A$ን ፈልጉ።"},"tip":{"en":"List both sets first. Remember $\\mathbb{N}$ starts at 1.","am":"መጀመሪያ ሁለቱንም ስብስቦች ዘርዝሩ። $\\mathbb{N}$ ከ1 እንደሚጀምር አስታውሱ።"},"hints":[{"en":"$A = \\{-2, -1, 0, 1, 2\\}$ ($-2$ and $2$ ARE included).","am":"$A = \\{-2, -1, 0, 1, 2\\}$ ($-2$ እና $2$ ይካተታሉ)።"},{"en":"$B = \\{1, 2, 3\\}$.","am":"$B = \\{1, 2, 3\\}$."}],"answers":[{"label":{"en":"$A \\cap B$","am":"$A \\cap B$"},"spec":{"kind":"set","value":["1","2"]}},{"label":{"en":"$A \\setminus B$","am":"$A \\setminus B$"},"spec":{"kind":"set","value":["-2","-1","0"]}},{"label":{"en":"$B \\setminus A$","am":"$B \\setminus A$"},"spec":{"kind":"set","value":["3"]}}],"solution":{"venn":{"sets":2,"labels":["A","B"],"elements":{"A":["-2","-1","0"],"AB":["1","2"],"B":["3"]}},"steps":[{"text":{"en":"$A = \\{-2, -1, 0, 1, 2\\}$, $B = \\{1, 2, 3\\}$","am":"$A = \\{-2, -1, 0, 1, 2\\}$, $B = \\{1, 2, 3\\}$"},"why":{"en":"$\\le$ includes the end numbers; $\\mathbb{N}$ has no 0.","am":"$\\le$ የመጨረሻ ቁጥሮችን ያካትታል፤ $\\mathbb{N}$ 0 የለውም።"}},{"text":{"en":"$A \\cap B = \\{1, 2\\}$","am":"$A \\cap B = \\{1, 2\\}$"},"why":{"en":"In both sets.","am":"በሁለቱም ስብስቦች።"},"shade":"A∩B"},{"text":{"en":"$A \\setminus B = \\{-2, -1, 0\\}$","am":"$A \\setminus B = \\{-2, -1, 0\\}$"},"why":{"en":"A without 1 and 2.","am":"A ያለ 1 እና 2።"},"shade":"A∖B"},{"text":{"en":"$B \\setminus A = \\{3\\}$","am":"$B \\setminus A = \\{3\\}$"},"why":{"en":"B without 1 and 2.","am":"B ያለ 1 እና 2።"},"shade":"B∖A"}],"answer":{"en":"$\\{1, 2\\}$, $\\{-2, -1, 0\\}$, $\\{3\\}$","am":"$\\{1, 2\\}$, $\\{-2, -1, 0\\}$, $\\{3\\}$"}}},{"id":"hw10","question":{"en":"True or false? (i) $\\emptyset \\subset \\{0\\}$ (ii) $0 \\in \\emptyset$ (iii) $\\{0\\} = \\emptyset$","am":"እውነት ወይስ ሐሰት? (i) $\\emptyset \\subset \\{0\\}$ (ii) $0 \\in \\emptyset$ (iii) $\\{0\\} = \\emptyset$"},"tip":{"en":"$\\emptyset$ has NO elements, but $\\{0\\}$ has one element: 0.","am":"$\\emptyset$ አባል የለውም፤ $\\{0\\}$ ግን አንድ አባል አለው፦ 0።"},"hints":[{"en":"The empty set is a subset of every set.","am":"ባዶ ስብስብ የሁሉም ስብስቦች ንዑስ ስብስብ ነው።"},{"en":"Can anything be an element of a set with no elements?","am":"አባል በሌለው ስብስብ ውስጥ አንድ ነገር አባል ሊሆን ይችላል?"}],"answers":[{"label":{"en":"(i)","am":"(i)"},"spec":{"kind":"choice","options":[{"en":"True","am":"እውነት"},{"en":"False","am":"ሐሰት"}],"correct":0}},{"label":{"en":"(ii)","am":"(ii)"},"spec":{"kind":"choice","options":[{"en":"True","am":"እውነት"},{"en":"False","am":"ሐሰት"}],"correct":1}},{"label":{"en":"(iii)","am":"(iii)"},"spec":{"kind":"choice","options":[{"en":"True","am":"እውነት"},{"en":"False","am":"ሐሰት"}],"correct":1}}],"solution":{"steps":[{"text":{"en":"(i) True","am":"(i) እውነት"},"why":{"en":"$\\emptyset$ is a subset of every set, and $\\emptyset \\ne \\{0\\}$, so it is a PROPER subset.","am":"$\\emptyset$ የሁሉም ስብስቦች ንዑስ ስብስብ ነው፤ $\\emptyset \\ne \\{0\\}$ ስለሆነ ትክክለኛ ንዑስ ስብስብ ነው።"}},{"text":{"en":"(ii) False","am":"(ii) ሐሰት"},"why":{"en":"$\\emptyset$ has no elements, so 0 cannot be in it.","am":"$\\emptyset$ አባል ስለሌለው 0 በውስጡ ሊኖር አይችልም።"}},{"text":{"en":"(iii) False","am":"(iii) ሐሰት"},"why":{"en":"$\\{0\\}$ has one element, $\\emptyset$ has none.","am":"$\\{0\\}$ አንድ አባል አለው፤ $\\emptyset$ ምንም የለውም።"}}],"answer":{"en":"True, False, False","am":"እውነት፣ ሐሰት፣ ሐሰት"}}}]$j$::jsonb,
       updated_at = now()
 where l.slug = '1-1'
   and l.unit_id in (
         select u.id from public.units u
           join public.grades g on g.id = u.grade_id
           join public.subjects s on s.id = g.subject_id
          where s.slug = 'mathematics' and g.number = 9 and u.number = 1)
   and not exists (select 1 from public.lesson_versions v where v.lesson_id = l.id);
