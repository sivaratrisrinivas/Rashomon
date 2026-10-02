-- Rashomon schema, row level security and helpers.
-- Idempotent: safe to run on an existing project created by hand.

create extension if not exists pgcrypto;

-- Profiles: one row per auth user, created automatically on sign up.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  reading_preferences text[] not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Content: articles (by normalized URL) and OCR'd uploads (by text hash).
create table if not exists public.content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  source_type text not null check (source_type in ('url', 'upload')),
  source_info text not null,
  processed_text text not null,
  created_at timestamptz not null default now()
);
-- Not unique: older projects may already hold duplicates. The API checks before inserting.
create index if not exists content_source_idx on public.content (source_type, source_info);

-- Highlights: a passage someone selected to discuss.
create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  content_id uuid not null references public.content (id) on delete cascade,
  highlighted_text text not null,
  surrounding_context text,
  start_index integer,
  end_index integer,
  created_at timestamptz not null default now()
);
create index if not exists highlights_content_idx on public.highlights (content_id);

-- Chat sessions: one per passage (highlight) or per article (content).
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references public.content (id) on delete cascade,
  highlight_id uuid references public.highlights (id) on delete cascade,
  participants uuid[] not null default '{}',
  transcript jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (content_id is not null or highlight_id is not null)
);
-- These make "two readers open the same chat at once" resolve to one session.
-- If they fail on an old project, merge duplicate sessions for the same passage first.
create unique index if not exists chat_sessions_highlight_unique on public.chat_sessions (highlight_id) where highlight_id is not null;
create unique index if not exists chat_sessions_content_unique on public.chat_sessions (content_id) where highlight_id is null;

-- Atomic append: concurrent messages can no longer overwrite each other.
create or replace function public.append_chat_message(p_session_id uuid, p_entry jsonb, p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.chat_sessions
     set transcript = transcript || jsonb_build_array(p_entry),
         participants = case when p_user_id = any (participants) then participants else participants || p_user_id end
   where id = p_session_id;
$$;
revoke all on function public.append_chat_message(uuid, jsonb, uuid) from public, anon, authenticated;

-- Row level security. The API uses the service role (bypasses RLS) and does
-- its own authorization; these policies protect direct browser access with
-- the anon key.
alter table public.profiles enable row level security;
alter table public.content enable row level security;
alter table public.highlights enable row level security;
alter table public.chat_sessions enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Shared reading is the point of the app: signed-in readers can read content,
-- highlights and past discussions, but every write goes through the API.
drop policy if exists "signed-in read content" on public.content;
create policy "signed-in read content" on public.content for select to authenticated using (true);
drop policy if exists "signed-in read highlights" on public.highlights;
create policy "signed-in read highlights" on public.highlights for select to authenticated using (true);
drop policy if exists "signed-in read sessions" on public.chat_sessions;
create policy "signed-in read sessions" on public.chat_sessions for select to authenticated using (true);

-- Storage: users may only upload to and read from their own folder.
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false) on conflict (id) do nothing;
drop policy if exists "own uploads insert" on storage.objects;
create policy "own uploads insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own uploads read" on storage.objects;
create policy "own uploads read" on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
