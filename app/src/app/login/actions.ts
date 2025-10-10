'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getServerRuntimeEnv } from '@/lib/runtime-env';
import { cookies } from 'next/headers';

export async function signInWithGoogle() {
  const { supabaseUrl, supabaseAnonKey } = getServerRuntimeEnv();
  const cookieStore = await cookies();
  const headersList = await headers();
  
  // Get the origin from request headers (handles Render proxy)
  const host = headersList.get('x-forwarded-host') || headersList.get('host');
  const proto = headersList.get('x-forwarded-proto') || 'https';
  const origin = `${proto}://${host}`;
  const publicDomain = (host || '').split(':')[0] || undefined;
  
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Configure cookies for Render proxy environment
            const cookieOptions = {
              ...options,
              sameSite: 'lax' as const,
              secure: proto === 'https',
              path: '/',
              domain: publicDomain,
              httpOnly: name.includes('code-verifier'), // PKCE verifier should be httpOnly
            };
            cookieStore.set(name, value, cookieOptions);
          });
        } catch (error) {
          console.error('[AUTH] Cookie set error:', error);
        }
      },
    },
  });

  const redirectTo = `${origin}/api/auth/callback`;
  
  console.log('[AUTH SERVER ACTION] Origin:', origin);
  console.log('[AUTH SERVER ACTION] Redirect URL:', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: false,
    },
  });

  if (error) {
    console.error('[AUTH SERVER ACTION] OAuth error:', error);
    throw error;
  }

  if (data.url) {
    console.log('[AUTH SERVER ACTION] Redirecting to:', data.url);
    redirect(data.url);
  }
}

