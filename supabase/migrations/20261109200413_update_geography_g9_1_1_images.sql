-- UPDATE lesson 1.1.1 Definition and Concept of Geography
-- geography / grade 9 / Unit One
-- Generated from content/lessons/geography/grade-9/unit-1/1-1-1.json by scripts/lesson-to-sql.mjs. Do not edit by hand.

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

  -- Update an existing lesson in place: replace its fields, note sections and quiz.
  update public.lessons set
    slug = '1-1-1', sort_order = 1, section_code = '1.1',
    section_title_en = 'The Science of Geography', section_title_am = 'የጂኦግራፊ ሳይንስ',
    title_en = 'Definition and Concept of Geography', title_am = 'የጂኦግራፊ ትርጉም እና ጽንሰ ሐሳብ',
    summary_en = 'Where the word geography comes from, how geographers defined it over time, the modern definition, and why geography is a science.', summary_am = 'ጂኦግራፊ የሚለው ቃል ከየት እንደመጣ፣ ምሁራን በጊዜ ሂደት እንዴት እንደተረጎሙት፣ ዘመናዊው ትርጉም፣ እና ጂኦግራፊ ለምን ሳይንስ እንደሆነ።',
    minutes = 20, main_topics = '[{"title":{"en":"Meaning of the word","am":"የቃሉ ትርጉም"},"points":[{"en":"Geography = **Geo** (Earth) + **Graphy** (writing / describing). Both are Greek words.","am":"ጂኦግራፊ = **ጂኦ** (ምድር) + **ግራፊ** (መጻፍ / መግለጽ)። ሁለቱም የግሪክ ቃላት ናቸው።"},{"en":"Old definition: geography is the **description of the Earth**.","am":"የቀድሞው ትርጉም፦ ጂኦግራፊ **የምድር ገለጻ** ነው።"},{"en":"**Eratosthenes**, a Greek scholar, was the first to use the word.","am":"ቃሉን መጀመሪያ የተጠቀመው **ኤራቶስቴንስ** የተባለ የግሪክ ምሁር ነው።"}]},{"title":{"en":"How the definition changed","am":"ትርጉሙ እንዴት ተለወጠ"},"points":[{"en":"There is **no single definition**, but all of them say geography studies the **Earth''s surface**.","am":"**አንድ ብቻ ትርጉም የለም**፤ ነገር ግን ሁሉም ጂኦግራፊ **የምድርን ገጽ** እንደሚያጠና ይስማማሉ።"},{"en":"**Hartshorne** (1899–1992): an **accurate, orderly and rational description** of the Earth''s surface.","am":"**ሃርትሾርን** (1899–1992)፦ የምድርን ገጽ **ትክክለኛ፣ ሥርዓት ያለውና ምክንያታዊ በሆነ መንገድ መግለጽ**።"},{"en":"**Yeates** (1968): geography develops and tests **theories** about where things are.","am":"**ዬትስ** (1968)፦ ጂኦግራፊ ነገሮች የት እንዳሉ የሚያብራሩ **ንድፈ ሐሳቦችን** ያዳብራል፣ ይፈትናል።"},{"en":"**Mid-20th century**: geography became a **spatial science** (where things are and how they are spread).","am":"**በ20ኛው ክፍለ ዘመን አጋማሽ**፦ ጂኦግራፊ **ቦታዊ ሳይንስ** ሆነ (ነገሮች የት እንዳሉና እንዴት እንደተሰራጩ)።"}]},{"title":{"en":"The modern definition (learn this!)","am":"ዘመናዊው ትርጉም (ይህን በደንብ አጥኑ!)"},"points":[{"en":"Geography is a **spatial-temporal science**: it studies **where** (space) and **when** (time).","am":"ጂኦግራፊ **ቦታዊ-ጊዜያዊ ሳይንስ** ነው፤ **የት** (ቦታ) እና **መቼ** (ጊዜ) የሚለውን ያጠናል።"},{"en":"It studies the **distribution** and **interaction** of **human and physical** things, and their **causes and effects**.","am":"የ**ሰውና የተፈጥሮ** ነገሮችን **ስርጭትና መስተጋብር**፣ እንዲሁም **መንስኤና ውጤታቸውን** ያጠናል።"},{"en":"Example: cutting forests → more soil erosion → less food.","am":"ምሳሌ፦ ደን መቁረጥ → የአፈር መሸርሸር መጨመር → የምግብ ምርት መቀነስ።"},{"en":"Geography answers 5 questions: **What? Where? When? Which? How?**","am":"ጂኦግራፊ 5 ጥያቄዎችን ይመልሳል፦ **ምን? የት? መቼ? የትኛው? እንዴት?**"}]},{"title":{"en":"Why geography is a science","am":"ጂኦግራፊ ለምን ሳይንስ ሆነ"},"points":[{"en":"Science = a **systematic** way of getting knowledge through research.","am":"ሳይንስ = በምርምር እውቀትን **ሥርዓት ባለው** መንገድ የማግኛ ዘዴ።"},{"en":"5 methods in order: Observation → Identification → Description → Experimental investigation → Theoretical explanation (**O-I-D-E-T**).","am":"5ቱ ዘዴዎች በቅደም ተከተል፦ ምልከታ → መለየት → ገለጻ → የሙከራ ምርመራ → ንድፈ ሐሳባዊ ማብራሪያ (**O-I-D-E-T**)።"},{"en":"Theoretical explanation answers **why** something happens.","am":"ንድፈ ሐሳባዊ ማብራሪያ አንድ ነገር **ለምን** እንደሚከሰት ይመልሳል።"},{"en":"Geography **bridges** the natural and social sciences.","am":"ጂኦግራፊ የተፈጥሮና የማኅበራዊ ሳይንሶችን **ያገናኛል**።"}]}]'::jsonb
  where unit_id = v_unit_id and code = '1.1.1'
  returning id into v_lesson_id;
  if v_lesson_id is null then
    raise exception 'Lesson 1.1.1 does not exist yet; add it without --update';
  end if;
  delete from public.lesson_sections where lesson_id = v_lesson_id;
  delete from public.quizzes where lesson_id = v_lesson_id;

  insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, blocks) values
    (v_lesson_id, 1, 'Where the word “geography” comes from', '«ጂኦግራፊ» የሚለው ቃል አመጣጥ', 'languages',
     '[{"type":"paragraph","text":{"en":"The word **geography** comes from two **Greek** words.","am":"**ጂኦግራፊ (Geography)** የሚለው ቃል ከሁለት የ**ግሪክ** ቃላት የተገኘ ነው።"}},{"type":"table","headers":[{"en":"Greek word","am":"የግሪክ ቃል"},{"en":"Meaning","am":"ትርጉም"}],"rows":[[{"en":"**Geo**","am":"**ጂኦ (Geo)**"},{"en":"Earth","am":"ምድር"}],[{"en":"**Graphy** (graphein)","am":"**ግራፊ (Graphy / graphein)**"},{"en":"Writing / describing","am":"መጻፍ / መግለጽ"}]]},{"type":"image","src":"/images/lessons/eratosthenes.webp","width":278,"height":275,"alt":{"en":"Old engraved portrait of Eratosthenes, a bearded Greek scholar, shown in profile.","am":"የኤራቶስቴንስ የጥንት የተቀረጸ ምስል፤ ጢም ያለው የግሪክ ምሁር ከጎን ሲታይ።"},"caption":{"en":"Eratosthenes, the Greek scholar who first used the word “geography”","am":"«ጂኦግራፊ» የሚለውን ቃል መጀመሪያ የተጠቀመው የግሪክ ምሁር ኤራቶስቴንስ"},"credit":"Portrait of Eratosthenes · Public domain · Wikimedia Commons","creditUrl":"https://commons.wikimedia.org/wiki/File:Portrait_of_Eratosthenes.png"},{"type":"keypoint","variant":"definition","title":{"en":"The old definition","am":"የቀድሞው ትርጉም"},"text":{"en":"So geography literally means **describing or writing about the Earth**.","am":"ስለዚህ ጂኦግራፊ ቃል በቃል **ስለ ምድር መጻፍ ወይም ምድርን መግለጽ** ማለት ነው።"}},{"type":"paragraph","text":{"en":"The word was first used by **Eratosthenes** (276–196 BC), a Greek scholar. He defined geography as “the description of the Earth”.","am":"ቃሉን ለመጀመሪያ ጊዜ የተጠቀመው **ኤራቶስቴንስ (Eratosthenes)** (276–196 ዓ.ዓ.) የተባለ የግሪክ ምሁር ነው። እሱም ጂኦግራፊን «የምድር ገለጻ» ብሎ ገልጾታል።"}},{"type":"tip","title":{"en":"Memory tip","am":"የማስታወሻ ዘዴ"},"text":{"en":"**Geo** = Earth, as in **geo**logy (the study of the Earth''s rocks). **Graphy** = writing, as in bio**graphy** (writing about a person''s life).","am":"**ጂኦ (Geo)** = ምድር፤ ለምሳሌ **ጂኦሎጂ (Geology)** የምድር ዐለቶች ጥናት ነው። **ግራፊ (Graphy)** = መጻፍ፤ ለምሳሌ **ባዮግራፊ (Biography)** ስለ አንድ ሰው ሕይወት የተጻፈ ታሪክ ነው።"}}]'::jsonb),
    (v_lesson_id, 2, 'How geographers defined geography', 'የጂኦግራፊ ምሁራን ጂኦግራፊን እንዴት ተረጎሙት', 'quote',
     '[{"type":"paragraph","text":{"en":"Geography has **no single definition**. Different geographers have proposed (put forward) different definitions.","am":"ጂኦግራፊ **አንድ ብቻ የሆነ ትርጉም የለውም**። የተለያዩ የጂኦግራፊ ምሁራን የተለያዩ ትርጉሞችን አቅርበዋል።"}},{"type":"paragraph","text":{"en":"However, the definitions **share common ideas**: almost all of them say that geography studies the **Earth''s surface**.","am":"ይሁን እንጂ ትርጉሞቹ **የጋራ ሐሳቦች አሏቸው**፤ ሁሉም ማለት ይቻላል ጂኦግራፊ **የምድርን ገጽ** እንደሚያጠና ይገልጻሉ።"}},{"type":"table","headers":[{"en":"Who","am":"ማን"},{"en":"When","am":"መቼ"},{"en":"Definition","am":"ትርጉም"}],"rows":[[{"en":"**Eratosthenes**","am":"**ኤራቶስቴንስ (Eratosthenes)**"},{"en":"276–196 BC","am":"276–196 ዓ.ዓ."},{"en":"Geography is the description of the Earth.","am":"ጂኦግራፊ የምድር ገለጻ ነው።"}],[{"en":"**Concise Oxford Dictionary**","am":"**ኮንሳይዝ ኦክስፎርድ መዝገበ ቃላት (Concise Oxford Dictionary)**"},{"en":"1964","am":"1964"},{"en":"Geography is the science of the Earth''s surface.","am":"ጂኦግራፊ የምድር ገጽ ሳይንስ ነው።"}],[{"en":"**Richard Hartshorne**","am":"**ሪቻርድ ሃርትሾርን (Richard Hartshorne)**"},{"en":"1899–1992","am":"1899–1992"},{"en":"Geography is a branch of knowledge that gives an **accurate, orderly and rational description** of the variable character of the Earth''s surface.","am":"ጂኦግራፊ የምድርን ገጽ ተለዋዋጭ ባሕርይ **ትክክለኛ፣ ሥርዓት ያለው እና ምክንያታዊ በሆነ መንገድ የሚገልጽ** የእውቀት ዘርፍ ነው።"}],[{"en":"**M. Yeates**","am":"**ኤም. ዬትስ (M. Yeates)**"},{"en":"1968","am":"1968"},{"en":"Geography is a science that develops and tests **theories** that explain and predict the spatial distribution and location of things on the Earth''s surface.","am":"ጂኦግራፊ በምድር ገጽ ላይ ያሉ ነገሮችን ቦታዊ ስርጭትና አቀማመጥ የሚያብራሩና የሚተነብዩ **ንድፈ ሐሳቦችን** የሚያዳብርና የሚፈትን ሳይንስ ነው።"}]]},{"type":"terms","title":{"en":"Hartshorne''s key words","am":"የሃርትሾርን ቁልፍ ቃላት"},"items":[{"en":"accurate","am":"ትክክለኛ (accurate)"},{"en":"orderly","am":"ሥርዓት ያለው (orderly)"},{"en":"rational","am":"ምክንያታዊ (rational)"},{"en":"description","am":"ገለጻ (description)"}]},{"type":"keypoint","variant":"note","title":{"en":"Textbook note","am":"የመማሪያ መጽሐፍ ማስታወሻ"},"text":{"en":"The Grade 9 textbook says Hartshorne called geography a **branch of knowledge**. Many notes call it a **branch of social science**. Both describe the same idea, so recognise either wording in an exam.","am":"የ9ኛ ክፍል መማሪያ መጽሐፍ ሃርትሾርን ጂኦግራፊን **የእውቀት ዘርፍ** ብሎ እንደጠራው ይገልጻል። ብዙ ማስታወሻዎች ደግሞ **የማኅበራዊ ሳይንስ ዘርፍ** ይሉታል። ሁለቱም አንድን ሐሳብ ስለሚገልጹ በፈተና ላይ የትኛውም አገላለጽ ቢመጣ ማወቅ ያስፈልጋል።"}},{"type":"heading","text":{"en":"Mid-20th century: a spatial science","am":"በ20ኛው ክፍለ ዘመን አጋማሽ፦ ቦታዊ ሳይንስ"}},{"type":"paragraph","text":{"en":"In the **mid-20th century**, geography became a **spatial science**. It studies the **arrangement and distribution** of things and phenomena over the Earth''s surface.","am":"በ**20ኛው ክፍለ ዘመን አጋማሽ** ጂኦግራፊ **ቦታዊ ሳይንስ (Spatial Science)** ሆነ። በምድር ገጽ ላይ ያሉ ነገሮችንና ክስተቶችን **አቀማመጥና ስርጭት** ያጠናል።"}},{"type":"list","items":[{"en":"**Spatial** = about space or location: **where** things are.","am":"**ቦታዊ (Spatial)** = ስለ ቦታ ወይም አቀማመጥ፤ ነገሮች **የት** እንዳሉ።"},{"en":"Example: where people live, and how many people live there.","am":"ምሳሌ፦ ሰዎች የት እንደሚኖሩና በዚያ ምን ያህል ሰዎች እንደሚኖሩ።"},{"en":"Example: how people interact with the environment (soil, water, air).","am":"ምሳሌ፦ ሰዎች ከአካባቢያቸው (ከአፈር፣ ከውሃ፣ ከአየር) ጋር እንዴት እንደሚገናኙ።"}]}]'::jsonb),
    (v_lesson_id, 3, 'The modern definition (most important)', 'ዘመናዊው ትርጉም (በጣም አስፈላጊ)', 'sparkles',
     '[{"type":"paragraph","text":{"en":"Today, scholars commonly agree on this definition:","am":"ዛሬ ምሁራን በአብዛኛው በዚህ ትርጉም ይስማማሉ፦"}},{"type":"keypoint","variant":"important","title":{"en":"Modern definition of geography","am":"የጂኦግራፊ ዘመናዊ ትርጉም"},"text":{"en":"Geography is a **spatial-temporal science** that studies the **distribution** and **interaction (interdependence)** of **human and physical phenomena**, and their **causes and effects**, on the surface of the Earth.","am":"ጂኦግራፊ በምድር ገጽ ላይ ያሉ **የሰውና የተፈጥሮ ክስተቶችን** **ስርጭት (Distribution)** እና **መስተጋብር (Interaction)**፣ እንዲሁም **መንስኤና ውጤታቸውን (Causes and Effects)** የሚያጠና **ቦታዊ-ጊዜያዊ ሳይንስ (Spatial-temporal Science)** ነው።"}},{"type":"table","caption":{"en":"The key words, explained simply","am":"ቁልፍ ቃላቱ በቀላሉ ሲብራሩ"},"headers":[{"en":"Word","am":"ቃል"},{"en":"Meaning","am":"ትርጉም"}],"rows":[[{"en":"**Spatial**","am":"**ቦታዊ (Spatial)**"},{"en":"About space: **where** things are","am":"ስለ ቦታ፤ ነገሮች **የት** እንዳሉ"}],[{"en":"**Temporal**","am":"**ጊዜያዊ (Temporal)**"},{"en":"About time: **when** things happen or change","am":"ስለ ጊዜ፤ ነገሮች **መቼ** እንደሚከሰቱ ወይም እንደሚለወጡ"}],[{"en":"**Distribution**","am":"**ስርጭት (Distribution)**"},{"en":"How things are spread over the Earth","am":"ነገሮች በምድር ላይ እንዴት እንደተሰራጩ"}],[{"en":"**Interaction / interdependence**","am":"**መስተጋብር / መደጋገፍ (Interaction / Interdependence)**"},{"en":"How humans and nature affect and depend on each other","am":"ሰውና ተፈጥሮ እርስ በርስ እንዴት ተጽዕኖ እንደሚያሳድሩና እንደሚደጋገፉ"}],[{"en":"**Causes and effects**","am":"**መንስኤና ውጤት (Causes and Effects)**"},{"en":"Why something happens, and what results from it","am":"አንድ ነገር ለምን እንደሚከሰትና ምን ውጤት እንደሚያስከትል"}]]},{"type":"example","title":{"en":"Interaction: cause and effect","am":"መስተጋብር፦ መንስኤና ውጤት"},"text":{"en":"People cut down a forest (human) → soil erosion increases (physical) → farms produce less food (effect on humans).","am":"ሰዎች ደን ይቆርጣሉ (የሰው ተግባር) → የአፈር መሸርሸር ይጨምራል (የተፈጥሮ ለውጥ) → እርሻዎች የሚያመርቱት ምግብ ይቀንሳል (በሰው ላይ የሚደርስ ውጤት)።"}},{"type":"terms","title":{"en":"The 5 questions geography answers","am":"ጂኦግራፊ የሚመልሳቸው 5 ጥያቄዎች"},"items":[{"en":"What?","am":"ምን? (What?)"},{"en":"Where?","am":"የት? (Where?)"},{"en":"When?","am":"መቼ? (When?)"},{"en":"Which?","am":"የትኛው? (Which?)"},{"en":"How?","am":"እንዴት? (How?)"}]},{"type":"keypoint","variant":"note","title":{"en":"From the textbook","am":"ከመማሪያ መጽሐፉ"},"text":{"en":"The textbook also calls modern geography a **spatial-temporal-areal science**: it examines **place and space** in terms of location, distribution, arrangement, interaction, causes and effects.","am":"መማሪያ መጽሐፉ ዘመናዊ ጂኦግራፊን **ቦታዊ-ጊዜያዊ-አካባቢያዊ ሳይንስ (Spatial-temporal-areal Science)** ብሎም ይጠራዋል፤ **ቦታንና ስፍራን** በአቀማመጥ፣ በስርጭት፣ በአደረጃጀት፣ በመስተጋብር፣ በመንስኤና በውጤት ያጠናል።"}}]'::jsonb),
    (v_lesson_id, 4, 'Geography as a science', 'ጂኦግራፊ እንደ ሳይንስ', 'flask-conical',
     '[{"type":"keypoint","variant":"definition","title":{"en":"What is science?","am":"ሳይንስ ምንድን ነው?"},"text":{"en":"**Science** is a **systematic** way of acquiring (getting) knowledge through scientific research.","am":"**ሳይንስ (Science)** በሳይንሳዊ ምርምር አማካኝነት እውቀትን **ሥርዓት ባለው (Systematic)** መንገድ የማግኛ ዘዴ ነው።"}},{"type":"paragraph","text":{"en":"Geography is a science because it studies physical and social phenomena through research, using **scientific methods**.","am":"ጂኦግራፊ ሳይንስ ነው፤ ምክንያቱም የተፈጥሮና የማኅበራዊ ክስተቶችን **ሳይንሳዊ ዘዴዎችን (Scientific Methods)** በመጠቀም በምርምር ያጠናል።"}},{"type":"table","caption":{"en":"The 5 scientific methods, in order","am":"5ቱ ሳይንሳዊ ዘዴዎች በቅደም ተከተል"},"headers":[{"en":"#","am":"#"},{"en":"Method","am":"ዘዴ"},{"en":"Meaning","am":"ትርጉም"},{"en":"Example","am":"ምሳሌ"}],"rows":[[{"en":"1","am":"1"},{"en":"**Observation**","am":"**ምልከታ (Observation)**"},{"en":"Looking at and watching things carefully","am":"ነገሮችን በጥንቃቄ ማየትና መከታተል"},{"en":"Seeing that a river is getting smaller","am":"አንድ ወንዝ እያነሰ መሆኑን ማየት"}],[{"en":"2","am":"2"},{"en":"**Identification**","am":"**መለየት (Identification)**"},{"en":"Naming or recognising what it is","am":"ነገሩ ምን እንደሆነ መሰየም ወይም ማወቅ"},{"en":"“This is soil erosion.”","am":"«ይህ የአፈር መሸርሸር ነው።»"}],[{"en":"3","am":"3"},{"en":"**Description**","am":"**ገለጻ (Description)**"},{"en":"Explaining what it looks like","am":"ነገሩ ምን እንደሚመስል ማብራራት"},{"en":"Its size, location and how serious it is","am":"መጠኑን፣ ቦታውንና ምን ያህል የከፋ እንደሆነ"}],[{"en":"4","am":"4"},{"en":"**Experimental investigation**","am":"**የሙከራ ምርመራ (Experimental Investigation)**"},{"en":"Testing and collecting data","am":"መሞከርና መረጃ መሰብሰብ"},{"en":"Measuring the water level for months","am":"የውሃውን መጠን ለወራት መለካት"}],[{"en":"5","am":"5"},{"en":"**Theoretical explanation**","am":"**ንድፈ ሐሳባዊ ማብራሪያ (Theoretical Explanation)**"},{"en":"Explaining **why** it happens","am":"ነገሩ **ለምን** እንደሚከሰት ማብራራት"},{"en":"“Deforestation is causing it.”","am":"«የደን ጭፍጨፋ እያስከተለው ነው።»"}]]},{"type":"tip","title":{"en":"Memory trick","am":"የማስታወሻ ዘዴ"},"text":{"en":"**O-I-D-E-T** = “**O**ld **I**deas **D**on''t **E**xplain **T**hings”: Observation, Identification, Description, Experimental investigation, Theoretical explanation.","am":"**O-I-D-E-T** = «**O**ld **I**deas **D**on''t **E**xplain **T**hings»፤ እያንዳንዱ ፊደል የዘዴዎቹ የእንግሊዝኛ መነሻ ፊደል ነው፦ ምልከታ፣ መለየት፣ ገለጻ፣ የሙከራ ምርመራ፣ ንድፈ ሐሳባዊ ማብራሪያ።"}},{"type":"paragraph","text":{"en":"Geography''s main tools are **observation**, **systematic description**, **systematic recording** and **mapping**.","am":"የጂኦግራፊ ዋና መሣሪያዎች **ምልከታ**፣ **ሥርዓት ያለው ገለጻ**፣ **ሥርዓት ያለው መመዝገብ** እና **ካርታ መሥራት (Mapping)** ናቸው።"}},{"type":"keypoint","variant":"important","title":{"en":"A bridge between sciences","am":"በሳይንሶች መካከል ያለ ድልድይ"},"text":{"en":"Because it studies both nature and people, geography **bridges the natural sciences and the social sciences**.","am":"ጂኦግራፊ ተፈጥሮንም ሰውንም ስለሚያጠና **የተፈጥሮ ሳይንሶችንና የማኅበራዊ ሳይንሶችን የሚያገናኝ ድልድይ** ነው።"}}]'::jsonb);

  insert into public.quizzes (lesson_id, title_en, title_am, description_en, description_am)
  values (v_lesson_id, 'Quiz: Definition and Concept of Geography', 'ፈተና፦ የጂኦግራፊ ትርጉም እና ጽንሰ ሐሳብ', '14 questions on the meaning, definitions and scientific methods of geography.', 'ስለ ጂኦግራፊ ትርጉም፣ ትርጓሜዎችና ሳይንሳዊ ዘዴዎች 14 ጥያቄዎች።')
  returning id into v_quiz_id;

  insert into public.quiz_questions (quiz_id, sort_order, question_en, question_am, options_en, options_am, correct_index, explanation_en, explanation_am) values
    (v_quiz_id, 1, 'The term “geography” comes from which language?', '«ጂኦግራፊ» የሚለው ቃል ከየትኛው ቋንቋ የመጣ ነው?',
     array['Latin', 'Greek', 'Arabic', 'French']::text[],
     array['ላቲን', 'ግሪክ', 'ዐረብኛ', 'ፈረንሳይኛ']::text[],
     1, 'Geography comes from two Greek words: geo (Earth) and graphy/graphein (writing).', 'ጂኦግራፊ ከሁለት የግሪክ ቃላት የመጣ ነው፦ ጂኦ (ምድር) እና ግራፊ (መጻፍ)።'),
    (v_quiz_id, 2, 'What does “geo” mean?', '«ጂኦ (Geo)» ምን ማለት ነው?',
     array['Water', 'Sky', 'Earth', 'People']::text[],
     array['ውሃ', 'ሰማይ', 'ምድር', 'ሰዎች']::text[],
     2, 'Geo means Earth, as in geology, the study of the Earth''s rocks.', 'ጂኦ ማለት ምድር ነው፤ ለምሳሌ ጂኦሎጂ የምድር ዐለቶች ጥናት ነው።'),
    (v_quiz_id, 3, 'Who first used the term “geography”?', '«ጂኦግራፊ» የሚለውን ቃል መጀመሪያ የተጠቀመው ማን ነው?',
     array['Richard Hartshorne', 'Aristotle', 'Eratosthenes', 'Ptolemy']::text[],
     array['ሪቻርድ ሃርትሾርን', 'አርስጣጣሊስ', 'ኤራቶስቴንስ', 'ቶለሚ']::text[],
     2, 'Eratosthenes (276–196 BC), a Greek scholar, first used the word and defined geography as the description of the Earth.', 'የግሪክ ምሁር የነበረው ኤራቶስቴንስ (276–196 ዓ.ዓ.) ቃሉን መጀመሪያ የተጠቀመ ሲሆን ጂኦግራፊን «የምድር ገለጻ» ብሎ ገልጾታል።'),
    (v_quiz_id, 4, 'Hartshorne described geography as a branch of knowledge that gives an accurate, orderly and ______ description of the Earth''s surface.', 'ሃርትሾርን ጂኦግራፊን የምድርን ገጽ ትክክለኛ፣ ሥርዓት ያለውና ______ በሆነ መንገድ የሚገልጽ የእውቀት ዘርፍ ብሎታል።',
     array['rational', 'historical', 'colourful', 'temporary']::text[],
     array['ምክንያታዊ (rational)', 'ታሪካዊ (historical)', 'ያሸበረቀ (colourful)', 'ጊዜያዊ (temporary)']::text[],
     0, 'Hartshorne''s key words are accurate, orderly and rational description.', 'የሃርትሾርን ቁልፍ ቃላት ትክክለኛ፣ ሥርዓት ያለውና ምክንያታዊ ገለጻ ናቸው።'),
    (v_quiz_id, 5, 'Which of these is true about the definition of geography?', 'ስለ ጂኦግራፊ ትርጉም ከሚከተሉት ውስጥ ትክክል የሆነው የትኛው ነው?',
     array['It has one definition that everyone has always agreed on', 'It has many definitions that share common ideas', 'Its definitions have nothing in common', 'It has never been defined']::text[],
     array['ሁሉም ሰው ሁልጊዜ የተስማማበት አንድ ትርጉም አለው', 'የጋራ ሐሳቦችን የሚጋሩ ብዙ ትርጉሞች አሉት', 'ትርጉሞቹ ምንም የሚያመሳስላቸው ነገር የለም', 'ፈጽሞ ተተርጉሞ አያውቅም']::text[],
     1, 'There is no single definition, but the definitions share common ideas, mainly that geography studies the Earth''s surface.', 'አንድ ብቻ ትርጉም የለም፤ ነገር ግን ትርጉሞቹ የጋራ ሐሳቦች አሏቸው፤ በተለይም ጂኦግራፊ የምድርን ገጽ እንደሚያጠና።'),
    (v_quiz_id, 6, 'In the mid-20th century, geography became a:', 'በ20ኛው ክፍለ ዘመን አጋማሽ ጂኦግራፊ ምን ሆነ?',
     array['Historical science', 'Spatial science', 'Political science', 'Medical science']::text[],
     array['ታሪካዊ ሳይንስ', 'ቦታዊ ሳይንስ (Spatial Science)', 'የፖለቲካ ሳይንስ', 'የሕክምና ሳይንስ']::text[],
     1, 'In the mid-20th century geography became a spatial science, studying the arrangement and distribution of things on the Earth''s surface.', 'በ20ኛው ክፍለ ዘመን አጋማሽ ጂኦግራፊ በምድር ገጽ ላይ ያሉ ነገሮችን አቀማመጥና ስርጭት የሚያጠና ቦታዊ ሳይንስ ሆነ።'),
    (v_quiz_id, 7, 'According to the modern definition, geography is a:', 'በዘመናዊው ትርጉም መሠረት ጂኦግራፊ ምንድን ነው?',
     array['Spatial-temporal science', 'Historical-political science', 'Natural-medical science', 'Social-economic science only']::text[],
     array['ቦታዊ-ጊዜያዊ ሳይንስ (Spatial-temporal Science)', 'ታሪካዊ-ፖለቲካዊ ሳይንስ', 'የተፈጥሮ-ሕክምና ሳይንስ', 'ማኅበራዊ-ኢኮኖሚያዊ ሳይንስ ብቻ']::text[],
     0, 'Modern geography is a spatial-temporal science: it studies where (space) and when (time).', 'ዘመናዊ ጂኦግራፊ ቦታዊ-ጊዜያዊ ሳይንስ ነው፤ የት (ቦታ) እና መቼ (ጊዜ) የሚለውን ያጠናል።'),
    (v_quiz_id, 8, 'What does “temporal” mean?', '«ጊዜያዊ (Temporal)» ምን ማለት ነው?',
     array['Space or location', 'Time', 'Temperature', 'People']::text[],
     array['ቦታ ወይም አቀማመጥ', 'ጊዜ', 'የሙቀት መጠን', 'ሰዎች']::text[],
     1, 'Temporal is about time: when things happen or change. Spatial is about space.', 'ጊዜያዊ ስለ ጊዜ ነው፤ ነገሮች መቼ እንደሚከሰቱ ወይም እንደሚለወጡ። ቦታዊ ደግሞ ስለ ቦታ ነው።'),
    (v_quiz_id, 9, 'Which set lists the 5 questions geography answers?', 'ጂኦግራፊ የሚመልሳቸውን 5 ጥያቄዎች የሚዘረዝረው የትኛው ነው?',
     array['Who, what, why, whose, how', 'What, where, when, which, how', 'Where, who, whom, when, why', 'How, how much, how many, what, who']::text[],
     array['ማን፣ ምን፣ ለምን፣ የማን፣ እንዴት', 'ምን፣ የት፣ መቼ፣ የትኛው፣ እንዴት', 'የት፣ ማን፣ ለማን፣ መቼ፣ ለምን', 'እንዴት፣ ምን ያህል፣ ስንት፣ ምን፣ ማን']::text[],
     1, 'Geography answers: What? Where? When? Which? How?', 'ጂኦግራፊ የሚመልሳቸው፦ ምን? የት? መቼ? የትኛው? እንዴት?'),
    (v_quiz_id, 10, 'Science is a ______ way of acquiring knowledge.', 'ሳይንስ እውቀትን ______ በሆነ መንገድ የማግኛ ዘዴ ነው።',
     array['random', 'systematic', 'traditional', 'religious']::text[],
     array['በዘፈቀደ (random)', 'ሥርዓት ያለው (systematic)', 'ባህላዊ (traditional)', 'ሃይማኖታዊ (religious)']::text[],
     1, 'Science is a systematic way of acquiring knowledge through scientific research.', 'ሳይንስ በሳይንሳዊ ምርምር እውቀትን ሥርዓት ባለው መንገድ የማግኛ ዘዴ ነው።'),
    (v_quiz_id, 11, 'Which is NOT one of the 5 scientific methods?', 'ከ5ቱ ሳይንሳዊ ዘዴዎች ውስጥ ያልሆነው የትኛው ነው?',
     array['Observation', 'Description', 'Imagination', 'Identification']::text[],
     array['ምልከታ (Observation)', 'ገለጻ (Description)', 'ምናብ (Imagination)', 'መለየት (Identification)']::text[],
     2, 'The 5 methods are observation, identification, description, experimental investigation and theoretical explanation (O-I-D-E-T). Imagination is not one of them.', '5ቱ ዘዴዎች ምልከታ፣ መለየት፣ ገለጻ፣ የሙከራ ምርመራና ንድፈ ሐሳባዊ ማብራሪያ ናቸው (O-I-D-E-T)። ምናብ ከነሱ ውስጥ አይደለም።'),
    (v_quiz_id, 12, 'Measuring a river''s water level for many months is an example of:', 'የአንድን ወንዝ የውሃ መጠን ለብዙ ወራት መለካት የየትኛው ዘዴ ምሳሌ ነው?',
     array['Identification', 'Description', 'Experimental investigation', 'Observation']::text[],
     array['መለየት (Identification)', 'ገለጻ (Description)', 'የሙከራ ምርመራ (Experimental Investigation)', 'ምልከታ (Observation)']::text[],
     2, 'Testing and collecting data over time is experimental investigation.', 'በጊዜ ሂደት መሞከርና መረጃ መሰብሰብ የሙከራ ምርመራ ነው።'),
    (v_quiz_id, 13, 'Which method explains WHY something happens?', 'አንድ ነገር ለምን እንደሚከሰት የሚያብራራው የትኛው ዘዴ ነው?',
     array['Identification', 'Theoretical explanation', 'Observation', 'Description']::text[],
     array['መለየት (Identification)', 'ንድፈ ሐሳባዊ ማብራሪያ (Theoretical Explanation)', 'ምልከታ (Observation)', 'ገለጻ (Description)']::text[],
     1, 'Theoretical explanation is the last step: it explains why something happens, e.g. “deforestation is causing it”.', 'ንድፈ ሐሳባዊ ማብራሪያ የመጨረሻው ደረጃ ነው፤ አንድ ነገር ለምን እንደሚከሰት ያብራራል፤ ለምሳሌ «የደን ጭፍጨፋ እያስከተለው ነው»።'),
    (v_quiz_id, 14, 'Geography is said to bridge which two groups of sciences?', 'ጂኦግራፊ የትኞቹን ሁለት የሳይንስ ቡድኖች ያገናኛል ይባላል?',
     array['Medical and military sciences', 'Natural and social sciences', 'Computer and space sciences', 'Language and art']::text[],
     array['የሕክምናና የወታደራዊ ሳይንሶች', 'የተፈጥሮና የማኅበራዊ ሳይንሶች', 'የኮምፒውተርና የሕዋ ሳይንሶች', 'ቋንቋና ሥነ ጥበብ']::text[],
     1, 'Geography studies both nature and people, so it bridges the natural and social sciences.', 'ጂኦግራፊ ተፈጥሮንም ሰውንም ስለሚያጠና የተፈጥሮና የማኅበራዊ ሳይንሶችን ያገናኛል።');
end
$migration$;

-- UPDATE lesson 1.1.2 Branches of Geography
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

  -- Update an existing lesson in place: replace its fields, note sections and quiz.
  update public.lessons set
    slug = '1-1-2', sort_order = 2, section_code = '1.1',
    section_title_en = 'The Science of Geography', section_title_am = 'የጂኦግራፊ ሳይንስ',
    title_en = 'Branches of Geography', title_am = 'የጂኦግራፊ ቅርንጫፎች',
    summary_en = 'The two main branches of geography, physical and human, and the specialised fields inside each one.', summary_am = 'ሁለቱ ዋና የጂኦግራፊ ቅርንጫፎች፣ የተፈጥሮና የሰው ጂኦግራፊ፣ እና በእያንዳንዳቸው ውስጥ ያሉ ልዩ ዘርፎች።',
    minutes = 15, main_topics = '[{"title":{"en":"Two main branches","am":"ሁለቱ ዋና ቅርንጫፎች"},"points":[{"en":"Geography has **2 main branches**: **Physical** geography and **Human** geography.","am":"ጂኦግራፊ **2 ዋና ቅርንጫፎች** አሉት፦ **የተፈጥሮ** ጂኦግራፊ እና **የሰው** ጂኦግራፊ።"},{"en":"Physical = **natural** features (climate, landforms, soil, vegetation, drainage).","am":"የተፈጥሮ = **ተፈጥሯዊ** ገጽታዎች (የአየር ንብረት፣ የመሬት ቅርጾች፣ አፈር፣ ዕፅዋት፣ የውሃ ፍሳሽ)።"},{"en":"Human = **human-made** aspects (population, cities, economy, culture, politics).","am":"የሰው = **በሰው የተሠሩ** ገጽታዎች (ሕዝብ፣ ከተሞች፣ ኢኮኖሚ፣ ባህል፣ ፖለቲካ)።"},{"en":"Trick: **nature** made it → physical; **people** made it → human.","am":"ዘዴ፦ **ተፈጥሮ** የሠራው → የተፈጥሮ፤ **ሰው** የሠራው → የሰው ጂኦግራፊ።"}]},{"title":{"en":"Physical geography fields","am":"የተፈጥሮ ጂኦግራፊ ዘርፎች"},"points":[{"en":"**Climatology** → climate","am":"**የአየር ንብረት ጥናት (Climatology)** → የአየር ንብረት"},{"en":"**Geomorphology** → landforms and the forces that shape them","am":"**የመሬት ቅርጽ ጥናት (Geomorphology)** → የመሬት ቅርጾችና የሚቀርጿቸው ኃይሎች"},{"en":"**Soil geography** → soils","am":"**የአፈር ጂኦግራፊ** → አፈር"},{"en":"**Biogeography** → plants and animals","am":"**የሕይወት ጂኦግራፊ (Biogeography)** → ዕፅዋትና እንስሳት"},{"en":"**Oceanography** → ocean currents, waves and tides; **Hydrology** → water on land","am":"**የውቅያኖስ ጥናት (Oceanography)** → ጅረቶች፣ ማዕበሎችና የባሕር ውሃ ከፍታና ዝቅታ፤ **የውሃ ጥናት (Hydrology)** → በየብስ ላይ ያለ ውሃ"}]},{"title":{"en":"Human geography fields","am":"የሰው ጂኦግራፊ ዘርፎች"},"points":[{"en":"**Population** → distribution, growth and structure of people","am":"**የሕዝብ ጂኦግራፊ** → የሕዝብ ስርጭት፣ ዕድገትና አወቃቀር"},{"en":"**Urban** → towns and cities","am":"**የከተማ ጂኦግራፊ** → ከተሞች"},{"en":"**Economic** → production, consumption and exchange","am":"**የኢኮኖሚ ጂኦግራፊ** → ምርት፣ ፍጆታና ልውውጥ"},{"en":"**Cultural** → beliefs and customs; **Political** → power and decisions; **Historical** → places in the past","am":"**የባህል ጂኦግራፊ** → እምነትና ልማድ፤ **የፖለቲካ ጂኦግራፊ** → ሥልጣንና ውሳኔ፤ **የታሪክ ጂኦግራፊ** → ቦታዎች በቀድሞ ዘመን"}]},{"title":{"en":"Watch out in exams","am":"በፈተና ላይ ተጠንቀቁ"},"points":[{"en":"Biogeography is **physical**, not human.","am":"የሕይወት ጂኦግራፊ (Biogeography) **የተፈጥሮ** ጂኦግራፊ ነው እንጂ የሰው አይደለም።"},{"en":"Population distribution = **population** geography, not cultural geography.","am":"የሕዝብ ስርጭት = **የሕዝብ** ጂኦግራፊ እንጂ የባህል ጂኦግራፊ አይደለም።"}]}]'::jsonb
  where unit_id = v_unit_id and code = '1.1.2'
  returning id into v_lesson_id;
  if v_lesson_id is null then
    raise exception 'Lesson 1.1.2 does not exist yet; add it without --update';
  end if;
  delete from public.lesson_sections where lesson_id = v_lesson_id;
  delete from public.quizzes where lesson_id = v_lesson_id;

  insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, blocks) values
    (v_lesson_id, 1, 'The two main branches', 'ሁለቱ ዋና ቅርንጫፎች', 'git-branch',
     '[{"type":"paragraph","text":{"en":"Geography is divided into branches **depending on what it studies**.","am":"ጂኦግራፊ **በሚያጠናው ነገር ላይ ተመሥርቶ** በቅርንጫፎች ይከፈላል።"}},{"type":"keypoint","variant":"important","title":{"en":"2 main branches","am":"2 ዋና ቅርንጫፎች"},"text":{"en":"Geography has **two main branches**: **Physical geography** and **Human geography**.","am":"ጂኦግራፊ **ሁለት ዋና ቅርንጫፎች** አሉት፦ **የተፈጥሮ ጂኦግራፊ (Physical Geography)** እና **የሰው ጂኦግራፊ (Human Geography)**።"}},{"type":"image","src":"/images/lessons/simien-mountains.webp","width":900,"height":675,"alt":{"en":"Steep green mountains and deep valleys of the Simien Mountains National Park in Ethiopia.","am":"በኢትዮጵያ የሰሜን ተራሮች ብሔራዊ ፓርክ ገደላማ አረንጓዴ ተራሮችና ጥልቅ ሸለቆዎች።"},"caption":{"en":"Physical geography: landforms made by nature (Simien Mountains, Ethiopia)","am":"የተፈጥሮ ጂኦግራፊ፦ በተፈጥሮ የተሠሩ የመሬት ቅርጾች (የሰሜን ተራሮች፣ ኢትዮጵያ)"},"credit":"Photo: Barrowbob · CC BY-SA 4.0 · Wikimedia Commons","creditUrl":"https://commons.wikimedia.org/wiki/File:Simien_Mountains_National_Park_in_Ethiopia.jpg"},{"type":"image","src":"/images/lessons/addis-ababa.webp","width":900,"height":675,"alt":{"en":"The skyline of Addis Ababa with tall buildings, cranes and trees.","am":"ረጃጅም ሕንፃዎች፣ ክሬኖችና ዛፎች ያሉበት የአዲስ አበባ ከተማ ገጽታ።"},"caption":{"en":"Human geography: a city built by people (Addis Ababa, Ethiopia)","am":"የሰው ጂኦግራፊ፦ በሰዎች የተገነባ ከተማ (አዲስ አበባ፣ ኢትዮጵያ)"},"credit":"Photo: Simfan34 · CC BY-SA 3.0 · Wikimedia Commons","creditUrl":"https://commons.wikimedia.org/wiki/File:Addis_Ababa_skyline.jpg"},{"type":"table","headers":[{"en":"Compare","am":"ንጽጽር"},{"en":"Physical geography","am":"የተፈጥሮ ጂኦግራፊ"},{"en":"Human geography","am":"የሰው ጂኦግራፊ"}],"rows":[[{"en":"**Studies**","am":"**ያጠናል**"},{"en":"The **natural** features of the Earth''s surface, with their causes, effects and interactions","am":"የምድርን ገጽ **የተፈጥሮ** ገጽታዎች ከመንስኤዎቻቸው፣ ከውጤቶቻቸውና ከመስተጋብራቸው ጋር"},{"en":"**Human-made** aspects of the world and their interaction with the natural environment","am":"**በሰው የተሠሩ** የዓለም ገጽታዎችንና ከተፈጥሮ አካባቢ ጋር ያላቸውን መስተጋብር"}],[{"en":"**Examples**","am":"**ምሳሌዎች**"},{"en":"Climate, landforms (mountains, plateaus, valleys, plains), soil, vegetation, drainage (rivers, lakes)","am":"የአየር ንብረት፣ የመሬት ቅርጾች (ተራሮች፣ አምባዎች፣ ሸለቆዎች፣ ሜዳዎች)፣ አፈር፣ ዕፅዋት፣ የውሃ ፍሳሽ (ወንዞች፣ ሐይቆች)"},{"en":"Population, settlements (cities and towns), economic activities, culture, political systems","am":"ሕዝብ፣ ሰፈራዎች (ከተሞች)፣ የኢኮኖሚ እንቅስቃሴዎች፣ ባህል፣ የፖለቲካ ሥርዓቶች"}]]},{"type":"tip","title":{"en":"Easy trick","am":"ቀላል ዘዴ"},"text":{"en":"If **nature** made it → **Physical** geography. If **people** made it → **Human** geography.","am":"**ተፈጥሮ** የሠራው ከሆነ → **የተፈጥሮ ጂኦግራፊ**። **ሰው** የሠራው ከሆነ → **የሰው ጂኦግራፊ**።"}}]'::jsonb),
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

-- UPDATE lesson 1.1.3 Scope of Geography
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

  -- Update an existing lesson in place: replace its fields, note sections and quiz.
  update public.lessons set
    slug = '1-1-3', sort_order = 3, section_code = '1.1',
    section_title_en = 'The Science of Geography', section_title_am = 'የጂኦግራፊ ሳይንስ',
    title_en = 'Scope of Geography', title_am = 'የጂኦግራፊ ወሰን',
    summary_en = 'What scope means, why geography''s scope is so wide, the five spheres it studies, and how its scope changed through history.', summary_am = 'ወሰን ምን ማለት እንደሆነ፣ የጂኦግራፊ ወሰን ለምን ሰፊ እንደሆነ፣ የሚያጠናቸው አምስቱ ሉሎች፣ እና ወሰኑ በታሪክ ውስጥ እንዴት እንደተለወጠ።',
    minutes = 15, main_topics = '[{"title":{"en":"What scope means","am":"ወሰን ምን ማለት ነው"},"points":[{"en":"Scope = the **focus, degree, range and content** of a subject: **how much** it covers.","am":"ወሰን = የአንድ ትምህርት **ትኩረት፣ ደረጃ፣ ስፋትና ይዘት**፤ ምን ያህል እንደሚሸፍን።"},{"en":"Geography''s scope is **very wide**: physical and human features, with their causes, effects and interactions.","am":"የጂኦግራፊ ወሰን **በጣም ሰፊ** ነው፦ የተፈጥሮና የሰው ገጽታዎችን ከመንስኤ፣ ከውጤትና ከመስተጋብራቸው ጋር ያጠናል።"},{"en":"Its scope is **dynamic**: it changes as new discoveries and ideas appear.","am":"ወሰኑ **ተለዋዋጭ** ነው፤ አዳዲስ ግኝቶችና ሐሳቦች ሲመጡ ይለወጣል።"}]},{"title":{"en":"The 5 spheres","am":"5ቱ ሉሎች"},"points":[{"en":"**Lithosphere** = rock (the solid layer)","am":"**ሊቶስፌር** = ዐለት (ጠንካራው ንብርብር)"},{"en":"**Hydrosphere** = water (oceans, rivers, lakes)","am":"**ሃይድሮስፌር** = ውሃ (ውቅያኖሶች፣ ወንዞች፣ ሐይቆች)"},{"en":"**Atmosphere** = air (gases around the Earth)","am":"**ከባቢ አየር** = አየር (ምድርን የከበቡ ጋዞች)"},{"en":"**Biosphere** = life (plants and animals)","am":"**ባዮስፌር** = ሕይወት (ዕፅዋትና እንስሳት)"},{"en":"**Anthroposphere** = the cultural landscape made by humans (cities, roads, farms)","am":"**አንትሮፖስፌር** = በሰው የተሠራ ባህላዊ ገጽታ (ከተሞች፣ መንገዶች፣ እርሻዎች)"}]},{"title":{"en":"How the scope changed","am":"ወሰኑ እንዴት ተለወጠ"},"points":[{"en":"Ancient times: the **mother of many sciences**.","am":"በጥንት ዘመን፦ **የብዙ ሳይንሶች እናት**።"},{"en":"16th century: focus on **location** (where, why, what).","am":"16ኛው ክፍለ ዘመን፦ ትኩረት በ**አቀማመጥ** ላይ (የት፣ ለምን፣ ምን)።"},{"en":"Mid-18th century: **people and environment**; Germans **Humboldt** and **Ritter**.","am":"18ኛው ክፍለ ዘመን አጋማሽ፦ **ሰውና አካባቢ**፤ ጀርመናውያኑ **ሁምቦልት** እና **ሪተር**።"},{"en":"19th century: geographical **societies** formed. 20th century: a **spatial science**.","am":"19ኛው ክፍለ ዘመን፦ የጂኦግራፊ **ማኅበራት** ተቋቋሙ። 20ኛው ክፍለ ዘመን፦ **ቦታዊ ሳይንስ** ሆነ።"}]}]'::jsonb
  where unit_id = v_unit_id and code = '1.1.3'
  returning id into v_lesson_id;
  if v_lesson_id is null then
    raise exception 'Lesson 1.1.3 does not exist yet; add it without --update';
  end if;
  delete from public.lesson_sections where lesson_id = v_lesson_id;
  delete from public.quizzes where lesson_id = v_lesson_id;

  insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, blocks) values
    (v_lesson_id, 1, 'What is scope?', 'ወሰን ምንድን ነው?', 'target',
     '[{"type":"keypoint","variant":"definition","title":{"en":"Scope","am":"ወሰን (Scope)"},"text":{"en":"**Scope** means the **focus, degree, range and content** of a subject. Simply put, scope is **how much** a subject covers.","am":"**ወሰን (Scope)** ማለት የአንድ ትምህርት **ትኩረት፣ ደረጃ፣ ስፋትና ይዘት** ማለት ነው። በቀላሉ ወሰን አንድ ትምህርት **ምን ያህል** እንደሚሸፍን ያሳያል።"}},{"type":"paragraph","text":{"en":"The textbook puts it as the **range and variety of contents** included in a subject or field of study.","am":"መማሪያ መጽሐፉ ደግሞ «በአንድ ትምህርት ወይም የጥናት ዘርፍ ውስጥ የተካተቱ **ይዘቶች ስፋትና ዓይነት**» ይለዋል።"}},{"type":"keypoint","variant":"important","title":{"en":"Geography''s scope is very wide","am":"የጂኦግራፊ ወሰን በጣም ሰፊ ነው"},"text":{"en":"Geography studies a great many **physical and human features** of the world, together with their **causes, effects and interactions**.","am":"ጂኦግራፊ እጅግ ብዙ የዓለምን **የተፈጥሮና የሰው ገጽታዎች** ከ**መንስኤዎቻቸው፣ ከውጤቶቻቸውና ከመስተጋብራቸው** ጋር ያጠናል።"}},{"type":"paragraph","text":{"en":"It mainly focuses on its **two major branches**: physical (natural) features and human-made features.","am":"በዋናነት በ**ሁለቱ ዋና ቅርንጫፎቹ** ላይ ያተኩራል፦ በተፈጥሮ ገጽታዎችና በሰው በተሠሩ ገጽታዎች።"}},{"type":"paragraph","text":{"en":"Geography''s scope is also **dynamic**: it changes as new discoveries and ideas enter the field.","am":"የጂኦግራፊ ወሰን **ተለዋዋጭ (Dynamic)** ነው፤ አዳዲስ ግኝቶችና ሐሳቦች ወደ ዘርፉ ሲገቡ ይለወጣል።"}}]'::jsonb),
    (v_lesson_id, 2, 'The 5 spheres of geography', 'የጂኦግራፊ 5 ሉሎች', 'layers',
     '[{"type":"paragraph","text":{"en":"The features geography studies are found in the Earth''s **spheres** (parts or layers):","am":"ጂኦግራፊ የሚያጠናቸው ገጽታዎች በምድር **ሉሎች (Spheres)**፣ ማለትም ክፍሎች ወይም ንብርብሮች ውስጥ ይገኛሉ፦"}},{"type":"image","src":"/images/lessons/earth-spheres.webp","width":900,"height":506,"alt":{"en":"Cut-away diagram of the Earth showing the layers of the atmosphere around it, the hydrosphere on the surface, and the lithosphere (crust) above the mantle and core.","am":"የምድርን ውስጥ የሚያሳይ ሥዕላዊ መግለጫ፤ በዙሪያዋ ያሉ የከባቢ አየር ንብርብሮች፣ በላይኛው ገጽ ላይ ያለው ሃይድሮስፌር፣ እና ከመጎናጸፊያውና ከማዕከሉ በላይ ያለው ሊቶስፌር (ቅርፊት)።"},"caption":{"en":"The Earth''s spheres: atmosphere (air), hydrosphere (water) and lithosphere (rock)","am":"የምድር ሉሎች፦ ከባቢ አየር (አየር)፣ ሃይድሮስፌር (ውሃ) እና ሊቶስፌር (ዐለት)"},"credit":"Diagram: Wikimeatier · CC BY-SA 4.0 · Wikimedia Commons","creditUrl":"https://commons.wikimedia.org/wiki/File:Earth%27s_spheres.svg"},{"type":"table","headers":[{"en":"Sphere","am":"ሉል"},{"en":"What it covers","am":"የሚያካትተው"},{"en":"Word root","am":"የቃሉ መነሻ"}],"rows":[[{"en":"**Lithosphere**","am":"**ሊቶስፌር (Lithosphere)**"},{"en":"The solid layer of rock that covers the whole planet","am":"መላውን ፕላኔት የሚሸፍነው ጠንካራው የዐለት ንብርብር"},{"en":"Litho = rock","am":"ሊቶ (Litho) = ዐለት"}],[{"en":"**Hydrosphere**","am":"**ሃይድሮስፌር (Hydrosphere)**"},{"en":"All bodies of water: oceans, rivers, lakes and others","am":"ሁሉም የውሃ አካላት፦ ውቅያኖሶች፣ ወንዞች፣ ሐይቆችና ሌሎችም"},{"en":"Hydro = water","am":"ሃይድሮ (Hydro) = ውሃ"}],[{"en":"**Atmosphere**","am":"**ከባቢ አየር (Atmosphere)**"},{"en":"The air (gases) surrounding our planet","am":"ፕላኔታችንን የከበበው አየር (ጋዞች)"},{"en":"Atmo = vapour / air","am":"አትሞ (Atmo) = ተን / አየር"}],[{"en":"**Biosphere**","am":"**ባዮስፌር (Biosphere)**"},{"en":"All living things in and on the Earth''s surface: plants and animals","am":"በምድር ገጽ ላይና ውስጥ ያሉ ሕያዋን ፍጥረታት በሙሉ፦ ዕፅዋትና እንስሳት"},{"en":"Bio = life","am":"ባዮ (Bio) = ሕይወት"}],[{"en":"**Anthroposphere**","am":"**አንትሮፖስፌር (Anthroposphere)**"},{"en":"The cultural landscape: what humans have made (cities, roads, farms)","am":"ባህላዊ ገጽታ፦ ሰዎች የሠሯቸው ነገሮች (ከተሞች፣ መንገዶች፣ እርሻዎች)"},{"en":"Anthropo = human","am":"አንትሮፖ (Anthropo) = ሰው"}]]},{"type":"keypoint","variant":"note","title":{"en":"Textbook note","am":"የመማሪያ መጽሐፍ ማስታወሻ"},"text":{"en":"The Grade 9 textbook names the **four natural spheres**: hydrosphere, atmosphere, lithosphere and biosphere. The **anthroposphere** is the human-made part, studied mainly by human geography.","am":"የ9ኛ ክፍል መማሪያ መጽሐፍ **አራቱን የተፈጥሮ ሉሎች** ይጠቅሳል፦ ሃይድሮስፌር፣ ከባቢ አየር፣ ሊቶስፌርና ባዮስፌር። **አንትሮፖስፌር** ደግሞ በሰው የተሠራው ክፍል ሲሆን በዋናነት በሰው ጂኦግራፊ ይጠናል።"}},{"type":"example","title":{"en":"Find all 5 spheres on one farm","am":"5ቱን ሉሎች በአንድ እርሻ ላይ ፈልጉ"},"text":{"en":"Picture a farm in the Ethiopian highlands: the **soil and rocks** (lithosphere), the **river** (hydrosphere), the **air and rain clouds** (atmosphere), the **crops and cattle** (biosphere), and the **farmer''s house and the road** (anthroposphere).","am":"በኢትዮጵያ ደጋማ አካባቢ ያለን አንድ እርሻ አስቡ፦ **አፈሩና ዐለቱ** (ሊቶስፌር)፣ **ወንዙ** (ሃይድሮስፌር)፣ **አየሩና የዝናብ ደመናው** (ከባቢ አየር)፣ **ሰብሉና ከብቶቹ** (ባዮስፌር)፣ እንዲሁም **የገበሬው ቤትና መንገዱ** (አንትሮፖስፌር)።"}},{"type":"tip","title":{"en":"Memory tip","am":"የማስታወሻ ዘዴ"},"text":{"en":"Learn the word roots and you know the spheres: **Litho** = rock, **Hydro** = water, **Atmo** = air, **Bio** = life, **Anthropo** = human.","am":"የቃላቱን መነሻ ካወቃችሁ ሉሎቹን ታውቃላችሁ፦ **ሊቶ** = ዐለት፣ **ሃይድሮ** = ውሃ፣ **አትሞ** = አየር፣ **ባዮ** = ሕይወት፣ **አንትሮፖ** = ሰው።"}}]'::jsonb),
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

