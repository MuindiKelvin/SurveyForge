import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

const toMillis = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null);

function mapSurvey(snap) {
  const d = snap.data();
  return {
    id: snap.id,
    title: d.title || '',
    description: d.description || '',
    status: d.status === 'complete' ? 'complete' : 'draft',
    questions: Array.isArray(d.questions) ? d.questions : [],
    ownerId: d.ownerId,
    ownerName: d.ownerName || '', // who created it (older surveys may not have a name)
    updatedByName: d.updatedByName || '', // who saved it last
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

/** Every survey the team has created (all signed-in users can see all of them), most recently edited first. */
export async function listSurveys() {
  const snap = await getDocs(collection(db, 'surveys'));
  return snap.docs.map(mapSurvey).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** One survey, or null when it does not exist. Any signed-in user may open any survey. */
export async function getSurvey(id) {
  try {
    const snap = await getDoc(doc(db, 'surveys', id));
    if (!snap.exists()) return null;
    return mapSurvey(snap);
  } catch (err) {
    if (err && err.code === 'permission-denied') return null;
    throw err;
  }
}

export async function createSurvey(uid, data) {
  const ref = await addDoc(collection(db, 'surveys'), {
    title: data.title,
    description: data.description,
    questions: data.questions,
    status: data.status,
    ownerId: uid,
    ownerName: data.ownerName || '',
    updatedByName: data.ownerName || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSurvey(id, data) {
  await updateDoc(doc(db, 'surveys', id), {
    title: data.title,
    description: data.description,
    questions: data.questions,
    status: data.status,
    updatedByName: data.updatedByName || '',
    updatedAt: serverTimestamp(),
  });
}

/** The copy belongs to whoever duplicated it. */
export async function duplicateSurvey(uid, survey, ownerName = '') {
  return createSurvey(uid, {
    title: `${survey.title} (copy)`,
    description: survey.description,
    questions: survey.questions,
    status: 'draft',
    ownerName,
  });
}

export async function countResponses(surveyId) {
  const snap = await getCountFromServer(collection(db, 'surveys', surveyId, 'responses'));
  return snap.data().count;
}

async function deleteInChunks(refs) {
  const SIZE = 400;
  for (let i = 0; i < refs.length; i += SIZE) {
    const batch = writeBatch(db);
    refs.slice(i, i + SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

/** Deletes the survey together with its responses and share links (only its creator is allowed to). */
export async function deleteSurveyCascade(surveyId) {
  const responses = await getDocs(collection(db, 'surveys', surveyId, 'responses'));
  await deleteInChunks(responses.docs.map((d) => d.ref));

  // Share links may have been created by any teammate, so match on the survey only.
  const shares = await getDocs(query(collection(db, 'shares'), where('surveyId', '==', surveyId)));
  await deleteInChunks(shares.docs.map((d) => d.ref));

  await deleteDoc(doc(db, 'surveys', surveyId));
}
