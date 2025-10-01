'use client';

import { use, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getSupabaseClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
    const [matchFound, setMatchFound] = useState(false);
    const [roomName, setRoomName] = useState('');
    const [presenceChannel, setPresenceChannel] = useState<RealtimeChannel | null>(null);

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

    // Cleanup presence channel on unmount
    useEffect(() => {
        return () => {
            if (presenceChannel) {
                presenceChannel.unsubscribe();
            }
        };
    }, [presenceChannel]);

    const handleDiscuss = async () => {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

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
            console.error('Failed to save highlight');
            setSelection('');
            return;
        }

        const { highlightId } = await response.json();

        // Join Presence channel for matching
        const channel = supabase.channel(`content:${contentId}`);

        channel
            .on('presence', { event: 'sync' }, () => {
                const presenceState = channel.presenceState();
                const currentUserId = session.user.id;

                // Check for other users in the presence state
                const otherUsers = Object.values(presenceState)
                    .flat()
                    .filter((state: any) => state.userId !== currentUserId);

                if (otherUsers.length > 0) {
                    setMatchFound(true);
                    setRoomName(`chat:${highlightId}`);
                    console.log('Match found! Starting chat...');
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        userId: session.user.id,
                        highlightId,
                        timestamp: new Date().toISOString()
                    });
                }
            });

        setPresenceChannel(channel);
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

            {/* Chat Interface Dialog */}
            {matchFound && <ChatInterface roomName={roomName} onClose={() => setMatchFound(false)} />}
        </div>
    );
}

// Chat Interface Component
function ChatInterface({ roomName, onClose }: { roomName: string; onClose: () => void }) {
    const [messages, setMessages] = useState<{ id: string; text: string; userId: string; timestamp: string }[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatChannel, setChatChannel] = useState<RealtimeChannel | null>(null);
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

    useEffect(() => {
        const supabase = getSupabaseClient();

        // Join chat channel
        const channel = supabase.channel(roomName);

        channel
            .on('broadcast', { event: 'message' }, (payload) => {
                setMessages((prev) => [...prev, payload.payload]);
            })
            .subscribe();

        setChatChannel(channel);

        // 5-minute timer
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onClose();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearInterval(timer);
            channel.unsubscribe();
        };
    }, [roomName, onClose]);

    const sendMessage = async () => {
        if (!newMessage.trim() || !chatChannel) return;

        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const message = {
            id: `${Date.now()}-${Math.random()}`,
            text: newMessage,
            userId: session.user.id,
            timestamp: new Date().toISOString(),
        };

        await chatChannel.send({
            type: 'broadcast',
            event: 'message',
            payload: message,
        });

        setMessages((prev) => [...prev, message]);
        setNewMessage('');
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center">
                        <span>Discussion</span>
                        <span className="text-sm font-mono text-muted-foreground">
                            Time left: {formatTime(timeLeft)}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col h-[500px]">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 rounded-lg mb-4">
                        {messages.length === 0 ? (
                            <p className="text-center text-muted-foreground">No messages yet. Start the conversation!</p>
                        ) : (
                            messages.map((msg) => (
                                <div key={msg.id} className="bg-white p-3 rounded-lg shadow-sm">
                                    <p className="text-sm text-slate-700">{msg.text}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {new Date(msg.timestamp).toLocaleTimeString()}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Input */}
                    <div className="flex gap-2">
                        <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Type your message..."
                            className="flex-1"
                        />
                        <Button onClick={sendMessage}>Send</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}