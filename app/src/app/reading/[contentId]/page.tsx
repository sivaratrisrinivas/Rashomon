// FILE: app/src/app/reading/[contentId]/page.tsx

'use client';

import { use, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getSupabaseClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PerspectiveReplay } from '@/components/PerspectiveReplay';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
    const [selectionStartIndex, setSelectionStartIndex] = useState<number>(-1);
    const [selectionEndIndex, setSelectionEndIndex] = useState<number>(-1);
    const [checkingMatch, setCheckingMatch] = useState(false);
    const [isClient, setIsClient] = useState(false);

    // Perspective Replay state
    const [replayMode, setReplayMode] = useState(false);
    const [pastSessions, setPastSessions] = useState<Record<string, unknown>[]>([]);
    const [selectedSession, setSelectedSession] = useState<Record<string, unknown> | null>(null);
    const [replayDialogOpen, setReplayDialogOpen] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string>('');

    // Ensure client-side rendering to prevent hydration mismatches
    useEffect(() => {
        setIsClient(true);
    }, []);

    // Debug render count
    useEffect(() => {
        console.log('🔄 [RENDER] ClientReadingView rendered for contentId:', contentId);
    });

    // Fetch current user ID and past sessions
    useEffect(() => {
        const fetchSessionsAndUser = async () => {
            const supabase = getSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                setCurrentUserId(session.user.id);
            }

            // Fetch past sessions
            try {
                const response = await fetch(`${API_URL}/content/${contentId}/sessions`);
                if (response.ok) {
                    const data = await response.json();
                    setPastSessions(data.sessions || []);
                    console.log('🎭 [REPLAY] Loaded', data.sessions?.length || 0, 'past sessions');
                    console.log('🎭 [REPLAY] Session details:', JSON.stringify(data.sessions, null, 2));
                }
            } catch (error) {
                console.error('❌ [REPLAY] Failed to fetch sessions:', error);
            }
        };

        fetchSessionsAndUser();
    }, [contentId]);

    // Parse the structured content
    interface ContentStructure {
        metadata: { title: string; category?: string; readingTime?: string };
        paragraphs: string[];
    }
    let content: ContentStructure;
    try {
        console.log('🧪 [CONTENT] Raw processed_text length:', processedText.length);
        content = JSON.parse(processedText) as ContentStructure;
        console.log('📄 [CONTENT] Parsed JSON structure:', {
            hasMetadata: !!content.metadata,
            hasParagraphs: !!content.paragraphs,
            paragraphCount: content.paragraphs?.length || 0,
            title: content.metadata?.title || 'No title'
        });

        if (content.metadata) {
            const metadataKeys = Object.keys(content.metadata);
            const metadataLengths: Record<string, number | null> = {};
            metadataKeys.forEach(key => {
                const value = (content.metadata as Record<string, unknown>)[key];
                metadataLengths[key] = typeof value === 'string' ? value.length : null;
            });
            console.log('🧪 [CONTENT] Metadata keys:', metadataKeys);
            console.log('🧪 [CONTENT] Metadata lengths:', metadataLengths);
            if (typeof content.metadata.category === 'string') {
                const categoryPreview = content.metadata.category.trim();
                console.log('🧪 [CONTENT] Metadata.category preview:', categoryPreview.length > 120 ? `${categoryPreview.slice(0, 120)}…` : categoryPreview);
            }
        }

        if (content.metadata?.title) {
            const titleOccurrences = processedText.split(content.metadata.title).length - 1;
            console.log('🧪 [CONTENT] Title occurrences in processed_text:', titleOccurrences);
        }

        if (Array.isArray(content.paragraphs)) {
            console.log('🧪 [CONTENT] Paragraph count before dedupe:', content.paragraphs.length);
            console.log('🧪 [CONTENT] Paragraph preview (first 3):', content.paragraphs.slice(0, 3).map((p: string) => {
                const trimmed = p.trim();
                return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
            }));
        }

        // Ensure we have the expected structure
        if (!content.metadata) {
            content.metadata = { title: 'Reading View' };
        }
        if (!content.paragraphs || !Array.isArray(content.paragraphs)) {
            console.log('⚠️ [CONTENT] Invalid paragraphs structure, using fallback');
            content.paragraphs = [processedText];
        } else {
            // Remove duplicate paragraphs if they exist
            const originalCount = content.paragraphs.length;
            content.paragraphs = [...new Set(content.paragraphs)];
            if (originalCount !== content.paragraphs.length) {
                console.log(`🧹 [CONTENT] Removed ${originalCount - content.paragraphs.length} duplicate paragraphs`);
            }
            if (content.paragraphs.length >= 2) {
                const halfIndex = Math.floor(content.paragraphs.length / 2);
                const firstHalf = content.paragraphs.slice(0, halfIndex).join('\n');
                const secondHalf = content.paragraphs.slice(halfIndex).join('\n');
                const halfSimilarity = calculateSimilarity(firstHalf, secondHalf);
                console.log('🧪 [CONTENT] Similarity between halves:', halfSimilarity.toFixed(2));
            }
            if (content.metadata?.title) {
                const titleParagraphMatches = content.paragraphs.filter(
                    (para: string) => para.trim().toLowerCase() === content.metadata.title.trim().toLowerCase()
                ).length;
                console.log('🧪 [CONTENT] Paragraphs matching title:', titleParagraphMatches);
            }
        }
    } catch (error) {
        console.log('⚠️ [CONTENT] JSON parse failed, using fallback:', error);
        // Fallback for old plain text content
        content = { metadata: { title: 'Reading View' }, paragraphs: [processedText] };
    }

    // Check for existing matches when text is selected
    const checkForExistingMatch = async (selectedText: string, paragraphIndex: number, startIdx?: number, endIdx?: number) => {
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

                    // Get all presence entries with their paragraph and position info
                    const allPresences: Array<{
                        userId: string,
                        selectedText: string,
                        paragraphIndex: number,
                        startIndex?: number,
                        endIndex?: number
                    }> = [];
                    // Supabase presenceState() returns weakly typed data (unknown[])
                    // Need explicit type assertion since TS can't infer types during iteration
                    Object.values(presenceState).forEach((presences: unknown[]) => {
                        presences.forEach((p) => {
                            const presence = p as Record<string, unknown>;
                            if (presence.userId && presence.userId !== currentUserId) {
                                allPresences.push({
                                    userId: presence.userId as string,
                                    selectedText: (presence.selectedText as string) || '',
                                    paragraphIndex: (presence.paragraphIndex as number) ?? -1,
                                    startIndex: presence.startIndex as number | undefined,
                                    endIndex: presence.endIndex as number | undefined
                                });
                            }
                        });
                    });

                    // Check for matches using precise overlap detection
                    let matchFound = false;
                    for (const otherPresence of allPresences) {
                        // Must be in the same paragraph
                        if (paragraphIndex !== otherPresence.paragraphIndex) {
                            continue;
                        }

                        // If both have position data, use precise overlap detection
                        if (
                            typeof startIdx === 'number' &&
                            typeof endIdx === 'number' &&
                            typeof otherPresence.startIndex === 'number' &&
                            typeof otherPresence.endIndex === 'number'
                        ) {
                            // Check if ranges overlap: startA < endB AND startB < endA
                            const hasOverlap = startIdx < otherPresence.endIndex && otherPresence.startIndex < endIdx;

                            if (hasOverlap) {
                                console.log('🎯 [MATCH] Precise overlap detected!', {
                                    current: { start: startIdx, end: endIdx },
                                    other: { start: otherPresence.startIndex, end: otherPresence.endIndex }
                                });
                                matchFound = true;
                                break;
                            }
                        } else {
                            // Fall back to fuzzy text matching for old highlights without position data
                            const similarity = calculateSimilarity(selectedText, otherPresence.selectedText);
                            if (similarity >= 0.6) {
                                console.log('🎯 [MATCH] Fuzzy text match (backward compatibility):', similarity);
                                matchFound = true;
                                break;
                            }
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
            const windowSelection = window.getSelection();
            const sel = windowSelection?.toString().trim();
            if (sel && windowSelection && windowSelection.rangeCount > 0) {
                // Find which paragraph this selection belongs to
                const paraIndex = findParagraphIndex(content.paragraphs, sel);

                // Calculate character positions within the paragraph
                let startIndex = -1;
                let endIndex = -1;

                if (paraIndex >= 0) {
                    try {
                        const range = windowSelection.getRangeAt(0);
                        const paragraphText = content.paragraphs[paraIndex];

                        // Find the position of the selected text within the paragraph
                        const selectedText = range.toString();
                        startIndex = paragraphText.indexOf(selectedText);

                        if (startIndex >= 0) {
                            endIndex = startIndex + selectedText.length;
                            console.log('📍 [SELECTION] Position calculated:', {
                                paraIndex,
                                startIndex,
                                endIndex,
                                selectedText: selectedText.substring(0, 50) + '...'
                            });
                        }
                    } catch (error) {
                        console.error('❌ [SELECTION] Error calculating positions:', error);
                    }
                }

                // Check for existing match
                setCheckingMatch(true);
                const hasMatch = await checkForExistingMatch(sel, paraIndex, startIndex, endIndex);
                setCheckingMatch(false);

                if (hasMatch) {
                    // Save highlight before navigating
                    const supabase = getSupabaseClient();
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        await fetch(`${API_URL}/highlights`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contentId,
                                text: sel,
                                context: processedText.substring(0, 100),
                                userId: session.user.id,
                                startIndex: startIndex >= 0 ? startIndex : undefined,
                                endIndex: endIndex >= 0 ? endIndex : undefined
                            }),
                        });
                    }
                    router.push(`/chat/${contentId}`);
                } else {
                    // No match, show discuss button
                    setSelection(sel);
                    setPosition({ x: e.pageX, y: e.pageY });
                    setSelectedParagraphIndex(paraIndex);
                    setSelectionStartIndex(startIndex);
                    setSelectionEndIndex(endIndex);
                }
            } else {
                setSelection('');
                setSelectedParagraphIndex(-1);
                setSelectionStartIndex(-1);
                setSelectionEndIndex(-1);
            }
        };
        document.addEventListener('mouseup', handleMouseUp);
        return () => document.removeEventListener('mouseup', handleMouseUp);
    }, [content.paragraphs, contentId, processedText, router]); // Added dependencies to useEffect

    // Cleanup presence channel on unmount
    useEffect(() => {
        return () => {
            if (presenceChannel) {
                presenceChannel.unsubscribe();
            }
        };
    }, [presenceChannel]);

    const handleDiscuss = async () => {
        console.log('💬 [DISCUSS] handleDiscuss called');
        console.log('💬 [DISCUSS] Selection:', selection);
        console.log('💬 [DISCUSS] Paragraph index:', selectedParagraphIndex);
        console.log('📍 [DISCUSS] Position:', { start: selectionStartIndex, end: selectionEndIndex });
        console.log('🔍 [DISCUSS DEBUG] Current contentId:', contentId);
        console.log('🔍 [DISCUSS DEBUG] Full URL:', window.location.href);
        console.log('🔍 [DISCUSS DEBUG] Pathname:', window.location.pathname);

        if (presenceChannel) {
            console.log('💬 [DISCUSS] Unsubscribing from existing presence channel');
            await presenceChannel.unsubscribe();
            setPresenceChannel(null);
        }

        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.log('❌ [DISCUSS] No session found');
            return;
        }
        console.log('✅ [DISCUSS] User authenticated:', session.user.id);
        console.log('🔍 [DISCUSS DEBUG] User email (for identification):', session.user.email);

        // Save highlight
        console.log('💬 [DISCUSS] Saving highlight...');
        const highlightPayload = {
            contentId,
            text: selection,
            context: processedText.substring(0, 100),
            userId: session.user.id,
            startIndex: selectionStartIndex >= 0 ? selectionStartIndex : undefined,
            endIndex: selectionEndIndex >= 0 ? selectionEndIndex : undefined
        };
        console.log('🔍 [DISCUSS DEBUG] Highlight request body:', JSON.stringify(highlightPayload, null, 2));

        const response = await fetch(`${API_URL}/highlights`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(highlightPayload),
        });

        console.log('💬 [DISCUSS] Highlight save response status:', response.status);
        if (!response.ok) {
            console.log('❌ [DISCUSS] Failed to save highlight');
            setSelection('');
            return;
        }

        const highlightData = await response.json();
        console.log('💬 [DISCUSS] Highlight saved:', highlightData);
        console.log('🔍 [DISCUSS DEBUG] Highlight ID returned:', highlightData.highlightId);
        console.log('✅ [DISCUSS DEBUG] Will pass highlightId to chat page via URL!');

        // Join Presence channel for matching
        const channelName = `content:${contentId}`;
        console.log('💬 [DISCUSS] Joining presence channel:', channelName);
        console.log('🔍 [DISCUSS DEBUG] If two users have same contentId, they should see each other in:', channelName);
        const channel = supabase.channel(channelName);

        channel
            .on('presence', { event: 'sync' }, () => {
                console.log('💬 [DISCUSS] Presence sync');
            })
            .subscribe(async (status) => {
                console.log('💬 [DISCUSS] Channel subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    const trackData = {
                        userId: session.user.id,
                        selectedText: selection,
                        paragraphIndex: selectedParagraphIndex,
                        startIndex: selectionStartIndex,
                        endIndex: selectionEndIndex,
                        timestamp: new Date().toISOString()
                    };
                    console.log('💬 [DISCUSS] Tracking presence with:', trackData);
                    await channel.track(trackData);
                }
            });

        setPresenceChannel(channel);
        setSelection('');

        // Navigate to chat with highlightId as query param
        const chatUrl = `/chat/${contentId}?highlightId=${highlightData.highlightId}`;
        console.log('💬 [DISCUSS] Navigating to chat:', chatUrl);
        router.push(chatUrl);
    };

    // Don't render until client-side to prevent hydration mismatches
    if (!isClient) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-[12px] text-muted-foreground">Loading</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative">
            {/* Ambient reading gradient */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-orange-300/8 via-transparent to-amber-300/8 blur-3xl pointer-events-none gradient-shift" />

            {/* Header - Sticky with back navigation */}
            <header className="border-b border-border/50 sticky top-0 glass z-10">
                <div className="max-w-3xl mx-auto px-8 py-6 flex justify-between items-center">
                    <Link
                        href="/dashboard"
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-all duration-300 inline-block font-light tracking-wide"
                    >
                        ← Library
                    </Link>

                    {/* Perspective Replay Toggle */}
                    {pastSessions.length > 0 && (
                        <button
                            onClick={() => {
                                console.log('🎭 [REPLAY] Toggling replay mode from', replayMode, 'to', !replayMode);
                                setReplayMode(!replayMode);
                            }}
                            className={`text-[11px] font-light tracking-wide transition-all duration-300 flex items-center gap-2 px-3 py-1.5 rounded-full ${replayMode
                                ? 'bg-orange-700/10 text-orange-800 border border-orange-700/20'
                                : 'text-muted-foreground hover:text-foreground border border-transparent'
                                }`}
                        >
                            <span>🎭</span>
                            <span>Perspective Replay</span>
                            <span className={`w-2 h-2 rounded-full transition-all duration-300 ${replayMode ? 'bg-orange-700' : 'bg-muted-foreground/30'
                                }`} />
                        </button>
                    )}
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-8 py-20 relative z-10">
                {/* Header */}
                <div className="mb-20 pb-16 border-b border-border/20">
                    {content.metadata.category && (
                        <div className="text-[10px] text-muted-foreground/70 mb-4 tracking-widest uppercase font-light">
                            {content.metadata.category}
                            {content.metadata.readingTime && (
                                <span className="ml-4">· {content.metadata.readingTime}</span>
                            )}
                        </div>
                    )}
                    <h1 className="text-[36px] font-light leading-[1.25] tracking-[-0.02em] text-foreground/95">
                        {content.metadata.title}
                    </h1>
                </div>

                {/* Content */}
                <article className="space-y-7" id="content-text">
                    {content.paragraphs.map((para: string, idx: number) => {
                        // Check if this paragraph has related discussions using precise position matching
                        const relevantSessions = replayMode ? pastSessions.filter(session => {
                            console.log(`🔍 [REPLAY] Checking paragraph ${idx} against session:`, {
                                sessionId: session.id,
                                highlightedText: session.highlightedText?.substring(0, 50) + '...',
                                startIndex: session.startIndex,
                                endIndex: session.endIndex,
                                paraPreview: para.substring(0, 50) + '...'
                            });

                            // If session has highlighted text with position data, use precise matching
                            if (session.highlightedText &&
                                typeof session.startIndex === 'number' &&
                                typeof session.endIndex === 'number') {

                                // First, find which paragraph the highlight belongs to
                                let highlightParagraphIndex = -1;
                                for (let i = 0; i < content.paragraphs.length; i++) {
                                    if (content.paragraphs[i].includes(session.highlightedText)) {
                                        highlightParagraphIndex = i;
                                        break;
                                    }
                                }

                                console.log(`🔍 [REPLAY] Highlight found in paragraph ${highlightParagraphIndex}, current: ${idx}`);

                                // Only show indicator on the exact paragraph that was highlighted
                                return highlightParagraphIndex === idx;
                            }
                            // Fall back to fuzzy matching for old sessions without position data
                            else if (session.highlightedText) {
                                const similarity = calculateSimilarity(para, session.highlightedText);
                                console.log(`🔍 [REPLAY] Fuzzy match similarity: ${similarity}`);
                                return similarity >= 0.6; // Higher threshold for backward compatibility
                            }
                            // If no highlighted text, it's a content-level discussion (show on all paragraphs)
                            console.log(`🔍 [REPLAY] No highlighted text for session ${session.id}`);
                            return false; // Changed from true to false - don't show content-level discussions on all paragraphs
                        }) : [];

                        const hasDiscussions = relevantSessions.length > 0;

                        if (replayMode && idx === 0) {
                            console.log('🎭 [REPLAY] replayMode is ON, pastSessions count:', pastSessions.length);
                        }

                        if (para.startsWith('> ')) {
                            return (
                                <blockquote key={idx} className="border-l-2 border-orange-700/30 pl-8 py-3 italic text-[15px] text-muted-foreground/90 leading-[1.9] font-light">
                                    {para.substring(2)}
                                </blockquote>
                            );
                        } else if (para.startsWith('## ')) {
                            return (
                                <h2 key={idx} className="text-[22px] font-light mt-16 mb-6 tracking-tight text-foreground/90">
                                    {para.substring(3)}
                                </h2>
                            );
                        } else {
                            return (
                                <div key={idx} className="relative group">
                                    <p className="text-[16px] leading-[1.9] text-foreground/90 tracking-normal font-light">
                                        {para}
                                    </p>
                                    {/* Replay indicator */}
                                    {hasDiscussions && (
                                        <button
                                            onClick={() => {
                                                setSelectedSession(relevantSessions[0]);
                                                setReplayDialogOpen(true);
                                            }}
                                            className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-[11px] text-orange-700 hover:text-orange-800 flex items-center gap-1"
                                            title={`${relevantSessions.length} discussion${relevantSessions.length > 1 ? 's' : ''}`}
                                        >
                                            <span>💬</span>
                                            <span className="font-mono">{relevantSessions.length}</span>
                                        </button>
                                    )}
                                </div>
                            );
                        }
                    })}
                </article>
            </div>

            {/* Selection popover - Glass morphism */}
            {selection && (
                <Popover open={!!selection}>
                    <PopoverTrigger asChild>
                        <div style={{ position: 'absolute', top: position.y, left: position.x }} />
                    </PopoverTrigger>
                    <PopoverContent className="glass shadow-lg shadow-orange-700/10 p-1.5 w-auto border-border/50">
                        <Button
                            onClick={handleDiscuss}
                            variant="ghost"
                            size="sm"
                            className="h-9 px-4 text-[11px] font-light tracking-wide hover:scale-105 transition-all duration-300"
                        >
                            Discuss this
                        </Button>
                    </PopoverContent>
                </Popover>
            )}

            {/* Checking for match indicator - Floating pill */}
            {checkingMatch && (
                <div className="fixed bottom-28 right-10 glass px-4 py-2 text-[11px] font-light tracking-wide shadow-md shadow-orange-700/10 border border-border/50">
                    Matching...
                </div>
            )}

            {/* Perspective Replay Dialog */}
            <PerspectiveReplay
                open={replayDialogOpen}
                onOpenChange={setReplayDialogOpen}
                session={selectedSession}
                currentUserId={currentUserId}
            />

        </div>
    );
}