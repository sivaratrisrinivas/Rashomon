import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '@/app/login/page';

const auth = {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signInWithOAuth: jest.fn(() => Promise.resolve({ error: null })),
};
let profilePrefs: string[] | null = [];
const from = jest.fn(() => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: profilePrefs === null ? null : { reading_preferences: profilePrefs } }) }) }),
}));

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn(() => ({ auth, from })) }));

jest.mock('@/lib/navigate', () => ({ navigate: jest.fn() }));
const { navigate: assign } = jest.requireMock('@/lib/navigate') as { navigate: jest.Mock };
beforeAll(() => {
    window.history.pushState({}, '', '/login?next=/reading/abc');
});
beforeEach(() => {
    jest.clearAllMocks();
    profilePrefs = [];
});

const fill = (email: string, password: string) => {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
};

test('shows the email sign-in form and hides Google unless enabled', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Sign In with Google')).not.toBeInTheDocument();
});

test('signs in with password and sends a new reader to onboarding, keeping next', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    render(<LoginPage />);
    fill('a@example.com', 'correct-horse');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/onboarding?next=%2Freading%2Fabc'));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@example.com', password: 'correct-horse' });
});

test('a returning reader with preferences goes straight to next', async () => {
    profilePrefs = ['history'];
    auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    render(<LoginPage />);
    fill('a@example.com', 'correct-horse');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/reading/abc'));
});

test('wrong password shows a generic error and does not navigate', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } });
    render(<LoginPage />);
    fill('a@example.com', 'wrong-pass');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.');
    expect(assign).not.toHaveBeenCalled();
});

test('create account signs up and handles projects that require email confirmation', async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: { id: 'u2' }, session: { access_token: 't' } }, error: null });
    render(<LoginPage />);
    fireEvent.click(screen.getByText('New here? Create an account'));
    fill('b@example.com', 'long-enough');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/onboarding?next=%2Freading%2Fabc'));

    assign.mockClear();
    auth.signUp.mockResolvedValueOnce({ data: { user: { id: 'u3' }, session: null }, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your email');
    expect(assign).not.toHaveBeenCalled();
});

test('rejects short passwords before calling Supabase', async () => {
    render(<LoginPage />);
    fill('a@example.com', 'short');
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 8 characters');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
});
