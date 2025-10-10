import { createBrowserClient } from '@supabase/ssr';
import { getBrowserRuntimeEnv } from './runtime-env';

// Client-side Supabase client (for components that run in the browser)
// IMPORTANT: No custom cookieOptions - Supabase manages PKCE cookie names automatically
export const getSupabaseClient = () => {
  const { supabaseUrl, supabaseAnonKey } = getBrowserRuntimeEnv();

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};