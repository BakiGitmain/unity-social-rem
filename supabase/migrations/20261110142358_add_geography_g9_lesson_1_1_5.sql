-- Lesson 1.1.5 Major Schools of Thought: Environmental Determinism
-- geography / grade 9 / Unit One
-- Generated from content/lessons/geography/grade-9/unit-1/1-1-5.json by scripts/lesson-to-sql.mjs. Do not edit by hand.

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
  if exists (select 1 from public.lessons where unit_id = v_unit_id and code = '1.1.5') then
    raise exception 'Lesson 1.1.5 already exists in this unit';
  end if;
  insert into public.lessons (unit_id, code, slug, sort_order, title_en, title_am) values (v_unit_id, '1.1.5', '1-1-5', 5, '', '')
  returning id into v_lesson_id;
  update public.lessons set
    slug = '1-1-5', sort_order = 5, section_code = '1.1',
    section_title_en = 'The Science of Geography', section_title_am = 'የጂኦግራፊ ሳይንስ',
    title_en = 'Major Schools of Thought: Environmental Determinism', title_am = 'ዋና ዋና የአስተሳሰብ ትምህርት ቤቶች፦ የአካባቢ ወሳኝነት',
    summary_en = 'What a school of thought is, and the first major school in geography: environmental determinism, its main ideas and its scholars (Darwin, Demolins and Ratzel).', summary_am = 'የአስተሳሰብ ትምህርት ቤት ምን እንደሆነ፣ እና በጂኦግራፊ የመጀመሪያው ዋና ትምህርት ቤት፦ የአካባቢ ወሳኝነት፣ ዋና ሐሳቦቹና ምሁራኑ (ዳርዊን፣ ዴሞላንና ራትዘል)።',
    minutes = 8, main_topics = '[{"title":{"en":"Schools of thought","am":"የአስተሳሰብ ትምህርት ቤቶች"},"points":[{"en":"Schools of thought have **different views on the human–environment relationship**.","am":"የአስተሳሰብ ትምህርት ቤቶች **ስለ ሰውና አካባቢ ግንኙነት የተለያዩ አመለካከቶች** አሏቸው።"},{"en":"This lesson: **A. Environmental Determinism**. Next lesson: B. Possibilism.","am":"ይህ ትምህርት፦ **ሀ. የአካባቢ ወሳኝነት**። ቀጣዩ ትምህርት፦ ለ. ዕድላዊነት።"}]},{"title":{"en":"Environmental Determinism","am":"የአካባቢ ወሳኝነት"},"points":[{"en":"Laid down by **Greek and Roman scholars**.","am":"በ**ግሪክና በሮም ምሁራን** የተጣለ።"},{"en":"The environment **controls** human activities; it is \"the master\".","am":"አካባቢ የሰውን እንቅስቃሴዎች **ይቆጣጠራል**፤ «ጌታ» ነው።"},{"en":"Dominant idea **up to the First World War**.","am":"**እስከ አንደኛው የዓለም ጦርነት** ዋነኛ አስተሳሰብ።"},{"en":"Nature causes people''s **physical differences** and differences in **economy and culture**.","am":"ተፈጥሮ የሰዎችን **አካላዊ ልዩነቶች** እና የ**ኢኮኖሚና የባህል** ልዩነቶችን ታስከትላለች።"}]},{"title":{"en":"The scholars","am":"ምሁራኑ"},"points":[{"en":"**Charles Darwin**: On the Origin of Species (1859), \"survival of the fittest\".","am":"**ቻርለስ ዳርዊን**፦ On the Origin of Species (1859)፣ «የብቁዎች መትረፍ»።"},{"en":"**Edmond Demolins**: French scholar.","am":"**ኤድሞን ዴሞላን**፦ ፈረንሳዊ ምሁር።"},{"en":"**Friedrich Ratzel**: German geographer, a leading determinist.","am":"**ፍሬድሪክ ራትዘል**፦ ጀርመናዊ የጂኦግራፊ ምሁር፣ ግንባር ቀደም አራማጅ።"}]}]'::jsonb, glossary = '[{"term":{"en":"School of thought","am":"የአስተሳሰብ ትምህርት ቤት"},"definition":{"en":"A group of scholars who share the same main idea about a question.","am":"ስለ አንድ ጥያቄ ተመሳሳይ ዋና ሐሳብ ያላቸው ምሁራን ቡድን።"}},{"term":{"en":"Environmental Determinism","am":"የአካባቢ ወሳኝነት"},"definition":{"en":"The school of thought that says the natural environment controls human activities; dominant until the First World War.","am":"የተፈጥሮ አካባቢ የሰውን እንቅስቃሴዎች ይቆጣጠራል የሚል የአስተሳሰብ ትምህርት ቤት፤ እስከ አንደኛው የዓለም ጦርነት ዋነኛ ነበር።"}},{"term":{"en":"Determinism","am":"ወሳኝነት"},"definition":{"en":"Short for environmental determinism: nature decides how people live.","am":"የአካባቢ ወሳኝነት አጭር ስም፦ ተፈጥሮ ሰዎች እንዴት እንደሚኖሩ ትወስናለች።"}},{"term":{"en":"Survival of the fittest","am":"የብቁዎች መትረፍ"},"definition":{"en":"The famous idea linked to Darwin''s theory of evolution; the phrase was first used by Herbert Spencer.","am":"ከዳርዊን የዝግመተ ለውጥ ንድፈ ሐሳብ ጋር የተያያዘ ታዋቂ ሐሳብ፤ አባባሉን መጀመሪያ የተጠቀመው ኸርበርት ስፔንሰር ነው።"}},{"term":{"en":"Charles Darwin","am":"ቻርለስ ዳርዊን"},"definition":{"en":"English naturalist whose theory of evolution (On the Origin of Species, 1859) supported determinism.","am":"የዝግመተ ለውጥ ንድፈ ሐሳቡ (On the Origin of Species፣ 1859) ወሳኝነትን የደገፈ እንግሊዛዊ የተፈጥሮ ተመራማሪ።"}},{"term":{"en":"Edmond Demolins","am":"ኤድሞን ዴሞላን"},"definition":{"en":"French scholar who supported environmental determinism.","am":"የአካባቢ ወሳኝነትን የደገፈ ፈረንሳዊ ምሁር።"}},{"term":{"en":"Friedrich Ratzel","am":"ፍሬድሪክ ራትዘል"},"definition":{"en":"German geographer and a leading environmental determinist.","am":"ጀርመናዊ የጂኦግራፊ ምሁርና ግንባር ቀደም የአካባቢ ወሳኝነት አራማጅ።"}}]'::jsonb
  where id = v_lesson_id;

  insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, blocks) values
    (v_lesson_id, 1, 'Schools of thought', 'የአስተሳሰብ ትምህርት ቤቶች', 'brain',
     '[{"type":"keypoint","variant":"definition","title":{"en":"School of thought","am":"የአስተሳሰብ ትምህርት ቤት (School of thought)"},"text":{"en":"A **school of thought** is a group of scholars who share the same main idea about a question.","am":"**የአስተሳሰብ ትምህርት ቤት (School of thought)** ስለ አንድ ጥያቄ ተመሳሳይ ዋና ሐሳብ ያላቸው ምሁራን ቡድን ነው።"}},{"type":"paragraph","text":{"en":"Geography has various schools of thought. They emerged with **different views on the relationship between humans and their environment**.","am":"ጂኦግራፊ የተለያዩ የአስተሳሰብ ትምህርት ቤቶች አሉት። እነዚህ **በሰውና በአካባቢው መካከል ስላለው ግንኙነት የተለያዩ አመለካከቶች** ይዘው ተነሱ።"}},{"type":"paragraph","text":{"en":"The big question is: **does nature control people, or do people control nature?**","am":"ትልቁ ጥያቄ፦ **ተፈጥሮ ሰውን ትቆጣጠራለች ወይስ ሰው ተፈጥሮን ይቆጣጠራል?**"}},{"type":"keypoint","variant":"note","title":{"en":"In this unit","am":"በዚህ ምዕራፍ"},"text":{"en":"This lesson covers **A. Environmental Determinism**. B. Environmental Possibilism comes in the next lesson.","am":"ይህ ትምህርት **ሀ. የአካባቢ ወሳኝነትን (Environmental Determinism)** ይሸፍናል። ለ. የአካባቢ ዕድላዊነት (Environmental Possibilism) በቀጣዩ ትምህርት ይመጣል።"}}]'::jsonb),
    (v_lesson_id, 2, 'A. Environmental Determinism', 'ሀ. የአካባቢ ወሳኝነት', 'mountain',
     '[{"type":"keypoint","variant":"definition","title":{"en":"Environmental Determinism","am":"የአካባቢ ወሳኝነት (Environmental Determinism)"},"text":{"en":"**Environmental determinism** is the idea that the natural environment **controls** human activities.","am":"**የአካባቢ ወሳኝነት (Environmental Determinism)** የተፈጥሮ አካባቢ የሰውን እንቅስቃሴዎች **ይቆጣጠራል** የሚል አስተሳሰብ ነው።"}},{"type":"paragraph","text":{"en":"The idea was first laid down by **Greek and Roman scholars**.","am":"ይህ ሐሳብ በመጀመሪያ የተጣለው በ**ግሪክና በሮም ምሁራን** ነው።"}},{"type":"paragraph","text":{"en":"\"Determine\" means \"decide\". So for this school, **nature decides** how people live.","am":"«Determine» ማለት «መወሰን» ነው። ስለዚህ ለዚህ ትምህርት ቤት **ተፈጥሮ ትወስናለች** ሰዎች እንዴት እንደሚኖሩ።"}}]'::jsonb),
    (v_lesson_id, 3, 'Its main ideas', 'ዋና ሐሳቦቹ', 'scale',
     '[{"type":"paragraph","text":{"en":"The philosophy (main ideas) of this school:","am":"የዚህ ትምህርት ቤት ፍልስፍና (ዋና ሐሳቦች)፦"}},{"type":"list","items":[{"en":"The natural environment is the **influential (dominant) factor** in the human way of living.","am":"የተፈጥሮ አካባቢ በሰው አኗኗር ላይ **ተጽዕኖ ፈጣሪ (ዋነኛ) ምክንያት** ነው።"},{"en":"Human activities are **controlled by the environment**.","am":"የሰው እንቅስቃሴዎች **በአካባቢ ቁጥጥር ሥር** ናቸው።"},{"en":"The physical environment is **the master** that decides people''s day-to-day activities.","am":"የተፈጥሮ አካባቢ የሰዎችን የዕለት ተዕለት እንቅስቃሴ የሚወስን **ጌታ** ነው።"}]},{"type":"keypoint","variant":"important","title":{"en":"Until the First World War","am":"እስከ አንደኛው የዓለም ጦርነት"},"text":{"en":"Environmental determinism was the **dominant idea up to the First World War (WWI)**.","am":"የአካባቢ ወሳኝነት **እስከ አንደኛው የዓለም ጦርነት ድረስ ዋነኛው አስተሳሰብ** ነበር።"}}]'::jsonb),
    (v_lesson_id, 4, 'What it says nature causes', 'ተፈጥሮ ታስከትላለች የሚለው', 'thermometer-sun',
     '[{"type":"paragraph","text":{"en":"For determinists, the physical qualities of geographical conditions (climate, landforms, soil...) are the **causes** of:","am":"ለወሳኝነት አራማጆች፣ የጂኦግራፊያዊ ሁኔታዎች የተፈጥሮ ባሕርያት (የአየር ንብረት፣ የመሬት ቅርጽ፣ አፈር...) የሚከተሉት **መንስኤዎች** ናቸው፦"}},{"type":"list","ordered":true,"items":[{"en":"people''s **physical differences**, and","am":"የሰዎች **አካላዊ ልዩነቶች**፣ እና"},{"en":"differences from place to place in **economic activity** and **cultural practice**.","am":"ከቦታ ቦታ ያሉ የ**ኢኮኖሚ እንቅስቃሴና** የ**ባህል ልማድ** ልዩነቶች።"}]},{"type":"example","title":{"en":"How a determinist would explain Ethiopia","am":"የወሳኝነት አራማጅ ኢትዮጵያን እንዴት ያብራራል"},"text":{"en":"A determinist would say: highland people grow teff and barley **because** the climate is cool and wet, while Afar people herd camels **because** the lowland is hot and dry. Nature \"decided\" it.","am":"የወሳኝነት አራማጅ እንዲህ ይላል፦ የደጋ ሰዎች ጤፍና ገብስ የሚያመርቱት የአየር ንብረቱ ቀዝቃዛና እርጥብ **ስለሆነ** ነው፤ የአፋር ሰዎች ግመል የሚያረቡት ቆላው ሞቃትና ደረቅ **ስለሆነ** ነው። ተፈጥሮ «ወሰነች»።"}}]'::jsonb),
    (v_lesson_id, 5, 'Scholars who supported it', 'የደገፉት ምሁራን', 'users',
     '[{"type":"points","items":[{"icon":"leaf","title":{"en":"Charles Darwin","am":"ቻርለስ ዳርዊን (Charles Darwin)"},"text":{"en":"his theory of evolution (book: **On the Origin of Species**, 1859) and the idea of **\"survival of the fittest\"** supported the school.","am":"የዝግመተ ለውጥ ንድፈ ሐሳቡ (መጽሐፍ፦ **On the Origin of Species**፣ 1859) እና **«የብቁዎች መትረፍ» (Survival of the fittest)** የሚለው ሐሳብ ትምህርት ቤቱን ደገፉ።"}},{"icon":"book-text","title":{"en":"Edmond Demolins","am":"ኤድሞን ዴሞላን (Edmond Demolins)"},"text":{"en":"a **French** scholar who supported the school.","am":"ትምህርት ቤቱን የደገፈ **ፈረንሳዊ** ምሁር።"}},{"icon":"globe","title":{"en":"Friedrich Ratzel","am":"ፍሬድሪክ ራትዘል (Friedrich Ratzel)"},"text":{"en":"a **German** geographer and a leading determinist.","am":"**ጀርመናዊ** የጂኦግራፊ ምሁርና ግንባር ቀደም የወሳኝነት አራማጅ።"}}]},{"type":"tip","title":{"en":"Memory trick","am":"የማስታወሻ ዘዴ"},"text":{"en":"**D**arwin and **D**emolins start with **D**, like **D**eterminism. Add **R**atzel, the German leader.","am":"**D**arwin እና **D**emolins በ**D** ይጀምራሉ፣ ልክ እንደ **D**eterminism። ጀርመናዊውን መሪ **R**atzel ጨምሩ።"}},{"type":"keypoint","variant":"note","title":{"en":"Spelling","am":"አጻጻፍ"},"text":{"en":"Some notes write \"F. Rutzel\". The correct name is **Friedrich Ratzel**.","am":"አንዳንድ ማስታወሻዎች «F. Rutzel» ብለው ይጽፋሉ። ትክክለኛው ስም **ፍሬድሪክ ራትዘል (Friedrich Ratzel)** ነው።"}}]'::jsonb),
    (v_lesson_id, 6, 'A note on Darwin', 'ስለ ዳርዊን ማስታወሻ', 'book-open',
     '[{"type":"keypoint","variant":"note","title":{"en":"Correction","am":"እርማት"},"text":{"en":"Some notes say Darwin''s book was called \"The Survival of the Fittest\". The book is actually **On the Origin of Species** (1859).","am":"አንዳንድ ማስታወሻዎች የዳርዊን መጽሐፍ «The Survival of the Fittest» ይባል ነበር ይላሉ። መጽሐፉ በእርግጥ **On the Origin of Species** (1859) ነው።"}},{"type":"paragraph","text":{"en":"**\"Survival of the fittest\"** is the famous idea (phrase) linked to Darwin''s theory. The phrase was first used by **Herbert Spencer**.","am":"**«የብቁዎች መትረፍ» (Survival of the fittest)** ከዳርዊን ንድፈ ሐሳብ ጋር የተያያዘ ታዋቂ ሐሳብ (አባባል) ነው። አባባሉን መጀመሪያ የተጠቀመው **ኸርበርት ስፔንሰር (Herbert Spencer)** ነው።"}},{"type":"keypoint","variant":"important","title":{"en":"Exam tip","am":"የፈተና ምክር"},"text":{"en":"In the exam, link **Darwin** with **\"survival of the fittest\"**.","am":"በፈተና **ዳርዊንን** ከ**«የብቁዎች መትረፍ»** ጋር አያይዙ።"}}]'::jsonb);

  insert into public.quizzes (lesson_id, title_en, title_am, description_en, description_am)
  values (v_lesson_id, 'Quiz: Environmental Determinism', 'ፈተና፦ የአካባቢ ወሳኝነት', '12 questions on schools of thought and environmental determinism.', 'ስለ አስተሳሰብ ትምህርት ቤቶችና ስለ አካባቢ ወሳኝነት 12 ጥያቄዎች።')
  returning id into v_quiz_id;

  insert into public.quiz_questions (quiz_id, sort_order, question_en, question_am, options_en, options_am, correct_index, explanation_en, explanation_am) values
    (v_quiz_id, 1, 'Environmental determinism says that:', 'የአካባቢ ወሳኝነት የሚለው፦',
     array['Humans fully control nature', 'The environment controls human activities', 'Environment has no effect on people', 'Only culture matters']::text[],
     array['ሰዎች ተፈጥሮን ሙሉ በሙሉ ይቆጣጠራሉ', 'አካባቢ የሰውን እንቅስቃሴዎች ይቆጣጠራል', 'አካባቢ በሰዎች ላይ ምንም ተጽዕኖ የለውም', 'ባህል ብቻ ነው ወሳኙ']::text[],
     1, 'For determinists, the natural environment is the master that controls how people live.', 'ለወሳኝነት አራማጆች የተፈጥሮ አካባቢ ሰዎች እንዴት እንደሚኖሩ የሚቆጣጠር ጌታ ነው።'),
    (v_quiz_id, 2, 'Environmental determinism was the dominant idea up to:', 'የአካባቢ ወሳኝነት ዋነኛ አስተሳሰብ የነበረው እስከ መቼ ነው?',
     array['The 15th century', 'The First World War', 'The Second World War', 'Today']::text[],
     array['15ኛው ክፍለ ዘመን', 'አንደኛው የዓለም ጦርነት', 'ሁለተኛው የዓለም ጦርነት', 'ዛሬ']::text[],
     1, 'It was the dominant idea in geography up to the First World War (WWI).', 'እስከ አንደኛው የዓለም ጦርነት ድረስ በጂኦግራፊ ዋነኛው አስተሳሰብ ነበር።'),
    (v_quiz_id, 3, 'Which scholar is linked with "survival of the fittest"?', 'ከ«የብቁዎች መትረፍ» ጋር የተያያዘው ምሁር ማን ነው?',
     array['Friedrich Ratzel', 'Edmond Demolins', 'Charles Darwin', 'Eratosthenes']::text[],
     array['ፍሬድሪክ ራትዘል', 'ኤድሞን ዴሞላን', 'ቻርለስ ዳርዊን', 'ኤራቶስቴነስ']::text[],
     2, '"Survival of the fittest" is the famous idea linked to Darwin''s theory of evolution.', '«የብቁዎች መትረፍ» ከዳርዊን የዝግመተ ለውጥ ንድፈ ሐሳብ ጋር የተያያዘ ታዋቂ ሐሳብ ነው።'),
    (v_quiz_id, 4, 'The idea of environmental determinism was first laid down by:', 'የአካባቢ ወሳኝነት ሐሳብ መጀመሪያ የተጣለው በእነማን ነው?',
     array['Greek and Roman scholars', 'Chinese scholars', 'American geographers after WWII', 'Ethiopian monks']::text[],
     array['የግሪክና የሮም ምሁራን', 'የቻይና ምሁራን', 'ከሁለተኛው የዓለም ጦርነት በኋላ የአሜሪካ ምሁራን', 'የኢትዮጵያ መነኮሳት']::text[],
     0, 'The notes say the idea was laid down by Greek and Roman scholars.', 'ሐሳቡ በግሪክና በሮም ምሁራን እንደተጣለ ማስታወሻው ይገልጻል።'),
    (v_quiz_id, 5, 'What is the actual title of Darwin''s famous 1859 book?', 'የዳርዊን ታዋቂ የ1859 መጽሐፍ ትክክለኛ ርዕስ ምንድን ነው?',
     array['The Survival of the Fittest', 'On the Origin of Species', 'Anthropogeography', 'The Spirit of Laws']::text[],
     array['The Survival of the Fittest', 'On the Origin of Species', 'Anthropogeography', 'The Spirit of Laws']::text[],
     1, 'The book is On the Origin of Species. "Survival of the fittest" is the idea linked to it, not its title.', 'መጽሐፉ On the Origin of Species ነው። «Survival of the fittest» ከእሱ ጋር የተያያዘ ሐሳብ እንጂ ርዕሱ አይደለም።'),
    (v_quiz_id, 6, 'Who first used the phrase "survival of the fittest"?', '«የብቁዎች መትረፍ» የሚለውን አባባል መጀመሪያ የተጠቀመው ማን ነው?',
     array['Charles Darwin', 'Friedrich Ratzel', 'Herbert Spencer', 'Edmond Demolins']::text[],
     array['ቻርለስ ዳርዊን', 'ፍሬድሪክ ራትዘል', 'ኸርበርት ስፔንሰር', 'ኤድሞን ዴሞላን']::text[],
     2, 'Herbert Spencer coined the phrase; it became linked with Darwin''s theory. In the exam, link Darwin with the idea.', 'አባባሉን የፈጠረው ኸርበርት ስፔንሰር ነው፤ ከዳርዊን ንድፈ ሐሳብ ጋር ተያያዘ። በፈተና ዳርዊንን ከሐሳቡ ጋር አያይዙ።'),
    (v_quiz_id, 7, 'Friedrich Ratzel was a:', 'ፍሬድሪክ ራትዘል ማን ነበር?',
     array['French historian', 'German geographer and leading determinist', 'Greek mathematician', 'English biologist']::text[],
     array['ፈረንሳዊ የታሪክ ምሁር', 'ጀርመናዊ የጂኦግራፊ ምሁርና ግንባር ቀደም የወሳኝነት አራማጅ', 'ግሪካዊ የሒሳብ ሊቅ', 'እንግሊዛዊ የሥነ ሕይወት ምሁር']::text[],
     1, 'Ratzel was a German geographer and one of the leading environmental determinists.', 'ራትዘል ጀርመናዊ የጂኦግራፊ ምሁርና ከግንባር ቀደም የአካባቢ ወሳኝነት አራማጆች አንዱ ነበር።'),
    (v_quiz_id, 8, 'Edmond Demolins, who supported determinism, was:', 'ወሳኝነትን የደገፈው ኤድሞን ዴሞላን የየት አገር ሰው ነበር?',
     array['French', 'German', 'Roman', 'American']::text[],
     array['ፈረንሳዊ', 'ጀርመናዊ', 'ሮማዊ', 'አሜሪካዊ']::text[],
     0, 'Demolins was a French scholar who supported environmental determinism.', 'ዴሞላን የአካባቢ ወሳኝነትን የደገፈ ፈረንሳዊ ምሁር ነበር።'),
    (v_quiz_id, 9, 'Which statement is NOT an idea of environmental determinism?', 'ከሚከተሉት ውስጥ የአካባቢ ወሳኝነት ሐሳብ ያልሆነው የትኛው ነው?',
     array['The environment is the dominant factor in human life', 'The physical environment is the master of daily activities', 'People freely change nature and are not limited by it', 'Nature causes differences in culture from place to place']::text[],
     array['አካባቢ በሰው ሕይወት ላይ ዋነኛ ምክንያት ነው', 'የተፈጥሮ አካባቢ የዕለት ተዕለት እንቅስቃሴ ጌታ ነው', 'ሰዎች ተፈጥሮን በነጻነት ይለውጣሉ፤ በእሷም አይገደቡም', 'ተፈጥሮ ከቦታ ቦታ የባህል ልዩነትን ታስከትላለች']::text[],
     2, 'Determinists believe nature controls people. Saying people are not limited by nature is the opposite view.', 'የወሳኝነት አራማጆች ተፈጥሮ ሰውን ትቆጣጠራለች ብለው ያምናሉ። ሰዎች በተፈጥሮ አይገደቡም ማለት ተቃራኒው አመለካከት ነው።'),
    (v_quiz_id, 10, 'According to determinism, the physical qualities of geographical conditions cause:', 'በወሳኝነት መሠረት የጂኦግራፊያዊ ሁኔታዎች የተፈጥሮ ባሕርያት የሚያስከትሉት፦',
     array['Only differences in language', 'Nothing; people decide everything', 'Only changes in the weather', 'People''s physical differences and differences in economy and culture']::text[],
     array['የቋንቋ ልዩነትን ብቻ', 'ምንም፤ ሰዎች ሁሉንም ይወስናሉ', 'የአየር ሁኔታ ለውጥን ብቻ', 'የሰዎችን አካላዊ ልዩነትና የኢኮኖሚና የባህል ልዩነቶችን']::text[],
     3, 'Determinists say nature causes (A) people''s physical differences and (B) differences in economic activity and cultural practice.', 'የወሳኝነት አራማጆች ተፈጥሮ (ሀ) የሰዎችን አካላዊ ልዩነትና (ለ) የኢኮኖሚ እንቅስቃሴና የባህል ልማድ ልዩነቶችን ታስከትላለች ይላሉ።'),
    (v_quiz_id, 11, 'Schools of thought in geography mainly differ in their view of:', 'የጂኦግራፊ የአስተሳሰብ ትምህርት ቤቶች በዋናነት የሚለያዩት በምን ላይ ባላቸው አመለካከት ነው?',
     array['How to draw maps', 'The relationship between humans and their environment', 'The size of the Earth', 'The number of continents']::text[],
     array['ካርታ እንዴት እንደሚሳል', 'በሰውና በአካባቢው መካከል ያለው ግንኙነት', 'የምድር መጠን', 'የአህጉራት ብዛት']::text[],
     1, 'They emerged with different views on how humans and the environment relate to each other.', 'ሰውና አካባቢ እንዴት እንደሚገናኙ በተመለከተ የተለያዩ አመለካከቶች ይዘው ተነሱ።'),
    (v_quiz_id, 12, 'A student says: "People in hot deserts are nomads only because the climate forces them." This view belongs to:', 'አንድ ተማሪ «በሞቃት በረሃ ያሉ ሰዎች ዘላን የሆኑት የአየር ንብረቱ ስለሚያስገድዳቸው ብቻ ነው» አለ። ይህ አመለካከት የማን ነው?',
     array['Environmental determinism', 'The systematic approach', 'Relative location', 'The movement theme']::text[],
     array['የአካባቢ ወሳኝነት', 'ሥርዓታዊ አቀራረብ', 'አንጻራዊ አቀማመጥ', 'የእንቅስቃሴ ጭብጥ']::text[],
     0, 'Saying the environment alone decides how people live is environmental determinism.', 'አካባቢ ብቻ ሰዎች እንዴት እንደሚኖሩ ይወስናል ማለት የአካባቢ ወሳኝነት ነው።');
end
$migration$;
