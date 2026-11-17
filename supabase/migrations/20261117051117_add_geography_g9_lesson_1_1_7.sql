-- Lesson 1.1.7 Geography and Other Disciplines (with Review of 1.1)
-- geography / grade 9 / Unit One
-- Generated from content/lessons/geography/grade-9/unit-1/1-1-7.json by scripts/lesson-to-sql.mjs. Do not edit by hand.

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
  if exists (select 1 from public.lessons where unit_id = v_unit_id and code = '1.1.7') then
    raise exception 'Lesson 1.1.7 already exists in this unit';
  end if;
  insert into public.lessons (unit_id, code, slug, sort_order, title_en, title_am) values (v_unit_id, '1.1.7', '1-1-7', 7, '', '')
  returning id into v_lesson_id;
  update public.lessons set
    slug = '1-1-7', sort_order = 7, section_code = '1.1',
    section_title_en = 'The Science of Geography', section_title_am = 'የጂኦግራፊ ሳይንስ',
    title_en = 'Geography and Other Disciplines (with Review of 1.1)', title_am = 'ጂኦግራፊና ሌሎች የትምህርት ዘርፎች (ከ1.1 ክለሳ ጋር)',
    summary_en = 'Geography is an interdisciplinary subject linked to both the natural and the social sciences. Ends with a summary and review exercise of the whole of section 1.1.', summary_am = 'ጂኦግራፊ ከተፈጥሮና ከማኅበራዊ ሳይንሶች ጋር የተያያዘ ሁለገብ የትምህርት ዘርፍ ነው። የክፍል 1.1 ማጠቃለያና የክለሳ መልመጃ ይዟል።',
    minutes = 8, main_topics = '[{"title":{"en":"An interdisciplinary subject","am":"ሁለገብ የትምህርት ዘርፍ"},"points":[{"en":"Physical geography ↔ **natural sciences**.","am":"የተፈጥሮ ጂኦግራፊ ↔ **የተፈጥሮ ሳይንሶች**።"},{"en":"Human geography ↔ **social sciences**.","am":"የሰው ጂኦግራፊ ↔ **ማኅበራዊ ሳይንሶች**።"}]},{"title":{"en":"Key pairs","am":"ዋና ጥንዶች"},"points":[{"en":"Biology → **biogeography**; Meteorology → **climatology**.","am":"ባዮሎጂ → **ባዮጂኦግራፊ**፤ ሜትሮሎጂ → **ክላይማቶሎጂ**።"},{"en":"Geology → **geomorphology & soil geography**.","am":"ጂኦሎጂ → **ጂኦሞርፎሎጂና የአፈር ጂኦግራፊ**።"},{"en":"Demography → **population geography**; Economics → **economic geography**.","am":"ዲሞግራፊ → **የሕዝብ ጂኦግራፊ**፤ ኢኮኖሚክስ → **የኢኮኖሚ ጂኦግራፊ**።"}]},{"title":{"en":"Review of 1.1","am":"የ1.1 ክለሳ"},"points":[{"en":"**Regional** = all aspects of one region; **systematic** = one phenomenon globally.","am":"**ክልላዊ** = የአንድ ክልል ሁሉም ገጽታዎች፤ **ሥርዓታዊ** = አንድ ክስተት በዓለም ደረጃ።"},{"en":"Determinism (nature decides) vs possibilism (two-way).","am":"ወሳኝነት (ተፈጥሮ ትወስናለች) እና ዕድላዊነት (የሁለትዮሽ)።"},{"en":"Quantitative Revolution → statistics; applied geography → solving problems.","am":"መጠናዊ አብዮት → ስታቲስቲክስ፤ ተግባራዊ ጂኦግራፊ → ችግር መፍታት።"}]}]'::jsonb, glossary = '[{"term":{"en":"Interdisciplinary subject","am":"ሁለገብ የትምህርት ዘርፍ"},"definition":{"en":"A subject that shares knowledge and methods with many other disciplines.","am":"ከብዙ ሌሎች የትምህርት ዘርፎች ጋር እውቀትንና ዘዴዎችን የሚጋራ የትምህርት ዘርፍ።"}},{"term":{"en":"Meteorology","am":"ሜትሮሎጂ"},"definition":{"en":"The science of the atmosphere and weather; related to climatology.","am":"የከባቢ አየርና የአየር ሁኔታ ሳይንስ፤ ከክላይማቶሎጂ ጋር ይዛመዳል።"}},{"term":{"en":"Geology","am":"ጂኦሎጂ"},"definition":{"en":"The science of rocks and the structure of the earth; related to geomorphology and soil geography.","am":"የዐለቶችና የምድር አወቃቀር ሳይንስ፤ ከጂኦሞርፎሎጂና ከአፈር ጂኦግራፊ ጋር ይዛመዳል።"}},{"term":{"en":"Demography","am":"ዲሞግራፊ"},"definition":{"en":"The study of human population (size, growth, structure); related to population geography.","am":"የሰው ሕዝብ (ብዛት፣ ዕድገት፣ አወቃቀር) ጥናት፤ ከሕዝብ ጂኦግራፊ ጋር ይዛመዳል።"}},{"term":{"en":"Biogeography","am":"ሥነ ሕይወታዊ ጂኦግራፊ"},"definition":{"en":"The field of geography that studies how plants and animals are distributed.","am":"ዕፅዋትና እንስሳት እንዴት እንደተሰራጩ የሚያጠና የጂኦግራፊ ዘርፍ።"}},{"term":{"en":"Anthroposphere","am":"አንትሮፖስፌር"},"definition":{"en":"The part of the geosphere that represents the cultural (human-made) landscape of the earth.","am":"የምድርን ባህላዊ (ሰው ሠራሽ) ገጽታ የሚወክለው የጂኦስፌር ክፍል።"}},{"term":{"en":"Systematic approach","am":"ሥርዓታዊ አቀራረብ"},"definition":{"en":"Studying one or two elements (e.g. climate) and their distribution over a wide area or the world.","am":"አንድ ወይም ሁለት ነገሮችን (ለምሳሌ የአየር ንብረት) እና በሰፊ ቦታ ወይም በዓለም ያላቸውን ስርጭት ማጥናት።"}},{"term":{"en":"Regional approach","am":"ክልላዊ አቀራረብ"},"definition":{"en":"Studying all the aspects of one defined region, e.g. the geography of Africa.","am":"የአንድን የተወሰነ ክልል ሁሉንም ገጽታዎች ማጥናት፤ ለምሳሌ የአፍሪካ ጂኦግራፊ።"}}]'::jsonb,
    homework = '[]'::jsonb, practice = '[]'::jsonb
  where id = v_lesson_id;

  insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, blocks) values
    (v_lesson_id, 1, 'An interdisciplinary subject', 'ሁለገብ የትምህርት ዘርፍ', 'git-branch',
     '[{"type":"keypoint","variant":"definition","title":{"en":"Interdisciplinary subject","am":"ሁለገብ የትምህርት ዘርፍ (Interdisciplinary subject)"},"text":{"en":"Geography is an **interdisciplinary subject**: it shares knowledge with many other disciplines.","am":"ጂኦግራፊ **ሁለገብ የትምህርት ዘርፍ (Interdisciplinary subject)** ነው፤ ከብዙ ሌሎች የትምህርት ዘርፎች ጋር እውቀትን ይጋራል።"}},{"type":"paragraph","text":{"en":"It has strong links with both the **natural sciences** and the **social sciences**.","am":"ከ**ተፈጥሮ ሳይንሶች** እና ከ**ማኅበራዊ ሳይንሶች** ጋር ጠንካራ ግንኙነት አለው።"}},{"type":"points","items":[{"icon":"mountain","title":{"en":"Physical geography","am":"የተፈጥሮ ጂኦግራፊ (Physical Geography)"},"text":{"en":"is linked to the **natural sciences**.","am":"ከ**ተፈጥሮ ሳይንሶች** ጋር ይያያዛል።"}},{"icon":"users","title":{"en":"Human geography","am":"የሰው ጂኦግራፊ (Human Geography)"},"text":{"en":"is linked to the **social sciences**.","am":"ከ**ማኅበራዊ ሳይንሶች** ጋር ይያያዛል።"}}]}]'::jsonb),
    (v_lesson_id, 2, 'Links with the natural sciences', 'ከተፈጥሮ ሳይንሶች ጋር ያለ ግንኙነት', 'flask-conical',
     '[{"type":"table","headers":[{"en":"Discipline","am":"የትምህርት ዘርፍ"},{"en":"Related field of geography","am":"ተዛማጅ የጂኦግራፊ ዘርፍ"}],"rows":[[{"en":"**Biology**","am":"**ባዮሎጂ**"},{"en":"Biogeography","am":"ሥነ ሕይወታዊ ጂኦግራፊ (Biogeography)"}],[{"en":"**Meteorology**","am":"**ሜትሮሎጂ**"},{"en":"Climatology","am":"ክላይማቶሎጂ (Climatology)"}],[{"en":"**Geology**","am":"**ጂኦሎጂ**"},{"en":"Geomorphology and soil geography","am":"ጂኦሞርፎሎጂ እና የአፈር ጂኦግራፊ"}],[{"en":"**Astronomy, chemistry, mathematics**","am":"**አስትሮኖሚ፣ ኬሚስትሪ፣ ሒሳብ**"},{"en":"The earth in space, soils and water, maps and statistics","am":"ምድር በኅዋ፣ አፈርና ውኃ፣ ካርታና ስታቲስቲክስ"}]]},{"type":"tip","title":{"en":"Matching trick","am":"የማዛመድ ዘዴ"},"text":{"en":"**Bio**logy → **Bio**geography. **Geo**logy → **Geo**morphology. The first letters help!","am":"**ባዮ**ሎጂ → **ባዮ**ጂኦግራፊ። **ጂኦ**ሎጂ → **ጂኦ**ሞርፎሎጂ። የመጀመሪያዎቹ ፊደላት ይረዳሉ!"}}]'::jsonb),
    (v_lesson_id, 3, 'Links with the social sciences', 'ከማኅበራዊ ሳይንሶች ጋር ያለ ግንኙነት', 'landmark',
     '[{"type":"table","headers":[{"en":"Discipline","am":"የትምህርት ዘርፍ"},{"en":"Related field of geography","am":"ተዛማጅ የጂኦግራፊ ዘርፍ"}],"rows":[[{"en":"**Economics**","am":"**ኢኮኖሚክስ**"},{"en":"Economic geography","am":"የኢኮኖሚ ጂኦግራፊ"}],[{"en":"**Political science**","am":"**ፖለቲካል ሳይንስ**"},{"en":"Political geography","am":"ፖለቲካዊ ጂኦግራፊ"}],[{"en":"**History**","am":"**ታሪክ**"},{"en":"Historical geography","am":"ታሪካዊ ጂኦግራፊ"}],[{"en":"**Demography**","am":"**ዲሞግራፊ (የሕዝብ ጥናት)**"},{"en":"Population geography","am":"የሕዝብ ጂኦግራፊ"}],[{"en":"**Sociology**","am":"**ሶሺዮሎጂ**"},{"en":"Cultural (social) geography","am":"የባህል (ማኅበራዊ) ጂኦግራፊ"}]]},{"type":"example","title":{"en":"Example","am":"ምሳሌ"},"text":{"en":"To plan a new school in a town, a geographer uses **demography** (how many children), **economics** (cost) and **maps** (where).","am":"በአንድ ከተማ አዲስ ትምህርት ቤት ለማቀድ ጂኦግራፈር **ዲሞግራፊን** (ስንት ልጆች)፣ **ኢኮኖሚክስን** (ወጪ) እና **ካርታን** (የት) ይጠቀማል።"}}]'::jsonb),
    (v_lesson_id, 4, 'Summary of 1.1 (part 1)', 'የ1.1 ማጠቃለያ (ክፍል 1)', 'list-checks',
     '[{"type":"list","items":[{"en":"**Geography** is a systematic study of the spatial distribution of phenomena on the earth''s surface and of the **two-way interaction** between natural and human environments.","am":"**ጂኦግራፊ** በምድር ገጽ ላይ ያሉ ክስተቶችን ቦታዊ ስርጭት እና በተፈጥሮና በሰው አካባቢዎች መካከል ያለውን **የሁለትዮሽ መስተጋብር** የሚያጠና ሥርዓታዊ ጥናት ነው።"},{"en":"Its **scope** is very wide: lithosphere, hydrosphere, atmosphere, biosphere and anthroposphere.","am":"**ወሰኑ** በጣም ሰፊ ነው፦ ሊቶስፌር፣ ሃይድሮስፌር፣ አትሞስፌር፣ ባዮስፌር እና አንትሮፖስፌር።"},{"en":"Two approaches: the **regional approach** (all aspects of one region) and the **systematic approach**, also called topical (one phenomenon over a wide area or the world).","am":"ሁለት አቀራረቦች፦ **ክልላዊ አቀራረብ** (የአንድ ክልል ሁሉም ገጽታዎች) እና **ሥርዓታዊ አቀራረብ**፣ ርዕሳዊም ይባላል (አንድ ክስተት በሰፊ ቦታ ወይም በዓለም)።"}]}]'::jsonb),
    (v_lesson_id, 5, 'Summary of 1.1 (part 2)', 'የ1.1 ማጠቃለያ (ክፍል 2)', 'brain',
     '[{"type":"points","items":[{"icon":"mountain","title":{"en":"Determinism","am":"ወሳኝነት (Determinism)"},"text":{"en":"The environment determines people''s way of living.","am":"አካባቢ የሰዎችን አኗኗር ይወስናል።"}},{"icon":"sprout","title":{"en":"Possibilism","am":"ዕድላዊነት (Possibilism)"},"text":{"en":"Two-way relationship; people can change the environment.","am":"የሁለትዮሽ ግንኙነት፤ ሰዎች አካባቢን መለወጥ ይችላሉ።"}},{"icon":"flask-conical","title":{"en":"Quantitative Revolution","am":"መጠናዊ አብዮት"},"text":{"en":"1950s–1960s; brought statistical techniques into geography.","am":"1950ዎቹ–1960ዎቹ፤ ስታቲስቲካዊ ዘዴዎችን ወደ ጂኦግራፊ አመጣ።"}},{"icon":"lightbulb","title":{"en":"Applied geography","am":"ተግባራዊ ጂኦግራፊ"},"text":{"en":"Made geography practical: solves socio-economic and environmental problems.","am":"ጂኦግራፊን ተግባራዊ አደረገ፦ ማኅበራዊ-ኢኮኖሚያዊና አካባቢያዊ ችግሮችን ይፈታል።"}},{"icon":"git-branch","title":{"en":"Other disciplines","am":"ሌሎች ዘርፎች"},"text":{"en":"Geography shares information with the social and natural sciences.","am":"ጂኦግራፊ ከማኅበራዊና ከተፈጥሮ ሳይንሶች ጋር መረጃ ይጋራል።"}}]}]'::jsonb),
    (v_lesson_id, 6, 'Exam traps from the review exercise', 'ከክለሳ መልመጃው የፈተና ወጥመዶች', 'target',
     '[{"type":"example","title":{"en":"Regional vs systematic","am":"ክልላዊ እና ሥርዓታዊ"},"text":{"en":"\"Systematic geography is the study of the general characteristics of a region\" is **FALSE**. That describes the **regional** approach.","am":"«ሥርዓታዊ ጂኦግራፊ የአንድ ክልል አጠቃላይ ባሕርያት ጥናት ነው» የሚለው **ሐሰት** ነው። ይህ **ክልላዊ** አቀራረብን ይገልጻል።"}},{"type":"example","title":{"en":"One definition?","am":"አንድ ትርጉም?"},"text":{"en":"Geography does **not have one single definition**, and its definition changes over time.","am":"ጂኦግራፊ **አንድ ብቻ ትርጉም የለውም**፤ ትርጉሙም በጊዜ ሂደት ይለወጣል።"}},{"type":"example","title":{"en":"Who is who?","am":"ማን ማን ነው?"},"text":{"en":"**Eratosthenes** coined the word \"geography\". **Ratzel** (German) showed how people are influenced by the environment. **Demolins** supported determinism; **Febvre** supported possibilism.","am":"**ኤራቶስቴንስ** «ጂኦግራፊ» የሚለውን ቃል ፈጠረ። **ራትዘል** (ጀርመናዊ) ሰዎች በአካባቢ እንዴት እንደሚጎዱ አሳየ። **ዴሞላን** ወሳኝነትን ደገፈ፤ **ፌብቭር** ዕድላዊነትን ደገፈ።"}}]'::jsonb);

  insert into public.quizzes (lesson_id, title_en, title_am, description_en, description_am)
  values (v_lesson_id, 'Quiz: Geography, Other Disciplines and Review of 1.1', 'ፈተና፦ ጂኦግራፊ፣ ሌሎች ዘርፎችና የ1.1 ክለሳ', '18 questions, including the unit review exercise (true/false, matching, multiple choice and fill-in).', '18 ጥያቄዎች፣ የምዕራፉን የክለሳ መልመጃ (እውነት/ሐሰት፣ ማዛመድ፣ ምርጫና ባዶ ቦታ መሙላት) ጨምሮ።')
  returning id into v_quiz_id;

  insert into public.quiz_questions (quiz_id, sort_order, kind, needs_calculation, question_en, question_am, options_en, options_am, correct_index, answer, steps, guide, explanation_en, explanation_am) values
    (v_quiz_id, 1, 'choice', false, 'Geography is called an interdisciplinary subject because it:', 'ጂኦግራፊ ሁለገብ የትምህርት ዘርፍ የሚባለው፦',
     array['Studies only maps', 'Has strong links with both natural and social sciences', 'Has no relationship with other disciplines', 'Is a branch of history only']::text[],
     array['ካርታዎችን ብቻ ስለሚያጠና', 'ከተፈጥሮና ከማኅበራዊ ሳይንሶች ጋር ጠንካራ ግንኙነት ስላለው', 'ከሌሎች ዘርፎች ጋር ምንም ግንኙነት ስለሌለው', 'የታሪክ ቅርንጫፍ ብቻ ስለሆነ']::text[],
     1, null, '[]'::jsonb, null,
     'Geography shares information with both the natural and the social sciences.', 'ጂኦግራፊ ከተፈጥሮና ከማኅበራዊ ሳይንሶች ጋር መረጃ ይጋራል።'),
    (v_quiz_id, 2, 'choice', false, 'Meteorology relates most closely with:', 'ሜትሮሎጂ በቅርብ የሚዛመደው ከ፦',
     array['Biogeography', 'Climatology', 'Political geography', 'Urban geography']::text[],
     array['ባዮጂኦግራፊ', 'ክላይማቶሎጂ', 'ፖለቲካዊ ጂኦግራፊ', 'የከተማ ጂኦግራፊ']::text[],
     1, null, '[]'::jsonb, null,
     'Meteorology (weather science) relates to climatology (study of climate).', 'ሜትሮሎጂ (የአየር ሁኔታ ሳይንስ) ከክላይማቶሎጂ (የአየር ንብረት ጥናት) ጋር ይዛመዳል።'),
    (v_quiz_id, 3, 'choice', false, 'Geology links with:', 'ጂኦሎጂ የሚያያዘው ከ፦',
     array['Geomorphology and soil geography', 'Cultural geography', 'Economic geography', 'Medical geography']::text[],
     array['ጂኦሞርፎሎጂና የአፈር ጂኦግራፊ', 'የባህል ጂኦግራፊ', 'የኢኮኖሚ ጂኦግራፊ', 'የሕክምና ጂኦግራፊ']::text[],
     0, null, '[]'::jsonb, null,
     'Geology studies rocks; geomorphology studies landforms and soil geography studies soils, both made from rocks.', 'ጂኦሎጂ ዐለቶችን ያጠናል፤ ጂኦሞርፎሎጂ የመሬት ቅርጾችን፣ የአፈር ጂኦግራፊ ደግሞ አፈርን ያጠናሉ፤ ሁለቱም ከዐለት የተሠሩ ናቸው።'),
    (v_quiz_id, 4, 'choice', false, 'Human geography is highly linked with:', 'የሰው ጂኦግራፊ በጣም የሚያያዘው ከ፦',
     array['The natural sciences', 'The social sciences', 'Astronomy only', 'Chemistry only']::text[],
     array['የተፈጥሮ ሳይንሶች', 'ማኅበራዊ ሳይንሶች', 'አስትሮኖሚ ብቻ', 'ኬሚስትሪ ብቻ']::text[],
     1, null, '[]'::jsonb, null,
     'Human geography is linked to the social sciences; physical geography to the natural sciences.', 'የሰው ጂኦግራፊ ከማኅበራዊ ሳይንሶች፣ የተፈጥሮ ጂኦግራፊ ደግሞ ከተፈጥሮ ሳይንሶች ጋር ይያያዛል።'),
    (v_quiz_id, 5, 'choice', false, 'A branch of geography that deals with the dynamic and static aspects of population is:', 'የሕዝብን ተለዋዋጭና ቋሚ ገጽታዎች የሚያጠና የጂኦግራፊ ቅርንጫፍ፦',
     array['Political geography', 'Population geography (demography)', 'Biogeography', 'Climatology']::text[],
     array['ፖለቲካዊ ጂኦግራፊ', 'የሕዝብ ጂኦግራፊ (ዲሞግራፊ)', 'ባዮጂኦግራፊ', 'ክላይማቶሎጂ']::text[],
     1, null, '[]'::jsonb, null,
     'Population geography (linked to demography) studies the size, growth and structure of population.', 'የሕዝብ ጂኦግራፊ (ከዲሞግራፊ ጋር የተያያዘ) የሕዝብን ብዛት፣ ዕድገትና አወቃቀር ያጠናል።'),
    (v_quiz_id, 6, 'choice', false, 'A branch of geography that deals with boundaries and activities between countries in relation to political power is:', 'ከፖለቲካ ሥልጣን ጋር በተያያዘ የአገሮችን ድንበሮችና እንቅስቃሴዎች የሚያጠና የጂኦግራፊ ቅርንጫፍ፦',
     array['Political geography', 'Economic geography', 'Applied geography', 'Historical geography']::text[],
     array['ፖለቲካዊ ጂኦግራፊ', 'የኢኮኖሚ ጂኦግራፊ', 'ተግባራዊ ጂኦግራፊ', 'ታሪካዊ ጂኦግራፊ']::text[],
     0, null, '[]'::jsonb, null,
     'Political geography studies political systems, boundaries and how power is used across space.', 'ፖለቲካዊ ጂኦግራፊ የፖለቲካ ሥርዓቶችን፣ ድንበሮችንና ሥልጣን በቦታ እንዴት እንደሚተገበር ያጠናል።'),
    (v_quiz_id, 7, 'choice', false, '"Systematic geography is the study of the general characteristics of a region." This is:', '«ሥርዓታዊ ጂኦግራፊ የአንድ ክልል አጠቃላይ ባሕርያት ጥናት ነው።» ይህ፦',
     array['True', 'False: that is the regional approach', 'False: that is determinism', 'True only for Africa']::text[],
     array['እውነት', 'ሐሰት፦ ይህ ክልላዊ አቀራረብ ነው', 'ሐሰት፦ ይህ ወሳኝነት ነው', 'ለአፍሪካ ብቻ እውነት']::text[],
     1, null, '[]'::jsonb, null,
     'The regional approach studies all aspects of one region; the systematic approach studies one phenomenon globally.', 'ክልላዊ አቀራረብ የአንድ ክልልን ሁሉንም ገጽታዎች ያጠናል፤ ሥርዓታዊ አቀራረብ አንድን ክስተት በዓለም ደረጃ ያጠናል።'),
    (v_quiz_id, 8, 'choice', false, 'A geographic approach that singles out one or two elements and treats their distribution globally is:', 'አንድ ወይም ሁለት ነገሮችን መርጦ ስርጭታቸውን በዓለም ደረጃ የሚያጠና አቀራረብ፦',
     array['The regional approach', 'The topical (systematic) approach', 'Possibilism', 'Demography']::text[],
     array['ክልላዊ አቀራረብ', 'ርዕሳዊ (ሥርዓታዊ) አቀራረብ', 'ዕድላዊነት', 'ዲሞግራፊ']::text[],
     1, null, '[]'::jsonb, null,
     'The topical or systematic approach follows one element (e.g. climate) across the world.', 'ርዕሳዊ ወይም ሥርዓታዊ አቀራረብ አንድን ነገር (ለምሳሌ የአየር ንብረት) በዓለም ዙሪያ ይከታተላል።'),
    (v_quiz_id, 9, 'choice', false, '"According to the determinist approach, humans cannot change or influence the environment." This is:', '«በወሳኝነት አቀራረብ መሠረት ሰዎች አካባቢን መለወጥ ወይም ተጽዕኖ ማሳደር አይችሉም።» ይህ፦',
     array['True', 'False', 'True only in Europe', 'It is the view of possibilism']::text[],
     array['እውነት', 'ሐሰት', 'በአውሮፓ ብቻ እውነት', 'የዕድላዊነት አመለካከት ነው']::text[],
     0, null, '[]'::jsonb, null,
     'Determinists see humans as passive agents controlled by the environment.', 'የወሳኝነት አራማጆች ሰዎችን በአካባቢ ቁጥጥር ሥር ያሉ ተገዢዎች አድርገው ይመለከቷቸዋል።'),
    (v_quiz_id, 10, 'choice', false, '"The facts and principles of the natural sciences can be applied in geography." This is:', '«የተፈጥሮ ሳይንሶች እውነታዎችና መርሆዎች በጂኦግራፊ ሊተገበሩ ይችላሉ።» ይህ፦',
     array['False, geography is only a social science', 'True, geography is interdisciplinary', 'False, only mathematics applies', 'True only for human geography']::text[],
     array['ሐሰት፣ ጂኦግራፊ ማኅበራዊ ሳይንስ ብቻ ነው', 'እውነት፣ ጂኦግራፊ ሁለገብ ነው', 'ሐሰት፣ የሚተገበረው ሒሳብ ብቻ ነው', 'ለሰው ጂኦግራፊ ብቻ እውነት']::text[],
     1, null, '[]'::jsonb, null,
     'Physical geography uses facts from biology, geology, meteorology and more.', 'የተፈጥሮ ጂኦግራፊ ከባዮሎጂ፣ ከጂኦሎጂ፣ ከሜትሮሎጂና ከሌሎችም እውነታዎችን ይጠቀማል።'),
    (v_quiz_id, 11, 'choice', false, 'Which of the following opinions is correct?', 'ከሚከተሉት አስተያየቶች ትክክለኛው የትኛው ነው?',
     array['The definition of geography is static', 'Geography does not have one single definition', 'Geography has no relationship with other disciplines', 'The definition of geography never changes']::text[],
     array['የጂኦግራፊ ትርጉም አይለወጥም', 'ጂኦግራፊ አንድ ብቻ ትርጉም የለውም', 'ጂኦግራፊ ከሌሎች ዘርፎች ጋር ግንኙነት የለውም', 'የጂኦግራፊ ትርጉም ፈጽሞ አይለወጥም']::text[],
     1, null, '[]'::jsonb, null,
     'Geography has been defined differently from the ancient Greeks to modern times.', 'ጂኦግራፊ ከጥንታዊ ግሪኮች እስከ ዘመናችን በተለያየ መንገድ ተተርጉሟል።'),
    (v_quiz_id, 12, 'choice', false, 'Which statement about geography is correct?', 'ስለ ጂኦግራፊ ትክክለኛው አባባል የትኛው ነው?',
     array['Physical phenomena are evenly distributed on the earth', 'There is a one-way relationship between humans and their environment', 'Elements of the natural environment affect the way of life of its inhabitants', 'Human beings cannot modify their environment']::text[],
     array['የተፈጥሮ ክስተቶች በምድር ላይ እኩል ተሰራጭተዋል', 'በሰውና በአካባቢው መካከል የአንድ አቅጣጫ ግንኙነት አለ', 'የተፈጥሮ አካባቢ ነገሮች የነዋሪዎቹን አኗኗር ይነካሉ', 'ሰዎች አካባቢያቸውን መለወጥ አይችሉም']::text[],
     2, null, '[]'::jsonb, null,
     'The environment does affect how people live (the relationship is two-way). The other options are false.', 'አካባቢ ሰዎች እንዴት እንደሚኖሩ ይነካል (ግንኙነቱ የሁለትዮሽ ነው)። ሌሎቹ አማራጮች ሐሰት ናቸው።'),
    (v_quiz_id, 13, 'choice', false, 'Which statement reflects the deterministic outlook?', 'የወሳኝነትን አመለካከት የሚያንጸባርቀው አባባል የትኛው ነው?',
     array['Self-reliance', 'People in cold climates are stronger and braver than those in warm climates', 'Humans are capable of modifying their environment', 'Social structure is explained by human activities']::text[],
     array['በራስ መተማመን', 'በቀዝቃዛ የአየር ንብረት የሚኖሩ ሰዎች በሞቃት ከሚኖሩት የበለጠ ጠንካራና ደፋር ናቸው', 'ሰዎች አካባቢያቸውን መለወጥ ይችላሉ', 'ማኅበራዊ አወቃቀር በሰው እንቅስቃሴዎች ይብራራል']::text[],
     1, null, '[]'::jsonb, null,
     'Saying climate decides people''s strength and character is a deterministic idea.', 'የአየር ንብረት የሰዎችን ጥንካሬና ባሕርይ ይወስናል ማለት የወሳኝነት ሐሳብ ነው።'),
    (v_quiz_id, 14, 'choice', false, 'A German geographer who tried to show how people adapt to and are influenced by the environment was:', 'ሰዎች ከአካባቢ ጋር እንዴት እንደሚላመዱና በአካባቢ እንዴት እንደሚጎዱ ለማሳየት የሞከረው ጀርመናዊ ጂኦግራፈር፦',
     array['Friedrich Ratzel', 'Febvre', 'Eratosthenes', 'Hartshorne']::text[],
     array['ፍሬድሪክ ራትዘል', 'ፌብቭር', 'ኤራቶስቴንስ', 'ሃርትሾርን']::text[],
     0, null, '[]'::jsonb, null,
     'Friedrich Ratzel, a German determinist, studied how the environment influences people.', 'ጀርመናዊው የወሳኝነት አራማጅ ፍሬድሪክ ራትዘል አካባቢ በሰዎች ላይ እንዴት ተጽዕኖ እንደሚያሳድር አጥንቷል።'),
    (v_quiz_id, 15, 'choice', false, 'The sub-field of geography that studies how plants and animals are distributed is:', 'ዕፅዋትና እንስሳት እንዴት እንደተሰራጩ የሚያጠናው የጂኦግራፊ ንዑስ ዘርፍ፦',
     array['Geomorphology', 'Biogeography', 'Oceanography', 'Climatology']::text[],
     array['ጂኦሞርፎሎጂ', 'ባዮጂኦግራፊ', 'ውቅያኖስ ጥናት', 'ክላይማቶሎጂ']::text[],
     1, null, '[]'::jsonb, null,
     'Biogeography studies plants and animals in relation to their environments.', 'ባዮጂኦግራፊ ዕፅዋትንና እንስሳትን ከአካባቢያቸው ጋር በማያያዝ ያጠናል።'),
    (v_quiz_id, 16, 'choice', false, 'The part of the geosphere that represents the cultural landscape of the earth is the:', 'የምድርን ባህላዊ ገጽታ የሚወክለው የጂኦስፌር ክፍል፦',
     array['Lithosphere', 'Hydrosphere', 'Anthroposphere', 'Atmosphere']::text[],
     array['ሊቶስፌር', 'ሃይድሮስፌር', 'አንትሮፖስፌር', 'አትሞስፌር']::text[],
     2, null, '[]'::jsonb, null,
     'The anthroposphere is the human, cultural landscape (towns, farms, roads).', 'አንትሮፖስፌር የሰውና የባህል ገጽታ ነው (ከተሞች፣ እርሻዎች፣ መንገዶች)።'),
    (v_quiz_id, 17, 'choice', false, 'The Greek scholar who coined the word "geography" for the first time was:', '«ጂኦግራፊ» የሚለውን ቃል ለመጀመሪያ ጊዜ የፈጠረው ግሪካዊ ምሁር፦',
     array['Ratzel', 'Eratosthenes', 'Demolins', 'Yeates']::text[],
     array['ራትዘል', 'ኤራቶስቴንስ', 'ዴሞላን', 'ዬትስ']::text[],
     1, null, '[]'::jsonb, null,
     'Eratosthenes (276–196 BC) defined geography as the description of the earth.', 'ኤራቶስቴንስ (276–196 ዓ.ዓ.) ጂኦግራፊን የምድር ገለጻ ብሎ ተረጎመው።'),
    (v_quiz_id, 18, 'choice', false, 'An ardent supporter of environmental determinism was:', 'የአካባቢ ወሳኝነት ጠንካራ ደጋፊ የነበረው፦',
     array['Febvre', 'Demolins', 'Von Thünen', 'Weber']::text[],
     array['ፌብቭር', 'ዴሞላን', 'ቮን ቲውነን', 'ዌበር']::text[],
     1, null, '[]'::jsonb, null,
     'Demolins supported determinism; Febvre supported possibilism; Von Thünen and Weber made location models.', 'ዴሞላን ወሳኝነትን ደገፈ፤ ፌብቭር ዕድላዊነትን ደገፈ፤ ቮን ቲውነንና ዌበር የአቀማመጥ ሞዴሎችን ሠሩ።');
end
$migration$;
