import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import LoginPage from '@/app/login/page';

test('renders Sign In with Google button', () => {
    render(<LoginPage />);
    expect(screen.getByText('Sign In with Google')).toBeInTheDocument();
});