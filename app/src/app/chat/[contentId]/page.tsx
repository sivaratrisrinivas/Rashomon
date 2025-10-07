'use client';

import { use, useEffect, useState, useRef } from 'react'; // Import useRef
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

    // Refs to hold the channel instances
    const chatChannelRef = useRef<RealtimeChannel | null>(null);
    const presenceChannelRef = useRef<RealtimeChannel | null>(null);

    const [messages, setMessages] = useState<{ id: string; text: string; userId: string; timestamp: string }[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [timeLeft, setTimeLeft] = useState(300);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [otherUserPresent, setOtherUserPresent] = useState(false);
    const [contentTitle, setContentTitle] = useState('');
    const [timerExpired, setTimerExpired] = useState(false);
    const chatSetupRunCountRef = useRef(0);
    const chatMessageHandlerIdRef = useRef<string | null>(null);
    const chatMessageCallbackCountRef = useRef(0);

    // Log state changes for debugging
    useEffect(() => {
        console.log('🎯 [STATE] otherUserPresent changed to:', otherUserPresent);
        console.log('🎯 [STATE] Input disabled?', !otherUserPresent || timerExpired);
    }, [otherUserPresent, timerExpired]);

    // Fetch content title (no changes here)
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

    // Setup or remove channels
    useEffect(() => {
        const supabase = getSupabaseClient();
        let isActive = true; // Flag to prevent race conditions

        const setupChannels = async () => {
            chatSetupRunCountRef.current += 1;
            const runId = chatSetupRunCountRef.current;
            console.log('🔧 [CHAT SETUP] Starting channel setup for contentId:', contentId, 'setup run #', runId);
            console.log('🔍 [CHAT SETUP DEBUG] Full URL:', window.location.href);
            console.log('🔍 [CHAT SETUP DEBUG] Pathname:', window.location.pathname);

            // Clean up any existing channels first
            if (chatChannelRef.current) {
                console.log('🧹 [CHAT SETUP] Cleaning up existing chat channel');
                await supabase.removeChannel(chatChannelRef.current);
                chatChannelRef.current = null;
            }
            if (presenceChannelRef.current) {
                console.log('🧹 [CHAT SETUP] Cleaning up existing presence channel');
                await supabase.removeChannel(presenceChannelRef.current);
                presenceChannelRef.current = null;
            }

            if (!isActive) {
                console.log('⏹️  [CHAT SETUP] Aborting setup run #', runId, 'after cleanup (stale effect)');
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (!isActive) {
                console.log('⏹️  [CHAT SETUP] Aborting setup run #', runId, 'after session fetch (stale effect)');
                return;
            }
            if (!session) {
                console.log('❌ [CHAT SETUP] No session found, redirecting to login');
                router.push('/login');
                return;
            }
            const localUserId = session.user.id;
            console.log('✅ [CHAT SETUP] User authenticated:', localUserId);
            console.log('🔍 [CHAT SETUP DEBUG] User email (for identification):', session.user.email);
            setCurrentUserId(localUserId);

            // --- Chat Channel (create first so presence can reference it) ---
            const chatChannelName = `chat:${contentId}`;
            const newChatHandlerId = `${chatSetupRunCountRef.current}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
            const handlerIdForRun = newChatHandlerId;
            chatMessageHandlerIdRef.current = newChatHandlerId;
            chatMessageCallbackCountRef.current = 0;
            console.log('💬 [CHAT] Creating chat channel:', chatChannelName, 'with handlerId:', newChatHandlerId);
            const cChannel = supabase.channel(chatChannelName);
            chatChannelRef.current = cChannel;

            if (!isActive) {
                console.log('⏹️  [CHAT SETUP] Aborting setup run #', runId, 'before registering chat handlers (stale effect)');
                await supabase.removeChannel(cChannel);
                chatChannelRef.current = null;
                return;
            }

            cChannel
                .on('broadcast', { event: 'message' }, ({ payload }) => {
                    if (!isActive || chatMessageHandlerIdRef.current !== handlerIdForRun) {
                        console.log('⏹️  [CHAT] Ignoring message for stale setup run #', runId, 'handler mismatch?', chatMessageHandlerIdRef.current, handlerIdForRun);
                        return;
                    }
                    chatMessageCallbackCountRef.current += 1;
                    const isFromSelf = payload.userId === localUserId;
                    console.log('📨 [CHAT] Received message:', {
                        payload,
                        handlerId: handlerIdForRun,
                        callbackInvocation: chatMessageCallbackCountRef.current,
                        isFromSelf,
                    });
                    if (payload.userId !== localUserId) {
                        setMessages((prev) => {
                            const alreadyExists = prev.some((msg) => msg.id === payload.id);
                            if (alreadyExists) {
                                console.log('♻️  [CHAT] Duplicate message id detected, skipping append:', payload.id, 'handlerId:', handlerIdForRun);
                                return prev;
                            }
                            console.log('✅ [CHAT] Message from other user, adding to messages');
                            return [...prev, payload];
                        });
                    } else {
                        console.log('⏭️  [CHAT] Message from self, skipping');
                    }
                })
                .on('broadcast', { event: 'timer-sync' }, ({ payload }) => {
                    console.log('⏱️  [TIMER SYNC] Received timer sync:', payload);
                    console.log('⏱️  [TIMER SYNC] Current timeLeft:', timeLeft);
                    console.log('⏱️  [TIMER SYNC] Synced timeLeft:', payload.timeLeft);

                    // Only sync if we're the joining user (have more time left)
                    if (timeLeft > payload.timeLeft + 2) { // Allow 2 second buffer
                        console.log('⏱️  [TIMER SYNC] Adjusting timer to match existing user');
                        setTimeLeft(payload.timeLeft);
                    } else {
                        console.log('⏱️  [TIMER SYNC] Skipping sync (we are the existing user or times are close)');
                    }
                })
                .subscribe((status) => {
                    console.log('💬 [CHAT] Subscription status:', status);
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ [CHAT] Chat channel ready!');
                    }
                });

            // --- Presence Channel ---
            const presenceChannelName = `content:${contentId}`;
            console.log('📡 [PRESENCE] Creating presence channel:', presenceChannelName);
            const pChannel = supabase.channel(presenceChannelName);
            presenceChannelRef.current = pChannel;

            if (!isActive) {
                console.log('⏹️  [CHAT SETUP] Aborting setup run #', runId, 'before registering presence handlers (stale effect)');
                await supabase.removeChannel(pChannel);
                presenceChannelRef.current = null;
                return;
            }

            const updatePresence = () => {
                const presenceState = pChannel.presenceState();
                console.log('🔍 [PRESENCE DEBUG] Full presenceState:', JSON.stringify(presenceState, null, 2));
                console.log('🔍 [PRESENCE DEBUG] presenceState keys:', Object.keys(presenceState));
                console.log('🔍 [PRESENCE DEBUG] Current userId (localUserId):', localUserId);

                const userIds = new Set<string>();
                Object.values(presenceState).forEach((presences: any) => {
                    console.log('🔍 [PRESENCE DEBUG] Processing presence array:', presences);
                    presences.forEach((p: any) => {
                        console.log('🔍 [PRESENCE DEBUG] Individual presence object:', p);
                        if (p.userId) {
                            console.log('🔍 [PRESENCE DEBUG] Adding userId to set:', p.userId);
                            userIds.add(p.userId);
                        } else {
                            console.log('⚠️  [PRESENCE DEBUG] Presence missing userId:', p);
                        }
                    });
                });
                console.log('👥 [PRESENCE] Users present:', Array.from(userIds), 'Count:', userIds.size);
                console.log('👥 [PRESENCE] Other user present?', userIds.size > 1);
                console.log('🔍 [PRESENCE DEBUG] Filtering out self - should have:', userIds.size - 1, 'other users');
                setOtherUserPresent(userIds.size > 1);
            };

            pChannel
                .on('presence', { event: 'sync' }, () => {
                    console.log('🔄 [PRESENCE] Sync event');
                    updatePresence();
                })
                .on('presence', { event: 'join' }, (payload) => {
                    console.log('➕ [PRESENCE] Join event:', payload);
                    const previousCount = Object.keys(pChannel.presenceState()).length - 1;
                    updatePresence();

                    // If this is the second user joining, broadcast timer sync
                    if (previousCount === 0 && cChannel) {
                        console.log('⏱️  [TIMER SYNC] Second user joined! Broadcasting current timer...');
                        cChannel.send({
                            type: 'broadcast',
                            event: 'timer-sync',
                            payload: { timeLeft, syncedAt: new Date().toISOString() }
                        });
                    }
                })
                .on('presence', { event: 'leave' }, (payload) => {
                    console.log('➖ [PRESENCE] Leave event:', payload);
                    updatePresence();
                })
                .subscribe(async (status) => {
                    console.log('📡 [PRESENCE] Subscription status:', status);
                    if (status === 'SUBSCRIBED') {
                        const trackData = {
                            userId: localUserId,
                            online_at: new Date().toISOString(),
                            inChat: true
                        };
                        console.log('📍 [PRESENCE] Tracking presence with data:', trackData);
                        await pChannel.track(trackData);
                    }
                });
        };

        setupChannels();

        // **THE FIX**: Cleanup function using the refs
        return () => {
            console.log('🧹 [CLEANUP] Removing channels');
            isActive = false; // Prevent any pending async operations
            if (chatChannelRef.current) {
                supabase.removeChannel(chatChannelRef.current);
                chatChannelRef.current = null;
            }
            if (presenceChannelRef.current) {
                supabase.removeChannel(presenceChannelRef.current);
                presenceChannelRef.current = null;
            }
        };
    }, [contentId]); // Removed 'router' from dependencies as it doesn't change

    // Timer (no changes here)
    useEffect(() => {
        console.log('⏱️  [TIMER] Current timeLeft:', timeLeft, 'seconds');
        console.log('🔍 [TIMER DEBUG] Timer started at:', new Date().toISOString());
        console.log('🔍 [TIMER DEBUG] otherUserPresent:', otherUserPresent);
        console.log('🔍 [TIMER DEBUG] timerExpired:', timerExpired);

        if (timeLeft <= 0) {
            if (!timerExpired) {
                console.log('⏱️  [TIMER] Timer expired! Setting timerExpired to true and redirecting to reading view');
                setTimerExpired(true);
                router.push(`/reading/${contentId}`);
            }
            return;
        }

        if (timeLeft === 300) {
            console.log('🔍 [TIMER DEBUG] Timer initialized at 300 seconds (5 minutes)');
            console.log('⚠️  [TIMER ISSUE] Timer starts immediately when page loads, NOT when second user joins!');
            console.log('⚠️  [TIMER ISSUE] This means two users will have DIFFERENT timers if they join at different times!');
        }

        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                const newTime = prev - 1;
                if (newTime % 60 === 0) { // Log every minute
                    console.log('⏱️  [TIMER] Time remaining:', newTime, 'seconds (', Math.floor(newTime / 60), 'minutes )');
                }
                return newTime;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [timeLeft, timerExpired, otherUserPresent]);

    useEffect(() => {
        if (!messages.length) {
            console.log('🧮 [MESSAGES STATE] Empty messages array');
            return;
        }
        const idOccurrences = messages.reduce<Record<string, number>>((acc, msg) => {
            acc[msg.id] = (acc[msg.id] ?? 0) + 1;
            return acc;
        }, {});
        const duplicateIds = Object.entries(idOccurrences)
            .filter(([, count]) => count > 1)
            .map(([id, count]) => `${id} (x${count})`);
        console.log('🧮 [MESSAGES STATE] Length:', messages.length, 'Duplicate IDs:', duplicateIds);
    }, [messages]);

    const sendMessage = async () => {
        console.log('📤 [SEND] sendMessage called');
        console.log('📤 [SEND] newMessage:', newMessage);
        console.log('📤 [SEND] chatChannelRef.current:', chatChannelRef.current);
        console.log('📤 [SEND] currentUserId:', currentUserId);

        // **THE FIX**: Use the channel instance from the ref
        if (!newMessage.trim()) {
            console.log('⚠️  [SEND] Empty message, aborting');
            return;
        }

        if (!chatChannelRef.current) {
            console.log('❌ [SEND] Chat channel is null, aborting');
            return;
        }

        const message = {
            id: `${Date.now()}-${Math.random()}`,
            text: newMessage,
            userId: currentUserId,
            timestamp: new Date().toISOString(),
        };

        console.log('📤 [SEND] Sending message:', message);
        setMessages((prev) => [...prev, message]);
        setNewMessage('');

        try {
            await chatChannelRef.current.send({
                type: 'broadcast',
                event: 'message',
                payload: message,
            });
            console.log('✅ [SEND] Broadcast successful');
        } catch (err) {
            console.error('❌ [SEND] Broadcast failed:', err);
        }

        try {
            console.log('📤 [SEND] Persisting to backend...');
            const response = await fetch('http://localhost:3001/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId,
                    userId: currentUserId,
                    message: newMessage,
                    timestamp: message.timestamp,
                }),
            });
            console.log('📤 [SEND] Backend response status:', response.status);
            const data = await response.json();
            console.log('📤 [SEND] Backend response data:', data);
        } catch (err) {
            console.error('❌ [SEND] Backend persistence failed:', err);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // --- The rest of your JSX remains the same ---
    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="border-b border-border/30 sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto px-8 py-5 flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <Link
                            href={`/reading/${contentId}`}
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                            ← Read
                        </Link>
                        <div className="border-l border-border/30 pl-6">
                            <h1 className="text-[13px] font-medium truncate max-w-md">{contentTitle}</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${otherUserPresent ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                                <p className="text-[10px] text-muted-foreground">
                                    {otherUserPresent ? 'Connected' : 'Waiting for reader'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono tabular-nums">
                        {formatTime(timeLeft)}
                    </div>
                </div>
            </header>

            {/* Chat Interface */}
            <main className="max-w-4xl w-full mx-auto px-8 flex-1 flex flex-col py-6">
                <div className="flex-1 flex flex-col w-full">
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto px-2 py-6 space-y-5">
                        {messages.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-[12px] text-muted-foreground">
                                    {otherUserPresent ? 'Start the conversation...' : 'Waiting for another reader...'}
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
                                            className={`max-w-[70%] space-y-1.5 ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}
                                        >
                                            <p className="text-[10px] text-muted-foreground">
                                                {isOwnMessage ? 'You' : 'Reader'}
                                            </p>
                                            <div
                                                className={`px-4 py-2.5 rounded-lg ${isOwnMessage
                                                    ? 'bg-foreground text-background'
                                                    : 'bg-muted text-foreground border border-border/30'
                                                    }`}
                                            >
                                                <p className="text-[13px] leading-[1.6]">{msg.text}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="border-t border-border/30 pt-4 pb-2">
                        <div className="flex items-end gap-2">
                            <Input
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                placeholder={!otherUserPresent || timerExpired ? "Waiting for another reader..." : "Type a message..."}
                                className="flex-1 h-10 text-[13px] bg-muted/30 border-border/30"
                                disabled={!otherUserPresent || timerExpired}
                            />
                            <Button
                                onClick={sendMessage}
                                disabled={!newMessage.trim() || !otherUserPresent || timerExpired}
                                className="h-10 px-4 text-[11px] font-normal"
                                variant="outline"
                            >
                                Send
                            </Button>
                        </div>
                    </div>
                </div>
            </main>

        </div>
    );
}