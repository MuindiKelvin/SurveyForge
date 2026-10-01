import { useEffect, useRef } from 'react';

const DEFAULT_IDLE_MINUTES = 30;

/**
 * How long a signed-in person may be inactive before being signed out.
 * 30 minutes by default; set VITE_IDLE_TIMEOUT_MINUTES in .env to change it (handy for testing).
 */
function resolveTimeoutMs() {
  const minutes = Number(import.meta.env?.VITE_IDLE_TIMEOUT_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_IDLE_MINUTES) * 60 * 1000;
}

export const IDLE_TIMEOUT_MS = resolveTimeoutMs();

const ACTIVITY_KEY = 'sf:lastActivity'; // localStorage: shared by every tab of the app
const NOTICE_KEY = 'sf:idleLogout'; // sessionStorage: tells the login page why the person was signed out
const CHECK_INTERVAL_MS = 15 * 1000;
const WRITE_THROTTLE_MS = 5 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart', 'click'];

function readStoredActivity() {
  try {
    const value = Number(window.localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeStoredActivity(ms) {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(ms));
  } catch {
    /* storage blocked: the in-memory copy still works for this tab */
  }
}

/** Record "the person is here right now" (also shared with other open tabs). */
export function markActivity(now = Date.now()) {
  writeStoredActivity(now);
}

export function setIdleNotice() {
  try {
    window.sessionStorage.setItem(NOTICE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function hasIdleNotice() {
  try {
    return window.sessionStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearIdleNotice() {
  try {
    window.sessionStorage.removeItem(NOTICE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Calls `onIdle` once the person has not touched the mouse, keyboard, screen or scroll for `timeoutMs`.
 *
 * - Activity in ANY open tab counts (the timestamp lives in localStorage).
 * - Uses the wall clock, so a sleeping laptop or a throttled background tab is still caught
 *   as soon as the person comes back, before any new activity can "rescue" the session.
 * - Activity is tracked even while signed out, so a fresh sign-in always starts with a full window;
 *   the timeout is only enforced while `active` is true.
 */
export function useIdleLogout({ active, onIdle, timeoutMs = IDLE_TIMEOUT_MS }) {
  const activeRef = useRef(active);
  const onIdleRef = useRef(onIdle);
  const lastSeenRef = useRef(0); // this tab's own latest activity (fallback if storage is blocked)
  const lastWriteRef = useRef(0);
  const busyRef = useRef(false);

  activeRef.current = active;
  onIdleRef.current = onIdle;

  useEffect(() => {
    const lastActivity = () => Math.max(readStoredActivity(), lastSeenRef.current);

    const fireIdle = () => {
      if (busyRef.current) return;
      busyRef.current = true;
      Promise.resolve()
        .then(() => onIdleRef.current())
        .catch((err) => console.error(err))
        .finally(() => {
          busyRef.current = false;
        });
    };

    /** Returns true when the idle limit has been passed and the sign-out was started. */
    const checkIdle = () => {
      if (!activeRef.current) return false;
      const last = lastActivity();
      const now = Date.now();
      if (!last) {
        // Nothing recorded yet (e.g. storage was cleared): start the clock now.
        lastSeenRef.current = now;
        writeStoredActivity(now);
        return false;
      }
      if (now - last >= timeoutMs) {
        fireIdle();
        return true;
      }
      return false;
    };

    const onActivity = () => {
      if (checkIdle()) return; // came back after the limit: do not let this event extend the session
      const now = Date.now();
      lastSeenRef.current = now;
      if (now - lastWriteRef.current < WRITE_THROTTLE_MS) return;
      lastWriteRef.current = now;
      writeStoredActivity(now);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkIdle();
    };

    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true, capture: true }));
    window.addEventListener('focus', checkIdle);
    document.addEventListener('visibilitychange', onVisibility);
    const timer = setInterval(checkIdle, CHECK_INTERVAL_MS);
    checkIdle(); // a session restored after a long absence is signed out straight away

    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity, { capture: true }));
      window.removeEventListener('focus', checkIdle);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(timer);
    };
  }, [timeoutMs]);
}
