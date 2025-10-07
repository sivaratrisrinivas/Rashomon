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


    return (
        <>
            <div className="glass mt-12 border border-border/50 overflow-hidden">
                <div className="border-b border-border/30 px-6 py-4 flex items-center justify-between glass">
                    <h2 className="text-[13px] font-light tracking-wide">Discussion</h2>
                    <span className="text-[11px] text-muted-foreground/70 font-mono font-light">
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                </div>
                <div className="p-6 space-y-4 min-h-[280px] max-h-[400px] overflow-y-auto">
                    {messages.map((msg, idx) => (
                        <div key={idx} className="text-[14px] p-4 glass border border-border/30 font-light leading-relaxed hover:scale-[1.01] transition-all duration-300">
                            {msg}
                        </div>
                    ))}
                </div>
                {timeLeft > 0 ? (
                    <div className="border-t border-border/30 p-4 flex gap-3 glass">
                        <Input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Message"
                            className="h-11 text-[13px] border-0 bg-transparent focus-visible:ring-0 font-light placeholder:text-muted-foreground/40"
                        />
                        <Button
                            onClick={sendMessage}
                            variant="ghost"
                            className="h-11 px-5 text-[12px] font-light tracking-wide hover:scale-105 transition-all duration-300 glass border border-border/30"
                        >
                            Send
                        </Button>
                    </div>
                ) : (
                    <div className="text-center py-8 text-[13px] text-muted-foreground/70 font-light">
                        Session ended
                    </div>
                )}
            </div>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="glass border-border/50 shadow-2xl shadow-violet-500/10">
                    <DialogHeader>
                        <DialogTitle className="text-[18px] font-light tracking-tight">Session Complete</DialogTitle>
                        <DialogDescription className="text-[13px] text-muted-foreground/80 leading-relaxed font-light">
                            Your discussion session has ended. Thanks for participating!
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            onClick={() => setShowModal(false)}
                            className="h-11 text-[12px] font-light tracking-wide glass hover:scale-105 transition-all duration-300 border-border/50"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ChatInterface;