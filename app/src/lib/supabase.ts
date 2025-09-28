import { createBrowserClient } from '@supabase/ssr';

// Client-side Supabase client (for components that run in the browser)
export const getSupabaseClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};