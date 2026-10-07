import { useEffect, useState } from 'react';
import { listMembers } from '../services/memberService';

/** Loads the team's verification status once: { [uid]: { name, emailVerified } }. Empty if it cannot be read. */
export function useMembers() {
  const [members, setMembers] = useState({});
  useEffect(() => {
    let cancelled = false;
    listMembers()
      .then((m) => {
        if (!cancelled) setMembers(m);
      })
      .catch(() => {}); // ticks are a nicety: never break the page
    return () => {
      cancelled = true;
    };
  }, []);
  return members;
}
