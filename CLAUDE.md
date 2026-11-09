@AGENTS.md

# Unity Social Rem

A study website.

## Stack
- Next.js (App Router), TypeScript, Tailwind CSS. App code lives in `src/` (`src/app`, `src/lib`); the `@/*` import alias maps to `./src/*`.
- Supabase for the database and auth. Use the clients in `src/lib/supabase/`:
  - `client.ts` for Client Components (browser)
  - `server.ts` for Server Components, Server Functions and Route Handlers (`await createClient()`)
- Hosted on Vercel.

## GitHub & deploys
- Repo: `BakiGitmain/unity-social-rem`, default branch `main`.
- Pushing to `main` auto-deploys to production on Vercel.

## Supabase
- Project ref: `gqzlbkhlyrkuillyljep` (already linked via `supabase/`).
- Make database changes **only** through migrations:
  1. `npx supabase migration new <name>`
  2. Write the SQL in the new file under `supabase/migrations/`
  3. `npx supabase db push --password "$(grep SUPABASE_DB_PASSWORD .env.local | cut -d= -f2-)"`
- Always enable RLS on new tables (`alter table ... enable row level security;`) and add policies for them.
- Never edit migrations that have already been pushed. Write a new migration instead (check with `npx supabase migration list`).

## Environment variables
- Add each new variable to `.env.local` **and** to Vercel for all three environments:
  ```sh
  printf 'VALUE' | vercel env add NAME production
  printf 'VALUE' | vercel env add NAME preview
  printf 'VALUE' | vercel env add NAME development
  ```
- Only `NEXT_PUBLIC_` variables reach the browser.
- Never expose the Supabase service_role/secret key: no `NEXT_PUBLIC_` prefix, never in client code.

## Workflow: after finishing any task
1. Run `npm run build` and fix any errors.
2. Commit with a clear message.
3. `git push` (this deploys to production).

## Never
- Commit `.env.local` or any keys or secrets.
