import { getQuestionNumbers } from './surveyModel';
import { YES_NO_OPTIONS } from './answers';
import { formatDateTime } from './format';

const round2 = (n) => Math.round(n * 100) / 100;

export const pct = (count, total) => (total > 0 ? Math.round((count / total) * 1000) / 10 : 0);

function choiceStats(labels, values, multi) {
  const counts = new Map(labels.map((l) => [l, 0]));
  let answered = 0;
  for (const v of values) {
    const items = (multi ? (Array.isArray(v) ? v : [v]) : [v]).filter((x) => typeof x === 'string' && x !== '');
    if (!items.length) continue;
    answered += 1;
    for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
  }
  return { kind: 'choice', labels: [...counts.keys()], counts: [...counts.values()], answered };
}

function statFor(q, responses) {
  const values = responses.map((r) => r.answers?.[q.id]);
  const present = values.filter((v) => v !== undefined && v !== null && v !== '');

  switch (q.type) {
    case 'multiple_choice':
    case 'dropdown':
      return choiceStats((q.options || []).map((o) => o.label), present, false);
    case 'yes_no':
      return choiceStats(YES_NO_OPTIONS, present, false);
    case 'checkboxes':
      return { ...choiceStats((q.options || []).map((o) => o.label), present, true), multi: true };
    case 'rating': {
      const max = Number(q.scaleMax) || 5;
      const labels = Array.from({ length: max }, (_, i) => String(i + 1));
      const counts = new Array(max).fill(0);
      let sum = 0;
      let answered = 0;
      for (const v of present) {
        const n = Number(v);
        if (Number.isInteger(n) && n >= 1 && n <= max) {
          counts[n - 1] += 1;
          sum += n;
          answered += 1;
        }
      }
      return { kind: 'rating', labels, counts, answered, average: answered ? round2(sum / answered) : null };
    }
    case 'number': {
      const nums = present.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
      const answered = nums.length;
      const sum = nums.reduce((a, b) => a + b, 0);
      let median = null;
      if (answered) {
        const mid = Math.floor(answered / 2);
        median = answered % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
      }
      return {
        kind: 'number',
        answered,
        average: answered ? round2(sum / answered) : null,
        min: answered ? nums[0] : null,
        max: answered ? nums[answered - 1] : null,
        median: median === null ? null : round2(median),
        sum: round2(sum),
      };
    }
    case 'matrix': {
      const columns = (q.options || []).map((o) => o.label);
      const rows = (q.rows || []).map((row) => {
        const counts = new Array(columns.length).fill(0);
        let rowAnswered = 0;
        for (const v of present) {
          const chosen = v && typeof v === 'object' ? v[row.id] : undefined;
          const idx = columns.indexOf(chosen);
          if (idx >= 0) {
            counts[idx] += 1;
            rowAnswered += 1;
          }
        }
        return { id: row.id, label: row.label, counts, answered: rowAnswered };
      });
      const answered = present.filter((v) => v && typeof v === 'object' && Object.keys(v).length).length;
      return { kind: 'matrix', columns, rows, answered };
    }
    default: {
      // short_text, long_text, email, date
      const entries = [];
      responses.forEach((r) => {
        const v = r.answers?.[q.id];
        if (v !== undefined && v !== null && String(v).trim() !== '') entries.push({ text: String(v), at: r.submittedAt });
      });
      return { kind: 'text', entries, answered: entries.length };
    }
  }
}

/** Statistics for every real question (sections are skipped). */
export function computeStats(survey, responses) {
  const numbers = getQuestionNumbers(survey.questions);
  return (survey.questions || [])
    .filter((q) => q.type !== 'section')
    .map((q) => ({ question: q, number: numbers[q.id], total: responses.length, ...statFor(q, responses) }));
}

/** Text shown for one answer in tables / spreadsheets. Numbers stay numeric. */
export function answerCell(q, value) {
  if (value === undefined || value === null || value === '') return '';
  if (Array.isArray(value)) return value.join('; ');
  if (typeof value === 'number') return value;
  return String(value);
}

/**
 * Flat table of every response (oldest first). Matrix questions get one column per row.
 * Returns { headers: string[], rows: any[][] } where the first two columns are "#" and "Submitted".
 */
export function buildResponseTable(survey, responses) {
  const numbers = getQuestionNumbers(survey.questions);
  const columns = [];
  for (const q of survey.questions || []) {
    if (q.type === 'section') continue;
    const label = `${numbers[q.id]}. ${q.text}`;
    if (q.type === 'matrix') {
      for (const row of q.rows || []) {
        columns.push({ header: `${label} [${row.label}]`, get: (r) => answerCell(q, r.answers?.[q.id]?.[row.id]) });
      }
    } else {
      columns.push({ header: label, get: (r) => answerCell(q, r.answers?.[q.id]) });
    }
  }
  const ordered = [...responses].sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0));
  return {
    headers: ['#', 'Submitted', ...columns.map((c) => c.header)],
    rows: ordered.map((r, i) => [i + 1, formatDateTime(r.submittedAt), ...columns.map((c) => c.get(r))]),
  };
}

/** Responses grouped by calendar day (oldest first): [{ day: 'YYYY-MM-DD', count }] */
export function responsesPerDay(responses) {
  const map = new Map();
  for (const r of responses) {
    if (!r.submittedAt) continue;
    const d = new Date(r.submittedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([day, count]) => ({ day, count }));
}
