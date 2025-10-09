import { createBrowserClient } from '@supabase/ssr';
import { getBrowserRuntimeEnv } from './runtime-env';

// Client-side Supabase client (for components that run in the browser)
// Uses localStorage instead of cookies to avoid third-party cookie issues
export const getSupabaseClient = () => {
  const { supabaseUrl, supabaseAnonKey } = getBrowserRuntimeEnv();

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return null; // Don't use cookies, fall back to localStorage
      },
      set() {},
      remove() {}
    },
    cookieOptions: {
      name: 'rashomon-auth',
      domain: typeof window !== 'undefined' ? window.location.hostname : '',
      path: '/',
      sameSite: 'lax'
    }
  });
};