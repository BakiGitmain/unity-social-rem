-- Lesson 1.1.3 Scope of Geography
-- geography / grade 9 / Unit One
-- Generated from content/lessons/geography/grade-9/unit-1/1-1-3.json by scripts/lesson-to-sql.mjs. Do not edit by hand.

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
  if exists (select 1 from public.lessons where unit_id = v_unit_id and code = '1.1.3') then
    raise exception 'Lesson 1.1.3 already exists in this unit';
  end if;

  insert into public.lessons (unit_id, code, slug, sort_order, section_code, section_title_en, section_title_am,
                              title_en, title_am, summary_en, summary_am, minutes, main_topics)
  values (v_unit_id, '1.1.3', '1-1-3', 3, '1.1', 'The Science of Geography', 'የጂኦግራፊ ሳይንስ',
          'Scope of Geography', 'የጂኦግራፊ ወሰን', 'What scope means, why geography''s scope is so wide, the five spheres it studies, and how its scope changed through history.', 'ወሰን ምን ማለት እንደሆነ፣ የጂኦግራፊ ወሰን ለምን ሰፊ እንደሆነ፣ የሚያጠናቸው አምስቱ ሉሎች፣ እና ወሰኑ በታሪክ ውስጥ እንዴት እንደተለወጠ።', 15,
          '[{"title":{"en":"What scope means","am":"ወሰን ምን ማለት ነው"},"points":[{"en":"Scope = the **focus, degree, range and content** of a subject: **how much** it covers.","am":"ወሰን = የአንድ ትምህርት **ትኩረት፣ ደረጃ፣ ስፋትና ይዘት**፤ ምን ያህል እንደሚሸፍን።"},{"en":"Geography''s scope is **very wide**: physical and human features, with their causes, effects and interactions.","am":"የጂኦግራፊ ወሰን **በጣም ሰፊ** ነው፦ የተፈጥሮና የሰው ገጽታዎችን ከመንስኤ፣ ከውጤትና ከመስተጋብራቸው ጋር ያጠናል።"},{"en":"Its scope is **dynamic**: it changes as new discoveries and ideas appear.","am":"ወሰኑ **ተለዋዋጭ** ነው፤ አዳዲስ ግኝቶችና ሐሳቦች ሲመጡ ይለወጣል።"}]},{"title":{"en":"The 5 spheres","am":"5ቱ ሉሎች"},"points":[{"en":"**Lithosphere** = rock (the solid layer)","am":"**ሊቶስፌር** = ዐለት (ጠንካራው ንብርብር)"},{"en":"**Hydrosphere** = water (oceans, rivers, lakes)","am":"**ሃይድሮስፌር** = ውሃ (ውቅያኖሶች፣ ወንዞች፣ ሐይቆች)"},{"en":"**Atmosphere** = air (gases around the Earth)","am":"**ከባቢ አየር** = አየር (ምድርን የከበቡ ጋዞች)"},{"en":"**Biosphere** = life (plants and animals)","am":"**ባዮስፌር** = ሕይወት (ዕፅዋትና እንስሳት)"},{"en":"**Anthroposphere** = the cultural landscape made by humans (cities, roads, farms)","am":"**አንትሮፖስፌር** = በሰው የተሠራ ባህላዊ ገጽታ (ከተሞች፣ መንገዶች፣ እርሻዎች)"}]},{"title":{"en":"How the scope changed","am":"ወሰኑ እንዴት ተለወጠ"},"points":[{"en":"Ancient times: the **mother of many sciences**.","am":"በጥንት ዘመን፦ **የብዙ ሳይንሶች እናት**።"},{"en":"16th century: focus on **location** (where, why, what).","am":"16ኛው ክፍለ ዘመን፦ ትኩረት በ**አቀማመጥ** ላይ (የት፣ ለምን፣ ምን)።"},{"en":"Mid-18th century: **people and environment**; Germans **Humboldt** and **Ritter**.","am":"18ኛው ክፍለ ዘመን አጋማሽ፦ **ሰውና አካባቢ**፤ ጀርመናውያኑ **ሁምቦልት** እና **ሪተር**።"},{"en":"19th century: geographical **societies** formed. 20th century: a **spatial science**.","am":"19ኛው ክፍለ ዘመን፦ የጂኦግራፊ **ማኅበራት** ተቋቋሙ። 20ኛው ክፍለ ዘመን፦ **ቦታዊ ሳይንስ** ሆነ።"}]}]'::jsonb)
  returning id into v_lesson_id;

  insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, blocks) values
    (v_lesson_id, 1, 'What is scope?', 'ወሰን ምንድን ነው?', 'target',
     '[{"type":"keypoint","variant":"definition","title":{"en":"Scope","am":"ወሰን (Scope)"},"text":{"en":"**Scope** means the **focus, degree, range and content** of a subject. Simply put, scope is **how much** a subject covers.","am":"**ወሰን (Scope)** ማለት የአንድ ትምህርት **ትኩረት፣ ደረጃ፣ ስፋትና ይዘት** ማለት ነው። በቀላሉ ወሰን አንድ ትምህርት **ምን ያህል** እንደሚሸፍን ያሳያል።"}},{"type":"paragraph","text":{"en":"The textbook puts it as the **range and variety of contents** included in a subject or field of study.","am":"መማሪያ መጽሐፉ ደግሞ «በአንድ ትምህርት ወይም የጥናት ዘርፍ ውስጥ የተካተቱ **ይዘቶች ስፋትና ዓይነት**» ይለዋል።"}},{"type":"keypoint","variant":"important","title":{"en":"Geography''s scope is very wide","am":"የጂኦግራፊ ወሰን በጣም ሰፊ ነው"},"text":{"en":"Geography studies a great many **physical and human features** of the world, together with their **causes, effects and interactions**.","am":"ጂኦግራፊ እጅግ ብዙ የዓለምን **የተፈጥሮና የሰው ገጽታዎች** ከ**መንስኤዎቻቸው፣ ከውጤቶቻቸውና ከመስተጋብራቸው** ጋር ያጠናል።"}},{"type":"paragraph","text":{"en":"It mainly focuses on its **two major branches**: physical (natural) features and human-made features.","am":"በዋናነት በ**ሁለቱ ዋና ቅርንጫፎቹ** ላይ ያተኩራል፦ በተፈጥሮ ገጽታዎችና በሰው በተሠሩ ገጽታዎች።"}},{"type":"paragraph","text":{"en":"Geography''s scope is also **dynamic**: it changes as new discoveries and ideas enter the field.","am":"የጂኦግራፊ ወሰን **ተለዋዋጭ (Dynamic)** ነው፤ አዳዲስ ግኝቶችና ሐሳቦች ወደ ዘርፉ ሲገቡ ይለወጣል።"}}]'::jsonb),
    (v_lesson_id, 2, 'The 5 spheres of geography', 'የጂኦግራፊ 5 ሉሎች', 'layers',
     '[{"type":"paragraph","text":{"en":"The features geography studies are found in the Earth''s **spheres** (parts or layers):","am":"ጂኦግራፊ የሚያጠናቸው ገጽታዎች በምድር **ሉሎች (Spheres)**፣ ማለትም ክፍሎች ወይም ንብርብሮች ውስጥ ይገኛሉ፦"}},{"type":"image","src":"/illustrations/spheres.svg","width":640,"height":320,"alt":{"en":"Illustration of a landscape showing the five spheres: rock and soil (lithosphere), a river and lake (hydrosphere), the sky and clouds (atmosphere), trees and animals (biosphere), and a house and road (anthroposphere).","am":"አምስቱን ሉሎች የሚያሳይ የመሬት ገጽታ ሥዕል፦ ዐለትና አፈር (ሊቶስፌር)፣ ወንዝና ሐይቅ (ሃይድሮስፌር)፣ ሰማይና ደመና (ከባቢ አየር)፣ ዛፎችና እንስሳት (ባዮስፌር)፣ ቤትና መንገድ (አንትሮፖስፌር)።"},"caption":{"en":"One landscape, five spheres","am":"አንድ የመሬት ገጽታ፣ አምስት ሉሎች"},"credit":"Illustration: Unity Social Rem (original, free to use)"},{"type":"table","headers":[{"en":"Sphere","am":"ሉል"},{"en":"What it covers","am":"የሚያካትተው"},{"en":"Word root","am":"የቃሉ መነሻ"}],"rows":[[{"en":"**Lithosphere**","am":"**ሊቶስፌር (Lithosphere)**"},{"en":"The solid layer of rock that covers the whole planet","am":"መላውን ፕላኔት የሚሸፍነው ጠንካራው የዐለት ንብርብር"},{"en":"Litho = rock","am":"ሊቶ (Litho) = ዐለት"}],[{"en":"**Hydrosphere**","am":"**ሃይድሮስፌር (Hydrosphere)**"},{"en":"All bodies of water: oceans, rivers, lakes and others","am":"ሁሉም የውሃ አካላት፦ ውቅያኖሶች፣ ወንዞች፣ ሐይቆችና ሌሎችም"},{"en":"Hydro = water","am":"ሃይድሮ (Hydro) = ውሃ"}],[{"en":"**Atmosphere**","am":"**ከባቢ አየር (Atmosphere)**"},{"en":"The air (gases) surrounding our planet","am":"ፕላኔታችንን የከበበው አየር (ጋዞች)"},{"en":"Atmo = vapour / air","am":"አትሞ (Atmo) = ተን / አየር"}],[{"en":"**Biosphere**","am":"**ባዮስፌር (Biosphere)**"},{"en":"All living things in and on the Earth''s surface: plants and animals","am":"በምድር ገጽ ላይና ውስጥ ያሉ ሕያዋን ፍጥረታት በሙሉ፦ ዕፅዋትና እንስሳት"},{"en":"Bio = life","am":"ባዮ (Bio) = ሕይወት"}],[{"en":"**Anthroposphere**","am":"**አንትሮፖስፌር (Anthroposphere)**"},{"en":"The cultural landscape: what humans have made (cities, roads, farms)","am":"ባህላዊ ገጽታ፦ ሰዎች የሠሯቸው ነገሮች (ከተሞች፣ መንገዶች፣ እርሻዎች)"},{"en":"Anthropo = human","am":"አንትሮፖ (Anthropo) = ሰው"}]]},{"type":"keypoint","variant":"note","title":{"en":"Textbook note","am":"የመማሪያ መጽሐፍ ማስታወሻ"},"text":{"en":"The Grade 9 textbook names the **four natural spheres**: hydrosphere, atmosphere, lithosphere and biosphere. The **anthroposphere** is the human-made part, studied mainly by human geography.","am":"የ9ኛ ክፍል መማሪያ መጽሐፍ **አራቱን የተፈጥሮ ሉሎች** ይጠቅሳል፦ ሃይድሮስፌር፣ ከባቢ አየር፣ ሊቶስፌርና ባዮስፌር። **አንትሮፖስፌር** ደግሞ በሰው የተሠራው ክፍል ሲሆን በዋናነት በሰው ጂኦግራፊ ይጠናል።"}},{"type":"example","title":{"en":"Find all 5 spheres on one farm","am":"5ቱን ሉሎች በአንድ እርሻ ላይ ፈልጉ"},"text":{"en":"Picture a farm in the Ethiopian highlands: the **soil and rocks** (lithosphere), the **river** (hydrosphere), the **air and rain clouds** (atmosphere), the **crops and cattle** (biosphere), and the **farmer''s house and the road** (anthroposphere).","am":"በኢትዮጵያ ደጋማ አካባቢ ያለን አንድ እርሻ አስቡ፦ **አፈሩና ዐለቱ** (ሊቶስፌር)፣ **ወንዙ** (ሃይድሮስፌር)፣ **አየሩና የዝናብ ደመናው** (ከባቢ አየር)፣ **ሰብሉና ከብቶቹ** (ባዮስፌር)፣ እንዲሁም **የገበሬው ቤትና መንገዱ** (አንትሮፖስፌር)።"}},{"type":"tip","title":{"en":"Memory tip","am":"የማስታወሻ ዘዴ"},"text":{"en":"Learn the word roots and you know the spheres: **Litho** = rock, **Hydro** = water, **Atmo** = air, **Bio** = life, **Anthropo** = human.","am":"የቃላቱን መነሻ ካወቃችሁ ሉሎቹን ታውቃላችሁ፦ **ሊቶ** = ዐለት፣ **ሃይድሮ** = ውሃ፣ **አትሞ** = አየር፣ **ባዮ** = ሕይወት፣ **አንትሮፖ** = ሰው።"}}]'::jsonb),
    (v_lesson_id, 3, 'How the scope changed over time', 'ወሰኑ በጊዜ ሂደት እንዴት ተለወጠ', 'history',
     '[{"type":"paragraph","text":{"en":"Geography''s scope and focus have changed a lot through history:","am":"የጂኦግራፊ ወሰንና ትኩረት በታሪክ ውስጥ ብዙ ተለውጧል፦"}},{"type":"list","ordered":true,"items":[{"en":"**Ancient times**: geography was seen as the **mother of many sciences**, including philosophy and the earth sciences.","am":"**በጥንት ዘመን**፦ ጂኦግራፊ ፍልስፍናንና የምድር ሳይንሶችን ጨምሮ **የብዙ ሳይንሶች እናት** ተደርጎ ይታይ ነበር።"},{"en":"**16th century**: geography began to emphasise **location**, asking where, why and what.","am":"**በ16ኛው ክፍለ ዘመን**፦ ጂኦግራፊ **አቀማመጥ (Location)** ላይ ማተኮር ጀመረ፤ የት? ለምን? ምን? የሚሉ ጥያቄዎችን ጠየቀ።"},{"en":"**Mid-18th century**: German geographers linked geography with philosophy and focused on the **relationship between people and the natural environment**. **Alexander von Humboldt** and **Carl Ritter** were major contributors.","am":"**በ18ኛው ክፍለ ዘመን አጋማሽ**፦ የጀርመን ጂኦግራፊ ምሁራን ጂኦግራፊን ከፍልስፍና ጋር አያይዘው **በሰውና በተፈጥሮ አካባቢ መካከል ባለው ግንኙነት** ላይ አተኮሩ። **አሌክሳንደር ቮን ሁምቦልት (Alexander von Humboldt)** እና **ካርል ሪተር (Carl Ritter)** ዋና አስተዋጽኦ ያደረጉ ምሁራን ነበሩ።"},{"en":"**19th century**: geographical societies and research groups were formed, which made geography stronger as a discipline.","am":"**በ19ኛው ክፍለ ዘመን**፦ የጂኦግራፊ ማኅበራትና የምርምር ቡድኖች ተቋቋሙ፤ ይህም ጂኦግራፊን እንደ ትምህርት ዘርፍ አጠናከረው።"},{"en":"**20th century**: geography became a **spatial science**.","am":"**በ20ኛው ክፍለ ዘመን**፦ ጂኦግራፊ **ቦታዊ ሳይንስ (Spatial Science)** ሆነ።"}]},{"type":"keypoint","variant":"note","title":{"en":"Mid or late 20th century?","am":"የ20ኛው ክፍለ ዘመን አጋማሽ ወይስ መጨረሻ?"},"text":{"en":"The textbook says “mid-20th century” in its introduction and “late 20th century” in this section. Most exam questions use **mid-20th century**, and **20th century** is always correct.","am":"መማሪያ መጽሐፉ በመግቢያው ላይ «የ20ኛው ክፍለ ዘመን አጋማሽ»፣ በዚህ ክፍል ደግሞ «የ20ኛው ክፍለ ዘመን መጨረሻ» ይላል። አብዛኞቹ የፈተና ጥያቄዎች **የ20ኛው ክፍለ ዘመን አጋማሽ** ይላሉ፤ **20ኛው ክፍለ ዘመን** ማለት ደግሞ ሁልጊዜ ትክክል ነው።"}},{"type":"example","title":{"en":"Is geography only about place names?","am":"ጂኦግራፊ የቦታ ስሞችን ማጥናት ብቻ ነው?"},"text":{"en":"No. Some people think geography is only about memorising place names, but its scope is very wide: it explains **where** things are, **why** they are there, and how people and nature **affect each other**.","am":"አይደለም። አንዳንድ ሰዎች ጂኦግራፊ የቦታ ስሞችን ማጥናት ብቻ ይመስላቸዋል፤ ነገር ግን ወሰኑ በጣም ሰፊ ነው፦ ነገሮች **የት** እንዳሉ፣ **ለምን** እዚያ እንዳሉ፣ እንዲሁም ሰውና ተፈጥሮ እርስ በርስ **እንዴት ተጽዕኖ እንደሚያሳድሩ** ያብራራል።"}}]'::jsonb),
    (v_lesson_id, 4, 'Key terms of 1.1 (revision)', 'የ1.1 ቁልፍ ቃላት (ክለሳ)', 'list-checks',
     '[{"type":"table","headers":[{"en":"Term","am":"ቃል"},{"en":"Meaning","am":"ትርጉም"}],"rows":[[{"en":"**Geography** (old definition)","am":"**ጂኦግራፊ** (የቀድሞ ትርጉም)"},{"en":"Describing or writing about the Earth (Eratosthenes)","am":"ምድርን መግለጽ ወይም ስለ ምድር መጻፍ (ኤራቶስቴንስ)"}],[{"en":"**Eratosthenes**","am":"**ኤራቶስቴንስ**"},{"en":"Greek scholar who first used the word geography","am":"ጂኦግራፊ የሚለውን ቃል መጀመሪያ የተጠቀመ የግሪክ ምሁር"}],[{"en":"**Richard Hartshorne**","am":"**ሪቻርድ ሃርትሾርን**"},{"en":"(1899–1992) Geography = accurate, orderly and rational description of the Earth''s surface","am":"(1899–1992) ጂኦግራፊ = የምድርን ገጽ ትክክለኛ፣ ሥርዓት ያለውና ምክንያታዊ ገለጻ"}],[{"en":"**Spatial science**","am":"**ቦታዊ ሳይንስ**"},{"en":"Studies the arrangement and distribution of things on the Earth''s surface (20th century)","am":"በምድር ገጽ ላይ ያሉ ነገሮችን አቀማመጥና ስርጭት ያጠናል (20ኛው ክፍለ ዘመን)"}],[{"en":"**Spatial-temporal science**","am":"**ቦታዊ-ጊዜያዊ ሳይንስ**"},{"en":"Modern definition: studies space (where) and time (when)","am":"ዘመናዊ ትርጉም፦ ቦታን (የት) እና ጊዜን (መቼ) ያጠናል"}],[{"en":"**Interdependence**","am":"**መደጋገፍ**"},{"en":"Humans and nature affect and depend on each other","am":"ሰውና ተፈጥሮ እርስ በርስ ተጽዕኖ ያሳድራሉ፣ ይደጋገፋሉ"}],[{"en":"**Science**","am":"**ሳይንስ**"},{"en":"A systematic way of acquiring knowledge through research","am":"በምርምር እውቀትን ሥርዓት ባለው መንገድ የማግኛ ዘዴ"}],[{"en":"**Physical geography**","am":"**የተፈጥሮ ጂኦግራፊ**"},{"en":"Studies natural features: climate, landforms, soil, vegetation, drainage","am":"ተፈጥሯዊ ገጽታዎችን ያጠናል፦ የአየር ንብረት፣ የመሬት ቅርጾች፣ አፈር፣ ዕፅዋት፣ የውሃ ፍሳሽ"}],[{"en":"**Human geography**","am":"**የሰው ጂኦግራፊ**"},{"en":"Studies human-made aspects: population, cities, economy, culture, politics","am":"በሰው የተሠሩ ገጽታዎችን ያጠናል፦ ሕዝብ፣ ከተሞች፣ ኢኮኖሚ፣ ባህል፣ ፖለቲካ"}],[{"en":"**Scope**","am":"**ወሰን**"},{"en":"Focus, degree, range and content of a subject","am":"የአንድ ትምህርት ትኩረት፣ ደረጃ፣ ስፋትና ይዘት"}],[{"en":"**The 5 spheres**","am":"**5ቱ ሉሎች**"},{"en":"Lithosphere (rock), hydrosphere (water), atmosphere (air), biosphere (life), anthroposphere (human-made)","am":"ሊቶስፌር (ዐለት)፣ ሃይድሮስፌር (ውሃ)፣ ከባቢ አየር (አየር)፣ ባዮስፌር (ሕይወት)፣ አንትሮፖስፌር (በሰው የተሠራ)"}]]}]'::jsonb);

  insert into public.quizzes (lesson_id, title_en, title_am, description_en, description_am)
  values (v_lesson_id, 'Quiz: Scope of Geography', 'ፈተና፦ የጂኦግራፊ ወሰን', '12 questions on scope, the five spheres and how geography''s scope developed.', 'ስለ ወሰን፣ ስለ አምስቱ ሉሎችና የጂኦግራፊ ወሰን እንዴት እንዳደገ 12 ጥያቄዎች።')
  returning id into v_quiz_id;

  insert into public.quiz_questions (quiz_id, sort_order, question_en, question_am, options_en, options_am, correct_index, explanation_en, explanation_am) values
    (v_quiz_id, 1, 'In geography, scope refers to:', 'በጂኦግራፊ ወሰን (Scope) የሚያመለክተው፦',
     array['Focus, degree, range and content', 'Only maps', 'The history of geographers', 'The distance between places']::text[],
     array['ትኩረት፣ ደረጃ፣ ስፋትና ይዘት', 'ካርታዎችን ብቻ', 'የጂኦግራፊ ምሁራንን ታሪክ', 'በቦታዎች መካከል ያለውን ርቀት']::text[],
     0, 'Scope is the focus, degree, range and content of a subject, in other words how much it covers.', 'ወሰን የአንድ ትምህርት ትኩረት፣ ደረጃ፣ ስፋትና ይዘት ነው፤ በሌላ አነጋገር ምን ያህል እንደሚሸፍን ነው።'),
    (v_quiz_id, 2, 'How would you describe the scope of geography?', 'የጂኦግራፊን ወሰን እንዴት ይገልጹታል?',
     array['Very narrow and fixed', 'Very wide and dynamic', 'Limited to place names', 'Limited to physical features']::text[],
     array['በጣም ጠባብና የማይለወጥ', 'በጣም ሰፊና ተለዋዋጭ', 'በቦታ ስሞች ብቻ የተወሰነ', 'በተፈጥሮ ገጽታዎች ብቻ የተወሰነ']::text[],
     1, 'Geography covers many physical and human features, and its scope keeps changing as new ideas appear.', 'ጂኦግራፊ ብዙ የተፈጥሮና የሰው ገጽታዎችን ይሸፍናል፤ ወሰኑም አዳዲስ ሐሳቦች ሲመጡ ይለወጣል።'),
    (v_quiz_id, 3, 'Which sphere is the solid layer of rock covering the planet?', 'ፕላኔቷን የሚሸፍነው ጠንካራው የዐለት ንብርብር የትኛው ሉል ነው?',
     array['Hydrosphere', 'Atmosphere', 'Lithosphere', 'Biosphere']::text[],
     array['ሃይድሮስፌር (Hydrosphere)', 'ከባቢ አየር (Atmosphere)', 'ሊቶስፌር (Lithosphere)', 'ባዮስፌር (Biosphere)']::text[],
     2, 'Litho means rock, so the lithosphere is the solid rock layer of the Earth.', 'ሊቶ ማለት ዐለት ነው፤ ስለዚህ ሊቶስፌር የምድር ጠንካራው የዐለት ንብርብር ነው።'),
    (v_quiz_id, 4, 'The cultural landscape (cities, roads, farms) belongs to the:', 'ባህላዊ ገጽታ (ከተሞች፣ መንገዶች፣ እርሻዎች) የየትኛው ሉል ክፍል ነው?',
     array['Biosphere', 'Anthroposphere', 'Lithosphere', 'Hydrosphere']::text[],
     array['ባዮስፌር (Biosphere)', 'አንትሮፖስፌር (Anthroposphere)', 'ሊቶስፌር (Lithosphere)', 'ሃይድሮስፌር (Hydrosphere)']::text[],
     1, 'Anthropo means human. The anthroposphere is everything humans have made: the cultural landscape.', 'አንትሮፖ ማለት ሰው ነው። አንትሮፖስፌር ሰዎች የሠሯቸው ነገሮች በሙሉ፣ ማለትም ባህላዊ ገጽታ ነው።'),
    (v_quiz_id, 5, 'Oceans, rivers and lakes are part of the:', 'ውቅያኖሶች፣ ወንዞችና ሐይቆች የየትኛው ሉል ክፍል ናቸው?',
     array['Hydrosphere', 'Atmosphere', 'Lithosphere', 'Anthroposphere']::text[],
     array['ሃይድሮስፌር (Hydrosphere)', 'ከባቢ አየር (Atmosphere)', 'ሊቶስፌር (Lithosphere)', 'አንትሮፖስፌር (Anthroposphere)']::text[],
     0, 'Hydro means water, so the hydrosphere includes all bodies of water.', 'ሃይድሮ ማለት ውሃ ነው፤ ስለዚህ ሃይድሮስፌር ሁሉንም የውሃ አካላት ያካትታል።'),
    (v_quiz_id, 6, 'The layer of gases (air) surrounding our planet is the:', 'ፕላኔታችንን የከበበው የጋዞች (የአየር) ንብርብር ምን ይባላል?',
     array['Biosphere', 'Lithosphere', 'Atmosphere', 'Hydrosphere']::text[],
     array['ባዮስፌር (Biosphere)', 'ሊቶስፌር (Lithosphere)', 'ከባቢ አየር (Atmosphere)', 'ሃይድሮስፌር (Hydrosphere)']::text[],
     2, 'The atmosphere is the air (gases) around the Earth.', 'ከባቢ አየር ምድርን የከበበው አየር (ጋዞች) ነው።'),
    (v_quiz_id, 7, 'All plants and animals on Earth make up the:', 'በምድር ላይ ያሉ ዕፅዋትና እንስሳት በሙሉ የትኛውን ሉል ይመሠርታሉ?',
     array['Biosphere', 'Anthroposphere', 'Atmosphere', 'Lithosphere']::text[],
     array['ባዮስፌር (Biosphere)', 'አንትሮፖስፌር (Anthroposphere)', 'ከባቢ አየር (Atmosphere)', 'ሊቶስፌር (Lithosphere)']::text[],
     0, 'Bio means life, so the biosphere is all living things.', 'ባዮ ማለት ሕይወት ነው፤ ስለዚህ ባዮስፌር ሁሉም ሕያዋን ፍጥረታት ናቸው።'),
    (v_quiz_id, 8, 'In ancient times, geography was considered:', 'በጥንት ዘመን ጂኦግራፊ እንደ ምን ይቆጠር ነበር?',
     array['A branch of medicine', 'The mother of many other sciences', 'A spatial science', 'A part of mathematics only']::text[],
     array['የሕክምና ዘርፍ', 'የብዙ ሌሎች ሳይንሶች እናት', 'ቦታዊ ሳይንስ', 'የሒሳብ ክፍል ብቻ']::text[],
     1, 'In ancient times geography was seen as the mother of many sciences, including philosophy and the earth sciences.', 'በጥንት ዘመን ጂኦግራፊ ፍልስፍናንና የምድር ሳይንሶችን ጨምሮ የብዙ ሳይንሶች እናት ተደርጎ ይታይ ነበር።'),
    (v_quiz_id, 9, 'Alexander von Humboldt and Carl Ritter focused geography on:', 'አሌክሳንደር ቮን ሁምቦልትና ካርል ሪተር ጂኦግራፊን በምን ላይ እንዲያተኩር አደረጉ?',
     array['Place names only', 'The relationship between people and the natural environment', 'Ocean tides', 'Map scales']::text[],
     array['በቦታ ስሞች ብቻ', 'በሰውና በተፈጥሮ አካባቢ መካከል ባለው ግንኙነት', 'በባሕር ውሃ ከፍታና ዝቅታ', 'በካርታ መለኪያ']::text[],
     1, 'In the mid-18th century, German geographers such as Humboldt and Ritter focused on the relationship between people and the natural environment.', 'በ18ኛው ክፍለ ዘመን አጋማሽ እንደ ሁምቦልትና ሪተር ያሉ የጀርመን ጂኦግራፊ ምሁራን በሰውና በተፈጥሮ አካባቢ ግንኙነት ላይ አተኮሩ።'),
    (v_quiz_id, 10, 'In the 16th century, geography began to emphasise:', 'በ16ኛው ክፍለ ዘመን ጂኦግራፊ በምን ላይ ማተኮር ጀመረ?',
     array['Location', 'Philosophy only', 'Computer mapping', 'Population growth']::text[],
     array['አቀማመጥ (Location)', 'ፍልስፍና ብቻ', 'የኮምፒውተር ካርታ', 'የሕዝብ ዕድገት']::text[],
     0, 'In the 16th century geography focused on location, asking where, why and what.', 'በ16ኛው ክፍለ ዘመን ጂኦግራፊ በአቀማመጥ ላይ አተኮረ፤ የት? ለምን? ምን? የሚሉ ጥያቄዎችን ጠየቀ።'),
    (v_quiz_id, 11, 'What happened to geography in the 19th century?', 'በ19ኛው ክፍለ ዘመን በጂኦግራፊ ላይ ምን ሆነ?',
     array['It stopped being studied', 'Geographical societies and research groups were formed', 'It became part of history', 'The word geography was first used']::text[],
     array['መጠናት አቆመ', 'የጂኦግራፊ ማኅበራትና የምርምር ቡድኖች ተቋቋሙ', 'የታሪክ ክፍል ሆነ', 'ጂኦግራፊ የሚለው ቃል ለመጀመሪያ ጊዜ ጥቅም ላይ ዋለ']::text[],
     1, 'In the 19th century geographical societies and research groups were formed, which strengthened geography as a discipline.', 'በ19ኛው ክፍለ ዘመን የጂኦግራፊ ማኅበራትና የምርምር ቡድኖች ተቋቁመው ጂኦግራፊን እንደ ትምህርት ዘርፍ አጠናከሩት።'),
    (v_quiz_id, 12, '“Geography is only about memorising place names.” This statement is:', '«ጂኦግራፊ የቦታ ስሞችን መሸምደድ ብቻ ነው።» ይህ አባባል፦',
     array['True, because maps show place names', 'False, because geography''s scope is very wide', 'True only for human geography', 'True only for physical geography']::text[],
     array['ትክክል ነው፤ ምክንያቱም ካርታዎች የቦታ ስሞችን ያሳያሉ', 'ስህተት ነው፤ ምክንያቱም የጂኦግራፊ ወሰን በጣም ሰፊ ነው', 'ለሰው ጂኦግራፊ ብቻ ትክክል ነው', 'ለተፈጥሮ ጂኦግራፊ ብቻ ትክክል ነው']::text[],
     1, 'Geography explains where things are, why they are there and how people and nature interact, so it is much more than place names.', 'ጂኦግራፊ ነገሮች የት እንዳሉ፣ ለምን እዚያ እንዳሉና ሰውና ተፈጥሮ እንዴት እንደሚገናኙ ያብራራል፤ ስለዚህ ከቦታ ስሞች እጅግ የላቀ ነው።');
end
$migration$;
