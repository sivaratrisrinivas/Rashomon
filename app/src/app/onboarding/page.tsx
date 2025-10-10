'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { getBrowserRuntimeEnv } from '@/lib/runtime-env';

const preferencesOptions = ['fiction', 'non-fiction', 'mystery', 'science', 'history']; // Example options

const OnboardingPage = () => {
    const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
    const router = useRouter();

    const handleSubmit = async () => {
        // TODO: Re-implement with new auth
        console.log('Selected preferences:', selectedPreferences);
        router.push('/dashboard');
    };

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
                        variant="outline"
                        className="w-full h-11 text-[13px] font-light tracking-wide glass hover:scale-[1.02] transition-all duration-300 hover:shadow-md hover:shadow-orange-700/10 border-border/50"
                    >
                        Continue
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default OnboardingPage;