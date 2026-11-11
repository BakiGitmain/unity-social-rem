@AGENTS.md

# Unity Social Rem

A private study website for a class: notes, quick-revision topics and quizzes for Ethiopian secondary students,
in English, Amharic, or both.

## Stack
- Next.js (App Router, Cache Components on), TypeScript, Tailwind v4, framer-motion, lucide-react.
  App code lives in `src/` (`src/app`, `src/lib`, `src/components`); the `@/*` alias maps to `./src/*`.
- Supabase for the database. Clients in `src/lib/supabase/`:
  - `public.ts`: cookie-less client for cached public content reads on the server (used by `src/lib/data.ts`)
  - `client.ts`: Client Components (browser), e.g. the lazy-loaded quiz
  - `server.ts`: Server Components / Server Functions / Route Handlers that need the user's cookies
- Hosted on Vercel.

## Structure
- Subjects (only 4): mathematics, english, geography, history. Subject → Grade → Unit → Lesson.
- Routes live under `src/app/[locale]/` (`en` | `am`): `/[locale]/[subject]/[grade]/[unit]/[lesson]`, plus
  `/[locale]/login` and `/[locale]/signup`. Visitors never see the locale: `src/proxy.ts` rewrites
  `/geography` → `/en/geography` (or `/am/...`) from the `usr-site-lang` cookie. Links are written WITHOUT a locale.
- Tables: subjects, grades, units, lessons (+ `glossary`), lesson_sections (= Learn-mode parts),
  quizzes, quiz_questions, profiles (+ private `profiles_private`: role, last_seen_at, ai_daily_limit), lesson_progress,
  quiz_attempts, events, ai_usage, ai_chats, ai_feedback, ai_moderation_log, app_settings, announcements,
  schedule_overrides, lesson_drafts, lesson_versions, admin_audit_log. All text is `*_en` / `*_am`; note blocks are JSON (`src/lib/types.ts`).
  RLS: content is public read (drafts hidden) and written ONLY by migrations (new lessons, INSERT only) or by admins
  (`is_admin()` policies). Content items have `status`: published | draft (admins only) | coming_soon (listed, not openable).
- Lesson content source files: `content/lessons/<subject>/grade-<n>/unit-<n>/<slug>.json`, turned into migrations by
  `scripts/lesson-to-sql.mjs`. **The database is the source of truth now** (lessons may be edited in the admin):
  check the DB before adding, INSERT only, never overwrite an existing lesson (`--update` refuses admin-edited lessons).
- **Adding a lesson from a PDF: follow [ADD_LESSON.md](ADD_LESSON.md) exactly.**

## Two separate languages
- **Site language** (EN | አማ switch in the header): all website UI (nav, titles, buttons, labels, grade/unit/lesson
  names, empty states, auth pages). Strings: `src/lib/site-i18n.ts` → `t(locale, key)`; DB names via `loc(row, field, locale)`.
  Stored in the `usr-site-lang` cookie (+ localStorage). Server pages get `locale` from params; pass it down as a prop.
- **Notes language** (English | አማርኛ | Both on the study page, `src/lib/use-lang.ts`, localStorage only): lesson
  notes, Main Topics and quiz content. It must never change UI labels; UI never changes notes.

## Study page
- Tabs: Full Notes (Learn | Read all) · Main Topics · Homework (only if the lesson has `homework`) · Quiz. Learn mode (`components/study/learn-mode.tsx`) shows one part
  per screen (no quick checks), swipe on touch, and a "Lesson complete!" screen (Start Quiz → focus mode, or Exit to
  the unit). Key-term popovers come from `lessons.glossary`.
- Progress (`src/lib/progress.ts`): % = parts finished ÷ total parts, plus best quiz score. Always in localStorage;
  when logged in also saved to `lesson_progress` via the `save_lesson_progress` RPC (keeps the higher values), and
  merged on login by `<ProgressSync>`. Shown as bars on lesson cards (unit page) and unit cards (grade page).
- The full quiz is lazy-loaded in the browser; the notes are hidden while it runs (focus mode).

## Math toolkit (all math lessons)
- Math is DATA, never images: inline LaTeX in `$…$` in any text (KaTeX: `components/math/tex.tsx`, also in Rem chat via
  remark-math + rehype-katex). Block types `venn` (interactive SVG, 2/3 sets, shading = set expression, "Show me" steps,
  tap a region for its elements) and `worked` (paper mode, Kalam font, one step at a time, "Why?", highlighted answer,
  optional Venn per step). Pure logic + tests in `src/lib/math/`: `venn.ts` (regions A, AB, ABC, none… from expressions),
  `sets.ts` (set answers: order/duplicates/spaces ignored, ∅ or { }, friendly feedback), `calc.ts` (safe calculator).
- Homework (`lessons.homework` jsonb): items with tip → hints → full paper-mode solution, answer boxes
  (choice | number | set | venn), mark done, progress % (`src/lib/homework-progress.ts`: localStorage + `homework_progress`).
- Quiz kinds: `quiz_questions.kind` (choice | number | set | venn) + `answer` jsonb + `steps`. Scored IN SQL by
  `quiz_answer_correct()` (set values canonical: sorted, normalized). Tools: math keyboard (`math-input.tsx`, tap or
  drag symbols), calculation paper + calculator inside every question card. Admin editor supports all of it (`math-editors.tsx`).

## Question card (Homework, Extra practice, Quiz) + Answer Paper
- ONE card for every question: `components/questions/question-card.tsx`, model `src/lib/questions.ts` (`fromHomework`,
  `fromQuiz`; type choice | written | venn | open, labelled parts). Choice = big options; written = `written-answer.tsx`
  (one labelled line per part, ONE Check, "x / n parts correct"); venn = shade mode, one Check (no AI). In every card:
  calculation paper (`ink/scratch-paper.tsx`, never sent to the AI) + calculator. Quiz: one attempt, explanation after.
- Written answers: typing into the labelled lines is the DEFAULT (math keyboard); "Write by hand" (remembered per device)
  = one Answer Paper with the labels printed on it (desktop: label left of the line; phone: label above a full-width
  line, full-screen writing sheet). Ink = vector data (`src/lib/ink/model.ts`), perfect-freehand (`render.ts`), IndexedDB
  (`store.ts`); engine `ink-canvas.tsx` (pen/highlighter/eraser tap+scribble/shapes/smart shapes/symbols, 2 fingers
  pan-zoom, Pen only), tools `ink-editor.tsx`.
- Check → the whole worksheet (labels included) cropped, black on white → `/api/handwriting` → the model READS every line
  in ONE call (low detail, temperature 0, strict JSON `RECOGNITION_PARTS_SCHEMA`; correct answers are NEVER sent) → our
  checkers grade each line. Cached by ink hash (IndexedDB + server memory). Confidence < 0.8 → "Did I read that right?";
  per-line "Fix it" / "Did I read it wrong?". Limits: login, 60 reads / user / day, own switch (`app_settings.ai.ink_*`,
  Admin → AI tutor); `start_ink_check()` + `record_ink_tokens()` count in `ai_usage` (cost chart + monthly budget).
  Off / limit / logged out → typing with a note. Images ≤ 200 KB, never logged. Live test: `npm run test:ink`.

## AI study tutor "Rem" ✨
- **OpenAI is ONLY for the student chat tutor.** Never use it to write lesson notes: lessons are always added by hand (ADD_LESSON.md).
  Never print, log or commit `OPENAI_API_KEY`. The model is the `OPENAI_MODEL` env var (now `gpt-6-luna`, change it in Vercel, no code change).
- Server: `src/app/api/tutor/route.ts` (the only place that calls OpenAI). It uses the Vercel AI SDK v7 (`ai`, `@ai-sdk/openai`) with
  streaming. Order: per-IP burst limit (`src/lib/tutor/burst.ts`, 5 req / 10 s, in memory) → login required (401) →
  `start_ai_message` RPC (kill switch, monthly budget, per-user limit, model + prompt overrides from `app_settings.ai`,
  logs an `ai_message` event) + OpenAI moderation (free, fails open; blocked → `ai_moderation_log`) + lesson, in parallel
  → `streamText` → `record_ai_tokens` (tokens + searches for the cost estimate; capped, once per counted message).
- Prompt: `src/lib/tutor/prompt.ts`: a short **stable** system prompt (prompt caching; no per-request text in it), then
  `buildContext()` = subject/grade/unit/lesson + the CURRENT part in full + the lesson's KEY TERMS and summary (compact),
  so questions about other parts get the lesson's meaning (not dictionary meanings). Admins can override the prompt
  in /admin/ai (versions in `ai_prompt_versions`). Answers: 2–3 short sentences + ONE example (~50–70 words).
- Cost rules (all in `src/lib/tutor/config.ts`): 350 max output tokens (600 for Amharic answers, which need ~3× tokens),
  last 8 messages only, history sent as text only, user messages ≤ 800 chars, `reasoningEffort: "none"`, `store: false`.
  Tools are only sent when needed (each adds hidden tokens + latency): the quiz tool only for quiz intent (`QUIZ_RE` or
  the 🎯 chip), web search (`openai.tools.webSearch`, $10 / 1k calls) only when `SEARCH_RE` matches (latest, current,
  years…) and the admin allows it, max 3 per user per day. Sources go to the UI as `source-url` parts.
  Live-tested: ~1.5–2 s to first token, ≈ $0.02–0.05 per 100 questions.
- "Quiz me": `intent: "quiz"` forces the `quiz_question` tool (structured JSON: question, 4 options, answer, explanation),
  rendered as tappable buttons. Answers end with a `FOLLOWUPS: a | b | c` line that the UI turns into chips.
- Limits (defaults, editable in /admin/ai; per-user override in /admin/users): 30 questions + 3 web searches per user
  per **Addis Ababa day** (`ai_usage`, written only by SECURITY DEFINER functions; `my_ai_status()` for the counter).
  Monthly budget: at 100% `ai_status()` reports unavailable → "Rem is resting". Chats are saved per lesson in
  `ai_chats` (own rows, last 40 messages); 👍/👎 go to `ai_feedback` (Admin → AI tutor → Feedback inbox).
- Test it live with a real account: create a test student, sign in with `@supabase/ssr` and POST to `/api/tutor`
  (see `tests/security.test.mjs` for how to sign in from a script).
- UI (`src/components/tutor/`): `tutor.tsx` (mounted by StudyView) = draggable `bubble.tsx` (snaps to the left/right edge,
  position in localStorage, fades to 30% after 10 s idle, one-time tooltip) + `selection-pill.tsx` ("Explain further" /
  "In Amharic" for 3–300 selected characters inside `[data-tutor-notes]`) + `chat-panel.tsx` (lazy-loaded on first use:
  desktop panel 400×600, mobile bottom sheet 85% with swipe-down). Shown only on Learn mode, Read all and Main Topics;
  hidden in the quiz, focus mode and on the "Lesson complete!" screen. UI labels come from `site-i18n.ts`.

## Class schedule
- Tables `class_sections` + `schedule_entries` + `schedule_overrides` (public read, admin write). Loaded by `getSchedule()`.
- Date overrides (cancel, room change, extra class, exam, holiday) are applied by `src/lib/time/overrides.ts`
  (`planForDate`, `scheduleStatusOn`, tested in `overrides.test.ts`) in the Today card and the schedule page.
- ALL time logic is in pure, tested modules under `src/lib/time/` (run `npm test`): `clock.ts` (Addis Ababa time,
  always UTC+3 whatever the device zone; 12h / 24h / Ethiopian clock), `ethiopian.ts` (Ethiopian calendar),
  `schedule.ts` (current/next class, breaks, stats). Never use the device time zone for schedule logic.
- UI: Today card on the home page (`components/schedule/today-card.tsx`), `/schedule` page (day timeline, week grid,
  stats), `.ics` export at `/api/schedule.ics?lang=en|am`. Clock format is remembered in localStorage.
- Dev only: `?now=2026-11-11T14:45` fakes the current Addis Ababa time (kept for the tab while navigating; `?now=off` clears it).

## Navigation & auth
- Desktop header: logo · Home · Schedule · (EN | አማ, profile dropdown with letter avatar). Mobile: slim header
  (logo, EN | አማ) + floating bottom tab bar (Home, Schedule, Profile → bottom sheet). Files: `src/components/site-header.tsx`, `src/components/nav/*`.
- Accounts are username + password. Supabase Auth needs an email, so `<username>@users.unitysocialrem.app` is used
  internally (no inbox; "Confirm email" is OFF). Users only see `@username`. Rules: `src/lib/auth/username.ts`
  (3–20 chars `a-z 0-9 _`, password ≥ 6, simple is fine).
- Server actions: `src/lib/auth/actions.ts` (logIn, signUp, logOut). Generic errors only ("Wrong username or password").
- `profiles` + `profiles_private` rows are created by the `on_auth_user_created` trigger; only admins can rename a user
  (Admin → Users, which also updates the login email). Admins see an "Admin dashboard" item in the profile menu.
- The proxy refreshes the Supabase session cookie (only when one exists). The menus read the user in the browser
  (`src/components/user-provider.tsx`), so pages stay static. The site works fully without logging in.

## Admin dashboard (`/admin`) & security
- Root layout `src/app/admin/layout.tsx` (English UI, noindex). Pages in `src/app/admin/**` (server: load data with
  the admin's own session, RLS + `is_admin()`), client views in `src/components/admin/pages/*`, shared UI in
  `src/components/admin/*` (DataTable, charts (Recharts), dialogs, toasts, shell with sidebar + Ctrl/Cmd+K palette).
  Server actions in `src/lib/admin/actions/*`, loaders in `src/lib/admin/queries.ts`.
- **Roles** live in `profiles_private.role` ('student' | 'admin'), NOT in public `profiles` (public-read). New users are
  always 'student' (trigger). Nobody can change their OWN role; only admins can change others (RLS + trigger guard).
  First admin: `@eyosiyas` (migration `admin_security`).
- `has_admin_role()` = role only. `is_admin()` = role **and an AAL2 (2FA) session** (JWT `aal`). Every admin RLS
  policy and admin SQL function uses `is_admin()`, so even the database refuses admin data without 2FA.
- **Three layers, never trust the client:**
  1. `src/proxy.ts`: `/admin/**` → non-admins get a real 404 (rewrite to the site not-found); idle > 30 min → signed out
     (`usr-admin-active` cookie, sliding window); `X-Robots-Tag: noindex`.
  2. Admin layout `AdminGate` (`getAdminGate()`): 404 for non-admins; admin without AAL2 → only the 2FA screen.
  3. EVERY admin server action uses `adminAction()` → `requireAdmin()` → `checkAdmin()` (verified JWT + `is_admin()` RPC)
     and writes the audit log. Every admin page calls `requireAdmin()` too. Decision logic: `src/lib/admin/access.ts`.
- **2FA**: Supabase MFA TOTP. First visit to /admin = enrollment (QR + key + verify); then a 6-digit code each session.
  **Lost authenticator?** Create a NEW migration with
  `delete from auth.mfa_factors where user_id = (select id from public.profiles where username = 'eyosiyas');`
  push it, log in and open /admin to enroll again.
- **Secret key** (`SUPABASE_SECRET_KEY`): only in `src/lib/supabase/admin.ts` (`import "server-only"`), only for
  auth-admin operations (ban, delete user, set password, rename login email) AFTER `requireAdmin()`. Never log it.
- **Audit log** `admin_audit_log`: written only via `log_admin_action()` (admin_id = caller), admin read-only, update /
  delete / truncate blocked by triggers. Log every admin action (`ctx.audit(...)`). Viewing a student's chat is logged.
- **Dangerous actions** (delete user, ban, role, maintenance, AI off, discard/restore, delete schedule items) use
  `ConfirmDialog` = type the username/name to confirm; delete-user re-checks the typed name on the server.
- **Activity tracking** (first-party): `events` (lesson_view, lesson_complete, quiz_start, quiz_finish, ai_message,
  signup, login), `quiz_attempts` (score computed IN SQL from the answers), `profiles_private.last_seen_at` (≤ 1 write /
  5 min). Written only through SECURITY DEFINER functions called from server code (`/api/track`, auth actions, the
  tutor route); they always use `auth.uid()`. Admin read only.
- **Settings** `app_settings`: public keys `site`, `maintenance`, `features` (read in the browser by
  `<SiteSettingsProvider>` and by the proxy, 15 s memory cache); private key `ai`. Maintenance mode rewrites student
  pages to `/[locale]/maintenance` (503) in the proxy; admins pass. Feature flags are enforced on the server too
  (proxy for schedule, signUp action, tutor route via `ai_status()`).
- **Content editing**: lesson editor (`lesson-editor.tsx`, `block-editor.tsx`) autosaves to `lesson_drafts`; Publish
  calls `admin_save_lesson()` (one transaction: snapshot → `lesson_versions`, update lesson/parts/questions keeping
  their ids, audit). Images go to Storage bucket `media` (public read, admin write). Status changes apply at once.
  After content changes call `updateTag("content")` (server actions only) so cached public pages refresh.
- **Announcements** (`announcements`, RLS filters live window + audience) show via `<AnnouncementBanner>`; dismissals in localStorage.
- **Instant updates**: every admin write goes through `adminAction()`, which calls `revalidatePath("/admin", "layout")`
  after success (the action response carries the fresh page data); read-only actions pass `{ revalidate: false }`.
  Student-facing content changes also call `updateTag("content")`. Client lists use React `useOptimistic` (pure
  reducers in `src/lib/admin/optimistic.ts`): the change shows at once, rolls back automatically + error toast if the
  action fails. Lists animate items out (DataTable rows, schedule, announcements). Don't add `router.refresh()` after
  actions. Local state that mirrors props uses `useServerState()` (src/components/live.tsx).
- **Live updates** (`src/components/live.tsx`, logic in `src/lib/live/controller.ts`, tested): `useRealtime` (Supabase
  Realtime, RLS-filtered; tables in the `supabase_realtime` publication: events, profiles, ai_feedback, announcements,
  app_settings, schedule_overrides, schedule_entries), `usePolling` (60 s) and `useLiveRefresh` (both → quiet
  `router.refresh()`). All pause while the tab is hidden and clean up on unmount. Admin header shows "● Live · Updated …".
- **Never read the clock while prerendering**: in server code call `await connection()` first (`requireAdmin`,
  `getAdminGate`, `requestNow()`); in client components use `<TimeAgo>` / `useNowMs()` (only set after mount).
  `fmtDate` is deterministic (no Intl) to avoid hydration mismatches.
- **Tests**: `npm test` (time, live controller, optimistic lists), `npm run test:security` and `npm run test:e2e`
  (both need `npm run dev`; e2e drives headless Edge/Chrome via puppeteer-core): temporary users are created with the
  secret key and deleted afterwards. Security: student/AAL1/AAL2 access over the DB and HTTP + every admin page renders.
  E2E: zero console errors/warnings on every page, and a deleted user disappears from the list without a reload.
  Debug the dev overlay with the built-in MCP: POST `/_next/mcp` `tools/call` `get_errors`.

## Design rules
- Keep everything **simple, clean and fast**. It is a private class site: no marketing sections.
- Light, flat, off-white background, soft colour per subject (`src/lib/subjects.ts`), no purple, no heavy shadows.
- **Images: get them online** (Wikimedia Commons, Unsplash, unDraw), freely licensed, stored locally in `public/`,
  with a credit line. Only draw custom SVGs when nothing suitable exists.
- Animations subtle and smooth; respect prefers-reduced-motion. Every route has a matching `loading.tsx` skeleton.
- Inputs never show the browser's focus outline (globals.css); their wrapper shows a soft ring instead. Text
  selection must stay clearly visible. Don't use flag emojis (Windows shows "ET"); use icons.

## GitHub & deploys
- Repo: `BakiGitmain/unity-social-rem`, default branch `main`. Pushing to `main` auto-deploys to production on Vercel.

## Supabase
- Project ref: `gqzlbkhlyrkuillyljep` (already linked via `supabase/`). The CLI targets the LOCAL db unless you pass `--remote`.
- Make database changes **only** through migrations:
  1. `npx supabase migration new <name>`
  2. Write the SQL in the new file under `supabase/migrations/`
  3. `npx supabase db push --remote --password "$(grep SUPABASE_DB_PASSWORD .env.local | cut -d= -f2-)"`
- Check state: `npx supabase migration list --remote --password "$(grep SUPABASE_DB_PASSWORD .env.local | cut -d= -f2-)"`
- Always enable RLS on new tables and add policies for them.
- Never edit migrations that have already been pushed; write a new migration instead.

## Environment variables
- Add each new variable to `.env.local` **and** to Vercel for all three environments:
  ```sh
  printf 'VALUE' | vercel env add NAME production
  printf 'VALUE' | vercel env add NAME preview
  printf 'VALUE' | vercel env add NAME development
  ```
- Only `NEXT_PUBLIC_` variables reach the browser.
- Never expose the Supabase service_role/secret key: no `NEXT_PUBLIC_` prefix, never in client code.

## Workflow for every task
1. Write migrations (if any) and push them to Supabase.
2. Run `npm run build`, `npm test` (and `npm run test:security` when auth/admin/RLS changed) and fix any errors, then start `npm run dev` and tell the user exactly which
   localhost pages to check.
3. **WAIT for the user to say it's good.** Only then commit with a clear message and `git push` (this deploys).

## Never
- `git push` before the user approves.
- Commit `.env.local` or any keys or secrets.
