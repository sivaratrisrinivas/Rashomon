import { createBrowserClient } from '@supabase/ssr';
import { getBrowserRuntimeEnv } from './runtime-env';

// Client-side Supabase client (for components that run in the browser)
// Uses cookies for PKCE flow to avoid cross-domain storage access issues
export const getSupabaseClient = () => {
  const { supabaseUrl, supabaseAnonKey } = getBrowserRuntimeEnv();

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      name: 'sb-auth-token',
      path: '/',
      sameSite: 'lax',
      secure: true
    }
  });
};