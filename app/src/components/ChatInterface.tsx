'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getSupabaseClient } from '@/lib/supabase';

const ChatInterface = ({ roomName }: { roomName: string }) => {
    const [messages, setMessages] = useState<string[]>([]);
    const [message, setMessage] = useState('');
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

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
                    // End session logic
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
        setMessage('');
    };

    if (timeLeft <= 0) return <div>Session Ended</div>;

    return (
        <div className="border p-4 mt-4">
            <h2>Chat (Time left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')})</h2>
            <div className="space-y-2">
                {messages.map((msg, idx) => <div key={idx}>{msg}</div>)}
            </div>
            <Input value={message} onChange={(e) => setMessage(e.target.value)} />
            <Button onClick={sendMessage}>Send</Button>
        </div>
    );
};

export default ChatInterface;