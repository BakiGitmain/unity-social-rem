-- Lesson 1.1.2 Branches of Geography
-- geography / grade 9 / Unit One
-- Generated from content/lessons/geography/grade-9/unit-1/1-1-2.json by scripts/lesson-to-sql.mjs. Do not edit by hand.

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
  if exists (select 1 from public.lessons where unit_id = v_unit_id and code = '1.1.2') then
    raise exception 'Lesson 1.1.2 already exists in this unit';
  end if;

  insert into public.lessons (unit_id, code, slug, sort_order, section_code, section_title_en, section_title_am,
                              title_en, title_am, summary_en, summary_am, minutes, main_topics)
  values (v_unit_id, '1.1.2', '1-1-2', 2, '1.1', 'The Science of Geography', 'የጂኦግራፊ ሳይንስ',
          'Branches of Geography', 'የጂኦግራፊ ቅርንጫፎች', 'The two main branches of geography, physical and human, and the specialised fields inside each one.', 'ሁለቱ ዋና የጂኦግራፊ ቅርንጫፎች፣ የተፈጥሮና የሰው ጂኦግራፊ፣ እና በእያንዳንዳቸው ውስጥ ያሉ ልዩ ዘርፎች።', 15,
          '[{"title":{"en":"Two main branches","am":"ሁለቱ ዋና ቅርንጫፎች"},"points":[{"en":"Geography has **2 main branches**: **Physical** geography and **Human** geography.","am":"ጂኦግራፊ **2 ዋና ቅርንጫፎች** አሉት፦ **የተፈጥሮ** ጂኦግራፊ እና **የሰው** ጂኦግራፊ።"},{"en":"Physical = **natural** features (climate, landforms, soil, vegetation, drainage).","am":"የተፈጥሮ = **ተፈጥሯዊ** ገጽታዎች (የአየር ንብረት፣ የመሬት ቅርጾች፣ አፈር፣ ዕፅዋት፣ የውሃ ፍሳሽ)።"},{"en":"Human = **human-made** aspects (population, cities, economy, culture, politics).","am":"የሰው = **በሰው የተሠሩ** ገጽታዎች (ሕዝብ፣ ከተሞች፣ ኢኮኖሚ፣ ባህል፣ ፖለቲካ)።"},{"en":"Trick: **nature** made it → physical; **people** made it → human.","am":"ዘዴ፦ **ተፈጥሮ** የሠራው → የተፈጥሮ፤ **ሰው** የሠራው → የሰው ጂኦግራፊ።"}]},{"title":{"en":"Physical geography fields","am":"የተፈጥሮ ጂኦግራፊ ዘርፎች"},"points":[{"en":"**Climatology** → climate","am":"**የአየር ንብረት ጥናት (Climatology)** → የአየር ንብረት"},{"en":"**Geomorphology** → landforms and the forces that shape them","am":"**የመሬት ቅርጽ ጥናት (Geomorphology)** → የመሬት ቅርጾችና የሚቀርጿቸው ኃይሎች"},{"en":"**Soil geography** → soils","am":"**የአፈር ጂኦግራፊ** → አፈር"},{"en":"**Biogeography** → plants and animals","am":"**የሕይወት ጂኦግራፊ (Biogeography)** → ዕፅዋትና እንስሳት"},{"en":"**Oceanography** → ocean currents, waves and tides; **Hydrology** → water on land","am":"**የውቅያኖስ ጥናት (Oceanography)** → ጅረቶች፣ ማዕበሎችና የባሕር ውሃ ከፍታና ዝቅታ፤ **የውሃ ጥናት (Hydrology)** → በየብስ ላይ ያለ ውሃ"}]},{"title":{"en":"Human geography fields","am":"የሰው ጂኦግራፊ ዘርፎች"},"points":[{"en":"**Population** → distribution, growth and structure of people","am":"**የሕዝብ ጂኦግራፊ** → የሕዝብ ስርጭት፣ ዕድገትና አወቃቀር"},{"en":"**Urban** → towns and cities","am":"**የከተማ ጂኦግራፊ** → ከተሞች"},{"en":"**Economic** → production, consumption and exchange","am":"**የኢኮኖሚ ጂኦግራፊ** → ምርት፣ ፍጆታና ልውውጥ"},{"en":"**Cultural** → beliefs and customs; **Political** → power and decisions; **Historical** → places in the past","am":"**የባህል ጂኦግራፊ** → እምነትና ልማድ፤ **የፖለቲካ ጂኦግራፊ** → ሥልጣንና ውሳኔ፤ **የታሪክ ጂኦግራፊ** → ቦታዎች በቀድሞ ዘመን"}]},{"title":{"en":"Watch out in exams","am":"በፈተና ላይ ተጠንቀቁ"},"points":[{"en":"Biogeography is **physical**, not human.","am":"የሕይወት ጂኦግራፊ (Biogeography) **የተፈጥሮ** ጂኦግራፊ ነው እንጂ የሰው አይደለም።"},{"en":"Population distribution = **population** geography, not cultural geography.","am":"የሕዝብ ስርጭት = **የሕዝብ** ጂኦግራፊ እንጂ የባህል ጂኦግራፊ አይደለም።"}]}]'::jsonb)
  returning id into v_lesson_id;

  insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, blocks) values
    (v_lesson_id, 1, 'The two main branches', 'ሁለቱ ዋና ቅርንጫፎች', 'git-branch',
     '[{"type":"paragraph","text":{"en":"Geography is divided into branches **depending on what it studies**.","am":"ጂኦግራፊ **በሚያጠናው ነገር ላይ ተመሥርቶ** በቅርንጫፎች ይከፈላል።"}},{"type":"keypoint","variant":"important","title":{"en":"2 main branches","am":"2 ዋና ቅርንጫፎች"},"text":{"en":"Geography has **two main branches**: **Physical geography** and **Human geography**.","am":"ጂኦግራፊ **ሁለት ዋና ቅርንጫፎች** አሉት፦ **የተፈጥሮ ጂኦግራፊ (Physical Geography)** እና **የሰው ጂኦግራፊ (Human Geography)**።"}},{"type":"image","src":"/illustrations/branches.svg","width":640,"height":300,"alt":{"en":"Tree diagram: Geography splits into Physical geography (climate, landforms, soil, plants and animals, oceans) and Human geography (population, cities, economy, culture, politics, history).","am":"የዛፍ ሥዕላዊ መግለጫ፦ ጂኦግራፊ ወደ የተፈጥሮ ጂኦግራፊ (የአየር ንብረት፣ የመሬት ቅርጾች፣ አፈር፣ ዕፅዋትና እንስሳት፣ ውቅያኖሶች) እና የሰው ጂኦግራፊ (ሕዝብ፣ ከተሞች፣ ኢኮኖሚ፣ ባህል፣ ፖለቲካ፣ ታሪክ) ይከፈላል።"},"caption":{"en":"The two branches of geography","am":"ሁለቱ የጂኦግራፊ ቅርንጫፎች"},"credit":"Illustration: Unity Social Rem (original, free to use)"},{"type":"table","headers":[{"en":"Compare","am":"ንጽጽር"},{"en":"Physical geography","am":"የተፈጥሮ ጂኦግራፊ"},{"en":"Human geography","am":"የሰው ጂኦግራፊ"}],"rows":[[{"en":"**Studies**","am":"**ያጠናል**"},{"en":"The **natural** features of the Earth''s surface, with their causes, effects and interactions","am":"የምድርን ገጽ **የተፈጥሮ** ገጽታዎች ከመንስኤዎቻቸው፣ ከውጤቶቻቸውና ከመስተጋብራቸው ጋር"},{"en":"**Human-made** aspects of the world and their interaction with the natural environment","am":"**በሰው የተሠሩ** የዓለም ገጽታዎችንና ከተፈጥሮ አካባቢ ጋር ያላቸውን መስተጋብር"}],[{"en":"**Examples**","am":"**ምሳሌዎች**"},{"en":"Climate, landforms (mountains, plateaus, valleys, plains), soil, vegetation, drainage (rivers, lakes)","am":"የአየር ንብረት፣ የመሬት ቅርጾች (ተራሮች፣ አምባዎች፣ ሸለቆዎች፣ ሜዳዎች)፣ አፈር፣ ዕፅዋት፣ የውሃ ፍሳሽ (ወንዞች፣ ሐይቆች)"},{"en":"Population, settlements (cities and towns), economic activities, culture, political systems","am":"ሕዝብ፣ ሰፈራዎች (ከተሞች)፣ የኢኮኖሚ እንቅስቃሴዎች፣ ባህል፣ የፖለቲካ ሥርዓቶች"}]]},{"type":"tip","title":{"en":"Easy trick","am":"ቀላል ዘዴ"},"text":{"en":"If **nature** made it → **Physical** geography. If **people** made it → **Human** geography.","am":"**ተፈጥሮ** የሠራው ከሆነ → **የተፈጥሮ ጂኦግራፊ**። **ሰው** የሠራው ከሆነ → **የሰው ጂኦግራፊ**።"}}]'::jsonb),
    (v_lesson_id, 2, 'Fields of physical geography', 'የተፈጥሮ ጂኦግራፊ ዘርፎች', 'mountain',
     '[{"type":"paragraph","text":{"en":"Physical geography studies the distribution of the world''s natural features. Each feature has its own **sub-field** (specialised field) that studies it:","am":"የተፈጥሮ ጂኦግራፊ የዓለምን የተፈጥሮ ገጽታዎች ስርጭት ያጠናል። እያንዳንዱን ገጽታ የሚያጠና የራሱ **ንዑስ ዘርፍ (Sub-field)** አለ፦"}},{"type":"table","headers":[{"en":"Field","am":"ዘርፍ"},{"en":"What it studies","am":"የሚያጠናው"}],"rows":[[{"en":"**Climatology**","am":"**የአየር ንብረት ጥናት (Climatology)**"},{"en":"Climate: the factors that create it, and how it varies and is distributed","am":"የአየር ንብረት፦ የሚፈጥሩትን ምክንያቶች፣ ልዩነቱንና ስርጭቱን"}],[{"en":"**Geomorphology**","am":"**የመሬት ቅርጽ ጥናት (Geomorphology)**"},{"en":"Landforms (such as mountains and plains) and the forces that change them","am":"የመሬት ቅርጾችን (እንደ ተራሮችና ሜዳዎች) እና የሚለውጧቸውን ኃይሎች"}],[{"en":"**Soil geography**","am":"**የአፈር ጂኦግራፊ (Soil Geography)**"},{"en":"The distribution of soils and their characteristics","am":"የአፈርን ስርጭትና ባሕርያቱን"}],[{"en":"**Biogeography**","am":"**የሕይወት ጂኦግራፊ (Biogeography)**"},{"en":"The distribution of **plants and animals** in relation to the environments they live in","am":"የ**ዕፅዋትና የእንስሳትን** ስርጭት ከሚኖሩበት አካባቢ ጋር በተያያዘ"}],[{"en":"**Oceanography**","am":"**የውቅያኖስ ጥናት (Oceanography)**"},{"en":"Ocean currents, waves and tides: where they are, and their causes and effects","am":"የውቅያኖስ ጅረቶችን፣ ማዕበሎችንና የባሕር ውሃ ከፍታና ዝቅታን (Tides)፦ ቦታቸውን፣ መንስኤና ውጤታቸውን"}],[{"en":"**Hydrology**","am":"**የውሃ ጥናት (Hydrology)**"},{"en":"Water on land: rivers, lakes and drainage","am":"በየብስ ላይ ያለ ውሃ፦ ወንዞች፣ ሐይቆችና የውሃ ፍሳሽ"}]]},{"type":"keypoint","variant":"note","title":{"en":"Textbook note","am":"የመማሪያ መጽሐፍ ማስታወሻ"},"text":{"en":"Class notes often list **Hydrology**, while the Grade 9 textbook lists **Oceanography**. Learn both: both are fields of physical geography.","am":"የክፍል ማስታወሻዎች ብዙ ጊዜ **የውሃ ጥናትን (Hydrology)** ይዘረዝራሉ፤ የ9ኛ ክፍል መማሪያ መጽሐፍ ደግሞ **የውቅያኖስ ጥናትን (Oceanography)** ይዘረዝራል። ሁለቱንም ማወቅ ያስፈልጋል፤ ሁለቱም የተፈጥሮ ጂኦግራፊ ዘርፎች ናቸው።"}}]'::jsonb),
    (v_lesson_id, 3, 'Fields of human geography', 'የሰው ጂኦግራፊ ዘርፎች', 'users',
     '[{"type":"paragraph","text":{"en":"Human geography studies the distribution and influence of the **human aspects** of our world: cultures, population, settlements, economic activities and political systems.","am":"የሰው ጂኦግራፊ የዓለማችንን **ሰው ነክ ገጽታዎች** ስርጭትና ተጽዕኖ ያጠናል፦ ባህሎችን፣ ሕዝብን፣ ሰፈራዎችን፣ የኢኮኖሚ እንቅስቃሴዎችንና የፖለቲካ ሥርዓቶችን።"}},{"type":"table","headers":[{"en":"Field","am":"ዘርፍ"},{"en":"What it studies","am":"የሚያጠናው"}],"rows":[[{"en":"**Population geography**","am":"**የሕዝብ ጂኦግራፊ (Population Geography)**"},{"en":"The distribution, growth and structure of population","am":"የሕዝብን ስርጭት፣ ዕድገትና አወቃቀር"}],[{"en":"**Urban geography**","am":"**የከተማ ጂኦግራፊ (Urban Geography)**"},{"en":"The development and characteristics of towns, cities and other urban centres","am":"የከተሞችንና የሌሎች የከተማ ማዕከላትን ዕድገትና ባሕርያት"}],[{"en":"**Economic geography**","am":"**የኢኮኖሚ ጂኦግራፊ (Economic Geography)**"},{"en":"Production, consumption and exchange of goods and services, and where they happen","am":"የዕቃዎችና የአገልግሎቶችን ምርት፣ ፍጆታና ልውውጥ፣ እንዲሁም የሚካሄዱበትን ቦታ"}],[{"en":"**Cultural geography**","am":"**የባህል ጂኦግራፊ (Cultural Geography)**"},{"en":"Cultures, including people''s beliefs and customs, and how they move, spread and interact","am":"የሰዎችን እምነትና ልማድ ጨምሮ ባህሎችን፣ እንዴት እንደሚንቀሳቀሱ፣ እንደሚስፋፉና እንደሚገናኙ"}],[{"en":"**Political geography**","am":"**የፖለቲካ ጂኦግራፊ (Political Geography)**"},{"en":"Political systems, and how people use them to exercise power and make decisions","am":"የፖለቲካ ሥርዓቶችን፣ ሰዎች ሥልጣን ለመጠቀምና ውሳኔ ለመስጠት እንዴት እንደሚጠቀሙባቸው"}],[{"en":"**Historical geography**","am":"**የታሪክ ጂኦግራፊ (Historical Geography)**"},{"en":"The geography of the past, and how places and regions change over time","am":"የቀድሞውን ዘመን ጂኦግራፊ፣ ቦታዎችና አካባቢዎች በጊዜ ሂደት እንዴት እንደሚለወጡ"}]]},{"type":"example","title":{"en":"Common exam traps","am":"የተለመዱ የፈተና ወጥመዶች"},"text":{"en":"**Biogeography** studies plants and animals, so it is **physical** geography, not human geography. The distribution of population is studied by **population geography**, not cultural geography.","am":"**የሕይወት ጂኦግራፊ (Biogeography)** ዕፅዋትንና እንስሳትን ስለሚያጠና የ**ተፈጥሮ** ጂኦግራፊ ዘርፍ ነው እንጂ የሰው ጂኦግራፊ አይደለም። የሕዝብን ስርጭት የሚያጠናው **የሕዝብ ጂኦግራፊ (Population Geography)** ነው እንጂ የባህል ጂኦግራፊ አይደለም።"}}]'::jsonb);

  insert into public.quizzes (lesson_id, title_en, title_am, description_en, description_am)
  values (v_lesson_id, 'Quiz: Branches of Geography', 'ፈተና፦ የጂኦግራፊ ቅርንጫፎች', '12 questions on physical and human geography and their fields.', 'ስለ የተፈጥሮና የሰው ጂኦግራፊ እና ዘርፎቻቸው 12 ጥያቄዎች።')
  returning id into v_quiz_id;

  insert into public.quiz_questions (quiz_id, sort_order, question_en, question_am, options_en, options_am, correct_index, explanation_en, explanation_am) values
    (v_quiz_id, 1, 'The two main branches of geography are:', 'ሁለቱ ዋና የጂኦግራፊ ቅርንጫፎች የትኞቹ ናቸው?',
     array['Old and modern', 'Physical and human', 'Spatial and temporal', 'Urban and rural']::text[],
     array['የቀድሞና ዘመናዊ', 'የተፈጥሮና የሰው', 'ቦታዊና ጊዜያዊ', 'የከተማና የገጠር']::text[],
     1, 'Geography is divided into physical geography (natural features) and human geography (human-made aspects).', 'ጂኦግራፊ በተፈጥሮ ጂኦግራፊ (ተፈጥሯዊ ገጽታዎች) እና በሰው ጂኦግራፊ (በሰው የተሠሩ ገጽታዎች) ይከፈላል።'),
    (v_quiz_id, 2, 'Which of these is a PHYSICAL feature?', 'ከሚከተሉት ውስጥ የተፈጥሮ ገጽታ የሆነው የትኛው ነው?',
     array['Population', 'Economy', 'Climate', 'Culture']::text[],
     array['ሕዝብ', 'ኢኮኖሚ', 'የአየር ንብረት', 'ባህል']::text[],
     2, 'Climate is made by nature, so it is studied by physical geography. The others are human aspects.', 'የአየር ንብረት በተፈጥሮ የሚፈጠር ስለሆነ በተፈጥሮ ጂኦግራፊ ይጠናል። ሌሎቹ ሰው ነክ ገጽታዎች ናቸው።'),
    (v_quiz_id, 3, 'Which of these is a HUMAN aspect?', 'ከሚከተሉት ውስጥ ሰው ነክ ገጽታ የሆነው የትኛው ነው?',
     array['Soil', 'Urban areas (cities)', 'Drainage', 'Plateau']::text[],
     array['አፈር', 'የከተማ አካባቢዎች (ከተሞች)', 'የውሃ ፍሳሽ', 'አምባ']::text[],
     1, 'Cities are made by people, so they belong to human geography (urban geography).', 'ከተሞች በሰው የተሠሩ ስለሆኑ የሰው ጂኦግራፊ (የከተማ ጂኦግራፊ) ክፍል ናቸው።'),
    (v_quiz_id, 4, 'Mountains, plateaus, valleys and plains are examples of:', 'ተራሮች፣ አምባዎች፣ ሸለቆዎችና ሜዳዎች የምን ምሳሌዎች ናቸው?',
     array['Drainage', 'Landforms', 'Climate', 'Culture']::text[],
     array['የውሃ ፍሳሽ', 'የመሬት ቅርጾች', 'የአየር ንብረት', 'ባህል']::text[],
     1, 'These are landforms, the shapes of the land. They are studied by geomorphology.', 'እነዚህ የመሬት ቅርጾች ናቸው። የሚጠኑትም በመሬት ቅርጽ ጥናት (Geomorphology) ነው።'),
    (v_quiz_id, 5, 'The branch of geography that studies landforms and the forces that shape them is:', 'የመሬት ቅርጾችንና የሚቀርጿቸውን ኃይሎች የሚያጠናው የጂኦግራፊ ዘርፍ የትኛው ነው?',
     array['Biogeography', 'Oceanography', 'Geomorphology', 'Soil geography']::text[],
     array['የሕይወት ጂኦግራፊ (Biogeography)', 'የውቅያኖስ ጥናት (Oceanography)', 'የመሬት ቅርጽ ጥናት (Geomorphology)', 'የአፈር ጂኦግራፊ (Soil Geography)']::text[],
     2, 'Geomorphology studies landforms such as mountains and plains, and the forces that change them.', 'የመሬት ቅርጽ ጥናት (Geomorphology) እንደ ተራሮችና ሜዳዎች ያሉ የመሬት ቅርጾችንና የሚለውጧቸውን ኃይሎች ያጠናል።'),
    (v_quiz_id, 6, 'Which one is NOT a branch of human geography?', 'ከሚከተሉት ውስጥ የሰው ጂኦግራፊ ዘርፍ ያልሆነው የትኛው ነው?',
     array['Political geography', 'Urban geography', 'Biogeography', 'Historical geography']::text[],
     array['የፖለቲካ ጂኦግራፊ', 'የከተማ ጂኦግራፊ', 'የሕይወት ጂኦግራፊ (Biogeography)', 'የታሪክ ጂኦግራፊ']::text[],
     2, 'Biogeography studies plants and animals, so it is a field of physical geography.', 'የሕይወት ጂኦግራፊ ዕፅዋትንና እንስሳትን ስለሚያጠና የተፈጥሮ ጂኦግራፊ ዘርፍ ነው።'),
    (v_quiz_id, 7, 'Which field studies the distribution, growth and structure of population?', 'የሕዝብን ስርጭት፣ ዕድገትና አወቃቀር የሚያጠናው ዘርፍ የትኛው ነው?',
     array['Cultural geography', 'Population geography', 'Political geography', 'Historical geography']::text[],
     array['የባህል ጂኦግራፊ', 'የሕዝብ ጂኦግራፊ', 'የፖለቲካ ጂኦግራፊ', 'የታሪክ ጂኦግራፊ']::text[],
     1, 'Population geography studies the distribution, growth and structure of population. Cultural geography studies beliefs and customs.', 'የሕዝብ ጂኦግራፊ የሕዝብን ስርጭት፣ ዕድገትና አወቃቀር ያጠናል። የባህል ጂኦግራፊ ደግሞ እምነትንና ልማድን ያጠናል።'),
    (v_quiz_id, 8, 'Which of the following is a branch of physical geography?', 'ከሚከተሉት ውስጥ የተፈጥሮ ጂኦግራፊ ዘርፍ የሆነው የትኛው ነው?',
     array['Climatology', 'Soil geography', 'Oceanography', 'All of the above']::text[],
     array['የአየር ንብረት ጥናት (Climatology)', 'የአፈር ጂኦግራፊ', 'የውቅያኖስ ጥናት (Oceanography)', 'ሁሉም መልስ ናቸው']::text[],
     3, 'Climatology, soil geography and oceanography all study natural features, so all are physical geography.', 'የአየር ንብረት ጥናት፣ የአፈር ጂኦግራፊና የውቅያኖስ ጥናት ሁሉም ተፈጥሯዊ ገጽታዎችን ስለሚያጠኑ የተፈጥሮ ጂኦግራፊ ዘርፎች ናቸው።'),
    (v_quiz_id, 9, 'Which field studies the distribution of plants and animals in relation to their environments?', 'የዕፅዋትንና የእንስሳትን ስርጭት ከሚኖሩበት አካባቢ ጋር በተያያዘ የሚያጠናው ዘርፍ የትኛው ነው?',
     array['Biogeography', 'Economic geography', 'Climatology', 'Urban geography']::text[],
     array['የሕይወት ጂኦግራፊ (Biogeography)', 'የኢኮኖሚ ጂኦግራፊ', 'የአየር ንብረት ጥናት (Climatology)', 'የከተማ ጂኦግራፊ']::text[],
     0, 'Bio means life, so biogeography studies living things: plants and animals.', 'ባዮ (Bio) ማለት ሕይወት ነው፤ ስለዚህ የሕይወት ጂኦግራፊ ሕያዋን ፍጥረታትን፣ ዕፅዋትንና እንስሳትን ያጠናል።'),
    (v_quiz_id, 10, 'Political geography studies:', 'የፖለቲካ ጂኦግራፊ የሚያጠናው፦',
     array['Ocean currents, waves and tides', 'Political systems and how people use them to exercise power and make decisions', 'The growth of towns and cities', 'The characteristics of soils']::text[],
     array['የውቅያኖስ ጅረቶችን፣ ማዕበሎችንና የባሕር ውሃ ከፍታና ዝቅታን', 'የፖለቲካ ሥርዓቶችንና ሰዎች ሥልጣን ለመጠቀምና ውሳኔ ለመስጠት እንዴት እንደሚጠቀሙባቸው', 'የከተሞችን ዕድገት', 'የአፈርን ባሕርያት']::text[],
     1, 'Political geography studies the distribution of political systems and how people use them to exercise power and make decisions.', 'የፖለቲካ ጂኦግራፊ የፖለቲካ ሥርዓቶችን ስርጭትና ሰዎች ሥልጣን ለመጠቀምና ውሳኔ ለመስጠት እንዴት እንደሚጠቀሙባቸው ያጠናል።'),
    (v_quiz_id, 11, 'Studying how a region looked 200 years ago and how it has changed belongs to:', 'አንድ አካባቢ ከ200 ዓመታት በፊት ምን ይመስል እንደነበርና እንዴት እንደተለወጠ ማጥናት የየትኛው ዘርፍ ነው?',
     array['Historical geography', 'Climatology', 'Oceanography', 'Soil geography']::text[],
     array['የታሪክ ጂኦግራፊ', 'የአየር ንብረት ጥናት', 'የውቅያኖስ ጥናት', 'የአፈር ጂኦግራፊ']::text[],
     0, 'Historical geography studies the geography of the past and how places and regions change over time.', 'የታሪክ ጂኦግራፊ የቀድሞውን ዘመን ጂኦግራፊና ቦታዎች በጊዜ ሂደት እንዴት እንደሚለወጡ ያጠናል።'),
    (v_quiz_id, 12, 'Production, consumption and exchange of goods and services are studied by:', 'የዕቃዎችና የአገልግሎቶች ምርት፣ ፍጆታና ልውውጥ የሚጠኑት በየትኛው ዘርፍ ነው?',
     array['Cultural geography', 'Geomorphology', 'Economic geography', 'Biogeography']::text[],
     array['የባህል ጂኦግራፊ', 'የመሬት ቅርጽ ጥናት', 'የኢኮኖሚ ጂኦግራፊ', 'የሕይወት ጂኦግራፊ']::text[],
     2, 'Economic geography studies production, consumption and exchange, and where these activities happen.', 'የኢኮኖሚ ጂኦግራፊ ምርትን፣ ፍጆታንና ልውውጥን፣ እንዲሁም እነዚህ እንቅስቃሴዎች የሚካሄዱበትን ቦታ ያጠናል።');
end
$migration$;
