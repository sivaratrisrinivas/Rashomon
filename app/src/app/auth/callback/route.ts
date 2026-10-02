import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { safeNextPath } from '@/lib/share'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))

  // Behind a proxy request.url can be an internal address, so production sets SITE_URL.
  const baseUrl = process.env['SITE_URL'] || new URL(request.url).origin

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
        const onboarding = new URL('/onboarding', baseUrl)
        onboarding.searchParams.set('next', next)
        return NextResponse.redirect(onboarding)
      }
      
      return NextResponse.redirect(new URL(next, baseUrl))
    }
  }

  return NextResponse.redirect(new URL('/login', baseUrl))
}
