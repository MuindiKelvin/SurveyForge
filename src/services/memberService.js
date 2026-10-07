import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { personName } from '../utils/format';

let lastSynced = ''; // avoids writing the same profile twice in one session

/**
 * Publishes the signed-in person's name and email-verification status to `members/{uid}` so teammates can
 * see a verified tick next to their name. The Firestore rules only accept `emailVerified: true` when
 * Firebase itself says the email is verified, so nobody can fake it.
 */
export async function syncMember(user) {
  if (!db || !user || !user.uid) return;
  const verified = Boolean(user.emailVerified);
  const name = personName(user);
  const key = `${user.uid}|${name}|${verified}`;
  if (key === lastSynced) return;

  // The rules read the verification flag from the sign-in token, so make sure the token is current.
  if (verified && typeof user.getIdTokenResult === 'function') {
    const result = await user.getIdTokenResult();
    if (result.claims.email_verified !== true) await user.getIdToken(true);
  }

  await setDoc(doc(db, 'members', user.uid), { name, emailVerified: verified, updatedAt: serverTimestamp() });
  lastSynced = key;
}

/** Everyone who has signed in since members were introduced: { [uid]: { name, emailVerified } }. */
export async function listMembers() {
  if (!db) return {};
  const snap = await getDocs(collection(db, 'members'));
  const map = {};
  snap.forEach((d) => {
    const data = d.data();
    map[d.id] = { name: data.name || '', emailVerified: data.emailVerified === true };
  });
  return map;
}
