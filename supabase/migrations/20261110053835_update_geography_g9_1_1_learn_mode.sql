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

  -- Update an existing lesson in place: replace its fields, note parts and quiz.
  update public.lessons set
    slug = '1-1-1', sort_order = 1, section_code = '1.1',
    section_title_en = 'The Science of Geography', section_title_am = 'የጂኦግራፊ ሳይንስ',
    title_en = 'Definition and Concept of Geography', title_am = 'የጂኦግራፊ ትርጉም እና ጽንሰ ሐሳብ',
    summary_en = 'Where the word geography comes from, how geographers defined it over time, the modern definition, and why geography is a science.', summary_am = 'ጂኦግራፊ የሚለው ቃል ከየት እንደመጣ፣ ምሁራን በጊዜ ሂደት እንዴት እንደተረጎሙት፣ ዘመናዊው ትርጉም፣ እና ጂኦግራፊ ለምን ሳይንስ እንደሆነ።',
    minutes = 12, main_topics = '[{"title":{"en":"Meaning of the word","am":"የቃሉ ትርጉም"},"points":[{"en":"Geography = **Geo** (Earth) + **Graphy** (writing / describing). Both are Greek words.","am":"ጂኦግራፊ = **ጂኦ** (ምድር) + **ግራፊ** (መጻፍ / መግለጽ)። ሁለቱም የግሪክ ቃላት ናቸው።"},{"en":"Old definition: geography is the **description of the Earth**.","am":"የቀድሞው ትርጉም፦ ጂኦግራፊ **የምድር ገለጻ** ነው።"},{"en":"**Eratosthenes**, a Greek scholar, was the first to use the word.","am":"ቃሉን መጀመሪያ የተጠቀመው **ኤራቶስቴንስ** የተባለ የግሪክ ምሁር ነው።"}]},{"title":{"en":"How the definition changed","am":"ትርጉሙ እንዴት ተለወጠ"},"points":[{"en":"There is **no single definition**, but all of them say geography studies the **Earth''s surface**.","am":"**አንድ ብቻ ትርጉም የለም**፤ ነገር ግን ሁሉም ጂኦግራፊ **የምድርን ገጽ** እንደሚያጠና ይስማማሉ።"},{"en":"**Hartshorne** (1899–1992): an **accurate, orderly and rational description** of the Earth''s surface.","am":"**ሃርትሾርን** (1899–1992)፦ የምድርን ገጽ **ትክክለኛ፣ ሥርዓት ያለውና ምክንያታዊ በሆነ መንገድ መግለጽ**።"},{"en":"**Yeates** (1968): geography develops and tests **theories** about where things are.","am":"**ዬትስ** (1968)፦ ጂኦግራፊ ነገሮች የት እንዳሉ የሚያብራሩ **ንድፈ ሐሳቦችን** ያዳብራል፣ ይፈትናል።"},{"en":"**Mid-20th century**: geography became a **spatial science** (where things are and how they are spread).","am":"**በ20ኛው ክፍለ ዘመን አጋማሽ**፦ ጂኦግራፊ **ቦታዊ ሳይንስ** ሆነ (ነገሮች የት እንዳሉና እንዴት እንደተሰራጩ)።"}]},{"title":{"en":"The modern definition (learn this!)","am":"ዘመናዊው ትርጉም (ይህን በደንብ አጥኑ!)"},"points":[{"en":"Geography is a **spatial-temporal science**: it studies **where** (space) and **when** (time).","am":"ጂኦግራፊ **ቦታዊ-ጊዜያዊ ሳይንስ** ነው፤ **የት** (ቦታ) እና **መቼ** (ጊዜ) የሚለውን ያጠናል።"},{"en":"It studies the **distribution** and **interaction** of **human and physical** things, and their **causes and effects**.","am":"የ**ሰውና የተፈጥሮ** ነገሮችን **ስርጭትና መስተጋብር**፣ እንዲሁም **መንስኤና ውጤታቸውን** ያጠናል።"},{"en":"Example: cutting forests → more soil erosion → less food.","am":"ምሳሌ፦ ደን መቁረጥ → የአፈር መሸርሸር መጨመር → የምግብ ምርት መቀነስ።"},{"en":"Geography answers 5 questions: **What? Where? When? Which? How?**","am":"ጂኦግራፊ 5 ጥያቄዎችን ይመልሳል፦ **ምን? የት? መቼ? የትኛው? እንዴት?**"}]},{"title":{"en":"Why geography is a science","am":"ጂኦግራፊ ለምን ሳይንስ ሆነ"},"points":[{"en":"Science = a **systematic** way of getting knowledge through research.","am":"ሳይንስ = በምርምር እውቀትን **ሥርዓት ባለው** መንገድ የማግኛ ዘዴ።"},{"en":"5 methods in order: Observation → Identification → Description → Experimental investigation → Theoretical explanation (**O-I-D-E-T**).","am":"5ቱ ዘዴዎች በቅደም ተከተል፦ ምልከታ → መለየት → ገለጻ → የሙከራ ምርመራ → ንድፈ ሐሳባዊ ማብራሪያ (**O-I-D-E-T**)።"},{"en":"Theoretical explanation answers **why** something happens.","am":"ንድፈ ሐሳባዊ ማብራሪያ አንድ ነገር **ለምን** እንደሚከሰት ይመልሳል።"},{"en":"Geography **bridges** the natural and social sciences.","am":"ጂኦግራፊ የተፈጥሮና የማኅበራዊ ሳይንሶችን **ያገናኛል**።"}]}]'::jsonb, glossary = '[{"term":{"en":"Geography","am":"ጂኦግራፊ"},"definition":{"en":"The study of the Earth''s surface: where things are, how they are spread, and how people and nature affect each other.","am":"የምድርን ገጽ የሚያጠና ትምህርት፦ ነገሮች የት እንዳሉ፣ እንዴት እንደተሰራጩ፣ ሰውና ተፈጥሮ እንዴት እንደሚገናኙ።"}},{"term":{"en":"Eratosthenes","am":"ኤራቶስቴንስ"},"definition":{"en":"Greek scholar (276–196 BC) who first used the word geography.","am":"ጂኦግራፊ የሚለውን ቃል መጀመሪያ የተጠቀመ የግሪክ ምሁር (276–196 ዓ.ዓ.)።"}},{"term":{"en":"Spatial-temporal science","am":"ቦታዊ-ጊዜያዊ ሳይንስ"},"definition":{"en":"A science that studies both space (where) and time (when). This is the modern definition of geography.","am":"ቦታን (የት) እና ጊዜን (መቼ) የሚያጠና ሳይንስ። ይህ የጂኦግራፊ ዘመናዊ ትርጉም ነው።"}},{"term":{"en":"Spatial science","am":"ቦታዊ ሳይንስ"},"definition":{"en":"A science about where things are and how they are arranged and spread over the Earth.","am":"ነገሮች የት እንዳሉና በምድር ላይ እንዴት እንደተደረደሩና እንደተሰራጩ የሚያጠና ሳይንስ።"}},{"term":{"en":"Spatial","am":"ቦታዊ"},"definition":{"en":"About space or location: where things are.","am":"ስለ ቦታ ወይም አቀማመጥ፤ ነገሮች የት እንዳሉ።"}},{"term":{"en":"Temporal","am":"ጊዜያዊ"},"definition":{"en":"About time: when things happen or change.","am":"ስለ ጊዜ፤ ነገሮች መቼ እንደሚከሰቱ ወይም እንደሚለወጡ።"}},{"term":{"en":"Distribution","am":"ስርጭት"},"definition":{"en":"How things are spread out over the Earth''s surface.","am":"ነገሮች በምድር ገጽ ላይ እንዴት እንደተሰራጩ።"}},{"term":{"en":"Interaction","am":"መስተጋብር"},"definition":{"en":"How people and nature affect and depend on each other (also called interdependence).","am":"ሰውና ተፈጥሮ እርስ በርስ እንዴት ተጽዕኖ እንደሚያሳድሩና እንደሚደጋገፉ (መደጋገፍ ተብሎም ይጠራል)።"}},{"term":{"en":"Science","am":"ሳይንስ"},"definition":{"en":"A systematic way of getting knowledge through research and scientific methods.","am":"በምርምርና በሳይንሳዊ ዘዴዎች እውቀትን ሥርዓት ባለው መንገድ የማግኛ ዘዴ።"}},{"term":{"en":"Systematic","am":"ሥርዓት ያለው"},"definition":{"en":"Done step by step, in a careful and organised order.","am":"በጥንቃቄና በተደራጀ ቅደም ተከተል፣ ደረጃ በደረጃ የሚሠራ።"}},{"term":{"en":"Observation","am":"ምልከታ"},"definition":{"en":"Looking at and watching things carefully: the first scientific method.","am":"ነገሮችን በጥንቃቄ ማየትና መከታተል፤ የመጀመሪያው ሳይንሳዊ ዘዴ።"}},{"term":{"en":"Theoretical explanation","am":"ንድፈ ሐሳባዊ ማብራሪያ"},"definition":{"en":"Explaining why something happens: the last scientific method.","am":"አንድ ነገር ለምን እንደሚከሰት ማብራራት፤ የመጨረሻው ሳይንሳዊ ዘዴ።"}}]'::jsonb
  where unit_id = v_unit_id and code = '1.1.1'
  returning id into v_lesson_id;
  if v_lesson_id is null then
    raise exception 'Lesson 1.1.1 does not exist yet; add it without --update';
  end if;
  delete from public.lesson_sections where lesson_id = v_lesson_id;
  delete from public.quizzes where lesson_id = v_lesson_id;

  insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, checks, blocks) values
    (v_lesson_id, 1, 'Where the word comes from', 'የቃሉ አመጣጥ', 'languages', array[1, 2]::int[],
     '[{"type":"paragraph","text":{"en":"The word **geography** is made of two **Greek** words.","am":"**ጂኦግራፊ (Geography)** የሚለው ቃል ከሁለት የ**ግሪክ** ቃላት የተሠራ ነው።"}},{"type":"points","items":[{"icon":"earth","title":{"en":"Geo","am":"ጂኦ (Geo)"},"text":{"en":"means **Earth**","am":"**ምድር** ማለት ነው"}},{"icon":"pen-line","title":{"en":"Graphy (graphein)","am":"ግራፊ (Graphy / graphein)"},"text":{"en":"means **writing** or describing","am":"**መጻፍ** ወይም መግለጽ ማለት ነው"}}]},{"type":"keypoint","variant":"definition","title":{"en":"So geography means…","am":"ስለዚህ ጂኦግራፊ ማለት…"},"text":{"en":"**Writing about the Earth**, or describing the Earth. This is the old definition.","am":"**ስለ ምድር መጻፍ** ወይም ምድርን መግለጽ ማለት ነው። ይህ የቀድሞው ትርጉም ነው።"}},{"type":"tip","title":{"en":"Memory tip","am":"የማስታወሻ ዘዴ"},"text":{"en":"**Geo**logy studies the Earth''s rocks. Bio**graphy** is writing about a life. Same two roots!","am":"**ጂኦ**ሎጂ (Geology) የምድር ዐለቶች ጥናት ነው። ባዮ**ግራፊ** (Biography) ስለ ሕይወት መጻፍ ነው። ተመሳሳይ ሁለት መነሻዎች!"}}]'::jsonb),
    (v_lesson_id, 2, 'Eratosthenes, the first to use the word', 'ቃሉን መጀመሪያ የተጠቀመው ኤራቶስቴንስ', 'scroll-text', array[3]::int[],
     '[{"type":"paragraph","text":{"en":"The word was first used by **Eratosthenes** (276–196 BC), a Greek scholar.","am":"ቃሉን ለመጀመሪያ ጊዜ የተጠቀመው **ኤራቶስቴንስ (Eratosthenes)** (276–196 ዓ.ዓ.) የተባለ የግሪክ ምሁር ነው።"}},{"type":"paragraph","text":{"en":"He defined geography simply as “the description of the Earth”.","am":"እሱ ጂኦግራፊን በቀላሉ «የምድር ገለጻ» ብሎ ገልጾታል።"}},{"type":"image","src":"/images/lessons/eratosthenes-map.webp","width":900,"height":468,"alt":{"en":"Old black-and-white map of the world as Eratosthenes knew it around 200 BC, showing Europe, Libya (Africa), Asia and India.","am":"ኤራቶስቴንስ በ200 ዓ.ዓ. ገደማ ያውቀው የነበረው ዓለም የሚያሳይ የጥንት ጥቁርና ነጭ ካርታ፤ አውሮፓ፣ ሊቢያ (አፍሪካ)፣ እስያና ሕንድ ይታያሉ።"},"caption":{"en":"The world as Eratosthenes described it (about 200 BC)","am":"ኤራቶስቴንስ የገለጸው ዓለም (በ200 ዓ.ዓ. ገደማ)"},"credit":"Map: J. F. Horrabin, The Outline of History (1920) · Public domain · Wikimedia Commons","creditUrl":"https://commons.wikimedia.org/wiki/File:Map_of_the_World_according_to_Eratosthenes,_H._G._Wells%27_Outline_of_History,_page_188.jpg"}]'::jsonb),
    (v_lesson_id, 3, 'Many definitions, one idea', 'ብዙ ትርጉሞች፣ አንድ ሐሳብ', 'quote', array[4, 5]::int[],
     '[{"type":"paragraph","text":{"en":"Geography has **no single definition**, but all definitions share one idea: geography studies the **Earth''s surface**.","am":"ጂኦግራፊ **አንድ ብቻ ትርጉም የለውም**፤ ነገር ግን ሁሉም ትርጉሞች አንድ ሐሳብ ይጋራሉ፦ ጂኦግራፊ **የምድርን ገጽ** ያጠናል።"}},{"type":"points","items":[{"icon":"book-text","title":{"en":"Concise Oxford Dictionary (1964)","am":"ኮንሳይዝ ኦክስፎርድ መዝገበ ቃላት (1964)"},"text":{"en":"The science of the Earth''s surface.","am":"የምድር ገጽ ሳይንስ።"}},{"icon":"ruler","title":{"en":"Richard Hartshorne (1899–1992)","am":"ሪቻርድ ሃርትሾርን (1899–1992)"},"text":{"en":"An **accurate, orderly and rational** description of the Earth''s surface.","am":"የምድርን ገጽ **ትክክለኛ፣ ሥርዓት ያለውና ምክንያታዊ** በሆነ መንገድ መግለጽ።"}},{"icon":"lightbulb","title":{"en":"M. Yeates (1968)","am":"ኤም. ዬትስ (1968)"},"text":{"en":"A science that builds and tests **theories** about where things are on the Earth.","am":"ነገሮች በምድር ላይ የት እንዳሉ የሚያብራሩ **ንድፈ ሐሳቦችን** የሚገነባና የሚፈትን ሳይንስ።"}}]},{"type":"keypoint","variant":"note","title":{"en":"Textbook note","am":"የመማሪያ መጽሐፍ ማስታወሻ"},"text":{"en":"The textbook calls Hartshorne''s geography a “branch of knowledge”; many notes say “social science”. Know both.","am":"መማሪያ መጽሐፉ የሃርትሾርንን ትርጉም «የእውቀት ዘርፍ» ይለዋል፤ ብዙ ማስታወሻዎች ደግሞ «ማኅበራዊ ሳይንስ» ይላሉ። ሁለቱንም ማወቅ ያስፈልጋል።"}}]'::jsonb),
    (v_lesson_id, 4, 'A spatial science', 'ቦታዊ ሳይንስ', 'map-pin', array[6]::int[],
     '[{"type":"paragraph","text":{"en":"In the **mid-20th century**, geography became a **spatial science**.","am":"በ**20ኛው ክፍለ ዘመን አጋማሽ** ጂኦግራፊ **ቦታዊ ሳይንስ (Spatial Science)** ሆነ።"}},{"type":"paragraph","text":{"en":"It studies the **arrangement and distribution** of things over the Earth''s surface.","am":"በምድር ገጽ ላይ ያሉ ነገሮችን **አቀማመጥና ስርጭት** ያጠናል።"}},{"type":"list","items":[{"en":"**Spatial** = about location: **where** things are.","am":"**ቦታዊ (Spatial)** = ስለ አቀማመጥ፤ ነገሮች **የት** እንዳሉ።"},{"en":"Example: where people live, and how many live there.","am":"ምሳሌ፦ ሰዎች የት እንደሚኖሩና ምን ያህል እንደሆኑ።"},{"en":"Example: how people use soil, water and air around them.","am":"ምሳሌ፦ ሰዎች በዙሪያቸው ያለውን አፈር፣ ውሃና አየር እንዴት እንደሚጠቀሙ።"}]}]'::jsonb),
    (v_lesson_id, 5, 'The modern definition', 'ዘመናዊው ትርጉም', 'sparkles', array[7, 8]::int[],
     '[{"type":"keypoint","variant":"important","title":{"en":"Learn this definition","am":"ይህን ትርጉም በደንብ አጥኑ"},"text":{"en":"Geography is a **spatial-temporal science** that studies the **distribution** and **interaction** of human and physical things, and their **causes and effects**, on the Earth''s surface.","am":"ጂኦግራፊ በምድር ገጽ ላይ ያሉ የሰውና የተፈጥሮ ነገሮችን **ስርጭት (Distribution)** እና **መስተጋብር (Interaction)**፣ እንዲሁም **መንስኤና ውጤታቸውን** የሚያጠና **ቦታዊ-ጊዜያዊ ሳይንስ (Spatial-temporal Science)** ነው።"}},{"type":"points","items":[{"icon":"map-pin","title":{"en":"Spatial","am":"ቦታዊ (Spatial)"},"text":{"en":"**where** things are","am":"ነገሮች **የት** እንዳሉ"}},{"icon":"clock","title":{"en":"Temporal","am":"ጊዜያዊ (Temporal)"},"text":{"en":"**when** things happen or change","am":"ነገሮች **መቼ** እንደሚከሰቱ ወይም እንደሚለወጡ"}},{"icon":"globe","title":{"en":"Distribution","am":"ስርጭት (Distribution)"},"text":{"en":"how things are spread over the Earth","am":"ነገሮች በምድር ላይ እንዴት እንደተሰራጩ"}},{"icon":"route","title":{"en":"Interaction","am":"መስተጋብር (Interaction)"},"text":{"en":"how people and nature affect each other","am":"ሰውና ተፈጥሮ እርስ በርስ እንዴት ተጽዕኖ እንደሚያሳድሩ"}}]},{"type":"example","title":{"en":"Cause and effect","am":"መንስኤና ውጤት"},"text":{"en":"People cut down a forest → soil erosion increases → farms produce less food.","am":"ሰዎች ደን ይቆርጣሉ → የአፈር መሸርሸር ይጨምራል → እርሻዎች የሚያመርቱት ምግብ ይቀንሳል።"}}]'::jsonb),
    (v_lesson_id, 6, 'The 5 questions geography asks', 'ጂኦግራፊ የሚጠይቃቸው 5 ጥያቄዎች', 'circle-help', array[9]::int[],
     '[{"type":"paragraph","text":{"en":"Every geography topic answers the same five questions.","am":"እያንዳንዱ የጂኦግራፊ ርዕስ ተመሳሳይ አምስት ጥያቄዎችን ይመልሳል።"}},{"type":"terms","title":{"en":"The 5 questions","am":"5ቱ ጥያቄዎች"},"items":[{"en":"What?","am":"ምን?"},{"en":"Where?","am":"የት?"},{"en":"When?","am":"መቼ?"},{"en":"Which?","am":"የትኛው?"},{"en":"How?","am":"እንዴት?"}]},{"type":"example","title":{"en":"Try it on Lake Tana","am":"በጣና ሐይቅ ላይ ሞክሩት"},"text":{"en":"What is it? A lake. Where? In northern Ethiopia. When did it form? Which rivers flow out? How do people use it?","am":"ምንድን ነው? ሐይቅ። የት? በሰሜን ኢትዮጵያ። መቼ ተፈጠረ? የትኛው ወንዝ ይወጣበታል? ሰዎች እንዴት ይጠቀሙበታል?"}}]'::jsonb),
    (v_lesson_id, 7, 'What makes geography a science?', 'ጂኦግራፊን ሳይንስ የሚያደርገው ምንድን ነው?', 'flask-conical', array[10]::int[],
     '[{"type":"keypoint","variant":"definition","title":{"en":"Science","am":"ሳይንስ"},"text":{"en":"**Science** is a **systematic** way of getting knowledge through research.","am":"**ሳይንስ (Science)** በምርምር እውቀትን **ሥርዓት ባለው (Systematic)** መንገድ የማግኛ ዘዴ ነው።"}},{"type":"paragraph","text":{"en":"Geography is a science because it studies nature and people through research, using **scientific methods**.","am":"ጂኦግራፊ ሳይንስ ነው፤ ምክንያቱም ተፈጥሮንና ሰውን **ሳይንሳዊ ዘዴዎችን** በመጠቀም በምርምር ያጠናል።"}}]'::jsonb),
    (v_lesson_id, 8, 'The 5 scientific methods', '5ቱ ሳይንሳዊ ዘዴዎች', 'microscope', array[11, 12]::int[],
     '[{"type":"paragraph","text":{"en":"Scientists, including geographers, follow these five steps in order. Example: a river that is shrinking.","am":"የጂኦግራፊ ምሁራንን ጨምሮ ሳይንቲስቶች እነዚህን አምስት ደረጃዎች በቅደም ተከተል ይከተላሉ። ምሳሌ፦ እየቀነሰ ያለ ወንዝ።"}},{"type":"points","items":[{"icon":"eye","title":{"en":"1. Observation","am":"1. ምልከታ (Observation)"},"text":{"en":"Watch carefully: the river is getting smaller.","am":"በጥንቃቄ መመልከት፦ ወንዙ እያነሰ ነው።"}},{"icon":"scan-search","title":{"en":"2. Identification","am":"2. መለየት (Identification)"},"text":{"en":"Name it: “this is soil erosion and water loss”.","am":"መሰየም፦ «ይህ የአፈር መሸርሸርና የውሃ መቀነስ ነው»።"}},{"icon":"pen-line","title":{"en":"3. Description","am":"3. ገለጻ (Description)"},"text":{"en":"Describe it: its size, location and how serious it is.","am":"መግለጽ፦ መጠኑን፣ ቦታውንና ምን ያህል የከፋ እንደሆነ።"}},{"icon":"ruler","title":{"en":"4. Experimental investigation","am":"4. የሙከራ ምርመራ (Experimental Investigation)"},"text":{"en":"Test and collect data: measure the water level for months.","am":"መሞከርና መረጃ መሰብሰብ፦ የውሃውን መጠን ለወራት መለካት።"}},{"icon":"lightbulb","title":{"en":"5. Theoretical explanation","am":"5. ንድፈ ሐሳባዊ ማብራሪያ (Theoretical Explanation)"},"text":{"en":"Explain **why**: “deforestation is causing it”.","am":"**ለምን** እንደሆነ ማብራራት፦ «የደን ጭፍጨፋ እያስከተለው ነው»።"}}]},{"type":"tip","title":{"en":"Memory trick","am":"የማስታወሻ ዘዴ"},"text":{"en":"**O-I-D-E-T**: “Old Ideas Don''t Explain Things”.","am":"**O-I-D-E-T**፦ «Old Ideas Don''t Explain Things»፤ እያንዳንዱ ፊደል የዘዴው የእንግሊዝኛ መነሻ ፊደል ነው።"}}]'::jsonb),
    (v_lesson_id, 9, 'A bridge between sciences', 'በሳይንሶች መካከል ያለ ድልድይ', 'git-branch', array[13, 14]::int[],
     '[{"type":"paragraph","text":{"en":"Geography''s main tools are observation, systematic description, systematic recording and **mapping**.","am":"የጂኦግራፊ ዋና መሣሪያዎች ምልከታ፣ ሥርዓት ያለው ገለጻ፣ ሥርዓት ያለው መመዝገብና **ካርታ መሥራት (Mapping)** ናቸው።"}},{"type":"keypoint","variant":"important","title":{"en":"Remember","am":"አስታውሱ"},"text":{"en":"Geography studies both nature and people, so it **bridges the natural and social sciences**.","am":"ጂኦግራፊ ተፈጥሮንም ሰውንም ስለሚያጠና **የተፈጥሮና የማኅበራዊ ሳይንሶችን ያገናኛል**።"}}]'::jsonb);

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

  -- Update an existing lesson in place: replace its fields, note parts and quiz.
  update public.lessons set
    slug = '1-1-2', sort_order = 2, section_code = '1.1',
    section_title_en = 'The Science of Geography', section_title_am = 'የጂኦግራፊ ሳይንስ',
    title_en = 'Branches of Geography', title_am = 'የጂኦግራፊ ቅርንጫፎች',
    summary_en = 'The two main branches of geography, physical and human, and the specialised fields inside each one.', summary_am = 'ሁለቱ ዋና የጂኦግራፊ ቅርንጫፎች፣ የተፈጥሮና የሰው ጂኦግራፊ፣ እና በእያንዳንዳቸው ውስጥ ያሉ ልዩ ዘርፎች።',
    minutes = 8, main_topics = '[{"title":{"en":"Two main branches","am":"ሁለቱ ዋና ቅርንጫፎች"},"points":[{"en":"Geography has **2 main branches**: **Physical** geography and **Human** geography.","am":"ጂኦግራፊ **2 ዋና ቅርንጫፎች** አሉት፦ **የተፈጥሮ** ጂኦግራፊ እና **የሰው** ጂኦግራፊ።"},{"en":"Physical = **natural** features (climate, landforms, soil, vegetation, drainage).","am":"የተፈጥሮ = **ተፈጥሯዊ** ገጽታዎች (የአየር ንብረት፣ የመሬት ቅርጾች፣ አፈር፣ ዕፅዋት፣ የውሃ ፍሳሽ)።"},{"en":"Human = **human-made** aspects (population, cities, economy, culture, politics).","am":"የሰው = **በሰው የተሠሩ** ገጽታዎች (ሕዝብ፣ ከተሞች፣ ኢኮኖሚ፣ ባህል፣ ፖለቲካ)።"},{"en":"Trick: **nature** made it → physical; **people** made it → human.","am":"ዘዴ፦ **ተፈጥሮ** የሠራው → የተፈጥሮ፤ **ሰው** የሠራው → የሰው ጂኦግራፊ።"}]},{"title":{"en":"Physical geography fields","am":"የተፈጥሮ ጂኦግራፊ ዘርፎች"},"points":[{"en":"**Climatology** → climate","am":"**የአየር ንብረት ጥናት (Climatology)** → የአየር ንብረት"},{"en":"**Geomorphology** → landforms and the forces that shape them","am":"**የመሬት ቅርጽ ጥናት (Geomorphology)** → የመሬት ቅርጾችና የሚቀርጿቸው ኃይሎች"},{"en":"**Soil geography** → soils","am":"**የአፈር ጂኦግራፊ** → አፈር"},{"en":"**Biogeography** → plants and animals","am":"**የሕይወት ጂኦግራፊ (Biogeography)** → ዕፅዋትና እንስሳት"},{"en":"**Oceanography** → ocean currents, waves and tides; **Hydrology** → water on land","am":"**የውቅያኖስ ጥናት (Oceanography)** → ጅረቶች፣ ማዕበሎችና የባሕር ውሃ ከፍታና ዝቅታ፤ **የውሃ ጥናት (Hydrology)** → በየብስ ላይ ያለ ውሃ"}]},{"title":{"en":"Human geography fields","am":"የሰው ጂኦግራፊ ዘርፎች"},"points":[{"en":"**Population** → distribution, growth and structure of people","am":"**የሕዝብ ጂኦግራፊ** → የሕዝብ ስርጭት፣ ዕድገትና አወቃቀር"},{"en":"**Urban** → towns and cities","am":"**የከተማ ጂኦግራፊ** → ከተሞች"},{"en":"**Economic** → production, consumption and exchange","am":"**የኢኮኖሚ ጂኦግራፊ** → ምርት፣ ፍጆታና ልውውጥ"},{"en":"**Cultural** → beliefs and customs; **Political** → power and decisions; **Historical** → places in the past","am":"**የባህል ጂኦግራፊ** → እምነትና ልማድ፤ **የፖለቲካ ጂኦግራፊ** → ሥልጣንና ውሳኔ፤ **የታሪክ ጂኦግራፊ** → ቦታዎች በቀድሞ ዘመን"}]},{"title":{"en":"Watch out in exams","am":"በፈተና ላይ ተጠንቀቁ"},"points":[{"en":"Biogeography is **physical**, not human.","am":"የሕይወት ጂኦግራፊ (Biogeography) **የተፈጥሮ** ጂኦግራፊ ነው እንጂ የሰው አይደለም።"},{"en":"Population distribution = **population** geography, not cultural geography.","am":"የሕዝብ ስርጭት = **የሕዝብ** ጂኦግራፊ እንጂ የባህል ጂኦግራፊ አይደለም።"}]}]'::jsonb, glossary = '[{"term":{"en":"Physical geography","am":"የተፈጥሮ ጂኦግራፊ"},"definition":{"en":"The branch of geography that studies natural features: climate, landforms, soil, vegetation and water.","am":"የተፈጥሮ ገጽታዎችን የሚያጠና የጂኦግራፊ ቅርንጫፍ፦ የአየር ንብረት፣ የመሬት ቅርጾች፣ አፈር፣ ዕፅዋትና ውሃ።"}},{"term":{"en":"Human geography","am":"የሰው ጂኦግራፊ"},"definition":{"en":"The branch of geography that studies what people make and do: population, cities, economy, culture and politics.","am":"ሰዎች የሚሠሩትንና የሚያደርጉትን የሚያጠና የጂኦግራፊ ቅርንጫፍ፦ ሕዝብ፣ ከተሞች፣ ኢኮኖሚ፣ ባህልና ፖለቲካ።"}},{"term":{"en":"Sub-field","am":"ንዑስ ዘርፍ"},"definition":{"en":"A smaller, specialised area of study inside a branch.","am":"በአንድ ቅርንጫፍ ውስጥ ያለ ትንሽና ልዩ የጥናት ዘርፍ።"}},{"term":{"en":"Landforms","am":"የመሬት ቅርጾች"},"definition":{"en":"Natural shapes of the land, such as mountains, plateaus, valleys and plains.","am":"እንደ ተራሮች፣ አምባዎች፣ ሸለቆዎችና ሜዳዎች ያሉ የመሬት ተፈጥሯዊ ቅርጾች።"}},{"term":{"en":"Climatology","am":"የአየር ንብረት ጥናት"},"definition":{"en":"The study of climate: what creates it and how it differs from place to place.","am":"የአየር ንብረት ጥናት፦ የሚፈጥሩት ምክንያቶችና ከቦታ ቦታ እንዴት እንደሚለያይ።"}},{"term":{"en":"Geomorphology","am":"የመሬት ቅርጽ ጥናት"},"definition":{"en":"The study of landforms and the forces that shape them.","am":"የመሬት ቅርጾችንና የሚቀርጿቸውን ኃይሎች የሚያጠና ዘርፍ።"}},{"term":{"en":"Biogeography","am":"የሕይወት ጂኦግራፊ"},"definition":{"en":"The study of where plants and animals live, and why. It is part of physical geography.","am":"ዕፅዋትና እንስሳት የት እንደሚኖሩና ለምን እንደሆነ የሚያጠና ዘርፍ። የተፈጥሮ ጂኦግራፊ ክፍል ነው።"}},{"term":{"en":"Oceanography","am":"የውቅያኖስ ጥናት"},"definition":{"en":"The study of oceans: currents, waves and tides.","am":"የውቅያኖሶች ጥናት፦ ጅረቶች፣ ማዕበሎችና የባሕር ውሃ ከፍታና ዝቅታ።"}},{"term":{"en":"Hydrology","am":"የውሃ ጥናት"},"definition":{"en":"The study of water on land: rivers, lakes and drainage.","am":"በየብስ ላይ ያለ ውሃ ጥናት፦ ወንዞች፣ ሐይቆችና የውሃ ፍሳሽ።"}},{"term":{"en":"Population geography","am":"የሕዝብ ጂኦግራፊ"},"definition":{"en":"The study of how people are spread, how fast the population grows and its structure (ages, sexes).","am":"ሕዝብ እንዴት እንደተሰራጨ፣ በምን ያህል ፍጥነት እንደሚያድግና አወቃቀሩን (ዕድሜ፣ ጾታ) የሚያጠና ዘርፍ።"}},{"term":{"en":"Urban geography","am":"የከተማ ጂኦግራፊ"},"definition":{"en":"The study of how towns and cities grow and what they are like.","am":"ከተሞች እንዴት እንደሚያድጉና ምን እንደሚመስሉ የሚያጠና ዘርፍ።"}}]'::jsonb
  where unit_id = v_unit_id and code = '1.1.2'
  returning id into v_lesson_id;
  if v_lesson_id is null then
    raise exception 'Lesson 1.1.2 does not exist yet; add it without --update';
  end if;
  delete from public.lesson_sections where lesson_id = v_lesson_id;
  delete from public.quizzes where lesson_id = v_lesson_id;

  insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, checks, blocks) values
    (v_lesson_id, 1, 'The two main branches', 'ሁለቱ ዋና ቅርንጫፎች', 'git-branch', array[1]::int[],
     '[{"type":"paragraph","text":{"en":"Geography is divided into branches depending on **what it studies**.","am":"ጂኦግራፊ **በሚያጠናው ነገር** ላይ ተመሥርቶ በቅርንጫፎች ይከፈላል።"}},{"type":"points","items":[{"icon":"mountain","title":{"en":"Physical geography","am":"የተፈጥሮ ጂኦግራፊ (Physical Geography)"},"text":{"en":"studies **natural** features made by nature.","am":"በተፈጥሮ የተሠሩ **ተፈጥሯዊ** ገጽታዎችን ያጠናል።"}},{"icon":"users","title":{"en":"Human geography","am":"የሰው ጂኦግራፊ (Human Geography)"},"text":{"en":"studies **human-made** things and how people interact with nature.","am":"በሰው የተሠሩ ነገሮችንና ሰዎች ከተፈጥሮ ጋር እንዴት እንደሚገናኙ ያጠናል።"}}]},{"type":"tip","title":{"en":"Easy trick","am":"ቀላል ዘዴ"},"text":{"en":"**Nature** made it → physical. **People** made it → human.","am":"**ተፈጥሮ** የሠራው → የተፈጥሮ ጂኦግራፊ። **ሰው** የሠራው → የሰው ጂኦግራፊ።"}}]'::jsonb),
    (v_lesson_id, 2, 'Physical geography', 'የተፈጥሮ ጂኦግራፊ', 'mountain', array[2, 4]::int[],
     '[{"type":"paragraph","text":{"en":"**Physical geography** studies the natural features of the Earth, with their causes, effects and interactions.","am":"**የተፈጥሮ ጂኦግራፊ (Physical Geography)** የምድርን ተፈጥሯዊ ገጽታዎች ከመንስኤ፣ ከውጤትና ከመስተጋብራቸው ጋር ያጠናል።"}},{"type":"list","items":[{"en":"Climate","am":"የአየር ንብረት"},{"en":"**Landforms**: mountains, plateaus, valleys, plains","am":"**የመሬት ቅርጾች (Landforms)**፦ ተራሮች፣ አምባዎች፣ ሸለቆዎች፣ ሜዳዎች"},{"en":"Soil and vegetation","am":"አፈርና ዕፅዋት"},{"en":"Drainage: rivers and lakes","am":"የውሃ ፍሳሽ፦ ወንዞችና ሐይቆች"}]},{"type":"image","src":"/images/lessons/simien-mountains.webp","width":900,"height":675,"alt":{"en":"Steep green mountains and deep valleys of the Simien Mountains National Park in Ethiopia.","am":"በኢትዮጵያ የሰሜን ተራሮች ብሔራዊ ፓርክ ገደላማ አረንጓዴ ተራሮችና ጥልቅ ሸለቆዎች።"},"caption":{"en":"Landforms made by nature: the Simien Mountains, Ethiopia","am":"በተፈጥሮ የተሠሩ የመሬት ቅርጾች፦ የሰሜን ተራሮች፣ ኢትዮጵያ"},"credit":"Photo: Barrowbob · CC BY-SA 4.0 · Wikimedia Commons","creditUrl":"https://commons.wikimedia.org/wiki/File:Simien_Mountains_National_Park_in_Ethiopia.jpg"}]'::jsonb),
    (v_lesson_id, 3, 'Human geography', 'የሰው ጂኦግራፊ', 'users', array[3]::int[],
     '[{"type":"paragraph","text":{"en":"**Human geography** studies the human-made parts of our world and how they interact with nature.","am":"**የሰው ጂኦግራፊ (Human Geography)** የዓለማችንን በሰው የተሠሩ ክፍሎችና ከተፈጥሮ ጋር ያላቸውን መስተጋብር ያጠናል።"}},{"type":"list","items":[{"en":"Population","am":"ሕዝብ"},{"en":"Settlements: towns and cities","am":"ሰፈራዎች፦ ከተሞች"},{"en":"Economic activities","am":"የኢኮኖሚ እንቅስቃሴዎች"},{"en":"Culture and political systems","am":"ባህልና የፖለቲካ ሥርዓቶች"}]},{"type":"image","src":"/images/lessons/addis-ababa.webp","width":900,"height":675,"alt":{"en":"The skyline of Addis Ababa with tall buildings, cranes and trees.","am":"ረጃጅም ሕንፃዎች፣ ክሬኖችና ዛፎች ያሉበት የአዲስ አበባ ከተማ ገጽታ።"},"caption":{"en":"A city built by people: Addis Ababa, Ethiopia","am":"በሰዎች የተገነባ ከተማ፦ አዲስ አበባ፣ ኢትዮጵያ"},"credit":"Photo: Simfan34 · CC BY-SA 3.0 · Wikimedia Commons","creditUrl":"https://commons.wikimedia.org/wiki/File:Addis_Ababa_skyline.jpg"}]'::jsonb),
    (v_lesson_id, 4, 'Fields of physical geography', 'የተፈጥሮ ጂኦግራፊ ዘርፎች', 'leaf', array[5, 8]::int[],
     '[{"type":"paragraph","text":{"en":"Each natural feature has its own **sub-field** that studies it.","am":"እያንዳንዱን ተፈጥሯዊ ገጽታ የሚያጠና የራሱ **ንዑስ ዘርፍ (Sub-field)** አለ።"}},{"type":"points","items":[{"icon":"thermometer-sun","title":{"en":"Climatology","am":"የአየር ንብረት ጥናት (Climatology)"},"text":{"en":"climate","am":"የአየር ንብረት"}},{"icon":"mountain","title":{"en":"Geomorphology","am":"የመሬት ቅርጽ ጥናት (Geomorphology)"},"text":{"en":"landforms and the forces that shape them","am":"የመሬት ቅርጾችና የሚቀርጿቸው ኃይሎች"}},{"icon":"sprout","title":{"en":"Soil geography","am":"የአፈር ጂኦግራፊ (Soil Geography)"},"text":{"en":"soils and their characteristics","am":"አፈርና ባሕርያቱ"}},{"icon":"bird","title":{"en":"Biogeography","am":"የሕይወት ጂኦግራፊ (Biogeography)"},"text":{"en":"plants and animals","am":"ዕፅዋትና እንስሳት"}},{"icon":"waves","title":{"en":"Oceanography","am":"የውቅያኖስ ጥናት (Oceanography)"},"text":{"en":"ocean currents, waves and tides","am":"የውቅያኖስ ጅረቶች፣ ማዕበሎችና የባሕር ውሃ ከፍታና ዝቅታ"}},{"icon":"droplets","title":{"en":"Hydrology","am":"የውሃ ጥናት (Hydrology)"},"text":{"en":"water on land: rivers and lakes","am":"በየብስ ላይ ያለ ውሃ፦ ወንዞችና ሐይቆች"}}]},{"type":"keypoint","variant":"note","title":{"en":"Textbook note","am":"የመማሪያ መጽሐፍ ማስታወሻ"},"text":{"en":"Class notes often list Hydrology; the Grade 9 textbook lists Oceanography. Both are physical geography.","am":"የክፍል ማስታወሻዎች ብዙ ጊዜ የውሃ ጥናትን (Hydrology) ይዘረዝራሉ፤ የ9ኛ ክፍል መጽሐፍ ደግሞ የውቅያኖስ ጥናትን (Oceanography)። ሁለቱም የተፈጥሮ ጂኦግራፊ ናቸው።"}}]'::jsonb),
    (v_lesson_id, 5, 'Fields of human geography', 'የሰው ጂኦግራፊ ዘርፎች', 'building-2', array[7, 10]::int[],
     '[{"type":"points","items":[{"icon":"users","title":{"en":"Population geography","am":"የሕዝብ ጂኦግራፊ (Population Geography)"},"text":{"en":"how people are spread, how the population grows, its structure","am":"ሕዝብ እንዴት እንደተሰራጨ፣ እንዴት እንደሚያድግና አወቃቀሩ"}},{"icon":"building-2","title":{"en":"Urban geography","am":"የከተማ ጂኦግራፊ (Urban Geography)"},"text":{"en":"towns and cities","am":"ከተሞች"}},{"icon":"coins","title":{"en":"Economic geography","am":"የኢኮኖሚ ጂኦግራፊ (Economic Geography)"},"text":{"en":"producing, using and trading goods and services","am":"የዕቃዎችና የአገልግሎቶች ምርት፣ ፍጆታና ንግድ"}},{"icon":"palette","title":{"en":"Cultural geography","am":"የባህል ጂኦግራፊ (Cultural Geography)"},"text":{"en":"beliefs, customs and how cultures spread","am":"እምነቶች፣ ልማዶችና ባህሎች እንዴት እንደሚስፋፉ"}},{"icon":"landmark","title":{"en":"Political geography","am":"የፖለቲካ ጂኦግራፊ (Political Geography)"},"text":{"en":"political systems, power and decisions","am":"የፖለቲካ ሥርዓቶች፣ ሥልጣንና ውሳኔዎች"}},{"icon":"hourglass","title":{"en":"Historical geography","am":"የታሪክ ጂኦግራፊ (Historical Geography)"},"text":{"en":"places in the past and how they changed","am":"ቦታዎች በቀድሞ ዘመን እና እንዴት እንደተለወጡ"}}]}]'::jsonb),
    (v_lesson_id, 6, 'Watch out in exams', 'በፈተና ላይ ተጠንቀቁ', 'target', array[6, 9]::int[],
     '[{"type":"example","title":{"en":"Trap 1","am":"ወጥመድ 1"},"text":{"en":"**Biogeography** studies plants and animals, so it is **physical** geography, not human geography.","am":"**የሕይወት ጂኦግራፊ (Biogeography)** ዕፅዋትንና እንስሳትን ስለሚያጠና የ**ተፈጥሮ** ጂኦግራፊ ነው እንጂ የሰው ጂኦግራፊ አይደለም።"}},{"type":"example","title":{"en":"Trap 2","am":"ወጥመድ 2"},"text":{"en":"Where people live is studied by **population geography**, not cultural geography.","am":"ሰዎች የት እንደሚኖሩ የሚያጠናው **የሕዝብ ጂኦግራፊ (Population Geography)** ነው እንጂ የባህል ጂኦግራፊ አይደለም።"}}]'::jsonb);

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

  -- Update an existing lesson in place: replace its fields, note parts and quiz.
  update public.lessons set
    slug = '1-1-3', sort_order = 3, section_code = '1.1',
    section_title_en = 'The Science of Geography', section_title_am = 'የጂኦግራፊ ሳይንስ',
    title_en = 'Scope of Geography', title_am = 'የጂኦግራፊ ወሰን',
    summary_en = 'What scope means, why geography''s scope is so wide, the five spheres it studies, and how its scope changed through history.', summary_am = 'ወሰን ምን ማለት እንደሆነ፣ የጂኦግራፊ ወሰን ለምን ሰፊ እንደሆነ፣ የሚያጠናቸው አምስቱ ሉሎች፣ እና ወሰኑ በታሪክ ውስጥ እንዴት እንደተለወጠ።',
    minutes = 8, main_topics = '[{"title":{"en":"What scope means","am":"ወሰን ምን ማለት ነው"},"points":[{"en":"Scope = the **focus, degree, range and content** of a subject: **how much** it covers.","am":"ወሰን = የአንድ ትምህርት **ትኩረት፣ ደረጃ፣ ስፋትና ይዘት**፤ ምን ያህል እንደሚሸፍን።"},{"en":"Geography''s scope is **very wide**: physical and human features, with their causes, effects and interactions.","am":"የጂኦግራፊ ወሰን **በጣም ሰፊ** ነው፦ የተፈጥሮና የሰው ገጽታዎችን ከመንስኤ፣ ከውጤትና ከመስተጋብራቸው ጋር ያጠናል።"},{"en":"Its scope is **dynamic**: it changes as new discoveries and ideas appear.","am":"ወሰኑ **ተለዋዋጭ** ነው፤ አዳዲስ ግኝቶችና ሐሳቦች ሲመጡ ይለወጣል።"}]},{"title":{"en":"The 5 spheres","am":"5ቱ ሉሎች"},"points":[{"en":"**Lithosphere** = rock (the solid layer)","am":"**ሊቶስፌር** = ዐለት (ጠንካራው ንብርብር)"},{"en":"**Hydrosphere** = water (oceans, rivers, lakes)","am":"**ሃይድሮስፌር** = ውሃ (ውቅያኖሶች፣ ወንዞች፣ ሐይቆች)"},{"en":"**Atmosphere** = air (gases around the Earth)","am":"**ከባቢ አየር** = አየር (ምድርን የከበቡ ጋዞች)"},{"en":"**Biosphere** = life (plants and animals)","am":"**ባዮስፌር** = ሕይወት (ዕፅዋትና እንስሳት)"},{"en":"**Anthroposphere** = the cultural landscape made by humans (cities, roads, farms)","am":"**አንትሮፖስፌር** = በሰው የተሠራ ባህላዊ ገጽታ (ከተሞች፣ መንገዶች፣ እርሻዎች)"}]},{"title":{"en":"How the scope changed","am":"ወሰኑ እንዴት ተለወጠ"},"points":[{"en":"Ancient times: the **mother of many sciences**.","am":"በጥንት ዘመን፦ **የብዙ ሳይንሶች እናት**።"},{"en":"16th century: focus on **location** (where, why, what).","am":"16ኛው ክፍለ ዘመን፦ ትኩረት በ**አቀማመጥ** ላይ (የት፣ ለምን፣ ምን)።"},{"en":"Mid-18th century: **people and environment**; Germans **Humboldt** and **Ritter**.","am":"18ኛው ክፍለ ዘመን አጋማሽ፦ **ሰውና አካባቢ**፤ ጀርመናውያኑ **ሁምቦልት** እና **ሪተር**።"},{"en":"19th century: geographical **societies** formed. 20th century: a **spatial science**.","am":"19ኛው ክፍለ ዘመን፦ የጂኦግራፊ **ማኅበራት** ተቋቋሙ። 20ኛው ክፍለ ዘመን፦ **ቦታዊ ሳይንስ** ሆነ።"}]}]'::jsonb, glossary = '[{"term":{"en":"Scope","am":"ወሰን"},"definition":{"en":"The focus, degree, range and content of a subject: how much it covers.","am":"የአንድ ትምህርት ትኩረት፣ ደረጃ፣ ስፋትና ይዘት፤ ምን ያህል እንደሚሸፍን።"}},{"term":{"en":"Dynamic","am":"ተለዋዋጭ"},"definition":{"en":"Always changing and growing.","am":"ሁልጊዜ የሚለወጥና የሚያድግ።"}},{"term":{"en":"Lithosphere","am":"ሊቶስፌር"},"definition":{"en":"The solid rock layer of the Earth (litho = rock).","am":"የምድር ጠንካራ የዐለት ንብርብር (ሊቶ = ዐለት)።"}},{"term":{"en":"Hydrosphere","am":"ሃይድሮስፌር"},"definition":{"en":"All the water on Earth: oceans, rivers, lakes (hydro = water).","am":"በምድር ላይ ያለ ውሃ በሙሉ፦ ውቅያኖሶች፣ ወንዞች፣ ሐይቆች (ሃይድሮ = ውሃ)።"}},{"term":{"en":"Atmosphere","am":"ከባቢ አየር"},"definition":{"en":"The layer of air (gases) around the Earth.","am":"ምድርን የከበበው የአየር (የጋዞች) ንብርብር።"}},{"term":{"en":"Biosphere","am":"ባዮስፌር"},"definition":{"en":"All living things on Earth: plants and animals (bio = life).","am":"በምድር ላይ ያሉ ሕያዋን ፍጥረታት በሙሉ፦ ዕፅዋትና እንስሳት (ባዮ = ሕይወት)።"}},{"term":{"en":"Anthroposphere","am":"አንትሮፖስፌር"},"definition":{"en":"Everything humans have made: cities, roads, farms (anthropo = human).","am":"ሰዎች የሠሯቸው ነገሮች በሙሉ፦ ከተሞች፣ መንገዶች፣ እርሻዎች (አንትሮፖ = ሰው)።"}},{"term":{"en":"Cultural landscape","am":"ባህላዊ ገጽታ"},"definition":{"en":"The parts of a landscape that people have shaped or built.","am":"ሰዎች የቀረጹት ወይም የገነቡት የመሬት ገጽታ ክፍል።"}}]'::jsonb
  where unit_id = v_unit_id and code = '1.1.3'
  returning id into v_lesson_id;
  if v_lesson_id is null then
    raise exception 'Lesson 1.1.3 does not exist yet; add it without --update';
  end if;
  delete from public.lesson_sections where lesson_id = v_lesson_id;
  delete from public.quizzes where lesson_id = v_lesson_id;

  insert into public.lesson_sections (lesson_id, sort_order, title_en, title_am, icon, checks, blocks) values
    (v_lesson_id, 1, 'What is scope?', 'ወሰን ምንድን ነው?', 'target', array[1]::int[],
     '[{"type":"keypoint","variant":"definition","title":{"en":"Scope","am":"ወሰን (Scope)"},"text":{"en":"**Scope** means the **focus, degree, range and content** of a subject. Simply: **how much** a subject covers.","am":"**ወሰን (Scope)** ማለት የአንድ ትምህርት **ትኩረት፣ ደረጃ፣ ስፋትና ይዘት** ነው። በቀላሉ፦ አንድ ትምህርት **ምን ያህል** እንደሚሸፍን።"}},{"type":"paragraph","text":{"en":"The textbook says it is the **range and variety of contents** in a subject.","am":"መማሪያ መጽሐፉ «በአንድ ትምህርት ውስጥ ያሉ **ይዘቶች ስፋትና ዓይነት**» ይለዋል።"}}]'::jsonb),
    (v_lesson_id, 2, 'A very wide, changing scope', 'በጣም ሰፊና ተለዋዋጭ ወሰን', 'globe', array[2, 12]::int[],
     '[{"type":"paragraph","text":{"en":"Geography studies a great many physical and human features, with their causes, effects and interactions.","am":"ጂኦግራፊ እጅግ ብዙ የተፈጥሮና የሰው ገጽታዎችን ከመንስኤ፣ ከውጤትና ከመስተጋብራቸው ጋር ያጠናል።"}},{"type":"paragraph","text":{"en":"Its scope is **dynamic**: it changes as new discoveries and ideas appear.","am":"ወሰኑ **ተለዋዋጭ (Dynamic)** ነው፤ አዳዲስ ግኝቶችና ሐሳቦች ሲመጡ ይለወጣል።"}},{"type":"example","title":{"en":"Only place names?","am":"የቦታ ስሞች ብቻ?"},"text":{"en":"No! Geography explains **where** things are, **why** they are there, and how people and nature affect each other.","am":"አይደለም! ጂኦግራፊ ነገሮች **የት** እንዳሉ፣ **ለምን** እዚያ እንዳሉ፣ ሰውና ተፈጥሮ እንዴት እርስ በርስ ተጽዕኖ እንደሚያሳድሩ ያብራራል።"}}]'::jsonb),
    (v_lesson_id, 3, 'The 5 spheres', '5ቱ ሉሎች', 'earth', array[3, 4]::int[],
     '[{"type":"paragraph","text":{"en":"What geography studies is found in the Earth''s five **spheres** (parts).","am":"ጂኦግራፊ የሚያጠናቸው ነገሮች በምድር አምስት **ሉሎች (Spheres)** ውስጥ ይገኛሉ።"}},{"type":"points","items":[{"icon":"mountain","title":{"en":"Lithosphere","am":"ሊቶስፌር (Lithosphere)"},"text":{"en":"rock: the solid layer (litho = rock)","am":"ዐለት፦ ጠንካራው ንብርብር (ሊቶ = ዐለት)"}},{"icon":"droplets","title":{"en":"Hydrosphere","am":"ሃይድሮስፌር (Hydrosphere)"},"text":{"en":"water: oceans, rivers, lakes (hydro = water)","am":"ውሃ፦ ውቅያኖሶች፣ ወንዞች፣ ሐይቆች (ሃይድሮ = ውሃ)"}},{"icon":"wind","title":{"en":"Atmosphere","am":"ከባቢ አየር (Atmosphere)"},"text":{"en":"air: the gases around the Earth (atmo = vapour)","am":"አየር፦ ምድርን የከበቡ ጋዞች (አትሞ = ተን)"}},{"icon":"leaf","title":{"en":"Biosphere","am":"ባዮስፌር (Biosphere)"},"text":{"en":"life: plants and animals (bio = life)","am":"ሕይወት፦ ዕፅዋትና እንስሳት (ባዮ = ሕይወት)"}},{"icon":"building-2","title":{"en":"Anthroposphere","am":"አንትሮፖስፌር (Anthroposphere)"},"text":{"en":"the **cultural landscape** humans made (anthropo = human)","am":"ሰዎች የሠሩት **ባህላዊ ገጽታ** (አንትሮፖ = ሰው)"}}]},{"type":"image","src":"/images/lessons/earth-spheres.webp","width":900,"height":506,"alt":{"en":"Cut-away diagram of the Earth showing the atmosphere layers around it, the hydrosphere on the surface, and the lithosphere above the mantle and core.","am":"የምድርን ውስጥ የሚያሳይ ሥዕላዊ መግለጫ፤ በዙሪያዋ ያሉ የከባቢ አየር ንብርብሮች፣ በላይ ያለው ሃይድሮስፌርና ከመጎናጸፊያውና ከማዕከሉ በላይ ያለው ሊቶስፌር።"},"caption":{"en":"Atmosphere, hydrosphere and lithosphere","am":"ከባቢ አየር፣ ሃይድሮስፌርና ሊቶስፌር"},"credit":"Diagram: Wikimeatier · CC BY-SA 4.0 · Wikimedia Commons","creditUrl":"https://commons.wikimedia.org/wiki/File:Earth%27s_spheres.svg"}]'::jsonb),
    (v_lesson_id, 4, 'Find the spheres on a farm', 'ሉሎቹን በአንድ እርሻ ላይ ፈልጉ', 'tractor', array[5, 7]::int[],
     '[{"type":"example","title":{"en":"A highland farm in Ethiopia","am":"በኢትዮጵያ ደጋማ አካባቢ ያለ እርሻ"},"text":{"en":"Soil and rocks = lithosphere. The river = hydrosphere. Air and rain clouds = atmosphere. Crops and cattle = biosphere. The house and road = anthroposphere.","am":"አፈርና ዐለት = ሊቶስፌር። ወንዙ = ሃይድሮስፌር። አየርና የዝናብ ደመና = ከባቢ አየር። ሰብልና ከብቶች = ባዮስፌር። ቤቱና መንገዱ = አንትሮፖስፌር።"}},{"type":"tip","title":{"en":"Memory tip","am":"የማስታወሻ ዘዴ"},"text":{"en":"Know the roots: Litho = rock, Hydro = water, Atmo = air, Bio = life, Anthropo = human.","am":"መነሻዎቹን እወቁ፦ ሊቶ = ዐለት፣ ሃይድሮ = ውሃ፣ አትሞ = አየር፣ ባዮ = ሕይወት፣ አንትሮፖ = ሰው።"}},{"type":"keypoint","variant":"note","title":{"en":"Textbook note","am":"የመማሪያ መጽሐፍ ማስታወሻ"},"text":{"en":"The textbook names the 4 natural spheres. The anthroposphere is the human-made part, studied by human geography.","am":"መማሪያ መጽሐፉ 4ቱን የተፈጥሮ ሉሎች ይጠቅሳል። አንትሮፖስፌር በሰው የተሠራው ክፍል ሲሆን በሰው ጂኦግራፊ ይጠናል።"}}]'::jsonb),
    (v_lesson_id, 5, 'How the scope changed over time', 'ወሰኑ በጊዜ ሂደት እንዴት ተለወጠ', 'history', array[8, 9]::int[],
     '[{"type":"list","ordered":true,"items":[{"en":"**Ancient times**: the mother of many sciences, including philosophy.","am":"**በጥንት ዘመን**፦ ፍልስፍናን ጨምሮ የብዙ ሳይንሶች እናት።"},{"en":"**16th century**: focus on **location** (where, why, what).","am":"**16ኛው ክፍለ ዘመን**፦ ትኩረት በ**አቀማመጥ** ላይ (የት፣ ለምን፣ ምን)።"},{"en":"**Mid-18th century**: people and the environment. Germans **Humboldt** and **Ritter** led this.","am":"**18ኛው ክፍለ ዘመን አጋማሽ**፦ ሰውና አካባቢ። ጀርመናውያኑ **ሁምቦልት** እና **ሪተር** መሩት።"},{"en":"**19th century**: geographical societies and research groups formed.","am":"**19ኛው ክፍለ ዘመን**፦ የጂኦግራፊ ማኅበራትና የምርምር ቡድኖች ተቋቋሙ።"},{"en":"**20th century**: geography became a **spatial science**.","am":"**20ኛው ክፍለ ዘመን**፦ ጂኦግራፊ **ቦታዊ ሳይንስ** ሆነ።"}]},{"type":"keypoint","variant":"note","title":{"en":"Mid or late 20th century?","am":"የ20ኛው ክፍለ ዘመን አጋማሽ ወይስ መጨረሻ?"},"text":{"en":"The textbook says both. Most exams use **mid-20th century**; “20th century” is always right.","am":"መማሪያ መጽሐፉ ሁለቱንም ይላል። አብዛኞቹ ፈተናዎች **የ20ኛው ክፍለ ዘመን አጋማሽ** ይላሉ፤ «20ኛው ክፍለ ዘመን» ሁልጊዜ ትክክል ነው።"}}]'::jsonb),
    (v_lesson_id, 6, 'Key terms of 1.1 (revision)', 'የ1.1 ቁልፍ ቃላት (ክለሳ)', 'list-checks', array[10, 11]::int[],
     '[{"type":"table","headers":[{"en":"Term","am":"ቃል"},{"en":"Meaning","am":"ትርጉም"}],"rows":[[{"en":"**Geography** (old)","am":"**ጂኦግራፊ** (የቀድሞ)"},{"en":"Writing about the Earth (Eratosthenes)","am":"ስለ ምድር መጻፍ (ኤራቶስቴንስ)"}],[{"en":"**Hartshorne**","am":"**ሃርትሾርን**"},{"en":"Accurate, orderly and rational description of the Earth''s surface","am":"የምድርን ገጽ ትክክለኛ፣ ሥርዓት ያለውና ምክንያታዊ ገለጻ"}],[{"en":"**Spatial-temporal science**","am":"**ቦታዊ-ጊዜያዊ ሳይንስ**"},{"en":"Modern definition: studies where and when","am":"ዘመናዊ ትርጉም፦ የትና መቼ የሚለውን ያጠናል"}],[{"en":"**Science**","am":"**ሳይንስ**"},{"en":"A systematic way of getting knowledge through research","am":"በምርምር እውቀትን ሥርዓት ባለው መንገድ የማግኛ ዘዴ"}],[{"en":"**Physical / Human geography**","am":"**የተፈጥሮ / የሰው ጂኦግራፊ**"},{"en":"Natural features / human-made features","am":"ተፈጥሯዊ ገጽታዎች / በሰው የተሠሩ ገጽታዎች"}],[{"en":"**Scope**","am":"**ወሰን**"},{"en":"Focus, degree, range and content of a subject","am":"የአንድ ትምህርት ትኩረት፣ ደረጃ፣ ስፋትና ይዘት"}],[{"en":"**The 5 spheres**","am":"**5ቱ ሉሎች**"},{"en":"Rock, water, air, life, human-made","am":"ዐለት፣ ውሃ፣ አየር፣ ሕይወት፣ በሰው የተሠራ"}]]}]'::jsonb);

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

