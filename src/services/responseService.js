import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const MAX_RESPONSES_LOADED = 5000;

const toMillis = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null);

/** Called from the public page - no sign-in needed. Allowed only while the share link is valid. */
export async function submitResponse({ surveyId, shareId, answers }) {
  await addDoc(collection(db, 'surveys', surveyId, 'responses'), {
    shareId,
    answers,
    submittedAt: serverTimestamp(),
  });
}

/** Owner only. Newest first. */
export async function listResponses(surveyId) {
  const snap = await getDocs(
    query(collection(db, 'surveys', surveyId, 'responses'), orderBy('submittedAt', 'desc'), limit(MAX_RESPONSES_LOADED)),
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, shareId: data.shareId, answers: data.answers || {}, submittedAt: toMillis(data.submittedAt) };
  });
}
