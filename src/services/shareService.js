import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { newShareId } from '../utils/ids';

/** Links stop working 24 hours after they are created (enforced by the Firestore security rules). */
export const SHARE_TTL_MS = 24 * 60 * 60 * 1000;

const toMillis = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null);

export function shareUrl(shareId) {
  return `${window.location.origin}/s/${shareId}`;
}

/**
 * Creates a share link. The link holds a snapshot of the survey as it is right now,
 * so later edits never change what people who already have the link see.
 */
export async function createShare(survey, uid, createdByName = '') {
  const shareId = newShareId();
  await setDoc(doc(db, 'shares', shareId), {
    surveyId: survey.id,
    ownerId: uid, // the teammate who created this link
    createdByName,
    title: survey.title,
    description: survey.description,
    questions: survey.questions,
    createdAt: serverTimestamp(),
  });
  return shareId;
}

/** Every share link for a survey (whoever on the team created it), newest first. */
export async function listShares(surveyId) {
  const snap = await getDocs(query(collection(db, 'shares'), where('surveyId', '==', surveyId)));
  return snap.docs
    .map((d) => {
      const data = d.data();
      const createdAt = toMillis(data.createdAt) ?? Date.now();
      return { id: d.id, createdAt, expiresAt: createdAt + SHARE_TTL_MS, createdByName: data.createdByName || '' };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function revokeShare(shareId) {
  await deleteDoc(doc(db, 'shares', shareId));
}

/**
 * Public read used by the respondent page.
 * Returns null when the link does not exist or has expired (Firestore denies the read).
 */
export async function getPublicShare(shareId) {
  try {
    const snap = await getDoc(doc(db, 'shares', shareId));
    if (!snap.exists()) return null;
    const d = snap.data();
    const createdAt = toMillis(d.createdAt);
    return {
      id: snap.id,
      surveyId: d.surveyId,
      title: d.title || '',
      description: d.description || '',
      questions: Array.isArray(d.questions) ? d.questions : [],
      createdAt,
      expiresAt: createdAt ? createdAt + SHARE_TTL_MS : null,
    };
  } catch (err) {
    if (err && err.code === 'permission-denied') return null;
    throw err;
  }
}
