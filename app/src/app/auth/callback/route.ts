import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerRuntimeEnv } from '@/lib/runtime-env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  
  // Get actual public URL from proxy headers (Render sets these)
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const origin = `${proto}://${host}`;

  if (code) {
    const cookieStore = await cookies();
    const { supabaseUrl, supabaseAnonKey } = getServerRuntimeEnv();
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            cookieStore.set(name, value, options);
          },
          remove(name: string, options: Record<string, unknown>) {
            cookieStore.set(name, '', options);
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Check if user has completed onboarding
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('reading_preferences')
          .eq('id', user.id)
          .single();

        if (!profile?.reading_preferences || profile.reading_preferences.length === 0) {
          // Redirect to onboarding if profile is incomplete
          return NextResponse.redirect(`${origin}/onboarding`);
        }
        
        // Redirect to dashboard or home if profile is complete
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // If there's an error or no code, redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
