'use client';

import { Button } from '@/components/ui/button';
import { getSupabaseClient } from '@/lib/supabase';

const LoginPage = () => {
    const signInWithGoogle = async () => {
        const supabase = getSupabaseClient();
        const redirectUrl = `${window.location.origin}/auth/callback`;

        // COMPREHENSIVE DEBUG LOGGING
        console.log('🔍 [LOGIN DEBUG] === OAuth Initialization ===');
        console.log('🌐 [LOGIN DEBUG] window.location.href:', window.location.href);
        console.log('🌐 [LOGIN DEBUG] window.location.origin:', window.location.origin);
        console.log('🌐 [LOGIN DEBUG] window.location.hostname:', window.location.hostname);
        console.log('🔗 [LOGIN DEBUG] Computed redirectTo:', redirectUrl);
        console.log('⚙️  [LOGIN DEBUG] NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
        console.log('⚙️  [LOGIN DEBUG] Runtime env:', (window as typeof window & { __RASHOMON_ENV__?: unknown }).__RASHOMON_ENV__);
        
        // Force skipBrowserRedirect to check if popup is the issue
        console.log('🧪 [LOGIN DEBUG] Testing with skipBrowserRedirect: false (same-window redirect)');
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: false, // Force same-window redirect instead of popup
            },
        });

        console.log('📤 [LOGIN DEBUG] Supabase OAuth response:', { data, error });
        console.log('📤 [LOGIN DEBUG] OAuth URL being redirected to:', data?.url);
        
        if (error) {
            console.error('❌ [LOGIN DEBUG] OAuth error:', error);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen relative">
            {/* Psychedelic floating orbs */}
            <div className="absolute top-1/3 left-1/3 w-72 h-72 rounded-full bg-gradient-to-br from-orange-300/15 to-amber-300/15 blur-3xl float" style={{ animationDelay: '0s' }} />
            <div className="absolute bottom-1/3 right-1/3 w-96 h-96 rounded-full bg-gradient-to-br from-amber-200/12 to-orange-200/12 blur-3xl float" style={{ animationDelay: '2s' }} />

            <div className="text-center space-y-16 relative z-10">
                <div className="space-y-5">
                    <h1 className="text-[36px] font-light tracking-[-0.02em] iridescent">Rashomon</h1>
                    <p className="text-[14px] text-muted-foreground/80 font-light tracking-wide">
                        Shared reading experiences
                    </p>
                </div>
                <Button
                    onClick={signInWithGoogle}
                    variant="outline"
                    className="h-12 px-8 text-[13px] font-light tracking-wide glass hover:scale-105 transition-all duration-500 hover:shadow-lg hover:shadow-orange-700/10 border-border/50"
                >
                    Continue with Google
                </Button>
            </div>
        </div>
    );
};

export default LoginPage;