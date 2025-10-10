import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || 
                      request.nextUrl.pathname.startsWith('/auth/callback')
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
                           request.nextUrl.pathname.startsWith('/reading') ||
                           request.nextUrl.pathname.startsWith('/chat') ||
                           request.nextUrl.pathname.startsWith('/onboarding')
  
  // Redirect authenticated users away from login
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  // Redirect unauthenticated users to login
  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
