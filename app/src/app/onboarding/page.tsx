'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getSupabaseClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const preferencesOptions = ['fiction', 'non-fiction', 'mystery', 'science', 'history']; // Example options

const OnboardingPage = () => {
    const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
    const router = useRouter();

    const handleSubmit = async () => {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch('http://localhost:3001/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: session.user.id,
                reading_preferences: selectedPreferences
            }),
        });

        const result = await response.json();
        if (result.success) {
            router.push('/');
        }
    };

    return (
        <Dialog open={true}>
            <DialogContent className="border-border/50">
                <DialogHeader>
                    <DialogTitle className="text-[14px] font-medium">Reading Preferences</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                    <div className="space-y-3">
                        {preferencesOptions.map((option) => (
                            <div key={option} className="flex items-center space-x-3">
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
                                    className="data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                                />
                                <Label
                                    htmlFor={option}
                                    className="text-[13px] font-normal cursor-pointer"
                                >
                                    {option.charAt(0).toUpperCase() + option.slice(1)}
                                </Label>
                            </div>
                        ))}
                    </div>
                    <Button
                        onClick={handleSubmit}
                        variant="outline"
                        className="w-full h-9 text-[12px] font-normal"
                    >
                        Continue
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default OnboardingPage;