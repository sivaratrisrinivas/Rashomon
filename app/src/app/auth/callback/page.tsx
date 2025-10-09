'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { getBrowserRuntimeEnv } from '@/lib/runtime-env';

export default function AuthCallbackPage() {
    const router = useRouter();
    const [status, setStatus] = useState<'processing' | 'error'>('processing');

    useEffect(() => {
        const handleCallback = async () => {
            try {
                console.log('[CLIENT CALLBACK] Starting client-side callback handling');

                const { supabaseUrl, supabaseAnonKey } = getBrowserRuntimeEnv();
                const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

                // exchangeCodeForSession will automatically handle PKCE from browser storage
                const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);

                if (error) {
                    console.error('[CLIENT CALLBACK ERROR]', error);
                    setStatus('error');
                    setTimeout(() => router.push('/login'), 2000);
                    return;
                }

                if (data.user) {
                    console.log('[CLIENT CALLBACK] User authenticated:', data.user.id);

                    // Check onboarding status
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('reading_preferences')
                        .eq('id', data.user.id)
                        .single();

                    if (!profile?.reading_preferences || profile.reading_preferences.length === 0) {
                        console.log('[CLIENT CALLBACK] Redirecting to onboarding');
                        router.push('/onboarding');
                    } else {
                        console.log('[CLIENT CALLBACK] Redirecting to home');
                        router.push('/');
                    }
                }
            } catch (err) {
                console.error('[CLIENT CALLBACK EXCEPTION]', err);
                setStatus('error');
                setTimeout(() => router.push('/login'), 2000);
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
            <div className="text-center">
                {status === 'processing' ? (
                    <>
                        <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-gray-700">Completing sign in...</p>
                    </>
                ) : (
                    <>
                        <div className="text-red-500 text-5xl mb-4">✕</div>
                        <p className="text-gray-700">Authentication failed. Redirecting...</p>
                    </>
                )}
            </div>
        </div>
    );
}

