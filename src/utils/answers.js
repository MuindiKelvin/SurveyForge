import { MAX_TEXT_LENGTH } from './surveyModel';

/*
 * Answer formats (what the respondent form holds and what is stored):
 *   short_text, long_text, email, date -> string ('YYYY-MM-DD' for dates)
 *   number                             -> string while typing, number once cleaned
 *   rating                             -> number
 *   yes_no                             -> 'Yes' | 'No'
 *   multiple_choice, dropdown          -> the chosen option's label
 *   checkboxes                         -> array of chosen option labels
 *   matrix                             -> { [rowId]: chosen column label }
 */

export const YES_NO_OPTIONS = ['Yes', 'No'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const labelsOf = (list) => (list || []).map((o) => o.label);

/** Effective selection limit for a checkbox question (0 = unlimited). */
export function selectionLimit(q) {
  const n = Number(q.maxSelections) || 0;
  if (n <= 0) return 0;
  return n >= (q.options || []).length ? 0 : n;
}

export function isAnswered(q, value) {
  if (value === undefined || value === null) return false;
  switch (q.type) {
    case 'checkboxes':
      return Array.isArray(value) && value.length > 0;
    case 'matrix':
      return typeof value === 'object' && Object.values(value).some((v) => typeof v === 'string' && v !== '');
    case 'rating':
      return value !== '' && Number.isFinite(Number(value));
    case 'number':
      return String(value).trim() !== '';
    default:
      return String(value).trim() !== '';
  }
}

/** Returns { [questionId]: message } for every problem found. Empty object = valid. */
export function validateAnswers(questions, answers) {
  const errors = {};
  for (const q of questions) {
    if (q.type === 'section') continue;
    const value = answers[q.id];
    const answered = isAnswered(q, value);

    if (q.required && !answered) {
      errors[q.id] = q.type === 'matrix' ? 'Please answer every row.' : 'This question is required.';
      continue;
    }
    if (!answered) continue;

    if (q.type === 'matrix') {
      const rows = q.rows || [];
      if (q.required && rows.some((r) => !value[r.id])) errors[q.id] = 'Please answer every row.';
    } else if (q.type === 'email' && !EMAIL_RE.test(String(value).trim())) {
      errors[q.id] = 'Enter a valid email address.';
    } else if (q.type === 'number' && !Number.isFinite(Number(value))) {
      errors[q.id] = 'Enter a valid number.';
    } else if (q.type === 'checkboxes') {
      const limit = selectionLimit(q);
      if (limit && value.length > limit) errors[q.id] = `Select no more than ${limit}.`;
    } else if (q.type === 'short_text' || q.type === 'long_text') {
      if (String(value).length > MAX_TEXT_LENGTH) errors[q.id] = `Please keep this under ${MAX_TEXT_LENGTH} characters.`;
    }
  }
  return errors;
}

/** Convert the raw form state into what gets stored: unanswered/invalid entries are dropped. */
export function cleanAnswers(questions, answers) {
  const out = {};
  for (const q of questions) {
    if (q.type === 'section') continue;
    const value = answers[q.id];
    if (!isAnswered(q, value)) continue;

    switch (q.type) {
      case 'number':
        out[q.id] = Number(value);
        break;
      case 'rating': {
        const n = Number(value);
        if (n >= 1 && n <= (Number(q.scaleMax) || 5)) out[q.id] = n;
        break;
      }
      case 'yes_no':
        if (YES_NO_OPTIONS.includes(value)) out[q.id] = value;
        break;
      case 'multiple_choice':
      case 'dropdown':
        if (labelsOf(q.options).includes(value)) out[q.id] = value;
        break;
      case 'checkboxes': {
        const valid = labelsOf(q.options).filter((label) => value.includes(label)); // keeps option order
        if (valid.length) out[q.id] = valid;
        break;
      }
      case 'matrix': {
        const cols = labelsOf(q.options);
        const cleaned = {};
        for (const row of q.rows || []) {
          const chosen = value[row.id];
          if (typeof chosen === 'string' && cols.includes(chosen)) cleaned[row.id] = chosen;
        }
        if (Object.keys(cleaned).length) out[q.id] = cleaned;
        break;
      }
      default:
        out[q.id] = String(value).trim().slice(0, MAX_TEXT_LENGTH);
    }
  }
  return out;
}
