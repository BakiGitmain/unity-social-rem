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
  quizzes, quiz_questions, profiles, lesson_progress (own rows only). All text is `*_en` / `*_am`; note blocks are JSON (`src/lib/types.ts`).
  RLS: content is public read only and only written by migrations.
- Lesson content source files: `content/lessons/<subject>/grade-<n>/unit-<n>/<slug>.json`,
  turned into migrations by `scripts/lesson-to-sql.mjs` (`--update` for lessons already pushed).
- **Adding a lesson from a PDF: follow [ADD_LESSON.md](ADD_LESSON.md) exactly.**

## Two separate languages
- **Site language** (EN | አማ switch in the header): all website UI (nav, titles, buttons, labels, grade/unit/lesson
  names, empty states, auth pages). Strings: `src/lib/site-i18n.ts` → `t(locale, key)`; DB names via `loc(row, field, locale)`.
  Stored in the `usr-site-lang` cookie (+ localStorage). Server pages get `locale` from params; pass it down as a prop.
- **Notes language** (English | አማርኛ | Both on the study page, `src/lib/use-lang.ts`, localStorage only): lesson
  notes, Main Topics and quiz content. It must never change UI labels; UI never changes notes.

## Study page
- Tabs: Notes (Learn | Read all) · Main Topics · Quiz. Learn mode (`components/study/learn-mode.tsx`) shows one part
  per screen (no quick checks), swipe on touch, and a "Lesson complete!" screen (Start Quiz → focus mode, or Exit to
  the unit). Key-term popovers come from `lessons.glossary`.
- Progress (`src/lib/progress.ts`): % = parts finished ÷ total parts, plus best quiz score. Always in localStorage;
  when logged in also saved to `lesson_progress` via the `save_lesson_progress` RPC (keeps the higher values), and
  merged on login by `<ProgressSync>`. Shown as bars on lesson cards (unit page) and unit cards (grade page).
- The full quiz is lazy-loaded in the browser; the notes are hidden while it runs (focus mode).

## Class schedule
- Tables `class_sections` + `schedule_entries` (public read). Loaded by `getSchedule()` in `src/lib/data.ts`.
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
- `profiles` row is created by the `on_auth_user_created` trigger from the sign-up metadata; usernames can't change.
- The proxy refreshes the Supabase session cookie (only when one exists). The menus read the user in the browser
  (`src/components/user-provider.tsx`), so pages stay static. The site works fully without logging in.

## Design rules
- Keep everything **simple, clean and fast**. It is a private class site: no marketing sections.
- Light, flat, off-white background, soft colour per subject (`src/lib/subjects.ts`), no purple, no heavy shadows.
- **Images: get them online** (Wikimedia Commons, Unsplash, unDraw), freely licensed, stored locally in `public/`,
  with a credit line. Only draw custom SVGs when nothing suitable exists.
- Animations subtle and smooth; respect prefers-reduced-motion. Every route has a matching `loading.tsx` skeleton.

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
2. Run `npm run build` and fix any errors, then start `npm run dev` and tell the user exactly which
   localhost pages to check.
3. **WAIT for the user to say it's good.** Only then commit with a clear message and `git push` (this deploys).

## Never
- `git push` before the user approves.
- Commit `.env.local` or any keys or secrets.
