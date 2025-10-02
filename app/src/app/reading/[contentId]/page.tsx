'use client';

import { use, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getSupabaseClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

// Helper function for fuzzy text matching
function calculateSimilarity(text1: string, text2: string): number {
    const s1 = text1.toLowerCase().trim();
    const s2 = text2.toLowerCase().trim();

    // If texts are identical, return 100% similarity
    if (s1 === s2) return 1.0;

    // Check if one contains the other (fuzzy match)
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // Simple word overlap similarity
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size; // Jaccard similarity
}

function findParagraphIndex(paragraphs: string[], selectedText: string): number {
    for (let i = 0; i < paragraphs.length; i++) {
        if (paragraphs[i].includes(selectedText)) {
            return i;
        }
    }
    return -1;
}

function ClientReadingView({ contentId, processedText }: { contentId: string, processedText: string }) {
    const router = useRouter();
    const [selection, setSelection] = useState('');
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [presenceChannel, setPresenceChannel] = useState<RealtimeChannel | null>(null);
    const [selectedParagraphIndex, setSelectedParagraphIndex] = useState<number>(-1);
    const [checkingMatch, setCheckingMatch] = useState(false);

    // Parse the structured content
    let content;
    try {
        content = JSON.parse(processedText);
        // Remove duplicate paragraphs if they exist
        if (content.paragraphs && Array.isArray(content.paragraphs)) {
            content.paragraphs = [...new Set(content.paragraphs)];
        }
    } catch {
        // Fallback for old plain text content
        content = { metadata: { title: 'Reading View' }, paragraphs: [processedText] };
    }

    // Check for existing matches when text is selected
    const checkForExistingMatch = async (selectedText: string, paragraphIndex: number) => {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return false;

        const channelName = `content:${contentId}`;

        // Create a temporary channel to check presence (must be same channel name to see presence)
        const tempChannel = supabase.channel(channelName, {
            config: {
                presence: {
                    key: `temp-${session.user.id}-${Date.now()}`
                }
            }
        });

        return new Promise<boolean>((resolve) => {
            let resolved = false;
            tempChannel
                .on('presence', { event: 'sync' }, () => {
                    if (resolved) return;

                    const presenceState = tempChannel.presenceState();
                    const currentUserId = session.user.id;

                    // Get all presence entries with their paragraph info
                    const allPresences: Array<{ userId: string, selectedText: string, paragraphIndex: number }> = [];
                    Object.values(presenceState).forEach((presences: any) => {
                        presences.forEach((presence: any) => {
                            if (presence.userId && presence.userId !== currentUserId) {
                                allPresences.push({
                                    userId: presence.userId,
                                    selectedText: presence.selectedText || '',
                                    paragraphIndex: presence.paragraphIndex ?? -1
                                });
                            }
                        });
                    });

                    // Check for paragraph-level matches
                    let matchFound = false;
                    for (const otherPresence of allPresences) {
                        const similarity = calculateSimilarity(selectedText, otherPresence.selectedText);
                        const sameOrAdjacentParagraph =
                            Math.abs(paragraphIndex - otherPresence.paragraphIndex) <= 1;

                        if (sameOrAdjacentParagraph && similarity >= 0.6) {
                            matchFound = true;
                            break;
                        }
                    }

                    resolved = true;
                    tempChannel.unsubscribe();
                    resolve(matchFound);
                })
                .subscribe();

            // Timeout after 1 second if no response
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    tempChannel.unsubscribe();
                    resolve(false);
                }
            }, 1000);
        });
    };

    useEffect(() => {
        const handleMouseUp = async (e: MouseEvent) => {
            const sel = window.getSelection()?.toString().trim();
            if (sel) {
                // Find which paragraph this selection belongs to
                const paraIndex = findParagraphIndex(content.paragraphs, sel);

                // Check for existing match
                setCheckingMatch(true);
                const hasMatch = await checkForExistingMatch(sel, paraIndex);
                setCheckingMatch(false);

                if (hasMatch) {
                    // Save highlight before navigating
                    const supabase = getSupabaseClient();
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        await fetch('http://localhost:3001/highlights', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contentId,
                                text: sel,
                                context: processedText.substring(0, 100),
                                userId: session.user.id
                            }),
                        });
                    }
                    router.push(`/chat/${contentId}`);
                } else {
                    // No match, show discuss button
                    setSelection(sel);
                    setPosition({ x: e.pageX, y: e.pageY });
                    setSelectedParagraphIndex(paraIndex);
                }
            } else {
                setSelection('');
                setSelectedParagraphIndex(-1);
            }
        };
        document.addEventListener('mouseup', handleMouseUp);
        return () => document.removeEventListener('mouseup', handleMouseUp);
    }, []);

    // Cleanup presence channel on unmount
    useEffect(() => {
        return () => {
            if (presenceChannel) {
                presenceChannel.unsubscribe();
            }
        };
    }, [presenceChannel]);

    const handleDiscuss = async () => {
        if (presenceChannel) {
            await presenceChannel.unsubscribe();
            setPresenceChannel(null);
        }

        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return;
        }

        // Save highlight (from Phase 4)
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

        if (!response.ok) {
            setSelection('');
            return;
        }

        const { highlightId } = await response.json();

        // Join Presence channel for matching
        const channelName = `content:${contentId}`;
        const channel = supabase.channel(channelName);

        channel
            .on('presence', { event: 'sync' }, () => {
                // Presence synced
            })
            .on('presence', { event: 'join' }, () => {
                // User joined
            })
            .on('presence', { event: 'leave' }, () => {
                // User left
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        userId: session.user.id,
                        highlightId,
                        selectedText: selection,
                        paragraphIndex: selectedParagraphIndex,
                        timestamp: new Date().toISOString()
                    });
                }
            });

        setPresenceChannel(channel);
        setSelection('');

        // Navigate to chat immediately - matching will happen there
        router.push(`/chat/${contentId}`);
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
                        <Button onClick={handleDiscuss}>
                            Discuss this
                        </Button>
                    </PopoverContent>
                </Popover>
            )}

            {/* Checking for match indicator */}
            {checkingMatch && (
                <div className="fixed bottom-4 right-4 bg-indigo-500 text-white px-6 py-3 rounded-lg shadow-lg">
                    <div className="flex items-center gap-2">
                        <div className="animate-spin">🔄</div>
                        <div className="font-medium">Checking for matches...</div>
                    </div>
                </div>
            )}

        </div>
    );
}
