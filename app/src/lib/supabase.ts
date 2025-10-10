import { createBrowserClient } from '@supabase/ssr';
import { getBrowserRuntimeEnv } from './runtime-env';

// Client-side Supabase client (for components that run in the browser)
export const getSupabaseClient = () => {
  const { supabaseUrl, supabaseAnonKey } = getBrowserRuntimeEnv();

  // createBrowserClient from @supabase/ssr handles cookies automatically
  // No manual cookie configuration needed - it uses browser's built-in cookie API
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};