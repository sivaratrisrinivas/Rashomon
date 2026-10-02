# Deploying Rashomon on free tiers

Everything here runs on free plans: Supabase (database, auth, realtime, storage), Render (API and app) and the Gemini API free tier (OCR). No billing account is needed anywhere.

## 1. Supabase

1. Create a project on the free plan.
2. Apply `supabase/migrations/20261003000000_schema_rls.sql` (`supabase db push`, or paste it into the SQL editor). It creates the tables, RLS policies, the `uploads` bucket and the `append_chat_message` function.
3. Auth settings:
   - Enable the email provider and set a minimum password length of 8.
   - The built-in mailer only delivers to members of your Supabase team, so either turn on auto-confirm or connect your own SMTP.
   - Set Site URL to the app URL and add `<app>/**` to the redirect allow list.
   - Google sign-in is optional. It needs a Google Cloud OAuth client, the Google provider enabled in Supabase, and the app built with `NEXT_PUBLIC_GOOGLE_AUTH=true`.

## 2. Gemini key (OCR)

Create a key at https://aistudio.google.com/apikey. The free tier is enough for image and PDF uploads. Without a key, URL import still works and uploads return an error.

## 3. Render

`render.yaml` is a Blueprint for both services (free instances, Singapore region):

| Service | Root | Runtime | Env |
|---|---|---|---|
| `rashomon-api` | `api` | Docker (`api/Dockerfile`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ALLOWED_ORIGINS` |
| `rashomon` | `app` | Node (Next.js standalone) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`, `SITE_URL`, `HOSTNAME=0.0.0.0` |

`ALLOWED_ORIGINS` is an exact, comma-separated list of app origins. Wildcards are not supported on purpose.

The app also builds on Vercel (root directory `app`, framework Next.js) with the same `NEXT_PUBLIC_*` variables. If you add a Vercel URL, add it to `ALLOWED_ORIGINS` and to the Supabase redirect allow list.

## 4. Check it

- `GET <api>/health` returns `{"status":"healthy","database":"connected"}`.
- Create an account on `<app>/login`, pick interests, import an article by URL, highlight a passage and open the discussion.

Free Render instances sleep after 15 minutes idle; the first request afterwards takes up to a minute.
