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

## 3. Place it correctly (never duplicate, never overwrite)

> **Content can now be edited in the admin dashboard (`/admin/content`).** The database is the source of truth,
> not the JSON files. So: lessons are added by Claude Code through migrations **INSERT only**. Never overwrite an
> existing lesson: it may contain edits made in the admin. Schema changes still go through migrations.

- **Check the current database state first** (not only the JSON files):
  `npx supabase migration list --remote --password "$(grep SUPABASE_DB_PASSWORD .env.local | cut -d= -f2-)"`
  and query the live lessons (public read, anon key):
  `curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/lessons?select=code,title_en,status,updated_at&order=code" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"`
  (drafts are hidden from this query; ask the user if a code seems to be missing). Then look in `content/lessons/<subject>/grade-<n>/unit-<n>/`.
- If a lesson with the same code already exists, **do not add it again**. If its content needs fixing, use the update flow (see "Fixing a lesson that is already pushed").
- The unit is created automatically if it is missing (from the `unit` object in the JSON). Use the textbook's unit title.
- Slugs: subject = `geography`, grade = `grade-9`, unit = `unit-1`, lesson = code with dots → dashes (`1.1.1` → `1-1-1`).
- `sort_order` = position of the lesson inside the unit (1, 2, 3, ...).

## 4. Write the content as JSON (chunked for Learn mode)

Create `content/lessons/<subject>/grade-<n>/unit-<n>/<lesson-slug>.json`. Copy an existing lesson as the template
(e.g. `content/lessons/geography/grade-9/unit-1/1-1-3.json`). Shape:

```jsonc
{
  "subject": "geography", "grade": 9,
  "unit":   { "number": 1, "slug": "unit-1", "label": {en, am}, "title": {en, am}, "description": {en, am} },
  "lesson": { "code": "1.1.1", "slug": "1-1-1", "sort_order": 1, "minutes": 10,
              "section": { "code": "1.1", "title": {en, am} }, "title": {en, am}, "summary": {en, am} },
  "sections": [                     // = the PARTS of Learn mode, one concept per screen
    { "title": {en, am}, "icon": "mountain", "blocks": [ ...2-6 note blocks... ] }
  ],
  "glossary":    [ { "term": {en, am}, "definition": {en, am} } ],   // key-term popovers
  "main_topics": [ { "title": {en, am}, "points": [ {en, am}, ... ] } ],
  "quiz": { "title": {en, am}, "description": {en, am},
            "questions": [ { "question": {en, am}, "options": [{en, am} x4], "answer": 0, "explanation": {en, am} } ] }
}
```

Every piece of text is a pair `{ "en": "...", "am": "..." }`. Wrap **key terms** in `**double asterisks**`.

### Learning-science rules (the generator enforces the numbers)
- **Chunking:** each `sections[]` entry is ONE concept = one Learn-mode screen. **Max 6 blocks** and about
  **3–5 points** per part. A lesson usually has **5–9 parts**. If a part feels long, split it.
- **Short sentences:** one or two sentences per `paragraph` block. Plain words a Grade 9 student knows.
- **No quick checks between parts.** Parts contain only lesson content (the generator rejects a `checks` field).
  Retrieval practice happens in the lesson **quiz**, which students start from the "Lesson complete!" screen.
- **Dual coding:** give every part an `icon`, and use a `points` block (icon + title + short text) whenever a part
  lists 2–6 parallel ideas (spheres, branches, methods...). Only use icons that match the meaning
  (Lithosphere = `mountain`, Hydrosphere = `droplets`, Atmosphere = `wind`). Allowed icons: `src/lib/icon-names.json`.
- **Glossary:** at least 3 entries (usually 8–12): every important term with a one-sentence definition in both
  languages. A term gets a tap/hover popover wherever it appears as `**term**` or as a `points` title.
- **Time:** set `lesson.minutes` to a realistic estimate (≈1–1.5 min per part). Cards show "~N min".
- Use at least one `example` and one memory `tip` per lesson where it fits; Ethiopian examples are best.

**Note block types** (`src/lib/types.ts`):

| type | fields | use for |
|---|---|---|
| `heading` | `text` | rare sub-heading inside a part |
| `paragraph` | `text` | one or two sentences |
| `points` | `items[]: { icon, title, text }` (2–6) | parallel ideas with icons (dual coding) |
| `keypoint` | `variant` (`definition` / `important` / `note`), `icon?`, `title`, `text` | definitions, must-know facts, textbook notes |
| `list` | `ordered?`, `items[]` (max 6) | bullets or a numbered timeline |
| `table` | `caption?`, `headers[]`, `rows[][]` | comparisons; first column = row label (becomes the card title on phones) |
| `example` | `title`, `text` | real-life examples, exam traps |
| `tip` | `title`, `text` | memory tricks and mnemonics |
| `terms` | `title`, `items[]` | key-word chips |
| `image` | `src`, `width`, `height`, `alt`, `caption?`, `credit`, `creditUrl` | a small supporting image (shown 16:10, cover) |

**Main Topics:** 3–5 topic cards, each with 2–5 very short points: only the most important facts.

**Quiz:** **10–20** multiple-choice questions, 4 options each, one correct `answer` (0-based index), each with a short
`explanation` of *why*. Mix recall, understanding and exam-style questions; vary the correct position.

**Images (rule: get them online, only draw if nothing suitable exists)**
- Use **freely licensed images from online**: Wikimedia Commons (public domain / CC BY / CC BY-SA), Unsplash, unDraw.
- Check the licence on the file page (`.../w/index.php?title=File:NAME&action=raw` shows the licence template).
- Pick images that still read well cropped to **16:10** (landscape). Avoid tiny or round portraits.
- Download, convert to WebP (max 900 px wide) with sharp, save to `public/images/lessons/<name>.webp`.
  0–2 images per lesson. Always fill `credit` and `creditUrl` (the file page).
- **Never delete an image file a pushed migration still uses** until the new migration is live and deployed.

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

**Fixing a lesson that is already pushed:** prefer the admin editor (`/admin/content/lessons/<id>`), which keeps version
history. `--update` (`node scripts/lesson-to-sql.mjs --update <file.json>`) still exists for lessons nobody edited in the
admin, but the generated SQL **refuses to run** if the lesson has admin versions or a draft (so admin edits are never lost).
Never write migrations that update or delete lesson content by hand.

## 7. Build, run, and wait for approval

1. `npm run build`: must pass with no errors.
2. `npm run dev`, then open and check every new lesson URL:
   `http://localhost:3000/<subject>/grade-<n>/unit-<n>/<lesson-slug>`
3. Tell the user exactly which pages to check (the unit page and each new lesson: Learn mode → "Lesson complete!" → Start Quiz,
   Read all, key-term popovers, Main Topics, Quiz, the notes toggle English / አማርኛ / Both, and the site language
   switch), plus what was added or corrected from the textbook.
4. **Wait** for the user to say it's good. Only then: commit (content JSON + migration + images) and `git push`.
