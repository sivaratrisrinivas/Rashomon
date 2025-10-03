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
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center space-y-12">
                <div className="space-y-3">
                    <h1 className="text-[15px] font-medium tracking-tight">Rashomon</h1>
                    <p className="text-[13px] text-muted-foreground">
                        Shared reading experiences
                    </p>
                </div>
                <Button
                    onClick={signInWithGoogle}
                    variant="outline"
                    className="h-10 px-6 text-[13px] font-normal"
                >
                    Continue with Google
                </Button>
            </div>
        </div>
    );
};

export default LoginPage;