// The circular company logo lives in src/assets. "?datauri" (see vite.config.js) embeds it as a base64
// data-URI, so the PDF / Word exporters can use it instantly - no network request needed,
// which also means downloads work offline and inside the automated tests.
import circleLogo from '../assets/payoneer-logo-circle.png?datauri';

/** data:image/png;base64,... (used by jsPDF) */
export const LOGO_DATA_URI = circleLogo;

/** The same image as raw PNG bytes (used by the Word exporter). */
export function getLogoBytes() {
  const base64 = LOGO_DATA_URI.slice(LOGO_DATA_URI.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
