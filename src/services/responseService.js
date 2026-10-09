import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
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

/** Survey creator only (enforced by the Firestore rules). */
export async function deleteResponse(surveyId, responseId) {
  await deleteDoc(doc(db, 'surveys', surveyId, 'responses', responseId));
}

/** Deletes every response of the survey, including any beyond the ones loaded on screen. Returns the count. */
export async function deleteAllResponses(surveyId) {
  const col = collection(db, 'surveys', surveyId, 'responses');
  let total = 0;
  for (;;) {
    const snap = await getDocs(query(col, limit(400)));
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
  return total;
}
