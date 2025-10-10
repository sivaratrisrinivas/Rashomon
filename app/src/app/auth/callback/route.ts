import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

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
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
      
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL('/login', request.url))
}
