import { getQuestionNumbers } from './surveyModel';
import { YES_NO_OPTIONS } from './answers';
import { DEFAULT_DATA_OPTIONS } from './exportFormats';

/*
 * A flat, analysis-ready table built from a survey and its responses. Every data format
 * (CSV, TSV, JSON, NDJSON, XML, SPSS, codebook) is written from this one structure, so they all
 * agree on variable names, codes and values.
 *
 * buildDataset(survey, responses, options) -> {
 *   variables: [{
 *     name,          short unique name:  ResponseNumber, Q1, Q3_2 ...
 *     header,        long column heading: "3. Toppings [Cheese]"
 *     label,         description without the number: "Toppings [Cheese]"
 *     kind,          'numeric' | 'string'
 *     decimals,      numeric only: decimal places seen in the data (0 for codes)
 *     valueLabels,   [{ code, label }] - what each numeric code means (may be empty)
 *     questionNumber, questionText, questionType   ('' for the three response columns)
 *   }],
 *   rows: any[][]    one array per response (oldest first), aligned with `variables`.
 *                    Cells are number | string | null (null = no answer).
 * }
 *
 * Coding rules (when options.values === 'numeric'):
 *   multiple choice / dropdown / grid cell  -> 1-based position of the choice in the survey
 *   yes / no                                -> Yes = 1, No = 2
 *   checkbox, split into columns            -> 1 selected, 0 not selected (null if question unanswered)
 *   checkbox, one column                    -> text such as "1,3" (codes joined by commas)
 * A stored answer that no longer matches any current choice (the survey was edited after the
 * response came in) is never dropped: it gets the next free code after the defined choices.
 */

const MAX_DECIMALS = 6;

const isoUtc = (ms) => (ms === null || ms === undefined || Number.isNaN(Number(ms)) ? null : new Date(Number(ms)).toISOString().replace(/\.\d{3}Z$/, 'Z'));

const isFilled = (v) => v !== undefined && v !== null && String(v).trim() !== '';

const decimalsOf = (n) => {
  const s = String(Math.abs(n));
  if (/e-/i.test(s)) return MAX_DECIMALS;
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : Math.min(MAX_DECIMALS, s.length - dot - 1);
};

/** Labels found in the responses that are not among the survey's current choices (first-seen order). */
function unknownLabels(known, values) {
  const knownSet = new Set(known);
  const extra = new Set();
  for (const v of values) {
    for (const item of Array.isArray(v) ? v : [v]) {
      if (typeof item === 'string' && item !== '' && !knownSet.has(item)) extra.add(item);
    }
  }
  return [...extra];
}

/** { codeOf(label), valueLabels } for a list of labels; the first label gets code 1. */
function codeTable(labels) {
  const map = new Map();
  labels.forEach((label, i) => {
    if (!map.has(label)) map.set(label, i + 1);
  });
  return { codeOf: (label) => map.get(label), valueLabels: labels.map((label, i) => ({ code: i + 1, label })) };
}

const answerOf = (r, q) => r.answers?.[q.id];

/** The columns one question contributes: [{ variable fields, get(response) }]. */
function columnsForQuestion(q, number, responses, opts) {
  const numeric = opts.values === 'numeric';
  const base = `Q${number}`;
  const meta = { questionNumber: number, questionText: q.text || '', questionType: q.type };
  const make = (suffix, sub, fields) => ({
    name: suffix === null ? base : `${base}_${suffix}`,
    header: `${number}. ${q.text || ''}${sub ? ` [${sub}]` : ''}`,
    label: `${q.text || ''}${sub ? ` [${sub}]` : ''}`,
    decimals: 0,
    valueLabels: [],
    ...meta,
    ...fields,
  });
  const present = (get) => responses.map(get).filter(isFilled);

  switch (q.type) {
    case 'number': {
      const num = (r) => {
        const v = answerOf(r, q);
        return isFilled(v) && Number.isFinite(Number(v)) ? Number(v) : null;
      };
      const decimals = Math.max(0, ...responses.map(num).filter((n) => n !== null).map(decimalsOf));
      return [{ ...make(null, '', { kind: 'numeric', decimals }), get: num }];
    }

    case 'rating': {
      const max = Number(q.scaleMax) || 5;
      const valueLabels = [];
      if (String(q.minLabel || '').trim()) valueLabels.push({ code: 1, label: String(q.minLabel).trim() });
      if (String(q.maxLabel || '').trim()) valueLabels.push({ code: max, label: String(q.maxLabel).trim() });
      const get = (r) => {
        const v = answerOf(r, q);
        return isFilled(v) && Number.isFinite(Number(v)) ? Number(v) : null;
      };
      return [{ ...make(null, '', { kind: 'numeric', valueLabels }), get }];
    }

    case 'multiple_choice':
    case 'dropdown':
    case 'yes_no': {
      const known = q.type === 'yes_no' ? YES_NO_OPTIONS : (q.options || []).map((o) => o.label);
      const labels = [...known, ...unknownLabels(known, present((r) => answerOf(r, q)))];
      const { codeOf, valueLabels } = codeTable(labels);
      const get = (r) => {
        const v = answerOf(r, q);
        if (!isFilled(v)) return null;
        return numeric ? codeOf(String(v)) ?? null : String(v);
      };
      return [{ ...make(null, '', numeric ? { kind: 'numeric', valueLabels } : { kind: 'string' }), get }];
    }

    case 'checkboxes': {
      const known = (q.options || []).map((o) => o.label);
      const chosen = (r) => {
        const v = answerOf(r, q);
        return (Array.isArray(v) ? v : isFilled(v) ? [v] : []).filter((x) => typeof x === 'string' && x !== '');
      };
      const labels = [...known, ...unknownLabels(known, responses.map(chosen))];
      const { codeOf, valueLabels } = codeTable(labels);

      if (!opts.splitMulti) {
        const get = (r) => {
          const list = chosen(r);
          if (!list.length) return null;
          return numeric ? list.map((l) => codeOf(l)).join(',') : list.join('; ');
        };
        return [{ ...make(null, '', { kind: 'string', valueLabels: numeric ? valueLabels : [] }), get }];
      }

      return labels.map((label, i) => {
        const get = (r) => {
          const list = chosen(r);
          if (!list.length) return null;
          if (numeric) return list.includes(label) ? 1 : 0;
          return list.includes(label) ? label : null;
        };
        const fields = numeric
          ? { kind: 'numeric', valueLabels: [{ code: 1, label: 'Selected' }, { code: 0, label: 'Not selected' }] }
          : { kind: 'string', valueLabels: [] };
        return { ...make(i + 1, label, fields), get };
      });
    }

    case 'matrix': {
      const known = (q.options || []).map((o) => o.label);
      const cell = (r, row) => {
        const v = answerOf(r, q);
        const chosen = v && typeof v === 'object' ? v[row.id] : undefined;
        return typeof chosen === 'string' && chosen !== '' ? chosen : null;
      };
      const rows = q.rows || [];
      const seen = [];
      for (const r of responses) for (const row of rows) seen.push(cell(r, row));
      const labels = [...known, ...unknownLabels(known, seen)];
      const { codeOf, valueLabels } = codeTable(labels);
      return rows.map((row, i) => {
        const get = (r) => {
          const chosen = cell(r, row);
          if (chosen === null) return null;
          return numeric ? codeOf(chosen) ?? null : chosen;
        };
        return { ...make(i + 1, row.label, numeric ? { kind: 'numeric', valueLabels } : { kind: 'string' }), get };
      });
    }

    default: {
      // short_text, long_text, email, date
      const get = (r) => {
        const v = answerOf(r, q);
        return isFilled(v) ? String(v) : null;
      };
      return [{ ...make(null, '', { kind: 'string' }), get }];
    }
  }
}

export function buildDataset(survey, responses, options = {}) {
  const opts = { ...DEFAULT_DATA_OPTIONS, ...options };
  const numbers = getQuestionNumbers(survey.questions);
  const ordered = [...responses].sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0));

  const blank = { questionNumber: '', questionText: '', questionType: '', decimals: 0, valueLabels: [] };
  const columns = [
    { ...blank, name: 'ResponseNumber', header: '#', label: 'Response number', kind: 'numeric', get: (r, i) => i + 1 },
    { ...blank, name: 'ResponseID', header: 'Response ID', label: 'Response ID', kind: 'string', get: (r) => (isFilled(r.id) ? String(r.id) : null) },
    { ...blank, name: 'SubmittedAt', header: 'Submitted (UTC)', label: 'Submitted (UTC)', kind: 'string', get: (r) => isoUtc(r.submittedAt) },
  ];
  for (const q of survey.questions || []) {
    if (q.type === 'section') continue;
    columns.push(...columnsForQuestion(q, numbers[q.id], ordered, opts));
  }

  const rows = ordered.map((r, i) => columns.map((c) => c.get(r, i)));
  const variables = columns.map(({ get, ...variable }) => variable);
  return { variables, rows };
}

/** The heading of a variable for the chosen header style ('short' | 'full'). */
export const headingOf = (variable, style) => (style === 'full' ? variable.header : variable.name);
