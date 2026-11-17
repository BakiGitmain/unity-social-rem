-- Lesson 1.2.1 Meaning of a Map
-- geography / grade 9 / Unit One
-- Generated from content/lessons/geography/grade-9/unit-1/1-2-1.json by scripts/lesson-to-sql.mjs. Do not edit by hand.

do $migration$
declare
  v_grade_id  uuid;
  v_unit_id   uuid;
  v_lesson_id uuid;
  v_quiz_id   uuid;
begin
  select g.id into v_grade_id
    from public.grades g join public.subjects s on s.id = g.subject_id
   where s.slug = 'geography' and g.number = 9;
  if v_grade_id is null then
    raise exception 'Grade 9 of subject geography does not exist';
  end if;

  -- Create the unit if it does not exist yet.
  insert into public.units (grade_id, number, slug, label_en, label_am, title_en, title_am, description_en, description_am)
  values (v_grade_id, 1, 'unit-1', 'Unit One', 'ምዕራፍ አንድ', 'The Concept of Geography and Map-Reading', 'የጂኦግራፊ ጽንሰ ሐሳብ እና ካርታ ንባብ', 'What geography is, how it became a science, its branches and scope, and how to read maps.', 'ጂኦግራፊ ምን እንደሆነ፣ እንዴት ሳይንስ እንደሆነ፣ ቅርንጫፎቹና ወሰኑ፣ እንዲሁም ካርታ እንዴት እንደሚነበብ።')
  on conflict (grade_id, number) do nothing;
  select id into v_unit_id from public.units where grade_id = v_grade_id and number = 1;

  -- Never duplicate a lesson.
  if exists (select 1 from public.lessons where unit_id = v_unit_id and code = '1.2.1') then
    raise exception 'Lesson 1.2.1 already exists in this unit';
  end if;
  insert into public.lessons (unit_id, code, slug, sort_order, title_en, title_am) values (v_unit_id, '1.2.1', '1-2-1', 8, '', '')
  returning id into v_lesson_id;
  update public.lessons set
    slug = '1-2-1', sort_order = 8, section_code = '1.2',
    section_title_en = 'Introduction to the Concept of Map-Reading', section_title_am = 'የካርታ ንባብ ጽንሰ ሐሳብ መግቢያ',
    title_en = 'Meaning of a Map', title_am = 'የካርታ ትርጉም',
    summary_en = 'What a map is, what map reading means, the seven main features of maps (bird''s-eye view, scale, symbols...) and how maps differ from globes.', summary_am = 'ካርታ ምን እንደሆነ፣ ካርታ ማንበብ ምን ማለት እንደሆነ፣ የካርታ ሰባቱ ዋና ዋና ባሕርያት (የወፍ ዓይን እይታ፣ መለኪያ፣ ምልክቶች...) እና ካርታ ከሉል እንዴት እንደሚለይ።',
    minutes = 8, main_topics = '[{"title":{"en":"Meaning of a map","am":"የካርታ ትርጉም"},"points":[{"en":"Simplified, smaller, flat picture of the earth **seen from above**.","am":"**ከላይ ሲታይ** ቀለል ያለ፣ ያነሰና ጠፍጣፋ የምድር ሥዕል።"},{"en":"Geography''s **most important tool**.","am":"የጂኦግራፊ **በጣም አስፈላጊ መሣሪያ**።"},{"en":"**Map reading** = identifying natural and man-made features.","am":"**ካርታ ማንበብ** = ተፈጥሯዊና ሰው ሠራሽ ገጽታዎችን መለየት።"}]},{"title":{"en":"The 7 features","am":"7ቱ ባሕርያት"},"points":[{"en":"All or part of the earth; **two-dimensional**; **bird''s-eye view**.","am":"የምድር ሙሉ ወይም ከፊል፤ **ባለሁለት ገጽታ**፤ **የወፍ ዓይን እይታ**።"},{"en":"**Smaller** than reality and **drawn to scale**.","am":"ከእውነታው **ያነሰ** እና **በመለኪያ የተሳለ**።"},{"en":"**Simplified**; uses **symbols** and notes (title, date, scale).","am":"**ቀለል ያለ**፤ **ምልክቶችንና** ማስታወሻዎችን (ርዕስ፣ ቀን፣ መለኪያ) ይጠቀማል።"}]},{"title":{"en":"Map vs globe","am":"ካርታ እና ሉል"},"points":[{"en":"Map: flat, part or all, some distortion, easy to carry.","am":"ካርታ፦ ጠፍጣፋ፣ ከፊል ወይም ሙሉ፣ ትንሽ መዛባት፣ ለመያዝ ቀላል።"},{"en":"Globe: round, whole earth, true shapes, hard to carry.","am":"ሉል፦ ክብ፣ መላው ምድር፣ ትክክለኛ ቅርጾች፣ ለመያዝ አስቸጋሪ።"}]}]'::jsonb, glossary = '[{"term":{"en":"Map","am":"ካርታ"},"definition":{"en":"A simplified, smaller, flat representation of all or part of the earth''s surface as seen from directly above.","am":"የምድርን ገጽ በሙሉ ወይም በከፊል ከላይ በቀጥታ ሲታይ የሚያሳይ ቀለል ያለ፣ ያነሰና ጠፍጣፋ ውክልና።"}},{"term":{"en":"Map reading","am":"ካርታ ማንበብ"},"definition":{"en":"Systematically identifying the natural and man-made features shown on a map.","am":"በካርታ ላይ የሚታዩ ተፈጥሯዊና ሰው ሠራሽ ገጽታዎችን በሥርዓት መለየት።"}},{"term":{"en":"Bird''s-eye view","am":"የወፍ ዓይን እይታ"},"definition":{"en":"A view of the earth''s surface from directly above, the way maps show it.","am":"ካርታዎች እንደሚያሳዩት የምድርን ገጽ በቀጥታ ከላይ ማየት።"}},{"term":{"en":"Two-dimensional","am":"ባለሁለት ገጽታ"},"definition":{"en":"Having only length and width (flat), with no height.","am":"ርዝመትና ስፋት ብቻ ያለው (ጠፍጣፋ)፣ ቁመት የሌለው።"}},{"term":{"en":"Scale","am":"መለኪያ"},"definition":{"en":"The ratio that shows how much the real area was reduced to fit on the map.","am":"እውነተኛው ቦታ በካርታው ላይ እንዲገጥም ምን ያህል እንደተቀነሰ የሚያሳይ ጥምርታ።"}},{"term":{"en":"Symbols","am":"ምልክቶች"},"definition":{"en":"Generally accepted signs used on maps to show natural, artificial or cultural features.","am":"ተፈጥሯዊ፣ ሰው ሠራሽ ወይም ባህላዊ ገጽታዎችን ለማሳየት በካርታ ላይ የሚጠቀሙ በጠቅላላ ተቀባይነት ያላቸው ምልክቶች።"}},{"term":{"en":"Globe","am":"ሉል"},"definition":{"en":"A round, three-dimensional model of the whole earth.","am":"የመላው ምድር ክብ፣ ባለሦስት ገጽታ ሞዴል።"}}]'::jsonb,
    homework = '[]'::jsonb, practice = '[]'::jsonb
  where id = v_lesson_id;

  insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, blocks) values
    (v_lesson_id, 1, 'What is a map?', 'ካርታ ምንድን ነው?', 'map',
     '[{"type":"keypoint","variant":"definition","title":{"en":"Map (textbook definition)","am":"ካርታ (የመማሪያ መጽሐፉ ትርጉም)"},"text":{"en":"A **map** is a simplified, diminished (made smaller), plain representation of all or part of the earth''s surface **as viewed from vertically above**.","am":"**ካርታ** የምድርን ገጽ በሙሉ ወይም በከፊል **ከላይ በቀጥታ ወደ ታች ሲታይ** የሚያሳይ ቀለል ያለ፣ የተቀነሰ (ያነሰ) እና ጠፍጣፋ ውክልና ነው።"}},{"type":"keypoint","variant":"note","title":{"en":"Another wording (exam notes)","am":"ሌላ አገላለጽ (የፈተና ማስታወሻ)"},"text":{"en":"A map is a **two-dimensional, scaled** representation of part or the whole of the earth''s surface on a flat body such as paper, a blackboard, wood or cloth.","am":"ካርታ የምድርን ገጽ በከፊል ወይም በሙሉ እንደ ወረቀት፣ ጥቁር ሰሌዳ፣ እንጨት ወይም ጨርቅ ባለ ጠፍጣፋ ነገር ላይ የሚያሳይ **ባለሁለት ገጽታ፣ በመለኪያ የተሳለ** ውክልና ነው።"}},{"type":"tip","title":{"en":"Remember","am":"አስታውሱ"},"text":{"en":"A map is the **most important tool of geography**.","am":"ካርታ **የጂኦግራፊ በጣም አስፈላጊ መሣሪያ** ነው።"}}]'::jsonb),
    (v_lesson_id, 2, 'What is map reading?', 'ካርታ ማንበብ ምንድን ነው?', 'scan-search',
     '[{"type":"keypoint","variant":"definition","title":{"en":"Map reading","am":"ካርታ ማንበብ (Map reading)"},"text":{"en":"**Map reading** is the systematic identification of the natural and man-made features shown on a map.","am":"**ካርታ ማንበብ (Map reading)** በካርታ ላይ የሚታዩ ተፈጥሯዊና ሰው ሠራሽ ገጽታዎችን በሥርዓት መለየት ነው።"}},{"type":"points","items":[{"icon":"mountain","title":{"en":"Natural features","am":"ተፈጥሯዊ ገጽታዎች"},"text":{"en":"Mountains, rivers, oceans, hills, rocks.","am":"ተራሮች፣ ወንዞች፣ ውቅያኖሶች፣ ኮረብታዎች፣ ዐለቶች።"}},{"icon":"building-2","title":{"en":"Man-made features","am":"ሰው ሠራሽ ገጽታዎች"},"text":{"en":"Roads, railways, buildings, dams.","am":"መንገዶች፣ የባቡር ሐዲዶች፣ ሕንጻዎች፣ ግድቦች።"}}]}]'::jsonb),
    (v_lesson_id, 3, 'Features of maps (1): what and how', 'የካርታ ባሕርያት (1)፦ ምንና እንዴት', 'eye',
     '[{"type":"list","ordered":true,"items":[{"en":"A map represents **all or part** of the earth''s surface: a city like Addis Ababa, the whole world, or a section of a garden.","am":"ካርታ የምድርን ገጽ **በሙሉ ወይም በከፊል** ያሳያል፦ እንደ አዲስ አበባ ያለ ከተማን፣ መላውን ዓለም ወይም የአንድን የአትክልት ቦታ ክፍል።"},{"en":"A map is a **two-dimensional (plane)** representation, e.g. printed on paper. It has length and width, but no height.","am":"ካርታ **ባለሁለት ገጽታ (ጠፍጣፋ)** ውክልና ነው፤ ለምሳሌ በወረቀት ላይ የታተመ። ርዝመትና ስፋት አለው፣ ቁመት ግን የለውም።"},{"en":"Maps show the earth as if seen from **directly above**. This is called a **bird''s-eye view**.","am":"ካርታዎች ምድርን **በቀጥታ ከላይ** እንደታየች ያሳያሉ። ይህ **የወፍ ዓይን እይታ (Bird''s-eye view)** ይባላል።"}]}]'::jsonb),
    (v_lesson_id, 4, 'Features of maps (2): size and scale', 'የካርታ ባሕርያት (2)፦ መጠንና መለኪያ', 'ruler',
     '[{"type":"list","ordered":true,"items":[{"en":"**All maps are smaller** than the area they represent.","am":"**ሁሉም ካርታዎች** ከሚያሳዩት ቦታ **ያነሱ** ናቸው።"},{"en":"Maps are **drawn to scale**: features keep the same relative proportions as in reality.","am":"ካርታዎች **በመለኪያ (Scale) ይሳላሉ**፦ ገጽታዎች በእውነታው ያላቸውን ተመጣጣኝ መጠን ይጠብቃሉ።"}]},{"type":"example","title":{"en":"Textbook example","am":"የመጽሐፉ ምሳሌ"},"text":{"en":"If one mountain is **twice as wide** as another in reality, it is drawn **twice as wide** on the map too.","am":"አንድ ተራራ በእውነታው ከሌላው **በእጥፍ ሰፊ** ከሆነ፣ በካርታውም ላይ **በእጥፍ ሰፊ** ሆኖ ይሳላል።"}}]'::jsonb),
    (v_lesson_id, 5, 'Features of maps (3): simple and symbolic', 'የካርታ ባሕርያት (3)፦ ቀላልና በምልክት', 'map-pin',
     '[{"type":"list","ordered":true,"items":[{"en":"Maps are **simplified** representations: they show only the important details.","am":"ካርታዎች **ቀለል ያሉ** ውክልናዎች ናቸው፦ አስፈላጊ ዝርዝሮችን ብቻ ያሳያሉ።"},{"en":"Most maps use **generally accepted symbols** for natural, artificial or cultural features, and **conventional notations** for the map''s title, date and scale.","am":"አብዛኞቹ ካርታዎች ለተፈጥሯዊ፣ ሰው ሠራሽ ወይም ባህላዊ ገጽታዎች **በጠቅላላ ተቀባይነት ያላቸውን ምልክቶች**፣ ለካርታው ርዕስ፣ ቀንና መለኪያ ደግሞ **የተለመዱ ማስታወሻዎችን** ይጠቀማሉ።"}]},{"type":"tip","title":{"en":"The 7 features in one line","am":"7ቱ ባሕርያት በአንድ መስመር"},"text":{"en":"**Part/all · flat · from above · smaller · to scale · simplified · symbols.**","am":"**ከፊል/ሙሉ · ጠፍጣፋ · ከላይ · ያነሰ · በመለኪያ · ቀለል ያለ · ምልክቶች።**"}}]'::jsonb),
    (v_lesson_id, 6, 'Maps and globes', 'ካርታና ሉል', 'globe',
     '[{"type":"paragraph","text":{"en":"A **globe** is a round, three-dimensional model of the earth. The textbook activity asks you to compare it with a map.","am":"**ሉል (Globe)** ክብ፣ ባለሦስት ገጽታ የምድር ሞዴል ነው። የመጽሐፉ ተግባር ከካርታ ጋር እንድታነጻጽሩ ይጠይቃል።"}},{"type":"table","headers":[{"en":"Point","am":"ነጥብ"},{"en":"Map","am":"ካርታ"},{"en":"Globe","am":"ሉል"}],"rows":[[{"en":"Shape","am":"ቅርጽ"},{"en":"Flat, two-dimensional","am":"ጠፍጣፋ፣ ባለሁለት ገጽታ"},{"en":"Round, three-dimensional","am":"ክብ፣ ባለሦስት ገጽታ"}],[{"en":"Shows","am":"የሚያሳየው"},{"en":"Part or all of the earth","am":"የምድርን ከፊል ወይም ሙሉ"},{"en":"Always the whole earth","am":"ሁልጊዜ መላውን ምድር"}],[{"en":"Accuracy","am":"ትክክለኛነት"},{"en":"Some distortion of shape and area","am":"በቅርጽና በስፋት ትንሽ መዛባት አለው"},{"en":"True shapes, areas and directions","am":"ትክክለኛ ቅርጾች፣ ስፋቶችና አቅጣጫዎች"}],[{"en":"Detail and use","am":"ዝርዝርና አጠቃቀም"},{"en":"Much detail; easy to carry","am":"ብዙ ዝርዝር፤ ለመያዝ ቀላል"},{"en":"Little detail; hard to carry","am":"ጥቂት ዝርዝር፤ ለመያዝ አስቸጋሪ"}]]}]'::jsonb);

  insert into public.quizzes (lesson_id, title_en, title_am, description_en, description_am)
  values (v_lesson_id, 'Quiz: Meaning of a Map', 'ፈተና፦ የካርታ ትርጉም', '14 questions on the definition and features of maps, and maps vs globes.', 'ስለ ካርታ ትርጉምና ባሕርያት፣ እንዲሁም ስለ ካርታና ሉል 14 ጥያቄዎች።')
  returning id into v_quiz_id;

  insert into public.quiz_questions (quiz_id, sort_order, kind, needs_calculation, question_en, question_am, options_en, options_am, correct_index, answer, steps, guide, explanation_en, explanation_am) values
    (v_quiz_id, 1, 'choice', false, 'A map shows the earth''s surface as viewed from:', 'ካርታ የምድርን ገጽ የሚያሳየው ከየት ሲታይ ነው?',
     array['The side', 'Vertically above', 'Below the ground', 'An oblique (slanting) angle']::text[],
     array['ከጎን', 'ከላይ በቀጥታ', 'ከመሬት በታች', 'ከዘመመ (ገደላማ) ማዕዘን']::text[],
     1, null, '[]'::jsonb, null,
     'A map is a representation of the earth as viewed from vertically above (bird''s-eye view).', 'ካርታ ምድርን ከላይ በቀጥታ ሲታይ (የወፍ ዓይን እይታ) የሚያሳይ ውክልና ነው።'),
    (v_quiz_id, 2, 'choice', false, 'The view of the earth from directly above is called:', 'ምድርን በቀጥታ ከላይ ማየት ምን ይባላል?',
     array['Side view', 'Bird''s-eye view', 'Physiographic view', 'Ground view']::text[],
     array['የጎን እይታ', 'የወፍ ዓይን እይታ', 'የመልክዓ ምድር እይታ', 'የመሬት እይታ']::text[],
     1, null, '[]'::jsonb, null,
     'Like a flying bird, a map looks straight down on the land.', 'ልክ እንደሚበር ወፍ፣ ካርታ መሬቱን በቀጥታ ወደ ታች ይመለከታል።'),
    (v_quiz_id, 3, 'choice', false, '"A map is a two-dimensional representation" means that a map:', '«ካርታ ባለሁለት ገጽታ ውክልና ነው» ማለት ካርታ፦',
     array['Is flat, with length and width but no height', 'Is round like a ball', 'Shows only two countries', 'Has two colours only']::text[],
     array['ርዝመትና ስፋት ያለው ቁመት የሌለው ጠፍጣፋ ነው', 'እንደ ኳስ ክብ ነው', 'ሁለት አገሮችን ብቻ ያሳያል', 'ሁለት ቀለሞች ብቻ አሉት']::text[],
     0, null, '[]'::jsonb, null,
     'Two-dimensional means flat: it is drawn on a plane surface such as paper.', 'ባለሁለት ገጽታ ማለት ጠፍጣፋ ነው፤ እንደ ወረቀት ባለ ጠፍጣፋ ገጽ ላይ ይሳላል።'),
    (v_quiz_id, 4, 'choice', false, 'Which statement about maps is correct?', 'ስለ ካርታዎች ትክክለኛው አባባል የትኛው ነው?',
     array['Some maps are larger than the area they show', 'All maps are smaller than the area they represent', 'Maps are never drawn to scale', 'Maps always show the whole world']::text[],
     array['አንዳንድ ካርታዎች ከሚያሳዩት ቦታ ይበልጣሉ', 'ሁሉም ካርታዎች ከሚያሳዩት ቦታ ያነሱ ናቸው', 'ካርታዎች ፈጽሞ በመለኪያ አይሳሉም', 'ካርታዎች ሁልጊዜ መላውን ዓለም ያሳያሉ']::text[],
     1, null, '[]'::jsonb, null,
     'A map is always a diminished (reduced) representation of reality.', 'ካርታ ሁልጊዜ የእውነታው የተቀነሰ ውክልና ነው።'),
    (v_quiz_id, 5, 'choice', false, 'If one mountain is twice as wide as another, on a map it is drawn twice as wide. This shows that maps are:', 'አንድ ተራራ ከሌላው በእጥፍ ሰፊ ከሆነ በካርታ ላይም በእጥፍ ሰፊ ሆኖ ይሳላል። ይህ ካርታዎች ምን እንደሆኑ ያሳያል?',
     array['Drawn to scale', 'Three-dimensional', 'Pictographic', 'Larger than reality']::text[],
     array['በመለኪያ የሚሳሉ', 'ባለሦስት ገጽታ', 'በሥዕል የሚገለጹ', 'ከእውነታው የሚበልጡ']::text[],
     0, null, '[]'::jsonb, null,
     'Drawing to scale keeps the same relative proportions as in reality.', 'በመለኪያ መሳል በእውነታው ያለውን ተመጣጣኝ መጠን ይጠብቃል።'),
    (v_quiz_id, 6, 'choice', false, 'Map reading is the systematic identification of:', 'ካርታ ማንበብ በሥርዓት መለየት ነው፦',
     array['Only the colours of a map', 'Natural and man-made features on a map', 'The map maker''s name', 'Only the rivers']::text[],
     array['የካርታውን ቀለሞች ብቻ', 'በካርታ ላይ ያሉ ተፈጥሯዊና ሰው ሠራሽ ገጽታዎችን', 'የካርታ ሠሪውን ስም', 'ወንዞችን ብቻ']::text[],
     1, null, '[]'::jsonb, null,
     'Map reading identifies natural features (mountains, rivers...) and man-made ones (roads, dams...).', 'ካርታ ማንበብ ተፈጥሯዊ ገጽታዎችን (ተራሮች፣ ወንዞች...) እና ሰው ሠራሽ ገጽታዎችን (መንገዶች፣ ግድቦች...) ይለያል።'),
    (v_quiz_id, 7, 'choice', false, 'Which of these is a man-made feature?', 'ከሚከተሉት ሰው ሠራሽ ገጽታ የትኛው ነው?',
     array['A river', 'A hill', 'A railway', 'An ocean']::text[],
     array['ወንዝ', 'ኮረብታ', 'የባቡር ሐዲድ', 'ውቅያኖስ']::text[],
     2, null, '[]'::jsonb, null,
     'Railways are built by people; rivers, hills and oceans are natural.', 'የባቡር ሐዲዶች በሰዎች ይሠራሉ፤ ወንዞች፣ ኮረብታዎችና ውቅያኖሶች ተፈጥሯዊ ናቸው።'),
    (v_quiz_id, 8, 'choice', false, 'A map can show:', 'ካርታ ሊያሳይ የሚችለው፦',
     array['Only the whole world', 'Only one country', 'All or part of the earth''s surface, even a garden', 'Only places with roads']::text[],
     array['መላውን ዓለም ብቻ', 'አንድን አገር ብቻ', 'የምድርን ገጽ በሙሉ ወይም በከፊል፣ የአትክልት ቦታን እንኳ', 'መንገድ ያላቸውን ቦታዎች ብቻ']::text[],
     2, null, '[]'::jsonb, null,
     'A map can show Addis Ababa, the entire world, or a section of a garden.', 'ካርታ አዲስ አበባን፣ መላውን ዓለም ወይም የአትክልት ቦታን ክፍል ሊያሳይ ይችላል።'),
    (v_quiz_id, 9, 'choice', false, 'Maps use generally accepted symbols to:', 'ካርታዎች በጠቅላላ ተቀባይነት ያላቸውን ምልክቶች የሚጠቀሙት፦',
     array['Make the map look colourful only', 'Represent natural, artificial or cultural features', 'Hide information', 'Show the height of the paper']::text[],
     array['ካርታውን ቀለማማ ለማድረግ ብቻ', 'ተፈጥሯዊ፣ ሰው ሠራሽ ወይም ባህላዊ ገጽታዎችን ለመወከል', 'መረጃን ለመደበቅ', 'የወረቀቱን ቁመት ለማሳየት']::text[],
     1, null, '[]'::jsonb, null,
     'Symbols stand for real features, so every map reader can understand them.', 'ምልክቶች እውነተኛ ገጽታዎችን ይወክላሉ፤ ስለዚህ ማንኛውም ካርታ አንባቢ ይረዳቸዋል።'),
    (v_quiz_id, 10, 'choice', false, 'Conventional notations on a map give background information such as:', 'በካርታ ላይ ያሉ የተለመዱ ማስታወሻዎች የሚሰጡት መረጃ፦',
     array['Title, date and scale', 'The reader''s name', 'The price of the map', 'The weather today']::text[],
     array['ርዕስ፣ ቀንና መለኪያ', 'የአንባቢውን ስም', 'የካርታውን ዋጋ', 'የዛሬውን የአየር ሁኔታ']::text[],
     0, null, '[]'::jsonb, null,
     'Notations such as the title, date and scale tell the reader about the map itself.', 'እንደ ርዕስ፣ ቀንና መለኪያ ያሉ ማስታወሻዎች ስለ ካርታው ራሱ ለአንባቢው ይነግራሉ።'),
    (v_quiz_id, 11, 'choice', false, 'Why is a map called a simplified representation?', 'ካርታ ቀለል ያለ ውክልና የሚባለው ለምንድን ነው?',
     array['It shows every tiny object on the ground', 'It shows only the important details', 'It is drawn by children', 'It has no symbols']::text[],
     array['በመሬት ላይ ያለውን እያንዳንዱን ትንሽ ነገር ስለሚያሳይ', 'አስፈላጊ ዝርዝሮችን ብቻ ስለሚያሳይ', 'በልጆች ስለሚሳል', 'ምንም ምልክት ስለሌለው']::text[],
     1, null, '[]'::jsonb, null,
     'A map cannot show everything, so it keeps only the important features.', 'ካርታ ሁሉንም ነገር ማሳየት አይችልም፤ ስለዚህ አስፈላጊ ገጽታዎችን ብቻ ይይዛል።'),
    (v_quiz_id, 12, 'choice', false, 'Which one is the most important tool of geography?', 'የጂኦግራፊ በጣም አስፈላጊ መሣሪያ የትኛው ነው?',
     array['The thermometer', 'The map', 'The microscope', 'The calculator']::text[],
     array['ቴርሞሜትር', 'ካርታ', 'ማይክሮስኮፕ', 'ማስሊያ']::text[],
     1, null, '[]'::jsonb, null,
     'The map is geography''s most important tool for showing locations, distances, areas and directions.', 'ካርታ አቀማመጥን፣ ርቀትን፣ ስፋትንና አቅጣጫን ለማሳየት የጂኦግራፊ በጣም አስፈላጊ መሣሪያ ነው።'),
    (v_quiz_id, 13, 'choice', false, 'Compared with a map, a globe:', 'ከካርታ ጋር ሲነጻጸር ሉል፦',
     array['Is flat and easy to fold', 'Shows true shapes of the whole earth in three dimensions', 'Shows more detail of a small town', 'Can show only one country']::text[],
     array['ጠፍጣፋና ለማጠፍ ቀላል ነው', 'የመላውን ምድር ትክክለኛ ቅርጾች በሦስት ገጽታ ያሳያል', 'የአንዲት ትንሽ ከተማን የበለጠ ዝርዝር ያሳያል', 'አንድን አገር ብቻ ማሳየት ይችላል']::text[],
     1, null, '[]'::jsonb, null,
     'A globe is round like the earth, so it keeps true shapes and areas, but has little detail.', 'ሉል እንደ ምድር ክብ ስለሆነ ትክክለኛ ቅርጾችንና ስፋቶችን ይጠብቃል፤ ዝርዝሩ ግን ጥቂት ነው።'),
    (v_quiz_id, 14, 'choice', false, 'Which of these could a map be drawn on?', 'ካርታ ከሚከተሉት በየትኛው ላይ ሊሳል ይችላል?',
     array['Paper, blackboard, wood or cloth', 'Only special map paper', 'Only a computer screen', 'Only a globe']::text[],
     array['ወረቀት፣ ጥቁር ሰሌዳ፣ እንጨት ወይም ጨርቅ', 'በልዩ የካርታ ወረቀት ላይ ብቻ', 'በኮምፒውተር ስክሪን ላይ ብቻ', 'በሉል ላይ ብቻ']::text[],
     0, null, '[]'::jsonb, null,
     'Any flat body works: paper, a blackboard, wood or cloth.', 'ማንኛውም ጠፍጣፋ ነገር ይሆናል፦ ወረቀት፣ ጥቁር ሰሌዳ፣ እንጨት ወይም ጨርቅ።');
end
$migration$;
