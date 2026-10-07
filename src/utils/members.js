import { personName } from './format';

/**
 * Whether the person behind a survey's "created by" / "last edited by" name has a verified email.
 *  - `id` is their user id when the survey stored one.
 *  - Older surveys only stored a name; then the name must match exactly one member, otherwise it is not ticked.
 *  - The signed-in person (`me`) is always read live from their own account.
 */
export function isMemberVerified({ me, members, id, name }) {
  if (id) {
    if (me && id === me.uid) return Boolean(me.emailVerified);
    return Boolean(members && members[id] && members[id].emailVerified);
  }
  if (!name || !members) return false;
  const matches = Object.entries(members).filter(([, m]) => m.name === name);
  if (matches.length !== 1) return false;
  const [uid, member] = matches[0];
  if (me && uid === me.uid) return Boolean(me.emailVerified);
  return Boolean(member.emailVerified);
}

/**
 * True when the last save was made by someone other than the creator. The creator saving their own survey
 * must not show up as a second person (which would repeat their name and tick).
 */
export function editedByAnotherPerson({ me, ownerId, ownerName, updatedById, updatedByName }) {
  if (!updatedByName) return false;
  if (updatedById) return updatedById !== ownerId;
  if (updatedByName === ownerName) return false;
  if (me && ownerId === me.uid && updatedByName === personName(me)) return false; // older survey: it is you twice
  return true;
}

/**
 * Which of the "created by" / "last edited by" names gets the verified tick, so one person never gets two.
 *  - no editor shown: the creator's name is ticked if verified.
 *  - the editor is the same person as the creator: only the editor name is ticked (the last name shown).
 *  - two different people: each name is ticked on their own status.
 * `editorShown` says whether the "last edited / saved by" name is displayed at all.
 */
export function creditTicks({ me, members, ownerId, ownerName, updatedById, updatedByName, editorShown }) {
  const creatorVerified = isMemberVerified({ me, members, id: ownerId, name: ownerName });
  if (!editorShown) return { creator: creatorVerified, editor: false };
  if (!editedByAnotherPerson({ me, ownerId, ownerName, updatedById, updatedByName })) return { creator: false, editor: creatorVerified };
  return { creator: creatorVerified, editor: isMemberVerified({ me, members, id: updatedById, name: updatedByName }) };
}

/** The name shown after "Created by": your own current name on your surveys, the stored name on a teammate's. */
export function creatorLabel({ me, ownerId, ownerName }) {
  if (me && ownerId === me.uid) return personName(me) || ownerName || 'a teammate';
  return ownerName || 'a teammate';
}
