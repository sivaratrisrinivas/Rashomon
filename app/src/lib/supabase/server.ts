import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServerRuntimeEnv } from '@/lib/runtime-env'

export async function createClient() {
  const cookieStore = await cookies()
  const env = getServerRuntimeEnv()
  
  return createServerClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
