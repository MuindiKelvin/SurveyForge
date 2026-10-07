import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { syncMember } from '../services/memberService';
import { clearIdleNotice, markActivity, setIdleNotice, useIdleLogout } from '../hooks/useIdleLogout';

const AuthContext = createContext(null);

const AUTH_MESSAGES = {
  'auth/invalid-email': 'That email address is not valid.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account was found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account with that email already exists. Try signing in instead.',
  'auth/weak-password': 'Choose a stronger password (at least 6 characters).',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled in the Firebase console yet.',
  'auth/unauthorized-domain': 'This domain is not authorised for sign-in. Add it under Firebase console > Authentication > Settings > Authorized domains.',
  'auth/missing-password': 'Enter your password.',
};

export function friendlyAuthError(err) {
  if (err && err.code && AUTH_MESSAGES[err.code]) return AUTH_MESSAGES[err.code];
  return (err && err.message) || 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [version, bump] = useReducer((n) => n + 1, 0);

  useEffect(() => {
    if (!auth) return undefined;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) clearIdleNotice();
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Someone who verifies their email in another tab or app gets the tick as soon as they come back here.
  useEffect(() => {
    if (!user || user.emailVerified) return undefined;
    const recheck = async () => {
      try {
        await reload(user);
        if (user.emailVerified) bump(); // the user object is mutated in place, so force consumers to re-render
      } catch (err) {
        // offline or session expired: keep the current state, the next focus will retry
      }
    };
    window.addEventListener('focus', recheck);
    return () => window.removeEventListener('focus', recheck);
  }, [user]);

  // Publish name + verification status so teammates see the tick. `version` re-runs this after a profile
  // update or a verification re-check; syncMember skips the write when nothing changed.
  useEffect(() => {
    if (!user) return;
    syncMember(user).catch(() => {}); // a failed sync must never affect signing in
  }, [user, version]);

  // Sign the person out after a period with no activity (30 minutes by default).
  const handleIdle = useCallback(async () => {
    setIdleNotice();
    await signOut(auth);
  }, []);
  useIdleLogout({ active: Boolean(user), onIdle: handleIdle });

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      markActivity();
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleProvider); // fall back for browsers that block pop-ups
        return;
      }
      throw err;
    }
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    markActivity();
  }, []);

  const signUpWithEmail = useCallback(async (name, email, password) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    markActivity();
    try {
      await sendEmailVerification(cred.user); // never block sign-up if the email cannot be sent
    } catch (err) {
      // the person can request another one from the account menu
    }
    if (name && name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
      bump(); // the user object is mutated in place, so force consumers to re-render
    }
  }, []);

  /** Sends (another) verification email to the signed-in user. */
  const resendVerification = useCallback(async () => {
    if (!auth || !auth.currentUser) throw new Error('You need to be signed in first.');
    await sendEmailVerification(auth.currentUser);
  }, []);

  /** Re-reads the account from Firebase; resolves to true when the email is now verified. */
  const refreshUser = useCallback(async () => {
    if (!auth || !auth.currentUser) return false;
    await reload(auth.currentUser);
    bump();
    return Boolean(auth.currentUser.emailVerified);
  }, []);

  const resetPassword = useCallback(async (email) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
      resendVerification,
      refreshUser,
      logout,
      version,
    }),
    // `version` is intentionally a dependency so profile and verification updates propagate.
    [user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, resendVerification, refreshUser, logout, version],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
