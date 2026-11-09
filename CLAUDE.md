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
- Routes: `/[subject]/[grade]/[unit]/[lesson]`, e.g. `/geography/grade-9/unit-1/1-1-1`.
- Tables: subjects, grades, units, lessons, lesson_sections, quizzes, quiz_questions. All text is `*_en` / `*_am`;
  note blocks are JSON (`src/lib/types.ts`). RLS: public read only; content is only written by migrations.
- Lesson content source files: `content/lessons/<subject>/grade-<n>/unit-<n>/<slug>.json`,
  turned into migrations by `scripts/lesson-to-sql.mjs`.
- **Adding a lesson from a PDF: follow [ADD_LESSON.md](ADD_LESSON.md) exactly.**

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
