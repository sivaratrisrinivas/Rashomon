import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

interface Message {
    userId: string;
    message: string;
    timestamp: string;
}

interface ChatSession {
    id: string;
    highlightedText: string | null;
    transcript: Message[];
    participantCount: number;
    createdAt: string;
}

interface PerspectiveReplayProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessions: ChatSession[];
    currentUserId?: string;
}

export function PerspectiveReplay({
    open,
    onOpenChange,
    sessions,
    currentUserId,
}: PerspectiveReplayProps) {
    const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);

    if (!sessions || sessions.length === 0) return null;

    const selectedSession = sessions[selectedSessionIndex];
    const timeAgo = formatDistanceToNow(new Date(selectedSession.createdAt), { addSuffix: true });

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col glass border-border/50">
                <DialogHeader>
                    <DialogTitle className="text-[16px] font-light tracking-wide">
                        {selectedSession.participantCount} {selectedSession.participantCount === 1 ? 'reader' : 'readers'} discussed this {timeAgo}
                    </DialogTitle>
                    <DialogDescription>
                        View the discussion transcript and highlighted text from this reading session.
                    </DialogDescription>
                </DialogHeader>

                {/* Session selector if multiple sessions */}
                {sessions.length > 1 && (
                    <div className="flex gap-2 mb-4">
                        {sessions.map((session, index) => (
                            <button
                                key={session.id}
                                onClick={() => setSelectedSessionIndex(index)}
                                className={`px-3 py-1 text-xs rounded-full transition-colors ${index === selectedSessionIndex
                                    ? 'bg-orange-700/20 text-orange-700 border border-orange-700/30'
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                    }`}
                            >
                                Discussion {index + 1}
                            </button>
                        ))}
                    </div>
                )}

                {/* Highlighted text context */}
                {selectedSession.highlightedText && (
                    <div className="border-l-2 border-orange-700/30 pl-4 py-2 mb-4">
                        <p className="text-[13px] text-muted-foreground/80 italic font-light leading-relaxed">
                            &ldquo;{selectedSession.highlightedText}&rdquo;
                        </p>
                    </div>
                )}

                {/* Divider */}
                <div className="border-t border-border/30 -mx-6" />

                {/* Transcript */}
                <div className="flex-1 overflow-y-auto space-y-4 py-6 px-1">
                    {selectedSession.transcript.length === 0 ? (
                        <div className="flex items-center justify-center h-32">
                            <p className="text-[13px] text-muted-foreground/70 font-light">
                                No messages in this session
                            </p>
                        </div>
                    ) : (
                        selectedSession.transcript.map((msg, idx) => {
                            const isCurrentUser = currentUserId && msg.userId === currentUserId;
                            return (
                                <div key={idx} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-muted-foreground/60 font-light tracking-wide">
                                            {isCurrentUser ? 'You' : 'Reader'}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">
                                            {formatTime(msg.timestamp)}
                                        </span>
                                    </div>
                                    <div className="glass border border-border/40 rounded-lg px-4 py-2.5">
                                        <p className="text-[14px] leading-[1.7] font-light text-foreground/90">
                                            {msg.message}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

