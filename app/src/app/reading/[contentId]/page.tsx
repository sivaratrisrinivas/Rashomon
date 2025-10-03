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
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-[12px] text-muted-foreground">Loading</p>
            </div>
        );
    }

    if (!processedText) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-[12px] text-muted-foreground">Content not found</p>
            </div>
        );
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
        <div className="min-h-screen">
            {/* Header - Sticky with back navigation */}
            <header className="border-b border-border/30 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                <div className="max-w-2xl mx-auto px-8 py-5">
                    <Link
                        href="/dashboard"
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-block"
                    >
                        ← Library
                    </Link>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-8 py-16">
                {/* Header */}
                <div className="mb-16 pb-12 border-b border-border/30">
                    {content.metadata.category && (
                        <div className="text-[11px] text-muted-foreground mb-3 tracking-wide uppercase">
                            {content.metadata.category}
                            {content.metadata.readingTime && (
                                <span className="ml-3">· {content.metadata.readingTime}</span>
                            )}
                        </div>
                    )}
                    <h1 className="text-[28px] font-normal leading-[1.3] tracking-tight">
                        {content.metadata.title}
                    </h1>
                </div>

                {/* Content */}
                <article className="space-y-6" id="content-text">
                    {content.paragraphs.map((para: string, idx: number) => {
                        if (para.startsWith('> ')) {
                            return (
                                <blockquote key={idx} className="border-l border-border/50 pl-6 py-1 italic text-[14px] text-muted-foreground leading-[1.7]">
                                    {para.substring(2)}
                                </blockquote>
                            );
                        } else if (para.startsWith('## ')) {
                            return (
                                <h2 key={idx} className="text-[18px] font-medium mt-12 mb-4 tracking-tight">
                                    {para.substring(3)}
                                </h2>
                            );
                        } else {
                            return (
                                <p key={idx} className="text-[14px] leading-[1.7] text-foreground/90">
                                    {para}
                                </p>
                            );
                        }
                    })}
                </article>
            </div>

            {/* Floating Chat Button - Always visible */}
            <div className="fixed bottom-8 right-8 z-20">
                <Button
                    onClick={() => router.push(`/chat/${contentId}`)}
                    className="h-12 w-12 rounded-full p-0 shadow-lg hover:shadow-xl transition-shadow"
                    title="Start discussion"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </Button>
            </div>

            {/* Selection popover - Redesigned */}
            {selection && (
                <Popover open={!!selection}>
                    <PopoverTrigger asChild>
                        <div style={{ position: 'absolute', top: position.y, left: position.x }} />
                    </PopoverTrigger>
                    <PopoverContent className="border-border/50 shadow-sm p-1 w-auto">
                        <Button
                            onClick={handleDiscuss}
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-[11px] font-normal"
                        >
                            Discuss this
                        </Button>
                    </PopoverContent>
                </Popover>
            )}

            {/* Checking for match indicator - Improved */}
            {checkingMatch && (
                <div className="fixed bottom-24 right-8 bg-foreground text-background px-3 py-1.5 text-[10px] font-medium">
                    Matching...
                </div>
            )}

        </div>
    );
}
