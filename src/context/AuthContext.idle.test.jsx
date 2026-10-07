import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

let authCallback;
// like Firebase, signing out reports "no user" to the auth listener
const signOut = vi.fn(async () => {
  authCallback(null);
});

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  reload: vi.fn(),
  sendEmailVerification: vi.fn(),
  onAuthStateChanged: (_auth, cb) => {
    authCallback = cb;
    return () => {};
  },
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: (...args) => signOut(...args),
  updateProfile: vi.fn(),
}));
vi.mock('../firebase', () => ({ auth: { fake: true }, googleProvider: {} }));

const { AuthProvider, useAuth } = await import('./AuthContext');
const { hasIdleNotice, clearIdleNotice, markActivity } = await import('../hooks/useIdleLogout');

function Probe() {
  const { user } = useAuth();
  return <div>{user ? 'signed-in' : 'signed-out'}</div>;
}

describe('AuthProvider idle sign-out', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
    window.localStorage.clear();
    clearIdleNotice();
    signOut.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('signs the user out after 30 idle minutes and leaves a notice for the login page', async () => {
    markActivity();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    act(() => authCallback({ uid: 'u1' }));
    expect(screen.getByText('signed-in')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29 * 60 * 1000);
    });
    expect(signOut).not.toHaveBeenCalled();

    // advance in small steps so React can re-render between timer ticks, as it does in a browser
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15 * 1000);
      });
    }
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(hasIdleNotice()).toBe(true);
    expect(screen.getByText('signed-out')).toBeInTheDocument();

    // and it does not keep signing out afterwards
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
