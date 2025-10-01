'use client';

import { use, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getSupabaseClient } from '@/lib/supabase';

type ReadingPageProps = { params: Promise<{ contentId: string }> };

export default function ReadingPage({ params }: ReadingPageProps) {
    const { contentId } = use(params);
    const [processedText, setProcessedText] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContent = async () => {
            const supabase = getSupabaseClient();
            const { data: content } = await supabase
                .from('content')
                .select('processed_text')
                .eq('id', contentId)
                .single();

            if (content) {
                setProcessedText(content.processed_text);
            }
            setLoading(false);
        };
        fetchContent();
    }, [contentId]);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!processedText) {
        return <div>Content not found</div>;
    }

    return <ClientReadingView contentId={contentId} processedText={processedText} />;
}

function ClientReadingView({ contentId, processedText }: { contentId: string, processedText: string }) {
    const [selection, setSelection] = useState('');
    const [position, setPosition] = useState({ x: 0, y: 0 });

    // Parse the structured content
    let content;
    try {
        content = JSON.parse(processedText);
    } catch {
        // Fallback for old plain text content
        content = { metadata: { title: 'Reading View' }, paragraphs: [processedText] };
    }

    useEffect(() => {
        const handleMouseUp = (e: MouseEvent) => {
            const sel = window.getSelection()?.toString().trim();
            if (sel) {
                setSelection(sel);
                setPosition({ x: e.pageX, y: e.pageY });
            } else {
                setSelection('');
            }
        };
        document.addEventListener('mouseup', handleMouseUp);
        return () => document.removeEventListener('mouseup', handleMouseUp);
    }, []);

    const handleDiscuss = async () => {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch('http://localhost:3001/highlights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contentId,
                text: selection,
                context: processedText.substring(0, 100),
                userId: session.user.id
            }),
        });
        if (response.ok) {
            console.log('Highlight saved');
        }
        setSelection('');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <div className="max-w-3xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="mb-8 border-b border-slate-200 pb-8">
                    {content.metadata.category && (
                        <div className="text-sm font-medium text-slate-500 mb-2">
                            {content.metadata.category}
                            {content.metadata.readingTime && (
                                <span className="ml-3">| {content.metadata.readingTime}</span>
                            )}
                        </div>
                    )}
                    <h1 className="text-4xl font-bold text-slate-900 leading-tight">
                        {content.metadata.title}
                    </h1>
                </div>

                {/* Content */}
                <article className="prose prose-lg prose-slate max-w-none" id="content-text">
                    {content.paragraphs.map((para: string, idx: number) => {
                        if (para.startsWith('> ')) {
                            return (
                                <blockquote key={idx} className="border-l-4 border-slate-300 pl-6 py-2 my-6 italic text-slate-700">
                                    {para.substring(2)}
                                </blockquote>
                            );
                        } else if (para.startsWith('## ')) {
                            return (
                                <h2 key={idx} className="text-2xl font-semibold text-slate-900 mt-8 mb-4">
                                    {para.substring(3)}
                                </h2>
                            );
                        } else {
                            return (
                                <p key={idx} className="text-slate-700 leading-relaxed mb-6">
                                    {para}
                                </p>
                            );
                        }
                    })}
                </article>
            </div>

            {/* Selection popover */}
            {selection && (
                <Popover open={!!selection}>
                    <PopoverTrigger asChild>
                        <div style={{ position: 'absolute', top: position.y, left: position.x }} />
                    </PopoverTrigger>
                    <PopoverContent>
                        <Button onClick={handleDiscuss}>Discuss this</Button>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}