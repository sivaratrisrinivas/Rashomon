import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getServerRuntimeEnv } from '@/lib/runtime-env';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', url.origin));
  }

  const { supabaseUrl, supabaseAnonKey } = getServerRuntimeEnv();
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch (error) {
          console.error('[CALLBACK] Cookie set error:', error);
        }
      },
    },
  });

  // Exchange code for session (server-side, PKCE code verifier from cookie)
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.session) {
    console.error('[CALLBACK] Exchange error:', error);
    return NextResponse.redirect(new URL('/login?error=exchange_failed', url.origin));
  }

  console.log('[CALLBACK] Session created for user:', data.user.id);

  // Check if user needs onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('reading_preferences')
    .eq('id', data.user.id)
    .single();

  const redirectUrl = !profile?.reading_preferences || profile.reading_preferences.length === 0
    ? '/onboarding'
    : next;

  return NextResponse.redirect(new URL(redirectUrl, url.origin));
}

