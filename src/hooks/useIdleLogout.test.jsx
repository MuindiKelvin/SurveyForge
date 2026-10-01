import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { IDLE_TIMEOUT_MS, markActivity, useIdleLogout } from './useIdleLogout';

const MIN = 60 * 1000;

describe('useIdleLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to 30 minutes', () => {
    expect(IDLE_TIMEOUT_MS).toBe(30 * MIN);
  });

  it('signs out after 30 minutes without activity', async () => {
    const onIdle = vi.fn();
    markActivity();
    renderHook(() => useIdleLogout({ active: true, onIdle }));
    await vi.advanceTimersByTimeAsync(29 * MIN);
    expect(onIdle).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2 * MIN);
    expect(onIdle).toHaveBeenCalled();
  });

  it('activity restarts the 30 minute clock', async () => {
    const onIdle = vi.fn();
    markActivity();
    renderHook(() => useIdleLogout({ active: true, onIdle }));
    await vi.advanceTimersByTimeAsync(20 * MIN);
    window.dispatchEvent(new Event('mousemove'));
    await vi.advanceTimersByTimeAsync(20 * MIN);
    expect(onIdle).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(11 * MIN);
    expect(onIdle).toHaveBeenCalled();
  });

  it('does nothing while nobody is signed in', async () => {
    const onIdle = vi.fn();
    markActivity();
    renderHook(() => useIdleLogout({ active: false, onIdle }));
    await vi.advanceTimersByTimeAsync(2 * 60 * MIN);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('signs out a restored session whose last activity is long past', async () => {
    const onIdle = vi.fn();
    markActivity(Date.now() - 5 * 60 * MIN);
    renderHook(() => useIdleLogout({ active: true, onIdle }));
    await vi.advanceTimersByTimeAsync(0);
    expect(onIdle).toHaveBeenCalled();
  });

  it('does not let the first click after a long absence rescue the session', async () => {
    const onIdle = vi.fn();
    markActivity();
    renderHook(() => useIdleLogout({ active: true, onIdle }));
    vi.setSystemTime(Date.now() + 45 * MIN); // e.g. laptop was asleep; no timer ticks ran
    window.dispatchEvent(new Event('click'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onIdle).toHaveBeenCalled();
  });

  it('counts activity from another tab', async () => {
    const onIdle = vi.fn();
    markActivity();
    renderHook(() => useIdleLogout({ active: true, onIdle }));
    await vi.advanceTimersByTimeAsync(25 * MIN);
    markActivity(); // another tab writes to the shared storage
    await vi.advanceTimersByTimeAsync(25 * MIN);
    expect(onIdle).not.toHaveBeenCalled();
  });
});
