/**
 * jsPDF's built-in fonts only support Latin-1 characters. Normalise common
 * typographic characters and replace anything else so PDFs never show garbage.
 */
export function pdfSafe(input) {
  return String(input ?? '')
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u25CF\u25CB]/g, '-')
    .replace(/[\u00A0\u2009\u200A\u202F]/g, ' ')
    .replace(/[\r\t]/g, ' ')
    .replace(/[^\n\x20-\x7E\u00A1-\u00FF]/g, '?');
}
