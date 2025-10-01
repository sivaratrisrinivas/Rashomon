import { render, screen } from '@testing-library/react';
import ChatInterface from '@/components/ChatInterface';
import { getSupabaseClient } from '@/lib/supabase';

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
    getSupabaseClient: jest.fn(() => ({
        channel: jest.fn((roomName: string) => ({
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn().mockReturnThis(),
            unsubscribe: jest.fn(),
            send: jest.fn(),
        })),
    })),
}));

test('renders chat interface with timer', () => {
    render(<ChatInterface roomName="test-room" />);
    expect(screen.getByText(/Chat \(Time left:/)).toBeInTheDocument();
});