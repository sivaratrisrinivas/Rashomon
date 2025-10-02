'use client';

import { use, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type ChatPageProps = { params: Promise<{ contentId: string }> };

export default function ChatPage({ params }: ChatPageProps) {
    const { contentId } = use(params);
    const router = useRouter();
    const [messages, setMessages] = useState<{ id: string; text: string; userId: string; timestamp: string }[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatChannel, setChatChannel] = useState<RealtimeChannel | null>(null);
    const [presenceChannel, setPresenceChannel] = useState<RealtimeChannel | null>(null);
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [otherUserPresent, setOtherUserPresent] = useState(false);
    const [contentTitle, setContentTitle] = useState('');

    // Fetch content title
    useEffect(() => {
        const fetchContent = async () => {
            const supabase = getSupabaseClient();
            const { data } = await supabase
                .from('content')
                .select('processed_text')
                .eq('id', contentId)
                .single();

            if (data) {
                try {
                    const parsed = JSON.parse(data.processed_text);
                    setContentTitle(parsed.metadata?.title || 'Discussion');
                } catch {
                    setContentTitle('Discussion');
                }
            }
        };
        fetchContent();
    }, [contentId]);

    // Setup presence and chat channels
    useEffect(() => {
        const supabase = getSupabaseClient();
        let timer: NodeJS.Timeout;

        const setupChannels = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                return;
            }

            setCurrentUserId(session.user.id);

            // Join presence channel to track if other user is still there
            const presenceChannelName = `content:${contentId}`;
            const pChannel = supabase.channel(presenceChannelName);

            pChannel
                .on('presence', { event: 'sync' }, () => {
                    const presenceState = pChannel.presenceState();
                    const allUsers: string[] = [];
                    Object.values(presenceState).forEach((presences: any) => {
                        presences.forEach((presence: any) => {
                            if (presence.userId && !allUsers.includes(presence.userId)) {
                                allUsers.push(presence.userId);
                            }
                        });
                    });

                    const otherUsers = allUsers.filter(userId => userId !== session.user.id);
                    setOtherUserPresent(otherUsers.length > 0);
                })
                .on('presence', { event: 'join' }, () => {
                    const presenceState = pChannel.presenceState();
                    const allUsers: string[] = [];
                    Object.values(presenceState).forEach((presences: any) => {
                        presences.forEach((presence: any) => {
                            if (presence.userId && !allUsers.includes(presence.userId)) {
                                allUsers.push(presence.userId);
                            }
                        });
                    });

                    const otherUsers = allUsers.filter(userId => userId !== session.user.id);
                    setOtherUserPresent(otherUsers.length > 0);
                })
                .on('presence', { event: 'leave' }, () => {
                    const presenceState = pChannel.presenceState();
                    const allUsers: string[] = [];
                    Object.values(presenceState).forEach((presences: any) => {
                        presences.forEach((presence: any) => {
                            if (presence.userId && !allUsers.includes(presence.userId)) {
                                allUsers.push(presence.userId);
                            }
                        });
                    });

                    const otherUsers = allUsers.filter(userId => userId !== session.user.id);
                    setOtherUserPresent(otherUsers.length > 0);
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await pChannel.track({
                            userId: session.user.id,
                            timestamp: new Date().toISOString()
                        });
                    }
                });

            setPresenceChannel(pChannel);

            // Join chat channel
            const chatChannelName = `chat:${contentId}`;
            const cChannel = supabase.channel(chatChannelName, {
                config: {
                    broadcast: { self: false, ack: false },
                },
            });

            cChannel
                .on('broadcast', { event: 'message' }, (payload) => {
                    const msg = payload.payload;

                    // Add message from other users
                    if (msg && msg.id && msg.text) {
                        setMessages((prev) => {
                            const isDuplicate = prev.some(existingMsg => existingMsg.id === msg.id);
                            if (isDuplicate) {
                                return prev;
                            }
                            return [...prev, msg];
                        });
                    }
                })
                .subscribe();

            setChatChannel(cChannel);

            // 5-minute timer
            timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        router.push(`/reading/${contentId}`);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        };

        setupChannels();

        return () => {
            if (timer) clearInterval(timer);
            if (chatChannel) chatChannel.unsubscribe();
            if (presenceChannel) presenceChannel.unsubscribe();
        };
    }, [contentId, router]);

    const sendMessage = async () => {
        if (!newMessage.trim() || !chatChannel) {
            return;
        }

        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return;
        }

        const message = {
            id: `${Date.now()}-${Math.random()}`,
            text: newMessage,
            userId: session.user.id,
            timestamp: new Date().toISOString(),
        };

        try {
            await chatChannel.send({
                type: 'broadcast',
                event: 'message',
                payload: message,
            });

            // Add own message to local state
            setMessages((prev) => {
                const isDuplicate = prev.some(existingMsg => existingMsg.id === message.id);
                if (isDuplicate) {
                    return prev;
                }
                return [...prev, message];
            });
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            {/* Header */}
            <header className="border-b bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href={`/reading/${contentId}`}>
                            <Button variant="ghost" size="sm">
                                ← Back to Reading
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-lg font-semibold">{contentTitle}</h1>
                            <p className="text-sm text-slate-500">
                                {otherUserPresent ? (
                                    <span className="text-green-600">● Other reader present</span>
                                ) : (
                                    <span className="text-yellow-600">⏳ Waiting for other reader...</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="text-sm font-mono text-slate-600">
                        Time left: {formatTime(timeLeft)}
                    </div>
                </div>
            </header>

            {/* Chat Interface */}
            <main className="max-w-4xl mx-auto px-6 py-8">
                <div className="bg-white rounded-lg border shadow-sm">
                    {/* Messages Area */}
                    <div className="h-[60vh] overflow-y-auto p-6 space-y-4">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="text-6xl mb-4">💬</div>
                                <p className="text-lg font-medium text-slate-700">Start the conversation!</p>
                                <p className="text-sm text-slate-500 mt-2">
                                    Share your thoughts about this content with another reader.
                                </p>
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isOwnMessage = msg.userId === currentUserId;
                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[70%] p-4 rounded-lg shadow-sm ${isOwnMessage
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-slate-100 text-slate-900'
                                                }`}
                                        >
                                            <p className="text-xs font-medium mb-1 opacity-75">
                                                {isOwnMessage ? 'You' : 'Other Reader'}
                                            </p>
                                            <p className="text-sm leading-relaxed">{msg.text}</p>
                                            <p className={`text-xs mt-2 ${isOwnMessage ? 'text-blue-100' : 'text-slate-400'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="border-t p-4">
                        <div className="flex gap-2">
                            <Input
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                placeholder="Type your message..."
                                className="flex-1 text-base"
                                disabled={!otherUserPresent}
                            />
                            <Button
                                onClick={sendMessage}
                                disabled={!newMessage.trim() || !otherUserPresent}
                                size="lg"
                            >
                                Send
                            </Button>
                        </div>
                        {!otherUserPresent && (
                            <p className="text-xs text-yellow-600 mt-2">
                                ⏳ Waiting for another reader to join...
                            </p>
                        )}
                    </div>
                </div>

                {/* Helper Text */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <strong>💡 Tip:</strong> You can return to the reading page to highlight more text
                        and come back to this chat. Your conversation will continue where you left off!
                    </p>
                </div>
            </main>
        </div>
    );
}

