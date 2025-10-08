'use client';

import { Button } from '@/components/ui/button';
import { getSupabaseClient } from '@/lib/supabase';

const LoginPage = () => {
    const signInWithGoogle = async () => {
        const supabase = getSupabaseClient();
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
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