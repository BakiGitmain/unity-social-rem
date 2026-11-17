-- Lesson 1.1.6 Schools of Thought: Possibilism, the Quantitative Revolution and Applied Geography
-- geography / grade 9 / Unit One
-- Generated from content/lessons/geography/grade-9/unit-1/1-1-6.json by scripts/lesson-to-sql.mjs. Do not edit by hand.

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
  if exists (select 1 from public.lessons where unit_id = v_unit_id and code = '1.1.6') then
    raise exception 'Lesson 1.1.6 already exists in this unit';
  end if;
  insert into public.lessons (unit_id, code, slug, sort_order, title_en, title_am) values (v_unit_id, '1.1.6', '1-1-6', 6, '', '')
  returning id into v_lesson_id;
  update public.lessons set
    slug = '1-1-6', sort_order = 6, section_code = '1.1',
    section_title_en = 'The Science of Geography', section_title_am = 'የጂኦግራፊ ሳይንስ',
    title_en = 'Schools of Thought: Possibilism, the Quantitative Revolution and Applied Geography', title_am = 'የአስተሳሰብ ትምህርት ቤቶች፦ ዕድላዊነት፣ መጠናዊ አብዮትና ተግባራዊ ጂኦግራፊ',
    summary_en = 'B. Environmental possibilism (people can change nature), C. the Quantitative Revolution of the 1950s (statistics, models and computers), and D. Applied Geography (using geography to solve real problems).', summary_am = 'ለ. የአካባቢ ዕድላዊነት (ሰው ተፈጥሮን መለወጥ ይችላል)፣ ሐ. የ1950ዎቹ መጠናዊ አብዮት (ስታቲስቲክስ፣ ሞዴሎችና ኮምፒውተሮች)፣ እና መ. ተግባራዊ ጂኦግራፊ (ጂኦግራፊን እውነተኛ ችግሮችን ለመፍታት መጠቀም)።',
    minutes = 11, main_topics = '[{"title":{"en":"B. Environmental Possibilism","am":"ለ. የአካባቢ ዕድላዊነት"},"points":[{"en":"**Humans influence** the environment; postulated by **Febvre**.","am":"**ሰዎች** በአካባቢ ላይ **ተጽዕኖ ያሳድራሉ**፤ ያቀረበው **ፌብቭር** ነው።"},{"en":"**Two-way** human–environment relationship.","am":"**የሁለትዮሽ** የሰውና የአካባቢ ግንኙነት።"},{"en":"\"No necessities, only possibilities.\" Example: **irrigation** in deserts.","am":"«ግዴታዎች የሉም፣ ዕድሎች ብቻ ናቸው።» ምሳሌ፦ በምድረ በዳ **መስኖ**።"},{"en":"Widely accepted today; it criticised determinism.","am":"ዛሬ በሰፊው ተቀባይነት አለው፤ ወሳኝነትን ተችቷል።"}]},{"title":{"en":"C. The Quantitative Revolution","am":"ሐ. መጠናዊ አብዮት"},"points":[{"en":"**Early 1950s**; used **statistics, mathematical models and computers**.","am":"**በ1950ዎቹ መጀመሪያ**፤ **ስታቲስቲክስ፣ የሂሳብ ሞዴሎችና ኮምፒውተሮችን** ተጠቅሟል።"},{"en":"A response to a crisis (e.g. Harvard closed geography in **1948**).","am":"ለቀውስ የተሰጠ ምላሽ (ለምሳሌ ሀርቫርድ በ**1948** ጂኦግራፊን ዘጋ)።"},{"en":"Shift **from descriptive to empirical law-making** geography.","am":"**ከገላጭ ወደ ተጨባጭ ሕግ አውጪ** ጂኦግራፊ የተደረገ ሽግግር።"}]},{"title":{"en":"D. Applied Geography","am":"መ. ተግባራዊ ጂኦግራፊ"},"points":[{"en":"Using geography to **solve problems** and aid decisions.","am":"**ችግሮችን ለመፍታትና** ውሳኔ ለማገዝ ጂኦግራፊን መጠቀም።"},{"en":"Latter 20th century; **roots in the Quantitative Revolution**.","am":"የ20ኛው ክፍለ ዘመን የኋለኛው ክፍል፤ **መሠረቱ መጠናዊ አብዮት**።"},{"en":"Jobs: urban planners, GIS analysts, cartographers, environmentalists...","am":"ሙያዎች፦ የከተማ ፕላን ባለሙያዎች፣ የጂአይኤስ ተንታኞች፣ ካርታ ሠሪዎች፣ የአካባቢ ጥበቃ ባለሙያዎች..."}]}]'::jsonb, glossary = '[{"term":{"en":"Environmental Possibilism","am":"የአካባቢ ዕድላዊነት"},"definition":{"en":"The school of thought that says humans influence and can change the natural environment; a two-way relationship.","am":"ሰዎች በተፈጥሮ አካባቢ ላይ ተጽዕኖ ያሳድራሉ፣ ሊለውጡትም ይችላሉ የሚል የአስተሳሰብ ትምህርት ቤት፤ የሁለትዮሽ ግንኙነት።"}},{"term":{"en":"Febvre","am":"ፌብቭር"},"definition":{"en":"Lucien Febvre, the scholar who postulated (and named) possibilism.","am":"ዕድላዊነትን ያቀረበው (ስምም የሰጠው) ምሁር ሉሲየን ፌብቭር።"}},{"term":{"en":"Two-way relationship","am":"የሁለትዮሽ ግንኙነት"},"definition":{"en":"Nature affects people and people also affect nature.","am":"ተፈጥሮ በሰዎች ላይ ተጽዕኖ ታሳድራለች፤ ሰዎችም በተፈጥሮ ላይ ተጽዕኖ ያሳድራሉ።"}},{"term":{"en":"Quantitative Revolution","am":"መጠናዊ አብዮት"},"definition":{"en":"The change in geography in the early 1950s to using statistics, mathematical models and computers.","am":"በ1950ዎቹ መጀመሪያ ጂኦግራፊ ስታቲስቲክስን፣ የሂሳብ ሞዴሎችንና ኮምፒውተሮችን ወደመጠቀም የተሸጋገረበት ለውጥ።"}},{"term":{"en":"Nomothetic","am":"ሕግ አውጪ (Nomothetic)"},"definition":{"en":"Law-making: looking for general rules (laws) that explain many places, not only describing one place.","am":"ሕግ አውጪ፦ አንድን ቦታ መግለጽ ብቻ ሳይሆን ብዙ ቦታዎችን የሚያብራሩ አጠቃላይ ሕጎችን መፈለግ።"}},{"term":{"en":"Descriptive statistics","am":"ገላጭ ስታቲስቲክስ"},"definition":{"en":"Statistics that summarise data, such as averages and totals.","am":"እንደ አማካይና ድምር ያሉ መረጃን የሚያጠቃልሉ ስታቲስቲክስ።"}},{"term":{"en":"Inferential statistics","am":"አመላካች ስታቲስቲክስ"},"definition":{"en":"Statistics that draw conclusions about a whole group from a sample.","am":"ከናሙና ተነስቶ ስለ መላው ቡድን ድምዳሜ ላይ የሚደርስ ስታቲስቲክስ።"}},{"term":{"en":"Gravity models","am":"የስበት ሞዴሎች"},"definition":{"en":"Simple mathematical models, e.g. of movement between places based on their size and distance.","am":"ቀላል የሂሳብ ሞዴሎች፤ ለምሳሌ በቦታዎች መጠንና ርቀት ላይ ተመሥርቶ በመካከላቸው ያለ እንቅስቃሴ።"}},{"term":{"en":"Applied Geography","am":"ተግባራዊ ጂኦግራፊ"},"definition":{"en":"Using geographic analysis to solve socio-economic and political problems and to help decision making.","am":"ማኅበራዊ-ኢኮኖሚያዊና ፖለቲካዊ ችግሮችን ለመፍታትና ውሳኔ ለመስጠት ለማገዝ ጂኦግራፊያዊ ትንተናን መጠቀም።"}},{"term":{"en":"GIS","am":"ጂአይኤስ (GIS)"},"definition":{"en":"Geographical Information System: computer tools for storing and analysing map data.","am":"የጂኦግራፊ መረጃ ሥርዓት፦ የካርታ መረጃን ለማከማቸትና ለመተንተን የሚያገለግሉ የኮምፒውተር መሣሪያዎች።"}}]'::jsonb,
    homework = '[]'::jsonb, practice = '[]'::jsonb
  where id = v_lesson_id;

  insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, blocks) values
    (v_lesson_id, 1, 'B. Environmental Possibilism', 'ለ. የአካባቢ ዕድላዊነት', 'sprout',
     '[{"type":"keypoint","variant":"definition","title":{"en":"Environmental Possibilism","am":"የአካባቢ ዕድላዊነት (Environmental Possibilism)"},"text":{"en":"**Environmental possibilism** is the idea that **human beings influence** the natural environment.","am":"**የአካባቢ ዕድላዊነት (Environmental Possibilism)** **ሰዎች** በተፈጥሮ አካባቢ ላይ **ተጽዕኖ ያሳድራሉ** የሚል አስተሳሰብ ነው።"}},{"type":"paragraph","text":{"en":"The school of possibilism was postulated (put forward) by **Febvre**.","am":"የዕድላዊነት ትምህርት ቤት የቀረበው በ**ፌብቭር (Febvre)** ነው።"}},{"type":"paragraph","text":{"en":"Its famous saying: **\"There are no necessities, but only possibilities.\"** Nature offers choices; people decide.","am":"ታዋቂ አባባሉ፦ **«ግዴታዎች የሉም፣ ዕድሎች ብቻ ናቸው።»** ተፈጥሮ አማራጮችን ታቀርባለች፤ ሰዎች ይወስናሉ።"}},{"type":"keypoint","variant":"note","title":{"en":"Textbook note","am":"የመማሪያ መጽሐፍ ማስታወሻ"},"text":{"en":"**Lucien Febvre** gave the school its name. Many books call **Paul Vidal de la Blache** its founder. In exams, the expected answer is **Febvre**.","am":"ለትምህርት ቤቱ ስም የሰጠው **ሉሲየን ፌብቭር (Lucien Febvre)** ነው። ብዙ መጻሕፍት **ፖል ቪዳል ዴ ላ ብላሽ (Vidal de la Blache)**ን መሥራቹ ይሉታል። በፈተና የሚጠበቀው መልስ **ፌብቭር** ነው።"}}]'::jsonb),
    (v_lesson_id, 2, 'The main ideas of possibilism', 'የዕድላዊነት ዋና ሐሳቦች', 'users',
     '[{"type":"list","items":[{"en":"Human beings are **masters of the environment** and can judge their own benefits.","am":"ሰዎች **የአካባቢ ጌቶች** ናቸው፤ የራሳቸውን ጥቅም መመዘን ይችላሉ።"},{"en":"There is a **two-way relationship** between humans and the environment.","am":"በሰውና በአካባቢ መካከል **የሁለትዮሽ ግንኙነት** አለ።"},{"en":"People can **influence the environment** to improve their way of life.","am":"ሰዎች አኗኗራቸውን ለማሻሻል **በአካባቢ ላይ ተጽዕኖ ማሳደር** ይችላሉ።"},{"en":"The environment can affect people, but **knowledge and skills** let us control these effects.","am":"አካባቢ በሰዎች ላይ ተጽዕኖ ሊያሳድር ይችላል፤ ነገር ግን **እውቀትና ክህሎት** እነዚህን ተጽዕኖዎች እንድንቆጣጠር ያስችሉናል።"}]},{"type":"keypoint","variant":"important","title":{"en":"Widely accepted today","am":"ዛሬ በሰፊው ተቀባይነት ያለው"},"text":{"en":"Possibilism is **widely accepted today** because it recognises that people can change their environment with **better technology**.","am":"ዕድላዊነት **ዛሬ በሰፊው ተቀባይነት አለው**፤ ምክንያቱም ሰዎች በ**ተሻለ ቴክኖሎጂ** አካባቢያቸውን መለወጥ እንደሚችሉ ይቀበላል።"}}]'::jsonb),
    (v_lesson_id, 3, 'Determinism vs possibilism', 'ወሳኝነት እና ዕድላዊነት', 'scale',
     '[{"type":"table","headers":[{"en":"Question","am":"ጥያቄ"},{"en":"Determinism","am":"ወሳኝነት"},{"en":"Possibilism","am":"ዕድላዊነት"}],"rows":[[{"en":"Who is the master?","am":"ጌታው ማን ነው?"},{"en":"Nature","am":"ተፈጥሮ"},{"en":"People","am":"ሰው"}],[{"en":"Relationship","am":"ግንኙነቱ"},{"en":"One-way (nature → people)","am":"የአንድ አቅጣጫ (ተፈጥሮ → ሰው)"},{"en":"Two-way (nature ↔ people)","am":"የሁለትዮሽ (ተፈጥሮ ↔ ሰው)"}],[{"en":"Humans are...","am":"ሰዎች..."},{"en":"Passive agents","am":"ተገዢ (ተቀባይ) ናቸው"},{"en":"Active decision makers","am":"ንቁ ውሳኔ ሰጪዎች ናቸው"}],[{"en":"Key scholars","am":"ዋና ምሁራን"},{"en":"Darwin, Demolins, Ratzel","am":"ዳርዊን፣ ዴሞላን፣ ራትዘል"},{"en":"Febvre (Vidal de la Blache)","am":"ፌብቭር (ቪዳል ዴ ላ ብላሽ)"}]]},{"type":"paragraph","text":{"en":"Possibilists **strongly criticised determinism** because it treats people as passive and ignores what people can do.","am":"የዕድላዊነት አራማጆች **ወሳኝነትን አጥብቀው ተቹ**፤ ምክንያቱም ሰዎችን ተገዢ አድርጎ ይመለከታል፣ ሰዎች ሊያደርጉ የሚችሉትንም ይዘነጋል።"}}]'::jsonb),
    (v_lesson_id, 4, 'Possibilism in real life', 'ዕድላዊነት በእውነተኛ ሕይወት', 'tractor',
     '[{"type":"example","title":{"en":"Textbook example: irrigation","am":"የመጽሐፉ ምሳሌ፦ መስኖ"},"text":{"en":"People use **irrigation** to turn barren desert land into productive farmland.","am":"ሰዎች ምድረ በዳውን ወደ ምርታማ የእርሻ መሬት ለመቀየር **መስኖ** ይጠቀማሉ።"}},{"type":"example","title":{"en":"Ethiopian examples","am":"የኢትዮጵያ ምሳሌዎች"},"text":{"en":"Sugarcane is grown with irrigation in the hot, dry **Awash valley**. Farmers in **Tigray** build terraces on steep slopes to farm and stop erosion.","am":"በሞቃታማውና ደረቁ **የአዋሽ ሸለቆ** ሸንኮራ አገዳ በመስኖ ይመረታል። በ**ትግራይ** ገበሬዎች ገደላማ ቦታዎችን ለማረስና የአፈር መሸርሸርን ለማቆም እርከን ይሠራሉ።"}},{"type":"tip","title":{"en":"Memory trick","am":"የማስታወሻ ዘዴ"},"text":{"en":"**Possibilism = Possible.** With technology, it is *possible* to change nature.","am":"**ዕድላዊነት = ዕድል (Possible)።** በቴክኖሎጂ ተፈጥሮን መለወጥ *ይቻላል*።"}}]'::jsonb),
    (v_lesson_id, 5, 'C. The Quantitative Revolution', 'ሐ. መጠናዊ አብዮት', 'flask-conical',
     '[{"type":"keypoint","variant":"definition","title":{"en":"Quantitative Revolution","am":"መጠናዊ አብዮት (Quantitative Revolution)"},"text":{"en":"The **Quantitative Revolution** was a change in geography in the **early 1950s** to a theoretical approach that uses **numbers, statistics and mathematical models**.","am":"**መጠናዊ አብዮት (Quantitative Revolution)** በ**1950ዎቹ መጀመሪያ** በጂኦግራፊ የተከሰተ፣ **ቁጥሮችን፣ ስታቲስቲክስንና የሂሳብ ሞዴሎችን** ወደሚጠቀም ንድፈ ሐሳባዊ አቀራረብ የተደረገ ለውጥ ነው።"}},{"type":"paragraph","text":{"en":"It used rigorous **mathematical formulae borrowed from the physical sciences**.","am":"**ከተፈጥሮ ሳይንሶች የተዋሱ** ጥብቅ **የሂሳብ ቀመሮችን** ተጠቅሟል።"}},{"type":"paragraph","text":{"en":"It was driven by the **computer** and its ability to process data quickly.","am":"ያንቀሳቀሰው **ኮምፒውተር** እና መረጃን በፍጥነት የማስኬድ ችሎታው ነበር።"}}]'::jsonb),
    (v_lesson_id, 6, 'Why it happened: the 1950s crisis', 'ለምን ተከሰተ፦ የ1950ዎቹ ቀውስ', 'hourglass',
     '[{"type":"paragraph","text":{"en":"The Quantitative Revolution was a **response to a crisis** that geography faced in the late 1940s and early 1950s:","am":"መጠናዊ አብዮት ጂኦግራፊ በ1940ዎቹ መጨረሻና በ1950ዎቹ መጀመሪያ ለገጠመው **ቀውስ የተሰጠ ምላሽ** ነበር፦"}},{"type":"list","items":[{"en":"Geography departments were **closed**, e.g. at **Harvard University in 1948**.","am":"የጂኦግራፊ ትምህርት ክፍሎች **ተዘጉ**፤ ለምሳሌ በ**ሀርቫርድ ዩኒቨርሲቲ በ1948**።"},{"en":"Geography was seen as **only descriptive and unscientific**: it did not explain *why* things happen.","am":"ጂኦግራፊ **ገላጭ ብቻ እና ሳይንሳዊ ያልሆነ** ተብሎ ታየ፤ ነገሮች *ለምን* እንደሚከሰቱ አያብራራም ነበር።"},{"en":"It was seen as **not useful for solving problems**.","am":"**ችግሮችን ለመፍታት የማይጠቅም** ተብሎ ታየ።"},{"en":"The split between human and physical geography continued.","am":"በሰው ጂኦግራፊና በተፈጥሮ ጂኦግራፊ መካከል ያለው መከፋፈል ቀጠለ።"},{"en":"People were unsure if geography was a science, an art or a social science.","am":"ሰዎች ጂኦግራፊ ሳይንስ፣ ጥበብ ወይስ ማኅበራዊ ሳይንስ እንደሆነ እርግጠኛ አልነበሩም።"}]}]'::jsonb),
    (v_lesson_id, 7, 'Its techniques and contribution', 'ዘዴዎቹና አስተዋጽኦው', 'ruler',
     '[{"type":"points","items":[{"icon":"list-checks","title":{"en":"Descriptive statistics","am":"ገላጭ ስታቲስቲክስ (Descriptive statistics)"},"text":{"en":"Summarise data (averages, totals).","am":"መረጃን ያጠቃልላል (አማካይ፣ ድምር)።"}},{"icon":"search","title":{"en":"Inferential statistics","am":"አመላካች ስታቲስቲክስ (Inferential statistics)"},"text":{"en":"Draw conclusions from samples.","am":"ከናሙናዎች ድምዳሜ ላይ ይደርሳል።"}},{"icon":"route","title":{"en":"Gravity models","am":"የስበት ሞዴሎች (Gravity models)"},"text":{"en":"Basic equations, e.g. movement between towns.","am":"መሠረታዊ ቀመሮች፤ ለምሳሌ በከተሞች መካከል ያለ እንቅስቃሴ።"}},{"icon":"factory","title":{"en":"Deterministic models","am":"ወሳኝ ሞዴሎች (Deterministic models)"},"text":{"en":"**Von Thünen''s** and **Weber''s** location models.","am":"የ**ቮን ቲውነን** እና የ**ዌበር** የአቀማመጥ ሞዴሎች።"}},{"icon":"circle-help","title":{"en":"Statistical models","am":"ስታቲስቲካዊ ሞዴሎች (Statistical models)"},"text":{"en":"Use the concept of **probability**.","am":"የ**ዕድል (Probability)** ጽንሰ ሐሳብ ይጠቀማሉ።"}}]},{"type":"keypoint","variant":"important","title":{"en":"The big shift","am":"ትልቁ ለውጥ"},"text":{"en":"Geography shifted **from descriptive geography to empirical, law-making (nomothetic) geography**.","am":"ጂኦግራፊ **ከገላጭ ጂኦግራፊ ወደ ተጨባጭ፣ ሕግ አውጪ (Nomothetic) ጂኦግራፊ** ተሸጋገረ።"}}]'::jsonb),
    (v_lesson_id, 8, 'D. Applied Geography', 'መ. ተግባራዊ ጂኦግራፊ', 'lightbulb',
     '[{"type":"keypoint","variant":"definition","title":{"en":"Applied Geography","am":"ተግባራዊ ጂኦግራፊ (Applied Geography)"},"text":{"en":"**Applied geography** is the use of geographic analysis to **solve socio-economic and political problems** and to **help decision making**.","am":"**ተግባራዊ ጂኦግራፊ (Applied Geography)** ጂኦግራፊያዊ ትንተናን **ማኅበራዊ-ኢኮኖሚያዊና ፖለቲካዊ ችግሮችን ለመፍታት** እና **ውሳኔ ለመስጠት ለማገዝ** መጠቀም ነው።"}},{"type":"paragraph","text":{"en":"It emerged in the **latter part of the 20th century** and has its **roots in the Quantitative Revolution**.","am":"የተነሳው በ**20ኛው ክፍለ ዘመን የኋለኛው ክፍል** ሲሆን **መሠረቱ መጠናዊ አብዮት** ነው።"}},{"type":"paragraph","text":{"en":"It is used in private business, government and non-profit organisations.","am":"በግል ንግድ፣ በመንግሥትና በትርፍ አልባ ድርጅቶች ጥቅም ላይ ይውላል።"}}]'::jsonb),
    (v_lesson_id, 9, 'Geographers at work', 'ጂኦግራፈሮች በሥራ ላይ', 'map',
     '[{"type":"paragraph","text":{"en":"Thanks to applied geography, many geographers today work as:","am":"በተግባራዊ ጂኦግራፊ ምክንያት ዛሬ ብዙ ጂኦግራፈሮች በሚከተሉት ሙያዎች ይሠራሉ፦"}},{"type":"points","items":[{"icon":"building-2","title":{"en":"Urban planners","am":"የከተማ ፕላን ባለሙያዎች"},"text":{"en":"Plan where homes, roads and schools go.","am":"ቤቶች፣ መንገዶችና ትምህርት ቤቶች የት እንደሚሠሩ ያቅዳሉ።"}},{"icon":"map-pin","title":{"en":"GIS analysts & cartographers","am":"የጂአይኤስ ተንታኞችና ካርታ ሠሪዎች"},"text":{"en":"Make and analyse maps.","am":"ካርታዎችን ይሠራሉ፣ ይተነትናሉ።"}},{"icon":"leaf","title":{"en":"Environmentalists","am":"የአካባቢ ጥበቃ ባለሙያዎች"},"text":{"en":"Protect land, water and forests.","am":"መሬትን፣ ውኃንና ደንን ይጠብቃሉ።"}},{"icon":"route","title":{"en":"Transport & location planners","am":"የትራንስፖርትና የአቀማመጥ ዕቅድ ባለሙያዎች"},"text":{"en":"Highway, public-transport and logistics planning.","am":"የአውራ ጎዳና፣ የሕዝብ ትራንስፖርትና የሎጂስቲክስ ዕቅድ።"}},{"icon":"users","title":{"en":"Demographic analysts","am":"የሕዝብ ቁጥር ተንታኞች"},"text":{"en":"Study population data for planning.","am":"ለዕቅድ የሕዝብ ቁጥር መረጃን ያጠናሉ።"}}]}]'::jsonb);

  insert into public.quizzes (lesson_id, title_en, title_am, description_en, description_am)
  values (v_lesson_id, 'Quiz: Possibilism, Quantitative Revolution, Applied Geography', 'ፈተና፦ ዕድላዊነት፣ መጠናዊ አብዮት፣ ተግባራዊ ጂኦግራፊ', '16 questions on schools B, C and D, including exam-style questions.', 'ስለ ለ፣ ሐ እና መ ትምህርት ቤቶች 16 ጥያቄዎች፣ የፈተና ዓይነት ጥያቄዎችን ጨምሮ።')
  returning id into v_quiz_id;

  insert into public.quiz_questions (quiz_id, sort_order, kind, needs_calculation, question_en, question_am, options_en, options_am, correct_index, answer, steps, guide, explanation_en, explanation_am) values
    (v_quiz_id, 1, 'choice', false, 'Environmental possibilism says that:', 'የአካባቢ ዕድላዊነት የሚለው፦',
     array['Nature controls every human activity', 'Human beings influence the natural environment', 'The environment has no effect on people', 'Only statistics can explain geography']::text[],
     array['ተፈጥሮ እያንዳንዱን የሰው እንቅስቃሴ ትቆጣጠራለች', 'ሰዎች በተፈጥሮ አካባቢ ላይ ተጽዕኖ ያሳድራሉ', 'አካባቢ በሰዎች ላይ ምንም ተጽዕኖ የለውም', 'ጂኦግራፊን ማብራራት የሚችለው ስታቲስቲክስ ብቻ ነው']::text[],
     1, null, '[]'::jsonb, null,
     'Possibilism sees people as masters who can influence and change the environment.', 'ዕድላዊነት ሰዎችን አካባቢን ተጽዕኖ ሊያሳድሩበትና ሊለውጡት የሚችሉ ጌቶች አድርጎ ይመለከታቸዋል።'),
    (v_quiz_id, 2, 'choice', false, 'The school of possibilism was postulated by:', 'የዕድላዊነት ትምህርት ቤትን ያቀረበው ማን ነው?',
     array['Friedrich Ratzel', 'Charles Darwin', 'Febvre', 'Eratosthenes']::text[],
     array['ፍሬድሪክ ራትዘል', 'ቻርለስ ዳርዊን', 'ፌብቭር', 'ኤራቶስቴንስ']::text[],
     2, null, '[]'::jsonb, null,
     'Febvre postulated (and named) possibilism. Ratzel and Darwin are linked to determinism; Eratosthenes coined the word "geography".', 'ዕድላዊነትን ያቀረበው (ስምም የሰጠው) ፌብቭር ነው። ራትዘልና ዳርዊን ከወሳኝነት ጋር ይያያዛሉ፤ ኤራቶስቴንስ «ጂኦግራፊ» የሚለውን ቃል ፈጠረ።'),
    (v_quiz_id, 3, 'choice', false, 'The main theme of possibilism is:', 'የዕድላዊነት ዋና ጭብጥ፦',
     array['The two-way relationship between humans and nature', 'Human beings cannot modify their environment', 'Human society is a passive agent', 'Humans are always under the influence of nature']::text[],
     array['በሰውና በተፈጥሮ መካከል ያለ የሁለትዮሽ ግንኙነት', 'ሰዎች አካባቢያቸውን መለወጥ አይችሉም', 'የሰው ማኅበረሰብ ተገዢ ነው', 'ሰዎች ሁልጊዜ በተፈጥሮ ተጽዕኖ ሥር ናቸው']::text[],
     0, null, '[]'::jsonb, null,
     'Possibilists stress a two-way relationship. The other three options describe determinism.', 'የዕድላዊነት አራማጆች የሁለትዮሽ ግንኙነትን ያጎላሉ። ሌሎቹ ሦስት አማራጮች ወሳኝነትን ይገልጻሉ።'),
    (v_quiz_id, 4, 'choice', false, 'Turning desert land into farmland by irrigation supports:', 'ምድረ በዳን በመስኖ ወደ እርሻ መሬት መቀየር የሚደግፈው፦',
     array['Environmental determinism', 'Environmental possibilism', 'The regional approach', 'Descriptive geography']::text[],
     array['የአካባቢ ወሳኝነትን', 'የአካባቢ ዕድላዊነትን', 'ክልላዊ አቀራረብን', 'ገላጭ ጂኦግራፊን']::text[],
     1, null, '[]'::jsonb, null,
     'People using technology to change nature is the classic example of possibilism.', 'ሰዎች ቴክኖሎጂን ተጠቅመው ተፈጥሮን መለወጣቸው የዕድላዊነት ዋና ምሳሌ ነው።'),
    (v_quiz_id, 5, 'choice', false, 'Which saying belongs to possibilism?', 'የትኛው አባባል የዕድላዊነት ነው?',
     array['"Nature is the master of people."', '"There are no necessities, only possibilities."', '"Survival of the fittest."', '"Geography is the description of the earth."']::text[],
     array['«ተፈጥሮ የሰው ጌታ ናት።»', '«ግዴታዎች የሉም፣ ዕድሎች ብቻ ናቸው።»', '«የብቁዎች መትረፍ።»', '«ጂኦግራፊ የምድር ገለጻ ነው።»']::text[],
     1, null, '[]'::jsonb, null,
     'Possibilists argued that nature offers choices (possibilities), and people decide.', 'የዕድላዊነት አራማጆች ተፈጥሮ አማራጮችን (ዕድሎችን) ታቀርባለች፣ ሰዎች ይወስናሉ ብለው ተከራከሩ።'),
    (v_quiz_id, 6, 'choice', false, 'Why did possibilists criticise determinism?', 'የዕድላዊነት አራማጆች ወሳኝነትን ለምን ተቹ?',
     array['It used too much mathematics', 'It treated people as passive agents controlled by nature', 'It ignored the climate', 'It was invented after the 1950s']::text[],
     array['በጣም ብዙ ሂሳብ ስለተጠቀመ', 'ሰዎችን በተፈጥሮ የሚቆጣጠሩ ተገዢዎች አድርጎ ስለተመለከተ', 'የአየር ንብረትን ስለዘነጋ', 'ከ1950ዎቹ በኋላ ስለተፈጠረ']::text[],
     1, null, '[]'::jsonb, null,
     'Determinism ignores human knowledge and skills; possibilists showed people can regulate nature''s effects.', 'ወሳኝነት የሰውን እውቀትና ክህሎት ይዘነጋል፤ የዕድላዊነት አራማጆች ሰዎች የተፈጥሮን ተጽዕኖ መቆጣጠር እንደሚችሉ አሳዩ።'),
    (v_quiz_id, 7, 'choice', false, 'The Quantitative Revolution emerged in geography in the:', 'መጠናዊ አብዮት በጂኦግራፊ የተነሳው፦',
     array['Early 1900s', 'Early 1950s', 'Late 1990s', 'Time of the ancient Greeks']::text[],
     array['በ1900ዎቹ መጀመሪያ', 'በ1950ዎቹ መጀመሪያ', 'በ1990ዎቹ መጨረሻ', 'በጥንታዊ ግሪኮች ዘመን']::text[],
     1, null, '[]'::jsonb, null,
     'It emerged in the early 1950s and continued into the 1960s.', 'በ1950ዎቹ መጀመሪያ ተነስቶ እስከ 1960ዎቹ ቀጥሏል።'),
    (v_quiz_id, 8, 'choice', false, 'A nomothetic (empirical law-making) geography that occurred in the mid-20th century is:', 'በ20ኛው ክፍለ ዘመን አጋማሽ የተከሰተው ሕግ አውጪ (Nomothetic) ጂኦግራፊ፦',
     array['Environmental determinism', 'The Quantitative Revolution', 'The regional approach', 'Political geography']::text[],
     array['የአካባቢ ወሳኝነት', 'መጠናዊ አብዮት', 'ክልላዊ አቀራረብ', 'ፖለቲካዊ ጂኦግራፊ']::text[],
     1, null, '[]'::jsonb, null,
     'The Quantitative Revolution shifted geography from description to empirical law-making.', 'መጠናዊ አብዮት ጂኦግራፊን ከገለጻ ወደ ተጨባጭ ሕግ አውጪነት አሸጋገረው።'),
    (v_quiz_id, 9, 'choice', false, 'What mainly drove the Quantitative Revolution?', 'መጠናዊ አብዮትን በዋናነት ያንቀሳቀሰው ምንድን ነው?',
     array['The computer and fast data processing', 'The invention of the compass', 'The First World War', 'Greek philosophy']::text[],
     array['ኮምፒውተርና ፈጣን የመረጃ ማስኬድ', 'የኮምፓስ መፈልሰፍ', 'አንደኛው የዓለም ጦርነት', 'የግሪክ ፍልስፍና']::text[],
     0, null, '[]'::jsonb, null,
     'Computers made it possible to process large amounts of data quickly.', 'ኮምፒውተሮች ብዙ መረጃን በፍጥነት ማስኬድ አስቻሉ።'),
    (v_quiz_id, 10, 'choice', false, 'Which was one of the challenges (crisis) geography faced before the Quantitative Revolution?', 'ከመጠናዊ አብዮት በፊት ጂኦግራፊ ከገጠሙት ፈተናዎች (ቀውሶች) አንዱ የትኛው ነው?',
     array['Too many geography departments were opened', 'Geography was seen as only descriptive and unscientific', 'Geography used too many computers', 'Geography solved every problem']::text[],
     array['በጣም ብዙ የጂኦግራፊ ትምህርት ክፍሎች ተከፈቱ', 'ጂኦግራፊ ገላጭ ብቻና ሳይንሳዊ ያልሆነ ተብሎ ታየ', 'ጂኦግራፊ በጣም ብዙ ኮምፒውተሮችን ተጠቀመ', 'ጂኦግራፊ እያንዳንዱን ችግር ፈታ']::text[],
     1, null, '[]'::jsonb, null,
     'Critics said geography only described places and did not explain why things happen.', 'ተቺዎች ጂኦግራፊ ቦታዎችን ብቻ ይገልጻል፣ ነገሮች ለምን እንደሚከሰቱ አያብራራም አሉ።'),
    (v_quiz_id, 11, 'choice', false, 'Which university closed its geography programme in 1948?', 'በ1948 የጂኦግራፊ ፕሮግራሙን የዘጋው ዩኒቨርሲቲ የትኛው ነው?',
     array['Addis Ababa University', 'Oxford University', 'Harvard University', 'Cambridge University']::text[],
     array['አዲስ አበባ ዩኒቨርሲቲ', 'ኦክስፎርድ ዩኒቨርሲቲ', 'ሀርቫርድ ዩኒቨርሲቲ', 'ካምብሪጅ ዩኒቨርሲቲ']::text[],
     2, null, '[]'::jsonb, null,
     'The closing of the Harvard geography programme in 1948 is the textbook''s example of the crisis.', 'በ1948 የሀርቫርድ የጂኦግራፊ ፕሮግራም መዘጋት የመጽሐፉ የቀውሱ ምሳሌ ነው።'),
    (v_quiz_id, 12, 'choice', false, 'Von Thünen''s and Weber''s location models are examples of:', 'የቮን ቲውነንና የዌበር የአቀማመጥ ሞዴሎች የምን ምሳሌዎች ናቸው?',
     array['Deterministic models', 'Descriptive regional studies', 'Physiographic diagrams', 'Schools of determinism']::text[],
     array['ወሳኝ ሞዴሎች (Deterministic models)', 'ገላጭ ክልላዊ ጥናቶች', 'የመልክዓ ምድር ሥዕሎች', 'የወሳኝነት ትምህርት ቤቶች']::text[],
     0, null, '[]'::jsonb, null,
     'They are deterministic models used during the Quantitative Revolution (not the school of determinism).', 'በመጠናዊ አብዮት ዘመን ጥቅም ላይ የዋሉ ወሳኝ ሞዴሎች ናቸው (የወሳኝነት ትምህርት ቤት አይደሉም)።'),
    (v_quiz_id, 13, 'choice', false, 'The use of geography for socio-economic and political problem solving and planning is known as:', 'ጂኦግራፊን ለማኅበራዊ-ኢኮኖሚያዊና ፖለቲካዊ ችግሮች መፍቻና ለዕቅድ መጠቀም ምን ይባላል?',
     array['Historical geography', 'Applied geography', 'Environmental determinism', 'Cultural geography']::text[],
     array['ታሪካዊ ጂኦግራፊ', 'ተግባራዊ ጂኦግራፊ', 'የአካባቢ ወሳኝነት', 'የባህል ጂኦግራፊ']::text[],
     1, null, '[]'::jsonb, null,
     'Applied geography uses geographic analysis to solve problems and aid decision making.', 'ተግባራዊ ጂኦግራፊ ችግሮችን ለመፍታትና ውሳኔ ለማገዝ ጂኦግራፊያዊ ትንተናን ይጠቀማል።'),
    (v_quiz_id, 14, 'choice', false, 'Applied geography has its roots in:', 'የተግባራዊ ጂኦግራፊ መሠረቱ፦',
     array['Environmental determinism', 'The Quantitative Revolution', 'The work of Eratosthenes', 'The First World War']::text[],
     array['የአካባቢ ወሳኝነት', 'መጠናዊ አብዮት', 'የኤራቶስቴንስ ሥራ', 'አንደኛው የዓለም ጦርነት']::text[],
     1, null, '[]'::jsonb, null,
     'The tools of the Quantitative Revolution made geography useful for solving real problems.', 'የመጠናዊ አብዮት መሣሪያዎች ጂኦግራፊን እውነተኛ ችግሮችን ለመፍታት ጠቃሚ አደረጉት።'),
    (v_quiz_id, 15, 'choice', false, '"Geography is less practical in today''s world than it was before." This statement is:', '«ጂኦግራፊ በዛሬው ዓለም ከበፊቱ ያነሰ ተግባራዊ ነው።» ይህ አባባል፦',
     array['True, because of computers', 'False, applied geography made it more practical', 'True, departments are closed', 'False, because geography is only descriptive']::text[],
     array['እውነት ነው፣ በኮምፒውተሮች ምክንያት', 'ሐሰት ነው፣ ተግባራዊ ጂኦግራፊ የበለጠ ተግባራዊ አደረገው', 'እውነት ነው፣ ትምህርት ክፍሎች ተዘግተዋል', 'ሐሰት ነው፣ ምክንያቱም ጂኦግራፊ ገላጭ ብቻ ነው']::text[],
     1, null, '[]'::jsonb, null,
     'Today geographers work as planners, GIS analysts and more, so geography is more practical than before.', 'ዛሬ ጂኦግራፈሮች የፕላን ባለሙያዎች፣ የጂአይኤስ ተንታኞችና ሌሎችም ሆነው ይሠራሉ፤ ስለዚህ ጂኦግራፊ ከበፊቱ የበለጠ ተግባራዊ ነው።'),
    (v_quiz_id, 16, 'choice', false, 'Which job is an example of applied geography?', 'የተግባራዊ ጂኦግራፊ ምሳሌ የሆነው ሙያ የትኛው ነው?',
     array['Urban planner', 'Opera singer', 'Football player', 'Novelist']::text[],
     array['የከተማ ፕላን ባለሙያ', 'የኦፔራ ዘፋኝ', 'የእግር ኳስ ተጫዋች', 'ልብ ወለድ ደራሲ']::text[],
     0, null, '[]'::jsonb, null,
     'Urban planners use geographic analysis to decide where homes, roads and services go.', 'የከተማ ፕላን ባለሙያዎች ቤቶች፣ መንገዶችና አገልግሎቶች የት እንደሚሆኑ ለመወሰን ጂኦግራፊያዊ ትንተና ይጠቀማሉ።');
end
$migration$;
