import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

let mockUser;
const resendVerification = vi.fn();
const refreshUser = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn(), resendVerification, refreshUser }),
  friendlyAuthError: (e) => e.message,
}));
const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../context/ToastContext', () => ({ useToast: () => toast }));

const { default: AppNavbar } = await import('./AppNavbar');

const renderBar = () =>
  render(
    <MemoryRouter>
      <AppNavbar />
    </MemoryRouter>,
  );

describe('AppNavbar email verification tick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the verified tick for a verified email', async () => {
    mockUser = { uid: 'u1', email: 'me@example.com', displayName: 'Me', emailVerified: true };
    renderBar();
    // exactly one tick (after the name), not a second one on the avatar
    expect(screen.getAllByRole('img', { name: 'Email verified' })).toHaveLength(1);
    expect(screen.queryByRole('img', { name: 'Email not verified' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /me/i }));
    expect(screen.getByTestId('email-verified')).toHaveTextContent('Email verified');
    expect(screen.queryByTestId('email-unverified')).not.toBeInTheDocument();
  });

  it('shows no tick, and offers to resend, for an unverified email', async () => {
    mockUser = { uid: 'u1', email: 'me@example.com', displayName: 'Me', emailVerified: false };
    resendVerification.mockResolvedValue();
    renderBar();
    expect(screen.queryByRole('img', { name: 'Email verified' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Email not verified' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /me/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Send link again' }));
    expect(resendVerification).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('tells the person when the email is still not verified after re-checking', async () => {
    mockUser = { uid: 'u1', email: 'me@example.com', displayName: 'Me', emailVerified: false };
    refreshUser.mockResolvedValue(false);
    renderBar();
    await userEvent.click(screen.getByRole('button', { name: /me/i }));
    await userEvent.click(screen.getByRole('button', { name: "I've verified" }));
    await waitFor(() => expect(toast.info).toHaveBeenCalled());
  });
});
