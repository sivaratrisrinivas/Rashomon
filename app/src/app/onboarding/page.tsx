'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { getBrowserRuntimeEnv } from '@/lib/runtime-env';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

const preferencesOptions = ['fiction', 'non-fiction', 'mystery', 'science', 'history']; // Example options

const OnboardingPage = () => {
    const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            setIsLoading(false);
        };
        fetchUser();
    }, []);

    const handleSubmit = async () => {
        if (!user || selectedPreferences.length === 0) return;

        setIsSubmitting(true);
        try {
            const response = await fetch(`${getBrowserRuntimeEnv().apiUrl}/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await createClient().auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({
                    reading_preferences: selectedPreferences
                }),
            });

            if (response.ok) {
                router.push('/dashboard');
            } else {
                console.error('Failed to save preferences');
            }
        } catch (error) {
            console.error('Error saving preferences:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <Dialog open={true}>
                <DialogContent className="glass border-border/50 shadow-2xl shadow-orange-700/10">
                    <div className="flex items-center justify-center py-8">
                        <div className="text-[14px] font-light text-muted-foreground">Loading...</div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={true}>
            <DialogContent className="glass border-border/50 shadow-2xl shadow-orange-700/10">
                <DialogHeader>
                    <DialogTitle className="text-[20px] font-light tracking-tight">Reading Preferences</DialogTitle>
                </DialogHeader>
                <div className="space-y-8">
                    <div className="space-y-4">
                        {preferencesOptions.map((option) => (
                            <div key={option} className="flex items-center space-x-4 group">
                                <Checkbox
                                    id={option}
                                    checked={selectedPreferences.includes(option)}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            setSelectedPreferences([...selectedPreferences, option]);
                                        } else {
                                            setSelectedPreferences(selectedPreferences.filter((p) => p !== option));
                                        }
                                    }}
                                    className="data-[state=checked]:bg-foreground data-[state=checked]:border-foreground transition-all duration-300 hover:scale-110"
                                />
                                <Label
                                    htmlFor={option}
                                    className="text-[14px] font-light cursor-pointer group-hover:text-foreground transition-colors duration-300"
                                >
                                    {option.charAt(0).toUpperCase() + option.slice(1)}
                                </Label>
                            </div>
                        ))}
                    </div>
                    <Button
                        onClick={handleSubmit}
                        disabled={selectedPreferences.length === 0 || isSubmitting}
                        variant="outline"
                        className="w-full h-11 text-[13px] font-light tracking-wide glass hover:scale-[1.02] transition-all duration-300 hover:shadow-md hover:shadow-orange-700/10 border-border/50"
                    >
                        {isSubmitting ? 'Saving...' : 'Continue'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default OnboardingPage;