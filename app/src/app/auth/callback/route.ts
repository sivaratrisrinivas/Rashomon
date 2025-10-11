import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // Use production URL instead of request.url to avoid localhost redirects
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://impartial-solace-production.up.railway.app'
    : request.url.split('/').slice(0, 3).join('/')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Check if user has completed onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('reading_preferences')
        .eq('id', user?.id)
        .single()
      
      // Redirect to onboarding if preferences not set
      if (!profile?.reading_preferences || profile.reading_preferences.length === 0) {
        return NextResponse.redirect(new URL('/onboarding', baseUrl))
      }
      
      return NextResponse.redirect(new URL(next, baseUrl))
    }
  }

  return NextResponse.redirect(new URL('/login', baseUrl))
}
