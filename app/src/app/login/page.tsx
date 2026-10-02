'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { safeNextPath } from '@/lib/share'
import { navigate } from '@/lib/navigate'

// Google sign-in needs a Google Cloud OAuth client. It stays available behind a
// build flag; email and password works on any Supabase project with no extra setup.
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH === 'true'

type Mode = 'signin' | 'signup'

const nextFromUrl = () => safeNextPath(new URLSearchParams(window.location.search).get('next'))

export default function LoginPage() {
    const [mode, setMode] = useState<Mode>('signin')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const goAfterLogin = async (supabase: ReturnType<typeof createClient>, userId: string) => {
        const next = nextFromUrl()
        const { data: profile } = await supabase.from('profiles').select('reading_preferences').eq('id', userId).single()
        if (!profile?.reading_preferences || profile.reading_preferences.length === 0) {
            navigate(`/onboarding?next=${encodeURIComponent(next)}`)
        } else {
            navigate(next)
        }
    }

    const handleEmail = async (e: FormEvent) => {
        e.preventDefault()
        setMessage(null)
        if (password.length < 8) {
            setMessage('Use a password of at least 8 characters.')
            return
        }
        setBusy(true)
        const supabase = createClient()
        try {
            if (mode === 'signup') {
                const { data, error } = await supabase.auth.signUp({ email, password })
                if (error) return setMessage(error.message)
                if (!data.session || !data.user) return setMessage('Check your email to confirm your account, then sign in.')
                await goAfterLogin(supabase, data.user.id)
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password })
                if (error || !data.user) return setMessage('Wrong email or password.')
                await goAfterLogin(supabase, data.user.id)
            }
        } finally {
            setBusy(false)
        }
    }

    const handleGoogleSignIn = async () => {
        const supabase = createClient()
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextFromUrl())}`,
            },
        })
        if (error) console.error('Login error:', error)
    }

    return (
        <div className="flex items-center justify-center min-h-screen relative">
            {/* Floating orbs - psychedelic touch */}
            <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-gradient-to-br from-orange-300/20 to-amber-300/20 blur-3xl float" style={{ animationDelay: '0s' }} />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-gradient-to-br from-amber-200/15 to-orange-200/15 blur-3xl float" style={{ animationDelay: '1s' }} />

            <div className="text-center space-y-8 relative z-10 px-6 w-full max-w-sm">
                <div className="space-y-6">
                    <h1 className="text-[32px] font-light tracking-[-0.02em] iridescent">
                        Rashomon
                    </h1>
                    <p className="text-[14px] text-muted-foreground leading-relaxed font-light max-w-md mx-auto">
                        Sign in to start meaningful discussions around shared reading experiences
                    </p>
                </div>

                <form onSubmit={handleEmail} className="space-y-4 text-left">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    {message && <p role="alert" className="text-[13px] text-orange-700">{message}</p>}
                    <Button type="submit" disabled={busy} variant="outline" className="w-full h-11 text-[13px] font-light tracking-wide glass border-border/50">
                        {mode === 'signup' ? 'Create account' : 'Sign in'}
                    </Button>
                </form>

                <button
                    type="button"
                    className="text-[13px] text-muted-foreground underline underline-offset-4"
                    onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null) }}
                >
                    {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
                </button>

                {GOOGLE_ENABLED && (
                    <Button
                        onClick={handleGoogleSignIn}
                        variant="outline"
                        className="h-12 px-8 text-[13px] font-light tracking-wide glass hover:scale-105 transition-all duration-500 hover:shadow-lg hover:shadow-orange-700/10 border-border/50"
                    >
                        Sign In with Google
                    </Button>
                )}
            </div>
        </div>
    )
}
