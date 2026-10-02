# Rashomon

Read the same article as someone else, highlight a passage, and talk about it in a live five-minute room. Afterwards the transcript stays attached to the passage, so the next reader can replay how other people read it.

The name comes from Kurosawa's film: one event, several honest accounts.

## How it works

1. Sign in with email and password (Google sign-in is available behind a build flag) and pick a few reading interests.
2. Import a web article by URL, or upload an image or PDF (OCR through the Gemini API free tier).
3. Read. Select a passage and choose "Discuss this".
4. If another reader is on an overlapping passage, you are both dropped into a realtime chat (Supabase Realtime presence and broadcast). The room lasts five minutes.
5. The transcript is saved against the passage and shows up as Perspective Replay for later readers.

## Getting a second reader into the room

A realtime room is useless with one person in it, so the product work in this repo is about shrinking the time from "I found something" to "a friend is reading it with me":

- **Invite a reader.** The reading view has a button that copies a link to that exact text. Signed-out friends go through sign-in (and onboarding if they are new) and land back on the same page, not the dashboard.
- **Bookmarklet.** The import panel has a "Read on Rashomon" link you drag to the bookmarks bar. Clicking it on any article opens Rashomon and imports that page.
- **Deep link.** `/dashboard?url=<article>` imports the article right away. The bookmarklet uses it, and it works from any share sheet or chat message. Only http and https URLs are accepted.
- Two people importing the same URL reuse the same content row, so they can find each other.

The redirect target after login is limited to same-site paths, so the `next` parameter can't be used as an open redirect.

## Security model

- **The API trusts the Supabase access token, never the request body.** Every endpoint reads the user from `Authorization: Bearer <token>`. Older versions accepted a `userId` in the body, which let anyone write as anyone.
- **CORS is an explicit allowlist** from `ALLOWED_ORIGINS`. There are no wildcard hosting domains.
- **URL import is SSRF-hardened.** It resolves DNS and refuses private, loopback, link-local, CGNAT and metadata addresses (IPv4 and IPv6, including mapped forms). It follows redirects by hand and re-checks every hop, and it enforces a timeout, a 5 MB cap and an HTML or text content type. Residual risk: a DNS-rebinding race between the check and the connect.
- **Uploads are scoped.** `/content/upload` only accepts storage paths inside the caller's own folder.
- **Chat messages are appended atomically** through the `append_chat_message` database function, so concurrent senders don't overwrite each other.
- **Rate limits** are applied per user and per client IP. Error responses are generic and the details go to the server logs.
- **Row Level Security** policies for every table and the `uploads` bucket live in `supabase/migrations/`.

## Layout

```
api/   Bun + Elysia API
  index.ts           wiring: env, Supabase client, Gemini OCR, CORS, listen
  src/ocr.ts         Gemini OCR: file type check by magic bytes, retries, size cap
  src/app.ts         createApp(deps): routes, auth, validation, rate limits
  src/ssrf.ts        public-URL checks and safe fetch
  src/extract.ts     article text extraction
  tests/             bun tests against an in-memory Supabase fake
app/   Next.js 15 frontend
  src/lib/api.ts     apiFetch: attaches the session token
  src/lib/share.ts   invite links, bookmarklet, deep links, safe redirects
supabase/migrations/ schema, indexes, RLS, storage policies, append function
```

## Running locally

You need Bun 1.1 or newer, a Supabase project and, for OCR, a free Gemini API key from Google AI Studio (no billing needed).

1. Apply the schema: `supabase db push`, or paste `supabase/migrations/20261003000000_schema_rls.sql` into the SQL editor. It is idempotent. On an older project that already has duplicate chat sessions for the same passage, merge those first, because the unique indexes will refuse to build.
2. API (`api/.env`):
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   GEMINI_API_KEY=...                     # optional; without it image uploads fail and URL import still works
   GEMINI_OCR_MODEL=gemini-2.5-flash      # optional
   ALLOWED_ORIGINS=http://localhost:3000
   ```
   `cd api && bun install && bun run dev` starts it on port 3001.
3. App (`app/.env.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_API_URL=http://localhost:3001
   SITE_URL=http://localhost:3000
   ```
   `cd app && bun install && bun run dev` starts it on port 3000.
4. In Supabase Auth, enable the email provider. To skip confirmation emails (the built-in Supabase mailer only delivers to your own team), turn on auto-confirm. For Google sign-in, configure the Google provider, add `<site>/auth/callback` to the redirect URLs and build the app with `NEXT_PUBLIC_GOOGLE_AUTH=true`.

## Tests

- `cd api && bun test` runs 41 tests covering auth, ownership, validation, CORS, rate limits, the atomic message append, Gemini OCR (file type checks, retries, key never in the URL), and SSRF (private ranges, IPv6, redirects to internal hosts, size and type limits). Line coverage is about 98%.
- `cd app && npx jest` runs 32 tests, including email sign-in, the invite, bookmarklet, deep-link and safe-redirect helpers.
- `cd app && bun run lint && bun run build`.

CI runs all of these on every push and pull request. The Cypress specs in `app/cypress` need a running app and a real Supabase project, so they are not part of CI.

## Deployment

Live, all on free tiers:

- App: https://rashomon-ii0a.onrender.com (Next.js on Render free)
- API: https://rashomon-api.onrender.com/health (Bun + Elysia in Docker on Render free)
- Database, auth, realtime and storage: Supabase free project with the migration in `supabase/migrations/` applied

Free Render services sleep after 15 minutes without traffic, so the first request after a quiet spell takes up to a minute. `render.yaml` describes both services and `DEPLOYMENT.md` has the steps.
