import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getServerRuntimeEnv } from '@/lib/runtime-env';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { supabaseUrl, supabaseAnonKey } = getServerRuntimeEnv();

  // Public routes that don't need authentication - check FIRST before any auth calls
  const publicRoutes = ['/login', '/onboarding', '/auth/callback'];
  const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  if (isPublicRoute) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session ONLY for protected routes (not public/callback routes)
  await supabase.auth.getUser();

  // Check auth for protected routes
  // Get actual public URL from proxy headers
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const origin = `${proto}://${host}`;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Redirect to login if no session
      return NextResponse.redirect(`${origin}/login`);
    }

    // Check if user has completed onboarding
    const { data: profile } = await supabase
      .from('profiles')
      .select('reading_preferences')
      .eq('id', user.id)
      .single();

    if (!profile?.reading_preferences || profile.reading_preferences.length === 0) {
      // Redirect to onboarding if preferences not set
      return NextResponse.redirect(`${origin}/onboarding`);
    }

  } catch {
    // On auth errors, redirect to login
    return NextResponse.redirect(`${origin}/login`);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
