'use client';

import { Button } from '@/components/ui/button';
import { getSupabaseClient } from '@/lib/supabase';

const LoginPage = () => {
    const signInWithGoogle = async () => {
        const supabase = getSupabaseClient();
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
            },
        });
    };

    return (
        <div className="flex items-center justify-center h-screen">
            <Button onClick={signInWithGoogle}>Sign In with Google</Button>
        </div>
    );
};

export default LoginPage;