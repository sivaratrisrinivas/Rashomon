import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServerRuntimeEnv } from './runtime-env';

// Server-side Supabase client (for Server Components and API routes)
export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getServerRuntimeEnv();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          cookieStore.set(name, value, options);
        } catch {
          // Silently handle cookie setting errors
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          cookieStore.set(name, '', options);
        } catch {
          // Silently handle cookie removal errors
        }
      },
    },
  });
};
