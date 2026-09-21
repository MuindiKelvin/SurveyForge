const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Random alphanumeric id. Uses the browser's cryptographic RNG when available. */
export function randomId(length = 10) {
  const bytes = new Uint8Array(length);
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const newQuestionId = () => `q${randomId(9)}`;
export const newOptionId = () => `o${randomId(7)}`;
/** 24 random characters (~142 bits) - safe to use as an unguessable link id. */
export const newShareId = () => randomId(24);
