'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const preferencesOptions = ['fiction', 'non-fiction', 'mystery', 'science', 'history']; // Example options

const OnboardingPage = () => {
    const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);

    const handleSubmit = async () => {
        // API call to PUT /api/profile will go here in Subtask 4
        console.log('Selected preferences:', selectedPreferences);
        // After submit, redirect to /
    };

    return (
        <Dialog open={true}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Select Your Reading Preferences</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    {preferencesOptions.map((option) => (
                        <div key={option} className="flex items-center space-x-2">
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
                            />
                            <Label htmlFor={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</Label>
                        </div>
                    ))}
                    <Button onClick={handleSubmit}>Submit</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default OnboardingPage;