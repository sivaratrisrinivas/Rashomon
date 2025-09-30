'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

const DashboardPage = () => {
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const router = useRouter();

    const handleUrlSubmit = async () => {
        const { data: { session } } = await getSupabaseClient().auth.getSession();
        if (!session) return;

        const response = await fetch('http://localhost:3001/content/url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, userId: session.user.id }),
        });

        const { contentId } = await response.json();
        if (contentId) router.push(`/reading/${contentId}`);
    };

    const handleFileUpload = async () => {
        if (!file) return;
        const { data: { session } } = await getSupabaseClient().auth.getSession();
        if (!session) return;

        const filePath = `${session.user.id}/${file.name}`;
        const { error: uploadError } = await getSupabaseClient().storage.from('uploads').upload(filePath, file);

        if (uploadError) {
            console.error(uploadError);
            return;
        }

        const response = await fetch('http://localhost:3001/content/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath, userId: session.user.id }),
        });

        const { contentId } = await response.json();
        if (contentId) router.push(`/reading/${contentId}`);
    };

    return (
        <div className="p-4">
            <h1>Dashboard</h1>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter URL" />
            <Button onClick={handleUrlSubmit}>Submit URL</Button>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button onClick={handleFileUpload}>Upload File</Button>
        </div>
    );
};

export default DashboardPage;