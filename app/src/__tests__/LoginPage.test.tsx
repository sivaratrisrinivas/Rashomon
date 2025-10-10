import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginPage from '@/app/login/page';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
    createClient: jest.fn(() => ({
        auth: {
            signInWithOAuth: jest.fn(() => Promise.resolve({ error: null }))
        }
    }))
}));

test('renders Sign In with Google button', () => {
    render(<LoginPage />);
    expect(screen.getByText('Sign In with Google')).toBeInTheDocument();
});

test('calls signInWithOAuth when button is clicked', async () => {
    const { createClient } = require('@/lib/supabase/client');
    const mockSignInWithOAuth = jest.fn(() => Promise.resolve({ error: null }));
    createClient.mockReturnValue({
        auth: {
            signInWithOAuth: mockSignInWithOAuth
        }
    });

    render(<LoginPage />);

    const button = screen.getByText('Sign In with Google');
    fireEvent.click(button);

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
            redirectTo: expect.stringContaining('/auth/callback')
        }
    });
});