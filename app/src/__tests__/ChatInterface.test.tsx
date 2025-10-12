import { render, screen } from '@testing-library/react';
import ChatInterface from '@/components/ChatInterface';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
    createClient: jest.fn(() => ({
        channel: jest.fn((_roomName: string) => ({
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn().mockReturnThis(),
            unsubscribe: jest.fn(),
            send: jest.fn(),
        })),
        auth: {
            getUser: jest.fn(() => Promise.resolve({ data: { user: null } })),
        },
    })),
}));

test('renders chat interface with timer', () => {
    render(<ChatInterface roomName="test-room" />);
    expect(screen.getByText('Discussion')).toBeInTheDocument();
    expect(screen.getByText('5:00')).toBeInTheDocument();
});