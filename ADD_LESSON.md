# ADD_LESSON.md: how to add a lesson

Follow this **exactly** whenever a new PDF is placed in `lessons-inbox/` and the user says **"add this lesson"**.
Never `git push` until the user approves (step 7).

---

## 1. Read the PDF and identify the lesson

- Read the whole PDF (all pages, including any quiz and answer key).
- Write down: **subject** (mathematics | english | geography | history), **grade**, **unit number and title**,
  **section** (e.g. `1.1 The Science of Geography`) and the **lesson number(s)** (e.g. `1.1.1`, `1.1.2`).
- If the PDF covers several numbered sub-topics (1.1.1, 1.1.2, ...), each one becomes **its own lesson**.
- If the user gave the numbering explicitly, use theirs, even if the textbook orders it differently, and tell them about the difference.

## 2. Compare with the official textbook

- **Geography Grade 9:** OLD curriculum textbook:
  https://edumedia-depot.gei.de/bitstreams/52be9cc1-4c7e-4a58-a2c6-e9b3cf8556a7/download
- **Grades 10–12 (all subjects):** NEW MoE textbooks from https://elearn.moe.gov.et
- Other grades/subjects: find the official MoE textbook first; ask the user if it can't be found.

How:
1. Download the textbook PDF into a **new empty folder in the scratchpad** (never into the repo).
2. Extract text: `pdftotext -layout -f <first> -l <last> book.pdf out.txt` and find the matching section.
3. Compare line by line with the notes:
   - **Fill gaps:** definitions, names, dates, sub-fields, lists the notes skipped.
   - **Fix errors:** wrong facts or wording. Where notes and book disagree, follow the book and add a short `keypoint` with `"variant": "note"` that explains the difference (students see both wordings in exams).
   - Add the book's exercise questions and **common exam-style questions** on the topic to the quiz.

## 3. Place it correctly (never duplicate)

- Check what already exists:
  `npx supabase migration list --remote --password "$(grep SUPABASE_DB_PASSWORD .env.local | cut -d= -f2-)"`
  and look in `content/lessons/<subject>/grade-<n>/unit-<n>/`.
- If a lesson with the same code already exists, **do not add it again**. If its content needs fixing, use the update flow (see "Fixing a lesson that is already pushed").
- The unit is created automatically if it is missing (from the `unit` object in the JSON). Use the textbook's unit title.
- Slugs: subject = `geography`, grade = `grade-9`, unit = `unit-1`, lesson = code with dots → dashes (`1.1.1` → `1-1-1`).
- `sort_order` = position of the lesson inside the unit (1, 2, 3, ...).

## 4. Write the content as JSON

Create `content/lessons/<subject>/grade-<n>/unit-<n>/<lesson-slug>.json`. Copy an existing lesson file as the template
(e.g. `content/lessons/geography/grade-9/unit-1/1-1-1.json`). Shape:

```jsonc
{
  "subject": "geography", "grade": 9,
  "unit":   { "number": 1, "slug": "unit-1", "label": {en, am}, "title": {en, am}, "description": {en, am} },
  "lesson": { "code": "1.1.1", "slug": "1-1-1", "sort_order": 1, "minutes": 20,
              "section": { "code": "1.1", "title": {en, am} }, "title": {en, am}, "summary": {en, am} },
  "sections":    [ { "title": {en, am}, "icon": "languages", "blocks": [ ...note blocks... ] } ],
  "main_topics": [ { "title": {en, am}, "points": [ {en, am}, ... ] } ],
  "quiz": { "title": {en, am}, "description": {en, am},
            "questions": [ { "question": {en, am}, "options": [{en, am} x4], "answer": 0, "explanation": {en, am} } ] }
}
```

Every piece of text is a pair `{ "en": "...", "am": "..." }`. Wrap **key terms** in `**double asterisks**` (shown bold in the subject colour).

**Note block types** (`src/lib/types.ts`):

| type | fields | use for |
|---|---|---|
| `heading` | `text` | sub-heading inside a section |
| `paragraph` | `text` | normal explanation, **one or two sentences per block** (keeps "Both" mode readable) |
| `keypoint` | `variant` (`definition` / `important` / `note`), `title`, `text` | definitions, must-know facts, textbook notes |
| `list` | `ordered?`, `items[]` | bullet or numbered points, timelines |
| `table` | `caption?`, `headers[]`, `rows[][]` | comparisons, word tables (every row = same number of cells as headers) |
| `example` | `title`, `text` | worked / real-life examples, exam traps |
| `tip` | `title`, `text` | memory tricks and mnemonics |
| `terms` | `title`, `items[]` | key-word chips |
| `image` | `src`, `width`, `height`, `alt`, `caption?`, `credit`, `creditUrl` | a small supporting image |

Section `icon` must be one of: book-open, languages, quote, sparkles, flask-conical, git-branch, mountain, users,
layers, globe, history, target, lightbulb, scroll-text, compass, map, list-checks.

**Writing rules**
- **Full Notes:** the complete lesson, in clear simple English for Grade 9–12 students. Split into 3–5 sections.
  Use tables for comparisons, at least one `example` and one memory `tip` per lesson where it fits.
- **Main Topics:** 3–5 topic cards, each with 2–5 very short points. Only the most important facts, very easy to understand.
- **Quiz:** **10–20** multiple-choice questions, 4 options each, one correct `answer` (0-based index).
  Every question has a short `explanation` of *why* the answer is right. Mix recall, understanding and exam-style
  questions; vary the position of the correct answer.

**Images (rule: get them online, only draw if nothing suitable exists)**
- Use **freely licensed images from online**: Wikimedia Commons (public domain / CC BY / CC BY-SA) or Unsplash.
- Check the licence on the file page (`.../w/index.php?title=File:NAME&action=raw` shows the licence template).
- Download, convert to WebP (max 900 px wide) with sharp, and save to `public/images/lessons/<name>.webp`
  (local files are faster and never break). Keep images small and supportive: 0–2 per lesson.
- Always fill `credit` (e.g. `Photo: Author · CC BY-SA 4.0 · Wikimedia Commons`) and `creditUrl` (the file page).
- Only if no suitable free image exists, create a simple flat SVG, and say so in the credit.
- The generator refuses images whose file is missing or that have no `creditUrl`.

## 5. Translate to Amharic

- Every `am` field: **accurate, simple Amharic** a Grade 9 student understands. Translate meaning, not word by word.
- Keep key subject terms with the English in brackets: `ሊቶስፌር (Lithosphere)`, `ቦታዊ ሳይንስ (Spatial Science)`.
- Use Ethiopian conventions: `ዓ.ዓ.` for BC, `20ኛው ክፍለ ዘመን`, Ethiopic punctuation `።` `፣` `፦`.
- Use neutral phrasing (no gendered "you"): e.g. `ማወቅ ያስፈልጋል`, `አስቡ`.
- Quiz options that are terms: `ሊቶስፌር (Lithosphere)`.

## 6. Create ONE migration per lesson and push it

```sh
# validate (prints every problem, writes nothing):
node scripts/lesson-to-sql.mjs content/lessons/<subject>/grade-<n>/unit-<n>/<slug>.json > /dev/null

# one migration per lesson:
npx supabase migration new add_<subject>_g<grade>_lesson_<code_with_underscores>
node scripts/lesson-to-sql.mjs content/lessons/.../<slug>.json > supabase/migrations/<the new file>.sql

# push:
npx supabase db push --remote --password "$(grep SUPABASE_DB_PASSWORD .env.local | cut -d= -f2-)"
```

Never edit a migration that has already been pushed. The SQL is generated, so never hand-edit it either.

**Fixing a lesson that is already pushed:** edit its JSON, then create a **new** migration with
`node scripts/lesson-to-sql.mjs --update <file.json> > supabase/migrations/<new file>.sql` and push.
`--update` replaces the lesson's fields, sections and quiz in place.

## 7. Build, run, and wait for approval

1. `npm run build`: must pass with no errors.
2. `npm run dev`, then open and check every new lesson URL:
   `http://localhost:3000/<subject>/grade-<n>/unit-<n>/<lesson-slug>`
3. Tell the user exactly which pages to check (the unit page and each new lesson: Full Notes, Main Topics,
   Quiz, and the English / አማርኛ / Both toggle), plus what was added or corrected from the textbook.
4. **Wait** for the user to say it's good. Only then: commit (content JSON + migration + images) and `git push`.
