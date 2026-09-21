/**
 * Company details printed on every downloaded document (PDF / Word / Excel).
 * Change them here and every document picks up the new values.
 */
export const COMPANY = {
  name: 'PAYONEER',
  tagline: 'RESEARCH & ANALYTICS',
  fullName: 'Payoneer Research & Analytics',
  website: 'www.payoneerltd.com',
  phone: '0729 372 659',
  email: 'payoneerlimitedinfo@gmail.com',
  location: 'Nairobi, Kenya',
};

/** The one-line contact block shown in the footer of every document. */
export const CONTACT_LINE = `Call/WhatsApp ${COMPANY.phone} | ${COMPANY.email} / ${COMPANY.location}`;

/** Colours taken from the Payoneer logo. */
export const BRAND = {
  navy: '0B2240', // logo background
  blue: '2F7AE5', // logo arrow / accent
  rule: 'C9D3E0', // light divider line
  muted: '6E767A',
};

/** '0B2240' -> [11, 34, 64] (jsPDF wants RGB triplets). */
export const hexToRgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
