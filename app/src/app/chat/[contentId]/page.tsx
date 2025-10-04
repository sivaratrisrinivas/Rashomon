'use client';

import { use, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { getSupabaseClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Copy, Check } from 'lucide-react';

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
    const [showModal, setShowModal] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isInitiator, setIsInitiator] = useState(false);
    const [timerExpired, setTimerExpired] = useState(false);
    const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
    const [initiatorId, setInitiatorId] = useState<string | null>(null);

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
                .on('broadcast', { event: 'timer_sync' }, (payload) => {
                    // Sync timer with other users
                    const { startTime, initiatorId: broadcastInitiatorId } = payload.payload;
                    if (startTime && !timerStartTime) {
                        setTimerStartTime(startTime);
                        setInitiatorId(broadcastInitiatorId);
                        console.log('⏱️ Timer synced from broadcast:', new Date(startTime));
                    }
                })
                .subscribe();

            setChatChannel(cChannel);

            // Determine if this user is the initiator (first to join)
            const presenceState = pChannel.presenceState();
            const allUsers: string[] = [];
            Object.values(presenceState).forEach((presences: any) => {
                presences.forEach((presence: any) => {
                    if (presence.userId && !allUsers.includes(presence.userId)) {
                        allUsers.push(presence.userId);
                    }
                });
            });

            const isFirst = allUsers.length === 0 || (allUsers.length === 1 && allUsers[0] === session.user.id);

            if (isFirst) {
                // This user is the initiator - start the timer
                const startTime = Date.now();
                setTimerStartTime(startTime);
                setIsInitiator(true);
                setInitiatorId(session.user.id);
                console.log('🎬 Initiator joined, starting timer');

                // Broadcast timer start to others
                setTimeout(() => {
                    cChannel.send({
                        type: 'broadcast',
                        event: 'timer_sync',
                        payload: { startTime, initiatorId: session.user.id },
                    });
                }, 500);
            } else {
                // This user joined second - wait for timer sync
                console.log('👋 Second user joined, waiting for timer sync');
            }
        };

        setupChannels();

        return () => {
            if (chatChannel) chatChannel.unsubscribe();
            if (presenceChannel) presenceChannel.unsubscribe();
        };
    }, [contentId, router, timerStartTime]);

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

            // Save message to backend
            const response = await fetch('http://localhost:3001/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: contentId,
                    userId: session.user.id,
                    message: newMessage,
                    timestamp: message.timestamp,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.sessionId && !sessionId) {
                    setSessionId(data.sessionId);
                    // First message sender is the initiator
                    if (messages.length === 0) {
                        setIsInitiator(true);
                    }
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const generateInvite = async () => {
        if (!sessionId) {
            console.error('No session ID available');
            return;
        }

        setIsGeneratingInvite(true);
        try {
            const response = await fetch('http://localhost:3001/invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });

            if (response.ok) {
                const data = await response.json();
                setInviteLink(data.link);
            }
        } catch (error) {
            console.error('Error generating invite:', error);
        } finally {
            setIsGeneratingInvite(false);
        }
    };

    const copyInviteLink = async () => {
        if (inviteLink) {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Sync timer display based on startTime
    useEffect(() => {
        if (!timerStartTime) return;

        const updateTimer = () => {
            const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
            const remaining = Math.max(0, 300 - elapsed);
            setTimeLeft(remaining);

            if (remaining === 0) {
                setTimerExpired(true);
            }
        };

        updateTimer(); // Update immediately
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [timerStartTime]);

    // Show modal when timer expires AND user is the initiator
    useEffect(() => {
        if (timerExpired && isInitiator) {
            setShowModal(true);
        }
    }, [timerExpired, isInitiator]);

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header - Redesigned */}
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
                                <div className={`w-1.5 h-1.5 rounded-full ${otherUserPresent ? 'bg-foreground' : 'bg-muted-foreground'}`} />
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

            {/* Chat Interface - Redesigned */}
            <main className="max-w-4xl mx-auto px-8 flex-1 flex flex-col py-6">
                <div className="flex-1 flex flex-col">
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto px-2 py-6 space-y-5">
                        {messages.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center space-y-2">
                                    <p className="text-[12px] text-muted-foreground">
                                        {!otherUserPresent
                                            ? 'Waiting for another reader'
                                            : isInitiator
                                                ? 'Start the conversation'
                                                : 'Waiting for the first message'}
                                    </p>
                                    {!otherUserPresent && (
                                        <p className="text-[10px] text-muted-foreground/60">
                                            You'll be notified when someone joins
                                        </p>
                                    )}
                                    {otherUserPresent && !isInitiator && (
                                        <p className="text-[10px] text-muted-foreground/60">
                                            The initiator will send the first message
                                        </p>
                                    )}
                                </div>
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
                                            <div className="flex items-center gap-2">
                                                <p className="text-[10px] text-muted-foreground">
                                                    {isOwnMessage ? 'You' : 'Reader'}
                                                </p>
                                                <p className="text-[9px] text-muted-foreground/50">
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <div
                                                className={`px-4 py-2.5 ${isOwnMessage
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

                    {/* Input Area - Streamlined */}
                    <div className="border-t border-border/30 pt-4 pb-2">
                        <div className="flex items-end gap-2">
                            <Input
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                placeholder={
                                    !otherUserPresent
                                        ? "Waiting for another reader..."
                                        : messages.length === 0 && !isInitiator
                                            ? "Waiting for first message..."
                                            : "Type a message..."
                                }
                                className="flex-1 h-10 text-[13px] bg-muted/30 border-border/30"
                                disabled={!otherUserPresent || (messages.length === 0 && !isInitiator)}
                            />
                            <Button
                                onClick={sendMessage}
                                disabled={!newMessage.trim() || !otherUserPresent || (messages.length === 0 && !isInitiator)}
                                className="h-10 px-4 text-[11px] font-normal"
                                variant="outline"
                            >
                                Send
                            </Button>
                        </div>
                        <p className="text-[9px] text-muted-foreground/60 mt-2 pl-1">
                            {messages.length === 0 && isInitiator ? "You can start the conversation" : "Press Enter to send"}
                        </p>
                    </div>
                </div>
            </main>

            {/* Post-Chat Invite Modal - Redesigned */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent data-testid="aha-modal" className="border-border/30 max-w-md">
                    <DialogHeader className="space-y-3">
                        <DialogTitle className="text-[14px] font-medium">Enjoyed the conversation?</DialogTitle>
                        <DialogDescription className="text-[11px] text-muted-foreground leading-relaxed">
                            Share Rashomon with someone who'd appreciate spontaneous discussions around reading
                        </DialogDescription>
                    </DialogHeader>

                    {inviteLink ? (
                        <div className="space-y-3 pt-2">
                            <div className="p-3 bg-muted/50 border border-border/30 flex items-center gap-2">
                                <p className="text-[10px] font-mono break-all flex-1 text-muted-foreground" data-testid="invite-link">
                                    {inviteLink}
                                </p>
                                <Button
                                    onClick={copyInviteLink}
                                    size="icon"
                                    variant="ghost"
                                    className="shrink-0 h-7 w-7"
                                    title="Copy link"
                                >
                                    {copied ? (
                                        <Check className="h-3.5 w-3.5" />
                                    ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                    )}
                                </Button>
                            </div>
                            <Button
                                onClick={copyInviteLink}
                                variant="outline"
                                className="w-full h-9 text-[11px] font-normal"
                                disabled={copied}
                            >
                                {copied ? 'Copied to clipboard' : 'Copy invite link'}
                            </Button>
                        </div>
                    ) : (
                        <DialogFooter className="flex-row gap-2 pt-2">
                            <Button
                                variant="ghost"
                                onClick={() => setShowModal(false)}
                                className="flex-1 h-9 text-[11px] font-normal"
                            >
                                Not now
                            </Button>
                            <Button
                                onClick={generateInvite}
                                disabled={isGeneratingInvite}
                                variant="outline"
                                data-testid="yes-invite-button"
                                className="flex-1 h-9 text-[11px] font-normal"
                            >
                                {isGeneratingInvite ? 'Generating...' : 'Generate link'}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

