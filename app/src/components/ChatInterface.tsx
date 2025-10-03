'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { getSupabaseClient } from '@/lib/supabase';

const ChatInterface = ({ roomName }: { roomName: string }) => {
    const [messages, setMessages] = useState<string[]>([]);
    const [message, setMessage] = useState('');
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
    const [showModal, setShowModal] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

    useEffect(() => {
        const supabase = getSupabaseClient();
        const channel = supabase.channel(roomName);
        channel
            .on('broadcast', { event: 'message' }, ({ payload }) => {
                setMessages((prev) => [...prev, payload.message]);
            })
            .subscribe();

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setShowModal(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            channel.unsubscribe();
            clearInterval(timer);
        };
    }, [roomName]);

    const sendMessage = async () => {
        const supabase = getSupabaseClient();
        const channel = supabase.channel(roomName);
        await channel.send({
            type: 'broadcast',
            event: 'message',
            payload: { message },
        });

        // Persist message to database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await fetch('http://localhost:3001/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    highlightId: roomName.split(':')[1],
                    message,
                    userId: user.id
                }),
            });
        }

        setMessage('');
    };

    const generateInvite = async () => {
        setIsGeneratingInvite(true);
        try {
            const sessionId = roomName.split(':')[1];

            const response = await fetch('http://localhost:3001/invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });

            const result = await response.json();
            if (result.link) {
                setInviteLink(result.link);
            }
        } catch (error) {
            console.error('Failed to generate invite:', error);
        } finally {
            setIsGeneratingInvite(false);
        }
    };

    const copyInviteLink = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
        }
    };

    return (
        <>
            <div className="border border-border/30 mt-8">
                <div className="border-b border-border/30 px-4 py-3 flex items-center justify-between">
                    <h2 className="text-[12px] font-medium">Discussion</h2>
                    <span className="text-[11px] text-muted-foreground font-mono">
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                </div>
                <div className="p-4 space-y-3 min-h-[200px]">
                    {messages.map((msg, idx) => (
                        <div key={idx} className="text-[13px] p-2 bg-muted">
                            {msg}
                        </div>
                    ))}
                </div>
                {timeLeft > 0 ? (
                    <div className="border-t border-border/30 p-3 flex gap-2">
                        <Input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Message"
                            className="h-9 text-[13px] border-0 bg-transparent focus-visible:ring-0"
                        />
                        <Button
                            onClick={sendMessage}
                            variant="ghost"
                            className="h-9 px-3 text-[12px] font-normal"
                        >
                            Send
                        </Button>
                    </div>
                ) : (
                    <div className="text-center py-6 text-[12px] text-muted-foreground">
                        Session ended
                    </div>
                )}
            </div>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="border-border/50">
                    <DialogHeader>
                        <DialogTitle className="text-[14px] font-medium">Share Rashomon</DialogTitle>
                        <DialogDescription className="text-[12px] text-muted-foreground leading-relaxed">
                            Invite someone to experience this platform
                        </DialogDescription>
                    </DialogHeader>

                    {inviteLink ? (
                        <div className="space-y-3">
                            <div className="p-3 bg-muted">
                                <p className="text-[11px] font-mono break-all">{inviteLink}</p>
                            </div>
                            <Button
                                onClick={copyInviteLink}
                                variant="outline"
                                className="w-full h-9 text-[12px] font-normal"
                            >
                                Copy
                            </Button>
                        </div>
                    ) : (
                        <DialogFooter className="flex-col sm:flex-row gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => setShowModal(false)}
                                className="h-9 text-[12px] font-normal"
                            >
                                Not now
                            </Button>
                            <Button
                                onClick={generateInvite}
                                disabled={isGeneratingInvite}
                                variant="outline"
                                className="h-9 text-[12px] font-normal"
                            >
                                {isGeneratingInvite ? 'Generating' : 'Generate invite'}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ChatInterface;