import { createBrowserClient } from '@supabase/ssr';
import { getBrowserRuntimeEnv } from './runtime-env';

// Client-side Supabase client (for components that run in the browser)
export const getSupabaseClient = () => {
  const { supabaseUrl, supabaseAnonKey } = getBrowserRuntimeEnv();

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};