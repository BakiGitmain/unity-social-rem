/*
 * Mathematics 9 · 1.1, homework hw5 ("show that"): shade BOTH sides (left and right diagram) in one
 * venn-type question. Only while the lesson was never edited in the admin (no lesson_versions), so admin
 * edits are never overwritten.
 */
update public.lessons l
   set homework = (
         select jsonb_agg(case when t.e ->> 'id' = 'hw5' then $hw${"id":"hw5","question":{"en":"Using Venn diagrams, show that $A \\cap (B \\cup C) = (A \\cap B) \\cup (A \\cap C)$. Shade the left side and the right side: they must match.","am":"በቬን ዲያግራም $A \\cap (B \\cup C) = (A \\cap B) \\cup (A \\cap C)$ መሆኑን አሳዩ። ግራውንና ቀኙን ጎን አጥሉ፤ አንድ ዓይነት መሆን አለባቸው።"},"tip":{"en":"Shade $B \\cup C$ first, then keep only the part inside A.","am":"መጀመሪያ $B \\cup C$ን አጥሉ፣ ከዚያ በA ውስጥ ያለውን ክፍል ብቻ ያዙ።"},"hints":[{"en":"$B \\cup C$ is everything inside circle B or circle C.","am":"$B \\cup C$ በክበብ B ወይም በክበብ C ውስጥ ያለ ሁሉ ነው።"},{"en":"Inside A, that leaves three small regions: A∩B only, A∩C only and the centre.","am":"በA ውስጥ ሦስት ትንንሽ ክፍሎች ይቀራሉ፦ A∩B ብቻ፣ A∩C ብቻ እና መሀሉ።"}],"answers":[{"label":{"en":"Left side: $A \\cap (B \\cup C)$","am":"ግራ ጎን፦ $A \\cap (B \\cup C)$"},"spec":{"kind":"venn","venn":{"sets":3,"labels":["A","B","C"]},"regions":["AB","AC","ABC"]}},{"label":{"en":"Right side: $(A \\cap B) \\cup (A \\cap C)$","am":"ቀኝ ጎን፦ $(A \\cap B) \\cup (A \\cap C)$"},"spec":{"kind":"venn","venn":{"sets":3,"labels":["A","B","C"]},"regions":["AB","AC","ABC"]}}],"solution":{"venn":{"sets":3,"labels":["A","B","C"]},"steps":[{"text":{"en":"Left: shade $B \\cup C$.","am":"ግራ፦ $B \\cup C$ን አጥሉ።"},"why":{"en":"Work inside the bracket first.","am":"መጀመሪያ በቅንፉ ውስጥ ሥሩ።"},"shade":"B∪C"},{"text":{"en":"Keep only the part inside A: regions $A\\cap B$, $A \\cap C$ and the centre.","am":"በA ውስጥ ያለውን ብቻ ያዙ፦ $A\\cap B$፣ $A \\cap C$ እና መሀሉ።"},"why":{"en":"Intersection with A means: stay inside circle A.","am":"ከA ጋር መገናኘት ማለት በክበብ A ውስጥ መቆየት ማለት ነው።"},"shade":"A∩(B∪C)"},{"text":{"en":"Right: $A \\cap B$ and $A \\cap C$, then join them.","am":"ቀኝ፦ $A \\cap B$ እና $A \\cap C$፣ ከዚያ አንድ አድርጓቸው።"},"why":{"en":"Each is a lens-shaped overlap; together they cover the same three regions.","am":"እያንዳንዳቸው የመገናኛ ክፍል ናቸው፤ አንድ ላይ ተመሳሳዩን ሦስት ክፍሎች ይሸፍናሉ።"},"shade":"(A∩B)∪(A∩C)"}],"answer":{"en":"Both sides shade the same regions, so the identity is true.","am":"ሁለቱም ጎኖች ተመሳሳይ ክፍሎችን ያጠላሉ፤ ስለዚህ ማንነቱ እውነት ነው።"}},"type":"venn"}$hw$::jsonb else t.e end order by t.ord)
           from jsonb_array_elements(l.homework) with ordinality as t(e, ord)
       ),
       updated_at = now()
 where l.slug = '1-1'
   and l.unit_id in (
         select u.id from public.units u
           join public.grades g on g.id = u.grade_id
           join public.subjects s on s.id = g.subject_id
          where s.slug = 'mathematics' and g.number = 9 and u.number = 1)
   and not exists (select 1 from public.lesson_versions v where v.lesson_id = l.id);
