import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PerspectiveReplay } from '../PerspectiveReplay';

// Mock date-fns
jest.mock('date-fns', () => ({
    formatDistanceToNow: jest.fn(() => '2 days ago'),
}));

describe('PerspectiveReplay', () => {
    const mockSession = {
        id: 'session-1',
        highlightedText: 'This is the highlighted text that was discussed',
        transcript: [
            {
                userId: 'user-1',
                message: 'This is interesting!',
                timestamp: '2025-10-05T10:00:00Z',
            },
            {
                userId: 'user-2',
                message: 'I agree completely',
                timestamp: '2025-10-05T10:01:00Z',
            },
        ],
        participantCount: 2,
        createdAt: '2025-10-05T10:00:00Z',
    };

    test('renders nothing when sessions is empty', () => {
        const { container } = render(
            <PerspectiveReplay
                open={true}
                onOpenChange={jest.fn()}
                sessions={[]}
                currentUserId="user-1"
            />
        );

        // Dialog shouldn't render anything meaningful without sessions
        expect(container.firstChild).toBeNull();
    });

    test('renders session metadata correctly', () => {
        render(
            <PerspectiveReplay
                open={true}
                onOpenChange={jest.fn()}
                sessions={[mockSession]}
                currentUserId="user-1"
            />
        );

        // Check for participant count and time
        expect(screen.getByText(/2 readers discussed this/i)).toBeInTheDocument();
        expect(screen.getByText(/2 days ago/i)).toBeInTheDocument();
    });

    test('renders highlighted text when present', () => {
        render(
            <PerspectiveReplay
                open={true}
                onOpenChange={jest.fn()}
                sessions={[mockSession]}
                currentUserId="user-1"
            />
        );

        expect(screen.getByText(/This is the highlighted text that was discussed/i)).toBeInTheDocument();
    });

    test('renders all messages in transcript', () => {
        render(
            <PerspectiveReplay
                open={true}
                onOpenChange={jest.fn()}
                sessions={[mockSession]}
                currentUserId="user-1"
            />
        );

        expect(screen.getByText('This is interesting!')).toBeInTheDocument();
        expect(screen.getByText('I agree completely')).toBeInTheDocument();
    });

    test('shows "You" for current user messages', () => {
        render(
            <PerspectiveReplay
                open={true}
                onOpenChange={jest.fn()}
                sessions={[mockSession]}
                currentUserId="user-1"
            />
        );

        const youLabels = screen.getAllByText('You');
        expect(youLabels.length).toBeGreaterThan(0);
    });

    test('shows "Reader" for other user messages', () => {
        render(
            <PerspectiveReplay
                open={true}
                onOpenChange={jest.fn()}
                sessions={[mockSession]}
                currentUserId="user-1"
            />
        );

        const readerLabels = screen.getAllByText('Reader');
        expect(readerLabels.length).toBeGreaterThan(0);
    });

    test('handles session with no transcript', () => {
        const emptySession = {
            ...mockSession,
            transcript: [],
        };

        render(
            <PerspectiveReplay
                open={true}
                onOpenChange={jest.fn()}
                sessions={[emptySession]}
                currentUserId="user-1"
            />
        );

        expect(screen.getByText('No messages in this session')).toBeInTheDocument();
    });

    test('handles session without highlighted text', () => {
        const sessionWithoutHighlight = {
            ...mockSession,
            highlightedText: null,
        };

        render(
            <PerspectiveReplay
                open={true}
                onOpenChange={jest.fn()}
                sessions={[sessionWithoutHighlight]}
                currentUserId="user-1"
            />
        );

        // Should still render transcript
        expect(screen.getByText('This is interesting!')).toBeInTheDocument();
        // But no highlighted text block
        expect(screen.queryByText(/This is the highlighted text/i)).not.toBeInTheDocument();
    });

    test('uses singular "reader" for single participant', () => {
        const singleParticipantSession = {
            ...mockSession,
            participantCount: 1,
        };

        render(
            <PerspectiveReplay
                open={true}
                onOpenChange={jest.fn()}
                sessions={[singleParticipantSession]}
                currentUserId="user-1"
            />
        );

        expect(screen.getByText(/1 reader discussed this/i)).toBeInTheDocument();
    });
});

