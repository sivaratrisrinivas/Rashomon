import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServerRuntimeEnv } from './runtime-env';

// Server-side Supabase client (for Server Components and API routes)
export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getServerRuntimeEnv();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Silently handle cookie setting errors
        }
      },
    },
  });
};
