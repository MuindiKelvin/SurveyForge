import { describe, expect, it } from 'vitest';
import { creatorLabel, creditTicks, editedByAnotherPerson, isMemberVerified } from './members';

const members = {
  u2: { name: 'Wanjiku', emailVerified: true },
  u3: { name: 'Brian', emailVerified: false },
  u4: { name: 'Twin', emailVerified: true },
  u5: { name: 'Twin', emailVerified: true },
};

describe('isMemberVerified', () => {
  it('uses the member record for a teammate id', () => {
    expect(isMemberVerified({ members, id: 'u2' })).toBe(true);
    expect(isMemberVerified({ members, id: 'u3' })).toBe(false);
  });

  it('does not tick a teammate who has no record yet', () => {
    expect(isMemberVerified({ members, id: 'u9' })).toBe(false);
    expect(isMemberVerified({ members: {}, id: 'u2' })).toBe(false);
  });

  it('reads the signed-in person live from their own account, not from the stored record', () => {
    expect(isMemberVerified({ me: { uid: 'u3', emailVerified: true }, members, id: 'u3' })).toBe(true);
    expect(isMemberVerified({ me: { uid: 'u2', emailVerified: false }, members, id: 'u2' })).toBe(false);
  });

  it('falls back to a unique name match for older surveys without an id', () => {
    expect(isMemberVerified({ members, name: 'Wanjiku' })).toBe(true);
    expect(isMemberVerified({ members, name: 'Brian' })).toBe(false);
  });

  it('never guesses when a name is missing, unknown or shared by two members', () => {
    expect(isMemberVerified({ members, name: '' })).toBe(false);
    expect(isMemberVerified({ members, name: 'Nobody' })).toBe(false);
    expect(isMemberVerified({ members, name: 'Twin' })).toBe(false);
    expect(isMemberVerified({ name: 'Wanjiku' })).toBe(false);
  });
});

describe('editedByAnotherPerson', () => {
  const me = { uid: 'u1', displayName: 'Kevin Muindi' };

  it('is false when nobody saved or the creator saved their own survey', () => {
    expect(editedByAnotherPerson({ me, ownerId: 'u1', updatedByName: '' })).toBe(false);
    expect(editedByAnotherPerson({ me, ownerId: 'u1', ownerName: 'kevin@x.com', updatedById: 'u1', updatedByName: 'Kevin Muindi' })).toBe(false);
    expect(editedByAnotherPerson({ me, ownerId: 'u1', ownerName: 'Kevin', updatedByName: 'Kevin' })).toBe(false);
  });

  it('treats an older survey (no editor id) saved under your own name as you, not a second person', () => {
    expect(editedByAnotherPerson({ me, ownerId: 'u1', ownerName: 'kevin@x.com', updatedByName: 'Kevin Muindi' })).toBe(false);
  });

  it('is true when a different person saved it', () => {
    expect(editedByAnotherPerson({ me, ownerId: 'u2', ownerName: 'Wanjiku', updatedById: 'u3', updatedByName: 'Brian' })).toBe(true);
    expect(editedByAnotherPerson({ me, ownerId: 'u2', ownerName: 'Wanjiku', updatedByName: 'Brian' })).toBe(true);
    expect(editedByAnotherPerson({ me, ownerId: 'u2', ownerName: 'Wanjiku', updatedByName: 'Kevin Muindi' })).toBe(true); // a teammate's survey that you edited
  });
});

describe('creditTicks', () => {
  const me = { uid: 'u1', displayName: 'Kevin Muindi', emailVerified: true };
  const members = { u2: { name: 'Wanjiku', emailVerified: true }, u3: { name: 'Brian', emailVerified: false } };

  it('ticks only the last name shown when the creator and editor are the same person', () => {
    const t = creditTicks({ me, members, ownerId: 'u1', ownerName: 'kevin@x.com', updatedById: 'u1', updatedByName: 'Kevin Muindi', editorShown: true });
    expect(t).toEqual({ creator: false, editor: true });
  });

  it('ticks the creator when no editor name is shown', () => {
    expect(creditTicks({ me, members, ownerId: 'u1', ownerName: 'Kevin', editorShown: false })).toEqual({ creator: true, editor: false });
  });

  it('ticks each of two different people on their own status', () => {
    const t = creditTicks({ me, members, ownerId: 'u2', ownerName: 'Wanjiku', updatedById: 'u3', updatedByName: 'Brian', editorShown: true });
    expect(t).toEqual({ creator: true, editor: false });
  });
});

describe('creatorLabel', () => {
  const me = { uid: 'u1', displayName: 'Kevin Muindi', email: 'kevin@x.com' };
  it('shows your own current name on your surveys, even when an older survey stored an email', () => {
    expect(creatorLabel({ me, ownerId: 'u1', ownerName: 'kevin@x.com' })).toBe('Kevin Muindi');
  });
  it("shows the stored name on a teammate's survey, with a fallback", () => {
    expect(creatorLabel({ me, ownerId: 'u2', ownerName: 'Wanjiku' })).toBe('Wanjiku');
    expect(creatorLabel({ me, ownerId: 'u2', ownerName: '' })).toBe('a teammate');
  });
});
