import { createBrowserClient } from '@supabase/ssr'
import { getBrowserRuntimeEnv } from '@/lib/runtime-env'

export function createClient() {
  const env = getBrowserRuntimeEnv()
  return createBrowserClient(
    env.supabaseUrl,
    env.supabaseAnonKey
  )
}
