'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// Add form logic for preferences

const OnboardingPage = () => {
    return (
        <Dialog open={true}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Select Reading Preferences</DialogTitle>
                </DialogHeader>
                {/* Add form inputs here */}
            </DialogContent>
        </Dialog>
    );
};

export default OnboardingPage;